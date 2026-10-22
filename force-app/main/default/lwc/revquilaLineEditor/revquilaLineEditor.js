import { LightningElement, api } from "lwc";
import { getConfig } from "c/revquilaConfig";
import {
  CUSTOM_PRODUCT,
  bundleLines,
  errorMessage,
  getProducts,
  loadProducts,
  onDataChange,
  priceLines
} from "c/revquilaData";
import { formatMoney, marketOf } from "c/revquilaTax";

let nextRowId = 0;

function toRow(line) {
  nextRowId += 1;
  const custom = line.productKey === CUSTOM_PRODUCT;
  return {
    id: `row-${nextRowId}`,
    productKey: line.productKey,
    bundleKey: line.bundleKey || "",
    required: Boolean(line.required),
    name: custom ? line.name : "",
    unit: custom ? line.unit : "",
    price: custom ? String(line.price) : "",
    qty: String(line.qty),
    discount: String(line.discount)
  };
}

function wholeNumber(text) {
  const value = Number(text);
  return text !== "" && Number.isInteger(value) ? value : NaN;
}

// How many products are offered as one-tap additions
const SUGGESTIONS = 6;

/**
 * The products on a quote: add, remove and change lines, with the totals, the tax
 * and the pricing policy worked out as you type.
 *
 * lines     the lines to start from: [{ productKey, qty, discount }], plus { name, unit, price }
 *           when productKey is CUSTOM_PRODUCT (c/revquilaData). productKey is the product's id.
 * region    the customer's state or province, which decides the tax
 * country   the customer's country (a code), which decides the tax system and the currency
 * terms     the payment terms, which the pricing policy also looks at
 * validate() shows any problems and returns whether the lines can be saved
 * Fires `change` with { lines, valid } after every edit.
 *
 * The totals here are a preview at today's list prices. The server prices the quote again when it is saved.
 */
export default class RevquilaLineEditor extends LightningElement {
  @api region;
  @api terms;
  @api country;

  rows = [];
  // the products that can be sold: active, with a standard price
  products = getProducts();
  productsError = "";
  bulkDiscount = "";
  showErrors = false;

  _unsubscribe;

  connectedCallback() {
    this._unsubscribe = onDataChange(() => {
      this.products = getProducts();
    });
    loadProducts().catch((error) => {
      this.productsError = errorMessage(error);
    });
  }

  disconnectedCallback() {
    this._unsubscribe();
  }

  @api
  get lines() {
    return this.cleanLines();
  }

  // A parent usually hands back what `change` gave it. Only lines that differ from the
  // ones on screen replace the rows, so typing is never interrupted.
  set lines(value) {
    if (value && JSON.stringify(value) !== JSON.stringify(this.cleanLines())) {
      this.rows = value.map(toRow);
    }
  }

  @api
  validate() {
    this.showErrors = true;
    return this.isValid;
  }

  get limit() {
    return getConfig().pricing.discountLimit;
  }

  // the market the lines are priced in: its currency, number format and exchange rate
  get market() {
    return marketOf(this.country);
  }

  get money() {
    return { tax: this.market };
  }

  problemsOf(row) {
    const problems = {};
    const qty = wholeNumber(row.qty);
    const discount = Number(row.discount);
    if (!(qty >= 1)) {
      problems.qty = "Whole number, 1 or more";
    }
    if (row.discount === "" || !(discount >= 0 && discount <= 100)) {
      problems.discount = "0 to 100";
    }
    if (row.productKey === CUSTOM_PRODUCT) {
      if (!row.name.trim()) {
        problems.name = "Name the item";
      }
      if (row.price === "" || !(Number(row.price) >= 0)) {
        problems.price = "Enter a price";
      }
    } else if (this.isRetired(row.productKey)) {
      problems.product = "This product is no longer sold: pick another";
    }
    return problems;
  }

  productOf(key) {
    return this.products.find((product) => product.key === key);
  }

  // Not among the products that can be sold. Until they have loaded, nothing counts as retired.
  isRetired(key) {
    return this.products.length > 0 && !this.productOf(key);
  }

  get isValid() {
    return (
      this.rows.length > 0 &&
      this.rows.every((row) => Object.keys(this.problemsOf(row)).length === 0)
    );
  }

  // What the rows mean as numbers. A field that cannot be read counts as 0 so the totals still show.
  cleanLines() {
    return this.rows.map((row) => {
      const line = {
        productKey: row.productKey,
        qty: Math.max(0, wholeNumber(row.qty) || 0),
        discount: Math.min(100, Math.max(0, Number(row.discount) || 0))
      };
      if (row.bundleKey) {
        line.bundleKey = row.bundleKey;
        line.required = row.required;
      }
      if (row.productKey === CUSTOM_PRODUCT) {
        line.name = row.name.trim() || "Custom item";
        line.unit = row.unit.trim();
        line.price = Math.max(0, Number(row.price) || 0);
      }
      return line;
    });
  }

  get priced() {
    return priceLines(this.cleanLines(), this.region, this.terms, this.country);
  }

