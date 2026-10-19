import React, { useState } from 'react';
import { Invoice, Currency } from '../../types';
import { X, Check, Receipt } from 'lucide-react';

interface EditInvoiceModalProps {
  invoice: Invoice;
  currency: Currency;
  onClose: () => void;
  onSave: (updatedInvoice: Invoice) => void;
}

export const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({
  invoice,
  currency,
  onClose,
  onSave,
}) => {
  const [accountName, setAccountName] = useState(invoice.accountName);
  const [invoiceType, setInvoiceType] = useState<Invoice['invoiceType']>(invoice.invoiceType || 'B2B Tax Invoice');
  const [status, setStatus] = useState<Invoice['status']>(invoice.status);
  const [amount, setAmount] = useState<number>(invoice.amount);
  const [gstAmount, setGstAmount] = useState<number>(invoice.gstAmount);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [paymentMethod, setPaymentMethod] = useState<Invoice['paymentMethod']>(invoice.paymentMethod || 'Stripe');
  const [buyerGstin, setBuyerGstin] = useState(invoice.buyerGstin || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Invoice = {
      ...invoice,
      accountName,
      invoiceType,
      status,
      amount,
      gstAmount,
      dueDate,
      paymentMethod,
      buyerGstin,
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
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center">
              <Receipt size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#10233f]">Edit Invoice &amp; Tax Attributes</h2>
              <span className="text-xs font-mono font-bold text-emerald-700">{invoice.invoiceNumber}</span>
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
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Invoice Document Type</label>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as Invoice['invoiceType'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="B2B Tax Invoice">B2B Tax Invoice</option>
                <option value="Proforma">Proforma</option>
                <option value="Credit Note">Credit Note</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Payment Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Invoice['status'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Invoice Total Amount ({invoice.currency}) *</label>
              <input
                type="number"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">GST Tax Amount ({invoice.currency})</label>
              <input
                type="number"
                min="0"
                value={gstAmount}
                onChange={(e) => setGstAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Payment Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Payment Method / Gateway</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as Invoice['paymentMethod'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Stripe">Stripe</option>
                <option value="Razorpay">Razorpay</option>
                <option value="Bank Transfer">Bank Transfer / Wire</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#10233f] mb-1">Buyer GSTIN (15-Char Indian Tax ID)</label>
            <input
              type="text"
              placeholder="e.g. 27AABCT3518Q1ZP"
              value={buyerGstin}
              onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())}
              className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
            />
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
              <span>Save Invoice Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
