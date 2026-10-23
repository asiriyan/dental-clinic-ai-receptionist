import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini Client for multimodal AI & TTS voice synthesis
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Default or configured n8n Webhook URL
let configuredWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/dental-chat';
const N8N_TIMEOUT_MS = parseInt(process.env.N8N_TIMEOUT_MS || '30000', 10);
const SESSION_TTL_MS = 45 * 60 * 1000; // 45 minutes

interface SessionEntry {
  sessionId: string;
  createdAt: number;
  lastActive: number;
  messageCount: number;
}

const sessionStore = new Map<string, SessionEntry>();

// Periodic session cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sessionStore.entries()) {
    if (now - entry.lastActive > SESSION_TTL_MS) {
      sessionStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

function resolveServerSession(req: Request, explicitId?: string): { sessionId: string; isNew: boolean } {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
  const ua = (req.headers['user-agent'] || 'generic-client').substring(0, 80);
  const clientKey = `${ip}::${ua}`;
  const now = Date.now();

  const headerId = req.headers['x-session-id'] as string | undefined;
  const targetId = explicitId || headerId;

  if (targetId && targetId.trim().length > 0) {
    const cleanId = targetId.trim();
    sessionStore.set(clientKey, {
      sessionId: cleanId,
      createdAt: now,
      lastActive: now,
      messageCount: (sessionStore.get(clientKey)?.messageCount || 0) + 1,
    });
    return { sessionId: cleanId, isNew: false };
  }

  const existing = sessionStore.get(clientKey);
  if (existing && now - existing.lastActive < SESSION_TTL_MS) {
    existing.lastActive = now;
    existing.messageCount += 1;
    return { sessionId: existing.sessionId, isNew: false };
  }

  const newSessionId = `denttora-${crypto.randomUUID ? crypto.randomUUID().substring(0, 8) : Math.random().toString(36).substring(2, 10)}`;
  sessionStore.set(clientKey, {
    sessionId: newSessionId,
    createdAt: now,
    lastActive: now,
    messageCount: 1,
  });
  return { sessionId: newSessionId, isNew: true };
}

/**
 * Health Check Endpoint
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'denttora-webhook-diagnostic-server',
    activeSessions: sessionStore.size,
    configuredWebhookUrl,
    timeoutMs: N8N_TIMEOUT_MS,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Update configured webhook URL dynamically from the UI
 */
app.post('/api/n8n/config', (req: Request, res: Response) => {
  const { webhookUrl } = req.body;
  if (webhookUrl && typeof webhookUrl === 'string') {
    configuredWebhookUrl = webhookUrl.trim();
  }
  res.json({
    status: 'updated',
    configuredWebhookUrl,
  });
});

/**
 * Deep diagnostic probe for any n8n webhook URL
 */
app.post('/api/n8n/diagnostic', async (req: Request, res: Response) => {
  const targetUrl = (req.body.webhookUrl || configuredWebhookUrl || '').trim();
  if (!targetUrl) {
    return res.status(400).json({ error: 'Webhook URL is required' });
  }

  const isTestUrl = targetUrl.includes('/webhook-test/');
  const isProdUrl = targetUrl.includes('/webhook/') && !isTestUrl;
  const isLocalhost = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1');

  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (isTestUrl) {
    warnings.push("⚠️ URL is using the n8n TEST webhook endpoint (/webhook-test/). In n8n, test URLs ONLY accept a request while the 'Listen for test event' button has been actively clicked in the workflow canvas. It automatically expires after ONE request!");
    suggestions.push("Switch your endpoint to the Production Webhook URL: replace '/webhook-test/' with '/webhook/' and toggle the workflow switch at the top-right of n8n to 'ACTIVE'.");
  }

  if (isLocalhost) {
    warnings.push("⚠️ Target URL points to 'localhost' or '127.0.0.1'. If this backend or client is running in a cloud/container environment, 'localhost' points to the container itself, not your host machine.");
    suggestions.push("If running n8n locally on your computer, use ngrok or Cloudflare Tunnel (e.g. `ngrok http 5678`) to expose a public HTTPS URL, or use host.docker.internal if within Docker.");
  }

  const startTime = Date.now();
  let probeResult: any = {
    targetUrl,
    isTestUrl,
    isProdUrl,
    isLocalhost,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const testPayload = {
      chatInput: "Hello, diagnostic ping from Denttora Studio",
      question: "Hello, diagnostic ping from Denttora Studio",
      message: "Hello, diagnostic ping from Denttora Studio",
      sessionId: `diag-${Date.now().toString(36)}`,
      channel: "diagnostic",
      language: "English"
    };

    const fetchRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DenttoraDiagnostic/1.0',
      },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const durationMs = Date.now() - startTime;
    const responseText = await fetchRes.text();
    let responseJson: any = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      // not json
    }

    probeResult.reachable = true;
    probeResult.httpStatus = fetchRes.status;
    probeResult.httpStatusText = fetchRes.statusText;
    probeResult.durationMs = durationMs;
    probeResult.responsePreview = responseText.substring(0, 500);
    probeResult.responseJson = responseJson;

    if (fetchRes.status === 404) {
      if (isTestUrl) {
        probeResult.diagnosis = "EXPIRED_OR_NOT_LISTENING_TEST_WEBHOOK";
        probeResult.diagnosisTitle = "n8n Test Webhook Not Listening (404 Not Found)";
        probeResult.rootCause = "In n8n, a test webhook only listens when you click 'Listen for test event' in the Webhook node editor. Once 1 event arrives or 120 seconds pass, n8n stops listening and returns 404.";
        suggestions.unshift("Click 'Listen for test event' inside your Webhook node in n8n, then re-test immediately; OR switch to the Production URL and toggle the workflow to ACTIVE.");
      } else {
        probeResult.diagnosis = "WORKFLOW_INACTIVE_OR_WRONG_PATH";
        probeResult.diagnosisTitle = "Workflow Inactive or Path Mismatch (404 Not Found)";
        probeResult.rootCause = "The workflow is toggled to Inactive in n8n, or the webhook path 'dental-chat' doesn't match the path configured inside the Webhook node.";
        suggestions.unshift("Open n8n, go to the top-right corner, and toggle the switch from INACTIVE to ACTIVE.");
      }
    } else if (fetchRes.status === 200) {
      probeResult.diagnosis = "SUCCESS";
      probeResult.diagnosisTitle = "Webhook Triggered Successfully (200 OK)";
      probeResult.rootCause = "The webhook is listening, reachable, and returned a valid response!";
    } else if (fetchRes.status === 500 || fetchRes.status === 502) {
      probeResult.diagnosis = "WORKFLOW_NODE_CRASH";
      probeResult.diagnosisTitle = `Workflow Execution Error (Status ${fetchRes.status})`;
      probeResult.rootCause = "The webhook triggered, but an internal node (such as Gemini API key, Pinecone credentials, or Deepgram TTS) failed during execution.";
      suggestions.unshift("Check the 'Executions' tab in the left sidebar of n8n to inspect which node threw the error.");
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    probeResult.reachable = false;
    probeResult.durationMs = durationMs;
    probeResult.errorName = err.name;
    probeResult.errorMessage = err.message;

    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      probeResult.diagnosis = "TIMEOUT";
      probeResult.diagnosisTitle = "Request Timed Out";
      probeResult.rootCause = "The webhook server took more than 8 seconds to respond, or the host is unresponsive.";
      suggestions.push("Check if n8n is running and reachable from this network.");
    } else if (err.message?.includes('ECONNREFUSED')) {
      probeResult.diagnosis = "CONNECTION_REFUSED";
      probeResult.diagnosisTitle = "Connection Refused (n8n Not Running or Port Blocked)";
      probeResult.rootCause = "Nothing is listening at this address and port. n8n might be stopped or running on a different port.";
      suggestions.push("Verify that n8n is running (`n8n start`) on port 5678.");
    } else {
      probeResult.diagnosis = "NETWORK_ERROR";
      probeResult.diagnosisTitle = "Network / DNS Error";
      probeResult.rootCause = err.message;
    }
  }

  return res.json({
    probeResult,
    warnings,
    suggestions,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Reset server session
 */
app.post('/api/chat/reset', (req: Request, res: Response) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
  const ua = (req.headers['user-agent'] || 'generic-client').substring(0, 80);
  const clientKey = `${ip}::${ua}`;

  const newSessionId = `denttora-${Math.random().toString(36).substring(2, 10)}`;
  sessionStore.set(clientKey, {
    sessionId: newSessionId,
    createdAt: Date.now(),
    lastActive: Date.now(),
    messageCount: 0,
  });

  res.json({
    status: 'reset_success',
    sessionId: newSessionId,
    message: 'Session has been reset. Next message will start a fresh conversation.',
  });
});

/**
 * Voice Synthesis Engine:
 * - English: Uses Deepgram Aura (aura-2-thalia-en) if DEEPGRAM_API_KEY is present, with Gemini TTS as fallback.
 * - Amharic: Strictly bypasses Deepgram (which lacks Ge'ez grapheme/phoneme support) and uses Google Gemini Flash TTS (gemini-3.8-flash-lite-tts), or client-side Web Speech API (am-ET).
 */
async function generateDeepgramTTS(text: string): Promise<string | null> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey || !text?.trim()) return null;
  // Never send Amharic to Deepgram English model
  if (/[\u1200-\u137F]/.test(text)) return null;

  try {
    const clean = text.replace(/[*#_~`]/g, '').replace(/\n+/g, ' ').trim();
    if (!clean) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: clean.substring(0, 1000) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:audio/mpeg;base64,${base64}`;
    }
    return null;
  } catch (err: any) {
    console.warn('[Deepgram TTS Warning]:', err.message);
    return null;
  }
}

async function generateGeminiTTS(text: string, language?: string): Promise<string | null> {
  if (!ai || !process.env.GEMINI_API_KEY || !text?.trim()) return null;
  try {
    const clean = text.replace(/[*#_~`]/g, '').replace(/\n+/g, ' ').trim();
    if (!clean) return null;

    const isAmharic = /[\u1200-\u137F]/.test(clean) || language?.toLowerCase().includes('am');
    const stylePrompt = isAmharic
      ? 'Warm, polite, and reassuring Ethiopian dental clinic assistant in Addis Ababa speaking natural Amharic'
      : 'Warm, clear, and reassuring dental assistant for Denttora Dental Clinic';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: clean.substring(0, 1000),
              speechMetadata: {
                style: stylePrompt,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return `data:audio/wav;base64,${base64Audio}`;
    }
    return null;
  } catch (err: any) {
    console.warn('[Gemini TTS Warning]:', err.message);
    return null;
  }
}

