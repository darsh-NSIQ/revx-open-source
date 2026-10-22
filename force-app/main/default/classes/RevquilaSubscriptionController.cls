/**
 * Subscriptions for the Revquila screens: the list, one subscription with its timeline,
 * invoices, billing schedule and usage, and what can be done to one (change a quantity, swap
 * a product, add a product, change the billing frequency, pause, resume, cancel, renew, log
 * usage). A subscription starts when a quote with recurring lines is signed.
 *
 * A change mid-term is prorated to the end of the term: a charge goes on the next invoice,
 * a credit comes off it. Every change writes a timeline entry that carries the MRR after it
 * (Kind 'mrr') and what kind of movement it was (new, expansion, contraction, churn,
 * reactivation); the MRR history and the movements in Analytics are read back from them.
 */
public with sharing class RevquilaSubscriptionController {
  public static final String ACTIVE = 'active';
  public static final String PAUSED = 'paused';
  public static final String CANCELLED = 'cancelled';
  public static final String KIND_MRR = 'mrr';
  public static final String KIND_NOTE = 'note';
  public static final Integer TERM_DAYS = 365;

  private static final Integer LIST_SIZE = 1000;
  private static final String FIELDS =
    'Id, Name, Display_Number__c, OwnerId, Account__c, Account__r.Name, Account__r.BillingState, Account__r.OwnerId, ' +
    'Account__r.Billing_Email__c, Owner.Name, Quote__c, Quote__r.Name, Quote__r.Display_Number__c, ' +
    'Start_Date__c, Renewal_Date__c, Auto_Renew__c, Status__c, Cancel_Reason__c, Contract_MRR__c, ' +
    'Country__c, Currency_Code__c, Exchange_Rate__c, Billing_Frequency__c, Next_Bill_Date__c, Bill_In_Advance__c, ' +
    'Mandate_Id__c, Mandate_Status__c, Mandate_Type__c, Mandate_Max_Amount__c, Mandate_Auth_Date__c, Discount_Code__c, Discount_Percent__c, Trial_End_Date__c, ' +
    'Contract__c, Contract__r.Name, Contract__r.Display_Number__c, Order__c, Paused_On__c, Ends_On__c, Term_Months__c, ' +
    '(SELECT Id, Product__c, Description__c, Unit__c, Unit_Price__c, Quantity__c, Monthly_Amount__c, Usage_Based__c, ' +
    'Usage_Unit__c, Usage_Price__c FROM Items__r ORDER BY Name)';

  public class ItemView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Id productId;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String unit;
    @AuraEnabled
    public Decimal price;
    @AuraEnabled
    public Decimal qty;
    @AuraEnabled
    public Decimal monthly;
    @AuraEnabled
    public Boolean usageBased;
    @AuraEnabled
    public String usageUnit;
    @AuraEnabled
    public Decimal usagePrice;
  }

  public class InvoiceLink {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Decimal total;
    @AuraEnabled
    public Date dueOn;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public String kind;
  }

  public class ScheduleView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Date billDate;
    @AuraEnabled
    public Date periodStart;
    @AuraEnabled
    public Date periodEnd;
    @AuraEnabled
    public Decimal amount;
    @AuraEnabled
    public String description;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public String kind;
    @AuraEnabled
    public Id invoiceId;
    @AuraEnabled
    public String invoiceNumber;
  }

  public class UsageView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Id itemId;
    @AuraEnabled
    public String item;
    @AuraEnabled
    public Date usageDate;
    @AuraEnabled
    public Decimal qty;
    @AuraEnabled
    public String note;
    @AuraEnabled
    public Boolean billed;
  }

  public class SubscriptionView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Id accountId;
    @AuraEnabled
    public String account;
    @AuraEnabled
    public String owner;
    @AuraEnabled
    public Id quoteId;
    @AuraEnabled
    public String quoteNumber;
    @AuraEnabled
    public Date startDate;
    @AuraEnabled
    public Date renewalDate;
    @AuraEnabled
    public Boolean autoRenew;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public String cancelReason;
    @AuraEnabled
    public Decimal contractMrr;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public String currencyCode;
    @AuraEnabled
    public Decimal exchangeRate;
    /** What the account owes on invoices past their due date. It is what puts a renewal at risk. */
    @AuraEnabled
    public Decimal overdueOnAccount;
    @AuraEnabled
    public List<ItemView> items;
    @AuraEnabled
    public String billingFrequency;
    @AuraEnabled
    public Date nextBillDate;
    @AuraEnabled
    public Id contractId;
    @AuraEnabled
    public String contractNumber;
    @AuraEnabled
    public Id orderId;
    @AuraEnabled
    public Integer termMonths;
    @AuraEnabled
    public Date endsOn;
    // only on getSubscription
    @AuraEnabled
    public List<RevquilaCore.EventView> events;
    @AuraEnabled
    public List<InvoiceLink> invoices;
    @AuraEnabled
    public List<ScheduleView> schedules;
    @AuraEnabled
    public List<UsageView> usage;
    @AuraEnabled
    public String mandateId;
    @AuraEnabled
    public String mandateStatus;
    @AuraEnabled
    public String mandateType;
    @AuraEnabled
    public Decimal mandateMaxAmount;
    @AuraEnabled
    public Date mandateAuthDate;
    @AuraEnabled
    public String discountCode;
    @AuraEnabled
    public Decimal discountPercent;
    @AuraEnabled
    public Date trialEndDate;
  }

  // ---------------------------------------------------------------- reading

  /** Every subscription, soonest renewal first, each with its items. */
  @AuraEnabled
  public static List<SubscriptionView> getSubscriptions() {
    try {
      Integer listSize = LIST_SIZE;
      List<Subscription__c> rows = (List<Subscription__c>) Database.query(
        'SELECT ' +
          FIELDS +
          ' FROM Subscription__c ORDER BY Renewal_Date__c, Name LIMIT :listSize',
        AccessLevel.USER_MODE
      );
      Set<Id> accountIds = new Set<Id>();
      for (Subscription__c row : rows) {
        accountIds.add(row.Account__c);
      }
      Map<Id, Decimal> overdue = overdueByAccount(accountIds);
      List<SubscriptionView> views = new List<SubscriptionView>();
      for (Subscription__c row : rows) {
        views.add(view(row, overdue));
      }
      return views;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** One subscription with its timeline, invoices, billing schedule and usage. */
  @AuraEnabled
  public static SubscriptionView getSubscription(Id subscriptionId) {
    try {
      Subscription__c row = one(subscriptionId);
      SubscriptionView subscription = view(
        row,
        overdueByAccount(new Set<Id>{ row.Account__c })
      );
      subscription.events = RevquilaCore.eventsOf('Subscription__c', subscriptionId);
      subscription.invoices = new List<InvoiceLink>();
      for (Invoice__c invoice : [
        SELECT
          Id,
          Number__c,
          Total__c,
          Due_On__c,
          Sent_On__c,
          Balance__c,
          Paid_Amount__c,
          Kind__c,
          Written_Off__c
        FROM Invoice__c
        WHERE Subscription__c = :subscriptionId
        WITH USER_MODE
        ORDER BY Issued_On__c DESC, Name DESC
        LIMIT 50
      ]) {
        InvoiceLink link = new InvoiceLink();
        link.id = invoice.Id;
        link.name = invoice.Number__c;
        link.total = invoice.Total__c;
        link.dueOn = invoice.Due_On__c;
        link.status = RevquilaInvoiceController.statusOf(invoice);
        link.kind = invoice.Kind__c;
        subscription.invoices.add(link);
      }
      subscription.schedules = schedulesOf('Subscription__c', subscriptionId);
      subscription.usage = new List<UsageView>();
      for (Usage_Record__c usage : [
        SELECT Id, Subscription_Item__c, Subscription_Item__r.Description__c, Usage_Date__c, Quantity__c, Note__c, Billed__c
        FROM Usage_Record__c
        WHERE Subscription__c = :subscriptionId
        WITH USER_MODE
        ORDER BY Usage_Date__c DESC
        LIMIT 100
      ]) {
        UsageView view = new UsageView();
        view.id = usage.Id;
        view.itemId = usage.Subscription_Item__c;
        view.item = usage.Subscription_Item__r?.Description__c;
        view.usageDate = usage.Usage_Date__c;
        view.qty = usage.Quantity__c;
        view.note = usage.Note__c;
        view.billed = usage.Billed__c;
        subscription.usage.add(view);
      }
      return subscription;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** The billing schedules under a subscription or an order, by bill date. */
  public static List<ScheduleView> schedulesOf(String field, Id parentId) {
    List<ScheduleView> views = new List<ScheduleView>();
    for (
      Billing_Schedule__c row : (List<Billing_Schedule__c>) Database.query(
        'SELECT Id, Bill_Date__c, Period_Start__c, Period_End__c, Amount__c, Description__c, Status__c, Kind__c, ' +
          'Invoice__c, Invoice__r.Number__c FROM Billing_Schedule__c WHERE ' +
          field +
          ' = :parentId ORDER BY Bill_Date__c, Name LIMIT 200',
        AccessLevel.USER_MODE
      )
    ) {
      ScheduleView view = new ScheduleView();
      view.id = row.Id;
      view.billDate = row.Bill_Date__c;
      view.periodStart = row.Period_Start__c;
      view.periodEnd = row.Period_End__c;
      view.amount = row.Amount__c;
      view.description = row.Description__c;
      view.status = row.Status__c;
      view.kind = row.Kind__c;
      view.invoiceId = row.Invoice__c;
      view.invoiceNumber = row.Invoice__r?.Number__c;
      views.add(view);
    }
    return views;
  }

  // ---------------------------------------------------------------- actions

  /** Changes how many units of one item are subscribed, prorating the difference to the end of the term. */
  @AuraEnabled
  public static void changeQuantity(Id itemId, Integer quantity) {
    try {
      List<Subscription_Item__c> items = [
        SELECT Id, Subscription__c, Description__c, Quantity__c, Unit_Price__c, Product__c, Usage_Based__c
        FROM Subscription_Item__c
        WHERE Id = :itemId
        WITH USER_MODE
      ];
      need(!items.isEmpty(), 'That item is no longer on the subscription.');
      Subscription__c subscription = one(items[0].Subscription__c);
      need(
        subscription.Status__c == ACTIVE,
        'Only an active subscription can be changed.'
      );
      need(
        quantity != null && quantity >= 1,
        'Enter a whole number, 1 or more.'
      );
      Integer before = items[0].Quantity__c.intValue();
      need(quantity != before, 'That is the quantity it already has.');
      update as user new Subscription_Item__c(
        Id = itemId,
        Quantity__c = quantity
      );
      String prorated = prorate(subscription, (quantity - before) * RevquilaCore.orZero(items[0].Unit_Price__c), items[0].Product__c, items[0].Description__c + ': ' + before + ' to ' + quantity);
      logChange(
        subscription.Id,
        quantity > before ? 'Quantity increased' : 'Quantity reduced',
        items[0].Description__c + ': ' + before + ' to ' + quantity + prorated,
        quantity > before ? RevquilaCore.TONE_GOOD : RevquilaCore.TONE_WARN
      );
      afterChange(subscription);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Swaps the product of one item (an upgrade or a downgrade), at the new product's price, prorated. */
  @AuraEnabled
  public static void changePlan(Id itemId, Id productId) {
    try {
      List<Subscription_Item__c> items = [
        SELECT Id, Subscription__c, Description__c, Quantity__c, Unit_Price__c, Product__c
        FROM Subscription_Item__c
        WHERE Id = :itemId
        WITH USER_MODE
      ];
      need(!items.isEmpty(), 'That item is no longer on the subscription.');
      need(productId != null && productId != items[0].Product__c, 'Pick a different product.');
      Subscription__c subscription = one(items[0].Subscription__c);
      need(subscription.Status__c == ACTIVE, 'Only an active subscription can be changed.');
      RevquilaPricing.Product product = productOf(productId);
      need(product.recurring, 'Pick a recurring product.');
      Decimal yearly = yearlyPrice(product, subscription);
      Decimal before = RevquilaCore.orZero(items[0].Unit_Price__c) * items[0].Quantity__c;
      Decimal after = yearly * items[0].Quantity__c;
      update as user new Subscription_Item__c(
        Id = itemId,
        Product__c = product.id,
        Description__c = product.name,
        Unit__c = product.unit,
        Unit_Price__c = yearly
      );
      String prorated = prorate(subscription, after - before, product.id, items[0].Description__c + ' to ' + product.name);
      logChange(
        subscription.Id,
        after >= before ? 'Upgraded' : 'Downgraded',
        items[0].Description__c + ' to ' + product.name + prorated,
        after >= before ? RevquilaCore.TONE_GOOD : RevquilaCore.TONE_WARN
      );
      afterChange(subscription);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Adds a product mid-term, co-terminated with the subscription and prorated to its end. */
  @AuraEnabled
  public static void addItem(Id subscriptionId, Id productId, Integer quantity) {
    try {
      Subscription__c subscription = one(subscriptionId);
      need(subscription.Status__c == ACTIVE, 'Only an active subscription can be changed.');
      need(quantity != null && quantity >= 1, 'Enter a whole number, 1 or more.');
      RevquilaPricing.Product product = productOf(productId);
      need(product.recurring, 'Pick a recurring product.');
      Decimal yearly = yearlyPrice(product, subscription);
      Boolean usage = product.pricingMethod == 'usage';
      insert as user new Subscription_Item__c(
        Subscription__c = subscriptionId,
        Product__c = product.id,
        Description__c = product.name,
        Unit__c = product.unit,
        Unit_Price__c = usage ? 0 : yearly,
        Quantity__c = quantity,
        Usage_Based__c = usage,
        Usage_Unit__c = product.usageUnit,
        Usage_Price__c = usage ? RevquilaCore.money(product.price * RevquilaCore.rate(subscription.Exchange_Rate__c)) : null
      );
      String prorated = usage ? '' : prorate(subscription, yearly * quantity, product.id, quantity + ' × ' + product.name + ' added');
      logChange(subscription.Id, 'Product added', quantity + ' × ' + product.name + prorated, RevquilaCore.TONE_GOOD);
      afterChange(subscription);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Takes a product off the subscription, crediting the rest of the term. */
  @AuraEnabled
  public static void removeItem(Id itemId) {
    try {
      List<Subscription_Item__c> items = [
        SELECT Id, Subscription__c, Description__c, Quantity__c, Unit_Price__c, Product__c
        FROM Subscription_Item__c
        WHERE Id = :itemId
        WITH USER_MODE
      ];
      need(!items.isEmpty(), 'That item is no longer on the subscription.');
      Subscription__c subscription = one(items[0].Subscription__c);
      need(subscription.Status__c == ACTIVE, 'Only an active subscription can be changed.');
      need(subscription.Items__r.size() > 1, 'This is the last product: cancel the subscription instead.');
      delete as user new Subscription_Item__c(Id = itemId);
      String prorated = prorate(subscription, -RevquilaCore.orZero(items[0].Unit_Price__c) * items[0].Quantity__c, items[0].Product__c, items[0].Description__c + ' removed');
      logChange(subscription.Id, 'Product removed', items[0].Description__c + prorated, RevquilaCore.TONE_WARN);
      afterChange(subscription);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Bills the subscription monthly, quarterly or yearly from its next unbilled period. */
  @AuraEnabled
  public static void setBillingFrequency(Id subscriptionId, String frequency) {
    try {
      need(new Set<String>{ 'monthly', 'quarterly', 'yearly' }.contains(frequency), 'Pick monthly, quarterly or yearly.');
      Subscription__c subscription = one(subscriptionId);
      need(subscription.Status__c != CANCELLED, 'A cancelled subscription is not billed.');
      List<Billing_Schedule__c> planned = [
        SELECT Id, Period_Start__c
        FROM Billing_Schedule__c
        WHERE Subscription__c = :subscriptionId AND Status__c = :RevquilaBilling.PLANNED AND Kind__c = 'recurring'
        WITH USER_MODE
        ORDER BY Period_Start__c
      ];
      update as user new Subscription__c(Id = subscriptionId, Billing_Frequency__c = frequency);
      if (!planned.isEmpty() && subscription.Renewal_Date__c != null) {
        Date start = planned[0].Period_Start__c;
        delete as user planned;
        RevquilaBilling.planTerm(subscriptionId, start, Math.max(1, start.monthsBetween(subscription.Renewal_Date__c)));
      }
      logChange(subscriptionId, 'Billing frequency changed', 'Now billed ' + frequency, RevquilaCore.TONE_ACCENT);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Records usage of a usage-based item. */
  @AuraEnabled
  public static void logUsage(Id itemId, Date usageDate, Decimal quantity, String note) {
    try {
      List<Subscription_Item__c> items = [
        SELECT Id, Subscription__c, Usage_Based__c
        FROM Subscription_Item__c
        WHERE Id = :itemId
        WITH USER_MODE
      ];
      need(!items.isEmpty(), 'That item is no longer on the subscription.');
      need(items[0].Usage_Based__c, 'That product is not billed on usage.');
      need(quantity != null && quantity > 0, 'Enter the quantity used, above zero.');
      insert as user new Usage_Record__c(
        Subscription_Item__c = itemId,
        Subscription__c = items[0].Subscription__c,
        Usage_Date__c = usageDate == null ? Date.today() : usageDate,
        Quantity__c = quantity,
        Note__c = String.isBlank(note) ? null : note.trim().abbreviate(255)
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  @AuraEnabled
  public static void setAutoRenew(Id subscriptionId, Boolean autoRenew) {
    try {
      Subscription__c subscription = one(subscriptionId);
      need(
        subscription.Status__c != CANCELLED,
        'A cancelled subscription cannot renew.'
      );
      Boolean isOn = autoRenew == true;
      Subscription__c change = new Subscription__c(
        Id = subscriptionId,
        Auto_Renew__c = isOn
      );
      // turning it back on takes back a cancellation that was set for the end of the term
      if (isOn) {
        change.Cancel_Reason__c = null;
        change.Ends_On__c = null;
      }
      update as user change;
      if (subscription.Contract__c != null) {
        update as user new Contract__c(Id = subscription.Contract__c, Auto_Renew__c = isOn);
      }
      logChange(
        subscriptionId,
        isOn ? 'Auto-renew turned on' : 'Auto-renew turned off',
        isOn ? 'Renews without a new signature' : 'Needs a signed renewal',
        isOn ? RevquilaCore.TONE_GOOD : RevquilaCore.TONE_WARN
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Stops billing until the subscription is resumed. The renewal date does not move. */
  @AuraEnabled
  public static void pause(Id subscriptionId) {
    try {
      need(
        one(subscriptionId).Status__c == ACTIVE,
        'Only an active subscription can be paused.'
      );
      update as user new Subscription__c(
        Id = subscriptionId,
        Status__c = PAUSED,
        Paused_On__c = Date.today()
      );
      skipPlanned(subscriptionId);
      logChange(
        subscriptionId,
        'Subscription paused',
        'Billing stops until it is resumed',
        RevquilaCore.TONE_WARN
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  @AuraEnabled
  public static void resume(Id subscriptionId) {
    try {
      Subscription__c subscription = one(subscriptionId);
      need(
        subscription.Status__c == PAUSED,
        'Only a paused subscription can be resumed.'
      );
      update as user new Subscription__c(
        Id = subscriptionId,
        Status__c = ACTIVE,
        Paused_On__c = null
      );
      // billing picks up from today for the rest of the term
      if (subscription.Order__c != null && subscription.Renewal_Date__c != null && subscription.Renewal_Date__c > Date.today()) {
        RevquilaBilling.planTerm(subscriptionId, Date.today(), Math.max(1, Date.today().monthsBetween(subscription.Renewal_Date__c)));
      }
      logChange(
        subscriptionId,
        'Subscription resumed',
        'Billing continues',
        RevquilaCore.TONE_GOOD
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Cancels today, or (atTermEnd) lets it run to the renewal date and end there. */
  @AuraEnabled
  public static void cancel(
    Id subscriptionId,
    String reason,
    Boolean atTermEnd
  ) {
    try {
      Subscription__c subscription = one(subscriptionId);
      need(
        subscription.Status__c != CANCELLED,
        'This subscription is already cancelled.'
      );
      need(
        String.isNotBlank(reason),
        'Say why, so the team can learn from it.'
      );
      Subscription__c change = new Subscription__c(
        Id = subscriptionId,
        Auto_Renew__c = false,
        Cancel_Reason__c = reason.trim().abbreviate(255)
      );
      if (atTermEnd != true) {
        change.Status__c = CANCELLED;
      } else {
        change.Ends_On__c = subscription.Renewal_Date__c;
      }
      update as user change;
      String credit = '';
      if (atTermEnd != true) {
        skipPlanned(subscriptionId);
        if (RevquilaSettings.current().prorate && subscription.Renewal_Date__c != null && subscription.Renewal_Date__c > Date.today()) {
          Decimal unused = RevquilaCore.money(RevquilaCore.orZero(subscription.Contract_MRR__c) * 12 * Date.today().daysBetween(subscription.Renewal_Date__c) / TERM_DAYS);
          if (unused > 0) {
            credit = ' · unused ' + unused.toPlainString() + ' for the rest of the term: credit or refund it from the last invoice if it was paid ahead';
          }
        }
      }
      logChange(
        subscriptionId,
        atTermEnd == true
          ? 'Set to end on the renewal date'
          : 'Subscription cancelled',
        change.Cancel_Reason__c + credit,
        RevquilaCore.TONE_BAD
      );
      if (atTermEnd != true) {
        RevquilaRevenueDepthService.handleContractModification(subscriptionId, 'termination', change.Cancel_Reason__c);
        fireFor(subscriptionId, RevquilaCore.SUBSCRIPTION_CANCELLED);
      }
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Creates a draft renewal quote and returns the quote's id. */
  @AuraEnabled
  public static Id renew(Id subscriptionId) {
    try {
      Subscription__c subscription = one(subscriptionId);
      if (subscription.Contract__c != null) {
        Id quoteId = RevquilaContractController.renewalQuote(subscription.Contract__c);
        noteRenewalQuote(subscriptionId, quoteId);
        return quoteId;
      }
      RevquilaQuoteController.QuoteInput quote = new RevquilaQuoteController.QuoteInput();
      quote.accountId = subscription.Account__c;
      quote.country = subscription.Country__c;
      quote.region = subscription.Account__r.BillingState;
      quote.type = 'renewal';
      quote.reference =
        subscription.Account__r.Name +
        ': renewal of ' +
        RevquilaCore.shownNumber(subscription);
      quote.lines = renewalLines(subscription, RevquilaSettings.current().renewalUplift);
      Id quoteId = RevquilaQuoteController.save(quote);
      noteRenewalQuote(subscriptionId, quoteId);
      return quoteId;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static void noteRenewalQuote(Id subscriptionId, Id quoteId) {
    Quote__c quote = [SELECT Name, Display_Number__c FROM Quote__c WHERE Id = :quoteId WITH USER_MODE];
    String quoteNumber = RevquilaCore.shownNumber(quote);
    Revenue_Event__c created = RevquilaCore.event(
      subscriptionId,
      'Renewal quote created',
      quoteNumber,
      RevquilaCore.TONE_ACCENT
    );
    created.Kind__c = KIND_NOTE;
    insert as user created;
  }

  /** The subscription's items as renewal quote lines: the price it pays now, with the uplift. */
  public static List<RevquilaPricing.LineInput> renewalLines(Subscription__c subscription, Decimal uplift) {
    Map<Id, RevquilaPricing.Product> products = new Map<Id, RevquilaPricing.Product>();
    Set<Id> productIds = new Set<Id>();
    for (Subscription_Item__c item : subscription.Items__r) {
      if (item.Product__c != null) {
        productIds.add(item.Product__c);
      }
    }
    for (RevquilaPricing.Product product : RevquilaPricing.products(productIds)) {
      products.put(product.id, product);
    }
    List<RevquilaPricing.LineInput> lines = new List<RevquilaPricing.LineInput>();
    Decimal factor = 1 + RevquilaCore.orZero(uplift) / 100;
    for (Subscription_Item__c item : subscription.Items__r) {
      RevquilaPricing.LineInput line = new RevquilaPricing.LineInput();
      line.productId = products.containsKey(item.Product__c) ? item.Product__c : null;
      line.name = item.Description__c;
      line.unit = item.Unit__c;
      line.qty = item.Quantity__c;
      line.discount = 0;
      RevquilaPricing.Product product = products.get(item.Product__c);
      Integer periodMonths = product == null ? 12 : RevquilaBilling.periodMonths(product.billingFrequency);
      Decimal perPeriod = item.Usage_Based__c
        ? RevquilaCore.orZero(item.Usage_Price__c)
        : RevquilaCore.orZero(item.Unit_Price__c) * periodMonths / 12;
      line.price = RevquilaCore.money(perPeriod * factor);
      if (line.productId != null) {
        line.priceOverride = line.price;
      }
      lines.add(line);
    }
    return lines;
  }

  /** Adds a note to the subscription's timeline. */
  @AuraEnabled
  public static void logNote(Id subscriptionId, String note) {
    try {
      one(subscriptionId);
      need(String.isNotBlank(note), 'Write the note first.');
      Revenue_Event__c entry = RevquilaCore.event(
        subscriptionId,
        'Note',
        note.trim(),
        RevquilaCore.TONE_TEAL
      );
      entry.Kind__c = KIND_NOTE;
      insert as user entry;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- used by other classes

  /**
   * Starts the subscription a signed quote brings: its recurring lines, for the quote's term, at
   * the price the customer actually pays (after discount) per year. Usage lines are billed on
   * usage. Returns null when no line is recurring.
   */
  public static Subscription__c startFor(Quote__c quote) {
    List<Quote_Line__c> recurring = new List<Quote_Line__c>();
    for (Quote_Line__c line : quote.Lines__r) {
      if (line.Recurring__c && !line.Optional__c) {
        recurring.add(line);
      }
    }
    if (recurring.isEmpty()) {
      return null;
    }
    Integer termMonths = quote.Term_Months__c == null || quote.Term_Months__c < 1 ? 12 : quote.Term_Months__c.intValue();
    Date start = quote.Start_Date__c == null ? Date.today() : quote.Start_Date__c;
    RevquilaSettings settings = RevquilaSettings.current();
    String frequency = settings.scheduleFrequency == 'product' ? null : settings.scheduleFrequency;
    Subscription__c subscription = new Subscription__c(
      Account__c = quote.Account__c,
      Quote__c = quote.Id,
      Start_Date__c = start,
      Renewal_Date__c = termMonths == 12 && start == Date.today() ? start.addDays(TERM_DAYS) : start.addMonths(termMonths),
      Auto_Renew__c = settings.autoRenew,
      Status__c = ACTIVE,
      Term_Months__c = termMonths,
      Billing_Frequency__c = frequency,
      Bill_In_Advance__c = settings.billInAdvance,
      Country__c = quote.Country__c,
      Currency_Code__c = quote.Currency_Code__c,
      Exchange_Rate__c = RevquilaCore.rate(quote.Exchange_Rate__c)
    );
    insert as user subscription;
    RevquilaCore.stampNumber(subscription, 'subscription');
    List<Subscription_Item__c> items = new List<Subscription_Item__c>();
    for (Quote_Line__c line : recurring) {
      Boolean usage = line.Usage_Based__c;
      Integer lineTerm = line.Term_Months__c == null || line.Term_Months__c < 1 ? termMonths : line.Term_Months__c.intValue();
      items.add(
        new Subscription_Item__c(
          Subscription__c = subscription.Id,
          Product__c = line.Product__c,
          Description__c = line.Description__c,
          Unit__c = line.Unit__c,
          Unit_Price__c = usage ? 0 : RevquilaCore.money(
            RevquilaCore.orZero(line.Net_Amount__c) / line.Quantity__c * 12 / lineTerm
          ),
          Quantity__c = line.Quantity__c,
          Usage_Based__c = usage,
          Usage_Price__c = usage ? line.Unit_Price__c : null
        )
      );
    }
    insert as user items;
    logChange(
      subscription.Id,
      'Subscription started',
      'From quote ' + RevquilaCore.shownNumber(quote),
      RevquilaCore.TONE_ACCENT
    );
    // read back for its number, which only exists once the row is saved
    return [
      SELECT Id, Name, Display_Number__c
      FROM Subscription__c
      WHERE Id = :subscription.Id
      WITH USER_MODE
    ];
  }

  /** A new term on a subscription that renews by itself, with the uplift on its prices, billed by schedules. */
  public static void renewTerm(Id subscriptionId, Decimal uplift) {
    Subscription__c subscription = one(subscriptionId);
    Integer months = subscription.Term_Months__c == null || subscription.Term_Months__c < 1 ? 12 : subscription.Term_Months__c.intValue();
    Date start = subscription.Renewal_Date__c;
    Date renewal = start.addMonths(months);
    Decimal factor = 1 + RevquilaCore.orZero(uplift) / 100;
    if (factor != 1) {
      List<Subscription_Item__c> raised = new List<Subscription_Item__c>();
      for (Subscription_Item__c item : subscription.Items__r) {
        raised.add(new Subscription_Item__c(Id = item.Id, Unit_Price__c = RevquilaCore.money(RevquilaCore.orZero(item.Unit_Price__c) * factor)));
      }
      update as user raised;
    }
    update as user new Subscription__c(Id = subscriptionId, Start_Date__c = start, Renewal_Date__c = renewal);
    if (subscription.Contract__c != null) {
      Contract__c contract = [SELECT Id, Annual_Value__c, End_Date__c FROM Contract__c WHERE Id = :subscription.Contract__c WITH USER_MODE];
      update as user new Contract__c(
        Id = contract.Id,
        End_Date__c = renewal.addDays(-1),
        Annual_Value__c = RevquilaCore.money(RevquilaCore.orZero(contract.Annual_Value__c) * factor)
      );
      insert as user RevquilaCore.event(contract.Id, 'Renewed by itself', RevquilaCore.dayText(start) + ' to ' + RevquilaCore.dayText(renewal.addDays(-1)) + (factor == 1 ? '' : ' · ' + RevquilaPricing.plain(uplift) + '% uplift'), RevquilaCore.TONE_GOOD);
    }
    if (subscription.Order__c != null) {
      RevquilaBilling.planTerm(subscriptionId, start, months);
    }
    logChange(subscriptionId, 'Renewed', RevquilaCore.dayText(start) + ' to ' + RevquilaCore.dayText(renewal.addDays(-1)) + (factor == 1 ? '' : ' · ' + RevquilaPricing.plain(uplift) + '% uplift'), RevquilaCore.TONE_GOOD);
  }

  /** Ends a subscription whose term ran out without a renewal. */
  public static void endTerm(Id subscriptionId) {
    Subscription__c subscription = one(subscriptionId);
    update as user new Subscription__c(
      Id = subscriptionId,
      Status__c = CANCELLED,
      Cancel_Reason__c = String.isBlank(subscription.Cancel_Reason__c) ? 'The term ended without a renewal' : subscription.Cancel_Reason__c
    );
    skipPlanned(subscriptionId);
    if (subscription.Contract__c != null) {
      update as user new Contract__c(Id = subscription.Contract__c, Status__c = RevquilaContractController.EXPIRED);
      insert as user RevquilaCore.event(subscription.Contract__c, 'Contract ended', 'The term ran out without a renewal', RevquilaCore.TONE_WARN);
    }
    logChange(subscriptionId, 'Term ended', 'Not renewed', RevquilaCore.TONE_BAD);
    fireFor(subscriptionId, RevquilaCore.SUBSCRIPTION_CANCELLED);
  }

  /** Runs the automation for a moment of a subscription. */
  public static void fireFor(Id subscriptionId, String moment) {
    try {
      Subscription__c subscription = one(subscriptionId);
      RevquilaAutomation.Context context = new RevquilaAutomation.Context();
      context.moment = moment;
      context.recordId = subscriptionId;
      context.recordKind = 'subscription';
      Integer daysLeft = subscription.Renewal_Date__c == null ? null : Date.today().daysBetween(subscription.Renewal_Date__c);
      context.facts = new Map<String, Object>{
        'record.number' => RevquilaCore.shownNumber(subscription),
        'subscription.number' => RevquilaCore.shownNumber(subscription),
        'subscription.mrr' => RevquilaCore.orZero(subscription.Contract_MRR__c),
        'subscription.renewalDate' => subscription.Renewal_Date__c,
        'subscription.daysLeft' => daysLeft,
        'subscription.status' => subscription.Status__c,
        'account.name' => subscription.Account__r?.Name,
        'company.name' => RevquilaSettings.current().companyName
      };
      context.targets.put('Account', subscription.Account__c);
      context.targets.put('Subscription', subscriptionId);
      context.users.put('owner', new Set<Id>{ subscription.OwnerId });
      if (subscription.Account__r?.OwnerId != null) {
        context.users.put('account_owner', new Set<Id>{ subscription.Account__r.OwnerId });
      }
      context.emails.put('billing', subscription.Account__r?.Billing_Email__c);
      List<Contact> contacts = [SELECT Id, Email FROM Contact WHERE AccountId = :subscription.Account__c AND Email != NULL WITH USER_MODE LIMIT 1];
      if (!contacts.isEmpty()) {
        context.emails.put('contact', contacts[0].Email);
        context.targets.put('Contact', contacts[0].Id);
        if (String.isBlank(context.emails.get('billing'))) {
          context.emails.put('billing', contacts[0].Email);
        }
      }
      for (User person : [SELECT Id, Email FROM User WHERE Id = :subscription.OwnerId]) {
        context.emails.put('owner', person.Email);
      }
      RevquilaAutomation.fire(context);
    } catch (Exception e) {
      RevquilaCore.log('automation', moment, 'failed', null, e.getMessage(), subscriptionId);
    }
  }

  // ---------------------------------------------------------------- helpers

  public static Subscription__c one(Id subscriptionId) {
    List<Subscription__c> rows = (List<Subscription__c>) Database.query(
      'SELECT ' + FIELDS + ' FROM Subscription__c WHERE Id = :subscriptionId',
      AccessLevel.USER_MODE
    );
    if (rows.isEmpty()) {
      throw new RevquilaCore.ProblemException(
        'That subscription no longer exists.'
      );
    }
    return rows[0];
  }

  private static void need(Boolean condition, String message) {
    if (condition != true) {
      throw new RevquilaCore.ProblemException(message);
    }
  }

  private static RevquilaPricing.Product productOf(Id productId) {
    List<RevquilaPricing.Product> found = RevquilaPricing.products(new Set<Id>{ productId });
    need(!found.isEmpty(), 'That product is inactive or has no standard price.');
    return found[0];
  }

  // A product's price for one year, in the subscription's currency
  private static Decimal yearlyPrice(RevquilaPricing.Product product, Subscription__c subscription) {
    Integer periodMonths = RevquilaBilling.periodMonths(product.billingFrequency);
    return RevquilaCore.money(product.price * RevquilaCore.rate(subscription.Exchange_Rate__c) * 12 / periodMonths);
  }

  // A change of `yearlyDelta` a year, from today to the end of the term: a charge or a credit to bill
  private static String prorate(Subscription__c subscription, Decimal yearlyDelta, Id productId, String what) {
    if (!RevquilaSettings.current().prorate || subscription.Renewal_Date__c == null || subscription.Order__c == null) {
      return '';
    }
    Integer daysLeft = Date.today().daysBetween(subscription.Renewal_Date__c);
    if (daysLeft <= 0 || yearlyDelta == 0) {
      return '';
    }
    Decimal amount = RevquilaCore.money(yearlyDelta * daysLeft / TERM_DAYS);
    if (amount == 0) {
      return '';
    }
    RevquilaBilling.prorationFor(subscription, amount, (amount > 0 ? 'Prorated charge: ' : 'Prorated credit: ') + what, productId, (amount > 0 ? 'Prorated: ' : 'Credit: ') + what);
    return ' · ' + (amount > 0 ? 'prorated charge ' : 'prorated credit ') + amount.abs().toPlainString() + ' on the next invoice';
  }

  // After a change: the planned invoices follow the new items, and the contract's value too
  private static void afterChange(Subscription__c subscription) {
    RevquilaBilling.replan(subscription.Id);
    if (subscription.Contract__c != null) {
      Decimal annual = 0;
      for (Subscription_Item__c item : [
        SELECT Unit_Price__c, Quantity__c
        FROM Subscription_Item__c
        WHERE Subscription__c = :subscription.Id
        WITH USER_MODE
      ]) {
        annual += RevquilaCore.orZero(item.Unit_Price__c) * RevquilaCore.orZero(item.Quantity__c);
      }
      update as user new Contract__c(Id = subscription.Contract__c, Annual_Value__c = RevquilaCore.money(annual), Amended_On__c = Date.today());
    }
    RevquilaRevenueDepthService.handleContractModification(subscription.Id, 'prospective', 'Subscription amended/upgraded');
    fireFor(subscription.Id, RevquilaCore.SUBSCRIPTION_CHANGED);
  }

  private static void skipPlanned(Id subscriptionId) {
    List<Billing_Schedule__c> planned = [
      SELECT Id
      FROM Billing_Schedule__c
      WHERE Subscription__c = :subscriptionId AND Status__c = :RevquilaBilling.PLANNED AND Kind__c IN ('recurring', 'usage')
      WITH USER_MODE
    ];
    for (Billing_Schedule__c row : planned) {
      row.Status__c = RevquilaBilling.SKIPPED;
    }
    update as user planned;
  }

  // A timeline entry that carries the MRR being billed once the change is in, and the kind of movement
  private static void logChange(
    Id subscriptionId,
    String title,
    String detail,
    String tone
  ) {
    Subscription__c saved = [
      SELECT Status__c, Contract_MRR__c, Exchange_Rate__c
      FROM Subscription__c
      WHERE Id = :subscriptionId
      WITH USER_MODE
    ];
    List<Revenue_Event__c> previous = [
      SELECT Number_Value__c
      FROM Revenue_Event__c
      WHERE Subscription__c = :subscriptionId AND Kind__c = :KIND_MRR
      WITH USER_MODE
      ORDER BY Occurred_On__c DESC, Name DESC
      LIMIT 1
    ];
    Revenue_Event__c entry = RevquilaCore.event(
      subscriptionId,
      title,
      detail,
      tone
    );
    entry.Kind__c = KIND_MRR;
    // the MRR history is kept in the home currency, so every subscription adds up on the dashboard
    Decimal after = saved.Status__c == ACTIVE
      ? RevquilaCore.toBase(saved.Contract_MRR__c, saved.Exchange_Rate__c)
      : 0;
    entry.Number_Value__c = after;
    Decimal before = previous.isEmpty() ? null : RevquilaCore.orZero(previous[0].Number_Value__c);
    if (before == null) {
      entry.Movement__c = after > 0 ? 'new' : null;
    } else if (before == 0 && after > 0) {
      entry.Movement__c = 'reactivation';
    } else if (before > 0 && after == 0) {
      entry.Movement__c = 'churn';
    } else if (after > before) {
      entry.Movement__c = 'expansion';
    } else if (after < before) {
      entry.Movement__c = 'contraction';
    }
    insert as user entry;
  }

  // What each account owes on invoices that are past their due date
  private static Map<Id, Decimal> overdueByAccount(Set<Id> accountIds) {
    Map<Id, Decimal> overdue = new Map<Id, Decimal>();
    for (AggregateResult row : [
      SELECT
        Account__c accountId,
        SUM(Total__c) total,
        SUM(Paid_Amount__c) paid,
        SUM(Credited_Amount__c) credited,
        SUM(Refunded_Amount__c) refunded
      FROM Invoice__c
      WHERE
        Account__c IN :accountIds
        AND Sent_On__c != NULL
        AND Balance__c > 0
        AND Due_On__c < TODAY
      WITH USER_MODE
      GROUP BY Account__c
    ]) {
      overdue.put(
        (Id) row.get('accountId'),
        RevquilaCore.orZero((Decimal) row.get('total')) -
          RevquilaCore.orZero((Decimal) row.get('paid')) -
          RevquilaCore.orZero((Decimal) row.get('credited')) +
          RevquilaCore.orZero((Decimal) row.get('refunded'))
      );
    }
    return overdue;
  }

  private static SubscriptionView view(
    Subscription__c row,
    Map<Id, Decimal> overdue
  ) {
    SubscriptionView subscription = new SubscriptionView();
    subscription.id = row.Id;
    subscription.name = RevquilaCore.shownNumber(row);
    subscription.accountId = row.Account__c;
    subscription.account = row.Account__r?.Name;
    subscription.owner = row.Owner.Name;
    subscription.quoteId = row.Quote__c;
    subscription.quoteNumber = row.Quote__r == null ? null : (String.isNotBlank(row.Quote__r.Display_Number__c) ? row.Quote__r.Display_Number__c : row.Quote__r.Name);
    subscription.startDate = row.Start_Date__c;
    subscription.renewalDate = row.Renewal_Date__c;
    subscription.autoRenew = row.Auto_Renew__c;
    subscription.status = row.Status__c;
    subscription.cancelReason = row.Cancel_Reason__c;
    subscription.contractMrr = RevquilaCore.orZero(row.Contract_MRR__c);
    subscription.country = row.Country__c;
    subscription.currencyCode = row.Currency_Code__c;
    subscription.exchangeRate = RevquilaCore.rate(row.Exchange_Rate__c);
    subscription.overdueOnAccount = overdue.containsKey(row.Account__c)
      ? overdue.get(row.Account__c)
      : 0;
    subscription.billingFrequency = RevquilaBilling.frequencyOf(row);
    subscription.nextBillDate = row.Next_Bill_Date__c;
    subscription.contractId = row.Contract__c;
    subscription.contractNumber = row.Contract__r == null ? null : (String.isNotBlank(row.Contract__r.Display_Number__c) ? row.Contract__r.Display_Number__c : row.Contract__r.Name);
    subscription.orderId = row.Order__c;
    subscription.termMonths = row.Term_Months__c == null ? 12 : row.Term_Months__c.intValue();
    subscription.endsOn = row.Ends_On__c;
    subscription.mandateId = row.Mandate_Id__c;
    subscription.mandateStatus = row.Mandate_Status__c;
    subscription.mandateType = row.Mandate_Type__c;
    subscription.mandateMaxAmount = row.Mandate_Max_Amount__c;
    subscription.mandateAuthDate = row.Mandate_Auth_Date__c;
    subscription.discountCode = row.Discount_Code__c;
    subscription.discountPercent = row.Discount_Percent__c;
    subscription.trialEndDate = row.Trial_End_Date__c;
    subscription.items = new List<ItemView>();
    for (Subscription_Item__c item : row.Items__r) {
      ItemView itemView = new ItemView();
      itemView.id = item.Id;
      itemView.productId = item.Product__c;
      itemView.name = item.Description__c;
      itemView.unit = item.Unit__c;
      itemView.price = RevquilaCore.orZero(item.Unit_Price__c);
      itemView.qty = RevquilaCore.orZero(item.Quantity__c);
      itemView.monthly = RevquilaCore.orZero(item.Monthly_Amount__c);
      itemView.usageBased = item.Usage_Based__c;
      itemView.usageUnit = item.Usage_Unit__c;
      itemView.usagePrice = item.Usage_Price__c;
      subscription.items.add(itemView);
    }
    return subscription;
  }

  /** Updates subscription details (renewal date, next bill date, frequency, auto renew, term months). */
  @AuraEnabled
  public static void saveSubscription(Id subscriptionId, Date renewalDate, Date nextBillDate, String frequency, Boolean autoRenew, Integer termMonths) {
    try {
      one(subscriptionId);
      Subscription__c toUpdate = new Subscription__c(Id = subscriptionId);
      if (renewalDate != null) toUpdate.Renewal_Date__c = renewalDate;
      if (nextBillDate != null) toUpdate.Next_Bill_Date__c = nextBillDate;
      if (String.isNotBlank(frequency)) toUpdate.Billing_Frequency__c = frequency;
      if (autoRenew != null) toUpdate.Auto_Renew__c = autoRenew;
      if (termMonths != null) toUpdate.Term_Months__c = termMonths;
      update as user toUpdate;
      insert as user RevquilaCore.event(
        subscriptionId,
        'Subscription updated',
        'Terms modified',
        RevquilaCore.TONE_ACCENT
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}