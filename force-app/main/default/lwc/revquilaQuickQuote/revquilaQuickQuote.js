import { LightningElement, api } from "lwc";
import { getConfig } from "c/revquilaConfig";
import {
  CUSTOM_PRODUCT,
  PAYMENT_TERMS,
  createAccount,
  errorMessage,
  fetchQuoteLines,
  getAccountContext,
  getQuote,
  saveQuote,
  searchAccounts
} from "c/revquilaData";
import {
  formatMoneyCompact,
  getMarkets,
  getRegions,
  marketOf
} from "c/revquilaTax";

const SEARCH_DELAY_MS = 250;
const NONE = "";

// A priced line back to what the editor takes
function editableLine({
  productKey,
  qty,
  discount,
  name,
  unit,
  price,
  bundleKey
}) {
  const line =
    productKey === CUSTOM_PRODUCT
      ? { productKey, qty, discount, name, unit, price }
      : { productKey, qty, discount };
  if (bundleKey) {
    line.bundleKey = bundleKey;
  }
  return line;
}

/**
 * The quote form, in a modal.
 * Without quoteId it creates a quote and fires `created` with { id }.
 * With quoteId it edits that draft (load it with loadQuote first) and fires `saved` with { id }.
 * Fires `close` once it has animated out.
 */
export default class RevquilaQuickQuote extends LightningElement {
  @api quoteId;

  // the account picked: { id, name, city, region }
  account;
  accountText = "";
  matches = [];
  searching = false;
  // what the picked account brings with it
  contacts = [];
  opportunities = [];
  recentQuotes = [];

  contactId = NONE;
  opportunityId = NONE;
  // the customer's country as a code: it sets the tax system and the currency
  country = "";
  state = "";
  opportunity = "";
  terms = "";
  validDays = "";
  notes = "";
  lines = [];
  copiedFrom = "";
  errors = {};
  saving = false;
  saveError = "";

  _notesShown = false;
  _searchTimer;
  _searchCount = 0;

  connectedCallback() {
    const { pricing, company } = getConfig();
    const quote = this.quoteId && getQuote(this.quoteId);
    if (quote) {
      this.account = {
        id: quote.accountId,
        name: quote.account,
        city: quote.city,
        region: quote.state
      };
      this.accountText = quote.account;
      this.contactId = quote.contactId || NONE;
      this.opportunityId = quote.opportunityId || NONE;
      this.country = marketOf(quote.country).country;
      this.state = quote.state;
      this.opportunity = quote.opportunity;
      this.terms = quote.terms;
      this.validDays = String(quote.validDays);
      this.notes = quote.notes;
      this.lines = quote.lines.map(editableLine);
      this.loadContext(quote.accountId);
      return;
    }
    this.country = getConfig().tax.country;
    this.state = company.state;
    this.terms = pricing.standardTerms;
    this.validDays = String(pricing.quoteValidDays);
  }

  disconnectedCallback() {
    clearTimeout(this._searchTimer);
  }

  // A textarea takes its text as a property, which a template cannot set
  renderedCallback() {
    if (!this._notesShown) {
      this._notesShown = true;
      this.refs.notes.value = this.notes;
    }
  }

  // ---------------------------------------------------------------- what the form shows

  get editing() {
    return Boolean(this.quoteId);
  }

  get heading() {
    const quote = this.editing && getQuote(this.quoteId);
    return quote ? `Edit ${quote.number}` : "New Quick Quote";
  }

  get subheading() {
    return this.editing
      ? `${this.accountText} · totals, tax and the approval check update as you type`
      : "Pick the customer, add products. Totals, tax and the approval check update as you type.";
  }

  get saveLabel() {
    if (this.saving) {
      return "Saving…";
    }
    return this.editing ? "Save changes" : "Create quote";
  }

  get picking() {
    return !this.editing && !this.account;
  }

  get picked() {
    return !this.editing && Boolean(this.account);
  }