async function generateVoiceAudio(text: string, language?: string): Promise<string | null> {
  // Strictly honor user choice - no heuristic regex guessing
  const isAmharic = language ? language.toLowerCase().includes('am') : false;

  if (isAmharic) {
    // 1. Amharic: Always use Google Gemini TTS (Deepgram Aura does not support Ge'ez/Amharic)
    if (process.env.GEMINI_API_KEY) {
      const geminiAudio = await generateGeminiTTS(text, 'Amharic');
      if (geminiAudio) return geminiAudio;
    }
    // If server Gemini key is not set, return null -> browser Web Speech API speaks it using device am-ET voice
    return null;
  }

  // 2. English: Try Deepgram first if API key configured
  if (process.env.DEEPGRAM_API_KEY) {
    const deepgramAudio = await generateDeepgramTTS(text);
    if (deepgramAudio) return deepgramAudio;
  }

  // 3. English Fallback: Use Gemini Flash TTS
  if (process.env.GEMINI_API_KEY) {
    return await generateGeminiTTS(text, 'English');
  }

  return null;
}

/**
 * Dedicated TTS Endpoint: /api/tts
 */
app.post('/api/tts', async (req: Request, res: Response) => {
  const { text, language } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter' });
  }
  const isAmharic = language ? language.toLowerCase().includes('am') : false;
  const audio = await generateVoiceAudio(text, language);
  return res.json({
    audio,
    provider: audio
      ? (isAmharic ? 'gemini-tts' : (process.env.DEEPGRAM_API_KEY ? 'deepgram-aura' : 'gemini-tts'))
      : 'browser-speech-fallback'
  });
});

