import { LightningElement, track } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getExceptionsApex from "@salesforce/apex/RevquilaExceptionInboxController.getExceptions";
import approveExceptionApex from "@salesforce/apex/RevquilaExceptionInboxController.approveException";
import rejectExceptionApex from "@salesforce/apex/RevquilaExceptionInboxController.rejectException";
import editExceptionApex from "@salesforce/apex/RevquilaExceptionInboxController.editException";
import getAiLogsApex from "@salesforce/apex/RevquilaExceptionInboxController.getAiLogs";
import submitFeedbackApex from "@salesforce/apex/RevquilaExceptionInboxController.submitFeedback";
import getAutonomySettingsApex from "@salesforce/apex/RevquilaExceptionInboxController.getAutonomySettings";
import saveAutonomySettingsApex from "@salesforce/apex/RevquilaExceptionInboxController.saveAutonomySettings";

export default class RevquilaExceptionInbox extends LightningElement {
  @track activeTab = "inbox";
  @track loading = false;

  // Filters
  @track categoryFilter = "all";
  @track severityFilter = "all";
  @track statusFilter = "Pending";

  // Data
  @track rawExceptions = [];
  @track rawLogs = [];

  // Settings
  @track autonomyLevel = "suggest";
  @track killSwitch = false;
  @track maxDiscount = 20.0;
  @track maxRefund = 5000.0;
  @track savingSettings = false;

  // Modals
  @track rejectModalOpen = false;
  @track selectedItemId = null;
  @track rejectionReasonText = "";

  @track editModalOpen = false;
  @track editAmountInput = 0;
  @track editNotesInput = "";

  connectedCallback() {
    this.loadAllData();
  }

  async loadAllData() {
    this.loading = true;
    try {
      await Promise.all([
        this.fetchExceptions(),
        this.fetchLogs(),
        this.fetchSettings()
      ]);
    } catch (err) {
      this.toast("Error", err?.body?.message || err?.message || "Failed to load data", "error");
    } finally {
      this.loading = false;
    }
  }

  async fetchExceptions() {
    const data = await getExceptionsApex({
      category: this.categoryFilter,
      severity: this.severityFilter,
      status: this.statusFilter
    });
    this.rawExceptions = data || [];
  }

  async fetchLogs() {
    const data = await getAiLogsApex({ limitRows: 50 });
    this.rawLogs = data || [];
  }

  async fetchSettings() {
    const cfg = await getAutonomySettingsApex();
    if (cfg) {
      this.autonomyLevel = cfg.autonomyLevel || "suggest";
      this.killSwitch = cfg.killSwitch === true;
      this.maxDiscount = cfg.maxDiscountPercent != null ? cfg.maxDiscountPercent : 20.0;
      this.maxRefund = cfg.maxRefundAmount != null ? cfg.maxRefundAmount : 5000.0;
    }
  }

  handleOpenCommandBar() {
    const cmdBar = this.template.querySelector("c-revquila-command-bar");
    if (cmdBar) {
      cmdBar.open();
    }
  }

  refreshData() {
    this.loadAllData();
  }

  handleTabClick(e) {
    this.activeTab = e.currentTarget.dataset.tab;
  }

  get isInboxTab() {
    return this.activeTab === "inbox";
  }

  get isLogsTab() {
    return this.activeTab === "logs";
  }

  get isSettingsTab() {
    return this.activeTab === "settings";
  }

  get inboxTabClass() {
    return `rq-tab-btn ${this.isInboxTab ? "rq-tab-active" : ""}`;
  }

  get logsTabClass() {
    return `rq-tab-btn ${this.isLogsTab ? "rq-tab-active" : ""}`;
  }

  get settingsTabClass() {
    return `rq-tab-btn ${this.isSettingsTab ? "rq-tab-active" : ""}`;
  }

  // Filter handlers
  handleCategoryChange(e) {
    this.categoryFilter = e.target.value;
    this.fetchExceptions();
  }

  handleSeverityChange(e) {
    this.severityFilter = e.target.value;
    this.fetchExceptions();
  }

  handleStatusChange(e) {
    this.statusFilter = e.target.value;
    this.fetchExceptions();
  }

  // KPI Getters
  get pendingCount() {
    return this.rawExceptions.filter(x => x.status === "Pending").length;
  }

  get criticalCount() {
    return this.rawExceptions.filter(x => (x.severity === "Critical" || x.severity === "High") && x.status === "Pending").length;
  }

