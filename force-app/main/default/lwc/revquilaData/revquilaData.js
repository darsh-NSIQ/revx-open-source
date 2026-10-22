import actOnQuoteApex from "@salesforce/apex/RevquilaQuoteController.act";
import approveAllApex from "@salesforce/apex/RevquilaQuoteController.approveAll";
import canApproveApex from "@salesforce/apex/RevquilaQuoteController.canApprove";
import cloneQuoteApex from "@salesforce/apex/RevquilaQuoteController.cloneQuote";
import getQuoteApex from "@salesforce/apex/RevquilaQuoteController.getQuote";
import getQuotesApex from "@salesforce/apex/RevquilaQuoteController.getQuotes";
import saveQuoteApex from "@salesforce/apex/RevquilaQuoteController.saveQuote";
import syncOpportunityLinesApex from "@salesforce/apex/RevquilaQuoteController.syncOpportunityLines";
import createPaymentLinkApex from "@salesforce/apex/RevquilaInvoiceController.createPaymentLink";
import emailInvoiceApex from "@salesforce/apex/RevquilaInvoiceController.emailInvoice";
import generateEInvoiceApex from "@salesforce/apex/RevquilaInvoiceController.generateEInvoice";
import getInvoiceApex from "@salesforce/apex/RevquilaInvoiceController.getInvoice";
import getInvoicesApex from "@salesforce/apex/RevquilaInvoiceController.getInvoices";
import issueCreditNoteApex from "@salesforce/apex/RevquilaInvoiceController.issueCreditNote";
import logPromiseApex from "@salesforce/apex/RevquilaInvoiceController.logPromise";
import logRemindersApex from "@salesforce/apex/RevquilaInvoiceController.logReminders";
import markSentApex from "@salesforce/apex/RevquilaInvoiceController.markSent";
import recordPaymentApex from "@salesforce/apex/RevquilaInvoiceController.recordPayment";
import refundApex from "@salesforce/apex/RevquilaInvoiceController.refund";
import writeOffApex from "@salesforce/apex/RevquilaInvoiceController.writeOff";
import cancelApex from "@salesforce/apex/RevquilaSubscriptionController.cancel";
import changeQuantityApex from "@salesforce/apex/RevquilaSubscriptionController.changeQuantity";
import getSubscriptionApex from "@salesforce/apex/RevquilaSubscriptionController.getSubscription";
import getSubscriptionsApex from "@salesforce/apex/RevquilaSubscriptionController.getSubscriptions";
import logNoteApex from "@salesforce/apex/RevquilaSubscriptionController.logNote";
import logUsageApex from "@salesforce/apex/RevquilaSubscriptionController.logUsage";
import pauseApex from "@salesforce/apex/RevquilaSubscriptionController.pause";
import renewApex from "@salesforce/apex/RevquilaSubscriptionController.renew";
import resumeApex from "@salesforce/apex/RevquilaSubscriptionController.resume";
import setAutoRenewApex from "@salesforce/apex/RevquilaSubscriptionController.setAutoRenew";
import getDashboardApex from "@salesforce/apex/RevquilaDashboardController.getDashboard";
import saveInvoiceApex from "@salesforce/apex/RevquilaInvoiceController.saveInvoice";
import saveSubscriptionApex from "@salesforce/apex/RevquilaSubscriptionController.saveSubscription";
import getOrdersApex from "@salesforce/apex/RevquilaOrderController.getOrders";
import getOrderApex from "@salesforce/apex/RevquilaOrderController.getOrder";
import activateOrderApex from "@salesforce/apex/RevquilaOrderController.activate";
import invoiceOrderApex from "@salesforce/apex/RevquilaOrderController.invoice";
import cancelOrderApex from "@salesforce/apex/RevquilaOrderController.cancel";
import saveOrderApex from "@salesforce/apex/RevquilaOrderController.saveOrder";
import getContractsApex from "@salesforce/apex/RevquilaContractController.getContracts";
import getContractApex from "@salesforce/apex/RevquilaContractController.getContract";
import cancelContractApex from "@salesforce/apex/RevquilaContractController.cancel";
import saveContractApex from "@salesforce/apex/RevquilaContractController.saveContract";
import getCatalogApex from "@salesforce/apex/RevquilaCatalogController.getCatalog";
import saveProductApex from "@salesforce/apex/RevquilaCatalogController.saveProduct";
import retireProductApex from "@salesforce/apex/RevquilaCatalogController.retireProduct";
import saveBundleOptionsApex from "@salesforce/apex/RevquilaCatalogController.saveBundleOptions";
import savePriceRuleApex from "@salesforce/apex/RevquilaCatalogController.savePriceRule";
import deletePriceRuleApex from "@salesforce/apex/RevquilaCatalogController.deletePriceRule";
import createAccountApex from "@salesforce/apex/RevquilaLookupController.createAccount";
import getAccountContextApex from "@salesforce/apex/RevquilaLookupController.getAccountContext";
import searchAccountsApex from "@salesforce/apex/RevquilaLookupController.searchAccounts";
import isDemoLoadedApex from "@salesforce/apex/RevquilaDemoData.isLoaded";
import loadDemoApex from "@salesforce/apex/RevquilaDemoData.load";
import { getConfig, onConfigChange } from "c/revquilaConfig";
import {
  calculateTax,
  formatMoney,
  formatMoneyCompact,
  marketOf
} from "c/revquilaTax";

/**
 * The records behind every Revquila screen: quotes, approvals, invoices, subscriptions,
 * renewals and the dashboard. It reads and writes through the Apex controllers and keeps
 * what it read in memory, so a screen asks once and then reads synchronously.
 *
 * How a screen uses it
 *   connectedCallback: onDataChange(() => this.show()), then loadQuotes() (or another load…)
 *   show():            this.quotes = getQuotes()
 *   an action:         await actOnQuote(id, "approve")   // writes, then reloads whatever is on screen
 * Every load… and every action returns a promise that rejects with the Apex error; turn it
 * into words with errorMessage(error).
 *
 * Shared
 *   onDataChange(listener) -> unsubscribe
 *   errorMessage(error), formatDate(date), formatDay(date)
 *   loadProducts(), getProducts(), CUSTOM_PRODUCT, PAYMENT_TERMS, PAYMENT_METHODS, MILESTONES
 *   priceLines(lines, region, terms)     a preview of what the server will save
 *   searchAccounts(term), getAccountContext(accountId), createAccount(name, region)
 *
 * Quotes. A line is { productKey, qty, discount }, plus { name, unit, price } when productKey is CUSTOM_PRODUCT.
 *   loadQuotes(), getQuotes(), loadQuote(id), getQuote(id)
 *   saveQuote({ quoteId, accountId, contactId, opportunityId, state, terms, validDays, notes, opportunity, lines }) -> id
 *   actOnQuote(id, action, note)     action: submit | approve | reject | send | sign | invoice | revise
 *   cloneQuote(id) -> id, approveQuotes(ids), loadCanApprove(), canApprove(), fetchQuoteLines(id)
 *   getTimeline(quote), getRelated(quote), getQuoteDocument(quote), getApprovals()
 *   STATUS_ORDER, getStatusLabel(status)
 *
 * Invoices
 *   loadInvoices(), getInvoices(), loadInvoice(id), getInvoice(id)
 *   markInvoiceSent(id), logInvoiceReminders(ids), recordPayment(id, { amount, method, reference, date })
 *   issueCreditNote(id, { amount, reason }), logPromiseToPay(id, { date, note })
 *   getInvoiceTimeline(invoice), getInvoiceRelated(invoice), getInvoiceDocument(invoice)
 *   INVOICE_STATUS_ORDER, getInvoiceStatusLabel(status)
 *
 * Subscriptions
 *   loadSubscriptions(), getSubscriptions(), getRenewals(), loadSubscription(id), getSubscription(id)
 *   changeSubscriptionQuantity(itemId, qty), setSubscriptionAutoRenew(id, on), pauseSubscription(id),
 *   resumeSubscription(id), cancelSubscription(id, { reason, when }), renewSubscription(id) -> quote id,
 *   logRenewalNote(id, note), getSubscriptionTimeline(subscription), getMrrHistory(subscription)
 *   SUBSCRIPTION_STATUS_ORDER, getSubscriptionStatusLabel(status)
 *
 * Orders and contracts
 *   loadOrders(), getOrders(), loadOrder(id), getOrder(id), activateOrder(id), invoiceOrder(id) -> invoice id,
 *   cancelOrder(id, reason), getOrderTimeline(order), ORDER_STATUS_ORDER, getOrderStatusLabel(status)
 *   loadContracts(), getContracts(), loadContract(id), getContract(id), cancelContract(id, reason),
 *   getContractTimeline(contract), CONTRACT_STATUS_ORDER, getContractStatusLabel(status)
 *
 * Catalog (products, bundles and price rules; changing them takes Revquila Admin)
 *   loadProducts() also brings getRules() and canManageCatalog(); bundleLines(product) expands a bundle
 *   saveProduct(product) -> id, retireProduct(id), saveBundleOptions(bundleId, options),
 *   savePriceRule(rule) -> id, deletePriceRule(id)
 *
 * Money: every record carries `country`, `currency` and `money`, the market it is priced in.
 * Format its amounts with formatMoney(amount, { tax: record.money }); the labels here already do.
 *
 * Dashboard and demo data
 *   loadDashboard(), getDashboard(), isDemoLoaded(), loadDemoData()
 */

