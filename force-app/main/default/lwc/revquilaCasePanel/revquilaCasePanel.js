import { LightningElement, api, wire, track } from "lwc";
import { refreshApex } from "@salesforce/apex";
import getAccountSummary from "@salesforce/apex/RevquilaAccount360Controller.getAccountSummary";
import generatePaymentLink from "@salesforce/apex/RevquilaAccount360Controller.generatePaymentLink";
import issueCreditNote from "@salesforce/apex/RevquilaAccount360Controller.issueCreditNote";
import resendInvoice from "@salesforce/apex/RevquilaAccount360Controller.resendInvoice";
import requestRefund from "@salesforce/apex/RevquilaAccount360Controller.requestRefund";

export default class RevquilaCasePanel extends LightningElement {
  @api recordId;

  loading = true;
  wiredSummaryResult;
  data;

  // Credit Note Modal State
  showCreditModal = false;
  selectedInvoiceId;
  selectedInvoiceNum;
  selectedInvoiceBalance = 0;
  creditAmount = "";
  creditReason = "";

  // Refund Modal State
  showRefundModal = false;
  refundAmount = "";
  refundReason = "";

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
          balanceClass: inv.balance > 0 ? "rq-due-bad" : "rq-due-zero",
          statusPillClass: `rq-pill rq-tone-${inv.statusTone || "mut"}`
        }))
      };
    } else if (error) {
      this.data = null;
    }
  }

  get noData() {
    return !this.loading && !this.data;
  }

  get hasData() {
    return !this.loading && !!this.data;
  }

  get accountName() {
    return this.data?.accountName || "Account Context";
  }

  get entitlementTier() {
    return this.data?.entitlementTier || "";
  }

  get formattedOutstanding() {
    return `$${Number(this.data?.outstandingBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  }

  get formattedOverdue() {
    return `$${Number(this.data?.overdueBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  }

  get formattedMrr() {
    return `$${Number(this.data?.mrr || 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}/mo`;
  }

  get outstandingClass() {
    return this.data?.outstandingBalance > 0 ? "rq-val rq-bad" : "rq-val";
  }

  get overdueClass() {
    return this.data?.overdueBalance > 0 ? "rq-val rq-bad" : "rq-val";
  }

  get subscriptions() {
    return this.data?.subscriptions || [];
  }

  get subscriptionsCount() {
    return this.subscriptions.length;
  }

  get hasSubscriptions() {
    return this.subscriptions.length > 0;
  }

  get invoices() {
    return this.data?.invoices || [];
  }

  get invoicesCount() {
    return this.invoices.length;
  }

  get hasInvoices() {
    return this.invoices.length > 0;
  }

  // --- Actions ---

  handlePaymentLink(event) {
    const invoiceId = event.currentTarget.dataset.id;
    if (!invoiceId) return;

    generatePaymentLink({ invoiceId })
      .then((link) => {
        if (link) {
          navigator.clipboard.writeText(link);
          this.toast("Payment Link Copied", "Stripe / Razorpay link copied to clipboard.", "success");
        } else {
          this.toast("Link Notice", "Payment link is available on the invoice record.", "info");
        }
      })
      .catch((err) => {
        this.toast("Error", err?.body?.message || err?.message, "error");
      });
  }

  handleResendInvoice(event) {
    const invoiceId = event.currentTarget.dataset.id;
    if (!invoiceId) return;

    resendInvoice({ invoiceId, recipientEmail: null })
      .then(() => {
        this.toast("Invoice Dispatched", "Invoice email dispatched to customer successfully.", "success");
      })
      .catch((err) => {
        this.toast("Error", err?.body?.message || err?.message, "error");
      });
  }

  openCreditModal(event) {
    this.selectedInvoiceId = event.currentTarget.dataset.id;
    this.selectedInvoiceNum = event.currentTarget.dataset.num;
    this.selectedInvoiceBalance = Number(event.currentTarget.dataset.balance || 0);
    this.creditAmount = this.selectedInvoiceBalance > 0 ? String(this.selectedInvoiceBalance) : "";
    this.creditReason = "Support resolution credit";
    this.showCreditModal = true;
  }

  closeCreditModal() {
    this.showCreditModal = false;
  }

  handleCreditAmountChange(e) {
    this.creditAmount = e.target.value;
  }

  handleCreditReasonChange(e) {
    this.creditReason = e.target.value;
  }

  submitCreditNote() {
    const amt = parseFloat(this.creditAmount);
    if (!amt || amt <= 0) {
      this.toast("Invalid Amount", "Please enter a positive credit amount.", "error");
      return;
    }

    issueCreditNote({
      invoiceId: this.selectedInvoiceId,
      amount: amt,
      reason: this.creditReason || "Service resolution credit"
    })
      .then(() => {
        this.toast("Credit Note Issued", "Credit note created successfully.", "success");
        this.closeCreditModal();
        return refreshApex(this.wiredSummaryResult);
      })
      .catch((err) => {
        this.toast("Credit Note Error", err?.body?.message || err?.message, "error");
      });
  }

  openRefundModal(event) {
    this.selectedInvoiceId = event.currentTarget.dataset.id;
    this.selectedInvoiceNum = event.currentTarget.dataset.num;
    this.refundAmount = "";
    this.refundReason = "Customer support refund request";
    this.showRefundModal = true;
  }

  closeRefundModal() {
    this.showRefundModal = false;
  }

  handleRefundAmountChange(e) {
    this.refundAmount = e.target.value;
  }

  handleRefundReasonChange(e) {
    this.refundReason = e.target.value;
  }

  submitRefund() {
    const amt = parseFloat(this.refundAmount);
    if (!amt || amt <= 0) {
      this.toast("Invalid Amount", "Please enter a positive refund amount.", "error");
      return;
    }

    requestRefund({
      invoiceId: this.selectedInvoiceId,
      amount: amt,
      reason: this.refundReason || "Customer refund request"
    })
      .then(() => {
        this.toast("Refund Submitted", "Refund request processed / submitted to approval flow.", "success");
        this.closeRefundModal();
        return refreshApex(this.wiredSummaryResult);
      })
      .catch((err) => {
        this.toast("Refund Error", err?.body?.message || err?.message, "error");
      });
  }

  toast(title, message, variant = "info") {
    const toast = this.template.querySelector("c-revquila-toast");
    if (toast) {
      toast.show({ title, message, variant });
    }
  }
}
