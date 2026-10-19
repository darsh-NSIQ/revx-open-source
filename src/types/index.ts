export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: 'Subscription' | 'Usage' | 'One-Time' | 'Add-on';
  basePrice: number;
  cogs: number; // Cost of goods sold for margin modeling
  description: string;
  billingFrequency: 'Monthly' | 'Annual' | 'Usage-based' | 'One-off';
  tierPricing?: { minQty: number; maxQty: number; unitPrice: number }[];
  isBundle?: boolean;
  includedItems?: string[];
  hsnCode?: string;
  gstRate?: number; // percentage (e.g. 18)
  accountingCode?: string;
}

export interface QuoteLineItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  totalPrice: number;
  marginPct: number;
  hsnCode?: string;
  servicePeriod?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
  hash?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface RampInterval {
  year: number;
  periodLabel: string;
  startDate: string;
  endDate: string;
  committedSeats: number;
  unitPrice: number;
  discountPct: number;
  subtotal: number;
  annualARR: number;
}

// ==========================================
// Core CRM Objects: Account, Contact, Lead
// ==========================================
export interface Account {
  id: string;
  name: string;
  accountNumber: string;
  industry: 'Software & Technology' | 'Financial Services' | 'Healthcare' | 'Retail & E-Commerce' | 'Aerospace' | 'Manufacturing';
  type: 'Customer' | 'Prospect' | 'Enterprise Partner' | 'Strategic Account';
  annualRevenue: number;
  currency: Currency;
  website: string;
  phone: string;
  ownerName: string;
  tier: 'Tier 1 Strategic' | 'Tier 2 Mid-Market' | 'Tier 3 Emerging';
  healthScore: number; // 0 - 100
  billingAddress: Address;
  shippingAddress?: Address;
  parentAccountId?: string;
  parentAccountName?: string;
  taxRegistrationNumber?: string;
  createdAt: string;
  notes?: string;
}

export interface Contact {
  id: string;
  accountId: string;
  accountName: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  title: string;
  department: 'Executive' | 'Engineering' | 'Finance & Procurement' | 'Operations' | 'Legal';
  isPrimaryContact: boolean;
  leadSource?: string;
  linkedinUrl?: string;
  mailingAddress?: Address;
  createdAt: string;
  notes?: string;
}

export type LeadStatus = 'New' | 'Contacted' | 'Working' | 'Nurturing' | 'Qualified' | 'Converted' | 'Unqualified';

export interface Lead {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  status: LeadStatus;
  rating: 'Hot' | 'Warm' | 'Cold';
  leadSource: 'Web Inbound' | 'Gartner Magic Quadrant' | 'Executive Referral' | 'Cold Outbound' | 'Event / Conference' | 'Partner';
  estimatedARR: number;
  currency: Currency;
  industry: string;
  city?: string;
  country?: string;
  ownerName: string;
  convertedAccountId?: string;
  convertedContactId?: string;
  convertedOpportunityId?: string;
  convertedAt?: string;
  createdAt: string;
  notes?: string;
}

export type OpportunityStage = 
  | 'Prospecting'
  | 'Qualification'
  | 'Needs Analysis'
  | 'Proposal / CPQ Quote'
  | 'Negotiation & Review'
  | 'Closed Won'
  | 'Closed Lost';

export interface Opportunity {
  id: string;
  name: string;
  accountName: string;
  amount: number;
  currency: Currency;
  stage: OpportunityStage;
  probabilityPct: number;
  closeDate: string;
  ownerName: string;
  dealType: 'New Business' | 'Existing - Expansion' | 'Renewal' | 'Contract Amendment';
  leadSource?: string;
  nextStep?: string;
  primaryContact?: string;
  contactEmail?: string;
  quoteId?: string;
  quoteNumber?: string;
  forecastCategory: 'Pipeline' | 'Best Case' | 'Commit' | 'Closed';
  lossReason?: string;
  notes?: string;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  accountName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  opportunityName?: string;
  status: 'Draft' | 'Approved' | 'Sent' | 'Signed' | 'Invoiced';
  currency: Currency;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalAmount: number;
  marginPct: number;
  createdAt: string;
  validUntil: string;
  paymentTerms?: 'Net 30' | 'Net 45' | 'Net 60' | 'Due Upon Receipt';
  billingAddress?: Address;
  shippingAddress?: Address;
  discountTier?: 'Rep Discretion (<15%)' | 'Manager Approval (15-25%)' | 'VP Sign-Off (>25%)' | 'CFO Clearance (>40%)';
  approvalStatus?: 'Auto-Approved' | 'Pending Approval' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvalNotes?: string;
  items: QuoteLineItem[];
  portalToken: string;
  signatureData?: string;
  signatureDigest?: string;
  signedAt?: string;
  signedByName?: string;
  signedByEmail?: string;
  signerIp?: string;
  signerUserAgent?: string;
  auditTrail?: AuditEvent[];
  customProposalNotes?: string;
  rampIntervals?: RampInterval[];
}

