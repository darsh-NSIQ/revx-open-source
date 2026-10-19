import React, { useState } from 'react';
import { Order, Currency } from '../../types';
import { X, Check, Package } from 'lucide-react';

interface EditOrderModalProps {
  order: Order;
  currency: Currency;
  onClose: () => void;
  onSave: (updatedOrder: Order) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  order,
  currency,
  onClose,
  onSave,
}) => {
  const [accountName, setAccountName] = useState(order.accountName);
  const [poNumber, setPoNumber] = useState(order.poNumber || 'PO-DIRECT-AUTO');
  const [orderType, setOrderType] = useState<Order['orderType']>(order.orderType || 'New');
  const [status, setStatus] = useState<Order['status']>(order.status);
  const [fulfillmentStatus, setFulfillmentStatus] = useState<Order['fulfillmentStatus']>(order.fulfillmentStatus || 'Active');
  const [totalAmount, setTotalAmount] = useState<number>(order.totalAmount);
  const [orderedDate, setOrderedDate] = useState(order.orderedDate);
  const [deliveryMilestone, setDeliveryMilestone] = useState(order.deliveryMilestone || '100% Provisioned & Entitlements Dispatched');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Order = {
      ...order,
      accountName,
      poNumber,
      orderType,
      status,
      fulfillmentStatus,
      totalAmount,
      orderedDate,
      deliveryMilestone,
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
              <Package size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#10233f]">Edit Order Details</h2>
              <span className="text-xs font-mono font-bold text-[#015ba5]">{order.orderNumber}</span>
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
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Customer Purchase Order (PO #)</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Order Type</label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as Order['orderType'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="New">New Deal</option>
                <option value="Renewal">Renewal</option>
                <option value="Amendment">Amendment</option>
                <option value="Upsell">Upsell / Expansion</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Order Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Order['status'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Draft">Draft</option>
                <option value="Activated">Activated</option>
                <option value="Fulfilled">Fulfilled</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Fulfillment Status</label>
              <select
                value={fulfillmentStatus}
                onChange={(e) => setFulfillmentStatus(e.target.value as Order['fulfillmentStatus'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Active">Active &amp; Provisioned</option>
                <option value="Pending">Pending Fulfillment</option>
                <option value="Provisioned">Fully Provisioned</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Total Order Amount ({order.currency}) *</label>
              <input
                type="number"
                min="0"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Ordered Date</label>
              <input
                type="date"
                value={orderedDate}
                onChange={(e) => setOrderedDate(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#10233f] mb-1">Delivery / Fulfillment Milestone</label>
            <input
              type="text"
              value={deliveryMilestone}
              onChange={(e) => setDeliveryMilestone(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
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
              <span>Save Order Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
