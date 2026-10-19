import React, { useState } from 'react';
import { Currency, Order } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { Package, CheckCircle2, Clock, Plus, Receipt, TrendingUp, ShieldCheck, Zap, Truck, Tag, Edit2 } from 'lucide-react';
import { EditOrderModal } from './EditOrderModal';

interface OrdersStudioProps {
  currency: Currency;
  orders: Order[];
  onGenerateInvoiceFromOrder: (order: Order) => void;
  onUpdateOrder?: (order: Order) => void;
}

export const OrdersStudio: React.FC<OrdersStudioProps> = ({ 
  currency,
  orders, 
  onGenerateInvoiceFromOrder,
  onUpdateOrder,
}) => {
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const totalOrdersValue = orders.reduce(
    (acc, ord) => acc + convertCurrency(ord.totalAmount, ord.currency, currency),
    0
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="rq-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                Orders 360 &amp; Fulfillment
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                Autonomous Provisioning
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-[#10233f] tracking-tight">
              Contract Fulfillment, Line Entitlements &amp; Billing Dispatch
            </h1>
            <p className="text-xs text-[#5c6678] mt-0.5">
              Activated customer orders synchronized automatically from Native eSign execution with zero manual re-entry.
            </p>
          </div>
        </div>
      </div>

      {/* Mini Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rq-card border-l-4 border-l-[#0176d3] p-3.5 sm:p-4 group hover:shadow-md transition-all">
          <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Total Activated Order Value</span>
          <div className="text-2xl font-extrabold font-mono text-[#10233f] mt-1 group-hover:text-[#015ba5] transition-colors">
            {formatCurrency(totalOrdersValue, currency)}
          </div>
          <span className="text-[11px] text-[#5c6678] mt-1 block">Across {orders.length} active customer orders</span>
        </div>

        <div className="rq-card border-l-4 border-l-emerald-600 p-3.5 sm:p-4 group hover:shadow-md transition-all">
          <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Fulfillment Status</span>
          <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-1 flex items-center gap-2">
            <span>100% Synced</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 rq-pulse-dot" />
          </div>
          <span className="text-[11px] text-[#5c6678] mt-1 block">0 Stuck or orphaned orders</span>
        </div>

        <div className="rq-card border-l-4 border-l-purple-600 p-3.5 sm:p-4 group hover:shadow-md transition-all">
          <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">Order-to-Billing Velocity</span>
          <div className="text-2xl font-extrabold font-mono text-purple-700 mt-1">
            &lt; 1 Second
          </div>
          <span className="text-[11px] text-[#5c6678] mt-1 block">Instant GST e-Invoice generation ready</span>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rq-card overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-[#dde1e9] flex items-center justify-between bg-[#fbfcfe]">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-[#0176d3]" />
            <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
              Activated Customer Orders &amp; Milestones
            </h2>
          </div>
          <span className="text-[11px] text-[#5c6678] font-semibold">
            {orders.length} Orders in system
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Order # &amp; PO</th>
                <th className="py-3 px-4">Customer Account</th>
                <th className="py-3 px-4">Source Quote</th>
                <th className="py-3 px-4">Order Type</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Fulfillment Status</th>
                <th className="py-3 px-4">Ordered Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f7]">
              {orders.map((ord) => {
                const convertedOrderAmt = convertCurrency(ord.totalAmount, ord.currency, currency);
                return (
                  <tr key={ord.id} className="hover:bg-[#f5f8fc] transition-colors duration-150 group">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-[#0176d3] group-hover:text-[#014486]">{ord.orderNumber}</div>
                      <div className="text-[10px] text-[#5c6678]">{ord.poNumber || 'PO-DIRECT-AUTO'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#181c25]">
                      <div>{ord.accountName}</div>
                      {ord.deliveryMilestone && (
                        <div className="text-[10px] text-[#5c6678] font-normal">{ord.deliveryMilestone}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#5c6678]">
                      {ord.quoteNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#015ba5] border border-blue-200">
                        {ord.orderType || 'New Deal'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#10233f]">
                      {formatCurrency(convertedOrderAmt, currency)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                        <CheckCircle2 size={11} />
                        <span>{ord.status}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#5c6678] font-mono text-[11px]">
                      {ord.orderedDate}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingOrder(ord)}
                          className="px-2.5 py-1 rounded bg-white hover:bg-blue-50 text-[#015ba5] text-[11px] font-semibold border border-[#dde1e9] hover:border-[#0176d3]/40 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Edit Order Attributes"
                        >
                          <Edit2 size={11} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => onGenerateInvoiceFromOrder(ord)}
                          className="rq-btn-primary py-1 px-2.5 text-[11px] cursor-pointer"
                        >
                          <Receipt size={12} />
                          <span>Generate Bill</span>
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

      {editingOrder && onUpdateOrder && (
        <EditOrderModal
          order={editingOrder}
          currency={currency}
          onClose={() => setEditingOrder(null)}
          onSave={onUpdateOrder}
        />
      )}
    </div>
  );
};