export interface OrderLineItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  entitlementKey?: string;
  provisioningStatus: 'Ready' | 'Provisioned' | 'Active';
}

export interface Order {
  id: string;
  orderNumber: string;
  quoteNumber: string;
  accountName: string;
  status: 'Draft' | 'Activated' | 'Fulfilled' | 'Cancelled';
  orderType?: 'New' | 'Renewal' | 'Amendment' | 'Upsell';
  totalAmount: number;
  currency: Currency;
  orderedDate: string;
  activatedDate?: string;
  fulfillmentStatus?: 'Pending' | 'Provisioned' | 'Active';
  deliveryMilestone?: string;
  billingSchedule?: 'Immediate' | 'Milestone-based' | 'Arrears' | 'Annual Pre-paid';
  itemsCount: number;
  orderLines?: OrderLineItem[];
  poNumber?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  accountName: string;
  quoteNumber: string;
  contractType?: 'Master Service Agreement (MSA)' | 'Service Level Agreement (SLA)' | 'Data Processing Agreement (DPA)';
  status: 'Draft' | 'In Approval' | 'Activated' | 'Expired';
  startDate: string;
  endDate: string;
  contractTermMonths: number;
  totalContractValue: number;
  currency: Currency;
  autoRenew: boolean;
  governingLaw?: string;
  noticePeriodDays?: number;
  annualUpliftCapPct?: number;
  coTermingEnabled?: boolean;
  amendmentHistory?: { date: string; change: string; user: string }[];
}

export type SubscriptionStatus = 'Active' | 'Past Due' | 'Cancelled' | 'Paused' | 'In Trial';

export interface SubscriptionAddOn {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  billingCadence: 'Monthly' | 'Annual';
}

