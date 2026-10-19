import React, { useState } from 'react';
import { Contract, Currency } from '../../types';
import { X, Check, FileCheck2 } from 'lucide-react';

interface EditContractModalProps {
  contract: Contract;
  currency: Currency;
  onClose: () => void;
  onSave: (updatedContract: Contract) => void;
}

export const EditContractModal: React.FC<EditContractModalProps> = ({
  contract,
  currency,
  onClose,
  onSave,
}) => {
  const [accountName, setAccountName] = useState(contract.accountName);
  const [contractType, setContractType] = useState<Contract['contractType']>(contract.contractType || 'Master Service Agreement (MSA)');
  const [status, setStatus] = useState<Contract['status']>(contract.status);
  const [startDate, setStartDate] = useState(contract.startDate);
  const [endDate, setEndDate] = useState(contract.endDate);
  const [contractTermMonths, setContractTermMonths] = useState<number>(contract.contractTermMonths || 12);
  const [totalContractValue, setTotalContractValue] = useState<number>(contract.totalContractValue);
  const [autoRenew, setAutoRenew] = useState<boolean>(contract.autoRenew);
  const [governingLaw, setGoverningLaw] = useState(contract.governingLaw || 'Delaware, USA');
  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(contract.noticePeriodDays || 30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Contract = {
      ...contract,
      accountName,
      contractType,
      status,
      startDate,
      endDate,
      contractTermMonths,
      totalContractValue,
      autoRenew,
      governingLaw,
      noticePeriodDays,
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
              <FileCheck2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#10233f]">Edit Master Agreement</h2>
              <span className="text-xs font-mono font-bold text-[#015ba5]">{contract.contractNumber}</span>
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
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Contract Type</label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as Contract['contractType'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Master Service Agreement (MSA)">Master Service Agreement (MSA)</option>
                <option value="Service Level Agreement (SLA)">Service Level Agreement (SLA)</option>
                <option value="Data Processing Agreement (DPA)">Data Processing Agreement (DPA)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Contract Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Contract['status'])}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              >
                <option value="Draft">Draft</option>
                <option value="In Approval">In Approval</option>
                <option value="Activated">Activated</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Total Contract Value (TCV) *</label>
              <input
                type="number"
                min="0"
                required
                value={totalContractValue}
                onChange={(e) => setTotalContractValue(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Term (Months)</label>
              <input
                type="number"
                min="1"
                value={contractTermMonths}
                onChange={(e) => setContractTermMonths(parseInt(e.target.value) || 12)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Governing Jurisdiction</label>
              <input
                type="text"
                value={governingLaw}
                onChange={(e) => setGoverningLaw(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Notice Period (Days)</label>
              <input
                type="number"
                min="0"
                value={noticePeriodDays}
                onChange={(e) => setNoticePeriodDays(parseInt(e.target.value) || 30)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
                className="rounded border-[#dde1e9] text-[#0176d3] focus:ring-[#0176d3]"
              />
              <span className="text-xs font-semibold text-[#10233f]">Enable Automated Evergreen Renewal Policy</span>
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
              <span>Save Contract Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
