import getActivePayload from "@salesforce/apex/RevquilaConfigController.getActivePayload";
import getHistory from "@salesforce/apex/RevquilaConfigController.getHistory";
import getPayload from "@salesforce/apex/RevquilaConfigController.getPayload";
import publish from "@salesforce/apex/RevquilaConfigController.publish";
import uploadLogoFile from "@salesforce/apex/RevquilaConfigController.uploadLogo";

/**
 * The Revquila configuration an admin edits on the Setup tab.
 *
 * It is one JSON document, published as versions (see RevquilaConfigController).
 * Anything missing from a published version falls back to the value here, so
 * new settings can be added without migrating old versions.
 */
export const DEFAULT_CONFIG = {
  company: {
    name: "RevX Demo Pvt Ltd",
    registrationNumber: "27AAAAA0000A1Z5",
    address: "4th Floor, Sapphire Tower, Baner Road",
    city: "Pune",
    state: "Maharashtra",
    postalCode: "411045",
    email: "accounts@example.com",
    phone: "+91 20 5550 0100",
    website: "www.example.com"
  },
  brand: {
    // The app's accent colour. Buttons, links, charts and the page tint follow it.
    accent: "#0176d3",
    // URL of an uploaded logo. Empty shows the Revquila logo.
    logo: ""
  },
  pdf: {
    layout: "classic", // classic | modern | minimal
    pageSize: "A4", // A4 | Letter
    font: "sans", // sans | serif
    accent: "", // empty uses brand.accent
    showLogo: true,
    logoPosition: "left", // left | right
    quoteTitle: "Quotation",
    invoiceTitle: "Tax Invoice",
    showUnit: true,
    showDiscount: true,
    showTaxBreakup: true,
    showBankDetails: true,
    bankDetails:
      "Bank: Example Bank, Baner branch\nAccount: 0000 0000 0000\nIFSC: EXMP0000000",
    terms:
      "1. Prices are valid until the date shown above.\n2. Payment is due as per the payment terms on this document.\n3. Taxes are charged at the rate in force on the invoice date.",
    footer: "Thank you for your business.",
    showSignature: true,
    signatory: "Authorised Signatory",
    draftWatermark: true
  },
  tax: {
    country: "IN", // ISO 3166-1 alpha-2
    countryName: "India",
    system: "GST", // what the tax is called on documents
    registrationLabel: "GSTIN", // what the registration number is called
    currency: "INR", // ISO 4217
    locale: "en-IN", // number formatting
    // none: no tax line | single: one line at `rate` | split: `splitLabels` share the rate when the
    // customer is in the company's state, `crossLabel` otherwise | regional: the customer's region sets the rate
    mode: "split",
    rate: 18,
    splitLabels: ["CGST", "SGST"],
    crossLabel: "IGST",
    regionLabel: "State",
    regionRates: [], // regional mode: [{ region: "California", rate: 7.25 }]; other regions use `rate`
    pricesIncludeTax: false
  },
  // Other countries Revquila sells into: each is a `tax` block of its own plus `exchangeRate`,
  // the units of its currency per one unit of the home currency
  markets: [],
  // Setup > Salesforce sync: what to write into the linked Account, Contact or Opportunity
  // when a quote is created, sent or signed, an order is activated or an invoice is paid
  sync: {
    rules: [] // [{ id, trigger, target, field, source, value }]
  },
  pricing: {
    discountLimit: 15, // a line discount above this % needs approval
    standardTerms: "Net 30", // any other payment terms need approval
    quoteValidDays: 30,
    // a name to show reps; who may approve is set by the Approve Quotes permission
    approver: ""
  },
  billing: {
    invoicePrefix: "INV-",
    invoiceDueDays: 30,
    reminderDays: [3, 7, 14], // days after the due date
    lateFeePercent: 0
  },
  payments: {
    gateway: "manual",
    paymentLinks: true,
    autoPay: false
  },
  notifications: {
    approvalPending: true,
    quoteViewed: true,
    quoteSigned: true,
    invoiceOverdue: true,
    paymentReceived: true,
    renewalDue: true
  },
  jobs: {
    dailyHour: 2,
    autoRunBilling: true,
    autoRecognize: true,
    expireQuotes: true,
    expireContracts: true,
    autoRenew: true,
    fxAutoFetch: false
  },
  emails: {
    fromName: "RevX Billing",
    replyTo: "billing@example.com",
    cc: "",
    templates: [
      {
        key: "quote_sent",
        label: "Quote sent",
        subject: "Your quotation {{quote.number}} from {{company.name}}",
        body: "Hi {{contact.firstName}},\n\nPlease find attached quotation {{quote.number}} for {{quote.total}}.\n\nBest regards,\n{{user.name}}",
        enabled: true
      },
      {
        key: "quote_signed",
        label: "Quote signed",
        subject: "Confirmed: Quote {{quote.number}} has been signed",
        body: "Hi {{contact.firstName}},\n\nThank you for signing quote {{quote.number}}! We are setting up your order now.\n\nBest regards,\n{{company.name}}",
        enabled: true
      },
      {
        key: "invoice_sent",
        label: "Invoice sent",
        subject: "Invoice {{invoice.number}} from {{company.name}}",
        body: "Hi {{contact.firstName}},\n\nPlease find your tax invoice {{invoice.number}} for {{invoice.total}}, due on {{invoice.dueDate}}.\n\nBest regards,\n{{company.name}}",
        enabled: true
      },
      {
        key: "reminder",
        label: "Payment reminder",
        subject: "Reminder: Invoice {{invoice.number}} payment is due",
        body: "Hi {{contact.firstName}},\n\nThis is a friendly reminder that invoice {{invoice.number}} for {{invoice.total}} is due.\n\nBest regards,\n{{company.name}}",
        enabled: true
      },
      {
        key: "payment_received",
        label: "Payment received",
        subject: "Payment received for {{invoice.number}}",
        body: "Hi {{contact.firstName}},\n\nThank you! We have received your payment of {{payment.amount}} for invoice {{invoice.number}}.\n\nBest regards,\n{{company.name}}",
        enabled: true
      },
      {
        key: "renewal_due",
        label: "Renewal due",
        subject: "Subscription {{subscription.number}} renewal notice",
        body: "Hi {{contact.firstName}},\n\nYour subscription {{subscription.number}} is scheduled for renewal on {{subscription.renewalDate}}.\n\nBest regards,\n{{company.name}}",
        enabled: true
      }
    ]
  },
  automation: {
    rules: []
  },
  productRules: []
};

