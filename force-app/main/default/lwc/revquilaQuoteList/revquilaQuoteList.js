import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { quotePage, GUIDED_SELLING_PAGE } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { paginate, revealTop } from "c/revquilaPaging";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import { getConfig } from "c/revquilaConfig";
import {
  STATUS_ORDER,
  errorMessage,
  getQuotes,
  getStatusLabel,
  loadQuotes,
  onDataChange
} from "c/revquilaData";
import { formatMoneyCompact } from "c/revquilaTax";

const ALL = "all";

/** The Quotes tab: Revquila's own list, used instead of a standard list view. */
export default class RevquilaQuoteList extends NavigationMixin(
  LightningElement
) {
  quotes = [];
  loading = true;
  loadError = "";
  filter = ALL;
  search = "";
  page = 1;
  pageSize = 10;
  showQuickQuote = false;

  _unsubscribe;
  _releasePage;
  _trigger;

  get chips() {
    const counts = {};
    this.quotes.forEach((quote) => {
      counts[quote.status] = (counts[quote.status] || 0) + 1;
    });
    const statuses = STATUS_ORDER.filter((status) => counts[status]).map(
      (status) => ({
        key: status,
        label: getStatusLabel(status),
        count: counts[status]
      })
    );
    return [
      { key: ALL, label: "All", count: this.quotes.length },
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

  get visibleQuotes() {
    const term = this.search.trim().toLowerCase();
    return this.quotes.filter((quote) => {
      const inStatus = this.filter === ALL || quote.status === this.filter;
      const inSearch =
        !term ||
        [quote.account, quote.number, quote.owner, quote.opportunity].some(
          (text) => text.toLowerCase().includes(term)
        );
      return inStatus && inSearch;
    });
  }

  // The page of matching quotes that is on screen
  get paging() {
    return paginate(this.visibleQuotes, this.page, this.pageSize);
  }

  get hasQuotes() {
    return this.visibleQuotes.length > 0;
  }

  // loaded, and there is not a single quote yet
  get isEmpty() {
    return !this.loading && !this.loadError && this.quotes.length === 0;
  }

  // loaded, there are quotes, but none match the search and the filter
  get noMatch() {
    return !this.loading && this.quotes.length > 0 && !this.hasQuotes;
  }

  get summary() {
    const visible = this.visibleQuotes;
    // in the home currency, so quotes in several currencies add up
    const total = visible.reduce((sum, quote) => sum + quote.baseNet, 0);
    const noun = visible.length === 1 ? "quote" : "quotes";
    return `${visible.length} ${noun} · ${formatMoneyCompact(total)}`;
  }

  get amountNote() {
    const { mode, system } = getConfig().tax;
    return mode === "none" ? "" : `Amounts exclude ${system}`;
  }

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this._unsubscribe = onDataChange(() => this.show());
    loadQuotes()
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
    this.quotes = getQuotes();
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

  openGuidedSelling() {
    this[NavigationMixin.Navigate](GUIDED_SELLING_PAGE);
  }

  openQuickQuote(event) {
    this._trigger = event.currentTarget;
    this.showQuickQuote = true;
  }

  closeQuickQuote() {
    this.showQuickQuote = false;
    this._trigger.focus();
  }

  handleQuoteCreated(event) {
    this.showQuickQuote = false;
    this.navigateToQuote(event.detail.id);
  }

  openQuote(event) {
    this.navigateToQuote(event.currentTarget.dataset.id);
  }

  navigateToQuote(id) {
    this[NavigationMixin.Navigate](quotePage(id));
  }
}