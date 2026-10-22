import { LightningElement, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { getFieldValue, getRecord } from "lightning/uiRecordApi";
import FIRST_NAME from "@salesforce/schema/User.FirstName";
import USER_ID from "@salesforce/user/Id";
import { getConfig } from "c/revquilaConfig";
import {
  APPROVALS_PAGE,
  INVOICES_PAGE,
  ORDERS_PAGE,
  QUOTES_PAGE,
  RENEWALS_PAGE,
  REVENUE_PAGE,
  SUBSCRIPTIONS_PAGE,
  quotePage,
  subscriptionPage
} from "c/revquilaNav";
import { fillPage } from "c/revquilaFill";
import { clearSpotlight, moveSpotlight } from "c/revquilaSpotlight";
import {
  actOnQuote,
  errorMessage,
  getDashboard,
  loadDashboard,
  onDataChange
} from "c/revquilaData";
import { formatMoneyCompact } from "c/revquilaTax";
import { countOf } from "c/revquilaText";
import getDailyBriefingApex from "@salesforce/apex/RevquilaDailyBriefingJob.getDailyBriefing";

const PAGES = {
  quotes: QUOTES_PAGE,
  approvals: APPROVALS_PAGE,
  orders: ORDERS_PAGE,
  invoices: INVOICES_PAGE,
  revenue: REVENUE_PAGE,
  renewals: RENEWALS_PAGE,
  subscriptions: SUBSCRIPTIONS_PAGE
};

// The four figures, shown as dashes until the records are in
const FIGURES = [
  { id: "mrr", label: "MRR" },
  { id: "arr", label: "ARR" },
  { id: "cash", label: "Cash collected" },
  { id: "overdue", label: "Overdue" }
];

// Room around the plot for the tick labels (left) and month labels (bottom)
const INSET = { left: 58, right: 20, top: 20, bottom: 40 };
const COUNT_UP_MS = 1100;

// Round tick values that cover the data: [{ min, max, ticks }]
function scaleFor(values) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const rough = (high - low) / 3 || high || 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10]
    .map((multiple) => multiple * magnitude)
    .find((candidate) => candidate >= rough);
  const min = Math.floor(low / step) * step;
  const ticks = [min];
  while (ticks[ticks.length - 1] < high) {
    ticks.push(ticks[ticks.length - 1] + step);
  }
  return { min, max: ticks[ticks.length - 1], ticks };
}

function monthOf(day) {
  return new Intl.DateTimeFormat(getConfig().tax.locale, {
    month: "short"
  }).format(day);
}

