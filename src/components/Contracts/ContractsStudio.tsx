import React, { useState, useEffect } from 'react';
import { Currency, Contract, Subscription, SubscriptionStatus, SubscriptionAddOn } from '../../types';
import { formatCurrency, convertCurrency } from '../../utils/format';
import { 
  FileCheck2, 
  Repeat, 
  CheckCircle2, 
  Calendar, 
  ShieldCheck, 
  TrendingUp, 
  Layers, 
  Activity,
  Sparkles,
  Pause,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Unlock,
  Tag,
  CreditCard,
  UserCheck,
  ExternalLink,
  Percent,
  Clock,
  AlertTriangle,
  X,
  Check,
  ChevronRight,
  Copy,
  Receipt,
  Download,
  ShieldAlert,
  Zap,
  RefreshCw,
  Sliders,
  DollarSign,
  Edit2
} from 'lucide-react';
import { EditContractModal } from './EditContractModal';
import { EditSubscriptionModal } from './EditSubscriptionModal';

interface ContractsStudioProps {
  currency: Currency;
  contracts: Contract[];
  subscriptions: Subscription[];
  onUpdateSubscription?: (sub: Subscription) => void;
  onCreateSubscription?: (sub: Subscription) => void;
  onUpdateContract?: (contract: Contract) => void;
}

type ActiveSubView = 'subscriptions' | 'portal' | 'retention' | 'checkout' | 'contracts';

