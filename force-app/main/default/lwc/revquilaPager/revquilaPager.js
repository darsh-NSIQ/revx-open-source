import { LightningElement, api } from "lwc";
import { countOf } from "c/revquilaText";

const SIZES = [5, 10, 25, 50];
// Page buttons between the arrows: always this many once there are more pages than fit,
// so the bar does not change width from one page to the next
const SLOTS = 7;

// The pages to offer around `page`, with a gap where pages are left out: 1 … 4 5 6 … 12
function pagesAround(page, pages) {
  if (pages <= SLOTS) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }
  let start = Math.max(2, Math.min(page - 1, pages - 4));
  let end = Math.min(pages - 1, Math.max(page + 1, 5));
  // a gap that would hide a single page shows the page instead
  if (start === 3) {
    start = 2;
  }
  if (end === pages - 2) {
    end = pages - 1;
  }
  const around = [1];
  if (start > 2) {
    around.push("gap-before");
  }
  for (let number = start; number <= end; number += 1) {
    around.push(number);
  }
  if (end < pages - 1) {
    around.push("gap-after");
  }
  around.push(pages);
  return around;
}

/**
 * The page buttons under a list. The list keeps the page and the page size, and cuts its
 * rows with paginate() from c/revquilaPaging; this only shows where it is and asks to move.
 *
 *   <c-revquila-pager total={paging.total} page={paging.page} page-size={pageSize}
 *     noun="quote" onpagechange={handlePage} onsizechange={handlePageSize}>
 *
 * Fires `pagechange` with { page } and `sizechange` with { pageSize }.
 * `compact` is the small form for a column or a side list: arrows and "Page 2 of 5",
 * shown only when there is more than one page.
 */
export default class RevquilaPager extends LightningElement {
  /** How many rows the list has after its search and filters. */
  @api total = 0;
  @api page = 1;
  @api pageSize = 10;
  /** What one row is, for "of 43 quotes". */
  @api noun = "row";
  /** The plural, when adding an "s" is not enough. */
  @api plural;
  /** The page sizes to offer. */
  @api sizes = SIZES;
  @api compact = false;

  get pages() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get current() {
    return Math.min(Math.max(1, this.page), this.pages);
  }

  get shown() {
    return this.compact ? this.pages > 1 : this.total > 0;
  }

  get full() {
    return !this.compact;
  }

  get barClass() {
    return this.compact ? "rq-pg rq-compact" : "rq-pg";
  }

  get navLabel() {
    return `Pages of ${this.plural || `${this.noun}s`}`;
  }

  get last() {
    return Math.min(this.total, this.current * this.pageSize);
  }

  get rangeLabel() {
    const first = (this.current - 1) * this.pageSize + 1;
    return first === this.last ? String(first) : `${first}–${this.last}`;
  }

  get totalLabel() {
    return countOf(this.total, this.noun, this.plural);
  }

  get pageLabel() {
    return `Page ${this.current} of ${this.pages}`;
  }

  // How far through the list this page reaches
  get progressStyle() {
    return `--rq-p:${this.total ? this.last / this.total : 0}`;
  }

  get items() {
    return pagesAround(this.current, this.pages).map((entry) => {
      if (typeof entry !== "number") {
        return { key: entry, gap: true };
      }
      const on = entry === this.current;
      return {
        key: `page-${entry}`,
        page: entry,
        label: `Page ${entry}`,
        current: on ? "page" : undefined,
        itemClass: on ? "rq-pg-btn rq-pg-num rq-on" : "rq-pg-btn rq-pg-num"
      };
    });
  }

  get atStart() {
    return this.current <= 1;
  }

  get atEnd() {
    return this.current >= this.pages;
  }

  // The arrows stay focusable at either end, so the keyboard does not lose its place
  get previousClass() {
    return this.atStart
      ? "rq-pg-btn rq-pg-arrow rq-off"
      : "rq-pg-btn rq-pg-arrow";
  }

  get nextClass() {
    return this.atEnd
      ? "rq-pg-btn rq-pg-arrow rq-off"
      : "rq-pg-btn rq-pg-arrow";
  }

  get previousDisabled() {
    return this.atStart ? "true" : "false";
  }

  get nextDisabled() {
    return this.atEnd ? "true" : "false";
  }

  get showSizes() {
    return this.full && this.sizes.length > 1;
  }

  get sizeOptions() {
    const sizes = this.sizes.includes(this.pageSize)
      ? this.sizes
      : [...this.sizes, this.pageSize].sort((a, b) => a - b);
    return sizes.map((size) => ({
      value: size,
      selected: size === this.pageSize
    }));
  }

  go(page) {
    if (page < 1 || page > this.pages || page === this.current) {
      return;
    }
    this.dispatchEvent(new CustomEvent("pagechange", { detail: { page } }));
  }

  handlePrevious() {
    this.go(this.current - 1);
  }

  handleNext() {
    this.go(this.current + 1);
  }

  handlePage(event) {
    this.go(Number(event.currentTarget.dataset.page));
  }

  // Left and right move a page from any of the buttons; the page-size menu keeps its own keys
  handleKeydown(event) {
    if (event.target.tagName === "SELECT") {
      return;
    }
    if (event.key === "ArrowLeft") {
      this.go(this.current - 1);
    } else if (event.key === "ArrowRight") {
      this.go(this.current + 1);
    } else if (event.key === "Home") {
      this.go(1);
    } else if (event.key === "End") {
      this.go(this.pages);
    } else {
      return;
    }
    event.preventDefault();
  }

  handleSize(event) {
    this.dispatchEvent(
      new CustomEvent("sizechange", {
        detail: { pageSize: Number(event.target.value) }
      })
    );
  }
}