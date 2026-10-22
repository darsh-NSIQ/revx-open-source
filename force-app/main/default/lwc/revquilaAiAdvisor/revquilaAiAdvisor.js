import { LightningElement, api, track } from "lwc";
import getAdviceApex from "@salesforce/apex/RevquilaAiController.getAdvice";

export default class RevquilaAiAdvisor extends LightningElement {
  @api quoteId;

  @track advice;
  loading = false;
  errorMessage = "";
  activeTab = "strategy";
  copied = false;

  connectedCallback() {
    if (this.quoteId) {
      this.loadAdvice();
    }
  }

  @api
  refresh() {
    this.loadAdvice();
  }

  async loadAdvice() {
    if (!this.quoteId) return;
    this.loading = true;
    this.errorMessage = "";
    try {
      const data = await getAdviceApex({ quoteId: this.quoteId });
      this.advice = data;
    } catch (err) {
      this.errorMessage =
        err?.body?.message || err?.message || "Failed to load AI deal advice.";
    } finally {
      this.loading = false;
    }
  }

  handleRefresh() {
    this.loadAdvice();
  }

  selectTab(event) {
    const tab = event.currentTarget?.dataset?.tab;
    if (tab) {
      this.activeTab = tab;
    }
  }

  async handleCopyPitch() {
    const pitchText = this.clientPitchEmailText;
    if (!pitchText) return;
    try {
      await navigator.clipboard.writeText(pitchText);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2500);
    } catch (e) {
      // Fallback
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2500);
    }
  }

  // --- Getters ---

  get showContent() {
    return !this.loading && !this.hasError && !!this.advice;
  }

  get hasError() {
    return !!this.errorMessage;
  }

  get providerLabel() {
    if (!this.advice) return "AI Offline";
    return this.advice.isLiveAi ? this.advice.providerUsed : "Heuristic AI Engine";
  }

  get providerBadgeClass() {
    const isLive = this.advice && this.advice.isLiveAi;
    return isLive
      ? "rq-pill rq-pill-live"
      : "rq-pill rq-pill-heuristic";
  }

  get refreshButtonLabel() {
    return this.loading ? "Analyzing…" : "Refresh";
  }

  get refreshIconClass() {
    return this.loading ? "rq-spin-icon" : "";
  }

  get winScoreDisplay() {
    return this.advice ? `${this.advice.winProbability}%` : "0%";
  }

  get winConfidenceLabel() {
    return this.advice ? this.advice.winConfidence : "";
  }

  get winScoreClass() {
    const score = this.advice?.winProbability || 0;
    if (score >= 75) return "rq-score-val rq-val-good";
    if (score >= 55) return "rq-score-val rq-val-mid";
    return "rq-score-val rq-val-warn";
  }

  get winPillClass() {
    const score = this.advice?.winProbability || 0;
    if (score >= 75) return "rq-pill rq-pill-good";
    if (score >= 55) return "rq-pill rq-pill-mid";
    return "rq-pill rq-pill-warn";
  }

  get meterFillClass() {
    const score = this.advice?.winProbability || 0;
    if (score >= 75) return "rq-meter-fill rq-fill-good";
    if (score >= 55) return "rq-meter-fill rq-fill-mid";
    return "rq-meter-fill rq-fill-warn";
  }

  get meterFillStyle() {
    const score = this.advice?.winProbability || 0;
    return `width: ${score}%;`;
  }

  get actualDiscountDisplay() {
    const disc = this.advice?.actualDiscount ?? 0;
    return `${Number(disc).toFixed(1)}%`;
  }

  get benchmarkDiscountDisplay() {
    const bench = this.advice?.benchmarkDiscount ?? 0;
    return `${Number(bench).toFixed(1)}%`;
  }

  get discountStatusSub() {
    if (!this.advice) return "";
    const act = Number(this.advice.actualDiscount || 0);
    const bench = Number(this.advice.benchmarkDiscount || 0);
    if (act > bench) {
      return `+${(act - bench).toFixed(1)}% over cohort average`;
    }
    if (act === 0) {
      return "Full price (Max margin preserved)";
    }
    return "Within target margin guidelines";
  }

  get isStrategyTab() {
    return this.activeTab === "strategy";
  }

  get isProposalTab() {
    return this.activeTab === "proposal";
  }

  get isRiskTab() {
    return this.activeTab === "risks";
  }

  get strategyTabClass() {
    return this.activeTab === "strategy"
      ? "rq-tab-btn rq-tab-active"
      : "rq-tab-btn";
  }

  get proposalTabClass() {
    return this.activeTab === "proposal"
      ? "rq-tab-btn rq-tab-active"
      : "rq-tab-btn";
  }

  get riskTabClass() {
    return this.activeTab === "risks"
      ? "rq-tab-btn rq-tab-active"
      : "rq-tab-btn";
  }

  get discountAnalysisText() {
    return this.advice?.discountAnalysis || "No discount analysis available.";
  }

  get recommendationsList() {
    if (!this.advice || !this.advice.recommendations) return [];
    return this.advice.recommendations.map((text, idx) => ({
      id: `rec-${idx}`,
      text
    }));
  }

  get hasUpsells() {
    return (
      this.advice &&
      this.advice.upsellSuggestions &&
      this.advice.upsellSuggestions.length > 0
    );
  }

  get upsellList() {
    if (!this.hasUpsells) return [];
    return this.advice.upsellSuggestions.map((u) => ({
      name: u.name,
      family: u.family || "Package",
      reason: u.reason,
      formattedAmount: `$${Number(u.estimatedAmount || 0).toLocaleString()}`
    }));
  }

  get copyButtonLabel() {
    return this.copied ? "Copied!" : "Copy Pitch";
  }

  get executiveSummaryText() {
    return this.advice?.executiveSummary || "";
  }

  get clientPitchEmailText() {
    return this.advice?.clientPitchEmail || "";
  }

  get riskCount() {
    if (!this.advice || !this.advice.riskWarnings) return 0;
    return this.advice.riskWarnings.length;
  }

  get riskList() {
    if (!this.advice || !this.advice.riskWarnings) return [];
    return this.advice.riskWarnings.map((text, idx) => {
      const isClean = text.toLowerCase().includes("no governance") || text.toLowerCase().includes("adheres");
      return {
        id: `risk-${idx}`,
        text,
        icon: isClean ? "✓" : "!",
        itemClass: isClean ? "rq-risk-item rq-risk-clean" : "rq-risk-item rq-risk-flag"
      };
    });
  }
}