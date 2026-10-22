import { LightningElement, api } from "lwc";
import { paginate } from "c/revquilaPaging";

// A long story is read a page at a time, so the record page stays a sensible height
const PAGE_SIZE = 8;

/**
 * A record's story, newest first.
 * events: [{ id, when, title, detail, tone }] where tone is one of the theme's rq-tone-* names.
 */
export default class RevquilaTimeline extends LightningElement {
  page = 1;

  _events = [];

  @api
  get events() {
    return this._events;
  }

  // Something new on the story (an action just taken) shows from the first page
  set events(value) {
    const events = value || [];
    if (events.length !== this._events.length) {
      this.page = 1;
    }
    this._events = events;
  }

  get paging() {
    // the entries come in after the card they sit in
    return paginate(this._events, this.page, PAGE_SIZE, 3);
  }

  get items() {
    return this.paging.rows.map((event) => ({
      ...event,
      itemClass: `rq-event rq-rise rq-tone-${event.tone}`
    }));
  }

  get pageSize() {
    return PAGE_SIZE;
  }

  handlePage(event) {
    this.page = event.detail.page;
  }
}