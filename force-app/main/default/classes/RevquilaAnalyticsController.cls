/**
 * The Analytics tab: bookings, billings and collections by month, the MRR waterfall (new,
 * expansion, contraction, churn), ARR, net and gross revenue retention, AR aging and DSO, the
 * quote-to-cash funnel, the renewal and pipeline forecast, top accounts and products. Every
 * amount is in the home currency.
 */
public with sharing class RevquilaAnalyticsController {
  public class Month {
    @AuraEnabled
    public Date month;
    @AuraEnabled
    public Decimal bookings = 0;
    @AuraEnabled
    public Decimal billings = 0;
    @AuraEnabled
    public Decimal collections = 0;
    @AuraEnabled
    public Decimal newMrr = 0;
    @AuraEnabled
    public Decimal expansion = 0;
    @AuraEnabled
    public Decimal contraction = 0;
    @AuraEnabled
    public Decimal churn = 0;
    @AuraEnabled
    public Decimal endMrr = 0;
  }

  public class Ranked {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Decimal value;
    @AuraEnabled
    public Id id;
  }

  public class Analytics {
    @AuraEnabled
    public List<Month> months = new List<Month>();
    @AuraEnabled
    public Decimal mrr = 0;
    @AuraEnabled
    public Decimal arr = 0;
    @AuraEnabled
    public Decimal nrr;
    @AuraEnabled
    public Decimal grr;
    @AuraEnabled
    public Decimal dso;
    @AuraEnabled
    public Decimal receivable = 0;
    @AuraEnabled
    public Map<String, Decimal> aging = new Map<String, Decimal>();
    @AuraEnabled
    public Map<String, Integer> funnel = new Map<String, Integer>();
    @AuraEnabled
    public Decimal winRate;
    @AuraEnabled
    public Decimal averageDeal = 0;
    @AuraEnabled
    public Decimal renewalsDue90 = 0;
    @AuraEnabled
    public Integer renewalsCount90 = 0;
    @AuraEnabled
    public Decimal pipeline = 0;
    @AuraEnabled
    public Decimal weightedPipeline = 0;
    @AuraEnabled
    public Decimal deferred = 0;
    @AuraEnabled
    public List<Ranked> topAccounts = new List<Ranked>();
    @AuraEnabled
    public List<Ranked> topProducts = new List<Ranked>();
    @AuraEnabled
    public Integer activeSubscriptions = 0;
    @AuraEnabled
    public Integer churnedLast12 = 0;
  }

  private static final Map<String, Decimal> STAGE_WEIGHTS = new Map<String, Decimal>{
    'draft' => 0.1,
    'approval' => 0.3,
    'approved' => 0.5,
    'rejected' => 0.05,
    'sent' => 0.6
  };

  @AuraEnabled
  public static Analytics getAnalytics() {
    try {
      Analytics view = new Analytics();
      Date today = Date.today();
      Date first = today.toStartOfMonth().addMonths(-11);
      Map<String, Month> byMonth = new Map<String, Month>();
      for (Integer index = 0; index < 12; index++) {
        Month month = new Month();
        month.month = first.addMonths(index);
        byMonth.put(String.valueOf(month.month), month);
        view.months.add(month);
      }

      // bookings: orders by order date
      Map<Id, Decimal> productBookings = new Map<Id, Decimal>();
      Map<Id, String> productNames = new Map<Id, String>();
      for (Order__c row : [
        SELECT Order_Date__c, Base_Net_Amount__c, Net_Amount__c, Exchange_Rate__c
        FROM Order__c
        WHERE Order_Date__c >= :first AND Status__c != 'cancelled'
        WITH USER_MODE
        LIMIT 10000
      ]) {
        Month month = byMonth.get(String.valueOf(row.Order_Date__c.toStartOfMonth()));
        if (month != null) {
          month.bookings += row.Base_Net_Amount__c != null ? row.Base_Net_Amount__c : RevquilaCore.toBase(row.Net_Amount__c, row.Exchange_Rate__c);
        }
      }
      for (Order_Line__c row : [
        SELECT Product__c, Product__r.Name, Net_Amount__c, Order__r.Exchange_Rate__c
        FROM Order_Line__c
        WHERE Order__r.Order_Date__c >= :first AND Order__r.Status__c != 'cancelled' AND Product__c != NULL
        WITH USER_MODE
        LIMIT 20000
      ]) {
        productBookings.put(row.Product__c, RevquilaCore.orZero(productBookings.get(row.Product__c)) + RevquilaCore.toBase(row.Net_Amount__c, row.Order__r.Exchange_Rate__c));
        productNames.put(row.Product__c, row.Product__r.Name);
      }
      // billings: invoices by issue date
      Decimal billed90 = 0;
      for (Invoice__c row : [
        SELECT Issued_On__c, Base_Net_Amount__c, Total__c, Exchange_Rate__c
        FROM Invoice__c
        WHERE Issued_On__c >= :first AND Sent_On__c != NULL
        WITH USER_MODE
        LIMIT 10000
      ]) {
        Month month = byMonth.get(String.valueOf(row.Issued_On__c.toStartOfMonth()));
        Decimal base = RevquilaCore.toBase(row.Total__c, row.Exchange_Rate__c);
        if (month != null) {
          month.billings += base;
        }
        if (row.Issued_On__c > today.addDays(-90)) {
          billed90 += base;
        }
      }
      // collections: payments by day paid
      for (Payment__c row : [
        SELECT Paid_On__c, Amount__c, Base_Amount__c
        FROM Payment__c
        WHERE Paid_On__c >= :first
        WITH USER_MODE
        LIMIT 10000
      ]) {
        Month month = byMonth.get(String.valueOf(row.Paid_On__c.toStartOfMonth()));
        if (month != null) {
          month.collections += row.Base_Amount__c != null ? row.Base_Amount__c : RevquilaCore.orZero(row.Amount__c);
        }
      }

      // the MRR waterfall, rebuilt from every subscription's MRR events in order
      Map<Id, Decimal> mrrThen = new Map<Id, Decimal>();
      Map<Id, Decimal> mrrNow = new Map<Id, Decimal>();
      Date yearAgo = today.addMonths(-12);
      Id current;
      Decimal previous = 0;
      for (Revenue_Event__c row : [
        SELECT Subscription__c, Occurred_On__c, Number_Value__c
        FROM Revenue_Event__c
        WHERE Subscription__c != NULL AND Kind__c = 'mrr' AND Number_Value__c != NULL
        WITH USER_MODE
        ORDER BY Subscription__c, Occurred_On__c, Name
        LIMIT 40000
      ]) {
        if (row.Subscription__c != current) {
          current = row.Subscription__c;
          previous = 0;
        }
        Decimal after = RevquilaCore.orZero(row.Number_Value__c);
        Decimal delta = after - previous;
        Date day = row.Occurred_On__c.date();
        if (day <= yearAgo) {
          mrrThen.put(current, after);
        }
        mrrNow.put(current, after);
        Month month = byMonth.get(String.valueOf(day.toStartOfMonth()));
        if (month != null && delta != 0) {
          if (previous == 0) {
            month.newMrr += after;
          } else if (after == 0) {
            month.churn += previous;
            view.churnedLast12++;
          } else if (delta > 0) {
            month.expansion += delta;
          } else {
            month.contraction += -delta;
          }
        }
        previous = after;
      }
      // the MRR at the end of each month: start from today's and walk the movements back
      for (Subscription__c row : [
        SELECT Contract_MRR__c, Exchange_Rate__c, Account__c, Account__r.Name
        FROM Subscription__c
        WHERE Status__c = 'active'
        WITH USER_MODE
        LIMIT 10000
      ]) {
        view.mrr += RevquilaCore.toBase(row.Contract_MRR__c, row.Exchange_Rate__c);
        view.activeSubscriptions++;
      }
      view.arr = RevquilaCore.money(view.mrr * 12);
      Decimal running = view.mrr;
      for (Integer index = view.months.size() - 1; index >= 0; index--) {
        Month month = view.months[index];
        month.endMrr = RevquilaCore.money(running);
        running = running - month.newMrr - month.expansion + month.contraction + month.churn;
      }
      Decimal startTotal = 0;
      Decimal nowTotal = 0;
      Decimal kept = 0;
      for (Id subscriptionId : mrrThen.keySet()) {
        Decimal before = mrrThen.get(subscriptionId);
        if (before <= 0) {
          continue;
        }
        Decimal after = RevquilaCore.orZero(mrrNow.get(subscriptionId));
        startTotal += before;
        nowTotal += after;
        kept += Math.min(before, after);
      }
      if (startTotal > 0) {
        view.nrr = (nowTotal / startTotal * 100).setScale(1, RoundingMode.HALF_UP);
        view.grr = (kept / startTotal * 100).setScale(1, RoundingMode.HALF_UP);
      }

      // receivables and DSO
      for (String bucket : new List<String>{ 'current', '1-30', '31-60', '61-90', '90+' }) {
        view.aging.put(bucket, 0);
      }
      for (Invoice__c row : [
        SELECT Balance__c, Exchange_Rate__c, Due_On__c
        FROM Invoice__c
        WHERE Sent_On__c != NULL AND Balance__c > 0 AND Written_Off__c = FALSE
        WITH USER_MODE
        LIMIT 10000
      ]) {
        Decimal base = RevquilaCore.toBase(row.Balance__c, row.Exchange_Rate__c);
        view.receivable += base;
        Integer late = row.Due_On__c == null ? 0 : row.Due_On__c.daysBetween(today);
        String bucket = late <= 0 ? 'current' : late <= 30 ? '1-30' : late <= 60 ? '31-60' : late <= 90 ? '61-90' : '90+';
        view.aging.put(bucket, view.aging.get(bucket) + base);
      }
      if (billed90 > 0) {
        view.dso = (view.receivable / billed90 * 90).setScale(0, RoundingMode.HALF_UP);
      }

      // the funnel over twelve months, and the pipeline still open
      Integer created = 0;
      Integer sent = 0;
      Integer signed = 0;
      Integer invoiced = 0;
      Integer paid = 0;
      Integer lost = 0;
      Decimal won = 0;
      for (Quote__c row : [
        SELECT Status__c, Base_Net_Amount__c, Net_Amount__c, Exchange_Rate__c, Sent_On__c, Signed_On__c
        FROM Quote__c
        WHERE Quote_Date__c >= :first
        WITH USER_MODE
        LIMIT 10000
      ]) {
        created++;
        String status = row.Status__c;
        Decimal base = row.Base_Net_Amount__c != null ? row.Base_Net_Amount__c : RevquilaCore.toBase(row.Net_Amount__c, row.Exchange_Rate__c);
        if (row.Sent_On__c != null || status == 'sent' || status == 'signed' || status == 'invoiced' || status == 'paid') {
          sent++;
        }
        if (status == 'signed' || status == 'invoiced' || status == 'paid') {
          signed++;
          won += base;
        }
        if (status == 'invoiced' || status == 'paid') {
          invoiced++;
        }
        if (status == 'paid') {
          paid++;
        }
        if (status == 'expired' || status == 'rejected') {
          lost++;
        }
        if (STAGE_WEIGHTS.containsKey(status)) {
          view.pipeline += base;
          view.weightedPipeline += base * STAGE_WEIGHTS.get(status);
        }
      }
      view.funnel.put('created', created);
      view.funnel.put('sent', sent);
      view.funnel.put('signed', signed);
      view.funnel.put('invoiced', invoiced);
      view.funnel.put('paid', paid);
      view.funnel.put('lost', lost);
      if (signed + lost > 0) {
        view.winRate = (Decimal.valueOf(signed) / (signed + lost) * 100).setScale(1, RoundingMode.HALF_UP);
      }
      if (signed > 0) {
        view.averageDeal = RevquilaCore.money(won / signed);
      }
      view.pipeline = RevquilaCore.money(view.pipeline);
      view.weightedPipeline = RevquilaCore.money(view.weightedPipeline);

      // renewals due in 90 days, and the top accounts by ARR
      Map<Id, Decimal> accountArr = new Map<Id, Decimal>();
      Map<Id, String> accountNames = new Map<Id, String>();
      for (Subscription__c row : [
        SELECT Account__c, Account__r.Name, Contract_MRR__c, Exchange_Rate__c, Renewal_Date__c
        FROM Subscription__c
        WHERE Status__c = 'active'
        WITH USER_MODE
        LIMIT 10000
      ]) {
        Decimal arr = RevquilaCore.toBase(row.Contract_MRR__c, row.Exchange_Rate__c) * 12;
        accountArr.put(row.Account__c, RevquilaCore.orZero(accountArr.get(row.Account__c)) + arr);
        accountNames.put(row.Account__c, row.Account__r?.Name);
        if (row.Renewal_Date__c != null && row.Renewal_Date__c <= today.addDays(90)) {
          view.renewalsDue90 += arr;
          view.renewalsCount90++;
        }
      }
      view.topAccounts = top(accountArr, accountNames, 8);
      view.topProducts = top(productBookings, productNames, 8);
      for (AggregateResult row : [
        SELECT SUM(Amount__c) deferred
        FROM Revenue_Schedule_Line__c
        WHERE Recognized__c = FALSE
        WITH USER_MODE
      ]) {
        view.deferred = RevquilaCore.orZero((Decimal) row.get('deferred'));
      }
      for (Month month : view.months) {
        month.bookings = RevquilaCore.money(month.bookings);
        month.billings = RevquilaCore.money(month.billings);
        month.collections = RevquilaCore.money(month.collections);
        month.newMrr = RevquilaCore.money(month.newMrr);
        month.expansion = RevquilaCore.money(month.expansion);
        month.contraction = RevquilaCore.money(month.contraction);
        month.churn = RevquilaCore.money(month.churn);
      }
      view.mrr = RevquilaCore.money(view.mrr);
      view.receivable = RevquilaCore.money(view.receivable);
      view.renewalsDue90 = RevquilaCore.money(view.renewalsDue90);
      return view;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static List<Ranked> top(Map<Id, Decimal> values, Map<Id, String> names, Integer count) {
    List<Ranked> ranked = new List<Ranked>();
    List<Id> ids = new List<Id>(values.keySet());
    while (!ids.isEmpty() && ranked.size() < count) {
      Integer best = 0;
      for (Integer index = 1; index < ids.size(); index++) {
        if (values.get(ids[index]) > values.get(ids[best])) {
          best = index;
        }
      }
      Ranked row = new Ranked();
      row.id = ids[best];
      row.name = names.get(ids[best]);
      row.value = RevquilaCore.money(values.get(ids[best]));
      ranked.add(row);
      ids.remove(best);
    }
    return ranked;
  }
}