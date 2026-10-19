import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Minus, 
  ShieldCheck, 
  Zap, 
  DollarSign, 
  TrendingUp, 
  Lock, 
  Layers, 
  Building2,
  FileSignature,
  Activity,
  ShieldAlert,
  Share2,
  Sliders,
  Network
} from 'lucide-react';

interface CompetitorMatrixModalProps {
  onClose: () => void;
  onRunDemoFlow?: () => void;
}

type CompetitorFilter = 'all' | 'zuora' | 'chargebee' | 'oracle' | 'dealhub' | 'billingplatform';

export const CompetitorMatrixModal: React.FC<CompetitorMatrixModalProps> = ({ 
  onClose,
  onRunDemoFlow 
}) => {
  const [activeFilter, setActiveFilter] = useState<CompetitorFilter>('all');

  const allCapabilities = [
    {
      category: 'Interactive Digital DealRoom & Telemetry',
      feature: 'Interactive buyer microsites, live seat/ARR calculators, collaborative Mutual Action Plans (MAP), and real-time viewing telemetry',
      revx: 'Native DealRoom Studio Built-in ($0)',
      competitorScores: {
        dealhub: 'Core DealRoom Platform ($60 - $90/user/mo)',
        oracle: 'None (Static proposals only)',
        zuora: 'None (Relies on 3rd party tools)',
        chargebee: 'Basic Hosted Pages (No buyer DealRoom)',
        billingplatform: 'None (Back-office billing only)'
      },
      advantage: 'Sales reps send interactive microsites where buyers can adjust sliders, complete security checklists, and eSign in real-time.'
    },
    {
      category: 'Multi-Tier Approvals & Margin Governance',
      feature: 'Dynamic approval chains (<15% auto, 15-25% Director, 25-40% VP, >40% CFO), gross margin floor enforcement, and COGS guardrails',
      revx: 'Native Approval Matrix Engine Built-in ($0)',
      competitorScores: {
        oracle: 'Oracle CPQ Approval Matrix ($130 - $240/user/mo)',
        dealhub: 'Basic 1-2 tier discount approvals',
        zuora: 'Basic workflow notifications',
        chargebee: 'No enterprise multi-tier approval matrix',
        billingplatform: 'Basic billing approval rules'
      },
      advantage: 'Protects enterprise gross margins with automated routing to Directors, VPs, and CFOs with instant cryptographic approval audit trails.'
    },
    {
      category: 'Multi-Entity Account Hierarchy & Consolidation',
      feature: 'Parent-child organizational trees (Global Holding HQ -> Operating Corps -> Subsidiaries) with consolidated or split invoicing',
      revx: 'Native Account Hierarchy Studio Built-in ($0)',
      competitorScores: {
        billingplatform: 'Core Multi-Entity Hierarchy ($50k+/yr platform)',
        zuora: 'Zuora Billing Parent-Child (Enterprise tier add-on)',
        chargebee: 'Limited parent-child billing accounts',
        oracle: 'Requires heavy Oracle Fusion ERP integration',
        dealhub: 'Not applicable (CPQ front-end only)'
      },
      advantage: 'Enables flexible enterprise rollups: choose between single consolidated holding invoices or independent localized subsidiary billing.'
    },
    {
      category: 'Dynamic Multi-Metric Rating Models',
      feature: 'Graduated tiered volume discount slabs, Peak vs Off-Peak time-of-day multipliers, and attribute-based GPU/regional mediation',
      revx: 'Native Dynamic Rating Engine Built-in ($0)',
      competitorScores: {
        billingplatform: 'Dynamic Rating Engine ($40k+/yr add-on)',
        zuora: 'Zuora Metering & Rating ($25k+/yr module)',
        chargebee: 'Basic metered tiering + 0.75% take-rate',
        oracle: 'Not supported (requires Billing engine)',
        dealhub: 'Not applicable (CPQ front-end only)'
      },
      advantage: 'Unifies both complex consumption rating formulas and stepped multi-year CPQ ramp deals in a single unified architecture.'
    },
    {
      category: 'Subscription Lifecycle, Proration & Pauses',
      feature: 'Instant daily proration calculations, seasonal pause/resume scheduling, grandfathered price locking, and coupons',
      revx: 'Native Subscription 360 & Portal ($0)',
      competitorScores: {
        chargebee: 'Core Billing ($249 - $599/mo + 0.75-1.25% revenue cut)',
        zuora: 'Zuora Orders & Billing ($20k+/yr module)',
        oracle: 'Complex CPQ order amendments',
        dealhub: 'Basic renewal CPQ quoting',
        billingplatform: 'Supported in enterprise billing edition'
      },
      advantage: 'Chargebee-grade proration math, scheduled pause dates, and locked grandfathered rates without paying any take-rate cut on revenue.'
    },
    {
      category: 'Customer Retention & Churn Deflection',
      feature: 'Exit cancellation surveys, automated dynamic save incentives (35% off 3 mos, 60-day freeze), and deflection telemetry',
      revx: 'Native Retention Studio Built-in ($0)',
      competitorScores: {
        chargebee: 'Chargebee Retention ($9,000 - $18,000/yr add-on)',
        zuora: 'Not available (requires Churnkey/ProsperStack)',
        oracle: 'Not available in Oracle CPQ',
        dealhub: 'Not available in DealHub',
        billingplatform: 'Not available'
      },
      advantage: 'Recovers up to 34% of churning subscriptions automatically with customizable deflection offers at zero incremental cost.'
    },
    {
      category: 'Collections & ML Smart Dunning',
      feature: '3-stage automated dunning cadence, optimal banking retry prediction, and multi-gateway failover (Stripe ↔ Razorpay)',
      revx: 'Native Collect Studio Built-in ($0)',
      competitorScores: {
        zuora: 'Zuora Collect ($20k+/yr add-on module)',
        chargebee: 'Smart Dunning (included in high tiers + gateway fees)',
        oracle: 'Requires Oracle Financials middleware',
        dealhub: 'Not applicable',
        billingplatform: 'Standard collections scheduler'
      },
      advantage: 'Cuts involuntary churn by up to 89.2% without paying $20k/yr for separate collections automation software.'
    },
    {
      category: 'ASC 606 / IFRS 15 Revenue Recognition',
      feature: '5-step standalone selling price (SSP) allocation, POB carving, contract liability ledgers & 12-month amortization waterfalls',
      revx: 'Native Audit-Ready Ledger Built-in ($0)',
      competitorScores: {
        zuora: 'Zuora Revenue / RevPro ($35k - $60k/yr)',
        chargebee: 'Chargebee RevRec ($12k - $24k/yr add-on)',
        oracle: 'Requires separate Oracle Fusion RevRec ($$$)',
        dealhub: 'Not applicable',
        billingplatform: 'Supported in high-tier finance package'
      },
      advantage: 'Delivers boardroom-ready GAAP revenue amortization waterfalls with complete audit trails without buying separate RevPro licenses.'
    },
    {
      category: 'Indian GST & NIC IRN E-Invoicing',
      feature: '18% GST automatic breakdown, 64-char cryptographically signed NIC IRN hash, and B2B signed QR code generation',
      revx: 'Native IRN & GST Engine Built-in ($0)',
      competitorScores: {
        zuora: 'None (Requires ClearTax / Avalara connector)',
        chargebee: 'Basic GST (No direct NIC IRN engine)',
        oracle: 'Requires expensive India localization pack',
        dealhub: 'None',
        billingplatform: 'None'
      },
      advantage: 'Immediate out-of-the-box compliance for Indian enterprises and global SaaS companies billing in India.'
    },
    {
      category: 'Native Cryptographic eSign Suite',
      feature: 'SHA-256 canvas e-signatures, tamper-evident seals & digital Completion Certificates',
      revx: 'Free & Unlimited ($0/envelope)',
      competitorScores: {
        dealhub: 'DealHub eSign (Included in CPQ per-user fee)',
        oracle: 'Requires DocuSign ($3-$5/envelope + $40/user/mo)',
        zuora: 'Requires DocuSign ($3-$5/envelope)',
        chargebee: 'Requires DocuSign / PandaDoc',
        billingplatform: 'Requires DocuSign integration'
      },
      advantage: 'Saves $25,000 - $60,000/year for 100 enterprise reps by removing third-party envelope taxes completely.'
    },
    {
      category: 'Platform Licensing & Revenue Take-Rate',
      feature: 'Total platform license cost and transaction percentage cut on gross merchandise value (GMV)',
      revx: '$0 Platform Fee & 0% Take-Rate (100% Free & Open-Source)',
      competitorScores: {
        chargebee: '$249 - $1,199/mo base + 0.75% to 1.25% revenue cut',
        zuora: '$60k - $120k/yr platform fee + % GMV take-rate',
        oracle: '$130 - $240 / user / mo + implementation ($80k+)',
        dealhub: '$60 - $90 / user / mo platform subscription',
        billingplatform: '$50,000 - $100,000+/yr platform license'
      },
      advantage: 'Zero vendor lock-in, zero per-seat tax, and zero take-rate cut on your gross business revenue.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10233f]/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#dde1e9] w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#dde1e9] bg-gradient-to-r from-[#eef4ff] via-white to-[#fbf8fe] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0176d3] to-[#7c3aed] text-white flex items-center justify-center shadow-sm shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-[#10233f]">
                  RevX vs Zuora, Chargebee, Oracle CPQ, DealHub &amp; BillingPlatform
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-500/25">
                  5-in-1 Unified Superset OS
                </span>
              </div>
              <p className="text-xs text-[#5c6678] mt-0.5">
                RevX combines the best of all 5 leading monetization platforms into a single 100% open-source stack with $0 platform tax.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c6678] hover:text-[#181c25] hover:bg-white border border-transparent hover:border-[#dde1e9] transition-all shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filter Toolbar & Cost Savings Highlights */}
        <div className="px-4 sm:px-6 py-3 bg-[#fafbfd] border-b border-[#dde1e9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#5c6678] mr-1">Focus Filter:</span>
            {[
              { id: 'all', label: 'All 5 Platforms Overview' },
              { id: 'zuora', label: 'vs Zuora' },
              { id: 'chargebee', label: 'vs Chargebee' },
              { id: 'oracle', label: 'vs Oracle CPQ' },
              { id: 'dealhub', label: 'vs DealHub' },
              { id: 'billingplatform', label: 'vs BillingPlatform' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as CompetitorFilter)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-[#0176d3] text-white shadow-xs'
                    : 'bg-white text-[#5c6678] border border-[#dde1e9] hover:text-[#181c25]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-emerald-800 font-bold text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 rq-pulse-dot" />
            <span>Avoids $80k-$200k/yr in combined SaaS subscription and take-rate fees</span>
          </div>
        </div>

        {/* Comparison Matrix Table */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="border border-[#dde1e9] rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead className="bg-[#f8fafc] text-[#5c6678] border-b border-[#dde1e9] font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="py-3 px-3.5 w-[25%]">Capability Dimension</th>
                  <th className="py-3 px-3.5 w-[25%] bg-[#eef4ff] text-[#015ba5] font-extrabold">
                    RevX (Unified Open-Source Architecture)
                  </th>
                  {activeFilter === 'all' ? (
                    <>
                      <th className="py-3 px-3 w-[10%]">DealHub</th>
                      <th className="py-3 px-3 w-[10%]">Oracle CPQ</th>
                      <th className="py-3 px-3 w-[10%]">BillingPlatform</th>
                      <th className="py-3 px-3 w-[10%]">Chargebee</th>
                      <th className="py-3 px-3 w-[10%]">Zuora</th>
                    </>
                  ) : (
                    <th className="py-3 px-4 w-[50%]">
                      {activeFilter === 'dealhub' && 'DealHub.io Digital Sales Room & CPQ'}
                      {activeFilter === 'oracle' && 'Oracle CPQ Cloud & Fusion Monetization'}
                      {activeFilter === 'billingplatform' && 'BillingPlatform Dynamic Rating & Hierarchy'}
                      {activeFilter === 'chargebee' && 'Chargebee Subscription Suite & Retention'}
                      {activeFilter === 'zuora' && 'Zuora Billing, Collect, Metering & RevPro'}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f7]">
                {allCapabilities.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#fafcff] transition-colors">
                    <td className="py-3.5 px-3.5">
                      <div className="font-bold text-[#10233f] text-xs">{item.category}</div>
                      <div className="text-[11px] text-[#5c6678] mt-0.5 leading-snug">{item.feature}</div>
                      <div className="text-[10px] text-[#015ba5] font-semibold mt-1 bg-[#eef4ff] p-1.5 rounded border border-[#0176d3]/15">
                        💡 {item.advantage}
                      </div>
                    </td>

                    {/* RevX Column */}
                    <td className="py-3.5 px-3.5 bg-[#eef4ff]/40 font-bold text-[#015ba5]">
                      <div className="flex items-center gap-1.5 text-emerald-700">
                        <Check size={14} strokeWidth={3} className="shrink-0" />
                        <span>{item.revx}</span>
                      </div>
                    </td>

                    {/* All Competitors View */}
                    {activeFilter === 'all' && (
                      <>
                        <td className="py-3.5 px-3 text-[#5c6678] text-[11px]">
                          {item.competitorScores.dealhub.includes('None') || item.competitorScores.dealhub.includes('Not applicable') ? (
                            <span className="text-slate-400 font-medium">None</span>
                          ) : (
                            <span className="text-purple-800 font-semibold">{item.competitorScores.dealhub.split('(')[0]}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-[#5c6678] text-[11px]">
                          {item.competitorScores.oracle.includes('None') || item.competitorScores.oracle.includes('Not supported') ? (
                            <span className="text-slate-400 font-medium">None</span>
                          ) : (
                            <span className="text-blue-800 font-semibold">{item.competitorScores.oracle.split('(')[0]}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-[#5c6678] text-[11px]">
                          {item.competitorScores.billingplatform.includes('None') ? (
                            <span className="text-slate-400 font-medium">None</span>
                          ) : (
                            <span className="text-indigo-800 font-semibold">{item.competitorScores.billingplatform.split('(')[0]}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-[#5c6678] text-[11px]">
                          {item.competitorScores.chargebee.includes('None') ? (
                            <span className="text-slate-400 font-medium">None</span>
                          ) : (
                            <span className="text-amber-800 font-semibold">{item.competitorScores.chargebee.split('(')[0]}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-[#5c6678] text-[11px]">
                          {item.competitorScores.zuora.includes('None') ? (
                            <span className="text-slate-400 font-medium">None</span>
                          ) : (
                            <span className="text-cyan-800 font-semibold">{item.competitorScores.zuora.split('(')[0]}</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Single Competitor Filter View */}
                    {activeFilter !== 'all' && (
                      <td className="py-3.5 px-4 text-[#5c6678] text-xs">
                        <div className="font-semibold text-[#181c25]">
                          {item.competitorScores[activeFilter]}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#dde1e9] bg-[#fbfcfe] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-[#5c6678]">
            Status: <span className="text-emerald-700 font-bold">100% Operational In RevX Revenue Cloud</span> (Zuora + Chargebee + Oracle + DealHub + BillingPlatform)
          </span>
          <div className="flex items-center gap-2">
            {onRunDemoFlow && (
              <button
                onClick={() => {
                  onClose();
                  onRunDemoFlow();
                }}
                className="rq-btn-primary text-xs"
              >
                <Zap size={13} />
                <span>Execute Live Q2C Master Pipeline →</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rq-btn-secondary text-xs"
            >
              Close Matrix
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
