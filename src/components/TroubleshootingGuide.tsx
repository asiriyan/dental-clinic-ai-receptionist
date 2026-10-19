import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  AlertTriangle,
  Terminal,
  Zap,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { FORENSIC_REASONS } from '../data/clinicData';

export const TroubleshootingGuide: React.FC = () => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
  });

  const [copiedCurl, setCopiedCurl] = useState(false);

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyCurl = () => {
    const cmd = `curl -X POST http://localhost:5678/webhook/dental-chat \\
  -H "Content-Type: application/json" \\
  -d '{"chatInput": "I need a tooth cleaning", "sessionId": "prod-test-1", "channel": "web"}'`;
    navigator.clipboard.writeText(cmd);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">
              Interactive Resolution Checklist
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-100 mt-1">
              Why the Webhook Stopped Triggering & How to Fix It
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Follow these 5 steps in order. Once completed, your chat will trigger n8n seamlessly on every message.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 shrink-0">
            <span className="text-xs font-mono text-slate-400">Checklist Progress:</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-teal-400 transition-all duration-300"
                  style={{ width: `${(completedCount / 5) * 100}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-teal-400">
                {completedCount}/5
              </span>
            </div>
          </div>
        </div>

        {/* 5-Step Checklist */}
        <div className="space-y-2.5 pt-2">
          <div
            onClick={() => toggleCheck('step1')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              checkedItems.step1
                ? 'bg-teal-950/20 border-teal-500/40 text-slate-200'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="mt-0.5 text-teal-400 shrink-0">
              {checkedItems.step1 ? (
                <CheckSquare className="w-5 h-5 fill-teal-500/20 text-teal-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-teal-400">
                STEP 1: SWITCH FROM TEST TO PRODUCTION URL
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Change your endpoint from <code className="text-amber-300 font-mono">/webhook-test/dental-chat</code> to <code className="text-teal-300 font-mono">/webhook/dental-chat</code>. The test URL automatically deactivates after 1 request; the production URL stays permanently active.
              </p>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('step2')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              checkedItems.step2
                ? 'bg-teal-950/20 border-teal-500/40 text-slate-200'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="mt-0.5 text-teal-400 shrink-0">
              {checkedItems.step2 ? (
                <CheckSquare className="w-5 h-5 fill-teal-500/20 text-teal-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-teal-400">
                STEP 2: TOGGLE WORKFLOW TO &quot;ACTIVE&quot; IN N8N
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Open n8n in your browser. Look at the top-right corner above the canvas. Flip the switch from <strong>Inactive</strong> to <strong>Active</strong> (turns bright green). If left Inactive, n8n rejects all production calls with 404.
              </p>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('step3')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              checkedItems.step3
                ? 'bg-teal-950/20 border-teal-500/40 text-slate-200'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="mt-0.5 text-teal-400 shrink-0">
              {checkedItems.step3 ? (
                <CheckSquare className="w-5 h-5 fill-teal-500/20 text-teal-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-teal-400">
                STEP 3: RUN DEV SERVER WITH EXPRESS PROXY (SERVER.TS)
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Do not run plain Vite. The app must run with <code className="text-teal-300 font-mono">tsx server.ts</code> so the backend forwards <code className="text-teal-300 font-mono">POST /api/chat</code> to n8n without browser Mixed Content or CORS restrictions.
              </p>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('step4')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              checkedItems.step4
                ? 'bg-teal-950/20 border-teal-500/40 text-slate-200'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="mt-0.5 text-teal-400 shrink-0">
              {checkedItems.step4 ? (
                <CheckSquare className="w-5 h-5 fill-teal-500/20 text-teal-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-teal-400">
                STEP 4: CHECK THE &quot;EXECUTIONS&quot; TAB (NOT CANVAS)
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                When using production webhooks, n8n does NOT light up or animate nodes on the canvas. To verify executions, click the clock/list icon labeled <strong>&quot;Executions&quot;</strong> on the far left sidebar of n8n.
              </p>
            </div>
          </div>

          <div
            onClick={() => toggleCheck('step5')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              checkedItems.step5
                ? 'bg-teal-950/20 border-teal-500/40 text-slate-200'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="mt-0.5 text-teal-400 shrink-0">
              {checkedItems.step5 ? (
                <CheckSquare className="w-5 h-5 fill-teal-500/20 text-teal-400" />
              ) : (
                <Square className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-teal-400">
                STEP 5: VERIFY DOCKER &amp; NETWORK ACCESS
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                If n8n is running in Docker, ensure port 5678 is published (<code className="text-teal-300 font-mono">-p 5678:5678</code>). If accessing from outside your machine, run <code className="text-teal-300 font-mono">ngrok http 5678</code> to provide an HTTPS tunnel.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Copy-Paste cURL Verification */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-teal-400" />
            <h4 className="font-bold text-base text-slate-100">
              Direct Terminal Verification (cURL)
            </h4>
          </div>
          <button
            onClick={copyCurl}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-teal-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedCurl ? (
              <>
                <Check className="w-3.5 h-3.5 text-teal-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Command</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Run this command in your terminal while n8n is running. If it returns the dental assistant text and audio, your webhook is working perfectly.
        </p>

        <pre className="text-xs font-mono text-teal-300/90 bg-slate-950 p-4 rounded-xl overflow-x-auto border border-slate-800">
{`curl -X POST http://localhost:5678/webhook/dental-chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "chatInput": "I need a tooth cleaning",
    "sessionId": "prod-test-1",
    "channel": "web"
  }'`}
        </pre>
      </div>

      {/* Forensic Deep Dive Cards */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
          Forensic Cause Breakdown
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FORENSIC_REASONS.map((reason) => (
            <div
              key={reason.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black font-mono text-slate-700">
                  {reason.number}
                </span>
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${reason.badgeColor}`}
                >
                  {reason.badge}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-slate-500 tracking-wider">
                  {reason.tag}
                </span>
                <h5 className="font-bold text-sm text-slate-100 mt-0.5">
                  {reason.title}
                </h5>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {reason.explanation}
              </p>

              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-mono text-teal-400 font-semibold mb-1">
                  ✓ THE FIX:
                </div>
                <div className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  {reason.solution}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
