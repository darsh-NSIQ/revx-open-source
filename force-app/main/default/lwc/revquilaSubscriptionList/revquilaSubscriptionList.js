import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { RENEWALS_PAGE, subscriptionPage } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { paginate, revealTop } from "c/revquilaPaging";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  SUBSCRIPTION_STATUS_ORDER,
  errorMessage,
  getSubscriptionStatusLabel,
  getSubscriptions,
  loadSubscriptions,
  onDataChange
} from "c/revquilaData";
import { formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const ALL = "all";

function sum(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

function renewalNote(subscription) {
  if (subscription.status === "cancelled") {
    return "Cancelled";
  }
  if (subscription.daysLeft < 0) {
    return `Renewal was due ${countOf(-subscription.daysLeft, "day")} ago`;
  }
  const days = countOf(subscription.daysLeft, "day");
  return subscription.autoRenew
    ? `Auto-renews in ${days}`
    : `Ends in ${days} unless renewed`;
}

/** The Subscriptions tab: every recurring contract and what it is worth. */
export default class RevquilaSubscriptionList extends NavigationMixin(
  LightningElement
) {
  subscriptions = [];
  loading = true;
  loadError = "";
  filter = ALL;
  search = "";
  page = 1;
  pageSize = 10;

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
    this.subscriptions = getSubscriptions();
  }

  get stats() {
    const billing = this.subscriptions.filter(
      (subscription) => subscription.mrr > 0
    );
    const renewing = this.subscriptions.filter(
      (subscription) => subscription.status === "renewing"
    );
    const paused = this.subscriptions.filter(
      (subscription) => subscription.status === "paused"
    );
    // in the home currency, so subscriptions in several currencies add up
    const mrr = sum(billing, (subscription) => subscription.baseMrr);
    return [
      {
        label: "MRR",
        value: formatMoneyCompact(mrr),
        note: `${countOf(billing.length, "subscription")} billing`
      },
      {
        label: "ARR",
        value: formatMoneyCompact(mrr * 12),
        note: "MRR × 12"
      },
      {
        label: "Renewing in 90 days",
        value: formatMoneyCompact(
          sum(renewing, (subscription) => subscription.baseArr)
        ),
        note: `${countOf(renewing.length, "subscription")}, by ARR`,
        tone: "warn"
      },
      {
        label: "Paused",
        value: formatMoneyCompact(
          sum(paused, (subscription) => subscription.baseContractMrr)
        ),
        note: `MRR on hold in ${countOf(paused.length, "subscription")}`,
        tone: "mut"
      }
    ].map((stat, index) => ({
      ...stat,
      cardClass: `rq-card rq-lift rq-stat rq-rise rq-d${index + 2}${stat.tone ? ` rq-tone-${stat.tone}` : ""}`
    }));
  }

  get chips() {
    const counts = {};
    this.subscriptions.forEach((subscription) => {
      counts[subscription.status] = (counts[subscription.status] || 0) + 1;
    });
    const statuses = SUBSCRIPTION_STATUS_ORDER.filter(
      (status) => counts[status]
    ).map((status) => ({
      key: status,
      label: getSubscriptionStatusLabel(status),
      count: counts[status]
    }));
    return [
      { key: ALL, label: "All", count: this.subscriptions.length },
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
    return this.subscriptions
      .filter((subscription) => {
        const inStatus =
          this.filter === ALL || subscription.status === this.filter;
        const inSearch =
          !term ||
          [
            subscription.account,
            subscription.number,
            subscription.owner,
            subscription.productSummary
          ].some((text) => text.toLowerCase().includes(term));
        return inStatus && inSearch;
      })
      .map((subscription) => ({
        ...subscription,
        renewalNote: renewalNote(subscription),
        autoRenewLabel: subscription.autoRenew ? "On" : "Off",
        autoRenewClass: `rq-pill rq-tone-${subscription.autoRenew ? "good" : "warn"}`
      }));
  }

  // The page of matching subscriptions that is on screen
  get paging() {
    return paginate(this.visible, this.page, this.pageSize);
  }

  get hasSubscriptions() {
    return this.visible.length > 0;
  }

  // loaded, and there is not a single subscription yet
  get isEmpty() {
    return !this.loading && !this.loadError && this.subscriptions.length === 0;
  }

  get noMatch() {
    return (
      !this.loading && this.subscriptions.length > 0 && !this.hasSubscriptions
    );
  }

  get summary() {
    const visible = this.visible;
    const noun = visible.length === 1 ? "subscription" : "subscriptions";
    const mrr = sum(visible, (subscription) => subscription.baseMrr);
    return `${visible.length} ${noun} · ${formatMoneyCompact(mrr)} MRR`;
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

  clearFilters() {
    this.filter = ALL;
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

  openSubscription(event) {
    this[NavigationMixin.Navigate](
      subscriptionPage(event.currentTarget.dataset.id)
    );
  }

  openRenewals() {
    this[NavigationMixin.Navigate](RENEWALS_PAGE);
  }
}