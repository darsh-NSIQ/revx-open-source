import { LightningElement, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { getFieldValue, getRecord } from "lightning/uiRecordApi";
import FIRST_NAME from "@salesforce/schema/User.FirstName";
import USER_ID from "@salesforce/user/Id";
import { getConfigHistory } from "c/revquilaConfig";
import {
  APPROVALS_PAGE,
  CATALOG_PAGE,
  COMMAND_CENTER_PAGE,
  CONTRACTS_PAGE,
  INVOICES_PAGE,
  ORDERS_PAGE,
  PRICING_PAGE,
  QUOTES_PAGE,
  RENEWALS_PAGE,
  REVENUE_PAGE,
  SETUP_PAGE,
  SUBSCRIPTIONS_PAGE,
  GUIDED_SELLING_PAGE,
  USAGE_PAGE,
  DUNNING_PAGE,
  WAR_ROOM_PAGE
} from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  errorMessage,
  getContracts,
  getDashboard,
  getProducts,
  getRenewals,
  getRules,
  loadContracts,
  loadDashboard,
  loadProducts,
  loadSubscriptions,
  onDataChange
} from "c/revquilaData";
import { formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";

const PAGES = {
  catalog: CATALOG_PAGE,
  pricing: PRICING_PAGE,
  quotes: QUOTES_PAGE,
  approvals: APPROVALS_PAGE,
  orders: ORDERS_PAGE,
  contracts: CONTRACTS_PAGE,
  invoices: INVOICES_PAGE,
  revenue: REVENUE_PAGE,
  subscriptions: SUBSCRIPTIONS_PAGE,
  renewals: RENEWALS_PAGE,
  command: COMMAND_CENTER_PAGE,
  setup: SETUP_PAGE,
  guided: GUIDED_SELLING_PAGE,
  usage: USAGE_PAGE,
  dunning: DUNNING_PAGE,
  warroom: WAR_ROOM_PAGE
};

// The lifecycle phases, in the order a deal moves through them. A signed quote books the order and,
// for recurring lines, the contract and its subscription; billing then invoices what the order and
// subscription hold, and a renewal near the end of the term starts a new quote.
const PHASES = [
  {
    key: "product",
    label: "Product & price",
    path: "catalog → pricing",
    group: "cpq"
  },
  {
    key: "sell",
    label: "Quote & approve",
    path: "quote → approval",
    group: "cpq"
  },
  {
    key: "fulfil",
    label: "Order & contract",
    path: "order → contract",
    group: "cpq"
  },
  {
    key: "bill",
    label: "Subscribe & bill",
    path: "subscription → invoice",
    group: "rev"
  },
  { key: "renew", label: "Renew", path: "back to quotes ↺", group: "rev" }
];

// The journey: every app in that order, with its phase and group (blue CPQ, teal revenue)
const STEPS = [
  { key: "catalog", label: "Catalog", phase: "product", group: "cpq" },
  { key: "pricing", label: "Pricing", phase: "product", group: "cpq" },
  { key: "quotes", label: "Quotes", phase: "sell", group: "cpq" },
  { key: "approvals", label: "Approvals", phase: "sell", group: "cpq" },
  { key: "orders", label: "Orders", phase: "fulfil", group: "cpq" },
  { key: "contracts", label: "Contracts", phase: "fulfil", group: "cpq" },
  { key: "subscriptions", label: "Subscriptions", phase: "bill", group: "rev" },
  { key: "invoices", label: "Invoices", phase: "bill", group: "rev" },
  { key: "revenue", label: "Revenue", phase: "bill", group: "rev" },
  { key: "renewals", label: "Renewals", phase: "renew", group: "rev" }
];

const SETUP_AREAS = [
  "Company & branding",
  "Documents & PDF",
  "Tax & currency",
  "Pricing & approvals",
  "Billing",
  "Salesforce sync"
];

function sum(values) {
  return values.reduce((total, value) => total + (value || 0), 0);
}

/** The Home tab: every Revquila app as a step of the quote-to-cash journey, with a live figure on each. */
export default class RevquilaHome extends NavigationMixin(LightningElement) {
  loading = true;
  loadError = "";
  figures = {};
  kpis = [];
  liveVersion;

  _unsubscribe;
  _releasePage;

  @wire(getRecord, { recordId: USER_ID, fields: [FIRST_NAME] })
  user;

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this._unsubscribe = onDataChange(() => this.show());
    this.show();
    Promise.all([
      loadDashboard(),
      loadProducts(),
      loadContracts(),
      loadSubscriptions()
    ])
      .catch((error) => {
        this.loadError = errorMessage(error);
      })
      .finally(() => {
        this.loading = false;
      });
    getConfigHistory()
      .then((history) => {
        this.liveVersion = history.length ? history[0].version : undefined;
      })
      .catch(() => {});
  }

  disconnectedCallback() {
    this._releasePage();
    this._unsubscribe();
  }

  // One figure per app, from what has loaded so far; a dash until it has
  show() {
    const dashboard = getDashboard();
    const products = getProducts().filter((product) => !product.bundle);
    const rules = getRules().filter((rule) => rule.active);
    const contracts = getContracts().filter(
      (contract) => contract.status === "active"
    );
    const renewals = getRenewals();
    const figures = {
      catalog: products.length ? countOf(products.length, "product") : "",
      pricing: countOf(rules.length, "rule"),
      contracts: `${contracts.length} active`,
      renewals: `${renewals.length} in 90 days`
    };
    if (dashboard) {
      const counts = dashboard.quoteCounts || {};
      const open = sum(
        ["draft", "approval", "approved", "rejected", "sent", "signed"].map(
          (status) => counts[status]
        )
      );
      figures.quotes = `${open} open`;
      figures.approvals = counts.approval
        ? `${counts.approval} waiting`
        : "Nothing waiting";
      figures.approvalsHot = Boolean(counts.approval);
      figures.orders = `${dashboard.ordersOpen || 0} open`;
      figures.invoices = `${dashboard.invoicesOpen || 0} unpaid`;
      figures.subscriptions = `${formatMoneyCompact(dashboard.mrr)} MRR`;
      figures.revenue = "ASC 606";
      this.kpis = [
        { label: "MRR", value: formatMoneyCompact(dashboard.mrr) },
        {
          label: `Collected · ${dashboard.collectedDays} d`,
          value: formatMoneyCompact(dashboard.collected)
        },
        { label: "Overdue", value: formatMoneyCompact(dashboard.overdue) }
      ];
    }
    this.figures = figures;
  }

  get greeting() {
    const hour = new Date().getHours();
    let salutation = "Good evening";
    if (hour < 12) {
      salutation = "Good morning";
    } else if (hour < 17) {
      salutation = "Good afternoon";
    }
    const firstName = getFieldValue(this.user.data, FIRST_NAME);
    return firstName ? `${salutation}, ${firstName}` : salutation;
  }

  get initials() {
    const firstName = getFieldValue(this.user.data, FIRST_NAME) || "";
    return firstName.slice(0, 1).toUpperCase() || "R";
  }

  get hasKpis() {
    return this.kpis.length > 0;
  }

  get setupNote() {
    return this.liveVersion
      ? `Version ${this.liveVersion} live · one place for every setting`
      : "Running on the defaults · one place for every setting";
  }

  get setupAreas() {
    return SETUP_AREAS;
  }

  get steps() {
    return STEPS.map((step, index) => {
      const hot = step.key === "approvals" && this.figures.approvalsHot;
      return {
        ...step,
        number: index + 1,
        figure: this.figures[step.key] || "—",
        stepClass: `rq-card rq-lift rq-step rq-rise rq-g-${hot ? "hot" : step.group}`,
        stepStyle: `--rq-i:${index + 3}`,
        [`is${step.key.charAt(0).toUpperCase()}${step.key.slice(1)}`]: true
      };
    });
  }

  // One band per phase, as wide as the steps above it
  get phases() {
    return PHASES.map((phase) => {
      const steps = STEPS.filter((step) => step.phase === phase.key).length;
      return {
        ...phase,
        bandClass: `rq-flow-group rq-g-${phase.group}`,
        bandStyle: `--rq-span:${steps}`
      };
    });
  }

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  openPage(event) {
    this[NavigationMixin.Navigate](PAGES[event.currentTarget.dataset.page]);
  }
}