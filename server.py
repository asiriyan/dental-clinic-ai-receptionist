"""
Denttora Dental Clinic - Python Backend Server (FastAPI) [PRODUCTION READY]

Connects:
- n8n workflow  (AI chatbot: Gemini + Pinecone RAG + Google Calendar booking + Deepgram TTS)
- React UI      (Forwarding /api/chat calls without CORS or port isolation issues)
- LiveKit       (Voice room token generation)
- Deepgram      (Speech-to-text transcription)
"""

import os
import re
import time
import uuid
import logging
from typing import Optional
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

try:
    from livekit import api as livekit_api
    HAS_LIVEKIT_SDK = True
except ImportError:
    HAS_LIVEKIT_SDK = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("denttora")

# ---------------------------------------------------------------- .env loader
env_candidates = [
    Path.cwd() / ".env",
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
]
env_loaded_from = None
for env_path in env_candidates:
    if env_path.exists():
        try:
            from dotenv import load_dotenv
            load_dotenv(dotenv_path=env_path)
            env_loaded_from = str(env_path)
            break
        except ImportError:
            with open(env_path, "r", encoding="utf-8") as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line and not _line.startswith("#") and "=" in _line:
                        _k, _v = _line.split("=", 1)
                        _k, _v = _k.strip(), _v.strip().strip('"').strip("'")
                        os.environ.setdefault(_k, _v)
            env_loaded_from = str(env_path)
            break

# --------------------------------------------------------------------- config
# Use 127.0.0.1 by default to prevent IPv6 [::1] connection refused issues
DEFAULT_N8N_URL = os.getenv("N8N_WEBHOOK_URL", "http://127.0.0.1:5678/webhook/dental-chat")
N8N_WEBHOOK_URL = DEFAULT_N8N_URL
N8N_TIMEOUT = float(os.getenv("N8N_TIMEOUT", "90"))
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://your-project.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
ENABLE_SIMULATOR = os.getenv("ENABLE_SIMULATOR", "false").lower() in ("true", "1", "yes")

# Explicit CORS origins for Vite (ports 3000 and 5173) + localhost
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
custom_origins = os.getenv("ALLOWED_ORIGINS")
if custom_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in custom_origins.split(",") if o.strip()])

print("=" * 65)
print("  DENTTORA DENTAL CLINIC FASTAPI BACKEND SERVER")
print("=" * 65)
print(f"• .env Loaded From : {env_loaded_from or 'System Environment'}")
print(f"• N8N_WEBHOOK_URL  : {N8N_WEBHOOK_URL}")
print(f"• N8N_TIMEOUT      : {N8N_TIMEOUT}s")
print(f"• SIMULATOR MODE   : {'ENABLED (Fake Replies)' if ENABLE_SIMULATOR else 'DISABLED (Live n8n Mode)'}")
print(f"• LiveKit SDK      : {'Configured' if (LIVEKIT_API_KEY and LIVEKIT_API_SECRET and HAS_LIVEKIT_SDK) else 'Not Configured'}")
print(f"• Deepgram Key     : {'Configured' if DEEPGRAM_API_KEY else 'Not Configured'}")
print("=" * 65)

app = FastAPI(title="Denttora Dental Clinic API", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in ALLOWED_ORIGINS else ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------- models
class ChatRequest(BaseModel):
    message: Optional[str] = ""
    chatInput: Optional[str] = ""
    sessionId: Optional[str] = None
    phone: Optional[str] = ""
    language: Optional[str] = "English"
    channel: Optional[str] = "web"
    voiceEnabled: Optional[bool] = True


class LiveKitTokenRequest(BaseModel):
    roomName: Optional[str] = None
    participantName: str = "Patient Guest"


# -------------------------------------------------------------------- helpers
_SESSION_OK = re.compile(r"^[A-Za-z0-9_\-:.]{1,100}$")
SESSION_TTL_SECONDS = 45 * 60  # 45 minutes
_server_session_cache: dict = {}


def get_client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "127.0.0.1")
    ua = request.headers.get("user-agent", "generic-client")[:80]
    return f"{ip}::{ua}"


