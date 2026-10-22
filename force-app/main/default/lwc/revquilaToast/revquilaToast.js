import { LightningElement, api } from "lwc";

const VISIBLE_MS = 2800;

/**
 * Themed toast. Used instead of the standard ShowToastEvent so feedback
 * matches the Revquila theme. Call show(message, variant) from the page.
 */
export default class RevquilaToast extends LightningElement {
  message = "";
  variant = "info";
  visible = false;

  _timer;

  get toastClass() {
    return `rq-toast rq-is-${this.variant}${this.visible ? " rq-show" : ""}`;
  }

  /** @param {"info"|"success"|"error"} variant */
  @api
  show(message, variant = "info") {
    this.message = message;
    this.variant = variant;
    this.visible = true;
    clearTimeout(this._timer);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._timer = setTimeout(() => {
      this.visible = false;
    }, VISIBLE_MS);
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
  }
}