const DAY = 24 * 60 * 60 * 1000;
const RENEWAL_WINDOW = 90;
const TERM_DAYS = 365;

export const CUSTOM_PRODUCT = "CUSTOM";

export const MILESTONES = [
  "Drafted",
  "Approved",
  "Sent",
  "Signed",
  "Invoiced",
  "Paid"
];

export const PAYMENT_TERMS = [
  "Due on receipt",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60"
];

export const PAYMENT_METHODS = ["Bank transfer", "UPI", "Card", "Cheque"];

// ---------------------------------------------------------------- store

const cache = {
  products: [],
  rules: [],
  canManageCatalog: false,
  quotes: [],
  invoices: [],
  subscriptions: [],
  orders: [],
  contracts: [],
  dashboard: undefined,
  canApprove: false
};

// The records opened in a 360 view, by id. Lightning keeps the pages a user has been on
// alive, so more than one view of the same kind can be showing a record. The last few of
// each kind are kept, and read again after a write.
const KEPT_RECORDS = 4;
const records = {
  quote: new Map(),
  invoice: new Map(),
  subscription: new Map(),
  order: new Map(),
  contract: new Map()
};

// What has been loaded so far, by name, so an action can load it again
const loaded = new Map();
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener());
}

// Money and dates are formatted from the settings, so a publish redraws what is on screen
onConfigChange(notify);

/** Calls listener after anything here was loaded or changed. Returns the unsubscribe function. */
export function onDataChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Runs a loader, remembers it for refresh(), and tells the screens when it is in
function load(name, read, store) {
  const run = () =>
    read().then((result) => {
      store(result);
      return result;
    });
  loaded.set(name, run);
  return run().then((result) => {
    notify();
    return result;
  });
}

// Loads one record for a 360 view and keeps it as the newest of its kind
function loadRecord(kind, id, read, build) {
  const kept = records[kind];
  const name = `${kind}:${id}`;
  // opening it again makes it the newest
  if (kept.has(id)) {
    const record = kept.get(id);
    kept.delete(id);
    kept.set(id, record);
  }
  return load(name, read, (result) => {
    kept.set(id, build(result));
    while (kept.size > KEPT_RECORDS) {
      const [oldest] = kept.keys();
      kept.delete(oldest);
      loaded.delete(`${kind}:${oldest}`);
    }
  }).catch((error) => {
    // a record that could not be read is not read again after every write
    if (!kept.has(id)) {
      loaded.delete(name);
    }
    throw error;
  });
}

// What a write never changes, so it is not read again after one
const STEADY = ["products", "canApprove"];

// After a write: read again whatever the screens have loaded, then tell them once.
// A read that fails here (the record on screen was just deleted, say) must not make
// the write look like it failed, so it is left as it was.
function refresh() {
  const reads = [...loaded.entries()]
    .filter(([name]) => !STEADY.includes(name))
    .map(([, run]) => run().catch(() => undefined));
  return Promise.all(reads).then(notify);
}

function write(promise) {
  return promise.then((result) => refresh().then(() => result));
}

/** The words of an error from Apex, for a toast. */
export function errorMessage(error) {
  return (
    error?.body?.message ||
    error?.message ||
    "Something went wrong. Reload the page and try again."
  );
}

// ---------------------------------------------------------------- dates and small helpers

// "2026-09-30" is a day, not a moment: read it in local time so it never shifts a day
function toDay(text) {
  if (!text) {
    return undefined;
  }
  const [year, month, day] = text.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toMoment(text) {
  return text ? new Date(text) : undefined;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// A payment or a credit note has a day but no time: on a timeline it goes above that day's other entries
function endOfDay(day) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
}

function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / DAY);
}

function round(amount) {
  return Math.round(amount * 100) / 100;
}

function sum(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

/** "30 Sep 2026" */
export function formatDate(date) {
  return new Intl.DateTimeFormat(getConfig().tax.locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

/** "30 Sep" */
export function formatDay(date) {
  return new Intl.DateTimeFormat(getConfig().tax.locale, {
    day: "numeric",
    month: "short"
  }).format(date);
}

function formatAgo(date) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60000)
  );
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  if (minutes < 24 * 60) {
    return `${Math.round(minutes / 60)} hr ago`;
  }
  return minutes < 48 * 60 ? "Yesterday" : formatDay(date);
}

// The market a record is priced in, for formatMoney: its country's currency and format
function moneyOf(record) {
  return marketOf(record.country);
}

function money(amount, record) {
  return formatMoney(amount, { tax: moneyOf(record) });
}

// "12%", "12% + 5% vol" or "5% vol": the rep's discount and the price rule's
function discountLabel(line) {
  const parts = [];
  if (line.discount) {
    parts.push(`${line.discount}%`);
  }
  if (line.ruleDiscount) {
    parts.push(`${line.ruleDiscount}% vol`);
  }
  return parts.join(" + ") || "0%";
}

function pill(status) {
  return `rq-pill rq-tone-${status.tone}${status.live ? " rq-live" : ""}`;
}

function timeline(events) {
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    detail: event.detail || "",
    tone: event.tone || "acc",
    when: formatDay(event.at)
  }));
}

function buildEvents(events) {
  return (events || []).map((event) => ({
    id: event.id,
    title: event.title,
    detail: event.detail,
    tone: event.tone,
    kind: event.kind,
    at: toMoment(event.occurredOn),
    date: toDay(event.dateValue),
    number: event.numberValue
  }));
}

// ---------------------------------------------------------------- products and pricing

/**
 * Loads the catalog: the products that can go on a quote (active, with a standard price),
 * bundles with their options, the price rules, and whether the user may change them.
 */
