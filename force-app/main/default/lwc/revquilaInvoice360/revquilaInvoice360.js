import { LightningElement, wire } from "lwc";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import { getConfig } from "c/revquilaConfig";
import {
  INVOICES_PAGE,
  orderPage,
  quotePage,
  subscriptionPage
} from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  PAYMENT_METHODS,
  errorMessage,
  formatDate,
  getInvoice,
  getInvoiceDocument,
  getInvoiceRelated,
  getInvoiceTimeline,
  issueCreditNote,
  createPaymentLink,
  emailInvoice,
  generateEInvoice,
  loadInvoice,
  logInvoiceReminders,
  logPromiseToPay,
  markInvoiceSent,
  onDataChange,
  recordPayment,
  refundInvoice,
  saveInvoice,
  writeOffInvoice
} from "c/revquilaData";
import { buildPrintModel } from "c/revquilaDocuments";
import saveSnapshot from "@salesforce/apex/RevquilaDocumentController.saveSnapshot";
import generateUpiPayload from "@salesforce/apex/RevquilaIndiaPaymentsController.generateUpiPayload";
import simulateUpiInstantSettlement from "@salesforce/apex/RevquilaIndiaPaymentsController.simulateUpiInstantSettlement";
import { formatMoney } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const DAY = 24 * 60 * 60 * 1000;

// Each action's modal. `fields` lists the inputs it shows.
const MODALS = {
  payment: {
    heading: "Record a payment",
    confirmLabel: "Record payment",
    fields: ["amount", "method", "reference", "date"]
  },
  credit: {
    heading: "Issue a credit note",
    confirmLabel: "Issue credit note",
    fields: ["amount", "reason"]
  },
  refund: {
    heading: "Issue a refund",
    confirmLabel: "Issue refund",
    fields: ["amount", "reason"]
  },
  writeOff: {
    heading: "Write off remaining balance?",
    confirmLabel: "Write off",
    fields: ["reason"]
  },
  promise: {
    heading: "Log a promise to pay",
    confirmLabel: "Save promise",
    fields: ["date", "note"]
  },
  reminder: {
    heading: "Log a payment reminder?",
    confirmLabel: "Log reminder",
    fields: []
  },
  send: {
    heading: "Mark this invoice as sent?",
    confirmLabel: "Mark as sent",
    fields: []
  },
  email: {
    heading: "Email invoice to customer",
    confirmLabel: "Send email",
    fields: ["toAddress"]
  }
};

// yyyy-mm-dd in local time, for a date input
function inputDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Invoice 360: Revquila's own record view of one invoice.
 * Opened by URL with the invoice's id in c__invoice.
 */
