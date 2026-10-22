import { LightningElement, wire } from "lwc";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import { getConfig } from "c/revquilaConfig";
import {
  QUOTES_PAGE,
  TEMPLATES_PAGE,
  invoicePage,
  quotePage,
  subscriptionPage
} from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  CUSTOM_PRODUCT,
  MILESTONES,
  actOnQuote,
  canApprove,
  cloneQuote,
  errorMessage,
  getQuote,
  getQuoteDocument,
  getRelated,
  getTimeline,
  loadCanApprove,
  loadProducts,
  loadQuote,
  onDataChange,
  priceLines,
  saveQuote,
  syncOpportunityLines
} from "c/revquilaData";
import { formatMoney } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const SEND = {
  label: "Mark as sent",
  heading: "Mark this quote as sent?",
  body: "Locks this version, so what the customer has is what stays on file. RevX does not email the customer yet: download the PDF and send it yourself.",
  act: "send",
  toast: "Marked as sent"
};

// The primary button at each status. `act` is the action RevquilaQuoteController carries out.
const ACTIONS = {
  draft: SEND,
  approval: {
    label: "Approve",
    heading: "Approve this quote?",
    body: "Approves the exception so the rep can send this quote.",
    act: "approve",
    toast: "Quote approved",
    needsApprover: true
  },
  approved: SEND,
  rejected: { label: "Edit quote", edit: true },
  sent: {
    label: "Mark as signed",
    heading: "Mark this quote as signed?",
    body: "Use this once the customer has accepted the quote. Its yearly products start a subscription that renews in twelve months.",
    act: "sign",
    toast: "Signed"
  },
  signed: { label: "Open order", order: true },
  invoiced: { label: "Open invoice", invoice: true },
  paid: { label: "Open invoice", invoice: true }
};

const SUBMIT_FOR_APPROVAL = {
  label: "Submit for approval",
  heading: "Submit this quote for approval?",
  body: "This quote is outside the pricing policy, so an approver has to approve it before it can be sent.",
  act: "submit",
  toast: "Submitted for approval"
};

const DIALOGS = {
  clone: {
    heading: "Clone this quote?",
    body: "Creates a new draft with the same customer and products, priced at today's list prices.",
    confirmLabel: "Clone quote"
  },
  revise: {
    heading: "Revise this quote?",
    body: "Starts the next version as a draft you can edit. The timeline keeps what happened to the version that went out.",
    confirmLabel: "Start new version",
    act: "revise",
    toast: "New version started as a draft"
  }
};

const WHAT_IF_MAX = 40;

function editableLine({ productKey, qty, discount, name, unit, price }) {
  return productKey === CUSTOM_PRODUCT
    ? { productKey, qty, discount, name, unit, price }
    : { productKey, qty, discount };
}

/**
 * Quote 360: Revquila's own record view of one quote, used instead of a standard record page.
 * Opened by URL with the quote's id in c__quote.
 */
