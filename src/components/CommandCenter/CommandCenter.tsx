import React, { useState } from 'react';
import { Currency, Quote, Invoice, Order } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { 
  Sparkles, 
  ArrowUpRight, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  FileSignature, 
  Package, 
  ChevronRight, 
  TrendingUp, 
  ShieldCheck, 
  Activity, 
  Layers, 
  Target,
  DollarSign,
  BarChart3,
  Calendar,
  Zap,
  ArrowRight,
  Send,
  RefreshCw,
  FileCheck2,
  Sliders
} from 'lucide-react';

interface CommandCenterProps {
  currency: Currency;
  quotes: Quote[];
  invoices: Invoice[];
  orders: Order[];
  onNavigate: (tab: string) => void;
  onOpenSignModal: (quote: Quote) => void;
  onOpenCompetitorMatrix?: () => void;
  onRunDemoFlow?: () => void;
}

interface MonthlyDataPoint {
  month: string;
  mrrUSD: number;
  newDeals: number;
  growthPct: number;
}

const MONTHLY_REVENUE_TRAJECTORY: MonthlyDataPoint[] = [
  { month: 'Jan', mrrUSD: 168000, newDeals: 6, growthPct: 2.8 },
  { month: 'Feb', mrrUSD: 174000, newDeals: 8, growthPct: 3.5 },
  { month: 'Mar', mrrUSD: 182000, newDeals: 9, growthPct: 4.6 },
  { month: 'Apr', mrrUSD: 189000, newDeals: 11, growthPct: 3.8 },
  { month: 'May', mrrUSD: 198000, newDeals: 12, growthPct: 4.7 },
  { month: 'Jun', mrrUSD: 206000, newDeals: 14, growthPct: 4.0 },
  { month: 'Jul', mrrUSD: 215000, newDeals: 15, growthPct: 4.4 },
  { month: 'Aug', mrrUSD: 222000, newDeals: 16, growthPct: 3.3 },
  { month: 'Sep', mrrUSD: 229000, newDeals: 18, growthPct: 3.2 },
  { month: 'Oct', mrrUSD: 236666, newDeals: 21, growthPct: 3.8 },
];

