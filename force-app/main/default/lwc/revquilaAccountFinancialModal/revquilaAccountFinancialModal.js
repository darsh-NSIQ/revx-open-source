import { LightningElement, api, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getAccountFinancial360 from '@salesforce/apex/RevquilaQuickActionController.getAccountFinancial360';

export default class RevquilaAccountFinancialModal extends NavigationMixin(LightningElement) {
  @api recordId; // Account record ID
  @track dossier = {};
  @track loading = true;

  connectedCallback() {
    this.loadDossier();
  }

  async loadDossier() {
    if (!this.recordId) return;
    this.loading = true;
    try {
      const data = await getAccountFinancial360({ accountId: this.recordId });
      this.dossier = data || {};
    } catch (e) {
      console.error('Error loading financial 360', e);
    } finally {
      this.loading = false;
    }
  }

  get accountName() {
    return this.dossier.accountName || 'Account';
  }

  get totalInvoicedFormatted() {
    return (this.dossier.totalInvoiced || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  }

  get totalOutstandingFormatted() {
    return (this.dossier.totalOutstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  }

  get totalMrrFormatted() {
    return (this.dossier.totalMrr || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  }

  get activeSubsCount() {
    return this.dossier.activeSubscriptionsCount || 0;
  }

  get invoices() {
    return this.dossier.invoices || [];
  }

  get subscriptions() {
    return this.dossier.subscriptions || [];
  }

  get noInvoices() {
    return !this.invoices || this.invoices.length === 0;
  }

  get noSubscriptions() {
    return !this.subscriptions || this.subscriptions.length === 0;
  }

  handleNavigateRecord(e) {
    const recordId = e.currentTarget.dataset.id;
    if (recordId) {
      this[NavigationMixin.Navigate]({
        type: 'standard__recordPage',
        attributes: {
          recordId: recordId,
          actionName: 'view'
        }
      });
    }
  }
}
