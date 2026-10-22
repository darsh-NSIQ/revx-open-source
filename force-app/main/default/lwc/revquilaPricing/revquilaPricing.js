import { LightningElement } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { getConfig } from "c/revquilaConfig";
import { SETUP_PAGE } from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  canManageCatalog,
  deletePriceRule,
  errorMessage,
  getProducts,
  getRules,
  loadProducts,
  onDataChange,
  ruleDiscountFor,
  savePriceRule
} from "c/revquilaData";
import { formatMoney, getMarkets } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const ANY = "";

function emptyRule() {
  return {
    id: "",
    name: "",
    productKey: ANY,
    minQty: "",
    discount: "",
    active: true,
    note: ""
  };
}

/**
 * The Pricing tab: the pricing policy at a glance, the volume price rules, the currencies
 * quotes are priced in, and a calculator to try a quantity. Rules are changed here with
 * the Revquila Admin permission set; the policy and the currencies live in Setup.
 */
export default class RevquilaPricing extends NavigationMixin(LightningElement) {
  rules = [];
  products = [];
  loading = true;
  loadError = "";
  canManage = false;
  // the calculator
  tryProduct = "";
  tryQty = "10";
  // the rule form
  modal;
  form = emptyRule();
  errors = {};
  busy = false;
  saveError = "";
  deleting;