export function loadProducts() {
  return load("products", getCatalogApex, (catalog) => {
    cache.products = catalog.products.map((product) => ({
      key: product.id,
      name: product.name,
      code: product.code || "",
      family: product.family || "",
      unit: product.unit || "",
      price: product.price,
      recurring: product.recurring,
      bundle: product.bundle,
      options: (product.options || []).map((option) => ({
        id: option.id,
        productKey: option.productId,
        name: option.name,
        qty: option.qty,
        required: option.required
      }))
    }));
    cache.rules = catalog.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      productKey: rule.productId || "",
      productName: rule.productName || "",
      minQty: rule.minQty,
      discount: rule.discount,
      active: rule.active,
      note: rule.note || ""
    }));
    cache.canManageCatalog = catalog.canManage;
  });
}

/** Every product, bundles included. A bundle's `options` are what it adds to a quote. */
export function getProducts() {
  return cache.products;
}

/** The price rules, active and inactive. */
export function getRules() {
  return cache.rules;
}

export function canManageCatalog() {
  return cache.canManageCatalog;
}

/** The discount the active price rules give a product at a quantity. */
export function ruleDiscountFor(productKey, qty) {
  return cache.rules
    .filter(
      (rule) =>
        rule.active &&
        (!rule.productKey || rule.productKey === productKey) &&
        qty >= rule.minQty
    )
    .reduce((best, rule) => Math.max(best, rule.discount), 0);
}

/** The lines a bundle adds to a quote, each tagged with the bundle. */
export function bundleLines(bundle) {
  return bundle.options.map((option) => ({
    productKey: option.productKey,
    qty: option.qty,
    discount: 0,
    bundleKey: bundle.key,
    required: option.required
  }));
}

// The catalog is steady for a write, so a change to it is read back on purpose
function catalogWrite(promise) {
  return promise.then((result) => loadProducts().then(() => result));
}

/** Creates or changes a product: { id, name, code, family, unit, price, recurring, bundle }. Resolves with its id. */
export function saveProduct(product) {
  return catalogWrite(saveProductApex({ input: JSON.stringify(product) }));
}

export function retireProduct(id) {
  return catalogWrite(retireProductApex({ productId: id }));
}

/** Replaces a bundle's options: [{ productKey, qty, required }]. */
export function saveBundleOptions(bundleId, options) {
  return catalogWrite(
    saveBundleOptionsApex({
      bundleId,
      input: JSON.stringify(
        options.map((option) => ({
          productId: option.productKey,
          qty: option.qty,
          required: option.required
        }))
      )
    })
  );
}

/** Creates or changes a price rule: { id, name, productKey, minQty, discount, active, note }. Resolves with its id. */
export function savePriceRule(rule) {
  return catalogWrite(
    savePriceRuleApex({
      input: JSON.stringify({
        id: rule.id || null,
        name: rule.name,
        productId: rule.productKey || null,
        minQty: rule.minQty,
        discount: rule.discount,
        active: rule.active,
        note: rule.note || null
      })
    })
  );
}

export function deletePriceRule(id) {
  return catalogWrite(deletePriceRuleApex({ ruleId: id }));
}

function policyIssueOf(maxDiscount, terms) {
  const { discountLimit, standardTerms } = getConfig().pricing;
  if (maxDiscount > discountLimit) {
    return `${maxDiscount}% discount, limit is ${discountLimit}%`;
  }
  return terms && terms !== standardTerms ? `${terms} payment terms` : "";
}

function previewLine(line, index, exchangeRate) {
  const custom = line.productKey === CUSTOM_PRODUCT;
  const product = custom
    ? line
    : cache.products.find((candidate) => candidate.key === line.productKey);
  const bundle =
    line.bundleKey &&
    cache.products.find((candidate) => candidate.key === line.bundleKey);
  // a product that was retired since the line was written has no price to preview;
  // a product's price is in the home currency, a custom item's in the quote's
  let price = product ? Number(product.price) || 0 : 0;
  if (!custom) {
    price = round(price * exchangeRate);
  }
  const ruleDiscount = custom ? 0 : ruleDiscountFor(line.productKey, line.qty);
  const list = round(price * line.qty);
  const off = Math.min(100, line.discount + ruleDiscount);
  const priced = {
    key: `line-${index}`,
    productKey: line.productKey,
    bundleKey: line.bundleKey || "",
    bundleName: bundle ? bundle.name : "",
    name: product ? product.name : line.name || "Unavailable product",
    unit: product ? product.unit : line.unit || "",
    price,
    recurring: Boolean(product && product.recurring),
    qty: line.qty,
    discount: line.discount,
    ruleDiscount,
    list,
    net: round(list * (1 - off / 100))
  };
  priced.discountLabel = discountLabel(priced);
  return priced;
}

/**
 * Prices lines for a customer in `region` of `country`, the way RevquilaPricing does on the
 * server: today's list prices converted at the market's exchange rate, the price rules'
 * volume discounts, then the market's tax. It is a preview for the screen while typing:
 * what gets saved is what the server works out.
 */
export function priceLines(lines, region, terms, country) {
  const market = marketOf(country);
  const { tax, company } = getConfig();
  const priced = lines.map((line, index) =>
    previewLine(line, index, market.exchangeRate)
  );
  const subtotal = round(sum(priced, (line) => line.list));
  const net = round(sum(priced, (line) => line.net));
  // a split tax has a home region only in the home country
  const homeRegion = market.country === tax.country ? company.state : undefined;
  const taxed = calculateTax(net, { region }, market, homeRegion);
  const maxDiscount = Math.max(0, ...priced.map((line) => line.discount));
  return {
    lines: priced,
    subtotal,
    discountTotal: round(subtotal - net),
    net: taxed.net,
    taxLines: taxed.lines,
    tax: taxed.tax,
    total: taxed.total,
    maxDiscount,
    policyIssue: policyIssueOf(maxDiscount, terms),
    country: market.countryName,
    currency: market.currency,
    money: market
  };
}

function buildLines(lines) {
  return (lines || []).map((line) => {
    const built = {
      key: line.id,
      productKey: line.productId || CUSTOM_PRODUCT,
      bundleKey: line.bundleId || "",
      bundleName: line.bundleName || "",
      name: line.name,
      unit: line.unit || "",
      price: line.price,
      qty: line.qty,
      discount: line.discount,
      ruleDiscount: line.ruleDiscount || 0,
      list: line.listAmount,
      net: line.net,
      recurring: line.recurring
    };
    built.discountLabel = discountLabel(built);
    return built;
  });
}

// The printable form of a quote or an invoice (see c/revquilaDocuments)
function documentFor(record, extra) {
  const location = [record.city, record.state].filter(Boolean).join(", ");
  return {
    number: record.number,
    reference: record.opportunity || "",
    paymentTerms: record.terms,
    notes: record.notes || "",
    customer: {
      name: record.account,
      contact: record.contact || "",
      addressLines: location ? [location] : [],
      registrationNumber: record.registration || "",
      region: record.state
    },
    lines: record.lines.map(
      ({ name, unit, qty, price, discount, ruleDiscount, net }) => ({
        name,
        unit,
        qty,
        price,
        // the document shows the whole discount as one figure
        discount: round((discount || 0) + (ruleDiscount || 0)),
        net
      })
    ),
    country: record.country,
    currency: record.currency,
    money: record.money,
    subtotal: record.subtotal,
    discountTotal: record.discountTotal,
    net: record.net,
    taxLines: record.taxLines,
    tax: record.tax,
    total: record.total,
    ...extra
  };
}

// ---------------------------------------------------------------- quotes