def resolve_session_id(raw: Optional[str], request: Optional[Request] = None, prefix: str = "web") -> str:
    now = time.time()
    header_id = request.headers.get("x-session-id") if request else None
    target_id = (raw or header_id or "").strip()

    if target_id and _SESSION_OK.match(target_id):
        if request:
            client_key = get_client_key(request)
            _server_session_cache[client_key] = {"session_id": target_id, "last_active": now}
        return target_id

    if request:
        client_key = get_client_key(request)
        cached = _server_session_cache.get(client_key)
        if cached and (now - cached["last_active"]) < SESSION_TTL_SECONDS:
            cached["last_active"] = now
            return cached["session_id"]

        new_id = f"{prefix}-{uuid.uuid4().hex[:12]}"
        _server_session_cache[client_key] = {"session_id": new_id, "last_active": now}
        return new_id

    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def normalize_voice_transcript(raw_text: str) -> dict:
    text = (raw_text or "").strip()
    transformations = []
    extracted_ref = None
    extracted_phone = None

    ref_match = re.search(r"\b(?:dc|d\s*c|d\.c\.)[\s-]*(\d{6})\b", text, re.IGNORECASE)
    if ref_match:
        extracted_ref = f"DC-{ref_match.group(1)}"
        text = text[:ref_match.start()] + extracted_ref + text[ref_match.end():]
        transformations.append(f"Standardized booking reference to {extracted_ref}")

    phone_pattern = r"(?:\+?251\s?[79]\d{2}\s?\d{3}\s?\d{3}|0[79]\d{2}\s?\d{3}\s?\d{3}|0[79]\d{8}|\+?251[79]\d{8})"
    phone_match = re.search(phone_pattern, text)
    if phone_match:
        extracted_phone = re.sub(r"\s+", "", phone_match.group(0))
        if extracted_phone.startswith("0"):
            extracted_phone = "+251" + extracted_phone[1:]
        elif not extracted_phone.startswith("+"):
            extracted_phone = "+" + extracted_phone
        text = text[:phone_match.start()] + extracted_phone + text[phone_match.end():]
        transformations.append(f"Normalized phone number to {extracted_phone}")

    cleaned = re.sub(
        r"^(?:um+|uh+|er+|ah+|hey\s+\w+|hello\s+\w+|hi\s+\w+|can\s+you\s+please|could\s+you\s+please|i\s+want\s+to|i'd\s+like\s+to)\s*,?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    if cleaned and cleaned != text:
        transformations.append("Trimmed conversational voice filler")
        text = cleaned

    if text:
        text = text[0].upper() + text[1:]

    return {
        "raw": raw_text,
        "clean": text or raw_text,
        "extracted_ref": extracted_ref,
        "extracted_phone": extracted_phone,
        "transformations": transformations,
    }


def simulate_reply(clean_message: str) -> str:
    m = clean_message.lower()
    is_amharic = bool(re.search(r"[\u1200-\u137F]", clean_message))

    if is_amharic:
        if any(w in m for w in ["ሰላም", "ጤና", "እንደምን"]):
            return "ጤና ይስጥልኝ! እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ። እኛ የጥርስ ማጽዳት፣ መሙላት፣ ስር ህክምና እና የጥርስ ህክምና ቀጠሮዎችን እንሰጣለን። ዛሬ በምን ልርዳዎት?"
        if any(w in m for w in ["ማጽዳት", "ማስዳት", "ቆሻሻ", "ታርታር"]):
            return "የጥርስ ማጽዳት (Scaling) አገልግሎታችን 1,200 ብር ሲሆን፣ 30 ደቂቃ ይወስዳል። ለነገ ቀጠሮ ማስያዝ ይፈልጋሉ?"
        if any(w in m for w in ["ህመም", "ማመም", "ነቅዞ", "መሙላት"]):
            return "የጥርስ ህመም ካለብዎት ፈጣን የህመም ማስታገሻ እና ሙሌት (ከ1,500 ብር) እንሰጣለን። ለነገ ቀጠሮ ማስያዝ ይፈልጋሉ?"
        if any(w in m for w in ["ክፍት", "ሰዓት", "ነገ", "ቀጠሮ"]):
            return "ለነገ ከጠዋቱ 3:00 (9:00 AM)፣ 4:00 (10:00 AM)፣ እንዲሁም ከሰዓት 8:00 (2:00 PM) የ30 ደቂቃ ክፍት ሰዓቶች አሉን። የትኛው ሰዓት ይመችዎታል?"
        if any(w in m for w in ["ዋጋ", "ስንት", "ክፍያ"]):
            return "የዋጋ ዝርዝር፡ የጥርስ ማጽዳት 1,200 ብር፣ ሙሌት ከ1,500 እስከ 2,500 ብር፣ ስር ህክምና ከ4,500 ብር።"
        return "እንኳን ወደ ዴንቶራ የጥርስ ህክምና ክሊኒክ በደህና መጡ! በምን ልርዳዎት?"

    if "clean" in m or "scaling" in m:
        return "We would be delighted to take care of your teeth cleaning! Our scaling and polishing removes tartar, protects gums, and is 1,200 ETB. Would you like to book a slot for tomorrow?"
    if "book" in m or "tomorrow" in m or "slot" in m:
        return "Great! Tomorrow at 10:00 AM (4:00 local time) is available with Dr. Dawit. Please provide your full name and phone number to reserve your appointment."
    return f"Welcome to Denttora Dental Clinic! We received your message: '{clean_message}'. How can we help care for your teeth today?"


import base64

async def generate_deepgram_tts(text: str) -> Optional[str]:
    """Generates high-fidelity neural audio from Deepgram Aura model on the backend (English only)."""
    if not DEEPGRAM_API_KEY or not text or not text.strip():
        return None
    # Never send Amharic to Deepgram English model
    if re.search(r"[\u1200-\u137F]", text):
        return None
    try:
        # Strip markdown syntax and emojis for clean voice speech
        clean = re.sub(r"[*#_~`]", "", text).replace("\n", " ").strip()
        if not clean:
            return None
        log.info("Generating Deepgram TTS on backend for %d chars of text...", len(clean))
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3",
                headers={
                    "Authorization": f"Token {DEEPGRAM_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={"text": clean[:1000]},
            )
            if resp.status_code == 200 and resp.content:
                encoded = base64.b64encode(resp.content).decode("utf-8")
                log.info("Deepgram TTS successfully generated (%d bytes).", len(resp.content))
                return f"data:audio/mpeg;base64,{encoded}"
            else:
                log.warning("Deepgram TTS returned HTTP %s: %s", resp.status_code, resp.text[:200])
                return None
    except Exception as e:
        log.warning("Deepgram TTS generation error: %s", e)
        return None


async def generate_gemini_tts(text: str, language: str = "Amharic") -> Optional[str]:
    """Generates Amharic / multilingual speech using Google Gemini Flash TTS (gemini-3.8-flash-lite-tts)."""
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or not text or not text.strip():
        return None
    try:
        clean = re.sub(r"[*#_~`]", "", text).replace("\n", " ").strip()
        if not clean:
            return None
        is_amharic = bool(re.search(r"[\u1200-\u137F]", clean)) or "am" in language.lower()
        style = "Warm, polite Ethiopian dental clinic assistant speaking natural Amharic" if is_amharic else "Warm dental clinic assistant"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": clean[:1000],
                            "speechMetadata": {"style": style}
                        }
                    ]
                }
            ],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": "Kore"}
                    }
                }
            }
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent?key={gemini_key}",
                headers={"Content-Type": "application/json", "User-Agent": "aistudio-build"},
                json=payload
            )
            if resp.status_code == 200:
                data = resp.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                for part in parts:
                    inline = part.get("inlineData", {})
                    b64 = inline.get("data")
                    if b64:
                        return f"data:audio/wav;base64,{b64}"
            return None
    except Exception as e:
        log.warning("Gemini TTS error: %s", e)
        return None


