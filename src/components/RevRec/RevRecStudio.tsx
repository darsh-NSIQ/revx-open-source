import React, { useState } from 'react';
import { Currency, PerformanceObligation } from '../../types';
import { INITIAL_POBS } from '../../data/mockData';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  PieChart, 
  Layers, 
  Calendar, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  Scale, 
  ShieldCheck, 
  FileCheck2,
  Edit2
} from 'lucide-react';
import { EditPobModal } from './EditPobModal';

interface RevRecStudioProps {
  currency: Currency;
}

export const RevRecStudio: React.FC<RevRecStudioProps> = ({ currency }) => {
  const [pobs, setPobs] = useState<PerformanceObligation[]>(INITIAL_POBS);
  const [editingPob, setEditingPob] = useState<PerformanceObligation | null>(null);

  const handleSavePob = (updated: PerformanceObligation) => {
    setPobs((prev) => prev.map((p) => p.id === updated.id ? updated : p));
  };

  const totalAllocatedSSP = pobs.reduce((acc, p) => acc + convertCurrency(p.allocatedSSP, 'USD', currency), 0);
  const totalRecognized = pobs.reduce((acc, p) => acc + convertCurrency(p.recognizedRevenue, 'USD', currency), 0);
  const totalDeferred = pobs.reduce((acc, p) => acc + convertCurrency(p.deferredRevenue, 'USD', currency), 0);

  const recognizedRatio = totalAllocatedSSP > 0 ? (totalRecognized / totalAllocatedSSP) * 100 : 0;
  const deferredRatio = totalAllocatedSSP > 0 ? (totalDeferred / totalAllocatedSSP) * 100 : 0;

  const months = ['Nov 2026', 'Dec 2026', 'Jan 2027', 'Feb 2027', 'Mar 2027', 'Apr 2027'];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="rq-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                ASC 606 / IFRS 15 Revenue Recognition
              </span>
              <span className="text-xs text-[#5c6678] font-medium">Audit-Ready Ledger</span>
            </div>
            <h1 className="text-xl font-extrabold text-[#10233f] tracking-tight">
              Multi-Element Contracts, SSP Carving &amp; Amortization Waterfalls
            </h1>
            <p className="text-xs text-[#5c6678] mt-0.5">
              Automated 5-step revenue recognition compliant with US GAAP ASC 606 and international IFRS 15 standards.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards: Enterprise Telemetry Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Total SSP Allocated */}
        <div className="rq-card border-l-4 border-l-[#0176d3] p-4.5 group hover:shadow-md transition-all duration-200 bg-gradient-to-br from-blue-50/15 via-white to-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0176d3] border border-blue-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Scale size={14} />
                </div>
                <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">
                  Total SSP Allocated
                </span>
              </div>
              <span className="text-[10px] font-bold bg-[#eef4ff] text-[#015ba5] px-2 py-0.5 rounded-full border border-[#0176d3]/20 font-mono">
                3 POBs
              </span>
            </div>

            <div className="mt-2 text-2xl lg:text-[26px] font-extrabold font-mono text-[#10233f] tracking-tight group-hover:text-[#015ba5] transition-colors">
              {formatCurrency(totalAllocatedSSP, currency)}
            </div>

            {/* Split Progress Bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] text-[#5c6678] font-medium">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Recognized: {recognizedRatio.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Deferred: {deferredRatio.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#f0f3f8] overflow-hidden flex border border-[#dde1e9]">
                <div 
                  style={{ width: `${recognizedRatio}%` }} 
                  className="bg-emerald-500 h-full transition-all duration-500" 
                  title={`Recognized: ${recognizedRatio.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${deferredRatio}%` }} 
                  className="bg-amber-400 h-full transition-all duration-500" 
                  title={`Deferred: ${deferredRatio.toFixed(1)}%`}
                />
              </div>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-[#edf1f7] flex items-center justify-between text-[10.5px] text-[#747e90]">
            <span className="font-medium">Step 4 Standalone Price Allocation</span>
            <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">Clean Audit</span>
          </div>
        </div>

        {/* Card 2: Recognized Revenue (MTD) */}
        <div className="rq-card border-l-4 border-l-emerald-600 p-4.5 group hover:shadow-md transition-all duration-200 bg-gradient-to-br from-emerald-50/15 via-white to-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <TrendingUp size={14} />
                </div>
                <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">
                  Recognized (MTD)
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 rq-pulse-dot" />
                Realized P&amp;L
              </span>
            </div>

            <div className="mt-2 text-2xl lg:text-[26px] font-extrabold font-mono text-emerald-700 tracking-tight">
              {formatCurrency(totalRecognized, currency)}
            </div>

            {/* Realization Progress Bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] text-[#5c6678] font-medium">
                <span>Contract Performance Progress</span>
                <span className="font-bold text-emerald-700 font-mono">{recognizedRatio.toFixed(1)}% Earned</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#f0f3f8] overflow-hidden border border-[#dde1e9]">
                <div 
                  style={{ width: `${recognizedRatio}%` }} 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                />
              </div>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-[#edf1f7] flex items-center justify-between text-[10.5px] text-[#747e90]">
            <span className="font-medium">Amortized by delivery milestone</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-500/20">Ledger Posted</span>
          </div>
        </div>

        {/* Card 3: Deferred Revenue Balance */}
        <div className="rq-card border-l-4 border-l-amber-500 p-4.5 group hover:shadow-md transition-all duration-200 bg-gradient-to-br from-amber-50/15 via-white to-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Clock size={14} />
                </div>
                <span className="text-[11px] font-bold text-[#5c6678] uppercase tracking-wider">
                  Deferred Balance
                </span>
              </div>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                Unearned Liability
              </span>
            </div>

            <div className="mt-2 text-2xl lg:text-[26px] font-extrabold font-mono text-amber-800 tracking-tight">
              {formatCurrency(totalDeferred, currency)}
            </div>

            {/* Deferred Ratio Progress Bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] text-[#5c6678] font-medium">
                <span>Contract Liability Remaining</span>
                <span className="font-bold text-amber-800 font-mono">{deferredRatio.toFixed(1)}% Active</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#f0f3f8] overflow-hidden border border-[#dde1e9]">
                <div 
                  style={{ width: `${deferredRatio}%` }} 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                />
              </div>
            </div>
          </div>

          <div className="mt-3.5 pt-2.5 border-t border-[#edf1f7] flex items-center justify-between text-[10.5px] text-[#747e90]">
            <span className="font-medium">12-Month Straight-Line Amortization</span>
            <span className="font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-500/20">ASC 606 Liab.</span>
          </div>
        </div>
      </div>

      {/* Performance Obligations Table */}
      <div className="rq-card overflow-hidden">
        <div className="p-4 border-b border-[#dde1e9] flex items-center justify-between bg-[#fbfcfe]">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#0176d3]" />
            <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
              Performance Obligations (POB) &amp; SSP Allocations
            </h2>
          </div>
          <span className="text-[11px] text-[#5c6678] font-semibold">5-Step Revenue Model Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Performance Obligation</th>
                <th className="py-3 px-4">Recognition Rule</th>
                <th className="py-3 px-4">SSP Allocation</th>
                <th className="py-3 px-4">Recognized</th>
                <th className="py-3 px-4">Deferred Balance</th>
                <th className="py-3 px-4">Schedule Period</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f7]">
              {pobs.map((pob) => {
                const sspConverted = convertCurrency(pob.allocatedSSP, 'USD', currency);
                const recConverted = convertCurrency(pob.recognizedRevenue, 'USD', currency);
                const defConverted = convertCurrency(pob.deferredRevenue, 'USD', currency);
                return (
                  <tr key={pob.id} className="hover:bg-[#f5f8fc] transition-colors duration-150">
                    <td className="py-3.5 px-4 font-bold text-[#181c25]">
                      {pob.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[#eef4ff] text-[#015ba5] border border-[#0176d3]/20">
                        {pob.recognitionMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#10233f]">
                      {formatCurrency(sspConverted, currency)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold">
                      {formatCurrency(recConverted, currency)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-amber-800 font-semibold">
                      {formatCurrency(defConverted, currency)}
                    </td>
                    <td className="py-3.5 px-4 text-[#5c6678] font-mono text-[11px]">
                      {pob.startDate} → {pob.endDate}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setEditingPob(pob)}
                        className="px-2.5 py-1 rounded bg-white hover:bg-blue-50 text-[#015ba5] text-xs font-semibold border border-[#dde1e9] hover:border-[#0176d3]/40 transition-all shadow-2xs flex items-center gap-1 ml-auto cursor-pointer"
                        title="Edit Performance Obligation"
                      >
                        <Edit2 size={11} />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Revenue Amortization Waterfall Table */}
      <div className="rq-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#edf1f7] pb-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-emerald-700" />
            <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
              12-Month Revenue Waterfall Forecast
            </h2>
          </div>
          <span className="text-[11px] text-[#5c6678] font-mono font-semibold">ASC 606 Amortization</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-[#dde1e9] rounded-lg overflow-hidden min-w-[950px]">
            <thead className="bg-[#f8fafc] text-[#5c6678] font-bold text-[10px] uppercase border-b border-[#dde1e9]">
              <tr>
                <th className="py-3 px-3.5 border-r border-[#dde1e9]">Contract / POB</th>
                {months.map((m, idx) => (
                  <th key={idx} className="py-3 px-3.5 text-right font-mono">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f7] font-mono text-[11px]">
              <tr className="hover:bg-[#f5f8fc]">
                <td className="py-3 px-3.5 font-sans font-bold text-[#181c25] border-r border-[#dde1e9]">
                  SaaS Platform License
                </td>
                {months.map((_, i) => (
                  <td key={i} className="py-3 px-3.5 text-right text-emerald-700 font-semibold">
                    {formatCurrency(convertCurrency(1458.33, 'USD', currency), currency)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-[#f5f8fc]">
                <td className="py-3 px-3.5 font-sans font-bold text-[#181c25] border-r border-[#dde1e9]">
                  Native eSign Module
                </td>
                {months.map((_, i) => (
                  <td key={i} className="py-3 px-3.5 text-right text-emerald-700 font-semibold">
                    {formatCurrency(convertCurrency(416.66, 'USD', currency), currency)}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-[#f5f8fc]">
                <td className="py-3 px-3.5 font-sans font-bold text-[#181c25] border-r border-[#dde1e9]">
                  Implementation (Point-in-Time)
                </td>
                <td className="py-3 px-3.5 text-right text-emerald-700 font-extrabold">
                  {formatCurrency(convertCurrency(2500, 'USD', currency), currency)}
                </td>
                {months.slice(1).map((_, i) => (
                  <td key={i} className="py-3 px-3.5 text-right text-[#94a3b8]">
                    {formatCurrency(0, currency)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {editingPob && (
        <EditPobModal
          pob={editingPob}
          currency={currency}
          onClose={() => setEditingPob(null)}
          onSave={handleSavePob}
        />
      )}
    </div>
  );
};
