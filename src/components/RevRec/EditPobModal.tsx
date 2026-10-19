import React, { useState } from 'react';
import { PerformanceObligation, Currency } from '../../types';
import { X, Check, Layers } from 'lucide-react';

interface EditPobModalProps {
  pob: PerformanceObligation;
  currency: Currency;
  onClose: () => void;
  onSave: (updatedPob: PerformanceObligation) => void;
}

export const EditPobModal: React.FC<EditPobModalProps> = ({
  pob,
  currency,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(pob.name);
  const [recognitionMethod, setRecognitionMethod] = useState<PerformanceObligation['recognitionMethod']>(pob.recognitionMethod);
  const [allocatedSSP, setAllocatedSSP] = useState<number>(pob.allocatedSSP);
  const [recognizedRevenue, setRecognizedRevenue] = useState<number>(pob.recognizedRevenue);
  const [deferredRevenue, setDeferredRevenue] = useState<number>(pob.deferredRevenue);
  const [startDate, setStartDate] = useState(pob.startDate);
  const [endDate, setEndDate] = useState(pob.endDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: PerformanceObligation = {
      ...pob,
      name,
      recognitionMethod,
      allocatedSSP,
      transactionPrice: allocatedSSP,
      recognizedRevenue,
      deferredRevenue,
      startDate,
      endDate,
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
              <h2 className="text-base font-extrabold text-[#10233f]">Edit Performance Obligation (ASC 606)</h2>
              <span className="text-xs font-mono font-bold text-[#015ba5]">{pob.id}</span>
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
            <label className="block text-[11px] font-bold text-[#10233f] mb-1">Obligation Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#10233f] mb-1">ASC 606 Recognition Method *</label>
            <select
              value={recognitionMethod}
              onChange={(e) => setRecognitionMethod(e.target.value as PerformanceObligation['recognitionMethod'])}
              className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white"
            >
              <option value="Over Time (Ratable)">Over Time (Ratable / Straight-Line)</option>
              <option value="Point in Time">Point in Time (Milestone / Delivery)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Allocated SSP (USD) *</label>
              <input
                type="number"
                min="0"
                required
                value={allocatedSSP}
                onChange={(e) => {
                  const ssp = parseFloat(e.target.value) || 0;
                  setAllocatedSSP(ssp);
                  setDeferredRevenue(Math.max(0, ssp - recognizedRevenue));
                }}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Recognized (USD)</label>
              <input
                type="number"
                min="0"
                value={recognizedRevenue}
                onChange={(e) => {
                  const rec = parseFloat(e.target.value) || 0;
                  setRecognizedRevenue(rec);
                  setDeferredRevenue(Math.max(0, allocatedSSP - rec));
                }}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Deferred (USD)</label>
              <input
                type="number"
                min="0"
                value={deferredRevenue}
                onChange={(e) => setDeferredRevenue(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Schedule Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-2 text-xs text-[#10233f] focus:outline-none focus:border-[#0176d3] focus:bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#10233f] mb-1">Schedule End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
              <span>Save POB Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
