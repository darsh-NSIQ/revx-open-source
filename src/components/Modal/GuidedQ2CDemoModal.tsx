import React, { useState } from 'react';
import { Currency, Quote, Order, Contract, Subscription, Invoice } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { generateIRN } from '../../utils/crypto';
import { 
  X, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles, 
  FileSignature, 
  Package, 
  FileCheck2, 
  Receipt, 
  PieChart, 
  Zap, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Sliders,
  Play
} from 'lucide-react';

interface GuidedQ2CDemoModalProps {
  onClose: () => void;
  currency: Currency;
  onInjectDemoDeal: (data: {
    quote: Quote;
    order: Order;
    contract: Contract;
    subscription: Subscription;
    invoice: Invoice;
  }) => void;
  onNavigate: (tab: string) => void;
}

export const GuidedQ2CDemoModal: React.FC<GuidedQ2CDemoModalProps> = ({
  onClose,
  currency,
  onInjectDemoDeal,
  onNavigate,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isRunningAuto, setIsRunningAuto] = useState<boolean>(false);

  const baseDealUSD = 124000;
  const dealConverted = convertCurrency(baseDealUSD, 'USD', currency);
  const mrrConverted = dealConverted / 12;

  const steps = [
    {
      num: 1,
      title: 'CPQ Deal Configuration & Margin Modeling',
      tab: 'quotes',
      badge: 'Step 1: CPQ',
      icon: Layers,
      summary: 'Acme Enterprise Deal configured with Core Platform + Usage Metering add-ons at 12% discount.',
      detail: `Total Contract Value: ${formatCurrency(dealConverted, currency)} | Blended Margin: 78.4% (Optimal Threshold Beat).`,
      metric: 'Gross Margin: 78.4%',
    },
    {
      num: 2,
      title: 'Automated Tiered Discount Governance',
      tab: 'quotes',
      badge: 'Step 2: Approvals',
      icon: ShieldCheck,
      summary: 'Rules Engine checks discount threshold against enterprise discount policy.',
      detail: 'Rule: Discounts < 15% auto-approved. Status switched from Draft → Approved without manager bottleneck.',
      metric: 'Approval: Auto-Approved (<15%)',
    },
    {
      num: 3,
      title: 'Native eSign & SHA-256 Digest',
      tab: 'esign',
      badge: 'Step 3: eSign',
      icon: FileSignature,
      summary: 'Customer signs agreement on digital canvas with zero third-party envelope fees ($0 DocuSign cost).',
      detail: 'Envelope sealed with immutable 64-char SHA-256 cryptographic hash and timestamp certificate.',
      metric: 'Seal: SHA-256 0x9f4a...e12b7c',
    },
    {
      num: 4,
      title: 'Autonomous Order Fulfillment',
      tab: 'orders',
      badge: 'Step 4: Orders',
      icon: Package,
      summary: 'Activated Customer Order is generated automatically the instant the signature canvas is locked.',
      detail: 'Zero manual data entry between sales and operations. Line items and entitlements synchronized instantly.',
      metric: 'Order Status: Activated',
    },
    {
      num: 5,
      title: 'MSA Contract & Recurring MRR Lines',
      tab: 'contracts',
      badge: 'Step 5: Contracts',
      icon: FileCheck2,
      summary: '12-Month Master Service Agreement (MSA) activated with automated renewal notice rule.',
      detail: `Recurring MRR line spawned: ${formatCurrency(mrrConverted, currency)}/mo compounding into baseline ARR.`,
      metric: `MRR Run Rate: ${formatCurrency(mrrConverted, currency)}/mo`,
    },
    {
      num: 6,
      title: 'Indian GST 18% Tax Invoice & 64-Char IRN',
      tab: 'invoices',
      badge: 'Step 6: Billing',
      icon: Receipt,
      summary: 'Official tax invoice issued with Indian GST 18% breakdown and NIC/IRP compliant IRN.',
      detail: 'Includes signed QR code payload, due dates, and instant Stripe / Razorpay payment simulator integration.',
      metric: 'IRN: 64-Char Hash Generated',
    },
    {
      num: 7,
      title: 'ASC 606 / IFRS 15 Revenue Allocation',
      tab: 'revrec',
      badge: 'Step 7: Revenue',
      icon: PieChart,
      summary: '5-step revenue recognition carves standalone selling prices (SSP) across Performance Obligations.',
      detail: 'Recognizes delivery milestones and posts unearned liability into 12-month amortization waterfall.',
      metric: 'Audit: GAAP ASC 606 Verified',
    },
  ];

  const handleRunAuto = () => {
    setIsRunningAuto(true);
    setCurrentStep(1);
    let step = 1;
    const interval = setInterval(() => {
      step += 1;
      if (step <= 7) {
        setCurrentStep(step);
      } else {
        clearInterval(interval);
        setIsRunningAuto(false);
      }
    }, 1200);
  };

  const handleExecuteIntoWorkspace = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    const demoQuoteNum = `Q-2026-0099`;
    const demoOrderNum = `ORD-2026-0099`;
    const demoContractNum = `CNT-2026-0099`;
    const demoSubNum = `SUB-2026-0099`;
    const demoInvNum = `INV-2026-0099`;
    const irn = generateIRN('27AABCR9999P1ZQ', demoInvNum, '2026-27');

    const demoQuote: Quote = {
      id: `quote-ent-${Date.now()}`,
      quoteNumber: demoQuoteNum,
      accountName: 'Tesla Mobility India Pvt Ltd',
      contactName: 'Rohan Sharma',
      contactEmail: 'rohan.sharma@teslamobility.in',
      status: 'Signed',
      currency,
      subtotal: dealConverted * 0.9,
      discountTotal: dealConverted * 0.1,
      taxTotal: dealConverted * 0.18,
      totalAmount: dealConverted * 1.08,
      marginPct: 78.4,
      createdAt: today,
      validUntil: nextYear,
      portalToken: 'tok_live_enterprise_tesla_2026',
      signedByName: 'Rohan Sharma',
      signedAt: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      signatureDigest: '0x4a9f81bc3d2e1055728a3fbc91023d84a712f5e04b1239aa',
      items: [
        {
          id: 'item-ent-1',
          productId: 'prod-1',
          productName: 'RevX Core Platform Enterprise Edition',
          quantity: 12,
          unitPrice: dealConverted / 12,
          discountPct: 12,
          totalPrice: dealConverted,
          marginPct: 78.4,
        },
      ],
    };

    const demoOrder: Order = {
      id: `ord-ent-${Date.now()}`,
      orderNumber: demoOrderNum,
      quoteNumber: demoQuoteNum,
      accountName: 'Tesla Mobility India Pvt Ltd',
      status: 'Activated',
      totalAmount: dealConverted * 1.08,
      currency,
      orderedDate: today,
      activatedDate: today,
      itemsCount: 1,
    };

    const demoContract: Contract = {
      id: `con-ent-${Date.now()}`,
      contractNumber: demoContractNum,
      accountName: 'Tesla Mobility India Pvt Ltd',
      quoteNumber: demoQuoteNum,
      status: 'Activated',
      startDate: today,
      endDate: nextYear,
      contractTermMonths: 12,
      totalContractValue: dealConverted * 1.08,
      currency,
      autoRenew: true,
    };

    const demoSubscription: Subscription = {
      id: `sub-ent-${Date.now()}`,
      subscriptionNumber: demoSubNum,
      contractNumber: demoContractNum,
      productName: 'RevX Core Platform Enterprise Edition',
      accountName: 'Tesla Mobility India Pvt Ltd',
      status: 'Active',
      mrr: (dealConverted * 1.08) / 12,
      currency,
      startDate: today,
      renewalDate: nextYear,
      quantity: 12,
    };

    const demoInvoice: Invoice = {
      id: `inv-ent-${Date.now()}`,
      invoiceNumber: demoInvNum,
      quoteNumber: demoQuoteNum,
      accountName: 'Tesla Mobility India Pvt Ltd',
      amount: dealConverted * 1.08,
      currency,
      status: 'Paid',
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      irnNumber: irn,
      gstAmount: dealConverted * 0.18,
      paymentMethod: 'Stripe',
      paidAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    onInjectDemoDeal({
      quote: demoQuote,
      order: demoOrder,
      contract: demoContract,
      subscription: demoSubscription,
      invoice: demoInvoice,
    });

    onClose();
    onNavigate('war-room');
  };

  const activeStepObj = steps[currentStep - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-gradient-to-r from-[#eef4ff] via-white to-[#f0fdf4] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-[#1ab9ff] text-white flex items-center justify-center shadow-sm shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                  Autonomous Quote-to-Cash (Q2C) Enterprise Pipeline
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                  7-Step Live Execution
                </span>
              </div>
              <p className="text-xs text-[#5c6678] mt-0.5">
                Watch how an enterprise deal flows autonomously across CPQ, eSign, Orders, Contracts, GST Invoicing, and ASC 606 RevRec.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:text-[#181c25] hover:bg-white border border-transparent hover:border-[#dde1e9] transition-all shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* 7-Step Progress Stepper */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-[#f8fafc] border-b border-[#dde1e9] overflow-x-auto">
          <div className="flex items-center justify-between min-w-[620px] gap-2">
            {steps.map((st) => {
              const isDone = st.num < currentStep;
              const isCurrent = st.num === currentStep;
              return (
                <button
                  key={st.num}
                  onClick={() => setCurrentStep(st.num)}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition-all ${
                    isCurrent
                      ? 'bg-white border-[#0176d3] shadow-md ring-2 ring-[#0176d3]/20 scale-102'
                      : isDone
                      ? 'bg-emerald-50/60 border-emerald-500/30 text-emerald-800'
                      : 'bg-white border-[#dde1e9] text-[#64748b] hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      isCurrent
                        ? 'bg-[#0176d3] text-white shadow-2xs'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#e2e8f0] text-[#64748b]'
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={14} /> : st.num}
                  </div>
                  <span className="text-[10.5px] font-bold truncate max-w-[100px] leading-tight">
                    {st.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Visualizer Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#f8fafc] to-white border border-[#dde1e9] shadow-xs">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#0176d3] border border-blue-200/60 flex items-center justify-center shrink-0 shadow-2xs">
                  <activeStepObj.icon size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#015ba5] uppercase tracking-wider font-mono">
                      Milestone {activeStepObj.num} of 7
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-[#eef4ff] text-[#0176d3] px-2 py-0.5 rounded border border-[#0176d3]/20">
                      Target Tab: {activeStepObj.tab.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-[#10233f] mt-1">
                    {activeStepObj.title}
                  </h3>
                  <p className="text-xs text-[#475569] mt-1 leading-relaxed max-w-xl">
                    {activeStepObj.summary}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#eef4ff] border border-[#0176d3]/20 text-right shrink-0">
                <span className="text-[10px] font-bold text-[#5c6678] uppercase tracking-wider block">Telemetry Indicator</span>
                <span className="font-mono font-extrabold text-xs text-[#015ba5] block mt-0.5">
                  {activeStepObj.metric}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#e2e8f0] text-xs text-[#334155] bg-white p-3.5 rounded-xl border border-[#dde1e9] font-mono leading-relaxed">
              <span className="text-emerald-700 font-bold">✓ RevX Execution Engine: </span>
              {activeStepObj.detail}
            </div>
          </div>

          {/* Interactive Comparison Strip for this Step */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#f0fdf4] border border-emerald-500/25 space-y-1.5">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>How RevX Handles This (Effortless &amp; Free)</span>
              </span>
              <p className="text-[11px] text-emerald-950 leading-relaxed">
                Autonomous 1-click execution. Instant data propagation with zero latency, zero third-party licensing taxes, and complete audit trail.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#fef2f2] border border-[#ba0517]/20 space-y-1.5">
              <span className="text-[11px] font-bold text-[#ba0517] uppercase tracking-wider flex items-center gap-1.5">
                <X size={13} className="text-[#ba0517]" />
                <span>How Competitors Struggle</span>
              </span>
              <p className="text-[11px] text-[#7f1d1d] leading-relaxed">
                Salesforce CPQ &amp; DealHub require separate DocuSign/Adobe seats, separate Zuora RevRec licenses, and 10+ manual sync clicks.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#dde1e9] bg-[#fbfcfe] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAuto}
              disabled={isRunningAuto}
              className="rq-btn-secondary text-xs flex items-center gap-1.5"
            >
              <Play size={12} className={isRunningAuto ? 'animate-spin' : ''} />
              <span>{isRunningAuto ? 'Running 7-Step Pipeline...' : 'Run Auto Pipeline'}</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1 || isRunningAuto}
                className="px-2.5 py-1 text-xs font-semibold rounded border border-[#dde1e9] bg-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentStep(Math.min(7, currentStep + 1))}
                disabled={currentStep === 7 || isRunningAuto}
                className="px-2.5 py-1 text-xs font-semibold rounded border border-[#dde1e9] bg-white disabled:opacity-40"
              >
                Next Step
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExecuteIntoWorkspace}
              className="rq-btn-primary text-xs"
            >
              <Zap size={13} />
              <span>Commit &amp; Provision Enterprise Deal Across Pipeline →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
