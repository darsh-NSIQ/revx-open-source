/**
 * The Billing tab: what is due to be invoiced, the billing run, the dunning queue, accounts
 * receivable by age, unbilled usage, and the schedule rows themselves (skip or move one).
 */
public with sharing class RevquilaBillingController {
  public class DunningRow {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String invoiceNumber;
    @AuraEnabled
    public String account;
    @AuraEnabled
    public Decimal balance;
    @AuraEnabled
    public Decimal baseBalance;
    @AuraEnabled
    public String currencyCode;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public Date dueOn;
    @AuraEnabled
    public Integer daysOverdue;
    @AuraEnabled
    public Integer stage;
    @AuraEnabled
    public String nextStep;
    @AuraEnabled
    public Boolean paused;
  }

  public class ScheduleRow {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String account;
    @AuraEnabled
    public Id orderId;
    @AuraEnabled
    public String orderNumber;
    @AuraEnabled
    public Id subscriptionId;
    @AuraEnabled
    public String subscriptionNumber;
    @AuraEnabled
    public Date billDate;
    @AuraEnabled
    public Date periodStart;
    @AuraEnabled
    public Date periodEnd;
    @AuraEnabled
    public Decimal amount;
    @AuraEnabled
    public Decimal baseAmount;
    @AuraEnabled
    public String currencyCode;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public String description;
    @AuraEnabled
    public String kind;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public Id invoiceId;
    @AuraEnabled
    public String invoiceNumber;
  }

  public class Overview {
    @AuraEnabled
    public Integer dueCount = 0;
    @AuraEnabled
    public Decimal dueAmount = 0;
    @AuraEnabled
    public Decimal next30 = 0;
    @AuraEnabled
    public Decimal next90 = 0;
    @AuraEnabled
    public Decimal receivable = 0;
    @AuraEnabled
    public Decimal overdue = 0;
    @AuraEnabled
    public Integer unbilledUsage = 0;
    @AuraEnabled
    public Map<String, Decimal> aging = new Map<String, Decimal>();
    @AuraEnabled
    public List<ScheduleRow> schedules = new List<ScheduleRow>();
    @AuraEnabled
    public List<DunningRow> dunning = new List<DunningRow>();
    @AuraEnabled
    public List<String> lastRuns = new List<String>();
    @AuraEnabled
    public Boolean canRun = false;
    @AuraEnabled
    public Boolean jobsScheduled = false;
  }

  @AuraEnabled
  public static Overview getOverview() {
    try {
      Overview view = new Overview();
      Date today = Date.today();
      Date in30 = today.addDays(30);
      Date in90 = today.addDays(90);
      for (Billing_Schedule__c row : [
        SELECT Id, Name, Account__r.Name, Order__c, Order__r.Name, Order__r.Display_Number__c, Subscription__c,
          Subscription__r.Name, Subscription__r.Display_Number__c, Bill_Date__c, Period_Start__c, Period_End__c, Amount__c,
          Currency_Code__c, Country__c, Exchange_Rate__c, Description__c, Kind__c, Status__c, Invoice__c, Invoice__r.Number__c
        FROM Billing_Schedule__c
        WHERE (Status__c = 'planned' AND Bill_Date__c <= :in90) OR (Status__c = 'invoiced' AND Bill_Date__c >= :today.addDays(-30))
        WITH USER_MODE
        ORDER BY Bill_Date__c, Name
        LIMIT 500
      ]) {
        ScheduleRow schedule = new ScheduleRow();
        schedule.id = row.Id;
        schedule.name = row.Name;
        schedule.account = row.Account__r?.Name;
        schedule.orderId = row.Order__c;
        schedule.orderNumber = row.Order__r == null ? null : (String.isNotBlank(row.Order__r.Display_Number__c) ? row.Order__r.Display_Number__c : row.Order__r.Name);
        schedule.subscriptionId = row.Subscription__c;
        schedule.subscriptionNumber = row.Subscription__r == null ? null : (String.isNotBlank(row.Subscription__r.Display_Number__c) ? row.Subscription__r.Display_Number__c : row.Subscription__r.Name);
        schedule.billDate = row.Bill_Date__c;
        schedule.periodStart = row.Period_Start__c;
        schedule.periodEnd = row.Period_End__c;
        schedule.amount = RevquilaCore.orZero(row.Amount__c);
        schedule.baseAmount = RevquilaCore.toBase(row.Amount__c, row.Exchange_Rate__c);
        schedule.currencyCode = row.Currency_Code__c;
        schedule.country = row.Country__c;
        schedule.description = row.Description__c;
        schedule.kind = row.Kind__c;
        schedule.status = row.Status__c;
        schedule.invoiceId = row.Invoice__c;
        schedule.invoiceNumber = row.Invoice__r?.Number__c;
        view.schedules.add(schedule);
        if (row.Status__c == 'planned') {
          if (row.Bill_Date__c <= today) {
            view.dueCount++;
            view.dueAmount += schedule.baseAmount;
          }
          if (row.Bill_Date__c <= in30) {
            view.next30 += schedule.baseAmount;
          }
          view.next90 += schedule.baseAmount;
        }
      }
      for (String bucket : new List<String>{ 'current', '1-30', '31-60', '61-90', '90+' }) {
        view.aging.put(bucket, 0);
      }
      List<RevquilaSettings.DunningStep> steps = RevquilaSettings.current().dunning;
      for (Invoice__c row : [
        SELECT Id, Number__c, Account__r.Name, Account__r.Dunning_Paused__c, Balance__c, Exchange_Rate__c,
          Currency_Code__c, Country__c, Due_On__c, Dunning_Stage__c
        FROM Invoice__c
        WHERE Sent_On__c != NULL AND Balance__c > 0 AND Written_Off__c = FALSE
        WITH USER_MODE
        ORDER BY Due_On__c
        LIMIT 2000
      ]) {
        Decimal base = RevquilaCore.toBase(row.Balance__c, row.Exchange_Rate__c);
        view.receivable += base;
        Integer late = row.Due_On__c == null ? 0 : row.Due_On__c.daysBetween(today);
        String bucket = late <= 0 ? 'current' : late <= 30 ? '1-30' : late <= 60 ? '31-60' : late <= 90 ? '61-90' : '90+';
        view.aging.put(bucket, view.aging.get(bucket) + base);
        if (late > 0) {
          view.overdue += base;
          if (view.dunning.size() < 200) {
            DunningRow dun = new DunningRow();
            dun.id = row.Id;
            dun.invoiceNumber = row.Number__c;
            dun.account = row.Account__r?.Name;
            dun.balance = row.Balance__c;
            dun.baseBalance = base;
            dun.currencyCode = row.Currency_Code__c;
            dun.country = row.Country__c;
            dun.dueOn = row.Due_On__c;
            dun.daysOverdue = late;
            dun.stage = row.Dunning_Stage__c == null ? 0 : row.Dunning_Stage__c.intValue();
            dun.paused = row.Account__r?.Dunning_Paused__c == true;
            if (dun.stage < steps.size()) {
              RevquilaSettings.DunningStep step = steps[dun.stage];
              dun.nextStep = (step.action == null ? 'email' : step.action) + ' on day ' + step.days;
            } else {
              dun.nextStep = steps.isEmpty() ? 'No dunning steps in Setup' : 'Every step has run';
            }
            view.dunning.add(dun);
          }
        }
      }
      view.unbilledUsage = [SELECT COUNT() FROM Usage_Record__c WHERE Billed__c = FALSE WITH USER_MODE];
      for (Integration_Log__c row : [
        SELECT Target__c, Status__c, Response__c, Occurred_On__c
        FROM Integration_Log__c
        WHERE Kind__c IN ('job', 'billing')
        WITH USER_MODE
        ORDER BY Occurred_On__c DESC
        LIMIT 8
      ]) {
        view.lastRuns.add(row.Occurred_On__c.format('d MMM HH:mm') + ' · ' + row.Target__c + ': ' + String.valueOf(row.Response__c).abbreviate(120));
      }
      view.canRun = RevquilaCore.allowed('billing');
      view.jobsScheduled = RevquilaJobs.status().scheduled;
      return view;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Raises every invoice due on or before the day. Returns what it did, in words. */
  @AuraEnabled
  public static String runBilling(Date asOf) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('billing'), 'You need Revquila Finance to run billing.');
      Integer raised = RevquilaBilling.run(asOf == null ? Date.today() : asOf);
      RevquilaCore.log('billing', 'run by ' + UserInfo.getName(), 'ok', null, raised + ' invoices raised', null);
      return raised == 1 ? '1 invoice raised' : raised + ' invoices raised';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  @AuraEnabled
  public static String runDunning() {
    try {
      RevquilaCore.need(RevquilaCore.allowed('billing'), 'You need Revquila Finance to run dunning.');
      Integer ran = RevquilaBilling.dun(Date.today());
      RevquilaCore.log('billing', 'dunning by ' + UserInfo.getName(), 'ok', null, ran + ' steps', null);
      return ran == 1 ? '1 dunning step ran' : ran + ' dunning steps ran';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Leaves a planned invoice out, or moves it to another day. */
  @AuraEnabled
  public static void changeSchedule(Id scheduleId, String action, Date billDate) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('billing'), 'You need Revquila Finance to change the billing schedule.');
      Billing_Schedule__c row = [
        SELECT Id, Status__c, Description__c, Order__c, Subscription__c
        FROM Billing_Schedule__c
        WHERE Id = :scheduleId
        WITH USER_MODE
      ];
      RevquilaCore.need(row.Status__c == RevquilaBilling.PLANNED, 'Only a planned invoice can be changed.');
      Id parent = row.Subscription__c != null ? row.Subscription__c : row.Order__c;
      if (action == 'skip') {
        update as user new Billing_Schedule__c(Id = scheduleId, Status__c = RevquilaBilling.SKIPPED);
        insert as user RevquilaCore.event(parent, 'Planned invoice skipped', row.Description__c, RevquilaCore.TONE_WARN);
      } else {
        RevquilaCore.need(billDate != null, 'Pick the new bill date.');
        update as user new Billing_Schedule__c(Id = scheduleId, Bill_Date__c = billDate);
        insert as user RevquilaCore.event(parent, 'Planned invoice moved', row.Description__c + ' · now ' + RevquilaCore.dayText(billDate), RevquilaCore.TONE_ACCENT);
      }
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}