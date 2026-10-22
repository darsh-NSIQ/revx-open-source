import { LightningElement, api } from "lwc";
import { getConfig } from "c/revquilaConfig";
import { createPdf } from "c/revquilaDocuments";

const LAYOUT_NAMES = {
  classic: "Classic",
  modern: "Modern",
  minimal: "Minimal"
};

/**
 * Shows a quote or invoice as it will print, and creates the real PDF.
 * `document` is the document from getQuoteDocument / getInvoiceDocument.
 * Fires `close` once it has animated out.
 */
export default class RevquilaDocumentModal extends LightningElement {
  @api document;

  creating = false;
  error = "";
  // Set once the PDF exists, so it can be opened again without creating another
  pdfUrl;
  blocked = false;

  get heading() {
    return `${this.document.number} · preview`;
  }

  get subheading() {
    const { layout, pageSize } = getConfig().pdf;
    return `${LAYOUT_NAMES[layout] || LAYOUT_NAMES.classic} layout, ${pageSize}. Change the look in Setup > Documents & PDF.`;
  }

  get downloadLabel() {
    return this.creating ? "Creating PDF…" : "Download PDF";
  }

  get readyText() {
    return this.blocked
      ? "The PDF is ready, but your browser blocked the new tab."
      : "The PDF opened in a new tab.";
  }

  get linkText() {
    return `Open ${this.document.number}.pdf`;
  }

  handleDownload() {
    this.creating = true;
    this.error = "";
    createPdf(this.document)
      .then((url) => {
        this.pdfUrl = url;
        // A new tab: the PDF must not replace the app. Browsers allow it this soon after the click.
        this.blocked = !window.open(url, "_blank");
      })
      .catch((error) => {
        this.error =
          error?.body?.message || "The PDF could not be created. Try again.";
      })
      .finally(() => {
        this.creating = false;
      });
  }

  handleCancel() {
    this.refs.modal.close();
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent("close"));
  }
}