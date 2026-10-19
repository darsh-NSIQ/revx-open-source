import React, { useState } from 'react';
import { Subscription, Currency, SubscriptionStatus } from '../../types';
import { X, Check, Sliders } from 'lucide-react';

interface EditSubscriptionModalProps {
  subscription: Subscription;
  currency: Currency;
  onClose: () => void;
  onSave: (updatedSub: Subscription) => void;
}

export const EditSubscriptionModal: React.FC<EditSubscriptionModalProps> = ({
  subscription,
  currency,
  onClose,
  onSave,
}) => {
  const [productName, setProductName] = useState(subscription.productName);
  const [accountName, setAccountName] = useState(subscription.accountName);
  const [customerEmail, setCustomerEmail] = useState(subscription.customerEmail || '');
  const [tier, setTier] = useState<Subscription['tier']>(subscription.tier || 'Enterprise Plus');
  const [status, setStatus] = useState<SubscriptionStatus>(subscription.status);
  const [mrr, setMrr] = useState<number>(subscription.mrr);
  const [billingCadence, setBillingCadence] = useState<Subscription['billingCadence']>(subscription.billingCadence || 'Monthly');
  const [renewalDate, setRenewalDate] = useState(subscription.renewalDate);
  const [discountPct, setDiscountPct] = useState<number>(subscription.discountPct || 0);
  const [isGrandfathered, setIsGrandfathered] = useState<boolean>(!!subscription.isGrandfathered);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Subscription = {
      ...subscription,
      productName,
      accountName,
      customerEmail,
      tier,
      status,
      mrr,
      billingCadence,
      renewalDate,
      discountPct,
      isGrandfathered,
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
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 flex items-center justify-center">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#10233f]">Edit Subscription Details</h2>
              <span className="text-xs font-mono font-bold text-purple-700">{subscription.subscriptionNumber}</span>
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
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Product / Plan Name *</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Customer Contact Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Subscription Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as Subscription['tier'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Starter">Starter</option>
                <option value="Professional">Professional</option>
                <option value="Enterprise Plus">Enterprise Plus</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Active">Active</option>
                <option value="In Trial">In Trial</option>
                <option value="Past Due">Past Due</option>
                <option value="Paused">Paused</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Monthly MRR ({subscription.currency}) *</label>
              <input
                type="number"
                min="0"
                required
                value={mrr}
                onChange={(e) => setMrr(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Billing Cadence</label>
              <select
                value={billingCadence}
                onChange={(e) => setBillingCadence(e.target.value as Subscription['billingCadence'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Next Renewal Date</label>
              <input
                type="date"
                required
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Discount %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountPct}
                onChange={(e) => setDiscountPct(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isGrandfathered}
                onChange={(e) => setIsGrandfathered(e.target.checked)}
                className="rounded border-[#dde1e9] text-[#0176d3] focus:ring-[#0176d3]"
              />
              <span className="text-xs font-semibold text-[#10233f]">Lock Grandfathered Price Protection</span>
            </label>
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
              <span>Save Subscription Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
