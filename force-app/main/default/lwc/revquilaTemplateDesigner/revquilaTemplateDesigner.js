import { LightningElement, track } from "lwc";
import { getConfig, publishConfig } from "c/revquilaConfig";
import { createPdf } from "c/revquilaDocuments";
import { errorMessage } from "c/revquilaData";

const SWATCHES = [
  { hex: "#0176d3", name: "RevX Blue" },
  { hex: "#6366f1", name: "Indigo Purple" },
  { hex: "#059669", name: "Emerald Green" },
  { hex: "#d97706", name: "Amber Gold" },
  { hex: "#e11d48", name: "Crimson Rose" },
  { hex: "#0f172a", name: "Slate Charcoal" }
];

const PRESETS = [
  {
    id: "modern_saas",
    name: "Modern SaaS Quote (Standard)",
    layout: "modern",
    font: "sans",
    accent: "#0176d3",
    pageSize: "A4",
    logoPosition: "left",
    quoteTitle: "Quotation & Proposal",
    terms:
      "1. Prices are valid for 30 calendar days from the issue date.\n2. Invoicing commences upon signature execution.\n3. Standard payment terms are Net 30 days unless agreed otherwise.",
    footer: "Thank you for partnering with RevX. Transforming Quote-to-Cash."
  },
  {
    id: "enterprise_msa",
    name: "Enterprise Master Agreement & Schedule",
    layout: "classic",
    font: "serif",
    accent: "#6366f1",
    pageSize: "A4",
    logoPosition: "left",
    quoteTitle: "Enterprise Order Schedule & MSA",
    terms:
      "1. Multi-year commitment subject to RevX Master Services Agreement.\n2. Guaranteed 99.95% uptime SLA with 24x7 Enterprise Premier Support.\n3. Co-termed additions prorated to master renewal schedule.",
    footer: "Confidential & Proprietary · RevX Enterprise Revenue Platform."
  },
  {
    id: "india_gst",
    name: "India GST Compliant B2B Tax Invoice",
    layout: "classic",
    font: "sans",
    accent: "#059669",
    pageSize: "A4",
    logoPosition: "left",
    quoteTitle: "Tax Invoice & Bill of Supply",
    terms:
      "1. Place of Supply determined as per GST Council inter-state rules.\n2. ITC eligibility subject to GSTR-1/GSTR-2B reconciliation.\n3. Late payment interest @ 18% p.a. applicable post due date.",
    footer: "Computer generated tax invoice. Compliant with Rule 46 of CGST Rules."
  },
  {
    id: "minimal_tech",
    name: "Minimalist Tech Statement",
    layout: "minimal",
    font: "sans",
    accent: "#0f172a",
    pageSize: "Letter",
    logoPosition: "right",
    quoteTitle: "Statement of Work & Pricing",
    terms:
      "1. Work deliverables executed under agile 2-week milestones.\n2. Payment released upon sprint acceptance sign-off.\n3. Code ownership transfers in full upon final payment clearance.",
    footer: "RevX Modern Revenue Cloud · All rights reserved."
  }
];

const DEFAULT_SECTIONS = [
  { id: "header", name: "Header & Brand", summary: "Logo, company info, and title", visible: true },
  { id: "meta", name: "Document Metadata", summary: "Issue date, due date, terms, and rep", visible: true },
  { id: "parties", name: "Bill To & Ship To", summary: "Customer address, contact, and tax IDs", visible: true },
  { id: "lines", name: "Products Table", summary: "Items, descriptions, pricing, and quantities", visible: true },
  { id: "totals", name: "Summary & Totals", summary: "Subtotal, discounts, tax split, and grand total", visible: true },
  { id: "terms", name: "Terms & Conditions", summary: "Legal stipulations, payment terms, and SLA", visible: true },
  { id: "bank", name: "Bank & Remittance", summary: "Wire details, bank account, and IFSC / IBAN", visible: true },
  { id: "signatures", name: "Signatures", summary: "Client acceptance and authorized company signer", visible: true },
  { id: "footer", name: "Document Footer", summary: "Closing remarks and confidentiality note", visible: true }
];

