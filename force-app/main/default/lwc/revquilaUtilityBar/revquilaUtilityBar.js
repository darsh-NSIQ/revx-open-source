import { LightningElement, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getGlobalSearch from '@salesforce/apex/RevquilaLookupController.getGlobalSearch';
import getUtilityMetrics from '@salesforce/apex/RevquilaLookupController.getUtilityMetrics';

export default class RevquilaUtilityBar extends NavigationMixin(LightningElement) {
  @track searchTerm = '';
  @track results = {};
  @track metrics = {
    openInvoicesCount: 0,
    activeSubsCount: 0,
    openQuotesCount: 0,
    activeAgreementsCount: 0
  };
  searchTimeout;

  connectedCallback() {
    this.loadMetrics();
  }

  async loadMetrics() {
    try {
      const data = await getUtilityMetrics();
      if (data) {
        this.metrics = { ...this.metrics, ...data };
      }
    } catch (e) {
      console.warn('Could not load utility metrics', e);
    }
  }

  handleSearchInput(e) {
    const term = e.target.value;
    this.searchTerm = term;

    clearTimeout(this.searchTimeout);
    if (!term || term.trim().length < 2) {
      this.results = {};
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.executeSearch(term.trim());
    }, 250);
  }

  async executeSearch(term) {
    try {
      const data = await getGlobalSearch({ term });
      if (data) {
        // Map account names for display
        const quotes = (data.quotes || []).map((q) => ({
          ...q,
          AccountName: q.Account__r ? q.Account__r.Name : 'Account'
        }));
        const invoices = (data.invoices || []).map((i) => ({
          ...i,
          AccountName: i.Account__r ? i.Account__r.Name : 'Account'
        }));
        const agreements = (data.agreements || []).map((a) => ({
          ...a,
          AccountName: a.Account__r ? a.Account__r.Name : 'Account'
        }));

        this.results = {
          accounts: data.accounts || [],
          quotes,
          invoices,
          agreements
        };
      }
    } catch (err) {
      console.error('Search error', err);
    }
  }

  handleClearSearch() {
    this.searchTerm = '';
    this.results = {};
  }

  handleNavigateRecord(e) {
    const recordId = e.currentTarget.dataset.id;
    if (recordId) {
      this[NavigationMixin.Navigate]({
        type: 'standard__recordPage',
        attributes: {
          recordId,
          actionName: 'view'
        }
      });
      this.handleClearSearch();
    }
  }

  get hasQuotes() {
    return this.results.quotes && this.results.quotes.length > 0;
  }

  get hasInvoices() {
    return this.results.invoices && this.results.invoices.length > 0;
  }

  get hasAgreements() {
    return this.results.agreements && this.results.agreements.length > 0;
  }

  get hasAccounts() {
    return this.results.accounts && this.results.accounts.length > 0;
  }

  get hasResults() {
    return this.hasQuotes || this.hasInvoices || this.hasAgreements || this.hasAccounts;
  }

  get totalResultsCount() {
    return (
      (this.results.quotes?.length || 0) +
      (this.results.invoices?.length || 0) +
      (this.results.agreements?.length || 0) +
      (this.results.accounts?.length || 0)
    );
  }
}
