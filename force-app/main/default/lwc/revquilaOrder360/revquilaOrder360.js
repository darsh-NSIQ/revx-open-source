import { LightningElement, wire } from "lwc";
import { CurrentPageReference, NavigationMixin } from "lightning/navigation";
import {
  ORDERS_PAGE,
  contractPage,
  invoicePage,
  quotePage,
  subscriptionPage
} from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  activateOrder,
  cancelOrder,
  errorMessage,
  getContractStatusLabel,
  getInvoiceStatusLabel,
  getOrder,
  getOrderDocument,
  getOrderTimeline,
  getSubscriptionStatusLabel,
  invoiceOrder,
  loadOrder,
  onDataChange,
  saveOrder
} from "c/revquilaData";
import { formatMoney } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const STEPS = ["Booked", "Active", "Invoiced", "Paid"];

const DIALOGS = {
  activate: {
    heading: "Activate this order?",
    body: "Confirms the order is ready to fulfil and bill. Once it is active, its invoice can be raised.",
    confirmLabel: "Activate order",
    toast: "Order activated"
  },
  invoice: {
    heading: "Create the invoice?",
    body: "Raises an invoice for the full amount, due as per the payment terms, and marks it as sent.",
    confirmLabel: "Create invoice",
    toast: "Invoice raised"
  },
  cancel: {
    heading: "Cancel this order?",
    body: "The order is closed without an invoice. The quote stays signed, so a new order can be booked from a revised quote.",
    confirmLabel: "Cancel order",
    toast: "Order cancelled",
    danger: true,
    reason: true
  }
};

function inputDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Order 360: Revquila's own record view of one order.
 * Opened by URL with the order's id in c__order.
 */