  get rowViews() {
    const { lines } = this.priced;
    return this.rows.map((row, index) => {
      const problems = this.showErrors ? this.problemsOf(row) : {};
      const custom = row.productKey === CUSTOM_PRODUCT;
      const product = this.productOf(row.productKey);
      const over = lines[index].discount > this.limit;
      // a bundle is added from the adders, which is where its options come in
      const options = this.products
        .filter((item) => !item.bundle)
        .map((item) => ({
          key: item.key,
          label: item.name,
          selected: item.key === row.productKey
        }));
      // a line whose product was retired still shows what it was
      if (!custom && this.isRetired(row.productKey)) {
        options.unshift({
          key: row.productKey,
          label: `${lines[index].name} (no longer sold)`,
          selected: true
        });
      }
      return {
        ...row,
        custom,
        position: index + 1,
        unitLabel: product ? product.unit : "",
        priceLabel: product ? formatMoney(lines[index].price, this.money) : "",
        netLabel: formatMoney(lines[index].net, this.money),
        // what the price rules add for the quantity, and the bundle the line came with
        ruleNote: lines[index].ruleDiscount
          ? `+${lines[index].ruleDiscount}% volume`
          : "",
        bundleNote: lines[index].bundleName
          ? `${lines[index].bundleName}${row.required ? " · required" : ""}`
          : "",
        removeDisabled: row.required,
        options: options.concat({
          key: CUSTOM_PRODUCT,
          label: "Custom item…",
          selected: custom
        }),
        qtyClass: problems.qty ? "rq-input rq-bad-input" : "rq-input",
        discountClass: `rq-input${problems.discount ? " rq-bad-input" : ""}${over ? " rq-over" : ""}`,
        nameClass: problems.name ? "rq-input rq-bad-input" : "rq-input",
        priceClass: problems.price ? "rq-input rq-bad-input" : "rq-input",
        problem: Object.values(problems).join(" · "),
        removeLabel: `Remove line ${index + 1}`
      };
    });
  }

  get hasRows() {
    return this.rows.length > 0;
  }

  get needsLine() {
    return this.showErrors && !this.hasRows;
  }

  // Bundles, then products that are not on the quote yet, as one-tap additions
  get suggestions() {
    const used = new Set(this.rows.map((row) => row.productKey));
    const { exchangeRate } = this.market;
    const bundles = this.products
      .filter((product) => product.bundle && product.options.length > 0)
      .map((product) => ({
        key: product.key,
        label: product.name,
        price: `${product.options.length} products`,
        addClass: "rq-add rq-add-bundle"
      }));
    const singles = this.products
      .filter((product) => !product.bundle && !used.has(product.key))
      .slice(0, SUGGESTIONS)
      .map((product) => ({
        key: product.key,
        label: product.name,
        price: formatMoney(product.price * exchangeRate, this.money),
        addClass: "rq-add"
      }));
    return bundles.concat(singles);
  }

  get totals() {
    const { subtotal, discountTotal, net, taxLines, total } = this.priced;
    const taxed = getConfig().tax.mode !== "none";
    const rows = [
      { label: "Subtotal", value: formatMoney(subtotal, this.money) }
    ];
    if (discountTotal) {
      rows.push({
        label: "Discount",
        value: `− ${formatMoney(discountTotal, this.money)}`
      });
    }
    if (taxed) {
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
      label: "Total",
      value: formatMoney(total, this.money),
      grand: true
    });
    return rows.map((row) => ({
      ...row,
      rowClass: row.grand ? "rq-row rq-grand" : "rq-row"
    }));
  }

  get overLimit() {
    return this.priced.maxDiscount > this.limit;
  }

  get policy() {
    const { policyIssue } = this.priced;
    const { approver } = getConfig().pricing;
    if (!policyIssue) {
      return {
        text: `Within policy: discounts up to ${this.limit}% need no approval.`,
        noteClass: "rq-policy rq-tone-good"
      };
    }
    return {
      text: `${policyIssue}. This quote will go ${approver ? `to ${approver} ` : ""}for approval.`,
      noteClass: "rq-policy rq-tone-warn"
    };
  }

  get capLabel() {
    return `Cap discounts at ${this.limit}%`;
  }

  changed() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { lines: this.cleanLines(), valid: this.isValid }
      })
    );
  }

  update(id, changes) {
    this.rows = this.rows.map((row) => {
      return row.id === id ? { ...row, ...changes } : row;
    });
    this.changed();
  }

  handleField(event) {
    const { id, field } = event.target.dataset;
    this.update(id, { [field]: event.target.value });
  }

  handleProduct(event) {
    const { id } = event.target.dataset;
    const productKey = event.target.value;
    this.update(id, {
      productKey,
      name: "",
      unit: productKey === CUSTOM_PRODUCT ? "one-time" : "",
      price: ""
    });
  }

  addRow(line) {
    this.rows = [...this.rows, toRow(line)];
    this.changed();
  }

  handleSuggestion(event) {
    const { key } = event.currentTarget.dataset;
    const product = this.productOf(key);
    if (product && product.bundle) {
      this.rows = [...this.rows, ...bundleLines(product).map(toRow)];
      this.changed();
      return;
    }
    this.addRow({ productKey: key, qty: 1, discount: 0 });
  }

  handleAddCustom() {
    this.addRow({
      productKey: CUSTOM_PRODUCT,
      name: "",
      unit: "one-time",
      price: "",
      qty: 1,
      discount: 0
    });
  }

  handleRemove(event) {
    const { id } = event.currentTarget.dataset;
    this.rows = this.rows.filter((row) => row.id !== id);
    this.changed();
  }

  handleBulkInput(event) {
    this.bulkDiscount = event.target.value;
  }

  setEveryDiscount(pick) {
    this.rows = this.rows.map((row) => ({ ...row, discount: pick(row) }));
    this.changed();
  }

  handleBulkApply() {
    const discount = Number(this.bulkDiscount);
    if (this.bulkDiscount === "" || !(discount >= 0 && discount <= 100)) {
      return;
    }
    this.setEveryDiscount(() => String(discount));
  }

  handleCap() {
    this.setEveryDiscount((row) => {
      return Number(row.discount) > this.limit
        ? String(this.limit)
        : row.discount;
    });
  }
}