  get accountDetail() {
    const { city, region } = this.account;
    return (
      [city, region].filter(Boolean).join(", ") || "No address on the account"
    );
  }

  // What was typed is offered as a new account unless an account has exactly that name
  get canCreate() {
    const typed = this.accountText.trim().toLowerCase();
    return (
      typed.length > 1 &&
      !this.searching &&
      !this.matches.some((match) => match.name.toLowerCase() === typed)
    );
  }

  get createLabel() {
    return `Create account “${this.accountText.trim()}”`;
  }

  get matchRows() {
    return this.matches.map((match) => ({
      ...match,
      detail:
        [match.city, match.region].filter(Boolean).join(", ") || "No address"
    }));
  }

  get showMatches() {
    return this.picking && (this.matches.length > 0 || this.canCreate);
  }

  get contactOptions() {
    return [{ id: NONE, name: "No contact" }, ...this.contacts].map(
      (contact) => ({
        ...contact,
        label: contact.detail
          ? `${contact.name} · ${contact.detail}`
          : contact.name,
        selected: contact.id === this.contactId
      })
    );
  }

  get hasOpportunities() {
    return this.opportunities.length > 0;
  }

  get opportunityOptions() {
    return [{ id: NONE, name: "Not linked" }, ...this.opportunities].map(
      (opportunity) => ({
        ...opportunity,
        label: opportunity.detail
          ? `${opportunity.name} · ${opportunity.detail}`
          : opportunity.name,
        selected: opportunity.id === this.opportunityId
      })
    );
  }

  get regionLabel() {
    return marketOf(this.country).regionLabel || "Region";
  }

  // Every country in Setup > Tax & currency, the home one first
  get countryOptions() {
    return getMarkets().map((market) => ({
      code: market.country,
      label: `${market.countryName} · ${market.currency}`,
      selected: market.country === this.country
    }));
  }

  get hasCountries() {
    return getMarkets().length > 1;
  }

  get regions() {
    const regions = getRegions(this.country);
    const all =
      !this.state || regions.includes(this.state)
        ? regions
        : [this.state, ...regions];
    return all.map((name) => ({ name, selected: name === this.state }));
  }

  get hasRegions() {
    return this.regions.length > 0;
  }

  get termOptions() {
    const all = PAYMENT_TERMS.includes(this.terms)
      ? PAYMENT_TERMS
      : [this.terms, ...PAYMENT_TERMS];
    return all.map((name) => ({ name, selected: name === this.terms }));
  }

  // The account's latest quotes, to start this one from
  get copyOptions() {
    return this.recentQuotes
      .filter((quote) => quote.id !== this.quoteId)
      .map((quote) => ({
        ...quote,
        label: `${quote.name} · ${formatMoneyCompact(quote.amount)}`,
        copyClass:
          quote.id === this.copiedFrom ? "rq-bundle rq-on" : "rq-bundle",
        pressed: quote.id === this.copiedFrom ? "true" : "false"
      }));
  }

  get hasCopyOptions() {
    return this.copyOptions.length > 0;
  }

  get accountFieldClass() {
    return this.fieldClass("account");
  }

  get validDaysFieldClass() {
    return this.fieldClass("validDays");
  }

  fieldClass(name) {
    return this.errors[name] ? "rq-field rq-invalid" : "rq-field";
  }

  // ---------------------------------------------------------------- account

  handleAccountInput(event) {
    this.accountText = event.target.value;
    this.searching = true;
    clearTimeout(this._searchTimer);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._searchTimer = setTimeout(() => this.search(), SEARCH_DELAY_MS);
  }

  handleAccountFocus() {
    if (!this.matches.length && !this.accountText) {
      this.search();
    }
  }

  // Only the answer to the latest search is shown, however late an earlier one comes back
  search() {
    this._searchCount += 1;
    const count = this._searchCount;
    searchAccounts(this.accountText.trim())
      .then((matches) => {
        if (count === this._searchCount) {
          this.matches = matches;
        }
      })
      .catch((error) => {
        this.saveError = errorMessage(error);
      })
      .finally(() => {
        if (count === this._searchCount) {
          this.searching = false;
        }
      });
  }