// done = how many of MILESTONES the quote has completed
const STATUS = {
  draft: { label: "Draft", tone: "mut", done: 1 },
  approval: { label: "Pending approval", tone: "warn", done: 1, live: true },
  approved: { label: "Approved", tone: "acc", done: 2 },
  rejected: { label: "Rejected", tone: "bad", done: 1 },
  sent: { label: "Sent", tone: "acc", done: 3 },
  signed: { label: "Signed", tone: "teal", done: 4 },
  invoiced: { label: "Invoiced", tone: "acc", done: 5 },
  paid: { label: "Paid", tone: "good", done: 6 },
  expired: { label: "Expired", tone: "bad", done: 1 }
};

export const STATUS_ORDER = Object.keys(STATUS);

export function getStatusLabel(status) {
  return STATUS[status].label;
}

function policyVerdict(quote) {
  const { approver } = getConfig().pricing;
  const decidedBy = quote.approvalDecidedBy || "the approver";
  if (quote.status === "rejected") {
    return {
      text: `Rejected by ${decidedBy}: ${quote.approvalNote || "no reason given"}`,
      tone: "bad"
    };
  }
  if (quote.status === "approval") {
    return {
      text: approver ? `Waiting for ${approver}` : "Waiting for approval",
      tone: "warn"
    };
  }
  if (!quote.policyIssue) {
    return { text: "Within policy. No approval needed.", tone: "good" };
  }
  if (STATUS[quote.status].done >= 2) {
    return { text: `Approved by ${decidedBy}`, tone: "good" };
  }
  return { text: "Needs approval before it can be sent", tone: "warn" };
}

// Turns a quote from Apex into everything the screens show
function buildQuote(quote) {
  const status = STATUS[quote.status];
  const created = toDay(quote.quoteDate) || toMoment(quote.createdOn);
  const market = marketOf(quote.country);
  return {
    id: quote.id,
    number: quote.name,
    country: quote.country || market.countryName,
    currency: quote.currencyCode || market.currency,
    exchangeRate: quote.exchangeRate || 1,
    money: market,
    accountId: quote.accountId,
    account: quote.account || "",
    contactId: quote.contactId,
    contact: quote.contact || "",
    city: quote.city || "",
    state: quote.region || "",
    registration: quote.registration || "",
    owner: quote.owner,
    // the title the screens show: the deal's reference
    opportunity: quote.reference || "",
    opportunityId: quote.opportunityId,
    opportunityName: quote.opportunity,
    opportunityStage: quote.opportunityStage,
    primary: Boolean(quote.primary),
    status: quote.status,
    statusLabel: status.label,
    done: status.done,
    pillClass: pill(status),
    version: quote.version,
    versionLabel: `v${quote.version}`,
    terms: quote.terms,
    standardTerms: quote.terms === getConfig().pricing.standardTerms,
    validDays: quote.validDays,
    created,
    validUntil: quote.validUntil ? formatDate(toDay(quote.validUntil)) : "",
    signedOn: quote.signedOn ? formatDate(toDay(quote.signedOn)) : "",
    signedByName: quote.signedByName || "",
    signedByEmail: quote.signedByEmail || "",
    signedByTitle: quote.signedByTitle || "",
    signatureData: quote.signatureData || "",
    signatureAudit: quote.signatureAudit || "",
    isSigned: quote.status === "signed" || Boolean(quote.signedOn),
    notes: quote.notes || "",
    lines: buildLines(quote.lines),
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal,
    net: quote.net,
    tax: quote.tax,
    total: quote.total,
    taxLines: quote.taxLines || [],
    maxDiscount: quote.maxDiscount,
    policyIssue: quote.policyIssue || "",
    needsApproval: Boolean(quote.policyIssue),
    verdict: policyVerdict(quote),
    amountLabel: formatMoneyCompact(quote.net, { tax: market }),
    // the same in the home currency, so a list of quotes in several currencies adds up
    baseNet: round(quote.net / (quote.exchangeRate || 1)),
    editable: quote.status === "draft" || quote.status === "rejected",
    updated: formatAgo(toMoment(quote.modifiedOn)),
    approval: {
      decision: quote.approvalDecision,
      requestedOn: toMoment(quote.approvalRequestedOn),
      decidedBy: quote.approvalDecidedBy || "",
      note: quote.approvalNote || ""
    },
    events: buildEvents(quote.events),
    invoice: quote.invoiceId && {
      id: quote.invoiceId,
      number: quote.invoiceNumber,
      status: quote.invoiceStatus
    },
    subscription: quote.subscriptionId && {
      id: quote.subscriptionId,
      number: quote.subscriptionName,
      status: quote.subscriptionStatus
    },
    order: quote.orderId && {
      id: quote.orderId,
      number: quote.orderNumber,
      status: quote.orderStatus
    },
    contract: quote.contractId && {
      id: quote.contractId,
      number: quote.contractNumber,
      status: quote.contractStatus
    }
  };
}

/** Loads the newest quotes, each with its lines. */
export function loadQuotes() {
  return load("quotes", getQuotesApex, (quotes) => {
    cache.quotes = quotes.map(buildQuote);
  });
}

/** Newest first */
export function getQuotes() {
  return cache.quotes;
}

/** Loads one quote with its timeline and the invoice and subscription that came from it. */
export function loadQuote(id) {
  return loadRecord(
    "quote",
    id,
    () => getQuoteApex({ quoteId: id }),
    buildQuote
  );
}

/** The quote loaded with loadQuote(id), or undefined when it is not (or no longer) kept. */
export function getQuote(id) {
  return records.quote.get(id);
}

/** The lines of any quote, to copy them onto another. Does not change what is loaded. */
export function fetchQuoteLines(id) {
  return getQuoteApex({ quoteId: id }).then((quote) => buildLines(quote.lines));
}

// A line from the editor, as RevquilaPricing.LineInput
function lineInput(line) {
  const custom = line.productKey === CUSTOM_PRODUCT;
  return {
    productId: custom ? null : line.productKey,
    name: custom ? line.name : null,
    unit: custom ? line.unit : null,
    price: custom ? line.price : null,
    qty: line.qty,
    discount: line.discount,
    bundleId: line.bundleKey || null
  };
}

/**
 * Creates a quote (no quoteId) or changes a draft, and resolves with its id.
 * The server prices it: a product line always takes today's list price.
 */
export function saveQuote({
  quoteId,
  accountId,
  contactId,
  opportunityId,
  country,
  state,
  terms,
  validDays,
  notes,
  opportunity,
  lines
}) {
  const input = {
    quoteId: quoteId || null,
    accountId: accountId || null,
    contactId: contactId || null,
    opportunityId: opportunityId || null,
    country: country || null,
    region: state || null,
    terms: terms || null,
    validDays: validDays || null,
    notes: notes || null,
    reference: opportunity || null,
    lines: lines.map(lineInput)
  };
  return write(saveQuoteApex({ input: JSON.stringify(input) }));
}

/** Moves a quote along: submit, approve, reject (note is the reason), send, sign, invoice or revise. */
export function actOnQuote(id, action, note) {
  return write(actOnQuoteApex({ quoteId: id, action, note: note || null }));
}

/** Synchronizes quote products and amounts directly to Salesforce OpportunityLineItems. */
export function syncOpportunityLines(quoteId) {
  return write(syncOpportunityLinesApex({ quoteId }));
}

/** Copies a quote as a new draft and resolves with the copy's id. */
export function cloneQuote(id) {
  return write(cloneQuoteApex({ quoteId: id }));
}

/** Approves every waiting quote in the list. Resolves with how many were approved. */
export function approveQuotes(ids) {
  return write(approveAllApex({ quoteIds: ids }));
}

