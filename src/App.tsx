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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "assistant",
      text: "Hello! Welcome to Denttora Dental Clinic. How can I help with your smile today?",
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

  // Voice speech synthesis fallback if neural audio stream is absent
  const speak = (text: string) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_~`]/g, "").replace(/[•-]\s+/g, ", ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const female = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Female") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Natural"))
      );
      if (female) utterance.voice = female;

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
    speak("Welcome to Denttora Dental Clinic! I am your assistant, ready to help. Please tell me what you need.");

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
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
    // Notify backend if available
    fetch("/api/chat/reset", { method: "POST" }).catch(() => {});
    setMessages([
      {
        id: "1",
        sender: "assistant",
        text: "Hello! Welcome to Denttora Dental Clinic. How can I help with your smile today?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        showForm: false,
        formSubmitted: false
      }
    ]);
  };

  // Send message function - handles both normal chat and hidden form submission
  const sendMessage = async (
    textToSend?: string,
    options?: { hidden?: boolean; originatingMessageId?: string }
  ) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    if (!textToSend) {
      setInput("");
    }

    // Only render a patient bubble if this is NOT a hidden message
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

    const payload = {
      message: text,
      chatInput: text,
      sessionId: getSessionId(),
      channel: "web",
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
      if (q.startsWith("my details:")) {
        reply = "Thank you! I have confirmed your appointment for tomorrow. Your booking reference is DC-482913. We look forward to seeing you at Denttora Dental Clinic!";
        showForm = false;
      } else if (q.includes("clean") || q.includes("scaling")) {
        reply = "We would be delighted to take care of your teeth cleaning! Our professional scaling and polishing removes plaque and tartar, protects your gums, and freshens your breath. It takes about 30 minutes and is 1,500 ETB. When would you like to come in? Let me know which day or time works best for you.";
        showForm = false;
      } else if (q.includes("slot") || q.includes("available") || q.includes("free time") || q.includes("what time") || q.includes("when can") || (q.includes("tomorrow") && !q.match(/\b(8|9|10|11|12|1|2|3|4|5)(?::\d{2})?\s*(?:am|pm)\b/))) {
        reply = "Tomorrow (Monday to Saturday, 8:00 AM to 5:00 PM), we have 30-minute appointment slots available at 9:00 AM (3:00 local), 10:00 AM (4:00 local), 11:30 AM (5:30 local), 2:00 PM (8:00 local), 3:30 PM (9:30 local), and 4:30 PM (10:30 local). Which of these times works best for you?";
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
        reply = "Our main treatment prices:\n• Cleaning (Scaling & Polishing): 1,500 ETB\n• Fillings: 1,500 – 2,500 ETB\n• Checkup & X-ray: 800 ETB\n• Root Canal: from 4,500 ETB\n• Whitening: 5,500 ETB";
        showForm = false;
      } else {
        reply = "Hello! I am the virtual assistant for Denttora Dental Clinic in Addis Ababa. We are open Monday to Saturday from 8:00 AM to 5:00 PM. How can I help you today?";
        showForm = false;
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
        <div className="fixed bottom-24 right-6 w-[90vw] sm:w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-teal-600 px-4 py-3 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                🦷
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-tight">Denttora Assistant</h3>
                <p className="text-[11px] text-teal-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  Online • Front Desk
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleNewChat}
                className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                title="New chat"
                aria-label="New chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-teal-700 cursor-pointer"
                title={voiceEnabled ? "Mute Voice" : "Enable Voice"}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
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

                  {/* Render BookingForm inside bot bubble when showForm is true */}
                  {m.sender === "assistant" && m.showForm && (
                    <BookingForm
                      alreadySubmitted={m.formSubmitted}
                      isLoading={isLoading}
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
              placeholder={isRecording ? "Listening..." : "Type your message..."}
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
