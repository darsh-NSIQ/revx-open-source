import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getOverview from '@salesforce/apex/RevquilaAccountingSyncController.getOverview';
import getAccountMappings from '@salesforce/apex/RevquilaAccountingSyncController.getAccountMappings';
import saveAccountMappings from '@salesforce/apex/RevquilaAccountingSyncController.saveAccountMappings';
import getSyncLogs from '@salesforce/apex/RevquilaAccountingSyncController.getSyncLogs';
import triggerInvoiceSync from '@salesforce/apex/RevquilaAccountingSyncController.triggerInvoiceSync';
import triggerPaymentSync from '@salesforce/apex/RevquilaAccountingSyncController.triggerPaymentSync';
import triggerJournalSync from '@salesforce/apex/RevquilaAccountingSyncController.triggerJournalSync';
import resyncLogRecord from '@salesforce/apex/RevquilaAccountingSyncController.resyncLogRecord';
import exportAccountingData from '@salesforce/apex/RevquilaAccountingSyncController.exportAccountingData';
import getRecentInvoices from '@salesforce/apex/RevquilaAccountingSyncController.getRecentInvoices';
import getRecentPayments from '@salesforce/apex/RevquilaAccountingSyncController.getRecentPayments';

export default class RevquilaAccountingSync extends LightningElement {
  @track selectedSystem = 'Tally';
  @track activeTab = 'mappings';

