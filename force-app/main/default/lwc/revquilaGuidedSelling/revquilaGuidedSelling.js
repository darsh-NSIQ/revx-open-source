import { LightningElement, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { quotePage } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { moveSpotlight, clearSpotlight } from "c/revquilaSpotlight";
import getConfigData from "@salesforce/apex/RevquilaGuidedSellingController.getConfigData";
import evaluateProposals from "@salesforce/apex/RevquilaGuidedSellingController.evaluateProposals";
import createQuoteFromProposal from "@salesforce/apex/RevquilaGuidedSellingController.createQuoteFromProposal";

export default class RevquilaGuidedSelling extends NavigationMixin(LightningElement) {
  loading = false;
  creatingQuote = false;
  currentStep = 1;

  selectedAccountId = "";
  selectedIndustry = "saas";
  selectedSize = "growth";
  selectedModel = "hybrid";
  selectedFeatures = ["ai_advisor", "usage_metering"];

  accounts = [];
  rawIndustries = [];
  rawCompanySizes = [];
  rawBusinessModels = [];
  rawFeatures = [];
  proposals = [];

  _releasePage;

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
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

  @wire(getConfigData)
  wiredConfig({ data, error }) {
    if (data) {
      this.accounts = data.accounts || [];
      this.rawIndustries = data.industries || [];
      this.rawCompanySizes = data.companySizes || [];
      this.rawBusinessModels = data.businessModels || [];
      this.rawFeatures = data.featureOptions || [];
      if (this.accounts.length > 0) {
        this.selectedAccountId = this.accounts[0].id;
      }
    } else if (error) {
      this.showToast("Failed to load options", error.body?.message || "Error", "bad");
    }
  }

  get isStep1() { return this.currentStep === 1; }
  get isStep2() { return this.currentStep === 2; }
  get isStep3() { return this.currentStep === 3; }

  get step1Class() { return `rq-step-btn ${this.currentStep === 1 ? "rq-step-active" : ""}`; }
  get step2Class() { return `rq-step-btn ${this.currentStep === 2 ? "rq-step-active" : ""}`; }
  get step3Class() { return `rq-step-btn ${this.currentStep === 3 ? "rq-step-active" : ""}`; }

  get cannotAdvanceStep1() {
    return !this.selectedAccountId || !this.selectedIndustry;
  }

  get industries() {
    return this.rawIndustries.map(i => ({
      ...i,
      cardClass: `rq-opt-card ${this.selectedIndustry === i.id ? "rq-opt-selected" : ""}`
    }));
  }

  get companySizes() {
    return this.rawCompanySizes.map(s => ({
      ...s,
      cardClass: `rq-opt-card ${this.selectedSize === s.id ? "rq-opt-selected" : ""}`
    }));
  }

  get businessModels() {
    return this.rawBusinessModels.map(m => ({
      ...m,
      cardClass: `rq-opt-card ${this.selectedModel === m.id ? "rq-opt-selected" : ""}`
    }));
  }

  get featureOptions() {
    return this.rawFeatures.map(f => ({
      ...f,
      selected: this.selectedFeatures.includes(f.id)
    }));
  }

  goToStep1() { this.currentStep = 1; }
  goToStep2() {
    if (!this.selectedAccountId) {
      this.showToast("Account Required", "Please choose a customer account first.", "warn");
      return;
    }
    this.currentStep = 2;
  }
  goToStep3() { this.currentStep = 3; }

  handleAccountChange(e) {
    this.selectedAccountId = e.target.value;
  }

  handleSelectIndustry(e) {
    this.selectedIndustry = e.currentTarget.dataset.id;
  }

  handleSelectSize(e) {
    this.selectedSize = e.currentTarget.dataset.id;
  }

  handleSelectModel(e) {
    this.selectedModel = e.currentTarget.dataset.id;
  }

  handleToggleFeature(e) {
    const id = e.target.dataset.id;
    if (e.target.checked) {
      if (!this.selectedFeatures.includes(id)) {
        this.selectedFeatures = [...this.selectedFeatures, id];
      }
    } else {
      this.selectedFeatures = this.selectedFeatures.filter(x => x !== id);
    }
  }

  async evaluateProposalsAction() {
    this.loading = true;
    try {
      const result = await evaluateProposals({
        industry: this.selectedIndustry,
        companySize: this.selectedSize,
        businessModel: this.selectedModel,
        selectedFeatures: this.selectedFeatures
      });
      this.proposals = (result || []).map(p => ({
        ...p,
        wrapperClass: `rq-card rq-prop-card ${p.packageCode === "RECOMMENDED" ? "rq-prop-featured" : ""}`,
        tagClass: `rq-badge ${p.packageCode === "RECOMMENDED" ? "rq-badge-good" : "rq-badge-info"}`
      }));
      this.currentStep = 3;
    } catch (err) {
      this.showToast("Proposal Generation Error", err.body?.message || err.message, "bad");
    } finally {
      this.loading = false;
    }
  }

  async handleCreateQuote(e) {
    const code = e.currentTarget.dataset.code;
    const prop = this.proposals.find(p => p.packageCode === code);
    if (!prop) return;

    this.creatingQuote = true;
    try {
      const quoteId = await createQuoteFromProposal({
        accountId: this.selectedAccountId,
        packageName: prop.title,
        discountPct: prop.suggestedDiscount,
        productsJson: JSON.stringify(prop.products)
      });

      this.showToast("Quote Created!", `Draft quote generated for ${prop.title}. Redirecting...`, "good");
      setTimeout(() => {
        this[NavigationMixin.Navigate](quotePage(quoteId));
      }, 1000);
    } catch (err) {
      this.showToast("Quote Creation Failed", err.body?.message || err.message, "bad");
    } finally {
      this.creatingQuote = false;
    }
  }

  showToast(title, message, tone = "good") {
    const toast = this.refs.toast;
    if (toast) toast.show({ title, message, tone });
  }
}
