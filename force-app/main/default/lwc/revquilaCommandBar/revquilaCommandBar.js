import { LightningElement, api, track } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import processCommandApex from "@salesforce/apex/RevquilaAgentService.processCommand";

export default class RevquilaCommandBar extends NavigationMixin(LightningElement) {
  @api recordId;
  @track isOpen = false;
  @track promptValue = "";
  @track loading = false;
  @track executing = false;
  @track previewData = null;
  @track isListening = false;
  _recognition = null;

  suggestedChips = [
    {
      id: "c1",
      category: "Quote",
      label: "Create quote for Acme, 50 licenses, 10% discount, Net 30",
      prompt: "create a quote for Acme, 50 licenses, 10% discount, Net 30"
    },
    {
      id: "c2",
      category: "Collections",
      label: "Send reminders to all overdue invoices",
      prompt: "send reminders to all overdue invoices"
    },
    {
      id: "c3",
      category: "Renewals",
      label: "Renew Acme's contract for 12 months with 5% uplift",
      prompt: "renew Acme's contract for 12 months with 5% uplift"
    },
    {
      id: "c4",
      category: "Metrics",
      label: "What was last quarter's MRR growth?",
      prompt: "what was last quarter's MRR growth?"
    }
  ];

  _boundKeyHandler = null;

  connectedCallback() {
    this._boundKeyHandler = this.handleGlobalKeyDown.bind(this);
    window.addEventListener("keydown", this._boundKeyHandler);
  }

  disconnectedCallback() {
    if (this._boundKeyHandler) {
      window.removeEventListener("keydown", this._boundKeyHandler);
    }
  }

  handleGlobalKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) {
      event.preventDefault();
      this.toggle();
    } else if (event.key === "Escape" && this.isOpen) {
      this.close();
    }
  }

  @api
  open() {
    this.isOpen = true;
    setTimeout(() => {
      const input = this.template.querySelector(".rq-cmd-input");
      if (input) input.focus();
    }, 100);
  }

  @api
  close() {
    this.isOpen = false;
    this.promptValue = "";
    this.previewData = null;
    this.loading = false;
    this.executing = false;
    if (this.isListening && this._recognition) {
      try { this._recognition.stop(); } catch (e) { /* ignore */ }
      this.isListening = false;
    }
  }

  get micButtonClass() {
    return `rq-cmd-mic-badge ${this.isListening ? 'listening' : ''}`;
  }

  get micButtonTitle() {
    return this.isListening ? 'Listening... Click to stop' : 'Click to Speak Voice Command';
  }

  toggleVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition requires Google Chrome or Microsoft Edge.');
      return;
    }

    if (this.isListening && this._recognition) {
      try { this._recognition.stop(); } catch (e) { /* ignore */ }
      this.isListening = false;
      return;
    }

    try {
      this._recognition = new SpeechRecognition();
      this._recognition.lang = 'en-US';
      this._recognition.interimResults = true;
      this._recognition.continuous = false;

      this.isListening = true;

      this._recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        this.promptValue = transcript;
      };

      this._recognition.onerror = () => {
        this.isListening = false;
      };

      this._recognition.onend = () => {
        this.isListening = false;
        if (this.promptValue && this.promptValue.trim().length > 3) {
          this.submitPrompt(this.promptValue);
        }
      };

      this._recognition.start();
    } catch (err) {
      console.warn('Voice input error:', err);
      this.isListening = false;
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  handleBackdropClick(event) {
    if (event.target.classList.contains("rq-cmd-overlay")) {
      this.close();
    }
  }

  stopPropagation(event) {
    event.stopPropagation();
  }

  handleInputChange(event) {
    this.promptValue = event.target.value;
  }

  handleInputKeyDown(event) {
    if (event.key === "Enter" && this.promptValue && this.promptValue.trim()) {
      event.preventDefault();
      this.executeAgentCommand(false);
    }
  }

  handleChipClick(event) {
    const prompt = event.currentTarget.dataset.prompt;
    if (prompt) {
      this.promptValue = prompt;
      this.executeAgentCommand(false);
    }
  }

  handleReset() {
    this.previewData = null;
    this.promptValue = "";
    this.loading = false;
    this.executing = false;
  }

  async executeAgentCommand(executeDirectly) {
    if (!this.promptValue || !this.promptValue.trim()) return;

    if (executeDirectly) {
      this.executing = true;
    } else {
      this.loading = true;
      this.previewData = null;
    }

    try {
      const res = await processCommandApex({
        prompt: this.promptValue,
        executeDirectly: executeDirectly,
        contextRecordId: this.recordId || null
      });

      this.previewData = {
        ...res,
        actionLabel: this.getActionLabel(res.action)
      };
    } catch (err) {
      this.previewData = {
        success: false,
        action: "error",
        actionLabel: "Error",
        provider: "RevX Error Handler",
        intentDescription: "Execution halted",
        previewMarkdown: "### ❌ Error Processing Request\n\n" + (err?.body?.message || err?.message || "Unknown error occurred."),
        resultMessage: err?.body?.message || err?.message,
        requiresConfirmation: false,
        requiresApproval: false
      };
    } finally {
      this.loading = false;
      this.executing = false;
    }
  }

  handleConfirmExecute() {
    this.executeAgentCommand(true);
  }

  handleGoToExceptions() {
    this.close();
    this[NavigationMixin.Navigate]({
      type: "standard__navItemPage",
      attributes: {
        apiName: "Revquila_Exception_Inbox"
      }
    });
  }

  getActionLabel(action) {
    switch (action) {
      case "create_quote": return "CREATE QUOTE";
      case "send_reminders": return "DUNNING BATCH";
      case "renew_contract": return "CONTRACT RENEWAL";
      case "mrr_growth": return "REVENUE ANALYTICS";
      case "check_balance": return "RECEIVABLES CHECK";
      case "error": return "HALTED";
      default: return "AI AGENT ACTION";
    }
  }

  get showSuggestions() {
    return !this.previewData && !this.loading;
  }

  get hasParameters() {
    return this.previewData && this.previewData.parameters && Object.keys(this.previewData.parameters).length > 0;
  }

  get parameterList() {
    if (!this.hasParameters) return [];
    const params = this.previewData.parameters;
    return Object.keys(params).map(k => ({
      key: k,
      label: this.formatParamKey(k),
      value: String(params[k])
    }));
  }

  formatParamKey(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());
  }

  get previewStatusBadgeClass() {
    if (!this.previewData) return "rq-badge";
    if (this.previewData.requiresApproval) return "rq-badge rq-badge-danger";
    if (this.previewData.requiresConfirmation) return "rq-badge rq-badge-primary";
    if (this.previewData.success) return "rq-badge rq-badge-success";
    return "rq-badge rq-badge-danger";
  }

  get resultNoticeClass() {
    if (!this.previewData) return "rq-notice";
    if (this.previewData.success) return "rq-notice rq-notice-success";
    return "rq-notice rq-notice-danger";
  }

  get previewHtml() {
    if (!this.previewData || !this.previewData.previewMarkdown) return "";
    return this.markdownToHtml(this.previewData.previewMarkdown);
  }

  markdownToHtml(md) {
    if (!md) return "";
    let html = md
      .replace(/^### (.*$)/gim, '<h3 class="rq-md-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="rq-md-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="rq-md-h1">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/gim, "<em>$1</em>")
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" class="rq-md-link">$1</a>')
      .replace(/^\• (.*$)/gim, '<li class="rq-md-li">$1</li>')
      .replace(/^\- (.*$)/gim, '<li class="rq-md-li">$1</li>')
      .replace(/\n\n/gim, "<br/>");
    return html;
  }
}
