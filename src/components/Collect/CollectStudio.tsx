import React, { useState } from 'react';
import { Currency, DunningAttempt, Invoice } from '../../types';
import { INITIAL_DUNNING_ATTEMPTS } from '../../data/mockData';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  ShieldAlert, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  CreditCard, 
  TrendingUp, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Mail,
  UserX
} from 'lucide-react';

interface CollectStudioProps {
  currency: Currency;
  onPayInvoice?: (invoiceId: string, method: 'Razorpay' | 'Stripe') => void;
}

export const CollectStudio: React.FC<CollectStudioProps> = ({ 
  currency,
  onPayInvoice 
}) => {
  const [dunningList, setDunningList] = useState<DunningAttempt[]>(INITIAL_DUNNING_ATTEMPTS);
  const [isRetryingBatch, setIsRetryingBatch] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const totalInDunning = dunningList
    .filter((d) => d.recoveryStatus === 'In Dunning')
    .reduce((acc, d) => acc + convertCurrency(d.amount, d.currency, currency), 0);

  const totalRecovered = dunningList
    .filter((d) => d.recoveryStatus === 'Recovered')
    .reduce((acc, d) => acc + convertCurrency(d.amount, d.currency, currency), 0);

  // Run ML Smart Retry Batch
  const handleRunSmartRetryBatch = () => {
    setIsRetryingBatch(true);
    setBannerNotice('Executing ML Smart Retry: routing requests through optimal banking clearance windows...');

    setTimeout(() => {
      setDunningList((prev) =>
        prev.map((d) => {
          if (d.recoveryStatus === 'In Dunning' && d.id === 'dun-01') {
            return {
              ...d,
              recoveryStatus: 'Recovered',
              attemptCount: d.attemptCount + 1,
              smartRetryRecommendedTime: 'Recovered $14,200 GBP via Stripe auto-failover',
            };
          }
          return d;
        })
      );
      setIsRetryingBatch(false);
      setBannerNotice('🎉 Smart Retry Succeeded: Recovered £14,200 GBP for HyperScale Media UK with zero manual intervention!');
      setTimeout(() => setBannerNotice(null), 5000);
    }, 1200);
  };

  // Dispatch Dunning Notice Email
  const handleDispatchDunningEmail = (accountName: string, stage: string) => {
    setBannerNotice(`Dispatched formal ${stage} email notification with secure 1-click payment link to ${accountName}.`);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="rq-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                Zuora-Grade Collections &amp; Smart Dunning
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                ML Gateway Failover Active
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-[#10233f] tracking-tight">
              Automated Receivables Recovery, Dunning Cadence &amp; ML Retries
            </h1>
            <p className="text-xs text-[#5c6678] mt-0.5">
              Eliminates involuntary subscription churn by orchestrating intelligent card retry timing, multi-gateway failover (Stripe ↔ Razorpay), and automated customer communications.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunSmartRetryBatch}
              disabled={isRetryingBatch}
              className="rq-btn-primary"
            >
              <RotateCw size={13} className={isRetryingBatch ? 'animate-spin' : ''} />
              <span>{isRetryingBatch ? 'Retrying Gateways...' : 'Run ML Smart Retry Batch'}</span>
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
        <div className="rq-card border-l-4 border-l-amber-500 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">In Active Dunning</span>
            <ShieldAlert size={14} className="text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-700 mt-1">
            {formatCurrency(totalInDunning, currency)}
          </div>
          <span className="text-[10.5px] text-[#5c6678] mt-1 block">Across overdue customer invoices</span>
        </div>

        <div className="rq-card border-l-4 border-l-emerald-600 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">30-Day Recovery Rate</span>
            <TrendingUp size={14} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-1 flex items-center gap-1.5">
            <span>89.2%</span>
            <span className="text-xs text-emerald-600 font-bold font-sans">▲ vs 68% avg</span>
          </div>
          <span className="text-[10.5px] text-[#5c6678] mt-1 block">Involuntary churn prevented</span>
        </div>

        <div className="rq-card border-l-4 border-l-[#0176d3] p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Total Cash Recovered</span>
            <Zap size={14} className="text-[#0176d3]" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#015ba5] mt-1">
            {formatCurrency(totalRecovered, currency)}
          </div>
          <span className="text-[10.5px] text-[#5c6678] mt-1 block">Retrieved via automated retries</span>
        </div>

        <div className="rq-card border-l-4 border-l-purple-600 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Next ML Batch Window</span>
            <Clock size={14} className="text-purple-600" />
          </div>
          <div className="text-xl font-extrabold font-mono text-purple-700 mt-1.5">
            Tue 09:30 AM
          </div>
          <span className="text-[10.5px] text-[#5c6678] mt-1 block">Optimal bank clearing window</span>
        </div>
      </div>

      {/* Section 1: 3-Stage Dunning Strategy Lifecycle */}
      <div className="rq-card p-4 sm:p-5 space-y-4">
        <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider border-b border-[#edf1f7] pb-2">
          Configured Dunning Stages &amp; Escalation Strategy
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#015ba5]">Stage 01: Soft Reminder</span>
              <span className="text-[10px] font-mono bg-blue-100 text-[#015ba5] px-2 py-0.5 rounded font-bold">
                Day 3
              </span>
            </div>
            <p className="text-[11px] text-[#5c6678]">
              Automated friendly email dispatched with encrypted 1-click invoice review and payment card update link.
            </p>
            <div className="text-[10px] text-[#0176d3] font-medium pt-1">
              Gateway Policy: 1st background retry during customer local business hours.
            </div>
          </div>

          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/25 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900">Stage 02: Urgent Grace Period</span>
              <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                Day 7
              </span>
            </div>
            <p className="text-[11px] text-[#5c6678]">
              Urgent warning sent to Account Admin and Billing Contact. Gateway failover to secondary merchant route (Razorpay).
            </p>
            <div className="text-[10px] text-amber-800 font-medium pt-1">
              Gateway Policy: Automatic merchant routing switch.
            </div>
          </div>

          <div className="p-4 rounded-xl border border-rose-300 bg-rose-50/25 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-900">Stage 03: Service Suspension</span>
              <span className="text-[10px] font-mono bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-bold">
                Day 14
              </span>
            </div>
            <p className="text-[11px] text-[#5c6678]">
              API keys throttled to read-only mode. Notification routed to Assigned Account Executive and Legal Counsel.
            </p>
            <div className="text-[10px] text-rose-800 font-medium pt-1">
              Gateway Policy: Final attempt prior to bad-debt write-off.
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Active Dunning Invoices Table */}
      <div className="rq-card overflow-hidden">
        <div className="p-4 border-b border-[#dde1e9] flex items-center justify-between bg-[#fbfcfe]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-500" />
            <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
              Active Dunning Invoices &amp; Smart Retry Status
            </h2>
          </div>
          <span className="text-[11px] text-[#5c6678] font-semibold">
            {dunningList.length} Invoices Tracked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Account Name</th>
                <th className="py-3 px-4">Past Due Amount</th>
                <th className="py-3 px-4">Dunning Stage</th>
                <th className="py-3 px-4 text-center">Attempts</th>
                <th className="py-3 px-4">Failure Reason &amp; ML Optimization</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f7]">
              {dunningList.map((d) => {
                const convertedAmt = convertCurrency(d.amount, d.currency, currency);
                const isRecovered = d.recoveryStatus === 'Recovered';

                return (
                  <tr key={d.id} className="hover:bg-[#f5f8fc] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0176d3]">
                      {d.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#181c25]">
                      {d.accountName}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#10233f]">
                      {formatCurrency(convertedAmt, currency)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-medium text-[#10233f]">
                        {d.stage}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-[#5c6678]">
                      {d.attemptCount} / 3
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#5c6678] max-w-xs">
                      <div className="text-[11px] font-medium text-[#10233f]">{d.lastFailureReason}</div>
                      <div className="text-[10px] text-[#015ba5] font-mono mt-0.5">{d.smartRetryRecommendedTime}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isRecovered
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-500/20'
                            : 'bg-amber-50 text-amber-800 border-amber-500/20'
                        }`}
                      >
                        {d.recoveryStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {!isRecovered ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDispatchDunningEmail(d.accountName, d.stage)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-[#5c6678] transition-colors"
                            title="Dispatch Dunning Notice Email"
                          >
                            <Mail size={13} />
                          </button>
                          <button
                            onClick={handleRunSmartRetryBatch}
                            className="rq-btn-primary py-1 px-2.5 text-[11px]"
                          >
                            <RotateCw size={11} />
                            <span>Retry</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-bold font-mono">
                          ✓ Settled
                        </span>
                      )}
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
