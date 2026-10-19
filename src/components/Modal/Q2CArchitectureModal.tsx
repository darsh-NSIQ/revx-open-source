import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Sparkles, 
  Workflow, 
  ShieldCheck, 
  UserCheck, 
  Database,
  ExternalLink
} from 'lucide-react';
import { Q2C_STAGES, Q2C_MODULES, Q2CModule, Q2CStageInfo } from '../../data/q2cArchitecture';

interface Q2CArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
}

export const Q2CArchitectureModal: React.FC<Q2CArchitectureModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigateTab,
}) => {
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const query = searchQuery.trim().toLowerCase();

  const filteredModules = Q2C_MODULES.filter((mod) => {
    if (selectedStageId !== 'all' && mod.stageId !== selectedStageId && mod.stageId !== 'core') {
      return false;
    }
    if (!query) return true;
    return (
      mod.label.toLowerCase().includes(query) ||
      mod.desc.toLowerCase().includes(query) ||
      mod.useCase.toLowerCase().includes(query) ||
      mod.competitorBenchmark.toLowerCase().includes(query) ||
      mod.persona.toLowerCase().includes(query) ||
      (mod.badge && mod.badge.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#015ba5] to-[#0176d3] text-white flex items-center justify-center shadow-md shadow-[#0176d3]/20">
              <Workflow size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Quote-to-Cash (Q2C) Enterprise Architecture & Use Cases
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                  5-Stage Blueprint
                </span>
              </div>
              <p className="text-xs text-slate-500">
                End-to-end architectural lifecycle order from Inbound Lead to Revenue Recognition (ASC 606)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Visual Lifecycle Flow Bar */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 shrink-0 overflow-x-auto scrollbar-none border-b border-slate-800">
          <div className="flex items-center justify-between min-w-[700px] gap-2 text-xs">
            {Q2C_STAGES.filter(s => s.id !== 'all').map((stg, idx, arr) => {
              const isSelected = selectedStageId === stg.id;
              return (
                <React.Fragment key={stg.id}>
                  <button
                    onClick={() => setSelectedStageId(selectedStageId === stg.id ? 'all' : stg.id)}
                    className={`flex-1 px-3 py-2 rounded-xl text-left transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-white/15 border-white/50 text-white shadow-sm'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-blue-300">
                        Stage {stg.number}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {stg.moduleIds.length} Modules
                      </span>
                    </div>
                    <div className="font-bold text-xs truncate mt-0.5 text-white">
                      {stg.label.replace(/^\d+\.\s*/, '')}
                    </div>
                  </button>
                  {idx < arr.length - 1 && (
                    <ArrowRight size={14} className="text-slate-500 shrink-0 mx-1" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Stage Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {Q2C_STAGES.map((s) => {
              const active = selectedStageId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStageId(s.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#0176d3] text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by use case, role, tool..."
              className="w-full bg-white border border-slate-200 focus:border-[#0176d3] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Modules Grid with Detailed Use Cases */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[calc(92vh-220px)] bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredModules.map((mod) => {
              const Icon = mod.icon;
              const isCurrentActiveTab = activeTab === mod.id;
              const stage = Q2C_STAGES.find(s => s.id === mod.stageId) || Q2C_STAGES[0];

              return (
                <div
                  key={mod.id}
                  className={`bg-white rounded-xl border p-4.5 flex flex-col justify-between transition-all hover:shadow-md ${
                    isCurrentActiveTab 
                      ? 'border-[#0176d3] ring-2 ring-[#0176d3]/20 shadow-xs' 
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Card Top: Number, Icon, Title, Badge */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[#0176d3] shrink-0 font-bold">
                          <Icon size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-slate-400">
                              #{mod.seqNumber}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">
                              {mod.label}
                            </h3>
                            {isCurrentActiveTab && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-[#0176d3] font-bold">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            {mod.desc}
                          </p>
                        </div>
                      </div>

                      {mod.badge && (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 shrink-0">
                          {mod.badge}
                        </span>
                      )}
                    </div>

                    {/* Use Case Box */}
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs space-y-2 mb-3">
                      <div>
                        <span className="font-bold text-slate-800">Primary Enterprise Use Case:</span>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">
                          {mod.useCase}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 font-medium block">Inputs (Trigger):</span>
                          <span className="text-slate-700 font-medium">{mod.inputs}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Outputs (Downstream):</span>
                          <span className="text-slate-700 font-medium">{mod.outputs}</span>
                        </div>
                      </div>
                    </div>

                    {/* Meta Tags: Persona & Competitor Benchmark */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] mb-3">
                      <div className="flex items-center gap-1 text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded">
                        <UserCheck size={11} className="text-slate-400" />
                        <span className="font-semibold text-slate-700">Role:</span> {mod.persona.split(',')[0]}
                      </div>
                      <div className="flex items-center gap-1 text-purple-700 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded">
                        <Sparkles size={11} className="text-purple-500" />
                        <span className="font-semibold">Benchmark:</span> {mod.competitorBenchmark.split('/')[0]}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Stage {mod.stageNumber}: {stage.shortLabel}
                    </span>

                    <button
                      onClick={() => {
                        onNavigateTab(mod.id);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-[#0176d3] hover:bg-[#015ba5] transition-all cursor-pointer shadow-2xs"
                    >
                      <span>Open {mod.label}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredModules.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
              No modules matched "{searchQuery}". Try searching for terms like "CPQ", "Zuora", "GST", "Invoices", or "Leads".
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Architecture is 100% compliant with Enterprise Lead-to-Cash, CPQ, and ASC 606 standards.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close Blueprint
          </button>
        </div>
      </div>
    </div>
  );
};
