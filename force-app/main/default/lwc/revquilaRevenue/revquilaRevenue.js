import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import getRevenue from "@salesforce/apex/RevquilaRevenueController.getRevenue";
import recognizeNow from "@salesforce/apex/RevquilaRevenueController.recognizeNow";
import recognizeSchedule from "@salesforce/apex/RevquilaRevenueController.recognizeSchedule";
import exportJournal from "@salesforce/apex/RevquilaRevenueController.exportJournal";
import backfill from "@salesforce/apex/RevquilaRevenueController.backfill";
import getPeriodLocks from "@salesforce/apex/RevquilaRevenueController.getPeriodLocks";
import lockAccountingPeriod from "@salesforce/apex/RevquilaRevenueController.lockAccountingPeriod";
import reopenAccountingPeriod from "@salesforce/apex/RevquilaRevenueController.reopenAccountingPeriod";
import getRollforwardReport from "@salesforce/apex/RevquilaRevenueController.getRollforwardReport";
import getBillingsVsRevenue from "@salesforce/apex/RevquilaRevenueController.getBillingsVsRevenue";
import getRevenueByProduct from "@salesforce/apex/RevquilaRevenueController.getRevenueByProduct";
import exportAccountingSync from "@salesforce/apex/RevquilaRevenueController.exportAccountingSync";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import { formatMoney, formatMoneyCompact, formatDate } from "c/revquilaTax";
import { paginate } from "c/revquilaPaging";
import { countOf } from "c/revquilaText";
import { invoicePage } from "c/revquilaNav";

const PAGE_SIZE = 15;

const CHIPS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "complete", label: "Complete" },
  { key: "ratable", label: "Ratable" },
  { key: "milestone", label: "Milestone" },
  { key: "point_in_time", label: "Point-in-time" }
];

export default class RevquilaRevenue extends NavigationMixin(LightningElement) {
  loading = true;
  loadError = "";
  overview;
  search = "";
  activeFilter = "all";
  page = 1;
  pageSize = PAGE_SIZE;

  // Sub-view navigation
  activeSubView = "waterfall"; // 'waterfall', 'reports', 'periodLocks'

  // Reports state
  reportFrom = "";
  reportTo = "";
  rollforward;
  billingsVsRevenue = [];
  revenueByProduct = [];
  loadingReports = false;

  // Period Lock state
  periodLocks = [];
  loadingLocks = false;
  showLockModal = false;
  lockStartDate = "";
  lockEndDate = "";
  lockNotes = "";
  locking = false;

  showReopenModal = false;
  reopenLockId = "";
  reopenLockName = "";
  reopenReason = "";
  reopening = false;

  // Accounting Sync & Export modal
  showExportModal = false;
  exportFrom = "";
  exportTo = "";
  markExported = false;
  exporting = false;
  syncFormat = "csv"; // 'csv', 'tally', 'quickbooks', 'zoho'
  syncPreview = "";
  generatingSync = false;

  // Backfill modal / confirmation
  backfilling = false;

  _releasePage;

  get isWaterfallView() {
    return this.activeSubView === "waterfall";
  }

  get isReportsView() {
    return this.activeSubView === "reports";
  }

  get isPeriodLocksView() {
    return this.activeSubView === "periodLocks";
  }

  get waterfallBtnClass() {
    return `rq-subnav-btn${this.isWaterfallView ? " rq-active" : ""}`;
  }

  get reportsBtnClass() {
    return `rq-subnav-btn${this.isReportsView ? " rq-active" : ""}`;
  }

  get periodLocksBtnClass() {
    return `rq-subnav-btn${this.isPeriodLocksView ? " rq-active" : ""}`;
  }

  get chips() {
    const list = this.overview?.schedules || [];
    return CHIPS.map((chip) => {
      let count = 0;
      if (chip.key === "all") {
        count = list.length;
      } else if (chip.key === "open" || chip.key === "complete") {
        count = list.filter((s) => s.status === chip.key).length;
      } else {
        count = list.filter((s) => s.method === chip.key).length;
      }
      return {
        ...chip,
        count,
        pressed: this.activeFilter === chip.key,
        chipClass: `rq-chip${this.activeFilter === chip.key ? " rq-on" : ""}`
      };
    });
  }

