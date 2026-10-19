import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Layers, 
  Package, 
  FileCheck2, 
  Receipt, 
  FileSignature, 
  BarChart3, 
  PieChart, 
  Settings, 
  Plus, 
  Sparkles, 
  Home, 
  Activity, 
  ShieldAlert, 
  Target,
  ArrowRight,
  Check,
  Share2,
  CheckCircle2,
  Network,
  Building2,
  Users,
  Workflow
} from 'lucide-react';
import { Q2C_STAGES, Q2C_MODULES, Q2CModule } from '../../data/q2cArchitecture';

interface AppLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewQuote?: () => void;
  onRunDemoFlow?: () => void;
  onOpenCompetitorMatrix?: () => void;
  onOpenArchitectureModal?: () => void;
}

interface AppCard {
  id: string;
  tabId: string;
  name: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  badge?: string;
}

export const AppLauncherModal: React.FC<AppLauncherModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onNewQuote,
  onRunDemoFlow,
  onOpenCompetitorMatrix,
  onOpenArchitectureModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const featuredApps: AppCard[] = [
    {
      id: 'app-revenue-cloud',
      tabId: 'quotes',
      name: 'RevX Revenue Cloud',
      category: 'Core CPQ & Pricing',
      description: 'End-to-end CPQ pricing rules, tiered quotes, subscription contracts & revenue governance.',
      icon: Layers,
      iconBg: 'bg-gradient-to-tr from-[#015ba5] to-[#0176d3]',
      iconColor: 'text-white',
      badge: 'Primary App',
    },
    {
      id: 'app-pipeline-cloud',
      tabId: 'opportunities',
      name: 'Sales & Pipeline Cloud',
      category: 'Sales Execution',
      description: 'Full deal pipeline management, weighted forecasting, and 1-click CPQ quote conversion.',
      icon: Target,
      iconBg: 'bg-gradient-to-tr from-emerald-600 to-teal-500',
      iconColor: 'text-white',
      badge: 'Pipeline',
    },
    {
      id: 'app-billing-hub',
      tabId: 'invoices',
      name: 'Finance & GST Invoicing Hub',
      category: 'Billing & Compliance',
      description: 'Indian GST compliant tax invoices with real-time 64-character NIC IRN & QR generation.',
      icon: Receipt,
      iconBg: 'bg-gradient-to-tr from-blue-600 to-cyan-500',
      iconColor: 'text-white',
      badge: 'GST E-Invoice',
    },
    {
      id: 'app-metering-cloud',
      tabId: 'metering',
      name: 'Consumption & Usage Metering',
      category: 'Zuora Mediation',
      description: 'High-throughput usage mediation, rating engine, threshold alerts & commitment drawdowns.',
      icon: Activity,
      iconBg: 'bg-gradient-to-tr from-indigo-600 to-violet-500',
      iconColor: 'text-white',
      badge: 'Zuora+',
    },
    {
      id: 'app-collections-ai',
      tabId: 'collect',
      name: 'Collections & Smart Dunning AI',
      category: 'Receivables & Risk',
      description: 'Autonomous payment retry cadences, multi-gateway failover & DSO reduction workflows.',
      icon: ShieldAlert,
      iconBg: 'bg-gradient-to-tr from-rose-600 to-orange-500',
      iconColor: 'text-white',
      badge: 'ML Dunning',
    },
    {
      id: 'app-esign-vault',
      tabId: 'esign',
      name: 'Cryptographic eSign Studio',
      category: 'Native Security',
      description: 'Legally admissible digital signing with SHA-256 seal, Section 65B IT Act audit certificates.',
      icon: FileSignature,
      iconBg: 'bg-gradient-to-tr from-purple-600 to-pink-500',
      iconColor: 'text-white',
      badge: 'SHA-256 Seal',
    },
    {
      id: 'app-dealroom',
      tabId: 'dealroom',
      name: 'DealHub™ Digital DealRoom',
      category: 'Sales Execution',
      description: 'Interactive buyer microsites, live seat & ARR calculators, mutual action plans (MAP) & telemetry.',
      icon: Share2,
      iconBg: 'bg-gradient-to-tr from-purple-700 to-indigo-600',
      iconColor: 'text-white',
      badge: 'DealHub',
    },
    {
      id: 'app-approvals',
      tabId: 'approvals',
      name: 'Oracle CPQ™ Approval Matrix',
      category: 'Governance & Margins',
      description: 'Multi-tier sequential approvals (Director, VP, CFO) based on discount thresholds & margin floors.',
      icon: CheckCircle2,
      iconBg: 'bg-gradient-to-tr from-sky-600 to-blue-500',
      iconColor: 'text-white',
      badge: 'Oracle CPQ',
    },
  ];

  const query = searchQuery.trim().toLowerCase();

  const filteredApps = featuredApps.filter((app) => {
    if (!query) return true;
    return (
      app.name.toLowerCase().includes(query) ||
      app.category.toLowerCase().includes(query) ||
      app.description.toLowerCase().includes(query) ||
      (app.badge && app.badge.toLowerCase().includes(query))
    );
  });

  const filteredModules = Q2C_MODULES.filter((item) => {
    if (!query) return true;
    return (
      item.label.toLowerCase().includes(query) ||
      item.desc.toLowerCase().includes(query) ||
      item.useCase.toLowerCase().includes(query) ||
      item.persona.toLowerCase().includes(query) ||
      item.competitorBenchmark.toLowerCase().includes(query) ||
      (item.badge && item.badge.toLowerCase().includes(query))
    );
  });

  const handleLaunchTab = (tabId: string) => {
    setActiveTab(tabId);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-2.5 sm:p-5 pt-8 sm:pt-14 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden my-auto sm:my-0 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#dde1e9] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#015ba5] via-[#0176d3] to-[#0ea5e9] flex items-center justify-center text-white shadow-sm ring-1 ring-white/60 shrink-0">
              <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                <circle cx="5" cy="5" r="2.2" />
                <circle cx="12" cy="5" r="2.2" />
                <circle cx="19" cy="5" r="2.2" />
                <circle cx="5" cy="12" r="2.2" />
                <circle cx="12" cy="12" r="2.2" />
                <circle cx="19" cy="12" r="2.2" />
                <circle cx="5" cy="19" r="2.2" />
                <circle cx="12" cy="19" r="2.2" />
                <circle cx="19" cy="19" r="2.2" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#10233f] tracking-tight">App Launcher</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0176d3]/10 text-[#0176d3] font-bold uppercase tracking-wider">
                  Q2C Enterprise Architecture
                </span>
              </div>
              <p className="text-xs text-[#5c6678]">
                Search, switch applications, and navigate across all Quote-to-Cash modules in architectural sequence
              </p>
            </div>
          </div>

          {/* Search Box in Header */}
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search apps, objects, or use cases..."
                className="w-full bg-white border border-[#dde1e9] focus:border-[#0176d3] focus:ring-1 focus:ring-[#0176d3] rounded-xl pl-9 pr-8 py-2 text-xs text-[#10233f] placeholder:text-slate-400 shadow-2xs focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Close App Launcher (Esc)"
              className="w-8 h-8 rounded-lg hover:bg-slate-200/80 active:scale-95 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Launchpad Action Strip */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#f1f5f9]/70 border-b border-[#dde1e9] flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
          <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider shrink-0 mr-1">
            Quick Actions:
          </span>
          {onOpenArchitectureModal && (
            <button
              onClick={() => {
                onClose();
                onOpenArchitectureModal();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-[#015ba5] border border-[#0176d3]/30 font-bold text-xs transition-all shadow-2xs shrink-0 cursor-pointer"
            >
              <Workflow size={13} className="text-[#0176d3]" />
              <span>📐 Q2C Architecture Blueprint</span>
            </button>
          )}
          {onNewQuote && (
            <button
              onClick={() => {
                onClose();
                onNewQuote();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-[#015ba5] border border-[#dde1e9] hover:border-[#0176d3]/40 font-bold text-xs transition-all shadow-2xs shrink-0 cursor-pointer"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>+ New Quote (CPQ)</span>
            </button>
          )}
          {onRunDemoFlow && (
            <button
              onClick={() => {
                onClose();
                onRunDemoFlow();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-emerald-50 text-emerald-800 border border-[#dde1e9] hover:border-emerald-500/40 font-bold text-xs transition-all shadow-2xs shrink-0 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 rq-pulse-dot" />
              <span>Automated Q2C Pipeline</span>
            </button>
          )}
          {onOpenCompetitorMatrix && (
            <button
              onClick={() => {
                onClose();
                onOpenCompetitorMatrix();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-purple-50 text-purple-800 border border-[#dde1e9] hover:border-purple-500/40 font-bold text-xs transition-all shadow-2xs shrink-0 cursor-pointer"
            >
              <Sparkles size={12} className="text-purple-600" />
              <span>RevX vs Competitors</span>
            </button>
          )}
          <button
            onClick={() => handleLaunchTab('setup')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-[#5c6678] hover:text-[#10233f] border border-[#dde1e9] font-medium text-xs transition-all shadow-2xs shrink-0 ml-auto cursor-pointer"
          >
            <Settings size={12} />
            <span>Setup</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-150px)] space-y-6">
          {/* Section 1: Enterprise Apps */}
          {filteredApps.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5c6678]">
                    Featured Cloud Applications
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
                    {filteredApps.length}
                  </span>
                </div>
                <span className="text-[11px] text-[#747e90]">Click to launch application workspace</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredApps.map((app) => {
                  const Icon = app.icon;
                  const isCurrent = activeTab === app.tabId;
                  return (
                    <div
                      key={app.id}
                      onClick={() => handleLaunchTab(app.tabId)}
                      className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between ${
                        isCurrent
                          ? 'border-[#0176d3] bg-[#f0f7ff]/90 ring-2 ring-[#0176d3]/20 shadow-sm'
                          : 'border-[#dde1e9] bg-white hover:border-[#0176d3]/60 hover:shadow-md hover:-translate-y-0.5'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className={`w-9 h-9 rounded-xl ${app.iconBg} ${app.iconColor} flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0`}>
                            <Icon size={18} />
                          </div>
                          {app.badge && (
                            <span className="text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#5c6678] border border-slate-200">
                              {app.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-extrabold text-[#10233f] group-hover:text-[#015ba5] transition-colors flex items-center gap-1.5">
                          <span>{app.name}</span>
                          {isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3] shrink-0" title="Currently Active" />
                          )}
                        </div>
                        <div className="text-[10px] font-semibold text-[#0176d3] mt-0.5">
                          {app.category}
                        </div>
                        <p className="text-[11px] text-[#5c6678] mt-1.5 line-clamp-2 leading-relaxed">
                          {app.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-[#edf1f7] flex items-center justify-between text-[10.5px]">
                        <span className="font-semibold text-[#015ba5] group-hover:underline flex items-center gap-1">
                          <span>Open App</span>
                          <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: All Items Grouped by 5 Architectural Stages */}
          {filteredModules.length > 0 && (
            <div className="space-y-5 pt-2 border-t border-[#edf1f7]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5c6678]">
                    All Platform Modules in Q2C Architectural Order
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-100 text-[#0176d3] font-bold">
                    {filteredModules.length} Modules
                  </span>
                </div>
                {onOpenArchitectureModal && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenArchitectureModal();
                    }}
                    className="text-xs font-semibold text-[#0176d3] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect Full Architecture Blueprint</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {/* Loop through the stages */}
              {Q2C_STAGES.filter(s => s.id !== 'all').map((stg) => {
                const stageModules = filteredModules.filter(m => m.stageId === stg.id);
                if (stageModules.length === 0) return null;

                return (
                  <div key={stg.id} className="bg-slate-50/60 rounded-xl p-3 border border-slate-200/70">
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200/50">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                          Stage {stg.number}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800">
                          {stg.label.replace(/^\d+\.\s*/, '')}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-400 hidden sm:inline">
                        {stg.description}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {stageModules.map((item) => {
                        const Icon = item.icon;
                        const isCurrent = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleLaunchTab(item.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all duration-150 flex items-center justify-between group cursor-pointer ${
                              isCurrent
                                ? 'border-[#0176d3] bg-[#eef4ff] shadow-2xs ring-1 ring-[#0176d3]/30'
                                : 'border-[#dde1e9] bg-white hover:bg-[#f8fafc] hover:border-[#0176d3]/50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                                isCurrent 
                                  ? 'bg-[#0176d3] text-white shadow-xs' 
                                  : 'bg-slate-100 text-[#5c6678] group-hover:bg-[#eef4ff] group-hover:text-[#0176d3]'
                              }`}>
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono font-bold text-slate-400">
                                    #{item.seqNumber}
                                  </span>
                                  <span className={`text-xs font-bold truncate ${
                                    isCurrent ? 'text-[#015ba5]' : 'text-[#10233f] group-hover:text-[#0176d3]'
                                  }`}>
                                    {item.label}
                                  </span>
                                  {item.badge && (
                                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full bg-slate-100 text-[#5c6678] font-bold shrink-0">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10.5px] text-[#5c6678] truncate max-w-[210px]">
                                  {item.desc}
                                </div>
                              </div>
                            </div>

                            {isCurrent && (
                              <div className="w-5 h-5 rounded-full bg-[#0176d3] text-white flex items-center justify-center shrink-0 ml-2">
                                <Check size={11} strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* If search query produced no results */}
          {filteredApps.length === 0 && filteredModules.length === 0 && (
            <div className="py-12 text-center text-[#5c6678]">
              <Search size={32} className="mx-auto text-slate-300 mb-2" />
              <div className="text-sm font-bold text-[#10233f]">No matching apps or items found</div>
              <div className="text-xs text-slate-400 mt-1">Try searching for &quot;Quotes&quot;, &quot;Billing&quot;, &quot;GST&quot;, &quot;eSign&quot;, or &quot;Orders&quot;.</div>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 px-3 py-1 rounded-md text-xs font-semibold text-[#0176d3] bg-[#eef4ff] hover:bg-[#e0edff]"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between text-xs text-[#5c6678]">
          <div className="flex items-center gap-2.5">
            <img src="/revx-logo.png" alt="RevX" className="h-5 w-auto object-contain" />
            <span className="font-semibold text-[#10233f]">Accelerate Revenue. Anywhere.</span>
            <span className="hidden sm:inline text-slate-400">• Enterprise Revenue Cloud Live</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 hidden sm:inline">Press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[#10233f]">ESC</kbd> to exit</span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-md bg-white border border-[#dde1e9] text-xs font-semibold text-[#10233f] hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
