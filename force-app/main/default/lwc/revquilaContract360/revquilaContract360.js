import { LightningElement, wire } from "lwc";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import {
  CONTRACTS_PAGE,
  orderPage,
  quotePage,
  subscriptionPage
} from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  cancelContract,
  errorMessage,
  getContract,
  getContractTimeline,
  getOrderStatusLabel,
  getSubscriptionStatusLabel,
  loadContract,
  onDataChange,
  saveContract
} from "c/revquilaData";
import { formatMoney } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

function inputDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Contract 360: Revquila's own record view of one contract.
 * Opened by URL with the contract's id in c__contract.
 */
export default class RevquilaContract360 extends NavigationMixin(
  LightningElement
) {
  contract;
  loading = true;
  cancelling = false;
  reason = "";
  reasonError = "";
  busy = false;
  isEditing = false;
  editBusy = false;
  editForm = {};

  _contractId;
  _unsubscribe;
  _releasePage;
  _trigger;

  @wire(CurrentPageReference)
  setPageReference(pageReference) {
    const contractId = pageReference?.state?.c__contract;
    if (contractId === this._contractId) {
      if (contractId && !this.loading && !getContract(contractId)) {
        this.open();
      }
      return;
    }
    this._contractId = contractId;
    this.contract = undefined;
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
    if (!this._contractId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    loadContract(this._contractId)
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        this.show();
      });
  }

  show() {
    this.contract = getContract(this._contractId) || this.contract;
  }

  get missing() {
    return !this.loading && !this.contract;
  }

  get recordId() {
    return this.contract ? this.contract.id : this._contractId || null;
  }

  get money() {
    return { tax: this.contract?.money };
  }

  get eyebrow() {
    return `Contract ${this.contract.number}`;
  }

  get canCancel() {
    return this.contract.status === "active";
  }

  get facts() {
    const { annualValue, termMonths, endLabel, daysLeft, currency, autoRenew } =
      this.contract;
    let left = countOf(Math.max(0, daysLeft), "day");
    if (this.contract.status !== "active") {
      left = this.contract.statusLabel;
    } else if (daysLeft < 0) {
      left = `${countOf(-daysLeft, "day")} past the end`;
    }
    return [
      { label: "Annual value", value: formatMoney(annualValue, this.money) },
      { label: "Term", value: `${termMonths} months` },
      { label: autoRenew ? "Renews on" : "Ends on", value: endLabel },
      { label: "Days left", value: left },
      { label: "Currency", value: currency }
    ];
  }

  get termStyle() {
    return `--rq-p:${this.contract.termProgress}`;
  }

  get termLabel() {
    const { startLabel, endLabel, signedLabel } = this.contract;
    return `${startLabel} to ${endLabel} · signed ${signedLabel}`;
  }

  get timeline() {
    return getContractTimeline(this.contract);
  }

  get details() {
    const { owner, reference, autoRenew, country, contact } = this.contract;
    return [
      { label: "Reference", value: reference || "None" },
      { label: "Signed by", value: contact || "Not set" },
      { label: "Country", value: country },
      { label: "Auto-renew", value: autoRenew ? "On" : "Off" },
      { label: "Owner", value: owner }
    ];
  }

  get related() {
    const contract = this.contract;
    return [
      {
        type: "Quote",
        name: contract.quoteNumber || "Not from a quote",
        state: "",
        exists: Boolean(contract.quoteId),
        quoteId: contract.quoteId
      },
      {
        type: "Order",
        name: contract.orderNumber || "No order",
        state: contract.orderStatus
          ? getOrderStatusLabel(contract.orderStatus)
          : "",
        exists: Boolean(contract.orderId),
        orderId: contract.orderId
      },
      {
        type: "Subscription",
        name: contract.subscriptionNumber || "No subscription",
        state: contract.subscriptionStatus
          ? getSubscriptionStatusLabel(contract.subscriptionStatus)
          : "",
        exists: Boolean(contract.subscriptionId),
        subscriptionId: contract.subscriptionId
      }
    ].map((record) => ({
      ...record,
      itemClass: record.exists ? "rq-item" : "rq-item rq-off"
    }));
  }

  get reasonFieldClass() {
    return this.reasonError ? "rq-field rq-invalid" : "rq-field";
  }

  openCancel(event) {
    this._trigger = event.currentTarget;
    this.reason = "";
    this.reasonError = "";
    this.cancelling = true;
  }

  handleReason(event) {
    this.reason = event.target.value;
  }

  confirmCancel() {
    if (this.busy) {
      return;
    }
    const reason = this.reason.trim();
    if (!reason) {
      this.reasonError = "Say why, for the audit trail.";
      return;
    }
    this.busy = true;
    cancelContract(this.contract.id, reason)
      .then(() => {
        this.refs.toast.show(
          "Contract cancelled, with its subscription",
          "success"
        );
        this.refs.cancelModal.close();
      })
      .catch((error) => this.refs.toast.show(errorMessage(error), "error"))
      .finally(() => {
        this.busy = false;
      });
  }

  backFromCancel() {
    this.refs.cancelModal.close();
  }

  closeCancel() {
    this.cancelling = false;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  openEdit() {
    this.editForm = {
      endDate: this.contract.end ? inputDate(this.contract.end) : "",
      termMonths: this.contract.termMonths || 12,
      autoRenew: Boolean(this.contract.autoRenew),
      upliftPercent: this.contract.upliftPercent != null ? this.contract.upliftPercent : 5,
      reference: this.contract.reference || "",
      notes: this.contract.notes || ""
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

  async saveEditContract() {
    this.editBusy = true;
    try {
      await saveContract(this.contract.id, {
        endDate: this.editForm.endDate || null,
        termMonths: this.editForm.termMonths ? Number(this.editForm.termMonths) : null,
        autoRenew: this.editForm.autoRenew,
        upliftPercent: this.editForm.upliftPercent ? Number(this.editForm.upliftPercent) : null,
        reference: this.editForm.reference || null,
        notes: this.editForm.notes || null
      });
      this.isEditing = false;
      this.refs.toast.show("Contract updated", "accent");
    } catch (err) {
      this.refs.toast.show(errorMessage(err), "bad");
    } finally {
      this.editBusy = false;
    }
  }

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  openRelated(event) {
    const { quote, order, subscription } = event.currentTarget.dataset;
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

  goToContracts() {
    this[NavigationMixin.Navigate](CONTRACTS_PAGE);
  }
}