const HEX = /^#[0-9a-f]{6}$/i;

let current = clone(DEFAULT_CONFIG);
let loading;
const listeners = new Set();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Published values win; anything they leave out comes from the defaults
function withDefaults(saved, defaults = DEFAULT_CONFIG) {
  const merged = {};
  Object.keys(defaults).forEach((key) => {
    const fallback = defaults[key];
    const value = saved ? saved[key] : undefined;
    const isSection =
      fallback !== null &&
      typeof fallback === "object" &&
      !Array.isArray(fallback);
    if (isSection) {
      merged[key] = withDefaults(value, fallback);
    } else {
      merged[key] = value === undefined ? clone(fallback) : value;
    }
  });
  return merged;
}

function use(config) {
  current = config;
  listeners.forEach((listener) => listener());
}

/** The configuration in use right now: the defaults until loadConfig() resolves. */
export function getConfig() {
  return current;
}

/** Loads the published configuration once per page load. Resolves with it. */
export function loadConfig() {
  if (!loading) {
    loading = getActivePayload().then((payload) => {
      if (payload) {
        use(withDefaults(JSON.parse(payload)));
      }
      return current;
    });
  }
  return loading;
}

/** Calls listener whenever the configuration in use changes. Returns the unsubscribe function. */
export function onConfigChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Publishes config as the next version and makes it the one in use. Resolves with the version number. */
export function publishConfig(config, note) {
  return publish({ payload: JSON.stringify(config), note }).then((version) => {
    use(clone(config));
    return version;
  });
}

/** Resolves with [{ id, version, note, publishedBy, publishedAt }], newest first. */
export function getConfigHistory() {
  return getHistory();
}

/** Resolves with the configuration of one past version, defaults filled in. */
export function getConfigVersion(id) {
  return getPayload({ versionId: id }).then((payload) =>
    withDefaults(JSON.parse(payload))
  );
}

/** Stores a PNG or JPG (base64, no data: prefix) and resolves with the URL for brand.logo. */
export function uploadLogo(fileName, base64Data) {
  return uploadLogoFile({ fileName, base64Data });
}

/** A fresh copy of the defaults, for a "reset this section" action. */
export function getDefaultConfig() {
  return clone(DEFAULT_CONFIG);
}

function mix(hex, target, share) {
  const channels = [1, 3, 5].map((start) =>
    parseInt(hex.slice(start, start + 2), 16)
  );
  return `#${channels
    .map((channel) =>
      Math.round(channel + (target - channel) * share)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

/**
 * The CSS custom properties that carry the admin's accent colour. revquilaTheme reads them
 * with the Revquila blues as fallbacks, so an untouched accent sets nothing.
 */
export function brandProperties(config = current) {
  const { accent } = config.brand;
  if (
    !HEX.test(accent) ||
    accent.toLowerCase() === DEFAULT_CONFIG.brand.accent
  ) {
    return {};
  }
  return {
    "--rq-brand-acc": accent,
    "--rq-brand-acc-deep": mix(accent, 0, 0.35),
    "--rq-brand-acc2": mix(accent, 255, 0.35)
  };
}