export default class RevquilaTemplateDesigner extends LightningElement {
  @track sectionList = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
  @track selectedSectionId = "lines";
  @track hoveredSectionId = null;

  activePresetId = "modern_saas";
  viewMode = "designer"; // designer | preview
  inspectorTab = "style"; // style | content | data
  sampleKind = "quote"; // quote | order | invoice
  sampleCurrency = "USD"; // USD | INR | EUR | GBP

  saving = false;
  exportingPdf = false;

  @track docConfig = {
    layout: "modern",
    font: "sans",
    pageSize: "A4",
    accent: "#0176d3",
    showLogo: true,
    logoPosition: "left",
    quoteTitle: "Quotation & Proposal",
    invoiceTitle: "Tax Invoice",
    showUnit: true,
    showDiscount: true,
    showTaxBreakup: true,
    showBankDetails: true,
    bankDetails:
      "Bank: Silicon Valley Bank / HDFC\nAccount: 0942-8821-4902\nIFSC / SWIFT: HDFC0001290",
    terms:
      "1. Prices are valid for 30 calendar days from the issue date.\n2. Invoicing commences upon signature execution.\n3. Standard payment terms are Net 30 days.",
    footer: "Thank you for choosing RevX. Transforming Quote-to-Cash.",
    showSignature: true,
    signatory: "Darsh Desai, Chief Revenue Officer",
    draftWatermark: false
  };

  connectedCallback() {
    this.syncFromGlobalConfig();
  }

  syncFromGlobalConfig() {
    const config = getConfig();
    if (config?.pdf) {
      this.docConfig = {
        ...this.docConfig,
        ...config.pdf,
        accent: config.pdf.accent || config.brand?.accent || "#0176d3"
      };
    }
  }

  // ---------------------------------------------------------------- Presets
  get presets() {
    return PRESETS.map((p) => ({
      ...p,
      selected: p.id === this.activePresetId
    }));
  }

  get activePresetName() {
    const found = PRESETS.find((p) => p.id === this.activePresetId);
    return found ? found.name : "Custom";
  }

  handlePresetChange(event) {
    const presetId = event.target.value;
    this.activePresetId = presetId;
    const p = PRESETS.find((item) => item.id === presetId);
    if (p) {
      this.docConfig = {
        ...this.docConfig,
        layout: p.layout,
        font: p.font,
        accent: p.accent,
        pageSize: p.pageSize,
        logoPosition: p.logoPosition,
        quoteTitle: p.quoteTitle,
        terms: p.terms,
        footer: p.footer
      };
      this.refs.toast?.show(`Loaded preset: ${p.name}`, "accent");
    }
  }

  // ---------------------------------------------------------------- View Modes
  get isDesignerMode() {
    return this.viewMode === "designer";
  }

  get designerModeClass() {
    return `td-mode-btn ${this.viewMode === "designer" ? "is-active" : ""}`;
  }

  get previewModeClass() {
    return `td-mode-btn ${this.viewMode === "preview" ? "is-active" : ""}`;
  }

  handleViewMode(event) {
    this.viewMode = event.currentTarget.dataset.mode;
  }

  // ---------------------------------------------------------------- Inspector Tabs
  get isTabStyle() {
    return this.inspectorTab === "style";
  }

  get isTabContent() {
    return this.inspectorTab === "content";
  }

  get isTabData() {
    return this.inspectorTab === "data";
  }

  get styleTabClass() {
    return `td-tab-item ${this.inspectorTab === "style" ? "is-active" : ""}`;
  }

  get contentTabClass() {
    return `td-tab-item ${this.inspectorTab === "content" ? "is-active" : ""}`;
  }

  get dataTabClass() {
    return `td-tab-item ${this.inspectorTab === "data" ? "is-active" : ""}`;
  }

  handleInspectorTab(event) {
    this.inspectorTab = event.currentTarget.dataset.tab;
  }

