import React, { useState } from 'react';
import { Currency, ApprovalRequest, ApprovalChainStep, Quote } from '../../types';
import { INITIAL_APPROVAL_REQUESTS } from '../../data/mockData';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  FileCheck2, 
  UserCheck, 
  Sparkles, 
  Sliders, 
  Check, 
  TrendingUp, 
  DollarSign, 
  Layers, 
  Percent,
  Search,
  Filter,
  Send,
  Building2,
  FileText
} from 'lucide-react';

interface ApprovalMatrixStudioProps {
  currency: Currency;
  quotes?: Quote[];
}

export const ApprovalMatrixStudio: React.FC<ApprovalMatrixStudioProps> = ({ 
  currency,
  quotes = []
}) => {
  const [requests, setRequests] = useState<ApprovalRequest[]>(INITIAL_APPROVAL_REQUESTS);
  const [selectedRequestId, setSelectedRequestId] = useState<string>(requests[0]?.id || '');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [managerComment, setManagerComment] = useState<string>('');
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const selectedRequest = requests.find((r) => r.id === selectedRequestId) || requests[0];

  const handleApproveStep = (requestId: string, level: number) => {
    const updated = requests.map((req) => {
      if (req.id !== requestId) return req;

      const updatedChain = req.approvalChain.map((step) => {
        if (step.level === level) {
          return {
            ...step,
            status: 'Approved' as const,
            actionDate: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
            comments: managerComment || 'Approved in accordance with margin guidelines.',
          };
        }
        return step;
      });

      // Check if all non-skipped steps are approved
      const remainingPending = updatedChain.filter(
        (s) => s.status === 'Pending'
      );
      const isFullyApproved = remainingPending.length === 0;

      return {
        ...req,
        approvalChain: updatedChain,
        overallStatus: isFullyApproved ? ('Approved' as const) : ('Pending Review' as const),
      };
    });

    setRequests(updated);
    setManagerComment('');
    setActionSuccessNotice(`Level ${level} Approval granted successfully.`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  const handleRejectStep = (requestId: string, level: number) => {
    const updated = requests.map((req) => {
      if (req.id !== requestId) return req;

      const updatedChain = req.approvalChain.map((step) => {
        if (step.level === level) {
          return {
            ...step,
            status: 'Rejected' as const,
            actionDate: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
            comments: managerComment || 'Rejected. Discount exceeds margin floor; request revision.',
          };
        }
        return step;
      });

      return {
        ...req,
        approvalChain: updatedChain,
        overallStatus: 'Rejected' as const,
      };
    });

    setRequests(updated);
    setManagerComment('');
    setActionSuccessNotice(`Level ${level} Approval request rejected.`);
    setTimeout(() => setActionSuccessNotice(null), 3000);
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return r.overallStatus === 'Pending Review';
    if (filterStatus === 'approved') return r.overallStatus === 'Approved';
    if (filterStatus === 'rejected') return r.overallStatus === 'Rejected';
    return true;
  });

  const pendingCount = requests.filter((r) => r.overallStatus === 'Pending Review').length;
  const approvedCount = requests.filter((r) => r.overallStatus === 'Approved').length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] text-white flex items-center justify-center shadow-xs shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-[#10233f]">
                  Oracle CPQ™ Enterprise Multi-Tier Approval Matrix &amp; Margin Governance
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-500/25">
                  Oracle CPQ Cloud Parity + Superset
                </span>
              </div>
              <p className="text-xs text-[#5c6678] mt-0.5">
                Automate multi-tier approval chains based on discount thresholds, gross margin floors, deal TCV, and payment term exceptions.
              </p>
            </div>
          </div>

          {/* Quick KPIs */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-900 text-xs font-bold flex items-center gap-2">
              <Clock size={14} className="text-amber-600" />
              <span>{pendingCount} Pending Reviews</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>{approvedCount} Approved Deals</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {actionSuccessNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-500/30 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{actionSuccessNotice}</span>
        </div>
      )}

      {/* Main Grid: Requests List & Selected Approval Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Requests Queue */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white rounded-xl border border-[#dde1e9] p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#10233f]">
                Approval Queue ({filteredRequests.length})
              </span>
              <div className="flex items-center gap-1 bg-[#f8fafc] border border-[#dde1e9] rounded-lg p-0.5 text-[11px]">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-2 py-1 rounded font-semibold transition-all ${
                    filterStatus === 'all' ? 'bg-white shadow-2xs text-[#0176d3]' : 'text-[#5c6678]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus('pending')}
                  className={`px-2 py-1 rounded font-semibold transition-all ${
                    filterStatus === 'pending' ? 'bg-white shadow-2xs text-amber-600' : 'text-[#5c6678]'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setFilterStatus('approved')}
                  className={`px-2 py-1 rounded font-semibold transition-all ${
                    filterStatus === 'approved' ? 'bg-white shadow-2xs text-emerald-600' : 'text-[#5c6678]'
                  }`}
                >
                  Approved
                </button>
              </div>
            </div>

            {/* List */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredRequests.map((req) => {
                const isSelected = req.id === selectedRequestId;
                const convAmount = convertCurrency(req.dealAmount, req.currency, currency);
                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#0284c7] bg-[#f0f9ff]/70 ring-1 ring-[#0284c7]/40 shadow-xs'
                        : 'border-[#dde1e9] bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#10233f] truncate max-w-[200px]">
                        {req.accountName}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        req.overallStatus === 'Approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/25'
                          : req.overallStatus === 'Rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-500/25'
                          : 'bg-amber-50 text-amber-700 border border-amber-500/25'
                      }`}>
                        {req.overallStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#5c6678] mt-2">
                      <span>Ref: <strong className="text-[#181c25]">{req.quoteNumber}</strong></span>
                      <span className="font-mono font-bold text-[#10233f]">
                        {formatCurrency(convAmount, currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px]">
                      <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-bold">
                        {req.discountPct}% Discount
                      </span>
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold">
                        {req.marginPct}% Gross Margin
                      </span>
                      <span className="text-[#747e90] ml-auto">
                        Req by {req.requestedBy.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Oracle CPQ Governance Threshold Policy Reference */}
          <div className="bg-white rounded-xl border border-[#dde1e9] p-4 shadow-2xs text-xs space-y-2.5">
            <h3 className="font-bold text-[#10233f] flex items-center gap-1.5">
              <Sliders size={14} className="text-[#0284c7]" />
              <span>Configured Discount Matrix Policy</span>
            </h3>
            <div className="divide-y divide-slate-100 text-[11px]">
              <div className="py-1.5 flex justify-between">
                <span className="text-[#5c6678]">0% - 15% Discount:</span>
                <span className="font-bold text-emerald-700">Level 0 (Rep Discretion)</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-[#5c6678]">15.1% - 25% Discount:</span>
                <span className="font-bold text-blue-700">Level 1 (Sales Director)</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-[#5c6678]">25.1% - 40% Discount:</span>
                <span className="font-bold text-amber-700">Level 2 (VP Finance)</span>
              </div>
              <div className="py-1.5 flex justify-between">
                <span className="text-[#5c6678]">&gt; 40% or Terms &gt; Net 60:</span>
                <span className="font-bold text-purple-700">Level 3 (CFO / CEO)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Quote Approval Chain & Review Drawer */}
        <div className="lg:col-span-7 space-y-4">
          {selectedRequest ? (
            <div className="bg-white rounded-xl border border-[#dde1e9] p-5 sm:p-6 shadow-2xs space-y-6">
              {/* Request Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#dde1e9] gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#5c6678]">
                      Quote: {selectedRequest.quoteNumber}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedRequest.overallStatus === 'Approved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/25'
                        : selectedRequest.overallStatus === 'Rejected'
                        ? 'bg-rose-50 text-rose-700 border border-rose-500/25'
                        : 'bg-amber-50 text-amber-700 border border-amber-500/25'
                    }`}>
                      {selectedRequest.overallStatus}
                    </span>
                  </div>
                  <h2 className="text-lg font-extrabold text-[#10233f] mt-1">
                    {selectedRequest.accountName}
                  </h2>
                  <p className="text-xs text-[#5c6678]">
                    Requested by <strong>{selectedRequest.requestedBy}</strong> on {selectedRequest.requestDate}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xl font-extrabold text-[#10233f]">
                    {formatCurrency(convertCurrency(selectedRequest.dealAmount, selectedRequest.currency, currency), currency)}
                  </div>
                  <div className="text-xs font-bold text-rose-600 mt-0.5">
                    {selectedRequest.discountPct}% Proposed Discount
                  </div>
                </div>
              </div>

              {/* Profitability Health Check & COGS Guardrails */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-gradient-to-r from-blue-50/50 via-slate-50 to-white rounded-xl border border-blue-200/50 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#5c6678] uppercase">Gross Margin</span>
                  <div className="text-lg font-extrabold text-emerald-700 mt-0.5">
                    {selectedRequest.marginPct}%
                  </div>
                  <span className="text-[10px] text-emerald-700">Healthy (&gt;65% Floor)</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#5c6678] uppercase">Floor Margin</span>
                  <div className="text-lg font-extrabold text-[#10233f] mt-0.5">
                    65.0%
                  </div>
                  <span className="text-[10px] text-[#5c6678]">Executive Guardrail</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#5c6678] uppercase">Target Margin</span>
                  <div className="text-lg font-extrabold text-blue-700 mt-0.5">
                    80.0%
                  </div>
                  <span className="text-[10px] text-blue-700">Corporate Target</span>
                </div>
              </div>

              {/* Business Justification */}
              <div>
                <h4 className="text-xs font-bold text-[#10233f] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText size={14} className="text-[#0284c7]" />
                  <span>Sales Rep Business Justification</span>
                </h4>
                <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#dde1e9] text-xs text-[#181c25] leading-relaxed italic">
                  "{selectedRequest.businessJustification}"
                </div>
              </div>

              {/* Visual Approval Chain (Oracle CPQ Signature Feature) */}
              <div>
                <h4 className="text-xs font-bold text-[#10233f] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Layers size={14} className="text-[#0284c7]" />
                  <span>Sequential Multi-Tier Approval Chain</span>
                </h4>

                <div className="space-y-3">
                  {selectedRequest.approvalChain.map((step) => {
                    const isApproved = step.status === 'Approved';
                    const isRejected = step.status === 'Rejected';
                    const isPending = step.status === 'Pending';
                    const isSkipped = step.status === 'Skipped';

                    return (
                      <div
                        key={step.level}
                        className={`p-4 rounded-xl border transition-all ${
                          isApproved
                            ? 'bg-emerald-50/40 border-emerald-300/80'
                            : isRejected
                            ? 'bg-rose-50/40 border-rose-300/80'
                            : isPending
                            ? 'bg-amber-50/40 border-amber-300/80 ring-1 ring-amber-400/40'
                            : 'bg-slate-50 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              isApproved
                                ? 'bg-emerald-600 text-white'
                                : isRejected
                                ? 'bg-rose-600 text-white'
                                : isPending
                                ? 'bg-amber-500 text-white animate-pulse'
                                : 'bg-slate-300 text-slate-700'
                            }`}>
                              {isApproved ? <Check size={14} strokeWidth={3} /> : step.level}
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-[#10233f]">
                                Level {step.level}: {step.role}
                              </div>
                              <div className="text-[11px] text-[#5c6678]">
                                Approver: <strong>{step.approverName}</strong> · Condition: {step.conditionDescription}
                              </div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800'
                              : isPending
                              ? 'bg-amber-100 text-amber-900 font-extrabold'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {step.status}
                          </span>
                        </div>

                        {step.comments && (
                          <div className="mt-2 text-[11px] text-[#5c6678] bg-white/70 p-2 rounded border border-slate-200">
                            <strong>Note:</strong> {step.comments}
                            {step.actionDate && <span className="ml-2 text-[10px] text-[#747e90]">({step.actionDate})</span>}
                          </div>
                        )}

                        {/* Interactive Manager Approval Actions */}
                        {isPending && (
                          <div className="mt-3 pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row items-center gap-2">
                            <input
                              type="text"
                              placeholder="Optional approver feedback / conditions..."
                              value={managerComment}
                              onChange={(e) => setManagerComment(e.target.value)}
                              className="w-full text-xs bg-white border border-amber-300 rounded-lg px-3 py-1.5 outline-none focus:border-amber-500"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleApproveStep(selectedRequest.id, step.level)}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Check size={13} />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleRejectStep(selectedRequest.id, step.level)}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle size={13} />
                                <span>Reject</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#dde1e9] p-8 text-center text-xs text-[#5c6678]">
              Select an approval request to view chain details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
