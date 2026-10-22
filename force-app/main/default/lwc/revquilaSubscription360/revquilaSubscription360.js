import { LightningElement, wire } from "lwc";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import { SUBSCRIPTIONS_PAGE, invoicePage, quotePage } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  cancelSubscription,
  changeSubscriptionQuantity,
  errorMessage,
  getMrrHistory,
  getSubscription,
  getSubscriptionTimeline,
  loadSubscription,
  logRenewalNote,
  logSubscriptionUsage,
  onDataChange,
  pauseSubscription,
  renewSubscription,
  resumeSubscription,
  saveSubscription,
  setSubscriptionAutoRenew
} from "c/revquilaData";
import { formatMoney, formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

function inputDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TERM_DAYS = 365;
const RISK = {
  high: { label: "High risk", tone: "bad" },
  medium: { label: "Needs attention", tone: "warn" },
  low: { label: "On track", tone: "good" }
};

const CONFIRMS = {
  renew: {
    heading: "Create the renewal quote?",
    body: "Creates a draft quote with the products and quantities this subscription has today, at today's list prices. You can change it before sending it.",
    confirmLabel: "Create renewal quote"
  },
  pause: {
    heading: "Pause this subscription?",
    body: "Its MRR leaves your totals from today until you resume it. The renewal date does not move.",
    confirmLabel: "Pause subscription"
  },
  resume: {
    heading: "Resume this subscription?",
    body: "Its MRR counts again from today.",
    confirmLabel: "Resume subscription"
  }
};

/**
 * Subscription 360: Revquila's own record view of one subscription.
 * Opened by URL with the subscription's id in c__subscription.
 */
export default class RevquilaSubscription360 extends NavigationMixin(
  LightningElement
) {
  subscription;
  loading = true;
  // { kind: "confirm" | "quantity" | "cancel" | "note", … } while a modal is open
  modal;
  form = {};
  errors = {};
  busy = false;
  isEditing = false;
  editBusy = false;
  editForm = {};

  _subscriptionId;
  _unsubscribe;
  _releasePage;
  _trigger;

  @wire(CurrentPageReference)
  setPageReference(pageReference) {
    const subscriptionId = pageReference?.state?.c__subscription;
    if (subscriptionId === this._subscriptionId) {
      // back on a page Lightning kept: read the record again if it is no longer held
      if (subscriptionId && !this.loading && !getSubscription(subscriptionId)) {
        this.open();
      }
      return;
    }
    this._subscriptionId = subscriptionId;
    this.subscription = undefined;
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
    if (!this._subscriptionId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    loadSubscription(this._subscriptionId)
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        this.show();
      });
  }

  show() {
    // a record that is no longer held stays as it was last shown
    this.subscription =
      getSubscription(this._subscriptionId) || this.subscription;
  }

  get missing() {
    return !this.loading && !this.subscription;
  }

  // ---------------------------------------------------------------- hero

  // formatMoney options: the subscription's own currency and number format
  get money() {
    return { tax: this.subscription.money };
  }

  get isLive() {
    return ["active", "renewing"].includes(this.subscription.status);
  }

  get recordId() {
    return this.subscription ? this.subscription.id : this._subscriptionId || null;
  }

  get isPaused() {
    return this.subscription.status === "paused";
  }

  get isCancelled() {
    return this.subscription.status === "cancelled";
  }

  get canCancel() {
    return !this.isCancelled;
  }

  get facts() {
    const { mrr, arr, renewalLabel, daysLeft, autoRenew } = this.subscription;
    let ending = autoRenew ? "Auto-renews on" : "Ends on";
    let left = String(daysLeft);
    if (this.isCancelled) {
      ending = "Would have renewed";
      left = "Ended";
    } else if (daysLeft < 0) {
      ending = "Renewal was due";
      left = `${countOf(-daysLeft, "day")} late`;
    }
    return [
      { label: "MRR", value: formatMoney(mrr, this.money) },
      { label: "ARR", value: formatMoney(arr, this.money) },
      { label: ending, value: renewalLabel },
      { label: "Days left in term", value: left }
    ];
  }

  get termStyle() {
    return `--rq-p:${this.subscription.termProgress}`;
  }

  get termLabel() {
    const { startLabel, renewalLabel, termProgress } = this.subscription;
    const day = Math.round(termProgress * TERM_DAYS);
    return `Day ${day} of ${TERM_DAYS} · ${startLabel} to ${renewalLabel}`;
  }

  // ---------------------------------------------------------------- body

  get productRows() {
    return this.subscription.products.map((product) => ({
      ...product,
      priceLabel: formatMoney(product.price, this.money),
      mrrLabel: formatMoney(product.mrr, this.money)
    }));
  }

  // One bar per change to the subscription, as tall as its MRR
  get history() {
    const points = getMrrHistory(this.subscription);
    const highest = Math.max(...points.map((point) => point.mrr), 1);
    return points.map((point, index) => ({
      key: `point-${index}`,
      label: point.label,
      value: formatMoneyCompact(point.mrr),
      barStyle: `--rq-p:${point.mrr / highest};--rq-i:${index}`
    }));
  }

  get timeline() {
    return getSubscriptionTimeline(this.subscription);
  }

  get risk() {
    const { label, tone } = RISK[this.subscription.risk];
    return { label, pillClass: `rq-pill rq-tone-${tone}` };
  }

  get riskReason() {
    const { cancelReason, riskReason } = this.subscription;
    if (this.isCancelled) {
      return `Cancelled: ${cancelReason || "no reason given"}`;
    }
    return cancelReason
      ? `Set to end on the renewal date: ${cancelReason}`
      : riskReason;
  }

  get riskClass() {
    const tone =
      this.isCancelled || this.subscription.cancelReason
        ? "bad"
        : RISK[this.subscription.risk].tone;
    return `rq-verdict rq-tone-${tone}`;
  }

  get hasInvoices() {
    return this.subscription.invoices.length > 0;
  }

  get hasMandate() {
    return Boolean(this.subscription?.mandateStatus);
  }

  get mandateMaxLabel() {
    return Number(this.subscription?.mandateMaxAmount || 0).toLocaleString();
  }

  get mandateAuthDateLabel() {
    return this.subscription?.mandateAuthDate ? String(this.subscription.mandateAuthDate) : "Pending authorization";
  }

  get hasCoupon() {
    return Boolean(this.subscription?.discountCode);
  }

  get hasTrial() {
    return Boolean(this.subscription?.trialEndDate);
  }

  get discountPromoLabel() {
    const pct = this.subscription?.discountPercent || 0;
    return pct > 0 ? `${pct}% promotional discount active` : "Promo terms active";
  }

  get trialEndLabel() {
    return this.subscription?.trialEndDate ? String(this.subscription.trialEndDate) : "";
  }

  get details() {
    const { owner, startLabel, quoteNumber, number } = this.subscription;
    return [
      { label: "Subscription", value: number },
      { label: "Owner", value: owner },
      { label: "Started", value: startLabel },
      { label: "Term", value: "12 months" },
      { label: "Currency", value: this.subscription.currency },
      { label: "Started from", value: quoteNumber || "Not from a quote" }
    ];
  }

  // ---------------------------------------------------------------- modals

  get isConfirm() {
    return this.modal.kind === "confirm";
  }

  get isQuantity() {
    return this.modal.kind === "quantity";
  }

  get isCancel() {
    return this.modal.kind === "cancel";
  }

  get isNote() {
    return this.modal.kind === "note";
  }

  get isUsage() {
    return this.modal.kind === "usage";
  }

  get hasUsage() {
    return this.subscription?.usage && this.subscription.usage.length > 0;
  }

  get usageRows() {
    if (!this.subscription?.usage) {
      return [];
    }
    return this.subscription.usage.map((u) => ({
      ...u,
      statusLabel: u.billed ? "Billed" : "Unbilled",
      pillClass: `rq-pill ${u.billed ? "rq-tone-good" : "rq-tone-warn"}`
    }));
  }

  get usageItemOptions() {
    if (!this.subscription?.items) {
      return [];
    }
    const usageOnly = this.subscription.items.filter((i) => i.usageBased);
    const list = usageOnly.length ? usageOnly : this.subscription.items;
    return list.map((item) => ({
      id: item.id,
      label: `${item.name} (${item.usageUnit || "unit"})`
    }));
  }

  // What changing the quantity does, worked out as the number is typed
  get proration() {
    const { product } = this.modal;
    const { daysLeft, contractMrr } = this.subscription;
    const qty = Number(this.form.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty === product.qty) {
      return undefined;
    }
    const change = qty - product.qty;
    const remaining = Math.max(0, daysLeft);
    const prorated = (Math.abs(change) * product.price * remaining) / TERM_DAYS;
    return [
      {
        label: "MRR",
        value: `${formatMoney(contractMrr, this.money)} to ${formatMoney(contractMrr + (change * product.price) / 12, this.money)}`
      },
      {
        label:
          change > 0
            ? "Prorated charge, to invoice yourself"
            : "Prorated credit, to issue yourself",
        value: formatMoney(prorated, this.money)
      },
      { label: "Days left in the term", value: String(remaining) }
    ];
  }

  get whenOptions() {
    return [
      { key: "term-end", label: "At the end of the term" },
      { key: "now", label: "Today" }
    ].map((option) => ({
      ...option,
      optionClass: option.key === this.form.when ? "rq-on" : "",
      pressed: option.key === this.form.when ? "true" : "false"
    }));
  }

  get cancelNote() {
    const { renewalLabel, contractMrr } = this.subscription;
    return this.form.when === "now"
      ? `It ends today and ${formatMoney(contractMrr, this.money)} of MRR is lost now.`
      : `It keeps running until ${renewalLabel}, then ends instead of renewing.`;
  }

  get qtyFieldClass() {
    return this.errors.qty ? "rq-field rq-invalid" : "rq-field";
  }

  get reasonFieldClass() {
    return this.errors.reason ? "rq-field rq-invalid" : "rq-field";
  }

  get noteFieldClass() {
    return this.errors.note ? "rq-field rq-invalid" : "rq-field";
  }

  get confirmClass() {
    return this.modal.danger ? "rq-btn rq-danger" : "rq-btn rq-primary";
  }

  openModal(event, modal) {
    this._trigger = event.currentTarget;
    this.errors = {};
    this.modal = modal;
  }

  openConfirm(event) {
    const { action } = event.currentTarget.dataset;
    this.openModal(event, {
      kind: "confirm",
      action,
      size: "small",
      ...CONFIRMS[action]
    });
  }

  openQuantity(event) {
    const product = this.subscription.products.find(
      (candidate) => candidate.key === event.currentTarget.dataset.key
    );
    this.form = { qty: String(product.qty) };
    this.openModal(event, {
      kind: "quantity",
      size: "small",
      product,
      heading: `Change ${product.name}`,
      confirmLabel: "Change quantity"
    });
  }

  openCancel(event) {
    this.form = { reason: "", when: "term-end" };
    this.openModal(event, {
      kind: "cancel",
      size: "small",
      heading: "Cancel this subscription?",
      confirmLabel: "Cancel subscription",
      danger: true
    });
  }

  openNote(event) {
    this.form = { note: "" };
    this.openModal(event, {
      kind: "note",
      size: "small",
      heading: "Log a note",
      confirmLabel: "Save note"
    });
  }

  openUsage(event) {
    const items = this.usageItemOptions;
    this.form = {
      itemId: items.length ? items[0].id : "",
      usageDate: new Date().toISOString().slice(0, 10),
      qty: 1,
      note: ""
    };
    this.openModal(event, {
      kind: "usage",
      size: "small",
      heading: "Log usage consumption",
      confirmLabel: "Save usage"
    });
  }

  handleField(event) {
    this.form = {
      ...this.form,
      [event.target.dataset.field]: event.target.value
    };
  }

  handleWhen(event) {
    this.form = { ...this.form, when: event.currentTarget.dataset.key };
  }

  fail(error) {
    this.refs.toast.show(errorMessage(error), "error");
  }

  // The write for the modal that is open, or undefined when the form is not right yet.
  // It resolves with what to say once it is done.
  work() {
    const { id } = this.subscription;
    const { kind, action, product } = this.modal;
    const errors = {};
    let work;

    if (kind === "quantity") {
      const qty = Number(this.form.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        errors.qty = "Enter a whole number, 1 or more.";
      } else if (qty === product.qty) {
        errors.qty = "That is the quantity it already has.";
      } else {
        work = changeSubscriptionQuantity(product.itemId, qty).then(
          () => `${product.name} changed to ${qty}`
        );
      }
    } else if (kind === "cancel") {
      const reason = this.form.reason.trim();
      const { when } = this.form;
      if (!reason) {
        errors.reason = "Say why, so the team can learn from it.";
      } else {
        work = cancelSubscription(id, { reason, when }).then(() => {
          return when === "now"
            ? "Subscription cancelled"
            : "Set to end on the renewal date";
        });
      }
    } else if (kind === "note") {
      const note = this.form.note.trim();
      if (!note) {
        errors.note = "Write the note first.";
      } else {
        work = logRenewalNote(id, note).then(
          () => "Note added to the timeline"
        );
      }
    } else if (kind === "usage") {
      const qty = Number(this.form.qty);
      if (!qty || qty <= 0) {
        errors.qty = "Enter a quantity above zero.";
      } else if (!this.form.itemId) {
        errors.qty = "Select a product or item.";
      } else {
        work = logSubscriptionUsage(
          this.form.itemId,
          this.form.usageDate || new Date().toISOString().slice(0, 10),
          qty,
          this.form.note ? this.form.note.trim() : ""
        ).then(() => `Logged usage of ${qty}`);
      }
    } else if (action === "pause") {
      work = pauseSubscription(id).then(() => "Subscription paused");
    } else {
      work = resumeSubscription(id).then(() => "Subscription resumed");
    }
    this.errors = errors;
    return work;
  }

  confirmModal() {
    if (this.busy) {
      return;
    }
    if (this.modal.action === "renew") {
      this.busy = true;
      renewSubscription(this.subscription.id)
        .then((quoteId) => {
          this.modal = undefined;
          this[NavigationMixin.Navigate](quotePage(quoteId));
        })
        .catch((error) => this.fail(error))
        .finally(() => {
          this.busy = false;
        });
      return;
    }
    const work = this.work();
    if (!work) {
      return;
    }
    this.busy = true;
    work
      .then((toast) => {
        this.refs.toast.show(toast, "success");
        this.refs.actionModal.close();
      })
      .catch((error) => this.fail(error))
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

  handleAutoRenew(event) {
    const on = event.target.checked;
    setSubscriptionAutoRenew(this.subscription.id, on)
      .then(() =>
        this.refs.toast.show(
          on ? "Auto-renew is on" : "Auto-renew is off",
          "success"
        )
      )
      .catch((error) => this.fail(error));
  }

  get frequencyOptions() {
    const freqs = ["Monthly", "Quarterly", "Semi-Annual", "Annual"];
    return freqs.map((f) => ({
      value: f,
      label: f,
      selected: f.toLowerCase() === (this.editForm.frequency || "").toLowerCase()
    }));
  }

  openEdit() {
    this.editForm = {
      renewalDate: this.subscription.renewalDate ? inputDate(this.subscription.renewalDate) : "",
      nextBillDate: this.subscription.nextBillDate ? inputDate(this.subscription.nextBillDate) : "",
      frequency: this.subscription.billingFrequency || "Monthly",
      termMonths: this.subscription.termMonths || 12,
      autoRenew: Boolean(this.subscription.autoRenew)
    };
    this.isEditing = true;
  }

  cancelEdit() {
    this.isEditing = false;
  }

  handleEditInput(event) {
    const { field } = event.target.dataset;
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    this.editForm = {
      ...this.editForm,
      [field]: value
    };
  }

  async saveEditSubscription() {
    this.editBusy = true;
    try {
      await saveSubscription(this.subscription.id, {
        renewalDate: this.editForm.renewalDate || null,
        nextBillDate: this.editForm.nextBillDate || null,
        frequency: this.editForm.frequency || null,
        autoRenew: this.editForm.autoRenew,
        termMonths: this.editForm.termMonths ? Number(this.editForm.termMonths) : null
      });
      this.isEditing = false;
      this.refs.toast.show("Subscription updated", "accent");
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

  openInvoice(event) {
    this[NavigationMixin.Navigate](invoicePage(event.currentTarget.dataset.id));
  }

  goToSubscriptions() {
    this[NavigationMixin.Navigate](SUBSCRIPTIONS_PAGE);
  }
}