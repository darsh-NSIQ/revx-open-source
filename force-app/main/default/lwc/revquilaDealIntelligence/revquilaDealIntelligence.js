import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getDealAnalysis from '@salesforce/apex/RevquilaDealIntelligenceController.getDealAnalysis';
import applyDealRecommendation from '@salesforce/apex/RevquilaDealIntelligenceController.applyDealRecommendation';
import getRecentQuotesForScoring from '@salesforce/apex/RevquilaDealIntelligenceController.getRecentQuotesForScoring';

export default class RevquilaDealIntelligence extends LightningElement {
  @api recordId;

  @track selectedQuoteId;
  @track quoteOptions = [];
  @track dealData = null;
  @track isLoading = false;

  connectedCallback() {
    if (this.recordId) {
      this.selectedQuoteId = this.recordId;
      this.loadAnalysis(this.recordId);
    } else {
      this.loadRecentQuotes();
    }
  }

  loadRecentQuotes() {
    this.isLoading = true;
    getRecentQuotesForScoring()
      .then((quotes) => {
        if (quotes && quotes.length > 0) {
          this.quoteOptions = quotes.map((q) => ({
            label: `${q.Display_Number__c || q.Name} - ${q.Account__r ? q.Account__r.Name : 'Quote'} (Total: $${q.Total__c || 0})`,
            value: q.Id
          }));
          this.selectedQuoteId = this.quoteOptions[0].value;
          this.loadAnalysis(this.selectedQuoteId);
        } else {
          this.isLoading = false;
        }
      })
      .catch((err) => {
        this.isLoading = false;
        console.error('Failed to load quotes:', err);
      });
  }

  loadAnalysis(quoteId) {
    if (!quoteId) return;
    this.isLoading = true;
    getDealAnalysis({ quoteId })
      .then((data) => {
        this.dealData = this.formatData(data);
        this.isLoading = false;
      })
      .catch((err) => {
        this.isLoading = false;
        this.showToast('Evaluation Error', err.body ? err.body.message : err.message, 'error');
      });
  }

  formatData(data) {
    if (!data) return null;
    const recs = (data.recommendations || []).map((r) => {
      let impactLabel = 'Win Rate Lift';
      let badgeClass = 'rec-badge rec-badge-win';
      if (r.impactType === 'margin') {
        impactLabel = 'Margin Protection';
        badgeClass = 'rec-badge rec-badge-margin';
      } else if (r.impactType === 'cashflow') {
        impactLabel = 'Cash Flow Accelerator';
        badgeClass = 'rec-badge rec-badge-cash';
      }
      return {
        ...r,
        impactLabel,
        badgeClass
      };
    });

    return {
      ...data,
      recommendations: recs
    };
  }

  handleQuoteSelect(event) {
    this.selectedQuoteId = event.detail.value;
    this.loadAnalysis(this.selectedQuoteId);
  }

  handleReanalyze() {
    const qId = this.recordId || this.selectedQuoteId;
    if (qId) {
      this.loadAnalysis(qId);
    }
  }

  handleApplyRec(event) {
    const disc = event.target.dataset.discount ? parseFloat(event.target.dataset.discount) : null;
    const terms = event.target.dataset.terms || null;
    const qId = this.recordId || this.selectedQuoteId;

    this.isLoading = true;
    applyDealRecommendation({ quoteId: qId, suggestedDiscount: disc, suggestedTerms: terms })
      .then((updatedData) => {
        this.dealData = this.formatData(updatedData);
        this.isLoading = false;
        this.showToast('Optimization Applied', 'Quote discount and payment terms updated successfully.', 'success');
      })
      .catch((err) => {
        this.isLoading = false;
        this.showToast('Action Failed', err.body ? err.body.message : err.message, 'error');
      });
  }

  // Getters
  get isRecordContext() {
    return !!this.recordId;
  }

  get hasData() {
    return !!this.dealData;
  }

  get hasRecommendations() {
    return this.dealData && this.dealData.recommendations && this.dealData.recommendations.length > 0;
  }

  get gaugeDashArray() {
    const score = this.dealData ? Math.round(this.dealData.dealScore) : 0;
    return `${score}, 100`;
  }

  get circleStrokeClass() {
    if (!this.dealData) return 'circle-stroke score-moderate';
    const score = this.dealData.dealScore;
    if (score >= 80) return 'circle-stroke score-hot';
    if (score >= 68) return 'circle-stroke score-strong';
    if (score >= 52) return 'circle-stroke score-moderate';
    return 'circle-stroke score-risk';
  }

  get ratingBadgeClass() {
    if (!this.dealData) return 'rating-badge badge-moderate';
    const tier = this.dealData.ratingTier;
    if (tier === 'Hot') return 'rating-badge badge-hot';
    if (tier === 'Strong') return 'rating-badge badge-strong';
    if (tier === 'Moderate') return 'rating-badge badge-moderate';
    return 'rating-badge badge-risk';
  }

  get marginBadgeClass() {
    if (!this.dealData) return 'margin-badge';
    const h = this.dealData.marginHealth;
    if (h === 'Healthy') return 'margin-badge margin-healthy';
    if (h === 'Acceptable') return 'margin-badge margin-acceptable';
    return 'margin-badge margin-eroded';
  }

  get winProbProgressStyle() {
    const prob = this.dealData ? this.dealData.winProbability : 0;
    return `width: ${prob}%;`;
  }

  get factorList() {
    if (!this.dealData || !this.dealData.scoreFactorBreakdown) return [];
    return Object.keys(this.dealData.scoreFactorBreakdown).map((k) => ({
      name: k,
      points: this.dealData.scoreFactorBreakdown[k]
    }));
  }

  showToast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
