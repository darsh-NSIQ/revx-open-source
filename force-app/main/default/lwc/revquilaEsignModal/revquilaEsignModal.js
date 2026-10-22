import { LightningElement, api } from "lwc";
import getQuoteForSigning from "@salesforce/apex/RevquilaEsignController.getQuoteForSigning";
import completeEsign from "@salesforce/apex/RevquilaEsignController.completeEsign";
import resendCertificateEmail from "@salesforce/apex/RevquilaEsignController.resendCertificateEmail";

export default class RevquilaEsignModal extends LightningElement {
  @api quoteId;

  loading = true;
  submitting = false;
  error = "";
  signedSuccess = false;

  quoteData;
  signerName = "";
  signerEmail = "";
  signerTitle = "";
  consentAccepted = false;
  currentMode = "draw"; // "draw" | "type"

  signatureData = "";
  signatureDigest = "";
  portalToken = "";
  resending = false;
  resendMessage = "";
  resendSuccess = false;

  hasDrawn = false;
  isDrawing = false;
  _canvasInitialized = false;

  connectedCallback() {
    this.loadQuote();
  }

  renderedCallback() {
    if (!this._canvasInitialized && this.refs.canvas && !this.loading && !this.signedSuccess) {
      this.initCanvas();
    }
  }

  async loadQuote() {
    this.loading = true;
    this.error = "";
    try {
      const res = await getQuoteForSigning({ quoteId: this.quoteId, token: null });
      this.quoteData = res;
      this.portalToken = res.portalToken || "";
      if (res.isSigned) {
        this.signedSuccess = true;
        this.signerName = res.signedByName || "Customer";
        this.signerEmail = res.signedByEmail || res.contactEmail || "";
        this.signerTitle = res.signedByTitle || "";
        this.signatureData = res.signatureData || "";
        this.signatureDigest = res.signatureDigest || "";
      } else {
        this.signerName = res.contactName || "";
        this.signerEmail = res.contactEmail || "";
      }
    } catch (err) {
      this.error = err?.body?.message || err?.message || "Failed to load quotation details.";
    } finally {
      this.loading = false;
    }
  }

  get subheading() {
    if (!this.quoteData) return "";
    return `${this.quoteData.quoteNumber} · ${this.quoteData.accountName}`;
  }

  get quoteNumber() {
    return this.quoteData?.quoteNumber || "";
  }

  get accountName() {
    return this.quoteData?.accountName || "";
  }

  get amountFormatted() {
    if (!this.quoteData) return "$0.00";
    const curr = this.quoteData.currencyCode || "USD";
    const num = Number(this.quoteData.totalAmount) || 0;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 2
    }).format(num);
  }

  get canSign() {
    return !this.loading && !this.signedSuccess;
  }

  get drawTabClass() {
    return `rq-mode-tab ${this.currentMode === "draw" ? "active" : ""}`;
  }

  get typeTabClass() {
    return `rq-mode-tab ${this.currentMode === "type" ? "active" : ""}`;
  }

  get submitDisabled() {
    return (
      this.submitting ||
      !this.signerName.trim() ||
      !this.signerEmail.trim() ||
      !this.signerEmail.includes("@") ||
      !this.hasDrawn ||
      !this.consentAccepted
    );
  }

  // --- Canvas Interaction ---

  initCanvas() {
    const canvas = this.refs.canvas;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : 540;
    const height = 150;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    this._canvasInitialized = true;
    if (this.currentMode === "type") {
      this.renderTypedSignature();
    }
  }

  getPos(event) {
    const canvas = this.refs.canvas;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  startPointer(event) {
    if (this.currentMode !== "draw") return;
    event.preventDefault();
    this.isDrawing = true;
    const ctx = this.refs.canvas.getContext("2d");
    const pos = this.getPos(event);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  movePointer(event) {
    if (!this.isDrawing || this.currentMode !== "draw") return;
    event.preventDefault();
    const ctx = this.refs.canvas.getContext("2d");
    const pos = this.getPos(event);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    this.hasDrawn = true;
  }

  endPointer(event) {
    if (!this.isDrawing) return;
    event.preventDefault();
    this.isDrawing = false;
  }

  clearCanvas() {
    const canvas = this.refs.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    this.hasDrawn = false;
    if (this.currentMode === "type") {
      this.renderTypedSignature();
    }
  }

  selectDrawMode() {
    this.currentMode = "draw";
    this.clearCanvas();
  }

  selectTypeMode() {
    this.currentMode = "type";
    this.clearCanvas();
  }

  renderTypedSignature() {
    const canvas = this.refs.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);
    const text = this.signerName.trim() || this.accountName || "Authorized Signatory";
    ctx.fillStyle = "#0f172a";
    ctx.font = 'italic 34px "Brush Script MT", "Caveat", "Segoe Script", cursive';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 - 6);
    this.hasDrawn = true;
  }

  // --- Handlers ---

  handleNameChange(event) {
    this.signerName = event.target.value;
    if (this.currentMode === "type") {
      this.renderTypedSignature();
    }
  }

  handleEmailChange(event) {
    this.signerEmail = event.target.value;
  }

  handleTitleChange(event) {
    this.signerTitle = event.target.value;
  }

  handleConsentChange(event) {
    this.consentAccepted = event.target.checked;
  }

  async handleSign() {
    if (this.submitDisabled) return;

    this.submitting = true;
    this.error = "";

    try {
      const canvas = this.refs.canvas;
      const sigDataUrl = canvas.toDataURL("image/png");
      this.signatureData = sigDataUrl;

      const auditPayload = {
        clientTimestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`,
        mode: this.currentMode,
        appContext: "RevX Lightning Salesforce Console"
      };

      const result = await completeEsign({
        quoteId: this.quoteId,
        token: null,
        signerName: this.signerName.trim(),
        signerEmail: this.signerEmail.trim(),
        signerTitle: this.signerTitle.trim(),
        signatureData: sigDataUrl,
        auditJson: JSON.stringify(auditPayload)
      });

      if (result.ok) {
        this.signedSuccess = true;
        this.signatureDigest = result.digest || "";
        this.dispatchEvent(
          new CustomEvent("signed", {
            detail: {
              quoteId: this.quoteId,
              quoteNumber: this.quoteNumber
            }
          })
        );
      } else {
        this.error = result.message || "Failed to sign quote.";
      }
    } catch (err) {
      this.error = err?.body?.message || err?.message || "An error occurred during e-signing.";
    } finally {
      this.submitting = false;
    }
  }

  openCertificatePdf() {
    const url = `/apex/Revquila__RevquilaEsignCertificate?id=${this.quoteId}`;
    window.open(url, "_blank");
  }

  async handleResendEmail() {
    if (!this.signerEmail) return;
    this.resending = true;
    this.resendMessage = "";
    try {
      await resendCertificateEmail({ quoteId: this.quoteId, targetEmail: this.signerEmail.trim() });
      this.resendSuccess = true;
      this.resendMessage = `Certificate dispatched successfully to ${this.signerEmail}!`;
    } catch (e) {
      this.resendSuccess = false;
      this.resendMessage = e?.body?.message || "Could not dispatch email.";
    } finally {
      this.resending = false;
    }
  }

  get resendStatusClass() {
    return `rq-resend-status ${this.resendSuccess ? "success" : "error"}`;
  }

  handleDone() {
    this.refs.modal.close();
  }

  handleCancel() {
    this.refs.modal.close();
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent("close"));
  }
}