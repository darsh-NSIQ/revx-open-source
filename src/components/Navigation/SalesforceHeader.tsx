import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Currency } from '../../types';
import { 
  Search, 
  Settings, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Command, 
  Workflow,
  ArrowRight,
  Layers,
  Zap
} from 'lucide-react';
import { AppLauncherModal } from './AppLauncherModal';
import { Q2C_STAGES, Q2C_MODULES, getStageForTab, Q2CModule } from '../../data/q2cArchitecture';
import { loadSetupConfig } from '../../utils/storage';

interface SalesforceHeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  onNewQuote?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenCompetitorMatrix?: () => void;
  onRunDemoFlow?: () => void;
  onOpenArchitectureModal?: () => void;
}

export const SalesforceHeader: React.FC<SalesforceHeaderProps> = ({
  activeTab,
  setActiveTab,
  currency,
  setCurrency,
  onNewQuote,
  onOpenCommandPalette,
  onOpenCompetitorMatrix,
  onRunDemoFlow,
  onOpenArchitectureModal,
}) => {
  const currencies: Currency[] = ['USD', 'INR', 'EUR', 'GBP'];
  const [brandAccent, setBrandAccent] = useState<string>(() => {
    try {
      return loadSetupConfig().brand?.accent || '#0176d3';
    } catch {
      return '#0176d3';
    }
  });
  const [brandLogo, setBrandLogo] = useState<string>(() => {
    try {
      return loadSetupConfig().brand?.logo || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const handleBrandChange = (e: Event) => {
      const custom = e as CustomEvent<{ accent: string; logo?: string }>;
      if (custom.detail?.accent) {
        setBrandAccent(custom.detail.accent);
      }
      if (custom.detail?.logo !== undefined) {
        setBrandLogo(custom.detail.logo || '');
      }
    };
    window.addEventListener('revx_brand_change', handleBrandChange);
    return () => window.removeEventListener('revx_brand_change', handleBrandChange);
  }, []);
  const [isAppLauncherOpen, setIsAppLauncherOpen] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('launcher') === 'true';
    } catch {
      return false;
    }
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  // Architectural Stage Filter: 'all' or 'crm' | 'cpq' | 'fulfillment' | 'billing' | 'finance'
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');

  const navRef = useRef<HTMLDivElement>(null);

  // Automatically ensure active tab is visible when switching tabs
  useEffect(() => {
    if (selectedStageFilter !== 'all') {
      const currentStage = getStageForTab(activeTab);
      if (currentStage && currentStage.id !== selectedStageFilter && activeTab !== 'command-center') {
        setSelectedStageFilter(currentStage.id);
      }
    }
  }, [activeTab]);

  // Check scroll position to display left/right navigation arrows
  const checkScroll = useCallback(() => {
    if (navRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  // Scroll active tab into view when activeTab or filter changes
  useEffect(() => {
    if (navRef.current) {
      const activeBtn = navRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
      if (activeBtn) {
        const navRect = navRef.current.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const scrollOffset = (btnRect.left - navRect.left) + navRef.current.scrollLeft - (navRef.current.clientWidth / 2) + (btnRect.width / 2);
        navRef.current.scrollTo({
          left: Math.max(0, scrollOffset),
          behavior: 'auto',
        });
      }
      checkScroll();
    }
  }, [activeTab, selectedStageFilter, checkScroll]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (navRef.current) {
      const offset = direction === 'left' ? -280 : 280;
      navRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkScroll, 300);
    }
  };

  // Filter tabs by selected architectural stage
  const visibleTabs = Q2C_MODULES.filter((tab) => {
    if (selectedStageFilter === 'all') return true;
    if (tab.id === 'command-center') return true; // Always allow jumping to Home
    return tab.stageId === selectedStageFilter;
  });

  const activeStageInfo = Q2C_STAGES.find((s) => s.id === selectedStageFilter) || Q2C_STAGES[0];

  // Helper for SaaS Category Badges
  const getBadgeClasses = (badge: string, isActive: boolean) => {
    if (isActive) {
      return 'bg-[#0176d3] text-white shadow-2xs ring-1 ring-white/30';
    }
    switch (badge) {
      case 'Live':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-300/60 shadow-2xs';
      case 'Lead Gen':
      case 'CRM':
      case 'Pipeline':
        return 'bg-sky-50 text-sky-700 border border-sky-300/60 shadow-2xs';
      case 'CPQ':
        return 'bg-purple-50 text-purple-700 border border-purple-300/60 shadow-2xs';
      case 'Oracle':
        return 'bg-blue-50 text-blue-700 border border-blue-300/60 shadow-2xs';
      case 'DealHub':
        return 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-300/60 shadow-2xs';
      case 'SHA-256':
        return 'bg-teal-50 text-teal-700 border border-teal-300/60 shadow-2xs';
      case 'Chargebee':
        return 'bg-orange-50 text-orange-700 border border-orange-300/60 shadow-2xs';
      case 'GST':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-300/60 shadow-2xs';
      case 'BillingPlatform':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-300/60 shadow-2xs';
      case 'Zuora+':
        return 'bg-cyan-50 text-cyan-700 border border-cyan-300/60 shadow-2xs';
      case 'ML':
        return 'bg-amber-50 text-amber-800 border border-amber-300/60 shadow-2xs';
      case 'ASC 606':
        return 'bg-rose-50 text-rose-700 border border-rose-300/60 shadow-2xs';
      default:
        return 'bg-slate-100 text-slate-600 border border-slate-200/60 shadow-2xs';
    }
  };

  // Helper for Stage Pill Active Styling
  const getStageButtonClasses = (stgId: string, isSelected: boolean) => {
    if (!isSelected) {
      return 'text-slate-600 hover:text-slate-900 hover:bg-white/90 border border-transparent font-semibold hover:shadow-2xs';
    }
    switch (stgId) {
      case 'crm':
        return 'bg-white text-sky-700 font-bold shadow-[0_2px_8px_rgba(2,132,199,0.18)] border border-sky-300/90 ring-1 ring-sky-400/25';
      case 'cpq':
        return 'bg-white text-purple-700 font-bold shadow-[0_2px_8px_rgba(124,58,237,0.18)] border border-purple-300/90 ring-1 ring-purple-400/25';
      case 'fulfillment':
        return 'bg-white text-emerald-700 font-bold shadow-[0_2px_8px_rgba(5,150,105,0.18)] border border-emerald-300/90 ring-1 ring-emerald-400/25';
      case 'billing':
        return 'bg-white text-amber-800 font-bold shadow-[0_2px_8px_rgba(217,119,6,0.18)] border border-amber-300/90 ring-1 ring-amber-400/25';
      case 'finance':
        return 'bg-white text-rose-700 font-bold shadow-[0_2px_8px_rgba(220,38,38,0.18)] border border-rose-300/90 ring-1 ring-rose-400/25';
      case 'all':
      default:
        return 'bg-white text-slate-900 font-bold shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-slate-300/90 ring-1 ring-slate-400/20';
    }
  };

  const getStageDotClasses = (stgId: string) => {
    switch (stgId) {
      case 'crm':
        return 'bg-sky-500 shadow-[0_0_6px_rgba(2,132,199,0.6)]';
      case 'cpq':
        return 'bg-purple-500 shadow-[0_0_6px_rgba(124,58,237,0.6)]';
      case 'fulfillment':
        return 'bg-emerald-500 shadow-[0_0_6px_rgba(5,150,105,0.6)]';
      case 'billing':
        return 'bg-amber-500 shadow-[0_0_6px_rgba(217,119,6,0.6)]';
      case 'finance':
        return 'bg-rose-500 shadow-[0_0_6px_rgba(220,38,38,0.6)]';
      case 'all':
      default:
        return 'bg-[#0176d3] shadow-[0_0_6px_rgba(1,118,211,0.6)]';
    }
  };

  return (
    <>
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/80 select-none sticky top-0 z-40 transition-all duration-300 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02)]">
        {/* Level 1: Global Header Bar (Strict h-16 / 64px, vertical center alignment) */}
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-slate-200/80 bg-white gap-4">
          {/* Left: Salesforce 9-Dots App Launcher & RevX Brand Lockup */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Salesforce 9-Dots App Launcher (Authentic SLDS Waffle) */}
            <button
              onClick={() => setIsAppLauncherOpen(true)}
              title="Salesforce App Launcher (View all apps and Quote-to-Cash modules)"
              className={`w-9.5 h-9.5 rounded-lg flex items-center justify-center transition-all duration-150 group cursor-pointer active:scale-95 border ${
                isAppLauncherOpen
                  ? 'bg-[#eef4ff] border-[#0176d3] ring-2 ring-[#0176d3]/30 shadow-xs'
                  : 'bg-white hover:bg-slate-100/90 active:bg-slate-200/70 border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs'
              }`}
            >
              <svg 
                className="w-5.5 h-5.5 transition-transform duration-200 group-hover:scale-110" 
                viewBox="0 0 24 24" 
                fill="none"
              >
                {/* 3x3 Grid of Authentic Salesforce Lightning Circular Dots */}
                {/* Row 1 */}
                <circle cx="5" cy="5" r="2.2" fill={brandAccent} className="transition-colors" />
                <circle cx="12" cy="5" r="2.2" fill={brandAccent} className="transition-colors" />
                <circle cx="19" cy="5" r="2.2" fill={brandAccent} className="transition-colors" />
                {/* Row 2 */}
                <circle cx="5" cy="12" r="2.2" fill={brandAccent} className="transition-colors" />
                <circle cx="12" cy="12" r="2.2" fill={brandAccent} className="transition-colors" />
                <circle cx="19" cy="12" r="2.2" fill={brandAccent} className="transition-colors" />
                {/* Row 3 */}
                <circle cx="5" cy="19" r="2.2" fill={brandAccent} className="transition-colors" />
                <circle cx="12" cy="19" r="2.2" fill={brandAccent} className="transition-colors" />
                <circle cx="19" cy="19" r="2.2" fill={brandAccent} className="transition-colors" />
              </svg>
            </button>

            {/* RevX Brand & Identity Lockup */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Logo with optical height & scaling */}
              <img 
                src={brandLogo || "/revx-logo.png"} 
                alt="RevX - Accelerate Revenue. Anywhere." 
                className="h-9 w-auto object-contain cursor-pointer transition-transform duration-150 hover:scale-105 shrink-0 select-none"
                onClick={() => setActiveTab('command-center')}
                title="RevX - Accelerate Revenue. Anywhere."
              />

              {/* Refined vertical divider */}
              <span className="hidden sm:inline-block w-px h-6 bg-slate-200/90 shrink-0" />

              {/* Professional Salesforce Brand Hierarchy */}
              <div className="hidden sm:flex flex-col justify-center">
                <span className="text-[14.5px] font-bold text-slate-900 tracking-tight leading-tight">
                  Revenue Management
                </span>
                <span className="text-[11px] text-slate-400 font-medium tracking-normal mt-0.5 leading-tight">
                  Enterprise Quote-to-Cash Cloud
                </span>
              </div>
            </div>
          </div>

          {/* Center: Command Search Input (Centered, h-9 / 36px, rounded-lg) */}
          <div className="flex-1 min-w-[220px] max-w-md hidden md:block mx-4">
            <div 
              onClick={onOpenCommandPalette}
              className="relative group cursor-pointer"
            >
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-[#0176d3] transition-colors pointer-events-none" />
              <input
                type="text"
                readOnly
                placeholder="Search quotes, orders, records..."
                onClick={onOpenCommandPalette}
                className="w-full h-9 cursor-pointer bg-slate-100/70 hover:bg-white focus:bg-white border border-slate-200/90 group-hover:border-[#0176d3]/40 rounded-lg pl-10 pr-14 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all shadow-2xs group-hover:shadow-[0_2px_12px_rgba(1,118,211,0.08)]"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white border border-slate-200/90 text-[10px] text-slate-500 font-mono font-medium shadow-2xs group-hover:border-[#0176d3]/30 group-hover:text-[#0176d3] transition-colors pointer-events-none">
                <Command size={10} />
                <span>K</span>
              </div>
            </div>
          </div>

          {/* Right: Actions, FX Switcher & User Profile (All uniform h-9 / 36px and rounded-lg) */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Mobile Search Icon Button */}
            <button
              onClick={onOpenCommandPalette}
              title="Quick Search (Cmd+K)"
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:text-[#0176d3] hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200/60"
            >
              <Search size={16} />
            </button>

            {/* Q2C Architecture Blueprint Button */}
            {onOpenArchitectureModal && (
              <button
                onClick={onOpenArchitectureModal}
                className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:text-[#015ba5] bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-[#0176d3]/40 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                title="View End-to-End Enterprise Quote-to-Cash Architecture & Use Cases"
              >
                <Workflow size={13} className="text-[#0176d3] group-hover:rotate-45 transition-transform duration-300" />
                <span className="hidden xl:inline">Q2C Architecture</span>
                <span className="xl:hidden">Architecture</span>
              </button>
            )}

            {/* 1-Click Autonomous Q2C Pipeline */}
            {onRunDemoFlow && (
              <button
                onClick={onRunDemoFlow}
                className="h-9 hidden 2xl:inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-300/70 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                title="Execute Autonomous Quote-to-Cash Pipeline"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 rq-pulse-dot" />
                <span>Auto Pipeline</span>
              </button>
            )}

            {/* Segmented FX Currency Switcher */}
            <div className="h-9 flex items-center bg-slate-100/90 border border-slate-200/90 rounded-lg p-0.5 shadow-2xs">
              {currencies.map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`h-full px-2.5 text-[11px] rounded-md transition-all cursor-pointer ${
                    currency === c
                      ? 'bg-white text-[#0176d3] shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 font-semibold'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Primary Action: + New Quote */}
            {onNewQuote && (
              <button
                onClick={onNewQuote}
                style={{ backgroundColor: brandAccent, borderColor: brandAccent }}
                className="h-9 inline-flex items-center gap-1.5 px-3.5 rounded-lg text-xs font-bold text-white shadow-xs hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                title="Create New Quote in CPQ Studio"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span className="hidden sm:inline">New Quote</span>
                <span className="sm:hidden">Quote</span>
              </button>
            )}

            {/* Setup Gear Icon */}
            <button
              onClick={() => setActiveTab('setup')}
              title="Setup Cockpit"
              style={activeTab === 'setup' ? { color: brandAccent, borderColor: `${brandAccent}60`, backgroundColor: `${brandAccent}15` } : undefined}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer active:scale-95 border ${
                activeTab === 'setup' 
                  ? 'ring-1 ring-current shadow-xs' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 border-slate-200/80 bg-white shadow-2xs'
              }`}
            >
              <Settings size={16} className="transition-transform duration-300 hover:rotate-90" />
            </button>

            {/* User Profile Avatar */}
            <div 
              title="System Administrator (AD)" 
              className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#015ba5] via-[#0ea5e9] to-[#38bdf8] text-white text-xs font-black flex items-center justify-center ring-1 ring-white/80 shadow-2xs hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
            >
              AD
            </div>
          </div>
        </div>

        {/* Level 2A: Architectural Stage Progression Strip (Fixed h-10 / 40px, proper vertical breathing room) */}
        <div className="h-10 px-4 sm:px-6 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between text-xs overflow-x-auto scrollbar-none gap-3 shrink-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[10.5px] font-mono font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 mr-1">
              <Layers size={13} className="text-[#0176d3]" />
              <span>Q2C Stages:</span>
            </span>

            {/* Segmented Control Capsule */}
            <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/60 border border-slate-200/80">
              {Q2C_STAGES.map((stg) => {
                const isSelected = selectedStageFilter === stg.id;
                return (
                  <button
                    key={stg.id}
                    onClick={() => setSelectedStageFilter(stg.id)}
                    title={stg.description}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${getStageButtonClasses(
                      stg.id,
                      isSelected
                    )}`}
                  >
                    <span>{stg.shortLabel}</span>
                    {isSelected && (
                      <span className={`w-1.5 h-1.5 rounded-full ${getStageDotClasses(stg.id)}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context Use Case or Blueprint CTA on right of Stage Strip */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-600 shrink-0">
            {selectedStageFilter !== 'all' ? (
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white border border-slate-200/80 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3] rq-pulse-dot" />
                <span className="font-semibold text-slate-800">Stage {activeStageInfo.number}:</span>
                <span className="text-slate-600 truncate max-w-md">{activeStageInfo.description}</span>
              </div>
            ) : (
              <span className="text-slate-500 font-medium">
                18 Enterprise Modules in Strict Lead-to-Cash &amp; ASC 606 Order
              </span>
            )}
            {onOpenArchitectureModal && (
              <button
                onClick={onOpenArchitectureModal}
                className="text-[#0176d3] hover:text-[#014486] hover:underline font-bold flex items-center gap-1 cursor-pointer shrink-0 ml-1 transition-colors"
              >
                <span>View Blueprint</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Level 2B: Full-Width Salesforce Lightning Tab Bar (Clean SLDS Tabs, no badge clutter, h-11 / 44px) */}
        <div className="relative bg-white border-b border-slate-200/80 flex items-center h-11 px-4 sm:px-6 shadow-2xs">
          {/* Left Scroll Arrow */}
          {canScrollLeft && (
            <button
              onClick={() => handleScroll('left')}
              title="Scroll tabs left"
              className="shrink-0 mr-2 z-10 w-6.5 h-6.5 rounded-md bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 flex items-center justify-center text-[#0176d3] transition-all cursor-pointer"
            >
              <ChevronLeft size={13} strokeWidth={2.5} />
            </button>
          )}

          {/* Full-Width Tab List */}
          <nav 
            ref={navRef}
            onScroll={checkScroll}
            className="h-full flex items-center overflow-x-auto scrollbar-none flex-1 -mb-px"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={`#${tab.seqNumber} - ${tab.label}: ${tab.desc}\n\nUse Case: ${tab.useCase}`}
                  style={isActive ? { 
                    color: brandAccent, 
                    borderBottomColor: brandAccent,
                    backgroundColor: `${brandAccent}10`
                  } : undefined}
                  className={`group relative h-11 px-3.5 flex items-center gap-1.5 text-xs whitespace-nowrap transition-colors shrink-0 cursor-pointer select-none border-b-2 ${
                    isActive
                      ? 'font-bold'
                      : 'text-slate-600 hover:text-slate-900 border-transparent hover:border-slate-300 hover:bg-slate-50/80 font-medium'
                  }`}
                >
                  <Icon 
                    size={14} 
                    style={isActive ? { color: brandAccent } : undefined}
                    className={`transition-colors shrink-0 ${
                      isActive 
                        ? '' 
                        : 'text-slate-400 group-hover:text-slate-700'
                    }`} 
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Scroll Arrow */}
          {canScrollRight && (
            <button
              onClick={() => handleScroll('right')}
              title="Scroll tabs right"
              className="shrink-0 ml-2 z-10 w-6.5 h-6.5 rounded-md bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 flex items-center justify-center text-[#0176d3] transition-all cursor-pointer"
            >
              <ChevronRight size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </header>

      {/* Full Salesforce App Launcher Modal (Interactive on click of 9-dots waffle icon) */}
      <AppLauncherModal
        isOpen={isAppLauncherOpen}
        onClose={() => setIsAppLauncherOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewQuote={onNewQuote}
        onRunDemoFlow={onRunDemoFlow}
        onOpenCompetitorMatrix={onOpenCompetitorMatrix}
        onOpenArchitectureModal={onOpenArchitectureModal}
      />
    </>
  );
};
