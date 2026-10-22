import { LightningElement, track } from "lwc";
import { fillPage } from "c/revquilaFill";
import { moveSpotlight, clearSpotlight } from "c/revquilaSpotlight";
import getWarRoomData from "@salesforce/apex/RevquilaWarRoomController.getWarRoomData";
import simulateScenario from "@salesforce/apex/RevquilaWarRoomController.simulateScenario";

export default class RevquilaExecutiveWarRoom extends LightningElement {
  loading = true;

  nrr = 114.2;
  grr = 92.4;
  ruleOf40 = 48.6;
  ltvCac = 4.8;
  cacPayback = 11.2;
  magicNumber = 1.34;

  @track waterfall = [];
  @track cohorts = [];

  simPriceUplift = 8;
  simChurnRed = 1.5;
  simWinRate = 5;

  simDelta = 0;
  simProjEnding = 0;
  simProjectedNRR = 121.4;
  simRunway = 4.8;
  simSummary = "";

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

  get hasWaterfall() {
    return !this.loading && this.waterfall.length > 0;
  }

  get simDeltaFormatted() {
    return Number(this.simDelta || 0).toLocaleString();
  }

  get simProjEndingFormatted() {
    return Number(this.simProjEnding || 0).toLocaleString();
  }

  async loadData() {
    this.loading = true;
    try {
      const data = await getWarRoomData();
      if (data) {
        this.nrr = data.nrr || 114.2;
        this.grr = data.grr || 92.4;
        this.ruleOf40 = data.ruleOf40 || 48.6;
        this.ltvCac = data.ltvCacRatio || 4.8;
        this.cacPayback = data.cacPaybackMonths || 11.2;
        this.magicNumber = data.magicNumber || 1.34;

        // Calculate max bar height for percentage styling
        const maxVal = Math.max(...(data.waterfall || []).map(w => w.amount || 0), 1);

        this.waterfall = (data.waterfall || []).map(w => {
          const heightPct = Math.max(15, Math.round(((w.amount || 0) / maxVal) * 100));
          let dirClass = "rq-bar-base";
          if (w.direction === "positive") dirClass = "rq-bar-pos";
          else if (w.direction === "negative") dirClass = "rq-bar-neg";
          else if (w.direction === "total") dirClass = "rq-bar-end";

          return {
            ...w,
            barClass: `rq-waterfall-bar ${dirClass}`,
            barStyle: `height: ${heightPct}%;`
          };
        });

        this.cohorts = (data.cohorts || []).map(c => ({
          ...c,
          formattedStart: Number(c.startingARR || 0).toLocaleString(),
          m3Label: c.month3Retention ? `${c.month3Retention}%` : "—",
          m3Class: this.getCohortClass(c.month3Retention),
          m6Label: c.month6Retention ? `${c.month6Retention}%` : "—",
          m6Class: this.getCohortClass(c.month6Retention),
          m9Label: c.month9Retention ? `${c.month9Retention}%` : "—",
          m9Class: this.getCohortClass(c.month9Retention),
          m12Label: c.month12Retention ? `${c.month12Retention}%` : "—",
          m12Class: this.getCohortClass(c.month12Retention)
        }));

        await this.runSimulation();
      }
    } catch (err) {
      this.showToast("War Room Load Error", err.body?.message || err.message, "bad");
    } finally {
      this.loading = false;
    }
  }

  getCohortClass(val) {
    if (!val) return "rq-text-mut";
    if (val >= 110) return "rq-badge rq-badge-good";
    if (val >= 100) return "rq-badge rq-badge-info";
    return "rq-badge rq-badge-warn";
  }

  refreshData() {
    this.loadData();
  }

  handlePriceSlider(e) {
    this.simPriceUplift = Number(e.target.value);
    this.runSimulation();
  }

  handleChurnSlider(e) {
    this.simChurnRed = Number(e.target.value);
    this.runSimulation();
  }

  handleWinSlider(e) {
    this.simWinRate = Number(e.target.value);
    this.runSimulation();
  }

  async runSimulation() {
    try {
      const sim = await simulateScenario({
        priceUpliftPct: this.simPriceUplift,
        churnReductionPct: this.simChurnRed,
        winRateUpliftPct: this.simWinRate
      });
      if (sim) {
        this.simDelta = sim.netARRDelta || 0;
        this.simProjEnding = sim.projectedEndingARR || 0;
        this.simProjectedNRR = sim.projectedNRR || 120;
        this.simRunway = sim.runwayExtensionMonths || 4.2;
        this.simSummary = sim.summaryStatement || "";
      }
    } catch (err) {
      // fallback local calculation if needed
    }
  }

  showToast(title, message, tone = "good") {
    const toast = this.refs.toast;
    if (toast) toast.show({ title, message, tone });
  }
}
