import React, { useState } from 'react';
import { Currency, Quote, Order, Contract, Subscription, Invoice } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  ArrowLeft, 
  Sparkles, 
  FileSignature, 
  Printer, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Package, 
  Receipt, 
  FileCheck2, 
  ShieldCheck, 
  Sliders, 
  ChevronRight,
  ExternalLink,
  Building2,
  Calendar,
  Send,
  CreditCard,
  UserCheck,
  MapPin,
  FileSpreadsheet,
  Hash,
  Copy,
  Check,
  Edit2
} from 'lucide-react';
import { EditQuoteModal } from './EditQuoteModal';

interface Quote360Props {
  quote: Quote;
  currency: Currency;
  onBack: () => void;
  onOpenSignModal: (quote: Quote) => void;
  onAdvanceStage: (quoteId: string, nextStatus: Quote['status']) => void;
  onOpenAiAdvisor: () => void;
  onUpdateQuote?: (quote: Quote) => void;
  relatedOrder?: Order;
  relatedContract?: Contract;
  relatedInvoice?: Invoice;
}

type QuoteSubTab = 'details' | 'lineItems' | 'audit' | 'related';

export const Quote360: React.FC<Quote360Props> = ({
  quote,
  currency,
  onBack,
  onOpenSignModal,
  onAdvanceStage,
  onOpenAiAdvisor,
  onUpdateQuote,
  relatedOrder,
  relatedContract,
  relatedInvoice,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<QuoteSubTab>('details');
  const [whatIfDiscount, setWhatIfDiscount] = useState<number>(10);
  const [showAiDrawer, setShowAiDrawer] = useState<boolean>(false);
  const [copiedDigest, setCopiedDigest] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const stages: { key: Quote['status']; label: string }[] = [
    { key: 'Draft', label: '1. Drafted' },
    { key: 'Approved', label: '2. Approved' },
    { key: 'Sent', label: '3. Sent for E-Sign' },
    { key: 'Signed', label: '4. Signed & Sealed' },
    { key: 'Invoiced', label: '5. Invoiced & GST' },
  ];

  const currentStageIndex = stages.findIndex((s) => s.key === quote.status);

  // What-if calculation
  const baseSubtotal = quote.subtotal;
  const simulatedDiscount = baseSubtotal * (whatIfDiscount / 100);
  const simulatedNet = baseSubtotal - simulatedDiscount;
  const simulatedTotal = simulatedNet * (quote.currency === 'INR' ? 1.18 : 1.08);

  const handleCopyDigest = () => {
    if (quote.signatureDigest) {
      navigator.clipboard.writeText(quote.signatureDigest);
      setCopiedDigest(true);
      setTimeout(() => setCopiedDigest(false), 2000);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Level 1: Breadcrumb & Record ID */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#0176d3] hover:text-[#014486] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to All Quotes</span>
        </button>
        <span className="text-[11px] font-mono text-[#5c6678]">
          Record ID: <span className="font-bold text-[#181c25]">{quote.id}</span>
        </span>
      </div>

      {/* Level 2: Salesforce Hero Highlights Panel */}
      <div className="rq-card p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-[#015ba5] to-[#1ab9ff] flex items-center justify-center text-white font-extrabold text-xl shadow-md shrink-0">
              Q
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider font-mono">
                  {quote.quoteNumber} · Primary Enterprise Quote
                </span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                    quote.status === 'Signed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-500/25'
                      : quote.status === 'Sent'
                      ? 'bg-blue-50 text-[#0176d3] border-[#0176d3]/25'
                      : 'bg-amber-50 text-amber-800 border-amber-500/25'
                  }`}
                >
                  {quote.status}
                </span>
                {quote.approvalStatus && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#5c6678] border border-slate-200">
                    {quote.approvalStatus}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#10233f] tracking-tight mt-0.5">
                {quote.accountName}
              </h1>
              <p className="text-xs text-[#5c6678] mt-0.5">
                Opportunity: <span className="font-semibold text-[#181c25]">{quote.opportunityName || 'Enterprise Subscription Renewal & CPQ'}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="rq-btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
              title="Edit Quote Details"
            >
              <Edit2 size={13} className="text-[#0176d3]" />
              <span>Edit Quote</span>
            </button>

            <button
              onClick={() => setShowAiDrawer(!showAiDrawer)}
              className="rq-btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
              title="Autonomous AI Deal Advisor"
            >
              <Sparkles size={13} className="text-[#0176d3]" />
              <span>AI Advisor</span>
            </button>

            <button
              onClick={() => onOpenSignModal(quote)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                quote.status === 'Signed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/30 hover:bg-emerald-100'
                  : 'rq-btn-primary'
              }`}
            >
              <FileSignature size={13} />
              <span>{quote.status === 'Signed' ? 'View Certificate' : 'Digital eSign'}</span>
            </button>
          </div>
        </div>

        {/* Quick Highlights Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-[#edf1f7]">
          <div>
            <span className="text-[10.5px] font-bold text-[#5c6678] uppercase tracking-wider block">
              Grand Total ({currency})
            </span>
            <div className="text-base sm:text-lg font-extrabold text-[#10233f] mt-0.5 font-mono">
              {formatCurrency(convertCurrency(quote.totalAmount, quote.currency, currency), currency)}
            </div>
          </div>
          <div>
            <span className="text-[10.5px] font-bold text-[#5c6678] uppercase tracking-wider block">
              Payment Terms
            </span>
            <div className="text-xs font-bold text-[#181c25] mt-1 font-mono">
              {quote.paymentTerms || 'Net 30'}
            </div>
          </div>
          <div>
            <span className="text-[10.5px] font-bold text-[#5c6678] uppercase tracking-wider block">
              Valid Until
            </span>
            <div className="text-xs font-semibold text-[#181c25] mt-1 font-mono">
              {quote.validUntil}
            </div>
          </div>
          <div>
            <span className="text-[10.5px] font-bold text-[#5c6678] uppercase tracking-wider block">
              Gross Margin
            </span>
            <div className="text-xs font-extrabold text-emerald-700 mt-1 font-mono">
              {quote.marginPct.toFixed(1)}% (Healthy)
            </div>
          </div>
          <div>
            <span className="text-[10.5px] font-bold text-[#5c6678] uppercase tracking-wider block">
              Cryptographic Audit
            </span>
            <div className="text-xs font-mono text-[#015ba5] mt-1 truncate">
              {quote.signatureDigest ? `${quote.signatureDigest.substring(0, 14)}...` : 'Pending Signature'}
            </div>
          </div>
        </div>

        {/* Level 3: Salesforce Chevron Lifecycle Path (rq-path) */}
        <div className="mt-4 sm:mt-6 pt-4 sm:pt-5 border-t border-[#edf1f7]">
          <div className="flex items-center overflow-x-auto pb-2 pt-1">
            {stages.map((st, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <div key={st.key} className="flex-1 min-w-[140px] flex items-center relative group">
                  <div
                    onClick={() => onAdvanceStage(quote.id, st.key)}
                    className={`w-full py-2 px-3 rounded-md text-xs font-bold text-center cursor-pointer transition-all duration-200 border flex items-center justify-center gap-1.5 ${
                      isPast
                        ? 'bg-[#ebf7ee] text-[#2e844a] border-[#2e844a]/30'
                        : isCurrent
                        ? 'bg-[#0176d3] text-white border-[#015ba5] shadow-md scale-102 z-10'
                        : 'bg-[#f8fafc] text-[#747e90] border-[#dde1e9] hover:bg-[#f0f3f8]'
                    }`}
                  >
                    {isPast && <CheckCircle2 size={13} className="text-[#2e844a]" />}
                    {isCurrent && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    <span>{st.label}</span>
                  </div>
                  {idx < stages.length - 1 && (
                    <ChevronRight size={14} className="text-[#c9ced8] mx-1 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex items-center border-b border-[#dde1e9] bg-white rounded-t-xl px-4 pt-2 gap-2 shadow-2xs">
        <button
          onClick={() => setActiveSubTab('details')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'details'
              ? 'border-[#0176d3] text-[#0176d3] bg-[#eef4ff]/50 rounded-t-md'
              : 'border-transparent text-[#5c6678] hover:text-[#10233f] hover:bg-slate-50'
          }`}
        >
          <Building2 size={14} />
          <span>Record Details &amp; Commercial Terms</span>
        </button>

        <button
          onClick={() => setActiveSubTab('lineItems')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'lineItems'
              ? 'border-[#0176d3] text-[#0176d3] bg-[#eef4ff]/50 rounded-t-md'
              : 'border-transparent text-[#5c6678] hover:text-[#10233f] hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Configured Line Items ({quote.items.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'audit'
              ? 'border-[#0176d3] text-[#0176d3] bg-[#eef4ff]/50 rounded-t-md'
              : 'border-transparent text-[#5c6678] hover:text-[#10233f] hover:bg-slate-50'
          }`}
        >
          <ShieldCheck size={14} />
          <span>Cryptographic Audit &amp; Verification</span>
          {quote.signatureDigest && (
            <span className="text-[10px] font-mono bg-emerald-100/70 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
              Sealed
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('related')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'related'
              ? 'border-[#0176d3] text-[#0176d3] bg-[#eef4ff]/50 rounded-t-md'
              : 'border-transparent text-[#5c6678] hover:text-[#10233f] hover:bg-slate-50'
          }`}
        >
          <Package size={14} />
          <span>Related 360 (Order, Contract, Invoices)</span>
        </button>
      </div>

      {/* Tab 1: Record Details & Entity Architecture */}
      {activeSubTab === 'details' && (
        <div className="rq-card p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* Left Column: Quote & Contact Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#10233f] uppercase tracking-wider border-b border-[#edf1f7] pb-2 flex items-center gap-2">
                <FileText size={14} className="text-[#0176d3]" />
                <span>Quote &amp; Opportunity Header</span>
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Quote Number</span>
                  <span className="font-mono font-bold text-[#10233f]">{quote.quoteNumber}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Opportunity Name</span>
                  <span className="font-semibold text-[#10233f]">{quote.opportunityName || 'Global Modernization Renewal'}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Account Name</span>
                  <span className="font-bold text-[#0176d3]">{quote.accountName}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Status</span>
                  <span className="font-bold text-[#10233f]">{quote.status}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Primary Contact</span>
                  <span className="font-semibold text-[#10233f]">{quote.contactName}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Contact Email</span>
                  <span className="font-mono text-[#10233f]">{quote.contactEmail}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Contact Phone</span>
                  <span className="font-mono text-[#10233f]">{quote.contactPhone || '+1 (555) 019-2834'}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Payment Terms</span>
                  <span className="font-bold text-[#2e844a]">{quote.paymentTerms || 'Net 30'}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Created Date</span>
                  <span className="font-mono text-[#10233f]">{quote.createdAt}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Valid Until</span>
                  <span className="font-mono text-[#10233f]">{quote.validUntil}</span>
                </div>
              </div>

              {/* Discount Governance Section */}
              <div className="pt-4 border-t border-[#edf1f7] space-y-3">
                <h4 className="text-[11px] font-bold text-[#10233f] uppercase tracking-wider">
                  Discount Governance &amp; Approvals
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#5c6678] text-[11px] block">Approval Tier</span>
                    <span className="font-semibold text-[#015ba5]">{quote.discountTier || 'Rep Discretion (<15%)'}</span>
                  </div>
                  <div>
                    <span className="text-[#5c6678] text-[11px] block">Approval Status</span>
                    <span className="font-bold text-emerald-700">{quote.approvalStatus || 'Auto-Approved'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#5c6678] text-[11px] block">Approved By / Governance Note</span>
                    <span className="text-[#10233f]">
                      {quote.approvedBy || 'AI CPQ Governance Engine'}
                      {quote.approvalNotes && ` — ${quote.approvalNotes}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Address & Commercial Breakdown */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#10233f] uppercase tracking-wider border-b border-[#edf1f7] pb-2 flex items-center gap-2">
                <MapPin size={14} className="text-[#0176d3]" />
                <span>Addresses &amp; Multi-Entity Taxation</span>
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#dde1e9] space-y-1">
                  <span className="text-[10px] font-bold text-[#5c6678] uppercase block">Billing Address</span>
                  <div className="text-xs font-medium text-[#10233f]">
                    {quote.billingAddress ? (
                      <>
                        <p>{quote.billingAddress.street}</p>
                        <p>{quote.billingAddress.city}, {quote.billingAddress.state} {quote.billingAddress.postalCode}</p>
                        <p className="font-semibold text-[#5c6678]">{quote.billingAddress.country}</p>
                      </>
                    ) : (
                      <p>510 Townsend St, Suite 400, San Francisco, CA 94103, USA</p>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#dde1e9] space-y-1">
                  <span className="text-[10px] font-bold text-[#5c6678] uppercase block">Shipping / Provisioning Address</span>
                  <div className="text-xs font-medium text-[#10233f]">
                    {quote.shippingAddress ? (
                      <>
                        <p>{quote.shippingAddress.street}</p>
                        <p>{quote.shippingAddress.city}, {quote.shippingAddress.state} {quote.shippingAddress.postalCode}</p>
                        <p className="font-semibold text-[#5c6678]">{quote.shippingAddress.country}</p>
                      </>
                    ) : (
                      <p>510 Townsend St, Suite 400, San Francisco, CA 94103, USA</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Taxation Breakdown */}
              <div className="pt-2 space-y-2">
                <h4 className="text-[11px] font-bold text-[#10233f] uppercase tracking-wider">
                  Tax Architecture Breakdown
                </h4>
                <div className="p-3.5 rounded-xl bg-[#fbfcfe] border border-[#dde1e9] space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-[#5c6678]">
                    <span>Subtotal:</span>
                    <span className="font-bold text-[#10233f]">{formatCurrency(quote.subtotal, quote.currency)}</span>
                  </div>
                  <div className="flex justify-between text-[#ba0517]">
                    <span>Discount Allowed:</span>
                    <span>-{formatCurrency(quote.discountTotal, quote.currency)}</span>
                  </div>
                  {quote.currency === 'INR' ? (
                    <>
                      <div className="flex justify-between text-[#5c6678]">
                        <span>CGST (9% Central):</span>
                        <span>{formatCurrency(quote.cgstAmount || quote.taxTotal / 2, quote.currency)}</span>
                      </div>
                      <div className="flex justify-between text-[#5c6678]">
                        <span>SGST (9% State):</span>
                        <span>{formatCurrency(quote.sgstAmount || quote.taxTotal / 2, quote.currency)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-[#5c6678]">
                      <span>Tax (GST / VAT):</span>
                      <span>{formatCurrency(quote.taxTotal, quote.currency)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#dde1e9] flex justify-between font-extrabold text-[#10233f] text-sm">
                    <span>Grand Total:</span>
                    <span className="text-emerald-700">{formatCurrency(quote.totalAmount, quote.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Proposal Custom Notes */}
          <div className="pt-4 border-t border-[#edf1f7]">
            <h4 className="text-xs font-bold text-[#10233f] uppercase tracking-wider mb-2">
              Proposal Executive Summary &amp; Special Clauses
            </h4>
            <div className="p-3.5 rounded-xl bg-[#fbfcfe] border border-[#dde1e9] text-xs text-[#5c6678] leading-relaxed">
              {quote.customProposalNotes || 'Special Enterprise Terms: Includes dedicated technical account manager (TAM) with 99.99% SLA guarantee and priority 1-hour ticket response.'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Configured Line Items & What-If Slider */}
      {activeSubTab === 'lineItems' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="rq-card overflow-hidden">
            <div className="p-4 border-b border-[#dde1e9] flex items-center justify-between bg-[#fbfcfe]">
              <div>
                <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                  Configured Product Line Items
                </h2>
                <p className="text-[11px] text-[#5c6678]">
                  {quote.items.length} items configured with tiered volume pricing &amp; HSN/SAC codes
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 text-center">HSN / SAC</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Unit List</th>
                    <th className="py-3 px-4 text-center">Discount</th>
                    <th className="py-3 px-4 text-right">Net Amount</th>
                    <th className="py-3 px-4 text-center">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f7]">
                  {quote.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#f8fafc]">
                      <td className="py-3.5 px-4 font-bold text-[#181c25]">
                        <div>{item.productName}</div>
                        {item.servicePeriod && (
                          <div className="text-[10px] text-[#5c6678] font-normal">{item.servicePeriod}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-[#5c6678]">
                        <span className="bg-slate-100 text-[#5c6678] px-2 py-0.5 rounded text-[10.5px]">
                          {item.hsnCode || '998313'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-[#5c6678]">
                        {item.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[#5c6678]">
                        {formatCurrency(item.unitPrice, quote.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-xs font-bold text-[#0176d3] bg-[#eef4ff] px-2 py-0.5 rounded">
                          {item.discountPct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-[#10233f]">
                        {formatCurrency(item.totalPrice, quote.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-emerald-700 font-bold">
                        {item.marginPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pricing Summary Totals */}
            <div className="p-5 bg-[#fbfcfe] border-t border-[#dde1e9] flex justify-end">
              <div className="w-80 space-y-2 text-xs">
                <div className="flex justify-between text-[#5c6678]">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold text-[#181c25]">
                    {formatCurrency(convertCurrency(quote.subtotal, quote.currency, currency), currency)}
                  </span>
                </div>
                <div className="flex justify-between text-[#5c6678]">
                  <span>Discount Allowed</span>
                  <span className="font-mono font-bold text-[#ba0517]">
                    -{formatCurrency(convertCurrency(quote.discountTotal, quote.currency, currency), currency)}
                  </span>
                </div>
                <div className="flex justify-between text-[#5c6678]">
                  <span>Tax (18% GST / VAT)</span>
                  <span className="font-mono font-bold text-[#181c25]">
                    {formatCurrency(convertCurrency(quote.taxTotal, quote.currency, currency), currency)}
                  </span>
                </div>
                <div className="pt-2.5 border-t border-[#dde1e9] flex justify-between items-center text-sm">
                  <span className="font-extrabold text-[#10233f]">Grand Total</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-lg">
                    {formatCurrency(convertCurrency(quote.totalAmount, quote.currency, currency), currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive What-If Discount Modeler */}
          <div className="rq-card p-5 space-y-3.5 border-l-4 border-l-[#1ab9ff]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-[#0176d3]" />
                <h3 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                  Interactive What-If Discount Simulator
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-[#0176d3] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                {whatIfDiscount}% Simulated
              </span>
            </div>
            <p className="text-[11px] text-[#5c6678]">
              Test price sensitivity on the fly: adjust discount to see instant revised net, margin impact and approval gating.
            </p>

            <input
              type="range"
              min="0"
              max="40"
              value={whatIfDiscount}
              onChange={(e) => setWhatIfDiscount(parseInt(e.target.value) || 0)}
              className="w-full accent-[#0176d3] cursor-pointer"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#dde1e9]">
                <span className="text-[10px] text-[#5c6678] font-bold block uppercase">Simulated Net</span>
                <span className="font-mono font-extrabold text-[#10233f] text-sm">
                  {formatCurrency(convertCurrency(simulatedNet, quote.currency, currency), currency)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#dde1e9]">
                <span className="text-[10px] text-[#5c6678] font-bold block uppercase">Simulated Grand Total</span>
                <span className="font-mono font-extrabold text-emerald-700 text-sm">
                  {formatCurrency(convertCurrency(simulatedTotal, quote.currency, currency), currency)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#dde1e9]">
                <span className="text-[10px] text-[#5c6678] font-bold block uppercase">Approval Required?</span>
                <span className={`font-bold text-xs ${whatIfDiscount > 20 ? 'text-[#ba0517]' : 'text-[#2e844a]'}`}>
                  {whatIfDiscount > 20 ? 'Requires VP Sign-Off' : 'Auto-Approved (<20%)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cryptographic Audit Trail & E-Sign Verification */}
      {activeSubTab === 'audit' && (
        <div className="rq-card p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#edf1f7] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#10233f] flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#0176d3]" />
                <span>Tamper-Evident SHA-256 Audit Trail &amp; Verification</span>
              </h2>
              <p className="text-xs text-[#5c6678] mt-0.5">
                Cryptographic log of all quote modifications, discount approvals, email deliveries, and digital signatures.
              </p>
            </div>

            {quote.signatureDigest && (
              <button
                onClick={handleCopyDigest}
                className="rq-btn-secondary text-xs"
              >
                {copiedDigest ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                <span>{copiedDigest ? 'Copied Hash!' : 'Copy SHA-256 Digest'}</span>
              </button>
            )}
          </div>

          {/* Cryptographic Seal Panel */}
          {quote.signatureDigest ? (
            <div className="p-4 rounded-xl bg-[#ebf7ee] border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-700" />
                  <span className="font-bold text-xs text-emerald-900 uppercase tracking-wider">
                    Legally Executed &amp; Cryptographically Sealed
                  </span>
                </div>
                <span className="text-[10.5px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                  SHA-256 Validated
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[11px] text-[#5c6678] block">Signer Name &amp; Email:</span>
                  <span className="font-bold text-[#10233f]">{quote.signedByName} ({quote.signedByEmail})</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#5c6678] block">Timestamp (UTC):</span>
                  <span className="font-mono text-[#10233f]">{quote.signedAt}</span>
                </div>
                <div>
                  <span className="text-[11px] text-[#5c6678] block">Signer IP &amp; Browser:</span>
                  <span className="font-mono text-[#10233f]">{quote.signerIp || '198.51.100.42'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-500/20">
                <span className="text-[10.5px] text-[#5c6678] uppercase tracking-wider block font-bold mb-1">
                  SHA-256 Digest Hash:
                </span>
                <div className="p-2 rounded bg-white font-mono text-[11px] text-emerald-900 border border-emerald-300/60 break-all select-all">
                  {quote.signatureDigest}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-500/25 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-amber-700" />
                <div>
                  <div className="font-bold text-xs text-amber-900">Awaiting Digital Execution</div>
                  <div className="text-[11px] text-amber-800">
                    Quote has not been digitally signed yet. Click "Digital eSign" above to sign and seal.
                  </div>
                </div>
              </div>
              <button
                onClick={() => onOpenSignModal(quote)}
                className="rq-btn-primary"
              >
                Sign Now
              </button>
            </div>
          )}

          {/* Chronological Event Log */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
              Chronological Audit Events ({quote.auditTrail ? quote.auditTrail.length : 3})
            </h3>

            <div className="space-y-3">
              {(quote.auditTrail || [
                {
                  id: 'aud-fallback-1',
                  timestamp: quote.createdAt + ' 09:15:00 UTC',
                  actor: 'Devon Vance (Account Exec)',
                  action: 'Quote Created & Primary Flag Set',
                  details: 'Configured Core Platform + Native eSign bundle with discount',
                  hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                },
                {
                  id: 'aud-fallback-2',
                  timestamp: quote.createdAt + ' 11:30:22 UTC',
                  actor: 'Marcus Sterling (VP RevOps)',
                  action: 'Autonomous CPQ Rule Passed',
                  details: 'System validated margin > threshold. Deal auto-approved for dispatch.',
                  hash: 'b10a8db164e0754105b7a99be72e3fe5aa7059ea3be01524e0b044d4cd4a3878',
                },
                {
                  id: 'aud-fallback-3',
                  timestamp: quote.createdAt + ' 11:32:00 UTC',
                  actor: 'System Daemon',
                  action: 'Envelope Dispatched via SES',
                  details: `Audit token ${quote.portalToken} generated and sent to ${quote.contactEmail}`,
                  hash: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
                },
              ]).map((evt, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-[#dde1e9] bg-[#fbfcfe] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#0176d3]" />
                      <span className="font-bold text-[#10233f]">{evt.action}</span>
                    </div>
                    <span className="font-mono text-[10.5px] text-[#5c6678]">{evt.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-[#5c6678]">
                    Actor: <span className="font-semibold text-[#181c25]">{evt.actor}</span> — {evt.details}
                  </div>
                  {evt.hash && (
                    <div className="text-[10px] font-mono text-[#015ba5] pt-1">
                      Hash: {evt.hash.substring(0, 32)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Related 360 Records */}
      {activeSubTab === 'related' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Linked Order Card */}
          <div className="rq-card p-4 sm:p-5 space-y-3.5 border-t-[3px] border-t-[#0176d3]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-[#0176d3]" />
                <h3 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                  Downstream Order Record
                </h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${relatedOrder ? 'bg-emerald-50 text-emerald-800 border-emerald-500/20' : 'bg-amber-50 text-amber-800 border-amber-500/20'}`}>
                {relatedOrder ? relatedOrder.status : 'Pending Execution'}
              </span>
            </div>

            {relatedOrder ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Order Number:</span>
                  <span className="font-mono font-bold text-[#10233f]">{relatedOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Fulfillment Status:</span>
                  <span className="font-bold text-emerald-700">{relatedOrder.fulfillmentStatus || 'Active'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">PO Number:</span>
                  <span className="font-mono text-[#10233f]">{relatedOrder.poNumber || 'PO-STRIPE-89124'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Ordered Date:</span>
                  <span className="font-mono text-[#10233f]">{relatedOrder.orderedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Delivery Milestone:</span>
                  <span className="text-[#10233f] font-medium">{relatedOrder.deliveryMilestone || 'Cloud Provisioned & Active'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#5c6678]">
                Once quote is digitally signed, an Activated Order will automatically be provisioned.
              </p>
            )}
          </div>

          {/* Linked Contract Card */}
          <div className="rq-card p-4 sm:p-5 space-y-3.5 border-t-[3px] border-t-purple-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck2 size={16} className="text-purple-600" />
                <h3 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                  Master Agreement Contract
                </h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${relatedContract ? 'bg-emerald-50 text-emerald-800 border-emerald-500/20' : 'bg-amber-50 text-amber-800 border-amber-500/20'}`}>
                {relatedContract ? relatedContract.status : 'Pending Execution'}
              </span>
            </div>

            {relatedContract ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Contract Number:</span>
                  <span className="font-mono font-bold text-[#10233f]">{relatedContract.contractNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Contract Type:</span>
                  <span className="font-semibold text-[#10233f]">{relatedContract.contractType || 'Master Service Agreement (MSA)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Contract Term:</span>
                  <span className="font-mono text-[#10233f]">{relatedContract.contractTermMonths} Months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Governing Law:</span>
                  <span className="text-[#10233f]">{relatedContract.governingLaw || 'Delaware, USA'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Auto-Renew:</span>
                  <span className="font-bold text-emerald-700">{relatedContract.autoRenew ? 'Enabled (30d notice)' : 'No'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#5c6678]">
                Master contract terms will automatically bind and activate upon digital signature capture.
              </p>
            )}
          </div>

          {/* Linked GST Invoice Card */}
          <div className="rq-card p-4 sm:p-5 space-y-3.5 border-t-[3px] border-t-emerald-600 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-emerald-600" />
                <h3 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                  B2B Tax Invoice &amp; Indian GST e-Invoice Compliance
                </h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${relatedInvoice ? (relatedInvoice.status === 'Paid' ? 'bg-emerald-50 text-emerald-800 border-emerald-500/20' : 'bg-blue-50 text-[#015ba5] border-[#0176d3]/20') : 'bg-amber-50 text-amber-800 border-amber-500/20'}`}>
                {relatedInvoice ? relatedInvoice.status : 'Pending Execution'}
              </span>
            </div>

            {relatedInvoice ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Invoice Number:</span>
                  <span className="font-mono font-bold text-[#10233f]">{relatedInvoice.invoiceNumber}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Invoice Type:</span>
                  <span className="font-semibold text-[#10233f]">{relatedInvoice.invoiceType || 'B2B Tax Invoice'}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Due Date:</span>
                  <span className="font-mono text-[#10233f]">{relatedInvoice.dueDate}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Total Amount:</span>
                  <span className="font-mono font-extrabold text-emerald-700">
                    {formatCurrency(relatedInvoice.amount, relatedInvoice.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Payment Method:</span>
                  <span className="font-semibold text-[#10233f]">{relatedInvoice.paymentMethod || 'Stripe / Bank Wire'}</span>
                </div>
                <div>
                  <span className="text-[#5c6678] text-[11px] block">Place of Supply:</span>
                  <span className="font-mono text-[#10233f]">{relatedInvoice.placeOfSupply || '99-Other Countries / Export'}</span>
                </div>
                {relatedInvoice.irnNumber && (
                  <div className="col-span-full pt-2 border-t border-[#edf1f7]">
                    <span className="text-[10.5px] text-[#5c6678] uppercase tracking-wider block font-bold mb-1">
                      Indian GST IRN (Invoice Reference Number):
                    </span>
                    <div className="p-2 rounded bg-[#f8fafc] font-mono text-[11px] text-[#015ba5] border border-[#dde1e9] break-all select-all">
                      {relatedInvoice.irnNumber}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#5c6678]">
                B2B tax invoice will be generated with automated tax breakdown and government IRN hash upon signature.
              </p>
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && onUpdateQuote && (
        <EditQuoteModal
          quote={quote}
          currency={currency}
          onClose={() => setIsEditModalOpen(false)}
          onSave={onUpdateQuote}
        />
      )}
    </div>
  );
};
