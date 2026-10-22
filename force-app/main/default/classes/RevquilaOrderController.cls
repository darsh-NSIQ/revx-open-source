/**
 * Orders for the Revquila screens. A signed quote is booked as an order with the same lines
 * and amounts; activating the order plans its billing (RevquilaBilling); the first invoice is
 * raised from it, the rest by the billing run. Amendments and renewals book their own orders.
 */
public with sharing class RevquilaOrderController {
  public static final String BOOKED = 'booked';
  public static final String ACTIVE = 'active';
  public static final String INVOICED = 'invoiced';
  public static final String CANCELLED = 'cancelled';

  private static final Integer LIST_SIZE = 1000;
  private static final String FIELDS =
    'Id, Name, Display_Number__c, Account__c, Account__r.Name, Account__r.BillingCity, Account__r.Tax_Registration_Number__c, ' +
    'Contact__c, Contact__r.Name, Quote__c, Quote__r.Name, Quote__r.Display_Number__c, Contract__c, Contract__r.Name, ' +
    'Contract__r.Display_Number__c, Contract__r.Status__c, Owner.Name, Reference__c, Status__c, Type__c, Order_Date__c, ' +
    'Activated_On__c, Payment_Terms__c, Region__c, Country__c, Currency_Code__c, Exchange_Rate__c, Base_Net_Amount__c, ' +
    'Notes__c, Cancel_Reason__c, Billing_Started__c, Subtotal__c, Discount_Total__c, Net_Amount__c, Tax_Amount__c, ' +
    'Total__c, Tax_Breakup__c, CreatedDate, ' +
    '(SELECT Id, Product__c, Description__c, Unit__c, Unit_Price__c, Quantity__c, Discount__c, ' +
    'List_Amount__c, Net_Amount__c, Recurring__c, Rule_Discount__c, Bundle__c, Bundle__r.Name, Group__c, Optional__c, ' +
    'Term_Months__c, Start_Date__c, End_Date__c, Usage_Based__c FROM Lines__r ORDER BY Sort_Order__c)';

  public class OrderView {
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
    public String owner;
    @AuraEnabled
    public Id quoteId;
    @AuraEnabled
    public String quoteNumber;
    @AuraEnabled
    public Id contractId;
    @AuraEnabled
    public String contractNumber;
    @AuraEnabled
    public String contractStatus;
    @AuraEnabled
    public String reference;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public String type;
    @AuraEnabled
    public Date orderDate;
    @AuraEnabled
    public Date activatedOn;
    @AuraEnabled
    public String terms;
    @AuraEnabled
    public String region;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public String currencyCode;
    @AuraEnabled
    public Decimal exchangeRate;
    @AuraEnabled
    public String notes;
    @AuraEnabled
    public String cancelReason;
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
    public List<RevquilaPricing.TaxLine> taxLines;
    @AuraEnabled
    public List<RevquilaCore.LineView> lines;
    @AuraEnabled
    public Datetime createdOn;
    // only on getOrder
    @AuraEnabled
    public List<RevquilaCore.EventView> events;
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
    public List<RevquilaSubscriptionController.ScheduleView> schedules;
  }

  // ---------------------------------------------------------------- reading

  /** The newest orders first, each with its lines. */
  @AuraEnabled
  public static List<OrderView> getOrders() {
    try {
      Integer listSize = LIST_SIZE;
      List<OrderView> views = new List<OrderView>();
      for (
        Order__c row : (List<Order__c>) Database.query(
          'SELECT ' +
            FIELDS +
            ' FROM Order__c ORDER BY Order_Date__c DESC, Name DESC LIMIT :listSize',
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

  /** One order with its timeline, billing schedule, its latest invoice and the subscription it bills. */
  @AuraEnabled
  public static OrderView getOrder(Id orderId) {
    try {
      Order__c row = one(orderId);
      OrderView order = view(row);
      order.events = RevquilaCore.eventsOf('Order__c', orderId);
      order.schedules = RevquilaSubscriptionController.schedulesOf('Order__c', orderId);
      for (Invoice__c invoice : [
        SELECT Id, Number__c, Sent_On__c, Due_On__c, Balance__c, Paid_Amount__c, Written_Off__c
        FROM Invoice__c
        WHERE Order__c = :orderId
        WITH USER_MODE
        ORDER BY CreatedDate DESC
        LIMIT 1
      ]) {
        order.invoiceId = invoice.Id;
        order.invoiceNumber = invoice.Number__c;
        order.invoiceStatus = RevquilaInvoiceController.statusOf(invoice);
      }
      List<Subscription__c> subscriptions = [
        SELECT Id, Name, Display_Number__c, Status__c
        FROM Subscription__c
        WHERE Order__c = :orderId OR (Quote__c != NULL AND Quote__c = :row.Quote__c)
        WITH USER_MODE
        ORDER BY CreatedDate DESC
        LIMIT 1
      ];
      for (Subscription__c subscription : subscriptions) {
        order.subscriptionId = subscription.Id;
        order.subscriptionName = RevquilaCore.shownNumber(subscription);
        order.subscriptionStatus = subscription.Status__c;
      }
      return order;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- actions

  /** Activates a booked order and plans its invoices. */
  @AuraEnabled
  public static void activate(Id orderId) {
    try {
      Order__c order = one(orderId);
      need(order.Status__c == BOOKED, 'Only a booked order can be activated.');
      update as user new Order__c(
        Id = orderId,
        Status__c = ACTIVE,
        Activated_On__c = Date.today()
      );
      insert as user RevquilaCore.event(
        orderId,
        'Order activated',
        'Ready to invoice',
        RevquilaCore.TONE_GOOD
      );
      RevquilaBilling.planOrder(orderId);
      if (order.Quote__c != null) {
        Quote__c quote = RevquilaQuoteController.one(order.Quote__c);
        Map<String, Object> figures = RevquilaQuoteController.figures(quote);
        figures.put('order.number', RevquilaCore.shownNumber(order));
        figures.put('order.total', RevquilaCore.orZero(order.Total__c));
        RevquilaQuoteController.fire(quote, RevquilaCore.ORDER_ACTIVATED, figures, null);
      } else {
        RevquilaCore.publish(RevquilaCore.ORDER_ACTIVATED, orderId, new Map<String, Object>{ 'order.number' => RevquilaCore.shownNumber(order) });
      }
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Raises the invoice of what is due on an active order now and returns the invoice's id. */
  @AuraEnabled
  public static Id invoice(Id orderId) {
    try {
      Order__c order = one(orderId);
      need(
        order.Status__c == ACTIVE || (order.Status__c == INVOICED && order.Billing_Started__c),
        order.Status__c == BOOKED
          ? 'Activate the order before invoicing it.'
          : 'Only an active order can be invoiced.'
      );
      if (!order.Billing_Started__c) {
        RevquilaBilling.planOrder(orderId);
      }
      Invoice__c invoice = RevquilaBilling.billOrder(orderId);
      if (invoice == null) {
        List<Billing_Schedule__c> next = [
          SELECT Bill_Date__c
          FROM Billing_Schedule__c
          WHERE Order__c = :orderId AND Status__c = :RevquilaBilling.PLANNED
          WITH USER_MODE
          ORDER BY Bill_Date__c
          LIMIT 1
        ];
        throw new RevquilaCore.ProblemException(
          next.isEmpty()
            ? 'Everything on this order has been invoiced.'
            : 'Nothing is due yet. The billing run raises the next invoice on ' + RevquilaCore.dayText(next[0].Bill_Date__c) + '.'
        );
      }
      update as user new Order__c(Id = orderId, Status__c = INVOICED);
      insert as user RevquilaCore.event(
        orderId,
        'Invoice raised',
        invoice.Number__c + ' · due ' + RevquilaCore.dayText(invoice.Due_On__c),
        RevquilaCore.TONE_ACCENT
      );
      if (order.Quote__c != null) {
        RevquilaQuoteController.markInvoiced(order.Quote__c, invoice);
      }
      return invoice.Id;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Cancels an order that has not been invoiced. */
  @AuraEnabled
  public static void cancel(Id orderId, String reason) {
    try {
      Order__c order = one(orderId);
      need(
        order.Status__c == BOOKED || order.Status__c == ACTIVE,
        'Only a booked or active order can be cancelled.'
      );
      need(String.isNotBlank(reason), 'Say why, for the audit trail.');
      update as user new Order__c(
        Id = orderId,
        Status__c = CANCELLED,
        Cancel_Reason__c = reason.trim().abbreviate(255)
      );
      List<Billing_Schedule__c> planned = [
        SELECT Id
        FROM Billing_Schedule__c
        WHERE Order__c = :orderId AND Status__c = :RevquilaBilling.PLANNED
        WITH USER_MODE
      ];
      for (Billing_Schedule__c row : planned) {
        row.Status__c = RevquilaBilling.SKIPPED;
      }
      update as user planned;
      insert as user RevquilaCore.event(
        orderId,
        'Order cancelled',
        reason.trim(),
        RevquilaCore.TONE_BAD
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- used by other controllers

  /** Books the order for a signed quote: same lines and amounts. Returns it with its number. */
  public static Order__c bookFor(Quote__c quote, Contract__c contract) {
    List<RevquilaCore.LineView> lines = new List<RevquilaCore.LineView>();
    for (RevquilaCore.LineView line : RevquilaQuoteController.lineViews(quote.Lines__r)) {
      if (line.optional != true) {
        lines.add(line);
      }
    }
    return bookLines(quote, contract, lines, String.isBlank(quote.Type__c) ? 'new' : quote.Type__c);
  }

  /**
   * Books an order for lines of a quote, the totals taxed as the quote was (the same shares of
   * its tax lines). Used for new deals, the prorated difference of an amendment, and renewals.
   */
  public static Order__c bookLines(
    Quote__c quote,
    Contract__c contract,
    List<RevquilaCore.LineView> lines,
    String type
  ) {
    Decimal subtotal = 0;
    Decimal net = 0;
    for (RevquilaCore.LineView line : lines) {
      subtotal += RevquilaCore.orZero(line.listAmount);
      net += RevquilaCore.orZero(line.net);
    }
    net = RevquilaCore.money(net);
    Decimal quoteNet = RevquilaCore.orZero(quote.Net_Amount__c);
    Decimal share = quoteNet == 0 ? 0 : net / quoteNet;
    List<RevquilaPricing.TaxLine> taxLines = new List<RevquilaPricing.TaxLine>();
    Decimal tax = 0;
    for (RevquilaPricing.TaxLine line : RevquilaPricing.taxLines(quote.Tax_Breakup__c)) {
      RevquilaPricing.TaxLine copy = new RevquilaPricing.TaxLine();
      copy.label = line.label;
      copy.rate = line.rate;
      copy.amount = RevquilaCore.money(RevquilaCore.orZero(line.amount) * share);
      tax += copy.amount;
      taxLines.add(copy);
    }
    Boolean whole = share == 1;
    Order__c order = new Order__c(
      Account__c = quote.Account__c,
      Contact__c = quote.Contact__c,
      Quote__c = quote.Id,
      Contract__c = contract == null ? null : contract.Id,
      Reference__c = quote.Reference__c,
      Status__c = BOOKED,
      Type__c = type,
      Order_Date__c = Date.today(),
      Payment_Terms__c = quote.Payment_Terms__c,
      Region__c = quote.Region__c,
      Country__c = quote.Country__c,
      Currency_Code__c = quote.Currency_Code__c,
      Exchange_Rate__c = RevquilaCore.rate(quote.Exchange_Rate__c),
      Base_Net_Amount__c = RevquilaCore.toBase(net, quote.Exchange_Rate__c),
      Notes__c = quote.Notes__c,
      Subtotal__c = RevquilaCore.money(subtotal),
      Discount_Total__c = RevquilaCore.money(subtotal - net),
      Net_Amount__c = net,
      Tax_Amount__c = whole ? quote.Tax_Amount__c : RevquilaCore.money(tax),
      Total__c = whole ? quote.Total__c : RevquilaCore.money(net + tax),
      Tax_Breakup__c = whole ? quote.Tax_Breakup__c : JSON.serialize(taxLines)
    );
    insert as user order;
    RevquilaCore.stampNumber(order, 'order');
    List<Order_Line__c> rows = new List<Order_Line__c>();
    Integer position = 0;
    for (RevquilaCore.LineView line : lines) {
      position++;
      rows.add(
        new Order_Line__c(
          Order__c = order.Id,
          Product__c = line.productId,
          Description__c = line.name,
          Unit__c = line.unit,
          Unit_Price__c = line.price,
          Quantity__c = line.qty,
          Discount__c = line.discount,
          Rule_Discount__c = line.ruleDiscount,
          Bundle__c = line.bundleId,
          List_Amount__c = line.listAmount,
          Net_Amount__c = line.net,
          Recurring__c = line.recurring == true,
          Group__c = line.groupName,
          Term_Months__c = line.termMonths,
          Start_Date__c = line.startDate,
          End_Date__c = line.endDate,
          Usage_Based__c = line.usageBased == true,
          Sort_Order__c = position
        )
      );
    }
    insert as user rows;
    insert as user RevquilaCore.event(
      order.Id,
      type == 'amendment' ? 'Amendment order booked' : (type == 'renewal' ? 'Renewal order booked' : 'Order booked'),
      'From quote ' + RevquilaCore.shownNumber(quote),
      RevquilaCore.TONE_ACCENT
    );
    return [
      SELECT Id, Name, Display_Number__c
      FROM Order__c
      WHERE Id = :order.Id
      WITH USER_MODE
    ];
  }

  // ---------------------------------------------------------------- helpers

  public static Order__c one(Id orderId) {
    List<Order__c> rows = (List<Order__c>) Database.query(
      'SELECT ' + FIELDS + ' FROM Order__c WHERE Id = :orderId',
      AccessLevel.USER_MODE
    );
    if (rows.isEmpty()) {
      throw new RevquilaCore.ProblemException('That order no longer exists.');
    }
    return rows[0];
  }

  private static void need(Boolean condition, String message) {
    if (condition != true) {
      throw new RevquilaCore.ProblemException(message);
    }
  }

  private static OrderView view(Order__c row) {
    OrderView order = new OrderView();
    order.id = row.Id;
    order.name = RevquilaCore.shownNumber(row);
    order.accountId = row.Account__c;
    order.account = row.Account__r?.Name;
    order.city = row.Account__r?.BillingCity;
    order.registration = row.Account__r?.Tax_Registration_Number__c;
    order.contactId = row.Contact__c;
    order.contact = row.Contact__r?.Name;
    order.owner = row.Owner.Name;
    order.quoteId = row.Quote__c;
    order.quoteNumber = row.Quote__r == null ? null : (String.isNotBlank(row.Quote__r.Display_Number__c) ? row.Quote__r.Display_Number__c : row.Quote__r.Name);
    order.contractId = row.Contract__c;
    order.contractNumber = row.Contract__r == null ? null : (String.isNotBlank(row.Contract__r.Display_Number__c) ? row.Contract__r.Display_Number__c : row.Contract__r.Name);
    order.contractStatus = row.Contract__r?.Status__c;
    order.reference = row.Reference__c;
    order.status = row.Status__c;
    order.type = String.isBlank(row.Type__c) ? 'new' : row.Type__c;
    order.orderDate = row.Order_Date__c;
    order.activatedOn = row.Activated_On__c;
    order.terms = row.Payment_Terms__c;
    order.region = row.Region__c;
    order.country = row.Country__c;
    order.currencyCode = row.Currency_Code__c;
    order.exchangeRate = RevquilaCore.rate(row.Exchange_Rate__c);
    order.notes = row.Notes__c;
    order.cancelReason = row.Cancel_Reason__c;
    order.subtotal = RevquilaCore.orZero(row.Subtotal__c);
    order.discountTotal = RevquilaCore.orZero(row.Discount_Total__c);
    order.net = RevquilaCore.orZero(row.Net_Amount__c);
    order.tax = RevquilaCore.orZero(row.Tax_Amount__c);
    order.total = RevquilaCore.orZero(row.Total__c);
    order.taxLines = RevquilaPricing.taxLines(row.Tax_Breakup__c);
    order.createdOn = row.CreatedDate;
    order.lines = new List<RevquilaCore.LineView>();
    for (Order_Line__c line : row.Lines__r) {
      RevquilaCore.LineView view = new RevquilaCore.LineView();
      view.id = line.Id;
      view.productId = line.Product__c;
      view.name = line.Description__c;
      view.unit = line.Unit__c;
      view.price = RevquilaCore.orZero(line.Unit_Price__c);
      view.qty = RevquilaCore.orZero(line.Quantity__c);
      view.discount = RevquilaCore.orZero(line.Discount__c);
      view.ruleDiscount = RevquilaCore.orZero(line.Rule_Discount__c);
      view.bundleId = line.Bundle__c;
      view.bundleName = line.Bundle__r?.Name;
      view.listAmount = RevquilaCore.orZero(line.List_Amount__c);
      view.net = RevquilaCore.orZero(line.Net_Amount__c);
      view.recurring = line.Recurring__c;
      view.groupName = line.Group__c;
      view.optional = line.Optional__c;
      view.termMonths = line.Term_Months__c == null ? null : line.Term_Months__c.intValue();
      view.startDate = line.Start_Date__c;
      view.endDate = line.End_Date__c;
      view.usageBased = line.Usage_Based__c;
      order.lines.add(view);
    }
    return order;
  }

  /** Updates order header details (order date, terms, reference, notes, region). */
  @AuraEnabled
  public static void saveOrder(Id orderId, Date orderDate, String terms, String reference, String notes, String region) {
    try {
      one(orderId);
      Order__c toUpdate = new Order__c(Id = orderId);
      if (orderDate != null) toUpdate.Order_Date__c = orderDate;
      if (terms != null) toUpdate.Payment_Terms__c = terms;
      if (reference != null) toUpdate.Reference__c = reference;
      if (notes != null) toUpdate.Notes__c = notes;
      if (region != null) toUpdate.Region__c = region;
      update as user toUpdate;
      insert as user RevquilaCore.event(
        orderId,
        'Order updated',
        'Details modified',
        RevquilaCore.TONE_ACCENT
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}