  handlePickAccount(event) {
    this.pickAccount(
      this.matches.find((match) => match.id === event.currentTarget.dataset.id)
    );
  }

  handleCreateAccount() {
    this.saveError = "";
    createAccount(this.accountText, this.state)
      .then((account) => this.pickAccount(account))
      .catch((error) => {
        this.saveError = errorMessage(error);
      });
  }

  pickAccount(account) {
    this.account = account;
    this.accountText = account.name;
    this.matches = [];
    this.errors = { ...this.errors, account: undefined };
    if (account.region) {
      this.state = account.region;
    }
    if (account.country) {
      this.country = marketOf(account.country).country;
    }
    this.loadContext(account.id);
  }

  clearAccount() {
    this.account = undefined;
    this.accountText = "";
    this.contacts = [];
    this.opportunities = [];
    this.recentQuotes = [];
    this.contactId = NONE;
    this.opportunityId = NONE;
    this.copiedFrom = "";
  }

  loadContext(accountId) {
    getAccountContext(accountId)
      .then((context) => {
        this.contacts = context.contacts;
        this.opportunities = context.opportunities;
        this.recentQuotes = context.recentQuotes;
        // the only contact on the account is almost always the one who signs
        if (!this.editing && context.contacts.length === 1) {
          this.contactId = context.contacts[0].id;
        }
      })
      .catch((error) => {
        this.saveError = errorMessage(error);
      });
  }

  // ---------------------------------------------------------------- fields and lines

  handleInput(event) {
    this[event.target.dataset.field] = event.target.value;
  }

  // A new country brings its own regions, so the region starts again
  handleCountry(event) {
    this.country = event.target.value;
    const [first] = getRegions(this.country);
    this.state = first || "";
  }

  // Linking an opportunity names the quote after it, unless a reference was typed
  handleOpportunity(event) {
    this.opportunityId = event.target.value;
    const linked = this.opportunities.find(
      (opportunity) => opportunity.id === this.opportunityId
    );
    if (linked && !this.opportunity.trim()) {
      this.opportunity = linked.name;
    }
  }

  handleCopy(event) {
    const { id } = event.currentTarget.dataset;
    fetchQuoteLines(id)
      .then((lines) => {
        this.copiedFrom = id;
        this.lines = lines.map(editableLine);
      })
      .catch((error) => {
        this.saveError = errorMessage(error);
      });
  }

  handleLines(event) {
    this.lines = event.detail.lines;
  }

  validate() {
    const errors = {};
    const validDays = Number(this.validDays);
    if (!this.account) {
      errors.account = "Pick the account, or create it.";
    }
    if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
      errors.validDays = "1 to 365 days.";
    }
    this.errors = errors;
    const linesValid = this.refs.editor.validate();
    return linesValid && Object.keys(errors).length === 0;
  }

  handleSave() {
    if (this.saving || !this.validate()) {
      return;
    }
    this.saving = true;
    this.saveError = "";
    saveQuote({
      quoteId: this.quoteId,
      accountId: this.account.id,
      contactId: this.contactId,
      opportunityId: this.opportunityId,
      country: this.country,
      state: this.state.trim(),
      terms: this.terms,
      validDays: Number(this.validDays),
      notes: this.notes.trim(),
      opportunity: this.opportunity.trim(),
      lines: this.lines
    })
      .then((id) => {
        this.dispatchEvent(
          new CustomEvent(this.editing ? "saved" : "created", {
            detail: { id }
          })
        );
      })
      .catch((error) => {
        this.saveError = errorMessage(error);
        this.saving = false;
      });
  }

  handleCancel() {
    this.refs.modal.close();
  }

  handleClose() {
    this.dispatchEvent(new CustomEvent("close"));
  }
}