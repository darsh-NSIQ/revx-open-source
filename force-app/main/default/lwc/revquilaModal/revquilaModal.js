import { LightningElement, api } from "lwc";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const EXIT_MS = 180;

/**
 * Themed modal shell. Every Revquila action opens one of these instead of a
 * standard Salesforce modal.
 *
 * The parent renders it conditionally and removes it on `close`:
 *   <template lwc:if={open}>
 *     <c-revquila-modal heading="..." onclose={handleClose}>
 *       body
 *       <div slot="footer" class="rq-actions-end">buttons</div>
 *     </c-revquila-modal>
 *   </template>
 * Mark the element that should get focus first with data-autofocus="true".
 */
export default class RevquilaModal extends LightningElement {
  @api heading;
  @api subheading;
  /** "small" | "medium" | "large" | "wide" */
  @api size = "medium";

  closing = false;

  _focused = false;
  _timer;

  get backdropClass() {
    return this.closing ? "rq-backdrop rq-closing" : "rq-backdrop";
  }

  get panelClass() {
    return `rq-panel rq-${this.size}`;
  }

  renderedCallback() {
    if (this._focused) {
      return;
    }
    this._focused = true;
    (this.querySelector("[data-autofocus]") || this.refs.panel).focus();
  }

  disconnectedCallback() {
    clearTimeout(this._timer);
  }

  /** Plays the exit animation, then fires `close` so the parent can remove the modal. */
  @api
  close() {
    if (this.closing) {
      return;
    }
    this.closing = true;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._timer = setTimeout(
      () => this.dispatchEvent(new CustomEvent("close")),
      reduceMotion ? 0 : EXIT_MS
    );
  }

  handleKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      this.close();
    }
  }

  // The guards sit just outside the panel and send focus back in, so Tab never leaves the modal
  handleGuardFocus(event) {
    if (event.target.dataset.edge === "end") {
      this.refs.closeButton.focus();
      return;
    }
    const slotted = [...this.querySelectorAll(FOCUSABLE)].filter(
      (element) => !element.disabled
    );
    (slotted[slotted.length - 1] || this.refs.closeButton).focus();
  }
}