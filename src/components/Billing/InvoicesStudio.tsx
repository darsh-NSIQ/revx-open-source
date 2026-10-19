import React, { useState } from 'react';
import { Currency, Invoice, Quote } from '../../types';
import { formatCurrency } from '../../utils/format';
import { generateIRN } from '../../utils/crypto';
import { 
  Receipt, 
  CreditCard, 
  CheckCircle2, 
  QrCode, 
  Clock, 
  Plus,
  ShieldCheck,
  Building2,
  ExternalLink,
  MapPin,
  FileText,
  Edit2
} from 'lucide-react';
import { EditInvoiceModal } from './EditInvoiceModal';

interface InvoicesStudioProps {
  currency: Currency;
  invoices: Invoice[];
  quotes: Quote[];
  onPayInvoice: (invoiceId: string, method: 'Razorpay' | 'Stripe') => void;
  onGenerateInvoiceFromQuote: (quote: Quote) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
}

export const InvoicesStudio: React.FC<InvoicesStudioProps> = ({ 
  currency, 
  invoices, 
  quotes,
  onPayInvoice,
  onGenerateInvoiceFromQuote,
  onUpdateInvoice,
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(invoices[0] || null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const signedQuotesWithoutInvoice = quotes.filter(
    (q) => q.status === 'Signed' && !invoices.some((inv) => inv.quoteNumber === q.quoteNumber)
  );

  const handleSimulatePayment = (method: 'Razorpay' | 'Stripe') => {
    if (!selectedInvoice) return;
    setIsProcessingPayment(true);
    setTimeout(() => {
      onPayInvoice(selectedInvoice.id, method);
      setIsProcessingPayment(false);
      setSelectedInvoice({
        ...selectedInvoice,
        status: 'Paid',
        paymentMethod: method,
        paidAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      });
    }, 800);
  };

  // Calculate invoice metrics
  const totalReceivables = invoices
    .filter((inv) => inv.status !== 'Paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const totalCollected = invoices
    .filter((inv) => inv.status === 'Paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const totalGst = invoices.reduce((sum, inv) => sum + (inv.gstAmount || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner with Glassmorphism */}
      <div className="rq-card p-4 sm:p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3] animate-pulse" />
                Zuora Billing &amp; Invoicing 360
              </span>
              <span className="text-xs text-slate-500 font-medium">India GST &amp; IRN Compliant</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Tax Invoicing, Indian GST &amp; Autonomous Dunning
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Automated e-Invoicing (IRN &amp; signed QR code), multi-tax GST 18% calculation, and real-time Stripe/Razorpay payment gateway webhooks.
            </p>
          </div>

          {signedQuotesWithoutInvoice.length > 0 && (
            <button
              onClick={() => onGenerateInvoiceFromQuote(signedQuotesWithoutInvoice[0])}
              className="rq-btn-primary text-xs cursor-pointer shadow-sm"
            >
              <Plus size={14} className="stroke-[2.5]" />
              <span>Bill {signedQuotesWithoutInvoice[0].quoteNumber}</span>
            </button>
          )}
        </div>

        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-32 bg-radial from-[#0176d3]/10 to-transparent pointer-events-none" />
      </div>

      {/* Receivables Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-amber-500 rq-stagger-1">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Open Receivables</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 tabular-nums font-mono">
            {formatCurrency(totalReceivables, currency)}
          </div>
          <div className="text-[10px] text-amber-700 font-bold mt-1 flex items-center gap-1">
            <Clock size={11} />
            <span>Autonomous dunning active</span>
          </div>
        </div>

        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-emerald-500 rq-stagger-2">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Settled Collections</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight mt-1 tabular-nums font-mono">
            {formatCurrency(totalCollected, currency)}
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
            <CheckCircle2 size={11} />
            <span>Razorpay / Stripe Webhooks</span>
          </div>
        </div>

        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-[#0176d3] rq-stagger-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">GST Collected (18%)</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 tabular-nums font-mono">
            {formatCurrency(totalGst, currency)}
          </div>
          <div className="text-[10px] text-[#0176d3] font-bold mt-1 flex items-center gap-1">
            <ShieldCheck size={11} />
            <span>NIC IRP e-Invoice Certified</span>
          </div>
        </div>

        <div className="rq-card-elevated p-3.5 sm:p-4 border-l-4 border-l-indigo-500 rq-stagger-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Weighted DSO</div>
          <div className="text-xl sm:text-2xl font-black text-indigo-700 tracking-tight mt-1 tabular-nums font-mono">
            24.2 Days
          </div>
          <div className="text-[10px] text-indigo-700 font-bold mt-1 flex items-center gap-1">
            <span>Industry benchmark 42d</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Left: Invoice List */}
        <div className="lg:col-span-2 rq-card overflow-hidden rq-stagger-2">
          <div className="p-3.5 sm:p-4 border-b border-slate-200/90 flex items-center justify-between bg-white/70 backdrop-blur-md">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Receipt size={14} className="text-[#0176d3]" />
              <span>Issued Invoices &amp; Receivables</span>
            </h2>
            <span className="text-[11px] text-slate-500 font-semibold">
              {invoices.length} Invoices recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="rq-table">
              <thead>
                <tr>
                  <th>Invoice # &amp; Type</th>
                  <th>Account &amp; GSTIN</th>
                  <th>Quote Ref</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isPaid = inv.status === 'Paid';
                  const isSelected = selectedInvoice?.id === inv.id;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      className={`cursor-pointer ${
                        isSelected ? 'bg-blue-50/70 font-semibold' : ''
                      }`}
                    >
                      <td className="font-mono">
                        <div className="font-bold text-[#0176d3] flex items-center gap-1">
                          <span>{inv.invoiceNumber}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3]" />}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">{inv.invoiceType || 'B2B Tax Invoice'}</div>
                      </td>
                      <td className="font-semibold text-slate-900">
                        <div>{inv.accountName}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">{inv.buyerGstin || 'Unregistered / Export'}</div>
                      </td>
                      <td className="font-mono text-slate-600 font-medium">
                        {inv.quoteNumber}
                      </td>
                      <td className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(inv.amount, inv.currency)}
                      </td>
                      <td>
                        {isPaid ? (
                          <span className="rq-badge rq-badge-emerald">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Paid · {inv.paymentMethod}</span>
                          </span>
                        ) : (
                          <span className="rq-badge rq-badge-amber">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>Due {inv.dueDate}</span>
                          </span>
                        )}
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingInvoice(inv)}
                            className="px-2 py-1 rounded bg-white hover:bg-blue-50 text-[#015ba5] text-xs font-semibold border border-slate-200 hover:border-[#0176d3]/40 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            title="Edit Invoice"
                          >
                            <Edit2 size={11} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="text-[11px] font-bold text-[#0176d3] hover:text-[#014486] transition-colors cursor-pointer"
                          >
                            Details →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Invoice Details & Payment Simulator */}
        {selectedInvoice && (
          <div className="rq-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#edf1f7] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#5c6678] uppercase tracking-wider block font-bold">
                  {selectedInvoice.invoiceType || 'Official Tax Invoice'}
                </span>
                <h3 className="text-base font-extrabold text-[#10233f] font-mono">
                  {selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingInvoice(selectedInvoice)}
                  className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-[#015ba5] text-xs font-semibold border border-[#dde1e9] transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                  title="Edit Selected Invoice"
                >
                  <Edit2 size={11} />
                  <span>Edit</span>
                </button>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                    selectedInvoice.status === 'Paid'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-500/30'
                      : 'bg-amber-50 text-amber-800 border-amber-500/30'
                  }`}
                >
                  {selectedInvoice.status}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-[#5c6678]">
                <span>Customer</span>
                <span className="font-bold text-[#181c25]">{selectedInvoice.accountName}</span>
              </div>
              <div className="flex justify-between text-[#5c6678]">
                <span>Buyer GSTIN</span>
                <span className="font-mono font-semibold text-[#181c25]">{selectedInvoice.buyerGstin || '06AABCS1429B1Z0'}</span>
              </div>
              <div className="flex justify-between text-[#5c6678]">
                <span>Place of Supply</span>
                <span className="font-medium text-[#181c25]">{selectedInvoice.placeOfSupply || '27-Maharashtra'}</span>
              </div>
              <div className="flex justify-between text-[#5c6678]">
                <span>Associated Quote</span>
                <span className="font-mono font-semibold text-[#0176d3]">{selectedInvoice.quoteNumber}</span>
              </div>
              <div className="flex justify-between text-[#5c6678]">
                <span>GST Amount</span>
                <span className="font-mono font-semibold text-[#181c25]">
                  {formatCurrency(selectedInvoice.gstAmount, selectedInvoice.currency)}
                </span>
              </div>
              <div className="pt-2.5 border-t border-[#dde1e9] flex justify-between items-center">
                <span className="font-bold text-[#10233f]">Total Payable</span>
                <span className="font-mono font-extrabold text-emerald-700 text-lg">
                  {formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}
                </span>
              </div>
            </div>

            {/* India GST e-Invoice IRN Details */}
            <div className="p-3.5 rounded-xl bg-[#f8fafc] border border-[#dde1e9] space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-[#015ba5] font-bold text-[11px]">
                <QrCode size={15} />
                <span>GST e-Invoice IRN &amp; Signed QR Code</span>
              </div>
              <p className="text-[10.5px] text-[#5c6678] leading-relaxed">
                64-character hash registered with GST e-Invoicing portal (IRP/NIC compliance).
              </p>
              <div className="font-mono text-[9.5px] p-2 rounded-md bg-white border border-[#dde1e9] text-[#181c25] break-all select-all shadow-2xs font-semibold">
                {selectedInvoice.irnNumber || generateIRN('27AABCR9999P1ZQ', selectedInvoice.invoiceNumber, '2026-27')}
              </div>
              {selectedInvoice.ackNumber && (
                <div className="text-[10px] text-[#5c6678] font-mono pt-1">
                  NIC Ack: <span className="text-[#10233f] font-bold">{selectedInvoice.ackNumber}</span> ({selectedInvoice.ackDate})
                </div>
              )}
            </div>

            {/* Simulated Payment Webhook Triggers */}
            {selectedInvoice.status !== 'Paid' ? (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5c6678] block">
                  Simulate Live Payment Webhook
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => handleSimulatePayment('Razorpay')}
                    disabled={isProcessingPayment}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-[#0c2340] hover:bg-[#123158] text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                  >
                    <CreditCard size={13} />
                    <span>Pay Razorpay</span>
                  </button>
                  <button
                    onClick={() => handleSimulatePayment('Stripe')}
                    disabled={isProcessingPayment}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-[#635bff] hover:bg-[#5347e8] text-white text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                  >
                    <CreditCard size={13} />
                    <span>Pay Stripe</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-500/25 text-xs text-emerald-800 flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <div className="font-bold">Payment Settled via {selectedInvoice.paymentMethod}</div>
                  <div className="text-[10.5px] text-emerald-700">{selectedInvoice.paidAt} UTC</div>
                  {selectedInvoice.transactionRef && (
                    <div className="text-[10px] font-mono text-[#5c6678] mt-0.5">Ref: {selectedInvoice.transactionRef}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {editingInvoice && onUpdateInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          currency={currency}
          onClose={() => setEditingInvoice(null)}
          onSave={onUpdateInvoice}
        />
      )}
    </div>
  );
};
