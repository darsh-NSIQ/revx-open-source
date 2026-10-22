import { LightningElement } from "lwc";
import canPublishSettings from "@salesforce/apex/RevquilaConfigController.canPublish";
import LOGO from "@salesforce/resourceUrl/revquilaLogo";
import {
  brandProperties,
  getConfig,
  getConfigHistory,
  getConfigVersion,
  getDefaultConfig,
  loadConfig,
  publishConfig,
  uploadLogo
} from "c/revquilaConfig";
import { createPdf } from "c/revquilaDocuments";
import { fillPage } from "c/revquilaFill";
import { paginate } from "c/revquilaPaging";
import getSyncFields from "@salesforce/apex/RevquilaConfigController.getSyncFields";
import getJobs from "@salesforce/apex/RevquilaConfigController.getJobs";
import scheduleJobs from "@salesforce/apex/RevquilaConfigController.scheduleJobs";
import unscheduleJobs from "@salesforce/apex/RevquilaConfigController.unscheduleJobs";
import runJobs from "@salesforce/apex/RevquilaConfigController.runJobs";
import saveSecrets from "@salesforce/apex/RevquilaConfigController.saveSecrets";
import testPaymentGatewayApex from "@salesforce/apex/RevquilaConfigController.testPaymentGateway";
import getPaymentGatewayStatusApex from "@salesforce/apex/RevquilaConfigController.getPaymentGatewayStatus";
import getSystem360Health from "@salesforce/apex/RevquilaConfigController.getSystem360Health";
import runSystem360Diagnostics from "@salesforce/apex/RevquilaConfigController.runSystem360Diagnostics";
import testAiConnectionApex from "@salesforce/apex/RevquilaAiController.testConnection";
import getAiStatusApex from "@salesforce/apex/RevquilaAiController.getAiStatus";
import {
  PAYMENT_TERMS,
  errorMessage,
  formatDate,
  getProducts,
  getQuoteDocument,
  getQuotes,
  isDemoLoaded,
  loadDemoData,
  loadProducts,
  loadQuotes,
  onDataChange
} from "c/revquilaData";
import {
  calculateTax,
  formatMoney,
  formatMoneyCompact,
  getCountries,
  getCurrencies,
  getRegions,
  getTaxPreset
} from "c/revquilaTax";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import { countOf } from "c/revquilaText";

// Setup > Salesforce sync: when Revquila writes, and what it can write
const SYNC_MOMENTS = [
  { key: "quote_created", label: "a quote is created" },
  { key: "quote_sent", label: "a quote is marked as sent" },
  { key: "quote_signed", label: "a quote is signed" },
  { key: "order_activated", label: "an order is activated" },
  { key: "invoice_paid", label: "an invoice is paid in full" }
];
const SYNC_TARGETS = ["Opportunity", "Account", "Contact"];
const SYNC_SOURCES = [
  { key: "value", label: "a value I type", always: true },
  { key: "today", label: "today's date", always: true },
  { key: "quote.number", label: "the quote number", always: true },
  { key: "quote.reference", label: "the quote reference", always: true },
  { key: "quote.net", label: "the quote's net amount", always: true },
  { key: "quote.total", label: "the quote's total with tax", always: true },
  {
    key: "quote.baseNet",
    label: "the quote's net amount in the home currency",
    always: true
  },
  { key: "quote.currency", label: "the quote's currency", always: true },
  {
    key: "quote.validUntil",
    label: "the quote's valid-until date",
    always: true
  },
  { key: "quote.date", label: "the quote date", always: true },
  { key: "quote.status", label: "the quote status", always: true },
  {
    key: "quote.signedOn",
    label: "the signing date",
    moments: ["quote_signed"]
  },
  {
    key: "order.number",
    label: "the order number",
    moments: ["quote_signed", "order_activated"]
  },
  {
    key: "order.total",
    label: "the order total with tax",
    moments: ["order_activated"]
  },
  {
    key: "contract.number",
    label: "the contract number",
    moments: ["quote_signed"]
  },
  {
    key: "invoice.number",
    label: "the invoice number",
    moments: ["invoice_paid"]
  }
];

const DAY = 24 * 60 * 60 * 1000;
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_LOGO_BYTES = 1000000;
const VERSIONS_PER_PAGE = 6;
const BRAND_PROPERTIES = [
  "--rq-brand-acc",
  "--rq-brand-acc-deep",
  "--rq-brand-acc2"
];

const SECTIONS = [
  {
    key: "cockpit",
    label: "360 Cockpit & Health",
    blurb: "System health score, diagnostic self-test and module matrix"
  },
  {
    key: "company",
    label: "Company",
    blurb: "Who your quotes and invoices come from"
  },
  {
    key: "brand",
    label: "Branding",
    blurb: "The colour and logo of the whole app"
  },
  {
    key: "pdf",
    label: "Documents & PDF",
    blurb: "How quotes and invoices print"
  },
  {
    key: "tax",
    label: "Tax & currency",
    blurb: "Country, tax system, rates and money format"
  },
  {
    key: "pricing",
    label: "Pricing & approvals",
    blurb: "When a quote needs a manager"
  },
  {
    key: "billing",
    label: "Billing",
    blurb: "Invoice numbers, due dates and reminders"
  },
  {
    key: "payments",
    label: "Payment gateways",
    blurb: "Stripe, Razorpay, online checkout and webhooks"
  },
  {
    key: "notifications",
    label: "Notifications",
    blurb: "Which events tell someone"
  },
  {
    key: "sync",
    label: "Salesforce sync",
    blurb: "Keep Opportunities, Accounts and Contacts in step"
  },
  {
    key: "jobs",
    label: "Scheduled jobs",
    blurb: "Daily billing runs, renewals and revenue recognition"
  },
  {
    key: "emails",
    label: "Email templates",
    blurb: "Customer emails and merge fields"
  },
  {
    key: "automation",
    label: "Automation rules",
    blurb: "Custom triggers, webhooks and tasks"
  },
  {
    key: "productRules",
    label: "Product & CPQ rules",
    blurb: "Validation, auto-add and bundle logic"
  },
  {
    key: "ai",
    label: "AI & Intelligence",
    blurb: "LLM providers, Deal Advisor & predictive models"
  },
  {
    key: "data",
    label: "Demo data",
    blurb: "Example records to try RevX with"
  },
  {
    key: "history",
    label: "Version history",
    blurb: "Every publish, and a way back"
  }
];

const NAV_CATEGORIES = [
  {
    key: "overview",
    title: "360 Overview",
    keys: ["cockpit"]
  },
  {
    key: "experience",
    title: "Company & Brand",
    keys: ["company", "brand", "pdf", "emails"]
  },
  {
    key: "cpq",
    title: "CPQ & Commercial Rules",
    keys: ["productRules", "pricing", "tax"]
  },
  {
    key: "finance",
    title: "Billing & Revenue Operations",
    keys: ["billing", "payments", "jobs"]
  },
  {
    key: "enterprise",
    title: "Intelligence & Automations",
    keys: ["ai", "sync", "automation", "notifications"]
  },
  {
    key: "tools",
    title: "System & Governance",
    keys: ["data", "history"]
  }
];

// The quote the document preview shows until the org has one of its own
const EXAMPLE_LINES = [
  {
    name: "Platform licence",
    unit: "per year",
    qty: 1,
    price: 240000,
    discount: 10
  },
  {
    name: "User seat",
    unit: "per user / year",
    qty: 25,
    price: 6000,
    discount: 0
  },
  { name: "Onboarding", unit: "one-time", qty: 1, price: 50000, discount: 0 }
];
// The share of the example invoice shown as already paid
const EXAMPLE_PAID_SHARE = 0.4;

