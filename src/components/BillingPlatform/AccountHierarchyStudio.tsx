import React, { useState } from 'react';
import { Currency, AccountHierarchyNode, DynamicRatingModel } from '../../types';
import { INITIAL_ACCOUNT_HIERARCHY, INITIAL_DYNAMIC_RATING_MODELS } from '../../data/mockData';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  Network, 
  Building2, 
  Globe2, 
  Receipt, 
  Layers, 
  Activity, 
  Sliders, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  ArrowRight, 
  Zap, 
  DollarSign, 
  Check, 
  RefreshCw,
  Clock,
  ShieldCheck
} from 'lucide-react';

interface AccountHierarchyStudioProps {
  currency: Currency;
}

export const AccountHierarchyStudio: React.FC<AccountHierarchyStudioProps> = ({ currency }) => {
  const [rootNode, setRootNode] = useState<AccountHierarchyNode>(INITIAL_ACCOUNT_HIERARCHY);
  const [activeSubTab, setActiveSubTab] = useState<'hierarchy' | 'rating'>('hierarchy');
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([
    'node-corp-1',
    'node-na-1',
    'node-emea-1',
  ]);
  const [selectedNode, setSelectedNode] = useState<AccountHierarchyNode>(rootNode);

  // Dynamic Rating Simulator State
  const [selectedRatingModel, setSelectedRatingModel] = useState<DynamicRatingModel>(
    INITIAL_DYNAMIC_RATING_MODELS[0]
  );
  const [simulatedUnits, setSimulatedUnits] = useState<number>(350000);
  const [simulatedIsPeak, setSimulatedIsPeak] = useState<boolean>(true);

  const toggleNodeExpand = (id: string) => {
    if (expandedNodeIds.includes(id)) {
      setExpandedNodeIds(expandedNodeIds.filter((nodeId) => nodeId !== id));
    } else {
      setExpandedNodeIds([...expandedNodeIds, id]);
    }
  };

  // Toggle Billing Mode (Consolidated vs Split)
  const toggleBillingMode = (nodeId: string) => {
    const updateRecursive = (node: AccountHierarchyNode): AccountHierarchyNode => {
      if (node.id === nodeId) {
        const nextMode = 
          node.billingMode === 'Consolidated Parent Invoicing'
            ? 'Split Subsidiary Invoicing'
            : 'Consolidated Parent Invoicing';
        return { ...node, billingMode: nextMode };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(updateRecursive),
        };
      }
      return node;
    };

    const updated = updateRecursive(rootNode);
    setRootNode(updated);
    if (selectedNode.id === nodeId) {
      setSelectedNode((prev) => ({
        ...prev,
        billingMode:
          prev.billingMode === 'Consolidated Parent Invoicing'
            ? 'Split Subsidiary Invoicing'
            : 'Consolidated Parent Invoicing',
      }));
    }
  };

  // Compute Rated Amount for Sandbox
  const calculateRatedAmount = () => {
    if (selectedRatingModel.ratingStrategy === 'Graduated Tiered Slabs' && selectedRatingModel.slabs) {
      let remaining = simulatedUnits;
      let totalCost = 0;
      for (const slab of selectedRatingModel.slabs) {
        const slabCapacity = slab.maxUnits - slab.minUnits;
        const unitsInSlab = Math.min(remaining, slabCapacity);
        if (unitsInSlab > 0) {
          totalCost += unitsInSlab * slab.rateUSD;
          remaining -= unitsInSlab;
        }
      }
      return convertCurrency(totalCost, 'USD', currency);
    }

    if (selectedRatingModel.ratingStrategy === 'Peak / Off-Peak Time-of-Day') {
      const multiplier = simulatedIsPeak
        ? (selectedRatingModel.peakMultiplier || 1.5)
        : (selectedRatingModel.offPeakMultiplier || 0.7);
      const cost = simulatedUnits * selectedRatingModel.baseRateUSD * multiplier;
      return convertCurrency(cost, 'USD', currency);
    }

    // Default attribute-based
    const cost = simulatedUnits * selectedRatingModel.baseRateUSD;
    return convertCurrency(cost, 'USD', currency);
  };

  const calculatedSandboxAmount = calculateRatedAmount();

  // Recursive Tree Renderer
  const renderTreeNode = (node: AccountHierarchyNode, level = 0) => {
    const isExpanded = expandedNodeIds.includes(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNode.id === node.id;
    const convACV = convertCurrency(node.annualContractValue, node.currency, currency);

    return (
      <div key={node.id} className="space-y-1">
        <div
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          className={`py-2.5 pr-3 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
            isSelected
              ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/40 shadow-2xs font-semibold'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
          onClick={() => setSelectedNode(node)}
        >
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeExpand(node.id);
                }}
                className="w-5 h-5 flex items-center justify-center text-[#5c6678] hover:text-[#181c25]"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-5" />
            )}

            <Building2 size={15} className={level === 0 ? 'text-indigo-600' : 'text-slate-500'} />
            <div>
              <span className="font-bold text-[#10233f]">{node.accountName}</span>
              <span className="text-[10px] text-[#5c6678] ml-2">({node.country})</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-[#10233f]">
              {formatCurrency(convACV, currency)}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              node.billingMode === 'Consolidated Parent Invoicing'
                ? 'bg-blue-50 text-blue-700 border border-blue-500/20'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-500/20'
            }`}>
              {node.billingMode === 'Consolidated Parent Invoicing' ? 'Consolidated HQ' : 'Split Local'}
            </span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children!.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-xl border border-[#dde1e9] p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#4f46e5] to-[#6366f1] text-white flex items-center justify-center shadow-xs shrink-0">
              <Network size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-[#10233f]">
                  BillingPlatform™ Account Hierarchy &amp; Dynamic Rating Engine
                </h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-500/25">
                  BillingPlatform Parity + Superset
                </span>
              </div>
              <p className="text-xs text-[#5c6678] mt-0.5">
                Model complex multi-entity parent-child organizational hierarchies with consolidated or split invoicing, plus advanced graduated and peak/off-peak rating models.
              </p>
            </div>
          </div>

          {/* Sub-view switcher */}
          <div className="flex items-center gap-2 bg-[#f8fafc] border border-[#dde1e9] rounded-lg p-1">
            <button
              onClick={() => setActiveSubTab('hierarchy')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'hierarchy'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-[#dde1e9]'
                  : 'text-[#5c6678] hover:text-[#181c25]'
              }`}
            >
              <Network size={13} />
              <span>Multi-Entity Hierarchy</span>
            </button>
            <button
              onClick={() => setActiveSubTab('rating')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'rating'
                  ? 'bg-white text-indigo-700 shadow-2xs border border-[#dde1e9]'
                  : 'text-[#5c6678] hover:text-[#181c25]'
              }`}
            >
              <Activity size={13} />
              <span>Dynamic Rating Models</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-view 1: Multi-Entity Hierarchy Tree */}
      {activeSubTab === 'hierarchy' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Tree Structure */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#dde1e9] p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f] flex items-center gap-2">
                  <Globe2 size={15} className="text-indigo-600" />
                  <span>Enterprise Organization Chart</span>
                </h3>
                <p className="text-[11px] text-[#5c6678] mt-0.5">
                  Click any entity node to inspect billing profiles, tax identifiers, and invoicing policies.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                Total Rollup: {formatCurrency(convertCurrency(rootNode.annualContractValue, rootNode.currency, currency), currency)}
              </span>
            </div>

            <div className="space-y-2">
              {renderTreeNode(rootNode)}
            </div>
          </div>

          {/* Node Inspector & Billing Policy */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-[#dde1e9] p-5 shadow-2xs space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Entity Configuration Inspector
              </span>
              <h2 className="text-base font-extrabold text-[#10233f] mt-1">
                {selectedNode.accountName}
              </h2>
              <div className="text-xs text-[#5c6678]">
                {selectedNode.nodeType} · {selectedNode.country}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#f8fafc] rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Tax / Entity Registration:</span>
                  <span className="font-mono font-bold text-[#181c25]">{selectedNode.taxRegistrationNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Reporting Region:</span>
                  <span className="font-bold text-[#181c25]">{selectedNode.region}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5c6678]">Annual Contract Spend:</span>
                  <span className="font-mono font-extrabold text-indigo-700">
                    {formatCurrency(convertCurrency(selectedNode.annualContractValue, selectedNode.currency, currency), currency)}
                  </span>
                </div>
              </div>

              {/* Invoicing Mode Selector (BillingPlatform Signature Feature) */}
              <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50/40 to-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#10233f]">
                    Invoicing Aggregation Policy
                  </div>
                  <span className="text-[10px] font-mono font-bold text-indigo-700">
                    {selectedNode.billingMode}
                  </span>
                </div>

                <p className="text-[11px] text-[#5c6678] leading-relaxed">
                  {selectedNode.billingMode === 'Consolidated Parent Invoicing'
                    ? 'All charges across this subsidiary roll up directly into the Parent Holding HQ master invoice each month.'
                    : 'This subsidiary generates its own independent invoice with local statutory tax compliance (VAT / GST).'}
                </p>

                <button
                  type="button"
                  onClick={() => toggleBillingMode(selectedNode.id)}
                  className="w-full py-2 rounded-lg bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-700 text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>
                    Switch to {selectedNode.billingMode === 'Consolidated Parent Invoicing' ? 'Split Subsidiary Invoicing' : 'Consolidated Parent Invoicing'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-view 2: Dynamic Rating Models & Event Rating Sandbox */}
      {activeSubTab === 'rating' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Rating Models Catalog */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-[#dde1e9] p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f] mb-2 flex items-center gap-2">
              <Zap size={15} className="text-indigo-600" />
              <span>Available Dynamic Rating Strategies</span>
            </h3>

            <div className="space-y-3">
              {INITIAL_DYNAMIC_RATING_MODELS.map((model) => {
                const isSelected = model.id === selectedRatingModel.id;
                return (
                  <div
                    key={model.id}
                    onClick={() => setSelectedRatingModel(model)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-2xs'
                        : 'border-[#dde1e9] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-[#10233f]">{model.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        {model.metricKey}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#5c6678] mt-1.5 leading-relaxed">
                      {model.description}
                    </p>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-[#5c6678]">Base Unit Rate:</span>
                      <span className="font-mono font-bold text-indigo-700">
                        ${model.baseRateUSD} / unit
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-Time Rating Sandbox Simulator */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#dde1e9] p-5 sm:p-6 shadow-2xs space-y-6">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  Rating Sandbox &amp; Mediation Simulator
                </span>
                <h3 className="text-base font-extrabold text-[#10233f] mt-0.5">
                  {selectedRatingModel.name}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                Live Formula Rating
              </span>
            </div>

            {/* Strategy Specific Details */}
            {selectedRatingModel.ratingStrategy === 'Graduated Tiered Slabs' && selectedRatingModel.slabs && (
              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-2">
                  Graduated Discount Slabs Structure:
                </label>
                <div className="space-y-1.5">
                  {selectedRatingModel.slabs.map((slab, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                      <span className="font-semibold text-[#181c25]">{slab.label}</span>
                      <span className="font-mono font-bold text-indigo-700">${slab.rateUSD} / unit</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedRatingModel.ratingStrategy === 'Peak / Off-Peak Time-of-Day' && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-600" />
                  <span>Time-of-Day Multiplier Rule Active</span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-amber-900">
                  <span>Peak Hours (09:00 - 18:00): <strong>1.5x Rate</strong></span>
                  <span>Off-Peak Night / Weekend: <strong>0.7x Rate (30% Discount)</strong></span>
                </div>
              </div>
            )}

            {/* Input Controls */}
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-[#10233f] mb-1.5">
                  <span>Simulated Consumption Units:</span>
                  <span className="font-mono text-indigo-700 font-extrabold text-sm">
                    {simulatedUnits.toLocaleString()} Units
                  </span>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={2000000}
                  step={25000}
                  value={simulatedUnits}
                  onChange={(e) => setSimulatedUnits(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
                />
              </div>

              {selectedRatingModel.ratingStrategy === 'Peak / Off-Peak Time-of-Day' && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#10233f]">Simulated Window:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSimulatedIsPeak(true)}
                      className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                        simulatedIsPeak
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-[#5c6678]'
                      }`}
                    >
                      Peak Hours (1.5x)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulatedIsPeak(false)}
                      className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                        !simulatedIsPeak
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-[#5c6678]'
                      }`}
                    >
                      Off-Peak Night (0.7x)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Calculated Output Banner */}
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-[#1e1b4b] text-white rounded-xl shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-300">
                  Mediated &amp; Rated Invoiced Amount
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {formatCurrency(calculatedSandboxAmount, currency)}
                </div>
                <p className="text-[11px] text-indigo-200 mt-1">
                  Zero rounding error · Audit hash ready for ledger posting
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/20 text-white border border-white/20">
                  Real-Time Rated
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
