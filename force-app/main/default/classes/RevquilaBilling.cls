/**
 * Billing: the schedule of invoices an order plans when it is activated (one-time lines now,
 * recurring lines per period of the term at the frequency in Setup), the billing run that
 * raises every invoice that is due, proration when a subscription changes mid-term, usage
 * billing, dunning (reminders, late fees), refunds, write-offs and payments from a gateway.
 */
public with sharing class RevquilaBilling {
  public static final String PLANNED = 'planned';
  public static final String INVOICED = 'invoiced';
  public static final String SKIPPED = 'skipped';

  /** One invoice line a schedule raises. */
  public class PlannedLine {
    public Id productId;
    public String name;
    public String unit;
    public Decimal price;
    public Decimal qty;
    public Decimal discount;
    public Decimal ruleDiscount;
    public Decimal listAmount;
    public Decimal net;
    public Boolean recurring;
    public Id bundleId;
    public String groupName;
  }

  private static final String ORDER_FIELDS =
    'Id, Name, Display_Number__c, Account__c, Contact__c, Quote__c, Contract__c, Reference__c, Status__c, Type__c, ' +
    'Order_Date__c, Activated_On__c, Payment_Terms__c, Region__c, Country__c, Currency_Code__c, Exchange_Rate__c, ' +
    'Base_Net_Amount__c, Notes__c, Subtotal__c, Discount_Total__c, Net_Amount__c, Tax_Amount__c, Total__c, Tax_Breakup__c, ' +
    'Billing_Started__c, (SELECT Id, Product__c, Description__c, Unit__c, Unit_Price__c, Quantity__c, Discount__c, ' +
    'Rule_Discount__c, Bundle__c, List_Amount__c, Net_Amount__c, Recurring__c, Optional__c, Group__c, Term_Months__c, ' +
    'Start_Date__c, End_Date__c, Usage_Based__c FROM Lines__r ORDER BY Sort_Order__c)';

  // ---------------------------------------------------------------- planning

  /** Months in one billing period. */
  public static Integer periodMonths(String frequency) {
    if (frequency == 'monthly') {
      return 1;
    }
    if (frequency == 'quarterly') {
      return 3;
    }
    return 12;
  }

  /** The billing frequency a subscription uses: its own, Setup's, or yearly. */
  public static String frequencyOf(Subscription__c subscription) {
    if (subscription != null && String.isNotBlank(subscription.Billing_Frequency__c)) {
      return subscription.Billing_Frequency__c;
    }
    String setting = RevquilaSettings.current().scheduleFrequency;
    return setting == 'product' || String.isBlank(setting) ? 'yearly' : setting;
  }

  /**
   * Plans the invoices of an activated order: one schedule for its one-time lines, due today,
   * and one per billing period of the subscription's term for its recurring lines. An order
   * that already planned does nothing.
   */
  public static void planOrder(Id orderId) {
    Order__c order = order(orderId);
    if (order.Billing_Started__c) {
      return;
    }
    RevquilaSettings settings = RevquilaSettings.current();
    Subscription__c subscription = subscriptionOf(order);
    Date today = Date.today();
    List<Billing_Schedule__c> schedules = new List<Billing_Schedule__c>();
    List<PlannedLine> oneTime = new List<PlannedLine>();
    List<PlannedLine> recurring = new List<PlannedLine>();
    for (Order_Line__c line : order.Lines__r) {
      if (line.Optional__c || line.Usage_Based__c) {
        continue;
      }
      PlannedLine planned = planned(line);
      if (line.Recurring__c && subscription != null && order.Type__c != 'amendment') {
        recurring.add(planned);
      } else {
        oneTime.add(planned);
      }
    }
    if (!oneTime.isEmpty()) {
      schedules.add(
        schedule(order, subscription, today, today, today, oneTime, 'one_time', order.Type__c == 'amendment' ? 'Amendment, prorated to the contract end' : 'One-time charges')
      );
    }
    if (!recurring.isEmpty()) {
      String frequency = frequencyOf(subscription);
      Integer months = periodMonths(frequency);
      Date start = subscription.Start_Date__c == null ? today : subscription.Start_Date__c;
      Date termEnd = subscription.Renewal_Date__c == null ? start.addMonths(12) : subscription.Renewal_Date__c;
      Integer termMonths = Math.max(1, start.monthsBetween(termEnd));
      Integer periods = Math.max(1, (Decimal.valueOf(termMonths) / months).round(System.RoundingMode.CEILING).intValue());
      for (Integer index = 0; index < periods; index++) {
        Date periodStart = start.addMonths(index * months);
        Date periodEnd = index == periods - 1 ? termEnd.addDays(-1) : start.addMonths((index + 1) * months).addDays(-1);
        Decimal share = Decimal.valueOf(Math.min(months, periodStart.monthsBetween(periodEnd.addDays(1)))) / termMonths;
        List<PlannedLine> lines = scaled(recurring, share);
        Date billDate = settings.billInAdvance ? periodStart : periodEnd;
        if (settings.billingDay > 0 && index > 0) {
          billDate = Date.newInstance(billDate.year(), billDate.month(), Math.min(settings.billingDay, Date.daysInMonth(billDate.year(), billDate.month())));
        }
        if (billDate < today) {
          billDate = today;
        }
        schedules.add(
          schedule(order, subscription, billDate, periodStart, periodEnd, lines, 'recurring', 'Subscription, ' + RevquilaCore.dayText(periodStart) + ' to ' + RevquilaCore.dayText(periodEnd))
        );
      }
      Date nextBill;
      for (Billing_Schedule__c row : schedules) {
        if (row.Kind__c == 'recurring' && (nextBill == null || row.Bill_Date__c < nextBill)) {
          nextBill = row.Bill_Date__c;
        }
      }
      update as user new Subscription__c(
        Id = subscription.Id,
        Billing_Frequency__c = frequency,
        Bill_In_Advance__c = settings.billInAdvance,
        Next_Bill_Date__c = nextBill,
        Order__c = order.Id
      );
    }
    insert as user schedules;
    update as user new Order__c(Id = order.Id, Billing_Started__c = true);
    insert as user RevquilaCore.event(
      order.Id,
      'Billing planned',
      schedules.size() == 1 ? '1 invoice' : schedules.size() + ' invoices over the term',
      RevquilaCore.TONE_TEAL
    );
  }

  private static PlannedLine planned(Order_Line__c line) {
    PlannedLine planned = new PlannedLine();
    planned.productId = line.Product__c;
    planned.name = line.Description__c;
    planned.unit = line.Unit__c;
    planned.price = line.Unit_Price__c;
    planned.qty = line.Quantity__c;
    planned.discount = line.Discount__c;
    planned.ruleDiscount = line.Rule_Discount__c;
    planned.listAmount = line.List_Amount__c;
    planned.net = line.Net_Amount__c;
    planned.recurring = line.Recurring__c;
    planned.bundleId = line.Bundle__c;
    planned.groupName = line.Group__c;
    return planned;
  }

  private static List<PlannedLine> scaled(List<PlannedLine> lines, Decimal share) {
    List<PlannedLine> result = new List<PlannedLine>();
    for (PlannedLine line : lines) {
      PlannedLine copy = copyOf(line);
      copy.listAmount = RevquilaCore.money(RevquilaCore.orZero(line.listAmount) * share);
      copy.net = RevquilaCore.money(RevquilaCore.orZero(line.net) * share);
      copy.price = copy.qty > 0 ? RevquilaCore.money(copy.listAmount / copy.qty) : copy.listAmount;
      result.add(copy);
    }
    return result;
  }

  private static PlannedLine copyOf(PlannedLine line) {
    PlannedLine copy = new PlannedLine();
    copy.productId = line.productId;
    copy.name = line.name;
    copy.unit = line.unit;
    copy.price = line.price;
    copy.qty = line.qty;
    copy.discount = line.discount;
    copy.ruleDiscount = line.ruleDiscount;
    copy.listAmount = line.listAmount;
    copy.net = line.net;
    copy.recurring = line.recurring;
    copy.bundleId = line.bundleId;
    copy.groupName = line.groupName;
    return copy;
  }

  private static Billing_Schedule__c schedule(
    Order__c order,
    Subscription__c subscription,
    Date billDate,
    Date periodStart,
    Date periodEnd,
    List<PlannedLine> lines,
    String kind,
    String description
  ) {
    Decimal amount = 0;
    for (PlannedLine line : lines) {
      amount += RevquilaCore.orZero(line.net);
    }
    return new Billing_Schedule__c(
      Order__c = order.Id,
      Subscription__c = subscription == null ? null : subscription.Id,
      Account__c = order.Account__c,
      Bill_Date__c = billDate,
      Period_Start__c = periodStart,
      Period_End__c = periodEnd,
      Amount__c = RevquilaCore.money(amount),
      Description__c = description.abbreviate(255),
      Status__c = PLANNED,
      Kind__c = kind,
      Lines__c = JSON.serialize(lines),
      Country__c = order.Country__c,
      Currency_Code__c = order.Currency_Code__c,
      Exchange_Rate__c = RevquilaCore.rate(order.Exchange_Rate__c)
    );
  }

  /** Re-plans the planned recurring schedules of a subscription from its items today. */
  public static void replan(Id subscriptionId) {
    Subscription__c subscription = subscription(subscriptionId);
    List<Billing_Schedule__c> planned = [
      SELECT Id, Period_Start__c, Period_End__c, Lines__c
      FROM Billing_Schedule__c
      WHERE Subscription__c = :subscriptionId AND Status__c = :PLANNED AND Kind__c = 'recurring'
      WITH USER_MODE
    ];
    if (planned.isEmpty()) {
      return;
    }
    List<PlannedLine> items = itemLines(subscription);
    for (Billing_Schedule__c row : planned) {
      Decimal months = Math.max(1, row.Period_Start__c.monthsBetween(row.Period_End__c.addDays(1)));
      List<PlannedLine> lines = scaled(items, months / 12);
      Decimal amount = 0;
      for (PlannedLine line : lines) {
        amount += line.net;
      }
      row.Lines__c = JSON.serialize(lines);
      row.Amount__c = RevquilaCore.money(amount);
    }
    update as user planned;
  }

  // The subscription's items as yearly lines
  private static List<PlannedLine> itemLines(Subscription__c subscription) {
    List<PlannedLine> lines = new List<PlannedLine>();
    for (Subscription_Item__c item : subscription.Items__r) {
      if (item.Usage_Based__c) {
        continue;
      }
      PlannedLine line = new PlannedLine();
      line.productId = item.Product__c;
      line.name = item.Description__c;
      line.unit = item.Unit__c;
      line.qty = item.Quantity__c;
      line.price = item.Unit_Price__c;
      line.discount = 0;
      line.ruleDiscount = 0;
      line.listAmount = RevquilaCore.money(RevquilaCore.orZero(item.Unit_Price__c) * RevquilaCore.orZero(item.Quantity__c));
      line.net = line.listAmount;
      line.recurring = true;
      lines.add(line);
    }
    return lines;
  }

  /** Plans the schedules of a new term of a subscription that renewed, from `start` for `months`. */
  public static void planTerm(Id subscriptionId, Date start, Integer months) {
    Subscription__c subscription = subscription(subscriptionId);
    RevquilaSettings settings = RevquilaSettings.current();
    String frequency = frequencyOf(subscription);
    Integer periodLength = periodMonths(frequency);
    Integer periods = Math.max(1, (Decimal.valueOf(months) / periodLength).round(System.RoundingMode.CEILING).intValue());
    List<PlannedLine> items = itemLines(subscription);
    if (items.isEmpty()) {
      return;
    }
    List<Billing_Schedule__c> schedules = new List<Billing_Schedule__c>();
    Date termEnd = start.addMonths(months);
    for (Integer index = 0; index < periods; index++) {
      Date periodStart = start.addMonths(index * periodLength);
      Date periodEnd = index == periods - 1 ? termEnd.addDays(-1) : start.addMonths((index + 1) * periodLength).addDays(-1);
      Decimal share = Decimal.valueOf(Math.max(1, periodStart.monthsBetween(periodEnd.addDays(1)))) / 12;
      List<PlannedLine> lines = scaled(items, share);
      Decimal amount = 0;
      for (PlannedLine line : lines) {
        amount += line.net;
      }
      schedules.add(
        new Billing_Schedule__c(
          Subscription__c = subscription.Id,
          Order__c = subscription.Order__c,
          Account__c = subscription.Account__c,
          Bill_Date__c = settings.billInAdvance ? periodStart : periodEnd,
          Period_Start__c = periodStart,
          Period_End__c = periodEnd,
          Amount__c = RevquilaCore.money(amount),
          Description__c = ('Renewal term, ' + RevquilaCore.dayText(periodStart) + ' to ' + RevquilaCore.dayText(periodEnd)).abbreviate(255),
          Status__c = PLANNED,
          Kind__c = 'recurring',
          Lines__c = JSON.serialize(lines),
          Country__c = subscription.Country__c,
          Currency_Code__c = subscription.Currency_Code__c,
          Exchange_Rate__c = RevquilaCore.rate(subscription.Exchange_Rate__c)
        )
      );
    }
    insert as user schedules;
  }

  /** A one-off schedule for a subscription: a proration charge (amount above 0) or credit (below 0), due today. */
  public static Billing_Schedule__c prorationFor(
    Subscription__c subscription,
    Decimal amount,
    String description,
    Id productId,
    String name
  ) {
    PlannedLine line = new PlannedLine();
    line.productId = productId;
    line.name = name;
    line.unit = 'prorated';
    line.qty = 1;
    line.price = RevquilaCore.money(amount);
    line.discount = 0;
    line.ruleDiscount = 0;
    line.listAmount = line.price;
    line.net = line.price;
    line.recurring = false;
    Date today = Date.today();
    Billing_Schedule__c row = new Billing_Schedule__c(
      Subscription__c = subscription.Id,
      Order__c = subscription.Order__c,
      Account__c = subscription.Account__c,
      Bill_Date__c = today,
      Period_Start__c = today,
      Period_End__c = subscription.Renewal_Date__c == null ? today : subscription.Renewal_Date__c.addDays(-1),
      Amount__c = RevquilaCore.money(amount),
      Description__c = description.abbreviate(255),
      Status__c = PLANNED,
      Kind__c = 'proration',
      Lines__c = JSON.serialize(new List<PlannedLine>{ line }),
      Country__c = subscription.Country__c,
      Currency_Code__c = subscription.Currency_Code__c,
      Exchange_Rate__c = RevquilaCore.rate(subscription.Exchange_Rate__c)
    );
    insert as user row;
    return row;
  }

  // ---------------------------------------------------------------- the billing run

  /** Raises the invoices of an order's schedules that are due today. Returns the first invoice. */
  public static Invoice__c billOrder(Id orderId) {
    List<Billing_Schedule__c> due = [
      SELECT Id, Order__c, Subscription__c, Account__c, Bill_Date__c, Period_Start__c, Period_End__c, Amount__c,
        Description__c, Kind__c, Lines__c, Country__c, Currency_Code__c, Exchange_Rate__c
      FROM Billing_Schedule__c
      WHERE Order__c = :orderId AND Status__c = :PLANNED AND Bill_Date__c <= TODAY
      WITH USER_MODE
      ORDER BY Bill_Date__c
    ];
    if (due.isEmpty()) {
      return null;
    }
    return raise(due, order(orderId));
  }

  /**
   * Raises every invoice that is due on or before `asOf`: one per order (or one per account
   * and currency when Setup consolidates). Returns how many invoices were raised.
   */
  public static Integer run(Date asOf) {
    RevquilaSettings settings = RevquilaSettings.current();
    billUsage(asOf);
    List<Billing_Schedule__c> due = [
      SELECT Id, Order__c, Subscription__c, Account__c, Bill_Date__c, Period_Start__c, Period_End__c, Amount__c,
        Description__c, Kind__c, Lines__c, Country__c, Currency_Code__c, Exchange_Rate__c
      FROM Billing_Schedule__c
      WHERE Status__c = :PLANNED AND Bill_Date__c <= :asOf AND Order__c != NULL
      WITH USER_MODE
      ORDER BY Bill_Date__c
      LIMIT 200
    ];
    Map<String, List<Billing_Schedule__c>> groups = new Map<String, List<Billing_Schedule__c>>();
    for (Billing_Schedule__c row : due) {
      String key = settings.consolidate
        ? row.Account__c + '|' + row.Currency_Code__c
        : String.valueOf(row.Order__c);
      if (!groups.containsKey(key)) {
        groups.put(key, new List<Billing_Schedule__c>());
      }
      groups.get(key).add(row);
    }
    Integer raised = 0;
    for (List<Billing_Schedule__c> rows : groups.values()) {
      Savepoint point = Database.setSavepoint();
      try {
        Invoice__c invoice = raise(rows, order(rows[0].Order__c));
        if (invoice != null) {
          raised++;
        }
      } catch (Exception e) {
        Database.rollback(point);
        RevquilaCore.log('billing', 'run', 'failed', null, e.getMessage(), rows[0].Order__c);
      }
    }
    return raised;
  }

  /** Raises one invoice for the schedules, from the order's terms, taxed like the order. */
  public static Invoice__c raise(List<Billing_Schedule__c> schedules, Order__c order) {
    List<PlannedLine> lines = new List<PlannedLine>();
    Decimal net = 0;
    Date periodStart;
    Date periodEnd;
    Boolean recurring = false;
    Boolean proration = false;
    Boolean usage = false;
    Id subscriptionId;
    for (Billing_Schedule__c row : schedules) {
      if (String.isNotBlank(row.Lines__c)) {
        lines.addAll((List<PlannedLine>) JSON.deserialize(row.Lines__c, List<PlannedLine>.class));
      }
      net += RevquilaCore.orZero(row.Amount__c);
      if (row.Kind__c == 'recurring') {
        recurring = true;
      }
      if (row.Kind__c == 'proration') {
        proration = true;
      }
      if (row.Kind__c == 'usage') {
        usage = true;
      }
      if (row.Subscription__c != null) {
        subscriptionId = row.Subscription__c;
      }
      if (periodStart == null || row.Period_Start__c < periodStart) {
        periodStart = row.Period_Start__c;
      }
      if (periodEnd == null || row.Period_End__c > periodEnd) {
        periodEnd = row.Period_End__c;
      }
    }
    net = RevquilaCore.money(net);
    if (net <= 0) {
      // a credit larger than what is billed: the schedules stay planned for the next run
      if (net < 0) {
        return null;
      }
    }
    // tax as the order was taxed: the same lines in the same shares
    Decimal orderNet = RevquilaCore.orZero(order.Net_Amount__c);
    Decimal share = orderNet == 0 ? 0 : net / orderNet;
    List<RevquilaPricing.TaxLine> taxLines = new List<RevquilaPricing.TaxLine>();
    Decimal tax = 0;
    for (RevquilaPricing.TaxLine line : RevquilaPricing.taxLines(order.Tax_Breakup__c)) {
      RevquilaPricing.TaxLine copy = new RevquilaPricing.TaxLine();
      copy.label = line.label;
      copy.rate = line.rate;
      copy.amount = RevquilaCore.money(RevquilaCore.orZero(line.amount) * share);
      tax += copy.amount;
      taxLines.add(copy);
    }
    if (orderNet == 0) {
      // nothing on the order to take the rate from: tax it afresh
      RevquilaPricing.TaxResult taxed = RevquilaPricing.taxOn(net, order.Region__c, RevquilaSettings.current().market(order.Country__c));
      tax = taxed.tax;
      taxLines = taxed.lines;
    }
    Decimal subtotal = 0;
    for (PlannedLine line : lines) {
      subtotal += RevquilaCore.orZero(line.listAmount);
    }
    String kind = 'standard';
    if (proration) {
      kind = 'proration';
    } else if (usage) {
      kind = 'usage';
    } else if (recurring && order.Activated_On__c != null && order.Activated_On__c < Date.today().addDays(-1)) {
      kind = 'recurring';
    }
    if (order.Type__c == 'amendment') {
      kind = 'amendment';
    } else if (order.Type__c == 'renewal' && recurring) {
      kind = 'renewal';
    }
    Date today = Date.today();
    Invoice__c invoice = new Invoice__c(
      Account__c = order.Account__c,
      Contact__c = order.Contact__c,
      Quote__c = order.Quote__c,
      Order__c = order.Id,
      Subscription__c = subscriptionId,
      Reference__c = order.Reference__c,
      Payment_Terms__c = order.Payment_Terms__c,
      Region__c = order.Region__c,
      Country__c = order.Country__c,
      Currency_Code__c = order.Currency_Code__c,
      Exchange_Rate__c = RevquilaCore.rate(order.Exchange_Rate__c),
      Notes__c = order.Notes__c,
      Issued_On__c = today,
      Due_On__c = today.addDays(RevquilaPricing.dueDays(order.Payment_Terms__c)),
      Sent_On__c = today,
      Subtotal__c = RevquilaCore.money(subtotal),
      Discount_Total__c = RevquilaCore.money(subtotal - net),
      Net_Amount__c = net,
      Base_Net_Amount__c = RevquilaCore.toBase(net, order.Exchange_Rate__c),
      Tax_Amount__c = RevquilaCore.money(tax),
      Total__c = RevquilaCore.money(net + tax),
      Tax_Breakup__c = JSON.serialize(taxLines),
      Kind__c = kind,
      Period_Start__c = periodStart,
      Period_End__c = periodEnd,
      Portal_Token__c = RevquilaCore.token()
    );
    insert as user invoice;
    RevquilaInvoiceController.stampNumber(invoice);
    List<Invoice_Line__c> rows = new List<Invoice_Line__c>();
    Integer position = 0;
    for (PlannedLine line : lines) {
      position++;
      rows.add(
        new Invoice_Line__c(
          Invoice__c = invoice.Id,
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
          Start_Date__c = periodStart,
          End_Date__c = periodEnd,
          Sort_Order__c = position
        )
      );
    }
    insert as user rows;
    List<Billing_Schedule__c> done = new List<Billing_Schedule__c>();
    for (Billing_Schedule__c row : schedules) {
      done.add(new Billing_Schedule__c(Id = row.Id, Status__c = INVOICED, Invoice__c = invoice.Id));
    }
    update as user done;
    if (subscriptionId != null) {
      List<Billing_Schedule__c> next = [
        SELECT Bill_Date__c
        FROM Billing_Schedule__c
        WHERE Subscription__c = :subscriptionId AND Status__c = :PLANNED
        WITH USER_MODE
        ORDER BY Bill_Date__c
        LIMIT 1
      ];
      update as user new Subscription__c(Id = subscriptionId, Next_Bill_Date__c = next.isEmpty() ? null : next[0].Bill_Date__c);
    }
    insert as user RevquilaCore.event(
      invoice.Id,
      'Invoice raised',
      (order.Display_Number__c == null ? 'From order ' + order.Name : 'From order ' + order.Display_Number__c) +
      (periodStart == null || kind == 'standard' ? '' : ' · ' + RevquilaCore.dayText(periodStart) + ' to ' + RevquilaCore.dayText(periodEnd)),
      RevquilaCore.TONE_ACCENT
    );
    // what it earns is recognised over the period it is for
    RevquilaRevenue.scheduleFor(invoice.Id);
    afterRaise(invoice);
    return invoice;
  }

  // The payment link, auto-pay and the invoice email once an invoice is raised
  private static void afterRaise(Invoice__c invoice) {
    RevquilaSettings settings = RevquilaSettings.current();
    if (settings.paymentLinks && settings.gateway == 'manual') {
      Invoice__c saved = RevquilaInvoiceController.one(invoice.Id);
      String url = RevquilaPayments.portalLink(saved);
      if (url != null) {
        update as user new Invoice__c(Id = invoice.Id, Payment_Link__c = url);
      }
    }
    RevquilaInvoiceController.fireFor(invoice.Id, RevquilaCore.INVOICE_RAISED, null);
  }

  // ---------------------------------------------------------------- usage

  /** Bills the usage of usage-based items for every period that has ended. */
  public static Integer billUsage(Date asOf) {
    if (!RevquilaSettings.current().usageEnabled) {
      return 0;
    }
    Map<Id, List<Usage_Record__c>> byItem = new Map<Id, List<Usage_Record__c>>();
    for (Usage_Record__c row : [
      SELECT Id, Subscription_Item__c, Subscription__c, Quantity__c, Usage_Date__c
      FROM Usage_Record__c
      WHERE Billed__c = FALSE AND Usage_Date__c < :asOf.toStartOfMonth()
      WITH USER_MODE
      ORDER BY Usage_Date__c
      LIMIT 2000
    ]) {
      if (!byItem.containsKey(row.Subscription_Item__c)) {
        byItem.put(row.Subscription_Item__c, new List<Usage_Record__c>());
      }
      byItem.get(row.Subscription_Item__c).add(row);
    }
    if (byItem.isEmpty()) {
      return 0;
    }
    Map<Id, Subscription_Item__c> items = new Map<Id, Subscription_Item__c>(
      [
        SELECT Id, Subscription__c, Product__c, Description__c, Usage_Unit__c, Usage_Price__c, Unit_Price__c,
          Subscription__r.Account__c, Subscription__r.Order__c, Subscription__r.Country__c,
          Subscription__r.Currency_Code__c, Subscription__r.Exchange_Rate__c
        FROM Subscription_Item__c
        WHERE Id IN :byItem.keySet()
        WITH USER_MODE
      ]
    );
    List<Billing_Schedule__c> schedules = new List<Billing_Schedule__c>();
    List<Usage_Record__c> billed = new List<Usage_Record__c>();
    for (Id itemId : byItem.keySet()) {
      Subscription_Item__c item = items.get(itemId);
      if (item == null || item.Subscription__r.Order__c == null) {
        continue;
      }
      Decimal quantity = 0;
      Date first;
      Date last;
      for (Usage_Record__c row : byItem.get(itemId)) {
        quantity += RevquilaCore.orZero(row.Quantity__c);
        first = first == null || row.Usage_Date__c < first ? row.Usage_Date__c : first;
        last = last == null || row.Usage_Date__c > last ? row.Usage_Date__c : last;
        billed.add(new Usage_Record__c(Id = row.Id, Billed__c = true));
      }
      Decimal unitPrice = item.Usage_Price__c != null ? item.Usage_Price__c : RevquilaCore.orZero(item.Unit_Price__c);
      PlannedLine line = new PlannedLine();
      line.productId = item.Product__c;
      line.name = item.Description__c + ' usage';
      line.unit = item.Usage_Unit__c == null ? 'unit' : item.Usage_Unit__c;
      line.qty = quantity;
      line.price = unitPrice;
      line.discount = 0;
      line.ruleDiscount = 0;
      line.listAmount = RevquilaCore.money(quantity * unitPrice);
      line.net = line.listAmount;
      line.recurring = false;
      schedules.add(
        new Billing_Schedule__c(
          Subscription__c = item.Subscription__c,
          Order__c = item.Subscription__r.Order__c,
          Account__c = item.Subscription__r.Account__c,
          Bill_Date__c = asOf,
          Period_Start__c = first.toStartOfMonth(),
          Period_End__c = last.toStartOfMonth().addMonths(1).addDays(-1),
          Amount__c = line.net,
          Description__c = ('Usage of ' + item.Description__c).abbreviate(255),
          Status__c = PLANNED,
          Kind__c = 'usage',
          Lines__c = JSON.serialize(new List<PlannedLine>{ line }),
          Country__c = item.Subscription__r.Country__c,
          Currency_Code__c = item.Subscription__r.Currency_Code__c,
          Exchange_Rate__c = RevquilaCore.rate(item.Subscription__r.Exchange_Rate__c)
        )
      );
    }
    insert as user schedules;
    update as user billed;
    return schedules.size();
  }

  // ---------------------------------------------------------------- dunning

  /**
   * Walks every overdue invoice through the dunning steps in Setup > Billing: on each step's
   * day after the due date, email the reminder, charge the late fee, tell the owner or create a
   * task. Returns how many steps ran.
   */
  public static Integer dun(Date asOf) {
    RevquilaSettings settings = RevquilaSettings.current();
    if (settings.dunning.isEmpty()) {
      return 0;
    }
    List<RevquilaSettings.DunningStep> steps = settings.dunning.clone();
    Integer ran = 0;
    for (Invoice__c invoice : [
      SELECT Id, Number__c, Due_On__c, Balance__c, Dunning_Stage__c, Account__c, Account__r.Dunning_Paused__c,
        Account__r.OwnerId, Late_Fee_Amount__c, Order__c
      FROM Invoice__c
      WHERE Sent_On__c != NULL AND Balance__c > 0 AND Due_On__c < :asOf AND Written_Off__c = FALSE
      WITH USER_MODE
      ORDER BY Due_On__c
      LIMIT 200
    ]) {
      if (invoice.Account__r?.Dunning_Paused__c == true) {
        continue;
      }
      Integer stage = RevquilaCore.orZero(invoice.Dunning_Stage__c).intValue();
      Integer daysOver = invoice.Due_On__c.daysBetween(asOf);
      if (stage == 0) {
        RevquilaInvoiceController.fireFor(invoice.Id, RevquilaCore.INVOICE_OVERDUE, null);
      }
      while (stage < steps.size() && daysOver >= RevquilaCore.orZero(steps[stage].days)) {
        RevquilaSettings.DunningStep step = steps[stage];
        try {
          runStep(invoice, step, stage + 1);
          ran++;
        } catch (Exception e) {
          RevquilaCore.log('dunning', invoice.Number__c, 'failed', JSON.serialize(step), e.getMessage(), invoice.Id);
        }
        stage++;
      }
      if (stage != RevquilaCore.orZero(invoice.Dunning_Stage__c).intValue()) {
        update as user new Invoice__c(Id = invoice.Id, Dunning_Stage__c = stage);
      }
    }
    return ran;
  }

  private static void runStep(Invoice__c invoice, RevquilaSettings.DunningStep step, Integer stepNumber) {
    String action = step.action == null ? 'email' : step.action;
    if (action == 'fee') {
      Decimal percent = step.feePercent != null ? step.feePercent : RevquilaSettings.current().lateFeePercent;
      if (percent > 0 && RevquilaSettings.current().chargeLateFee) {
        lateFee(invoice.Id, RevquilaCore.money(RevquilaCore.orZero(invoice.Balance__c) * percent / 100));
      }
      return;
    }
    if (action == 'notify' || action == 'task') {
      RevquilaCore.notify(new Set<Id>{ invoice.Account__r.OwnerId }, 'invoiceOverdue', 'Invoice ' + invoice.Number__c + ' is ' + invoice.Due_On__c.daysBetween(Date.today()) + ' days overdue', 'Dunning step ' + stepNumber, invoice.Id);
      if (action == 'task') {
        insert as user new Task(
          Subject = ('Collect ' + invoice.Number__c).abbreviate(255),
          WhatId = invoice.Account__c,
          OwnerId = invoice.Account__r.OwnerId,
          ActivityDate = Date.today().addDays(2),
          Status = 'Not Started'
        );
      }
      return;
    }
    // email: the reminder template, logged on the invoice as a reminder
    RevquilaAutomation.Context context = RevquilaInvoiceController.contextFor(invoice.Id, 'reminder');
    String template = String.isBlank(step.template) ? 'reminder' : step.template;
    Boolean sent = RevquilaAutomation.sendTemplate(template, 'billing', context, RevquilaSettings.current());
    Revenue_Event__c reminder = RevquilaCore.event(invoice.Id, 'Reminder ' + stepNumber, sent ? 'Emailed by Revquila' : 'Due: no email address or template', RevquilaCore.TONE_WARN);
    reminder.Kind__c = RevquilaInvoiceController.KIND_REMINDER;
    insert as user reminder;
  }

  /** Raises a late-fee invoice for an overdue invoice. */
  public static Invoice__c lateFee(Id invoiceId, Decimal amount) {
    RevquilaCore.need(amount != null && amount > 0, 'Enter a fee above zero.');
    Invoice__c source = RevquilaInvoiceController.one(invoiceId);
    Date today = Date.today();
    Invoice__c fee = new Invoice__c(
      Account__c = source.Account__c,
      Contact__c = source.Contact__c,
      Order__c = source.Order__c,
      Subscription__c = source.Subscription__c,
      Reference__c = ('Late fee on ' + source.Number__c).abbreviate(255),
      Payment_Terms__c = 'Due on receipt',
      Region__c = source.Region__c,
      Country__c = source.Country__c,
      Currency_Code__c = source.Currency_Code__c,
      Exchange_Rate__c = RevquilaCore.rate(source.Exchange_Rate__c),
      Issued_On__c = today,
      Due_On__c = today,
      Sent_On__c = today,
      Subtotal__c = RevquilaCore.money(amount),
      Discount_Total__c = 0,
      Net_Amount__c = RevquilaCore.money(amount),
      Base_Net_Amount__c = RevquilaCore.toBase(amount, source.Exchange_Rate__c),
      Tax_Amount__c = 0,
      Total__c = RevquilaCore.money(amount),
      Tax_Breakup__c = '[]',
      Kind__c = 'late_fee',
      Portal_Token__c = RevquilaCore.token()
    );
    insert as user fee;
    RevquilaInvoiceController.stampNumber(fee);
    insert as user new Invoice_Line__c(
      Invoice__c = fee.Id,
      Description__c = 'Late fee on ' + source.Number__c,
      Unit__c = 'one-time',
      Unit_Price__c = fee.Total__c,
      Quantity__c = 1,
      Discount__c = 0,
      List_Amount__c = fee.Total__c,
      Net_Amount__c = fee.Total__c,
      Sort_Order__c = 1
    );
    update as user new Invoice__c(Id = source.Id, Late_Fee_Amount__c = RevquilaCore.orZero(source.Late_Fee_Amount__c) + amount);
    insert as user new List<Revenue_Event__c>{
      RevquilaCore.event(source.Id, 'Late fee charged', fee.Number__c + ' · ' + amount.setScale(2).toPlainString(), RevquilaCore.TONE_BAD),
      RevquilaCore.event(fee.Id, 'Invoice raised', 'Late fee on ' + source.Number__c, RevquilaCore.TONE_BAD)
    };
    return fee;
  }

  // ---------------------------------------------------------------- refunds and write-offs

  /** Returns money on an invoice, through the gateway when the payment came through one. */
  public static Refund__c refund(Id invoiceId, Id paymentId, Decimal amount, String reason, Boolean withCredit) {
    Invoice__c invoice = RevquilaInvoiceController.one(invoiceId);
    RevquilaCore.need(amount != null && amount > 0, 'Enter an amount above zero.');
    RevquilaCore.need(String.isNotBlank(reason), 'Say why, for the audit trail.');
    Decimal refundable = RevquilaCore.orZero(invoice.Paid_Amount__c) - RevquilaCore.orZero(invoice.Refunded_Amount__c);
    RevquilaCore.need(RevquilaCore.money(amount) <= RevquilaCore.money(refundable), 'That is more than was paid and not yet refunded.');
    String reference;
    if (paymentId != null) {
      List<Payment__c> payments = [
        SELECT Id, Gateway__c, Gateway_Reference__c, Amount__c
        FROM Payment__c
        WHERE Id = :paymentId AND Invoice__c = :invoiceId
        WITH USER_MODE
      ];
      RevquilaCore.need(!payments.isEmpty(), 'That payment is not on this invoice.');
      if (String.isNotBlank(payments[0].Gateway__c) && String.isNotBlank(payments[0].Gateway_Reference__c)) {
        reference = RevquilaPayments.gateway().refund(payments[0], amount, reason);
      }
    }
    if (withCredit == true) {
      insert as user new Credit_Note__c(
        Invoice__c = invoiceId,
        Amount__c = RevquilaCore.money(amount),
        Reason__c = ('Refund: ' + reason.trim()).abbreviate(255),
        Issued_On__c = Date.today()
      );
    }
    Refund__c row = new Refund__c(
      Invoice__c = invoiceId,
      Payment__c = paymentId,
      Amount__c = RevquilaCore.money(amount),
      Reason__c = reason.trim().abbreviate(255),
      Refunded_On__c = Date.today(),
      Gateway_Reference__c = reference
    );
    insert as user row;
    insert as user RevquilaCore.event(invoiceId, 'Refunded', reason.trim() + (reference == null ? '' : ' · ' + reference), RevquilaCore.TONE_BAD);
    return row;
  }

  /** Writes off what is left on an invoice: a credit note for the balance, marked as a write-off. */
  public static void writeOff(Id invoiceId, String reason) {
    Invoice__c invoice = RevquilaInvoiceController.one(invoiceId);
    RevquilaCore.need(RevquilaCore.orZero(invoice.Balance__c) > 0, 'Nothing is left to write off.');
    RevquilaCore.need(String.isNotBlank(reason), 'Say why, for the audit trail.');
    insert as user new Credit_Note__c(
      Invoice__c = invoiceId,
      Amount__c = invoice.Balance__c,
      Reason__c = ('Written off: ' + reason.trim()).abbreviate(255),
      Issued_On__c = Date.today()
    );
    update as user new Invoice__c(Id = invoiceId, Written_Off__c = true);
    insert as user RevquilaCore.event(invoiceId, 'Written off', reason.trim(), RevquilaCore.TONE_BAD);
  }

  // ---------------------------------------------------------------- gateway payments

  /** Records a payment a gateway reported. Ignores one it has already recorded. */
  public static Payment__c gatewayPayment(String invoiceNumber, Decimal amount, String method, String reference, String gateway) {
    return new Elevated().record(invoiceNumber, amount, method, reference, gateway);
  }

  // A gateway call arrives as the site's guest user, who sees no records: this part runs without sharing
  private without sharing class Elevated {
    Payment__c record(String invoiceNumber, Decimal amount, String method, String reference, String gateway) {
      RevquilaCore.need(String.isNotBlank(invoiceNumber), 'No invoice number in the payment.');
      RevquilaCore.need(amount != null && amount > 0, 'No amount in the payment.');
      List<Invoice__c> invoices = [
        SELECT Id, Number__c, Balance__c, Exchange_Rate__c, Quote__c
        FROM Invoice__c
        WHERE Number__c = :invoiceNumber
        WITH SYSTEM_MODE
        LIMIT 1
      ];
      RevquilaCore.need(!invoices.isEmpty(), 'No invoice ' + invoiceNumber + '.');
      if (String.isNotBlank(reference)) {
        Integer seen = [SELECT COUNT() FROM Payment__c WHERE Gateway_Reference__c = :reference WITH SYSTEM_MODE];
        if (seen > 0) {
          return null;
        }
      }
      Invoice__c invoice = invoices[0];
      Payment__c payment = new Payment__c(
        Invoice__c = invoice.Id,
        Amount__c = RevquilaCore.money(Math.min(amount, RevquilaCore.orZero(invoice.Balance__c) == 0 ? amount : invoice.Balance__c)),
        Base_Amount__c = RevquilaCore.toBase(amount, invoice.Exchange_Rate__c),
        Method__c = method == null ? 'Online' : method.abbreviate(40),
        Reference__c = reference == null ? null : reference.abbreviate(120),
        Gateway__c = gateway,
        Gateway_Reference__c = reference == null ? null : reference.abbreviate(120),
        Paid_On__c = Date.today()
      );
      Database.insert(payment, true, AccessLevel.SYSTEM_MODE);
      Database.insert(RevquilaCore.event(invoice.Id, 'Paid online', method + (reference == null ? '' : ' · ' + reference), RevquilaCore.TONE_GOOD), true, AccessLevel.SYSTEM_MODE);
      Invoice__c after = [SELECT Balance__c FROM Invoice__c WHERE Id = :invoice.Id WITH SYSTEM_MODE];
      if (RevquilaCore.orZero(after.Balance__c) <= 0 && invoice.Quote__c != null) {
        Quote__c quote = [SELECT Id, Status__c FROM Quote__c WHERE Id = :invoice.Quote__c WITH SYSTEM_MODE];
        if (quote.Status__c == RevquilaQuoteController.INVOICED) {
          Database.update(new Quote__c(Id = quote.Id, Status__c = RevquilaQuoteController.PAID), true, AccessLevel.SYSTEM_MODE);
          Database.insert(RevquilaCore.event(quote.Id, 'Paid in full', invoice.Number__c + ' is settled', RevquilaCore.TONE_GOOD), true, AccessLevel.SYSTEM_MODE);
        }
      }
      RevquilaCore.publish(RevquilaCore.PAYMENT_RECEIVED, invoice.Id, new Map<String, Object>{ 'invoice.number' => invoice.Number__c, 'payment.amount' => amount, 'gateway' => gateway });
      return payment;
    }
  }

  // ---------------------------------------------------------------- reading

  public static Order__c order(Id orderId) {
    List<Order__c> rows = (List<Order__c>) Database.query(
      'SELECT ' + ORDER_FIELDS + ' FROM Order__c WHERE Id = :orderId',
      AccessLevel.USER_MODE
    );
    RevquilaCore.need(!rows.isEmpty(), 'That order no longer exists.');
    return rows[0];
  }

  private static Subscription__c subscriptionOf(Order__c order) {
    if (order.Quote__c == null && order.Contract__c == null) {
      return null;
    }
    List<Subscription__c> rows;
    if (order.Contract__c != null) {
      Id contractId = order.Contract__c;
      Set<Id> ids = new Set<Id>();
      for (Contract__c contract : [
        SELECT Subscription__c
        FROM Contract__c
        WHERE Id = :contractId
        WITH USER_MODE
      ]) {
        if (contract.Subscription__c != null) {
          ids.add(contract.Subscription__c);
        }
      }
      rows = [
        SELECT Id, Start_Date__c, Renewal_Date__c, Billing_Frequency__c, Account__c, Order__c
        FROM Subscription__c
        WHERE Contract__c = :contractId OR Id IN :ids
        WITH USER_MODE
        ORDER BY CreatedDate DESC
        LIMIT 1
      ];
      if (!rows.isEmpty()) {
        return rows[0];
      }
    }
    rows = [
      SELECT Id, Start_Date__c, Renewal_Date__c, Billing_Frequency__c, Account__c, Order__c
      FROM Subscription__c
      WHERE Quote__c = :order.Quote__c
      WITH USER_MODE
      ORDER BY CreatedDate DESC
      LIMIT 1
    ];
    return rows.isEmpty() ? null : rows[0];
  }

  public static Subscription__c subscription(Id subscriptionId) {
    return [
      SELECT Id, Name, Account__c, Order__c, Start_Date__c, Renewal_Date__c, Billing_Frequency__c, Country__c,
        Currency_Code__c, Exchange_Rate__c, Status__c, Contract__c,
        (SELECT Id, Product__c, Description__c, Unit__c, Unit_Price__c, Quantity__c, Usage_Based__c FROM Items__r)
      FROM Subscription__c
      WHERE Id = :subscriptionId
      WITH USER_MODE
    ];
  }
}