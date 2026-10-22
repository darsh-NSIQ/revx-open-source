import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAgreements from '@salesforce/apex/RevquilaManufacturingController.getAgreements';
import getSchedules from '@salesforce/apex/RevquilaManufacturingController.getSchedules';
import releaseOrderFromSchedule from '@salesforce/apex/RevquilaManufacturingController.releaseOrderFromSchedule';
import createSampleAgreement from '@salesforce/apex/RevquilaManufacturingController.createSampleAgreement';

export default class RevquilaManufacturingBridge extends NavigationMixin(LightningElement) {
  @track agreements = [];
  @track schedules = [];
  @track selectedAgreementId = null;
  @track loading = false;

  connectedCallback() {
    this.loadAgreements();
  }

  async loadAgreements() {
    this.loading = true;
    try {
      const data = await getAgreements({ accountId: null });
      this.agreements = (data || []).map((a) => {
        const isSelected = a.Id === this.selectedAgreementId;
        return {
          ...a,
          AccountName: a.Account__r ? a.Account__r.Name : 'Global Account',
          cardClass: `rq-agr-item ${isSelected ? 'selected' : ''}`,
          statusBadgeClass: `rq-badge rq-badge-${(a.Status__c || 'draft').toLowerCase()}`
        };
      });

      if (this.agreements.length > 0 && !this.selectedAgreementId) {
        this.selectAgreement(this.agreements[0].Id);
      }
    } catch (err) {
      this.showToast('Error', err.body?.message || err.message, 'error');
    } finally {
      this.loading = false;
    }
  }

  async selectAgreement(agrId) {
    this.selectedAgreementId = agrId;
    this.agreements = this.agreements.map((a) => ({
      ...a,
      cardClass: `rq-agr-item ${a.Id === agrId ? 'selected' : ''}`
    }));

    this.loading = true;
    try {
      const data = await getSchedules({ agreementId: agrId });
      this.schedules = (data || []).map((s) => ({
        ...s,
        FormattedDate: s.Scheduled_Date__c ? new Date(s.Scheduled_Date__c).toLocaleDateString() : '-',
        isReleased: s.Status__c === 'Released' && s.Order__c,
        statusBadgeClass: `rq-badge rq-badge-${(s.Status__c || 'pending').toLowerCase()}`
      }));
    } catch (err) {
      this.showToast('Error', err.body?.message || err.message, 'error');
    } finally {
      this.loading = false;
    }
  }

  handleSelectAgreement(e) {
    const agrId = e.currentTarget.dataset.id;
    this.selectAgreement(agrId);
  }

  async handleReleaseOrder(e) {
    const schedId = e.target.dataset.id;
    if (!schedId) return;

    this.loading = true;
    try {
      const res = await releaseOrderFromSchedule({ scheduleId: schedId });
      if (res && res.success) {
        this.showToast('Success', res.message || 'Order successfully generated!', 'success');
        await this.selectAgreement(this.selectedAgreementId);
        await this.loadAgreements();
      } else {
        this.showToast('Warning', res.message || 'Could not release order.', 'warning');
      }
    } catch (err) {
      this.showToast('Error', err.body?.message || err.message, 'error');
    } finally {
      this.loading = false;
    }
  }

  handleViewOrder(e) {
    const orderId = e.target.dataset.orderid;
    if (orderId) {
      this[NavigationMixin.Navigate]({
        type: 'standard__recordPage',
        attributes: {
          recordId: orderId,
          actionName: 'view'
        }
      });
    }
  }

  async handleCreateSample() {
    this.loading = true;
    try {
      const res = await createSampleAgreement({ accountId: null });
      if (res && res.success) {
        this.showToast('Success', 'Sample agreement with 6 delivery batches created!', 'success');
        this.selectedAgreementId = res.agreementId;
        await this.loadAgreements();
      }
    } catch (err) {
      this.showToast('Error', err.body?.message || err.message, 'error');
    } finally {
      this.loading = false;
    }
  }

  handleRefresh() {
    this.loadAgreements();
  }

  get selectedAgreement() {
    return this.agreements.find((a) => a.Id === this.selectedAgreementId);
  }

  get agreementsCount() {
    return this.agreements.length;
  }

  get noAgreements() {
    return !this.agreements || this.agreements.length === 0;
  }

  get noSchedules() {
    return !this.schedules || this.schedules.length === 0;
  }

  get totalCommittedUnits() {
    return this.agreements.reduce((sum, a) => sum + (a.Total_Committed_Quantity__c || 0), 0);
  }

  get totalActualUnits() {
    return this.agreements.reduce((sum, a) => sum + (a.Total_Actual_Quantity__c || 0), 0);
  }

  get totalCommittedAmount() {
    return this.agreements.reduce((sum, a) => sum + (a.Total_Committed_Amount__c || 0), 0);
  }

  get totalActualAmount() {
    return this.agreements.reduce((sum, a) => sum + (a.Total_Actual_Amount__c || 0), 0);
  }

  get totalCommittedUnitsFormatted() {
    return this.totalCommittedUnits.toLocaleString();
  }

  get totalActualUnitsFormatted() {
    return this.totalActualUnits.toLocaleString();
  }

  get totalCommittedAmountFormatted() {
    return '$' + this.totalCommittedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  }

  get totalActualAmountFormatted() {
    return '$' + this.totalActualAmount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  }

  get fulfillmentRate() {
    if (!this.totalCommittedUnits) return 0;
    return Math.min(100, Math.round((this.totalActualUnits / this.totalCommittedUnits) * 100));
  }

  get fulfillmentRateFormatted() {
    return this.fulfillmentRate;
  }

  get fulfillmentProgressStyle() {
    return `width: ${this.fulfillmentRate}%;`;
  }

  showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
