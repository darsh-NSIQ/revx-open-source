import React from 'react';
import {
  Home,
  Target,
  Building2,
  Users,
  Layers,
  CheckCircle2,
  Share2,
  FileSignature,
  Package,
  FileCheck2,
  Network,
  Activity,
  Receipt,
  ShieldAlert,
  PieChart,
  BarChart3,
  Settings,
  LucideIcon
} from 'lucide-react';

export interface Q2CModule {
  id: string;
  label: string;
  stageId: 'crm' | 'cpq' | 'fulfillment' | 'billing' | 'finance' | 'core';
  stageNumber: number;
  seqNumber: string;
  badge?: string;
  icon: LucideIcon;
  desc: string;
  useCase: string;
  inputs: string;
  outputs: string;
  persona: string;
  competitorBenchmark: string;
}

export interface Q2CStageInfo {
  id: 'all' | 'crm' | 'cpq' | 'fulfillment' | 'billing' | 'finance';
  number?: number;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderActive: string;
  moduleIds: string[];
}

export const Q2C_STAGES: Q2CStageInfo[] = [
  {
    id: 'all',
    label: 'All Modules',
    shortLabel: 'All (18)',
    description: 'Complete End-to-End Enterprise Quote-to-Cash (Q2C) Platform',
    color: '#0176d3',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    borderActive: 'border-[#0176d3]',
    moduleIds: [
      'command-center',
      'leads',
      'accounts',
      'contacts',
      'opportunities',
      'quotes',
      'approvals',
      'dealroom',
      'esign',
      'orders',
      'contracts',
      'hierarchy',
      'metering',
      'invoices',
      'collect',
      'revrec',
      'war-room',
      'setup'
    ]
  },
  {
    id: 'crm',
    number: 1,
    label: '1. Lead-to-Opportunity',
    shortLabel: '1. CRM & Deals',
    description: 'Inbound prospecting, account hierarchies, buyer stakeholder mapping, and sales pipeline',
    color: '#0284c7', // sky
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    borderActive: 'border-sky-500',
    moduleIds: ['leads', 'accounts', 'contacts', 'opportunities']
  },
  {
    id: 'cpq',
    number: 2,
    label: '2. Configure, Price, Quote',
    shortLabel: '2. CPQ & Closing',
    description: 'Tiered CPQ pricing rules, margin approval matrices, interactive DealRooms, and cryptographic eSign',
    color: '#7c3aed', // violet
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    borderActive: 'border-purple-500',
    moduleIds: ['quotes', 'approvals', 'dealroom', 'esign']
  },
  {
    id: 'fulfillment',
    number: 3,
    label: '3. Orders & Subscriptions',
    shortLabel: '3. Orders & Subs',
    description: 'Order provisioning, subscription lifecycle with automated proration, and multi-entity billing trees',
    color: '#059669', // emerald
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    borderActive: 'border-emerald-500',
    moduleIds: ['orders', 'contracts', 'hierarchy']
  },
  {
    id: 'billing',
    number: 4,
    label: '4. Billing & Collections',
    shortLabel: '4. Billing & Cash',
    description: 'Real-time usage event mediation, GST tax invoices with 64-char NIC IRN, and ML dunning recovery',
    color: '#d97706', // amber
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    borderActive: 'border-amber-500',
    moduleIds: ['metering', 'invoices', 'collect']
  },
  {
    id: 'finance',
    number: 5,
    label: '5. Revenue & Governance',
    shortLabel: '5. RevRec & Exec',
    description: 'ASC 606 ratable revenue recognition, executive churn/retention war room, and system setup',
    color: '#dc2626', // rose
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    borderActive: 'border-rose-500',
    moduleIds: ['revrec', 'war-room', 'setup']
  }
];