  _unsubscribe;
  _releasePage;
  _trigger;

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this._unsubscribe = onDataChange(() => this.show());
    loadProducts()
      .catch((error) => {
        this.loadError = errorMessage(error);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  disconnectedCallback() {
    this._releasePage();
    this._unsubscribe();
  }

  show() {
    this.rules = getRules();
    this.products = getProducts().filter((product) => !product.bundle);
    this.canManage = canManageCatalog();
    if (!this.tryProduct && this.products.length) {
      this.tryProduct = this.products[0].key;
    }
  }

  // ---------------------------------------------------------------- policy and currencies

  get policy() {
    const { discountLimit, standardTerms, quoteValidDays } =
      getConfig().pricing;
    return [
      {
        label: "Discount limit",
        value: `${discountLimit}%`,
        note: "A rep's discount above this needs approval"
      },
      {
        label: "Standard terms",
        value: standardTerms,
        note: "Other payment terms need approval",
        tone: "acc"
      },
      {
        label: "Quote validity",
        value: countOf(quoteValidDays, "day"),
        note: "How long list prices hold"
      },
      {
        label: "Volume rules",
        value: String(this.rules.filter((rule) => rule.active).length),
        note: "Discounts given without approval",
        tone: "good"
      }
    ].map((stat, index) => ({
      ...stat,
      cardClass: `rq-card rq-lift rq-stat rq-rise rq-d${index + 2}${stat.tone ? ` rq-tone-${stat.tone}` : ""}`
    }));
  }

  get markets() {
    return getMarkets().map((market, index) => ({
      key: market.country,
      name: market.countryName,
      currency: market.currency,
      tax:
        market.mode === "none" ? "No tax" : `${market.system} ${market.rate}%`,
      rate:
        index === 0
          ? "Home currency"
          : `1 ${getMarkets()[0].currency} = ${market.exchangeRate} ${market.currency}`,
      sample: formatMoney(
        (this.products[0] ? this.products[0].price : 100000) *
          market.exchangeRate,
        { tax: market }
      )
    }));
  }

  get sampleName() {
    return this.products[0] ? this.products[0].name : "a product";
  }

  // ---------------------------------------------------------------- rules

  get ruleRows() {
    return this.rules.map((rule) => ({
      ...rule,
      product: rule.productName || "Any product",
      from: `${countOf(rule.minQty, "unit")} and up`,
      discountLabel: `${rule.discount}%`,
      stateLabel: rule.active ? "Active" : "Off",
      stateClass: `rq-pill rq-tone-${rule.active ? "good" : "mut"}`
    }));
  }

  get hasRules() {
    return this.rules.length > 0;
  }

  get noRules() {
    return !this.loading && !this.loadError && !this.hasRules;
  }

  // ---------------------------------------------------------------- calculator

  get tryOptions() {
    return this.products.map((product) => ({
      key: product.key,
      label: product.name,
      selected: product.key === this.tryProduct
    }));
  }

  get tryResult() {
    const product = this.products.find(
      (candidate) => candidate.key === this.tryProduct
    );
    const qty = Math.max(0, Math.floor(Number(this.tryQty) || 0));
    if (!product || !qty) {
      return undefined;
    }
    const discount = ruleDiscountFor(product.key, qty);
    const list = product.price * qty;
    const net = list * (1 - discount / 100);
    const rules = this.rules.filter(
      (rule) =>
        rule.active &&
        (!rule.productKey || rule.productKey === product.key) &&
        qty >= rule.minQty
    );
    return {
      discount: discount ? `${discount}% off` : "No volume discount",
      list: formatMoney(list),
      net: formatMoney(net),
      saving: discount ? `− ${formatMoney(list - net)}` : "",
      rule: rules.length
        ? `From ${rules.map((rule) => rule.name).join(", ")}`
        : "No rule reaches this quantity",
      verdictClass: `rq-pill rq-tone-${discount ? "good" : "mut"}`
    };
  }

  handleTryProduct(event) {
    this.tryProduct = event.target.value;
  }

  handleTryQty(event) {
    this.tryQty = event.target.value;
  }

  // ---------------------------------------------------------------- the rule form

  get modalHeading() {
    return this.form.id ? `Edit ${this.form.name}` : "New price rule";
  }

  get productOptions() {
    return [{ key: ANY, label: "Any product" }]
      .concat(
        this.products.map((product) => ({
          key: product.key,
          label: product.name
        }))
      )
      .map((option) => ({
        ...option,
        selected: option.key === this.form.productKey
      }));
  }

  get nameFieldClass() {
    return this.errors.name ? "rq-field rq-invalid" : "rq-field";
  }

  get qtyFieldClass() {
    return this.errors.minQty ? "rq-field rq-invalid" : "rq-field";
  }

  get discountFieldClass() {
    return this.errors.discount ? "rq-field rq-invalid" : "rq-field";
  }

  get saveLabel() {
    return this.busy ? "Saving…" : "Save rule";
  }

  openNew(event) {
    this._trigger = event.currentTarget;
    this.form = emptyRule();
    this.errors = {};
    this.saveError = "";
    this.modal = { kind: "rule" };
  }

  openEdit(event) {
    const rule = this.rules.find(
      (candidate) => candidate.id === event.currentTarget.dataset.id
    );
    this._trigger = event.currentTarget;
    this.form = {
      id: rule.id,
      name: rule.name,
      productKey: rule.productKey,
      minQty: String(rule.minQty),
      discount: String(rule.discount),
      active: rule.active,
      note: rule.note
    };
    this.errors = {};
    this.saveError = "";
    this.modal = { kind: "rule" };
  }

  openDelete(event) {
    this._trigger = event.currentTarget;
    this.deleting = this.rules.find(
      (candidate) => candidate.id === event.currentTarget.dataset.id
    );
    this.modal = { kind: "delete" };
  }

  get isRuleForm() {
    return this.modal.kind === "rule";
  }

  get isDelete() {
    return this.modal.kind === "delete";
  }

  handleField(event) {
    const { field } = event.target.dataset;
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    this.form = { ...this.form, [field]: value };
  }

  handleSave() {
    if (this.busy) {
      return;
    }
    const errors = {};
    const minQty = Number(this.form.minQty);
    const discount = Number(this.form.discount);
    if (!this.form.name.trim()) {
      errors.name = "Name the rule.";
    }
    if (!Number.isInteger(minQty) || minQty < 1) {
      errors.minQty = "A whole number, 1 or more.";
    }
    if (!(discount > 0 && discount <= 100)) {
      errors.discount = "Above 0, up to 100.";
    }
    this.errors = errors;
    if (Object.keys(errors).length) {
      return;
    }
    this.busy = true;
    this.saveError = "";
    savePriceRule({
      id: this.form.id,
      name: this.form.name.trim(),
      productKey: this.form.productKey,
      minQty,
      discount,
      active: this.form.active,
      note: this.form.note.trim()
    })
      .then(() => {
        this.refs.toast.show("Price rule saved", "success");
        this.refs.modal.close();
      })
      .catch((error) => {
        this.saveError = errorMessage(error);
      })
      .finally(() => {
        this.busy = false;
      });
  }

  confirmDelete() {
    if (this.busy) {
      return;
    }
    this.busy = true;
    deletePriceRule(this.deleting.id)
      .then(() => {
        this.refs.toast.show("Price rule deleted");
        this.refs.modal.close();
      })
      .catch((error) => this.refs.toast.show(errorMessage(error), "error"))
      .finally(() => {
        this.busy = false;
      });
  }

  cancelModal() {
    this.refs.modal.close();
  }

  closeModal() {
    this.modal = undefined;
    this.deleting = undefined;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  openSetup() {
    this[NavigationMixin.Navigate](SETUP_PAGE);
  }
}