/**
 * Dedicated Voice Transcription Endpoint: /api/transcribe
 * Converts recorded user audio into text using 'gemini-3.5-transcribe'
 * strictly guided by the user's chosen language.
 */
app.post('/api/transcribe', async (req: Request, res: Response) => {
  const { audioData, mimeType, language } = req.body;
  if (!audioData) {
    return res.status(400).json({ error: 'Missing audioData parameter' });
  }

  if (!ai || !process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Audio transcription requires Gemini API.',
      provider: 'none',
    });
  }

  try {
    const isAmharic = language ? language.toLowerCase().includes('am') : false;
    const base64Data = audioData.includes('base64,') ? audioData.split('base64,')[1] : audioData;
    const targetMime = mimeType || 'audio/webm';

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: targetMime,
                data: base64Data,
              },
            },
            {
              text: isAmharic
                ? 'Transcribe this spoken Amharic audio into accurate Ge\'ez script text. Return only the transcribed text.'
                : 'Transcribe this spoken English audio into accurate text. Return only the transcribed text.',
            },
          ],
        },
      ],
    });

    const transcript = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return res.json({
      transcript,
      language: isAmharic ? 'Amharic' : 'English',
      provider: 'gemini-3.5-transcribe',
    });
  } catch (err: any) {
    console.warn('[Gemini Transcribe Warning]:', err.message);
    return res.status(500).json({ error: err.message, transcript: '' });
  }
});

