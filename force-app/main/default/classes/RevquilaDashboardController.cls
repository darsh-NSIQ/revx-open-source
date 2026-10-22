/**
 * The Command Center's figures, added up in the database so they stay right however many
 * records there are: MRR and its last six months, cash collected, what is overdue, how many
 * records sit at each stage, and the short lists the dashboard shows.
 */
public with sharing class RevquilaDashboardController {
  private static final Integer MONTHS = 6;
  private static final Integer RECENT_QUOTES = 6;
  private static final Integer WAITING_QUOTES = 5;
  private static final Integer RENEWAL_COUNT = 5;
  private static final Integer RENEWAL_WINDOW = 90;
  private static final Integer COLLECTED_DAYS = 30;

  /** A figure at the end of a day. */
  public class Point {
    @AuraEnabled
    public Date day;
    @AuraEnabled
    public Decimal value;
  }

  public class Renewal {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String account;
    @AuraEnabled
    public Date renewalDate;
    @AuraEnabled
    public Integer daysLeft;
  }

  public class Dashboard {
    @AuraEnabled
    public Decimal mrr = 0;
    /** MRR at the end of each of the last six months, the last point being today. */
    @AuraEnabled
    public List<Point> mrrSeries = new List<Point>();
    @AuraEnabled
    public Decimal collected = 0;
    @AuraEnabled
    public Integer collectedCount = 0;
    @AuraEnabled
    public Integer collectedDays = COLLECTED_DAYS;
    /** Payments received in each of the last six months, the last point being this month so far. */
    @AuraEnabled
    public List<Point> collectedSeries = new List<Point>();
    @AuraEnabled
    public Decimal overdue = 0;
    @AuraEnabled
    public Integer overdueCount = 0;
    /** How many quotes are at each status. */
    @AuraEnabled
    public Map<String, Integer> quoteCounts = new Map<String, Integer>();
    @AuraEnabled
    public Integer invoicesOpen = 0;
    @AuraEnabled
    public Integer invoicesPaid = 0;
    /** Orders booked or active, not yet invoiced. */
    @AuraEnabled
    public Integer ordersOpen = 0;
    @AuraEnabled
    public List<RevquilaQuoteController.QuoteView> recentQuotes;
    @AuraEnabled
    public List<RevquilaQuoteController.QuoteView> waitingQuotes;
    @AuraEnabled
    public List<Renewal> renewals = new List<Renewal>();
    @AuraEnabled
    public Boolean canApprove = false;
    @AuraEnabled
    public Decimal arr = 0;
    @AuraEnabled
    public Decimal deferred = 0;
    @AuraEnabled
    public Decimal winRate = 0;
  }

  @AuraEnabled
  public static Dashboard getDashboard() {
    try {
      Dashboard dashboard = new Dashboard();
      Date today = Date.today();

      // the last day of each of the five months before this one, then today
      List<Date> days = new List<Date>();
      for (Integer back = MONTHS - 1; back >= 1; back--) {
        days.add(today.toStartOfMonth().addMonths(1 - back).addDays(-1));
      }
      days.add(today);

      addRecurring(dashboard, days);
      addCollected(dashboard, days);
      addInvoices(dashboard);

      for (AggregateResult row : [
        SELECT Status__c status, COUNT(Id) quotes
        FROM Quote__c
        WITH USER_MODE
        GROUP BY Status__c
      ]) {
        dashboard.quoteCounts.put(
          (String) row.get('status'),
          (Integer) row.get('quotes')
        );
      }
      dashboard.recentQuotes = RevquilaQuoteController.views(
        'ORDER BY Quote_Date__c DESC, Name DESC LIMIT ' + RECENT_QUOTES
      );
      dashboard.waitingQuotes = RevquilaQuoteController.views(
        'WHERE Status__c = \'approval\' ORDER BY Approval_Requested_On__c LIMIT ' +
        WAITING_QUOTES
      );
      for (Subscription__c row : [
        SELECT Id, Account__r.Name, Renewal_Date__c
        FROM Subscription__c
        WHERE
          Status__c = :RevquilaSubscriptionController.ACTIVE
          AND Renewal_Date__c <= :today.addDays(RENEWAL_WINDOW)
        WITH USER_MODE
        ORDER BY Renewal_Date__c
        LIMIT :RENEWAL_COUNT
      ]) {
        Renewal renewal = new Renewal();
        renewal.id = row.Id;
        renewal.account = row.Account__r?.Name;
        renewal.renewalDate = row.Renewal_Date__c;
        renewal.daysLeft = today.daysBetween(row.Renewal_Date__c);
        dashboard.renewals.add(renewal);
      }
      dashboard.ordersOpen = [
        SELECT COUNT()
        FROM Order__c
        WHERE Status__c IN ('booked', 'active')
        WITH USER_MODE
      ];
      dashboard.arr = RevquilaCore.money(dashboard.mrr * 12);
      for (AggregateResult ar : [
        SELECT SUM(Deferred_Amount__c) deferred
        FROM Revenue_Schedule__c
        WHERE Status__c = 'open'
        WITH USER_MODE
      ]) {
        dashboard.deferred = RevquilaCore.orZero((Decimal) ar.get('deferred'));
      }
      Integer signed = [SELECT COUNT() FROM Quote__c WHERE Status__c = 'signed' WITH USER_MODE];
      Integer lost = [SELECT COUNT() FROM Quote__c WHERE Status__c IN ('rejected', 'expired') WITH USER_MODE];
      Integer decided = signed + lost;
      dashboard.winRate = decided == 0 ? 0 : RevquilaCore.money((Decimal) signed * 100 / decided);
      dashboard.canApprove = RevquilaCore.canApprove();
      return dashboard;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * MRR today is the sum over active subscriptions. MRR on an earlier day is rebuilt from the
   * timeline: every change to a subscription wrote the MRR it left behind, so the latest
   * entry on or before that day says what the subscription was billing then.
   */
  private static void addRecurring(Dashboard dashboard, List<Date> days) {
    // every subscription's MRR in the home currency
    for (Subscription__c row : [
      SELECT Contract_MRR__c, Exchange_Rate__c
      FROM Subscription__c
      WHERE Status__c = :RevquilaSubscriptionController.ACTIVE
      WITH USER_MODE
      LIMIT 5000
    ]) {
      dashboard.mrr += RevquilaCore.toBase(
        row.Contract_MRR__c,
        row.Exchange_Rate__c
      );
    }

    List<Decimal> totals = new List<Decimal>();
    for (Date day : days) {
      totals.add(0);
    }
    Id subscriptionId;
    List<Decimal> latest;
    for (Revenue_Event__c entry : [
      SELECT Subscription__c, Occurred_On__c, Number_Value__c
      FROM Revenue_Event__c
      WHERE
        Subscription__c != NULL
        AND Kind__c = :RevquilaSubscriptionController.KIND_MRR
        AND Number_Value__c != NULL
      WITH USER_MODE
      ORDER BY Subscription__c, Occurred_On__c
      LIMIT 20000
    ]) {
      if (entry.Subscription__c != subscriptionId) {
        add(totals, latest);
        subscriptionId = entry.Subscription__c;
        latest = new List<Decimal>();
        for (Date day : days) {
          latest.add(0);
        }
      }
      // this entry is the subscription's MRR on every day from when it happened
      Date happened = entry.Occurred_On__c.date();
      for (Integer index = 0; index < days.size(); index++) {
        if (happened <= days[index]) {
          latest[index] = entry.Number_Value__c;
        }
      }
    }
    add(totals, latest);

    for (Integer index = 0; index < days.size(); index++) {
      Point point = new Point();
      point.day = days[index];
      // today's point is the live figure, so the chart ends on the number in the tile
      point.value = index == days.size() - 1 ? dashboard.mrr : totals[index];
      dashboard.mrrSeries.add(point);
    }
  }

  private static void add(List<Decimal> totals, List<Decimal> values) {
    if (values == null) {
      return;
    }
    for (Integer index = 0; index < totals.size(); index++) {
      totals[index] += values[index];
    }
  }

  private static void addCollected(Dashboard dashboard, List<Date> days) {
    Date today = Date.today();
    Date since = today.addDays(-COLLECTED_DAYS);
    Map<String, Decimal> byMonth = new Map<String, Decimal>();
    Date firstMonth = days[0].toStartOfMonth();
    // in the home currency: a payment made before currencies were kept is in it already
    for (Payment__c row : [
      SELECT Amount__c, Base_Amount__c, Paid_On__c
      FROM Payment__c
      WHERE Paid_On__c >= :firstMonth AND Paid_On__c <= :today
      WITH USER_MODE
      LIMIT 10000
    ]) {
      Decimal amount = row.Base_Amount__c == null
        ? RevquilaCore.orZero(row.Amount__c)
        : row.Base_Amount__c;
      if (row.Paid_On__c > since) {
        dashboard.collected += amount;
        dashboard.collectedCount++;
      }
      String month = row.Paid_On__c.year() + '-' + row.Paid_On__c.month();
      byMonth.put(month, RevquilaCore.orZero(byMonth.get(month)) + amount);
    }
    for (Date day : days) {
      Point point = new Point();
      point.day = day;
      point.value = RevquilaCore.orZero(
        byMonth.get(day.year() + '-' + day.month())
      );
      dashboard.collectedSeries.add(point);
    }
  }

  private static void addInvoices(Dashboard dashboard) {
    // The balance is a formula, so what is overdue is added up from the fields behind it
    for (Invoice__c row : [
      SELECT Balance__c, Exchange_Rate__c
      FROM Invoice__c
      WHERE Sent_On__c != NULL AND Balance__c > 0 AND Due_On__c < TODAY
      WITH USER_MODE
      LIMIT 5000
    ]) {
      dashboard.overdueCount++;
      dashboard.overdue += RevquilaCore.toBase(
        row.Balance__c,
        row.Exchange_Rate__c
      );
    }
    dashboard.invoicesOpen = [
      SELECT COUNT()
      FROM Invoice__c
      WHERE Sent_On__c != NULL AND Balance__c > 0
      WITH USER_MODE
    ];
    dashboard.invoicesPaid = [
      SELECT COUNT()
      FROM Invoice__c
      WHERE Sent_On__c != NULL AND Balance__c <= 0
      WITH USER_MODE
    ];
  }
}