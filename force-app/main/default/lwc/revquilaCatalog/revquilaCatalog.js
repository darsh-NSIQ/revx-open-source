import { LightningElement } from "lwc";
import { fillPage } from "c/revquilaFill";
import { paginate } from "c/revquilaPaging";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  canManageCatalog,
  errorMessage,
  getProducts,
  loadProducts,
  onDataChange,
  retireProduct,
  saveBundleOptions,
  saveProduct
} from "c/revquilaData";
import { formatMoney, formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const ALL = "all";
const PAGE_SIZE = 12;
const UNITS = [
  "per user, yearly",
  "per user, monthly",
  "yearly",
  "monthly",
  "one-time",
  "per hour",
  "per unit"
];

function emptyProduct() {
  return {
    id: "",
    name: "",
    code: "",
    family: "",
    unit: UNITS[0],
    price: "",
    recurring: true,
    bundle: false
  };
}

/**
 * The Catalog tab: every product and bundle with its list price, grouped by family.
 * With the Revquila Admin permission set, products and bundles are added and changed here.
 */
export default class RevquilaCatalog extends LightningElement {
  products = [];
  loading = true;
  loadError = "";
  canManage = false;
  search = "";
  family = ALL;
  page = 1;
  // { kind: "product" | "options", … } while a form is open
  modal;
  form = emptyProduct();
  options = [];
  errors = {};
  busy = false;
  saveError = "";

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
    this.products = getProducts();
    this.canManage = canManageCatalog();
  }

  // ---------------------------------------------------------------- what the page shows

  get singles() {
    return this.products.filter((product) => !product.bundle);
  }

  get bundles() {
    return this.products.filter((product) => product.bundle);
  }

  get stats() {
    const recurring = this.singles.filter((product) => product.recurring);
    const families = new Set(
      this.singles.map((product) => product.family).filter(Boolean)
    );
    return [
      {
        label: "Products",
        value: String(this.singles.length),
        note: `${countOf(families.size, "family", "families")}`
      },
      {
        label: "Recurring",
        value: String(recurring.length),
        note: "Start a subscription when signed",
        tone: "good"
      },
      {
        label: "Bundles",
        value: String(this.bundles.length),
        note: "Added to a quote in one tap",
        tone: "teal"
      },
      {
        label: "Highest list price",
        value: this.singles.length
          ? formatMoneyCompact(
              Math.max(...this.singles.map((product) => product.price))
            )
          : "None",
        note: "In the home currency"
      }
    ].map((stat, index) => ({
      ...stat,
      cardClass: `rq-card rq-lift rq-stat rq-rise rq-d${index + 2}${stat.tone ? ` rq-tone-${stat.tone}` : ""}`
    }));
  }

  get chips() {
    const counts = {};
    this.singles.forEach((product) => {
      const family = product.family || "Other";
      counts[family] = (counts[family] || 0) + 1;
    });
    return [
      { key: ALL, label: "All", count: this.singles.length },
      ...Object.keys(counts)
        .sort()
        .map((family) => ({
          key: family,
          label: family,
          count: counts[family]
        }))
    ].map((chip) => {
      const selected = chip.key === this.family;
      return {
        ...chip,
        chipClass: selected ? "rq-chip rq-on" : "rq-chip",
        pressed: selected ? "true" : "false"
      };
    });
  }

  get visible() {
    const term = this.search.trim().toLowerCase();
    return this.singles.filter((product) => {
      const inFamily =
        this.family === ALL || (product.family || "Other") === this.family;
      const inSearch =
        !term ||
        [product.name, product.code, product.family].some((text) =>
          (text || "").toLowerCase().includes(term)
        );
      return inFamily && inSearch;
    });
  }

  get paging() {
    const paged = paginate(this.visible, this.page, PAGE_SIZE, 6);
    paged.rows = paged.rows.map((product) => ({
      ...product,
      priceLabel: formatMoney(product.price),
      family: product.family || "Other",
      kindLabel: product.recurring ? "Recurring" : "One-time",
      kindClass: `rq-pill rq-tone-${product.recurring ? "good" : "mut"}`,
      cardClass: "rq-card rq-lift rq-product rq-rise"
    }));
    return paged;
  }

  get pageSize() {
    return PAGE_SIZE;
  }

  get hasProducts() {
    return this.visible.length > 0;
  }

  get isEmpty() {
    return !this.loading && !this.loadError && this.products.length === 0;
  }

  get noMatch() {
    return !this.loading && this.products.length > 0 && !this.hasProducts;
  }

  get bundleCards() {
    return this.bundles.map((bundle) => {
      const options = bundle.options.map((option) => {
        const product = this.products.find(
          (candidate) => candidate.key === option.productKey
        );
        return {
          ...option,
          key: option.id || option.productKey,
          label: `${option.qty} × ${option.name}`,
          note: [
            product ? formatMoney(product.price) : "",
            option.required ? "required" : ""
          ]
            .filter(Boolean)
            .join(" · ")
        };
      });
      const value = bundle.options.reduce((total, option) => {
        const product = this.products.find(
          (candidate) => candidate.key === option.productKey
        );
        return total + (product ? product.price * option.qty : 0);
      }, 0);
      return {
        ...bundle,
        options,
        countLabel: countOf(options.length, "product"),
        valueLabel: `${formatMoney(value)} at list`,
        hasOptions: options.length > 0
      };
    });
  }

  get hasBundles() {
    return this.bundles.length > 0;
  }

  get summary() {
    return countOf(this.visible.length, "product");
  }

  // ---------------------------------------------------------------- the product form

  get modalHeading() {
    if (this.modal.kind === "options") {
      return `Products in ${this.modal.bundle.name}`;
    }
    return this.form.id ? `Edit ${this.form.name}` : "New product";
  }

  get isProductForm() {
    return this.modal.kind === "product";
  }

  get isOptionsForm() {
    return this.modal.kind === "options";
  }

  get unitOptions() {
    const all = UNITS.includes(this.form.unit)
      ? UNITS
      : [this.form.unit, ...UNITS];
    return all.map((unit) => ({ unit, selected: unit === this.form.unit }));
  }

  get nameFieldClass() {
    return this.errors.name ? "rq-field rq-invalid" : "rq-field";
  }

  get priceFieldClass() {
    return this.errors.price ? "rq-field rq-invalid" : "rq-field";
  }

  get saveLabel() {
    if (this.busy) {
      return "Saving…";
    }
    return this.modal.kind === "options" ? "Save bundle" : "Save product";
  }

  get optionRows() {
    return this.options.map((option, index) => ({
      ...option,
      choices: this.singles.map((product) => ({
        key: product.key,
        label: product.name,
        selected: product.key === option.productKey
      })),
      removeLabel: `Remove option ${index + 1}`
    }));
  }

  get canAddOption() {
    return this.singles.length > 0;
  }

  openNew(event) {
    this._trigger = event.currentTarget;
    this.form = emptyProduct();
    this.errors = {};
    this.saveError = "";
    this.modal = { kind: "product" };
  }

  openEdit(event) {
    const product = this.products.find(
      (candidate) => candidate.key === event.currentTarget.dataset.key
    );
    this._trigger = event.currentTarget;
    this.form = {
      id: product.key,
      name: product.name,
      code: product.code,
      family: product.family,
      unit: product.unit,
      price: String(product.price),
      recurring: product.recurring,
      bundle: product.bundle
    };
    this.errors = {};
    this.saveError = "";
    this.modal = { kind: "product" };
  }

  openOptions(event) {
    const bundle = this.products.find(
      (candidate) => candidate.key === event.currentTarget.dataset.key
    );
    this._trigger = event.currentTarget;
    this.options = bundle.options.map((option, index) => ({
      id: `option-${index}`,
      productKey: option.productKey,
      qty: String(option.qty),
      required: option.required
    }));
    this.saveError = "";
    this.modal = { kind: "options", bundle };
  }

  handleField(event) {
    const { field } = event.target.dataset;
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    this.form = { ...this.form, [field]: value };
  }

  handleOptionField(event) {
    const { id, field } = event.target.dataset;
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    this.options = this.options.map((option) => {
      return option.id === id ? { ...option, [field]: value } : option;
    });
  }

  addOption() {
    this.options = [
      ...this.options,
      {
        id: `option-${Date.now()}`,
        productKey: this.singles[0].key,
        qty: "1",
        required: false
      }
    ];
  }

  removeOption(event) {
    const { id } = event.currentTarget.dataset;
    this.options = this.options.filter((option) => option.id !== id);
  }

  validateProduct() {
    const errors = {};
    if (!this.form.name.trim()) {
      errors.name = "Name the product.";
    }
    if (this.form.price === "" || !(Number(this.form.price) >= 0)) {
      errors.price = "Enter the list price, 0 or more.";
    }
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  handleSave() {
    if (this.busy) {
      return;
    }
    let work;
    if (this.modal.kind === "options") {
      const bad = this.options.some(
        (option) => !(Number(option.qty) >= 1) || !option.productKey
      );
      if (bad) {
        this.saveError = "Every product needs a quantity of 1 or more.";
        return;
      }
      work = saveBundleOptions(
        this.modal.bundle.key,
        this.options.map((option) => ({
          productKey: option.productKey,
          qty: Number(option.qty),
          required: option.required
        }))
      );
    } else {
      if (!this.validateProduct()) {
        return;
      }
      work = saveProduct({
        id: this.form.id || null,
        name: this.form.name.trim(),
        code: this.form.code.trim(),
        family: this.form.family.trim(),
        unit: this.form.unit,
        price: Number(this.form.price),
        recurring: this.form.recurring,
        bundle: this.form.bundle
      });
    }
    this.busy = true;
    this.saveError = "";
    work
      .then(() => {
        this.refs.toast.show("Catalog updated", "success");
        this.refs.modal.close();
      })
      .catch((error) => {
        this.saveError = errorMessage(error);
      })
      .finally(() => {
        this.busy = false;
      });
  }

  handleRetire(event) {
    const { key } = event.currentTarget.dataset;
    const product = this.products.find((candidate) => candidate.key === key);
    retireProduct(key)
      .then(() =>
        this.refs.toast.show(`${product.name} retired from the catalog`)
      )
      .catch((error) => this.refs.toast.show(errorMessage(error), "error"));
  }

  cancelModal() {
    this.refs.modal.close();
  }

  closeModal() {
    this.modal = undefined;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  // ---------------------------------------------------------------- filters

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  handleSearch(event) {
    this.search = event.target.value;
    this.page = 1;
  }

  handleFamily(event) {
    this.family = event.currentTarget.dataset.key;
    this.page = 1;
  }

  clearFilters() {
    this.family = ALL;
    this.search = "";
    this.page = 1;
  }

  handlePage(event) {
    this.page = event.detail.page;
  }
}