/** Finds out whether the user may approve and reject quotes. */
export function loadCanApprove() {
  return load("canApprove", canApproveApex, (allowed) => {
    cache.canApprove = allowed;
  });
}

export function canApprove() {
  return cache.canApprove;
}

/** The quote's story so far, newest first. Needs a quote from loadQuote. */
export function getTimeline(quote) {
  return timeline(quote.events);
}

/** The records up and downstream of the quote, whether or not they exist yet. */
export function getRelated(quote) {
  const { invoice, subscription, order, contract } = quote;
  return [
    {
      // a stage can be any length, so it reads beside the label, not in a pill
      type: quote.opportunityStage
        ? `Opportunity · ${quote.opportunityStage}`
        : "Opportunity",
      name: quote.opportunityName || "No opportunity linked",
      state: "",
      exists: Boolean(quote.opportunityId)
    },
    {
      type: "Order",
      name: order ? order.number : "Booked when the quote is signed",
      state: order ? getOrderStatusLabel(order.status) : "",
      exists: Boolean(order),
      orderId: order ? order.id : undefined
    },
    {
      type: "Contract",
      name: contract
        ? contract.number
        : "Signed with a quote that has yearly products",
      state: contract ? getContractStatusLabel(contract.status) : "",
      exists: Boolean(contract),
      contractId: contract ? contract.id : undefined
    },
    {
      type: "Subscription",
      name: subscription
        ? subscription.number
        : "Starts when a quote with yearly products is signed",
      state: subscription
        ? getSubscriptionStatusLabel(subscription.status)
        : "",
      exists: Boolean(subscription),
      subscriptionId: subscription ? subscription.id : undefined
    },
    {
      type: "Invoice",
      name: invoice
        ? invoice.number
        : "Raised from the order once it is active",
      state: invoice ? getInvoiceStatusLabel(invoice.status) : "",
      exists: Boolean(invoice),
      invoiceId: invoice ? invoice.id : undefined
    }
  ];
}

/** The quote as a printable document (see c/revquilaDocuments). */
export function getQuoteDocument(quote) {
  return documentFor(quote, {
    kind: "quote",
    version: quote.version,
    issuedOn: formatDate(quote.created),
    dueLabel: "Valid until",
    dueOn: quote.validUntil,
    status: quote.statusLabel,
    isDraft: quote.done < 3
  });
}

/** Every loaded quote that went to an approver: waiting first, then newest first. */
export function getApprovals() {
  return cache.quotes
    .filter((quote) => quote.approval.decision)
    .map((quote) => {
      const { decision, requestedOn, decidedBy, note } = quote.approval;
      const asked = requestedOn || quote.created;
      return {
        id: quote.id,
        number: quote.number,
        account: quote.account,
        owner: quote.owner,
        net: quote.net,
        baseNet: quote.baseNet,
        reason: quote.policyIssue,
        status: decision,
        requested: formatAgo(asked),
        // whole days waited: 17 hours is not a day yet
        ageDays: Math.max(0, Math.floor((Date.now() - asked.getTime()) / DAY)),
        decidedBy,
        note,
        quote
      };
    })
    .sort(
      (a, b) =>
        (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)
    );
}

// ---------------------------------------------------------------- invoices

const INVOICE_STATUS = {
  draft: { label: "Draft", tone: "mut" },
  sent: { label: "Sent", tone: "acc" },
  partial: { label: "Part paid", tone: "teal" },
  paid: { label: "Paid", tone: "good" },
  overdue: { label: "Overdue", tone: "bad", live: true },
  written_off: { label: "Written off", tone: "mut" }
};

export const INVOICE_STATUS_ORDER = Object.keys(INVOICE_STATUS);

export function getInvoiceStatusLabel(status) {
  return INVOICE_STATUS[status].label;
}

function buildInvoice(invoice) {
  const status = INVOICE_STATUS[invoice.status];
  const events = buildEvents(invoice.events);
  const market = marketOf(invoice.country);
  const record = { country: invoice.country };
  return {
    id: invoice.id,
    number: invoice.name,
    country: invoice.country || market.countryName,
    currency: invoice.currencyCode || market.currency,
    exchangeRate: invoice.exchangeRate || 1,
    money: market,
    orderId: invoice.orderId,
    orderNumber: invoice.orderNumber,
    accountId: invoice.accountId,
    account: invoice.account || "",
    contact: invoice.contact || "",
    contactEmail: invoice.contactEmail || "",
    city: invoice.city || "",
    state: invoice.region || "",
    registration: invoice.registration || "",
    quoteId: invoice.quoteId,
    quoteNumber: invoice.quoteNumber,
    subscriptionId: invoice.subscriptionId,
    subscriptionNumber: invoice.subscriptionName,
    subscriptionStatus: invoice.subscriptionStatus,
    opportunity: invoice.reference || "",
    terms: invoice.terms,
    notes: invoice.notes || "",
    issued: toDay(invoice.issuedOn),
    due: toDay(invoice.dueOn),
    sent: Boolean(invoice.sentOn),
    lines: buildLines(invoice.lines),
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    net: invoice.net,
    tax: invoice.tax,
    total: invoice.total,
    taxLines: invoice.taxLines || [],
    paid: invoice.paid,
    credited: invoice.credited,
    balance: invoice.balance,
    // the same in the home currency, so the lists add up across countries
    baseTotal: round(invoice.total / (invoice.exchangeRate || 1)),
    baseBalance: round(invoice.balance / (invoice.exchangeRate || 1)),
    status: invoice.status,
    statusLabel: status.label,
    pillClass: pill(status),
    daysOverdue: invoice.daysOverdue,
    issuedLabel: formatDate(toDay(invoice.issuedOn)),
    dueLabel: formatDate(toDay(invoice.dueOn)),
    amountLabel: money(invoice.total, record),
    balanceLabel: money(invoice.balance, record),
    paymentLink: invoice.paymentLink || "",
    portalLink: invoice.portalLink || "",
    hasPaymentLink: Boolean(invoice.paymentLink),
    eInvoiceIrn: invoice.eInvoiceIrn || "",
    eInvoiceAck: invoice.eInvoiceAck || "",
    hasEInvoice: Boolean(invoice.eInvoiceIrn),
    hasPaymentPlan: Boolean(invoice.hasPaymentPlan),
    paymentStatus: invoice.paymentStatus || "Unpaid",
    paidShare: invoice.total
      ? Math.min(1, (invoice.paid + invoice.credited) / invoice.total)
      : 0,
    payments: (invoice.payments || []).map((payment) => ({
      id: payment.id,
      number: payment.name,
      date: toDay(payment.paidOn),
      amount: payment.amount,
      baseAmount: round(payment.amount / (invoice.exchangeRate || 1)),
      method: payment.method || "",
      reference: payment.reference || "",
      dateLabel: formatDate(toDay(payment.paidOn)),
      amountLabel: money(payment.amount, record)
    })),
    credits: (invoice.credits || []).map((credit) => ({
      id: credit.id,
      number: credit.name,
      date: toDay(credit.issuedOn),
      amount: credit.amount,
      reason: credit.reason || ""
    })),
    // oldest first: the dates each reminder was logged, and the promises to pay
    reminders: events
      .filter((event) => event.kind === "reminder")
      .map((event) => event.at)
      .reverse(),
    promises: events
      .filter((event) => event.kind === "promise")
      .map((event) => ({ at: event.at, date: event.date, note: event.detail }))
      .reverse(),
    events
  };
}