  get stats() {
    if (!this.overview) {
      return [];
    }
    return [
      {
        label: "Deferred balance",
        value: formatMoneyCompact(this.overview.deferred),
        note: "To recognise over service periods",
        cardClass: "rq-card rq-stat rq-lift rq-rise rq-d2"
      },
      {
        label: "Recognised this month",
        value: formatMoneyCompact(this.overview.recognizedThisMonth),
        note: "Earned revenue this calendar month",
        cardClass: "rq-card rq-stat rq-lift rq-rise rq-d3"
      },
      {
        label: "Recognised this year",
        value: formatMoneyCompact(this.overview.recognizedThisYear),
        note: "Year-to-date recognised",
        cardClass: "rq-card rq-stat rq-lift rq-rise rq-d4"
      },
      {
        label: "Pending milestones",
        value: formatMoneyCompact(this.overview.pendingMilestones),
        note: "Waiting on milestone signoff",
        cardClass: "rq-card rq-stat rq-lift rq-rise rq-d5"
      },
      {
        label: "Contract asset (unbilled)",
        value: formatMoneyCompact(this.overview.unbilledContractAsset || 0),
        note: "Metered usage earned prior to invoice",
        cardClass: "rq-card rq-stat rq-lift rq-rise rq-d5"
      }
    ];
  }

  get waterfallBars() {
    if (!this.overview || !this.overview.waterfall) {
      return [];
    }
    const list = this.overview.waterfall;
    const maxVal = Math.max(
      ...list.map((item) => Math.max(item.scheduled || 0, item.recognized || 0)),
      1
    );

    return list.map((item) => {
      const monthDate = new Date(item.month);
      const label = new Intl.DateTimeFormat("en", {
        month: "short",
        year: "2-digit"
      }).format(monthDate);
      const schedHeight = Math.max(4, Math.round(((item.scheduled || 0) / maxVal) * 110));
      const recHeight = Math.max(4, Math.round(((item.recognized || 0) / maxVal) * 110));

      return {
        key: String(item.month),
        label,
        scheduledLabel: formatMoneyCompact(item.scheduled),
        recognizedLabel: formatMoneyCompact(item.recognized),
        scheduledStyle: `height: ${schedHeight}px;`,
        recognizedStyle: `height: ${recHeight}px;`
      };
    });
  }

