import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { contractPage } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { paginate, revealTop } from "c/revquilaPaging";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  CONTRACT_STATUS_ORDER,
  errorMessage,
  getContractStatusLabel,
  getContracts,
  loadContracts,
  onDataChange
} from "c/revquilaData";
import { formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const ALL = "all";
const ENDING_SOON_DAYS = 90;

function sum(items, pick) {
  return items.reduce((total, item) => total + pick(item), 0);
}

function endNote(contract) {
  if (contract.status !== "active") {
    return getContractStatusLabel(contract.status);
  }
  if (contract.daysLeft < 0) {
    return `Term ended ${countOf(-contract.daysLeft, "day")} ago`;
  }
  return contract.autoRenew
    ? `Renews in ${countOf(contract.daysLeft, "day")}`
    : `Ends in ${countOf(contract.daysLeft, "day")} unless renewed`;
}

/** The Contracts tab: every signed agreement, its value and when its term ends. */
export default class RevquilaContractList extends NavigationMixin(
  LightningElement
) {
  contracts = [];
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
    loadContracts()
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
    this.contracts = getContracts();
  }

  get stats() {
    const active = this.contracts.filter(
      (contract) => contract.status === "active"
    );
    const endingSoon = active.filter(
      (contract) => contract.daysLeft <= ENDING_SOON_DAYS
    );
    const manual = active.filter((contract) => !contract.autoRenew);
    // in the home currency, so contracts in several currencies add up
    const base = (rows) => sum(rows, (contract) => contract.baseAnnual);
    return [
      {
        label: "Contracted value",
        value: formatMoneyCompact(base(active)),
        note: `${countOf(active.length, "active contract")}, a year`
      },
      {
        label: `Ending in ${ENDING_SOON_DAYS} days`,
        value: formatMoneyCompact(base(endingSoon)),
        note: countOf(endingSoon.length, "contract"),
        tone: "warn"
      },
      {
        label: "Needs a signed renewal",
        value: formatMoneyCompact(base(manual)),
        note: `${manual.length} of ${active.length} without auto-renew`,
        tone: manual.length ? "bad" : "good"
      },
      {
        label: "Average term",
        value: active.length
          ? `${Math.round(sum(active, (contract) => contract.termMonths) / active.length)} months`
          : "None",
        note: "Across the active contracts"
      }
    ].map((stat, index) => ({
      ...stat,
      cardClass: `rq-card rq-lift rq-stat rq-rise rq-d${index + 2}${stat.tone ? ` rq-tone-${stat.tone}` : ""}`
    }));
  }

  get chips() {
    const counts = {};
    this.contracts.forEach((contract) => {
      counts[contract.status] = (counts[contract.status] || 0) + 1;
    });
    const statuses = CONTRACT_STATUS_ORDER.filter(
      (status) => counts[status]
    ).map((status) => ({
      key: status,
      label: getContractStatusLabel(status),
      count: counts[status]
    }));
    return [
      { key: ALL, label: "All", count: this.contracts.length },
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
    return this.contracts
      .filter((contract) => {
        const inStatus = this.filter === ALL || contract.status === this.filter;
        const inSearch =
          !term ||
          [
            contract.account,
            contract.number,
            contract.quoteNumber || "",
            contract.reference
          ].some((text) => text.toLowerCase().includes(term));
        return inStatus && inSearch;
      })
      .map((contract) => ({
        ...contract,
        endNote: endNote(contract),
        autoRenewLabel: contract.autoRenew ? "On" : "Off",
        autoRenewClass: `rq-pill rq-tone-${contract.autoRenew ? "good" : "warn"}`
      }));
  }

  get paging() {
    return paginate(this.visible, this.page, this.pageSize);
  }

  get hasContracts() {
    return this.visible.length > 0;
  }

  get isEmpty() {
    return !this.loading && !this.loadError && this.contracts.length === 0;
  }

  get noMatch() {
    return !this.loading && this.contracts.length > 0 && !this.hasContracts;
  }

  get summary() {
    const visible = this.visible;
    const value = sum(visible, (contract) => contract.baseAnnual);
    return `${countOf(visible.length, "contract")} · ${formatMoneyCompact(value)} a year`;
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

  openContract(event) {
    this[NavigationMixin.Navigate](
      contractPage(event.currentTarget.dataset.id)
    );
  }
}