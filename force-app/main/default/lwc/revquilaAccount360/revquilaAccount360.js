import { LightningElement, api, wire, track } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { refreshApex } from "@salesforce/apex";
import { quotePage, invoicePage, subscriptionPage } from "c/revquilaNav";
import getAccountSummary from "@salesforce/apex/RevquilaAccount360Controller.getAccountSummary";
import generatePaymentLink from "@salesforce/apex/RevquilaAccount360Controller.generatePaymentLink";
import issueCreditNote from "@salesforce/apex/RevquilaAccount360Controller.issueCreditNote";
import resendInvoice from "@salesforce/apex/RevquilaAccount360Controller.resendInvoice";

export default class RevquilaAccount360 extends NavigationMixin(LightningElement) {
  @api recordId;

  loading = true;
  activeTab = "subscriptions";
  wiredSummaryResult;
  data;

  // Credit Note Modal State
  showCreditModal = false;
  selectedInvoiceId;
  selectedInvoiceNum;
  selectedInvoiceBalance = 0;
  creditAmount = "";
  creditReason = "";

  @wire(getAccountSummary, { recordId: "$recordId" })
  wiredSummary(result) {
    this.wiredSummaryResult = result;
    const { data, error } = result;
    this.loading = false;
    if (data) {
      this.data = {
        ...data,
        invoices: (data.invoices || []).map((inv) => ({
          ...inv,
          hasBalance: inv.balance > 0,
          balanceClass: inv.balance > 0 ? "rq-td-balance-bad" : "rq-td-balance-zero",
          statusPillClass: `rq-badge rq-badge-${inv.statusTone || "mut"}`
        }))
      };
    } else if (error) {
      this.data = null;
    }
  }

  get noData() {
    return !this.loading && !this.data;
  }

  get displayTerms() {
    return this.data?.paymentTerms || "Standard";
  }

  get churnLabel() {
    return `Churn Risk: ${this.data?.churnRisk || "Low"}`;
  }

  get churnBadgeClass() {
    const tone = this.data?.churnRiskTone || "good";
    return `rq-badge rq-badge-${tone}`;
  }

  get overdueKpiClass() {
    return this.data?.overdueBalance > 0
      ? "rq-kpi-card rq-kpi-overdue"
      : "rq-kpi-card";
  }

  get formattedLtv() {
    return `$${Number(this.data?.ltv || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  get formattedArr() {
    return `$${Number(this.data?.arr || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  get formattedMrr() {
    return `$${Number(this.data?.mrr || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  get formattedOutstanding() {
    return `$${Number(this.data?.outstandingBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  get formattedOverdue() {
    return `$${Number(this.data?.overdueBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  get subscriptionsCount() {
    return this.data?.subscriptions?.length || 0;
  }

  get invoicesCount() {
    return this.data?.invoices?.length || 0;
  }

  get quotesCount() {
    return this.data?.quotes?.length || 0;
  }

  get isTabSubscriptions() {
    return this.activeTab === "subscriptions";
  }

  get isTabInvoices() {
    return this.activeTab === "invoices";
  }

  get isTabQuotes() {
    return this.activeTab === "quotes";
  }

  get subscriptionsTabClass() {
    return this.activeTab === "subscriptions" ? "rq-tab rq-tab-active" : "rq-tab";
  }

  get invoicesTabClass() {
    return this.activeTab === "invoices" ? "rq-tab rq-tab-active" : "rq-tab";
  }

  get quotesTabClass() {
    return this.activeTab === "quotes" ? "rq-tab rq-tab-active" : "rq-tab";
  }

  get hasSubscriptions() {
    return (this.data?.subscriptions?.length || 0) > 0;
  }

  get hasInvoices() {
    return (this.data?.invoices?.length || 0) > 0;
  }

  get hasQuotes() {
    return (this.data?.quotes?.length || 0) > 0;
  }

  selectSubscriptions() {
    this.activeTab = "subscriptions";
  }

  selectInvoices() {
    this.activeTab = "invoices";
  }

  selectQuotes() {
    this.activeTab = "quotes";
  }

  // Navigation handlers to redirect to records
  handleSubscriptionClick(event) {
    const id = event.currentTarget.dataset.id;
    if (id) {
      this[NavigationMixin.Navigate](subscriptionPage(id));
    }
  }

  handleInvoiceClick(event) {
    const id = event.currentTarget.dataset.id;
    if (id) {
      this[NavigationMixin.Navigate](invoicePage(id));
    }
  }

  handleQuoteClick(event) {
    const id = event.currentTarget.dataset.id;
    if (id) {
      this[NavigationMixin.Navigate](quotePage(id));
    }
  }

  handleAccountClick() {
    const accountId = this.data?.accountId || this.recordId;
    if (accountId) {
      this[NavigationMixin.Navigate]({
        type: "standard__recordPage",
        attributes: {
          recordId: accountId,
          actionName: "view"
        }
      });
    }
  }

  handleActionClick(event) {
    event.stopPropagation();
  }

  // Action: Generate or retrieve payment link
  async handleGeneratePaymentLink(event) {
    const invoiceId = event.currentTarget.dataset.id;
    try {
      const url = await generatePaymentLink({ invoiceId });
      if (url && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        this.refs.toast?.show("Payment link generated and copied to clipboard!", "success");
      } else {
        this.refs.toast?.show(`Payment link ready: ${url}`, "success");
      }
      refreshApex(this.wiredSummaryResult);
    } catch (err) {
      const msg = err.body?.message || err.message || "Unable to generate payment link.";
      this.refs.toast?.show(msg, "error");
    }
  }

  // Action: Resend invoice
  async handleResendInvoice(event) {
    const invoiceId = event.currentTarget.dataset.id;
    try {
      await resendInvoice({ invoiceId, recipientEmail: null });
      this.refs.toast?.show("Invoice sent to customer billing email successfully.", "success");
    } catch (err) {
      const msg = err.body?.message || err.message || "Unable to resend invoice.";
      this.refs.toast?.show(msg, "error");
    }
  }

  // Credit Note Modal Handlers
  openCreditNoteModal(event) {
    this.selectedInvoiceId = event.currentTarget.dataset.id;
    this.selectedInvoiceNum = event.currentTarget.dataset.num;
    this.selectedInvoiceBalance = Number(event.currentTarget.dataset.bal) || 0;
    this.creditAmount = "";
    this.creditReason = "";
    this.showCreditModal = true;
  }

  closeCreditModal() {
    this.showCreditModal = false;
  }

  get creditModalSubheading() {
    return `Invoice ${this.selectedInvoiceNum} · Current Balance $${this.selectedInvoiceBalance}`;
  }

  handleCreditAmountChange(event) {
    this.creditAmount = event.target.value;
  }

  handleCreditReasonChange(event) {
    this.creditReason = event.target.value;
  }

  get isCreditSubmitDisabled() {
    const amt = parseFloat(this.creditAmount);
    return isNaN(amt) || amt <= 0 || amt > this.selectedInvoiceBalance || !this.creditReason.trim();
  }

  async submitCreditNote() {
    const amount = parseFloat(this.creditAmount);
    if (!amount || amount <= 0 || !this.creditReason.trim()) return;

    try {
      await issueCreditNote({
        invoiceId: this.selectedInvoiceId,
        amount,
        reason: this.creditReason.trim()
      });
      this.showCreditModal = false;
      this.refs.toast?.show(`Credit note of $${amount} issued successfully.`, "success");
      refreshApex(this.wiredSummaryResult);
    } catch (err) {
      const msg = err.body?.message || err.message || "Failed to issue credit note.";
      this.refs.toast?.show(msg, "error");
    }
  }
}