export default class RevquilaInvoice360 extends NavigationMixin(
  LightningElement
) {
  invoice;
  loading = true;
  // { kind, heading, confirmLabel, fields } while an action's modal is open
  modal;
  form = {};
  errors = {};
  busy = false;
  previewing = false;
  generatingLink = false;
  generatingEInvoice = false;
  isEditing = false;
  editBusy = false;
  editForm = {};
  showUpiModal = false;
  upiQrUrl = '';
  upiAmount = 0;
  upiUri = '';
  settlingUpi = false;

  _invoiceId;
  _unsubscribe;
  _releasePage;
  _trigger;

  @wire(CurrentPageReference)
  setPageReference(pageReference) {
    const invoiceId = pageReference?.state?.c__invoice;
    if (invoiceId === this._invoiceId) {
      // back on a page Lightning kept: read the record again if it is no longer held
      if (invoiceId && !this.loading && !getInvoice(invoiceId)) {
        this.open();
      }
      return;
    }
    this._invoiceId = invoiceId;
    this.invoice = undefined;
    this.open();
  }

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this._unsubscribe = onDataChange(() => this.show());
  }

  disconnectedCallback() {
    this._releasePage();
    this._unsubscribe();
  }

  open() {
    if (!this._invoiceId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    loadInvoice(this._invoiceId)
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        this.show();
      });
  }

  show() {
    // a record that is no longer held stays as it was last shown
    this.invoice = getInvoice(this._invoiceId) || this.invoice;
  }

  get missing() {
    return !this.loading && !this.invoice;
  }

  get recordId() {
    return this.invoice ? this.invoice.id : this._invoiceId || null;
  }

  get isDraft() {
    return this.invoice.status === "draft";
  }

  // formatMoney options: the invoice's own currency and number format
  get money() {
    return { tax: this.invoice.money };
  }

  get isOpen() {
    return this.invoice.balance > 0 && !this.isDraft;
  }

  get canRefund() {
    return (this.invoice?.paid || 0) > 0;
  }

  get canWriteOff() {
    return (this.invoice?.balance || 0) > 0 && !this.isDraft;
  }

  get payLinkBtnLabel() {
    return this.invoice?.paymentLink ? "Copy pay link" : "Payment link";
  }

  get payStatusLabel() {
    return this.invoice?.paymentLink ? "Checkout Link Active" : "No Link Active";
  }

  get payStatusClass() {
    return this.invoice?.paymentLink
      ? "rq-pill rq-tone-good"
      : "rq-pill rq-tone-mut";
  }

  get hasPaymentPlan() {
    return Boolean(this.invoice?.hasPaymentPlan);
  }

  get paymentStatusLabel() {
    return this.invoice?.paymentStatus || "Unpaid";
  }

  get origin() {
    const { quoteNumber, subscriptionNumber } = this.invoice;
    if (quoteNumber) {
      return `Raised from quote ${quoteNumber}`;
    }
    return subscriptionNumber
      ? `Billing for subscription ${subscriptionNumber}`
      : "One-off invoice";
  }

  get facts() {
    const { total, paid, credited, balance, dueLabel, daysOverdue } =
      this.invoice;
    return [
      {
        label: "Invoice total",
        value: formatMoney(total, this.money)
      },
      {
        label: "Paid",
        value: formatMoney(paid, this.money),
        tone: "good"
      },
      credited && {
        label: "Credited",
        value: formatMoney(credited, this.money),
        tone: "teal"
      },
      {
        label: "Balance due",
        value: formatMoney(balance, this.money),
        tone: balance ? "bad" : "good"
      },
      {
        label: daysOverdue
          ? `Due · ${countOf(daysOverdue, "day")} late`
          : "Due",
        value: dueLabel
      }
    ]
      .filter(Boolean)
      .map((fact) => ({
        ...fact,
        factClass: fact.tone ? `rq-fact rq-tone-${fact.tone}` : "rq-fact"
      }));
  }

  get settledStyle() {
    return `--rq-p:${this.invoice.paidShare}`;
  }

  get settledLabel() {
    const share = Math.round(this.invoice.paidShare * 100);
    return this.invoice.balance
      ? `${share}% settled · ${this.invoice.balanceLabel} to collect`
      : "Settled in full";
  }

  // ---------------------------------------------------------------- body

  get lineRows() {
    return this.invoice.lines.map((line) => ({
      key: line.key,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      price: formatMoney(line.price, this.money),
      discount: line.discountLabel,
      net: formatMoney(line.net, this.money)
    }));
  }

  get totals() {
    const {
      subtotal,
      discountTotal,
      net,
      taxLines,
      total,
      paid,
      credited,
      balance
    } = this.invoice;
    const rows = [
      {
        label: "Subtotal",
        value: formatMoney(subtotal, this.money)
      }
    ];
    if (discountTotal) {
      rows.push({
        label: "Discount",
        value: `− ${formatMoney(discountTotal, this.money)}`
      });
    }
    if (taxLines.length) {
      rows.push({
        label: "Taxable value",
        value: formatMoney(net, this.money)
      });
      taxLines.forEach((line) =>
        rows.push({
          label: line.label,
          value: formatMoney(line.amount, this.money)
        })
      );
    }
    rows.push({
      label: "Invoice total",
      value: formatMoney(total, this.money)
    });
    if (paid) {
      rows.push({
        label: "Paid",
        value: `− ${formatMoney(paid, this.money)}`
      });
    }
    if (credited) {
      rows.push({
        label: "Credit notes",
        value: `− ${formatMoney(credited, this.money)}`
      });
    }
    rows.push({
      label: "Balance due",
      value: formatMoney(balance, this.money),
      grand: true
    });
    return rows.map((row) => ({
      ...row,
      rowClass: row.grand ? "rq-row rq-grand" : "rq-row"
    }));
  }

  // Payments and credit notes together, newest first
  get receipts() {
    const payments = this.invoice.payments.map((payment) => ({
      id: payment.id,
      at: payment.date,
      title: payment.amountLabel,
      detail: [
        payment.number,
        payment.method,
        payment.reference,
        payment.dateLabel
      ]
        .filter(Boolean)
        .join(" · "),
      pill: "Payment",
      pillClass: "rq-pill rq-tone-good"
    }));
    const credits = this.invoice.credits.map((credit) => ({
      id: credit.id,
      at: credit.date,
      title: formatMoney(credit.amount, this.money),
      detail: `${credit.number} · ${credit.reason} · ${formatDate(credit.date)}`,
      pill: "Credit note",
      pillClass: "rq-pill rq-tone-teal"
    }));
    return payments.concat(credits).sort((a, b) => b.at - a.at);
  }

  get hasReceipts() {
    return this.receipts.length > 0;
  }

  get timeline() {
    return getInvoiceTimeline(this.invoice);
  }

  // The reminders Setup > Billing plans after the due date, and where each one stands
  get plan() {
    const { reminderDays } = getConfig().billing;
    const { due, reminders } = this.invoice;
    const settled = this.invoice.balance === 0;
    return reminderDays.map((days, index) => {
      const on = new Date(due.getTime() + days * DAY);
      // the pill says where the reminder stands; its date goes in the line beside it
      let state = { text: "Planned", tone: "mut", note: formatDate(on) };
      if (index < reminders.length) {
        state = {
          text: "Logged",
          tone: "good",
          note: `logged ${formatDate(reminders[index])}`
        };
      } else if (settled) {
        state = { text: "Not needed", tone: "mut" };
      } else if (this.isDraft) {
        state = {
          text: "Not started",
          tone: "mut",
          note: "once the invoice is sent"
        };
      } else if (on <= new Date()) {
        state = { text: "Due now", tone: "warn", note: formatDate(on) };
      }
      const after = `${countOf(days, "day")} after the due date`;
      return {
        key: `reminder-${index}`,
        name: `Reminder ${index + 1}`,
        when: state.note ? `${after} · ${state.note}` : after,
        text: state.text,
        pillClass: `rq-pill rq-tone-${state.tone}`
      };
    });
  }

  // Late fee so far: the monthly rate from Setup > Billing on the overdue balance
  get lateFee() {
    const { lateFeePercent } = getConfig().billing;
    const { daysOverdue, balance } = this.invoice;
    if (!lateFeePercent || !daysOverdue) {
      return undefined;
    }
    const fee = (balance * lateFeePercent * daysOverdue) / 100 / 30;
    return `${formatMoney(fee, this.money)} late fee so far, at ${lateFeePercent}% a month. It is shown here only: add it to the next invoice yourself.`;
  }

  get lastPromise() {
    const { promises } = this.invoice;
    if (!promises.length) {
      return undefined;
    }
    const { date, note } = promises[promises.length - 1];
    return `Promised by ${formatDate(date)}${note ? `: ${note}` : ""}`;
  }

  get customer() {
    const { account, contact, city, state, registration, terms } = this.invoice;
    return [
      { label: "Account", value: account },
      { label: "Contact", value: contact || "Not set" },
      {
        label: "Location",
        value: [city, state].filter(Boolean).join(", ") || "Not set"
      },
      registration && {
        label: this.invoice.money.registrationLabel,
        value: registration
      },
      { label: "Currency", value: this.invoice.currency },
      { label: "Payment terms", value: terms }
    ].filter(Boolean);
  }

  get related() {
    return getInvoiceRelated(this.invoice).map((record) => ({
      ...record,
      itemClass: record.exists ? "rq-item" : "rq-item rq-off"
    }));
  }

  get document() {
    return getInvoiceDocument(this.invoice);
  }

  // ---------------------------------------------------------------- action modals

  get shown() {
    const shown = {};
    this.modal.fields.forEach((field) => {
      shown[field] = true;
    });
    return shown;
  }

  get modalBody() {
    const { balanceLabel, number } = this.invoice;
    switch (this.modal.kind) {
      case "payment":
        return `${balanceLabel} is outstanding. A part payment keeps the invoice open for the rest.`;
      case "credit":
        return "A credit note reduces what the customer owes without a payment, for a return, a goodwill gesture or a billing mistake.";
      case "refund":
        return `Refunds recorded payment up to ${formatMoney(this.invoice.paid, this.money)}. An automatic credit note reconciles the billing balance.`;
      case "writeOff":
        return `Writes off the remaining balance of ${balanceLabel}. This marks the invoice as written off and records a credit note.`;
      case "promise":
        return "Note the date the customer said they will pay. It shows on the timeline and in the collection plan.";
      case "reminder":
        return `Notes that you reminded the customer today that ${balanceLabel} is due on ${number}. RevX does not email the customer yet: send the reminder yourself.`;
      case "email":
        return `Send invoice ${number} directly to the customer inbox with payment link and attached PDF.`;
      default:
        return `Marks ${number} as sent today. RevX does not email the customer yet: download the PDF and send it yourself.`;
    }
  }

  get methodOptions() {
    return PAYMENT_METHODS.map((name) => ({
      name,
      selected: name === this.form.method
    }));
  }

  get fieldClasses() {
    const classes = {};
    ["amount", "date", "reason", "toAddress"].forEach((field) => {
      classes[field] = this.errors[field] ? "rq-field rq-invalid" : "rq-field";
    });
    return classes;
  }

  get maxDate() {
    return this.modal.kind === "payment" ? inputDate(new Date()) : undefined;
  }

  openModal(event) {
    const { kind } = event.currentTarget.dataset;
    this._trigger = event.currentTarget;
    this.errors = {};
    this.form = {
      amount: kind === "payment" ? String(this.invoice.balance) : "",
      method: PAYMENT_METHODS[0],
      reference: "",
      date: kind === "payment" ? inputDate(new Date()) : "",
      reason: "",
      note: "",
      toAddress: kind === "email" ? (this.invoice.contactEmail || "") : ""
    };
    this.modal = { kind, ...MODALS[kind] };
  }

  handleField(event) {
    this.form = {
      ...this.form,
      [event.target.dataset.field]: event.target.value
    };
  }

  fillBalance() {
    this.form = { ...this.form, amount: String(this.invoice.balance) };
  }

  fillHalf() {
    this.form = {
      ...this.form,
      amount: String(Math.round(this.invoice.balance / 2))
    };
  }

  validate() {
    const { fields } = this.modal;
    const { amount, date, reason } = this.form;
    const errors = {};
    if (fields.includes("amount")) {
      const value = Number(amount);
      const isRefund = this.modal.kind === "refund";
      const maxAllowed = isRefund
        ? Math.max(0, (this.invoice.paid || 0) - (this.invoice.refunded || 0))
        : this.invoice.balance;
      const maxLabel = isRefund
        ? formatMoney(maxAllowed, this.money)
        : this.invoice.balanceLabel;
      if (!(value > 0)) {
        errors.amount = "Enter an amount above zero.";
      } else if (value > maxAllowed) {
        errors.amount = `No more than the ${maxLabel} available.`;
      }
    }
    if (fields.includes("date") && !date) {
      errors.date = "Pick a date.";
    }
    if (fields.includes("reason") && !reason.trim()) {
      errors.reason = "Say why, for the audit trail.";
    }
    if (fields.includes("toAddress")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!this.form.toAddress || !emailRegex.test(this.form.toAddress.trim())) {
        errors.toAddress = "Enter a valid recipient email address (e.g. name@company.com).";
      }
    }
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  // The write for the modal that is open, and what to say once it is done
  async work() {
    const { id } = this.invoice;
    const { amount, method, reference, date, reason, note, toAddress } = this.form;
    switch (this.modal.kind) {
      case "payment":
        return recordPayment(id, {
          amount: Number(amount),
          method,
          reference: reference.trim(),
          date
        }).then(() => {
          return this.invoice.balance
            ? `Payment recorded. ${this.invoice.balanceLabel} still due.`
            : "Paid in full";
        });
      case "credit":
        return issueCreditNote(id, {
          amount: Number(amount),
          reason: reason.trim()
        }).then(() => "Credit note issued");
      case "refund":
        return refundInvoice({
          invoiceId: id,
          paymentId: null,
          amount: Number(amount),
          reason: reason.trim(),
          withCredit: true
        }).then(() => "Refund recorded & credit note issued");
      case "writeOff":
        return writeOffInvoice({
          invoiceId: id,
          reason: reason.trim()
        }).then(() => "Invoice balance written off");
      case "promise":
        return logPromiseToPay(id, { date, note: note.trim() }).then(
          () => "Promise to pay saved"
        );
      case "reminder":
        return logInvoiceReminders([id]).then(() => "Reminder logged");
      case "email": {
        const to = (toAddress || "").trim();
        let snapshotId = null;
        try {
          const doc = getInvoiceDocument(this.invoice);
          if (doc) {
            snapshotId = await saveSnapshot({
              payload: JSON.stringify(buildPrintModel(doc, getConfig()))
            });
          }
        } catch (e) {
          // If snapshot generation fails, email still delivers body and checkout link
        }
        return emailInvoice(id, to, snapshotId).then(
          () => `Invoice emailed to ${to}`
        );
      }
      default:
        return markInvoiceSent(id).then(() => "Marked as sent");
    }
  }

  confirmModal() {
    if (this.busy || !this.validate()) {
      return;
    }
    this.busy = true;
    this.work()
      .then((toast) => {
        this.refs.toast.show(toast, "success");
        this.refs.actionModal.close();
      })
      .catch((error) => this.refs.toast.show(errorMessage(error), "error"))
      .finally(() => {
        this.busy = false;
      });
  }

  cancelModal() {
    this.refs.actionModal.close();
  }

  closeModal() {
    this.modal = undefined;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  openPreview(event) {
    this._trigger = event.currentTarget;
    this.previewing = true;
  }

  closePreview() {
    this.previewing = false;
    this._trigger.focus();
  }

  async copyPaymentLink() {
    if (!this.invoice?.paymentLink) return;
    try {
      await navigator.clipboard.writeText(this.invoice.paymentLink);
      this.refs.toast.show("Payment checkout link copied to clipboard", "good");
    } catch (e) {
      this.refs.toast.show(this.invoice.paymentLink, "good");
    }
  }

  async generatePaymentLink() {
    if (!this.invoice?.id) return;
    this.generatingLink = true;
    try {
      await createPaymentLink(this.invoice.id);
      this.refs.toast.show("Payment link created successfully", "good");
      await loadInvoice(this._invoiceId);
      this.show();
    } catch (err) {
      this.refs.toast.show(errorMessage(err) || "Failed to generate payment link", "bad");
    } finally {
      this.generatingLink = false;
    }
  }

  async handlePaymentLinkAction() {
    if (this.invoice?.paymentLink) {
      await this.copyPaymentLink();
    } else {
      await this.generatePaymentLink();
    }
  }

  async handleOpenUpiModal() {
    const invId = this.recordId;
    if (!invId) return;
    try {
      const data = await generateUpiPayload({ invoiceId: invId });
      if (data && data.success) {
        this.upiQrUrl = data.qrUrl;
        this.upiAmount = data.amount;
        this.upiUri = data.upiUri;
        this.showUpiModal = true;
      } else {
        this.refs.toast.show(data?.message || 'Could not generate UPI payload', 'bad');
      }
    } catch (e) {
      this.refs.toast.show(errorMessage(e), 'bad');
    }
  }

  handleCloseUpiModal() {
    this.showUpiModal = false;
  }

  async handleCopyUpiUri() {
    if (!this.upiUri) return;
    try {
      await navigator.clipboard.writeText(this.upiUri);
      this.refs.toast.show('UPI link copied to clipboard', 'good');
    } catch (e) {
      this.refs.toast.show(this.upiUri, 'good');
    }
  }

  async handleSimulateUpiPayment() {
    const invId = this.recordId;
    if (!invId) return;
    this.settlingUpi = true;
    try {
      const res = await simulateUpiInstantSettlement({ invoiceId: invId, utrRef: null });
      if (res && res.success) {
        this.refs.toast.show('UPI payment successfully verified and recorded!', 'good');
        this.showUpiModal = false;
        await loadInvoice(this._invoiceId);
        this.show();
      } else {
        this.refs.toast.show(res?.message || 'Failed settlement', 'bad');
      }
    } catch (err) {
      this.refs.toast.show(errorMessage(err), 'bad');
    } finally {
      this.settlingUpi = false;
    }
  }

  get hasEInvoice() {
    return Boolean(this.invoice?.eInvoiceIrn);
  }

  async generateEInvoice() {
    if (!this.invoice?.id) return;
    this.generatingEInvoice = true;
    try {
      await generateEInvoice(this.invoice.id);
      this.refs.toast.show("GST e-Invoice IRN generated and registered successfully", "good");
      await loadInvoice(this._invoiceId);
      this.show();
    } catch (err) {
      this.refs.toast.show(errorMessage(err) || "Failed to generate e-invoice", "bad");
    } finally {
      this.generatingEInvoice = false;
    }
  }

  openEdit() {
    this.editForm = {
      dueOn: this.invoice.due ? inputDate(this.invoice.due) : "",
      terms: this.invoice.terms || "",
      reference: this.invoice.opportunity || "",
      notes: this.invoice.notes || ""
    };
    this.isEditing = true;
  }

  cancelEdit() {
    this.isEditing = false;
  }

  handleEditInput(event) {
    const { field } = event.target.dataset;
    this.editForm = {
      ...this.editForm,
      [field]: event.target.value
    };
  }

  async saveEditInvoice() {
    this.editBusy = true;
    try {
      await saveInvoice(this.invoice.id, {
        dueOn: this.editForm.dueOn || null,
        terms: this.editForm.terms || null,
        reference: this.editForm.reference || null,
        notes: this.editForm.notes || null
      });
      this.isEditing = false;
      this.refs.toast.show("Invoice updated", "accent");
    } catch (err) {
      this.refs.toast.show(errorMessage(err), "bad");
    } finally {
      this.editBusy = false;
    }
  }

  // ---------------------------------------------------------------- navigation

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  openRelated(event) {
    const { quote, subscription, order } = event.currentTarget.dataset;
    let page;
    if (quote) {
      page = quotePage(quote);
    } else if (order) {
      page = orderPage(order);
    } else {
      page = subscriptionPage(subscription);
    }
    this[NavigationMixin.Navigate](page);
  }

  goToInvoices() {
    this[NavigationMixin.Navigate](INVOICES_PAGE);
  }
}