/** Loads the newest invoices, each with its payments. */
export function loadInvoices() {
  return load("invoices", getInvoicesApex, (invoices) => {
    cache.invoices = invoices.map(buildInvoice);
  });
}

/** Newest first */
export function getInvoices() {
  return cache.invoices;
}

/** Loads one invoice with its lines, payments, credit notes and timeline. */
export function loadInvoice(id) {
  return loadRecord(
    "invoice",
    id,
    () => getInvoiceApex({ invoiceId: id }),
    buildInvoice
  );
}

/** The invoice loaded with loadInvoice(id), or undefined when it is not (or no longer) kept. */
export function getInvoice(id) {
  return records.invoice.get(id);
}

/** Marks a draft invoice as sent. */
export function markInvoiceSent(id) {
  return write(markSentApex({ invoiceId: id }));
}

/** Sends invoice by email with optional attached PDF snapshot and custom address. */
export function emailInvoice(id, recipientEmail, snapshotId = null) {
  return write(
    emailInvoiceApex({
      invoiceId: id,
      snapshotId: snapshotId || null,
      toAddress: recipientEmail || null
    })
  );
}

/** Notes that a reminder went out today on each of these invoices. Resolves with how many were noted. */
export function logInvoiceReminders(ids) {
  return write(logRemindersApex({ invoiceIds: ids }));
}

/** Records a payment. `date` is "yyyy-mm-dd"; leave it out for today. */
export function recordPayment(id, { amount, method, reference, date }) {
  return write(
    recordPaymentApex({
      invoiceId: id,
      amount,
      method,
      reference: reference || null,
      paidOn: date || null
    })
  );
}

/** Generates a payment link (Stripe / Razorpay / Portal) for an invoice. */
export function createPaymentLink(id) {
  return write(createPaymentLinkApex({ invoiceId: id }));
}

/** Generates India GST e-Invoice IRN and registers compliant acknowledgement. */
export function generateEInvoice(id) {
  return write(generateEInvoiceApex({ invoiceId: id }));
}

export function issueCreditNote(id, { amount, reason }) {
  return write(issueCreditNoteApex({ invoiceId: id, amount, reason }));
}

/** Refunds money on an invoice; with a credit note to reconcile. */
export function refundInvoice({ invoiceId, paymentId, amount, reason, withCredit }) {
  return write(
    refundApex({
      invoiceId,
      paymentId: paymentId || null,
      amount,
      reason,
      withCredit: withCredit !== false
    })
  );
}

/** Writes off the remaining balance of an invoice. */
export function writeOffInvoice({ invoiceId, reason }) {
  return write(
    writeOffApex({
      invoiceId,
      reason
    })
  );
}

/** Notes the day the customer said they will pay. `date` is "yyyy-mm-dd". */
export function logPromiseToPay(id, { date, note }) {
  return write(
    logPromiseApex({ invoiceId: id, promisedOn: date, note: note || null })
  );
}

export function saveInvoice(id, { dueOn, terms, reference, notes }) {
  return write(
    saveInvoiceApex({
      invoiceId: id,
      dueOn: dueOn || null,
      terms: terms || null,
      reference: reference || null,
      notes: notes || null
    })
  );
}

/** The invoice's story so far, newest first: its events, payments and credit notes together. */
export function getInvoiceTimeline(invoice) {
  const events = invoice.events.map((event) => ({
    ...event,
    title:
      event.kind === "promise" && event.date
        ? `Promised to pay by ${formatDay(event.date)}`
        : event.title
  }));
  invoice.payments.forEach((payment) =>
    events.push({
      id: payment.id,
      title: `Payment of ${money(payment.amount, invoice)} received`,
      detail: [payment.method, payment.reference].filter(Boolean).join(" · "),
      at: endOfDay(payment.date),
      tone: "good"
    })
  );
  invoice.credits.forEach((credit) =>
    events.push({
      id: credit.id,
      title: `Credit note ${credit.number} for ${money(credit.amount, invoice)}`,
      detail: credit.reason,
      at: endOfDay(credit.date),
      tone: "teal"
    })
  );
  return timeline(events.sort((a, b) => b.at - a.at));
}

export function getInvoiceRelated(invoice) {
  return [
    {
      type: "Quote",
      name: invoice.quoteNumber || "Not raised from a quote",
      exists: Boolean(invoice.quoteId),
      quoteId: invoice.quoteId
    },
    {
      type: "Order",
      name: invoice.orderNumber || "Not raised from an order",
      exists: Boolean(invoice.orderId),
      orderId: invoice.orderId
    },
    {
      type: "Subscription",
      name: invoice.subscriptionNumber || "No subscription",
      exists: Boolean(invoice.subscriptionId),
      subscriptionId: invoice.subscriptionId
    }
  ];
}

/** The invoice as a printable document (see c/revquilaDocuments). Needs an invoice from loadInvoice. */
export function getInvoiceDocument(invoice) {
  return documentFor(invoice, {
    kind: "invoice",
    issuedOn: invoice.issuedLabel,
    dueLabel: "Due date",
    dueOn: invoice.dueLabel,
    status: invoice.statusLabel,
    isDraft: invoice.status === "draft",
    amountPaid: round(invoice.paid + invoice.credited),
    balance: invoice.balance
  });
}

// ---------------------------------------------------------------- subscriptions

const SUBSCRIPTION_STATUS = {
  active: { label: "Active", tone: "good" },
  renewing: { label: "Renewing soon", tone: "warn", live: true },
  paused: { label: "Paused", tone: "mut" },
  cancelled: { label: "Cancelled", tone: "bad" }
};

export const SUBSCRIPTION_STATUS_ORDER = Object.keys(SUBSCRIPTION_STATUS);

export function getSubscriptionStatusLabel(status) {
  return SUBSCRIPTION_STATUS[status].label;
}

function renewalRisk(subscription) {
  if (subscription.overdueOnAccount > 0) {
    return {
      risk: "high",
      riskReason: `${money(subscription.overdueOnAccount, subscription)} is overdue on this account`
    };
  }
  if (!subscription.autoRenew) {
    return {
      risk: "medium",
      riskReason: "Auto-renew is off, so it needs a signed renewal"
    };
  }
  return { risk: "low", riskReason: "Auto-renews, and nothing is overdue" };
}

