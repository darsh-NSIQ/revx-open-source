/**
 * Contracts for the Revquila screens: the signed agreement behind recurring revenue. A quote
 * with recurring lines starts a contract when it is signed, alongside the subscription that
 * bills it. Here: the list, one contract with its timeline, cancelling, amending (an
 * amendment quote whose changes are prorated to the contract's end), renewing (a renewal quote
 * with the uplift, which starts the next contract), evergreen and the uplift.
 */
public with sharing class RevquilaContractController {
  public static final String ACTIVE = 'active';
  public static final String EXPIRED = 'expired';
  public static final String CANCELLED = 'cancelled';

  private static final Integer LIST_SIZE = 1000;
  private static final String FIELDS =
    'Id, Name, Display_Number__c, Account__c, Account__r.Name, Account__r.BillingCity, Account__r.BillingState, Contact__c, ' +
    'Contact__r.Name, Owner.Name, Quote__c, Quote__r.Name, Quote__r.Display_Number__c, Subscription__c, Subscription__r.Name, ' +
    'Subscription__r.Display_Number__c, Subscription__r.Status__c, Reference__c, Status__c, Start_Date__c, End_Date__c, ' +
    'Term_Months__c, Signed_On__c, Auto_Renew__c, Annual_Value__c, Notes__c, Country__c, Currency_Code__c, Exchange_Rate__c, ' +
    'Parent_Contract__c, Parent_Contract__r.Name, Parent_Contract__r.Display_Number__c, Evergreen__c, Uplift_Percent__c, ' +
    'Renewal_Quote__c, Renewal_Quote__r.Name, Renewal_Quote__r.Display_Number__c, Renewal_Quote__r.Status__c, ' +
    'Amended_On__c, Amendment_Count__c, CreatedDate';

  public class ContractView {
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
    public String contact;
    @AuraEnabled
    public String owner;
    @AuraEnabled
    public Id quoteId;
    @AuraEnabled
    public String quoteNumber;
    @AuraEnabled
    public Id subscriptionId;
    @AuraEnabled
    public String subscriptionName;
    @AuraEnabled
    public String subscriptionStatus;
    @AuraEnabled
    public String reference;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public Date startDate;
    @AuraEnabled
    public Date endDate;
    @AuraEnabled
    public Integer termMonths;
    @AuraEnabled
    public Date signedOn;
    @AuraEnabled
    public Boolean autoRenew;
    @AuraEnabled
    public Decimal annualValue;
    @AuraEnabled
    public String notes;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public String currencyCode;
    @AuraEnabled
    public Decimal exchangeRate;
    @AuraEnabled
    public Datetime createdOn;
    @AuraEnabled
    public Id parentId;
    @AuraEnabled
    public String parentNumber;
    @AuraEnabled
    public Boolean evergreen;
    @AuraEnabled
    public Decimal upliftPercent;
    @AuraEnabled
    public Id renewalQuoteId;
    @AuraEnabled
    public String renewalQuoteNumber;
    @AuraEnabled
    public String renewalQuoteStatus;
    @AuraEnabled
    public Date amendedOn;
    @AuraEnabled
    public Integer amendments;
    // only on getContract
    @AuraEnabled
    public List<RevquilaCore.EventView> events;
    @AuraEnabled
    public Id orderId;
    @AuraEnabled
    public String orderNumber;
    @AuraEnabled
    public String orderStatus;
    @AuraEnabled
    public List<RevquilaQuoteController.QuoteView> changeQuotes;
  }

  /** Soonest end date first. */
  @AuraEnabled
  public static List<ContractView> getContracts() {
    try {
      Integer listSize = LIST_SIZE;
      List<ContractView> views = new List<ContractView>();
      for (
        Contract__c row : (List<Contract__c>) Database.query(
          'SELECT ' +
            FIELDS +
            ' FROM Contract__c ORDER BY End_Date__c, Name LIMIT :listSize',
          AccessLevel.USER_MODE
        )
      ) {
        views.add(view(row));
      }
      return views;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** One contract with its timeline, the order under it, and its amendment and renewal quotes. */
  @AuraEnabled
  public static ContractView getContract(Id contractId) {
    try {
      ContractView contract = view(one(contractId));
      contract.events = RevquilaCore.eventsOf('Contract__c', contractId);
      for (Order__c order : [
        SELECT Id, Name, Display_Number__c, Status__c
        FROM Order__c
        WHERE Contract__c = :contractId
        WITH USER_MODE
        ORDER BY CreatedDate DESC
        LIMIT 1
      ]) {
        contract.orderId = order.Id;
        contract.orderNumber = RevquilaCore.shownNumber(order);
        contract.orderStatus = order.Status__c;
      }
      contract.changeQuotes = RevquilaQuoteController.views(
        'WHERE Contract__c = \'' + String.escapeSingleQuotes(contractId) + '\' ORDER BY CreatedDate DESC LIMIT 20'
      );
      return contract;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Cancels a contract and the subscription that bills it. */
  @AuraEnabled
  public static void cancel(Id contractId, String reason) {
    try {
      Contract__c contract = one(contractId);
      need(
        contract.Status__c == ACTIVE,
        'Only an active contract can be cancelled.'
      );
      need(String.isNotBlank(reason), 'Say why, for the audit trail.');
      update as user new Contract__c(
        Id = contractId,
        Status__c = CANCELLED,
        Auto_Renew__c = false,
        Evergreen__c = false
      );
      insert as user RevquilaCore.event(
        contractId,
        'Contract cancelled',
        reason.trim(),
        RevquilaCore.TONE_BAD
      );
      if (
        contract.Subscription__c != null &&
        contract.Subscription__r.Status__c !=
        RevquilaSubscriptionController.CANCELLED
      ) {
        RevquilaSubscriptionController.cancel(
          contract.Subscription__c,
          reason,
          false
        );
      }
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Turns evergreen on or off: an evergreen contract rolls over term after term until it is cancelled. */
  @AuraEnabled
  public static void setEvergreen(Id contractId, Boolean evergreen) {
    try {
      Contract__c contract = one(contractId);
      need(contract.Status__c == ACTIVE, 'Only an active contract can be changed.');
      Boolean turnOn = evergreen == true;
      update as user new Contract__c(Id = contractId, Evergreen__c = turnOn, Auto_Renew__c = turnOn ? true : contract.Auto_Renew__c);
      if (turnOn && contract.Subscription__c != null) {
        update as user new Subscription__c(Id = contract.Subscription__c, Auto_Renew__c = true, Cancel_Reason__c = null, Ends_On__c = null);
      }
      insert as user RevquilaCore.event(contractId, turnOn ? 'Made evergreen' : 'Evergreen turned off', turnOn ? 'Rolls over until cancelled' : 'Ends or renews at the end of the term', RevquilaCore.TONE_ACCENT);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Sets the price increase this contract renews with. Empty: the default in Setup. */
  @AuraEnabled
  public static void setUplift(Id contractId, Decimal upliftPercent) {
    try {
      need(upliftPercent == null || (upliftPercent >= -100 && upliftPercent <= 100), 'The uplift is between -100 and 100%.');
      one(contractId);
      update as user new Contract__c(Id = contractId, Uplift_Percent__c = upliftPercent);
      insert as user RevquilaCore.event(contractId, 'Renewal uplift set', upliftPercent == null ? 'The default in Setup' : RevquilaPricing.plain(upliftPercent) + '%', RevquilaCore.TONE_ACCENT);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- amendments

  /**
   * Raises an amendment quote: the contract's products today, at the price it pays, for the
   * months left on it. Change the quantities or add products, send it and have it signed;
   * signing changes the subscription and bills the difference prorated to the contract's end.
   */
  @AuraEnabled
  public static Id amend(Id contractId) {
    try {
      Contract__c contract = one(contractId);
      need(contract.Status__c == ACTIVE, 'Only an active contract can be amended.');
      need(contract.Subscription__c != null, 'This contract has no subscription to amend.');
      Subscription__c subscription = RevquilaSubscriptionController.one(contract.Subscription__c);
      Date today = Date.today();
      Date coTermEnd = contract.End_Date__c == null ? subscription.Renewal_Date__c.addDays(-1) : contract.End_Date__c;
      need(coTermEnd > today, 'The contract ends today or has ended: renew it instead.');
      Integer monthsLeft = Math.max(1, (Decimal.valueOf(today.daysBetween(coTermEnd) + 1) / 30.4375).round(System.RoundingMode.CEILING).intValue());
      RevquilaQuoteController.QuoteInput quote = new RevquilaQuoteController.QuoteInput();
      quote.accountId = contract.Account__c;
      quote.contactId = contract.Contact__c;
      quote.country = contract.Country__c;
      quote.region = contract.Account__r.BillingState;
      quote.type = 'amendment';
      quote.contractId = contractId;
      quote.termMonths = monthsLeft;
      quote.startDate = today;
      quote.coTermEnd = coTermEnd;
      quote.reference = contract.Account__r.Name + ': amendment to ' + RevquilaCore.shownNumber(contract);
      quote.lines = RevquilaSubscriptionController.renewalLines(subscription, 0);
      for (RevquilaPricing.LineInput line : quote.lines) {
        line.groupName = 'On the contract today';
        line.termMonths = monthsLeft;
      }
      Id quoteId = RevquilaQuoteController.save(quote);
      Quote__c created = [SELECT Name, Display_Number__c FROM Quote__c WHERE Id = :quoteId WITH USER_MODE];
      insert as user RevquilaCore.event(contractId, 'Amendment quote created', RevquilaCore.shownNumber(created), RevquilaCore.TONE_ACCENT);
      return quoteId;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Applies a signed amendment quote: the subscription takes the new quantities and products,
   * and an order bills the difference for the rest of the term. A net reduction becomes a credit
   * on the next invoice instead. Returns the order, or null when there is nothing to bill.
   */
  public static Order__c applyAmendment(Quote__c quote) {
    Contract__c contract = one(quote.Contract__c);
    need(contract.Subscription__c != null, 'The contract has no subscription to amend.');
    Subscription__c subscription = RevquilaSubscriptionController.one(contract.Subscription__c);
    Integer monthsLeft = quote.Term_Months__c == null ? 12 : Math.max(1, quote.Term_Months__c.intValue());

    // what the subscription has now, by product
    Map<Id, Subscription_Item__c> items = new Map<Id, Subscription_Item__c>();
    for (Subscription_Item__c item : subscription.Items__r) {
      if (item.Product__c != null) {
        items.put(item.Product__c, item);
      }
    }
    // what the amendment says it should have, by product, and the prorated net of each
    Map<Id, Decimal> wantedQty = new Map<Id, Decimal>();
    Map<Id, Quote_Line__c> wantedLine = new Map<Id, Quote_Line__c>();
    List<Quote_Line__c> oneTime = new List<Quote_Line__c>();
    for (Quote_Line__c line : quote.Lines__r) {
      if (line.Optional__c) {
        continue;
      }
      if (line.Recurring__c && line.Product__c != null) {
        wantedQty.put(line.Product__c, RevquilaCore.orZero(wantedQty.get(line.Product__c)) + line.Quantity__c);
        wantedLine.put(line.Product__c, line);
      } else {
        oneTime.add(line);
      }
    }
    List<RevquilaCore.LineView> billed = new List<RevquilaCore.LineView>();
    List<Subscription_Item__c> updates = new List<Subscription_Item__c>();
    List<Subscription_Item__c> inserts = new List<Subscription_Item__c>();
    List<Subscription_Item__c> removes = new List<Subscription_Item__c>();
    List<String> changes = new List<String>();
    Decimal credit = 0;
    Set<Id> all = new Set<Id>(items.keySet());
    all.addAll(wantedQty.keySet());
    for (Id productId : all) {
      Subscription_Item__c item = items.get(productId);
      Decimal before = item == null ? 0 : RevquilaCore.orZero(item.Quantity__c);
      Decimal after = wantedQty.containsKey(productId) ? wantedQty.get(productId) : 0;
      Decimal delta = after - before;
      if (delta == 0) {
        continue;
      }
      Quote_Line__c line = wantedLine.get(productId);
      // the prorated price of one unit for the rest of the term, as the amendment priced it
      Decimal perUnit = line != null && line.Quantity__c > 0
        ? RevquilaCore.orZero(line.Net_Amount__c) / line.Quantity__c
        : RevquilaCore.orZero(item.Unit_Price__c) * monthsLeft / 12;
      Decimal yearly = line != null && line.Quantity__c > 0
        ? RevquilaCore.money(RevquilaCore.orZero(line.Net_Amount__c) / line.Quantity__c * 12 / monthsLeft)
        : RevquilaCore.orZero(item.Unit_Price__c);
      String name = line != null ? line.Description__c : item.Description__c;
      changes.add(name + ' ' + before.intValue() + ' to ' + after.intValue());
      if (delta > 0) {
        RevquilaCore.LineView charge = new RevquilaCore.LineView();
        charge.productId = productId;
        charge.name = name + ' (added for the rest of the term)';
        charge.unit = line == null ? item.Unit__c : line.Unit__c;
        charge.qty = delta;
        charge.price = RevquilaCore.money(perUnit);
        charge.discount = 0;
        charge.ruleDiscount = 0;
        charge.listAmount = RevquilaCore.money(perUnit * delta);
        charge.net = charge.listAmount;
        charge.recurring = false;
        billed.add(charge);
      } else {
        credit += RevquilaCore.money(perUnit * -delta);
      }
      if (item == null) {
        inserts.add(
          new Subscription_Item__c(
            Subscription__c = subscription.Id,
            Product__c = productId,
            Description__c = line.Description__c,
            Unit__c = line.Unit__c,
            Unit_Price__c = yearly,
            Quantity__c = after,
            Usage_Based__c = line.Usage_Based__c,
            Usage_Price__c = line.Usage_Based__c ? line.Unit_Price__c : null
          )
        );
      } else if (after == 0) {
        removes.add(new Subscription_Item__c(Id = item.Id));
      } else {
        updates.add(new Subscription_Item__c(Id = item.Id, Quantity__c = after));
      }
    }
    for (Quote_Line__c line : oneTime) {
      RevquilaCore.LineView charge = new RevquilaCore.LineView();
      charge.productId = line.Product__c;
      charge.name = line.Description__c;
      charge.unit = line.Unit__c;
      charge.qty = line.Quantity__c;
      charge.price = line.Unit_Price__c;
      charge.discount = line.Discount__c;
      charge.ruleDiscount = line.Rule_Discount__c;
      charge.listAmount = line.List_Amount__c;
      charge.net = line.Net_Amount__c;
      charge.recurring = false;
      billed.add(charge);
    }
    update as user updates;
    insert as user inserts;
    delete as user removes;

    Decimal annual = 0;
    for (Subscription_Item__c item : [
      SELECT Unit_Price__c, Quantity__c
      FROM Subscription_Item__c
      WHERE Subscription__c = :subscription.Id
      WITH USER_MODE
    ]) {
      annual += RevquilaCore.orZero(item.Unit_Price__c) * RevquilaCore.orZero(item.Quantity__c);
    }
    update as user new Contract__c(
      Id = contract.Id,
      Annual_Value__c = RevquilaCore.money(annual),
      Amended_On__c = Date.today(),
      Amendment_Count__c = RevquilaCore.orZero(contract.Amendment_Count__c) + 1
    );
    insert as user RevquilaCore.event(contract.Id, 'Amended', String.join(changes, ', ').abbreviate(255), RevquilaCore.TONE_ACCENT);
    RevquilaBilling.replan(subscription.Id);
    if (credit > 0 && subscription.Order__c != null) {
      RevquilaBilling.prorationFor(subscription, -credit, 'Credit for the amendment, prorated to the contract end', null, 'Amendment credit');
    }
    RevquilaSubscriptionController.fireFor(subscription.Id, RevquilaCore.SUBSCRIPTION_CHANGED);
    if (billed.isEmpty()) {
      return null;
    }
    return RevquilaOrderController.bookLines(quote, contract, billed, 'amendment');
  }

  // ---------------------------------------------------------------- renewals

  /**
   * Raises the renewal quote of a contract: its products at the price it pays now plus the
   * uplift, for the next term, starting the day after it ends. Returns the quote's id.
   */
  @AuraEnabled
  public static Id renewalQuote(Id contractId) {
    try {
      Contract__c contract = one(contractId);
      need(contract.Status__c == ACTIVE || contract.Status__c == EXPIRED, 'A cancelled contract cannot be renewed: start a new quote.');
      if (contract.Renewal_Quote__c != null && contract.Renewal_Quote__r.Status__c != 'expired' && contract.Renewal_Quote__r.Status__c != 'rejected') {
        return contract.Renewal_Quote__c;
      }
      need(contract.Subscription__c != null, 'This contract has no subscription to renew.');
      Subscription__c subscription = RevquilaSubscriptionController.one(contract.Subscription__c);
      Decimal uplift = contract.Uplift_Percent__c != null ? contract.Uplift_Percent__c : RevquilaSettings.current().renewalUplift;
      RevquilaQuoteController.QuoteInput quote = new RevquilaQuoteController.QuoteInput();
      quote.accountId = contract.Account__c;
      quote.contactId = contract.Contact__c;
      quote.country = contract.Country__c;
      quote.region = contract.Account__r.BillingState;
      quote.type = 'renewal';
      quote.contractId = contractId;
      quote.upliftPercent = uplift;
      quote.termMonths = contract.Term_Months__c == null ? 12 : contract.Term_Months__c.intValue();
      Date start = contract.End_Date__c == null ? Date.today() : contract.End_Date__c.addDays(1);
      quote.startDate = start < Date.today() ? Date.today() : start;
      quote.reference = contract.Account__r.Name + ': renewal of ' + RevquilaCore.shownNumber(subscription);
      quote.lines = RevquilaSubscriptionController.renewalLines(subscription, uplift);
      Id quoteId = RevquilaQuoteController.save(quote);
      update as user new Contract__c(Id = contractId, Renewal_Quote__c = quoteId);
      Quote__c created = [SELECT Name, Display_Number__c FROM Quote__c WHERE Id = :quoteId WITH USER_MODE];
      insert as user RevquilaCore.event(contractId, 'Renewal quote created', RevquilaCore.shownNumber(created) + (RevquilaCore.orZero(uplift) == 0 ? '' : ' · ' + RevquilaPricing.plain(uplift) + '% uplift'), RevquilaCore.TONE_ACCENT);
      return quoteId;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Applies a signed renewal quote: a new contract for the next term, the subscription moved
   * onto it with the renewal's products and prices, and an order that bills the new term.
   * The old contract runs to its end and then ends. Returns the new contract.
   */
  public static Contract__c applyRenewal(Quote__c quote) {
    Contract__c old = one(quote.Contract__c);
    Integer months = quote.Term_Months__c == null ? 12 : quote.Term_Months__c.intValue();
    Date start = quote.Start_Date__c != null ? quote.Start_Date__c : (old.End_Date__c == null ? Date.today() : old.End_Date__c.addDays(1));
    Decimal annual = 0;
    for (Quote_Line__c line : quote.Lines__r) {
      if (line.Recurring__c && !line.Optional__c) {
        annual += RevquilaCore.orZero(line.Net_Amount__c) * 12 / Math.max(1, line.Term_Months__c == null ? months : line.Term_Months__c.intValue());
      }
    }
    Contract__c renewed = new Contract__c(
      Account__c = quote.Account__c,
      Contact__c = quote.Contact__c,
      Quote__c = quote.Id,
      Subscription__c = old.Subscription__c,
      Parent_Contract__c = old.Id,
      Reference__c = quote.Reference__c,
      Status__c = ACTIVE,
      Start_Date__c = start,
      End_Date__c = start.addMonths(months).addDays(-1),
      Term_Months__c = months,
      Signed_On__c = Date.today(),
      Auto_Renew__c = old.Auto_Renew__c,
      Evergreen__c = old.Evergreen__c,
      Uplift_Percent__c = old.Uplift_Percent__c,
      Annual_Value__c = RevquilaCore.money(annual),
      Notes__c = quote.Notes__c,
      Country__c = quote.Country__c,
      Currency_Code__c = quote.Currency_Code__c,
      Exchange_Rate__c = RevquilaCore.rate(quote.Exchange_Rate__c)
    );
    insert as user renewed;
    RevquilaCore.stampNumber(renewed, 'contract');
    update as user new Contract__c(Id = old.Id, Auto_Renew__c = false, Evergreen__c = false);
    insert as user new List<Revenue_Event__c>{
      RevquilaCore.event(old.Id, 'Renewed', 'Continues as ' + RevquilaCore.shownNumber(renewed), RevquilaCore.TONE_GOOD),
      RevquilaCore.event(renewed.Id, 'Contract signed', 'Renewal of ' + RevquilaCore.shownNumber(old) + ' · ' + months + '-month term', RevquilaCore.TONE_TEAL)
    };
    if (old.Subscription__c != null) {
      Subscription__c subscription = RevquilaSubscriptionController.one(old.Subscription__c);
      delete as user subscription.Items__r;
      List<Subscription_Item__c> items = new List<Subscription_Item__c>();
      for (Quote_Line__c line : quote.Lines__r) {
        if (!line.Recurring__c || line.Optional__c) {
          continue;
        }
        Integer lineTerm = line.Term_Months__c == null ? months : Math.max(1, line.Term_Months__c.intValue());
        items.add(
          new Subscription_Item__c(
            Subscription__c = subscription.Id,
            Product__c = line.Product__c,
            Description__c = line.Description__c,
            Unit__c = line.Unit__c,
            Unit_Price__c = line.Usage_Based__c ? 0 : RevquilaCore.money(RevquilaCore.orZero(line.Net_Amount__c) / line.Quantity__c * 12 / lineTerm),
            Quantity__c = line.Quantity__c,
            Usage_Based__c = line.Usage_Based__c,
            Usage_Price__c = line.Usage_Based__c ? line.Unit_Price__c : null
          )
        );
      }
      insert as user items;
      update as user new Subscription__c(
        Id = subscription.Id,
        Contract__c = renewed.Id,
        Start_Date__c = start,
        Renewal_Date__c = start.addMonths(months),
        Term_Months__c = months,
        Status__c = RevquilaSubscriptionController.ACTIVE,
        Cancel_Reason__c = null,
        Ends_On__c = null,
        Auto_Renew__c = renewed.Auto_Renew__c,
        Quote__c = subscription.Quote__c
      );
      RevquilaSubscriptionController.fireFor(subscription.Id, RevquilaCore.SUBSCRIPTION_CHANGED);
    }
    List<RevquilaCore.LineView> lines = RevquilaQuoteController.lineViews(quote.Lines__r);
    List<RevquilaCore.LineView> kept = new List<RevquilaCore.LineView>();
    for (RevquilaCore.LineView line : lines) {
      if (line.optional != true) {
        kept.add(line);
      }
    }
    RevquilaOrderController.bookLines(quote, renewed, kept, 'renewal');
    return renewed;
  }

  // ---------------------------------------------------------------- used by other classes

  /** Starts the contract a signed quote with recurring lines brings, or returns null. */
  public static Contract__c startFor(
    Quote__c quote,
    Subscription__c subscription
  ) {
    Decimal annual = 0;
    Boolean recurring = false;
    Integer months = quote.Term_Months__c == null || quote.Term_Months__c < 1 ? 12 : quote.Term_Months__c.intValue();
    for (Quote_Line__c line : quote.Lines__r) {
      if (line.Recurring__c && !line.Optional__c) {
        recurring = true;
        Integer lineTerm = line.Term_Months__c == null ? months : Math.max(1, line.Term_Months__c.intValue());
        annual += RevquilaCore.orZero(line.Net_Amount__c) * 12 / lineTerm;
      }
    }
    if (!recurring) {
      return null;
    }
    Date start = quote.Start_Date__c == null ? Date.today() : quote.Start_Date__c;
    RevquilaSettings settings = RevquilaSettings.current();
    Contract__c contract = new Contract__c(
      Account__c = quote.Account__c,
      Contact__c = quote.Contact__c,
      Quote__c = quote.Id,
      Subscription__c = subscription == null ? null : subscription.Id,
      Reference__c = quote.Reference__c,
      Status__c = ACTIVE,
      Start_Date__c = start,
      End_Date__c = months == 12 && start == Date.today()
        ? start.addDays(RevquilaSubscriptionController.TERM_DAYS - 1)
        : start.addMonths(months).addDays(-1),
      Term_Months__c = months,
      Signed_On__c = Date.today(),
      Auto_Renew__c = settings.autoRenew,
      Annual_Value__c = RevquilaCore.money(annual),
      Notes__c = quote.Notes__c,
      Country__c = quote.Country__c,
      Currency_Code__c = quote.Currency_Code__c,
      Exchange_Rate__c = RevquilaCore.rate(quote.Exchange_Rate__c)
    );
    insert as user contract;
    RevquilaCore.stampNumber(contract, 'contract');
    if (subscription != null) {
      update as user new Subscription__c(Id = subscription.Id, Contract__c = contract.Id);
    }
    insert as user RevquilaCore.event(
      contract.Id,
      'Contract signed',
      'From quote ' + RevquilaCore.shownNumber(quote) + ' · ' + months + '-month term',
      RevquilaCore.TONE_TEAL
    );
    return [
      SELECT Id, Name, Display_Number__c
      FROM Contract__c
      WHERE Id = :contract.Id
      WITH USER_MODE
    ];
  }

  public static Contract__c one(Id contractId) {
    List<Contract__c> rows = (List<Contract__c>) Database.query(
      'SELECT ' + FIELDS + ' FROM Contract__c WHERE Id = :contractId',
      AccessLevel.USER_MODE
    );
    if (rows.isEmpty()) {
      throw new RevquilaCore.ProblemException(
        'That contract no longer exists.'
      );
    }
    return rows[0];
  }

  private static void need(Boolean condition, String message) {
    if (condition != true) {
      throw new RevquilaCore.ProblemException(message);
    }
  }

  private static ContractView view(Contract__c row) {
    ContractView contract = new ContractView();
    contract.id = row.Id;
    contract.name = RevquilaCore.shownNumber(row);
    contract.accountId = row.Account__c;
    contract.account = row.Account__r?.Name;
    contract.city = row.Account__r?.BillingCity;
    contract.contact = row.Contact__r?.Name;
    contract.owner = row.Owner.Name;
    contract.quoteId = row.Quote__c;
    contract.quoteNumber = row.Quote__r == null ? null : (String.isNotBlank(row.Quote__r.Display_Number__c) ? row.Quote__r.Display_Number__c : row.Quote__r.Name);
    contract.subscriptionId = row.Subscription__c;
    contract.subscriptionName = row.Subscription__r == null ? null : (String.isNotBlank(row.Subscription__r.Display_Number__c) ? row.Subscription__r.Display_Number__c : row.Subscription__r.Name);
    contract.subscriptionStatus = row.Subscription__r?.Status__c;
    contract.reference = row.Reference__c;
    contract.status = row.Status__c;
    contract.startDate = row.Start_Date__c;
    contract.endDate = row.End_Date__c;
    contract.termMonths = row.Term_Months__c == null
      ? 12
      : row.Term_Months__c.intValue();
    contract.signedOn = row.Signed_On__c;
    contract.autoRenew = row.Auto_Renew__c;
    contract.annualValue = RevquilaCore.orZero(row.Annual_Value__c);
    contract.notes = row.Notes__c;
    contract.country = row.Country__c;
    contract.currencyCode = row.Currency_Code__c;
    contract.exchangeRate = RevquilaCore.rate(row.Exchange_Rate__c);
    contract.createdOn = row.CreatedDate;
    contract.parentId = row.Parent_Contract__c;
    contract.parentNumber = row.Parent_Contract__r == null ? null : (String.isNotBlank(row.Parent_Contract__r.Display_Number__c) ? row.Parent_Contract__r.Display_Number__c : row.Parent_Contract__r.Name);
    contract.evergreen = row.Evergreen__c;
    contract.upliftPercent = row.Uplift_Percent__c;
    contract.renewalQuoteId = row.Renewal_Quote__c;
    contract.renewalQuoteNumber = row.Renewal_Quote__r == null ? null : (String.isNotBlank(row.Renewal_Quote__r.Display_Number__c) ? row.Renewal_Quote__r.Display_Number__c : row.Renewal_Quote__r.Name);
    contract.renewalQuoteStatus = row.Renewal_Quote__r?.Status__c;
    contract.amendedOn = row.Amended_On__c;
    contract.amendments = row.Amendment_Count__c == null ? 0 : row.Amendment_Count__c.intValue();
    return contract;
  }

  /** Updates contract details (end date, term months, auto renew, uplift %, reference, notes). */
  @AuraEnabled
  public static void saveContract(Id contractId, Date endDate, Integer termMonths, Boolean autoRenew, Decimal upliftPercent, String reference, String notes) {
    try {
      one(contractId);
      Contract__c toUpdate = new Contract__c(Id = contractId);
      if (endDate != null) toUpdate.End_Date__c = endDate;
      if (termMonths != null) toUpdate.Term_Months__c = termMonths;
      if (autoRenew != null) toUpdate.Auto_Renew__c = autoRenew;
      if (upliftPercent != null) toUpdate.Uplift_Percent__c = upliftPercent;
      if (reference != null) toUpdate.Reference__c = reference;
      if (notes != null) toUpdate.Notes__c = notes;
      update as user toUpdate;
      insert as user RevquilaCore.event(
        contractId,
        'Contract updated',
        'Details modified',
        RevquilaCore.TONE_ACCENT
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}