export const Q2C_MODULES: Q2CModule[] = [
  // Overview Cockpit
  {
    id: 'command-center',
    label: 'Home',
    stageId: 'core',
    stageNumber: 0,
    seqNumber: '0.0',
    badge: 'Live',
    icon: Home,
    desc: 'Revenue Command Center & Live Pipeline KPIs',
    useCase: 'Consolidated executive dashboard showing real-time pipeline velocity, outstanding ARR, active quote-to-order conversions, and immediate operational action items.',
    inputs: 'Aggregated cross-platform live telemetry',
    outputs: 'Executive visibility, 1-click deal approvals, pipeline health score',
    persona: 'Chief Revenue Officer (CRO), VP of Sales, RevOps Lead',
    competitorBenchmark: 'Salesforce Executive Command Center / Clari Revenue Cadence'
  },

  // STAGE 1: CRM & Pipeline
  {
    id: 'leads',
    label: 'Leads',
    stageId: 'crm',
    stageNumber: 1,
    seqNumber: '1.1',
    badge: 'Lead Gen',
    icon: Target,
    desc: 'Inbound prospect qualification & conversion pipeline',
    useCase: 'Capture inbound marketing prospects, evaluate enterprise intent and budget, and convert qualified prospects into Account, Contact, and Opportunity records in a single click.',
    inputs: 'Inbound web forms, marketing campaigns, outbound SDR prospecting',
    outputs: 'Verified Account, Contact, and active Sales Opportunity',
    persona: 'Sales Development Reps (SDR), Marketing Ops',
    competitorBenchmark: 'Salesforce Sales Cloud Lead Management'
  },
  {
    id: 'accounts',
    label: 'Accounts',
    stageId: 'crm',
    stageNumber: 1,
    seqNumber: '1.2',
    badge: 'CRM',
    icon: Building2,
    desc: 'Enterprise accounts & Quote-to-Cash related lists',
    useCase: 'Master repository of enterprise customers, holding complete 360-degree relationship records with linked Contacts, Opportunities, Quotes, Orders, Contracts, and Invoices.',
    inputs: 'Converted Leads, enterprise customer onboarding',
    outputs: 'Customer Account 360 context and parent-child hierarchy linkage',
    persona: 'Account Executives (AE), Customer Success Managers (CSM)',
    competitorBenchmark: 'Salesforce Account 360 / Microsoft Dynamics 365'
  },
  {
    id: 'contacts',
    label: 'Contacts',
    stageId: 'crm',
    stageNumber: 1,
    seqNumber: '1.3',
    badge: 'CRM',
    icon: Users,
    desc: 'Decision makers & authorized signatories',
    useCase: 'Map key enterprise stakeholders, buying champions, economic buyers, and authorized signatories required for legally binding quote approvals and cryptographic e-signatures.',
    inputs: 'Enterprise customer discovery, LinkedIn sales navigator',
    outputs: 'Designated signers and billing notification recipients',
    persona: 'Account Executives, Procurement Specialists',
    competitorBenchmark: 'Salesforce Contact Roles & Buying Committees'
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    stageId: 'crm',
    stageNumber: 1,
    seqNumber: '1.4',
    badge: 'Pipeline',
    icon: Target,
    desc: 'Enterprise deal pipeline & Kanban progression',
    useCase: 'Manage qualified deals through weighted sales stages (Discovery, Solution, Pricing, Negotiation, Won) with Kanban drag-and-drop and instant 1-click CPQ quote launching.',
    inputs: 'Qualified leads, account expansion initiatives',
    outputs: 'Structured deal requirements ready for CPQ quoting',
    persona: 'Account Executives, Sales Managers',
    competitorBenchmark: 'Salesforce Opportunity Kanban & Pipeline Inspection'
  },

  // STAGE 2: CPQ & Deal Closing
  {
    id: 'quotes',
    label: 'Quotes',
    stageId: 'cpq',
    stageNumber: 2,
    seqNumber: '2.1',
    badge: 'CPQ',
    icon: Layers,
    desc: 'Tiered CPQ quote builder & margin governance',
    useCase: 'Configure complex multi-product software & service bundles, enforce pricing tiers, calculate ACV/TCV, protect gross margin floors, and render pixel-perfect proposal PDFs.',
    inputs: 'Opportunity parameters, customer licensing needs',
    outputs: 'Approved pricing proposal, line items, and contractual pricing terms',
    persona: 'Sales Engineers, Pricing Analysts, Deal Desk',
    competitorBenchmark: 'Salesforce CPQ / DealHub CPQ / Oracle CPQ Cloud'
  },
  {
    id: 'approvals',
    label: 'Approvals',
    stageId: 'cpq',
    stageNumber: 2,
    seqNumber: '2.2',
    badge: 'Oracle',
    icon: CheckCircle2,
    desc: 'Multi-tier discount approval matrix & margin floor governance',
    useCase: 'Automate hierarchical governance (Director, VP Sales, CFO) when commercial discounts breach margin rules, ensuring zero unapproved revenue leakages.',
    inputs: 'Quotes submitted with discount rates exceeding tier allowances',
    outputs: 'Cryptographically timestamped approval or rejection with audit log',
    persona: 'Sales Directors, VP of Sales, Chief Financial Officer (CFO)',
    competitorBenchmark: 'Oracle CPQ Approval Matrix & Governance Engine'
  },
  {
    id: 'dealroom',
    label: 'DealRoom',
    stageId: 'cpq',
    stageNumber: 2,
    seqNumber: '2.3',
    badge: 'DealHub',
    icon: Share2,
    desc: 'Interactive buyer microsites & engagement telemetry',
    useCase: 'Provide enterprise buyers with an interactive digital sales room where they can dynamically simulate seat tiers, review executive proposals, and execute mutual action plans.',
    inputs: 'Active CPQ Quote and buyer stakeholder list',
    outputs: 'Buyer interaction telemetry, engagement scores, and commercial alignment',
    persona: 'Account Executives, Enterprise Buyers, Procurement',
    competitorBenchmark: 'DealHub DealRoom™ / Trumpet / Dock'
  },
  {
    id: 'esign',
    label: 'eSign Studio',
    stageId: 'cpq',
    stageNumber: 2,
    seqNumber: '2.4',
    badge: 'SHA-256',
    icon: FileSignature,
    desc: 'Tamper-proof digital signatures & audit trails',
    useCase: 'Execute legally admissible digital contracts with cryptographic SHA-256 checksums, signer IP/timestamp capture, and compliant audit certificates.',
    inputs: 'Approved quote proposal or master service agreement (MSA)',
    outputs: 'Fully executed contract with cryptographic proof, triggering order generation',
    persona: 'Enterprise Signatories, Corporate Legal, Deal Desk',
    competitorBenchmark: 'DocuSign / Adobe Sign / DealHub Native eSign'
  },

  // STAGE 3: Orders & Subscriptions
  {
    id: 'orders',
    label: 'Orders',
    stageId: 'fulfillment',
    stageNumber: 3,
    seqNumber: '3.1',
    badge: 'Fulfillment',
    icon: Package,
    desc: 'Provisioned customer orders & activation',
    useCase: 'Automatically ingest signed quotes into provisioned enterprise orders, allocate software licenses, schedule activations, and send fulfillment events to downstream billing.',
    inputs: 'Cryptographically signed Quote / Contract',
    outputs: 'Provisioned order records, license keys, and billing triggers',
    persona: 'Order Operations, Provisioning Engineers, RevOps',
    competitorBenchmark: 'Salesforce Order Management (SOM) / Oracle Fusion OM'
  },
  {
    id: 'contracts',
    label: 'Contracts & Subscriptions',
    stageId: 'fulfillment',
    stageNumber: 3,
    seqNumber: '3.2',
    badge: 'Chargebee',
    icon: FileCheck2,
    desc: 'Chargebee proration, pause, customer portal & retention',
    useCase: 'Manage the recurring subscription lifecycle: automated midterm upgrades, prorated billing adjustments, subscription pauses, and renewal coterming.',
    inputs: 'Provisioned order and customer subscription plan',
    outputs: 'Active subscription state, recurring billing schedule, renewal dates',
    persona: 'Subscription Operations, Customer Success, Billing Specialist',
    competitorBenchmark: 'Chargebee Subscription Cloud / Zuora Billing Engine'
  },
  {
    id: 'hierarchy',
    label: 'Account Hierarchy',
    stageId: 'fulfillment',
    stageNumber: 3,
    seqNumber: '3.3',
    badge: 'BillingPlatform',
    icon: Network,
    desc: 'Multi-entity parent-child consolidation & dynamic rating',
    useCase: 'Model complex enterprise global structures (holding companies, regional subsidiaries, cost centers) with flexible consolidated rollup or decentralized split billing.',
    inputs: 'Enterprise corporate tree and subsidiary billing requirements',
    outputs: 'Consolidated invoices or branch-level decoupled billing runs',
    persona: 'Enterprise Billing Architect, Global Controller',
    competitorBenchmark: 'BillingPlatform™ Complex Enterprise Account Hierarchy'
  },

  // STAGE 4: Billing & Collections
  {
    id: 'metering',
    label: 'Usage Metering',
    stageId: 'billing',
    stageNumber: 4,
    seqNumber: '4.1',
    badge: 'Zuora+',
    icon: Activity,
    desc: 'Real-time event mediation & commitment drawdown',
    useCase: 'Ingest millions of high-frequency consumption events (API requests, compute minutes, storage GB), execute tiered usage rating, and drawdown prepaid commitments.',
    inputs: 'Product usage telemetry streams, API usage pings',
    outputs: 'Rated usage billable line items and threshold alerts',
    persona: 'Data Platform Engineers, Usage Billing Specialists',
    competitorBenchmark: 'Zuora Usage Mediation / Stripe Usage Metering'
  },
  {
    id: 'invoices',
    label: 'Invoices',
    stageId: 'billing',
    stageNumber: 4,
    seqNumber: '4.2',
    badge: 'GST',
    icon: Receipt,
    desc: 'Indian GST tax invoices with 64-char NIC IRN',
    useCase: 'Generate GST-compliant tax invoices (CGST, SGST, IGST), execute real-time NIC portal cryptographic IRN generation, and embed QR codes for statutory audit compliance.',
    inputs: 'Orders, recurring subscriptions, and rated usage line items',
    outputs: 'Statutory e-Invoices with 64-char IRN, QR code, and payment gateway links',
    persona: 'Accounts Receivable (AR), Corporate Tax Controller',
    competitorBenchmark: 'NetSuite SuiteBilling / Indian GST NIC Portal'
  },
  {
    id: 'collect',
    label: 'Collections & Dunning',
    stageId: 'billing',
    stageNumber: 4,
    seqNumber: '4.3',
    badge: 'ML',
    icon: ShieldAlert,
    desc: 'Smart retry cadence & multi-gateway failover',
    useCase: 'Recover failed subscription payments using machine-learning retry cadences, automated multi-gateway failovers, tiered dunning emails, and DSO minimization.',
    inputs: 'Declined or overdue invoice records',
    outputs: 'Recovered cash transactions, updated invoice statuses, un-paused accounts',
    persona: 'Collections Specialists, AR Managers, Risk Analysts',
    competitorBenchmark: 'Stripe Smart Retries / Churn Buster / Zuora Collect'
  },

  // STAGE 5: Revenue & Compliance
  {
    id: 'revrec',
    label: 'Revenue (ASC 606)',
    stageId: 'finance',
    stageNumber: 5,
    seqNumber: '5.1',
    badge: 'ASC 606',
    icon: PieChart,
    desc: 'ASC 606 / IFRS 15 ratable revenue amortization',
    useCase: 'Deconstruct multi-element enterprise contracts into distinct Performance Obligations (POBs), calculate Standalone Selling Price (SSP), and automate ratable amortization waterfall schedules.',
    inputs: 'Invoiced orders, active contracts, delivery milestones',
    outputs: 'Ratable revenue schedules, deferred revenue balance, journal entry audit ledger',
    persona: 'Revenue Accounting Manager, Chief Accounting Officer (CAO), External Auditors',
    competitorBenchmark: 'Zuora RevPro / NetSuite Advanced Revenue Management (ARM)'
  },
  {
    id: 'war-room',
    label: 'Executive War Room',
    stageId: 'finance',
    stageNumber: 5,
    seqNumber: '5.2',
    badge: 'Strategic',
    icon: BarChart3,
    desc: 'Cohort retention, churn alerts, and forecasting',
    useCase: 'Provide C-level executives with strategic revenue intelligence: cohort net retention curves, machine learning churn risk scoring, LTV:CAC ratios, and dynamic ARR forecasting.',
    inputs: 'Unified Q2C historical transaction data',
    outputs: 'Executive board decks, churn mitigation alerts, capacity forecasts',
    persona: 'CEO, CFO, CRO, Board Members',
    competitorBenchmark: 'Gainsight / Planhat / ChartMogul Executive Cockpit'
  },
  {
    id: 'setup',
    label: 'Setup',
    stageId: 'finance',
    stageNumber: 5,
    seqNumber: '5.3',
    badge: 'Config',
    icon: Settings,
    desc: 'System preferences, factory reset, and JSON export',
    useCase: 'Configure global business rules, tax entity GSTIN settings, pricing governance tiers, export the complete enterprise state as JSON, and maintain enterprise baseline data.',
    inputs: 'System Administrator configuration choices',
    outputs: 'Global application environment parameters and persisted state backup',
    persona: 'System Administrators, RevOps Architects',
    competitorBenchmark: 'Salesforce Setup / Oracle Cloud Enterprise Administration'
  }
];

export const getStageForTab = (tabId: string): Q2CStageInfo => {
  for (const stage of Q2C_STAGES) {
    if (stage.id !== 'all' && stage.moduleIds.includes(tabId)) {
      return stage;
    }
  }
  return Q2C_STAGES[0]; // fallback
};