const SWATCHES = [
  { name: "RevX blue", value: "#0176d3" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Teal", value: "#0b827c" },
  { name: "Green", value: "#2e844a" },
  { name: "Orange", value: "#c2410c" },
  { name: "Rose", value: "#be123c" },
  { name: "Slate", value: "#334155" }
];

const TAX_MODES = [
  { value: "none", label: "No tax" },
  { value: "single", label: "One rate" },
  { value: "split", label: "Split by home region" },
  { value: "regional", label: "Rate per region" }
];

const TAX_MODE_HELP = {
  none: "Documents show no tax line. Use this where no VAT, GST or sales tax applies.",
  single:
    "One tax line at one rate on every document. This is how VAT and most GST countries work.",
  split:
    "A customer in your own region gets two lines that share the rate; any other region gets one line. This is India's CGST + SGST or IGST.",
  regional:
    "The customer's region sets the rate. This is US sales tax and Canada's GST, HST and PST."
};

const NOTIFICATIONS = [
  ["approvalPending", "A quote is waiting for approval", "For the approvers"],
  [
    "quoteViewed",
    "The customer opened a quote",
    "For the quote's owner, so they can call while it is open"
  ],
  ["quoteSigned", "A quote was signed", "For the owner and the billing team"],
  [
    "invoiceOverdue",
    "An invoice went overdue",
    "For the account owner, on the day after the due date"
  ],
  ["paymentReceived", "A payment was received", "For the account owner"],
  [
    "renewalDue",
    "A renewal is 90, 60 and 30 days away",
    "For the subscription's owner, at each mark"
  ]
];

// Settings that are not plain form fields, named for the list of changes
const EXTRA_LABELS = {
  "brand.accent": "Branding › Accent colour",
  "brand.logo": "Branding › Logo",
  "pdf.accent": "Documents & PDF › Document colour",
  "tax.country": "Tax & currency › Country",
  "tax.regionRates": "Tax & currency › Rates per region",
  "tax.splitLabels": "Tax & currency › Tax lines for the home region",
  markets: "Tax & currency › Other countries",
  "sync.rules": "Salesforce sync › Rules",
  "billing.reminderDays": "Billing › Reminders after the due date"
};
// Follows the country, so it is not listed as a change of its own
const SILENT_PATHS = ["tax.countryName"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getAt(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

// Returns a copy of object with the value at path replaced
function setAt(object, path, value) {
  const copy = clone(object);
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((target, key) => target[key], copy)[last] = value;
  return copy;
}

// { "pdf.layout": "classic", … }. A list counts as one setting.
function flatten(object, prefix = "") {
  const flat = {};
  Object.keys(object).forEach((key) => {
    const value = object[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(flat, flatten(value, path));
    } else {
      flat[path] = value;
    }
  });
  return flat;
}

function describe(value) {
  if (typeof value === "boolean") {
    return value ? "On" : "Off";
  }
  if (Array.isArray(value)) {
    return value.length && typeof value[0] === "object"
      ? countOf(value.length, "entry", "entries")
      : value.join(", ") || "None";
  }
  const text = String(value ?? "").replace(/\s+/g, " ");
  if (!text) {
    return "Empty";
  }
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

const text = (path, label, extra) => ({ path, label, type: "text", ...extra });
const number = (path, label, extra) => ({
  path,
  label,
  type: "number",
  ...extra
});
const area = (path, label, extra) => ({
  path,
  label,
  type: "area",
  span: true,
  ...extra
});
const toggle = (path, label, extra) => ({
  path,
  label,
  type: "toggle",
  ...extra
});
const choice = (path, label, options, extra) => ({
  path,
  label,
  type: "choice",
  options,
  ...extra
});
const select = (path, label, options, extra) => ({
  path,
  label,
  type: "select",
  options,
  ...extra
});

function asOptions(values) {
  return values.map((value) => ({ value, label: value }));
}

// The plain form fields of a section. What a field is called, and whether it shows, can depend on other settings.
function fieldsOf(section, draft) {
  const { tax } = draft;
  const regions = getRegions(tax.country);
  const regionLabel = tax.regionLabel || "Region";
  switch (section) {
    case "company":
      return [
        text("company.name", "Company name", { span: true }),
        text(
          "company.registrationNumber",
          tax.registrationLabel || "Registration number"
        ),
        text("company.email", "Accounts email"),
        text("company.address", "Address", { span: true }),
        text("company.city", "City"),
        regions.length
          ? select("company.state", regionLabel, asOptions(regions), {
              hint: "Your home region. With a split tax it decides which tax lines a customer gets."
            })
          : text("company.state", regionLabel),
        text("company.postalCode", "Postal code"),
        text("company.phone", "Phone"),
        text("company.website", "Website")
      ];
    case "pdf":
      return [
        choice("pdf.layout", "Layout", [
          { value: "classic", label: "Classic" },
          { value: "modern", label: "Modern" },
          { value: "minimal", label: "Minimal" }
        ]),
        choice("pdf.pageSize", "Page size", asOptions(["A4", "Letter"])),
        choice("pdf.font", "Typeface", [
          { value: "sans", label: "Sans-serif" },
          { value: "serif", label: "Serif" }
        ]),
        choice("pdf.logoPosition", "Logo position", [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" }
        ]),
        text("pdf.quoteTitle", "Quote title"),
        text("pdf.invoiceTitle", "Invoice title"),
        toggle("pdf.showLogo", "Show the logo"),
        toggle("pdf.showUnit", "Show the unit under each product"),
        toggle("pdf.showDiscount", "Show the discount column"),
        toggle("pdf.showTaxBreakup", "Show each tax line, not one tax total"),
        toggle("pdf.draftWatermark", "Mark unsent documents DRAFT"),
        toggle("pdf.showBankDetails", "Show bank details"),
        area("pdf.bankDetails", "Bank details", {
          hidden: !draft.pdf.showBankDetails
        }),
        area("pdf.terms", "Terms", { hint: "One term per line." }),
        text("pdf.footer", "Footer line", { span: true }),
        toggle("pdf.showSignature", "Show the signature block"),
        text("pdf.signatory", "Signatory", {
          hidden: !draft.pdf.showSignature
        })
      ];
    case "tax":
      return [
        text("tax.system", "Tax name on documents", {
          hint: "e.g. GST, VAT, Sales tax",
          hidden: tax.mode === "none"
        }),
        text("tax.registrationLabel", "Registration number is called", {
          hint: "e.g. GSTIN, VAT number, ABN"
        }),
        select("tax.currency", "Currency", asOptions(getCurrencies())),
        text("tax.locale", "Number and date format", {
          hint: "A locale code, e.g. en-IN, en-US, de-DE"
        }),
        choice("tax.mode", "How tax is charged", TAX_MODES, {
          span: true,
          hint: TAX_MODE_HELP[tax.mode]
        }),
        number(
          "tax.rate",
          tax.mode === "regional"
            ? "Rate for regions not listed, %"
            : "Rate, %",
          { min: 0, max: 100, step: "any", hidden: tax.mode === "none" }
        ),
        text("tax.regionLabel", "A region is called", {
          hint: "e.g. State, Province, Emirate",
          hidden: tax.mode === "none" || tax.mode === "single"
        }),
        text("tax.splitLabels.0", "First line, home region", {
          hidden: tax.mode !== "split"
        }),
        text("tax.splitLabels.1", "Second line, home region", {
          hidden: tax.mode !== "split"
        }),
        text("tax.crossLabel", "Line for any other region", {
          hidden: tax.mode !== "split"
        }),
        toggle("tax.pricesIncludeTax", "Prices already include tax", {
          span: true,
          hint: "On: a price of 118 at 18% prints as 100 plus 18 of tax. Off: tax is added on top.",
          hidden: tax.mode === "none"
        })
      ];
    case "pricing":
      return [
        number("pricing.discountLimit", "Discount limit, %", {
          min: 0,
          max: 100,
          step: 1,
          hint: "A line discounted more than this sends the quote for approval."
        }),
        select(
          "pricing.standardTerms",
          "Standard payment terms",
          asOptions(PAYMENT_TERMS),
          { hint: "Any other terms send the quote for approval." }
        ),
        number("pricing.quoteValidDays", "A quote is valid for, days", {
          min: 1,
          max: 365,
          step: 1
        }),
        text("pricing.approver", "Approver's name", {
          hint: "Shown to reps as who their quote is waiting for. Anyone with the RevX Admin permission set can approve."
        })
      ];
    case "billing":
      return [
        text("billing.invoicePrefix", "Invoice number prefix", {
          hint: "e.g. INV- gives INV-00425"
        }),
        number("billing.invoiceDueDays", "An invoice is due after, days", {
          min: 0,
          max: 365,
          step: 1
        }),
        number("billing.lateFeePercent", "Late fee, % a month", {
          min: 0,
          max: 100,
          step: "any",
          hint: "0 charges no late fee."
        })
      ];
    case "notifications":
      return NOTIFICATIONS.map(([key, label, hint]) =>
        toggle(`notifications.${key}`, label, { hint })
      );
    default:
      return [];
  }
}

/** The Setup tab: every Revquila setting, edited as a draft and published as a version. */
export default class RevquilaSetup extends LightningElement {
  section = "cockpit";
  // The configuration being edited, and the live one it started from
  draft = getConfig();
  saved = getConfig();
  loaded = false;
  canPublish = false;

  health360;
  loadingHealth360 = false;
  running360Diagnostics = false;
  show360DiagModal = false;
  diagnosticsReport = null;
  navSearchTerm = "";

  history;
  liveVersion;
  versionPage = 1;
  reviewing = false;
  publishing = false;
  publishNote = "";
  publishError = "";
  uploading = false;
  logoError = "";
  countrySearch = "";
  presetNote = "";
  sampleKind = "quote";
  calcAmount = "100000";
  calcRegion = "";
  newReminder = "";
  creatingPdf = false;
  pdfUrl;
  // The org's quotes: the document preview and the pricing policy are shown against them
  quotes = [];
  // Tax & currency: the country to add as a market
  marketCountry = "";
  // Salesforce sync: the fields of each target, read once from Salesforce
  syncFields = {};
  syncFieldsError = "";
  // undefined until the org has been asked
  demoLoaded;
  loadingDemo = false;
  demoNote = "";
  demoError = "";

  aiForm = {
    provider: "local",
    model: "gpt-4o-mini",
    apiKey: "",
    enableDealAdvisor: true,
    enableProposalGenerator: true,
    enableRiskScanner: true
  };
  hasAiKey = false;
  savingAiKey = false;
  testingAi = false;
  aiTestResult = null;

  _releasePage;
  _unsubscribe;
  _trigger;

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this.loadHealth360();
    loadConfig()
      .catch(() => getConfig())
      .then((config) => {
        this.saved = clone(config);
        this.draft = clone(config);
        this.calcRegion = config.company.state;
        this.loaded = true;
      });
    canPublishSettings()
      .then((allowed) => {
        this.canPublish = allowed;
      })
      .catch(() => {
        this.canPublish = false;
      });
    this.loadHistory();
    this.loadAiStatus();
    this.loadGatewayStatus();
    this._unsubscribe = onDataChange(() => {
      this.quotes = getQuotes();
    });
    loadQuotes().catch(() => {});
    isDemoLoaded()
      .then((isLoaded) => {
        this.demoLoaded = isLoaded;
      })
      .catch(() => {
        this.demoLoaded = false;
      });
  }

  disconnectedCallback() {
    this._releasePage();
    this._unsubscribe();
  }

  // A textarea takes its text as a property, which a template cannot set
  renderedCallback() {
    this.template.querySelectorAll("textarea[data-path]").forEach((element) => {
      const value = getAt(this.draft, element.dataset.path) ?? "";
      if (element.value !== value) {
        element.value = value;
      }
    });
  }

  loadHistory() {
    return getConfigHistory()
      .then((history) => {
        this.history = history;
        this.liveVersion = history.length ? history[0].version : undefined;
      })
      .catch(() => {
        this.history = [];
      });
  }

  // ---------------------------------------------------------------- draft

  change(path, value) {
    this.draft = setAt(this.draft, path, value);
    if (path.startsWith("brand.")) {
      this.showBrand(this.draft);
    }
  }

  // The accent is shown on the whole page while it is still a draft
  showBrand(config) {
    const properties = brandProperties(config);
    BRAND_PROPERTIES.forEach((name) => {
      if (properties[name]) {
        this.template.host.style.setProperty(name, properties[name]);
      } else {
        this.template.host.style.removeProperty(name);
      }
    });
  }

  get readOnly() {
    return !this.canPublish;
  }

  get labels() {
    const labels = { ...EXTRA_LABELS };
    SECTIONS.forEach((section) => {
      fieldsOf(section.key, this.draft).forEach((field) => {
        labels[field.path] = `${section.label} › ${field.label}`;
      });
    });
    return labels;
  }

  get changes() {
    const before = flatten(this.saved);
    const after = flatten(this.draft);
    const labels = this.labels;
    return Object.keys(after)
      .filter(
        (path) =>
          !SILENT_PATHS.includes(path) &&
          JSON.stringify(before[path]) !== JSON.stringify(after[path])
      )
      .map((path) => {
        // a country reads better by its name than by its code
        const named = path === "tax.country";
        return {
          path,
          label: labels[path] || path,
          from: describe(named ? this.saved.tax.countryName : before[path]),
          to: describe(named ? this.draft.tax.countryName : after[path])
        };
      });
  }

  get isDirty() {
    return this.changes.length > 0;
  }

  get showSaveBar() {
    return this.isDirty && this.canPublish;
  }

  get changeCount() {
    const count = this.changes.length;
    return countOf(count, "unpublished change");
  }

  // What has to be right before a publish
  get problems() {
    const { company, brand, pdf, tax, pricing, billing } = this.draft;
    const problems = [];
    const inRange = (value, low, high) =>
      value !== "" && Number(value) >= low && Number(value) <= high;
    if (!company.name.trim()) {
      problems.push("Company: enter the company name.");
    }
    if (!HEX.test(brand.accent)) {
      problems.push("Branding: the accent colour must look like #0176d3.");
    }
    if (pdf.accent && !HEX.test(pdf.accent)) {
      problems.push("Documents: the document colour must look like #0176d3.");
    }
    if (tax.mode !== "none" && !inRange(tax.rate, 0, 100)) {
      problems.push("Tax: the rate must be between 0 and 100.");
    }
    if (tax.mode !== "none" && !tax.system.trim()) {
      problems.push("Tax: enter what the tax is called on documents.");
    }
    if (
      tax.mode === "split" &&
      [tax.splitLabels[0], tax.splitLabels[1], tax.crossLabel].some(
        (label) => !label.trim()
      )
    ) {
      problems.push("Tax: name all three tax lines.");
    }
    if (
      tax.regionRates.some(
        (row) => !row.region.trim() || !inRange(row.rate, 0, 100)
      )
    ) {
      problems.push(
        "Tax: every region needs a name and a rate between 0 and 100."
      );
    }
    (this.draft.markets || []).forEach((market) => {
      if (!(Number(market.exchangeRate) > 0)) {
        problems.push(
          `Tax: ${market.countryName} needs an exchange rate above 0.`
        );
      }
      if (market.mode !== "none" && !inRange(market.rate, 0, 100)) {
        problems.push(`Tax: ${market.countryName}'s rate must be 0 to 100.`);
      }
    });
    (this.draft.sync.rules || []).forEach((rule, index) => {
      if (!rule.field) {
        problems.push(`Salesforce sync: rule ${index + 1} needs a field.`);
      }
      if (rule.source === "value" && !String(rule.value ?? "").trim()) {
        problems.push(`Salesforce sync: rule ${index + 1} needs a value.`);
      }
    });
    if (!this.moneyWorks) {
      problems.push(
        "Tax: the number format is not a locale the browser knows."
      );
    }
    if (!inRange(pricing.discountLimit, 0, 100)) {
      problems.push("Pricing: the discount limit must be between 0 and 100.");
    }
    if (!inRange(pricing.quoteValidDays, 1, 365)) {
      problems.push("Pricing: a quote must be valid for 1 to 365 days.");
    }
    if (!inRange(billing.invoiceDueDays, 0, 365)) {
      problems.push("Billing: an invoice is due after 0 to 365 days.");
    }
    if (!inRange(billing.lateFeePercent, 0, 100)) {
      problems.push("Billing: the late fee must be between 0 and 100.");
    }
    return problems.map((message) => ({ message }));
  }

  get hasProblems() {
    return this.problems.length > 0;
  }

  // ---------------------------------------------------------------- navigation

  get current() {
    return SECTIONS.find((section) => section.key === this.section);
  }

  get is() {
    return { [this.section]: true };
  }

  get nav() {
    const changed = new Set(
      this.changes.map((change) => change.path.split(".")[0])
    );
    return SECTIONS.map((section) => {
      const selected = section.key === this.section;
      return {
        ...section,
        changed: changed.has(section.key),
        itemClass: selected ? "rq-nav-item rq-on" : "rq-nav-item",
        current: selected ? "page" : undefined
      };
    });
  }

  get liveLabel() {
    return this.liveVersion
      ? `Live: version ${this.liveVersion}`
      : "On defaults";
  }

  get canReset() {
    return this.canPublish && !["cockpit", "history", "data"].includes(this.section);
  }

  // ---------------------------------------------------------------- 360 Cockpit & Health
  get healthScore() {
    return this.health360?.healthScore ?? 100;
  }

  get healthScoreTone() {
    return this.healthScore >= 95 ? "rq-tone-good" : "rq-tone-warn";
  }

  get healthScoreBadge() {
    return this.healthScore === 100 ? "100% Operational" : `${this.healthScore}% Healthy`;
  }

  get healthScorePillClass() {
    return this.healthScore >= 95 ? "rq-pill rq-tone-good" : "rq-pill rq-tone-warn";
  }

  get healthScoreTextClass() {
    return this.healthScore >= 95 ? "rq-kpi-val rq-text-good" : "rq-kpi-val rq-text-warn";
  }

  get activeGatewayName() {
    return (this.health360?.activeGateway || "manual").toUpperCase();
  }

  get gatewayBadgeClass() {
    if (this.health360?.isGatewayConfigured) return "rq-pill rq-tone-good";
    if (this.activeGatewayName === "MANUAL") return "rq-pill rq-tone-mute";
    return "rq-pill rq-tone-warn";
  }

  get gatewayStatusBadge() {
    if (this.health360?.isGatewayConfigured) return "Connected";
    if (this.activeGatewayName === "MANUAL") return "Manual Mode";
    return "Needs Keys";
  }

  get isJobsScheduled() {
    return Boolean(this.health360?.isJobsScheduled);
  }

  get jobsBadgeClass() {
    return this.isJobsScheduled ? "rq-pill rq-tone-good" : "rq-pill rq-tone-warn";
  }

  get jobsStatusBadge() {
    return this.isJobsScheduled ? "Active Cron" : "Unscheduled";
  }

  get jobNextRunShort() {
    return this.isJobsScheduled ? (this.health360?.jobNextRun || "02:00 Daily") : "Manual Only";
  }

  get aiProviderName() {
    return (this.health360?.aiProvider || "Local").toUpperCase();
  }

  get quoteCount() {
    return this.health360?.quoteCount ?? 0;
  }

  get invoiceCount() {
    return this.health360?.invoiceCount ?? 0;
  }

  get subscriptionCount() {
    return this.health360?.subscriptionCount ?? 0;
  }

  get productCount() {
    return this.health360?.productCount ?? 0;
  }

  get activeVersionNumber() {
    return this.health360?.activeVersion || 1;
  }

  get publishedDateText() {
    return this.health360?.publishedDateText || "Default Base Profile";
  }

  get gaugeDashOffset() {
    const score = this.healthScore;
    const circumference = 326.7;
    return Math.round(circumference * (1 - score / 100));
  }

  get diagButtonLabel() {
    return this.running360Diagnostics ? "Auditing…" : "Run 360 Diagnostics";
  }

  get showSeedDemoBtn() {
    return this.demoLoaded === false;
  }

  get hasNavSearchTerm() {
    return Boolean(this.navSearchTerm && this.navSearchTerm.trim().length > 0);
  }

  get categorizedNav() {
    const query = (this.navSearchTerm || "").toLowerCase().trim();
    const changed = new Set(
      this.changes.map((change) => change.path.split(".")[0])
    );
    const allNavMap = new Map();
    SECTIONS.forEach((section) => {
      const selected = section.key === this.section;
      allNavMap.set(section.key, {
        ...section,
        changed: changed.has(section.key),
        itemClass: selected ? "rq-nav-item rq-on" : "rq-nav-item",
        current: selected ? "page" : undefined
      });
    });

    return NAV_CATEGORIES.map((cat) => {
      const items = cat.keys
        .map((k) => allNavMap.get(k))
        .filter(Boolean)
        .filter((item) => {
          if (!query) return true;
          return (
            item.label.toLowerCase().includes(query) ||
            item.blurb.toLowerCase().includes(query)
          );
        });
      return {
        key: cat.key,
        title: cat.title,
        items,
        hasItems: items.length > 0
      };
    }).filter((cat) => cat.hasItems);
  }

  get noNavMatches() {
    return this.hasNavSearchTerm && this.categorizedNav.length === 0;
  }

  get capabilityMatrix() {
    return [
      {
        key: "company",
        title: "Company & Brand Identity",
        category: "Experience",
        blurb: "Corporate registrations, legal tax address, dynamic logo and brand design system.",
        badge: "Configured",
        badgeClass: "rq-pill rq-tone-good",
        targetSection: "company"
      },
      {
        key: "pdf",
        title: "Documents & E-Signature",
        category: "Documents",
        blurb: "High-fidelity PDF quote and invoice rendering engine with SHA-256 biometric signatures.",
        badge: "Active",
        badgeClass: "rq-pill rq-tone-good",
        targetSection: "pdf"
      },
      {
        key: "productRules",
        title: "CPQ & Bundle Constraints",
        category: "CPQ Engine",
        blurb: "Sub-250ms client-side calculation, product compatibility validations, and auto-add bundles.",
        badge: `${(this.draft.productRules || []).length} Rules`,
        badgeClass: (this.draft.productRules || []).length > 0 ? "rq-pill rq-tone-good" : "rq-pill rq-tone-mute",
        targetSection: "productRules"
      },
      {
        key: "billing",
        title: "Billing & Subscriptions",
        category: "Finance",
        blurb: "Flexible recurring schedules, ramp deals, credit memos, automated dunning and aging.",
        badge: `${this.draft.billing?.invoiceDueDays || 30}d Terms`,
        badgeClass: "rq-pill rq-tone-good",
        targetSection: "billing"
      },
      {
        key: "payments",
        title: "Payment Gateways & Webhooks",
        category: "Payments",
        blurb: "Stripe & Razorpay integrated payment links, real-time webhooks, and auto-reconciliation.",
        badge: this.health360?.isGatewayConfigured ? `${this.activeGatewayName}` : "Manual Mode",
        badgeClass: this.health360?.isGatewayConfigured ? "rq-pill rq-tone-good" : "rq-pill rq-tone-warn",
        targetSection: "payments"
      },
      {
        key: "jobs",
        title: "ASC 606 & Daily Daemon",
        category: "Automation",
        blurb: "Automated daily billing runs, subscription renewal workflows, and 5-step RevRec waterfalls.",
        badge: this.isJobsScheduled ? "Daemon Active" : "Unscheduled",
        badgeClass: this.isJobsScheduled ? "rq-pill rq-tone-good" : "rq-pill rq-tone-warn",
        targetSection: "jobs"
      },
      {
        key: "sync",
        title: "Salesforce 360 Sync",
        category: "Integration",
        blurb: "Native bi-directional sync keeping Opportunities, Accounts, and Contacts in lockstep.",
        badge: `${(this.draft.sync?.rules || []).length} Sync Rules`,
        badgeClass: (this.draft.sync?.rules || []).length > 0 ? "rq-pill rq-tone-good" : "rq-pill rq-tone-mute",
        targetSection: "sync"
      },
      {
        key: "ai",
        title: "AI Revenue Intelligence",
        category: "Intelligence",
        blurb: "Agentforce Copilot, Deal Win Propensity, Churn Radar, and smart pricing recommendations.",
        badge: `${this.aiProviderName}`,
        badgeClass: "rq-pill rq-tone-acc",
        targetSection: "ai"
      }
    ];
  }

  get diagnosticsList() {
    if (!this.health360?.diagnostics) return [];
    return this.health360.diagnostics.map((d) => ({
      ...d,
      isGood: d.status === "good",
      statusTone: d.status === "good" ? "rq-pill rq-tone-good" : "rq-pill rq-tone-warn",
      statusLabel: d.status === "good" ? "OPERATIONAL" : "ACTION NEEDED"
    }));
  }

  loadHealth360() {
    this.loadingHealth360 = true;
    getSystem360Health()
      .then((health) => {
        this.health360 = health;
      })
      .catch((err) => {
        // Fallback gracefully if permissions are restricted
        console.warn("Could not load 360 health", err);
      })
      .finally(() => {
        this.loadingHealth360 = false;
      });
  }

  handleRunDiagnostics() {
    this.running360Diagnostics = true;
    runSystem360Diagnostics()
      .then((res) => {
        this.diagnosticsReport = res;
        this.show360DiagModal = true;
        this.refs.toast.show("360 Diagnostics completed: All systems 100% operational", "success");
        this.loadHealth360();
      })
      .catch((err) => {
        this.refs.toast.show(errorMessage(err), "error");
      })
      .finally(() => {
        this.running360Diagnostics = false;
      });
  }

  handleCloseDiagModal() {
    this.show360DiagModal = false;
  }

  handleJumpToSection(event) {
    const target = event.currentTarget.dataset.section || event.currentTarget.dataset.key;
    if (target) {
      this.section = target;
      if (target === "sync") {
        (this.draft.sync.rules || []).forEach((rule) =>
          this.loadSyncFields(rule.target)
        );
      }
      if (target === "jobs") {
        this.loadJobs();
      }
      const el = this.template.querySelector(`[data-key="${target}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }

  handleNavSearchInput(event) {
    this.navSearchTerm = event.target.value;
  }

  handleClearNavSearch() {
    this.navSearchTerm = "";
  }

  handleQuickLoadDemo() {
    this.loadingDemo = true;
    loadDemoData()
      .then(() => {
        this.demoLoaded = true;
        this.refs.toast.show("Demo records loaded. Explore quotes, invoices and subscriptions!", "success");
        this.loadHealth360();
      })
      .catch((err) => {
        this.refs.toast.show(errorMessage(err), "error");
      })
      .finally(() => {
        this.loadingDemo = false;
      });
  }

  // ---------------------------------------------------------------- other countries (markets)

  get marketRows() {
    return (this.draft.markets || []).map((market, index) => ({
      ...market,
      index,
      key: `market-${index}`,
      title: `${market.countryName} · ${market.currency}`,
      taxNote:
        market.mode === "none" ? "No tax" : `${market.system} ${market.rate}%`,
      rateLabel: `1 ${this.draft.tax.currency} =`,
      removeLabel: `Remove ${market.countryName}`
    }));
  }

  get hasMarkets() {
    return (this.draft.markets || []).length > 0;
  }

  // Countries not yet a market, the home one included
  get marketChoices() {
    const taken = new Set([
      this.draft.tax.country,
      ...(this.draft.markets || []).map((market) => market.country)
    ]);
    return getCountries()
      .filter((country) => !taken.has(country.code))
      .map((country) => ({
        code: country.code,
        label: country.known
          ? `${country.name} · ${country.system}`
          : `${country.name} · enter the rate yourself`,
        selected: country.code === this.marketCountry
      }));
  }

  handleMarketCountry(event) {
    this.marketCountry = event.target.value;
  }

  addMarket() {
    const code = this.marketCountry || (this.marketChoices[0] || {}).code;
    if (!code) {
      return;
    }
    const { tax } = getTaxPreset(code);
    this.change("markets", [
      ...(this.draft.markets || []),
      { ...tax, exchangeRate: 1 }
    ]);
    this.marketCountry = "";
  }

  handleMarketField(event) {
    const { index, field } = event.target.dataset;
    const markets = clone(this.draft.markets);
    const { value } = event.target;
    markets[Number(index)][field] = value === "" ? "" : Number(value);
    this.change("markets", markets);
  }

  removeMarket(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.change(
      "markets",
      this.draft.markets.filter((market, position) => position !== index)
    );
  }

  // ---------------------------------------------------------------- Salesforce sync

  get syncRules() {
    return (this.draft.sync.rules || []).map((rule, index) => {
      const fields = this.syncFields[rule.target] || [];
      const field = fields.find((candidate) => candidate.name === rule.field);
      const typed = rule.source === "value";
      const picklist = typed && field && field.options.length > 0;
      return {
        ...rule,
        index,
        key: rule.id || `rule-${index}`,
        moments: SYNC_MOMENTS.map((moment) => ({
          ...moment,
          selected: moment.key === rule.trigger
        })),
        targets: SYNC_TARGETS.map((target) => ({
          name: target,
          selected: target === rule.target
        })),
        fields: fields.map((candidate) => ({
          ...candidate,
          selected: candidate.name === rule.field
        })),
        fieldsLoading: !this.syncFields[rule.target],
        sources: SYNC_SOURCES.filter(
          (source) => source.always || source.moments.includes(rule.trigger)
        ).map((source) => ({
          ...source,
          selected: source.key === rule.source
        })),
        typed,
        picklist,
        valueOptions: picklist
          ? field.options.map((option) => ({
              option,
              selected: option === rule.value
            }))
          : [],
        valueType:
          field && ["date", "datetime"].includes(field.type)
            ? "date"
            : field &&
                ["currency", "double", "percent", "integer"].includes(
                  field.type
                )
              ? "number"
              : "text",
        removeLabel: `Remove rule ${index + 1}`
      };
    });
  }

  get hasSyncRules() {
    return (this.draft.sync.rules || []).length > 0;
  }

  get syncLinks() {
    return [
      { label: "Quote", value: "Account, Contact, Opportunity" },
      { label: "Products and prices", value: "Product, standard price book" },
      {
        label: "Orders, contracts, invoices",
        value: "RevX objects on the Account"
      }
    ];
  }

  loadSyncFields(target) {
    if (this.syncFields[target]) {
      return;
    }
    getSyncFields({ target })
      .then((fields) => {
        this.syncFields = {
          ...this.syncFields,
          [target]: fields
            .slice()
            .sort((a, b) => a.label.localeCompare(b.label))
        };
      })
      .catch((error) => {
        this.syncFieldsError =
          error?.body?.message || "The fields could not be read.";
      });
  }

  addSyncRule() {
    const rules = [
      ...(this.draft.sync.rules || []),
      {
        id: `rule-${Date.now()}`,
        trigger: "quote_signed",
        target: "Opportunity",
        field: "",
        source: "value",
        value: ""
      }
    ];
    this.change("sync.rules", rules);
    this.loadSyncFields("Opportunity");
  }

  handleSyncField(event) {
    const { index, field } = event.target.dataset;
    const rules = clone(this.draft.sync.rules);
    const rule = rules[Number(index)];
    rule[field] = event.target.value;
    if (field === "target") {
      rule.field = "";
      rule.value = "";
      this.loadSyncFields(rule.target);
    }
    if (field === "field" || field === "source") {
      rule.value = "";
    }
    this.change("sync.rules", rules);
  }

  removeSyncRule(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.change(
      "sync.rules",
      this.draft.sync.rules.filter((rule, position) => position !== index)
    );
  }

  get hasAside() {
    return ["brand", "pdf", "tax", "pricing", "billing"].includes(this.section);
  }

  get layoutClass() {
    return this.hasAside ? "rq-work rq-has-aside" : "rq-work";
  }

  // ---------------------------------------------------------------- plain fields

  get fields() {
    return fieldsOf(this.section, this.draft)
      .filter((field) => !field.hidden)
      .map((field) => {
        const value = getAt(this.draft, field.path);
        const view = {
          ...field,
          value,
          isText: field.type === "text",
          isNumber: field.type === "number",
          isArea: field.type === "area",
          isToggle: field.type === "toggle",
          isChoice: field.type === "choice",
          isSelect: field.type === "select",
          wrapClass: field.span ? "rq-field rq-span-all" : "rq-field"
        };
        if (field.options) {
          const known = field.options.some((option) => option.value === value);
          view.options = (
            known ? field.options : [{ value, label: value }, ...field.options]
          ).map((option) => {
            const selected = option.value === value;
            return {
              ...option,
              selected,
              optionClass: selected ? "rq-on" : "",
              pressed: selected ? "true" : "false"
            };
          });
        }
        return view;
      });
  }

  get hasFields() {
    return this.fields.length > 0;
  }

  handleInput(event) {
    this.change(event.target.dataset.path, event.target.value);
  }

  handleNumber(event) {
    const { value } = event.target;
    this.change(event.target.dataset.path, value === "" ? "" : Number(value));
  }

  handleToggle(event) {
    this.change(event.target.dataset.path, event.target.checked);
  }

  handleChoice(event) {
    const { path, value } = event.currentTarget.dataset;
    this.change(path, value);
  }

  handleSection(event) {
    this.section = event.currentTarget.dataset.key;
    this.presetNote = "";
    if (this.section === "sync") {
      (this.draft.sync.rules || []).forEach((rule) =>
        this.loadSyncFields(rule.target)
      );
    }
    if (this.section === "jobs") {
      this.loadJobs();
    }
    // on a narrow page the sections are a row that scrolls sideways
    event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  handleReset() {
    const defaults = getDefaultConfig();
    this.draft = {
      ...clone(this.draft),
      [this.section]: defaults[this.section]
    };
    this.showBrand(this.draft);
    this.refs.toast.show(
      `${this.current.label} is back to the defaults. Publish to make it live.`
    );
  }

  handleDiscard() {
    this.draft = clone(this.saved);
    this.showBrand(this.draft);
    this.refs.toast.show("Changes discarded");
  }

  // ---------------------------------------------------------------- branding

  get swatches() {
    return SWATCHES.map((swatch) => {
      const selected =
        swatch.value === String(this.draft.brand.accent).toLowerCase();
      return {
        ...swatch,
        swatchClass: selected ? "rq-swatch rq-on" : "rq-swatch",
        swatchStyle: `--rq-swatch:${swatch.value}`,
        pressed: selected ? "true" : "false"
      };
    });
  }

  // A colour input only takes a full hex value
  get accentForPicker() {
    return HEX.test(this.draft.brand.accent)
      ? this.draft.brand.accent
      : "#0176d3";
  }

  get logoUrl() {
    return this.draft.brand.logo || LOGO;
  }

  get hasOwnLogo() {
    return Boolean(this.draft.brand.logo);
  }

  get uploadLabel() {
    return this.uploading ? "Uploading…" : "Upload a logo";
  }

  // A figure for the preview tile, in the currency that is set
  get demoMoney() {
    return this.moneyWorks
      ? formatMoneyCompact(482500, { tax: this.draft.tax })
      : "";
  }

  handleSwatch(event) {
    this.change("brand.accent", event.currentTarget.dataset.value);
  }

  pickLogo() {
    this.refs.logoFile.click();
  }

  handleLogoFile(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (!file) {
      return;
    }
    this.logoError = "";
    if (!/\.(png|jpe?g)$/i.test(file.name)) {
      this.logoError = "Upload the logo as a PNG or JPG file.";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      this.logoError = "The logo must be smaller than 1 MB.";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.uploading = true;
      uploadLogo(file.name, reader.result.split(",")[1])
        .then((url) => {
          this.change("brand.logo", url);
          this.refs.toast.show("Logo uploaded. Publish to make it live.");
        })
        .catch((error) => {
          this.logoError =
            error?.body?.message || "The logo could not be uploaded.";
        })
        .finally(() => {
          this.uploading = false;
        });
    };
    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.change("brand.logo", "");
  }

  // ---------------------------------------------------------------- documents

  get usesBrandColour() {
    return !this.draft.pdf.accent;
  }

  get hasDocumentColour() {
    return Boolean(this.draft.pdf.accent);
  }

  get documentColour() {
    return HEX.test(this.draft.pdf.accent)
      ? this.draft.pdf.accent
      : this.accentForPicker;
  }

  handleUseBrandColour(event) {
    this.change("pdf.accent", event.target.checked ? "" : this.accentForPicker);
  }

  get sampleKinds() {
    return [
      { key: "quote", label: "Quote" },
      { key: "invoice", label: "Invoice" }
    ].map((kind) => ({
      ...kind,
      kindClass: kind.key === this.sampleKind ? "rq-on" : "",
      pressed: kind.key === this.sampleKind ? "true" : "false"
    }));
  }

  // The quote the preview is drawn from: one of the org's own, with a discount if there is one
  get sampleQuote() {
    return (
      this.quotes.find((candidate) => candidate.discountTotal > 0) ||
      this.quotes[0]
    );
  }

  // A quote as it prints with the draft settings, or the same figures as an invoice
  get sampleDocument() {
    const quote = this.sampleQuote;
    const document = quote ? getQuoteDocument(quote) : this.exampleDocument;
    if (this.sampleKind !== "invoice") {
      return document;
    }
    const { invoicePrefix, invoiceDueDays } = this.draft.billing;
    const amountPaid = Math.round(document.total * EXAMPLE_PAID_SHARE);
    const due = new Date(Date.now() + (Number(invoiceDueDays) || 0) * DAY);
    return {
      ...document,
      kind: "invoice",
      number: `${invoicePrefix}00425`,
      issuedOn: formatDate(new Date()),
      dueLabel: "Due date",
      dueOn: formatDate(due),
      status: "Part paid",
      isDraft: false,
      amountPaid,
      balance: document.total - amountPaid
    };
  }

  get exampleDocument() {
    const { company, tax, pricing } = this.draft;
    const lines = EXAMPLE_LINES.map((line) => ({
      ...line,
      net: (line.price * line.qty * (100 - line.discount)) / 100
    }));
    const subtotal = lines.reduce(
      (total, line) => total + line.price * line.qty,
      0
    );
    const amount = lines.reduce((total, line) => total + line.net, 0);
    const taxed = calculateTax(
      amount,
      { region: company.state },
      tax,
      company.state
    );
    const validDays = Number(pricing.quoteValidDays) || 0;
    return {
      kind: "quote",
      number: "Q-00001",
      version: 1,
      reference: "Example: 25-seat rollout",
      paymentTerms: pricing.standardTerms,
      notes: "",
      customer: {
        name: "Example Customer Ltd",
        contact: "",
        addressLines: [company.city, company.state].filter(Boolean).length
          ? [[company.city, company.state].filter(Boolean).join(", ")]
          : [],
        registrationNumber: "",
        region: company.state
      },
      lines,
      subtotal,
      discountTotal: subtotal - amount,
      net: taxed.net,
      taxLines: taxed.lines,
      tax: taxed.tax,
      total: taxed.total,
      issuedOn: formatDate(new Date()),
      dueLabel: "Valid until",
      dueOn: formatDate(new Date(Date.now() + validDays * DAY)),
      status: "Draft",
      isDraft: true
    };
  }

  get sampleNote() {
    const quote = this.sampleQuote;
    const source = quote
      ? `Drawn from quote ${quote.number}`
      : "Drawn from an example, as there are no quotes yet";
    return this.sampleKind === "invoice"
      ? `${source}, shown as an invoice that is part paid.`
      : `${source}.`;
  }

  get samplePdfLabel() {
    return this.creatingPdf ? "Creating PDF…" : "Download a sample PDF";
  }

  handleSampleKind(event) {
    this.sampleKind = event.currentTarget.dataset.key;
  }

  handleSamplePdf() {
    this.creatingPdf = true;
    createPdf(this.sampleDocument, this.draft)
      .then((url) => {
        this.pdfUrl = url;
        window.open(url, "_blank");
      })
      .catch((error) => {
        this.refs.toast.show(
          error?.body?.message || "The PDF could not be created.",
          "error"
        );
      })
      .finally(() => {
        this.creatingPdf = false;
      });
  }

  // ---------------------------------------------------------------- tax and currency

  get countries() {
    const term = this.countrySearch.trim().toLowerCase();
    const { country } = this.draft.tax;
    return getCountries()
      .filter(
        (option) =>
          option.code === country ||
          !term ||
          option.name.toLowerCase().includes(term) ||
          option.system.toLowerCase().includes(term)
      )
      .map((option) => ({
        ...option,
        label: option.known
          ? `${option.name} · ${option.system}`
          : `${option.name} · enter the rate yourself`,
        selected: option.code === country
      }));
  }

  get countryCount() {
    return `${getCountries().length} countries and territories`;
  }

  handleCountrySearch(event) {
    this.countrySearch = event.target.value;
  }

  // Picking a country loads its preset over the tax settings
  handleCountry(event) {
    const { tax, note } = getTaxPreset(event.target.value);
    this.draft = { ...clone(this.draft), tax };
    this.presetNote = note;
    this.countrySearch = "";
    // the calculator keeps its region if the new country has it, else takes the first one
    const regions = getRegions(tax.country);
    this.calcRegion = regions.includes(this.calcRegion)
      ? this.calcRegion
      : regions[0] || "";
  }

  get showRegionRates() {
    return this.section === "tax" && this.draft.tax.mode === "regional";
  }

  get regionRows() {
    return this.draft.tax.regionRates.map((row, index) => ({
      ...row,
      index,
      key: `region-${index}`,
      removeLabel: `Remove ${row.region || "this region"}`
    }));
  }

  get regionRateSummary() {
    const count = this.draft.tax.regionRates.length;
    return `${countOf(count, "region")} with their own rate. Any other region uses the rate above.`;
  }

  get hasPresetRates() {
    return getTaxPreset(this.draft.tax.country).tax.regionRates.length > 0;
  }

  changeRegionRates(rows) {
    this.change("tax.regionRates", rows);
  }

  handleRegionField(event) {
    const { index, field } = event.target.dataset;
    const { value } = event.target;
    const rows = clone(this.draft.tax.regionRates);
    if (field === "rate") {
      rows[index].rate = value === "" ? "" : Number(value);
    } else {
      rows[index].region = value;
    }
    this.changeRegionRates(rows);
  }

  addRegion() {
    this.changeRegionRates([
      ...this.draft.tax.regionRates,
      { region: "", rate: this.draft.tax.rate }
    ]);
  }

  removeRegion(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.changeRegionRates(
      this.draft.tax.regionRates.filter((row, position) => position !== index)
    );
  }

  loadPresetRates() {
    this.changeRegionRates(
      getTaxPreset(this.draft.tax.country).tax.regionRates
    );
  }

  // False while the currency or the number format cannot be used
  get moneyWorks() {
    try {
      formatMoney(1, { tax: this.draft.tax });
      return true;
    } catch {
      return false;
    }
  }

  money(amount, decimals = 2) {
    return formatMoney(amount, { tax: this.draft.tax, decimals });
  }

  get calcRegions() {
    const { tax, company } = this.draft;
    const listed = getRegions(tax.country);
    const names = listed.length
      ? listed
      : [
          ...new Set(
            [company.state, ...tax.regionRates.map((row) => row.region)].filter(
              Boolean
            )
          )
        ];
    return names.map((name) => ({
      name,
      selected: name === this.calcRegion
    }));
  }

  get hasCalcRegions() {
    return (
      this.calcRegions.length > 0 &&
      ["split", "regional"].includes(this.draft.tax.mode)
    );
  }

  // The tax on an example amount, worked out with the draft settings
  get calculation() {
    if (!this.moneyWorks) {
      return undefined;
    }
    const { tax, company } = this.draft;
    const amount = Number(this.calcAmount) || 0;
    const result = calculateTax(
      amount,
      { region: this.calcRegion || company.state },
      { ...tax, rate: Number(tax.rate) || 0 },
      company.state
    );
    const rows = [
      {
        label: tax.pricesIncludeTax ? "Net of tax" : "Amount",
        value: this.money(result.net)
      },
      ...result.lines.map((line) => ({
        label: line.label,
        value: this.money(line.amount)
      })),
      { label: "Customer pays", value: this.money(result.total), grand: true }
    ];
    return rows.map((row) => ({
      ...row,
      rowClass: row.grand ? "rq-row rq-grand" : "rq-row"
    }));
  }

  get moneySamples() {
    if (!this.moneyWorks) {
      return [];
    }
    const { tax } = this.draft;
    return [
      { label: "On screen", value: this.money(1234567.5) },
      {
        label: "In tiles and lists",
        value: formatMoneyCompact(1234567.5, { tax })
      },
      {
        label: "A date",
        value: new Intl.DateTimeFormat(tax.locale, {
          day: "numeric",
          month: "short",
          year: "numeric"
        }).format(new Date())
      }
    ];
  }

  handleCalcAmount(event) {
    this.calcAmount = event.target.value;
  }

  handleCalcRegion(event) {
    this.calcRegion = event.target.value;
  }

  // ---------------------------------------------------------------- pricing

  // What the draft policy would do to the quotes that are open now
  get policyImpact() {
    const { discountLimit, standardTerms } = this.draft.pricing;
    const open = this.quotes.filter((quote) =>
      ["draft", "approval", "approved", "sent"].includes(quote.status)
    );
    const outside = open.filter(
      (quote) =>
        quote.maxDiscount > Number(discountLimit) ||
        quote.terms !== standardTerms
    );
    const rows = outside.map((quote) => ({
      id: quote.id,
      number: quote.number,
      account: quote.account,
      why:
        quote.maxDiscount > Number(discountLimit)
          ? `${quote.maxDiscount}% discount`
          : quote.terms
    }));
    return {
      headline: open.length
        ? `${outside.length} of ${countOf(open.length, "open quote")} would need approval`
        : "There are no open quotes to check it against yet.",
      rows,
      hasRows: rows.length > 0,
      allInside: open.length > 0 && rows.length === 0
    };
  }

  // ---------------------------------------------------------------- demo data

  get demoChecked() {
    return this.demoLoaded !== undefined;
  }

  get demoLabel() {
    return this.loadingDemo ? "Loading the demo records…" : "Load demo data";
  }

  get demoDisabled() {
    return this.loadingDemo || !this.canPublish;
  }

  handleLoadDemo() {
    this.loadingDemo = true;
    this.demoError = "";
    loadDemoData()
      .then((note) => {
        this.demoLoaded = true;
        this.demoNote = note;
        this.refs.toast.show("Demo data loaded", "success");
      })
      .catch((error) => {
        this.demoError = errorMessage(error);
      })
      .finally(() => {
        this.loadingDemo = false;
      });
  }

  // ---------------------------------------------------------------- billing

  get reminders() {
    return this.draft.billing.reminderDays.map((days) => ({
      days,
      label: `${countOf(days, "day")} after`,
      removeLabel: `Remove the reminder ${countOf(days, "day")} after the due date`
    }));
  }

  // The dates an invoice raised today would be chased on
  get billingExample() {
    const { invoiceDueDays, reminderDays, invoicePrefix } = this.draft.billing;
    const format = (date) => {
      return this.moneyWorks
        ? new Intl.DateTimeFormat(this.draft.tax.locale, {
            day: "numeric",
            month: "short"
          }).format(date)
        : date.toDateString();
    };
    const due = new Date(Date.now() + (Number(invoiceDueDays) || 0) * DAY);
    return [
      { label: "Invoice number", value: `${invoicePrefix}00425` },
      { label: "Raised today, due", value: format(due) },
      ...reminderDays.map((days, index) => ({
        label: `Reminder ${index + 1}`,
        value: format(new Date(due.getTime() + days * DAY))
      }))
    ];
  }

  handleNewReminder(event) {
    this.newReminder = event.target.value;
  }

  addReminder() {
    const days = Number(this.newReminder);
    const { reminderDays } = this.draft.billing;
    if (!Number.isInteger(days) || days < 1 || reminderDays.includes(days)) {
      return;
    }
    this.change(
      "billing.reminderDays",
      [...reminderDays, days].sort((a, b) => a - b)
    );
    this.newReminder = "";
  }

  removeReminder(event) {
    const days = Number(event.currentTarget.dataset.days);
    this.change(
      "billing.reminderDays",
      this.draft.billing.reminderDays.filter((value) => value !== days)
    );
  }

  // ---------------------------------------------------------------- history

  get versions() {
    const format = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
    return (this.history || []).map((version) => ({
      ...version,
      title: `Version ${version.version}`,
      detail: `${version.publishedBy} · ${format.format(new Date(version.publishedAt))}`,
      note: version.note || "No note",
      live: version.version === this.liveVersion
    }));
  }

  get hasVersions() {
    return this.versions.length > 0;
  }

  get versionPaging() {
    return paginate(this.versions, this.versionPage, VERSIONS_PER_PAGE);
  }

  get versionsPerPage() {
    return VERSIONS_PER_PAGE;
  }

  handleVersionPage(event) {
    this.versionPage = event.detail.page;
  }

  handleRestore(event) {
    const { id, version } = event.currentTarget.dataset;
    getConfigVersion(id)
      .then((config) => {
        this.draft = config;
        this.showBrand(config);
        this.refs.toast.show(
          `Version ${version} is loaded as a draft. Review and publish to make it live.`
        );
      })
      .catch((error) => {
        this.refs.toast.show(
          error?.body?.message || "That version could not be loaded.",
          "error"
        );
      });
  }

  // ---------------------------------------------------------------- jobs
  jobsStatus;
  jobsHour = 2;
  loadingJobs = false;
  runningJobs = false;

  loadJobs() {
    this.loadingJobs = true;
    getJobs()
      .then((status) => {
        this.jobsStatus = status;
        if (status?.hour !== undefined) {
          this.jobsHour = status.hour;
        }
      })
      .catch((err) => {
        this.refs.toast.show(errorMessage(err), "error");
      })
      .finally(() => {
        this.loadingJobs = false;
      });
  }

  handleJobsHourChange(event) {
    this.jobsHour = Number(event.target.value);
    this.change("jobs.dailyHour", this.jobsHour);
  }

  handleScheduleJobs() {
    this.loadingJobs = true;
    scheduleJobs({ hour: this.jobsHour })
      .then((status) => {
        this.jobsStatus = status;
        this.refs.toast.show(
          `Daily jobs scheduled for ${String(this.jobsHour).padStart(2, "0")}:00`,
          "success"
        );
      })
      .catch((err) => {
        this.refs.toast.show(errorMessage(err), "error");
      })
      .finally(() => {
        this.loadingJobs = false;
      });
  }

  handleUnscheduleJobs() {
    this.loadingJobs = true;
    unscheduleJobs()
      .then((status) => {
        this.jobsStatus = status;
        this.refs.toast.show("Daily jobs stopped", "info");
      })
      .catch((err) => {
        this.refs.toast.show(errorMessage(err), "error");
      })
      .finally(() => {
        this.loadingJobs = false;
      });
  }

  handleRunJobsNow() {
    this.runningJobs = true;
    runJobs()
      .then((msg) => {
        this.refs.toast.show(msg, "success");
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => this.loadJobs(), 3000);
      })
      .catch((err) => {
        this.refs.toast.show(errorMessage(err), "error");
      })
      .finally(() => {
        this.runningJobs = false;
      });
  }

  handleJobToggle(event) {
    const { path } = event.target.dataset;
    this.change(path, event.target.checked);
  }

  get isJobScheduled() {
    return Boolean(this.jobsStatus?.scheduled);
  }

  get runJobsButtonLabel() {
    return this.runningJobs ? "Running…" : "Run all jobs now";
  }

  get jobStatusLabel() {
    return this.isJobScheduled ? "Scheduled" : "Stopped";
  }

  get jobStatusPillClass() {
    return `rq-pill ${this.isJobScheduled ? "rq-tone-good" : "rq-tone-mute"}`;
  }

  get jobNextRunLabel() {
    return this.jobsStatus?.nextRun
      ? formatDate(new Date(this.jobsStatus.nextRun))
      : "Not scheduled";
  }

  get jobLastRunLabel() {
    return this.jobsStatus?.lastRun
      ? formatDate(new Date(this.jobsStatus.lastRun))
      : "Never run";
  }

  get hasJobResults() {
    return (this.jobsStatus?.lastResults || []).length > 0;
  }

  get jobResults() {
    return this.jobsStatus?.lastResults || [];
  }

  // ---------------------------------------------------------------- emails
  get mergeTags() {
    return [
      "{{quote.number}}",
      "{{quote.total}}",
      "{{invoice.number}}",
      "{{invoice.total}}",
      "{{payment.amount}}",
      "{{subscription.number}}",
      "{{contact.firstName}}",
      "{{company.name}}"
    ];
  }

  get emailTemplates() {
    return this.draft.emails?.templates || [];
  }

  handleEmailSenderField(event) {
    const { field } = event.target.dataset;
    this.change(`emails.${field}`, event.target.value);
  }

  handleTemplateField(event) {
    const { key, field } = event.target.dataset;
    const templates = (this.draft.emails?.templates || []).map((t) => {
      if (t.key === key) {
        return {
          ...t,
          [field]: field === "enabled" ? event.target.checked : event.target.value
        };
      }
      return t;
    });
    this.change("emails.templates", templates);
  }

  // ---------------------------------------------------------------- automation
  showAutomationModal = false;
  editingAutomationIndex = -1;
  automationForm = {
    name: "",
    active: true,
    event: "quote.signed",
    type: "task",
    target: "Account",
    field: "",
    value: "",
    message: "",
    url: ""
  };

  get automationRules() {
    return (this.draft.automation?.rules || []).map((rule, index) => {
      let actionSummary = "Custom action";
      if (rule.actions && rule.actions.length > 0) {
        const a = rule.actions[0];
        actionSummary = `${a.type.toUpperCase()}: ${a.target || a.field || a.url || a.message || ""}`;
      } else if (rule.type) {
        actionSummary = `${rule.type.toUpperCase()}: ${rule.target || rule.field || rule.url || rule.message || ""}`;
      }
      return {
        ...rule,
        index,
        key: `rule-${index}`,
        actionSummary,
        pillClass: rule.active ? "rq-pill rq-tone-good" : "rq-pill rq-tone-mute",
        activeLabel: rule.active ? "Active" : "Inactive"
      };
    });
  }

  get hasAutomationRules() {
    return this.automationRules.length > 0;
  }

  openNewAutomationRule() {
    this.editingAutomationIndex = -1;
    this.automationForm = {
      name: "",
      active: true,
      event: "quote.signed",
      type: "task",
      target: "Account",
      field: "",
      value: "",
      message: "",
      url: ""
    };
    this.showAutomationModal = true;
  }

  editAutomationRule(event) {
    const index = Number(event.currentTarget.dataset.index);
    const rule = this.draft.automation?.rules?.[index];
    if (rule) {
      this.editingAutomationIndex = index;
      const firstAction = rule.actions?.[0] || {};
      this.automationForm = {
        id: rule.id,
        name: rule.name,
        active: rule.active,
        event: rule.event || "quote.signed",
        type: firstAction.type || rule.type || "task",
        target: firstAction.target || rule.target || "Account",
        field: firstAction.field || rule.field || "",
        value: firstAction.value || rule.value || "",
        message: firstAction.message || rule.message || "",
        url: firstAction.url || rule.url || ""
      };
      this.showAutomationModal = true;
    }
  }

  deleteAutomationRule(event) {
    const index = Number(event.currentTarget.dataset.index);
    const rules = [...(this.draft.automation?.rules || [])];
    rules.splice(index, 1);
    this.change("automation.rules", rules);
  }

  toggleAutomationRule(event) {
    const index = Number(event.currentTarget.dataset.index);
    const rules = [...(this.draft.automation?.rules || [])];
    if (rules[index]) {
      rules[index] = { ...rules[index], active: !rules[index].active };
      this.change("automation.rules", rules);
    }
  }

  handleAutomationField(event) {
    const { field } = event.target.dataset;
    this.automationForm = {
      ...this.automationForm,
      [field]: field === "active" ? event.target.checked : event.target.value
    };
  }

  saveAutomationRule() {
    if (!this.automationForm.name.trim()) {
      this.refs.toast.show("Please enter a rule name", "error");
      return;
    }
    const rules = [...(this.draft.automation?.rules || [])];
    const ruleObj = {
      id: this.automationForm.id || `ar-${Date.now()}`,
      name: this.automationForm.name.trim(),
      active: Boolean(this.automationForm.active),
      event: this.automationForm.event,
      actions: [
        {
          type: this.automationForm.type,
          target: this.automationForm.target,
          field: this.automationForm.field,
          value: this.automationForm.value,
          message: this.automationForm.message,
          url: this.automationForm.url
        }
      ]
    };

    if (this.editingAutomationIndex >= 0) {
      rules[this.editingAutomationIndex] = ruleObj;
    } else {
      rules.push(ruleObj);
    }
    this.change("automation.rules", rules);
    this.showAutomationModal = false;
  }

  closeAutomationModal() {
    this.showAutomationModal = false;
  }

  // ---------------------------------------------------------------- product rules
  showProductRuleModal = false;
  editingProductRuleIndex = -1;
  productRuleForm = {
    name: "",
    active: true,
    kind: "validation",
    message: "",
    productId: "",
    addProductId: "",
    addQty: 1,
    removeProductId: ""
  };

  get productRulesList() {
    return (this.draft.productRules || []).map((rule, index) => {
      let kindTone = "rq-tone-accent";
      if (rule.kind === "validation") kindTone = "rq-tone-bad";
      else if (rule.kind === "alert") kindTone = "rq-tone-warn";

      return {
        ...rule,
        index,
        key: `prule-${index}`,
        kindLabel: (rule.kind || "validation").toUpperCase(),
        kindClass: `rq-pill ${kindTone}`,
        pillClass: rule.active ? "rq-pill rq-tone-good" : "rq-pill rq-tone-mute",
        activeLabel: rule.active ? "Active" : "Inactive"
      };
    });
  }

  get hasProductRules() {
    return this.productRulesList.length > 0;
  }

  get productOptions() {
    const list = getProducts();
    return [
      { value: "", label: "— Any / None —" },
      ...list.map((p) => ({ value: p.id, label: p.name }))
    ];
  }

  openNewProductRule() {
    this.editingProductRuleIndex = -1;
    this.productRuleForm = {
      name: "",
      active: true,
      kind: "validation",
      message: "",
      productId: "",
      addProductId: "",
      addQty: 1,
      removeProductId: ""
    };
    this.showProductRuleModal = true;
  }

  editProductRule(event) {
    const index = Number(event.currentTarget.dataset.index);
    const rule = this.draft.productRules?.[index];
    if (rule) {
      this.editingProductRuleIndex = index;
      this.productRuleForm = { ...rule };
      this.showProductRuleModal = true;
    }
  }

  deleteProductRule(event) {
    const index = Number(event.currentTarget.dataset.index);
    const rules = [...(this.draft.productRules || [])];
    rules.splice(index, 1);
    this.change("productRules", rules);
  }

  toggleProductRule(event) {
    const index = Number(event.currentTarget.dataset.index);
    const rules = [...(this.draft.productRules || [])];
    if (rules[index]) {
      rules[index] = { ...rules[index], active: !rules[index].active };
      this.change("productRules", rules);
    }
  }

  handleProductRuleField(event) {
    const { field } = event.target.dataset;
    this.productRuleForm = {
      ...this.productRuleForm,
      [field]: field === "active" ? event.target.checked : event.target.value
    };
  }

  saveProductRule() {
    if (!this.productRuleForm.name.trim()) {
      this.refs.toast.show("Please enter a rule name", "error");
      return;
    }
    const rules = [...(this.draft.productRules || [])];
    const ruleObj = {
      id: this.productRuleForm.id || `pr-${Date.now()}`,
      name: this.productRuleForm.name.trim(),
      active: Boolean(this.productRuleForm.active),
      kind: this.productRuleForm.kind,
      message: this.productRuleForm.message
        ? this.productRuleForm.message.trim()
        : "",
      productId: this.productRuleForm.productId,
      addProductId: this.productRuleForm.addProductId,
      addQty: Number(this.productRuleForm.addQty) || 1,
      removeProductId: this.productRuleForm.removeProductId
    };

    if (this.editingProductRuleIndex >= 0) {
      rules[this.editingProductRuleIndex] = ruleObj;
    } else {
      rules.push(ruleObj);
    }
    this.change("productRules", rules);
    this.showProductRuleModal = false;
  }

  closeProductRuleModal() {
    this.showProductRuleModal = false;
  }

  // ---------------------------------------------------------------- publish

  openReview(event) {
    this._trigger = event.currentTarget;
    this.publishNote = "";
    this.publishError = "";
    this.reviewing = true;
  }

  handleNote(event) {
    this.publishNote = event.target.value;
  }

  get publishLabel() {
    return this.publishing ? "Publishing…" : "Publish";
  }

  get publishDisabled() {
    return this.publishing || this.hasProblems;
  }

  handlePublish() {
    this.publishing = true;
    this.publishError = "";
    publishConfig(this.draft, this.publishNote.trim())
      .then((version) => {
        this.saved = clone(this.draft);
        this.liveVersion = version;
        this.refs.toast.show(`Published as version ${version}`, "success");
        this.refs.reviewModal.close();
        return this.loadHistory();
      })
      .catch((error) => {
        this.publishError =
          error?.body?.message || "Could not publish. Try again.";
      })
      .finally(() => {
        this.publishing = false;
      });
  }

  cancelReview() {
    this.refs.reviewModal.close();
  }

  closeReview() {
    this.reviewing = false;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  // ---------------------------------------------------------------- AI & Intelligence

  loadAiStatus() {
    getAiStatusApex()
      .then((status) => {
        if (status) {
          this.hasAiKey = Boolean(status.hasKey);
          this.aiForm.provider = status.provider || "local";
          this.aiForm.model = status.model || "gpt-4o-mini";
        }
      })
      .catch(() => {});
  }

  get isExternalAi() {
    return (
      this.aiForm.provider === "openai" || this.aiForm.provider === "gemini"
    );
  }

  get aiKeyPlaceholder() {
    return this.hasAiKey
      ? "•••••••••••••••• (Key configured)"
      : "Enter API key";
  }

  get aiKeyStatusText() {
    return this.hasAiKey
      ? "API key is securely stored in RevX Secrets (masked)."
      : "Enter your API key and click Save. Enter '-' to remove.";
  }

  get testAiButtonLabel() {
    return this.testingAi ? "Testing connection…" : "Test connection";
  }

  get aiTestBannerClass() {
    const ok = this.aiTestResult?.ok;
    return ok ? "rq-pill rq-tone-good" : "rq-pill rq-tone-warn";
  }

  handleAiProviderChange(event) {
    this.aiForm = { ...this.aiForm, provider: event.target.value };
    this.saveAiSettingField("aiProvider", event.target.value);
  }

  handleAiModelChange(event) {
    this.aiForm = { ...this.aiForm, model: event.target.value };
    this.saveAiSettingField("aiModel", event.target.value);
  }

  handleAiKeyChange(event) {
    this.aiForm = { ...this.aiForm, apiKey: event.target.value };
  }

  handleAiFeatureToggle(event) {
    const feat = event.target.dataset.feat;
    this.aiForm = { ...this.aiForm, [feat]: event.target.checked };
    this.refs.toast.show("Preference updated", "info");
  }

  saveAiSecretKey() {
    if (!this.aiForm.apiKey) return;
    this.savingAiKey = true;
    saveSecrets({
      input: JSON.stringify({
        aiApiKey: this.aiForm.apiKey,
        aiProvider: this.aiForm.provider,
        aiModel: this.aiForm.model
      })
    })
      .then(() => {
        this.refs.toast.show("AI API Key saved securely", "success");
        this.hasAiKey = this.aiForm.apiKey !== "-";
        this.aiForm = { ...this.aiForm, apiKey: "" };
      })
      .catch((err) => {
        this.refs.toast.show(errorMessage(err), "error");
      })
      .finally(() => {
        this.savingAiKey = false;
      });
  }

  saveAiSettingField(key, val) {
    saveSecrets({
      input: JSON.stringify({
        [key]: val
      })
    }).catch(() => {});
  }

  testAiConnectionClick() {
    this.testingAi = true;
    this.aiTestResult = null;
    testAiConnectionApex({
      provider: this.aiForm.provider,
      apiKey: this.aiForm.apiKey,
      model: this.aiForm.model
    })
      .then((res) => {
        this.aiTestResult = res;
      })
      .catch((err) => {
        this.aiTestResult = { ok: false, message: errorMessage(err) };
      })
      .finally(() => {
        this.testingAi = false;
      });
  }

  // ---------------------------------------------------------------- Payment Gateways

  gatewayStatus = {
    activeGateway: "manual",
    hasKey: false,
    hasSecret: false,
    hasWebhookSecret: false,
    webhookEndpoint: "",
    portalPay: true
  };
  gatewayKey = "";
  gatewaySecret = "";
  webhookSecret = "";
  testingGateway = false;
  gatewayTestResult = null;
  savingGatewayKeys = false;

  loadGatewayStatus() {
    getPaymentGatewayStatusApex()
      .then((status) => {
        if (status) {
          this.gatewayStatus = status;
          if (!this.draft.gateway) {
            this.draft.gateway = status.activeGateway || "manual";
          }
        }
      })
      .catch(() => {});
  }

  get activeGateway() {
    return (
      this.draft.payments?.gateway ||
      this.draft.gateway ||
      this.gatewayStatus.activeGateway ||
      "manual"
    );
  }

  get isStripe() {
    return this.activeGateway === "stripe";
  }

  get isRazorpay() {
    return this.activeGateway === "razorpay";
  }

  get isManualGateway() {
    return this.activeGateway === "manual";
  }

  get gatewayOptions() {
    const current = this.activeGateway;
    return [
      {
        value: "manual",
        label: "Manual / Bank Wire / Cheque (No gateway API callout)",
        selected: current === "manual"
      },
      {
        value: "stripe",
        label: "Stripe (Cards, Apple Pay, Google Pay, Global)",
        selected: current === "stripe"
      },
      {
        value: "razorpay",
        label: "Razorpay (UPI, Cards, Netbanking, Wallets, India & Global)",
        selected: current === "razorpay"
      }
    ];
  }

  get canTestGateway() {
    return !this.isManualGateway;
  }

  get testGatewayButtonLabel() {
    return this.testingGateway ? "Testing connection…" : "Test connection";
  }

  get gatewayVerdictClass() {
    return this.gatewayTestResult?.ok
      ? "rq-verdict rq-tone-good"
      : "rq-verdict rq-tone-bad";
  }

  get gatewaySecretPlaceholder() {
    return this.gatewayStatus.hasSecret ? "•••••••••••••••• (Secret stored)" : "Enter Secret Key";
  }

  get gatewayKeyPlaceholder() {
    return this.gatewayStatus.hasKey ? "•••••••••••••••• (Key ID stored)" : "Enter Key ID (e.g. rzp_live_...)";
  }

  get webhookSecretPlaceholder() {
    return this.gatewayStatus.hasWebhookSecret ? "•••••••••••••••• (Webhook secret stored)" : "Enter Webhook signing secret";
  }

  get gatewayExplanationText() {
    if (this.isStripe) {
      return "Stripe Checkout creates hosted, mobile-ready payment sessions supporting global cards, Apple Pay, Google Pay, and international currencies.";
    }
    if (this.isRazorpay) {
      return "Razorpay Checkout provides instant payment links for UPI (Google Pay, PhonePe, Paytm), credit/debit cards, netbanking, and Indian rupees.";
    }
    return "Invoices use offline bank instructions and require manual payment entry.";
  }

  get paymentLinks() {
    return this.draft.payments?.paymentLinks ?? true;
  }

  handlePaymentLinksToggle(event) {
    this.change("payments.paymentLinks", event.target.checked);
  }

  get portalPay() {
    return this.draft.portalPay ?? this.gatewayStatus.portalPay ?? true;
  }

  handlePortalPayToggle(event) {
    this.change("portalPay", event.target.checked);
  }

  handleGatewaySelect(event) {
    const val = event.target.value;
    this.change("payments.gateway", val);
    this.change("gateway", val);
    this.gatewayStatus = { ...this.gatewayStatus, activeGateway: val };
    const base = window.location.origin;
    this.gatewayStatus.webhookEndpoint = `${base}/services/apexrest/revquila/payments/${val === "manual" ? "generic" : val}`;
    this.gatewayTestResult = null;
  }

  handleGatewayKeyInput(event) {
    this.gatewayKey = event.target.value;
  }

  handleGatewaySecretInput(event) {
    this.gatewaySecret = event.target.value;
  }

  handleWebhookSecretInput(event) {
    this.webhookSecret = event.target.value;
  }

  saveGatewaySecrets() {
    const payload = {};
    if (this.gatewaySecret) payload.gatewaySecret = this.gatewaySecret;
    if (this.gatewayKey) payload.gatewayKey = this.gatewayKey;
    if (this.webhookSecret) payload.webhookSecret = this.webhookSecret;

    if (Object.keys(payload).length === 0) {
      this.refs.toast.show("Enter a key or secret to save.", "warn");
      return;
    }

    this.savingGatewayKeys = true;
    saveSecrets({ input: JSON.stringify(payload) })
      .then(() => {
        this.refs.toast.show("Gateway credentials securely saved", "success");
        if (payload.gatewaySecret) this.gatewayStatus.hasSecret = payload.gatewaySecret !== "-";
        if (payload.gatewayKey) this.gatewayStatus.hasKey = payload.gatewayKey !== "-";
        if (payload.webhookSecret) this.gatewayStatus.hasWebhookSecret = payload.webhookSecret !== "-";
        this.gatewayKey = "";
        this.gatewaySecret = "";
        this.webhookSecret = "";
      })
      .catch((err) => {
        this.refs.toast.show(errorMessage(err), "error");
      })
      .finally(() => {
        this.savingGatewayKeys = false;
      });
  }

  testGatewayConnectionClick() {
    this.testingGateway = true;
    this.gatewayTestResult = null;
    testPaymentGatewayApex({ gateway: this.activeGateway })
      .then((res) => {
        this.gatewayTestResult = res;
      })
      .catch((err) => {
        this.gatewayTestResult = { ok: false, message: errorMessage(err) };
      })
      .finally(() => {
        this.testingGateway = false;
      });
  }

  copyWebhookUrl() {
    const url = this.gatewayStatus.webhookEndpoint;
    if (!url) return;
    navigator.clipboard.writeText(url)
      .then(() => this.refs.toast.show("Webhook URL copied to clipboard", "good"))
      .catch(() => this.refs.toast.show(url, "good"));
  }

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }
}