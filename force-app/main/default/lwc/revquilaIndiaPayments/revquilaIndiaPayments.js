import { LightningElement, track } from "lwc";
import { fillPage } from "c/revquilaFill";
import { moveSpotlight, clearSpotlight } from "c/revquilaSpotlight";
import getOverview from "@salesforce/apex/RevquilaIndiaPaymentsController.getOverview";
import uploadBankStatement from "@salesforce/apex/RevquilaIndiaPaymentsController.uploadBankStatement";
import resolveBankLine from "@salesforce/apex/RevquilaIndiaPaymentsController.resolveBankLine";
import setupMandate from "@salesforce/apex/RevquilaIndiaPaymentsController.setupMandate";
import setupInstallments from "@salesforce/apex/RevquilaIndiaPaymentsController.setupInstallments";
import applyCoupon from "@salesforce/apex/RevquilaIndiaPaymentsController.applyCoupon";
import triggerRetry from "@salesforce/apex/RevquilaIndiaPaymentsController.triggerRetry";
import createCouponRecord from "@salesforce/apex/RevquilaIndiaPaymentsController.createCouponRecord";

export default class RevquilaIndiaPayments extends LightningElement {
  loading = true;
  activeTab = "reconciliation"; // reconciliation | mandates | installments | coupons | retries

  totalReconciled = 0;
  activeMandatesCount = 0;
  pendingInstallmentsCount = 0;
  exceptionCount = 0;

  @track statements = [];
  @track mandates = [];
  @track installments = [];
  @track coupons = [];
  @track openInvoices = [];
  @track activeSubscriptions = [];

  // Bank CSV Upload State
  selectedBank = "HDFC Bank";
  bankOptions = [
    { label: "HDFC Bank (UPI / NEFT / RTGS)", value: "HDFC Bank" },
    { label: "ICICI Bank (Corporate NetBanking)", value: "ICICI Bank" },
    { label: "State Bank of India (SBI)", value: "State Bank of India" },
    { label: "Axis Bank (Corporate Statement)", value: "Axis Bank" },
    { label: "Kotak Mahindra Bank", value: "Kotak Mahindra Bank" },
    { label: "Generic Indian Bank CSV", value: "Generic Bank" }
  ];
  uploadingCsv = false;
  uploadSuccessMessage = "";
  uploadErrorMessage = "";
  @track lastUploadSummary = null;

  // Manual Match Modal
  showResolveModal = false;
  resolvingLineId = null;
  resolvingInvoiceId = "";
  resolvingSaving = false;

  // Setup Mandate Modal
  showMandateModal = false;
  mandateSubscriptionId = "";
  mandateType = "UPI_AutoPay";
  mandateSaving = false;
  mandateResult = null;

  // Setup Installment Modal
  showInstallmentModal = false;
  installmentInvoiceId = "";
  installmentSplitType = "equal";
  installmentCount = 3;
  installmentSaving = false;

  // Coupon Modals
  showCouponModal = false;
  showApplyCouponModal = false;
  newCouponCode = "";
  newCouponName = "";
  newCouponType = "Percentage";
  newCouponValue = 15;
  newCouponTrialDays = 14;
  newCouponMaxRedemptions = 100;
  couponSaving = false;

  applySubId = "";
  applyCode = "";
  applySaving = false;
  applyResult = null;

  // Retry Simulator
  retryInvoiceIdentifier = "";
  retryReason = "Insufficient Funds in customer UPI linked account";
  retrySaving = false;
  retryResult = null;

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

  async loadData() {
    this.loading = true;
    try {
      const data = await getOverview();
      if (data) {
        this.totalReconciled = data.totalReconciled || 0;
        this.activeMandatesCount = data.activeMandatesCount || 0;
        this.pendingInstallmentsCount = data.pendingInstallmentsCount || 0;
        this.exceptionCount = data.exceptionCount || 0;

        this.statements = data.statements || [];
        this.mandates = (data.mandates || []).map(m => ({
          ...m,
          statusBadgeClass: this.getMandateBadgeClass(m.mandateStatus),
          formattedMax: Number(m.maxAmount || 0).toLocaleString()
        }));

        this.installments = (data.installments || []).map(i => ({
          ...i,
          formattedAmount: Number(i.amount || 0).toLocaleString(),
          formattedPaid: Number(i.paidAmount || 0).toLocaleString(),
          statusBadgeClass: this.getInstallmentBadgeClass(i.status)
        }));

        this.coupons = data.coupons || [];
        this.openInvoices = data.openInvoices || [];
        this.activeSubscriptions = data.activeSubscriptions || [];

        if (this.openInvoices.length > 0 && !this.installmentInvoiceId) {
          this.installmentInvoiceId = this.openInvoices[0].id;
        }
        if (this.activeSubscriptions.length > 0 && !this.mandateSubscriptionId) {
          this.mandateSubscriptionId = this.activeSubscriptions[0].id;
          this.applySubId = this.activeSubscriptions[0].id;
        }
      }
    } catch (err) {
      console.error("Error loading India Payments data", err);
    } finally {
      this.loading = false;
    }
  }