async def generate_voice_audio(text: str, language: str = "English") -> Optional[str]:
    """
    Intelligent language-based voice router:
    - Amharic: Always bypasses Deepgram Aura and routes to Google Gemini TTS or browser am-ET
    - English: Uses Deepgram Aura if configured, or Gemini TTS fallback
    """
    is_amharic = bool(re.search(r"[\u1200-\u137F]", text)) or "am" in language.lower()
    if is_amharic:
        if os.getenv("GEMINI_API_KEY"):
            return await generate_gemini_tts(text, "Amharic")
        return None
    if DEEPGRAM_API_KEY:
        dg = await generate_deepgram_tts(text)
        if dg:
            return dg
    if os.getenv("GEMINI_API_KEY"):
        return await generate_gemini_tts(text, "English")
    return None


async def call_n8n(message: str, session_id: str, phone: str, channel: str, language: str) -> dict:
    """
    Calls the n8n webhook with automatic IPv4 fallback to prevent localhost ::1 connection errors.
    """
    payload = {
        "chatInput": message,
        "question": message,
        "message": message,
        "sessionId": session_id,
        "phone": phone,
        "channel": channel,
        "language": language,
    }

    # Prepare URL candidates (try configured URL first, then 127.0.0.1 fallback)
    urls_to_try = [N8N_WEBHOOK_URL]
    if "localhost" in N8N_WEBHOOK_URL:
        urls_to_try.append(N8N_WEBHOOK_URL.replace("localhost", "127.0.0.1"))
    elif "127.0.0.1" in N8N_WEBHOOK_URL:
        urls_to_try.append(N8N_WEBHOOK_URL.replace("127.0.0.1", "localhost"))

    last_error = None
    resp = None

    for target_url in urls_to_try:
        try:
            log.info("Forwarding chat query to n8n webhook: %s", target_url)
            async with httpx.AsyncClient(timeout=N8N_TIMEOUT) as client:
                resp = await client.post(target_url, json=payload)
                break  # Successfully connected
        except httpx.TimeoutException:
            log.error("n8n timed out after %ss on %s", N8N_TIMEOUT, target_url)
            raise HTTPException(504, f"n8n webhook did not answer within {N8N_TIMEOUT:.0f}s. Check the execution in n8n.")
        except httpx.HTTPError as e:
            last_error = e
            log.warning("Connection failed on %s: %s. Trying fallback if available...", target_url, e)

    if resp is None:
        log.error("All n8n connection attempts failed. Last error: %s", last_error)
        raise HTTPException(
            502,
            f"Cannot reach n8n at {N8N_WEBHOOK_URL}. Is n8n running on port 5678 and is the workflow ACTIVE? Details: {last_error}",
        )

    if resp.status_code != 200:
        log.error("n8n returned HTTP %s: %s", resp.status_code, resp.text[:300])
        raise HTTPException(
            resp.status_code if resp.status_code in (404, 500, 502) else 502,
            f"n8n returned HTTP {resp.status_code}: {resp.text[:300]}",
        )

    try:
        data = resp.json()
    except ValueError:
        return {
            "reply": resp.text,
            "output": resp.text,
            "audio": None,
            "showForm": False,
            "ttsError": None,
            "n8nError": None,
        }

    raw_text = str(data.get("output") or data.get("reply") or data.get("response") or "")
    # Check for explicit [[FORM]] token from AI Agent
    has_form_marker = bool(re.search(r"\[\[\s*FORM\s*\]\]", raw_text, re.IGNORECASE))
    clean_text = re.sub(r"\[\[\s*FORM\s*\]\]", "", raw_text, flags=re.IGNORECASE)
    clean_text = re.sub(r"[ \t]{2,}", " ", clean_text).strip()

    # Determine if this response represents an error or mere slot listing / inquiry
    is_error_or_listing = bool(re.search(
        r"(?:trouble|cannot check|unable to|connection hiccup|call \+251|error|failed|closed|which time|what time|available slots|which of these|would you like to book)",
        clean_text,
        re.IGNORECASE
    ))

    # The booking form must ONLY appear after a specific slot is agreed upon:
    # 1. [[FORM]] token was emitted by the agent when confirming a chosen slot
    # 2. Or explicit data.showForm flag from n8n
    # 3. Never trigger when listing slots or when a tool error occurs
    show_form = False
    if has_form_marker:
        show_form = True
    elif data.get("showForm") is not None:
        show_form = bool(data.get("showForm")) and not is_error_or_listing
    elif not is_error_or_listing and re.search(r"(?:reserved for you|selected your appointment|confirm your booking below|fill out your details below)", clean_text, re.IGNORECASE) and not re.search(r"DC-\d{6}", clean_text, re.IGNORECASE):
        show_form = True

    return {
        "reply": clean_text,
        "output": clean_text,
        "audio": data.get("audio"),
        "showForm": bool(show_form),
        "ttsError": data.get("ttsError"),
        "n8nError": data.get("error"),
    }


