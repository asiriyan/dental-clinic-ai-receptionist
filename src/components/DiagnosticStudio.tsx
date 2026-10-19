import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Zap,
  Globe,
  Sliders,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { DiagnosticResult } from '../types';

interface DiagnosticStudioProps {
  currentUrl: string;
  onUrlChange: (newUrl: string) => void;
  onRunProbe: (url: string) => Promise<DiagnosticResult>;
  lastResult: DiagnosticResult | null;
  isLoading: boolean;
}

export const DiagnosticStudio: React.FC<DiagnosticStudioProps> = ({
  currentUrl,
  onUrlChange,
  onRunProbe,
  lastResult,
  isLoading,
}) => {
  const [inputUrl, setInputUrl] = useState(currentUrl);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const presets = [
    {
      label: 'Production Webhook (Recommended)',
      url: 'http://localhost:5678/webhook/dental-chat',
      note: 'Permanent listener. Requires workflow switch = ACTIVE',
      isProd: true,
    },
    {
      label: 'Test Webhook (Single-Shot)',
      url: 'http://localhost:5678/webhook-test/dental-chat',
      note: 'Expires after 1 request or 120s. Requires "Listen for test event"',
      isProd: false,
    },
    {
      label: 'Docker Host Network',
      url: 'http://host.docker.internal:5678/webhook/dental-chat',
      note: 'For apps running inside Docker containers',
      isProd: true,
    },
  ];

  const handleApplyPreset = (url: string) => {
    setInputUrl(url);
    onUrlChange(url);
  };

  const handleExecute = () => {
    onUrlChange(inputUrl);
    onRunProbe(inputUrl);
  };

  const copyCurl = () => {
    const cmd = `curl -X POST "${inputUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"chatInput": "I need a tooth cleaning", "sessionId": "test-denttora-1", "channel": "diagnostic"}'`;
    navigator.clipboard.writeText(cmd);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const isTest = inputUrl.includes('/webhook-test/');

  return (
    <div className="space-y-6">
      {/* Hero Diagnostic Notice */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-teal-500/10 border border-amber-500/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono font-bold tracking-wider text-amber-400">
                  Direct Forensic Answer
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  Why It Stopped Triggering
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 mt-1">
                Why does it not trigger the test webhook now, when previously it worked?
              </h2>
              <p className="text-sm text-slate-300 mt-1.5 leading-relaxed max-w-3xl">
                In n8n, <strong>Test Webhook URLs (<code className="text-amber-300 font-mono text-xs">/webhook-test/...</code>)</strong> only listen when you actively click the <em>&quot;Listen for test event&quot;</em> button in the canvas. The moment <strong>ONE single message</strong> arrives, n8n executes that test and <strong>immediately shuts down the listener</strong>!
                Any subsequent chat message sent to that URL will return <span className="text-rose-400 font-mono">404: The workflow is not registered</span>.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => handleApplyPreset('http://localhost:5678/webhook/dental-chat')}
              className="px-4 py-2.5 rounded-xl bg-teal-500 text-slate-950 hover:bg-teal-400 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Fix: Switch to Production Webhook</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Webhook Probe Tester */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-semibold text-slate-100">
              Live Webhook Probe & Connectivity Inspector
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Method: <strong className="text-teal-400 font-semibold">POST</strong> • Body: JSON
          </span>
        </div>

        {/* URL Input Box */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
            <span>Target n8n Webhook URL</span>
            {isTest ? (
              <span className="text-amber-400 font-mono text-xs flex items-center gap-1">
                ⚠️ Test URL detected (Single-Shot mode)
              </span>
            ) : (
              <span className="text-emerald-400 font-mono text-xs flex items-center gap-1">
                ✓ Production URL mode
              </span>
            )}
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://localhost:5678/webhook/dental-chat"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
              />
            </div>
            <button
              onClick={handleExecute}
              disabled={isLoading || !inputUrl.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-500/20 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Probing Webhook...</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  <span>Send Diagnostic Probe</span>
                </>
              )}
            </button>
          </div>

          {/* Preset Buttons */}
          <div className="pt-2">
            <span className="text-xs text-slate-400 mr-2">Quick Presets:</span>
            <div className="inline-flex flex-wrap gap-2 mt-1">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(p.url)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-all ${
                    inputUrl === p.url
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                  }`}
                  title={p.note}
                >
                  {p.isProd ? '🟢 ' : '🟡 '}
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Diagnostic Results Section */}
        {lastResult && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <span>Probe Results</span>
                <span className="text-xs text-slate-500 font-normal">
                  (Elapsed: {lastResult.durationMs ?? 0}ms)
                </span>
              </h4>

              {lastResult.httpStatus ? (
                <div
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 ${
                    lastResult.httpStatus === 200
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : lastResult.httpStatus === 404
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {lastResult.httpStatus === 200 ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span>HTTP {lastResult.httpStatus} {lastResult.httpStatusText}</span>
                </div>
              ) : (
                <div className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Unreachable</span>
                </div>
              )}
            </div>

            {/* Diagnostic Diagnosis Card */}
            <div
              className={`rounded-xl border p-4.5 mb-4 ${
                lastResult.httpStatus === 200
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : lastResult.httpStatus === 404
                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {lastResult.httpStatus === 200 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : lastResult.httpStatus === 404 ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <h5 className="font-semibold text-sm sm:text-base text-slate-100">
                    {lastResult.diagnosisTitle || (lastResult.httpStatus === 200 ? 'Webhook Active and Responding' : 'Probe Unsuccessful')}
                  </h5>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {lastResult.rootCause || lastResult.errorMessage || 'Target URL responded with code ' + lastResult.httpStatus}
                  </p>
                </div>
              </div>
            </div>

            {/* Request & Response Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sent Probe Payload */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-medium text-slate-400">
                    Request Payload Sent
                  </span>
                  <button
                    onClick={copyCurl}
                    className="text-xs text-slate-400 hover:text-teal-400 flex items-center gap-1 font-mono transition-colors"
                  >
                    {copiedCurl ? (
                      <>
                        <Check className="w-3 h-3 text-teal-400" />
                        <span className="text-teal-400">Copied cURL</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy cURL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-teal-300/90 bg-slate-900/60 p-3 rounded-lg overflow-x-auto border border-slate-800/80">
{`{
  "chatInput": "Hello, diagnostic ping from Denttora Studio",
  "sessionId": "diag-${lastResult.durationMs || '123'}",
  "channel": "diagnostic",
  "language": "English"
}`}
                </pre>
              </div>

              {/* Webhook Response Output */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-medium text-slate-400">
                    n8n Webhook Response
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Status: {lastResult.httpStatus ?? 'ERR'}
                  </span>
                </div>
                <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/60 p-3 rounded-lg overflow-x-auto border border-slate-800/80 max-h-48 overflow-y-auto">
                  {lastResult.responsePreview || lastResult.errorMessage || '(No response received)'}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side: Test Webhook vs Production Webhook Comparison */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-semibold text-slate-100">
            Architectural Comparison: Test vs Production Webhook
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Test Webhook Box */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                /webhook-test/dental-chat
              </span>
              <span className="text-xs font-mono text-amber-400/80 font-medium">Single-Shot</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-200">Test Webhook Endpoint</h4>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 shrink-0 font-bold">•</span>
                <span>Only active when you click <strong>&quot;Listen for test event&quot;</strong> in n8n.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 shrink-0 font-bold">✕</span>
                <span><strong>Deactivates immediately</strong> after 1 request arrives or 120s timer expires.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 shrink-0 font-bold">✕</span>
                <span>Subsequent chat messages fail with <strong>404 Not Found</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 shrink-0 font-bold">•</span>
                <span>Used strictly for designing nodes inside the n8n canvas.</span>
              </li>
            </ul>
          </div>

          {/* Production Webhook Box */}
          <div className="rounded-xl border border-teal-500/30 bg-teal-950/10 p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                /webhook/dental-chat
              </span>
              <span className="text-xs font-mono text-teal-400/80 font-medium">Continuous</span>
            </div>
            <h4 className="text-sm font-semibold text-slate-200">Production Webhook Endpoint</h4>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-teal-400 shrink-0 font-bold">✓</span>
                <span>Listens <strong>24/7 continuously</strong> for patient chat messages.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 shrink-0 font-bold">✓</span>
                <span>Does not expire after one message. Maintains persistent conversations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 shrink-0 font-bold">⚠️</span>
                <span>Requires workflow toggle in top-right of n8n to be <strong>ACTIVE</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-400 shrink-0 font-bold">•</span>
                <span>Execution logs appear under the <strong>&quot;Executions&quot;</strong> tab in the sidebar.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