function buildSubscription(subscription) {
  const renewal = toDay(subscription.renewalDate);
  const daysLeft = daysBetween(startOfToday(), renewal);
  // "renewing" is an active subscription inside the renewal window
  const statusKey =
    subscription.status === "active" && daysLeft <= RENEWAL_WINDOW
      ? "renewing"
      : subscription.status;
  const status = SUBSCRIPTION_STATUS[statusKey];
  const mrr = subscription.status === "active" ? subscription.contractMrr : 0;
  const market = marketOf(subscription.country);
  const products = subscription.items.map((item) => ({
    key: item.id,
    itemId: item.id,
    productId: item.productId,
    name: item.name,
    unit: item.unit || "",
    price: item.price,
    qty: item.qty,
    mrr: item.monthly
  }));
  return {
    id: subscription.id,
    number: subscription.name,
    country: subscription.country || market.countryName,
    currency: subscription.currencyCode || market.currency,
    exchangeRate: subscription.exchangeRate || 1,
    money: market,
    accountId: subscription.accountId,
    account: subscription.account || "",
    owner: subscription.owner,
    quoteId: subscription.quoteId,
    quoteNumber: subscription.quoteNumber,
    start: toDay(subscription.startDate),
    renewal,
    renewalDate: renewal,
    nextBillDate: toDay(subscription.nextBillDate),
    billingFrequency: subscription.billingFrequency || "Monthly",
    termMonths: subscription.termMonths || 12,
    autoRenew: subscription.autoRenew,
    mandateId: subscription.mandateId,
    mandateStatus: subscription.mandateStatus,
    mandateType: subscription.mandateType,
    mandateMaxAmount: subscription.mandateMaxAmount,
    mandateAuthDate: subscription.mandateAuthDate,
    discountCode: subscription.discountCode,
    discountPercent: subscription.discountPercent,
    trialEndDate: subscription.trialEndDate,
    // what is saved; `status` adds "renewing" on top of it
    state: subscription.status,
    cancelReason: subscription.cancelReason || "",
    products,
    productSummary: products
      .map((product) => `${product.qty} × ${product.name}`)
      .join(", "),
    mrr,
    arr: round(mrr * 12),
    contractMrr: subscription.contractMrr,
    mrrLabel: formatMoneyCompact(mrr, { tax: market }),
    arrLabel: formatMoneyCompact(mrr * 12, { tax: market }),
    // the same in the home currency, so a list of subscriptions in several currencies adds up
    baseMrr: round(mrr / (subscription.exchangeRate || 1)),
    baseArr: round((mrr * 12) / (subscription.exchangeRate || 1)),
    baseContractMrr: round(
      subscription.contractMrr / (subscription.exchangeRate || 1)
    ),
    startLabel: formatDate(toDay(subscription.startDate)),
    renewalLabel: formatDate(renewal),
    daysLeft,
    termProgress: Math.min(1, Math.max(0, 1 - daysLeft / TERM_DAYS)),
    status: statusKey,
    statusLabel: status.label,
    pillClass: pill(status),
    ...renewalRisk(subscription),
    events: buildEvents(subscription.events),
    invoices: (subscription.invoices || []).map((invoice) => ({
      id: invoice.id,
      number: invoice.name,
      amountLabel: formatMoney(invoice.total, { tax: market }),
      dueLabel: formatDate(toDay(invoice.dueOn)),
      statusLabel: getInvoiceStatusLabel(invoice.status),
      pillClass: pill(INVOICE_STATUS[invoice.status])
    })),
    items: (subscription.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      usageBased: item.usageBased,
      usageUnit: item.usageUnit || "unit",
      usagePrice: item.usagePrice,
      unit: item.unit,
      qty: item.qty
    })),
    usage: (subscription.usage || []).map((u) => ({
      id: u.id,
      itemId: u.itemId,
      item: u.item || "Usage",
      dateLabel: formatDate(toDay(u.usageDate)),
      qty: u.qty,
      note: u.note || "",
      billed: u.billed
    }))
  };
}

/** Loads every subscription, each with its items. */
export function loadSubscriptions() {
  return load("subscriptions", getSubscriptionsApex, (subscriptions) => {
    cache.subscriptions = subscriptions.map(buildSubscription);
  });
}

/** Soonest renewal first */
export function getSubscriptions() {
  return cache.subscriptions;
}

/** Subscriptions renewing within 90 days, each with the window (30, 60 or 90) it falls in. */
export function getRenewals() {
  return cache.subscriptions
    .filter((subscription) => subscription.status === "renewing")
    .map((subscription) => {
      let window = 90;
      if (subscription.daysLeft <= 30) {
        window = 30;
      } else if (subscription.daysLeft <= 60) {
        window = 60;
      }
      return { ...subscription, window };
    });
}

/** Loads one subscription with its timeline and invoices. */
export function loadSubscription(id) {
  return loadRecord(
    "subscription",
    id,
    () => getSubscriptionApex({ subscriptionId: id }),
    buildSubscription
  );
}

/** The subscription loaded with loadSubscription(id), or undefined when it is not (or no longer) kept. */
export function getSubscription(id) {
  return records.subscription.get(id);
}

export function changeSubscriptionQuantity(itemId, quantity) {
  return write(changeQuantityApex({ itemId, quantity }));
}

export function setSubscriptionAutoRenew(id, on) {
  return write(setAutoRenewApex({ subscriptionId: id, autoRenew: on }));
}

export function pauseSubscription(id) {
  return write(pauseApex({ subscriptionId: id }));
}

export function resumeSubscription(id) {
  return write(resumeApex({ subscriptionId: id }));
}

export function logSubscriptionUsage(itemId, usageDate, quantity, note) {
  return write(logUsageApex({ itemId, usageDate, quantity, note }));
}

/** when: "now" ends it today; "term-end" lets it run to the renewal date and not renew. */
export function cancelSubscription(id, { reason, when }) {
  return write(
    cancelApex({ subscriptionId: id, reason, atTermEnd: when !== "now" })
  );
}

/** Creates the renewal quote for a subscription and resolves with the quote's id. */
export function renewSubscription(id) {
  return write(renewApex({ subscriptionId: id }));
}

export function logRenewalNote(id, note) {
  return write(logNoteApex({ subscriptionId: id, note }));
}

export function saveSubscription(id, { renewalDate, nextBillDate, frequency, autoRenew, termMonths }) {
  return write(
    saveSubscriptionApex({
      subscriptionId: id,
      renewalDate: renewalDate || null,
      nextBillDate: nextBillDate || null,
      frequency: frequency || null,
      autoRenew: autoRenew != null ? autoRenew : null,
      termMonths: termMonths != null ? termMonths : null
    })
  );
}

/** The subscription's story so far, newest first. Needs a subscription from loadSubscription. */
export function getSubscriptionTimeline(subscription) {
  return timeline(subscription.events);
}

/** MRR after each change in the home currency, oldest first, ending with today's: [{ label, mrr }]. */
export function getMrrHistory(subscription) {
  const points = subscription.events
    .filter((event) => event.kind === "mrr")
    .map((event) => ({ label: formatDay(event.at), mrr: event.number }))
    .reverse();
  // a change made today is already today's figure
  const last = points[points.length - 1];
  if (
    last &&
    last.label === formatDay(new Date()) &&
    last.mrr === subscription.baseMrr
  ) {
    last.label = "Today";
    return points;
  }
  return points.concat({ label: "Today", mrr: subscription.baseMrr });
}

// ---------------------------------------------------------------- orders

const ORDER_STATUS = {
  booked: { label: "Booked", tone: "warn", live: true },
  active: { label: "Active", tone: "acc" },
  invoiced: { label: "Invoiced", tone: "good" },
  cancelled: { label: "Cancelled", tone: "bad" }
};

export const ORDER_STATUS_ORDER = Object.keys(ORDER_STATUS);

export function getOrderStatusLabel(status) {
  return ORDER_STATUS[status].label;
}

function buildOrder(order) {
  const status = ORDER_STATUS[order.status];
  const market = marketOf(order.country);
  return {
    id: order.id,
    number: order.name,
    country: order.country || market.countryName,
    currency: order.currencyCode || market.currency,
    exchangeRate: order.exchangeRate || 1,
    money: market,
    accountId: order.accountId,
    account: order.account || "",
    city: order.city || "",
    registration: order.registration || "",
    contactId: order.contactId,
    contact: order.contact || "",
    owner: order.owner,
    quoteId: order.quoteId,
    quoteNumber: order.quoteNumber,
    contractId: order.contractId,
    contractNumber: order.contractNumber,
    contractStatus: order.contractStatus,
    invoiceId: order.invoiceId,
    invoiceNumber: order.invoiceNumber,
    invoiceStatus: order.invoiceStatus,
    subscriptionId: order.subscriptionId,
    subscriptionNumber: order.subscriptionName,
    subscriptionStatus: order.subscriptionStatus,
    opportunity: order.reference || "",
    state: order.region || "",
    terms: order.terms,
    notes: order.notes || "",
    cancelReason: order.cancelReason || "",
    status: order.status,
    statusLabel: status.label,
    pillClass: pill(status),
    orderDate: toDay(order.orderDate),
    orderDateLabel: formatDate(toDay(order.orderDate)),
    activatedOn: toDay(order.activatedOn),
    activatedLabel: order.activatedOn
      ? formatDate(toDay(order.activatedOn))
      : "",
    lines: buildLines(order.lines),
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    net: order.net,
    tax: order.tax,
    total: order.total,
    taxLines: order.taxLines || [],
    amountLabel: formatMoneyCompact(order.net, { tax: market }),
    totalLabel: formatMoney(order.total, { tax: market }),
    updated: formatAgo(toMoment(order.createdOn)),
    events: buildEvents(order.events)
  };
}