/**
 * Chat Proxy Endpoint
 * Sends message to n8n webhook; if n8n is offline or unreachable, provides simulated fallback with diagnostic hints!
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { chatInput, question, message, sessionId: incomingSessionId, language, channel, webhookUrl, forceSimulate } = req.body;
    const query = (chatInput || question || message || '').trim();

    if (!query) {
      return res.status(400).json({
        error: 'Missing query text',
        status: 400,
      });
    }

    const { sessionId, isNew } = resolveServerSession(req, incomingSessionId);
    const targetUrl = (webhookUrl || configuredWebhookUrl || '').trim();

    // If forceSimulate requested or no webhook URL provided
    if (forceSimulate || !targetUrl) {
      const sim = generateSimulatedResponse(query, sessionId, language);
      if (req.body.voiceEnabled !== false) {
        sim.audio = await generateVoiceAudio(sim.reply, language);
      }
      return res.json(sim);
    }

    const payload = {
      chatInput: query,
      question: query,
      message: query,
      sessionId: sessionId,
      language: language || 'English',
      channel: channel || 'web',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
    let webhookRes: any;

    try {
      webhookRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DenttoraChatProxy/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!webhookRes.ok) {
      const errorText = await webhookRes.text();
      return res.status(webhookRes.status).json({
        output: `Webhook returned HTTP ${webhookRes.status} (${webhookRes.statusText}).`,
        reply: `Webhook returned HTTP ${webhookRes.status}.`,
        error: `HTTP_${webhookRes.status}`,
        errorDetails: errorText,
        isTestUrl: targetUrl.includes('/webhook-test/'),
        sessionId,
        hint: targetUrl.includes('/webhook-test/')
          ? "You are using a Test Webhook URL. It only triggers when 'Listen for test event' is active in n8n. After 1 request, n8n automatically deactivates it. Switch to the Production URL and toggle the workflow to ACTIVE."
          : "Check if the n8n workflow is toggled to ACTIVE in the top right of n8n, and inspect the Executions tab.",
      });
    }

    const data = await webhookRes.json();
    const rawOutput = data.output || data.reply || data.response || (typeof data === 'string' ? data : '');
    const hasFormMarker = /\[\[\s*FORM\s*\]\]/i.test(rawOutput);
    const outputText = rawOutput.replace(/\[\[\s*FORM\s*\]\]/gi, '').trim();

    let audioData = data.audio || null;

    // Backend TTS: generates audio using Deepgram (English) or Google Gemini Flash TTS (Amharic)
    if (!audioData && req.body.voiceEnabled !== false) {
      audioData = await generateVoiceAudio(outputText, language);
    }

    // Determine if message is an error or inquiring about/listing available times
    const isErrorOrListing = /(?:trouble|cannot check|unable to|connection hiccup|call \+251|error|failed|closed|which time|what time|available slots|which of these|would you like to book)/i.test(outputText);

    let showForm = false;
    if (hasFormMarker) {
      showForm = true;
    } else if (data.showForm !== undefined) {
      showForm = Boolean(data.showForm) && !isErrorOrListing;
    } else if (!isErrorOrListing && /(?:reserved for you|selected your appointment|confirm your booking below|fill out your details below)/i.test(outputText) && !/DC-\d{6}/i.test(outputText)) {
      showForm = true;
    }

    res.setHeader('X-Session-Id', sessionId);
    return res.json({
      output: outputText,
      reply: outputText,
      audio: audioData,
      showForm: showForm,
      sessionId: sessionId,
      source: 'n8n_live',
      error: data.error || null,
      ttsError: data.ttsError || null,
    });
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError' || error.message?.includes('aborted');
    return res.status(502).json({
      output: isTimeout
        ? 'The dental assistant timed out waiting for n8n (exceeded timeout).'
        : `Could not reach n8n webhook at: ${configuredWebhookUrl}. (${error.message})`,
      error: error.message,
      sessionId: req.body.sessionId || 'fallback-session',
      source: 'backend_error',
      hint: 'If n8n is running on your machine, check if n8n is started, or use the Diagnostic Studio tab to test connectivity.',
    });
  }
});

interface SimulatedResponse {
  output: string;
  reply: string;
  audio: string | null;
  sessionId: string;
  source: string;
  showForm?: boolean;
  service?: string;
  price?: string;
  bookingIntent?: boolean;
  timeContext?: string;
  selectedTime?: string;
  phone?: string;
  availableSlots?: string[];
  guardrailTriggered?: boolean;
  [key: string]: any;
}

// Built-in RAG Simulation for Denttora Dental Clinic
function generateSimulatedResponse(query: string, sessionId: string, language?: string): SimulatedResponse {
  const q = query.toLowerCase();
  // Strictly honor user choice - no heuristic regex guessing
  const isAmharic = language ? language.toLowerCase().includes('am') : false;

  if (isAmharic) {
    // Amharic Greetings
    if (q.includes('ሰላም') || q.includes('ጤና') || q.includes('እንደምን')) {
      return {
        output: "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። እኛ የጥርስ ማጽዳት፣ መሙላት፣ ስር ህክምና እና የጥርስ ህክምና ቀጠሮዎችን እንሰጣለን። ዛሬ በምን ልርዳዎት?",
        reply: "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። እኛ የጥርስ ማጽዳት፣ መሙላት፣ ስር ህክምና እና የጥርስ ህክምና ቀጠሮዎችን እንሰጣለን። ዛሬ በምን ልርዳዎት?",
        audio: null,
        sessionId,
        source: 'simulated_rag',
        bookingIntent: false,
      };
    }

    // Amharic Teeth Cleaning (ማጽዳት / ቆሻሻ / ታርታር)
    if (q.includes('ማጽዳት') || q.includes('ማስዳት') || q.includes('ቆሻሻ') || q.includes('ታርታር') || q.includes('ክሊኒንግ')) {
      return {
        output: "የጥርስ ማጽዳት (Scaling & Polishing) አገልግሎታችን በጥርሶች ላይ የተጠራቀመውን ቆሻሻ እና ታርታር በማስወገድ ድድን ከኢንፌክሽን እና ከመሸሽ ይጠብቃል። ህክምናው 30 ደቂቃ የሚወስድ ሲሆን ዋጋው 1,200 የኢትዮጵያ ብር ነው። ለነገ ቀጠሮ ማስያዝ ይፈልጋሉ?",
        reply: "የጥርስ ማጽዳት (Scaling & Polishing) አገልግሎታችን በጥርሶች ላይ የተጠራቀመውን ቆሻሻ እና ታርታር በማስወገድ ድድን ከኢንፌክሽን እና ከመሸሽ ይጠብቃል። ህክምናው 30 ደቂቃ የሚወስድ ሲሆን ዋጋው 1,200 የኢትዮጵያ ብር ነው። ለነገ ቀጠሮ ማስያዝ ይፈልጋሉ?",
        audio: null,
        sessionId,
        source: 'simulated_rag',
        service: 'የጥርስ ማጽዳት (Teeth Cleaning)',
        price: '1,200 ETB',
        bookingIntent: true,
      };
    }

    // Amharic Pain / Cavity / Filling (ህመም / ማመም / ነቅዞ / መሙላት)
    if (q.includes('ህመም') || q.includes('ህመምተኛ') || q.includes('ማመም') || q.includes('ነቅዞ') || q.includes('ነቀዘ') || q.includes('መሙላት') || q.includes('ስቃይ')) {
      return {
        output: "የጥርስ ህመም አብዛኛውን ጊዜ የጥርስ መበስበስ ወደ ውስጥ ነርቭ ሲደርስ ይከሰታል። በክሊኒካችን ጥርስ የማይነቅል የተፈጥሮ ቀለም ያለው ሙሌት (ከ1,500 እስከ 2,500 ብር) እና የስር ህክምና (Root canal) እንሰጣለን። ለነገ የድንገተኛ ህክምና ቀጠሮዎችን ማግኘት ይቻላል። ቀጠሮ ማስያዝ ይፈልጋሉ?",
        reply: "የጥርስ ህመም አብዛኛውን ጊዜ የጥርስ መበስበስ ወደ ውስጥ ነርቭ ሲደርስ ይከሰታል። በክሊኒካችን ጥርስ የማይነቅል የተፈጥሮ ቀለም ያለው ሙሌት (ከ1,500 እስከ 2,500 ብር) እና የስር ህክምና (Root canal) እንሰጣለን። ለነገ የድንገተኛ ህክምና ቀጠሮዎችን ማግኘት ይቻላል። ቀጠሮ ማስያዝ ይፈልጋሉ?",
        audio: null,
        sessionId,
        source: 'simulated_rag',
        service: 'የጥርስ ህመም እና ሙሌት',
        price: '1,500 - 2,500 ETB',
        bookingIntent: true,
      };
    }

    // Amharic Slots & Available Times (ነገ / ሰዓት / ክፍት / ቀጠሮ / መቼ)
    if (q.includes('ክፍት') || q.includes('ሰዓት') || (q.includes('ነገ') && !q.match(/\b(2|3|4|5|8|9|10|11|12|1)\b/)) || q.includes('መቼ')) {
      return {
        output: "ለነገ (ከሰኞ እስከ ቅዳሜ ከጠዋቱ 2:00 እስከ 11:00 ሰዓት)፣ የ30 ደቂቃ ክፍት የቀጠሮ ሰዓቶች አሉን፡\n• ጠዋት፡ 3:00 (9:00 AM)፣ 4:00 (10:00 AM)፣ 5:30 (11:30 AM)\n• ከሰዓት፡ 8:00 (2:00 PM)፣ 9:30 (3:30 PM)፣ 10:30 (4:30 PM)\nከእነዚህ ውስጥ የትኛው ሰዓት ይመችዎታል?",
        reply: "ለነገ (ከሰኞ እስከ ቅዳሜ ከጠዋቱ 2:00 እስከ 11:00 ሰዓት)፣ የ30 ደቂቃ ክፍት የቀጠሮ ሰዓቶች አሉን፡\n• ጠዋት፡ 3:00 (9:00 AM)፣ 4:00 (10:00 AM)፣ 5:30 (11:30 AM)\n• ከሰዓት፡ 8:00 (2:00 PM)፣ 9:30 (3:30 PM)፣ 10:30 (4:30 PM)\nከእነዚህ ውስጥ የትኛው ሰዓት ይመችዎታል?",
        audio: null,
        sessionId,
        source: 'simulated_rag',
        availableSlots: ['ነገ ጠዋት 3:00 (9:00 AM)', 'ነገ ጠዋት 4:00 (10:00 AM)', 'ነገ ከሰዓት 8:00 (2:00 PM)', 'ነገ ከሰዓት 9:30 (3:30 PM)'],
        bookingIntent: true,
        showForm: false,
      };
    }

    // Amharic Choosing a Specific Time (e.g. 4:00, ጠዋት, 10:00, የመጀመሪያው)
    if (q.includes('ጠዋት') || q.includes('ከሰዓት') || q.includes('የመጀመሪያ') || q.match(/\b(2|3|4|5|8|9|10|11|12|1)(?::[0-5][0-9])?\b/)) {
      const timeMatch = q.match(/\b(2|3|4|5|8|9|10|11|12|1)(?::[0-5][0-9])?\b/);
      const chosen = timeMatch ? `${timeMatch[0]} ሰዓት` : 'ጠዋት 4:00 (10:00 AM)';
      return {
        output: `በጣም ጥሩ! ለነገ ${chosen} ቀጠሮዎ ተመዝግቧል። ቀጠሮውን ለማረጋገጥ እባክዎ ከታች ባለው ቅጽ ሙሉ ስምዎን እና ስልክ ቁጥርዎን ያስገቡ።`,
        reply: `በጣም ጥሩ! ለነገ ${chosen} ቀጠሮዎ ተመዝግቧል። ቀጠሮውን ለማረጋገጥ እባክዎ ከታች ባለው ቅጽ ሙሉ ስምዎን እና ስልክ ቁጥርዎን ያስገቡ።`,
        audio: null,
        sessionId,
        source: 'simulated_rag',
        bookingIntent: true,
        showForm: true,
      };
    }

    // Amharic Price inquiry (ዋጋ / ስንት)
    if (q.includes('ዋጋ') || q.includes('ስንት') || q.includes('ክፍያ')) {
      return {
        output: "የዋና ዋና የጥርስ ህክምናዎቻችን የዋጋ ዝርዝር፡\n• የጥርስ ማጽዳት (Scaling): 1,200 ብር\n• የጥርስ ሙሌት: ከ1,500 እስከ 2,500 ብር\n• የጥርስ ስር ህክምና (Root Canal): ከ4,500 ብር\n• የጥርስ ማስተካከል (Orthodontics): በምርመራ የሚወሰን\nለማንኛቸውም አገልግሎቶች ቀጠሮ ማስያዝ ይፈልጋሉ?",
        reply: "የዋና ዋና የጥርስ ህክምናዎቻችን የዋጋ ዝርዝር፡\n• የጥርስ ማጽዳት (Scaling): 1,200 ብር\n• የጥርስ ሙሌት: ከ1,500 እስከ 2,500 ብር\n• የጥርስ ስር ህክምና (Root Canal): ከ4,500 ብር\n• የጥርስ ማስተካከል (Orthodontics): በምርመራ የሚወሰን\nለማንኛቸውም አገልግሎቶች ቀጠሮ ማስያዝ ይፈልጋሉ?",
        audio: null,
        sessionId,
        source: 'simulated_rag',
        bookingIntent: false,
      };
    }

    // Amharic Location / Hours (አድራሻ / የት / ሰዓት)
    if (q.includes('የት') || q.includes('አድራሻ') || q.includes('ቦታ')) {
      return {
        output: "ዴንቶራ የጥርስ ህክምና ክሊኒክ የሚገኘው አዲስ አበባ ቦሌ ክፍለ ከተማ ነው። ከሰኞ እስከ ቅዳሜ ከጠዋቱ 2:00 (8:00 AM) እስከ ማታ 11:00 (5:00 PM) ክፍት ነው። እሁድ ዝግ ነው። ቀጠሮ ማስያዝ ይፈልጋሉ?",
        reply: "ዴንቶራ የጥርስ ህክምና ክሊኒክ የሚገኘው አዲስ አበባ ቦሌ ክፍለ ከተማ ነው። ከሰኞ እስከ ቅዳሜ ከጠዋቱ 2:00 (8:00 AM) እስከ ማታ 11:00 (5:00 PM) ክፍት ነው። እሁድ ዝግ ነው። ቀጠሮ ማስያዝ ይፈልጋሉ?",
        audio: null,
        sessionId,
        source: 'simulated_rag',
      };
    }

    // Default Amharic reply
    return {
      output: "እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ! ክሊኒካችን ቦሌ፣ አዲስ አበባ የሚገኝ ሲሆን የጥርስ ማጽዳት፣ መሙላት እና የቀዶ ጥገና ህክምናዎችን እንሰጣለን። ቀጠሮ ለማስያዝ ወይም ስለ ዋጋ ለመጠየቅ ይችላሉ። በምን ልርዳዎት?",
      reply: "እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ! ክሊኒካችን ቦሌ፣ አዲስ አበባ የሚገኝ ሲሆን የጥርስ ማጽዳት፣ መሙላት እና የቀዶ ጥገና ህክምናዎችን እንሰጣለን። ቀጠሮ ለማስያዝ ወይም ስለ ዋጋ ለመጠየቅ ይችላሉ። በምን ልርዳዎት?",
      audio: null,
      sessionId,
      source: 'simulated_rag',
    };
  }

  // Greeting
  if (/^(hi|hello|hey|good morning|good afternoon|greetings)\b/i.test(q)) {
    return {
      output: "Hello! Welcome to Denttora Dental Clinic in Addis Ababa. How can I help you today? We offer comprehensive dental checkups, teeth cleaning, fillings, root canals, and orthodontic consultations.",
      reply: "Hello! Welcome to Denttora Dental Clinic in Addis Ababa. How can I help you today? We offer comprehensive dental checkups, teeth cleaning, fillings, root canals, and orthodontic consultations.",
      audio: null,
      sessionId,
      source: 'simulated_rag',
      bookingIntent: false,
    };
  }

  // Tooth cleaning / scaling
  if (q.includes('clean') || q.includes('scaling') || q.includes('plaque') || q.includes('hygiene')) {
    return {
      output: "Our professional ultrasonic teeth cleaning removes stubborn plaque and tartar that regular brushing cannot reach. Left untreated, tartar causes gum inflammation, bleeding, and eventual bone loss. We recommend a scaling session every 6 months to keep your smile bright and healthy. Our cleaning is 1,200 ETB. Would you like to schedule an appointment for this week?",
      reply: "Our professional ultrasonic teeth cleaning removes stubborn plaque and tartar that regular brushing cannot reach. Left untreated, tartar causes gum inflammation, bleeding, and eventual bone loss. We recommend a scaling session every 6 months to keep your smile bright and healthy. Our cleaning is 1,200 ETB. Would you like to schedule an appointment for this week?",
      audio: null,
      sessionId,
      source: 'simulated_rag',
      service: 'Teeth Cleaning (Scaling)',
      price: '1,200 ETB',
      bookingIntent: true,
    };
  }

  // Toothache / Filling / Cavity
  if (q.includes('ache') || q.includes('pain') || q.includes('cavity') || q.includes('filling') || q.includes('hurt')) {
    return {
      output: "Tooth pain typically signals active decay or pulp inflammation that requires prompt evaluation before it deepens into the nerve. We provide tooth-colored composite fillings (1,500 - 2,500 ETB) and gentle root canal therapy to relieve pain immediately and save your natural tooth. We have emergency slots available today and tomorrow. Would you like to reserve a consultation slot?",
      reply: "Tooth pain typically signals active decay or pulp inflammation that requires prompt evaluation before it deepens into the nerve. We provide tooth-colored composite fillings (1,500 - 2,500 ETB) and gentle root canal therapy to relieve pain immediately and save your natural tooth. We have emergency slots available today and tomorrow. Would you like to reserve a consultation slot?",
      audio: null,
      sessionId,
      source: 'simulated_rag',
      service: 'Cavity & Pain Relief',
      price: '1,500 - 2,500 ETB',
      bookingIntent: true,
    };
  }

  // Slot inquiry (e.g. asking for available times, tomorrow, slots, today)
  if (q.includes('slot') || q.includes('available') || q.includes('free time') || q.includes('what time') || q.includes('when can') || (q.includes('tomorrow') && !q.match(/\b(8|9|10|11|12|1|2|3|4|5)(?::[0-5][0-9])?\s*(?:am|pm)?\b/))) {
    return {
      output: "Tomorrow (Monday to Saturday, 8:00 AM to 5:00 PM), we have 30-minute appointment slots available at 9:00 AM (3:00 local), 10:00 AM (4:00 local), 11:30 AM (5:30 local), 2:00 PM (8:00 local), 3:30 PM (9:30 local), and 4:30 PM (10:30 local). Which of these times works best for you?",
      reply: "Tomorrow (Monday to Saturday, 8:00 AM to 5:00 PM), we have 30-minute appointment slots available at 9:00 AM (3:00 local), 10:00 AM (4:00 local), 11:30 AM (5:30 local), 2:00 PM (8:00 local), 3:30 PM (9:30 local), and 4:30 PM (10:30 local). Which of these times works best for you?",
      audio: null,
      sessionId,
      source: 'simulated_rag',
      availableSlots: ['Tomorrow 9:00 AM', 'Tomorrow 10:00 AM', 'Tomorrow 11:30 AM', 'Tomorrow 2:00 PM', 'Tomorrow 3:30 PM', 'Tomorrow 4:30 PM'],
      bookingIntent: true,
      showForm: false, // NEVER show form before a specific slot is chosen!
    };
  }

  // Choosing a specific time slot (e.g. patient says 10:00 AM, 2:30 PM, the first one)
  if (q.match(/\b(8|9|10|11|12|1|2|3|4|5)(?::[0-5][0-9])?\s*(?:am|pm)?\b/) || q.includes('first') || q.includes('second') || (q.includes('morning') && !q.includes('good morning')) || q.includes('afternoon')) {
    const timeMatch = q.match(/\b(8|9|10|11|12|1|2|3|4|5)(?::[0-5][0-9])?\s*(?:am|pm)?\b/i);
    const chosenTime = timeMatch ? timeMatch[0].toUpperCase() : '10:00 AM';
    return {
      output: `Wonderful! Tomorrow at ${chosenTime} is reserved for you. Please confirm your full name and phone number in the form below so we can finalize your booking.`,
      reply: `Wonderful! Tomorrow at ${chosenTime} is reserved for you. Please confirm your full name and phone number in the form below so we can finalize your booking.`,
      audio: null,
      sessionId,
      source: 'simulated_rag',
      bookingIntent: true,
      showForm: true, // Show form ONLY now that a slot is selected!
    };
  }

  // General booking question
  if (q.includes('book') || q.includes('appointment') || q.includes('schedule')) {
    return {
      output: "Denttora Dental Clinic is open Monday through Saturday from 8:00 AM to 5:00 PM. We have 30-minute appointment slots available tomorrow morning and afternoon. Which day and time works best for you?",
      reply: "Denttora Dental Clinic is open Monday through Saturday from 8:00 AM to 5:00 PM. We have 30-minute appointment slots available tomorrow morning and afternoon. Which day and time works best for you?",
      audio: null,
      sessionId,
      source: 'simulated_rag',
      bookingIntent: true,
      showForm: false,
    };
  }

  // Out of field guardrail (e.g. general medicine, headache, stomach)
  if (q.includes('headache') || q.includes('stomach') || q.includes('fever') || q.includes('cough') || q.includes('flu')) {
    return {
      output: "At Denttora Dental Clinic, we specialize exclusively in oral health, dental surgery, and orthodontics. For non-dental medical symptoms such as headaches or fevers, we strongly advise consulting a qualified general physician or visiting a primary care hospital. If your headache is accompanied by jaw pain or teeth grinding (TMJ), our dental specialists can examine your bite.",
      reply: "At Denttora Dental Clinic, we specialize exclusively in oral health, dental surgery, and orthodontics. For non-dental medical symptoms such as headaches or fevers, we strongly advise consulting a qualified general physician or visiting a primary care hospital. If your headache is accompanied by jaw pain or teeth grinding (TMJ), our dental specialists can examine your bite.",
      audio: null,
      sessionId,
      source: 'simulated_rag',
      guardrailTriggered: true,
    };
  }

  // Default RAG response
  return {
    output: "Denttora Dental Clinic is located on Bole Road, Addis Ababa, open Monday through Saturday from 8:00 AM to 5:00 PM. We provide preventative dental care, laser teeth whitening, composite restorations, dental crowns, and Invisalign consultations. How may we assist you today?",
    reply: "Denttora Dental Clinic is located on Bole Road, Addis Ababa, open Monday through Saturday from 8:00 AM to 5:00 PM. We provide preventative dental care, laser teeth whitening, composite restorations, dental crowns, and Invisalign consultations. How may we assist you today?",
    audio: null,
    sessionId,
    source: 'simulated_rag',
  };
}

/**
 * Return workflow JSON schemas and architecture breakdown
 */
