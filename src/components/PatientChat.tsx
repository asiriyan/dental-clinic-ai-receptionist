import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Volume2,
  VolumeX,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Languages,
  ShieldCheck,
  Stethoscope,
  Info
} from 'lucide-react';
import { ChatMessage, BookingAppointment } from '../types';
import { SAMPLE_QUESTIONS, CLINIC_DOCTORS } from '../data/clinicData';

interface PatientChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, forceSimulate?: boolean) => Promise<void>;
  onResetSession: () => Promise<void>;
  sessionId: string;
  isSending: boolean;
  webhookUrl: string;
  useSimulation: boolean;
  setUseSimulation: (val: boolean) => void;
  onOpenDiagnostic: () => void;
}

export const PatientChat: React.FC<PatientChatProps> = ({
  messages,
  onSendMessage,
  onResetSession,
  sessionId,
  isSending,
  webhookUrl,
  useSimulation,
  setUseSimulation,
  onOpenDiagnostic,
}) => {
  const [inputText, setInputText] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('Tomorrow 10:00 AM');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [selectedDentist, setSelectedDentist] = useState(CLINIC_DOCTORS[0].name);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingAppointment | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;
    const text = inputText.trim();
    setInputText('');
    onSendMessage(text, useSimulation);
  };

  const handleSampleClick = (questionText: string) => {
    if (isSending) return;
    onSendMessage(questionText, useSimulation);
  };

  const handlePlayAudio = (msgId: string, base64Audio: string) => {
    if (playingAudioId === msgId) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingAudioId(null);
      }
      return;
    }

    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      audioRef.current = audio;
      setPlayingAudioId(msgId);
      audio.play();
      audio.onended = () => setPlayingAudioId(null);
      audio.onerror = () => setPlayingAudioId(null);
    } catch {
      setPlayingAudioId(null);
    }
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim()) return;

    const booking: BookingAppointment = {
      bookingId: `DC-${Math.floor(100000 + Math.random() * 900000)}`,
      patientName: patientName.trim(),
      phone: patientPhone.trim(),
      service: 'General Dental Examination & Consultation',
      slot: selectedSlot,
      status: 'confirmed',
      dentist: selectedDentist,
      createdAt: new Date().toLocaleString(),
    };

    setConfirmedBooking(booking);
    setShowBookingModal(false);

    // Notify in chat
    onSendMessage(
      `Patient ${booking.patientName} (${booking.phone}) confirmed appointment ${booking.bookingId} for ${booking.slot} with ${booking.dentist}.`,
      true
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Column: Clinic Context & Fast Triggers */}
      <div className="lg:col-span-1 space-y-4">
        {/* Mode Selector Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Connection Engine
            </span>
            <button
              onClick={onResetSession}
              title="Start a fresh chat conversation with new session ID"
              className="text-xs text-slate-400 hover:text-teal-400 flex items-center gap-1 font-mono transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setUseSimulation(false)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                !useSimulation
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              n8n Webhook
            </button>
            <button
              type="button"
              onClick={() => setUseSimulation(true)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                useSimulation
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RAG Simulator
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400 break-all bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
            <div className="text-slate-500 text-[10px] mb-0.5">TARGET WEBHOOK:</div>
            <div className="text-teal-300 truncate">{webhookUrl}</div>
            <div className="mt-1 text-slate-500 text-[10px]">SESSION ID:</div>
            <div className="text-slate-300 font-mono text-[10px] truncate">{sessionId}</div>
          </div>
        </div>

        {/* Quick Test Questions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Test Prompts
            </h4>
          </div>
          <p className="text-[11px] text-slate-400">
            Click any prompt to trigger the webhook and observe the RAG response & audio.
          </p>

          <div className="flex flex-col gap-1.5">
            {SAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSampleClick(q.text)}
                disabled={isSending}
                className="text-left px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800/70 border border-slate-800 hover:border-teal-500/30 text-xs text-slate-300 transition-all flex items-center justify-between group disabled:opacity-50"
              >
                <span className="truncate pr-2 font-medium">{q.text}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 bg-slate-800 text-teal-400 group-hover:bg-teal-500/20">
                  {q.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Confirmed Booking Card if created */}
        {confirmedBooking && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 shadow-lg space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold font-mono">
              <CheckCircle2 className="w-4 h-4" />
              <span>APPOINTMENT BOOKED</span>
            </div>
            <div className="text-sm font-semibold text-slate-100">
              {confirmedBooking.bookingId}
            </div>
            <div className="text-xs text-slate-300">
              {confirmedBooking.patientName} • {confirmedBooking.slot}
            </div>
            <div className="text-[11px] text-slate-400">
              Dentist: {confirmedBooking.dentist}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Chat Screen */}
      <div className="lg:col-span-3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl h-[640px] overflow-hidden">
        {/* Chat Header */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 p-0.5">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-teal-400" />
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -bottom-0.5 -right-0.5 border-2 border-slate-950" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Denttora Front-Desk Dental Assistant
              </h3>
              <p className="text-[11px] text-slate-400">
                Addis Ababa • GMT+3 • Powered by Gemini RAG & n8n
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBookingModal(true)}
              className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/20 hover:bg-teal-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Appointment</span>
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 space-y-2 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md'
                      : msg.error
                      ? 'bg-rose-950/30 border border-rose-500/30 text-rose-200'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] opacity-70">
                    <span className="font-medium font-mono">
                      {isUser ? 'You' : 'Denttora AI'}
                    </span>
                    <span className="text-[10px]">{msg.timestamp}</span>
                  </div>

                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Audio Playback pill if present */}
                  {msg.audio && (
                    <div className="pt-2">
                      <button
                        onClick={() => handlePlayAudio(msg.id, msg.audio!)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all ${
                          playingAudioId === msg.id
                            ? 'bg-teal-500 text-slate-950 border-teal-400 animate-pulse'
                            : 'bg-teal-500/10 text-teal-300 border-teal-500/30 hover:bg-teal-500/20'
                        }`}
                      >
                        {playingAudioId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>Stop Voice Audio</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Play Neural Audio (Nova)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Special Diagnostic Warning on Webhook Error */}
                  {msg.error && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-rose-500/20 text-xs space-y-2">
                      <div className="flex items-center gap-2 text-rose-400 font-bold font-mono">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Webhook Failed to Trigger</span>
                      </div>
                      <p className="text-slate-300 text-xs">
                        {msg.error.includes('404')
                          ? "n8n returned 404 Not Found. This happens when using /webhook-test/ (which expires after 1 request) or when the production workflow is Inactive in n8n."
                          : "Connection refused or unreachable. Ensure n8n is running on port 5678."}
                      </p>
                      <button
                        onClick={onOpenDiagnostic}
                        className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
                      >
                        <span>Open Webhook Diagnostic & Fix Guide &rarr;</span>
                      </button>
                    </div>
                  )}

                  {/* Available booking slots pills */}
                  {msg.availableSlots && msg.availableSlots.length > 0 && (
                    <div className="pt-2">
                      <span className="text-xs text-slate-400 block mb-1.5">
                        Suggested Addis Ababa Clinic Slots:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.availableSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedSlot(slot);
                              setShowBookingModal(true);
                            }}
                            className="px-2.5 py-1 rounded-md text-xs font-mono bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition-colors flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{slot}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isSending && (
            <div className="flex gap-3 items-center text-xs text-slate-400">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
                <Bot className="w-4 h-4 animate-bounce" />
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse delay-150" />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse delay-300" />
                <span className="font-mono text-xs text-slate-300">
                  {useSimulation ? 'Generating RAG answer...' : 'Waiting for n8n Webhook response...'}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your dental query (e.g., 'I need teeth cleaning' or 'ቀጠሮ ማስያዝ እፈልጋለሁ')..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20 disabled:opacity-40 cursor-pointer shrink-0"
          >
            <span>Send</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-base text-slate-100">
                  Book Dental Appointment
                </h3>
              </div>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Patient Full Name
                </label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Abebe Bikila"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="e.g. +251 91 123 4567"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Preferred Time Slot
                </label>
                <select
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  <option value="Tomorrow 9:30 AM">Tomorrow 9:30 AM (Addis Ababa)</option>
                  <option value="Tomorrow 11:00 AM">Tomorrow 11:00 AM (Addis Ababa)</option>
                  <option value="Tomorrow 2:30 PM">Tomorrow 2:30 PM (Addis Ababa)</option>
                  <option value="Friday 10:00 AM">Friday 10:00 AM (Addis Ababa)</option>
                  <option value="Saturday 9:00 AM">Saturday 9:00 AM (Addis Ababa)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Attending Doctor
                </label>
                <select
                  value={selectedDentist}
                  onChange={(e) => setSelectedDentist(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  {CLINIC_DOCTORS.map((doc, idx) => (
                    <option key={idx} value={doc.name}>
                      {doc.name} - {doc.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-teal-500/20"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