  // Tab Selection
  setTab(event) {
    this.activeTab = event.currentTarget.dataset.tab;
  }

  get isTabReconciliation() {
    return this.activeTab === "reconciliation";
  }

  get isTabMandates() {
    return this.activeTab === "mandates";
  }

  get isTabInstallments() {
    return this.activeTab === "installments";
  }

  get isTabCoupons() {
    return this.activeTab === "coupons";
  }

  get isTabRetries() {
    return this.activeTab === "retries";
  }

  get tabReconciliationClass() {
    return this.activeTab === "reconciliation" ? "rq-tab active" : "rq-tab";
  }

  get tabMandatesClass() {
    return this.activeTab === "mandates" ? "rq-tab active" : "rq-tab";
  }

  get tabInstallmentsClass() {
    return this.activeTab === "installments" ? "rq-tab active" : "rq-tab";
  }

  get tabCouponsClass() {
    return this.activeTab === "coupons" ? "rq-tab active" : "rq-tab";
  }

  get tabRetriesClass() {
    return this.activeTab === "retries" ? "rq-tab active" : "rq-tab";
  }

  get formattedTotalReconciled() {
    return Number(this.totalReconciled || 0).toLocaleString();
  }

  // Bank CSV Upload
  handleBankChange(event) {
    this.selectedBank = event.target.value;
  }

  handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.uploadingCsv = true;
    this.uploadSuccessMessage = "";
    this.uploadErrorMessage = "";
    this.lastUploadSummary = null;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const content = reader.result;
        const summary = await uploadBankStatement({
          bankName: this.selectedBank,
          csvContent: content
        });
        this.lastUploadSummary = summary;
        this.uploadSuccessMessage = `Reconciliation finished: ${summary.matchedLines} matched automatically, ${summary.mismatchedLines} routed to Exception Inbox.`;
        await this.loadData();
      } catch (err) {
        this.uploadErrorMessage = "Reconciliation error: " + (err.body ? err.body.message : err.message);
      } finally {
        this.uploadingCsv = false;
      }
    };
    reader.onerror = () => {
      this.uploadErrorMessage = "Failed to read CSV file.";
      this.uploadingCsv = false;
    };
    reader.readAsText(file);
  }

  loadSampleCsv() {
    const sampleInvoice = this.openInvoices.length > 0 ? this.openInvoices[0].label.split(" ")[0] : "INV-00101";
    const sampleBalance = this.openInvoices.length > 0 ? this.openInvoices[0].balance : 25000.00;

    const csvData =
      `Date,UTR,Narration,Amount\n` +
      `2026-10-08,UTR99881100,NEFT-INW-${sampleInvoice}-HDFCBANK,${sampleBalance}\n` +
      `2026-10-08,UTR99881101,UPI-INW-ACME TECHNOLOGIES-9876543210,18500.00\n` +
      `2026-10-08,UTR99881102,IMPS-UNKNOWN-CLIENT-TRANSFER,7500.00\n`;

    this.uploadingCsv = true;
    uploadBankStatement({
      bankName: this.selectedBank,
      csvContent: csvData
    })
      .then(summary => {
        this.lastUploadSummary = summary;
        this.uploadSuccessMessage = `Sample statement processed: ${summary.matchedLines} matched, ${summary.mismatchedLines} routed to Exception Inbox.`;
        return this.loadData();
      })
      .catch(err => {
        this.uploadErrorMessage = "Error: " + (err.body ? err.body.message : err.message);
      })
      .finally(() => {
        this.uploadingCsv = false;
      });
  }

  // Manual Resolve
  openResolve(event) {
    this.resolvingLineId = event.currentTarget.dataset.id;
    this.showResolveModal = true;
  }

  closeResolve() {
    this.showResolveModal = false;
    this.resolvingLineId = null;
  }

  handleInvoiceSelect(event) {
    this.resolvingInvoiceId = event.target.value;
  }

  async saveResolve() {
    if (!this.resolvingInvoiceId) return;
    this.resolvingSaving = true;
    try {
      await resolveBankLine({
        bankLineId: this.resolvingLineId,
        invoiceId: this.resolvingInvoiceId
      });
      this.closeResolve();
      await this.loadData();
    } catch (err) {
      console.error(err);
    } finally {
      this.resolvingSaving = false;
    }
  }

  // Mandates
  openMandateModal() {
    this.mandateResult = null;
    this.showMandateModal = true;
  }

  closeMandateModal() {
    this.showMandateModal = false;
  }

  handleMandateSubChange(event) {
    this.mandateSubscriptionId = event.target.value;
  }

  handleMandateTypeChange(event) {
    this.mandateType = event.target.value;
  }

  async saveMandate() {
    if (!this.mandateSubscriptionId) return;
    this.mandateSaving = true;
    try {
      this.mandateResult = await setupMandate({
        subscriptionId: this.mandateSubscriptionId,
        mandateType: this.mandateType
      });
      await this.loadData();
    } catch (err) {
      this.mandateResult = { success: false, message: err.body ? err.body.message : err.message };
    } finally {
      this.mandateSaving = false;
    }
  }

  // Installments
  openInstallmentModal() {
    this.showInstallmentModal = true;
  }

  closeInstallmentModal() {
    this.showInstallmentModal = false;
  }

  handleInstInvoiceChange(event) {
    this.installmentInvoiceId = event.target.value;
  }

  handleInstSplitChange(event) {
    this.installmentSplitType = event.target.value;
  }

  handleInstCountChange(event) {
    this.installmentCount = Number(event.target.value);
  }

  async saveInstallments() {
    if (!this.installmentInvoiceId) return;
    this.installmentSaving = true;
    try {
      await setupInstallments({
        invoiceId: this.installmentInvoiceId,
        count: this.installmentCount,
        splitType: this.installmentSplitType
      });
      this.closeInstallmentModal();
      await this.loadData();
    } catch (err) {
      console.error(err);
    } finally {
      this.installmentSaving = false;
    }
  }

  // Coupons
  openCouponModal() {
    this.showCouponModal = true;
  }

  closeCouponModal() {
    this.showCouponModal = false;
  }

  handleCouponField(event) {
    const f = event.target.dataset.field;
    if (f === "code") this.newCouponCode = event.target.value;
    if (f === "name") this.newCouponName = event.target.value;
    if (f === "type") this.newCouponType = event.target.value;
    if (f === "value") this.newCouponValue = Number(event.target.value);
    if (f === "trial") this.newCouponTrialDays = Number(event.target.value);
    if (f === "max") this.newCouponMaxRedemptions = Number(event.target.value);
  }

  async saveCoupon() {
    if (!this.newCouponCode) return;
    this.couponSaving = true;
    try {
      await createCouponRecord({
        code: this.newCouponCode,
        name: this.newCouponName || this.newCouponCode,
        discountType: this.newCouponType,
        discountValue: this.newCouponValue,
        trialDays: this.newCouponTrialDays,
        validUntil: null,
        maxRedemptions: this.newCouponMaxRedemptions
      });
      this.closeCouponModal();
      await this.loadData();
    } catch (err) {
      console.error(err);
    } finally {
      this.couponSaving = false;
    }
  }

  openApplyModal() {
    this.applyResult = null;
    this.showApplyCouponModal = true;
  }

  closeApplyModal() {
    this.showApplyCouponModal = false;
  }

  handleApplySubChange(event) {
    this.applySubId = event.target.value;
  }

  handleApplyCodeChange(event) {
    this.applyCode = event.target.value;
  }

  async saveApplyCoupon() {
    if (!this.applySubId || !this.applyCode) return;
    this.applySaving = true;
    try {
      this.applyResult = await applyCoupon({
        subscriptionId: this.applySubId,
        couponCode: this.applyCode
      });
      await this.loadData();
    } catch (err) {
      this.applyResult = { success: false, message: err.body ? err.body.message : err.message };
    } finally {
      this.applySaving = false;
    }
  }

  // Retry Simulator
  handleRetryInvChange(event) {
    this.retryInvoiceIdentifier = event.target.value;
  }

  handleRetryReasonChange(event) {
    this.retryReason = event.target.value;
  }

  async runRetrySimulator() {
    if (!this.retryInvoiceIdentifier) {
      if (this.openInvoices.length > 0) {
        this.retryInvoiceIdentifier = this.openInvoices[0].label.split(" ")[0];
      } else {
        return;
      }
    }
    this.retrySaving = true;
    this.retryResult = null;
    try {
      this.retryResult = await triggerRetry({
        invoiceIdentifier: this.retryInvoiceIdentifier,
        reason: this.retryReason
      });
      await this.loadData();
    } catch (err) {
      this.retryResult = { status: "Error", message: err.body ? err.body.message : err.message };
    } finally {
      this.retrySaving = false;
    }
  }

  getMandateBadgeClass(status) {
    if (status === "active" || status === "authenticated") return "rq-badge good";
    if (status === "created" || status === "pending") return "rq-badge warn";
    return "rq-badge bad";
  }

  getInstallmentBadgeClass(status) {
    if (status === "Paid") return "rq-badge good";
    if (status === "Partially_Paid") return "rq-badge warn";
    return "rq-badge mut";
  }
}