app.get('/api/workflows/info', (_req: Request, res: Response) => {
  const workflowsDir = path.resolve(__dirname, 'public/workflows');
  const files = ['Dental-Clinic-RAG-CHAT-Fixed.json', 'Dental-Clinic-Booking-API.json', 'Dental-Clinic-Error-Alert.json'];
  const data: Record<string, any> = {};

  for (const file of files) {
    const fullPath = path.join(workflowsDir, file);
    if (fs.existsSync(fullPath)) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(raw);
        data[file] = {
          name: parsed.name,
          nodesCount: parsed.nodes?.length || 0,
          webhookNodes: parsed.nodes?.filter((n: any) => n.type?.includes('webhook')).map((n: any) => ({
            name: n.name,
            path: n.parameters?.path,
            httpMethod: n.parameters?.httpMethod,
            responseMode: n.parameters?.responseMode,
          })) || [],
          hasGemini: parsed.nodes?.some((n: any) => n.type?.includes('GoogleGemini')),
          hasPinecone: parsed.nodes?.some((n: any) => n.type?.includes('vectorStorePinecone')),
          hasDeepgram: parsed.nodes?.some((n: any) => n.name?.includes('TTS') || n.name?.includes('Speech')),
        };
      } catch (err: any) {
        data[file] = { error: err.message };
      }
    }
  }

  res.json({
    workflows: data,
    forensicReasons: [
      {
        id: "single_shot_test_webhook",
        title: "1. The n8n 'Single-Shot Test Webhook' Behavior (Exact Match)",
        description: "Test webhook URLs (/webhook-test/...) are designed for one-time manual node inspection. When you click 'Listen for test event', n8n registers a temporary 120-second socket listener. The moment ONE payload arrives, n8n executes the workflow in the editor and IMMEDIATELY CLOSES the listener. Any subsequent chat messages will be rejected with '404: The workflow is not registered' and will NOT trigger the workflow.",
        fix: "Switch your chat endpoint to the Production Webhook URL (/webhook/dental-chat) and toggle the workflow switch at the top-right corner of n8n to ACTIVE."
      },
      {
        id: "inactive_production_workflow",
        title: "2. Production Workflow Is Inactive (Switch is OFF)",
        description: "If your client calls the production URL (/webhook/dental-chat) but the workflow toggle in n8n is set to Inactive, n8n will refuse the connection with 404.",
        fix: "Click the toggle in the top-right of your n8n workflow canvas from 'Inactive' to 'Active' (green)."
      },
      {
        id: "mixed_content_https_to_http",
        title: "3. Mixed Content Security Block in Browser",
        description: "If your chat app is loaded via HTTPS (e.g. Google Cloud Run, Vercel, or custom domain with SSL) and tries to directly fetch http://localhost:5678 or http://your-ip:5678, modern browsers block the HTTP request before it even reaches the network. The webhook never receives any request.",
        fix: "Route the request through this backend proxy server (/api/chat), or use an HTTPS tunnel for n8n (such as ngrok or cloudflared)."
      },
      {
        id: "vite_server_not_running_express",
        title: "4. Running Vite Alone Without Express Proxy Backend",
        description: "If you started the project with standard 'vite' instead of 'tsx server.ts', the /api/chat route does not exist and Vite returns a 404 HTML page instead of forwarding to n8n.",
        fix: "Ensure the dev server runs 'tsx server.ts' which mounts Vite middlewares into the Express API proxy."
      },
      {
        id: "executions_tab_confusion",
        title: "5. Production Executions Don't Animate the Canvas",
        description: "When webhooks run in production mode (/webhook/...), n8n does NOT animate green lines on the active canvas! Users often believe the webhook did not trigger because nothing moved on the screen.",
        fix: "Click the 'Executions' tab in the left sidebar of n8n to see all incoming webhook logs and execution times."
      }
    ]
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Denttora Server] Listening on port ${PORT}`);
    console.log(`[Denttora Server] Default n8n Webhook: ${configuredWebhookUrl}`);
  });
}

startServer();
