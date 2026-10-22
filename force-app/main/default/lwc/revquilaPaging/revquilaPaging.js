/**
 * Paging for the lists: the rows of one page, and bringing the top of a list back into
 * view after the page changes. The buttons are c-revquila-pager.
 *
 * How a list uses it
 *   page = 1; pageSize = 10;
 *   get paging() { return paginate(this.visible, this.page, this.pageSize); }
 *   <c-revquila-pager total={paging.total} page={paging.page} page-size={pageSize}
 *     noun="quote" onpagechange={handlePage} onsizechange={handlePageSize}>
 * Go back to page 1 whenever the search or a filter changes.
 */

// A long page should not keep its last rows waiting: the entrance delay stops growing here
const MAX_STAGGER = 10;
// Lightning's fixed header, which a scrolled-to element has to clear
const HEADER = 120;

/**
 * One page of `items`: { rows, page, pages, total }. A page beyond the end (the list got
 * shorter) becomes the last page. Each row carries rowStyle, its place in the entrance:
 * `firstStep` is the step the first row comes in at, after whatever sits above the rows.
 */
export function paginate(items, page, pageSize, firstStep = 0) {
  const size = Math.max(1, Number(pageSize) || 1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const rows = items
    .slice((current - 1) * size, current * size)
    .map((item, index) => ({
      ...item,
      rowStyle: `--rq-i:${Math.min(index, MAX_STAGGER) + firstStep}`
    }));
  return { rows, page: current, pages, total: items.length };
}

/**
 * Scrolls `element` (the toolbar above a list, or a column) back into view when the new
 * page starts above what is on screen. Give the element a scroll-margin-top so it clears
 * Lightning's fixed header.
 */
export function revealTop(element) {
  if (!element || element.getBoundingClientRect().top >= HEADER) {
    return;
  }
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({
    behavior: still ? "auto" : "smooth",
    block: "start"
  });
}