# ------------------------------------------------------------------ endpoints
@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "service": "denttora-dental-clinic-api",
        "timezone": "Africa/Addis_Ababa",
        "n8n_url": N8N_WEBHOOK_URL,
        "simulator_enabled": ENABLE_SIMULATOR,
        "livekit_configured": bool(LIVEKIT_API_KEY and LIVEKIT_API_SECRET and HAS_LIVEKIT_SDK),
        "deepgram_configured": bool(DEEPGRAM_API_KEY),
    }


@app.get("/api/n8n/diagnostic")
async def n8n_diagnostic():
    """Diagnoses webhook connectivity, 404 test URL expiration, and port issues."""
    is_test_url = "/webhook-test/" in N8N_WEBHOOK_URL
    probe = {}

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(
                N8N_WEBHOOK_URL,
                json={"chatInput": "probe_test", "sessionId": "diag-probe", "channel": "diagnostic"},
            )
            probe = {
                "reachable": True,
                "status_code": resp.status_code,
                "response_body_preview": resp.text[:200],
            }
    except Exception as e:
        probe = {
            "reachable": False,
            "error_type": type(e).__name__,
            "error_detail": str(e),
        }

    return {
        "configured_webhook_url": N8N_WEBHOOK_URL,
        "is_test_url": is_test_url,
        "simulator_active": ENABLE_SIMULATOR,
        "probe": probe,
        "advice": (
            "If probe returns 404 with /webhook-test/: Test URLs only accept 1 request per manual canvas click. Switch to /webhook/dental-chat and toggle workflow to ACTIVE."
            if is_test_url
            else "Ensure n8n workflow switch is toggled to ACTIVE in the top-right corner."
        ),
    }


