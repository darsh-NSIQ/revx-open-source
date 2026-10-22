import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { orderPage } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { paginate, revealTop } from "c/revquilaPaging";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  ORDER_STATUS_ORDER,
  errorMessage,
  getOrderStatusLabel,
  getOrders,
  loadOrders,
  onDataChange
} from "c/revquilaData";
import { formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const ALL = "all";

function sum(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

/** The Orders tab: every order booked from a signed quote, and where it stands. */
export default class RevquilaOrderList extends NavigationMixin(
  LightningElement
) {
  orders = [];
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
    loadOrders()
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
    this.orders = getOrders();
  }

  get stats() {
    const inStatus = (status) =>
      this.orders.filter((order) => order.status === status);
    const booked = inStatus("booked");
    const active = inStatus("active");
    const invoiced = inStatus("invoiced");
    // in the home currency, so orders in several currencies add up
    const base = (rows) => sum(rows, (order) => order.net / order.exchangeRate);
    return [
      {
        label: "Booked",
        value: formatMoneyCompact(base(booked)),
        note: `${countOf(booked.length, "order")} to activate`,
        tone: booked.length ? "warn" : undefined
      },
      {
        label: "Active",
        value: formatMoneyCompact(base(active)),
        note: `${countOf(active.length, "order")} to invoice`,
        tone: "acc"
      },
      {
        label: "Invoiced",
        value: formatMoneyCompact(base(invoiced)),
        note: countOf(invoiced.length, "order"),
        tone: "good"
      },
      {
        label: "This month",
        value: formatMoneyCompact(
          base(
            this.orders.filter(
              (order) =>
                order.status !== "cancelled" &&
                order.orderDate.getMonth() === new Date().getMonth() &&
                order.orderDate.getFullYear() === new Date().getFullYear()
            )
          )
        ),
        note: "Booked this month, before tax"
      }
    ].map((stat, index) => ({
      ...stat,
      cardClass: `rq-card rq-lift rq-stat rq-rise rq-d${index + 2}${stat.tone ? ` rq-tone-${stat.tone}` : ""}`
    }));
  }

  get chips() {
    const counts = {};
    this.orders.forEach((order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
    });
    const statuses = ORDER_STATUS_ORDER.filter((status) => counts[status]).map(
      (status) => ({
        key: status,
        label: getOrderStatusLabel(status),
        count: counts[status]
      })
    );
    return [
      { key: ALL, label: "All", count: this.orders.length },
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
    return this.orders.filter((order) => {
      const inStatus = this.filter === ALL || order.status === this.filter;
      const inSearch =
        !term ||
        [
          order.account,
          order.number,
          order.quoteNumber || "",
          order.opportunity
        ].some((text) => text.toLowerCase().includes(term));
      return inStatus && inSearch;
    });
  }

  get paging() {
    return paginate(this.visible, this.page, this.pageSize);
  }

  get hasOrders() {
    return this.visible.length > 0;
  }

  get isEmpty() {
    return !this.loading && !this.loadError && this.orders.length === 0;
  }

  get noMatch() {
    return !this.loading && this.orders.length > 0 && !this.hasOrders;
  }

  get summary() {
    const visible = this.visible;
    const total = sum(visible, (order) => order.net / order.exchangeRate);
    return `${countOf(visible.length, "order")} · ${formatMoneyCompact(total)}`;
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

  openOrder(event) {
    this[NavigationMixin.Navigate](orderPage(event.currentTarget.dataset.id));
  }
}