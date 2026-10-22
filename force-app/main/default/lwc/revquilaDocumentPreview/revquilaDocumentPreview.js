import { LightningElement, api } from "lwc";
import { getConfig, onConfigChange } from "c/revquilaConfig";
import { buildPrintModel, previewLogo } from "c/revquilaDocuments";

/**
 * A quote or invoice on paper, as the PDF will print it.
 * `document` is the document from getQuoteDocument / getInvoiceDocument.
 * `config` previews settings that are not published yet (Setup); leave it out to use the live ones.
 */
export default class RevquilaDocumentPreview extends LightningElement {
  @api document;
  @api config;

  // the live configuration, replaced when it changes so the page is laid out again
  liveConfig = getConfig();

  _stop;

  connectedCallback() {
    this._stop = onConfigChange(() => {
      this.liveConfig = getConfig();
    });
  }

  disconnectedCallback() {
    this._stop();
  }

  get model() {
    return this.document
      ? buildPrintModel(this.document, this.config || this.liveConfig)
      : undefined;
  }

  get logo() {
    return previewLogo(this.model);
  }

  get paperClass() {
    const { layout, font, pageSize, logoRight } = this.model;
    return [
      "rq-paper",
      `rq-is-${layout}`,
      `rq-font-${font}`,
      `rq-size-${pageSize.toLowerCase()}`,
      logoRight ? "rq-logo-right" : ""
    ].join(" ");
  }

  get paperStyle() {
    const { accent, accentSoft } = this.model;
    return `--rq-doc-acc:${accent};--rq-doc-soft:${accentSoft}`;
  }

  get hasNotes() {
    return this.model.notesLines.length > 0;
  }

  get hasTerms() {
    return this.model.termsLines.length > 0;
  }

  get hasBank() {
    return this.model.bankLines.length > 0;
  }
}