@app.post("/api/chat/reset")
async def reset_session(request: Request):
    client_key = get_client_key(request)
    new_id = f"web-{uuid.uuid4().hex[:12]}"
    _server_session_cache[client_key] = {"session_id": new_id, "last_active": time.time()}
    return JSONResponse(
        content={"status": "reset_success", "sessionId": new_id, "message": "Session reset."},
        headers={"X-Session-Id": new_id},
    )


@app.post("/api/chat")
async def chat_with_n8n(payload: ChatRequest, request: Request):
    query_text = (payload.message or payload.chatInput or "").strip()
    if not query_text:
        raise HTTPException(400, "Missing query text in message or chatInput")

    session_id = resolve_session_id(payload.sessionId, request=request, prefix="web")
    norm = normalize_voice_transcript(query_text)
    clean_message = norm["clean"] or query_text
    clean_phone = payload.phone or norm["extracted_phone"] or ""

    if ENABLE_SIMULATOR:
        sim_reply = simulate_reply(clean_message)
        return JSONResponse(
            content={
                "reply": sim_reply,
                "output": sim_reply,
                "audio": None,
                "source": "python_simulator",
                "showForm": "tomorrow" in clean_message.lower() or "book" in clean_message.lower(),
                "sessionId": session_id,
                "normalized": norm,
            },
            headers={"X-Session-Id": session_id},
        )

    result = await call_n8n(
        clean_message,
        session_id,
        clean_phone,
        payload.channel or "web",
        payload.language or "English",
    )

    reply_text = result.get("reply") or result.get("output") or ""
    audio_data = result.get("audio")

    # Backend TTS: generates audio using Deepgram (English) or Google Gemini Flash TTS (Amharic)
    if not audio_data and payload.voiceEnabled is not False:
        audio_data = await generate_voice_audio(reply_text, payload.language or "English")

    return JSONResponse(
        content={
            "reply": reply_text,
            "output": reply_text,
            "audio": audio_data,
            "showForm": result.get("showForm", False),
            "ttsError": result.get("ttsError"),
            "n8nError": result.get("n8nError"),
            "source": "n8n_live",
            "sessionId": session_id,
            "normalized": norm,
        },
        headers={"X-Session-Id": session_id},
    )


