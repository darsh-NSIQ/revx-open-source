import { LightningElement, track } from "lwc";
import { fillPage } from "c/revquilaFill";
import { moveSpotlight, clearSpotlight } from "c/revquilaSpotlight";
import getDunningOverview from "@salesforce/apex/RevquilaDunningController.getDunningOverview";
import sendDunningNotice from "@salesforce/apex/RevquilaDunningController.sendDunningNotice";
import logPromiseToPay from "@salesforce/apex/RevquilaDunningController.logPromiseToPay";
import applyLateFee from "@salesforce/apex/RevquilaDunningController.applyLateFee";
import toggleAccountDunning from "@salesforce/apex/RevquilaDunningController.toggleAccountDunning";

export default class RevquilaDunningAgent extends LightningElement {
  loading = true;
  savingPromise = false;

  totalOverdue = 0;
  overdueCount = 0;
  recoveryRate = 84.5;
  activePromises = 0;
  avgDays = 14;

  bucket1 = "0";
  bucket2 = "0";
  bucket3 = "0";
  bucket4 = "0";

  @track invoices = [];

  showPromiseModal = false;
  selectedInvoiceId = null;
  promiseDate = "";
  promiseNote = "";

  _releasePage;

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this.loadData();
  }

  disconnectedCallback() {
    if (this._releasePage) this._releasePage();
  }

  handlePointerMove(event) {
    moveSpotlight(this.template.host, event);
  }

  handlePointerLeave() {
    clearSpotlight(this.template.host);
  }

  get formattedTotalOverdue() {
    return Number(this.totalOverdue || 0).toLocaleString();
  }

  get hasInvoices() {
    return !this.loading && this.invoices.length > 0;
  }

  get noInvoices() {
    return !this.loading && this.invoices.length === 0;
  }

  async loadData() {
    this.loading = true;
    try {
      const data = await getDunningOverview();
      if (data) {
        this.totalOverdue = data.totalOverdue || 0;
        this.overdueCount = data.totalOverdueCount || 0;
        this.recoveryRate = data.recoveryRate || 84.5;
        this.activePromises = data.activePromises || 0;
        this.avgDays = data.avgDaysToRecover || 14;

        this.bucket1 = Number(data.bucket1to30 || 0).toLocaleString();
        this.bucket2 = Number(data.bucket31to60 || 0).toLocaleString();
        this.bucket3 = Number(data.bucket61to90 || 0).toLocaleString();
        this.bucket4 = Number(data.bucket90Plus || 0).toLocaleString();

        this.invoices = (data.invoices || []).map(inv => ({
          ...inv,
          stageBadgeClass: `rq-badge rq-badge-${inv.stageBadgeTone || "mut"}`
        }));
      }
    } catch (err) {
      this.showToast("Failed to load Dunning overview", err.body?.message || err.message, "bad");
    } finally {
      this.loading = false;
    }
  }

  refreshData() {
    this.loadData();
  }

  async handleSendReminder(e) {
    const invId = e.currentTarget.dataset.id;
    const channel = e.currentTarget.dataset.channel;
    try {
      const res = await sendDunningNotice({ invoiceId: invId, channel });
      this.showToast("Reminder Dispatched", res, "good");
      this.loadData();
    } catch (err) {
      this.showToast("Dispatch Failed", err.body?.message || err.message, "bad");
    }
  }

  async handleApplyLateFee(e) {
    const invId = e.currentTarget.dataset.id;
    try {
      const newBal = await applyLateFee({ invoiceId: invId, feePercent: 2.0 });
      this.showToast("Late Fee Applied", `2% interest added. New balance is $${newBal}.`, "good");
      this.loadData();
    } catch (err) {
      this.showToast("Error applying fee", err.body?.message || err.message, "bad");
    }
  }

  openPromiseModal(e) {
    this.selectedInvoiceId = e.currentTarget.dataset.id;
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    this.promiseDate = nextWeek.toISOString().split("T")[0];
    this.promiseNote = "Customer acknowledged invoice; scheduled payment batch.";
    this.showPromiseModal = true;
  }

  closePromiseModal() {
    this.showPromiseModal = false;
  }

  handlePromiseDateChange(e) {
    this.promiseDate = e.target.value;
  }

  handlePromiseNoteChange(e) {
    this.promiseNote = e.target.value;
  }

  async savePromise() {
    if (!this.promiseDate) {
      this.showToast("Date Required", "Please specify agreed promise date.", "warn");
      return;
    }
    this.savingPromise = true;
    try {
      const msg = await logPromiseToPay({
        invoiceId: this.selectedInvoiceId,
        promiseDate: this.promiseDate,
        note: this.promiseNote
      });
      this.showToast("Promise Recorded", msg, "good");
      this.showPromiseModal = false;
      this.loadData();
    } catch (err) {
      this.showToast("Failed to save promise", err.body?.message || err.message, "bad");
    } finally {
      this.savingPromise = false;
    }
  }

  showToast(title, message, tone = "good") {
    const toast = this.refs.toast;
    if (toast) toast.show({ title, message, tone });
  }
}
