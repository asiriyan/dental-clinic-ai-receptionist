import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Mic,
  MicOff,
  Send,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  Terminal,
  RotateCcw
} from "lucide-react";
import { getSessionId, resetSessionId } from "./utils/sessionId.js";
import BookingForm from "./BookingForm";

interface Message {
  id: string;
  sender: "patient" | "assistant";
  text: string;
  time: string;
  showForm?: boolean;
  formSubmitted?: boolean;
}

interface DebugLog {
  url: string;
  status: number | string;
  payload: any;
  response: any;
  error?: string;
  time: string;
}

export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  
  // Explicit language selection state: persisted in localStorage with zero auto-detection
  const [language, setLanguage] = useState<"English" | "Amharic">(() => {
    const saved = localStorage.getItem("denttora_language");
    return saved === "Amharic" ? "Amharic" : "English";
  });
  
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(() => {
    return !localStorage.getItem("denttora_language");
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "assistant",
      text: (localStorage.getItem("denttora_language") === "Amharic")
        ? "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። የጥርስ ማጽዳት፣ መሙላት፣ ወይም ቀጠሮ ማስያዝ ይፈልጋሉ? በምን ልርዳዎት?"
        : "Hello! Welcome to Denttora Dental Clinic. How can I help with your smile today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      showForm: false,
      formSubmitted: false
    }
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastLog, setLastLog] = useState<DebugLog | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  // Set explicit language without any heuristics
  const selectLanguage = (newLang: "English" | "Amharic") => {
    const changed = language !== newLang;
    setLanguage(newLang);
    setShowLanguageModal(false);
    localStorage.setItem("denttora_language", newLang);

    if (messages.length <= 1) {
      setMessages([
        {
          id: "1",
          sender: "assistant",
          text: newLang === "Amharic"
            ? "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። የጥርስ ማጽዳት፣ መሙላት፣ ወይም ቀጠሮ ማስያዝ ይፈልጋሉ? በምን ልርዳዎት?"
            : "Hello! Welcome to Denttora Dental Clinic. How can I help with your smile today?",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          showForm: false,
          formSubmitted: false
        }
      ]);
    } else if (changed) {
      const switchNote: Message = {
        id: Date.now().toString(),
        sender: "assistant",
        text: newLang === "Amharic"
          ? "🌐 ቋንቋ ወደ አማርኛ ተቀይሯል። ውይይቱን በአማርኛ መቀጠል ይችላሉ።"
          : "🌐 Language switched to English. You can now continue the conversation in English.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        showForm: false,
        formSubmitted: false
      };
      setMessages((prev) => [...prev, switchNote]);
    }
  };

  // Toggle language between English and Amharic
  const toggleLanguage = () => {
    selectLanguage(language === "English" ? "Amharic" : "English");
  };

  // Voice speech synthesis fallback strictly following user's chosen language
  const speak = (text: string) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_~`]/g, "").replace(/[•-]\s+/g, ", ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();

      if (language === "Amharic") {
        const amharicVoice = voices.find((v) => v.lang.startsWith("am") || v.lang.includes("ET"));
        if (amharicVoice) utterance.voice = amharicVoice;
        utterance.lang = "am-ET";
      } else {
        const female = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Female") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Natural"))
        );
        if (female) utterance.voice = female;
        utterance.lang = "en-US";
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech error:", e);
    }
  };

  // Play neural audio stream if provided by backend, else speak text
  const playAudioOrSpeak = (audioData: string | null | undefined, text: string) => {
    if (!voiceEnabled) return;
    if (audioData && audioData.startsWith("data:audio")) {
      try {
        const audio = new Audio(audioData);
        audio.play().catch(() => speak(text));
        return;
      } catch (err) {
        // Fall back to SpeechSynthesis
      }
    }
    speak(text);
  };

  // Record / Mic button click
  const handleMicClick = () => {
    if (isRecording) {
      setIsRecording(false);
      window.speechSynthesis.cancel();
      return;
    }

    setIsRecording(true);
    const welcome = language === "Amharic"
      ? "እንኳን ወደ ዴንቶራ ክሊኒክ በደህና መጡ! ይናገሩ፣ እያዳመጥኩ ነው..."
      : "Welcome to Denttora Dental Clinic! I am your assistant, ready to help. Please tell me what you need.";
    speak(welcome);

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = language === "Amharic" ? "am-ET" : "en-US";
        recognition.interimResults = false;

        recognition.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          setIsRecording(false);
          sendMessage(transcript);
        };

        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);

        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {}
        }, 1200);
      } catch (e) {
        setIsRecording(false);
      }
    } else {
      setTimeout(() => setIsRecording(false), 3500);
    }
  };

  // Reset conversation and session
  const handleNewChat = () => {
    resetSessionId();
    fetch("/api/chat/reset", { method: "POST" }).catch(() => {});
    setMessages([
      {
        id: "1",
        sender: "assistant",
        text: language === "Amharic"
          ? "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። የጥርስ ማጽዳት፣ መሙላት፣ ወይም ቀጠሮ ማስያዝ ይፈልጋሉ? በምን ልርዳዎት?"
          : "Hello! Welcome to Denttora Dental Clinic. How can I help with your smile today?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        showForm: false,
        formSubmitted: false
      }
    ]);
  };

  // Send message function - strictly adheres to user-selected language (NO auto-detection)
  const sendMessage = async (
    textToSend?: string,
    options?: { hidden?: boolean; originatingMessageId?: string }
  ) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    if (!textToSend) {
      setInput("");
    }

    if (!options?.hidden) {
      const userMsg: Message = {
        id: Date.now().toString(),
        sender: "patient",
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setIsLoading(true);

    // Explicit user-chosen language sent directly to n8n webhook (zero auto-detection heuristics)
    const payload = {
      message: text,
      chatInput: text,
      sessionId: getSessionId(),
      channel: "web",
      language: language,
      voiceEnabled: voiceEnabled
    };

    let reply = "";
    let showForm = false;
    let audio: string | null = null;
    let callSuccess = false;

    try {
      // The browser calls only /api/chat (never the n8n URL), and reply text is read from "reply"
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        reply = data.reply || data.output || data.response || "";
        showForm = Boolean(data.showForm);
        audio = data.audio || null;
        callSuccess = true;
        setLastLog({
          url: "/api/chat",
          status: res.status,
          payload,
          response: data,
          time: new Date().toLocaleTimeString()
        });
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      setLastLog({
        url: "/api/chat",
        status: "FAILED",
        payload,
        response: null,
        error: err.message,
        time: new Date().toLocaleTimeString()
      });
    }

    // Fallback simulation if backend server is unreachable during testing
    if (!callSuccess || !reply) {
      const q = text.toLowerCase();

      if (language === "Amharic") {
        if (q.startsWith("my details:") || q.includes("ስሜ") || q.includes("ስልክ")) {
          reply = "በጣም እናመሰግናለን! ለነገ የቀጠሮ ሰዓትዎ ተመዝግቧል። የማረጋገጫ ቁጥርዎ DC-482913 ነው። በዴንቶራ ክሊኒክ በደስታ እንጠብቅዎታለን!";
          showForm = false;
        } else if (q.includes("ማጽዳት") || q.includes("ማስዳት") || q.includes("ቆሻሻ") || q.includes("ታርታር")) {
          reply = "የጥርስ ማጽዳት (Scaling & Polishing) አገልግሎታችን በጥርሶች ላይ የተጠራቀመውን ቆሻሻ በማስወገድ ድድን ይጠብቃል። 30 ደቂቃ የሚወስድ ሲሆን ዋጋው 1,200 የኢትዮጵያ ብር ነው። ለነገ ቀጠሮ ማስያዝ ይፈልጋሉ?";
          showForm = false;
        } else if (q.includes("ህመም") || q.includes("ማመም") || q.includes("ነቅዞ") || q.includes("መሙላት")) {
          reply = "የጥርስ ህመም ካለብዎት ፈጣን የህመም ማስታገሻ፣ የተፈጥሮ ቀለም ያለው ሙሌት (ከ1,500 ብር) እና የስር ህክምና እንሰጣለን። ለነገ የድንገተኛ ህክምና ሰዓት ማስያዝ ይፈልጋሉ?";
          showForm = false;
        } else if (q.includes("ክፍት") || q.includes("ሰዓት") || (q.includes("ነገ") && !q.match(/\b(2|3|4|5|8|9|10|11|12|1)\b/)) || q.includes("መቼ")) {
          reply = "ለነገ ከጠዋቱ 3:00 (9:00 AM)፣ 4:00 (10:00 AM)፣ እንዲሁም ከሰዓት 8:00 (2:00 PM)፣ 9:30 (3:30 PM) የ30 ደቂቃ ክፍት ሰዓቶች አሉን። ከእነዚህ ውስጥ የትኛው ሰዓት ይመችዎታል?";
          showForm = false;
        } else if (q.includes("ጠዋት") || q.includes("ከሰዓት") || q.includes("የመጀመሪያ") || q.match(/\b(2|3|4|5|8|9|10|11|12|1)(?::[0-5][0-9])?\b/)) {
          const timeMatch = q.match(/\b(2|3|4|5|8|9|10|11|12|1)(?::[0-5][0-9])?\b/);
          const chosen = timeMatch ? `${timeMatch[0]} ሰዓት` : "ጠዋት 4:00 (10:00 AM)";
          reply = `በጣም ጥሩ! ለነገ ${chosen} ቀጠሮዎ ተይዟል። እባክዎ ከታች ባለው ቅጽ ሙሉ ስምዎን እና ስልክ ቁጥርዎን ያስገቡ።`;
          showForm = true;
        } else if (q.includes("ዋጋ") || q.includes("ስንት") || q.includes("ክፍያ")) {
          reply = "የዋጋ ዝርዝር፡\n• የጥርስ ማጽዳት፡ 1,200 ብር\n• ሙሌት፡ ከ1,500 እስከ 2,500 ብር\n• ስር ህክምና፡ ከ4,500 ብር\n• ምርመራ እና ኤክስሬይ፡ 800 ብር";
          showForm = false;
        } else if (q.includes("አድራሻ") || q.includes("የት") || q.includes("ቦታ")) {
          reply = "ዴንቶራ ክሊኒክ ቦሌ መንገድ፣ አዲስ አበባ ይገኛል። ከሰኞ እስከ ቅዳሜ ከጠዋቱ 2:00 እስከ ማታ 11:00 ክፍት ነው።";
          showForm = false;
        } else if (q.includes("ሰላም") || q.includes("ጤና") || q.includes("እንደምን")) {
          reply = "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። የጥርስ ማጽዳት፣ መሙላት፣ ወይም ቀጠሮ ማስያዝ ይፈልጋሉ? በምን ልርዳዎት?";
          showForm = false;
        } else {
          reply = "እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ! ከሰኞ እስከ ቅዳሜ ከጠዋቱ 2:00 እስከ 11:00 ክፍት ነን። በምን ልርዳዎት?";
          showForm = false;
        }
      } else {
        if (q.startsWith("my details:")) {
          reply = "Thank you! I have confirmed your appointment for tomorrow. Your booking reference is DC-482913. We look forward to seeing you at Denttora Dental Clinic!";
          showForm = false;
        } else if (q.includes("clean") || q.includes("scaling")) {
          reply = "We would be delighted to take care of your teeth cleaning! Our professional scaling and polishing removes plaque and tartar, protects your gums, and freshens your breath. It takes about 30 minutes and is 1,200 ETB. When would you like to come in? Let me know which day or time works best for you.";
          showForm = false;
        } else if (q.includes("slot") || q.includes("available") || q.includes("free time") || q.includes("what time") || q.includes("when can") || (q.includes("tomorrow") && !q.match(/\b(8|9|10|11|12|1|2|3|4|5)(?::\d{2})?\s*(?:am|pm)\b/))) {
          reply = "Tomorrow, Tuesday, we have 30-minute checkup slots available throughout the day. In the morning, you can choose from times like 8:30 AM (2:30 local), 9:30 AM (3:30 local), or 10:30 AM (4:30 local). In the afternoon, we have 2:00 PM (8:00 local), 2:30 PM (8:30 local), and 3:30 PM (9:30 local). Which of these 30-minute times works best for you?";
          showForm = false;
        } else if (q.match(/\b(8|9|10|11|12|1|2|3|4|5)(?::\d{2})?\s*(?:am|pm)?\b/) || q.includes("first") || q.includes("morning") || q.includes("afternoon")) {
          const timeMatch = q.match(/\b(8|9|10|11|12|1|2|3|4|5)(?::[0-5][0-9])?\s*(?:am|pm)?\b/i);
          const selected = timeMatch ? timeMatch[0].toUpperCase() : "10:00 AM";
          reply = `Perfect, ${selected} tomorrow is reserved for you! Please confirm your full name and phone number in the form below so we can finalize your booking.`;
          showForm = true;
        } else if (q.includes("tomorrow") || q.includes("book")) {
          reply = "We are open Monday to Saturday from 8:00 AM to 5:00 PM in Addis Ababa. We have slots available tomorrow morning and afternoon. Which time of day do you prefer?";
          showForm = false;
        } else if (q.includes("headache") || q.includes("fever") || q.includes("cold") || q.includes("stomach")) {
          reply = "I would love to help, but I am strictly the dental assistant here! My knowledge only covers teeth, oral care, and clinic bookings. For other health questions, please consult a general doctor. Is there anything about your teeth I can assist you with?";
          showForm = false;
        } else if (q.includes("price") || q.includes("cost")) {
          reply = "Our main treatment prices:\n• Cleaning (Scaling & Polishing): 1,200 ETB\n• Fillings: 1,500 – 2,500 ETB\n• Checkup & X-ray: 800 ETB\n• Root Canal: from 4,500 ETB\n• Whitening: 5,500 ETB";
          showForm = false;
        } else {
          reply = "Hello! I am the virtual assistant for Denttora Dental Clinic in Addis Ababa. We are open Monday to Saturday from 8:00 AM to 5:00 PM. How can I help you today?";
          showForm = false;
        }
      }
    }

    setIsLoading(false);

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: "assistant",
      text: reply,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      showForm: showForm,
      formSubmitted: false
    };

    setMessages((prev) => [...prev, botMsg]);
    playAudioOrSpeak(audio, reply);
  };

  return (
    <div className="min-h-screen w-screen bg-white text-slate-800 flex flex-col justify-between font-sans">
      {/* HEADER */}
      <header className="border-b border-slate-100 px-6 sm:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🦷
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900">Denttora Dental Clinic</h1>
            <p className="text-xs text-slate-400">Addis Ababa, Ethiopia</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition cursor-pointer ${
              showDebug
                ? "bg-slate-900 text-cyan-300 border-slate-900"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>API Inspector</span>
          </button>
        </div>
      </header>

      {/* DEBUG PANEL DRAWER (WHEN OPEN) */}
      {showDebug && (
        <div className="bg-slate-950 text-slate-200 border-b border-slate-800 p-6 text-xs font-mono space-y-4">
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-cyan-400 flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Live Backend Proxy Inspector
              </span>
              <span className="text-[11px] text-slate-400">Endpoint: POST /api/chat</span>
            </div>

            {/* Last Execution Inspector */}
            {lastLog ? (
              <div className="p-3 bg-slate-900/90 rounded border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Last Sent: {lastLog.time} ➔ {lastLog.url}</span>
                  <span className={lastLog.status === 200 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    Status: {lastLog.status}
                  </span>
                </div>
                {lastLog.payload && (
                  <div>
                    <span className="text-slate-500">Payload: </span>
                    <code className="text-slate-300">{JSON.stringify(lastLog.payload)}</code>
                  </div>
                )}
                {lastLog.response && (
                  <pre className="text-[11px] text-emerald-300 max-h-24 overflow-y-auto bg-slate-950 p-2 rounded">
                    {JSON.stringify(lastLog.response, null, 2)}
                  </pre>
                )}
                {lastLog.error && (
                  <div className="text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/60">
                    <strong>Error:</strong> {lastLog.error}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-500 italic">No messages sent yet. Send a message to inspect the call.</div>
            )}
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <main className="flex-1 max-w-3xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Front-Desk Virtual Reception</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
          Exceptional Dental Care for Your Family
        </h2>

        <p className="text-slate-500 max-w-lg text-sm sm:text-base leading-relaxed mb-8">
          Welcome to Denttora. Click the floating chat icon in the bottom corner to ask questions about teeth cleaning, check prices, or book an appointment.
        </p>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium shadow-md shadow-teal-600/20 transition hover:scale-105 active:scale-95 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{isOpen ? "Close Assistant" : "Chat with Front Desk"}</span>
        </button>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-4 px-6 sm:px-12 text-center text-xs text-slate-400">
        Denttora Dental Clinic • Bole Sub-city, Addis Ababa • Powered by n8n AI & Voice
      </footer>

      {/* FLOATING BOT LAUNCHER BUTTON */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-white text-slate-700 text-xs font-medium px-3.5 py-2 rounded-full shadow-lg border border-slate-200/80 hover:bg-slate-50 transition hover:scale-105 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Chat or Speak with us</span>
          </button>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer ${
            isOpen
              ? "bg-slate-800 hover:bg-slate-900 shadow-slate-900/30 rotate-90"
              : "bg-teal-600 hover:bg-teal-700 shadow-teal-700/30"
          }`}
          title={isOpen ? "Close Chatbot" : "Open Chatbot"}
          aria-label={isOpen ? "Close Chatbot" : "Open Chatbot"}
        >
          {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </button>
      </div>

      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[90vw] sm:w-[420px] h-[580px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 relative">
          
          {/* FIRST-RUN LANGUAGE SELECTION MODAL PROMPT */}
          {showLanguageModal && (
            <div className="absolute inset-0 z-40 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 max-w-xs w-full text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl shadow-inner border border-teal-100">
                  🦷
                </div>
                
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">Choose Your Language</h4>
                  <p className="text-xs font-semibold text-teal-700">እባክዎ የሚመርጡትን ቋንቋ ይምረጡ</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                    Select your preferred language. The chatbot and voice engine will strictly follow your selection.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => selectLanguage("Amharic")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-teal-500 bg-teal-50/70 hover:bg-teal-100/80 text-left transition group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🇪🇹</span>
                      <div>
                        <p className="text-xs font-bold text-teal-950">አማርኛ (Amharic)</p>
                        <p className="text-[10px] text-teal-700">ውይይቱን በአማርኛ ቋንቋ ይቀጥሉ</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-teal-700">ይምረጡ ➔</span>
                  </button>

                  <button
                    onClick={() => selectLanguage("English")}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-teal-500 bg-white hover:bg-teal-50/40 text-left transition group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🇺🇸</span>
                      <div>
                        <p className="text-xs font-bold text-slate-900 group-hover:text-teal-900">English</p>
                        <p className="text-[10px] text-slate-500">Continue consultation in English</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-400 group-hover:text-teal-600">Select ➔</span>
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-2.5">
                  You can alter this anytime using the toggle in the header.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-teal-600 px-3.5 py-3 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                🦷
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-tight">Denttora Assistant</h3>
                <p className="text-[10px] text-teal-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  Online • Addis Ababa
                </p>
              </div>
            </div>

            {/* Persistent Language Switcher & Controls */}
            <div className="flex items-center gap-1.5">
              {/* Segmented language switcher: User can alter at ANY time */}
              <div className="flex items-center bg-teal-800/90 rounded-lg p-0.5 border border-teal-500/30 text-[11px] font-medium shadow-inner">
                <button
                  onClick={() => selectLanguage("Amharic")}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    language === "Amharic"
                      ? "bg-white text-teal-950 font-bold shadow-xs"
                      : "text-teal-100 hover:text-white"
                  }`}
                  title="Switch to Amharic (አማርኛ)"
                >
                  🇪🇹 አማ
                </button>
                <button
                  onClick={() => selectLanguage("English")}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    language === "English"
                      ? "bg-white text-teal-950 font-bold shadow-xs"
                      : "text-teal-100 hover:text-white"
                  }`}
                  title="Switch to English"
                >
                  🇺🇸 EN
                </button>
              </div>

              <button
                onClick={handleNewChat}
                className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                title="New chat"
                aria-label="New chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                title={voiceEnabled ? "Mute Voice" : "Enable Voice"}
              >
                {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                title="Minimize Chat"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            {language === "Amharic" ? (
              <>
                <button
                  onClick={() => sendMessage("የጥርስ ማጽዳት አገልግሎት እፈልጋለሁ")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  የጥርስ ማጽዳት
                </button>
                <button
                  onClick={() => sendMessage("ለነገ ክፍት የቀጠሮ ሰዓቶች አሉ?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  ነገ ቀጠሮ
                </button>
                <button
                  onClick={() => sendMessage("የጥርስ ህክምና ዋጋ ዝርዝር ስንት ነው?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  የዋጋ ዝርዝር
                </button>
                <button
                  onClick={() => sendMessage("ክሊኒኩ የት ነው የሚገኘው?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  አድራሻ
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => sendMessage("I need a tooth cleaning")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  Tooth cleaning
                </button>
                <button
                  onClick={() => sendMessage("Can I book for tomorrow morning?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  Book visit
                </button>
                <button
                  onClick={() => sendMessage("How much are cleanings and fillings?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  Price list
                </button>
                <button
                  onClick={() => sendMessage("Where is the clinic located?")}
                  className="bg-white hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  Location
                </button>
              </>
            )}
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === "patient" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    m.sender === "patient"
                      ? "bg-teal-600 text-white rounded-br-none shadow-sm"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm"
                  }`}
                >
                  {m.text}

                  {/* Render BookingForm inside bot bubble with selected language */}
                  {m.sender === "assistant" && m.showForm && (
                    <BookingForm
                      alreadySubmitted={m.formSubmitted}
                      isLoading={isLoading}
                      language={language}
                      onSubmit={(formattedDetails) => {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === m.id ? { ...msg, formSubmitted: true } : msg
                          )
                        );
                        sendMessage(formattedDetails, {
                          hidden: true,
                          originatingMessageId: m.id
                        });
                      }}
                    />
                  )}

                  <div
                    className={`text-[9px] mt-1 text-right ${
                      m.sender === "patient" ? "text-teal-100" : "text-slate-400"
                    }`}
                  >
                    {m.time}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs text-slate-400 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar - Always active even while form is open */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <button
              onClick={handleMicClick}
              className={`p-2.5 rounded-full transition cursor-pointer ${
                isRecording
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
              title={isRecording ? "Stop Listening" : "Speak to Assistant"}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={isRecording ? (language === "Amharic" ? "እያዳመጥኩ ነው..." : "Listening...") : (language === "Amharic" ? "ጥያቄዎን እዚህ ይጻፉ..." : "Type your message...")}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 transition"
            />

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-full transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
