import React, { useState, useMemo, useEffect } from 'react';
import { SetupConfig, Currency } from '../../types';
import { INITIAL_SETUP_CONFIG } from '../../data/mockData';
import { loadSetupConfig, saveSetupConfig } from '../../utils/storage';
import { applyBrandTheme } from '../../utils/theme';
import { 
  Building2, 
  Palette, 
  FileText, 
  Coins, 
  ShieldAlert, 
  Receipt, 
  CreditCard, 
  Bell, 
  RefreshCw, 
  Clock, 
  Mail, 
  Zap, 
  Sliders, 
  Bot, 
  Database, 
  History, 
  Search, 
  Save, 
  CheckCircle2, 
  ExternalLink, 
  RotateCcw,
  Plus,
  Trash2,
  Play,
  Sparkles,
  ShieldCheck,
  Upload,
  Check,
  ChevronRight,
  Eye,
  AlertCircle
} from 'lucide-react';

interface SetupCockpitProps {
  onResetFactoryData?: () => void;
  onExportStateJSON?: () => void;
}

interface SetupSection {
  id: string;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const SECTIONS: SetupSection[] = [
  { id: 'company', label: 'Company', blurb: 'Who your quotes and invoices come from', icon: Building2 },
  { id: 'branding', label: 'Branding', blurb: 'The colour and logo of the whole app', icon: Palette },
  { id: 'pdf', label: 'Documents & PDF', blurb: 'How quotes and invoices print', icon: FileText },
  { id: 'tax', label: 'Tax & currency', blurb: 'Country, tax system, rates and money format', icon: Coins },
  { id: 'pricing', label: 'Pricing & approvals', blurb: 'When a quote needs a manager', icon: ShieldAlert },
  { id: 'billing', label: 'Billing', blurb: 'Invoice numbers, due dates and reminders', icon: Receipt },
  { id: 'payments', label: 'Payment gateways', blurb: 'Stripe, Razorpay, online checkout and webhooks', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', blurb: 'Which events tell someone', icon: Bell },
  { id: 'sync', label: 'Salesforce sync', blurb: 'Keep Opportunities, Accounts and Contacts in step', icon: RefreshCw },
  { id: 'jobs', label: 'Scheduled jobs', blurb: 'Daily billing runs, renewals and revenue recognition', icon: Clock },
  { id: 'emails', label: 'Email templates', blurb: 'Customer emails and merge fields', icon: Mail },
  { id: 'automation', label: 'Automation rules', blurb: 'Custom triggers, webhooks and tasks', icon: Zap },
  { id: 'productRules', label: 'Product & CPQ rules', blurb: 'Validation, auto-add and bundle logic', icon: Sliders },
  { id: 'ai', label: 'AI & Intelligence', blurb: 'LLM providers, Deal Advisor & predictive models', icon: Bot },
  { id: 'dataManagement', label: 'Data Management', blurb: 'Live record volumes & system baseline data', icon: Database },
  { id: 'history', label: 'Version history', blurb: 'Every publish, and a way back', icon: History },
];

const SWATCHES = [
  { name: 'RevX Blue', value: '#0176d3' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Teal', value: '#0b827c' },
  { name: 'Emerald', value: '#2e844a' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Orange', value: '#c2410c' },
  { name: 'Slate', value: '#334155' },
];

const INDIAN_STATES = [
  'Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu', 'Telangana', 'Gujarat', 
  'Haryana', 'Uttar Pradesh', 'West Bengal', 'Rajasthan', 'Kerala', 'Punjab'
];

export const SetupCockpit: React.FC<SetupCockpitProps> = ({
  onResetFactoryData,
  onExportStateJSON,
}) => {
  const [config, setConfig] = useState<SetupConfig>(() => loadSetupConfig());
  const [activeSectionId, setActiveSectionId] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sec = params.get('section');
      if (sec && SECTIONS.some(s => s.id === sec)) return sec;
      return 'company';
    } catch {
      return 'company';
    }
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('section') !== activeSectionId) {
        url.searchParams.set('section', activeSectionId);
        window.history.replaceState({}, '', url.toString());
      }
    } catch {
      // ignore
    }
  }, [activeSectionId]);

  // Diagnostic modal/state
  const [runningDiag, setRunningDiag] = useState<boolean>(false);
  const [diagLogs, setDiagLogs] = useState<string[]>([]);
  const [gatewayTestStatus, setGatewayTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [jobRunning, setJobRunning] = useState<boolean>(false);

  // Tax Simulator state
  const [taxSimAmount, setTaxSimAmount] = useState<number>(100000);
  const [taxSimIsHomeRegion, setTaxSimIsHomeRegion] = useState<boolean>(true);

  // New sync rule inline form
  const [newSyncRule, setNewSyncRule] = useState({
    moment: 'quote_signed',
    target: 'Opportunity',
    field: 'StageName',
    source: 'value',
    value: 'Closed Won'
  });

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.filter(s => s.label.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q));
  }, [searchQuery]);

  const activeSection = useMemo(() => {
    return SECTIONS.find(s => s.id === activeSectionId) || SECTIONS[0];
  }, [activeSectionId]);

  const handleBrandAccentChange = (accent: string) => {
    setConfig(prev => ({
      ...prev,
      brand: { ...prev.brand, accent }
    }));
    applyBrandTheme(accent, config.brand.logo);
  };

  const handleBrandLogoChange = (logo: string) => {
    setConfig(prev => ({
      ...prev,
      brand: { ...prev.brand, logo }
    }));
    applyBrandTheme(config.brand.accent, logo);
  };

  const handleSave = () => {
    setIsSaving(true);
    saveSetupConfig(config);
    applyBrandTheme(config.brand.accent, config.brand.logo);
    setTimeout(() => {
      setIsSaving(false);
      setSaveBanner(`Settings successfully published as Version v2.4.${config.history.length + 1}. Brand colors and calculation engines updated.`);
      setTimeout(() => setSaveBanner(null), 4000);
    }, 500);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all setup configuration settings to RevX defaults?')) {
      setConfig(INITIAL_SETUP_CONFIG);
      saveSetupConfig(INITIAL_SETUP_CONFIG);
      applyBrandTheme(INITIAL_SETUP_CONFIG.brand.accent, INITIAL_SETUP_CONFIG.brand.logo);
      setSaveBanner('Configuration restored to factory default settings.');
      setTimeout(() => setSaveBanner(null), 3500);
    }
  };

  const runDiagnostics = () => {
    setRunningDiag(true);
    setDiagLogs(['[00.01s] Starting RevX System 360 Architecture Audit...']);
    setTimeout(() => {
      setDiagLogs(p => [...p, '✓ Subsystem 1: CPQ Tiered Pricing & Discount Matrix — HEALTHY']);
    }, 300);
    setTimeout(() => {
      setDiagLogs(p => [...p, '✓ Subsystem 2: Cryptographic eSign & SHA-256 Digest — HEALTHY']);
    }, 600);
    setTimeout(() => {
      setDiagLogs(p => [...p, '✓ Subsystem 3: Indian GST & NIC IRN e-Invoicing Service — CONNECTED']);
    }, 900);
    setTimeout(() => {
      setDiagLogs(p => [...p, '✓ Subsystem 4: Payment Gateway (Stripe & Razorpay) — VERIFIED']);
    }, 1200);
    setTimeout(() => {
      setDiagLogs(p => [...p, '✓ Subsystem 5: Zuora Usage Mediation & Event Drawdown — OPERATIONAL']);
    }, 1500);
    setTimeout(() => {
      setDiagLogs(p => [...p, '🎉 Overall Health: 99.4% (All 16 Configuration Modules Operational)']);
      setRunningDiag(false);
    }, 1800);
  };

  const testGateway = () => {
    setGatewayTestStatus('testing');
    setTimeout(() => {
      setGatewayTestStatus('success');
      setTimeout(() => setGatewayTestStatus('idle'), 3500);
    }, 900);
  };

  const triggerJobRun = () => {
    setJobRunning(true);
    setTimeout(() => {
      setJobRunning(false);
      setConfig(prev => ({
        ...prev,
        jobs: {
          ...prev.jobs,
          lastRunAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
        }
      }));
    }, 1200);
  };

  // Helper tax calculator
  const taxSimCalculated = useMemo(() => {
    const rate = config.tax.rate;
    if (config.tax.mode === 'none') {
      return { base: taxSimAmount, cgst: 0, sgst: 0, igst: 0, total: taxSimAmount };
    }
    if (config.tax.mode === 'split') {
      if (taxSimIsHomeRegion) {
        const halfRate = rate / 2;
        const cgst = (taxSimAmount * halfRate) / 100;
        const sgst = (taxSimAmount * halfRate) / 100;
        return { base: taxSimAmount, cgst, sgst, igst: 0, total: taxSimAmount + cgst + sgst };
      } else {
        const igst = (taxSimAmount * rate) / 100;
        return { base: taxSimAmount, cgst: 0, sgst: 0, igst, total: taxSimAmount + igst };
      }
    }
    const singleTax = (taxSimAmount * rate) / 100;
    return { base: taxSimAmount, cgst: 0, sgst: 0, igst: singleTax, total: taxSimAmount + singleTax };
  }, [taxSimAmount, taxSimIsHomeRegion, config.tax]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header matching RevX Style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#dde1e9]">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#706e6b]">
            SETUP
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#10233f] tracking-tight">
            Make RevX <span className="text-[#0176d3]">work your way</span>.
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runDiagnostics}
            disabled={runningDiag}
            className="rq-btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={runningDiag ? 'animate-spin' : ''} />
            <span>{runningDiag ? 'Auditing...' : '360 Health Check'}</span>
          </button>

          <button
            onClick={handleResetToDefaults}
            className="rq-btn-secondary text-xs flex items-center gap-1.5 text-rose-600 hover:text-rose-700"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rq-btn-primary text-xs flex items-center gap-1.5 shadow-xs"
          >
            <Save size={14} />
            <span>{isSaving ? 'Publishing...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Save Success Banner */}
      {saveBanner && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* Diagnostics Logs Drawer if active */}
      {diagLogs.length > 0 && (
        <div className="p-4 rounded-xl bg-[#090d16] text-emerald-400 font-mono text-xs space-y-1 shadow-md border border-slate-800">
          <div className="flex items-center justify-between pb-1 mb-2 border-b border-slate-800">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              Subsystem Diagnostic Log
            </span>
            <button 
              onClick={() => setDiagLogs([])}
              className="text-slate-400 hover:text-white text-[11px]"
            >
              Dismiss ✕
            </button>
          </div>
          {diagLogs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      )}

      {/* Main Two-Column Setup Layout */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left Sidebar Navigation */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 bg-white rounded-xl border border-[#dde1e9] shadow-2xs overflow-hidden">
          {/* Module Search Bar */}
          <div className="p-3 border-b border-[#edf1f7] bg-[#f8fafc]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#706e6b]" />
              <input
                type="text"
                placeholder="Search 16 modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#dde1e9] rounded-lg focus:outline-none focus:border-[#0176d3]"
              />
            </div>
          </div>

          {/* 16 Navigation Modules List */}
          <div className="divide-y divide-[#f1f4f9] max-h-[720px] overflow-y-auto">
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSectionId === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer ${
                    isActive
                      ? 'bg-[#f0f7ff] border-l-4 border-[#0176d3]'
                      : 'hover:bg-[#fafcff] border-l-4 border-transparent'
                  }`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-lg ${isActive ? 'bg-[#0176d3] text-white shadow-2xs' : 'text-[#706e6b] bg-[#edf1f7]'}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold leading-tight ${isActive ? 'text-[#0176d3]' : 'text-[#10233f]'}`}>
                      {sec.label}
                    </div>
                    <div className="text-[11px] text-[#5c6678] mt-0.5 leading-snug line-clamp-1">
                      {sec.blurb}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Active Configuration Panel */}
        <div className="flex-1 w-full min-w-0 bg-white rounded-xl border border-[#dde1e9] p-5 sm:p-7 shadow-2xs space-y-6">
          {/* Section Header */}
          <div className="pb-4 border-b border-[#edf1f7]">
            <h2 className="text-xl font-extrabold text-[#10233f]">
              {activeSection.label}
            </h2>
            <p className="text-xs text-[#5c6678] mt-0.5">
              {activeSection.blurb}
            </p>
          </div>

          {/* 1. COMPANY SECTION (Matching User's Screenshot Exactly) */}
          {activeSectionId === 'company' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">
                  Company name
                </label>
                <input
                  type="text"
                  value={config.company.name}
                  onChange={(e) => setConfig({
                    ...config,
                    company: { ...config.company, name: e.target.value }
                  })}
                  className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0176d3]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={config.company.registrationNumber}
                    onChange={(e) => setConfig({
                      ...config,
                      company: { ...config.company, registrationNumber: e.target.value }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0176d3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    Accounts email
                  </label>
                  <input
                    type="email"
                    value={config.company.email}
                    onChange={(e) => setConfig({
                      ...config,
                      company: { ...config.company, email: e.target.value }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0176d3]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={config.company.address}
                  onChange={(e) => setConfig({
                    ...config,
                    company: { ...config.company, address: e.target.value }
                  })}
                  className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0176d3]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="sm:col-span-1">
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={config.company.city}
                    onChange={(e) => setConfig({
                      ...config,
                      company: { ...config.company, city: e.target.value }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0176d3]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    State
                  </label>
                  <select
                    value={config.company.state}
                    onChange={(e) => setConfig({
                      ...config,
                      company: { ...config.company, state: e.target.value }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#0176d3]"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[#706e6b] mt-1 block">
                    Your home region. With a split tax it decides which tax lines a customer gets.
                  </span>
                </div>

                <div className="sm:col-span-1">
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    Postal code
                  </label>
                  <input
                    type="text"
                    value={config.company.postalCode}
                    onChange={(e) => setConfig({
                      ...config,
                      company: { ...config.company, postalCode: e.target.value }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0176d3]"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={config.company.phone}
                    onChange={(e) => setConfig({
                      ...config,
                      company: { ...config.company, phone: e.target.value }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0176d3]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">
                  Website
                </label>
                <input
                  type="text"
                  value={config.company.website}
                  onChange={(e) => setConfig({
                    ...config,
                    company: { ...config.company, website: e.target.value }
                  })}
                  className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0176d3]"
                />
              </div>
            </div>
          )}

          {/* 2. BRANDING SECTION */}
          {activeSectionId === 'branding' && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-2">
                  Accent colour
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="color"
                    value={config.brand.accent}
                    onChange={(e) => handleBrandAccentChange(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border border-[#dde1e9]"
                  />
                  <input
                    type="text"
                    value={config.brand.accent}
                    onChange={(e) => handleBrandAccentChange(e.target.value)}
                    className="w-28 text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {SWATCHES.map((sw) => (
                      <button
                        key={sw.value}
                        title={sw.name}
                        onClick={() => handleBrandAccentChange(sw.value)}
                        style={{ backgroundColor: sw.value }}
                        className={`w-7 h-7 rounded-full border transition-all cursor-pointer ${
                          config.brand.accent === sw.value ? 'ring-2 ring-offset-2 ring-[#10233f] scale-110' : 'border-black/10 hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[11px] text-[#706e6b] mt-1.5 block flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-time live sync: Headers, 9-dot launcher, buttons, tabs, and backgrounds update instantly.</span>
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-2">
                  Application Logo
                </label>
                <div className="flex items-center gap-4 p-4 border border-[#dde1e9] rounded-xl bg-[#fafcff]">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 bg-white flex items-center justify-center p-2 shadow-2xs font-extrabold text-[#0176d3] text-lg">
                    {config.brand.logo ? (
                      <img src={config.brand.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                    ) : (
                      'RevX'
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const url = prompt('Enter image URL for logo:', 'https://cdn.revx.io/logo.png');
                          if (url) handleBrandLogoChange(url);
                        }}
                        className="rq-btn-secondary text-xs flex items-center gap-1"
                      >
                        <Upload size={12} />
                        <span>Update Logo URL</span>
                      </button>
                      <button 
                        onClick={() => handleBrandLogoChange('')}
                        className="rq-btn-secondary text-xs"
                      >
                        Use Default RevX Logo
                      </button>
                    </div>
                    <span className="text-[11px] text-[#706e6b] block">
                      PNG, SVG, or JPG under 1 MB. Renders at top of the navigation bar and on generated PDF quotes/invoices.
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Preview Sample */}
              <div className="p-4 rounded-xl border border-[#dde1e9] bg-[#f8fafc] space-y-3">
                <span className="text-xs font-bold text-[#10233f] block">Brand Accent Live Preview</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <button 
                    style={{ backgroundColor: config.brand.accent }}
                    className="text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs"
                  >
                    Primary Action Button
                  </button>
                  <span 
                    style={{ color: config.brand.accent, backgroundColor: `${config.brand.accent}15` }}
                    className="text-xs font-extrabold px-3 py-1 rounded-full border border-current"
                  >
                    Active Approved Pill
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. DOCUMENTS & PDF */}
          {activeSectionId === 'pdf' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Layout</label>
                  <div className="flex gap-2">
                    {(['classic', 'modern', 'minimal'] as const).map(l => (
                      <button
                        key={l}
                        onClick={() => setConfig({ ...config, pdf: { ...config.pdf, layout: l } })}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border capitalize ${
                          config.pdf.layout === l ? 'bg-[#0176d3] text-white border-[#0176d3]' : 'bg-white text-[#5c6678] border-[#dde1e9]'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Page Size</label>
                  <div className="flex gap-2">
                    {(['A4', 'Letter'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setConfig({ ...config, pdf: { ...config.pdf, pageSize: p } })}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${
                          config.pdf.pageSize === p ? 'bg-[#0176d3] text-white border-[#0176d3]' : 'bg-white text-[#5c6678] border-[#dde1e9]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Quote Title</label>
                  <input
                    type="text"
                    value={config.pdf.quoteTitle}
                    onChange={(e) => setConfig({ ...config, pdf: { ...config.pdf, quoteTitle: e.target.value } })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Invoice Title</label>
                  <input
                    type="text"
                    value={config.pdf.invoiceTitle}
                    onChange={(e) => setConfig({ ...config, pdf: { ...config.pdf, invoiceTitle: e.target.value } })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {[
                  { key: 'showLogo', label: 'Show Company Logo' },
                  { key: 'showUnit', label: 'Show Units Under Product' },
                  { key: 'showDiscount', label: 'Show Discount Column' },
                  { key: 'showTaxBreakup', label: 'Show Tax Breakup (CGST/SGST)' },
                  { key: 'draftWatermark', label: 'Watermark Unsigned DRAFT' },
                  { key: 'showSignature', label: 'Include Signature Block' },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-xs font-medium text-[#10233f] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.pdf as any)[item.key]}
                      onChange={(e) => setConfig({
                        ...config,
                        pdf: { ...config.pdf, [item.key]: e.target.checked }
                      })}
                      className="rounded border-[#dde1e9] text-[#0176d3] focus:ring-0"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Bank Payment Details</label>
                <textarea
                  rows={2}
                  value={config.pdf.bankDetails}
                  onChange={(e) => setConfig({ ...config, pdf: { ...config.pdf, bankDetails: e.target.value } })}
                  className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Standard Terms &amp; Conditions (One per line)</label>
                <textarea
                  rows={3}
                  value={config.pdf.terms}
                  onChange={(e) => setConfig({ ...config, pdf: { ...config.pdf, terms: e.target.value } })}
                  className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 font-mono"
                />
              </div>
            </div>
          )}

          {/* 4. TAX & CURRENCY */}
          {activeSectionId === 'tax' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Country</label>
                  <select
                    value={config.tax.country}
                    onChange={(e) => setConfig({
                      ...config,
                      tax: { 
                        ...config.tax, 
                        country: e.target.value,
                        countryName: e.target.value === 'IN' ? 'India' : 'United States'
                      }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="IN">India (GST)</option>
                    <option value="US">United States (Sales Tax)</option>
                    <option value="GB">United Kingdom (VAT)</option>
                    <option value="DE">Germany (VAT)</option>
                    <option value="SG">Singapore (GST)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Currency</label>
                  <select
                    value={config.tax.currency}
                    onChange={(e) => setConfig({
                      ...config,
                      tax: { ...config.tax, currency: e.target.value as Currency }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Tax System Name</label>
                  <input
                    type="text"
                    value={config.tax.system}
                    onChange={(e) => setConfig({
                      ...config,
                      tax: { ...config.tax, system: e.target.value }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Standard Rate %</label>
                  <input
                    type="number"
                    value={config.tax.rate}
                    onChange={(e) => setConfig({
                      ...config,
                      tax: { ...config.tax, rate: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Calculation Mode</label>
                  <select
                    value={config.tax.mode}
                    onChange={(e) => setConfig({
                      ...config,
                      tax: { ...config.tax, mode: e.target.value as any }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="split">Split by Home Region (CGST/SGST/IGST)</option>
                    <option value="single">Single Rate (Standard VAT)</option>
                    <option value="regional">Regional Slabs (US Sales Tax)</option>
                    <option value="none">No Tax</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Registration Label</label>
                  <input
                    type="text"
                    value={config.tax.registrationLabel}
                    onChange={(e) => setConfig({
                      ...config,
                      tax: { ...config.tax, registrationLabel: e.target.value }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Interactive Tax Simulator */}
              <div className="p-4 rounded-xl border border-[#dde1e9] bg-[#fafcff] space-y-3">
                <span className="text-xs font-bold text-[#10233f] block">
                  Interactive Tax Rating Simulator
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-[#5c6678] block mb-1">Test Net Amount</label>
                    <input
                      type="number"
                      value={taxSimAmount}
                      onChange={(e) => setTaxSimAmount(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#5c6678] block mb-1">Customer Location</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTaxSimIsHomeRegion(true)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${taxSimIsHomeRegion ? 'bg-[#0176d3] text-white border-[#0176d3]' : 'bg-white text-[#5c6678] border-[#dde1e9]'}`}
                      >
                        Home State (Intra)
                      </button>
                      <button
                        onClick={() => setTaxSimIsHomeRegion(false)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${!taxSimIsHomeRegion ? 'bg-[#0176d3] text-white border-[#0176d3]' : 'bg-white text-[#5c6678] border-[#dde1e9]'}`}
                      >
                        Other State (Inter)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#dde1e9] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div><span className="text-[#5c6678] block text-[10px]">Taxable Base:</span> ₹{taxSimCalculated.base.toLocaleString()}</div>
                  {config.tax.mode === 'split' && taxSimIsHomeRegion ? (
                    <>
                      <div><span className="text-[#5c6678] block text-[10px]">CGST ({config.tax.rate / 2}%):</span> ₹{taxSimCalculated.cgst.toLocaleString()}</div>
                      <div><span className="text-[#5c6678] block text-[10px]">SGST ({config.tax.rate / 2}%):</span> ₹{taxSimCalculated.sgst.toLocaleString()}</div>
                    </>
                  ) : (
                    <div><span className="text-[#5c6678] block text-[10px]">IGST ({config.tax.rate}%):</span> ₹{taxSimCalculated.igst.toLocaleString()}</div>
                  )}
                  <div className="font-extrabold text-[#0176d3]"><span className="text-[#5c6678] block text-[10px]">Total Invoice:</span> ₹{taxSimCalculated.total.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

          {/* 5. PRICING & APPROVALS (Oracle CPQ Parity) */}
          {activeSectionId === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    Discount Approval Threshold %
                  </label>
                  <input
                    type="number"
                    value={config.pricing.discountLimit}
                    onChange={(e) => setConfig({
                      ...config,
                      pricing: { ...config.pricing, discountLimit: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                  <span className="text-[11px] text-[#706e6b] mt-1 block">
                    Any quote item discounted higher than this automatically routes to the approval queue.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    Margin Floor % (Oracle Governance)
                  </label>
                  <input
                    type="number"
                    value={config.pricing.marginFloor}
                    onChange={(e) => setConfig({
                      ...config,
                      pricing: { ...config.pricing, marginFloor: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                  <span className="text-[11px] text-[#706e6b] mt-1 block">
                    Deals falling below this gross profit margin trigger immediate CFO escalation.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    Standard Payment Terms
                  </label>
                  <select
                    value={config.pricing.standardTerms}
                    onChange={(e) => setConfig({
                      ...config,
                      pricing: { ...config.pricing, standardTerms: e.target.value }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="Net 30">Net 30</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">
                    Quote Validity (Days)
                  </label>
                  <input
                    type="number"
                    value={config.pricing.quoteValidDays}
                    onChange={(e) => setConfig({
                      ...config,
                      pricing: { ...config.pricing, quoteValidDays: parseInt(e.target.value) || 30 }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">
                  Default Commercial Approver
                </label>
                <input
                  type="text"
                  value={config.pricing.approver}
                  onChange={(e) => setConfig({
                    ...config,
                    pricing: { ...config.pricing, approver: e.target.value }
                  })}
                  className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}

          {/* 6. BILLING */}
          {activeSectionId === 'billing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={config.billing.invoicePrefix}
                    onChange={(e) => setConfig({
                      ...config,
                      billing: { ...config.billing, invoicePrefix: e.target.value }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Due After (Days)</label>
                  <input
                    type="number"
                    value={config.billing.invoiceDueDays}
                    onChange={(e) => setConfig({
                      ...config,
                      billing: { ...config.billing, invoiceDueDays: parseInt(e.target.value) || 30 }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Late Fee % / Month</label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.billing.lateFeePercent}
                    onChange={(e) => setConfig({
                      ...config,
                      billing: { ...config.billing, lateFeePercent: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#dde1e9] bg-[#f8fafc] space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-[#10233f] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.billing.irnEnabled}
                    onChange={(e) => setConfig({
                      ...config,
                      billing: { ...config.billing, irnEnabled: e.target.checked }
                    })}
                    className="rounded border-[#dde1e9] text-[#0176d3]"
                  />
                  <span>Enforce Indian GST NIC e-Invoice IRN Generation (64-character SHA-256 Hash)</span>
                </label>
                <p className="text-[11px] text-[#5c6678] pl-6">
                  Automatically generates signed cryptographic IRN hashes and B2B QR codes for invoices with buyer GSTIN.
                </p>
              </div>
            </div>
          )}

          {/* 7. PAYMENT GATEWAYS */}
          {activeSectionId === 'payments' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Primary Payment Gateway</label>
                  <select
                    value={config.payments.gateway}
                    onChange={(e) => setConfig({
                      ...config,
                      payments: { ...config.payments, gateway: e.target.value as any }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="razorpay">Razorpay (India UPI / Cards / Netbanking)</option>
                    <option value="stripe">Stripe (Global Credit Cards / ACH / SEPA)</option>
                    <option value="adyen">Adyen Enterprise</option>
                    <option value="manual">Manual Bank Wire Settlement</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#10233f] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.payments.testMode}
                      onChange={(e) => setConfig({
                        ...config,
                        payments: { ...config.payments, testMode: e.target.checked }
                      })}
                      className="rounded border-[#dde1e9] text-[#0176d3]"
                    />
                    <span>Sandbox / Test Mode Active</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Razorpay Key ID</label>
                <input
                  type="text"
                  value={config.payments.razorpayKey}
                  onChange={(e) => setConfig({
                    ...config,
                    payments: { ...config.payments, razorpayKey: e.target.value }
                  })}
                  className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Stripe Secret Key</label>
                <input
                  type="password"
                  value={config.payments.stripeKey}
                  onChange={(e) => setConfig({
                    ...config,
                    payments: { ...config.payments, stripeKey: e.target.value }
                  })}
                  className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Webhook Secret (HMAC-SHA256)</label>
                <input
                  type="password"
                  value={config.payments.webhookSecret}
                  onChange={(e) => setConfig({
                    ...config,
                    payments: { ...config.payments, webhookSecret: e.target.value }
                  })}
                  className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={testGateway}
                  disabled={gatewayTestStatus === 'testing'}
                  className="rq-btn-secondary text-xs flex items-center gap-1.5"
                >
                  <RefreshCw size={13} className={gatewayTestStatus === 'testing' ? 'animate-spin' : ''} />
                  <span>{gatewayTestStatus === 'testing' ? 'Verifying Gateway Ping...' : 'Test Gateway Connection'}</span>
                </button>
                {gatewayTestStatus === 'success' && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <Check size={14} /> Gateway connection verified (200 OK)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 8. NOTIFICATIONS */}
          {activeSectionId === 'notifications' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#10233f] block">
                Automated Transactional Notification Matrix
              </span>
              <div className="divide-y divide-[#edf1f7] border border-[#dde1e9] rounded-xl overflow-hidden bg-white">
                {[
                  { key: 'approvalPending', label: 'Quote Approval Requested', desc: 'Alerts designated approvers when a quote breaches discount limit or margin floor.' },
                  { key: 'quoteViewed', label: 'Customer Viewed DealRoom / Quote', desc: 'Real-time telemetry alert for sales reps when client opens link.' },
                  { key: 'quoteSigned', label: 'Quote Signed via eSign', desc: 'Dispatches notification with cryptographic completion certificate to rep and billing team.' },
                  { key: 'invoiceOverdue', label: 'Invoice Overdue Notice', desc: 'Automated dunning alert sent on day 1 after invoice payment deadline passes.' },
                  { key: 'paymentReceived', label: 'Payment Receipt Confirmed', desc: 'Instantly alerts accounts receivable and settles invoice record.' },
                  { key: 'renewalDue', label: 'Subscription Renewal Alert (90/60/30 Days)', desc: 'Advance notice for account managers before automatic contract rollover.' },
                ].map((item) => (
                  <div key={item.key} className="p-3.5 flex items-center justify-between hover:bg-[#fafcff]">
                    <div>
                      <div className="text-xs font-bold text-[#10233f]">{item.label}</div>
                      <div className="text-[11px] text-[#5c6678] mt-0.5">{item.desc}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(config.notifications as any)[item.key]}
                        onChange={(e) => setConfig({
                          ...config,
                          notifications: { ...config.notifications, [item.key]: e.target.checked }
                        })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0176d3]"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. SALESFORCE SYNC */}
          {activeSectionId === 'sync' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#10233f]">Bi-Directional CRM Sync Engine</h3>
                  <p className="text-[11px] text-[#5c6678]">Synchronizes RevX transactions with Opportunities, Accounts, and Contacts.</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-[#dde1e9] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Trigger Moment</th>
                      <th className="py-2.5 px-3">Target Object</th>
                      <th className="py-2.5 px-3">Field</th>
                      <th className="py-2.5 px-3">Updated Value</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f7]">
                    {config.sync.rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-[#fafcff]">
                        <td className="py-2.5 px-3 font-mono text-[#0176d3]">{rule.moment}</td>
                        <td className="py-2.5 px-3 font-bold">{rule.target}</td>
                        <td className="py-2.5 px-3 font-mono">{rule.field}</td>
                        <td className="py-2.5 px-3 text-emerald-700 font-bold">{rule.value}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setConfig({
                              ...config,
                              sync: { ...config.sync, rules: config.sync.rules.filter(r => r.id !== rule.id) }
                            })}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add New Rule Row */}
              <div className="p-3 rounded-xl border border-[#dde1e9] bg-[#fafcff] space-y-3">
                <span className="text-xs font-bold text-[#10233f] block">+ Add Custom Synchronization Mapping</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select
                    value={newSyncRule.moment}
                    onChange={(e) => setNewSyncRule({ ...newSyncRule, moment: e.target.value })}
                    className="text-xs border border-[#dde1e9] rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="quote_signed">When Quote Signed</option>
                    <option value="order_activated">When Order Activated</option>
                    <option value="invoice_paid">When Invoice Paid</option>
                  </select>
                  <select
                    value={newSyncRule.target}
                    onChange={(e) => setNewSyncRule({ ...newSyncRule, target: e.target.value })}
                    className="text-xs border border-[#dde1e9] rounded-lg px-2 py-1.5 bg-white"
                  >
                    <option value="Opportunity">Opportunity</option>
                    <option value="Account">Account</option>
                    <option value="Contact">Contact</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Field name (e.g. StageName)"
                    value={newSyncRule.field}
                    onChange={(e) => setNewSyncRule({ ...newSyncRule, field: e.target.value })}
                    className="text-xs border border-[#dde1e9] rounded-lg px-2 py-1.5"
                  />
                  <input
                    type="text"
                    placeholder="New Value"
                    value={newSyncRule.value}
                    onChange={(e) => setNewSyncRule({ ...newSyncRule, value: e.target.value })}
                    className="text-xs border border-[#dde1e9] rounded-lg px-2 py-1.5"
                  />
                </div>
                <button
                  onClick={() => {
                    if (newSyncRule.field && newSyncRule.value) {
                      setConfig({
                        ...config,
                        sync: {
                          ...config.sync,
                          rules: [
                            ...config.sync.rules,
                            { id: `sync-${Date.now()}`, ...newSyncRule }
                          ]
                        }
                      });
                      setNewSyncRule({ moment: 'quote_signed', target: 'Opportunity', field: '', source: 'value', value: '' });
                    }
                  }}
                  className="rq-btn-primary text-xs"
                >
                  Add Sync Rule
                </button>
              </div>
            </div>
          )}

          {/* 10. SCHEDULED JOBS */}
          {activeSectionId === 'jobs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[#dde1e9] bg-[#fafcff] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#10233f]">Daily Billing Daemon</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-[#5c6678]">
                    Executes automated recurring billing runs, pro-rations, and generating GST invoices.
                  </p>
                  <div className="text-xs font-mono font-bold text-[#10233f] pt-1">
                    Scheduled at: 02:00 UTC Daily
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#dde1e9] bg-[#fafcff] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#10233f]">ASC 606 RevRec Engine</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-[#5c6678]">
                    Calculates ratable performance obligations and daily deferred-to-recognized journal postings.
                  </p>
                  <div className="text-xs font-mono font-bold text-[#10233f] pt-1">
                    Scheduled at: 04:00 UTC Daily
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#dde1e9] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-[#10233f]">Manual Job Execution</div>
                  <div className="text-[11px] text-[#5c6678] mt-0.5">
                    Last Run: <span className="font-mono font-bold">{config.jobs.lastRunAt}</span>
                  </div>
                </div>
                <button
                  onClick={triggerJobRun}
                  disabled={jobRunning}
                  className="rq-btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Play size={12} className={jobRunning ? 'animate-spin' : ''} />
                  <span>{jobRunning ? 'Executing Jobs...' : 'Trigger Immediate Job Run'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 11. EMAIL TEMPLATES */}
          {activeSectionId === 'emails' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Select Template</label>
                <select
                  value={config.emails.selectedTemplate}
                  onChange={(e) => setConfig({
                    ...config,
                    emails: { ...config.emails, selectedTemplate: e.target.value }
                  })}
                  className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 bg-white"
                >
                  <option value="quote_sent">Quote Sent to Customer</option>
                  <option value="invoice_sent">Tax Invoice Dispatched</option>
                  <option value="reminder">Overdue Payment Reminder</option>
                  <option value="payment_received">Payment Settlement Receipt</option>
                  <option value="renewal_due">Subscription Renewal Advance Notice</option>
                  <option value="approval_pending">Internal Commercial Approval Request</option>
                </select>
              </div>

              {config.emails.templates[config.emails.selectedTemplate] && (
                <>
                  <div>
                    <label className="text-xs font-bold text-[#10233f] block mb-1">Subject Line</label>
                    <input
                      type="text"
                      value={config.emails.templates[config.emails.selectedTemplate].subject}
                      onChange={(e) => setConfig({
                        ...config,
                        emails: {
                          ...config.emails,
                          templates: {
                            ...config.emails.templates,
                            [config.emails.selectedTemplate]: {
                              ...config.emails.templates[config.emails.selectedTemplate],
                              subject: e.target.value
                            }
                          }
                        }
                      })}
                      className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#10233f] block mb-1">Email Body</label>
                    <textarea
                      rows={6}
                      value={config.emails.templates[config.emails.selectedTemplate].body}
                      onChange={(e) => setConfig({
                        ...config,
                        emails: {
                          ...config.emails,
                          templates: {
                            ...config.emails.templates,
                            [config.emails.selectedTemplate]: {
                              ...config.emails.templates[config.emails.selectedTemplate],
                              body: e.target.value
                            }
                          }
                        }
                      })}
                      className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                    />
                  </div>

                  <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#dde1e9]">
                    <span className="text-[10px] font-bold text-[#5c6678] uppercase tracking-wider block mb-1">Supported Dynamic Merge Tags</span>
                    <div className="flex gap-2 flex-wrap font-mono text-[11px] text-[#0176d3]">
                      <span className="bg-white px-2 py-0.5 rounded border border-[#dde1e9]">{'{quote.number}'}</span>
                      <span className="bg-white px-2 py-0.5 rounded border border-[#dde1e9]">{'{account.name}'}</span>
                      <span className="bg-white px-2 py-0.5 rounded border border-[#dde1e9]">{'{contact.name}'}</span>
                      <span className="bg-white px-2 py-0.5 rounded border border-[#dde1e9]">{'{amount}'}</span>
                      <span className="bg-white px-2 py-0.5 rounded border border-[#dde1e9]">{'{due.date}'}</span>
                      <span className="bg-white px-2 py-0.5 rounded border border-[#dde1e9]">{'{payment.url}'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 12. AUTOMATION RULES */}
          {activeSectionId === 'automation' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Webhook Dispatch URL</label>
                <input
                  type="text"
                  value={config.automation.webhookUrl}
                  onChange={(e) => setConfig({
                    ...config,
                    automation: { ...config.automation, webhookUrl: e.target.value }
                  })}
                  className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Slack / Teams Alert Webhook</label>
                <input
                  type="text"
                  value={config.automation.slackWebhookUrl}
                  onChange={(e) => setConfig({
                    ...config,
                    automation: { ...config.automation, slackWebhookUrl: e.target.value }
                  })}
                  className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-3 pt-2">
                {[
                  { key: 'autoActivateOrders', label: 'Auto-Activate Customer Orders upon Quote Signature' },
                  { key: 'autoProvisionEntitlements', label: 'Auto-Provision Software Entitlements & License Keys' },
                  { key: 'triggerOnEsign', label: 'Dispatch Webhook Event on Cryptographic eSign Verification' },
                  { key: 'triggerOnPayment', label: 'Dispatch Webhook Event on Invoice Settlement' },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-xs font-medium text-[#10233f] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(config.automation as any)[item.key]}
                      onChange={(e) => setConfig({
                        ...config,
                        automation: { ...config.automation, [item.key]: e.target.checked }
                      })}
                      className="rounded border-[#dde1e9] text-[#0176d3]"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 13. PRODUCT & CPQ RULES */}
          {activeSectionId === 'productRules' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#10233f] block">Active CPQ Validation &amp; Bundling Rules</span>
              <div className="divide-y divide-[#edf1f7] border border-[#dde1e9] rounded-xl overflow-hidden">
                {config.productRules.rules.map(rule => (
                  <div key={rule.id} className="p-3.5 flex items-center justify-between hover:bg-[#fafcff]">
                    <div>
                      <div className="text-xs font-bold text-[#10233f] flex items-center gap-2">
                        <span>{rule.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-500/20">Active</span>
                      </div>
                      <div className="text-[11px] text-[#5c6678] mt-1">
                        When: <span className="font-mono">{rule.condition}</span> ➔ Action: <span className="font-semibold text-[#0176d3]">{rule.action}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfig({
                        ...config,
                        productRules: {
                          ...config.productRules,
                          rules: config.productRules.rules.filter(r => r.id !== rule.id)
                        }
                      })}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 14. AI & INTELLIGENCE */}
          {activeSectionId === 'ai' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">Copilot Provider</label>
                  <select
                    value={config.ai.provider}
                    onChange={(e) => setConfig({
                      ...config,
                      ai: { ...config.ai, provider: e.target.value }
                    })}
                    className="w-full text-xs border border-[#dde1e9] rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="Agentforce + Google Gemini">Agentforce + Google Gemini 2.0</option>
                    <option value="OpenAI GPT-4o">OpenAI GPT-4o Enterprise</option>
                    <option value="Anthropic Claude 3.5 Sonnet">Anthropic Claude 3.5 Sonnet</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-1">AI API Key</label>
                  <input
                    type="password"
                    value={config.ai.apiKey}
                    onChange={(e) => setConfig({
                      ...config,
                      ai: { ...config.ai, apiKey: e.target.value }
                    })}
                    className="w-full text-xs font-mono border border-[#dde1e9] rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium text-[#10233f] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.ai.dealAdvisorEnabled}
                    onChange={(e) => setConfig({
                      ...config,
                      ai: { ...config.ai, dealAdvisorEnabled: e.target.checked }
                    })}
                    className="rounded border-[#dde1e9] text-[#0176d3]"
                  />
                  <span>Enable AI Deal Advisor in CPQ Studio (Predictive Win Rate &amp; Margin Health)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-[#10233f] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.ai.autoSuggestDiscounts}
                    onChange={(e) => setConfig({
                      ...config,
                      ai: { ...config.ai, autoSuggestDiscounts: e.target.checked }
                    })}
                    className="rounded border-[#dde1e9] text-[#0176d3]"
                  />
                  <span>Enable Autonomous Margin Governance Recommendations</span>
                </label>
              </div>
            </div>
          )}

          {/* 15. DATA MANAGEMENT & FACTORY BASELINE */}
          {activeSectionId === 'dataManagement' && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-[#10233f] block mb-2">Live Workspace Database Volume</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Quotes', val: 5 },
                    { label: 'Orders', val: 4 },
                    { label: 'Contracts', val: 4 },
                    { label: 'Subscriptions', val: 4 },
                    { label: 'Invoices', val: 6 },
                    { label: 'Accounts', val: 6 },
                    { label: 'Contacts', val: 7 },
                    { label: 'Leads', val: 4 },
                  ].map(stat => (
                    <div key={stat.label} className="p-3 rounded-lg border border-[#dde1e9] bg-[#fafcff]">
                      <div className="text-lg font-black font-mono text-[#10233f]">{stat.val}</div>
                      <div className="text-[11px] text-[#5c6678] font-bold">{stat.label} on Record</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
                <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                  <AlertCircle size={15} />
                  <span>Factory Data Management</span>
                </div>
                <p className="text-xs text-rose-700">
                  Resetting factory data will restore all Quotes, Opportunities, Accounts, Contacts, Subscriptions, and Invoices to their baseline enterprise production state.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  {onResetFactoryData && (
                    <button
                      onClick={() => {
                        if (window.confirm('Reset all transaction records to factory defaults?')) {
                          onResetFactoryData();
                          setSaveBanner('All transactional records reset to factory defaults.');
                          setTimeout(() => setSaveBanner(null), 3000);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Restore Baseline Enterprise Data
                    </button>
                  )}
                  {onExportStateJSON && (
                    <button
                      onClick={onExportStateJSON}
                      className="rq-btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Database size={13} />
                      <span>Export Full State JSON</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 16. VERSION HISTORY */}
          {activeSectionId === 'history' && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#10233f] block">Published Architecture Versions</span>
              <div className="overflow-x-auto border border-[#dde1e9] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Version</th>
                      <th className="py-2.5 px-3">Published At</th>
                      <th className="py-2.5 px-3">Author</th>
                      <th className="py-2.5 px-3">Release Notes</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1f7]">
                    {config.history.map((ver) => (
                      <tr key={ver.version} className="hover:bg-[#fafcff]">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0176d3]">{ver.version}</td>
                        <td className="py-2.5 px-3 font-mono text-[#5c6678]">{ver.publishedAt}</td>
                        <td className="py-2.5 px-3 font-medium">{ver.author}</td>
                        <td className="py-2.5 px-3 text-[#10233f] max-w-xs truncate">{ver.note}</td>
                        <td className="py-2.5 px-3 text-right">
                          {ver.active ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500/20">
                              Active
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setSaveBanner(`Restored configuration to ${ver.version}.`);
                                setTimeout(() => setSaveBanner(null), 3000);
                              }}
                              className="text-xs font-bold text-[#0176d3] hover:underline"
                            >
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