@app.post("/api/livekit/token")
async def generate_livekit_token(req: LiveKitTokenRequest):
    if not (HAS_LIVEKIT_SDK and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(503, "LiveKit is not configured: set LIVEKIT_API_KEY and LIVEKIT_API_SECRET.")

    identity = f"patient-{uuid.uuid4().hex[:8]}"
    room = req.roomName or f"denttora-{uuid.uuid4().hex[:8]}"
    token = (
        livekit_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_name(req.participantName)
        .with_grants(
            livekit_api.VideoGrants(
                room_join=True,
                room=room,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
        .to_jwt()
    )
    return {
        "token": token,
        "livekitUrl": LIVEKIT_URL,
        "roomName": room,
        "identity": identity,
        "sessionId": room,
    }


@app.post("/api/deepgram/transcribe")
async def transcribe_voice(
    file: Optional[UploadFile] = File(None),
    sessionId: Optional[str] = Form(None),
    phone: str = Form(""),
    language: str = Form("English"),
):
    if not file:
        raise HTTPException(400, "Audio file required")
    if not DEEPGRAM_API_KEY:
        raise HTTPException(503, "DEEPGRAM_API_KEY is not set on the server.")

    session_id = resolve_session_id(sessionId, prefix="voice")
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Audio file is empty")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            dg = await client.post(
                "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
                headers={
                    "Authorization": f"Token {DEEPGRAM_API_KEY}",
                    "Content-Type": file.content_type or "audio/webm",
                },
                content=audio_bytes,
            )
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Could not reach Deepgram: {e}")

    if dg.status_code != 200:
        raise HTTPException(502, f"Deepgram speech-to-text failed (HTTP {dg.status_code}).")

    try:
        transcript = dg.json()["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
    except Exception:
        transcript = ""

    if not transcript:
        raise HTTPException(422, "No speech detected in audio.")

    chat_result = await chat_with_n8n(
        ChatRequest(message=transcript, sessionId=session_id, phone=phone, language=language, channel="voice"),
        request=None,
    )
    return {
        "transcription": transcript,
        "n8n_response": chat_result.body,
        "sessionId": session_id,
    }


# -------------------------------------------------------------- static files
static_path = os.path.join(os.path.dirname(__file__), "dist")
if not os.path.exists(static_path):
    static_path = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

    @app.get("/")
    async def serve_landing():
        index_file = os.path.join(static_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "Denttora Dental Clinic API Running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
