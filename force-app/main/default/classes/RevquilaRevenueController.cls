/** The Revenue tab: deferred revenue, the waterfall, recognising, and the journal export. */
public with sharing class RevquilaRevenueController {
  @AuraEnabled
  public static RevquilaRevenue.Overview getRevenue() {
    try {
      return RevquilaRevenue.overview();
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Recognises every period that has ended by today. */
  @AuraEnabled
  public static String recognizeNow() {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to recognise revenue.');
      Integer count = RevquilaRevenue.recognize(Date.today());
      return count == 1 ? '1 period recognised' : count + ' periods recognised';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Recognises the whole of one schedule: a milestone that was reached. */
  @AuraEnabled
  public static void recognizeSchedule(Id scheduleId) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to recognise revenue.');
      RevquilaRevenue.recognizeSchedule(scheduleId);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** The journal of what was recognised between the days, as CSV. */
  @AuraEnabled
  public static String exportJournal(Date fromDay, Date toDay, Boolean markExported) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to export the journal.');
      RevquilaCore.need(fromDay != null && toDay != null && fromDay <= toDay, 'Pick the days to export.');
      return RevquilaRevenue.journal(fromDay, toDay, markExported);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Builds revenue schedules for invoices raised before revenue recognition was on. */
  @AuraEnabled
  public static String backfill() {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to build revenue schedules.');
      Set<Id> done = new Set<Id>();
      for (Revenue_Schedule__c row : [SELECT Invoice__c FROM Revenue_Schedule__c WHERE Invoice__c != NULL WITH USER_MODE LIMIT 10000]) {
        done.add(row.Invoice__c);
      }
      Integer built = 0;
      for (Invoice__c invoice : [SELECT Id FROM Invoice__c WHERE Sent_On__c != NULL AND Id NOT IN :done WITH USER_MODE ORDER BY Issued_On__c LIMIT 50]) {
        RevquilaRevenue.scheduleFor(invoice.Id);
        built++;
      }
      return built == 1 ? 'Schedules built for 1 invoice' : 'Schedules built for ' + built + ' invoices';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Lists accounting period locks and their current status. */
  @AuraEnabled
  public static List<RevquilaRevenueDepthService.PeriodLockView> getPeriodLocks() {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to view accounting period locks.');
      return RevquilaRevenueDepthService.getPeriodLocks();
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Locks an accounting period to prevent modifications. */
  @AuraEnabled
  public static String lockAccountingPeriod(Date startDate, Date endDate, String notes) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to lock accounting periods.');
      Revenue_Period_Lock__c lockRec = RevquilaRevenueDepthService.lockPeriod(startDate, endDate, notes);
      return 'Accounting period ' + lockRec.Name + ' locked successfully.';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Reopens a locked accounting period with justification. */
  @AuraEnabled
  public static String reopenAccountingPeriod(Id periodLockId, String reason) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to reopen accounting periods.');
      Revenue_Period_Lock__c lockRec = RevquilaRevenueDepthService.reopenPeriod(periodLockId, reason);
      return 'Accounting period ' + lockRec.Name + ' reopened.';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Deferred Revenue Rollforward statement. */
  @AuraEnabled
  public static RevquilaRevenueDepthService.RollforwardReport getRollforwardReport(Date fromDate, Date toDate) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to view revenue reports.');
      if (fromDate == null) fromDate = Date.today().toStartOfMonth().addMonths(-6);
      if (toDate == null) toDate = Date.today();
      return RevquilaRevenueDepthService.getRollforwardReport(fromDate, toDate);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Billings vs Recognized Revenue comparison. */
  @AuraEnabled
  public static List<RevquilaRevenueDepthService.BillingVsRevenueMonth> getBillingsVsRevenue(Date fromDate, Date toDate) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to view revenue reports.');
      if (fromDate == null) fromDate = Date.today().toStartOfMonth().addMonths(-6);
      if (toDate == null) toDate = Date.today();
      return RevquilaRevenueDepthService.getBillingsVsRevenue(fromDate, toDate);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Revenue breakdown grouped by product and POB type. */
  @AuraEnabled
  public static List<RevquilaRevenueDepthService.ProductRevenueSummary> getRevenueByProduct(Date fromDate, Date toDate) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to view revenue reports.');
      if (fromDate == null) fromDate = Date.today().toStartOfMonth().addMonths(-6);
      if (toDate == null) toDate = Date.today();
      return RevquilaRevenueDepthService.getRevenueByProduct(fromDate, toDate);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Exports accounting synchronization payloads for Tally, QuickBooks, Zoho, or CSV. */
  @AuraEnabled
  public static String exportAccountingSync(String format, Date fromDate, Date toDate) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to export accounting sync data.');
      if (fromDate == null) fromDate = Date.today().toStartOfMonth();
      if (toDate == null) toDate = Date.today();
      if (format == 'tally') {
        return RevquilaRevenueDepthService.generateTallyXml(fromDate, toDate);
      } else if (format == 'quickbooks') {
        return RevquilaRevenueDepthService.generateQuickBooksJson(fromDate, toDate);
      } else if (format == 'zoho') {
        return RevquilaRevenueDepthService.generateZohoBooksJson(fromDate, toDate);
      } else {
        return RevquilaRevenue.journal(fromDate, toDate, false);
      }
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Computes unbilled revenue (ASC 606 Contract Asset) for subscription. */
  @AuraEnabled
  public static Decimal getUnbilledRevenue(Id subscriptionId) {
    try {
      return RevquilaRevenueDepthService.calculateUnbilledRevenue(subscriptionId);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Accrues unbilled usage into earned contract asset revenue. */
  @AuraEnabled
  public static String accrueUnbilledRevenue(Id subscriptionId, Date accrualDate) {
    try {
      RevquilaCore.need(RevquilaCore.allowed('revenue'), 'You need Revquila Finance to accrue unbilled revenue.');
      if (accrualDate == null) accrualDate = Date.today();
      RevquilaRevenueDepthService.accrueUnbilledRevenue(subscriptionId, accrualDate);
      return 'Unbilled usage successfully accrued as contract asset.';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}