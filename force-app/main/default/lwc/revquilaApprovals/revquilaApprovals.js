import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { getConfig } from "c/revquilaConfig";
import { quotePage } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { paginate, revealTop } from "c/revquilaPaging";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  actOnQuote,
  approveQuotes,
  canApprove,
  errorMessage,
  getApprovals,
  loadCanApprove,
  loadQuotes,
  onDataChange
} from "c/revquilaData";
import { formatMoney, formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const FILTERS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" }
];

const OUTCOME = {
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" }
};

// The discount scale on each card runs from 0 to at least this
const SCALE_MAX = 40;
// Cards to a page: the grid is one, two or three across, and these fill whole rows of each
const PAGE_SIZES = [6, 12, 24];

function sum(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

// The discount given beyond the limit: on each line, the part of its discount above the limit
function beyondLimit(quote, limit) {
  return sum(
    quote.lines,
    (line) => (line.list * Math.max(0, line.discount - limit)) / 100
  );
}

/** The Approvals tab: every quote outside the pricing policy, and what saying yes costs. */
export default class RevquilaApprovals extends NavigationMixin(
  LightningElement
) {
  approvals = [];
  loading = true;
  loadError = "";
  // whether this user may approve and reject
  approver = false;
  filter = "pending";
  search = "";
  page = 1;
  pageSize = PAGE_SIZES[0];
  selected = [];
  rejecting;

  _unsubscribe;
  _releasePage;
  _trigger;

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this._unsubscribe = onDataChange(() => this.show());
    Promise.all([loadQuotes(), loadCanApprove()])
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
    this.approvals = getApprovals();
    this.approver = canApprove();
    // a quote decided elsewhere can no longer be ticked
    const pending = new Set(this.pending.map((approval) => approval.id));
    this.selected = this.selected.filter((id) => pending.has(id));
  }

  get pending() {
    return this.approvals.filter((approval) => approval.status === "pending");
  }

  get stats() {
    const { approver } = getConfig().pricing;
    const pending = this.pending;
    const oldest = Math.max(0, ...pending.map((approval) => approval.ageDays));
    const count = (status) =>
      this.approvals.filter((approval) => approval.status === status).length;
    let waited = "None";
    if (pending.length) {
      waited = oldest ? countOf(oldest, "day") : "Today";
    }
    return [
      {
        label: "Waiting",
        value: String(pending.length),
        note: approver ? `For ${approver}` : "For an approver",
        tone: pending.length ? "warn" : "good"
      },
      {
        label: "Value waiting",
        value: formatMoneyCompact(sum(pending, (approval) => approval.baseNet)),
        note: "Net amount of the quotes on hold"
      },
      {
        label: "Longest wait",
        value: waited,
        note: "Since the quote was created"
      },
      {
        label: "Decided",
        value: String(count("approved") + count("rejected")),
        note: `${count("approved")} approved, ${count("rejected")} rejected`
      }
    ].map((stat, index) => ({
      ...stat,
      cardClass: `rq-card rq-lift rq-stat rq-rise rq-d${index + 2}${stat.tone ? ` rq-tone-${stat.tone}` : ""}`
    }));
  }

  get chips() {
    return FILTERS.map((filter) => {
      const count =
        filter.key === "all"
          ? this.approvals.length
          : this.approvals.filter((approval) => approval.status === filter.key)
              .length;
      const selected = filter.key === this.filter;
      return {
        ...filter,
        count,
        chipClass: selected ? "rq-chip rq-on" : "rq-chip",
        pressed: selected ? "true" : "false"
      };
    });
  }

  get cards() {
    const { discountLimit } = getConfig().pricing;
    const term = this.search.trim().toLowerCase();
    return this.approvals
      .filter((approval) => {
        const inStatus =
          this.filter === "all" || approval.status === this.filter;
        const inSearch =
          !term ||
          [approval.account, approval.number, approval.owner].some((text) =>
            text.toLowerCase().includes(term)
          );
        return inStatus && inSearch;
      })
      .map((approval) => {
        const { quote } = approval;
        const pending = approval.status === "pending";
        const decidable = pending && this.approver;
        const overLimit = quote.maxDiscount > discountLimit;
        const scale = Math.max(SCALE_MAX, quote.maxDiscount);
        const beyond = beyondLimit(quote, discountLimit);
        const outcome = OUTCOME[approval.status];
        return {
          ...approval,
          pending,
          decidable,
          checked: this.selected.includes(approval.id),
          title: `${approval.account} · ${formatMoney(quote.net, { tax: quote.money })}`,
          detail: `${approval.number} · ${approval.owner} · asked ${approval.requested.toLowerCase()}`,
          decision: approval.decidedBy ? `by ${approval.decidedBy}` : "",
          overLimit,
          discountLabel: `${quote.maxDiscount}% against a ${discountLimit}% limit`,
          scaleStyle: `--rq-p:${quote.maxDiscount / scale};--rq-limit:${discountLimit / scale}`,
          // What approving gives away beyond what policy already allows
          cost: overLimit
            ? `Approving gives away ${formatMoney(beyond, { tax: quote.money })} more than the limit allows.`
            : `No extra discount. The exception is the ${quote.terms} payment terms.`,
          products: quote.lines
            .map((line) => `${line.qty} × ${line.name}`)
            .join(", "),
          outcomeLabel: outcome ? outcome.label : "",
          outcomeClass: outcome ? `rq-pill rq-tone-${outcome.tone}` : "",
          selectLabel: `Select ${approval.account}`,
          cardClass: `rq-card rq-approval rq-rise${pending ? "" : " rq-decided"}`
        };
      });
  }

  // The page of matching cards that is on screen
  get paging() {
    // the cards come in after the stats and the toolbar above them
    return paginate(this.cards, this.page, this.pageSize, 6);
  }

  get pageSizes() {
    return PAGE_SIZES;
  }

  get hasCards() {
    return this.cards.length > 0;
  }

  get showEmpty() {
    return !this.loading && !this.loadError && !this.hasCards;
  }

  get emptyText() {
    return this.filter === "pending" && !this.search
      ? "Nothing is waiting for approval."
      : "No approvals match.";
  }

  get readOnlyNote() {
    return !this.loading && !this.approver && this.pending.length > 0;
  }

  get hasSelection() {
    return this.selected.length > 0;
  }

  get bulkLabel() {
    return `Approve ${this.selected.length} selected`;
  }

  get canSelectAll() {
    return (
      this.approver && this.pending.length > 1 && this.filter !== "approved"
    );
  }

  get selectAllLabel() {
    return this.selected.length === this.pending.length
      ? "Clear selection"
      : "Select all waiting";
  }

  get rejectTitle() {
    return `${this.rejecting.account} · ${this.rejecting.number}`;
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

  handlePage(event) {
    this.page = event.detail.page;
    revealTop(this.refs.toolbar);
  }

  handlePageSize(event) {
    this.pageSize = event.detail.pageSize;
    this.page = 1;
  }

  handleSelect(event) {
    const { id } = event.target.dataset;
    this.selected = event.target.checked
      ? [...this.selected, id]
      : this.selected.filter((selectedId) => selectedId !== id);
  }

  handleSelectAll() {
    this.selected =
      this.selected.length === this.pending.length
        ? []
        : this.pending.map((approval) => approval.id);
  }

  // One tap: no confirmation step, the toast is the receipt
  handleApprove(event) {
    const { id } = event.currentTarget.dataset;
    const { account } = this.approvals.find((approval) => approval.id === id);
    actOnQuote(id, "approve")
      .then(() => this.refs.toast.show(`Approved ${account}`, "success"))
      .catch((error) => this.fail(error));
  }

  fail(error) {
    this.refs.toast.show(errorMessage(error), "error");
  }

  handleBulkApprove() {
    approveQuotes([...this.selected])
      .then((approved) => {
        this.selected = [];
        this.refs.toast.show(
          `${countOf(approved, "quote")} approved`,
          "success"
        );
      })
      .catch((error) => this.fail(error));
  }

  openReject(event) {
    const { id } = event.currentTarget.dataset;
    this._trigger = event.currentTarget;
    this.rejecting = this.approvals.find((approval) => approval.id === id);
  }

  handleReject(event) {
    const { id, account } = this.rejecting;
    actOnQuote(id, "reject", event.detail.reason)
      .then(() => this.refs.toast.show(`Rejected ${account}`))
      .catch((error) => this.fail(error));
  }

  // The rejected card leaves the Waiting list, so its button may be gone
  closeReject() {
    this.rejecting = undefined;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  openQuote(event) {
    this[NavigationMixin.Navigate](quotePage(event.currentTarget.dataset.id));
  }
}