import React from 'react';
import { 
  BarChart3, 
  Layers, 
  FileSignature, 
  Receipt, 
  PieChart, 
  Zap, 
  ShieldCheck, 
  Terminal
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isStandalone: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isStandalone }) => {
  const navItems = [
    { id: 'war-room', label: 'Executive War Room', icon: BarChart3, badge: 'Live' },
    { id: 'cpq', label: 'CPQ & Quote 360', icon: Layers, badge: 'AI' },
    { id: 'esign', label: 'Native eSign Studio', icon: FileSignature, badge: 'SHA-256' },
    { id: 'billing', label: 'Invoices & GST', icon: Receipt, badge: 'IRN' },
    { id: 'revrec', label: 'ASC 606 Rev Rec', icon: PieChart, badge: 'IFRS 15' },
    { id: 'connector', label: 'Salesforce Connector', icon: Zap, badge: 'Hybrid' },
  ];

  return (
    <aside className="w-64 bg-[#090d16] border-r border-slate-800/80 flex flex-col shrink-0 min-h-screen select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <span className="font-bold text-white text-lg tracking-tighter">Rx</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 tracking-tight text-sm">RevX Core</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                OSS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Revenue OS &amp; eSign</p>
          </div>
        </div>
      </div>

      {/* Mode Status Pill */}
      <div className="px-4 pt-4 pb-2">
        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="text-xs font-medium text-slate-300">
              {isStandalone ? 'Standalone Mode' : 'Salesforce Sync'}
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            100% Free
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Core Engines
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600/20 to-blue-600/10 text-white border border-indigo-500/30 shadow-sm shadow-indigo-950'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  size={16}
                  className={isActive ? 'text-indigo-400' : 'text-slate-500'}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-400/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Open Source Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-[11px]">MIT License</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">v1.0.0-oss</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub Star</span>
          </a>
          <button
            onClick={() => setActiveTab('connector')}
            title="CLI & API Specs"
            className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
          >
            <Terminal size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};