  // ---------------------------------------------------------------- Sections Management
  get sections() {
    return this.sectionList.map((sec, index) => ({
      ...sec,
      isFirst: index === 0,
      isLast: index === this.sectionList.length - 1,
      visibleTitle: sec.visible ? "Hide section" : "Show section",
      cardClass: `td-section-card ${
        sec.id === this.selectedSectionId ? "is-selected" : ""
      } ${!sec.visible ? "is-hidden" : ""}`
    }));
  }

  selectSection(event) {
    this.selectedSectionId = event.currentTarget.dataset.id;
  }

  selectSectionFromCanvas(event) {
    this.selectedSectionId = event.currentTarget.dataset.id;
    this.inspectorTab = "content";
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  moveSection(event) {
    event.stopPropagation();
    const { id, dir } = event.currentTarget.dataset;
    const index = this.sectionList.findIndex((s) => s.id === id);
    if (index === -1) return;

    const list = [...this.sectionList];
    const targetIndex = dir === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);
    this.sectionList = list;
    this.selectedSectionId = id;
  }

  toggleSectionVisibility(event) {
    event.stopPropagation();
    const { id } = event.currentTarget.dataset;
    this.sectionList = this.sectionList.map((s) =>
      s.id === id ? { ...s, visible: !s.visible } : s
    );
  }

  // ---------------------------------------------------------------- Rendered Blocks
  get orderedSections() {
    return this.sectionList.map((sec) => {
      const isSelected = sec.id === this.selectedSectionId;
      return {
        ...sec,
        wrapperClass: `td-block-wrapper ${
          this.isDesignerMode && isSelected ? "is-active-block" : ""
        }`,
        isHeader: sec.id === "header",
        isMeta: sec.id === "meta",
        isParties: sec.id === "parties",
        isLines: sec.id === "lines",
        isTotals: sec.id === "totals",
        isTerms: sec.id === "terms",
        isBank: sec.id === "bank",
        isSignatures: sec.id === "signatures",
        isFooter: sec.id === "footer"
      };
    });
  }

  // ---------------------------------------------------------------- Styles & Swatches
  get swatches() {
    return SWATCHES.map((s) => ({
      ...s,
      style: `background-color: ${s.hex}`,
      cls: `td-swatch ${
        s.hex.toLowerCase() === (this.docConfig.accent || "").toLowerCase()
          ? "is-active"
          : ""
      }`
    }));
  }

  pickAccentColor(event) {
    const { hex } = event.currentTarget.dataset;
    this.docConfig = { ...this.docConfig, accent: hex };
  }

  handleDocConfig(event) {
    const { field } = event.target.dataset;
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    this.docConfig = {
      ...this.docConfig,
      [field]: value
    };
  }

  get isLayoutModern() {
    return this.docConfig.layout === "modern";
  }

  get isLayoutClassic() {
    return this.docConfig.layout === "classic";
  }

  get isLayoutMinimal() {
    return this.docConfig.layout === "minimal";
  }

  get isFontSans() {
    return this.docConfig.font === "sans";
  }

  get isFontSerif() {
    return this.docConfig.font === "serif";
  }

  get isA4() {
    return this.docConfig.pageSize === "A4";
  }

  get isLetter() {
    return this.docConfig.pageSize === "Letter";
  }

  get isLogoLeft() {
    return this.docConfig.logoPosition !== "right";
  }

  get isLogoRight() {
    return this.docConfig.logoPosition === "right";
  }

  get paperClass() {
    return `td-doc-paper ${
      this.docConfig.font === "serif" ? "font-serif" : ""
    } layout-${this.docConfig.layout}`;
  }

  get paperInlineStyle() {
    return `--rq-acc: ${this.docConfig.accent || "#0176d3"};`;
  }

  get headerFlexStyle() {
    return this.docConfig.logoPosition === "right"
      ? "flex-direction: row-reverse;"
      : "flex-direction: row;";
  }

  get accentTextStyle() {
    return `color: ${this.docConfig.accent || "#0176d3"};`;
  }

