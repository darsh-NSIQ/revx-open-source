import { LightningElement, api, track } from "lwc";
import chatWithAi from "@salesforce/apex/RevquilaAiController.chat";

export default class RevquilaAiChatbot extends LightningElement {
  @api recordId;

  @track isOpen = false;
  @track inputText = "";
  @track isThinking = false;
  @track messages = [];
  @track contextTitle = "";
  @track engineLabel = "RevX AI Engine";

  quickPrompts = [
    {
      id: "balance",
      label: "Customer AR & Balance",
      desc: "Unpaid invoices & aggregate receivables",
      prompt: "What is the total outstanding AR balance and open invoices?",
      isBalance: true
    },
    {
      id: "deal",
      label: "Deal Margin & Win Strategy",
      desc: "Discount benchmarks & win probability",
      prompt: "Analyze quote win probability and protect deal margin",
      isDeal: true
    },
    {
      id: "gst",
      label: "India GST & e-Invoice IRN",
      desc: "Tax splits, 64-character IRN & QR code",
      prompt: "How does India GST e-Invoice IRN and QR verification work?",
      isGst: true
    },
    {
      id: "rules",
      label: "Pricing & Slab Governance",
      desc: "15% rep limit & volume discount tiers",
      prompt: "Explain pricing rules and discount approval thresholds",
      isRules: true
    }
  ];

  msgCounter = 0;

  get launcherBtnClass() {
    return `rq-launcher-btn ${this.isOpen ? "rq-open" : ""}`;
  }

  get isNewSession() {
    return this.messages.length === 0;
  }

  get sendDisabled() {
    return this.isThinking || !this.inputText || !this.inputText.trim();
  }

  get sendBtnClass() {
    return `rq-send-btn ${this.sendDisabled ? "rq-disabled" : ""}`;
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    }
  }

  closeChat() {
    this.isOpen = false;
  }

  handleOpenCommandBar() {
    const cmd = this.template.querySelector("c-revquila-command-bar");
    if (cmd) {
      cmd.open();
    }
  }

  handleInputChange(event) {
    this.inputText = event.target.value;
  }

  handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  }

  handlePromptClick(event) {
    const prompt = event.currentTarget.dataset.prompt;
    if (prompt) {
      this.inputText = prompt;
      this.handleSend();
    }
  }

  handlePillClick(event) {
    const prompt = event.currentTarget.dataset.prompt;
    if (prompt) {
      this.inputText = prompt;
      this.handleSend();
    }
  }

  handleClearChat() {
    this.messages = [];
    this.contextTitle = "";
    this.engineLabel = "RevX AI Engine";
  }

  handleSend() {
    const text = (this.inputText || "").trim();
    if (!text || this.isThinking) {
      return;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // 1. Append User Message
    this.messages = [
      ...this.messages,
      {
        id: `msg-${++this.msgCounter}`,
        isAi: false,
        text,
        formattedText: this.formatText(text),
        time: timeStr,
        containerClass: "rq-msg-row rq-user-row",
        bubbleClass: "rq-user-bubble",
        hasActions: false,
        suggestedActions: []
      }
    ];

    this.inputText = "";
    this.isThinking = true;
    this.scrollToBottom();

    // 2. Call Apex Conversational Chat
    chatWithAi({ message: text, recordId: this.recordId })
      .then((res) => {
        this.isThinking = false;
        const aiTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

        if (res) {
          if (res.providerUsed) {
            this.engineLabel = res.providerUsed.includes("OpenAI")
              ? "OpenAI (GPT-4o)"
              : res.providerUsed.includes("Gemini")
              ? "Google Gemini"
              : "RevX AI Engine";
          }
          if (res.contextTitle) {
            this.contextTitle = res.contextTitle;
          }

          const hasActions = res.suggestedActions && res.suggestedActions.length > 0;
          this.messages = [
            ...this.messages,
            {
              id: `msg-${++this.msgCounter}`,
              isAi: true,
              text: res.reply || "",
              formattedText: this.formatMarkdown(res.reply || ""),
              time: aiTime,
              containerClass: "rq-msg-row rq-ai-row",
              bubbleClass: "rq-ai-bubble",
              hasActions,
              suggestedActions: res.suggestedActions || []
            }
          ];
        }
        this.scrollToBottom();
      })
      .catch((err) => {
        this.isThinking = false;
        const errTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const errMsg = err && err.body && err.body.message ? err.body.message : "Unable to reach RevX AI engine.";
        this.messages = [
          ...this.messages,
          {
            id: `msg-${++this.msgCounter}`,
            isAi: true,
            text: errMsg,
            formattedText: `<div class="rq-error-msg"><svg viewBox="0 0 24 24" class="rq-err-svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${this.escapeHtml(errMsg)}</span></div>`,
            time: errTime,
            containerClass: "rq-msg-row rq-ai-row",
            bubbleClass: "rq-ai-bubble rq-error-bubble",
            hasActions: true,
            suggestedActions: ["Retry Request", "Check Setup Settings"]
          }
        ];
        this.scrollToBottom();
      });
  }

  scrollToBottom() {
    setTimeout(() => {
      const body = this.template.querySelector(".rq-chat-body");
      if (body) {
        body.scrollTop = body.scrollHeight;
      }
    }, 50);
  }

  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  formatText(str) {
    return this.escapeHtml(str).replace(/\n/g, "<br/>");
  }

  formatMarkdown(md) {
    if (!md) return "";
    let html = this.escapeHtml(md);

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong class='rq-md-bold'>$1</strong>");

    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, "<em class='rq-md-italic'>$1</em>");

    // Blockquote > text
    html = html.replace(/^&gt;\s+(.*)$/gm, "<div class='rq-md-quote'><span class='rq-quote-bar'></span><span>$1</span></div>");

    // Bullet points • or -
    html = html.replace(/^[•\-]\s+(.*)$/gm, "<div class='rq-md-bullet'><span class='rq-bullet-dot'></span><span>$1</span></div>");

    // Numbered lists 1. text
    html = html.replace(/^(\d+)\.\s+(.*)$/gm, "<div class='rq-md-num'><span class='rq-num-badge'>$1</span><span>$2</span></div>");

    // Double newlines to paragraph break, single newlines to br
    html = html.replace(/\n\n/g, "<div class='rq-md-spacer'></div>");
    html = html.replace(/\n/g, "<br/>");

    return html;
  }
}