  @track overview = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    successRate: 100,
    mappedAccountsCount: 0,
    lastSyncedAt: null
  };

  @track mappings = [];
  @track isSavingMappings = false;

  @track logs = [];
  @track statusFilter = 'All';
  @track searchKey = '';

  @track invoiceOptions = [];
  @track selectedInvoiceId = '';
  @track paymentOptions = [];
  @track selectedPaymentId = '';

  @track journalFromDate = '';
  @track journalToDate = '';

  @track isPayloadModalOpen = false;
  @track selectedLogRequest = '';
  @track selectedLogResponse = '';

  connectedCallback() {
    this.initDates();
    this.loadAllData();
  }

  initDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    this.journalFromDate = firstDay.toISOString().slice(0, 10);
    this.journalToDate = now.toISOString().slice(0, 10);
  }

  loadAllData() {
    this.fetchOverview();
    this.fetchMappings();
    this.fetchLogs();
    this.fetchRecentRecords();
  }

  fetchOverview() {
    getOverview({ targetSystem: this.selectedSystem })
      .then((data) => {
        if (data) {
          this.overview = data;
        }
      })
      .catch((error) => {
        console.error('Error loading overview:', error);
      });
  }

  fetchMappings() {
    getAccountMappings({ targetSystem: this.selectedSystem })
      .then((data) => {
        if (data) {
          this.mappings = JSON.parse(JSON.stringify(data));
        }
      })
      .catch((error) => {
        this.showToast('Error', 'Failed to load GL mappings: ' + (error.body ? error.body.message : error), 'error');
      });
  }

  fetchLogs() {
    getSyncLogs({ targetSystem: this.selectedSystem, statusFilter: this.statusFilter, limitCount: 50 })
      .then((data) => {
        if (data) {
          this.logs = data.map((item) => {
            const isFailed = item.status === 'Failed' || item.status === 'Pending Retry';
            return {
              ...item,
              isFailed: isFailed,
              syncedAtFormatted: item.syncedAt ? new Date(item.syncedAt).toLocaleString() : 'Pending',
              statusBadgeClass: this.computeStatusBadge(item.status),
              entityBadgeClass: this.computeEntityBadge(item.entityType)
            };
          });
        }
      })
      .catch((error) => {
        console.error('Error fetching logs:', error);
      });
  }

  fetchRecentRecords() {
    getRecentInvoices()
      .then((invs) => {
        if (invs) {
          this.invoiceOptions = invs.map((i) => ({
            label: `${i.Number__c || i.Name} - ${i.Account__r ? i.Account__r.Name : 'Account'} (Total: ${i.Total__c || 0})`,
            value: i.Id
          }));
          if (this.invoiceOptions.length > 0 && !this.selectedInvoiceId) {
            this.selectedInvoiceId = this.invoiceOptions[0].value;
          }
        }
      })
      .catch((err) => console.error(err));

    getRecentPayments()
      .then((pays) => {
        if (pays) {
          this.paymentOptions = pays.map((p) => ({
            label: `${p.Name} - ${p.Invoice__r ? p.Invoice__r.Number__c : ''} (Amt: ${p.Amount__c || 0})`,
            value: p.Id
          }));
          if (this.paymentOptions.length > 0 && !this.selectedPaymentId) {
            this.selectedPaymentId = this.paymentOptions[0].value;
          }
        }
      })
      .catch((err) => console.error(err));
  }

  // System Selector handlers
  handleSystemSelect(event) {
    const sys = event.currentTarget.dataset.system;
    if (this.selectedSystem !== sys) {
      this.selectedSystem = sys;
      this.loadAllData();
    }
  }

  handleTabSelect(event) {
    this.activeTab = event.target.value;
  }

  get tallyBtnClass() {
    return `system-switch-btn ${this.selectedSystem === 'Tally' ? 'active-system' : ''}`;
  }

  get qboBtnClass() {
    return `system-switch-btn ${this.selectedSystem === 'QuickBooks' ? 'active-system' : ''}`;
  }

  get zohoBtnClass() {
    return `system-switch-btn ${this.selectedSystem === 'Zoho Books' ? 'active-system' : ''}`;
  }

  get formattedLastSync() {
    return this.overview.lastSyncedAt ? new Date(this.overview.lastSyncedAt).toLocaleTimeString() : 'None';
  }

  // Chart of Accounts handlers
  handleMappingFieldChange(event) {
    const idx = event.target.dataset.idx;
    const field = event.target.dataset.field;
    const val = field === 'active' ? event.target.checked : event.target.value;

    const updated = [...this.mappings];
    updated[idx][field] = val;
    this.mappings = updated;
  }

  handleLoadDefaults() {
    this.fetchMappings();
    this.showToast('Defaults Seeded', `Standard default ${this.selectedSystem} GL mappings retrieved.`, 'info');
  }

  handleSaveMappings() {
    this.isSavingMappings = true;
    const records = this.mappings.map((m) => {
      const rec = {
        RevX_Account_Type__c: m.revxAccountType,
        Target_System__c: this.selectedSystem,
        External_GL_Code__c: m.glCode,
        External_Account_Name__c: m.accountName,
        Active__c: m.active
      };
      if (m.recordId) {
        rec.Id = m.recordId;
      }
      return rec;
    });

    saveAccountMappings({ targetSystem: this.selectedSystem, mappings: records })
      .then(() => {
        this.isSavingMappings = false;
        this.showToast('Success', `${this.selectedSystem} GL Mappings successfully saved.`, 'success');
        this.fetchOverview();
        this.fetchMappings();
      })
      .catch((error) => {
        this.isSavingMappings = false;
        this.showToast('Save Failed', error.body ? error.body.message : error.message, 'error');
      });
  }

  // Log filter handlers
  handleStatusFilterChange(event) {
    this.statusFilter = event.target.dataset.status;
    this.fetchLogs();
  }

  handleSearchChange(event) {
    this.searchKey = event.target.value.toLowerCase();
  }

  refreshLogs() {
    this.fetchLogs();
    this.fetchOverview();
  }

  get statusFilterAllVariant() {
    return this.statusFilter === 'All' ? 'brand' : 'neutral';
  }

  get statusFilterFailedVariant() {
    return this.statusFilter === 'Failed' ? 'brand' : 'neutral';
  }

  get statusFilterSuccessVariant() {
    return this.statusFilter === 'Success' ? 'brand' : 'neutral';
  }

  get filteredLogs() {
    if (!this.searchKey) return this.logs;
    return this.logs.filter((log) => {
      const recName = (log.recordName || '').toLowerCase();
      const extId = (log.externalId || '').toLowerCase();
      const err = (log.errorMessage || '').toLowerCase();
      return recName.includes(this.searchKey) || extId.includes(this.searchKey) || err.includes(this.searchKey);
    });
  }

  get hasLogs() {
    return this.filteredLogs && this.filteredLogs.length > 0;
  }

  // Quick Sync Actions
  handleInvoiceSelect(event) {
    this.selectedInvoiceId = event.detail.value;
  }

  handlePaymentSelect(event) {
    this.selectedPaymentId = event.detail.value;
  }

  handleJournalFromChange(event) {
    this.journalFromDate = event.target.value;
  }

  handleJournalToChange(event) {
    this.journalToDate = event.target.value;
  }

  get isInvoiceSyncDisabled() {
    return !this.selectedInvoiceId;
  }

  get isPaymentSyncDisabled() {
    return !this.selectedPaymentId;
  }

  handleTriggerInvoiceSync() {
    if (!this.selectedInvoiceId) return;
    triggerInvoiceSync({ targetSystem: this.selectedSystem, invoiceId: this.selectedInvoiceId })
      .then((res) => {
        if (res.isSuccess) {
          this.showToast('Invoice Synced', `${res.message} (Ref: ${res.externalId})`, 'success');
        } else {
          this.showToast('Sync Failed', res.message, 'error');
        }
        this.fetchLogs();
        this.fetchOverview();
      })
      .catch((err) => {
        this.showToast('Error', err.body ? err.body.message : err.message, 'error');
      });
  }

  handleTriggerPaymentSync() {
    if (!this.selectedPaymentId) return;
    triggerPaymentSync({ targetSystem: this.selectedSystem, paymentId: this.selectedPaymentId })
      .then((res) => {
        if (res.isSuccess) {
          this.showToast('Payment Synced', `${res.message} (Ref: ${res.externalId})`, 'success');
        } else {
          this.showToast('Sync Failed', res.message, 'error');
        }
        this.fetchLogs();
        this.fetchOverview();
      })
      .catch((err) => {
        this.showToast('Error', err.body ? err.body.message : err.message, 'error');
      });
  }

  handleTriggerJournalSync() {
    triggerJournalSync({
      targetSystem: this.selectedSystem,
      fromDate: this.journalFromDate,
      toDate: this.journalToDate
    })
      .then((res) => {
        if (res.isSuccess) {
          this.showToast('Journal Synced', `${res.message} (Ref: ${res.externalId})`, 'success');
        } else {
          this.showToast('Sync Failed', res.message, 'error');
        }
        this.fetchLogs();
        this.fetchOverview();
      })
      .catch((err) => {
        this.showToast('Error', err.body ? err.body.message : err.message, 'error');
      });
  }

  handleResyncClick(event) {
    const logId = event.target.dataset.id;
    resyncLogRecord({ logId: logId })
      .then((res) => {
        if (res.isSuccess) {
          this.showToast('Re-Sync Successful', res.message, 'success');
        } else {
          this.showToast('Re-Sync Failed', res.message, 'error');
        }
        this.fetchLogs();
        this.fetchOverview();
      })
      .catch((err) => {
        this.showToast('Error', err.body ? err.body.message : err.message, 'error');
      });
  }

  // Payload Viewer Modal
  handleViewPayload(event) {
    const logId = event.target.dataset.id;
    const item = this.logs.find((l) => l.id === logId);
    if (item) {
      this.selectedLogRequest = item.requestPayload || 'No request payload recorded.';
      this.selectedLogResponse = item.responsePayload || 'No response payload recorded.';
      this.isPayloadModalOpen = true;
    }
  }

  closePayloadModal() {
    this.isPayloadModalOpen = false;
  }

  // File Download Generator
  handleDownloadExport(event) {
    const format = event.target.dataset.format;
    exportAccountingData({
      targetSystem: format,
      entityType: 'Invoice',
      fromDate: this.journalFromDate,
      toDate: this.journalToDate
    })
      .then((fileContent) => {
        if (fileContent) {
          let filename = 'accounting_export.txt';
          let mime = 'text/plain';
          if (format === 'Tally') {
            filename = 'tally_vouchers.xml';
            mime = 'application/xml';
          } else if (format === 'QuickBooks') {
            filename = 'qbo_batch_import.json';
            mime = 'application/json';
          } else {
            filename = 'zoho_books_invoices.csv';
            mime = 'text/csv';
          }
          this.downloadBlob(fileContent, filename, mime);
          this.showToast('Download Ready', `Generated ${filename} for export.`, 'success');
        }
      })
      .catch((err) => {
        this.showToast('Export Error', err.body ? err.body.message : err.message, 'error');
      });
  }

  downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  computeStatusBadge(status) {
    if (status === 'Success') return 'status-badge status-success';
    if (status === 'Pending Retry') return 'status-badge status-pending';
    return 'status-badge status-failed';
  }

  computeEntityBadge(entityType) {
    if (entityType === 'Invoice') return 'entity-badge entity-invoice';
    if (entityType === 'Payment') return 'entity-badge entity-payment';
    return 'entity-badge entity-journal';
  }

  showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
