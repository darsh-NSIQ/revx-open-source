import React, { useState } from 'react';
import { Quote, Currency } from '../../types';
import { X, Check, Layers } from 'lucide-react';

interface EditQuoteModalProps {
  quote: Quote;
  currency: Currency;
  onClose: () => void;
  onSave: (updatedQuote: Quote) => void;
}

export const EditQuoteModal: React.FC<EditQuoteModalProps> = ({
  quote,
  currency,
  onClose,
  onSave,
}) => {
  const [accountName, setAccountName] = useState(quote.accountName);
  const [contactName, setContactName] = useState(quote.contactName);
  const [contactEmail, setContactEmail] = useState(quote.contactEmail);
  const [status, setStatus] = useState<Quote['status']>(quote.status);
  const [validUntil, setValidUntil] = useState(quote.validUntil);
  const [paymentTerms, setPaymentTerms] = useState<Quote['paymentTerms']>(quote.paymentTerms || 'Net 30');
  const [subtotal, setSubtotal] = useState<number>(quote.subtotal);
  const [discountTotal, setDiscountTotal] = useState<number>(quote.discountTotal || 0);
  const [marginPct, setMarginPct] = useState<number>(quote.marginPct || 75);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const net = Math.max(0, subtotal - discountTotal);
    const taxRate = quote.currency === 'INR' ? 0.18 : 0.08;
    const taxTotal = Math.round(net * taxRate);
    const totalAmount = net + taxTotal;

    const updated: Quote = {
      ...quote,
      accountName,
      contactName,
      contactEmail,
      status,
      validUntil,
      paymentTerms,
      subtotal,
      discountTotal,
      taxTotal,
      totalAmount,
      marginPct,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-lg flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-[#fbfcfe] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0176d3] border border-blue-200/60 flex items-center justify-center">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#10233f]">Edit Quote Attributes</h2>
              <span className="text-xs font-mono font-bold text-[#015ba5]">{quote.quoteNumber}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:text-[#181c25] hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-[#10233f] mb-1">Customer Account Name *</label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Authorized Signer *</label>
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Signer Email *</label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Quote Lifecycle Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Quote['status'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
                <option value="Sent">Sent</option>
                <option value="Signed">Signed</option>
                <option value="Invoiced">Invoiced</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as Quote['paymentTerms'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Net 30">Net 30</option>
                <option value="Net 45">Net 45</option>
                <option value="Net 60">Net 60</option>
                <option value="Due Upon Receipt">Due Upon Receipt</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Valid Until Date</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Gross Margin %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={marginPct}
                onChange={(e) => setMarginPct(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Subtotal ({quote.currency})</label>
              <input
                type="number"
                min="0"
                value={subtotal}
                onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Discount Amount ({quote.currency})</label>
              <input
                type="number"
                min="0"
                value={discountTotal}
                onChange={(e) => setDiscountTotal(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#dde1e9] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#dde1e9] text-xs font-semibold text-[#5c6678] hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rq-btn-primary text-xs flex items-center gap-1.5"
            >
              <Check size={13} />
              <span>Save Quote Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