export default class RevquilaOrder360 extends NavigationMixin(
  LightningElement
) {
  order;
  loading = true;
  dialog;
  reason = "";
  reasonError = "";
  busy = false;
  previewing = false;
  isEditing = false;
  editBusy = false;
  editForm = {};

  _orderId;
  _unsubscribe;
  _releasePage;
  _trigger;

  @wire(CurrentPageReference)
  setPageReference(pageReference) {
    const orderId = pageReference?.state?.c__order;
    if (orderId === this._orderId) {
      if (orderId && !this.loading && !getOrder(orderId)) {
        this.open();
      }
      return;
    }
    this._orderId = orderId;
    this.order = undefined;
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
    if (!this._orderId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    loadOrder(this._orderId)
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        this.show();
      });
  }

  show() {
    this.order = getOrder(this._orderId) || this.order;
  }

  get missing() {
    return !this.loading && !this.order;
  }

  get recordId() {
    return this.order ? this.order.id : this._orderId || null;
  }

  get money() {
    return { tax: this.order?.money };
  }

  // ---------------------------------------------------------------- hero

  get eyebrow() {
    return `Order ${this.order.number}`;
  }

  get canActivate() {
    return this.order.status === "booked";
  }

  get canInvoice() {
    return this.order.status === "active";
  }

  get canCancel() {
    return ["booked", "active"].includes(this.order.status);
  }

  get hasInvoice() {
    return Boolean(this.order.invoiceId);
  }

  get facts() {
    const { net, total, taxLines, terms, orderDateLabel, owner, currency } =
      this.order;
    const tax = this.order.money;
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
      { label: "Order date", value: orderDateLabel },
      { label: "Currency", value: currency },
      { label: "Payment terms", value: terms },
      { label: "Owner", value: owner }
    ].filter(Boolean);
  }

  get done() {
    const { status, invoiceStatus } = this.order;
    if (status === "invoiced") {
      return invoiceStatus === "paid" ? 4 : 3;
    }
    return status === "active" ? 2 : 1;
  }

  get pathStyle() {
    return `--rq-p:${(this.done - 1) / (STEPS.length - 1)}`;
  }

  get steps() {
    const cancelled = this.order.status === "cancelled";
    return STEPS.map((label, index) => {
      let state = "todo";
      if (cancelled && index === 1) {
        state = "blocked";
      } else if (index < this.done) {
        state = "done";
      } else if (index === this.done) {
        state = "next";
      }
      return { label, stepClass: `rq-step rq-${state}` };
    });
  }

  // ---------------------------------------------------------------- body

  get lineSummary() {
    const { lines, state, taxLines } = this.order;
    const tax = taxLines.map((line) => line.label).join(" + ");
    return `${countOf(lines.length, "product")}${state ? ` · place of supply ${state}` : ""}${tax ? ` (${tax})` : ""}`;
  }

  get lineRows() {
    return this.order.lines.map((line) => ({
      key: line.key,
      name: line.name,
      unit: line.bundleName ? `${line.unit} · ${line.bundleName}` : line.unit,
      qty: line.qty,
      price: formatMoney(line.price, this.money),
      discount: line.discountLabel,
      net: formatMoney(line.net, this.money)
    }));
  }

  get totals() {
    const { subtotal, discountTotal, net, taxLines, total } = this.order;
    const rows = [
      { label: "Subtotal", value: formatMoney(subtotal, this.money) }
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
      label: "Order total",
      value: formatMoney(total, this.money),
      grand: true
    });
    return rows.map((row) => ({
      ...row,
      rowClass: row.grand ? "rq-row rq-grand" : "rq-row"
    }));
  }

  get timeline() {
    return getOrderTimeline(this.order);
  }

  get customer() {
    const { account, contact, city, state, country, registration } = this.order;
    return [
      { label: "Account", value: account },
      { label: "Contact", value: contact || "Not set" },
      {
        label: "Location",
        value: [city, state, country].filter(Boolean).join(", ") || "Not set"
      },
      registration && {
        label: this.order.money.registrationLabel,
        value: registration
      }
    ].filter(Boolean);
  }

  get related() {
    const order = this.order;
    return [
      {
        type: "Quote",
        name: order.quoteNumber || "Not from a quote",
        state: "",
        exists: Boolean(order.quoteId),
        quoteId: order.quoteId
      },
      {
        type: "Contract",
        name: order.contractNumber || "No recurring products",
        state: order.contractStatus
          ? getContractStatusLabel(order.contractStatus)
          : "",
        exists: Boolean(order.contractId),
        contractId: order.contractId
      },
      {
        type: "Subscription",
        name: order.subscriptionNumber || "No recurring products",
        state: order.subscriptionStatus
          ? getSubscriptionStatusLabel(order.subscriptionStatus)
          : "",
        exists: Boolean(order.subscriptionId),
        subscriptionId: order.subscriptionId
      },
      {
        type: "Invoice",
        name: order.invoiceNumber || "Raised once the order is active",
        state: order.invoiceStatus
          ? getInvoiceStatusLabel(order.invoiceStatus)
          : "",
        exists: Boolean(order.invoiceId),
        invoiceId: order.invoiceId
      }
    ].map((record) => ({
      ...record,
      itemClass: record.exists ? "rq-item" : "rq-item rq-off"
    }));
  }

  get document() {
    return getOrderDocument(this.order);
  }

  get cancelNote() {
    return this.order.cancelReason
      ? `Cancelled: ${this.order.cancelReason}`
      : "";
  }

  // ---------------------------------------------------------------- actions

  get reasonFieldClass() {
    return this.reasonError ? "rq-field rq-invalid" : "rq-field";
  }

  get confirmClass() {
    return this.dialog.danger ? "rq-btn rq-danger" : "rq-btn rq-primary";
  }

  openDialog(event) {
    const { kind } = event.currentTarget.dataset;
    this._trigger = event.currentTarget;
    this.reason = "";
    this.reasonError = "";
    this.dialog = { kind, ...DIALOGS[kind] };
  }

  handleReason(event) {
    this.reason = event.target.value;
  }

  confirmDialog() {
    if (this.busy) {
      return;
    }
    const { kind, toast } = this.dialog;
    const { id } = this.order;
    let work;
    if (kind === "activate") {
      work = activateOrder(id);
    } else if (kind === "invoice") {
      work = invoiceOrder(id).then((invoiceId) => {
        this.refs.toast.show(toast, "success");
        this[NavigationMixin.Navigate](invoicePage(invoiceId));
      });
    } else {
      const reason = this.reason.trim();
      if (!reason) {
        this.reasonError = "Say why, for the audit trail.";
        return;
      }
      work = cancelOrder(id, reason);
    }
    this.busy = true;
    work
      .then(() => {
        if (kind !== "invoice") {
          this.refs.toast.show(toast, "success");
        }
        this.refs.dialogModal.close();
      })
      .catch((error) => this.refs.toast.show(errorMessage(error), "error"))
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

  openPreview(event) {
    this._trigger = event.currentTarget;
    this.previewing = true;
  }

  closePreview() {
    this.previewing = false;
    this._trigger.focus();
  }

  openEdit() {
    this.editForm = {
      orderDate: this.order.orderDate ? inputDate(this.order.orderDate) : "",
      terms: this.order.terms || "",
      reference: this.order.opportunity || "",
      region: this.order.state || "",
      notes: this.order.notes || ""
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

  async saveEditOrder() {
    this.editBusy = true;
    try {
      await saveOrder(this.order.id, {
        orderDate: this.editForm.orderDate || null,
        terms: this.editForm.terms || null,
        reference: this.editForm.reference || null,
        region: this.editForm.region || null,
        notes: this.editForm.notes || null
      });
      this.isEditing = false;
      this.template.querySelector("c-revquila-toast")?.show("Order updated", "accent");
    } catch (err) {
      this.template.querySelector("c-revquila-toast")?.show(errorMessage(err), "bad");
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

  openInvoice() {
    this[NavigationMixin.Navigate](invoicePage(this.order.invoiceId));
  }

  openRelated(event) {
    const { quote, contract, subscription, invoice } =
      event.currentTarget.dataset;
    let page;
    if (quote) {
      page = quotePage(quote);
    } else if (contract) {
      page = contractPage(contract);
    } else if (subscription) {
      page = subscriptionPage(subscription);
    } else {
      page = invoicePage(invoice);
    }
    this[NavigationMixin.Navigate](page);
  }

  goToOrders() {
    this[NavigationMixin.Navigate](ORDERS_PAGE);
  }
}