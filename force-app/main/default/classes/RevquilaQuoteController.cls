/**
 * Quotes for the Revquila screens: the list, one quote with its timeline, approval chain and
 * versions, saving a draft (new deals, amendments and renewals), a live server price preview,
 * and the actions that move a quote along (submit, approve, reject, recall, send, sign,
 * revise, make primary).
 *
 * A quote's amounts are worked out by RevquilaPricing when it is saved and stored on the record,
 * so a quote that has gone out never changes when prices or tax settings change later.
 */
public with sharing class RevquilaQuoteController {
  public static final String DRAFT = 'draft';
  public static final String APPROVAL = 'approval';
  public static final String APPROVED = 'approved';
  public static final String REJECTED = 'rejected';
  public static final String SENT = 'sent';
  public static final String SIGNED = 'signed';
  public static final String INVOICED = 'invoiced';
  public static final String PAID = 'paid';
  public static final String EXPIRED = 'expired';

  private static final Integer LIST_SIZE = 500;
  private static final String LINES =
    '(SELECT Id, Product__c, Product__r.Family, Description__c, Unit__c, Unit_Price__c, Quantity__c, Discount__c, ' +
    'List_Amount__c, Net_Amount__c, Recurring__c, Rule_Discount__c, Bundle__c, Bundle__r.Name, Group__c, Optional__c, ' +
    'Segment__c, Term_Months__c, Start_Date__c, End_Date__c, Attributes__c, Unit_Cost__c, Pricing_Method__c, Feature__c, ' +
    'Usage_Based__c, Price_Source__c FROM Lines__r ORDER BY Sort_Order__c)';
  private static final String FIELDS =
    'Id, Name, Display_Number__c, OwnerId, Account__c, Account__r.Name, Account__r.BillingCity, Account__r.BillingCountry, ' +
    'Account__r.BillingState, Account__r.BillingPostalCode, Account__r.OwnerId, Account__r.Industry, Account__r.Segment__c, ' +
    'Account__r.Price_Book__c, Account__r.Tax_Exempt__c, Account__r.Tax_Exemption_Reason__c, Account__r.Billing_Email__c, ' +
    'Account__r.Tax_Registration_Number__c, Country__c, Currency_Code__c, Exchange_Rate__c, Base_Net_Amount__c, ' +
    'Contact__c, Contact__r.Name, Contact__r.Email, Opportunity__c, Opportunity__r.Name, Opportunity__r.StageName, Owner.Name, ' +
    'Reference__c, Status__c, Version__c, Payment_Terms__c, Valid_Days__c, Quote_Date__c, Valid_Until__c, ' +
    'Region__c, Notes__c, Subtotal__c, Discount_Total__c, Net_Amount__c, Tax_Amount__c, Total__c, ' +
    'Tax_Breakup__c, Max_Discount__c, Policy_Issue__c, Approval_Decision__c, Approval_Requested_On__c, ' +
    'Approval_Decided_On__c, Approval_Decided_By__r.Name, Approval_Note__c, Sent_On__c, Signed_On__c, ' +
    'Signed_By_Name__c, Signed_By_Email__c, Signed_By_Title__c, Signature_Data__c, Signature_Audit__c, ' +
    'Type__c, Contract__c, Contract__r.Name, Contract__r.Display_Number__c, Primary__c, Term_Months__c, Start_Date__c, ' +
    'Cost_Total__c, Margin_Percent__c, Uplift_Percent__c, Version_History__c, Portal_Token__c, Approval_Step__c, ' +
    'Co_Term_End__c, Price_Book__c, CreatedDate, LastModifiedDate, ' +
    LINES;

  public class VersionView {
    @AuraEnabled
    public Integer version;
    @AuraEnabled
    public Decimal net;
    @AuraEnabled
    public Decimal total;
    @AuraEnabled
    public String terms;
    @AuraEnabled
    public Date sentOn;
    @AuraEnabled
    public Decimal maxDiscount;
    @AuraEnabled
    public List<RevquilaCore.LineView> lines;
  }

  public class QuoteView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Id accountId;
    @AuraEnabled
    public String account;
    @AuraEnabled
    public String city;
    @AuraEnabled
    public String registration;
    @AuraEnabled
    public Id contactId;
    @AuraEnabled
    public String contact;
    @AuraEnabled
    public Id opportunityId;
    @AuraEnabled
    public String opportunity;
    @AuraEnabled
    public String opportunityStage;
    @AuraEnabled
    public String owner;
    @AuraEnabled
    public String reference;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public Integer version;
    @AuraEnabled
    public String terms;
    @AuraEnabled
    public Integer validDays;
    @AuraEnabled
    public Date quoteDate;
    @AuraEnabled
    public Date validUntil;
    @AuraEnabled
    public String region;
    @AuraEnabled
    public String notes;
    @AuraEnabled
    public Decimal subtotal;
    @AuraEnabled
    public Decimal discountTotal;
    @AuraEnabled
    public Decimal net;
    @AuraEnabled
    public Decimal tax;
    @AuraEnabled
    public Decimal total;
    @AuraEnabled
    public Decimal maxDiscount;
    @AuraEnabled
    public String policyIssue;
    @AuraEnabled
    public List<RevquilaPricing.TaxLine> taxLines;
    @AuraEnabled
    public String approvalDecision;
    @AuraEnabled
    public Datetime approvalRequestedOn;
    @AuraEnabled
    public Datetime approvalDecidedOn;
    @AuraEnabled
    public String approvalDecidedBy;
    @AuraEnabled
    public String approvalNote;
    @AuraEnabled
    public Date sentOn;
    @AuraEnabled
    public Date signedOn;
    @AuraEnabled
    public String signedByName;
    @AuraEnabled
    public String signedByEmail;
    @AuraEnabled
    public String signedByTitle;
    @AuraEnabled
    public String signatureData;
    @AuraEnabled
    public String signatureAudit;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public String currencyCode;
    @AuraEnabled
    public Decimal exchangeRate;
    @AuraEnabled
    public Datetime createdOn;
    @AuraEnabled
    public Datetime modifiedOn;
    @AuraEnabled
    public List<RevquilaCore.LineView> lines;
    @AuraEnabled
    public String type;
    @AuraEnabled
    public Id sourceContractId;
    @AuraEnabled
    public String sourceContractNumber;
    @AuraEnabled
    public Boolean primary;
    @AuraEnabled
    public Integer termMonths;
    @AuraEnabled
    public Date startDate;
    @AuraEnabled
    public Decimal costTotal;
    @AuraEnabled
    public Decimal marginPercent;
    @AuraEnabled
    public Decimal upliftPercent;
    @AuraEnabled
    public Integer approvalStep;
    @AuraEnabled
    public Boolean canDecide = false;
    @AuraEnabled
    public Map<String, String> extra;
    // only on getQuote
    @AuraEnabled
    public List<RevquilaCore.EventView> events;
    @AuraEnabled
    public List<RevquilaApprovals.StepView> approvalSteps;
    @AuraEnabled
    public List<VersionView> versions;
    @AuraEnabled
    public String portalLink;
    @AuraEnabled
    public Id invoiceId;
    @AuraEnabled
    public String invoiceNumber;
    @AuraEnabled
    public String invoiceStatus;
    @AuraEnabled
    public Id subscriptionId;
    @AuraEnabled
    public String subscriptionName;
    @AuraEnabled
    public String subscriptionStatus;
    @AuraEnabled
    public Id orderId;
    @AuraEnabled
    public String orderNumber;
    @AuraEnabled
    public String orderStatus;
    @AuraEnabled
    public Id contractId;
    @AuraEnabled
    public String contractNumber;
    @AuraEnabled
    public String contractStatus;
  }

  /** What the quote form sends. The whole quote every time, not only what changed. */
  public class QuoteInput {
    public Id quoteId;
    public Id accountId;
    public Id contactId;
    public Id opportunityId;
    public String country;
    public String region;
    public String terms;
    public Integer validDays;
    public String notes;
    public String reference;
    public String type;
    public Id contractId;
    public Integer termMonths;
    public Date startDate;
    public Decimal upliftPercent;
    public Date coTermEnd;
    public List<RevquilaPricing.LineInput> lines;
  }

  /** What the live preview returns: the server's own sums for the lines as they are now. */
  public class PreviewView {
    @AuraEnabled
    public List<RevquilaCore.LineView> lines;
    @AuraEnabled
    public Decimal subtotal;
    @AuraEnabled
    public Decimal discountTotal;
    @AuraEnabled
    public Decimal net;
    @AuraEnabled
    public Decimal tax;
    @AuraEnabled
    public Decimal total;
    @AuraEnabled
    public Decimal maxDiscount;
    @AuraEnabled
    public List<RevquilaPricing.TaxLine> taxLines;
    @AuraEnabled
    public String policyIssue;
    @AuraEnabled
    public Decimal costTotal;
    @AuraEnabled
    public Decimal marginPercent;
    @AuraEnabled
    public Decimal optionalTotal;
    @AuraEnabled
    public List<RevquilaPricing.RuleOutcome> outcomes;
    @AuraEnabled
    public List<String> approvers;
  }

  // ---------------------------------------------------------------- reading

  /** The newest quotes first, each with its lines. */
  @AuraEnabled
  public static List<QuoteView> getQuotes() {
    try {
      return views('ORDER BY Quote_Date__c DESC, Name DESC LIMIT ' + LIST_SIZE);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Quotes for this and other controllers. `tail` is the WHERE, ORDER BY and LIMIT,
   * written by the caller as a constant: never build it from anything a user typed.
   */
  public static List<QuoteView> views(String tail) {
    List<QuoteView> views = new List<QuoteView>();
    List<String> extra = RevquilaCore.extraFields('quoteList', Quote__c.SObjectType);
    String extraSelect = '';
    for (String name : extra) {
      if (!FIELDS.contains(name)) {
        extraSelect += ', ' + name;
      }
    }
    Set<Id> mine = RevquilaApprovals.quotesForMe();
    for (
      Quote__c row : (List<Quote__c>) Database.query(
        'SELECT ' + FIELDS + extraSelect + ' FROM Quote__c ' + tail,
        AccessLevel.USER_MODE
      )
    ) {
      QuoteView quote = view(row);
      quote.canDecide = mine.contains(row.Id);
      if (!extra.isEmpty()) {
        quote.extra = RevquilaCore.extraValues(row, extra);
      }
      views.add(quote);
    }
    return views;
  }

  /** One quote with its timeline, approval chain, versions and the records that came from it. */
  @AuraEnabled
  public static QuoteView getQuote(Id quoteId) {
    try {
      Quote__c row = one(quoteId);
      QuoteView quote = view(row);
      List<String> extra = RevquilaCore.extraFields('quote360', Quote__c.SObjectType);
      if (!extra.isEmpty()) {
        quote.extra = RevquilaCore.extraValues(
          Database.query('SELECT ' + String.join(extra, ', ') + ' FROM Quote__c WHERE Id = :quoteId', AccessLevel.USER_MODE)[0],
          extra
        );
      }
      quote.events = RevquilaCore.eventsOf('Quote__c', quoteId);
      quote.approvalSteps = RevquilaApprovals.steps(quoteId);
      quote.canDecide = RevquilaApprovals.canDecide(quoteId);
      quote.versions = versions(row.Version_History__c);
      quote.portalLink = portalLink(row);
      for (Invoice__c invoice : [
        SELECT Id, Number__c, Sent_On__c, Due_On__c, Balance__c, Paid_Amount__c
        FROM Invoice__c
        WHERE Quote__c = :quoteId
        WITH USER_MODE
        ORDER BY CreatedDate DESC
        LIMIT 1
      ]) {
        quote.invoiceId = invoice.Id;
        quote.invoiceNumber = invoice.Number__c;
        quote.invoiceStatus = RevquilaInvoiceController.statusOf(invoice);
      }
      for (Subscription__c subscription : [
        SELECT Id, Name, Display_Number__c, Status__c
        FROM Subscription__c
        WHERE Quote__c = :quoteId
        WITH USER_MODE
        ORDER BY CreatedDate DESC
        LIMIT 1
      ]) {
        quote.subscriptionId = subscription.Id;
        quote.subscriptionName = RevquilaCore.shownNumber(subscription);
        quote.subscriptionStatus = subscription.Status__c;
      }
      for (Order__c order : [
        SELECT Id, Name, Display_Number__c, Status__c
        FROM Order__c
        WHERE Quote__c = :quoteId
        WITH USER_MODE
        ORDER BY CreatedDate DESC
        LIMIT 1
      ]) {
        quote.orderId = order.Id;
        quote.orderNumber = RevquilaCore.shownNumber(order);
        quote.orderStatus = order.Status__c;
      }
      for (Contract__c contract : [
        SELECT Id, Name, Display_Number__c, Status__c
        FROM Contract__c
        WHERE Quote__c = :quoteId
        WITH USER_MODE
        ORDER BY CreatedDate DESC
        LIMIT 1
      ]) {
        quote.contractId = contract.Id;
        quote.contractNumber = RevquilaCore.shownNumber(contract);
        quote.contractStatus = contract.Status__c;
      }
      return quote;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static List<VersionView> versions(String saved) {
    if (String.isBlank(saved)) {
      return new List<VersionView>();
    }
    try {
      return (List<VersionView>) JSON.deserialize(saved, List<VersionView>.class);
    } catch (Exception e) {
      return new List<VersionView>();
    }
  }

  private static String portalLink(Quote__c quote) {
    RevquilaSettings settings = RevquilaSettings.current();
    if (!settings.portalEnabled || String.isBlank(settings.portalUrl) || String.isBlank(quote.Portal_Token__c)) {
      return null;
    }
    return settings.portalUrl.removeEnd('/') + '/' + RevquilaCore.prefix() + 'RevquilaPortalQuote?t=' + quote.Portal_Token__c;
  }

  /** Whether the user may approve and reject quotes. */
  @AuraEnabled
  public static Boolean canApprove() {
    return RevquilaCore.canApprove();
  }

  /** What the user may do: approve, catalog, billing, payments, revenue, settings, prices, admin. */
  @AuraEnabled
  public static Map<String, Boolean> getGrants() {
    try {
      return RevquilaCore.grants();
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- saving

  /** Creates a quote, or changes a draft. `input` is a QuoteInput as JSON. Returns the quote's id. */
  @AuraEnabled
  public static Id saveQuote(String input) {
    try {
      return save((QuoteInput) JSON.deserialize(input, QuoteInput.class));
    } catch (JSONException e) {
      throw RevquilaCore.failure(
        'The quote could not be read. Reload the page and try again.'
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Prices the lines as the server would save them, with the product rules and who would approve. */
  @AuraEnabled
  public static PreviewView previewQuote(String input) {
    try {
      QuoteInput request = (QuoteInput) JSON.deserialize(input, QuoteInput.class);
      Account account = request.accountId == null ? null : account(request.accountId);
      RevquilaPricing.Context context = pricingContext(request, null, account);
      String terms = String.isBlank(request.terms) ? RevquilaSettings.current().standardTerms : request.terms;
      RevquilaPricing.Totals totals = RevquilaPricing.price(request.lines, terms, context);
      Map<String, Object> facts = RevquilaPricing.facts(totals, terms, context);
      PreviewView preview = new PreviewView();
      preview.lines = totals.lines;
      preview.subtotal = totals.subtotal;
      preview.discountTotal = totals.discountTotal;
      preview.net = totals.net;
      preview.tax = totals.tax;
      preview.total = totals.total;
      preview.maxDiscount = totals.maxDiscount;
      preview.taxLines = totals.taxLines;
      preview.policyIssue = totals.policyIssue;
      preview.costTotal = totals.costTotal;
      preview.marginPercent = totals.marginPercent;
      preview.optionalTotal = totals.optionalTotal;
      preview.outcomes = RevquilaPricing.productRules(totals.lines, facts);
      for (RevquilaPricing.RuleOutcome addition : totals.additions) {
        preview.outcomes.add(addition);
      }
      preview.approvers = new List<String>();
      RevquilaSettings settings = RevquilaSettings.current();
      if (totals.policyIssue != null && settings.approvalsMode == 'rules') {
        for (RevquilaSettings.ApprovalRule rule : settings.approvalRules) {
          if (rule.active != false && RevquilaRules.matches(rule.conditions, facts) && rule.steps != null) {
            for (RevquilaSettings.ApprovalStepDef step : rule.steps) {
              preview.approvers.add(String.isBlank(step.label) ? rule.name : step.label);
            }
          }
        }
      }
      return preview;
    } catch (JSONException e) {
      throw RevquilaCore.failure('The quote could not be read. Reload the page and try again.');
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Copies a quote as a new draft at today's prices and returns the copy's id. */
  @AuraEnabled
  public static Id cloneQuote(Id quoteId) {
    try {
      Quote__c source = one(quoteId);
      QuoteInput copy = new QuoteInput();
      copy.accountId = source.Account__c;
      copy.contactId = source.Contact__c;
      copy.opportunityId = source.Opportunity__c;
      copy.country = source.Country__c;
      copy.region = source.Region__c;
      copy.terms = source.Payment_Terms__c;
      copy.validDays = source.Valid_Days__c == null
        ? null
        : source.Valid_Days__c.intValue();
      copy.notes = source.Notes__c;
      copy.reference = source.Reference__c;
      copy.termMonths = source.Term_Months__c == null ? null : source.Term_Months__c.intValue();
      copy.lines = inputs(source.Lines__r);
      Id copyId = save(copy);
      insert as user RevquilaCore.event(
        copyId,
        'Cloned from ' + RevquilaCore.shownNumber(source),
        'Priced again at today\'s list prices',
        RevquilaCore.TONE_ACCENT
      );
      return copyId;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** The lines of a quote, as the input that prices them again. */
  public static List<RevquilaPricing.LineInput> inputs(
    List<Quote_Line__c> lines
  ) {
    List<RevquilaPricing.LineInput> inputs = new List<RevquilaPricing.LineInput>();
    for (Quote_Line__c line : lines) {
      RevquilaPricing.LineInput input = new RevquilaPricing.LineInput();
      input.productId = line.Product__c;
      input.name = line.Description__c;
      input.unit = line.Unit__c;
      input.price = line.Unit_Price__c;
      input.qty = line.Quantity__c;
      input.discount = line.Discount__c;
      input.bundleId = line.Bundle__c;
      input.groupName = line.Group__c;
      input.optional = line.Optional__c;
      input.segment = line.Segment__c;
      input.termMonths = line.Term_Months__c == null ? null : line.Term_Months__c.intValue();
      input.startDate = line.Start_Date__c;
      input.attributes = line.Attributes__c;
      input.feature = line.Feature__c;
      inputs.add(input);
    }
    return inputs;
  }

  private static Account account(Id accountId) {
    List<Account> accounts = [
      SELECT Id, Name, BillingState, BillingCountry, BillingPostalCode, Industry, Segment__c, Price_Book__c,
        Tax_Exempt__c, Tax_Exemption_Reason__c, Payment_Terms__c, OwnerId
      FROM Account
      WHERE Id = :accountId
      WITH USER_MODE
    ];
    if (accounts.isEmpty()) {
      throw new RevquilaCore.ProblemException('That account no longer exists.');
    }
    return accounts[0];
  }

  // Who the quote is for, for pricing: price book, segment, tax exemption, term, country
  private static RevquilaPricing.Context pricingContext(QuoteInput request, Quote__c before, Account account) {
    RevquilaSettings settings = RevquilaSettings.current();
    RevquilaPricing.Context context = new RevquilaPricing.Context();
    context.accountId = account == null ? null : account.Id;
    context.accountName = account == null ? null : account.Name;
    context.segment = account == null ? null : account.Segment__c;
    context.industry = account == null ? null : account.Industry;
    context.priceBookId = account == null ? null : account.Price_Book__c;
    context.taxExempt = account != null && account.Tax_Exempt__c == true;
    context.exemptionReason = account == null ? null : account.Tax_Exemption_Reason__c;
    context.postalCode = account == null ? null : account.BillingPostalCode;
    context.country = firstText(
      new List<String>{
        request.country,
        before == null ? null : before.Country__c,
        account == null ? null : account.BillingCountry
      }
    );
    RevquilaSettings.Market market = settings.market(context.country);
    context.country = market.country;
    context.region = firstText(
      new List<String>{
        request.region,
        before == null ? null : before.Region__c,
        account == null ? null : account.BillingState,
        market == settings.home ? settings.homeRegion : null
      }
    );
    Integer term = request.termMonths;
    if (term == null && before != null && before.Term_Months__c != null) {
      term = before.Term_Months__c.intValue();
    }
    context.termMonths = term == null ? settings.termDefaultMonths : term;
    context.quoteType = firstText(new List<String>{ request.type, before == null ? null : before.Type__c, 'new' });
    context.ownerName = UserInfo.getName();
    context.allowPriceEdit = settings.allowPriceEdit || RevquilaCore.hasPermission(settings.permissions.get('prices')) || context.quoteType == 'renewal' || context.quoteType == 'amendment';
    return context;
  }

  /** Creates or changes a quote from its full input. Also used to raise amendment and renewal quotes. */
  public static Id save(QuoteInput request) {
    RevquilaSettings settings = RevquilaSettings.current();
    Boolean isNew = request.quoteId == null;
    // `before` is the quote as it is saved now; `quote` carries only what this save writes
    Quote__c before = isNew ? new Quote__c() : one(request.quoteId);
    Quote__c quote;
    if (isNew) {
      if (request.accountId == null) {
        throw new RevquilaCore.ProblemException(
          'Pick the account the quote is for.'
        );
      }
      quote = new Quote__c(
        Account__c = request.accountId,
        Version__c = 1,
        Quote_Date__c = Date.today(),
        Type__c = String.isBlank(request.type) ? 'new' : request.type,
        Contract__c = request.contractId,
        Uplift_Percent__c = request.upliftPercent,
        Co_Term_End__c = request.coTermEnd,
        Portal_Token__c = RevquilaCore.token()
      );
    } else {
      if (before.Status__c != DRAFT && before.Status__c != REJECTED) {
        throw new RevquilaCore.ProblemException(
          'Only a draft can be edited. Revise the quote to change one that has gone out.'
        );
      }
      quote = new Quote__c(Id = before.Id);
    }
    Id accountId = isNew ? request.accountId : before.Account__c;
    Account account = account(accountId);
    if (isNew && String.isBlank(request.terms) && String.isNotBlank(account.Payment_Terms__c)) {
      request.terms = account.Payment_Terms__c;
    }
    RevquilaPricing.Context context = pricingContext(request, isNew ? null : before, account);
    String terms = firstText(
      new List<String>{
        request.terms,
        before.Payment_Terms__c,
        settings.standardTerms
      }
    );
    Integer validDays = request.validDays;
    if (validDays == null) {
      validDays = before.Valid_Days__c == null
        ? settings.quoteValidDays
        : before.Valid_Days__c.intValue();
    }
    if (validDays < 1 || validDays > 365) {
      throw new RevquilaCore.ProblemException(
        'A quote is valid for 1 to 365 days.'
      );
    }
    String reference = firstText(
      new List<String>{ request.reference, before.Reference__c, 'Quick Quote' }
    );
    RevquilaPricing.Totals totals = RevquilaPricing.price(
      request.lines,
      terms,
      context
    );
    // products a price rule adds come onto the quote by themselves
    if (!totals.additions.isEmpty()) {
      for (RevquilaPricing.RuleOutcome addition : totals.additions) {
        RevquilaPricing.LineInput added = new RevquilaPricing.LineInput();
        added.productId = addition.addProductId;
        added.qty = addition.addQty;
        added.discount = 0;
        added.groupName = 'Added by ' + addition.name;
        request.lines.add(added);
      }
      totals = RevquilaPricing.price(request.lines, terms, context);
    }
    // the product rules: a validation rule that holds stops the save
    Map<String, Object> facts = RevquilaPricing.facts(totals, terms, context);
    List<String> warnings = new List<String>();
    for (RevquilaPricing.RuleOutcome outcome : RevquilaPricing.productRules(totals.lines, facts)) {
      if (outcome.kind == 'validation') {
        throw new RevquilaCore.ProblemException(
          String.isBlank(outcome.message) ? outcome.name + ': this combination is not allowed.' : outcome.message
        );
      }
      if (outcome.kind == 'alert' && String.isNotBlank(outcome.message)) {
        warnings.add(outcome.message);
      }
    }

    List<String> changed = isNew
      ? new List<String>()
      : changes(before, request, context.region, terms, validDays, reference, totals);
    if (!isNew && changed.isEmpty()) {
      return before.Id;
    }
    Date quoteDate = before.Quote_Date__c == null
      ? Date.today()
      : before.Quote_Date__c;

    quote.Contact__c = request.contactId;
    quote.Opportunity__c = request.opportunityId;
    quote.Reference__c = reference.abbreviate(255);
    quote.Region__c = context.region;
    quote.Payment_Terms__c = terms;
    quote.Valid_Days__c = validDays;
    quote.Valid_Until__c = quoteDate.addDays(validDays);
    quote.Notes__c = String.isBlank(request.notes)
      ? null
      : request.notes.trim();
    quote.Subtotal__c = totals.subtotal;
    quote.Discount_Total__c = totals.discountTotal;
    quote.Net_Amount__c = totals.net;
    quote.Tax_Amount__c = totals.tax;
    quote.Total__c = totals.total;
    quote.Tax_Breakup__c = JSON.serialize(totals.taxLines);
    quote.Max_Discount__c = totals.maxDiscount;
    quote.Policy_Issue__c = totals.policyIssue;
    quote.Country__c = totals.country;
    quote.Currency_Code__c = totals.currencyCode;
    quote.Exchange_Rate__c = totals.exchangeRate;
    quote.Base_Net_Amount__c = totals.baseNet;
    quote.Term_Months__c = context.termMonths;
    quote.Start_Date__c = request.startDate != null ? request.startDate : before.Start_Date__c;
    quote.Cost_Total__c = totals.costTotal;
    quote.Margin_Percent__c = totals.marginPercent;
    quote.Price_Book__c = totals.priceBookId;

    List<Revenue_Event__c> events = new List<Revenue_Event__c>();
    Boolean needsApproval = false;
    if (isNew) {
      // A new quote outside the policy goes straight to an approver
      needsApproval = totals.policyIssue != null;
      quote.Status__c = needsApproval ? APPROVAL : DRAFT;
      requestApprovalIfNeeded(quote);
      insert as user quote;
      RevquilaCore.stampNumber(quote, 'quote');
      events.add(
        RevquilaCore.event(
          quote.Id,
          quote.Type__c == 'amendment' ? 'Amendment quote created' : (quote.Type__c == 'renewal' ? 'Renewal quote created' : 'Quote created'),
          reference,
          RevquilaCore.TONE_ACCENT
        )
      );
      if (needsApproval) {
        events.add(approvalRequested(quote.Id, totals.policyIssue));
      }
    } else {
      quote.Status__c = DRAFT;
      update as user quote;
      delete as user [
        SELECT Id
        FROM Quote_Line__c
        WHERE Quote__c = :quote.Id
        WITH USER_MODE
      ];
      events.add(
        RevquilaCore.event(
          quote.Id,
          'Quote edited',
          'Changed ' + String.join(changed, ', '),
          RevquilaCore.TONE_ACCENT
        )
      );
    }
    for (String warning : warnings) {
      events.add(RevquilaCore.event(quote.Id, 'Check', warning, RevquilaCore.TONE_WARN));
    }
    insert as user lineRows(quote.Id, totals.lines);
    insert as user events;
    Quote__c saved = one(quote.Id);
    if (needsApproval) {
      startApproval(saved, facts);
    }
    if (isNew) {
      fire(saved, RevquilaCore.QUOTE_CREATED, figures(saved), null);
    }
    if (saved.Primary__c) {
      syncPrimary(saved);
    }
    return quote.Id;
  }

  // Starts the approval chain and tells the approvers
  private static void startApproval(Quote__c quote, Map<String, Object> facts) {
    List<Approval_Step__c> pending = RevquilaApprovals.start(quote, facts);
    update as user new Quote__c(Id = quote.Id, Approval_Step__c = 1);
    Map<String, Object> figures = figures(quote);
    figures.put('quote.policyIssue', quote.Policy_Issue__c);
    fire(quote, RevquilaCore.QUOTE_SUBMITTED, figures, RevquilaApprovals.approversOf(pending));
  }

  /** The values automation, sync and merge fields can use at any point of a quote's life. */
  public static Map<String, Object> figures(Quote__c quote) {
    return new Map<String, Object>{
      'record.number' => RevquilaCore.shownNumber(quote),
      'quote.number' => RevquilaCore.shownNumber(quote),
      'quote.reference' => quote.Reference__c,
      'quote.net' => RevquilaCore.orZero(quote.Net_Amount__c),
      'quote.total' => RevquilaCore.orZero(quote.Total__c),
      'quote.baseNet' => RevquilaCore.orZero(quote.Base_Net_Amount__c),
      'quote.currency' => quote.Currency_Code__c,
      'quote.validUntil' => quote.Valid_Until__c,
      'quote.date' => quote.Quote_Date__c,
      'quote.status' => quote.Status__c,
      'quote.terms' => quote.Payment_Terms__c,
      'quote.country' => quote.Country__c,
      'quote.region' => quote.Region__c,
      'quote.type' => quote.Type__c,
      'quote.maxDiscount' => RevquilaCore.orZero(quote.Max_Discount__c),
      'quote.margin' => RevquilaCore.orZero(quote.Margin_Percent__c),
      'quote.termMonths' => quote.Term_Months__c,
      'quote.policyIssue' => quote.Policy_Issue__c,
      'quote.link' => portalLink(quote),
      'account.name' => quote.Account__r?.Name,
      'account.segment' => quote.Account__r?.Segment__c,
      'account.industry' => quote.Account__r?.Industry,
      'contact.name' => quote.Contact__r?.Name,
      'owner.name' => quote.Owner?.Name,
      'company.name' => RevquilaSettings.current().companyName
    };
  }

  /** Runs the automation for a moment of a quote. */
  public static void fire(Quote__c quote, String moment, Map<String, Object> figures, Set<Id> approvers) {
    RevquilaAutomation.Context context = new RevquilaAutomation.Context();
    context.moment = moment;
    context.recordId = quote.Id;
    context.recordKind = 'quote';
    context.facts = figures;
    context.quote = quote;
    context.targets.put('Account', quote.Account__c);
    context.targets.put('Contact', quote.Contact__c);
    context.targets.put('Opportunity', quote.Opportunity__c);
    context.targets.put('Quote', quote.Id);
    context.emails.put('contact', quote.Contact__r?.Email);
    context.emails.put('billing', String.isNotBlank(quote.Account__r?.Billing_Email__c) ? quote.Account__r.Billing_Email__c : quote.Contact__r?.Email);
    Set<Id> userIds = new Set<Id>{ quote.OwnerId, quote.Account__r?.OwnerId };
    Map<Id, User> users = new Map<Id, User>([SELECT Id, Email FROM User WHERE Id IN :userIds]);
    if (users.containsKey(quote.OwnerId)) {
      context.emails.put('owner', users.get(quote.OwnerId).Email);
      context.users.put('owner', new Set<Id>{ quote.OwnerId });
    }
    if (quote.Account__r?.OwnerId != null && users.containsKey(quote.Account__r.OwnerId)) {
      context.emails.put('account_owner', users.get(quote.Account__r.OwnerId).Email);
      context.users.put('account_owner', new Set<Id>{ quote.Account__r.OwnerId });
    }
    if (approvers != null) {
      context.users.put('approvers', approvers);
    }
    RevquilaAutomation.fire(context);
  }

  // ---------------------------------------------------------------- actions

  /**
   * Moves a quote along. action is one of:
   * submit (for approval), approve, reject (note is the reason), recall, send, sign, revise, primary.
   */
  @AuraEnabled
  public static void act(Id quoteId, String action, String note) {
    try {
      // `quote` is the saved quote; `change` carries only what this action writes
      Quote__c quote = one(quoteId);
      Quote__c change = new Quote__c(Id = quote.Id);
      List<Revenue_Event__c> events = new List<Revenue_Event__c>();
      String status = quote.Status__c;
      String userName = UserInfo.getName();
      // the automation to run once the change is saved, and what it may use
      String moment;
      Set<Id> approvers;
      Map<String, Object> figures = figures(quote);

      if (action == 'submit') {
        need(status == DRAFT, 'Only a draft can be sent for approval.');
        need(
          quote.Policy_Issue__c != null,
          'This quote is inside the pricing policy, so it needs no approval.'
        );
        change.Status__c = APPROVAL;
        change.Approval_Step__c = 1;
        requestApprovalIfNeeded(change);
        events.add(approvalRequested(quote.Id, quote.Policy_Issue__c));
        update as user change;
        insert as user events;
        startApprovalChain(quote);
        return;
      } else if (action == 'approve' || action == 'reject') {
        need(status == APPROVAL, 'This quote is not waiting for approval.');
        Boolean isApproval = action == 'approve';
        need(
          isApproval || String.isNotBlank(note),
          'Tell the rep why, so they can fix the quote.'
        );
        if (![SELECT Id FROM Approval_Step__c WHERE Quote__c = :quoteId WITH USER_MODE LIMIT 1].isEmpty()) {
          RevquilaApprovals.Outcome outcome = RevquilaApprovals.decide(quoteId, isApproval, note);
          if (!outcome.complete) {
            Integer nextStep = outcome.next.isEmpty() ? RevquilaCore.orZero(quote.Approval_Step__c).intValue() : RevquilaCore.orZero(outcome.next[0].Step__c).intValue();
            change.Approval_Step__c = nextStep;
            update as user change;
            insert as user RevquilaCore.event(
              quote.Id,
              outcome.stepLabel + ' approved by ' + userName,
              outcome.next.isEmpty() ? 'Waiting for the other approvers of this step' : 'Now with step ' + nextStep,
              RevquilaCore.TONE_GOOD
            );
            if (!outcome.next.isEmpty()) {
              fire(quote, RevquilaCore.QUOTE_SUBMITTED, figures, RevquilaApprovals.approversOf(outcome.next));
            }
            return;
          }
        } else {
          need(
            RevquilaCore.canApprove(),
            'You need the RevX Admin permission set to approve or reject quotes.'
          );
        }
        change.Status__c = isApproval ? APPROVED : REJECTED;
        change.Approval_Decision__c = isApproval ? 'approved' : 'rejected';
        change.Approval_Decided_On__c = System.now();
        change.Approval_Decided_By__c = UserInfo.getUserId();
        change.Approval_Note__c = String.isBlank(note)
          ? null
          : note.trim().abbreviate(255);
        events.add(
          RevquilaCore.event(
            quote.Id,
            (isApproval ? 'Approved by ' : 'Rejected by ') + userName,
            isApproval ? quote.Policy_Issue__c : change.Approval_Note__c,
            isApproval ? RevquilaCore.TONE_GOOD : RevquilaCore.TONE_BAD
          )
        );
        moment = isApproval ? RevquilaCore.QUOTE_APPROVED : RevquilaCore.QUOTE_REJECTED;
        figures.put('quote.note', change.Approval_Note__c);
      } else if (action == 'recall') {
        need(status == APPROVAL, 'Only a quote waiting for approval can be recalled.');
        RevquilaApprovals.recall(quoteId);
        change.Status__c = DRAFT;
        change.Approval_Decision__c = null;
        change.Approval_Step__c = null;
        events.add(RevquilaCore.event(quote.Id, 'Recalled by ' + userName, 'Back to a draft', RevquilaCore.TONE_WARN));
      } else if (action == 'send') {
        need(
          status == APPROVED ||
          (status == DRAFT &&
          quote.Policy_Issue__c == null),
          status == DRAFT
            ? 'This quote is outside the pricing policy. Send it for approval first.'
            : 'Only a draft or an approved quote can be marked as sent.'
        );
        change.Status__c = SENT;
        change.Sent_On__c = Date.today();
        if (String.isBlank(quote.Portal_Token__c)) {
          change.Portal_Token__c = RevquilaCore.token();
        }
        moment = RevquilaCore.QUOTE_SENT;
        events.add(
          RevquilaCore.event(
            quote.Id,
            'Marked as sent',
            'Version ' +
              quote.Version__c.intValue() +
              ' locked' +
              (quote.Contact__c == null
                ? ''
                : ' · to ' + quote.Contact__r.Name),
            RevquilaCore.TONE_ACCENT
          )
        );
      } else if (action == 'sign') {
        need(status == SENT, 'Only a quote that was sent can be signed.');
        change.Status__c = SIGNED;
        change.Signed_On__c = Date.today();
        update as user change;
        events.add(
          RevquilaCore.event(
            quote.Id,
            'Signed',
            'Version ' +
              quote.Version__c.intValue() +
              ' accepted by the customer',
            RevquilaCore.TONE_TEAL
          )
        );
        quote = one(quoteId);
        events.addAll(book(quote, figures));
        figures.put('quote.signedOn', Date.today());
        insert as user events;
        fire(quote, RevquilaCore.QUOTE_SIGNED, figures, null);
        return;
      } else if (action == 'invoice') {
        throw new RevquilaCore.ProblemException(
          'Invoices are raised from the order: open the order, activate it and create the invoice there.'
        );
      } else if (action == 'revise') {
        need(
          status == APPROVAL || status == APPROVED || status == SENT || status == EXPIRED || status == REJECTED,
          'Only a quote that is waiting, approved, sent, rejected or expired can be revised.'
        );
        if (status == APPROVAL) {
          RevquilaApprovals.recall(quoteId);
        }
        Integer version = quote.Version__c.intValue() + 1;
        change.Version__c = version;
        change.Status__c = DRAFT;
        change.Sent_On__c = null;
        change.Approval_Decision__c = null;
        change.Approval_Step__c = null;
        change.Version_History__c = withVersion(quote);
        if (status == EXPIRED || (quote.Valid_Until__c != null && quote.Valid_Until__c < Date.today())) {
          Integer validDays = quote.Valid_Days__c == null ? RevquilaSettings.current().quoteValidDays : quote.Valid_Days__c.intValue();
          change.Quote_Date__c = Date.today();
          change.Valid_Until__c = Date.today().addDays(validDays);
        }
        events.add(
          RevquilaCore.event(
            quote.Id,
            'Revised to v' + version,
            'v' + (version - 1) + ' is kept in the version history to compare',
            RevquilaCore.TONE_ACCENT
          )
        );
      } else if (action == 'primary') {
        need(quote.Opportunity__c != null, 'Link an opportunity first: the primary quote is the one its figures come from.');
        List<Quote__c> others = new List<Quote__c>();
        for (Quote__c other : [
          SELECT Id
          FROM Quote__c
          WHERE Opportunity__c = :quote.Opportunity__c AND Primary__c = TRUE AND Id != :quoteId
          WITH USER_MODE
        ]) {
          others.add(new Quote__c(Id = other.Id, Primary__c = false));
        }
        update as user others;
        change.Primary__c = true;
        events.add(RevquilaCore.event(quote.Id, 'Made primary', 'Its figures go to ' + quote.Opportunity__r.Name, RevquilaCore.TONE_ACCENT));
        update as user change;
        insert as user events;
        syncPrimary(one(quoteId));
        return;
      } else {
        throw new RevquilaCore.ProblemException(
          'RevX does not know that action.'
        );
      }
      update as user change;
      insert as user events;
      if (moment != null) {
        Quote__c saved = one(quoteId);
        fire(saved, moment, figures(saved).clone(), approvers);
      }
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static void startApprovalChain(Quote__c quote) {
    Account account = account(quote.Account__c);
    QuoteInput request = new QuoteInput();
    request.country = quote.Country__c;
    request.region = quote.Region__c;
    request.termMonths = quote.Term_Months__c == null ? null : quote.Term_Months__c.intValue();
    RevquilaPricing.Context context = pricingContext(request, quote, account);
    RevquilaPricing.Totals totals = RevquilaPricing.price(inputs(quote.Lines__r), quote.Payment_Terms__c, context);
    startApproval(one(quote.Id), RevquilaPricing.facts(totals, quote.Payment_Terms__c, context));
  }

  // The current version, added to the version history so it can be compared later
  private static String withVersion(Quote__c quote) {
    List<VersionView> history = versions(quote.Version_History__c);
    VersionView current = new VersionView();
    current.version = quote.Version__c.intValue();
    current.net = quote.Net_Amount__c;
    current.total = quote.Total__c;
    current.terms = quote.Payment_Terms__c;
    current.sentOn = quote.Sent_On__c;
    current.maxDiscount = quote.Max_Discount__c;
    current.lines = lineViews(quote.Lines__r);
    history.add(current);
    while (history.size() > 10) {
      history.remove(0);
    }
    String saved = JSON.serialize(history);
    return saved.length() > 131000 ? saved.left(131000) : saved;
  }

  // A primary quote's lines and net amount sync to its opportunity for Sales Forecasting
  private static void syncPrimary(Quote__c quote) {
    if (quote.Opportunity__c == null) {
      return;
    }
    RevquilaOliSync.syncOpportunity(quote.Id);
  }

  /** AuraEnabled endpoint to explicitly sync quote lines to OpportunityLineItems */
  @AuraEnabled
  public static RevquilaOliSync.SyncResult syncOpportunityLines(Id quoteId) {
    return RevquilaOliSync.syncOpportunity(quoteId);
  }

  /**
   * What a signed quote becomes. A new deal: an order, and for its recurring lines a contract
   * and a subscription. An amendment: the subscription changes and an order for the prorated
   * difference. A renewal: a new term on the subscription, a new contract, and its order.
   * Returns the timeline entries for the quote.
   */
  private static List<Revenue_Event__c> book(Quote__c quote, Map<String, Object> figures) {
    List<Revenue_Event__c> events = new List<Revenue_Event__c>();
    if (quote.Type__c == 'amendment' && quote.Contract__c != null) {
      Order__c order = RevquilaContractController.applyAmendment(quote);
      events.add(RevquilaCore.event(quote.Id, 'Amendment applied', 'Contract ' + quote.Contract__r?.Name + (order == null ? '' : ' · order ' + RevquilaCore.shownNumber(order)), RevquilaCore.TONE_GOOD));
      if (order != null) {
        figures.put('order.number', RevquilaCore.shownNumber(order));
      }
      return events;
    }
    if (quote.Type__c == 'renewal' && quote.Contract__c != null) {
      Contract__c renewed = RevquilaContractController.applyRenewal(quote);
      events.add(RevquilaCore.event(quote.Id, 'Renewal signed', 'New term on contract ' + RevquilaCore.shownNumber(renewed), RevquilaCore.TONE_GOOD));
      figures.put('contract.number', RevquilaCore.shownNumber(renewed));
      return events;
    }
    Subscription__c subscription = RevquilaSubscriptionController.startFor(
      quote
    );
    if (subscription != null) {
      events.add(
        RevquilaCore.event(
          quote.Id,
          'Subscription started',
          RevquilaCore.shownNumber(subscription),
          RevquilaCore.TONE_GOOD
        )
      );
    }
    Contract__c contract = RevquilaContractController.startFor(
      quote,
      subscription
    );
    if (contract != null) {
      events.add(
        RevquilaCore.event(
          quote.Id,
          'Contract started',
          RevquilaCore.shownNumber(contract),
          RevquilaCore.TONE_GOOD
        )
      );
      figures.put('contract.number', RevquilaCore.shownNumber(contract));
    }
    Order__c order = RevquilaOrderController.bookFor(quote, contract);
    events.add(
      RevquilaCore.event(
        quote.Id,
        'Order booked',
        RevquilaCore.shownNumber(order) + ' · activate it to invoice',
        RevquilaCore.TONE_ACCENT
      )
    );
    figures.put('order.number', RevquilaCore.shownNumber(order));
    return events;
  }

  /** Marks a signed quote as invoiced once its order is invoiced. */
  public static void markInvoiced(Id quoteId, Invoice__c invoice) {
    List<Quote__c> quotes = [
      SELECT Id, Status__c
      FROM Quote__c
      WHERE Id = :quoteId
      WITH USER_MODE
    ];
    if (quotes.isEmpty() || quotes[0].Status__c != SIGNED) {
      return;
    }
    update as user new Quote__c(Id = quoteId, Status__c = INVOICED);
    insert as user RevquilaCore.event(
      quoteId,
      'Invoice raised',
      invoice.Number__c + ' · due ' + RevquilaCore.dayText(invoice.Due_On__c),
      RevquilaCore.TONE_ACCENT
    );
  }

  /** Approves every quote in the list the user may decide now. Returns how many moved on. */
  @AuraEnabled
  public static Integer approveAll(List<Id> quoteIds) {
    try {
      Set<Id> decidable = RevquilaApprovals.quotesForMe();
      Boolean simple = RevquilaCore.canApprove();
      Integer decided = 0;
      for (Quote__c quote : [
        SELECT Id
        FROM Quote__c
        WHERE Id IN :quoteIds AND Status__c = :APPROVAL
        WITH USER_MODE
      ]) {
        if (decidable.contains(quote.Id) || simple) {
          act(quote.Id, 'approve', null);
          decided++;
        }
      }
      need(
        decided > 0 || quoteIds.isEmpty() || simple,
        'You need the RevX Admin permission set to approve or reject quotes.'
      );
      return decided;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Marks the quote behind a settled invoice as paid. */
  public static void markPaid(Id quoteId, String invoiceNumber) {
    List<Quote__c> quotes = [
      SELECT Id, Status__c
      FROM Quote__c
      WHERE Id = :quoteId AND Status__c = :INVOICED
      WITH USER_MODE
    ];
    if (quotes.isEmpty()) {
      return;
    }
    update as user new Quote__c(Id = quoteId, Status__c = PAID);
    insert as user RevquilaCore.event(
      quoteId,
      'Paid in full',
      invoiceNumber + ' is settled',
      RevquilaCore.TONE_GOOD
    );
    Quote__c paid = one(quoteId);
    Map<String, Object> figures = figures(paid);
    figures.put('invoice.number', invoiceNumber);
    RevquilaSync.fire(RevquilaSync.INVOICE_PAID, paid, figures);
  }

  // ---------------------------------------------------------------- helpers

  public static Quote__c one(Id quoteId) {
    List<Quote__c> rows = (List<Quote__c>) Database.query(
      'SELECT ' + FIELDS + ' FROM Quote__c WHERE Id = :quoteId',
      AccessLevel.USER_MODE
    );
    if (rows.isEmpty()) {
      throw new RevquilaCore.ProblemException('That quote no longer exists.');
    }
    return rows[0];
  }

  private static void need(Boolean condition, String message) {
    if (condition != true) {
      throw new RevquilaCore.ProblemException(message);
    }
  }

  private static String firstText(List<String> candidates) {
    for (String candidate : candidates) {
      if (String.isNotBlank(candidate)) {
        return candidate.trim();
      }
    }
    return null;
  }

  private static void requestApprovalIfNeeded(Quote__c quote) {
    if (quote.Status__c != APPROVAL) {
      return;
    }
    quote.Approval_Decision__c = 'pending';
    quote.Approval_Requested_On__c = System.now();
    quote.Approval_Decided_On__c = null;
    quote.Approval_Decided_By__c = null;
    quote.Approval_Note__c = null;
  }

  private static Revenue_Event__c approvalRequested(
    Id quoteId,
    String policyIssue
  ) {
    return RevquilaCore.event(
      quoteId,
      'Approval requested',
      policyIssue,
      RevquilaCore.TONE_WARN
    );
  }

  // What an edit changed, in words, for the timeline. Empty when nothing did.
  private static List<String> changes(
    Quote__c quote,
    QuoteInput request,
    String region,
    String terms,
    Integer validDays,
    String reference,
    RevquilaPricing.Totals totals
  ) {
    List<String> changed = new List<String>();
    if (quote.Contact__c != request.contactId) {
      changed.add('contact');
    }
    if (quote.Opportunity__c != request.opportunityId) {
      changed.add('opportunity');
    }
    if (quote.Region__c != region) {
      changed.add('place of supply');
    }
    if (quote.Payment_Terms__c != terms) {
      changed.add('payment terms');
    }
    if (quote.Valid_Days__c != validDays) {
      changed.add('validity');
    }
    if (quote.Reference__c != reference) {
      changed.add('reference');
    }
    String notes = String.isBlank(request.notes) ? null : request.notes.trim();
    if (quote.Notes__c != notes) {
      changed.add('notes');
    }
    if (request.termMonths != null && quote.Term_Months__c != request.termMonths) {
      changed.add('term');
    }
    if (signature(lineViews(quote.Lines__r)) != signature(totals.lines)) {
      changed.add('products and prices');
    }
    return changed;
  }

  private static String signature(List<RevquilaCore.LineView> lines) {
    List<String> parts = new List<String>();
    for (RevquilaCore.LineView line : lines) {
      parts.add(
        String.join(
          new List<String>{
            String.valueOf(line.productId),
            String.valueOf(line.bundleId),
            line.name,
            line.unit,
            String.valueOf(RevquilaCore.money(line.price)),
            String.valueOf(line.qty.intValue()),
            String.valueOf(RevquilaCore.money(line.discount)),
            String.valueOf(line.groupName),
            String.valueOf(line.optional == true),
            String.valueOf(line.termMonths),
            String.valueOf(line.attributes)
          },
          '|'
        )
      );
    }
    return String.join(parts, '\n');
  }

  private static List<Quote_Line__c> lineRows(
    Id quoteId,
    List<RevquilaCore.LineView> lines
  ) {
    List<Quote_Line__c> rows = new List<Quote_Line__c>();
    Integer position = 0;
    for (RevquilaCore.LineView line : lines) {
      position++;
      rows.add(
        new Quote_Line__c(
          Quote__c = quoteId,
          Product__c = line.productId,
          Description__c = line.name,
          Unit__c = line.unit,
          Unit_Price__c = line.price,
          Quantity__c = line.qty,
          Discount__c = line.discount,
          List_Amount__c = line.listAmount,
          Net_Amount__c = line.net,
          Recurring__c = line.recurring == true,
          Rule_Discount__c = line.ruleDiscount,
          Bundle__c = line.bundleId,
          Group__c = line.groupName,
          Optional__c = line.optional == true,
          Segment__c = line.segment,
          Term_Months__c = line.termMonths,
          Start_Date__c = line.startDate,
          End_Date__c = line.endDate,
          Attributes__c = line.attributes,
          Unit_Cost__c = line.unitCost,
          Pricing_Method__c = line.pricingMethod,
          Feature__c = line.feature,
          Usage_Based__c = line.usageBased == true,
          Price_Source__c = line.priceSource == null ? null : line.priceSource.abbreviate(40),
          Sort_Order__c = position
        )
      );
    }
    return rows;
  }

  public static List<RevquilaCore.LineView> lineViews(
    List<Quote_Line__c> rows
  ) {
    List<RevquilaCore.LineView> views = new List<RevquilaCore.LineView>();
    for (Quote_Line__c row : rows) {
      RevquilaCore.LineView line = new RevquilaCore.LineView();
      line.id = row.Id;
      line.productId = row.Product__c;
      line.name = row.Description__c;
      line.unit = row.Unit__c;
      line.price = RevquilaCore.orZero(row.Unit_Price__c);
      line.qty = RevquilaCore.orZero(row.Quantity__c);
      line.discount = RevquilaCore.orZero(row.Discount__c);
      line.listAmount = RevquilaCore.orZero(row.List_Amount__c);
      line.net = RevquilaCore.orZero(row.Net_Amount__c);
      line.recurring = row.Recurring__c;
      line.ruleDiscount = RevquilaCore.orZero(row.Rule_Discount__c);
      line.bundleId = row.Bundle__c;
      line.bundleName = row.Bundle__r?.Name;
      line.groupName = row.Group__c;
      line.optional = row.Optional__c;
      line.segment = row.Segment__c;
      line.termMonths = row.Term_Months__c == null ? null : row.Term_Months__c.intValue();
      line.startDate = row.Start_Date__c;
      line.endDate = row.End_Date__c;
      line.attributes = row.Attributes__c;
      line.unitCost = RevquilaCore.orZero(row.Unit_Cost__c);
      line.pricingMethod = row.Pricing_Method__c;
      line.feature = row.Feature__c;
      line.usageBased = row.Usage_Based__c;
      line.priceSource = row.Price_Source__c;
      line.family = row.Product__r?.Family;
      views.add(line);
    }
    return views;
  }

  public static QuoteView view(Quote__c row) {
    QuoteView quote = new QuoteView();
    quote.id = row.Id;
    quote.name = RevquilaCore.shownNumber(row);
    quote.accountId = row.Account__c;
    quote.account = row.Account__r?.Name;
    quote.city = row.Account__r?.BillingCity;
    quote.registration = row.Account__r?.Tax_Registration_Number__c;
    quote.contactId = row.Contact__c;
    quote.contact = row.Contact__r?.Name;
    quote.opportunityId = row.Opportunity__c;
    quote.opportunity = row.Opportunity__r?.Name;
    quote.opportunityStage = row.Opportunity__r?.StageName;
    quote.owner = row.Owner.Name;
    quote.reference = row.Reference__c;
    quote.status = row.Status__c;
    quote.version = row.Version__c == null ? 1 : row.Version__c.intValue();
    quote.terms = row.Payment_Terms__c;
    quote.validDays = row.Valid_Days__c == null
      ? null
      : row.Valid_Days__c.intValue();
    quote.quoteDate = row.Quote_Date__c;
    quote.validUntil = row.Valid_Until__c;
    quote.region = row.Region__c;
    quote.notes = row.Notes__c;
    quote.subtotal = RevquilaCore.orZero(row.Subtotal__c);
    quote.discountTotal = RevquilaCore.orZero(row.Discount_Total__c);
    quote.net = RevquilaCore.orZero(row.Net_Amount__c);
    quote.tax = RevquilaCore.orZero(row.Tax_Amount__c);
    quote.total = RevquilaCore.orZero(row.Total__c);
    quote.maxDiscount = RevquilaCore.orZero(row.Max_Discount__c);
    quote.policyIssue = row.Policy_Issue__c;
    quote.taxLines = RevquilaPricing.taxLines(row.Tax_Breakup__c);
    quote.approvalDecision = row.Approval_Decision__c;
    quote.approvalRequestedOn = row.Approval_Requested_On__c;
    quote.approvalDecidedOn = row.Approval_Decided_On__c;
    quote.approvalDecidedBy = row.Approval_Decided_By__r?.Name;
    quote.approvalNote = row.Approval_Note__c;
    quote.sentOn = row.Sent_On__c;
    quote.signedOn = row.Signed_On__c;
    quote.signedByName = row.Signed_By_Name__c;
    quote.signedByEmail = row.Signed_By_Email__c;
    quote.signedByTitle = row.Signed_By_Title__c;
    quote.signatureData = row.Signature_Data__c;
    quote.signatureAudit = row.Signature_Audit__c;
    quote.country = row.Country__c;
    quote.currencyCode = row.Currency_Code__c;
    quote.exchangeRate = RevquilaCore.rate(row.Exchange_Rate__c);
    quote.createdOn = row.CreatedDate;
    quote.modifiedOn = row.LastModifiedDate;
    quote.lines = lineViews(row.Lines__r);
    quote.type = String.isBlank(row.Type__c) ? 'new' : row.Type__c;
    quote.sourceContractId = row.Contract__c;
    quote.sourceContractNumber = row.Contract__r == null ? null : (String.isNotBlank(row.Contract__r.Display_Number__c) ? row.Contract__r.Display_Number__c : row.Contract__r.Name);
    quote.primary = row.Primary__c;
    quote.termMonths = row.Term_Months__c == null ? null : row.Term_Months__c.intValue();
    quote.startDate = row.Start_Date__c;
    quote.costTotal = RevquilaCore.orZero(row.Cost_Total__c);
    quote.marginPercent = row.Margin_Percent__c;
    quote.upliftPercent = row.Uplift_Percent__c;
    quote.approvalStep = row.Approval_Step__c == null ? null : row.Approval_Step__c.intValue();
    return quote;
  }
}