  get accentGrandTotalStyle() {
    return `color: ${this.docConfig.accent || "#0176d3"}; border-top-color: ${
      this.docConfig.accent || "#0176d3"
    };`;
  }

  get showWatermark() {
    return Boolean(this.docConfig.draftWatermark);
  }

  get watermarkText() {
    return "DRAFT";
  }

  get documentTitle() {
    if (this.sampleKind === "invoice") {
      return this.docConfig.invoiceTitle || "Tax Invoice";
    }
    if (this.sampleKind === "order") {
      return "Order Confirmation";
    }
    return this.docConfig.quoteTitle || "Quotation & Proposal";
  }

  get company() {
    const config = getConfig();
    return {
      name: config?.company?.name || "RevX Enterprise Inc.",
      address: config?.company?.address || "100 California Street, Suite 800",
      city: config?.company?.city || "San Francisco",
      state: config?.company?.state || "CA",
      postalCode: config?.company?.postalCode || "94111",
      registrationNumber: config?.company?.registrationNumber || "US-EIN-94-382910"
    };
  }

  // ---------------------------------------------------------------- Sample Data
  handleSampleKind(event) {
    this.sampleKind = event.target.value;
  }

  get isSampleQuote() {
    return this.sampleKind === "quote";
  }

  get isSampleOrder() {
    return this.sampleKind === "order";
  }

  get isSampleInvoice() {
    return this.sampleKind === "invoice";
  }

  handleCurrencyChange(event) {
    this.sampleCurrency = event.target.value;
  }

  get isCurrencyUSD() {
    return this.sampleCurrency === "USD";
  }

  get isCurrencyINR() {
    return this.sampleCurrency === "INR";
  }

  get isCurrencyEUR() {
    return this.sampleCurrency === "EUR";
  }

  get isCurrencyGBP() {
    return this.sampleCurrency === "GBP";
  }

  get currencySymbol() {
    switch (this.sampleCurrency) {
      case "INR":
        return "₹";
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      default:
        return "$";
    }
  }

