import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { getConfig } from "c/revquilaConfig";
import { invoicePage } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { paginate, revealTop } from "c/revquilaPaging";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  INVOICE_STATUS_ORDER,
  errorMessage,
  getInvoiceStatusLabel,
  getInvoices,
  loadInvoices,
  logInvoiceReminders,
  onDataChange
} from "c/revquilaData";
import { formatMoney, formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const ALL = "all";
const DAY = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 30;
const SOON_DAYS = 7;

// How late an unpaid invoice is. `upTo` is the last day overdue that falls in the bucket.
const BUCKETS = [
  { key: "current", label: "Not due yet", upTo: 0, tone: "acc" },
  { key: "30", label: "1–30 days", upTo: 30, tone: "teal" },
  { key: "60", label: "31–60 days", upTo: 60, tone: "warn" },
  { key: "90", label: "61–90 days", upTo: 90, tone: "bad" },
  { key: "older", label: "Over 90 days", upTo: Infinity, tone: "bad" }
];

function sum(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

function bucketOf(invoice) {
  return BUCKETS.find((bucket) => invoice.daysOverdue <= bucket.upTo).key;
}

function dueNote(invoice) {
  if (invoice.status === "paid" || invoice.status === "draft") {
    return "";
  }
  if (invoice.daysOverdue) {
    return `${countOf(invoice.daysOverdue, "day")} overdue`;
  }
  const days = Math.round((invoice.due.getTime() - Date.now()) / DAY);
  return days === 0 ? "Due today" : `Due in ${countOf(days, "day")}`;
}

/** The Invoices tab: Revquila's own list, with the ageing of what is unpaid. */
export default class RevquilaInvoiceList extends NavigationMixin(
  LightningElement
) {
  invoices = [];
  filter = ALL;
  bucket = "";
  search = "";
  page = 1;
  pageSize = 10;
  reminding = false;
  loading = true;
  loadError = "";

  _unsubscribe;
  _releasePage;
  _trigger;

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this._unsubscribe = onDataChange(() => this.show());
    loadInvoices()
      .catch((error) => {
        this.loadError = errorMessage(error);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  disconnectedCallback() {
    this._releasePage();
    this._unsubscribe();
  }

  show() {
    this.invoices = getInvoices();
  }

  // Sent and not yet paid in full
  get unpaid() {
    return this.invoices.filter(
      (invoice) => invoice.balance > 0 && invoice.status !== "draft"
    );
  }

  get overdue() {
    return this.invoices.filter((invoice) => invoice.status === "overdue");
  }

  get stats() {
    const since = Date.now() - RECENT_DAYS * DAY;
    const soon = Date.now() + SOON_DAYS * DAY;
    const payments = this.invoices
      .flatMap((invoice) => invoice.payments)
      .filter((payment) => payment.date.getTime() >= since);
    const dueSoon = this.unpaid.filter(
      (invoice) => !invoice.daysOverdue && invoice.due.getTime() <= soon
    );
    return [
      {
        label: "Outstanding",
        // every figure here is in the home currency, so countries add up
        value: formatMoneyCompact(
          sum(this.unpaid, (invoice) => invoice.baseBalance)
        ),
        note: `${this.unpaid.length} unpaid`
      },
      {
        label: "Overdue",
        value: formatMoneyCompact(
          sum(this.overdue, (invoice) => invoice.baseBalance)
        ),
        note: `${countOf(this.overdue.length, "invoice")} past the due date`,
        tone: "bad"
      },
      {
        label: `Due in ${SOON_DAYS} days`,
        value: formatMoneyCompact(
          sum(dueSoon, (invoice) => invoice.baseBalance)
        ),
        note: countOf(dueSoon.length, "invoice"),
        tone: "warn"
      },
      {
        label: "Collected",
        value: formatMoneyCompact(
          sum(payments, (payment) => payment.baseAmount)
        ),
        note: `${countOf(payments.length, "payment")}, last ${RECENT_DAYS} days`,
        tone: "good"
      }
    ].map((stat, index) => ({
      ...stat,
      cardClass: `rq-card rq-lift rq-stat rq-rise rq-d${index + 2} rq-tone-${stat.tone || "none"}`
    }));
  }

  // One segment per bucket that has money in it, as wide as its share
  get ageing() {
    const total = sum(this.unpaid, (invoice) => invoice.baseBalance);
    return BUCKETS.map((bucket) => {
      const invoices = this.unpaid.filter(
        (invoice) => bucketOf(invoice) === bucket.key
      );
      const amount = sum(invoices, (invoice) => invoice.baseBalance);
      const selected = this.bucket === bucket.key;
      return {
        ...bucket,
        amount,
        amountLabel: formatMoneyCompact(amount),
        countLabel: countOf(invoices.length, "invoice"),
        segmentClass: `rq-seg-bar rq-tone-${bucket.tone}${selected ? " rq-on" : ""}`,
        segmentStyle: `flex-grow:${total ? amount / total : 0}`,
        pressed: selected ? "true" : "false"
      };
    }).filter((bucket) => bucket.amount > 0);
  }

  get hasAgeing() {
    return this.ageing.length > 0;
  }

  get chips() {
    const counts = {};
    this.invoices.forEach((invoice) => {
      counts[invoice.status] = (counts[invoice.status] || 0) + 1;
    });
    const statuses = INVOICE_STATUS_ORDER.filter(
      (status) => counts[status]
    ).map((status) => ({
      key: status,
      label: getInvoiceStatusLabel(status),
      count: counts[status]
    }));
    return [
      { key: ALL, label: "All", count: this.invoices.length },
      ...statuses
    ].map((chip) => {
      const selected = chip.key === this.filter;
      return {
        ...chip,
        chipClass: selected ? "rq-chip rq-on" : "rq-chip",
        pressed: selected ? "true" : "false"
      };
    });
  }

  get visible() {
    const term = this.search.trim().toLowerCase();
    return this.invoices
      .filter((invoice) => {
        const inStatus = this.filter === ALL || invoice.status === this.filter;
        const inBucket =
          !this.bucket ||
          (invoice.balance > 0 &&
            invoice.status !== "draft" &&
            bucketOf(invoice) === this.bucket);
        const inSearch =
          !term ||
          [invoice.account, invoice.number, invoice.quoteNumber || ""].some(
            (text) => text.toLowerCase().includes(term)
          );
        return inStatus && inBucket && inSearch;
      })
      .map((invoice) => ({
        ...invoice,
        dueNote: dueNote(invoice),
        dueClass: invoice.daysOverdue ? "rq-late" : ""
      }));
  }

  // The page of matching invoices that is on screen
  get paging() {
    return paginate(this.visible, this.page, this.pageSize);
  }

  get hasInvoices() {
    return this.visible.length > 0;
  }

  // loaded, and there is not a single invoice yet
  get isEmpty() {
    return !this.loading && !this.loadError && this.invoices.length === 0;
  }

  get noMatch() {
    return !this.loading && this.invoices.length > 0 && !this.hasInvoices;
  }

  get summary() {
    const visible = this.visible;
    const noun = visible.length === 1 ? "invoice" : "invoices";
    // a draft has not been sent, so nothing is owed on it yet
    const balance = sum(
      visible.filter((invoice) => invoice.status !== "draft"),
      (invoice) => invoice.baseBalance
    );
    return `${visible.length} ${noun} · ${formatMoneyCompact(balance)} to collect`;
  }

  get amountNote() {
    const { mode, system } = getConfig().tax;
    return mode === "none" ? "" : `Amounts include ${system}`;
  }

  get canRemind() {
    return this.overdue.length > 0;
  }

  get remindLabel() {
    return `Log a reminder on all ${this.overdue.length} overdue`;
  }

  get remindBody() {
    const total = formatMoney(
      sum(this.overdue, (invoice) => invoice.baseBalance)
    );
    return `Notes today's reminder on each of the ${this.overdue.length} overdue invoices, ${total} in all, so the collection plan and the timeline stay right. RevX does not email customers yet: send the reminders yourself.`;
  }

  get overdueRows() {
    return this.overdue.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      account: invoice.account,
      late: countOf(invoice.daysOverdue, "day"),
      balance: invoice.balanceLabel
    }));
  }

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  handleSearch(event) {
    this.search = event.target.value;
    this.page = 1;
  }

  handleFilter(event) {
    this.filter = event.currentTarget.dataset.key;
    this.page = 1;
  }

  // Tapping the bucket that is already picked clears it
  handleBucket(event) {
    const { key } = event.currentTarget.dataset;
    this.bucket = this.bucket === key ? "" : key;
    this.page = 1;
  }

  clearFilters() {
    this.filter = ALL;
    this.bucket = "";
    this.search = "";
    this.page = 1;
  }

  handlePage(event) {
    this.page = event.detail.page;
    revealTop(this.refs.toolbar);
  }

  handlePageSize(event) {
    this.pageSize = event.detail.pageSize;
    this.page = 1;
  }

  openRemind(event) {
    this._trigger = event.currentTarget;
    this.reminding = true;
  }

  confirmRemind() {
    logInvoiceReminders(this.overdue.map((invoice) => invoice.id))
      .then((logged) => {
        this.refs.toast.show(
          `${countOf(logged, "reminder")} logged`,
          "success"
        );
        this.refs.remindModal.close();
      })
      .catch((error) => this.refs.toast.show(errorMessage(error), "error"));
  }

  cancelRemind() {
    this.refs.remindModal.close();
  }

  closeRemind() {
    this.reminding = false;
    this._trigger.focus();
  }

  openInvoice(event) {
    this[NavigationMixin.Navigate](invoicePage(event.currentTarget.dataset.id));
  }
}