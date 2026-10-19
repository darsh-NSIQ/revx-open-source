import React, { useState } from 'react';
import { Currency, Quote, Invoice } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  INITIAL_COHORTS, 
  INITIAL_ARR_WATERFALL, 
  INITIAL_DSO_BUCKETS, 
  INITIAL_SALES_REPS 
} from '../../data/mockData';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ShieldCheck, 
  CheckCircle, 
  FileSignature, 
  Sparkles,
  ChevronRight,
  Layers,
  ArrowRight,
  Users,
  PieChart,
  Calendar,
  AlertCircle,
  Clock,
  Target,
  Award,
  DollarSign,
  ArrowDownRight
} from 'lucide-react';

interface WarRoomProps {
  currency: Currency;
  quotes: Quote[];
  invoices: Invoice[];
  onNavigate: (tab: string) => void;
  onOpenSignModal: (quote: Quote) => void;
}

type DashboardSubTab = 'waterfall' | 'cohorts' | 'dso' | 'reps';

export const WarRoom: React.FC<WarRoomProps> = ({ 
  currency, 
  quotes, 
  invoices, 
  onNavigate,
  onOpenSignModal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<DashboardSubTab>('waterfall');

  const baseARR_USD = 3703000;
  const currentARR = convertCurrency(baseARR_USD, 'USD', currency);

  const inFlightQuotes = quotes.filter((q) => q.status !== 'Signed');
  const pipelineUSD = inFlightQuotes.reduce((acc, q) => acc + convertCurrency(q.totalAmount, q.currency, 'USD'), 0);
  const pipelineConverted = convertCurrency(pipelineUSD, 'USD', currency);

  const kpis = [
    {
      id: 'arr',
      title: 'ARR Compounding Velocity',
      badge: 'Live ARR',
      value: formatCurrency(currentARR, currency),
      delta: '▲ +29.8%',
      deltaNote: 'YoY Growth',
      detail: 'Compounding across 104 enterprise accounts',
      theme: {
        accent: '#0176d3',
        borderTop: 'border-t-[3px] border-t-[#0176d3]',
        iconBg: 'bg-blue-50 text-[#0176d3] border-blue-200/60',
        badgeBg: 'bg-[#eef4ff] text-[#015ba5] border-[#0176d3]/20',
        sparkColor: '#0176d3',
        sparkLine: 'M 3 24 Q 22 22 42 18 T 72 10 T 93 4',
        sparkArea: 'M 3 24 Q 22 22 42 18 T 72 10 T 93 4 L 93 30 L 3 30 Z',
      },
      icon: TrendingUp,
    },
    {
      id: 'nrr',
      title: 'Net Revenue Retention (NRR)',
      badge: 'Target > 120%',
      value: '128.4%',
      delta: '▲ +5.2%',
      deltaNote: 'vs Q2 benchmark',
      detail: 'Driven by Usage Metering & Add-on adoption',
      theme: {
        accent: '#2e844a',
        borderTop: 'border-t-[3px] border-t-emerald-600',
        iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-500/20',
        sparkColor: '#2e844a',
        sparkLine: 'M 3 22 Q 24 19 46 14 T 70 12 T 93 5',
        sparkArea: 'M 3 22 Q 24 19 46 14 T 70 12 T 93 5 L 93 30 L 3 30 Z',
      },
      icon: ArrowUpRight,
    },
    {
      id: 'margin',
      title: 'Blended Gross Margin',
      badge: 'Threshold > 75%',
      value: '78.6%',
      delta: '▲ +3.6%',
      deltaNote: 'Disciplined Pricing',
      detail: 'Enforced via CPQ Discount Governance Tiers',
      theme: {
        accent: '#6366f1',
        borderTop: 'border-t-[3px] border-t-indigo-600',
        iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
        badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-500/20',
        sparkColor: '#6366f1',
        sparkLine: 'M 3 16 Q 25 13 48 18 T 72 11 T 93 8',
        sparkArea: 'M 3 16 Q 25 13 48 18 T 72 11 T 93 8 L 93 30 L 3 30 Z',
      },
      icon: ShieldCheck,
    },
    {
      id: 'pipeline',
      title: 'Active Deal Pipeline',
      badge: `${inFlightQuotes.length} Deals In Flight`,
      value: formatCurrency(pipelineConverted, currency),
      delta: 'Avg 12d',
      deltaNote: 'Velocity to Close',
      detail: 'Salesforce synchronized & quote sealed',
      theme: {
        accent: '#d97706',
        borderTop: 'border-t-[3px] border-t-amber-500',
        iconBg: 'bg-amber-50 text-amber-700 border-amber-200/60',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-500/20',
        sparkColor: '#d97706',
        sparkLine: 'M 3 20 Q 24 25 48 15 T 72 19 T 93 7',
        sparkArea: 'M 3 20 Q 24 25 48 15 T 72 19 T 93 7 L 93 30 L 3 30 Z',
      },
      icon: Layers,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner with Quick Actions */}
      <div className="rq-card p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                Executive War Room &amp; Revenue Operations
              </span>
              <span className="text-xs text-[#5c6678] font-medium">Boardroom Level Real-Time Telemetry</span>
            </div>
            <h1 className="text-xl font-extrabold text-[#10233f] tracking-tight">
              Enterprise Revenue Performance, Retention &amp; Pipeline Engine
            </h1>
            <p className="text-xs text-[#5c6678] mt-0.5">
              Unified real-time views across Compounding ARR Waterfalls, Cohort NRR Matrices, DSO Cash Flow &amp; Rep Leaderboards.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('quotes')}
              className="rq-btn-primary"
            >
              <Sparkles size={13} />
              <span>Launch CPQ Studio</span>
            </button>
            <button
              onClick={() => onNavigate('esign')}
              className="rq-btn-secondary"
            >
              <FileSignature size={13} />
              <span>eSign Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid with Enterprise Micro-Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi) => {
          const IconComp = kpi.icon;
          return (
            <div
              key={kpi.id}
              className={`rq-card ${kpi.theme.borderTop} p-4.5 group hover:shadow-md transition-all duration-200 bg-gradient-to-b from-slate-50/20 via-white to-white flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${kpi.theme.iconBg} group-hover:scale-105 transition-transform`}>
                      <IconComp size={14} />
                    </div>
                    <span className="font-bold text-[11px] text-[#5c6678] uppercase tracking-wider truncate">
                      {kpi.title}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${kpi.theme.badgeBg}`}>
                    {kpi.badge}
                  </span>
                </div>

                <div className="mt-2 text-2xl lg:text-[26px] font-extrabold font-mono text-[#10233f] tracking-tight group-hover:text-[#015ba5] transition-colors">
                  {kpi.value}
                </div>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-[#edf1f7] flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                      {kpi.delta}
                    </span>
                    <span className="text-[10.5px] text-[#5c6678] font-medium truncate">
                      {kpi.deltaNote}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[#747e90] mt-1 truncate">
                    {kpi.detail}
                  </p>
                </div>

                <svg className="rq-spark shrink-0" viewBox="0 0 96 32" aria-hidden="true">
                  <defs>
                    <linearGradient id={`grad-${kpi.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={kpi.theme.sparkColor} stopOpacity="0.22" />
                      <stop offset="100%" stopColor={kpi.theme.sparkColor} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={kpi.theme.sparkArea}
                    fill={`url(#grad-${kpi.id})`}
                    className="rq-spark-area"
                  />
                  <path
                    d={kpi.theme.sparkLine}
                    stroke={kpi.theme.sparkColor}
                    className="rq-spark-line"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* Advanced Dashboard Sub-Tabs Switcher */}
      <div className="flex items-center border-b border-[#dde1e9] bg-white rounded-t-xl px-4 pt-2 gap-2 shadow-2xs">
        <button
          onClick={() => setActiveSubTab('waterfall')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'waterfall'
              ? 'border-[#0176d3] text-[#0176d3] bg-[#eef4ff]/50 rounded-t-md'
              : 'border-transparent text-[#5c6678] hover:text-[#10233f] hover:bg-slate-50'
          }`}
        >
          <TrendingUp size={14} />
          <span>ARR Growth Waterfall</span>
          <span className="text-[10px] font-mono bg-blue-100/70 text-[#015ba5] px-1.5 py-0.2 rounded font-semibold">
            Monthly
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('cohorts')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'cohorts'
              ? 'border-[#0176d3] text-[#0176d3] bg-[#eef4ff]/50 rounded-t-md'
              : 'border-transparent text-[#5c6678] hover:text-[#10233f] hover:bg-slate-50'
          }`}
        >
          <PieChart size={14} />
          <span>NRR Cohort Retention Heatmap</span>
          <span className="text-[10px] font-mono bg-emerald-100/70 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
            128% Avg
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('dso')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'dso'
              ? 'border-[#0176d3] text-[#0176d3] bg-[#eef4ff]/50 rounded-t-md'
              : 'border-transparent text-[#5c6678] hover:text-[#10233f] hover:bg-slate-50'
          }`}
        >
          <Clock size={14} />
          <span>DSO &amp; Receivables Aging</span>
          <span className="text-[10px] font-mono bg-amber-100/70 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
            Collections
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('reps')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'reps'
              ? 'border-[#0176d3] text-[#0176d3] bg-[#eef4ff]/50 rounded-t-md'
              : 'border-transparent text-[#5c6678] hover:text-[#10233f] hover:bg-slate-50'
          }`}
        >
          <Award size={14} />
          <span>Sales Rep Attainment &amp; Margin</span>
          <span className="text-[10px] font-mono bg-purple-100/70 text-purple-800 px-1.5 py-0.2 rounded font-semibold">
            Quota Matrix
          </span>
        </button>
      </div>

      {/* Sub-Tab 1: Growth Waterfall & Velocity */}
      {activeSubTab === 'waterfall' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 rq-card p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-[#edf1f7] pb-3 gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#10233f]">Compounding ARR Waterfall &amp; Velocity</h2>
                <p className="text-[11px] text-[#5c6678]">Trailing 6-month ARR momentum breakdown: New + Expansion vs Contraction + Churn</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-[10.5px]">
                <span className="flex items-center gap-1 font-semibold text-[#015ba5]">
                  <span className="w-2.5 h-2.5 rounded bg-[#0176d3]" /> New ARR
                </span>
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Expansion
                </span>
                <span className="flex items-center gap-1 font-semibold text-rose-600">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500" /> Churn
                </span>
              </div>
            </div>

            {/* Waterfall Visual Bars */}
            <div className="h-60 w-full flex items-end justify-between gap-3 pt-6 pb-2 px-1">
              {INITIAL_ARR_WATERFALL.map((d, i) => {
                const maxARR = 4000000;
                const heightPct = (d.closingARR / maxARR) * 100;
                const convertedClosing = convertCurrency(d.closingARR, 'USD', currency);
                const convertedNew = convertCurrency(d.newARR, 'USD', currency);
                const convertedExp = convertCurrency(d.expansionARR, 'USD', currency);

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono text-[#10233f] bg-white px-2 py-0.5 rounded shadow-sm border border-[#dde1e9] whitespace-nowrap">
                      {formatCurrency(convertedClosing, currency)}
                    </div>
                    <div className="w-full max-w-[54px] bg-[#f0f3f8] rounded-t-lg h-48 flex flex-col justify-end p-1 relative overflow-hidden border border-[#dde1e9] group-hover:border-[#0176d3]/60 group-hover:bg-[#eef4ff] transition-all duration-200">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-gradient-to-t from-[#015ba5] via-[#0176d3] to-[#1ab9ff] rounded-md transition-all duration-500 relative shadow-sm"
                      >
                        <div className="absolute top-0 inset-x-0 h-1 bg-white/40" />
                      </div>
                    </div>
                    <span className="text-[10.5px] font-bold text-[#5c6678] group-hover:text-[#015ba5] transition-colors truncate max-w-[65px] text-center">
                      {d.month.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Monthly Breakdown Table */}
            <div className="mt-4 border-t border-[#edf1f7] pt-3 overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3 text-right">Opening ARR</th>
                    <th className="py-2.5 px-3 text-right text-emerald-700">New ARR</th>
                    <th className="py-2.5 px-3 text-right text-[#015ba5]">Expansion</th>
                    <th className="py-2.5 px-3 text-right text-rose-600">Churn / Contraction</th>
                    <th className="py-2.5 px-3 text-right font-extrabold text-[#10233f]">Closing ARR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f7] font-mono text-[11px]">
                  {INITIAL_ARR_WATERFALL.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#f8fafc]">
                      <td className="py-2 px-3 font-sans font-bold text-[#10233f]">{row.month}</td>
                      <td className="py-2 px-3 text-right text-[#5c6678]">
                        {formatCurrency(convertCurrency(row.openingARR, 'USD', currency), currency)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-emerald-700">
                        +{formatCurrency(convertCurrency(row.newARR, 'USD', currency), currency)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-[#015ba5]">
                        +{formatCurrency(convertCurrency(row.expansionARR, 'USD', currency), currency)}
                      </td>
                      <td className="py-2 px-3 text-right text-rose-600">
                        -{formatCurrency(convertCurrency(row.churnARR + row.contractionARR, 'USD', currency), currency)}
                      </td>
                      <td className="py-2 px-3 text-right font-extrabold text-[#10233f]">
                        {formatCurrency(convertCurrency(row.closingARR, 'USD', currency), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deal & Signing Stream Panel */}
          <div className="rq-card p-4 sm:p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-[#edf1f7] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#10233f]">Deal &amp; Signing Stream</h2>
                <p className="text-[11px] text-[#5c6678]">Cryptographic audit trail events</p>
              </div>
              <span className="text-[10px] font-bold bg-[#eef4ff] text-[#015ba5] px-2 py-0.5 rounded-full border border-[#0176d3]/20">
                Active Stream
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[380px] pr-1">
              {quotes.map((quote) => {
                const isSigned = quote.status === 'Signed';
                return (
                  <div
                    key={quote.id}
                    className="p-3.5 rounded-xl bg-[#fbfcfe] border border-[#dde1e9] hover:border-[#0176d3]/40 hover:bg-[#fafbff] transition-all text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-[#10233f] truncate max-w-[150px]">{quote.accountName}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSigned
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/25'
                            : 'bg-amber-50 text-amber-800 border border-amber-500/25'
                        }`}
                      >
                        {quote.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#5c6678]">
                      <span className="font-mono">{quote.quoteNumber}</span>
                      <span className="font-mono font-extrabold text-[#10233f]">
                        {formatCurrency(quote.totalAmount, quote.currency)}
                      </span>
                    </div>

                    {isSigned && quote.signatureDigest && (
                      <div className="mt-2 pt-2 border-t border-[#edf1f7] flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#5c6678] font-mono">
                          <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[110px]">{quote.signatureDigest.substring(0, 14)}...</span>
                        </div>
                        <button
                          onClick={() => onOpenSignModal(quote)}
                          className="text-[10.5px] text-[#0176d3] hover:text-[#014486] font-bold"
                        >
                          View Certificate →
                        </button>
                      </div>
                    )}

                    {!isSigned && (
                      <div className="mt-2 pt-2 border-t border-[#edf1f7] flex items-center justify-between">
                        <span className="text-[10px] text-[#5c6678] truncate max-w-[120px]">Signer: {quote.contactName}</span>
                        <button
                          onClick={() => onOpenSignModal(quote)}
                          className="text-[10.5px] text-[#0176d3] hover:text-[#014486] font-bold flex items-center gap-0.5"
                        >
                          <span>Sign Now</span>
                          <ChevronRight size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => onNavigate('esign')}
              className="w-full mt-3.5 py-2 text-center text-xs font-bold text-[#0176d3] hover:text-[#014486] bg-[#eef4ff] hover:bg-[#e4efff] rounded-lg border border-[#0176d3]/20 transition-all shadow-2xs"
            >
              Open Native eSign Console →
            </button>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: NRR Cohort Retention Heatmap */}
      {activeSubTab === 'cohorts' && (
        <div className="rq-card p-4 sm:p-5 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#edf1f7] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#10233f]">Net Revenue Retention (NRR) Cohort Heatmap</h2>
              <p className="text-xs text-[#5c6678] mt-0.5">
                Tracks compounding cohort expansion across 12-month lifecycle. Industry standard benchmark: &gt;120% is top-decile SaaS.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-500/20">
                Portfolio NRR: 128.4%
              </span>
              <span className="text-xs font-bold text-[#015ba5] bg-[#eef4ff] px-3 py-1 rounded-md border border-[#0176d3]/20">
                Gross Retention: 96.8%
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Cohort</th>
                  <th className="py-3 px-4 text-center">Accounts</th>
                  <th className="py-3 px-4 text-right">Starting ARR</th>
                  <th className="py-3 px-4 text-center">Month 3</th>
                  <th className="py-3 px-4 text-center">Month 6</th>
                  <th className="py-3 px-4 text-center">Month 9</th>
                  <th className="py-3 px-4 text-center">Month 12</th>
                  <th className="py-3 px-4">Primary Expansion Vector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f7]">
                {INITIAL_COHORTS.map((c, idx) => {
                  const getHeatBg = (val: number) => {
                    if (val >= 125) return 'bg-emerald-600 text-white font-extrabold';
                    if (val >= 115) return 'bg-emerald-100 text-emerald-900 font-bold';
                    if (val >= 100) return 'bg-emerald-50 text-emerald-800 font-semibold';
                    return 'bg-amber-50 text-amber-800 font-semibold';
                  };

                  return (
                    <tr key={idx} className="hover:bg-[#f8fafc]">
                      <td className="py-3.5 px-4 font-bold text-[#10233f] flex items-center gap-2">
                        <Calendar size={13} className="text-[#0176d3]" />
                        <span>{c.cohort}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-[#5c6678] font-bold">
                        {c.accountsCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#10233f]">
                        {formatCurrency(convertCurrency(c.startingARR, 'USD', currency), currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block w-14 py-1 rounded text-[11px] font-mono ${getHeatBg(c.m3)}`}>
                          {c.m3}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block w-14 py-1 rounded text-[11px] font-mono ${getHeatBg(c.m6)}`}>
                          {c.m6}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block w-14 py-1 rounded text-[11px] font-mono ${getHeatBg(c.m9)}`}>
                          {c.m9}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block w-14 py-1 rounded text-[11px] font-mono shadow-xs ${getHeatBg(c.m12)}`}>
                          {c.m12}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#5c6678] font-medium">
                        {c.expansionDriver}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-xl bg-[#eef4ff] border border-[#0176d3]/20 flex items-start gap-3">
            <Sparkles size={16} className="text-[#0176d3] shrink-0 mt-0.5" />
            <div className="text-xs text-[#10233f]">
              <span className="font-bold">Autonomous Expansion Strategy Note:</span> Accounts adopting Native Digital eSign Suite alongside CPQ show <span className="font-bold text-emerald-700">32% higher Month-12 NRR</span> than pure-license contracts due to zero third-party envelope friction.
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: DSO & Receivables Aging */}
      {activeSubTab === 'dso' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="rq-card p-4 border-l-4 border-l-emerald-500">
              <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider block">Average DSO</span>
              <div className="text-2xl font-extrabold text-[#10233f] font-mono mt-1">26.4 Days</div>
              <p className="text-[10.5px] text-emerald-700 mt-1 font-semibold">▲ 6 days faster than SaaS benchmark (32d)</p>
            </div>
            <div className="rq-card p-4 border-l-4 border-l-blue-500">
              <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider block">Total Outstanding AR</span>
              <div className="text-2xl font-extrabold text-[#10233f] font-mono mt-1">
                {formatCurrency(convertCurrency(203500, 'USD', currency), currency)}
              </div>
              <p className="text-[10.5px] text-[#5c6678] mt-1">Across 26 outstanding enterprise invoices</p>
            </div>
            <div className="rq-card p-4 border-l-4 border-l-amber-500">
              <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider block">At-Risk Collections (&gt;60 Days)</span>
              <div className="text-2xl font-extrabold text-amber-700 font-mono mt-1">
                {formatCurrency(convertCurrency(8900, 'USD', currency), currency)}
              </div>
              <p className="text-[10.5px] text-amber-700 mt-1 font-semibold">Under 4.4% of total receivables (Healthy)</p>
            </div>
          </div>

          <div className="rq-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4 border-b border-[#edf1f7] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#10233f]">Accounts Receivable Aging Buckets &amp; Default Risk</h2>
                <p className="text-xs text-[#5c6678]">Real-time stratification of receivables across payment maturity tiers</p>
              </div>
              <span className="text-xs font-bold text-[#0176d3] bg-[#eef4ff] px-2.5 py-1 rounded-full border border-[#0176d3]/20">
                Auto-Dunning Active
              </span>
            </div>

            <div className="space-y-4">
              {INITIAL_DSO_BUCKETS.map((b, idx) => {
                const totalAR = 203500;
                const pct = (b.amount / totalAR) * 100;
                const convertedAmount = convertCurrency(b.amount, 'USD', currency);

                const getRiskBadge = (r: typeof b.riskScore) => {
                  switch (r) {
                    case 'Low':
                      return 'bg-emerald-50 text-emerald-800 border-emerald-500/20';
                    case 'Medium':
                      return 'bg-blue-50 text-[#015ba5] border-[#0176d3]/20';
                    case 'High':
                      return 'bg-amber-50 text-amber-800 border-amber-500/20';
                    case 'Critical':
                      return 'bg-rose-50 text-rose-800 border-rose-500/20';
                  }
                };

                return (
                  <div key={idx} className="p-3.5 rounded-xl border border-[#dde1e9] bg-[#fbfcfe]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#10233f]">{b.bucket}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRiskBadge(b.riskScore)}`}>
                          Risk: {b.riskScore}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-extrabold text-[#10233f]">
                          {formatCurrency(convertedAmount, currency)}
                        </span>
                        <span className="text-[11px] text-[#5c6678] ml-2">({b.invoiceCount} invoices)</span>
                      </div>
                    </div>
                    <div className="w-full bg-[#edf1f7] h-2.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          b.riskScore === 'Low'
                            ? 'bg-emerald-500'
                            : b.riskScore === 'Medium'
                            ? 'bg-[#0176d3]'
                            : b.riskScore === 'High'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Sales Rep Attainment & Margin Discipline */}
      {activeSubTab === 'reps' && (
        <div className="rq-card p-4 sm:p-5 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#edf1f7] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#10233f]">Sales Rep Quota Attainment &amp; Margin Discipline</h2>
              <p className="text-xs text-[#5c6678] mt-0.5">
                Evaluates revenue production alongside margin preservation and discount governance compliance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-500/20">
                Team Attainment: 116.7%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INITIAL_SALES_REPS.map((rep) => {
              const convertedQuota = convertCurrency(rep.quotaARR, 'USD', currency);
              const convertedAttained = convertCurrency(rep.attainedARR, 'USD', currency);

              return (
                <div
                  key={rep.id}
                  className="p-4 rounded-xl border border-[#dde1e9] bg-[#fbfcfe] hover:border-[#0176d3]/40 hover:bg-[#fafbff] transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={rep.avatar}
                        alt={rep.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#dde1e9] shadow-2xs"
                      />
                      <div>
                        <h3 className="font-bold text-xs text-[#10233f]">{rep.name}</h3>
                        <p className="text-[11px] text-[#5c6678]">{rep.role}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-500/20">
                      {rep.discountDiscipline}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#5c6678]">Quota Attainment</span>
                      <span className="font-mono font-extrabold text-[#10233f]">
                        {rep.attainmentPct.toFixed(1)}% ({formatCurrency(convertedAttained, currency)} / {formatCurrency(convertedQuota, currency)})
                      </span>
                    </div>
                    <div className="w-full bg-[#edf1f7] h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(rep.attainmentPct, 100)}%` }}
                        className="h-full bg-gradient-to-r from-[#0176d3] to-emerald-500 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#edf1f7] text-[11px]">
                    <div>
                      <span className="text-[#5c6678] block">Deals Closed:</span>
                      <span className="font-mono font-bold text-[#10233f]">{rep.dealsClosedCount} deals</span>
                    </div>
                    <div>
                      <span className="text-[#5c6678] block">Avg Win Margin:</span>
                      <span className="font-mono font-bold text-emerald-700">{rep.averageMarginPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