  get filteredSchedules() {
    if (!this.overview?.schedules) {
      return [];
    }
    let list = this.overview.schedules;
    const filter = this.activeFilter;
    if (filter === "open" || filter === "complete") {
      list = list.filter((s) => s.status === filter);
    } else if (filter !== "all") {
      list = list.filter((s) => s.method === filter);
    }

    if (this.search) {
      const q = this.search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.account && s.account.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.pobType && s.pobType.toLowerCase().includes(q)) ||
          (s.invoiceNumber && s.invoiceNumber.toLowerCase().includes(q))
      );
    }
    return list;
  }

  get pagedResult() {
    return paginate(this.filteredSchedules, this.page, this.pageSize);
  }

  get schedules() {
    const list = this.pagedResult?.rows || [];
    return list.map((s) => {
      let methodLabel = "Ratable";
      if (s.method === "milestone") {
        methodLabel = "Milestone";
      } else if (s.method === "point_in_time") {
        methodLabel = "Point-in-time";
      }

      let pobLabel = "License";
      if (s.pobType === "implementation") pobLabel = "Implementation";
      else if (s.pobType === "support") pobLabel = "Support & Maint.";
      else if (s.pobType === "usage") pobLabel = "Usage Consumption";
      else if (s.pobType === "other") pobLabel = "Other POB";

      let pillTone = s.status === "complete" ? "rq-tone-good" : "rq-tone-accent";
      let statusLabel = s.status === "complete" ? "Complete" : "Open";
      const isMilestoneOpen = s.method === "milestone" && s.status === "open";

      return {
        ...s,
        methodLabel,
        pobLabel,
        statusLabel,
        pillClass: `rq-pill ${pillTone}`,
        totalFormatted: formatMoney(s.total),
        sspFormatted: s.sspPrice ? formatMoney(s.sspPrice) : "—",
        allocatedFormatted: s.allocatedAmount ? formatMoney(s.allocatedAmount) : formatMoney(s.total),
        recognizedFormatted: formatMoney(s.recognized),
        deferredFormatted: formatMoney(s.deferred),
        contractAssetFormatted: s.contractAssetBalance ? formatMoney(s.contractAssetBalance) : "$0.00",
        periodLabel: s.startDate ? `${formatDate(s.startDate)} – ${formatDate(s.endDate)}` : "—",
        canRecognizeMilestone: isMilestoneOpen && this.overview?.canRecognize
      };
    });
  }

  get totalCount() {
    return this.filteredSchedules.length;
  }

  get totalPages() {
    return this.pagedResult?.pages || 1;
  }

  get summary() {
    return countOf(this.totalCount, "revenue schedule");
  }

  get hasSchedules() {
    return (this.schedules || []).length > 0;
  }

  get canRecognize() {
    return this.overview?.canRecognize;
  }

  get exportButtonLabel() {
    if (this.exporting) return "Exporting…";
    if (this.syncFormat === "tally") return "Download Tally XML";
    if (this.syncFormat === "quickbooks") return "Download QuickBooks JSON";
    if (this.syncFormat === "zoho") return "Download Zoho Books JSON";
    return "Download CSV";
  }

  get runReportsBtnLabel() {
    return this.loadingReports ? "Running…" : "Run ASC 606 Reports";
  }

  get generateSyncBtnLabel() {
    return this.generatingSync ? "Generating…" : "Generate & Preview Payload";
  }

  get lockBtnLabel() {
    return this.locking ? "Locking…" : "Lock Accounting Period";
  }

  get reopenBtnLabel() {
    return this.reopening ? "Reopening…" : "Confirm Reopen";
  }

  // Reports getters
  get formattedRollforward() {
    if (!this.rollforward) return null;
    return {
      beginning: formatMoney(this.rollforward.beginningDeferred || 0),
      billings: formatMoney(this.rollforward.newBillings || 0),
      recognized: formatMoney(this.rollforward.recognizedRevenue || 0),
      adjustments: formatMoney(this.rollforward.creditNoteAdjustments || 0),
      ending: formatMoney(this.rollforward.endingDeferred || 0)
    };
  }

  get formattedBillingsVsRevenue() {
    return (this.billingsVsRevenue || []).map((row) => ({
      ...row,
      billedFormatted: formatMoney(row.billedAmount || 0),
      recognizedFormatted: formatMoney(row.recognizedAmount || 0),
      varianceFormatted: formatMoney(row.variance || 0)
    }));
  }

  get formattedRevenueByProduct() {
    return (this.revenueByProduct || []).map((row) => ({
      ...row,
      totalFormatted: formatMoney(row.totalAmount || 0),
      recognizedFormatted: formatMoney(row.recognizedAmount || 0),
      deferredFormatted: formatMoney(row.deferredAmount || 0)
    }));
  }

  get hasBillingsVsRevenue() {
    return (this.billingsVsRevenue || []).length > 0;
  }

  get hasRevenueByProduct() {
    return (this.revenueByProduct || []).length > 0;
  }

  get formattedPeriodLocks() {
    return (this.periodLocks || []).map((p) => {
      let isLocked = p.status === "Locked";
      let isReopened = p.status === "Reopened";
      return {
        ...p,
        badgeClass: isLocked ? "rq-badge-locked" : isReopened ? "rq-badge-reopened" : "rq-badge-open",
        periodRange: `${formatDate(p.startDate)} – ${formatDate(p.endDate)}`,
        canReopen: isLocked
      };
    });
  }

  get hasPeriodLocks() {
    return (this.periodLocks || []).length > 0;
  }

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this.setDefaultExportDates();
    this.setDefaultReportDates();
    this.loadData();
  }

  disconnectedCallback() {
    if (this._releasePage) {
      this._releasePage();
    }
  }

  setDefaultExportDates() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.exportFrom = startOfMonth.toISOString().slice(0, 10);
    this.exportTo = today.toISOString().slice(0, 10);
  }

  setDefaultReportDates() {
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    this.reportFrom = sixMonthsAgo.toISOString().slice(0, 10);
    this.reportTo = today.toISOString().slice(0, 10);
  }

  // Navigation Sub-Views
  showWaterfallTab() {
    this.activeSubView = "waterfall";
  }

  showReportsTab() {
    this.activeSubView = "reports";
    if (!this.rollforward) {
      this.loadReports();
    }
  }

  showPeriodLocksTab() {
    this.activeSubView = "periodLocks";
    this.loadPeriodLocks();
  }

  loadData() {
    this.loading = true;
    getRevenue()
      .then((data) => {
        this.overview = data;
        this.loadError = "";
      })
      .catch((err) => {
        this.loadError = err?.body?.message || err?.message || "Failed to load revenue overview.";
      })
      .finally(() => {
        this.loading = false;
      });
  }

  // Period Locks Management
  loadPeriodLocks() {
    this.loadingLocks = true;
    getPeriodLocks()
      .then((data) => {
        this.periodLocks = data || [];
      })
      .catch((err) => {
        this.toast("Failed to load period locks", err?.body?.message || err?.message, "error");
      })
      .finally(() => {
        this.loadingLocks = false;
      });
  }

  openLockModal() {
    const today = new Date();
    const startOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    this.lockStartDate = startOfPrevMonth.toISOString().slice(0, 10);
    this.lockEndDate = endOfPrevMonth.toISOString().slice(0, 10);
    this.lockNotes = "Month-end close financial lock";
    this.showLockModal = true;
  }

  closeLockModal() {
    this.showLockModal = false;
  }

  handleLockStartDateChange(event) {
    this.lockStartDate = event.target.value;
  }

  handleLockEndDateChange(event) {
    this.lockEndDate = event.target.value;
  }

  handleLockNotesChange(event) {
    this.lockNotes = event.target.value;
  }

  submitLockPeriod() {
    if (!this.lockStartDate || !this.lockEndDate) {
      this.toast("Error", "Please provide both start and end dates.", "error");
      return;
    }
    this.locking = true;
    lockAccountingPeriod({
      startDate: this.lockStartDate,
      endDate: this.lockEndDate,
      notes: this.lockNotes
    })
      .then((msg) => {
        this.toast("Accounting Period Locked", msg, "success");
        this.showLockModal = false;
        this.loadPeriodLocks();
      })
      .catch((err) => {
        this.toast("Lock Failed", err?.body?.message || err?.message, "error");
      })
      .finally(() => {
        this.locking = false;
      });
  }

  openReopenModal(event) {
    this.reopenLockId = event.currentTarget.dataset.id;
    this.reopenLockName = event.currentTarget.dataset.name;
    this.reopenReason = "";
    this.showReopenModal = true;
  }

  closeReopenModal() {
    this.showReopenModal = false;
  }

  handleReopenReasonChange(event) {
    this.reopenReason = event.target.value;
  }

  submitReopenPeriod() {
    if (!this.reopenReason.trim()) {
      this.toast("Validation Error", "Mandatory justification reason required to reopen.", "error");
      return;
    }
    this.reopening = true;
    reopenAccountingPeriod({
      periodLockId: this.reopenLockId,
      reason: this.reopenReason
    })
      .then((msg) => {
        this.toast("Accounting Period Reopened", msg, "success");
        this.showReopenModal = false;
        this.loadPeriodLocks();
      })
      .catch((err) => {
        this.toast("Reopen Failed", err?.body?.message || err?.message, "error");
      })
      .finally(() => {
        this.reopening = false;
      });
  }

  // Reports Management
  handleReportFromChange(event) {
    this.reportFrom = event.target.value;
  }

  handleReportToChange(event) {
    this.reportTo = event.target.value;
  }

  loadReports() {
    this.loadingReports = true;
    Promise.all([
      getRollforwardReport({ fromDate: this.reportFrom, toDate: this.reportTo }),
      getBillingsVsRevenue({ fromDate: this.reportFrom, toDate: this.reportTo }),
      getRevenueByProduct({ fromDate: this.reportFrom, toDate: this.reportTo })
    ])
      .then(([rf, bvr, rbp]) => {
        this.rollforward = rf;
        this.billingsVsRevenue = bvr || [];
        this.revenueByProduct = rbp || [];
      })
      .catch((err) => {
        this.toast("Report Error", err?.body?.message || err?.message, "error");
      })
      .finally(() => {
        this.loadingReports = false;
      });
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
    this.activeFilter = event.currentTarget.dataset.key;
    this.page = 1;
  }

  handlePageChange(event) {
    this.page = event.detail.page;
  }

  handlePageSize(event) {
    this.pageSize = event.detail.pageSize;
    this.page = 1;
  }

  openInvoice(event) {
    const invoiceId = event.currentTarget.dataset.id;
    if (invoiceId) {
      this[NavigationMixin.Navigate](invoicePage(invoiceId));
    }
  }

  handleRecognizeNow() {
    this.loading = true;
    recognizeNow()
      .then((msg) => {
        this.toast("Revenue Recognised", msg, "success");
        this.loadData();
      })
      .catch((err) => {
        this.toast("Recognition Failed", err?.body?.message || err?.message, "error");
        this.loading = false;
      });
  }

  handleRecognizeSchedule(event) {
    const scheduleId = event.currentTarget.dataset.id;
    if (!scheduleId) return;

    this.loading = true;
    recognizeSchedule({ scheduleId })
      .then(() => {
        this.toast("Schedule Recognised", "Milestone revenue recognised successfully.", "success");
        this.loadData();
      })
      .catch((err) => {
        this.toast("Error", err?.body?.message || err?.message, "error");
        this.loading = false;
      });
  }

  handleBackfill() {
    this.backfilling = true;
    backfill()
      .then((msg) => {
        this.toast("Schedules Backfilled", msg, "success");
        this.loadData();
      })
      .catch((err) => {
        this.toast("Backfill Failed", err?.body?.message || err?.message, "error");
      })
      .finally(() => {
        this.backfilling = false;
      });
  }

  // Export & Accounting Sync Modal
  openExport() {
    this.syncPreview = "";
    this.showExportModal = true;
  }

  closeExport() {
    this.showExportModal = false;
  }

  handleExportFromChange(event) {
    this.exportFrom = event.target.value;
  }

  handleExportToChange(event) {
    this.exportTo = event.target.value;
  }

  handleMarkExportedChange(event) {
    this.markExported = event.target.checked;
  }

  handleSyncFormatChange(event) {
    this.syncFormat = event.target.value;
    this.syncPreview = "";
  }

  previewSync() {
    if (!this.exportFrom || !this.exportTo) {
      this.toast("Missing dates", "Please pick from and to dates.", "error");
      return;
    }
    this.generatingSync = true;
    exportAccountingSync({
      format: this.syncFormat,
      fromDate: this.exportFrom,
      toDate: this.exportTo
    })
      .then((payload) => {
        this.syncPreview = payload;
      })
      .catch((err) => {
        this.toast("Preview Error", err?.body?.message || err?.message, "error");
      })
      .finally(() => {
        this.generatingSync = false;
      });
  }

  copySyncPayload() {
    if (!this.syncPreview) return;
    navigator.clipboard.writeText(this.syncPreview);
    this.toast("Copied", "Payload copied to clipboard.", "success");
  }

  runExport() {
    if (!this.exportFrom || !this.exportTo) {
      this.toast("Missing dates", "Please pick from and to dates.", "error");
      return;
    }
    this.exporting = true;
    if (this.syncFormat === "csv") {
      exportJournal({
        fromDay: this.exportFrom,
        toDay: this.exportTo,
        markExported: this.markExported
      })
        .then((csv) => {
          this.triggerDownload(csv, `revenue_journal_${this.exportFrom}_to_${this.exportTo}.csv`, "text/csv");
          this.toast("Journal Exported", "CSV downloaded successfully.", "success");
          this.showExportModal = false;
        })
        .catch((err) => {
          this.toast("Export Failed", err?.body?.message || err?.message, "error");
        })
        .finally(() => {
          this.exporting = false;
        });
    } else {
      exportAccountingSync({
        format: this.syncFormat,
        fromDate: this.exportFrom,
        toDate: this.exportTo
      })
        .then((data) => {
          let ext = this.syncFormat === "tally" ? "xml" : "json";
          let mime = this.syncFormat === "tally" ? "application/xml" : "application/json";
          this.triggerDownload(data, `${this.syncFormat}_revenue_sync_${this.exportFrom}_to_${this.exportTo}.${ext}`, mime);
          this.toast("Sync Exported", `${this.syncFormat.toUpperCase()} payload downloaded.`, "success");
          this.showExportModal = false;
        })
        .catch((err) => {
          this.toast("Export Failed", err?.body?.message || err?.message, "error");
        })
        .finally(() => {
          this.exporting = false;
        });
    }
  }

  triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  toast(title, message, variant = "info") {
    const toast = this.template.querySelector("c-revquila-toast");
    if (toast) {
      toast.show({ title, message, variant });
    }
  }
}