export default class RevquilaQuote360 extends NavigationMixin(
  LightningElement
) {
  quote;
  loading = true;
  approver = false;
  // { kind, heading, body, confirmLabel, act, toast } while a confirmation is open
  dialog;
  busy = false;
  rejecting = false;
  editing = false;
  previewing = false;
  showAiAdvisor = false;
  showEsign = false;
  // The discount the what-if slider is on; undefined until it is moved
  whatIf;
  // The what-if prices with the product list, which can arrive after the quote
  productsLoaded = false;

  _quoteId;
  _unsubscribe;
  _releasePage;
  _trigger;

  @wire(CurrentPageReference)
  setPageReference(pageReference) {
    const quoteId = pageReference?.state?.c__quote;
    if (quoteId === this._quoteId) {
      // back on a page Lightning kept: read the record again if it is no longer held
      if (quoteId && !this.loading && !getQuote(quoteId)) {
        this.open();
      }
      return;
    }
    this._quoteId = quoteId;
    this.whatIf = undefined;
    this.quote = undefined;
    this.open();
  }

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this._unsubscribe = onDataChange(() => this.show());
    // the buttons depend on who may approve
    loadProducts()
      .then(() => {
        this.productsLoaded = true;
      })
      .catch(() => {});
    loadCanApprove().catch(() => {});
  }

  disconnectedCallback() {
    this._releasePage();
    this._unsubscribe();
  }

  open() {
    if (!this._quoteId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    loadQuote(this._quoteId)
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        this.show();
      });
  }

  show() {
    // a record that is no longer held stays as it was last shown
    this.quote = getQuote(this._quoteId) || this.quote;
    this.approver = canApprove();
  }

  get missing() {
    return !this.loading && !this.quote;
  }

  get recordId() {
    return this.quote ? this.quote.id : this._quoteId || null;
  }

  get action() {
    const { status, policyIssue } = this.quote;
    const action =
      status === "draft" && policyIssue ? SUBMIT_FOR_APPROVAL : ACTIONS[status];
    // deciding an approval takes the Approve Quotes permission
    return action.needsApprover && !this.approver ? undefined : action;
  }

  get canReject() {
    return this.quote.status === "approval" && this.approver;
  }

  // A rejected quote's primary button is already Edit
  get canEdit() {
    return this.quote.status === "draft";
  }

  // Once it has gone out (or is waiting on an approver) the way to change it is a new version
  get canRevise() {
    return ["approval", "approved", "sent"].includes(this.quote.status);
  }

  get canEsign() {
    if (!this.quote) return false;
    return (
      ["sent", "approved", "draft"].includes(this.quote.status) ||
      Boolean(this.quote.isSigned)
    );
  }

  get canMakePrimary() {
    return Boolean(this.quote?.opportunityId && !this.quote?.primary);
  }

  get canSyncOpportunity() {
    return Boolean(this.quote?.opportunityId);
  }

  get esignButtonLabel() {
    return this.quote?.isSigned ? "Signed Certificate" : "E-Sign";
  }

  get esignButtonTitle() {
    return this.quote?.isSigned
      ? "View Digital Signature Certificate & Audit"
      : "RevX Native Digital E-Signature";
  }

  get eyebrow() {
    return `Quote ${this.quote.number} · ${this.quote.versionLabel}`;
  }

  // formatMoney options: the quote's own currency and number format
  get money() {
    return { tax: this.quote.money };
  }

  get netLabel() {
    return formatMoney(this.quote.net, this.money);
  }

  get rejectTitle() {
    return `${this.quote.account} · ${this.quote.number}`;
  }

  get facts() {
    const { net, total, validUntil, owner, terms, taxLines } = this.quote;
    const tax = this.quote.money;
    const taxed = taxLines.length > 0;
    return [
      {
        label: taxed ? `Amount, excl. ${tax.system}` : "Amount",
        value: formatMoney(net, this.money)
      },
      taxed && {
        label: `Total, incl. ${tax.system}`,
        value: formatMoney(total, this.money)
      },
      { label: "Valid until", value: validUntil },
      { label: "Currency", value: this.quote.currency },
      { label: "Owner", value: owner },
      { label: "Payment terms", value: terms }
    ].filter(Boolean);
  }

  // --rq-p is the share of the track between the first and last milestone that is filled
  get pathStyle() {
    return `--rq-p:${(this.quote.done - 1) / (MILESTONES.length - 1)}`;
  }

  get milestones() {
    const { done, status } = this.quote;
    return MILESTONES.map((label, index) => {
      let state = "todo";
      if (index < done) {
        state = "done";
      } else if (index === done) {
        state = "next";
        if (status === "approval") {
          state = "waiting";
        } else if (status === "rejected") {
          state = "blocked";
        }
      }
      return { label, stepClass: `rq-step rq-${state}` };
    });
  }

  // ---------------------------------------------------------------- line items

  get lineRows() {
    const { discountLimit } = getConfig().pricing;
    return this.quote.lines.map((line) => ({
      key: line.key,
      name: line.name,
      unit: line.unit,
      qty: line.qty,
      price: formatMoney(line.price, this.money),
      discount: line.discountLabel,
      discountClass:
        line.discount > discountLimit ? "rq-right rq-over" : "rq-right",
      net: formatMoney(line.net, this.money)
    }));
  }

  get lineSummary() {
    const { lines, state, taxLines } = this.quote;
    const products = countOf(lines.length, "product");
    if (!taxLines.length) {
      return products;
    }
    const names = taxLines.map((line) => line.label).join(" + ");
    const region = getConfig().tax.regionLabel.toLowerCase();
    return `${products} · ${region} of supply ${state} (${names})`;
  }

  get totals() {
    const { subtotal, discountTotal, net, taxLines, total } = this.quote;
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
      label: "Grand total",
      value: formatMoney(total, this.money),
      grand: true
    });
    return rows.map((row) => ({
      ...row,
      rowClass: row.grand ? "rq-row rq-grand" : "rq-row"
    }));
  }

  // ---------------------------------------------------------------- side cards

  get timeline() {
    return getTimeline(this.quote);
  }

  get customer() {
    const { account, contact, city, state, registration } = this.quote;
    return [
      { label: "Account", value: account },
      { label: "Contact", value: contact || "Not set yet" },
      {
        label: "Location",
        value: [city, state].filter(Boolean).join(", ") || "Not set yet"
      },
      registration && {
        label: getConfig().tax.registrationLabel,
        value: registration
      }
    ].filter(Boolean);
  }

  get checks() {
    const { discountLimit, standardTerms } = getConfig().pricing;
    const { maxDiscount, terms } = this.quote;
    return [
      {
        label: "Highest discount",
        note: `Limit ${discountLimit}%`,
        value: `${maxDiscount}%`,
        ok: maxDiscount <= discountLimit
      },
      {
        label: "Payment terms",
        note: `Standard is ${standardTerms}`,
        value: terms,
        ok: this.quote.standardTerms
      }
    ].map((check) => ({
      ...check,
      mark: check.ok ? "✓" : "!",
      itemClass: check.ok ? "rq-check" : "rq-check rq-no"
    }));
  }

  get verdictClass() {
    return `rq-verdict rq-tone-${this.quote.verdict.tone}`;
  }

  // What the quote would come to with one discount on every line, at today's list prices
  get whatIfDiscount() {
    return this.whatIf === undefined ? this.quote.maxDiscount : this.whatIf;
  }

  get whatIfMax() {
    return Math.max(WHAT_IF_MAX, this.quote.maxDiscount);
  }

  get whatIfLines() {
    return this.quote.lines.map((line) => ({
      ...editableLine(line),
      discount: this.whatIfDiscount
    }));
  }

  get whatIfResult() {
    // until the product list is in there is nothing to price with: show the quote as it stands
    const priced = this.productsLoaded
      ? priceLines(this.whatIfLines, this.quote.state, this.quote.terms)
      : this.quote;
    const change = priced.net - this.quote.net;
    let changeLabel = "No change";
    if (change > 0) {
      changeLabel = `+ ${formatMoney(change, this.money)}`;
    } else if (change < 0) {
      changeLabel = `− ${formatMoney(-change, this.money)}`;
    }
    const overLimit = priced.maxDiscount > getConfig().pricing.discountLimit;
    return {
      heading: `Every line at ${this.whatIfDiscount}%`,
      net: formatMoney(priced.net, this.money),
      total: formatMoney(priced.total, this.money),
      changeLabel,
      verdict: overLimit ? "Needs approval" : "Within limit",
      verdictClass: `rq-pill rq-tone-${overLimit ? "warn" : "good"}`
    };
  }

  get whatIfChanged() {
    return this.quote.lines.some(
      (line) => line.discount !== this.whatIfDiscount
    );
  }

  get canApplyWhatIf() {
    return this.quote.editable && this.whatIfChanged;
  }

  get whatIfHint() {
    if (this.quote.editable) {
      return "";
    }
    return this.canRevise
      ? "Revise the quote to apply a different discount."
      : "This quote can no longer be changed.";
  }

  get pdfDetail() {
    const { version, done } = this.quote;
    return done >= 3
      ? `Version ${version} · as it was sent`
      : `Version ${version} · draft, not sent yet`;
  }

  get document() {
    return getQuoteDocument(this.quote);
  }

  get related() {
    return getRelated(this.quote).map((record) => ({
      ...record,
      opens: Boolean(
        record.invoiceId ||
        record.subscriptionId ||
        record.orderId ||
        record.contractId
      ),
      itemClass: record.exists ? "rq-item" : "rq-item rq-off"
    }));
  }

  // ---------------------------------------------------------------- events

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  fail(error) {
    this.refs.toast.show(errorMessage(error), "error");
  }

  openAction(event) {
    const { label, heading, body, act, toast, edit, invoice } = this.action;
    this._trigger = event.currentTarget;
    if (edit) {
      this.editing = true;
    } else if (invoice) {
      this[NavigationMixin.Navigate](invoicePage(this.quote.invoice.id));
    } else {
      this.dialog = { heading, body, confirmLabel: label, act, toast };
    }
  }

  openDialog(event) {
    const { kind } = event.currentTarget.dataset;
    this._trigger = event.currentTarget;
    this.dialog = { kind, ...DIALOGS[kind] };
  }

  confirmDialog() {
    if (this.busy) {
      return;
    }
    const { kind, act, toast } = this.dialog;
    const { id } = this.quote;
    this.busy = true;
    const work =
      kind === "clone"
        ? cloneQuote(id).then((copyId) => {
            this.dialog = undefined;
            this.navigateToQuote(copyId);
          })
        : actOnQuote(id, act).then(() => {
            this.whatIf = undefined;
            this.refs.toast.show(toast, "success");
            this.refs.dialogModal.close();
          });
    work
      .catch((error) => this.fail(error))
      .finally(() => {
        this.busy = false;
      });
  }

  cancelDialog() {
    this.refs.dialogModal.close();
  }

  closeDialog() {
    this.dialog = undefined;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  openReject(event) {
    this._trigger = event.currentTarget;
    this.rejecting = true;
  }

  handleReject(event) {
    actOnQuote(this.quote.id, "reject", event.detail.reason)
      .then(() => this.refs.toast.show("Quote rejected"))
      .catch((error) => this.fail(error));
  }

  closeReject() {
    this.rejecting = false;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  openEdit(event) {
    this._trigger = event.currentTarget;
    this.editing = true;
  }

  handleSaved() {
    this.editing = false;
    this.whatIf = undefined;
    this.refs.toast.show("Quote updated", "success");
  }

  closeEdit() {
    this.editing = false;
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

  openAiAdvisor(event) {
    this._trigger = event.currentTarget;
    this.showAiAdvisor = true;
  }

  closeAiAdvisor() {
    this.showAiAdvisor = false;
    if (this._trigger && this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  openEsign(event) {
    this._trigger = event.currentTarget;
    this.showEsign = true;
  }

  closeEsign() {
    this.showEsign = false;
    if (this._trigger && this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  openCertificatePdf() {
    if (!this.quote?.id) return;
    window.open(`/apex/Revquila__RevquilaEsignCertificate?id=${this.quote.id}`, "_blank");
  }

  handleSigned() {
    this.showEsign = false;
    this.refs.toast?.show("Quote successfully signed & booked!", "good");
    loadQuote(this._quoteId)
      .catch(() => {})
      .finally(() => {
        this.show();
      });
  }

  makePrimary() {
    this.busy = true;
    actOnQuote(this.quote.id, "primary")
      .then(() => {
        this.refs.toast?.show("Quote set as Primary and synced to Opportunity", "success");
        return loadQuote(this._quoteId);
      })
      .then(() => this.show())
      .catch((error) => this.fail(error))
      .finally(() => {
        this.busy = false;
      });
  }

  syncToOpportunity() {
    this.busy = true;
    syncOpportunityLines(this.quote.id)
      .then((res) => {
        const msg = res?.message || "Opportunity products synchronized successfully";
        this.refs.toast?.show(msg, "success");
        return loadQuote(this._quoteId);
      })
      .then(() => this.show())
      .catch((error) => this.fail(error))
      .finally(() => {
        this.busy = false;
      });
  }

  handleWhatIf(event) {
    this.whatIf = Number(event.target.value);
  }

  // Saves the quote as it is, with the slider's discount on every line
  applyWhatIf() {
    const { id, contactId, opportunityId, state, terms, validDays, notes } =
      this.quote;
    saveQuote({
      quoteId: id,
      contactId,
      opportunityId,
      state,
      terms,
      validDays,
      notes,
      opportunity: this.quote.opportunity,
      lines: this.whatIfLines
    })
      .then(() => {
        this.whatIf = undefined;
        this.refs.toast.show("Discount applied to every line", "success");
      })
      .catch((error) => this.fail(error));
  }

  openRelated(event) {
    const { invoice, subscription } = event.currentTarget.dataset;
    this[NavigationMixin.Navigate](
      invoice ? invoicePage(invoice) : subscriptionPage(subscription)
    );
  }

  navigateToQuote(id) {
    this[NavigationMixin.Navigate](quotePage(id));
  }

  goToQuotes() {
    this[NavigationMixin.Navigate](QUOTES_PAGE);
  }

  goToTemplates() {
    this[NavigationMixin.Navigate](TEMPLATES_PAGE);
  }

  goToEnterpriseTrust() {
    this[NavigationMixin.Navigate]({
      type: 'standard__navItemPage',
      attributes: {
        apiName: 'Revquila_Enterprise_Trust'
      }
    });
  }
}