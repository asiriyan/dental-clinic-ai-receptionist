import React, { useState } from 'react';
import {
  FileCode,
  Download,
  Copy,
  Check,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  Volume2,
  Calendar,
  AlertOctagon,
  Sparkles
} from 'lucide-react';

export const WorkflowInspector: React.FC = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<
    'Dental-Clinic-RAG-CHAT-Fixed.json' | 'Dental-Clinic-Booking-API.json' | 'Dental-Clinic-Error-Alert.json'
  >('Dental-Clinic-RAG-CHAT-Fixed.json');

  const [copied, setCopied] = useState(false);

  const workflows = [
    {
      id: 'Dental-Clinic-RAG-CHAT-Fixed.json',
      title: '1. Dental Clinic - RAG CHAT + Voice (Main)',
      tag: 'Primary Webhook',
      nodes: 16,
      desc: 'Handles patient incoming text/audio via POST /dental-chat, Amharic language detection, Gemini RAG retrieval via Pinecone, Deepgram aura-2 TTS generation, and sub-workflow booking execution.',
    },
    {
      id: 'Dental-Clinic-Booking-API.json',
      title: '2. Dental Clinic - Booking API (Sub-Workflow)',
      tag: 'Sub-Workflow',
      nodes: 14,
      desc: 'Executed as a tool by the primary AI Agent. Handles get_slots, book_appointment, Google Calendar integration, Supabase DB audit logging, and email confirmations.',
    },
    {
      id: 'Dental-Clinic-Error-Alert.json',
      title: '3. Dental Clinic - Error Alert',
      tag: 'Error Handler',
      nodes: 3,
      desc: 'Activated when any node in the primary or booking workflow throws an unhandled error, notifying administrators with diagnostic telemetry.',
    },
  ];

  const handleCopyWorkflow = async () => {
    try {
      const res = await fetch(`/workflows/${selectedWorkflow}`);
      const json = await res.text();
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/workflows/${selectedWorkflow}`;
    link.download = selectedWorkflow;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Workflow Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {workflows.map((wf) => (
          <button
            key={wf.id}
            onClick={() => setSelectedWorkflow(wf.id as any)}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedWorkflow === wf.id
                ? 'bg-teal-500/10 border-teal-500/40 shadow-lg shadow-teal-500/10'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-teal-400 border border-slate-700">
                {wf.tag}
              </span>
              <span className="text-xs font-mono text-slate-500">{wf.nodes} Nodes</span>
            </div>
            <h4 className="font-semibold text-sm text-slate-100">{wf.title}</h4>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{wf.desc}</p>
          </button>
        ))}
      </div>

      {/* Selected Workflow Details */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-teal-400" />
              <h3 className="font-bold text-base text-slate-100 font-mono">
                {selectedWorkflow}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Production-ready workflow file imported from Google Drive
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWorkflow}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-teal-400">Copied JSON!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy n8n JSON</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Node Pipeline Diagram for Main RAG Chat Workflow */}
        {selectedWorkflow === 'Dental-Clinic-RAG-CHAT-Fixed.json' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Pipeline Execution Topology
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono font-bold text-amber-400 flex items-center justify-between">
                  <span>STEP 1: INGRESS</span>
                  <span>Webhook</span>
                </div>
                <div className="font-semibold text-xs text-slate-200">
                  POST /dental-chat
                </div>
                <p className="text-[11px] text-slate-400">
                  Receives chat query, sessionId, language, and client channel.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono font-bold text-cyan-400 flex items-center justify-between">
                  <span>STEP 2: NORMALIZATION</span>
                  <span>JS Code</span>
                </div>
                <div className="font-semibold text-xs text-slate-200">
                  Amharic / Fidel Detect
                </div>
                <p className="text-[11px] text-slate-400">
                  Checks Unicode range [\u1200-\u137F] for native Ethiopian script.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono font-bold text-teal-400 flex items-center justify-between">
                  <span>STEP 3: RAG & REASONING</span>
                  <span>Gemini Agent</span>
                </div>
                <div className="font-semibold text-xs text-slate-200">
                  AI Agent (RAG) + Pinecone
                </div>
                <p className="text-[11px] text-slate-400">
                  Gemini 1.5 Flash queries dental vectors and invokes Booking tool.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono font-bold text-indigo-400 flex items-center justify-between">
                  <span>STEP 4: VOICE & EGRESS</span>
                  <span>Deepgram + Respond</span>
                </div>
                <div className="font-semibold text-xs text-slate-200">
                  Deepgram TTS (Nova)
                </div>
                <p className="text-[11px] text-slate-400">
                  Converts agent text into base64 mp3 audio streamed back to user.
                </p>
              </div>
            </div>

            {/* Key Node Code Details */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
              <span className="text-xs font-mono font-semibold text-slate-300">
                Webhook Node Configuration (In n8n):
              </span>
              <pre className="text-xs font-mono text-teal-300/90 bg-slate-900/60 p-3 rounded-lg overflow-x-auto border border-slate-800">
{`{
  "httpMethod": "POST",
  "path": "dental-chat",
  "responseMode": "responseNode",
  "options": {
    "allowedOrigins": "*"
  }
}`}
              </pre>
              <div className="text-xs text-slate-400 leading-relaxed">
                Notice: <code className="text-teal-300 font-mono">responseMode: &quot;responseNode&quot;</code> means the webhook waits for the <code className="text-teal-300 font-mono">Respond to Webhook</code> node at the end of the graph before returning HTTP 200. If an intermediate node crashes or times out, the client connection hangs or times out.
              </div>
            </div>
          </div>
        )}

        {/* Booking API Workflow Breakdown */}
        {selectedWorkflow === 'Dental-Clinic-Booking-API.json' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Booking Sub-Workflow Operations
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold font-mono">
                  <Calendar className="w-4 h-4" />
                  <span>ACTION 1: GET_SLOTS</span>
                </div>
                <p className="text-xs text-slate-300">
                  Queries Google Calendar free/busy intervals, filters out lunch breaks, and returns available 30-min patient slots.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-teal-400 text-xs font-bold font-mono">
                  <Database className="w-4 h-4" />
                  <span>ACTION 2: BOOK_APPOINTMENT</span>
                </div>
                <p className="text-xs text-slate-300">
                  Inserts patient record into Supabase <code className="text-teal-300 font-mono">bookings</code> table and creates Google Calendar event with patient phone.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold font-mono">
                  <Sparkles className="w-4 h-4" />
                  <span>ACTION 3: NOTIFICATIONS</span>
                </div>
                <p className="text-xs text-slate-300">
                  Sends confirmation email via Gmail node with appointment confirmation code DC-######.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
