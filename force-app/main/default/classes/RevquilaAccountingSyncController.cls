/**
 * RevquilaAccountingSyncController
 * AuraEnabled Controller for the RevX Direct Accounting Sync LWC interface.
 * Connects UI to Tally, QuickBooks, Zoho Books connectors, GL Mapping, and Sync Log Retry.
 */
public with sharing class RevquilaAccountingSyncController {

  public class OverviewDto {
    @AuraEnabled public Integer totalSyncs { get; set; }
    @AuraEnabled public Integer successfulSyncs { get; set; }
    @AuraEnabled public Integer failedSyncs { get; set; }
    @AuraEnabled public Decimal successRate { get; set; }
    @AuraEnabled public Integer mappedAccountsCount { get; set; }
    @AuraEnabled public DateTime lastSyncedAt { get; set; }
    @AuraEnabled public String targetSystem { get; set; }
  }

  public class LogViewDto {
    @AuraEnabled public Id id { get; set; }
    @AuraEnabled public String targetSystem { get; set; }
    @AuraEnabled public String entityType { get; set; }
    @AuraEnabled public String recordId { get; set; }
    @AuraEnabled public String recordName { get; set; }
    @AuraEnabled public String status { get; set; }
    @AuraEnabled public String externalId { get; set; }
    @AuraEnabled public String errorMessage { get; set; }
    @AuraEnabled public Decimal retryCount { get; set; }
    @AuraEnabled public DateTime syncedAt { get; set; }
    @AuraEnabled public String requestPayload { get; set; }
    @AuraEnabled public String responsePayload { get; set; }
  }

  @AuraEnabled(cacheable=true)
  public static OverviewDto getOverview(String targetSystem) {
    if (String.isBlank(targetSystem)) targetSystem = RevquilaAccountingSyncService.SYSTEM_TALLY;

    OverviewDto dto = new OverviewDto();
    dto.targetSystem = targetSystem;
    dto.totalSyncs = 0;
    dto.successfulSyncs = 0;
    dto.failedSyncs = 0;
    dto.successRate = 100.0;
    dto.mappedAccountsCount = 0;

    List<AggregateResult> agg = [
      SELECT Status__c status, COUNT(Id) cnt
      FROM Accounting_Sync_Log__c
      WHERE Target_System__c = :targetSystem
      WITH USER_MODE
      GROUP BY Status__c
    ];

    for (AggregateResult ar : agg) {
      String status = (String) ar.get('status');
      Integer cnt = (Integer) ar.get('cnt');
      dto.totalSyncs += cnt;
      if (status == RevquilaAccountingSyncService.STATUS_SUCCESS) {
        dto.successfulSyncs += cnt;
      } else {
        dto.failedSyncs += cnt;
      }
    }

    if (dto.totalSyncs > 0) {
      dto.successRate = ((Decimal) dto.successfulSyncs / (Decimal) dto.totalSyncs * 100.0).setScale(1);
    }

    List<Accounting_Sync_Log__c> lastLog = [
      SELECT Synced_At__c
      FROM Accounting_Sync_Log__c
      WHERE Target_System__c = :targetSystem
      WITH USER_MODE
      ORDER BY Synced_At__c DESC
      LIMIT 1
    ];
    if (!lastLog.isEmpty()) {
      dto.lastSyncedAt = lastLog[0].Synced_At__c;
    }

    dto.mappedAccountsCount = [
      SELECT COUNT()
      FROM Chart_of_Accounts_Mapping__c
      WHERE Target_System__c = :targetSystem AND Active__c = TRUE
      WITH USER_MODE
    ];

    return dto;
  }

  @AuraEnabled
  public static List<RevquilaAccountingSyncService.AccountMappingDto> getAccountMappings(String targetSystem) {
    return RevquilaAccountingSyncService.getMappings(targetSystem);
  }

  @AuraEnabled
  public static void saveAccountMappings(String targetSystem, List<Chart_of_Accounts_Mapping__c> mappings) {
    RevquilaAccountingSyncService.saveMappings(mappings);
  }

  @AuraEnabled
  public static List<LogViewDto> getSyncLogs(String targetSystem, String statusFilter, Integer limitCount) {
    if (limitCount == null || limitCount <= 0) limitCount = 50;

    String query = 'SELECT Id, Target_System__c, Entity_Type__c, Record_Id__c, Record_Name__c, Status__c, External_Id__c, Error_Message__c, Retry_Count__c, Synced_At__c, Request_Payload__c, Response_Payload__c FROM Accounting_Sync_Log__c WHERE Id != null';

    if (String.isNotBlank(targetSystem) && targetSystem != 'All') {
      query += ' AND Target_System__c = :targetSystem';
    }
    if (String.isNotBlank(statusFilter) && statusFilter != 'All') {
      query += ' AND Status__c = :statusFilter';
    }

    query += ' WITH USER_MODE ORDER BY Synced_At__c DESC NULLS LAST LIMIT :limitCount';

    List<Accounting_Sync_Log__c> records = Database.query(query);
    List<LogViewDto> logs = new List<LogViewDto>();
    for (Accounting_Sync_Log__c r : records) {
      LogViewDto d = new LogViewDto();
      d.id = r.Id;
      d.targetSystem = r.Target_System__c;
      d.entityType = r.Entity_Type__c;
      d.recordId = r.Record_Id__c;
      d.recordName = r.Record_Name__c;
      d.status = r.Status__c;
      d.externalId = r.External_Id__c;
      d.errorMessage = r.Error_Message__c;
      d.retryCount = r.Retry_Count__c != null ? r.Retry_Count__c : 0;
      d.syncedAt = r.Synced_At__c;
      d.requestPayload = r.Request_Payload__c;
      d.responsePayload = r.Response_Payload__c;
      logs.add(d);
    }
    return logs;
  }

  @AuraEnabled
  public static RevquilaAccountingSyncService.SyncResult triggerInvoiceSync(String targetSystem, Id invoiceId) {
    return RevquilaAccountingSyncService.syncInvoice(targetSystem, invoiceId);
  }

  @AuraEnabled
  public static RevquilaAccountingSyncService.SyncResult triggerPaymentSync(String targetSystem, Id paymentId) {
    return RevquilaAccountingSyncService.syncPayment(targetSystem, paymentId);
  }

  @AuraEnabled
  public static RevquilaAccountingSyncService.SyncResult triggerJournalSync(String targetSystem, Date fromDate, Date toDate) {
    return RevquilaAccountingSyncService.syncJournalEntry(targetSystem, fromDate, toDate);
  }

  @AuraEnabled
  public static RevquilaAccountingSyncService.SyncResult resyncLogRecord(Id logId) {
    return RevquilaAccountingSyncService.resyncLog(logId);
  }

  @AuraEnabled
  public static String exportAccountingData(String targetSystem, String entityType, Date fromDate, Date toDate) {
    return RevquilaAccountingSyncService.exportAccountingData(targetSystem, entityType, fromDate, toDate);
  }

  @AuraEnabled(cacheable=true)
  public static List<Invoice__c> getRecentInvoices() {
    return [
      SELECT Id, Name, Number__c, Account__r.Name, Issued_On__c, Total__c, Payment_Status__c
      FROM Invoice__c
      WITH USER_MODE
      ORDER BY CreatedDate DESC
      LIMIT 15
    ];
  }

  @AuraEnabled(cacheable=true)
  public static List<Payment__c> getRecentPayments() {
    return [
      SELECT Id, Name, Amount__c, Paid_On__c, Method__c, Reference__c, Invoice__r.Number__c, Invoice__r.Account__r.Name
      FROM Payment__c
      WITH USER_MODE
      ORDER BY CreatedDate DESC
      LIMIT 15
    ];
  }
}