export const ContractsStudio: React.FC<ContractsStudioProps> = ({ 
  currency,
  contracts, 
  subscriptions: initialSubscriptions,
  onUpdateSubscription,
  onCreateSubscription,
  onUpdateContract,
}) => {
  // Local state initialized with props
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  useEffect(() => {
    setSubscriptions(initialSubscriptions);
  }, [initialSubscriptions]);
  const [activeSubView, setActiveSubView] = useState<ActiveSubView>('subscriptions');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected subscription for modals
  const [selectedSubForProration, setSelectedSubForProration] = useState<Subscription | null>(null);
  const [selectedSubForRetention, setSelectedSubForRetention] = useState<Subscription | null>(null);
  const [selectedSubForPause, setSelectedSubForPause] = useState<Subscription | null>(null);
  const [selectedSubForCoupon, setSelectedSubForCoupon] = useState<Subscription | null>(null);
  const [selectedCustomerForPortal, setSelectedCustomerForPortal] = useState<Subscription>(subscriptions[0]);

  // Proration Modal state
  const [targetTier, setTargetTier] = useState<'Starter' | 'Professional' | 'Enterprise Plus'>('Enterprise Plus');
  const [prorationMethod, setProrationMethod] = useState<'immediate' | 'next-billing'>('immediate');

  // Pause Modal state
  const [pauseDurationDays, setPauseDurationDays] = useState<number>(60);

  // Coupon Modal state
  const [couponCode, setCouponCode] = useState<string>('SCALE25');
  const [couponDiscountPct, setCouponDiscountPct] = useState<number>(25);

  // Retention / Churn Deflection state
  const [cancellationReason, setCancellationReason] = useState<string>('Pricing too high for our current budget');
  const [retentionStep, setRetentionStep] = useState<'reason' | 'offer' | 'confirmed-save' | 'confirmed-cancelled'>('reason');

  // Hosted Checkout state
  const [checkoutTier, setCheckoutTier] = useState<'Starter' | 'Professional' | 'Enterprise Plus'>('Professional');
  const [checkoutCadence, setCheckoutCadence] = useState<'Monthly' | 'Annual'>('Annual');
  const [checkoutIncludeAddon, setCheckoutIncludeAddon] = useState<boolean>(true);
  const [checkoutCoupon, setCheckoutCoupon] = useState<string>('ANNUAL20');
  const [checkoutSuccessNotice, setCheckoutSuccessNotice] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Helper to sync update to parent & local state
  const handleUpdate = (updatedSub: Subscription) => {
    setSubscriptions((prev) => prev.map((s) => s.id === updatedSub.id ? updatedSub : s));
    if (onUpdateSubscription) {
      onUpdateSubscription(updatedSub);
    }
  };

  const totalTCV = contracts.reduce(
    (acc, con) => acc + convertCurrency(con.totalContractValue, con.currency, currency),
    0
  );

  const activeSubscriptions = subscriptions.filter((s) => s.status === 'Active');
  const totalMRR = activeSubscriptions.reduce(
    (acc, sub) => acc + convertCurrency(sub.mrr, sub.currency, currency),
    0
  );

  const grandfatheredCount = subscriptions.filter((s) => s.isGrandfathered).length;
  const trialCount = subscriptions.filter((s) => s.status === 'In Trial').length;
  const churnSavedCount = subscriptions.filter((s) => s.churnSaved).length;

  // Plan Prices definition
  const TIER_PRICES: Record<'Starter' | 'Professional' | 'Enterprise Plus', number> = {
    'Starter': 299,
    'Professional': 699,
    'Enterprise Plus': 1080,
  };

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? sub.status === 'Active' :
      statusFilter === 'trial' ? sub.status === 'In Trial' :
      statusFilter === 'paused' ? sub.status === 'Paused' :
      statusFilter === 'past-due' ? sub.status === 'Past Due' :
      statusFilter === 'cancelled' ? sub.status === 'Cancelled' : true;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      sub.subscriptionNumber.toLowerCase().includes(q) ||
      sub.accountName.toLowerCase().includes(q) ||
      sub.productName.toLowerCase().includes(q) ||
      (sub.customerEmail && sub.customerEmail.toLowerCase().includes(q))
    );

    return matchesStatus && matchesSearch;
  });

  // Action: Toggle Grandfathering
  const toggleGrandfathering = (sub: Subscription) => {
    const updated = {
      ...sub,
      isGrandfathered: !sub.isGrandfathered,
    };
    handleUpdate(updated);
  };

  // Action: Confirm Plan Upgrade / Downgrade with Proration
  const applyProrationPlanChange = () => {
    if (!selectedSubForProration) return;

    const oldPrice = selectedSubForProration.mrr;
    const newPrice = TIER_PRICES[targetTier];
    const daysRemaining = 18;
    const totalDays = 30;

    // Proration Math (Chargebee Engine)
    const unusedCredit = (oldPrice / totalDays) * daysRemaining;
    const proratedNewCharge = (newPrice / totalDays) * daysRemaining;
    const netDue = Math.round(proratedNewCharge - unusedCredit);

    const updated: Subscription = {
      ...selectedSubForProration,
      tier: targetTier,
      mrr: newPrice,
      prorationAccrued: netDue,
    };

    handleUpdate(updated);
    setSelectedSubForProration(null);
  };

  // Action: Pause Subscription
  const applyPauseSubscription = () => {
    if (!selectedSubForPause) return;
    const resumeDate = new Date(Date.now() + pauseDurationDays * 86400000).toISOString().split('T')[0];
    const updated: Subscription = {
      ...selectedSubForPause,
      status: 'Paused',
      pausedUntilDate: resumeDate,
    };
    handleUpdate(updated);
    setSelectedSubForPause(null);
  };

  // Action: Resume Subscription
  const applyResumeSubscription = (sub: Subscription) => {
    const updated: Subscription = {
      ...sub,
      status: 'Active',
      pausedUntilDate: undefined,
    };
    handleUpdate(updated);
  };

  // Action: Apply Coupon
  const applyCouponCode = () => {
    if (!selectedSubForCoupon) return;
    const discountFactor = (100 - couponDiscountPct) / 100;
    const newMrr = Math.round(selectedSubForCoupon.mrr * discountFactor);
    const updated: Subscription = {
      ...selectedSubForCoupon,
      appliedCoupon: couponCode,
      discountPct: couponDiscountPct,
      mrr: newMrr,
    };
    handleUpdate(updated);
    setSelectedSubForCoupon(null);
  };

  // Action: Accept Churn Deflection Offer (Chargebee Retention)
  const acceptRetentionOffer = () => {
    if (!selectedSubForRetention) return;
    const discountedMrr = Math.round(selectedSubForRetention.mrr * 0.65); // 35% discount
    const updated: Subscription = {
      ...selectedSubForRetention,
      status: 'Active',
      churnSaved: true,
      savedOfferApplied: '35% Churn Deflection Incentive applied for 3 months',
      discountPct: 35,
      mrr: discountedMrr,
      cancellationReason: undefined,
    };
    handleUpdate(updated);
    setRetentionStep('confirmed-save');
    setTimeout(() => {
      setSelectedSubForRetention(null);
      setRetentionStep('reason');
    }, 1500);
  };

  // Action: Confirm Cancellation
  const confirmCancellation = (atPeriodEnd: boolean) => {
    if (!selectedSubForRetention) return;
    const updated: Subscription = {
      ...selectedSubForRetention,
      status: atPeriodEnd ? 'Active' : 'Cancelled',
      cancelAtPeriodEnd: atPeriodEnd,
      cancellationReason: cancellationReason,
    };
    handleUpdate(updated);
    setRetentionStep('confirmed-cancelled');
    setTimeout(() => {
      setSelectedSubForRetention(null);
      setRetentionStep('reason');
    }, 1500);
  };

  // Action: Complete Test Checkout Link
  const handleTestCheckout = () => {
    const basePrice = TIER_PRICES[checkoutTier];
    const finalPrice = checkoutCadence === 'Annual' ? Math.round(basePrice * 0.8) : basePrice;
    const newSub: Subscription = {
      id: `sub-${Date.now()}`,
      subscriptionNumber: `SUB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      contractNumber: 'CNT-2026-ONLINE',
      productName: `RevX Core Platform · ${checkoutTier} Tier`,
      accountName: 'Acme Global Ventures (Online Checkout)',
      customerEmail: 'billing@acmeglobal.com',
      tier: checkoutTier,
      status: 'Active',
      mrr: finalPrice,
      currency: currency,
      startDate: new Date().toISOString().split('T')[0],
      renewalDate: new Date(Date.now() + (checkoutCadence === 'Annual' ? 365 : 30) * 86400000).toISOString().split('T')[0],
      quantity: 1,
      billingCadence: checkoutCadence,
      appliedCoupon: checkoutCoupon,
      discountPct: checkoutCadence === 'Annual' ? 20 : 0,
      lastPaymentMethod: 'Visa •••• 4242 (Stripe Instant Auth)',
      usageLimit: checkoutTier === 'Starter' ? 50000 : checkoutTier === 'Professional' ? 250000 : 1000000,
      currentUsage: 0,
      usageMetricName: 'API Invocations',
      overageUnitPrice: 0.02,
      prorationAccrued: 0,
      addOns: checkoutIncludeAddon ? [
        { id: `add-${Date.now()}`, name: '24/7 Priority SLA & Dedicated TAM', unitPrice: 150, quantity: 1, billingCadence: 'Monthly' }
      ] : []
    };

    if (onCreateSubscription) {
      onCreateSubscription(newSub);
    }
    setSubscriptions((prev) => [newSub, ...prev]);
    setCheckoutSuccessNotice(true);
    setTimeout(() => setCheckoutSuccessNotice(false), 3500);
  };

  const copyCheckoutUrl = () => {
    setCopiedLink(true);
    navigator.clipboard?.writeText?.(`https://checkout.revx.io/p/${checkoutTier.toLowerCase()}_${checkoutCadence.toLowerCase()}?coupon=${checkoutCoupon}`);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300">
      {/* Top Banner with Chargebee Parity Badge */}
      <div className="rq-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full border border-[#0176d3]/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0176d3] animate-pulse" />
                Subscription &amp; Recurring Billing Engine
              </span>
              <span className="text-[10.5px] font-bold text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-500/25 flex items-center gap-1">
                <Sparkles size={11} className="text-purple-600" />
                Chargebee Parity + Retention AI
              </span>
              <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                0% Take-Rate ($0 Platform Tax)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#10233f] tracking-tight">
              Subscription Lifecycle, Proration &amp; Churn Deflection
            </h1>
            <p className="text-xs text-[#5c6678] mt-1 max-w-3xl leading-relaxed">
              Complete Chargebee-grade recurring subscription operations: mid-cycle upgrades with live proration calculations, seasonal pausing, grandfathered pricing protection, customer self-service portal, and automated churn deflection save offers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveSubView('checkout')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0176d3] hover:bg-[#015ba5] shadow-sm shadow-[#0176d3]/20 transition-all cursor-pointer"
            >
              <ExternalLink size={13} />
              <span>+ Create Payment Link</span>
            </button>
            <button
              onClick={() => setActiveSubView('portal')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#015ba5] bg-[#eef4ff] hover:bg-[#e0edff] border border-[#0176d3]/20 transition-all cursor-pointer"
            >
              <UserCheck size={13} />
              <span>Customer Portal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chargebee Telemetry KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Active MRR */}
        <div className="rq-card border-l-4 border-l-emerald-600 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-xs text-[#5c6678]">
            <span className="font-bold text-[11px] uppercase tracking-wider">Active Monthly Recurring (MRR)</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Compounding
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-700 mt-1">
            {formatCurrency(totalMRR, currency)}/mo
          </div>
          <div className="text-[11px] text-[#5c6678] mt-2 pt-2 border-t border-[#f0f3f8] flex items-center justify-between">
            <span>{activeSubscriptions.length} Active Paying Subscribers</span>
            <span className="text-emerald-600 font-bold">100% Synced</span>
          </div>
        </div>

        {/* Grandfathered Pricing */}
        <div className="rq-card border-l-4 border-l-[#0176d3] p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-xs text-[#5c6678]">
            <span className="font-bold text-[11px] uppercase tracking-wider">Grandfathered Accounts</span>
            <span className="text-[10px] font-bold text-[#015ba5] bg-[#eef4ff] px-2 py-0.5 rounded-full border border-[#0176d3]/20 flex items-center gap-1">
              <Lock size={10} />
              <span>Price-Lock</span>
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#10233f] mt-1 group-hover:text-[#015ba5] transition-colors">
            {grandfatheredCount} Accounts
          </div>
          <div className="text-[11px] text-[#5c6678] mt-2 pt-2 border-t border-[#f0f3f8] flex items-center justify-between">
            <span>Legacy price immunity active</span>
            <span className="text-[#0176d3] font-bold">Catalog Safe</span>
          </div>
        </div>

        {/* Free Trials & Pipeline */}
        <div className="rq-card border-l-4 border-l-amber-500 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-xs text-[#5c6678]">
            <span className="font-bold text-[11px] uppercase tracking-wider">In Trial Conversion Queue</span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-500/20">
              Self-Serve
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-800 mt-1">
            {trialCount} Subscriptions
          </div>
          <div className="text-[11px] text-[#5c6678] mt-2 pt-2 border-t border-[#f0f3f8] flex items-center justify-between">
            <span>Avg 8.4 days to auto-bill</span>
            <span className="text-amber-700 font-bold">Card on File</span>
          </div>
        </div>

        {/* Chargebee Retention Saved Churn */}
        <div className="rq-card border-l-4 border-l-purple-600 p-4 group hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-xs text-[#5c6678]">
            <span className="font-bold text-[11px] uppercase tracking-wider">Retention AI Deflected Churn</span>
            <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-500/20">
              Save Rate 84.6%
            </span>
          </div>
          <div className="text-2xl font-extrabold font-mono text-purple-700 mt-1">
            {churnSavedCount} Saved Deals
          </div>
          <div className="text-[11px] text-[#5c6678] mt-2 pt-2 border-t border-[#f0f3f8] flex items-center justify-between">
            <span>$4,120/mo MRR saved from loss</span>
            <span className="text-purple-600 font-bold">Deflected</span>
          </div>
        </div>
      </div>

      {/* Chargebee Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[#dde1e9] pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubView('subscriptions')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeSubView === 'subscriptions'
              ? 'bg-[#0176d3] text-white shadow-xs'
              : 'text-[#5c6678] hover:text-[#10233f] hover:bg-slate-100'
          }`}
        >
          <Repeat size={14} />
          <span>Subscriptions 360</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/20">
            {subscriptions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('portal')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeSubView === 'portal'
              ? 'bg-[#0176d3] text-white shadow-xs'
              : 'text-[#5c6678] hover:text-[#10233f] hover:bg-slate-100'
          }`}
        >
          <UserCheck size={14} />
          <span>Customer Self-Service Portal</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800">
            Hosted
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('retention')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeSubView === 'retention'
              ? 'bg-[#0176d3] text-white shadow-xs'
              : 'text-[#5c6678] hover:text-[#10233f] hover:bg-slate-100'
          }`}
        >
          <ShieldAlert size={14} />
          <span>Chargebee Retention (Churn Deflection)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
            Active
          </span>
        </button>

        <button
          onClick={() => setActiveSubView('checkout')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeSubView === 'checkout'
              ? 'bg-[#0176d3] text-white shadow-xs'
              : 'text-[#5c6678] hover:text-[#10233f] hover:bg-slate-100'
          }`}
        >
          <CreditCard size={14} />
          <span>Hosted Checkout &amp; Payment Links</span>
        </button>

        <button
          onClick={() => setActiveSubView('contracts')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeSubView === 'contracts'
              ? 'bg-[#0176d3] text-white shadow-xs'
              : 'text-[#5c6678] hover:text-[#10233f] hover:bg-slate-100'
          }`}
        >
          <FileCheck2 size={14} />
          <span>Master Contracts (MSA)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
            {contracts.length}
          </span>
        </button>
      </div>

      {/* -------------------- VIEW 1: Subscriptions 360 -------------------- */}
      {activeSubView === 'subscriptions' && (
        <div className="space-y-4">
          {/* Controls Bar: Filters & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#dde1e9]">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { id: 'all', label: 'All Subscriptions' },
                { id: 'active', label: 'Active Paying' },
                { id: 'trial', label: 'In Trial' },
                { id: 'paused', label: 'Paused' },
                { id: 'past-due', label: 'Past Due' },
                { id: 'cancelled', label: 'Cancelled' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-[#eef4ff] text-[#015ba5] font-bold border border-[#0176d3]/30'
                      : 'text-[#5c6678] hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Filter by account, ID, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#dde1e9] focus:border-[#0176d3] rounded-lg pl-3 pr-3 py-1.5 text-xs text-[#10233f] placeholder:text-[#94a3b8] focus:outline-none"
              />
            </div>
          </div>

          {/* Subscriptions Table */}
          <div className="rq-card overflow-hidden">
            <div className="p-4 border-b border-[#dde1e9] flex items-center justify-between bg-[#fbfcfe]">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-[#0176d3]" />
                <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                  Subscriptions Lifecycle &amp; Proration Management
                </h2>
              </div>
              <span className="text-[11px] text-[#5c6678] font-semibold">
                Showing {filteredSubscriptions.length} of {subscriptions.length} subscriptions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[950px]">
                <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Subscription ID</th>
                    <th className="py-3 px-4">Customer Account</th>
                    <th className="py-3 px-4">Plan &amp; Tier</th>
                    <th className="py-3 px-4">Cadence &amp; Price Protection</th>
                    <th className="py-3 px-4">Monthly MRR</th>
                    <th className="py-3 px-4">Next Renewal / Expiry</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Chargebee Lifecycle Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f7]">
                  {filteredSubscriptions.map((sub) => {
                    const convertedMRR = convertCurrency(sub.mrr, sub.currency, currency);
                    return (
                      <tr key={sub.id} className="hover:bg-[#f5f8fc] transition-colors duration-150 group">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#0176d3]">
                          {sub.subscriptionNumber}
                          {sub.churnSaved && (
                            <span className="ml-1 text-[9px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-full">
                              Retained
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#181c25]">
                          <div>{sub.accountName}</div>
                          <div className="text-[10.5px] text-[#747e90] font-normal">{sub.customerEmail}</div>
                        </td>
                        <td className="py-3.5 px-4 text-[#181c25]">
                          <div className="font-semibold text-xs">{sub.productName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200 font-bold">
                              {sub.tier || 'Enterprise Plus'}
                            </span>
                            {sub.addOns && sub.addOns.length > 0 && (
                              <span className="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                +{sub.addOns.length} Add-on
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="font-semibold text-[#10233f]">{sub.billingCadence || 'Monthly'}</span>
                            {sub.discountPct && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                -{sub.discountPct}%
                              </span>
                            )}
                          </div>
                          <div className="mt-1">
                            {sub.isGrandfathered ? (
                              <button
                                onClick={() => toggleGrandfathering(sub)}
                                title="Click to unlock catalog pricing"
                                className="inline-flex items-center gap-1 text-[9.5px] font-bold text-[#015ba5] bg-[#eef4ff] px-1.5 py-0.5 rounded border border-[#0176d3]/30 cursor-pointer hover:bg-blue-100"
                              >
                                <Lock size={9} />
                                <span>Grandfathered</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleGrandfathering(sub)}
                                title="Click to lock in grandfathered pricing"
                                className="inline-flex items-center gap-1 text-[9.5px] text-slate-500 hover:text-[#0176d3] bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded border border-slate-200 cursor-pointer"
                              >
                                <Unlock size={9} />
                                <span>Standard Catalog</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-xs">
                          {formatCurrency(convertedMRR, currency)}/mo
                          {sub.prorationAccrued !== undefined && sub.prorationAccrued !== 0 && (
                            <div className="text-[9.5px] font-mono text-purple-700 font-normal">
                              Prorated: {sub.prorationAccrued > 0 ? `+${sub.prorationAccrued}` : sub.prorationAccrued}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#5c6678] text-[11px]">
                          <div>{sub.renewalDate}</div>
                          {sub.trialDaysLeft !== undefined && sub.status === 'In Trial' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-500/20">
                              {sub.trialDaysLeft} days left
                            </span>
                          )}
                          {sub.pausedUntilDate && (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              Resume {sub.pausedUntilDate}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {sub.status === 'Active' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                              <CheckCircle2 size={11} />
                              <span>Active</span>
                            </span>
                          )}
                          {sub.status === 'In Trial' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-500/25">
                              <Clock size={11} />
                              <span>In Trial</span>
                            </span>
                          )}
                          {sub.status === 'Paused' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-purple-50 text-purple-700 border border-purple-500/25">
                              <Pause size={11} />
                              <span>Paused</span>
                            </span>
                          )}
                          {sub.status === 'Past Due' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-500/25">
                              <AlertTriangle size={11} />
                              <span>Past Due</span>
                            </span>
                          )}
                          {sub.status === 'Cancelled' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                              <X size={11} />
                              <span>Cancelled</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Subscription */}
                            <button
                              onClick={() => setEditingSub(sub)}
                              title="Edit Subscription Details"
                              className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-[#015ba5] font-semibold text-[11px] border border-[#dde1e9] transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <Edit2 size={11} />
                              <span>Edit</span>
                            </button>

                            {/* Upgrade / Downgrade with Proration */}
                            <button
                              onClick={() => {
                                setSelectedSubForProration(sub);
                                setTargetTier(sub.tier === 'Enterprise Plus' ? 'Professional' : 'Enterprise Plus');
                              }}
                              title="Change Plan (Chargebee Proration Engine)"
                              className="px-2 py-1 rounded bg-[#eef4ff] hover:bg-blue-100 text-[#015ba5] font-semibold text-[11px] border border-[#0176d3]/20 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Sliders size={11} />
                              <span>Prorate</span>
                            </button>

                            {/* Pause or Resume */}
                            {sub.status === 'Paused' ? (
                              <button
                                onClick={() => applyResumeSubscription(sub)}
                                title="Resume Subscription Now"
                                className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] border border-emerald-500/25 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Play size={11} />
                                <span>Resume</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedSubForPause(sub)}
                                title="Pause Subscription (Seasonal Pause)"
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[#5c6678] font-semibold text-[11px] border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Pause size={11} />
                                <span>Pause</span>
                              </button>
                            )}

                            {/* Apply Coupon */}
                            <button
                              onClick={() => setSelectedSubForCoupon(sub)}
                              title="Apply Promotional Coupon Code"
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[#5c6678] hover:text-[#0176d3] font-semibold text-[11px] border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Tag size={11} />
                              <span>Coupon</span>
                            </button>

                            {/* Cancel with Chargebee Retention */}
                            <button
                              onClick={() => {
                                setSelectedSubForRetention(sub);
                                setRetentionStep('reason');
                              }}
                              title="Cancel Subscription (Triggers Retention Churn Deflection)"
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] border border-rose-300 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span>Cancel</span>
                            </button>

                            {/* View In Customer Portal */}
                            <button
                              onClick={() => {
                                setSelectedCustomerForPortal(sub);
                                setActiveSubView('portal');
                              }}
                              title="Open Customer Self-Service Portal Simulator"
                              className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
                            >
                              <UserCheck size={12} />
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
        </div>
      )}

      {/* -------------------- VIEW 2: Chargebee Customer Self-Service Portal Simulator -------------------- */}
      {activeSubView === 'portal' && selectedCustomerForPortal && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-[#0a192f] via-[#10233f] to-[#014486] p-5 sm:p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                  Chargebee Hosted Customer Portal Simulation
                </span>
                <span className="text-[10px] font-mono text-emerald-300">Live Active Session</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                {selectedCustomerForPortal.accountName} · Billing &amp; Subscription Portal
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                This is the exact self-service view enterprise customers see to update payment methods, manage plans, and download tax invoices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Simulate Account:</span>
              <select
                value={selectedCustomerForPortal.id}
                onChange={(e) => {
                  const found = subscriptions.find((s) => s.id === e.target.value);
                  if (found) setSelectedCustomerForPortal(found);
                }}
                className="bg-white/10 border border-white/25 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                {subscriptions.map((s) => (
                  <option key={s.id} value={s.id} className="text-slate-900">
                    {s.accountName} ({s.subscriptionNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 Cols: Plan Details & Proration Actions */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rq-card p-5">
                <div className="flex items-center justify-between border-b border-[#dde1e9] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Repeat size={18} className="text-[#0176d3]" />
                    <h3 className="text-sm font-bold text-[#10233f]">Current Subscription Overview</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                    {selectedCustomerForPortal.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#dde1e9]">
                    <span className="text-[10.5px] font-bold text-[#5c6678] uppercase">Plan Tier</span>
                    <div className="text-base font-extrabold text-[#10233f] mt-1">
                      {selectedCustomerForPortal.tier || 'Enterprise Plus'}
                    </div>
                    <span className="text-[10px] text-purple-700 font-mono">
                      {selectedCustomerForPortal.productName}
                    </span>
                  </div>

                  <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#dde1e9]">
                    <span className="text-[10.5px] font-bold text-[#5c6678] uppercase">Recurring Billing Rate</span>
                    <div className="text-base font-extrabold font-mono text-emerald-700 mt-1">
                      {formatCurrency(selectedCustomerForPortal.mrr, currency)} / {selectedCustomerForPortal.billingCadence || 'mo'}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Auto-debited on {selectedCustomerForPortal.renewalDate}
                    </span>
                  </div>

                  <div className="p-3 bg-[#f8fafc] rounded-xl border border-[#dde1e9]">
                    <span className="text-[10.5px] font-bold text-[#5c6678] uppercase">Price Guarantee</span>
                    <div className="text-base font-extrabold text-[#10233f] mt-1 flex items-center gap-1">
                      {selectedCustomerForPortal.isGrandfathered ? (
                        <>
                          <Lock size={14} className="text-[#0176d3]" />
                          <span>Grandfathered</span>
                        </>
                      ) : (
                        <span>Standard Rate</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Protected from future price hikes
                    </span>
                  </div>
                </div>

                {/* Self-Service Plan Change Simulator */}
                <div className="mt-5 p-4 rounded-xl border border-blue-200 bg-[#f0f7ff]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[#015ba5]">Want to change or upgrade your tier?</div>
                    <div className="text-[11px] text-[#5c6678] mt-0.5">
                      Chargebee proration engine calculates immediate partial-month credit and prorated charge.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSubForProration(selectedCustomerForPortal);
                      setTargetTier(selectedCustomerForPortal.tier === 'Enterprise Plus' ? 'Professional' : 'Enterprise Plus');
                    }}
                    className="rq-btn-primary text-xs shrink-0 cursor-pointer"
                  >
                    <Sliders size={12} />
                    <span>Change Plan &amp; Prorate</span>
                  </button>
                </div>
              </div>

              {/* Invoices & Receipts for Customer */}
              <div className="rq-card p-5">
                <div className="flex items-center justify-between border-b border-[#dde1e9] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Receipt size={18} className="text-[#0176d3]" />
                    <h3 className="text-sm font-bold text-[#10233f]">Recent Tax Invoices &amp; Receipts</h3>
                  </div>
                  <span className="text-xs text-[#5c6678]">Self-Service PDF Downloads</span>
                </div>

                <div className="space-y-2">
                  {[
                    { number: 'INV-2026-0089', date: '15 Oct 2026', amount: selectedCustomerForPortal.mrr, status: 'Paid' },
                    { number: 'INV-2026-0045', date: '15 Sep 2026', amount: selectedCustomerForPortal.mrr, status: 'Paid' },
                    { number: 'INV-2026-0012', date: '15 Aug 2026', amount: selectedCustomerForPortal.mrr, status: 'Paid' },
                  ].map((inv) => (
                    <div key={inv.number} className="p-3 bg-white rounded-lg border border-[#dde1e9] flex items-center justify-between hover:border-[#0176d3]/40 transition-all text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                          ✓
                        </div>
                        <div>
                          <div className="font-mono font-bold text-[#10233f]">{inv.number}</div>
                          <div className="text-[10px] text-slate-500">{inv.date} · GST Tax Invoice</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-[#10233f]">
                          {formatCurrency(inv.amount, currency)}
                        </span>
                        <button 
                          onClick={() => alert(`Downloading official PDF for ${inv.number} with NIC IRN Hash...`)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[#015ba5] font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Download size={11} />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Stored Payment Methods & Security */}
            <div className="space-y-4">
              <div className="rq-card p-5">
                <div className="flex items-center justify-between border-b border-[#dde1e9] pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-[#0176d3]" />
                    <h3 className="text-sm font-bold text-[#10233f]">Payment Method on File</h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-500/20">
                    Default
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white shadow-md relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs uppercase tracking-wider text-slate-400">Corporate Card</span>
                    <span className="font-extrabold text-sm tracking-tight text-[#0ea5e9]">RevX Secure Vault</span>
                  </div>
                  <div className="font-mono text-sm tracking-widest my-2">
                    •••• •••• •••• 4242
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300 mt-3 pt-2 border-t border-slate-700">
                    <span>Exp: 11/28</span>
                    <span>Stripe &amp; Razorpay Fallback</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button 
                    onClick={() => alert('Simulating Chargebee Hosted Card Update workflow...')}
                    className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#015ba5] font-bold text-xs border border-slate-200 transition-all cursor-pointer"
                  >
                    + Update Credit Card
                  </button>
                </div>
              </div>

              {/* Danger Zone: Pause or Cancel */}
              <div className="rq-card p-5 border-l-4 border-l-rose-500">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f] mb-1">
                  Manage Subscription Status
                </h3>
                <p className="text-[11px] text-[#5c6678] mb-3">
                  Need to pause operations temporarily or cancel subscription?
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedSubForPause(selectedCustomerForPortal)}
                    className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#10233f] font-semibold text-xs border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Pause size={12} />
                    <span>Pause Subscription (60 Days)</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSubForRetention(selectedCustomerForPortal);
                      setRetentionStep('reason');
                    }}
                    className="w-full py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Cancel Subscription</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- VIEW 3: Chargebee Retention (Churn Deflection Engine) -------------------- */}
      {activeSubView === 'retention' && (
        <div className="space-y-4">
          <div className="rq-card p-5 bg-gradient-to-r from-purple-50/70 via-white to-pink-50/40 border-l-4 border-l-purple-600">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
                Chargebee Retention (ChurnDeflect AI)
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                Active Churn Shield
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-[#10233f]">
              Autonomous Churn Deflection &amp; Customer Retention Engine
            </h2>
            <p className="text-xs text-[#5c6678] mt-1 max-w-3xl leading-relaxed">
              When a subscriber clicks &quot;Cancel Subscription&quot;, Chargebee Retention intercepts with an exit survey and serves targeted high-converting save offers (e.g. 35% discount for 3 months, or 60-day pause) to prevent revenue loss.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rq-card p-4">
              <span className="text-[11px] font-bold text-[#5c6678] uppercase">Deflection Save Rate</span>
              <div className="text-3xl font-extrabold text-emerald-700 mt-1">84.6%</div>
              <span className="text-xs text-[#5c6678] mt-1 block">11 of 13 cancellation attempts retained</span>
            </div>

            <div className="rq-card p-4">
              <span className="text-[11px] font-bold text-[#5c6678] uppercase">Retained MRR Run-Rate</span>
              <div className="text-3xl font-extrabold text-purple-700 mt-1">$4,120/mo</div>
              <span className="text-xs text-[#5c6678] mt-1 block">Annualized savings: $49,440/yr ARR</span>
            </div>

            <div className="rq-card p-4">
              <span className="text-[11px] font-bold text-[#5c6678] uppercase">Top Save Offer</span>
              <div className="text-xl font-extrabold text-[#10233f] mt-1">35% Discount (3 Mo)</div>
              <span className="text-xs text-emerald-600 font-bold mt-1 block">68% acceptance rate</span>
            </div>
          </div>

          {/* Test Churn Deflection Flow */}
          <div className="rq-card p-5">
            <div className="flex items-center justify-between border-b border-[#dde1e9] pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#10233f]">Test Live Churn Deflection Experience</h3>
                <p className="text-xs text-[#5c6678]">Experience what your subscriber sees when attempting to cancel.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedSubForRetention(subscriptions[0]);
                  setRetentionStep('reason');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs border border-purple-300 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Zap size={13} className="text-purple-600" />
                <span>Simulate Retention Flow</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: 'Incentive 1: 35% Off for 3 Months', desc: 'Triggers when user selects "Pricing too high for our budget"', rate: '68% Win Rate' },
                { title: 'Incentive 2: 60-Day Free Seasonal Pause', desc: 'Triggers when user selects "Low usage / seasonal downtime"', rate: '22% Win Rate' },
                { title: 'Incentive 3: Downgrade to Starter Tier', desc: 'Triggers when user selects "Missing enterprise features"', rate: '10% Win Rate' },
              ].map((card, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/30">
                  <div className="text-xs font-bold text-purple-900">{card.title}</div>
                  <div className="text-[11px] text-[#5c6678] mt-1">{card.desc}</div>
                  <div className="mt-2 text-[10.5px] font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-300 inline-block">
                    {card.rate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- VIEW 4: Chargebee Hosted Checkout & Payment Links -------------------- */}
      {activeSubView === 'checkout' && (
        <div className="space-y-4">
          <div className="rq-card p-5 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/40 border-l-4 border-l-[#0176d3]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#015ba5] bg-[#eef4ff] px-2.5 py-0.5 rounded-full">
                Chargebee Hosted Pages &amp; Payment Links
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                Stripe &amp; Razorpay 1-Click Checkout
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-[#10233f]">
              Shareable Hosted Checkout Link Generator
            </h2>
            <p className="text-xs text-[#5c6678] mt-1 max-w-3xl leading-relaxed">
              Create instant, high-converting hosted subscription checkout links with automated coupon codes, add-ons, and multi-currency billing without writing code.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Configure Checkout Link */}
            <div className="rq-card p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#10233f] border-b border-[#dde1e9] pb-2">
                1. Configure Subscription Plan
              </h3>

              <div>
                <label className="text-xs font-semibold text-[#10233f] block mb-1.5">Select Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Starter', 'Professional', 'Enterprise Plus'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setCheckoutTier(t)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        checkoutTier === t
                          ? 'bg-[#eef4ff] border-[#0176d3] text-[#015ba5] font-bold ring-1 ring-[#0176d3]/30'
                          : 'bg-white border-[#dde1e9] text-[#5c6678] hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs">{t}</div>
                      <div className="text-xs font-mono font-bold mt-0.5">${TIER_PRICES[t]}/mo</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#10233f] block mb-1.5">Billing Frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCheckoutCadence('Monthly')}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      checkoutCadence === 'Monthly'
                        ? 'bg-[#eef4ff] border-[#0176d3] text-[#015ba5] font-bold'
                        : 'bg-white border-[#dde1e9] text-[#5c6678]'
                    }`}
                  >
                    Monthly (Standard)
                  </button>
                  <button
                    onClick={() => setCheckoutCadence('Annual')}
                    className={`p-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      checkoutCadence === 'Annual'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                        : 'bg-white border-[#dde1e9] text-[#5c6678]'
                    }`}
                  >
                    Annual (20% Off Incentive)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-[#dde1e9] bg-[#f8fafc]">
                <div>
                  <div className="text-xs font-bold text-[#10233f]">Include 24/7 Dedicated TAM Add-on</div>
                  <div className="text-[11px] text-[#5c6678]">+$150/mo priority response guarantee</div>
                </div>
                <input
                  type="checkbox"
                  checked={checkoutIncludeAddon}
                  onChange={(e) => setCheckoutIncludeAddon(e.target.checked)}
                  className="w-4 h-4 text-[#0176d3] rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#10233f] block mb-1">Pre-applied Coupon Code</label>
                <input
                  type="text"
                  value={checkoutCoupon}
                  onChange={(e) => setCheckoutCoupon(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-1.5 text-xs text-[#10233f] font-mono focus:border-[#0176d3] focus:outline-none"
                />
              </div>

              {/* Shareable Link Output */}
              <div className="pt-2 border-t border-[#dde1e9]">
                <div className="text-xs font-bold text-[#10233f] mb-1">Shareable Checkout URL:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://checkout.revx.io/p/${checkoutTier.toLowerCase()}_${checkoutCadence.toLowerCase()}?coupon=${checkoutCoupon}`}
                    className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 select-all"
                  />
                  <button
                    onClick={copyCheckoutUrl}
                    className="px-3 py-1.5 rounded-lg bg-[#0176d3] hover:bg-[#015ba5] text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Hosted Checkout Simulator */}
            <div className="rq-card p-5 bg-gradient-to-b from-white to-[#fbfcfe] border-2 border-[#0176d3]/40 shadow-lg">
              <div className="flex items-center justify-between border-b border-[#dde1e9] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <img src="/revx-logo.png" alt="RevX" className="h-6 w-auto object-contain" />
                  <span className="text-xs font-extrabold text-[#10233f]">Hosted Checkout Preview</span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  256-Bit SSL Encrypted
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#f0f7ff] rounded-xl border border-blue-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#015ba5]">{checkoutTier} Plan ({checkoutCadence})</div>
                    <div className="text-[10.5px] text-[#5c6678]">Billed {checkoutCadence.toLowerCase()}</div>
                  </div>
                  <div className="text-sm font-extrabold font-mono text-[#10233f]">
                    ${checkoutCadence === 'Annual' ? Math.round(TIER_PRICES[checkoutTier] * 0.8) : TIER_PRICES[checkoutTier]}/mo
                  </div>
                </div>

                {checkoutIncludeAddon && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-[#5c6678]">24/7 Priority SLA &amp; TAM Add-on</span>
                    <span className="font-mono font-bold text-[#10233f]">+$150/mo</span>
                  </div>
                )}

                {checkoutCoupon && (
                  <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between text-xs">
                    <span className="text-emerald-800 font-bold">Coupon Code: {checkoutCoupon}</span>
                    <span className="font-mono font-bold text-emerald-700">Applied</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[#dde1e9] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#10233f]">Total Due Today:</span>
                  <span className="text-lg font-black font-mono text-[#015ba5]">
                    ${(checkoutCadence === 'Annual' ? Math.round(TIER_PRICES[checkoutTier] * 0.8) : TIER_PRICES[checkoutTier]) + (checkoutIncludeAddon ? 150 : 0)}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <input
                    type="text"
                    readOnly
                    value="Card: 4242 •••• •••• 4242  (Stripe Instant Auth)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700"
                  />
                  <button
                    onClick={handleTestCheckout}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0176d3] to-[#0ea5e9] text-white font-extrabold text-xs shadow-md shadow-[#0176d3]/30 hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} />
                    <span>Subscribe Now &amp; Instant Activate</span>
                  </button>
                  {checkoutSuccessNotice && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold text-center animate-in fade-in">
                      ✓ Subscription Activated! New customer &amp; MRR added to Subscriptions 360.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- VIEW 5: Master Contracts (MSA) -------------------- */}
      {activeSubView === 'contracts' && (
        <div className="rq-card overflow-hidden">
          <div className="p-4 border-b border-[#dde1e9] flex items-center justify-between bg-[#fbfcfe]">
            <div className="flex items-center gap-2">
              <FileCheck2 size={16} className="text-[#0176d3]" />
              <h2 className="text-xs font-bold text-[#10233f] uppercase tracking-wider">
                Customer Master Service Agreements (MSA)
              </h2>
            </div>
            <span className="text-[11px] text-[#5c6678] font-semibold">
              {contracts.length} Master Service Agreements
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Contract #</th>
                  <th className="py-3 px-4">Customer Account</th>
                  <th className="py-3 px-4">Type &amp; Jurisdiction</th>
                  <th className="py-3 px-4">Contract Period</th>
                  <th className="py-3 px-4">Total Contract Value</th>
                  <th className="py-3 px-4">Auto-Renew Policy</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f7]">
                {contracts.map((con) => {
                  const convertedTCV = convertCurrency(con.totalContractValue, con.currency, currency);
                  return (
                    <tr key={con.id} className="hover:bg-[#f5f8fc] transition-colors duration-150 group">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0176d3] group-hover:text-[#014486]">
                        {con.contractNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#181c25]">
                        {con.accountName}
                      </td>
                      <td className="py-3.5 px-4 text-[#5c6678]">
                        <div className="font-medium text-[#10233f]">{con.contractType || 'Master Service Agreement (MSA)'}</div>
                        <div className="text-[10px] text-[#5c6678]">{con.governingLaw || 'Delaware, USA'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#5c6678] text-[11px]">
                        {con.startDate} → {con.endDate} ({con.contractTermMonths} mo)
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#10233f]">
                        {formatCurrency(convertedTCV, currency)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-500/20">
                          <Repeat size={11} />
                          <span>{con.autoRenew ? `Enabled (${con.noticePeriodDays || 30}d Notice)` : 'Manual'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                          <CheckCircle2 size={11} />
                          <span>{con.status}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setEditingContract(con)}
                          className="px-2.5 py-1 rounded bg-white hover:bg-blue-50 text-[#015ba5] text-xs font-semibold border border-[#dde1e9] hover:border-[#0176d3]/40 transition-all shadow-2xs flex items-center gap-1 ml-auto cursor-pointer"
                          title="Edit Contract Details"
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
      )}

      {/* -------------------- MODAL 1: Chargebee Proration & Plan Change -------------------- */}
      {selectedSubForProration && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-[#0176d3]" />
                <h3 className="text-sm font-bold text-[#10233f]">Chargebee Proration Calculator</h3>
              </div>
              <button onClick={() => setSelectedSubForProration(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <span className="text-[11px] text-[#5c6678]">Customer Account</span>
                <div className="text-sm font-extrabold text-[#10233f]">{selectedSubForProration.accountName}</div>
                <div className="text-xs text-slate-500">Current Plan: {selectedSubForProration.tier || 'Enterprise Plus'} (${selectedSubForProration.mrr}/mo)</div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#10233f] block mb-1">Select New Target Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Starter', 'Professional', 'Enterprise Plus'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTargetTier(t)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        targetTier === t
                          ? 'bg-[#eef4ff] border-[#0176d3] text-[#015ba5] font-bold ring-1 ring-[#0176d3]/30'
                          : 'bg-white border-[#dde1e9] text-[#5c6678]'
                      }`}
                    >
                      <div className="text-xs">{t}</div>
                      <div className="text-xs font-mono font-bold">${TIER_PRICES[t]}/mo</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chargebee Live Proration Math Preview */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-[#5c6678]">
                  <span>Cycle Days Remaining:</span>
                  <span className="font-bold">18 of 30 days</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Current Plan Unused Credit:</span>
                  <span>-${Math.round((selectedSubForProration.mrr / 30) * 18)}</span>
                </div>
                <div className="flex justify-between text-blue-700">
                  <span>New Plan Prorated Charge:</span>
                  <span>+${Math.round((TIER_PRICES[targetTier] / 30) * 18)}</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between font-bold text-sm text-[#10233f]">
                  <span>Net Prorated Adjustment Due:</span>
                  <span className="text-[#0176d3]">
                    {Math.round((TIER_PRICES[targetTier] / 30) * 18) - Math.round((selectedSubForProration.mrr / 30) * 18) >= 0 ? '+' : ''}
                    ${Math.round((TIER_PRICES[targetTier] / 30) * 18) - Math.round((selectedSubForProration.mrr / 30) * 18)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={applyProrationPlanChange}
                  className="w-full py-2.5 rounded-xl bg-[#0176d3] hover:bg-[#015ba5] text-white font-bold text-xs shadow-md shadow-[#0176d3]/20 transition-all cursor-pointer"
                >
                  Confirm Mid-Cycle Plan Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL 2: Chargebee Retention (Churn Deflection) -------------------- */}
      {selectedSubForRetention && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-[#dde1e9] bg-gradient-to-r from-purple-50 via-white to-pink-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-purple-600" />
                <h3 className="text-sm font-bold text-[#10233f]">Chargebee Retention Churn Shield</h3>
              </div>
              <button onClick={() => setSelectedSubForRetention(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {retentionStep === 'reason' && (
                <>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#10233f]">
                      Before you go, what is the main reason for cancelling?
                    </h4>
                    <p className="text-xs text-[#5c6678] mt-0.5">
                      Your feedback helps our automated retention AI tailor an appropriate relief offer.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {[
                      'Pricing too high for our current budget',
                      'Missing features required by our team',
                      'Temporary low seasonal usage / project on pause',
                      'Switching to competitor',
                    ].map((reason) => (
                      <label
                        key={reason}
                        onClick={() => setCancellationReason(reason)}
                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                          cancellationReason === reason
                            ? 'bg-purple-50/80 border-purple-400 text-purple-950 font-bold'
                            : 'bg-white border-[#dde1e9] text-[#5c6678] hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="churnReason"
                          checked={cancellationReason === reason}
                          onChange={() => setCancellationReason(reason)}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-xs">{reason}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setRetentionStep('offer')}
                      className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                      Continue → View Retention Offer
                    </button>
                  </div>
                </>
              )}

              {retentionStep === 'offer' && (
                <>
                  <div className="p-4 rounded-xl border border-purple-300 bg-purple-50 text-center space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-white px-2 py-0.5 rounded-full border border-purple-200">
                      Tailored Retention Save Offer
                    </span>
                    <h4 className="text-base font-black text-purple-950">
                      Stay with us &amp; get 35% OFF for the next 3 months!
                    </h4>
                    <p className="text-xs text-[#5c6678] leading-relaxed">
                      We value your partnership. Reduce your monthly invoice from{' '}
                      <span className="line-through font-mono font-bold">${selectedSubForRetention.mrr}</span> to{' '}
                      <span className="text-emerald-700 font-mono font-bold">${Math.round(selectedSubForRetention.mrr * 0.65)}/mo</span> immediately.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={acceptRetentionOffer}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={14} />
                      <span>Accept 35% Discount &amp; Keep Subscription</span>
                    </button>

                    <button
                      onClick={() => confirmCancellation(true)}
                      className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#5c6678] font-semibold text-xs border border-slate-200 transition-all cursor-pointer"
                    >
                      Cancel at End of Current Billing Term
                    </button>

                    <button
                      onClick={() => confirmCancellation(false)}
                      className="w-full py-1.5 text-[11px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Cancel Immediately (No Refund)
                    </button>
                  </div>
                </>
              )}

              {retentionStep === 'confirmed-save' && (
                <div className="py-8 text-center space-y-2 text-emerald-700">
                  <CheckCircle2 size={40} className="mx-auto" />
                  <div className="text-sm font-extrabold">Churn Deflected Successfully!</div>
                  <div className="text-xs text-[#5c6678]">35% discount applied. MRR and subscriber status protected.</div>
                </div>
              )}

              {retentionStep === 'confirmed-cancelled' && (
                <div className="py-8 text-center space-y-2 text-slate-600">
                  <X size={40} className="mx-auto text-rose-500" />
                  <div className="text-sm font-extrabold">Subscription Cancelled</div>
                  <div className="text-xs text-[#5c6678]">Cancellation record logged in audit trail.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL 3: Pause Subscription (Seasonal Pause) -------------------- */}
      {selectedSubForPause && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pause size={16} className="text-purple-600" />
                <h3 className="text-sm font-bold text-[#10233f]">Pause Subscription (Seasonal Hold)</h3>
              </div>
              <button onClick={() => setSelectedSubForPause(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-[#5c6678]">
                Temporarily pause billing for <strong className="text-[#10233f]">{selectedSubForPause.accountName}</strong>. Usage and invoices will be suspended until auto-resume date.
              </p>

              <div>
                <label className="text-xs font-semibold text-[#10233f] block mb-1.5">Pause Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {[30, 60, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => setPauseDurationDays(days)}
                      className={`p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        pauseDurationDays === days
                          ? 'bg-[#eef4ff] border-[#0176d3] text-[#015ba5]'
                          : 'bg-white border-[#dde1e9] text-[#5c6678]'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs font-mono text-purple-900">
                Auto-resumption date: <strong className="font-bold">{new Date(Date.now() + pauseDurationDays * 86400000).toISOString().split('T')[0]}</strong>
              </div>

              <button
                onClick={applyPauseSubscription}
                className="w-full py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Confirm Seasonal Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL 4: Apply Coupon Code -------------------- */}
      {selectedSubForCoupon && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-[#dde1e9] bg-[#f8fafc] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-[#0176d3]" />
                <h3 className="text-sm font-bold text-[#10233f]">Apply Promotional Coupon</h3>
              </div>
              <button onClick={() => setSelectedSubForCoupon(null)} className="text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#10233f] block mb-1">Coupon Code</label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-[#10233f] focus:border-[#0176d3] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#10233f] block mb-1">Discount Percentage (%)</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={couponDiscountPct}
                  onChange={(e) => setCouponDiscountPct(Number(e.target.value))}
                  className="w-full bg-[#f8fafc] border border-[#dde1e9] rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-[#10233f] focus:border-[#0176d3] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-mono text-emerald-900 flex justify-between">
                <span>New Monthly Price:</span>
                <strong className="font-bold">
                  ${Math.round(selectedSubForCoupon.mrr * ((100 - couponDiscountPct) / 100))}/mo
                </strong>
              </div>

              <button
                onClick={applyCouponCode}
                className="w-full py-2.5 rounded-xl bg-[#0176d3] hover:bg-[#015ba5] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Apply Coupon to Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {editingContract && onUpdateContract && (
        <EditContractModal
          contract={editingContract}
          currency={currency}
          onClose={() => setEditingContract(null)}
          onSave={onUpdateContract}
        />
      )}

      {editingSub && onUpdateSubscription && (
        <EditSubscriptionModal
          subscription={editingSub}
          currency={currency}
          onClose={() => setEditingSub(null)}
          onSave={onUpdateSubscription}
        />
      )}
    </div>
  );
};