/** Loads the newest orders, each with its lines. */
export function loadOrders() {
  return load("orders", getOrdersApex, (orders) => {
    cache.orders = orders.map(buildOrder);
  });
}

/** Newest first */
export function getOrders() {
  return cache.orders;
}

/** Loads one order with its timeline, invoice and subscription. */
export function loadOrder(id) {
  return loadRecord(
    "order",
    id,
    () => getOrderApex({ orderId: id }),
    buildOrder
  );
}

export function getOrder(id) {
  return records.order.get(id);
}

export function activateOrder(id) {
  return write(activateOrderApex({ orderId: id }));
}

/** Raises the order's invoice and resolves with the invoice's id. */
export function invoiceOrder(id) {
  return write(invoiceOrderApex({ orderId: id }));
}

export function cancelOrder(id, reason) {
  return write(cancelOrderApex({ orderId: id, reason }));
}

export function saveOrder(id, { orderDate, terms, reference, notes, region }) {
  return write(
    saveOrderApex({
      orderId: id,
      orderDate: orderDate || null,
      terms: terms || null,
      reference: reference || null,
      notes: notes || null,
      region: region || null
    })
  );
}

export function getOrderTimeline(order) {
  return timeline(order.events);
}

/** The order as a printable document (see c/revquilaDocuments): an order confirmation. */
export function getOrderDocument(order) {
  return documentFor(order, {
    kind: "order",
    issuedOn: order.orderDateLabel,
    dueLabel: "Order date",
    dueOn: order.orderDateLabel,
    status: order.statusLabel,
    isDraft: order.status === "booked"
  });
}

// ---------------------------------------------------------------- contracts

const CONTRACT_STATUS = {
  active: { label: "Active", tone: "good" },
  expired: { label: "Expired", tone: "mut" },
  cancelled: { label: "Cancelled", tone: "bad" }
};

export const CONTRACT_STATUS_ORDER = Object.keys(CONTRACT_STATUS);

export function getContractStatusLabel(status) {
  return CONTRACT_STATUS[status].label;
}

function buildContract(contract) {
  const status = CONTRACT_STATUS[contract.status];
  const market = marketOf(contract.country);
  const end = toDay(contract.endDate);
  const start = toDay(contract.startDate);
  const daysLeft = end ? daysBetween(startOfToday(), end) : 0;
  const termDays = start && end ? Math.max(1, daysBetween(start, end)) : 1;
  return {
    id: contract.id,
    number: contract.name,
    country: contract.country || market.countryName,
    currency: contract.currencyCode || market.currency,
    exchangeRate: contract.exchangeRate || 1,
    money: market,
    accountId: contract.accountId,
    account: contract.account || "",
    city: contract.city || "",
    contact: contract.contact || "",
    owner: contract.owner,
    quoteId: contract.quoteId,
    quoteNumber: contract.quoteNumber,
    orderId: contract.orderId,
    orderNumber: contract.orderNumber,
    orderStatus: contract.orderStatus,
    subscriptionId: contract.subscriptionId,
    subscriptionNumber: contract.subscriptionName,
    subscriptionStatus: contract.subscriptionStatus,
    reference: contract.reference || "",
    status: contract.status,
    statusLabel: status.label,
    pillClass: pill(status),
    start,
    end,
    startLabel: start ? formatDate(start) : "",
    endLabel: end ? formatDate(end) : "",
    termMonths: contract.termMonths,
    signedLabel: contract.signedOn ? formatDate(toDay(contract.signedOn)) : "",
    autoRenew: contract.autoRenew,
    annualValue: contract.annualValue,
    annualLabel: formatMoneyCompact(contract.annualValue, { tax: market }),
    annualFull: formatMoney(contract.annualValue, { tax: market }),
    baseAnnual: round(contract.annualValue / (contract.exchangeRate || 1)),
    daysLeft,
    termProgress: Math.min(1, Math.max(0, 1 - daysLeft / termDays)),
    notes: contract.notes || "",
    events: buildEvents(contract.events)
  };
}

/** Loads every contract, soonest end first. */
export function loadContracts() {
  return load("contracts", getContractsApex, (contracts) => {
    cache.contracts = contracts.map(buildContract);
  });
}

export function getContracts() {
  return cache.contracts;
}

export function loadContract(id) {
  return loadRecord(
    "contract",
    id,
    () => getContractApex({ contractId: id }),
    buildContract
  );
}

export function getContract(id) {
  return records.contract.get(id);
}

/** Cancels the contract and the subscription that bills it. */
export function cancelContract(id, reason) {
  return write(cancelContractApex({ contractId: id, reason }));
}

export function saveContract(id, { endDate, termMonths, autoRenew, upliftPercent, reference, notes }) {
  return write(
    saveContractApex({
      contractId: id,
      endDate: endDate || null,
      termMonths: termMonths != null ? termMonths : null,
      autoRenew: autoRenew != null ? autoRenew : null,
      upliftPercent: upliftPercent != null ? upliftPercent : null,
      reference: reference || null,
      notes: notes || null
    })
  );
}

export function getContractTimeline(contract) {
  return timeline(contract.events);
}

// ---------------------------------------------------------------- dashboard

/** Loads the Command Center's figures and short lists. */
export function loadDashboard() {
  return load("dashboard", getDashboardApex, (dashboard) => {
    cache.dashboard = {
      ...dashboard,
      mrrSeries: dashboard.mrrSeries.map((point) => ({
        day: toDay(point.day),
        value: point.value
      })),
      collectedSeries: dashboard.collectedSeries.map((point) => ({
        day: toDay(point.day),
        value: point.value
      })),
      recentQuotes: dashboard.recentQuotes.map(buildQuote),
      waitingQuotes: dashboard.waitingQuotes.map(buildQuote),
      renewals: dashboard.renewals.map((renewal) => ({
        ...renewal,
        renewalDate: toDay(renewal.renewalDate)
      }))
    };
    cache.canApprove = dashboard.canApprove;
  });
}

/** The dashboard last loaded, or undefined before the first load. */
export function getDashboard() {
  return cache.dashboard;
}

// ---------------------------------------------------------------- accounts and demo data

/** Accounts whose name contains the text: [{ id, name, city, region, registration }]. */
export function searchAccounts(term) {
  return searchAccountsApex({ term });
}

/** { account, contacts, opportunities, recentQuotes } for the quote form. */
export function getAccountContext(accountId) {
  return getAccountContextApex({ accountId });
}

/** Creates an account, or finds the one with exactly that name. */
export function createAccount(name, region) {
  return createAccountApex({ name, region: region || null });
}

export function isDemoLoaded() {
  return isDemoLoadedApex();
}

/** Loads the demo records (admins only) and resolves with a sentence about what was loaded. */
export function loadDemoData() {
  return write(loadDemoApex());
}