// Lays the chart out for the space it has. One scale places the marks, ticks and labels.
function buildChart(points, width, height) {
  const scale = scaleFor(points.map((point) => point.value));
  const left = INSET.left;
  const right = width - INSET.right;
  const top = INSET.top;
  const bottom = height - INSET.bottom;
  const last = points.length - 1;
  const x = (index) => left + (index * (right - left)) / last;
  const y = (value) => {
    const share = (value - scale.min) / (scale.max - scale.min || 1);
    return bottom - share * (bottom - top);
  };
  const line = points
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`
    )
    .join(" ");
  const end = points[last];
  // The end label sits above the last point, or below it when the line comes down into
  // the point and there is room, so the line never runs through the figure
  const falling = end.value < points[last - 1].value;
  const below = falling && y(end.value) + 24 < bottom;
  return {
    width,
    height,
    left,
    right,
    tickX: left - 8,
    monthY: height - 16,
    gridLines: scale.ticks.map((value) => ({
      value,
      label: formatMoneyCompact(value),
      y: y(value),
      labelY: y(value) + 4
    })),
    months: points.map((point, index) => {
      let anchor = "middle";
      if (index === 0) {
        anchor = "start";
      } else if (index === last) {
        anchor = "end";
      }
      return { label: point.label, x: x(index), anchor };
    }),
    line,
    area: `${line} L${right} ${bottom} L${left} ${bottom}Z`,
    endLabel: formatMoneyCompact(end.value),
    endX: x(last),
    endY: y(end.value),
    endLabelX: x(last) - 10,
    endLabelY: y(end.value) + (below ? 24 : -12),
    summary: `MRR went from ${formatMoneyCompact(points[0].value)} in ${points[0].label} to ${formatMoneyCompact(end.value)} in ${end.label}`
  };
}

// A small line through the values, or nothing when there is no history to draw
function sparkPath(values) {
  if (values.length < 2 || values.every((value) => !value)) {
    return undefined;
  }
  const min = Math.min(...values);
  const spread = Math.max(...values) - min;
  return values
    .map((value, index) => {
      const x = 3 + (index * 90) / (values.length - 1);
      const y = spread ? 26 - ((value - min) / spread) * 22 : 15;
      return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

// How today's figure compares with the end of last month
function changeOf(values) {
  const now = values[values.length - 1];
  const before = values[values.length - 2];
  if (!before) {
    return {
      delta: "",
      note: now ? "New this month" : "Nothing recurring yet"
    };
  }
  const percent = ((now - before) / before) * 100;
  if (Math.abs(percent) < 0.05) {
    return { delta: "", note: "Same as the end of last month" };
  }
  return {
    delta: `${percent > 0 ? "▲" : "▼"} ${Math.abs(percent).toFixed(1)}%`,
    down: percent < 0,
    note: "since last month"
  };
}

export default class RevquilaCommandCenter extends NavigationMixin(
  LightningElement
) {
  kpis = [];
  stages = [];
  renewals = [];
  recentQuotes = [];
  approvals = [];
  collectedLabel = "";
  collectedTail = "";
  loading = true;
  loadError = "";
  // whether this user may approve and reject
  approver = false;
  showQuickQuote = false;
  rejecting;
  // Set once the chart area has been measured and there is MRR to draw
  chart;

  // 0 to 1 while the KPI figures count up
  _share = 1;
  _figures = FIGURES;
  _points = [];
  _plot;
  // The rows shown under approvals, by quote id, in the order they first appeared
  _rows = new Map();
  // Decisions made on this screen, so a decided row stays visible with its outcome
  _decided = {};
  _unsubscribe;
  _releasePage;
  _plotObserver;
  _frame;
  _started = false;
  _counted = false;
  _trigger;

  @wire(getRecord, { recordId: USER_ID, fields: [FIRST_NAME] })
  user;

  get greeting() {
    const hour = new Date().getHours();
    let salutation = "Good evening";
    if (hour < 12) {
      salutation = "Good morning";
    } else if (hour < 17) {
      salutation = "Good afternoon";
    }
    const firstName = getFieldValue(this.user.data, FIRST_NAME);
    return firstName ? `${salutation}, ${firstName}.` : `${salutation}.`;
  }

  get ready() {
    return !this.loading && !this.loadError;
  }

  get hasApprovals() {
    return this.approvals.length > 0;
  }

  get noApprovals() {
    return this.ready && !this.hasApprovals;
  }

  get caughtUp() {
    return this.approver
      ? "Nothing is waiting on you."
      : "No quote is waiting for approval.";
  }

  get approvalsNote() {
    return this.approver
      ? "Outside policy, waiting for your decision"
      : "Outside policy, waiting for an approver";
  }

  get hasQuotes() {
    return this.recentQuotes.length > 0;
  }

  get noQuotes() {
    return this.ready && !this.hasQuotes;
  }

  get hasRenewals() {
    return this.renewals.length > 0;
  }

  get noRenewals() {
    return this.ready && !this.hasRenewals;
  }

  // Loaded, and no subscription has billed anything in the six months
  get noRecurring() {
    return this.ready && !this._points.some((point) => point.value > 0);
  }

  get chartSubtitle() {
    return `${getConfig().tax.currency}, last six months`;
  }

  connectedCallback() {
    this._releasePage = fillPage(this.template.host);
    this.showKpis();
    this.loadBriefing();
    this._unsubscribe = onDataChange(() => this.show());
    loadDashboard()
      .catch((error) => {
        this.loadError = errorMessage(error);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  async loadBriefing() {
    try {
      const b = await getDailyBriefingApex();
      if (b) {
        this.briefing = {
          ...b,
          overdueLabel: formatMoneyCompact(b.overdueInvoicesAmount || 0),
          expiringLabel: formatMoneyCompact(b.expiringQuotesAmount || 0),
          renewalsLabel: formatMoneyCompact(b.renewalsDueAmount || 0)
        };
      }
    } catch (e) {
      // Non-blocking fallback
    }
  }

  openCommandPalette() {
    const cmd = this.template.querySelector("c-revquila-command-bar");
    if (cmd) cmd.open();
  }

  goToExceptions() {
    this[NavigationMixin.Navigate]({
      type: "standard__navItemPage",
      attributes: {
        apiName: "Revquila_Exception_Inbox"
      }
    });
  }

  renderedCallback() {
    if (this._started) {
      return;
    }
    this._started = true;
    // Redraw the chart whenever the space it has changes. A page Lightning has
    // hidden measures 0 by 0, so that is skipped.
    this._plotObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) {
        this._plot = { width: Math.round(width), height: Math.round(height) };
        this.drawChart();
      }
    });
    this._plotObserver.observe(this.refs.plot);
  }

  disconnectedCallback() {
    this._releasePage();
    this._unsubscribe();
    this._plotObserver.disconnect();
    cancelAnimationFrame(this._frame);
  }

  countUp() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / COUNT_UP_MS);
      this._share = 1 - Math.pow(1 - progress, 3);
      this.showKpis();
      if (progress < 1) {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._frame = requestAnimationFrame(tick);
      }
    };
    this._share = 0;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._frame = requestAnimationFrame(tick);
  }

  show() {
    const dashboard = getDashboard();
    if (!dashboard) {
      return;
    }
    this._dashboard = dashboard;
    this.approver = dashboard.canApprove;
    this.showFigures(dashboard);
    this.showStages(dashboard);
    this.recentQuotes = dashboard.recentQuotes;
    this.showApprovals(dashboard.waitingQuotes);
    this.renewals = dashboard.renewals.map((renewal) => {
      const { daysLeft } = renewal;
      let tone = "good";
      if (daysLeft <= 30) {
        tone = "bad";
      } else if (daysLeft <= 60) {
        tone = "warn";
      }
      const elapsed = Math.min(100, Math.max(8, 100 - daysLeft));
      return {
        id: renewal.id,
        account: renewal.account,
        daysLabel:
          daysLeft < 0
            ? `${countOf(-daysLeft, "day")} late`
            : countOf(daysLeft, "day"),
        pillClass: `rq-pill rq-tone-${tone}`,
        barClass: `rq-fill rq-tone-${tone}`,
        barStyle: `width:${elapsed}%`
      };
    });
    this._points = dashboard.mrrSeries.map((point) => ({
      label: monthOf(point.day),
      value: point.value
    }));
    this.drawChart();
    if (!this._counted) {
      this._counted = true;
      this.countUp();
    }
  }

  showFigures(dashboard) {
    const {
      mrr,
      collected,
      collectedCount,
      collectedDays,
      overdue,
      overdueCount
    } = dashboard;
    const recurring = dashboard.mrrSeries.map((point) => point.value);
    const change = changeOf(recurring);
    this.collectedLabel = `${formatMoneyCompact(collected)} collected`;
    this.collectedTail = `in the last ${collectedDays} days.`;
    this._figures = [
      { id: "mrr", label: "MRR", amount: mrr, ...change, trend: recurring },
      {
        id: "arr",
        label: "ARR",
        amount: mrr * 12,
        ...change,
        trend: recurring
      },
      {
        id: "cash",
        label: "Cash collected",
        amount: collected,
        note: `${countOf(collectedCount, "payment")}, last ${collectedDays} days`,
        // what came in each month, this month so far last
        trend: dashboard.collectedSeries.map((point) => point.value)
      },
      {
        id: "overdue",
        label: "Overdue",
        amount: overdue,
        note: overdueCount
          ? "past the due date"
          : "Nothing is past its due date",
        bad: overdueCount > 0,
        badge: overdueCount ? countOf(overdueCount, "invoice") : ""
      }
    ];
    this.showKpis();
  }

  showKpis() {
    this.kpis = this._figures.map((figure, index) => ({
      ...figure,
      display:
        figure.amount === undefined
          ? "—"
          : formatMoneyCompact(figure.amount * this._share),
      spark: figure.trend && sparkPath(figure.trend),
      cardClass: `rq-card rq-lift rq-kpi rq-rise rq-d${index + 2}${figure.bad ? " rq-bad" : ""}`,
      deltaClass: figure.bad || figure.down ? "rq-delta rq-bad" : "rq-delta"
    }));
  }

  showStages(dashboard) {
    const { quoteCounts, invoicesOpen, invoicesPaid, ordersOpen, deferred } = dashboard;
    const quotesIn = (...statuses) =>
      statuses.reduce((total, status) => total + (quoteCounts[status] || 0), 0);
    this.stages = [
      {
        id: "quotes",
        count: quotesIn("draft", "approved", "rejected"),
        label: "Quotes",
        page: "quotes"
      },
      {
        id: "approval",
        count: quotesIn("approval"),
        label: "Approval",
        page: "approvals",
        hot: true
      },
      { id: "sent", count: quotesIn("sent"), label: "Sent", page: "quotes" },
      {
        id: "signed",
        count: quotesIn("signed"),
        label: "Signed",
        page: "quotes"
      },
      {
        id: "orders",
        count: ordersOpen || 0,
        label: "Orders",
        page: "orders"
      },
      {
        id: "invoiced",
        count: invoicesOpen,
        label: "Invoiced",
        page: "invoices"
      },
      { id: "paid", count: invoicesPaid, label: "Paid", page: "invoices" },
      {
        id: "revenue",
        count: formatMoneyCompact(deferred || 0),
        label: "Deferred",
        page: "revenue"
      }
    ].map((stage) => ({
      ...stage,
      stageClass: stage.hot && stage.count ? "rq-st rq-hot" : "rq-st"
    }));
  }

  get deferredBalanceLabel() {
    return formatMoneyCompact(this._dashboard?.deferred || 0);
  }

  get winRateLabel() {
    const rate = this._dashboard?.winRate;
    return rate !== undefined ? `${Number(rate).toFixed(0)}%` : "—";
  }

  get arrRunRateLabel() {
    const arr = this._dashboard?.arr || (this._dashboard?.mrr || 0) * 12;
    return formatMoneyCompact(arr);
  }

  goToRevenue() {
    this[NavigationMixin.Navigate](PAGES.revenue);
  }

  showApprovals(waiting) {
    waiting.forEach((quote) =>
      this._rows.set(quote.id, {
        id: quote.id,
        account: quote.account,
        title: `${quote.account} · ${quote.amountLabel}`,
        detail: [quote.number, quote.policyIssue, quote.owner]
          .filter(Boolean)
          .join(" · ")
      })
    );
    const waitingIds = new Set(waiting.map((quote) => quote.id));
    this.approvals = [...this._rows.values()]
      .filter((row) => waitingIds.has(row.id) || this._decided[row.id])
      .map((row) => {
        const outcome = this._decided[row.id];
        return {
          ...row,
          outcome,
          outcomeClass: `rq-pill rq-tone-${outcome === "Approved" ? "good" : "bad"}`,
          rowClass: outcome ? "rq-ap rq-done" : "rq-ap"
        };
      });
  }

  drawChart() {
    if (!this._plot || !this._points.some((point) => point.value > 0)) {
      this.chart = undefined;
      return;
    }
    this.chart = buildChart(this._points, this._plot.width, this._plot.height);
  }

  handlePointerMove(event) {
    moveSpotlight(event);
  }

  handlePointerLeave() {
    clearSpotlight();
  }

  // Shows the outcome at once and takes it back if the server refuses
  decide(id, action, outcome, note) {
    const { account } = this._rows.get(id);
    this._decided[id] = outcome;
    this.show();
    return actOnQuote(id, action, note)
      .then(() => account)
      .catch((error) => {
        delete this._decided[id];
        this.show();
        this.refs.toast.show(errorMessage(error), "error");
      });
  }

  // One tap: no confirmation step, the toast is the receipt
  handleApprove(event) {
    const { id } = event.currentTarget.dataset;
    this.decide(id, "approve", "Approved").then((account) => {
      if (account) {
        this.refs.toast.show(`Approved ${account}`, "success");
      }
    });
  }

  openReject(event) {
    const { id } = event.currentTarget.dataset;
    this._trigger = event.currentTarget;
    this.rejecting = this._rows.get(id);
  }

  handleReject(event) {
    const { id } = this.rejecting;
    this.decide(id, "reject", "Rejected", event.detail.reason).then(
      (account) => {
        if (account) {
          this.refs.toast.show(`Rejected ${account}`);
        }
      }
    );
  }

  // The decided row swaps its buttons for the outcome, so the button may be gone
  closeReject() {
    this.rejecting = undefined;
    if (this._trigger.isConnected) {
      this._trigger.focus();
    }
  }

  openQuickQuote(event) {
    this._trigger = event.currentTarget;
    this.showQuickQuote = true;
  }

  closeQuickQuote() {
    this.showQuickQuote = false;
    this._trigger.focus();
  }

  handleQuoteCreated(event) {
    this.showQuickQuote = false;
    this[NavigationMixin.Navigate](quotePage(event.detail.id));
  }

  openQuote(event) {
    this[NavigationMixin.Navigate](quotePage(event.currentTarget.dataset.id));
  }

  openSubscription(event) {
    this[NavigationMixin.Navigate](
      subscriptionPage(event.currentTarget.dataset.id)
    );
  }

  openPage(event) {
    this[NavigationMixin.Navigate](PAGES[event.currentTarget.dataset.page]);
  }
}