  formatAmount(val) {
    const sym = this.currencySymbol;
    return `${sym}${Number(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  get sampleData() {
    const rate = this.sampleCurrency === "INR" ? 83 : 1;
    const baseP1 = 1200 * rate;
    const baseP2 = 450 * rate;
    const baseP3 = 800 * rate;

    const sym = this.currencySymbol;
    const sub = baseP1 * 10 + baseP2 * 5 + baseP3 * 2;
    const disc = sub * 0.15;
    const net = sub - disc;
    const tax = net * 0.18;
    const grand = net + tax;

    return {
      number:
        this.sampleKind === "invoice"
          ? "INV-2026-0814"
          : this.sampleKind === "order"
          ? "ORD-2026-0520"
          : "Q-2026-0941",
      date: "07 Oct 2026",
      dueDate: "06 Nov 2026",
      paymentTerms: "Net 30 Days",
      reference: "PO-ACME-4820",
      owner: "Darsh Desai",
      placeOfSupply: this.sampleCurrency === "INR" ? "Maharashtra (MH-27)" : "California (US-CA)",
      customerName: "Acme Global Technologies Ltd",
      contact: "Sarah Jenkins, VP Procurement",
      customerAddress: "450 Enterprise Parkway, Silicon District",
      customerTaxId: this.sampleCurrency === "INR" ? "27AABCA1234F1Z9" : "US-EIN-12-884920",
      lines: [
        {
          id: "1",
          no: 1,
          name: "RevX Enterprise Platform License",
          unit: "Per User / Year",
          qty: 10,
          price: this.formatAmount(baseP1),
          discount: "15%",
          total: this.formatAmount(baseP1 * 10 * 0.85)
        },
        {
          id: "2",
          no: 2,
          name: "Automated Dunning & Billing Engine",
          unit: "Instance / Month",
          qty: 5,
          price: this.formatAmount(baseP2),
          discount: "15%",
          total: this.formatAmount(baseP2 * 5 * 0.85)
        },
        {
          id: "3",
          no: 3,
          name: "Premier 24x7 Enterprise Support SLA",
          unit: "Annual Pack",
          qty: 2,
          price: this.formatAmount(baseP3),
          discount: "15%",
          total: this.formatAmount(baseP3 * 2 * 0.85)
        }
      ],
      subtotal: this.formatAmount(sub),
      discountTotal: this.formatAmount(disc),
      netTotal: this.formatAmount(net),
      taxBreakup: [
        {
          label: this.sampleCurrency === "INR" ? "CGST + SGST" : "Standard Tax",
          rate: "18.00%",
          amount: this.formatAmount(tax)
        }
      ],
      grandTotal: this.formatAmount(grand)
    };
  }

  // ---------------------------------------------------------------- PDF Export & Save
  buildCurrentDocumentModel() {
    const s = this.sampleData;
    const rate = this.sampleCurrency === "INR" ? 83 : 1;
    return {
      kind: this.sampleKind,
      number: s.number,
      version: 1,
      issuedOn: s.date,
      dueLabel: "Valid until / Due",
      dueOn: s.dueDate,
      status: "approved",
      isDraft: this.docConfig.draftWatermark,
      reference: s.reference,
      paymentTerms: s.paymentTerms,
      notes: "Generated via RevX Visual Document Designer Studio.",
      money: {
        currency: this.sampleCurrency,
        locale: this.sampleCurrency === "INR" ? "en-IN" : "en-US",
        registrationLabel: this.sampleCurrency === "INR" ? "GSTIN" : "Tax ID"
      },
      customer: {
        name: s.customerName,
        contact: s.contact,
        addressLines: [s.customerAddress],
        registrationNumber: s.customerTaxId,
        region: s.placeOfSupply
      },
      lines: [
        { name: "RevX Enterprise Platform License", unit: "Per User / Year", qty: 10, price: 1200 * rate, discount: 15, net: 10200 * rate },
        { name: "Automated Dunning & Billing Engine", unit: "Instance / Month", qty: 5, price: 450 * rate, discount: 15, net: 1912.5 * rate },
        { name: "Premier 24x7 Enterprise Support SLA", unit: "Annual Pack", qty: 2, price: 800 * rate, discount: 15, net: 1360 * rate }
      ],
      subtotal: 15850 * rate,
      discountTotal: 2377.5 * rate,
      net: 13472.5 * rate,
      tax: 2425.05 * rate,
      total: 15897.55 * rate,
      taxLines: [{ label: "GST / VAT", rate: 0.18, amount: 2425.05 * rate }],
      amountPaid: 0,
      balance: 15897.55 * rate
    };
  }

  async exportTestPdf() {
    this.exportingPdf = true;
    try {
      const doc = this.buildCurrentDocumentModel();
      const currentConf = getConfig();
      const mergedConf = {
        ...currentConf,
        pdf: {
          ...currentConf.pdf,
          ...this.docConfig
        }
      };
      const url = await createPdf(doc, mergedConf);
      window.open(url, "_blank");
      this.refs.toast?.show("PDF generated and opened in new window", "good");
    } catch (err) {
      this.refs.toast?.show(errorMessage(err) || "Failed to generate PDF", "bad");
    } finally {
      this.exportingPdf = false;
    }
  }

  resetDefaults() {
    this.sectionList = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
    this.syncFromGlobalConfig();
    this.refs.toast?.show("Reset designer settings to defaults", "accent");
  }

  async saveAndPublish() {
    this.saving = true;
    try {
      const currentConf = getConfig();
      const updatedConfig = {
        ...currentConf,
        brand: {
          ...currentConf.brand,
          accent: this.docConfig.accent || currentConf.brand?.accent
        },
        pdf: {
          ...currentConf.pdf,
          ...this.docConfig
        }
      };
      await publishConfig(updatedConfig, "Updated via RevX Visual Template Designer Studio");
      this.refs.toast?.show("Document template published & set as active theme!", "good");
    } catch (err) {
      this.refs.toast?.show(errorMessage(err) || "Failed to save configuration", "bad");
    } finally {
      this.saving = false;
    }
  }
}