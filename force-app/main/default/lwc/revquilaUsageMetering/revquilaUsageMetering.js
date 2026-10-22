import { LightningElement, track } from "lwc";
import { fillPage } from "c/revquilaFill";
import { moveSpotlight, clearSpotlight } from "c/revquilaSpotlight";
import getMeteringDashboard from "@salesforce/apex/RevquilaUsageMeteringController.getMeteringDashboard";
import ingestUsageEvent from "@salesforce/apex/RevquilaUsageMeteringController.ingestUsageEvent";
import closeAndBillAccruedUsage from "@salesforce/apex/RevquilaUsageMeteringController.closeAndBillAccruedUsage";

export default class RevquilaUsageMetering extends LightningElement {
  loading = true;
  ingesting = false;

  totalAccrued = 0;
  totalEvents = 0;
  activeMeters = 0;

  @track subscriptions = [];

  simSelectedSubId = "";
  simMetric = "API Ingestion Transactions";
  simQuantity = 10000;

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

  get formattedAccrued() {
    return Number(this.totalAccrued || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  get formattedEvents() {
    return Number(this.totalEvents || 0).toLocaleString();
  }

  get hasSubscriptions() {
    return !this.loading && this.subscriptions.length > 0;
  }

  async loadData() {
    this.loading = true;
    try {
      const data = await getMeteringDashboard();
      if (data) {
        this.totalAccrued = data.totalAccruedRevenue || 0;
        this.totalEvents = data.totalEventsIngested || 0;
        this.activeMeters = data.activeMetersCount || 0;

        this.subscriptions = (data.subscriptions || []).map(s => {
          const pct = Math.min(100, s.usagePercent || 0);
          return {
            ...s,
            consumedFormatted: Number(s.consumedUnits || 0).toLocaleString(),
            includedFormatted: Number(s.includedUnits || 0).toLocaleString(),
            overageFormatted: Number(s.overageUnits || 0).toLocaleString(),
            hasOverage: (s.overageUnits || 0) > 0,
            progressBarStyle: `width: ${pct}%; background: ${pct >= 100 ? "var(--rq-bad, #ef4444)" : "var(--rq-acc, #2563eb)"};`
          };
        });

        if (this.subscriptions.length > 0 && !this.simSelectedSubId) {
          this.simSelectedSubId = this.subscriptions[0].subscriptionId;
        }
      }
    } catch (err) {
      this.showToast("Telemetry Load Error", err.body?.message || err.message, "bad");
    } finally {
      this.loading = false;
    }
  }

  refreshData() {
    this.loadData();
  }

  handleSimSubChange(e) {
    this.simSelectedSubId = e.target.value;
  }

  handleSimMetricChange(e) {
    this.simMetric = e.target.value;
  }

  handleSimQtyChange(e) {
    this.simQuantity = Number(e.target.value || 0);
  }

  async handleIngestEvent() {
    if (!this.simQuantity || this.simQuantity <= 0) {
      this.showToast("Invalid Units", "Please enter positive units.", "warn");
      return;
    }

    this.ingesting = true;
    try {
      const res = await ingestUsageEvent({
        subscriptionId: this.simSelectedSubId || null,
        metricName: this.simMetric,
        quantity: this.simQuantity,
        note: `Simulator stream: ${this.simQuantity} ${this.simMetric}`
      });

      this.showToast("Stream Ingested ⚡", res.message, "good");
      await this.loadData();
    } catch (err) {
      this.showToast("Ingestion Failed", err.body?.message || err.message, "bad");
    } finally {
      this.ingesting = false;
    }
  }

  async handleCloseBilling(e) {
    const subId = e.currentTarget.dataset.id;
    try {
      const msg = await closeAndBillAccruedUsage({ subscriptionId: subId });
      this.showToast("Billing Synchronized", msg, "good");
      await this.loadData();
    } catch (err) {
      this.showToast("Sync Error", err.body?.message || err.message, "bad");
    }
  }

  showToast(title, message, tone = "good") {
    const toast = this.refs.toast;
    if (toast) toast.show({ title, message, tone });
  }
}
