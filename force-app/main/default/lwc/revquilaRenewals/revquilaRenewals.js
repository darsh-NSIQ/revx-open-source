import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { quotePage, subscriptionPage } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { paginate, revealTop } from "c/revquilaPaging";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  errorMessage,
  getRenewals,
  loadSubscriptions,
  onDataChange,
  renewSubscription
} from "c/revquilaData";
import { formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const WINDOWS = [
  { days: 30, title: "Next 30 days", tone: "bad" },
  { days: 60, title: "31 to 60 days", tone: "warn" },
  { days: 90, title: "61 to 90 days", tone: "good" }
];

const RISK = {
  high: { label: "High risk", tone: "bad" },
  medium: { label: "Needs attention", tone: "warn" },
  low: { label: "On track", tone: "good" }
};

const RISK_FILTERS = [
  { key: "all", label: "All" },
  { key: "high", label: "High risk" },
  { key: "medium", label: "Needs attention" },
  { key: "low", label: "On track" }
];

// Cards to a page in each window
const COLUMN_SIZE = 4;

function sum(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

// A renewal date that has passed reads as late, not as a negative number of days
function daysLabel(daysLeft) {
  return daysLeft < 0
    ? `${countOf(-daysLeft, "day")} late`
    : countOf(daysLeft, "day");
}

/** The Renewals tab: what comes up for renewal in the next 90 days, by window and by risk. */
export default class RevquilaRenewals extends NavigationMixin(
  LightningElement
) {
  renewals = [];
  loading = true;
  loadError = "";
  risk = "all";
  // The page each window is on, by its days: { 30: 2 }. A window not listed is on page 1.
  columnPages = {};

  _unsubscribe;
  _releasePage;

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this._unsubscribe = onDataChange(() => this.show());
    loadSubscriptions()
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
    this.renewals = getRenewals();
  }

  get stats() {
    // in the home currency, so renewals in several currencies add up
    const total = sum(this.renewals, (renewal) => renewal.baseArr);
    const atRisk = this.renewals.filter((renewal) => renewal.risk === "high");
    const auto = this.renewals.filter((renewal) => renewal.autoRenew);
    const [next] = this.renewals;
    return [
      {
        label: "Up for renewal",
        value: formatMoneyCompact(total),
        note: `${countOf(this.renewals.length, "subscription")}, by ARR`
      },
      {
        label: "At risk",
        value: formatMoneyCompact(sum(atRisk, (renewal) => renewal.baseArr)),
        note: `${atRisk.length} with an overdue invoice`,
        tone: "bad"
      },
      {
        label: "Renews by itself",
        value: formatMoneyCompact(sum(auto, (renewal) => renewal.baseArr)),
        note: `${auto.length} of ${this.renewals.length} on auto-renew`,
        tone: "good"
      },
      {
        label: "Next renewal",
        value: next ? daysLabel(next.daysLeft) : "None",
        note: next ? next.account : "Nothing in the next 90 days",
        tone: "warn"
      }
    ].map((stat, index) => ({
      ...stat,
      cardClass: `rq-card rq-lift rq-stat rq-rise rq-d${index + 2}${stat.tone ? ` rq-tone-${stat.tone}` : ""}`
    }));
  }

  get chips() {
    return RISK_FILTERS.map((filter) => {
      const count =
        filter.key === "all"
          ? this.renewals.length
          : this.renewals.filter((renewal) => renewal.risk === filter.key)
              .length;
      const selected = filter.key === this.risk;
      return {
        ...filter,
        count,
        chipClass: selected ? "rq-chip rq-on" : "rq-chip",
        pressed: selected ? "true" : "false"
      };
    });
  }

  // One column per window, soonest first inside each
  get columns() {
    return WINDOWS.map((window, index) => {
      const due = this.renewals.filter(
        (renewal) =>
          renewal.window === window.days &&
          (this.risk === "all" || renewal.risk === this.risk)
      );
      const paging = paginate(due, this.columnPages[window.days], COLUMN_SIZE);
      const cards = paging.rows.map((renewal) => ({
        id: renewal.id,
        account: renewal.account,
        detail: `${renewal.number} · ${renewal.owner}`,
        products: renewal.productSummary,
        arr: renewal.arrLabel,
        daysLabel: daysLabel(renewal.daysLeft),
        daysClass: `rq-pill rq-tone-${window.tone}`,
        date: renewal.renewalLabel,
        risk: RISK[renewal.risk].label,
        riskClass: `rq-risk rq-tone-${RISK[renewal.risk].tone}`,
        reason: renewal.riskReason,
        meterStyle: `--rq-p:${renewal.termProgress}`
      }));
      return {
        ...window,
        cards,
        page: paging.page,
        count: due.length,
        empty: due.length === 0,
        total: formatMoneyCompact(sum(due, (renewal) => renewal.baseArr)),
        countLabel: countOf(due.length, "renewal"),
        columnClass: `rq-column rq-rise rq-d${index + 6} rq-tone-${window.tone}`
      };
    });
  }

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  get columnSize() {
    return COLUMN_SIZE;
  }

  handleRisk(event) {
    this.risk = event.currentTarget.dataset.key;
    this.columnPages = {};
  }

  handleColumnPage(event) {
    const pager = event.currentTarget;
    this.columnPages = {
      ...this.columnPages,
      [pager.dataset.days]: event.detail.page
    };
    revealTop(pager.closest(".rq-column"));
  }

  // One tap: the renewal quote is a draft, so nothing is sent until the rep decides
  handleRenew(event) {
    renewSubscription(event.currentTarget.dataset.id)
      .then((quoteId) => this[NavigationMixin.Navigate](quotePage(quoteId)))
      .catch((error) => this.refs.toast.show(errorMessage(error), "error"));
  }

  openSubscription(event) {
    this[NavigationMixin.Navigate](
      subscriptionPage(event.currentTarget.dataset.id)
    );
  }
}