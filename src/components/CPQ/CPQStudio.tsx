import React, { useState } from 'react';
import { Currency, Product, Quote, QuoteLineItem, RampInterval } from '../../types';
import { INITIAL_PRODUCTS, INITIAL_GUIDED_QUESTIONS, INITIAL_CONSTRAINT_RULES } from '../../data/mockData';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  Sparkles, 
  Layers, 
  Sliders, 
  CheckCircle2, 
  Send, 
  TrendingUp,
  Percent,
  Check,
  ShieldCheck,
  Package,
  CalendarRange,
  Clock,
  ArrowRight,
  AlertTriangle,
  X,
  Compass,
  Zap
} from 'lucide-react';

interface CPQStudioProps {
  currency: Currency;
  quotes: Quote[];
  onAddQuote: (newQuote: Quote) => void;
  onOpenSignModal: (quote: Quote) => void;
  initialOpportunity?: {
    id: string;
    name: string;
    accountName: string;
    contactName?: string;
    contactEmail?: string;
  } | null;
}

export const CPQStudio: React.FC<CPQStudioProps> = ({ 
  currency, 
  quotes, 
  onAddQuote,
  onOpenSignModal,
  initialOpportunity
}) => {
  // Quote Builder State
  const [accountName, setAccountName] = useState(
    initialOpportunity?.accountName || 'Acme Global Enterprises'
  );
  const [contactName, setContactName] = useState(
    initialOpportunity?.contactName || 'David Miller'
  );
  const [contactEmail, setContactEmail] = useState(
    initialOpportunity?.contactEmail || 'david.miller@acmeglobal.com'
  );
  const [opportunityName, setOpportunityName] = useState(
    initialOpportunity?.name || 'Enterprise SaaS Modernization'
  );
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(['prod-1', 'prod-2']);
  const [quantities, setQuantities] = useState<Record<string, number>>({
    'prod-1': 12,
    'prod-2': 12,
    'prod-3': 12,
    'prod-4': 50000,
    'prod-5': 1,
  });
  const [discounts, setDiscounts] = useState<Record<string, number>>({
    'prod-1': 10,
    'prod-2': 10,
    'prod-3': 5,
    'prod-4': 0,
    'prod-5': 0,
  });

  const toggleProduct = (prodId: string) => {
    if (selectedProductIds.includes(prodId)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== prodId));
    } else {
      setSelectedProductIds([...selectedProductIds, prodId]);
    }
  };

  // Calculations
  const lineItems = selectedProductIds.map((pId) => {
    const prod = INITIAL_PRODUCTS.find((p) => p.id === pId)!;
    const qty = quantities[pId] || 1;
    const discPct = discounts[pId] || 0;
    
    const unitPrice = convertCurrency(prod.basePrice, 'USD', currency);
    const cogsUnit = convertCurrency(prod.cogs, 'USD', currency);

    const grossPrice = unitPrice * qty;
    const discountAmt = grossPrice * (discPct / 100);
    const finalPrice = grossPrice - discountAmt;
    const totalCogs = cogsUnit * qty;
    const marginPct = finalPrice > 0 ? ((finalPrice - totalCogs) / finalPrice) * 100 : 0;

    return {
      product: prod,
      quantity: qty,
      unitPrice,
      discountPct: discPct,
      grossPrice,
      discountAmt,
      finalPrice,
      marginPct,
    };
  });

  const subtotal = lineItems.reduce((acc, item) => acc + item.grossPrice, 0);
  const totalDiscount = lineItems.reduce((acc, item) => acc + item.discountAmt, 0);
  const discountedSubtotal = subtotal - totalDiscount;
  const taxRate = currency === 'INR' ? 0.18 : 0.08;
  const totalTax = discountedSubtotal * taxRate;
  const grandTotal = discountedSubtotal + totalTax;

  const totalCost = lineItems.reduce((acc, item) => acc + convertCurrency(item.product.cogs, 'USD', currency) * item.quantity, 0);
  const blendedMargin = grandTotal > 0 ? ((discountedSubtotal - totalCost) / discountedSubtotal) * 100 : 0;

  const getAdvisorScore = () => {
    if (blendedMargin >= 75) return { status: 'Optimal', score: 96, color: 'text-emerald-700 bg-emerald-50 border-emerald-500/25' };
    if (blendedMargin >= 65) return { status: 'Acceptable', score: 82, color: 'text-amber-800 bg-amber-50 border-amber-500/25' };
    return { status: 'Approval Required', score: 54, color: 'text-[#ba0517] bg-[#fef5f5] border-[#ba0517]/25' };
  };
  const advisor = getAdvisorScore();

  // Oracle CPQ Guided Selling & Approval Tier Prediction
  const [isGuidedSellingOpen, setIsGuidedSellingOpen] = useState<boolean>(false);
  const [guidedStep, setGuidedStep] = useState<number>(1);

  const maxDiscountPct = Math.max(...lineItems.map((li) => li.discountPct), 0);
  const getApprovalTier = () => {
    if (maxDiscountPct > 40) return { level: 3, role: 'CFO / CEO Clearance (>40%)', color: 'text-rose-700 bg-rose-50 border-rose-500/25' };
    if (maxDiscountPct > 25) return { level: 2, role: 'VP Finance Approval (25-40%)', color: 'text-amber-800 bg-amber-50 border-amber-500/25' };
    if (maxDiscountPct > 15) return { level: 1, role: 'Sales Director Approval (15-25%)', color: 'text-blue-700 bg-blue-50 border-blue-500/25' };
    return { level: 0, role: 'Auto-Approved (<15%)', color: 'text-emerald-700 bg-emerald-50 border-emerald-500/25' };
  };
  const approvalTier = getApprovalTier();

  // Constraint Rule: Usage Metering (prod-4) requires Core Platform (prod-1)
  const hasConstraintViolation = selectedProductIds.includes('prod-4') && !selectedProductIds.includes('prod-1');

  const handleApplyGuidedBundle = (productIds: string[], discPct: number) => {
    setSelectedProductIds(productIds);
    const newDiscounts: Record<string, number> = {};
    productIds.forEach((pid) => {
      newDiscounts[pid] = discPct;
    });
    setDiscounts((prev) => ({ ...prev, ...newDiscounts }));
    setIsGuidedSellingOpen(false);
  };

  // Zuora CPQ Style Multi-Year Ramp Deal Configuration
  const [isRampDeal, setIsRampDeal] = useState<boolean>(false);
  const [rampSeats, setRampSeats] = useState<{ y1: number; y2: number; y3: number }>({
    y1: 50,
    y2: 120,
    y3: 250,
  });
  const [rampDiscounts, setRampDiscounts] = useState<{ y1: number; y2: number; y3: number }>({
    y1: 25,
    y2: 15,
    y3: 5,
  });

  const baseProductMonthly = convertCurrency(INITIAL_PRODUCTS[0].basePrice, 'USD', currency);
  const baseProductAnnual = baseProductMonthly * 12;

  const y1Gross = rampSeats.y1 * baseProductAnnual;
  const y1Discount = y1Gross * (rampDiscounts.y1 / 100);
  const y1Net = y1Gross - y1Discount;

  const y2Gross = rampSeats.y2 * baseProductAnnual;
  const y2Discount = y2Gross * (rampDiscounts.y2 / 100);
  const y2Net = y2Gross - y2Discount;

  const y3Gross = rampSeats.y3 * baseProductAnnual;
  const y3Discount = y3Gross * (rampDiscounts.y3 / 100);
  const y3Net = y3Gross - y3Discount;

  const rampTotalTCV = y1Net + y2Net + y3Net;
  const rampTotalDiscount = y1Discount + y2Discount + y3Discount;
  const rampTotalGross = y1Gross + y2Gross + y3Gross;

  const rampIntervals: RampInterval[] = [
    {
      year: 1,
      periodLabel: 'Year 1 (Initial Adoption Ramp)',
      startDate: '2026-11-01',
      endDate: '2027-10-31',
      committedSeats: rampSeats.y1,
      unitPrice: baseProductAnnual,
      discountPct: rampDiscounts.y1,
      subtotal: y1Gross,
      annualARR: y1Net,
    },
    {
      year: 2,
      periodLabel: 'Year 2 (Company-Wide Rollout)',
      startDate: '2027-11-01',
      endDate: '2028-10-31',
      committedSeats: rampSeats.y2,
      unitPrice: baseProductAnnual,
      discountPct: rampDiscounts.y2,
      subtotal: y2Gross,
      annualARR: y2Net,
    },
    {
      year: 3,
      periodLabel: 'Year 3 (Global Scale Commitment)',
      startDate: '2028-11-01',
      endDate: '2029-10-31',
      committedSeats: rampSeats.y3,
      unitPrice: baseProductAnnual,
      discountPct: rampDiscounts.y3,
      subtotal: y3Gross,
      annualARR: y3Net,
    },
  ];

  const finalSubtotal = isRampDeal ? rampTotalGross : subtotal;
  const finalDiscountTotal = isRampDeal ? rampTotalDiscount : totalDiscount;
  const finalDiscountedSubtotal = isRampDeal ? rampTotalTCV : discountedSubtotal;
  const finalTaxTotal = finalDiscountedSubtotal * taxRate;
  const finalGrandTotal = finalDiscountedSubtotal + finalTaxTotal;

  const handleCreateAndSend = () => {
    const qNumber = `Q-00${quotes.length + 104}`;
    const token = `tok_live_${Math.random().toString(36).substring(2, 12)}`;

    const newQuote: Quote = {
      id: `quote-${Date.now()}`,
      quoteNumber: qNumber,
      accountName,
      contactName,
      contactEmail,
      opportunityName,
      status: 'Sent',
      currency,
      subtotal: finalSubtotal,
      discountTotal: finalDiscountTotal,
      taxTotal: finalTaxTotal,
      totalAmount: finalGrandTotal,
      marginPct: isRampDeal ? 79.4 : blendedMargin,
      createdAt: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      portalToken: token,
      rampIntervals: isRampDeal ? rampIntervals : undefined,
      items: lineItems.map((li) => ({
        id: `li-${Math.random().toString(36).substring(2, 6)}`,
        productId: li.product.id,
        productName: li.product.name,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        discountPct: li.discountPct,
        totalPrice: li.finalPrice,
        marginPct: li.marginPct,
      })),
    };

    onAddQuote(newQuote);
    onOpenSignModal(newQuote);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Highlights Panel (Salesforce Standard) */}
      <div className="rq-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20">
                CPQ &amp; Quote 360 Studio
              </span>
              <span className="text-xs text-[#5c6678]">Interactive Pricing Rules</span>
            </div>
            <h1 className="text-xl font-extrabold text-[#10233f] tracking-tight">
              Enterprise Bundle Configuration &amp; Margin Modeling
            </h1>
            <p className="text-xs text-[#5c6678] mt-0.5">
              Live discount governance, automated approvals, and instant eSign document generation.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setGuidedStep(1);
                setIsGuidedSellingOpen(true);
              }}
              className="rq-btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={13} className="text-amber-500" />
              <span>Oracle Guided Selling</span>
            </button>
            <div className="px-3.5 py-1.5 rounded-lg bg-[#f8fafc] border border-[#dde1e9] text-xs flex items-center gap-2 shadow-2xs">
              <span className="text-[#5c6678] font-medium">Gross Margin:</span>
              <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${advisor.color}`}>
                {blendedMargin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Oracle Constraint Violation Warning Banner */}
      {hasConstraintViolation && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>Oracle Configuration Rule Breach:</strong> Usage Metering requires an active RevX Core Platform subscription.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedProductIds((prev) => ['prod-1', ...prev])}
            className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-all shrink-0 cursor-pointer"
          >
            Auto-Resolve (Add Core Platform)
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Product Catalog & Configuration */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-5">
          {/* Signer Info Card */}
          <div className="rq-card p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#edf1f7] pb-2">
              <div className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                Signer &amp; Opportunity Information
              </div>
              {initialOpportunity && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eef4ff] text-[#015ba5] border border-[#0176d3]/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3] animate-pulse" />
                  Linked to Opportunity: {initialOpportunity.name}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="text-[11px] font-bold text-[#475569]">Customer Account</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-md px-3 py-1.5 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#475569]">Opportunity Name</label>
                <input
                  type="text"
                  value={opportunityName}
                  onChange={(e) => setOpportunityName(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-md px-3 py-1.5 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#475569]">Authorized Signer</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-md px-3 py-1.5 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#475569]">Signer Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full mt-1 bg-white border border-[#dde1e9] focus:border-[#0176d3] rounded-md px-3 py-1.5 text-xs text-[#181c25] focus:outline-none focus:ring-2 focus:ring-[#0176d3]/15 transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Deal Structure & Zuora Ramp Deal Modeler */}
          <div className="rq-card p-4 sm:p-5 space-y-4 border-l-4 border-l-purple-600">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#edf1f7] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarRange size={15} className="text-purple-600" />
                  <span className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                    Commercial Deal Structure (Zuora CPQ Multi-Year Ramp)
                  </span>
                </div>
                <p className="text-[11px] text-[#5c6678] mt-0.5">
                  Choose between standard 12-month quoting or a 3-year phased adoption ramp with tiered pricing.
                </p>
              </div>

              <div className="flex items-center bg-[#f0f3f8] border border-[#dde1e9] rounded-lg p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsRampDeal(false)}
                  className={`px-3 py-1 rounded-md transition-all ${
                    !isRampDeal
                      ? 'bg-white text-[#0176d3] shadow-xs font-bold'
                      : 'text-[#5c6678] hover:text-[#181c25]'
                  }`}
                >
                  Standard Annual (12-Mo)
                </button>
                <button
                  type="button"
                  onClick={() => setIsRampDeal(true)}
                  className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                    isRampDeal
                      ? 'bg-purple-600 text-white shadow-xs font-bold'
                      : 'text-purple-700 hover:text-purple-900 font-semibold'
                  }`}
                >
                  <span>3-Year Ramp Deal</span>
                  <span className="text-[9.5px] bg-white/20 px-1 rounded">Zuora+</span>
                </button>
              </div>
            </div>

            {isRampDeal ? (
              <div className="space-y-4 pt-1 animate-in fade-in">
                <div className="p-3.5 rounded-xl bg-purple-50/40 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5">
                  <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Multi-Year Stepped Commitment Active:</span> Eliminates upfront budget friction by stepping customer licenses across Year 1, Year 2, and Year 3. Total 3-Year Contract Value (TCV): <span className="font-bold font-mono text-purple-900">{formatCurrency(rampTotalTCV, currency)}</span>.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Year 1 Ramp */}
                  <div className="p-3.5 rounded-xl border border-purple-200 bg-white shadow-2xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#10233f]">Year 1 (Initial Adoption)</span>
                      <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">Y1</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5c6678]">Committed Seats</label>
                      <input
                        type="number"
                        min="1"
                        value={rampSeats.y1}
                        onChange={(e) => setRampSeats({ ...rampSeats, y1: parseInt(e.target.value) || 1 })}
                        className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded px-2.5 py-1 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5c6678]">Ramp Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={rampDiscounts.y1}
                        onChange={(e) => setRampDiscounts({ ...rampDiscounts, y1: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded px-2.5 py-1 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="pt-2 border-t border-[#edf1f7] flex justify-between font-mono font-bold text-purple-700">
                      <span>Y1 Net ARR:</span>
                      <span>{formatCurrency(y1Net, currency)}</span>
                    </div>
                  </div>

                  {/* Year 2 Ramp */}
                  <div className="p-3.5 rounded-xl border border-purple-200 bg-white shadow-2xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#10233f]">Year 2 (Rollout Ramp)</span>
                      <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">Y2</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5c6678]">Committed Seats</label>
                      <input
                        type="number"
                        min="1"
                        value={rampSeats.y2}
                        onChange={(e) => setRampSeats({ ...rampSeats, y2: parseInt(e.target.value) || 1 })}
                        className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded px-2.5 py-1 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5c6678]">Ramp Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={rampDiscounts.y2}
                        onChange={(e) => setRampDiscounts({ ...rampDiscounts, y2: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded px-2.5 py-1 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="pt-2 border-t border-[#edf1f7] flex justify-between font-mono font-bold text-purple-700">
                      <span>Y2 Net ARR:</span>
                      <span>{formatCurrency(y2Net, currency)}</span>
                    </div>
                  </div>

                  {/* Year 3 Ramp */}
                  <div className="p-3.5 rounded-xl border border-purple-200 bg-white shadow-2xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#10233f]">Year 3 (Global Scale)</span>
                      <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">Y3</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5c6678]">Committed Seats</label>
                      <input
                        type="number"
                        min="1"
                        value={rampSeats.y3}
                        onChange={(e) => setRampSeats({ ...rampSeats, y3: parseInt(e.target.value) || 1 })}
                        className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded px-2.5 py-1 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10.5px] text-[#5c6678]">Ramp Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={rampDiscounts.y3}
                        onChange={(e) => setRampDiscounts({ ...rampDiscounts, y3: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded px-2.5 py-1 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="pt-2 border-t border-[#edf1f7] flex justify-between font-mono font-bold text-purple-700">
                      <span>Y3 Net ARR:</span>
                      <span>{formatCurrency(y3Net, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#dde1e9] text-xs text-[#5c6678] flex items-center justify-between">
                <span>Standard single-term annual agreement selected.</span>
                <span className="text-[#0176d3] font-bold">12-Month Co-Terming</span>
              </div>
            )}
          </div>

          {/* Product Catalog Cards with Smooth Hover Effects */}
          <div className="rq-card p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#edf1f7] pb-2">
              <span className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                Select Bundle &amp; Add-ons
              </span>
              <span className="text-[11px] text-[#5c6678] font-medium">
                {selectedProductIds.length} of {INITIAL_PRODUCTS.length} selected
              </span>
            </div>

            <div className="space-y-3">
              {INITIAL_PRODUCTS.map((prod) => {
                const isSelected = selectedProductIds.includes(prod.id);
                const convertedPrice = convertCurrency(prod.basePrice, 'USD', currency);
                return (
                  <div
                    key={prod.id}
                    onClick={() => toggleProduct(prod.id)}
                    className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#eef4ff] to-white border-[#0176d3] shadow-xs'
                        : 'bg-white border-[#dde1e9] hover:border-[#0176d3]/40 hover:bg-[#fafbff]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-[#0176d3] text-white shadow-2xs' : 'border border-[#c9ced8] bg-white'
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#10233f]">{prod.name}</span>
                          <span className="text-[10px] font-mono text-[#5c6678] bg-[#f0f3f8] px-2 py-0.5 rounded font-semibold">
                            {prod.sku}
                          </span>
                          {prod.isBundle && (
                            <span className="text-[9.5px] font-bold text-[#015ba5] bg-[#eef4ff] px-2 py-0.5 rounded-full border border-[#0176d3]/20">
                              Core Bundle
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#5c6678] mt-1">{prod.description}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-4">
                      <div className="text-sm font-mono font-extrabold text-[#10233f]">
                        {formatCurrency(convertedPrice, currency)}
                      </div>
                      <div className="text-[10px] text-[#5c6678]">/{prod.billingFrequency}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configured Line Items with Steppers & Sliders */}
          {lineItems.length > 0 && (
            <div className="rq-card p-4 sm:p-5 space-y-3.5">
              <span className="text-xs font-bold text-[#10233f] uppercase tracking-wider border-b border-[#edf1f7] pb-2 block">
                Discount Governance &amp; Quantity Multipliers
              </span>
              <div className="space-y-3">
                {lineItems.map((li) => (
                  <div
                    key={li.product.id}
                    className="p-3.5 rounded-xl bg-[#fbfcfe] border border-[#dde1e9] text-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#10233f]">{li.product.name}</span>
                      <span className="font-mono font-extrabold text-sm text-[#015ba5]">
                        {formatCurrency(li.finalPrice, currency)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
                      <div>
                        <span className="text-[10.5px] font-bold text-[#5c6678]">Quantity / Units</span>
                        <input
                          type="number"
                          min="1"
                          value={li.quantity}
                          onChange={(e) =>
                            setQuantities({ ...quantities, [li.product.id]: Math.max(1, parseInt(e.target.value) || 1) })
                          }
                          className="w-full mt-1 bg-white border border-[#dde1e9] rounded px-2.5 py-1 text-xs text-[#181c25] font-mono shadow-2xs"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-[10.5px] font-bold text-[#5c6678]">
                          <span>Discount %</span>
                          <span className="font-mono text-[#0176d3]">{li.discountPct}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={li.discountPct}
                          onChange={(e) =>
                            setDiscounts({ ...discounts, [li.product.id]: parseInt(e.target.value) || 0 })
                          }
                          className="w-full mt-2 accent-[#0176d3] cursor-pointer"
                        />
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-[10.5px] font-bold text-[#5c6678]">Line Margin</span>
                        <div className="mt-1 font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-500/20 inline-block">
                          {li.marginPct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Deal Summary & AI Deal Advisor */}
        <div className="space-y-4 sm:space-y-5">
          {/* AI Deal Advisor Card with Luxury Glass Look */}
          <div className="rq-card p-4 sm:p-5 space-y-3.5 border-l-4 border-l-[#0176d3]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#0176d3]" />
                <span className="text-xs font-extrabold text-[#10233f] uppercase tracking-wider">
                  AI Deal Advisor
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${advisor.color}`}>
                Score: {advisor.score}/100
              </span>
            </div>

            <p className="text-[11px] text-[#5c6678] leading-relaxed">
              Autonomous margin health and discount guardrails analysis based on historical win rates.
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#f8fafc] border border-[#dde1e9]">
                <span className="text-[#5c6678] font-medium">Win Probability</span>
                <span className="font-mono font-bold text-emerald-700">84%</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#f8fafc] border border-[#dde1e9]">
                <span className="text-[#5c6678] font-medium">Oracle Approval Tier</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${approvalTier.color}`}>
                  Level {approvalTier.level}: {approvalTier.role}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Breakdown Card */}
          <div className="rq-card p-4 sm:p-5 space-y-3.5">
            <div className="text-xs font-extrabold text-[#10233f] uppercase tracking-wider border-b border-[#edf1f7] pb-2">
              Quote Summary
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between text-[#5c6678]">
                <span>Gross List Price</span>
                <span className="font-mono font-semibold text-[#181c25]">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-[#5c6678]">
                <span>Total Discount</span>
                <span className="font-mono font-bold text-[#ba0517]">-{formatCurrency(totalDiscount, currency)}</span>
              </div>
              <div className="flex justify-between text-[#5c6678]">
                <span>Tax / {currency === 'INR' ? 'GST (18%)' : 'Sales Tax'}</span>
                <span className="font-mono font-semibold text-[#181c25]">{formatCurrency(totalTax, currency)}</span>
              </div>
              <div className="pt-2.5 border-t border-[#dde1e9] flex justify-between items-center text-sm">
                <span className="font-extrabold text-[#10233f]">Grand Total</span>
                <span className="font-mono font-extrabold text-emerald-700 text-lg">
                  {formatCurrency(grandTotal, currency)}
                </span>
              </div>
            </div>

            <button
              onClick={handleCreateAndSend}
              disabled={lineItems.length === 0}
              className="w-full mt-4 rq-btn-primary py-2.5 shadow-md"
            >
              <Send size={13} />
              <span>Generate &amp; Dispatch for eSign</span>
            </button>
            <p className="text-[10px] text-center text-[#747e90]">
              Instant generation of SHA-256 seal &amp; Certificate of Completion.
            </p>
          </div>
        </div>
      </div>

      {/* Oracle Guided Selling Wizard Modal */}
      {isGuidedSellingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-gradient-to-r from-amber-50 via-white to-purple-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                    Oracle CPQ™ Guided Selling Recommender
                  </h3>
                  <p className="text-xs text-[#5c6678]">
                    Answer requirement discovery questions to configure the optimal product package.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGuidedSellingOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Questions Step Content */}
            <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {INITIAL_GUIDED_QUESTIONS.map((q) => (
                <div key={q.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center">
                      {q.step}
                    </span>
                    <h4 className="font-bold text-sm text-[#10233f]">{q.title}</h4>
                  </div>
                  <p className="text-xs text-[#5c6678] ml-7">{q.subtitle}</p>

                  <div className="grid grid-cols-1 gap-2.5 ml-7">
                    {q.options.map((opt, i) => (
                      <div
                        key={i}
                        onClick={() => handleApplyGuidedBundle(opt.recommendedProductIds, opt.suggestedDiscountPct)}
                        className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#10233f] group-hover:text-amber-800">
                            {opt.label}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Apply Bundle ({opt.recommendedProductIds.length} SKUs) →
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5c6678] mt-1 leading-snug">
                          {opt.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-[#dde1e9] bg-[#f8fafc] flex justify-end">
              <button
                onClick={() => setIsGuidedSellingOpen(false)}
                className="rq-btn-secondary text-xs"
              >
                Close Wizard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