export interface Subscription {
  id: string;
  subscriptionNumber: string;
  contractNumber: string;
  productName: string;
  accountName: string;
  customerEmail?: string;
  tier?: 'Starter' | 'Professional' | 'Enterprise Plus';
  status: SubscriptionStatus;
  mrr: number;
  currency: Currency;
  startDate: string;
  renewalDate: string;
  quantity: number;
  billingCadence?: 'Monthly' | 'Quarterly' | 'Annual';
  usageLimit?: number;
  currentUsage?: number;
  usageMetricName?: string;
  overageUnitPrice?: number;
  prorationAccrued?: number;
  // Chargebee Subscription Lifecycle & Retention Features:
  isGrandfathered?: boolean;
  trialDaysLeft?: number;
  pausedUntilDate?: string;
  appliedCoupon?: string;
  discountPct?: number;
  addOns?: SubscriptionAddOn[];
  cancellationReason?: string;
  churnSaved?: boolean;
  savedOfferApplied?: string;
  lastPaymentMethod?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface InvoiceLineItem {
  id: string;
  hsnCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quoteNumber: string;
  accountName: string;
  invoiceType?: 'B2B Tax Invoice' | 'Proforma' | 'Credit Note';
  amount: number;
  currency: Currency;
  status: 'Draft' | 'Issued' | 'Paid' | 'Overdue';
  dueDate: string;
  issueDate?: string;
  irnNumber?: string;
  signedQrCode?: string;
  ackNumber?: string;
  ackDate?: string;
  buyerGstin?: string;
  sellerGstin?: string;
  placeOfSupply?: string;
  reverseCharge?: boolean;
  ewayBillNumber?: string;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  gstAmount: number;
  paymentMethod?: 'Razorpay' | 'Stripe' | 'Bank Transfer';
  paidAt?: string;
  transactionRef?: string;
  lineItemsBreakdown?: InvoiceLineItem[];
}

export interface PerformanceObligation {
  id: string;
  name: string;
  allocatedSSP: number;
  transactionPrice: number;
  recognitionMethod: 'Over Time (Ratable)' | 'Point in Time';
  startDate: string;
  endDate: string;
  recognizedRevenue: number;
  deferredRevenue: number;
  pobStatus?: 'Active' | 'Satisfied' | 'Awaiting Delivery';
  satisfactionProgressPct?: number;
  contractLiabilityAccount?: string;
  contractAssetAccount?: string;
}

export interface SetupSettings {
  companyName: string;
  companyAddress: string;
  taxGstin: string;
  senderEmail: string;
  senderDisplayName: string;
  orgWideEmailAddress: string;
  googleDriveEnabled: boolean;
  googleDriveRootFolder: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  stripeSecretKey: string;
  autoRevRecDaemonHour: number;
  healthScore: number;
  currencyRates?: Record<Currency, number>;
}

export interface SetupConfig {
  company: {
    name: string;
    registrationNumber: string;
    email: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    phone: string;
    website: string;
  };
  brand: {
    accent: string;
    logo: string;
  };
  pdf: {
    layout: 'classic' | 'modern' | 'minimal';
    pageSize: 'A4' | 'Letter';
    font: 'sans' | 'serif';
    accent: string;
    showLogo: boolean;
    logoPosition: 'left' | 'right';
    quoteTitle: string;
    invoiceTitle: string;
    showUnit: boolean;
    showDiscount: boolean;
    showTaxBreakup: boolean;
    showBankDetails: boolean;
    bankDetails: string;
    terms: string;
    footer: string;
    showSignature: boolean;
    signatory: string;
    draftWatermark: boolean;
  };
  tax: {
    country: string;
    countryName: string;
    system: string;
    registrationLabel: string;
    currency: Currency;
    locale: string;
    mode: 'none' | 'single' | 'split' | 'regional';
    rate: number;
    splitLabels: [string, string];
    crossLabel: string;
    regionLabel: string;
    pricesIncludeTax: boolean;
  };
  pricing: {
    discountLimit: number;
    standardTerms: string;
    quoteValidDays: number;
    approver: string;
    marginFloor: number;
  };
  billing: {
    invoicePrefix: string;
    invoiceDueDays: number;
    reminderDays: number[];
    lateFeePercent: number;
    irnEnabled: boolean;
  };
  payments: {
    gateway: 'razorpay' | 'stripe' | 'adyen' | 'manual';
    paymentLinks: boolean;
    autoPay: boolean;
    testMode: boolean;
    stripeKey: string;
    razorpayKey: string;
    webhookSecret: string;
  };
  notifications: {
    approvalPending: boolean;
    quoteViewed: boolean;
    quoteSigned: boolean;
    invoiceOverdue: boolean;
    paymentReceived: boolean;
    renewalDue: boolean;
  };
  sync: {
    rules: { id: string; moment: string; target: string; field: string; source: string; value: string }[];
  };
  jobs: {
    dailyBillingHour: number;
    autoRenewNoticeDays: number;
    asc606DaemonEnabled: boolean;
    lastRunAt: string;
    nextRunAt: string;
  };
  emails: {
    selectedTemplate: string;
    templates: Record<string, { subject: string; body: string }>;
  };
  automation: {
    webhookUrl: string;
    autoActivateOrders: boolean;
    autoProvisionEntitlements: boolean;
    slackWebhookUrl: string;
    triggerOnEsign: boolean;
    triggerOnPayment: boolean;
  };
  productRules: {
    rules: { id: string; name: string; condition: string; action: string; active: boolean }[];
  };
  ai: {
    provider: string;
    apiKey: string;
    dealAdvisorEnabled: boolean;
    churnRadarSensitivity: string;
    autoSuggestDiscounts: boolean;
  };
  history: {
    version: string;
    publishedAt: string;
    author: string;
    note: string;
    active: boolean;
  }[];
}

// Analytics and Executive War Room Data Models
export interface CohortRetentionItem {
  cohort: string;
  accountsCount: number;
  startingARR: number;
  m3: number;
  m6: number;
  m9: number;
  m12: number;
  expansionDriver: string;
}

export interface ARRWaterfallItem {
  month: string;
  openingARR: number;
  newARR: number;
  expansionARR: number;
  contractionARR: number;
  churnARR: number;
  closingARR: number;
}

export interface DSOAgingBucket {
  bucket: string;
  amount: number;
  invoiceCount: number;
  riskScore: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface SalesRepPerformance {
  id: string;
  name: string;
  avatar: string;
  role: string;
  quotaARR: number;
  attainedARR: number;
  attainmentPct: number;
  dealsClosedCount: number;
  averageMarginPct: number;
  discountDiscipline: 'Tier A (Disciplined)' | 'Tier B' | 'Tier C';
}

// Zuora Metering & Mediation Engine Models
export interface RawUsageEvent {
  id: string;
  timestamp: string;
  accountId: string;
  accountName: string;
  metricKey: 'api_calls' | 'compute_hours' | 'storage_gb' | 'ai_tokens';
  units: number;
  ratingStatus: 'Unrated' | 'Rated' | 'Invoiced';
  ratedAmountUSD: number;
  aggregationType: 'SUM' | 'MAX' | 'DISTINCT_COUNT' | 'LATEST';
}

export interface UsageCommitmentPool {
  id: string;
  accountName: string;
  subscriptionNumber: string;
  metricName: string;
  prepaidCreditsUSD: number;
  consumedCreditsUSD: number;
  unitPriceUSD: number;
  overageRateUSD: number;
  resetCycle: 'Monthly' | 'Quarterly' | 'Annual';
  thresholdAlertPct: number;
}

// Zuora Collect & Smart Dunning Models
export interface DunningAttempt {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  accountName: string;
  amount: number;
  currency: Currency;
  stage: 'Stage 1: Soft Reminder (Day 3)' | 'Stage 2: Urgent Grace Period (Day 7)' | 'Stage 3: Service Suspension (Day 14)';
  lastAttemptDate: string;
  nextRetryDate: string;
  attemptCount: number;
  gateway: 'Stripe' | 'Razorpay';
  recoveryStatus: 'Recovered' | 'In Dunning' | 'Escalated to Legal' | 'Written Off';
  lastFailureReason: string;
  smartRetryRecommendedTime: string;
}

// DealHub.io DealRoom & Mutual Action Plan (MAP) Models
export interface DealRoomTelemetry {
  totalViews: number;
  totalTimeSpentSeconds: number;
  lastViewedAt: string;
  engagementScore: number; // 0 - 100%
  activeViewers: number;
  sectionsViewed: { sectionName: string; timeSpentSeconds: number; viewCount: number }[];
}

export interface MutualActionPlanItem {
  id: string;
  title: string;
  owner: 'Buyer' | 'Seller' | 'Shared';
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  category: 'Security & InfoSec' | 'Commercial & Legal' | 'Technical Architecture' | 'Procurement';
}

export interface DealRoom {
  id: string;
  quoteId: string;
  quoteNumber: string;
  accountName: string;
  dealSize: number;
  currency: Currency;
  customWelcomeMessage: string;
  salesRepName: string;
  salesRepEmail: string;
  buyerContactName: string;
  buyerContactEmail: string;
  buyerCompany: string;
  pricingLocked: boolean;
  interactiveSeats: number;
  interactiveAddOns: string[];
  telemetry: DealRoomTelemetry;
  actionPlan: MutualActionPlanItem[];
  status: 'Draft' | 'Published' | 'Viewed by Buyer' | 'Accepted' | 'Signed';
  roomUrl: string;
  createdAt: string;
}

// Oracle CPQ Guided Selling & Multi-Tier Approval Matrix Models
export interface GuidedSellingOption {
  label: string;
  description: string;
  recommendedProductIds: string[];
  suggestedDiscountPct: number;
}

export interface GuidedSellingQuestion {
  id: string;
  step: number;
  title: string;
  subtitle: string;
  options: GuidedSellingOption[];
}

export interface ProductConstraintRule {
  id: string;
  sourceProductId: string;
  targetProductId: string;
  ruleType: 'Requires' | 'Incompatible' | 'Recommends';
  message: string;
}

export interface ApprovalChainStep {
  level: number;
  role: string;
  approverName: string;
  conditionDescription: string;
  thresholdDiscountPct: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Skipped';
  actionDate?: string;
  comments?: string;
}

export interface ApprovalRequest {
  id: string;
  quoteId: string;
  quoteNumber: string;
  accountName: string;
  requestedBy: string;
  requestDate: string;
  discountPct: number;
  dealAmount: number;
  currency: Currency;
  marginPct: number;
  businessJustification: string;
  overallStatus: 'Pending Review' | 'Approved' | 'Rejected';
  approvalChain: ApprovalChainStep[];
}

export interface ProfitabilityGovernance {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMarginPct: number;
  floorMarginPct: number; // e.g. 65% floor
  targetMarginPct: number; // e.g. 80% target
  status: 'Healthy' | 'Warning' | 'Breach';
}

// BillingPlatform Account Hierarchy & Multi-Metric Dynamic Rating Models
export interface AccountHierarchyNode {
  id: string;
  accountName: string;
  nodeType: 'Global Parent Holding' | 'Regional Operating Corp' | 'Regional Subsidiary';
  country: string;
  region: 'North America' | 'EMEA' | 'APAC' | 'LATAM';
  currency: Currency;
  annualContractValue: number;
  billingMode: 'Consolidated Parent Invoicing' | 'Split Subsidiary Invoicing';
  taxRegistrationNumber?: string;
  children?: AccountHierarchyNode[];
}

export interface DynamicRatingModel {
  id: string;
  name: string;
  metricKey: 'api_calls' | 'compute_hours' | 'storage_gb' | 'ai_tokens';
  ratingStrategy: 'Graduated Tiered Slabs' | 'Peak / Off-Peak Time-of-Day' | 'Attribute-Based Regional Multiplier';
  baseRateUSD: number;
  peakMultiplier?: number;
  offPeakMultiplier?: number;
  peakWindowLabel?: string;
  slabs?: { minUnits: number; maxUnits: number; rateUSD: number; label: string }[];
  description: string;
}