  get atRiskAmountFormatted() {
    const sum = this.rawExceptions
      .filter(x => x.status === "Pending" && x.amount != null)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return "₹" + sum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get noExceptions() {
    return !this.rawExceptions || this.rawExceptions.length === 0;
  }

  get exceptions() {
    return this.rawExceptions.map(x => ({
      ...x,
      isPending: x.status === "Pending",
      severityBadgeClass: `rq-sev-pill rq-sev-${(x.severity || "medium").toLowerCase()}`,
      amountFormatted: x.amount != null ? "₹" + x.amount.toLocaleString("en-IN") : null,
      createdFormatted: x.createdDate ? new Date(x.createdDate).toLocaleDateString() : ""
    }));
  }

  get logs() {
    return this.rawLogs.map(l => ({
      ...l,
      createdFormatted: l.createdDate ? new Date(l.createdDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
      costFormatted: (l.cost || 0).toFixed(4),
      statusLabel: l.success ? "COMPLETED" : "BLOCKED",
      statusBadgeClass: `rq-status-pill ${l.success ? "rq-pill-success" : "rq-pill-danger"}`,
      upClass: `rq-fb-btn ${l.feedback === "UP" ? "rq-fb-active" : ""}`,
      downClass: `rq-fb-btn ${l.feedback === "DOWN" ? "rq-fb-active" : ""}`
    }));
  }

  // Approve action
  async handleApprove(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const msg = await approveExceptionApex({ exceptionId: id });
      this.toast("Approved", msg, "success");
      this.fetchExceptions();
    } catch (err) {
      this.toast("Error", err?.body?.message || err?.message, "error");
    }
  }

  // Reject modal
  openRejectModal(e) {
    this.selectedItemId = e.currentTarget.dataset.id;
    this.rejectionReasonText = "";
    this.rejectModalOpen = true;
  }

  closeRejectModal() {
    this.rejectModalOpen = false;
    this.selectedItemId = null;
  }

  handleRejectionReasonChange(e) {
    this.rejectionReasonText = e.target.value;
  }

  async confirmReject() {
    if (!this.selectedItemId) return;
    try {
      const msg = await rejectExceptionApex({
        exceptionId: this.selectedItemId,
        rejectionReason: this.rejectionReasonText
      });
      this.toast("Rejected", msg, "info");
      this.closeRejectModal();
      this.fetchExceptions();
    } catch (err) {
      this.toast("Error", err?.body?.message || err?.message, "error");
    }
  }

  // Edit modal
  openEditModal(e) {
    this.selectedItemId = e.currentTarget.dataset.id;
    const item = this.rawExceptions.find(x => x.id === this.selectedItemId);
    this.editAmountInput = item?.amount || 0;
    this.editNotesInput = "";
    this.editModalOpen = true;
  }

  closeEditModal() {
    this.editModalOpen = false;
    this.selectedItemId = null;
  }

  handleEditAmountChange(e) {
    this.editAmountInput = parseFloat(e.target.value) || 0;
  }

  handleEditNotesChange(e) {
    this.editNotesInput = e.target.value;
  }

  async confirmEdit() {
    if (!this.selectedItemId) return;
    try {
      const msg = await editExceptionApex({
        exceptionId: this.selectedItemId,
        revisedAmount: this.editAmountInput,
        notes: this.editNotesInput
      });
      this.toast("Adjusted & Resolved", msg, "success");
      this.closeEditModal();
      this.fetchExceptions();
    } catch (err) {
      this.toast("Error", err?.body?.message || err?.message, "error");
    }
  }

  // Feedback actions
  async handleFeedbackUp(e) {
    const logId = e.currentTarget.dataset.id;
    await submitFeedbackApex({ logId: logId, feedback: "UP" });
    this.fetchLogs();
  }

  async handleFeedbackDown(e) {
    const logId = e.currentTarget.dataset.id;
    await submitFeedbackApex({ logId: logId, feedback: "DOWN" });
    this.fetchLogs();
  }

  // Settings getters & setters
  get isAutonomySuggest() {
    return this.autonomyLevel === "suggest";
  }

  get isAutonomyLimits() {
    return this.autonomyLevel === "limits";
  }

  get isAutonomyAutopilot() {
    return this.autonomyLevel === "autopilot";
  }

  get maxDiscountInput() {
    return this.maxDiscount;
  }

  get maxRefundInput() {
    return this.maxRefund;
  }

  get killSwitchInput() {
    return this.killSwitch;
  }

  handleAutonomyChange(e) {
    this.autonomyLevel = e.target.value;
  }

  handleMaxDiscountChange(e) {
    this.maxDiscount = parseFloat(e.target.value) || 0;
  }

  handleMaxRefundChange(e) {
    this.maxRefund = parseFloat(e.target.value) || 0;
  }

  handleKillSwitchChange(e) {
    this.killSwitch = e.target.checked;
  }

  async saveAutonomyConfig() {
    this.savingSettings = true;
    try {
      await saveAutonomySettingsApex({
        autonomyLevel: this.autonomyLevel,
        killSwitch: this.killSwitch,
        maxDiscountPercent: this.maxDiscount,
        maxRefundAmount: this.maxRefund
      });
      this.toast("Saved", "AI Autonomy policies updated successfully.", "success");
    } catch (err) {
      this.toast("Error", err?.body?.message || err?.message, "error");
    } finally {
      this.savingSettings = false;
    }
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
