/**
 * Revenue recognition (ASC 606 / IFRS 15, simplified): every invoiced line becomes a revenue
 * schedule for its performance obligation. A ratable line is spread over its service period
 * month by month, by days; a point-in-time line is recognised on its invoice date; a milestone
 * line waits until someone recognises it. The daily job recognises every period that has
 * ended. Amounts are in the home currency, so the waterfall and the journal add up.
 */
public with sharing class RevquilaRevenue {
  public class MonthTotal {
    @AuraEnabled
    public Date month;
    @AuraEnabled
    public Decimal recognized = 0;
    @AuraEnabled
    public Decimal scheduled = 0;
  }

  public class ScheduleView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String account;
    @AuraEnabled
    public String description;
    @AuraEnabled
    public String method;
    @AuraEnabled
    public String pobType;
    @AuraEnabled
    public Decimal sspPrice;
    @AuraEnabled
    public Decimal allocatedAmount;
    @AuraEnabled
    public Decimal contractAssetBalance;
    @AuraEnabled
    public Date startDate;
    @AuraEnabled
    public Date endDate;
    @AuraEnabled
    public Decimal total;
    @AuraEnabled
    public Decimal recognized;
    @AuraEnabled
    public Decimal deferred;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public Id invoiceId;
    @AuraEnabled
    public String invoiceNumber;
  }

  public class Overview {
    @AuraEnabled
    public Decimal deferred = 0;
    @AuraEnabled
    public Decimal recognizedThisMonth = 0;
    @AuraEnabled
    public Decimal recognizedThisYear = 0;
    @AuraEnabled
    public Decimal pendingMilestones = 0;
    @AuraEnabled
    public Decimal unbilledContractAsset = 0;
    /** Twelve months: the six behind and the six ahead. */
    @AuraEnabled
    public List<MonthTotal> waterfall = new List<MonthTotal>();
    @AuraEnabled
    public List<ScheduleView> schedules = new List<ScheduleView>();
    @AuraEnabled
    public Boolean canRecognize = false;
  }

  /** Builds the revenue schedules of an invoice's lines using Standalone Selling Price (SSP) allocation. An invoice that has them already is left alone. */
  public static void scheduleFor(Id invoiceId) {
    if ([SELECT COUNT() FROM Revenue_Schedule__c WHERE Invoice__c = :invoiceId WITH USER_MODE] > 0) {
      return;
    }
    RevquilaRevenueDepthService.allocateSSPForInvoice(invoiceId);
  }

  // The periods of a schedule: one per calendar month for ratable, one for the rest
  private static List<Revenue_Schedule_Line__c> split(String method, Date start, Date finish, Decimal amount) {
    List<Revenue_Schedule_Line__c> rows = new List<Revenue_Schedule_Line__c>();
    if (method != 'ratable') {
      rows.add(new Revenue_Schedule_Line__c(Period_Start__c = start, Period_End__c = method == 'milestone' ? finish : start, Amount__c = amount));
      return rows;
    }
    Integer totalDays = start.daysBetween(finish) + 1;
    Decimal given = 0;
    Date cursor = start;
    while (cursor <= finish) {
      Date monthEnd = cursor.toStartOfMonth().addMonths(1).addDays(-1);
      Date periodEnd = monthEnd < finish ? monthEnd : finish;
      Decimal share;
      if (periodEnd == finish) {
        share = RevquilaCore.money(amount - given);
      } else {
        share = RevquilaCore.money(amount * (cursor.daysBetween(periodEnd) + 1) / totalDays);
      }
      given += share;
      rows.add(new Revenue_Schedule_Line__c(Period_Start__c = cursor, Period_End__c = periodEnd, Amount__c = share));
      cursor = periodEnd.addDays(1);
    }
    return rows;
  }

  /** Recognises every ratable and point-in-time period that has ended by `asOf`. Returns how many. */
  public static Integer recognize(Date asOf) {
    List<Revenue_Schedule_Line__c> due = [
      SELECT Id, Revenue_Schedule__c
      FROM Revenue_Schedule_Line__c
      WHERE Recognized__c = FALSE AND Period_End__c <= :asOf AND Revenue_Schedule__r.Method__c != 'milestone'
      WITH USER_MODE
      LIMIT 5000
    ];
    Set<Id> schedules = new Set<Id>();
    for (Revenue_Schedule_Line__c row : due) {
      row.Recognized__c = true;
      row.Recognized_On__c = asOf;
      schedules.add(row.Revenue_Schedule__c);
    }
    update as system due;
    closeComplete(schedules);
    return due.size();
  }

  /** Recognises the whole of one schedule now: a milestone that was reached. */
  public static void recognizeSchedule(Id scheduleId) {
    List<Revenue_Schedule_Line__c> open = [
      SELECT Id
      FROM Revenue_Schedule_Line__c
      WHERE Revenue_Schedule__c = :scheduleId AND Recognized__c = FALSE
      WITH SYSTEM_MODE
    ];
    RevquilaCore.need(!open.isEmpty(), 'Everything on this schedule is recognised already.');
    for (Revenue_Schedule_Line__c row : open) {
      row.Recognized__c = true;
      row.Recognized_On__c = Date.today();
    }
    update as system open;
    closeComplete(new Set<Id>{ scheduleId });
  }

  private static void closeComplete(Set<Id> scheduleIds) {
    if (scheduleIds.isEmpty()) {
      return;
    }
    List<Revenue_Schedule__c> complete = new List<Revenue_Schedule__c>();
    for (Revenue_Schedule__c row : [
      SELECT Id, Deferred_Amount__c
      FROM Revenue_Schedule__c
      WHERE Id IN :scheduleIds
      WITH SYSTEM_MODE
    ]) {
      if (RevquilaCore.orZero(row.Deferred_Amount__c) <= 0) {
        complete.add(new Revenue_Schedule__c(Id = row.Id, Status__c = 'complete'));
      }
    }
    update as system complete;
  }

  /** The Revenue tab: deferred balance, this month and year, the waterfall and the open schedules. */
  public static Overview overview() {
    Overview view = new Overview();
    Date today = Date.today();
    Date thisMonth = today.toStartOfMonth();
    Date yearStart = Date.newInstance(today.year(), 1, 1);
    Date from6 = thisMonth.addMonths(-6);
    Date to6 = thisMonth.addMonths(6);
    Map<String, MonthTotal> byMonth = new Map<String, MonthTotal>();
    for (Integer index = -6; index < 6; index++) {
      MonthTotal period = new MonthTotal();
      period.month = thisMonth.addMonths(index);
      byMonth.put(String.valueOf(period.month), period);
      view.waterfall.add(period);
    }
    for (Revenue_Schedule_Line__c row : [
      SELECT Period_Start__c, Amount__c, Recognized__c, Recognized_On__c, Revenue_Schedule__r.Method__c
      FROM Revenue_Schedule_Line__c
      WHERE (Period_Start__c >= :from6 AND Period_Start__c < :to6) OR Recognized__c = FALSE
      WITH USER_MODE
      LIMIT 20000
    ]) {
      Decimal amount = RevquilaCore.orZero(row.Amount__c);
      if (!row.Recognized__c) {
        view.deferred += amount;
        if (row.Revenue_Schedule__r?.Method__c == 'milestone') {
          view.pendingMilestones += amount;
        }
      } else if (row.Recognized_On__c != null) {
        if (row.Recognized_On__c >= thisMonth) {
          view.recognizedThisMonth += amount;
        }
        if (row.Recognized_On__c >= yearStart) {
          view.recognizedThisYear += amount;
        }
      }
      MonthTotal period = byMonth.get(String.valueOf(row.Period_Start__c.toStartOfMonth()));
      if (period != null) {
        period.scheduled += amount;
        if (row.Recognized__c) {
          period.recognized += amount;
        }
      }
    }
    for (Revenue_Schedule__c row : [
      SELECT Id, Name, Account__r.Name, Description__c, Method__c, POB_Type__c, SSP_Price__c,
        Allocated_Amount__c, Contract_Asset_Balance__c, Start_Date__c, End_Date__c, Total__c,
        Recognized_Amount__c, Deferred_Amount__c, Status__c, Invoice__c, Invoice__r.Number__c
      FROM Revenue_Schedule__c
      WITH SYSTEM_MODE
      ORDER BY Status__c DESC, Start_Date__c DESC
      LIMIT 500
    ]) {
      ScheduleView schedule = new ScheduleView();
      schedule.id = row.Id;
      schedule.name = row.Name;
      schedule.account = row.Account__r?.Name;
      schedule.description = row.Description__c;
      schedule.method = row.Method__c;
      schedule.pobType = row.POB_Type__c != null ? row.POB_Type__c : (row.Method__c == 'milestone' ? 'implementation' : 'license');
      schedule.sspPrice = RevquilaCore.orZero(row.SSP_Price__c);
      schedule.allocatedAmount = RevquilaCore.orZero(row.Allocated_Amount__c > 0 ? row.Allocated_Amount__c : row.Total__c);
      schedule.contractAssetBalance = RevquilaCore.orZero(row.Contract_Asset_Balance__c);
      schedule.startDate = row.Start_Date__c;
      schedule.endDate = row.End_Date__c;
      schedule.total = RevquilaCore.orZero(row.Total__c);
      schedule.recognized = RevquilaCore.orZero(row.Recognized_Amount__c);
      schedule.deferred = RevquilaCore.orZero(row.Deferred_Amount__c);
      schedule.status = row.Status__c;
      schedule.invoiceId = row.Invoice__c;
      schedule.invoiceNumber = row.Invoice__r?.Number__c;
      view.schedules.add(schedule);
      view.unbilledContractAsset += schedule.contractAssetBalance;
    }
    view.canRecognize = RevquilaCore.allowed('revenue');
    return view;
  }

  /** The journal of what was recognised between two days, as CSV: debit deferred revenue, credit revenue. */
  public static String journal(Date fromDay, Date toDay, Boolean markExported) {
    List<String> rows = new List<String>{
      'Date,Account,Product,Description,Schedule,Invoice,Debit account,Credit account,Amount,Currency'
    };
    String currencyCode = RevquilaSettings.current().home.currencyCode;
    List<Revenue_Schedule_Line__c> exported = new List<Revenue_Schedule_Line__c>();
    for (Revenue_Schedule_Line__c row : [
      SELECT Id, Recognized_On__c, Amount__c, Revenue_Schedule__r.Name, Revenue_Schedule__r.Account__r.Name,
        Revenue_Schedule__r.Product__r.Name, Revenue_Schedule__r.Description__c, Revenue_Schedule__r.Invoice__r.Number__c
      FROM Revenue_Schedule_Line__c
      WHERE Recognized__c = TRUE AND Recognized_On__c >= :fromDay AND Recognized_On__c <= :toDay
      WITH USER_MODE
      ORDER BY Recognized_On__c
      LIMIT 20000
    ]) {
      rows.add(
        String.join(
          new List<String>{
            String.valueOf(row.Recognized_On__c),
            csv(row.Revenue_Schedule__r.Account__r?.Name),
            csv(row.Revenue_Schedule__r.Product__r?.Name),
            csv(row.Revenue_Schedule__r.Description__c),
            row.Revenue_Schedule__r.Name,
            csv(row.Revenue_Schedule__r.Invoice__r?.Number__c),
            'Deferred revenue',
            'Revenue',
            String.valueOf(RevquilaCore.money(row.Amount__c)),
            currencyCode
          },
          ','
        )
      );
      exported.add(new Revenue_Schedule_Line__c(Id = row.Id, Exported__c = true));
    }
    if (markExported == true) {
      update as system exported;
    }
    return String.join(rows, '\n');
  }

  public static String csv(String value) {
    if (value == null) {
      return '';
    }
    return '"' + value.replace('"', '""') + '"';
  }
}