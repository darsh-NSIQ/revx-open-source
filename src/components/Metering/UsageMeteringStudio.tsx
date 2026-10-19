import React, { useState } from 'react';
import { Currency, RawUsageEvent, UsageCommitmentPool, Invoice } from '../../types';
import { INITIAL_USAGE_EVENTS, INITIAL_COMMITMENT_POOLS } from '../../data/mockData';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { generateIRN } from '../../utils/crypto';
import { 
  Activity, 
  Zap, 
  Database, 
  Layers, 
  Clock, 
  Plus, 
  Receipt, 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Server
} from 'lucide-react';

interface UsageMeteringStudioProps {
  currency: Currency;
  onGenerateInvoice?: (invoice: Invoice) => void;
}

export const UsageMeteringStudio: React.FC<UsageMeteringStudioProps> = ({ 
  currency,
  onGenerateInvoice 
}) => {
  const [events, setEvents] = useState<RawUsageEvent[]>(INITIAL_USAGE_EVENTS);
  const [pools, setPools] = useState<UsageCommitmentPool[]>(INITIAL_COMMITMENT_POOLS);
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Aggregated totals
  const totalRawEvents = 1482000 + events.reduce((acc, e) => acc + e.units, 0);
  const totalPrepaidUSD = pools.reduce((acc, p) => acc + p.prepaidCreditsUSD, 0);
  const totalConsumedUSD = pools.reduce((acc, p) => acc + p.consumedCreditsUSD, 0);
  const totalRatedOverageUSD = events
    .filter((e) => e.ratingStatus === 'Rated')
    .reduce((acc, e) => acc + e.ratedAmountUSD, 0);

  // Ingest Simulated Event on the fly
  const handleSimulateEvent = (
    metricKey: 'api_calls' | 'compute_hours' | 'storage_gb' | 'ai_tokens',
    units: number,
    accountName: string,
    unitPriceUSD: number
  ) => {
    const ratedAmt = units * unitPriceUSD;
    const newEvt: RawUsageEvent = {
      id: `evt-${Date.now().toString().substring(7)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      accountId: 'acc-live',
      accountName,
      metricKey,
      units,
      ratingStatus: 'Rated',
      ratedAmountUSD: ratedAmt,
      aggregationType: metricKey === 'storage_gb' ? 'MAX' : 'SUM',
    };

    setEvents((prev) => [newEvt, ...prev]);

    // Update pool consumption
    setPools((prev) =>
      prev.map((p) => {
        if (p.accountName === accountName) {
          return {
            ...p,
            consumedCreditsUSD: Math.min(p.prepaidCreditsUSD * 1.2, p.consumedCreditsUSD + ratedAmt),
          };
        }
        return p;
      })
    );

    setBannerNotice(`Ingested & Rated: +${units.toLocaleString()} ${metricKey} for ${accountName} ($${ratedAmt.toFixed(2)} USD rated)`);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  // Convert unbilled events to an official rated usage invoice
  const handleBillRatedEvents = () => {
    if (!onGenerateInvoice) return;
    const invNum = `INV-METER-${Date.now().toString().substring(8)}`;
    const billAmountUSD = totalRatedOverageUSD > 0 ? totalRatedOverageUSD : 284;
    const convertedAmount = convertCurrency(billAmountUSD, 'USD', currency);

    const newInvoice: Invoice = {
      id: `inv-meter-${Date.now()}`,
      invoiceNumber: invNum,
      quoteNumber: 'Q-METER-DRAWDOWN',
      accountName: 'Stripe Technologies Inc.',
      invoiceType: 'B2B Tax Invoice',
      amount: convertedAmount,
      currency,
      status: 'Issued',
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      issueDate: new Date().toISOString().split('T')[0],
      irnNumber: generateIRN('27AABCR9999P1ZQ', invNum, '2026-27'),
      gstAmount: convertedAmount * (currency === 'INR' ? 0.18 : 0.08),
      placeOfSupply: '99-Other Countries / Export',
    };

    onGenerateInvoice(newInvoice);

    // Mark events as invoiced
    setEvents((prev) =>
      prev.map((e) => ({ ...e, ratingStatus: 'Invoiced' }))
    );

    setBannerNotice(`Generated Rated Consumption Invoice ${invNum} for ${formatCurrency(convertedAmount, currency)}!`);
    setTimeout(() => setBannerNotice(null), 5000);
  };

  const filteredEvents = selectedMetric === 'all' 
    ? events 
    : events.filter((e) => e.metricKey === selectedMetric);

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="rq-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                Zuora-Grade Metering &amp; Event Mediation Engine
              </span>
              <span className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-bold border border-purple-500/20">
                High-Volume Ingestion Stream
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-[#10233f] tracking-tight">
              Real-Time Event Mediation, Multi-Attribute Rating &amp; Prepaid Drawdown
            </h1>
            <p className="text-xs text-[#5c6678] mt-0.5">
              Normalizes raw usage events (API calls, storage, compute hours), evaluates tiered overage pricing, and burns down prepaid commitment pools.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBillRatedEvents}
              className="rq-btn-primary"
            >
              <Receipt size={13} />
              <span>Bill Rated Usage</span>
            </button>
          </div>
        </div>

        {bannerNotice && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>{bannerNotice}</span>
          </div>
        )}
      </div>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className="rq-card border-l-4 border-l-[#0176d3] p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Events Ingested</span>
            <Activity size={14} className="text-[#0176d3]" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#10233f] mt-1 group-hover:text-[#015ba5] transition-colors">
            {totalRawEvents.toLocaleString()}
          </div>
          <span className="text-[10.5px] text-[#5c6678] mt-1 block">100% Normalized (Zero Dropped)</span>
        </div>

        <div className="rq-card border-l-4 border-l-purple-600 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Active Prepaid Pools</span>
            <Database size={14} className="text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-purple-700 mt-1">
            {formatCurrency(convertCurrency(totalPrepaidUSD, 'USD', currency), currency)}
          </div>
          <span className="text-[10.5px] text-[#5c6678] mt-1 block">Prepaid drawdown commitments</span>
        </div>

        <div className="rq-card border-l-4 border-l-emerald-600 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Stream Rating Latency</span>
            <Zap size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-1 flex items-center gap-1.5">
            <span>&lt; 12 ms</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 rq-pulse-dot" />
          </div>
          <span className="text-[10.5px] text-[#5c6678] mt-1 block">Sub-second rating mediation</span>
        </div>

        <div className="rq-card border-l-4 border-l-amber-500 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Unbilled Overage</span>
            <TrendingUp size={14} className="text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-700 mt-1">
            {formatCurrency(convertCurrency(totalRatedOverageUSD, 'USD', currency), currency)}
          </div>
          <span className="text-[10.5px] text-[#5c6678] mt-1 block">Ready for billing cycle rollup</span>
        </div>
      </div>

      {/* Interactive Event Emission Sandbox */}
      <div className="rq-card p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-[#10233f] to-slate-900 text-white rounded-xl shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Play size={14} className="text-[#1ab9ff]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Interactive Event Emission &amp; Mediation Sandbox
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Simulate raw developer telemetry to watch instant normalization, prepaid credit burning, and tiered overage rating.
            </p>
          </div>
          <span className="text-[10px] font-mono bg-blue-500/20 text-[#1ab9ff] px-2 py-0.5 rounded border border-[#1ab9ff]/30">
            Simulator Engine Ready
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-4">
          <button
            onClick={() => handleSimulateEvent('api_calls', 10000, 'Stripe Technologies Inc.', 0.02)}
            className="p-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-[#0176d3] text-left transition-all group"
          >
            <span className="text-[10px] font-mono text-[#1ab9ff] block font-bold">+10,000 API Calls</span>
            <span className="text-xs font-semibold text-white group-hover:text-[#1ab9ff] transition-colors">
              Stripe Technologies
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Rate: $0.02 / unit</span>
          </button>

          <button
            onClick={() => handleSimulateEvent('storage_gb', 250, 'HyperScale Media UK', 0.10)}
            className="p-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 text-left transition-all group"
          >
            <span className="text-[10px] font-mono text-purple-400 block font-bold">+250 GB Storage</span>
            <span className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
              HyperScale Media
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Rate: $0.10 / GB</span>
          </button>

          <button
            onClick={() => handleSimulateEvent('compute_hours', 100, 'Tata Consultancy & Cloud Ltd', 0.15)}
            className="p-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 text-left transition-all group"
          >
            <span className="text-[10px] font-mono text-emerald-400 block font-bold">+100 Compute Hours</span>
            <span className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
              Tata Consultancy
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Rate: $0.15 / hr</span>
          </button>

          <button
            onClick={() => handleSimulateEvent('ai_tokens', 5000000, 'Stripe Technologies Inc.', 0.00002)}
            className="p-3 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-amber-400 text-left transition-all group"
          >
            <span className="text-[10px] font-mono text-amber-400 block font-bold">+5M AI Tokens</span>
            <span className="text-xs font-semibold text-white group-hover:text-amber-300 transition-colors">
              Stripe Technologies
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">Rate: $0.02 / 1k</span>
          </button>
        </div>
      </div>

      {/* Section 1: Prepaid Commitment Pools & Drawdown */}
      <div className="rq-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#edf1f7] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#10233f]">Prepaid Commitment &amp; Drawdown Pools</h2>
            <p className="text-xs text-[#5c6678]">Tracks contractually agreed prepaid credit balance against real-time consumption</p>
          </div>
          <span className="text-xs font-mono font-bold text-[#015ba5] bg-[#eef4ff] px-2.5 py-1 rounded border border-[#0176d3]/20">
            Automatic Balance Burn-Down
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {pools.map((p) => {
            const pct = Math.min((p.consumedCreditsUSD / p.prepaidCreditsUSD) * 100, 100);
            const remainingUSD = Math.max(0, p.prepaidCreditsUSD - p.consumedCreditsUSD);
            const isNearAlert = pct >= p.thresholdAlertPct;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border bg-[#fbfcfe] transition-all space-y-3 ${
                  isNearAlert ? 'border-amber-400 bg-amber-50/20' : 'border-[#dde1e9]'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-xs text-[#10233f]">{p.accountName}</h3>
                    <p className="text-[11px] text-[#5c6678] font-mono">{p.metricName}</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isNearAlert
                        ? 'bg-amber-50 text-amber-800 border-amber-500/20'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-500/20'
                    }`}
                  >
                    {isNearAlert ? 'Threshold Alert' : 'Healthy'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#5c6678]">Drawdown Progress</span>
                    <span className="font-mono font-bold text-[#10233f]">
                      {pct.toFixed(1)}% ({formatCurrency(convertCurrency(p.consumedCreditsUSD, 'USD', currency), currency)} / {formatCurrency(convertCurrency(p.prepaidCreditsUSD, 'USD', currency), currency)})
                    </span>
                  </div>
                  <div className="w-full bg-[#edf1f7] h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-[#0176d3]'
                      }`}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#edf1f7] flex justify-between text-[11px] text-[#5c6678]">
                  <span>Remaining Credit:</span>
                  <span className="font-mono font-extrabold text-[#10233f]">
                    {formatCurrency(convertCurrency(remainingUSD, 'USD', currency), currency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Ingested Usage Events Table */}
      <div className="rq-card overflow-hidden">
        <div className="p-4 border-b border-[#dde1e9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fbfcfe]">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-[#0176d3]" />
            <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
              Normalized Usage Event Stream ({filteredEvents.length} events)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#5c6678]">Filter Metric:</span>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="text-xs border border-[#dde1e9] rounded px-2 py-1 bg-white text-[#10233f]"
            >
              <option value="all">All Metrics</option>
              <option value="api_calls">API Calls</option>
              <option value="compute_hours">Compute Hours</option>
              <option value="storage_gb">Storage GB</option>
              <option value="ai_tokens">AI Tokens</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Metric</th>
                <th className="py-3 px-4 text-center">Aggregation</th>
                <th className="py-3 px-4 text-right">Units Ingested</th>
                <th className="py-3 px-4 text-right">Rated Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f7]">
              {filteredEvents.map((evt) => {
                const convertedRatedAmt = convertCurrency(evt.ratedAmountUSD, 'USD', currency);
                return (
                  <tr key={evt.id} className="hover:bg-[#f5f8fc] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#0176d3]">
                      {evt.id}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#5c6678] text-[11px]">
                      {evt.timestamp}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#181c25]">
                      {evt.accountName}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-blue-50 text-[#015ba5] border border-blue-200">
                        {evt.metricKey}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[#5c6678] text-[10.5px]">
                      {evt.aggregationType}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#10233f]">
                      {evt.units.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700">
                      {formatCurrency(convertedRatedAmt, currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          evt.ratingStatus === 'Rated'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-500/20'
                            : evt.ratingStatus === 'Invoiced'
                            ? 'bg-blue-50 text-[#015ba5] border-[#0176d3]/20'
                            : 'bg-amber-50 text-amber-800 border-amber-500/20'
                        }`}
                      >
                        {evt.ratingStatus}
                      </span>
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
