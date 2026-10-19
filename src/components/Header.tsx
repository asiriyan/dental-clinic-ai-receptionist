import React from 'react';
import { Stethoscope, Activity, Terminal, BookOpen, Sparkles, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  activeTab: 'diagnostic' | 'chat' | 'workflows' | 'guide';
  setActiveTab: (tab: 'diagnostic' | 'chat' | 'workflows' | 'guide') => void;
  webhookStatus: 'checking' | 'connected' | 'disconnected' | 'simulated';
  configuredUrl: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  webhookStatus,
  configuredUrl,
}) => {
  const isTestUrl = configuredUrl.includes('/webhook-test/');

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-teal-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-100 tracking-tight font-sans">
                  Denttora
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  n8n RAG & Booking
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Addis Ababa Dental Clinic • Webhook Diagnostic & Live AI Chat
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('diagnostic')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'diagnostic'
                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4 text-teal-400" />
              <span>Webhook Diagnostic</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Patient Chatbot</span>
            </button>

            <button
              onClick={() => setActiveTab('workflows')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'workflows'
                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Workflows (JSON)</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'guide'
                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Fix Guide</span>
            </button>
          </nav>

          {/* Webhook Status pill */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              {webhookStatus === 'connected' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-300 font-mono">200 OK</span>
                </>
              ) : webhookStatus === 'simulated' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-cyan-300 font-mono">Simulated</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-amber-300 font-mono">
                    {isTestUrl ? 'Test URL (1-Shot)' : 'Check Status'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