export const CommandCenter: React.FC<CommandCenterProps> = ({
  currency,
  quotes,
  invoices,
  orders,
  onNavigate,
  onOpenSignModal,
  onOpenCompetitorMatrix,
  onRunDemoFlow,
}) => {
  const isReducedMotion = useReducedMotion();
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [chartView, setChartView] = useState<'mrr' | 'arr'>('mrr');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const currentARR = convertCurrency(2840000, 'USD', currency);
  const currentMRR = currentARR / 12;

  const overdueInvoices = invoices.filter((i) => i.status === 'Overdue' || i.status === 'Issued');
  const pendingQuotes = quotes.filter((q) => q.status !== 'Signed');

  const triggerAction = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // SVG Chart calculation parameters
  const chartHeight = 160;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 25;

  const minVal = 150000;
  const maxVal = 250000;

  const points = MONTHLY_REVENUE_TRAJECTORY.map((d, index) => {
    const x = paddingX + (index / (MONTHLY_REVENUE_TRAJECTORY.length - 1)) * (chartWidth - paddingX * 2);
    const val = chartView === 'mrr' ? d.mrrUSD : d.mrrUSD * 12;
    const effectiveMin = chartView === 'mrr' ? minVal : minVal * 12;
    const effectiveMax = chartView === 'mrr' ? maxVal : maxVal * 12;
    const normalizedY = (val - effectiveMin) / (effectiveMax - effectiveMin);
    const y = chartHeight - paddingY - normalizedY * (chartHeight - paddingY * 2);
    return { x, y, data: d };
  });

  const pathD = points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cpX = (prev.x + pt.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${pt.y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Executive Revenue Cockpit Hero Header */}
      <div className="rq-card p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-gradient-to-bl from-[var(--rq-acc,#0176d3)]/12 via-[var(--rq-acc2,#1ab9ff)]/8 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-gradient-to-tr from-purple-500/6 to-transparent rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--rq-acc,#0176d3)] bg-[var(--rq-acc,#0176d3)]/10 px-2.5 py-0.5 rounded-full border border-[var(--rq-acc,#0176d3)]/25 flex items-center gap-1.5 shadow-2xs">
                <span className={`w-1.5 h-1.5 rounded-full bg-[var(--rq-acc,#0176d3)] ${isReducedMotion ? '' : 'animate-pulse'}`} />
                Revenue Command Center
              </span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">Quote-to-Cash Cloud • 2026 Edition</span>
              {onOpenCompetitorMatrix && (
                <button
                  onClick={onOpenCompetitorMatrix}
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-500/25 transition-all shadow-2xs cursor-pointer active:scale-95"
                >
                  <Sparkles size={11} className="text-purple-600" />
                  <span>RevX vs Competitors</span>
                </button>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Executive Revenue Cockpit &amp; Pipeline
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Real-time telemetry across Enterprise CPQ, Native eSignatures, Indian GST e-Invoices, and ASC 606 ratable recognition.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('opportunities')}
              className="rq-btn-secondary text-xs cursor-pointer"
              title="View Sales Process & Opportunities Pipeline"
            >
              <Target size={13} className="text-[var(--rq-acc,#0176d3)]" />
              <span>Pipeline &amp; Deals</span>
            </button>
            {onRunDemoFlow && (
              <button
                onClick={onRunDemoFlow}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-500/25 transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Execute 7-Step Autonomous Q2C Pipeline"
              >
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isReducedMotion ? '' : 'rq-pulse-dot'}`} />
                <span>Automated Q2C Pipeline</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('quotes')}
              className="rq-btn-primary text-xs"
            >
              <Sparkles size={13} />
              <span>+ New Quick Quote</span>
            </button>
            <button
              onClick={() => onNavigate('setup')}
              className="rq-btn-secondary text-xs"
            >
              <span>Setup &amp; Cockpit →</span>
            </button>
          </div>
        </div>

        {/* Action Notification Banner */}
        {actionNotice && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>{actionNotice}</span>
            </div>
            <button 
              onClick={() => setActionNotice(null)}
              className="text-emerald-600 hover:text-emerald-900 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2. 4 Primary KPI Cards with SVG Sparklines & Tabular Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-slate-200/80">
          {/* ARR Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 hover:border-[var(--rq-acc,#0176d3)]/40 hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-2xs group-hover:scale-105 transition-transform">
                  <DollarSign size={15} />
                </div>
                <div>
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                    Annual Run Rate
                  </span>
                  <div className="text-[10px] text-slate-400 font-medium">Contracted ARR</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-2xs">
                <ArrowUpRight size={11} />
                +28.4% YoY
              </span>
            </div>
            
            <div className="flex items-baseline justify-between mt-2.5">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums group-hover:text-[var(--rq-acc,#0176d3)] transition-colors">
                {formatCurrency(currentARR, currency)}
              </div>
              {/* Mini Sparkline Curve */}
              <svg className="w-16 h-7 text-emerald-500" viewBox="0 0 64 24" fill="none">
                <path d="M 2 20 Q 18 18, 30 14 T 62 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
              <span className="font-medium text-slate-600">84 Enterprise Accounts</span>
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <TrendingUp size={12} />
                <span>Accelerating</span>
              </span>
            </div>
          </div>

          {/* MRR Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 hover:border-[var(--rq-acc,#0176d3)]/40 hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200/60 shadow-2xs group-hover:scale-105 transition-transform">
                  <Activity size={15} />
                </div>
                <div>
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                    Monthly Recurring
                  </span>
                  <div className="text-[10px] text-slate-400 font-medium">Subscriptions MRR</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-0.5 text-[10.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-500/20 shadow-2xs">
                <ArrowUpRight size={11} />
                +3.8% MoM
              </span>
            </div>
            
            <div className="flex items-baseline justify-between mt-2.5">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums group-hover:text-[var(--rq-acc,#0176d3)] transition-colors">
                {formatCurrency(currentMRR, currency)}
              </div>
              {/* Mini Sparkline Curve */}
              <svg className="w-16 h-7 text-blue-500" viewBox="0 0 64 24" fill="none">
                <path d="M 2 22 Q 20 18, 34 11 T 62 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
              <span className="font-medium text-slate-600">Automated Subscription Run</span>
              <span className="text-[var(--rq-acc,#0176d3)] font-bold">Ratable ASC 606</span>
            </div>
          </div>

          {/* NRR Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 hover:border-[var(--rq-acc,#0176d3)]/40 hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-500 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-200/60 shadow-2xs group-hover:scale-105 transition-transform">
                  <Target size={15} />
                </div>
                <div>
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                    Net Retention (NRR)
                  </span>
                  <div className="text-[10px] text-slate-400 font-medium">Expansion Rate</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-500/20 shadow-2xs">
                Top Decile
              </span>
            </div>
            
            <div className="flex items-baseline justify-between mt-2.5">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums group-hover:text-[var(--rq-acc,#0176d3)] transition-colors">
                124.8%
              </div>
              {/* Mini Sparkline Curve */}
              <svg className="w-16 h-7 text-violet-500" viewBox="0 0 64 24" fill="none">
                <path d="M 2 20 Q 22 17, 36 9 T 62 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
              <span className="font-medium text-slate-600">Usage Metering Add-ons</span>
              <span className="text-violet-600 font-bold">&gt;120% Benchmark</span>
            </div>
          </div>

          {/* In-Flight Orders */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 hover:border-[var(--rq-acc,#0176d3)]/40 hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-emerald-500 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-2xs group-hover:scale-105 transition-transform">
                  <Package size={15} />
                </div>
                <div>
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                    Active Orders
                  </span>
                  <div className="text-[10px] text-slate-400 font-medium">Provisioning Queue</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-500/20 shadow-2xs">
                {orders.length} Ready
              </span>
            </div>
            
            <div className="flex items-baseline justify-between mt-2.5">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums group-hover:text-[var(--rq-acc,#0176d3)] transition-colors">
                {orders.length} Orders
              </div>
              {/* Stepped Provisioning Curve */}
              <svg className="w-16 h-7 text-amber-500" viewBox="0 0 64 24" fill="none">
                <path d="M 2 22 L 20 22 L 20 14 L 40 14 L 40 6 L 62 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>

            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
              <span className="font-medium text-slate-600">Auto Provisioned from eSign</span>
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 size={12} />
                100% Synced
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Interactive Monthly Revenue Growth Trajectory Chart & Stage Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Monthly Recurring Revenue Growth Trajectory Area Chart */}
        <div className="lg:col-span-2 rq-card p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-[var(--rq-acc,#0176d3)]" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Revenue Trajectory &amp; Growth Velocity
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                10-Month Compounding MRR from Q2C Contracts &amp; Automatic Up-sells
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setChartView('mrr')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    chartView === 'mrr'
                      ? 'bg-white text-[var(--rq-acc,#0176d3)] shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  MRR Trajectory
                </button>
                <button
                  onClick={() => setChartView('arr')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    chartView === 'arr'
                      ? 'bg-white text-[var(--rq-acc,#0176d3)] shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ARR Run Rate
                </button>
              </div>
            </div>
          </div>

          {/* SVG Interactive Telemetry Chart */}
          <div className="relative w-full">
            <svg 
              className="w-full h-44 overflow-visible" 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="revenue-chart-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--rq-acc, #0176d3)" stopOpacity="0.32" />
                  <stop offset="60%" stopColor="var(--rq-acc, #0176d3)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--rq-acc, #0176d3)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Guidelines */}
              <line x1={paddingX} y1={paddingY} x2={chartWidth - paddingX} y2={paddingY} stroke="rgba(226, 232, 240, 0.8)" strokeDasharray="3 3" />
              <line x1={paddingX} y1={(chartHeight - paddingY) / 2 + paddingY / 2} x2={chartWidth - paddingX} y2={(chartHeight - paddingY) / 2 + paddingY / 2} stroke="rgba(226, 232, 240, 0.8)" strokeDasharray="3 3" />
              <line x1={paddingX} y1={chartHeight - paddingY} x2={chartWidth - paddingX} y2={chartHeight - paddingY} stroke="rgba(203, 213, 225, 0.9)" />

              {/* Area Gradient Fill */}
              <path d={areaD} fill="url(#revenue-chart-gradient)" />

              {/* Smooth Trajectory Line */}
              <path 
                d={pathD} 
                fill="none" 
                stroke="var(--rq-acc, #0176d3)" 
                strokeWidth="2.8" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* Interactive Data Points */}
              {points.map((pt, idx) => {
                const isHovered = hoveredMonthIndex === idx;
                return (
                  <g key={pt.data.month} className="cursor-pointer">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : 4}
                      fill="#ffffff"
                      stroke="var(--rq-acc, #0176d3)"
                      strokeWidth={isHovered ? 3 : 2}
                      className="transition-all duration-150"
                      onMouseEnter={() => setHoveredMonthIndex(idx)}
                      onMouseLeave={() => setHoveredMonthIndex(null)}
                    />
                    {/* Month Label below baseline */}
                    <text
                      x={pt.x}
                      y={chartHeight - 6}
                      textAnchor="middle"
                      className={`text-[10px] font-semibold select-none ${
                        isHovered ? 'fill-[var(--rq-acc,#0176d3)] font-bold' : 'fill-slate-400'
                      }`}
                    >
                      {pt.data.month}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Active Data Point Tooltip Pill */}
            {hoveredMonthIndex !== null && (
              <div 
                className="absolute top-1 -translate-x-1/2 p-2 rounded-xl bg-slate-900 text-white text-[11px] shadow-xl pointer-events-none z-20 flex flex-col gap-0.5 border border-slate-700 animate-in fade-in duration-150"
                style={{
                  left: `${(points[hoveredMonthIndex].x / chartWidth) * 100}%`,
                }}
              >
                <div className="font-bold flex items-center justify-between gap-3 text-slate-300">
                  <span>{MONTHLY_REVENUE_TRAJECTORY[hoveredMonthIndex].month} 2026</span>
                  <span className="text-emerald-400">+{MONTHLY_REVENUE_TRAJECTORY[hoveredMonthIndex].growthPct}%</span>
                </div>
                <div className="font-extrabold text-sm text-white tabular-nums">
                  {formatCurrency(
                    convertCurrency(
                      chartView === 'mrr'
                        ? MONTHLY_REVENUE_TRAJECTORY[hoveredMonthIndex].mrrUSD
                        : MONTHLY_REVENUE_TRAJECTORY[hoveredMonthIndex].mrrUSD * 12,
                      'USD',
                      currency
                    ),
                    currency
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  {MONTHLY_REVENUE_TRAJECTORY[hoveredMonthIndex].newDeals} Enterprise Deal Closures
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Q2C Stage Velocity Funnel */}
        <div className="rq-card p-5 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-[var(--rq-acc,#0176d3)]" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Q2C Pipeline Velocity
              </h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-500/25">
              91.4% Conversion
            </span>
          </div>

          <div className="space-y-3.5">
            {/* Stage 1 */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-slate-700">1. CRM Deals Pipeline</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatCurrency(convertCurrency(840000, 'USD', currency), currency)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: '100%' }} />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">14 Qualified Enterprise Accounts</span>
            </div>

            {/* Stage 2 */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-slate-700">2. CPQ Quotes in Flight</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatCurrency(convertCurrency(482000, 'USD', currency), currency)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-500 transition-all duration-500" style={{ width: '74%' }} />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{quotes.length} Multi-tier Quotations</span>
            </div>

            {/* Stage 3 */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-slate-700">3. eSign &amp; Digital Seal</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatCurrency(convertCurrency(318000, 'USD', currency), currency)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-violet-500 transition-all duration-500" style={{ width: '62%' }} />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Cryptographic SHA-256 Audit</span>
            </div>

            {/* Stage 4 & 5 */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-slate-700">4. Orders &amp; ASC 606 RevRec</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {formatCurrency(convertCurrency(236666, 'USD', currency), currency)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: '51%' }} />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">100% Ratable Revenue Sync</span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('dealroom')}
            className="w-full mt-3 py-2 rounded-lg text-xs font-bold text-[var(--rq-acc,#0176d3)] bg-[var(--rq-acc,#0176d3)]/10 hover:bg-[var(--rq-acc,#0176d3)]/20 border border-[var(--rq-acc,#0176d3)]/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Deal Room &amp; Velocity Matrix</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* 4. Autonomous AI Daily Revenue Briefing & Action Center */}
      <div className="rq-card p-5 relative overflow-hidden border border-slate-200/90 hover:border-purple-300/80 transition-all duration-300">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-gradient-to-bl from-purple-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-base shadow-md shadow-purple-500/20 shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Agentforce Autonomous AI Revenue Copilot
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-300/60 shadow-2xs">
                  <span className={`w-1.5 h-1.5 rounded-full bg-purple-600 ${isReducedMotion ? '' : 'animate-ping'}`} />
                  Agentforce Proactive Live
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Proactive intelligence: expiring quotes, overdue receivables, upcoming renewals, and audit flags.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('war-room')}
            className="rq-btn-secondary text-xs shrink-0 self-start sm:self-auto group cursor-pointer"
          >
            <span>War Room Console</span>
            <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 relative z-10">
          {/* Overdue Receivables */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-rose-50/70 to-white border border-rose-200/80 hover:border-rose-300 hover:shadow-md transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Overdue Bills</span>
                <AlertTriangle size={15} className="text-rose-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-rose-700 mt-1">
                {formatCurrency(overdueInvoices.reduce((a, b) => a + b.amount, 0), currency)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block font-medium">
                {overdueInvoices.length} open bills pending collection
              </span>
            </div>
            <button
              onClick={() => triggerAction('Automated WhatsApp & Email payment reminders dispatched via Razorpay gateway.')}
              className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-100/70 hover:bg-rose-200/70 border border-rose-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Send size={11} />
              <span>Dispatch Auto-Reminder</span>
            </button>
          </div>

          {/* Expiring Quotes */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-amber-50/70 to-white border border-amber-200/80 hover:border-amber-300 hover:shadow-md transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Expiring Quotes (&lt;7d)</span>
                <Clock size={15} className="text-amber-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-amber-800 mt-1">
                {pendingQuotes.length} Deals
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block font-medium">
                Requires sales rep follow-up
              </span>
            </div>
            <button
              onClick={() => triggerAction('Validity extended +15 days with automated executive price assurance discount.')}
              className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-bold text-amber-800 bg-amber-100/70 hover:bg-amber-200/70 border border-amber-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <RefreshCw size={11} />
              <span>Auto-Extend Expiry (+15d)</span>
            </button>
          </div>

          {/* Renewals Due */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-blue-50/70 to-white border border-blue-200/80 hover:border-blue-300 hover:shadow-md transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Renewals Due (&lt;30d)</span>
                <Activity size={15} className="text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-blue-700 mt-1">
                {formatCurrency(convertCurrency(84000, 'USD', currency), currency)}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block font-medium">
                Auto-renewal notices dispatched
              </span>
            </div>
            <button
              onClick={() => onNavigate('contracts')}
              className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-bold text-blue-700 bg-blue-100/70 hover:bg-blue-200/70 border border-blue-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <FileCheck2 size={11} />
              <span>Review Contracts &amp; Subs</span>
            </button>
          </div>

          {/* Audit Assurance */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-purple-50/70 to-white border border-purple-200/80 hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Audit Exceptions</span>
                <ShieldCheck size={15} className="text-purple-600 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-purple-700 mt-1">
                0 Flagged
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block flex items-center gap-1">
                <CheckCircle2 size={12} />
                100% SHA-256 Tamper-Proof
              </span>
            </div>
            <button
              onClick={() => triggerAction('Cryptographic Merkle tree digest verified. Zero audit discrepancies found.')}
              className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-bold text-purple-700 bg-purple-100/70 hover:bg-purple-200/70 border border-purple-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <ShieldCheck size={11} />
              <span>Verify Cryptographic Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. In-Flight Quotations with Custom Hover Rows & Actions */}
      <div className="rq-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between bg-gradient-to-r from-slate-50/80 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[var(--rq-acc,#0176d3)] flex items-center justify-center border border-blue-200/60 shadow-2xs">
              <Layers size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                In-Flight Quotations &amp; Fast E-Sign
              </h2>
              <p className="text-[11px] text-slate-500">Live transaction pipeline awaiting buyer approval or signature</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('quotes')}
            className="text-xs font-semibold text-[var(--rq-acc,#0176d3)] hover:brightness-90 flex items-center gap-1 transition-colors group cursor-pointer"
          >
            <span>View All ({quotes.length})</span>
            <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Quote Number</th>
                <th className="py-3.5 px-4">Account Name</th>
                <th className="py-3.5 px-4">Authorized Signer</th>
                <th className="py-3.5 px-4">Total Contract Value</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.slice(0, 4).map((q) => {
                const isSigned = q.status === 'Signed';
                return (
                  <tr key={q.id} className="hover:bg-blue-50/40 transition-colors duration-150 group">
                    <td className="py-3.5 px-4 font-mono font-bold text-[var(--rq-acc,#0176d3)] group-hover:underline">
                      {q.quoteNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {q.accountName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium text-slate-800">{q.contactName}</div>
                      <div className="text-[10px] text-slate-400">{q.contactEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 tabular-nums">
                      {formatCurrency(q.totalAmount, q.currency)}
                    </td>
                    <td className="py-3.5 px-4">
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-500/25 shadow-2xs">
                          <CheckCircle2 size={11} />
                          <span>Signed &amp; Sealed</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-500/25 shadow-2xs">
                          <Clock size={11} />
                          <span>Pending Execution</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onOpenSignModal(q)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          isSigned
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90 shadow-2xs'
                            : 'rq-btn-primary'
                        }`}
                      >
                        <FileSignature size={12} />
                        <span>{isSigned ? 'View Certificate' : 'Sign Now'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
