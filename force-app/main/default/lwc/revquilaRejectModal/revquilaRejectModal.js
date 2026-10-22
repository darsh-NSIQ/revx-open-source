import { LightningElement, api } from "lwc";

/**
 * Reject-with-reason modal. Fires `reject` with { reason }, then `close`
 * once it has animated out.
 */
export default class RevquilaRejectModal extends LightningElement {
  @api quoteTitle;

  reason = "";
  error = "";

  get fieldClass() {
    return this.error ? "rq-field rq-invalid" : "rq-field";
  }

  handleInput(event) {
    this.reason = event.target.value;
  }

  handleReject() {
    const reason = this.reason.trim();
    if (!reason) {
      this.error = "Tell the rep why, so they can fix the quote.";
      return;
    }
    this.dispatchEvent(new CustomEvent("reject", { detail: { reason } }));
    this.refs.modal.close();
  }

  handleCancel() {
    this.refs.modal.close();
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent("close"));
  }
}