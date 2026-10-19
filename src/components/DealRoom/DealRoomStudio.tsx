import React, { useState } from 'react';
import { Currency, DealRoom, MutualActionPlanItem } from '../../types';
import { INITIAL_DEALROOMS } from '../../data/mockData';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  Share2, 
  Eye, 
  Clock, 
  Activity, 
  CheckCircle2, 
  Calendar, 
  Sliders, 
  Sparkles, 
  FileCheck2, 
  Copy, 
  ExternalLink, 
  Check, 
  ShieldCheck, 
  UserCheck, 
  Send, 
  TrendingUp, 
  Zap, 
  Lock, 
  AlertCircle,
  Users,
  Compass,
  FileSignature
} from 'lucide-react';

interface DealRoomStudioProps {
  currency: Currency;
  onOpenSignModal?: (quoteNumber: string) => void;
}

export const DealRoomStudio: React.FC<DealRoomStudioProps> = ({ 
  currency,
  onOpenSignModal
}) => {
  const [dealRooms, setDealRooms] = useState<DealRoom[]>(INITIAL_DEALROOMS);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(dealRooms[0]?.id || '');
  const [viewMode, setViewMode] = useState<'buyer' | 'telemetry'>('buyer');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [hasAcceptedProposal, setHasAcceptedProposal] = useState<boolean>(false);

  const currentRoom = dealRooms.find((r) => r.id === selectedRoomId) || dealRooms[0];

  // Interactive Buyer Pricing Calculator State
  const [calcSeats, setCalcSeats] = useState<number>(currentRoom?.interactiveSeats || 120);
  const [calcTier, setCalcTier] = useState<'Enterprise' | 'Professional'>('Enterprise');
  const [multiYearCommit, setMultiYearCommit] = useState<boolean>(true);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(currentRoom?.interactiveAddOns || []);

  const SEAT_BASE_RATES: Record<string, number> = {
    'Enterprise': 399,
    'Professional': 249,
  };

  const ADDON_PRICING: Record<string, number> = {
    'Dedicated VPC': 1200,
    '24/7 Enterprise SLA': 850,
    'Native eSign Suite': 450,
    'Indian GST NIC IRN Engine': 350,
    'Event Ingestion Stream': 600,
    'Automated Razorpay Dunning': 300,
  };

  const baseSeatRate = convertCurrency(SEAT_BASE_RATES[calcTier], 'USD', currency);
  const rawSubtotal = calcSeats * baseSeatRate;
  const addonsSubtotal = selectedAddons.reduce((sum, name) => {
    const cost = convertCurrency(ADDON_PRICING[name] || 0, 'USD', currency);
    return sum + cost;
  }, 0);

  const discountRate = multiYearCommit ? 0.20 : 0.05;
  const calculatedARR = (rawSubtotal + addonsSubtotal * 12) * (1 - discountRate);

  const handleCopyLink = () => {
    if (currentRoom) {
      navigator.clipboard.writeText(currentRoom.roomUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const toggleAddon = (addon: string) => {
    if (selectedAddons.includes(addon)) {
      setSelectedAddons(selectedAddons.filter((a) => a !== addon));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handleToggleMapStatus = (itemId: string) => {
    if (!currentRoom) return;
    const updatedPlan = currentRoom.actionPlan.map((item) => {
      if (item.id === itemId) {
        const nextStatus: MutualActionPlanItem['status'] = 
          item.status === 'Completed' ? 'Pending' : 'Completed';
        return { ...item, status: nextStatus };
      }
      return item;
    });

    const updatedRooms = dealRooms.map((room) => 
      room.id === currentRoom.id ? { ...room, actionPlan: updatedPlan } : room
    );
    setDealRooms(updatedRooms);
  };

  const completedMapCount = currentRoom.actionPlan.filter((i) => i.status === 'Completed').length;
  const mapProgressPct = Math.round((completedMapCount / currentRoom.actionPlan.length) * 100);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & Header with Glassmorphism */}
      <div className="rq-card p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Share2 size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  DealHub™ Digital DealRoom &amp; Buyer Telemetry
                </h1>
                <span className="rq-badge rq-badge-purple">
                  DealHub Parity + Superset
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Eliminate static PDFs. Send interactive buyer microsites with dynamic pricing calculators, mutual action plans (MAP), and real-time engagement telemetry.
              </p>
            </div>
          </div>

          {/* Room Selector & Mode Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200/90 rounded-lg p-1">
              <button
                onClick={() => setViewMode('buyer')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'buyer'
                    ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Compass size={13} />
                <span>Buyer DealRoom View</span>
              </button>
              <button
                onClick={() => setViewMode('telemetry')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'telemetry'
                    ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity size={13} />
                <span>Sales Telemetry View</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 rq-pulse-dot" />
              </button>
            </div>

            {/* Switch Active DealRoom */}
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="rq-input text-xs font-bold cursor-pointer"
            >
              {dealRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.accountName} ({r.quoteNumber})
                </option>
              ))}
            </select>

            <button
              onClick={handleCopyLink}
              className="rq-btn-secondary text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copiedUrl ? <Check size={14} className="text-emerald-600 stroke-[2.5]" /> : <Copy size={14} />}
              <span>{copiedUrl ? 'Copied Link!' : 'Share DealRoom Link'}</span>
            </button>
          </div>
        </div>

        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-80 h-32 bg-radial from-purple-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Mode 1: Sales Rep Telemetry View */}
      {viewMode === 'telemetry' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Top Telemetry KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rq-card-elevated p-4 border-l-4 border-l-purple-500 rq-stagger-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Buyer Intent Score</span>
                <Activity size={16} className="text-purple-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-700 font-mono">
                  {currentRoom.telemetry.engagementScore}%
                </span>
                <span className="rq-badge rq-badge-purple">
                  Very High Intent
                </span>
              </div>
              <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-600 h-1.5 rounded-full" 
                  style={{ width: `${currentRoom.telemetry.engagementScore}%` }} 
                />
              </div>
            </div>

            <div className="rq-card-elevated p-4 border-l-4 border-l-emerald-500 rq-stagger-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Active Viewers Now</span>
                <Users size={16} className="text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {currentRoom.telemetry.activeViewers}
                </span>
                <span className="text-[10px] text-slate-500">
                  stakeholders in room
                </span>
              </div>
              <p className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 rq-pulse-dot" />
                Live socket connection active
              </p>
            </div>

            <div className="rq-card-elevated p-4 border-l-4 border-l-blue-500 rq-stagger-3">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Time In Room</span>
                <Clock size={16} className="text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {Math.round(currentRoom.telemetry.totalTimeSpentSeconds / 60)} min
                </span>
                <span className="text-[10px] text-slate-500">
                  ({currentRoom.telemetry.totalViews} total visits)
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Last viewed {currentRoom.telemetry.lastViewedAt}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-[#dde1e9] p-4 shadow-2xs">
              <div className="flex items-center justify-between text-[#5c6678]">
                <span className="text-[11px] font-bold uppercase tracking-wider">MAP Milestones</span>
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-emerald-700">
                  {completedMapCount} / {currentRoom.actionPlan.length}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {mapProgressPct}%
                </span>
              </div>
              <div className="mt-2 w-full bg-[#f1f5f9] rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full" 
                  style={{ width: `${mapProgressPct}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Telemetry Heatmap & Section Time Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#10233f] mb-3 flex items-center gap-2">
                <Eye size={15} className="text-purple-600" />
                <span>Buyer Section Engagement Heatmap</span>
              </h2>
              <div className="space-y-3">
                {currentRoom.telemetry.sectionsViewed.map((sec, idx) => {
                  const maxSeconds = Math.max(...currentRoom.telemetry.sectionsViewed.map((s) => s.timeSpentSeconds));
                  const pct = Math.round((sec.timeSpentSeconds / maxSeconds) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#181c25]">{sec.sectionName}</span>
                        <span className="text-[#5c6678] font-mono text-[11px]">
                          {Math.floor(sec.timeSpentSeconds / 60)}m {sec.timeSpentSeconds % 60}s · {sec.viewCount} views
                        </span>
                      </div>
                      <div className="w-full bg-[#f1f5f9] rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full" 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stakeholder Details */}
            <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#10233f] mb-3 flex items-center gap-2">
                <UserCheck size={15} className="text-blue-600" />
                <span>DealRoom Stakeholder Information</span>
              </h2>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#dde1e9] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-[#5c6678]">Primary Buyer Contact</div>
                    <div className="font-bold text-[#10233f] mt-0.5">{currentRoom.buyerContactName}</div>
                    <div className="text-[#5c6678] text-[11px]">{currentRoom.buyerContactEmail} · {currentRoom.buyerCompany}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                    Primary Decision Maker
                  </span>
                </div>

                <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#dde1e9] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-[#5c6678]">Assigned Sales Rep</div>
                    <div className="font-bold text-[#10233f] mt-0.5">{currentRoom.salesRepName}</div>
                    <div className="text-[#5c6678] text-[11px]">{currentRoom.salesRepEmail}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold">
                    Deal Owner
                  </span>
                </div>

                <div className="p-3 bg-gradient-to-r from-purple-50/60 to-white rounded-lg border border-purple-200/60">
                  <div className="text-[10px] uppercase font-bold text-purple-800">DealHub AI Engagement Recommendation</div>
                  <p className="text-[11px] text-purple-900 mt-1">
                    Buyer spent over 8 minutes on the <strong>Seat &amp; ARR Calculator</strong> and checked off InfoSec compliance. Recommended Next Step: Dispatch SHA-256 eSign envelope immediately to close this month.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Buyer DealRoom Interactive Experience */}
      {viewMode === 'buyer' && (
        <div className="space-y-6">
          {/* Buyer Header Banner */}
          <div className="bg-gradient-to-r from-[#1e1b4b] via-[#312e81] to-[#4338ca] text-white rounded-2xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
            <div className="relative z-10 max-w-3xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/25">
                  Interactive Digital Sales Room
                </span>
                <span className="text-xs text-purple-200">
                  Quote Ref: {currentRoom.quoteNumber}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Monetization Architecture &amp; Commercial Proposal for {currentRoom.accountName}
              </h2>
              <p className="text-sm text-purple-100 leading-relaxed">
                {currentRoom.customWelcomeMessage}
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs text-purple-200">
                <span>Prepared by: <strong className="text-white">{currentRoom.salesRepName}</strong></span>
                <span>•</span>
                <span>Valid through: <strong className="text-white">Q4 FY2026</strong></span>
              </div>
            </div>
          </div>

          {/* Interactive Pricing Calculator (DealHub Signature Feature) */}
          <div className="bg-white rounded-2xl border border-[#dde1e9] p-5 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#dde1e9] mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                    Interactive Dynamic Pricing &amp; Scale Calculator
                  </h3>
                  <p className="text-xs text-[#5c6678]">
                    Adjust user seats and infrastructure add-ons live to preview real-time ARR commitments.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                Interactive Buyer Mode
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls Column */}
              <div className="lg:col-span-2 space-y-5">
                {/* Seat Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-[#10233f] mb-2">
                    <span>Provisioned User Seats:</span>
                    <span className="text-base text-purple-700 font-extrabold font-mono">{calcSeats} Seats</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={500}
                    step={10}
                    value={calcSeats}
                    onChange={(e) => setCalcSeats(Number(e.target.value))}
                    className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-[#5c6678] mt-1 font-mono">
                    <span>20 Seats</span>
                    <span>100 Seats</span>
                    <span>250 Seats</span>
                    <span>500 Seats</span>
                  </div>
                </div>

                {/* Tier Selection */}
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-2">
                    Core Platform Edition:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCalcTier('Enterprise')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        calcTier === 'Enterprise'
                          ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600'
                          : 'border-[#dde1e9] hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs text-[#10233f]">Enterprise Tier</div>
                      <div className="text-[11px] text-[#5c6678] mt-0.5">{formatCurrency(convertCurrency(399, 'USD', currency), currency)} / seat / mo</div>
                      <div className="text-[10px] text-purple-700 font-semibold mt-1">Includes CPQ, RevPro &amp; Metering</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCalcTier('Professional')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        calcTier === 'Professional'
                          ? 'border-purple-600 bg-purple-50/50 ring-1 ring-purple-600'
                          : 'border-[#dde1e9] hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs text-[#10233f]">Professional Tier</div>
                      <div className="text-[11px] text-[#5c6678] mt-0.5">{formatCurrency(convertCurrency(249, 'USD', currency), currency)} / seat / mo</div>
                      <div className="text-[10px] text-[#5c6678] font-semibold mt-1">Core Billing &amp; Invoices</div>
                    </button>
                  </div>
                </div>

                {/* Add-ons Toggles */}
                <div>
                  <label className="text-xs font-bold text-[#10233f] block mb-2">
                    Infrastructure &amp; Compliance Add-Ons:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.keys(ADDON_PRICING).map((addon) => {
                      const isSelected = selectedAddons.includes(addon);
                      const price = convertCurrency(ADDON_PRICING[addon], 'USD', currency);
                      return (
                        <div
                          key={addon}
                          onClick={() => toggleAddon(addon)}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50/40 text-purple-900 font-semibold'
                              : 'border-[#dde1e9] text-[#5c6678] hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                              isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span>{addon}</span>
                          </div>
                          <span className="font-mono text-[11px] font-bold">
                            +{formatCurrency(price, currency)}/mo
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3-Year Commitment Discount */}
                <div 
                  onClick={() => setMultiYearCommit(!multiYearCommit)}
                  className="p-3 bg-emerald-50/60 border border-emerald-500/30 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      multiYearCommit ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {multiYearCommit && <Check size={13} strokeWidth={3} />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">
                        Lock 3-Year Multi-Year Ramp Commitment
                      </div>
                      <div className="text-[11px] text-emerald-800">
                        Applies an automatic 20% platform discount and guarantees zero price increases.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Save 20%
                  </span>
                </div>
              </div>

              {/* Real-Time Price Summary Card */}
              <div className="bg-gradient-to-b from-[#faf5ff] to-white rounded-xl border border-purple-200 p-5 flex flex-col justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                    Live Dynamic Proposal Summary
                  </span>
                  <div className="mt-2">
                    <span className="text-3xl font-extrabold text-[#10233f]">
                      {formatCurrency(calculatedARR, currency)}
                    </span>
                    <span className="text-xs text-[#5c6678] font-semibold"> / year</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-purple-100 space-y-2 text-xs">
                    <div className="flex justify-between text-[#5c6678]">
                      <span>Seats ({calcSeats} × {formatCurrency(baseSeatRate, currency)}):</span>
                      <span className="font-mono font-bold text-[#181c25]">{formatCurrency(rawSubtotal, currency)}/mo</span>
                    </div>
                    <div className="flex justify-between text-[#5c6678]">
                      <span>Add-ons Subtotal:</span>
                      <span className="font-mono font-bold text-[#181c25]">{formatCurrency(addonsSubtotal, currency)}/mo</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Multi-Year Ramp Savings:</span>
                      <span>-{Math.round(discountRate * 100)}%</span>
                    </div>
                  </div>

                  <div className="mt-5 p-3 rounded-lg bg-purple-100/60 text-[11px] text-purple-900 flex items-start gap-2">
                    <Sparkles size={14} className="shrink-0 text-purple-700 mt-0.5" />
                    <span>
                      Includes free SHA-256 eSign certificates, audit trails, and 0% take-rate fee.
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-purple-100">
                  {hasAcceptedProposal ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-500/40 rounded-xl text-center space-y-1">
                      <div className="text-xs font-extrabold text-emerald-800 flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={16} />
                        <span>Proposal Accepted &amp; Verified!</span>
                      </div>
                      <p className="text-[10px] text-emerald-700">
                        Sales team notified. Final execution agreement dispatched to {currentRoom.buyerContactEmail}.
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setHasAcceptedProposal(true);
                        if (onOpenSignModal) onOpenSignModal(currentRoom.quoteNumber);
                      }}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs shadow-md hover:from-purple-700 hover:to-indigo-700 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileSignature size={16} />
                      <span>Accept Terms &amp; Proceed to eSign →</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mutual Action Plan (MAP) Section */}
          <div className="bg-white rounded-2xl border border-[#dde1e9] p-5 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#dde1e9] mb-5">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-[#10233f] flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <span>Joint Mutual Action Plan (MAP)</span>
                </h3>
                <p className="text-xs text-[#5c6678]">
                  Collaborative milestones between {currentRoom.salesRepName} (RevX) and {currentRoom.buyerContactName} ({currentRoom.buyerCompany}) to ensure rapid go-live.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#10233f]">
                  Progress: {completedMapCount} of {currentRoom.actionPlan.length} Milestones ({mapProgressPct}%)
                </span>
                <div className="w-36 bg-[#f1f5f9] rounded-full h-2 mt-1 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${mapProgressPct}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="divide-y divide-[#edf1f7]">
              {currentRoom.actionPlan.map((item) => {
                const isDone = item.status === 'Completed';
                return (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-[#fafcff] px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleMapStatus(item.id)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer ${
                          isDone 
                            ? 'bg-emerald-600 border-emerald-600 text-white' 
                            : 'border-slate-300 bg-white hover:border-emerald-500'
                        }`}
                      >
                        {isDone && <Check size={12} strokeWidth={3} />}
                      </button>
                      <div>
                        <div className={`text-xs font-bold ${isDone ? 'line-through text-[#94a3b8]' : 'text-[#10233f]'}`}>
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[#5c6678] flex items-center gap-2 mt-0.5">
                          <span>Owner: <strong className="text-[#181c25]">{item.owner}</strong></span>
                          <span>•</span>
                          <span>Category: {item.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-[#5c6678]">
                        Target: {item.dueDate}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDone 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : item.status === 'In Progress'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-[#5c6678]'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
