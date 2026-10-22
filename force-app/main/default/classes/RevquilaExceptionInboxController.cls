/**
 * Revquila Exception Inbox & AI Governance Controller:
 * Manages human-in-the-loop exception triage (quotes outside policy, payment mismatches,
 * churn risks, failed payments), AI autonomy guardrail configurations, and AI Action Logs.
 */
public with sharing class RevquilaExceptionInboxController {

  public class ExceptionView {
    @AuraEnabled public Id id;
    @AuraEnabled public String name;
    @AuraEnabled public String title;
    @AuraEnabled public String category;
    @AuraEnabled public String severity;
    @AuraEnabled public String status;
    @AuraEnabled public Decimal amount;
    @AuraEnabled public Id accountId;
    @AuraEnabled public String accountName;
    @AuraEnabled public String recordId;
    @AuraEnabled public String recordType;
    @AuraEnabled public String aiReason;
    @AuraEnabled public String recommendedAction;
    @AuraEnabled public Datetime createdDate;
    @AuraEnabled public String severityBadgeTone;
  }

  public class LogView {
    @AuraEnabled public Id id;
    @AuraEnabled public String name;
    @AuraEnabled public String action;
    @AuraEnabled public String input;
    @AuraEnabled public String output;
    @AuraEnabled public String reason;
    @AuraEnabled public Decimal tokens;
    @AuraEnabled public Decimal cost;
    @AuraEnabled public Boolean success;
    @AuraEnabled public String feedback;
    @AuraEnabled public String provider;
    @AuraEnabled public String recordId;
    @AuraEnabled public String userName;
    @AuraEnabled public Datetime createdDate;
  }

  public class AutonomyConfig {
    @AuraEnabled public String autonomyLevel;
    @AuraEnabled public Boolean killSwitch;
    @AuraEnabled public Decimal maxDiscountPercent;
    @AuraEnabled public Decimal maxRefundAmount;
  }

  /**
   * Retrieves items pending human triage in the Exception Inbox.
   */
  @AuraEnabled
  public static List<ExceptionView> getExceptions(String category, String severity, String status) {
    try {
      String query = 'SELECT Id, Name, Title__c, Category__c, Severity__c, Status__c, Amount__c, ' +
        'Account__c, Account__r.Name, Record_Id__c, Record_Type__c, AI_Reason__c, Recommended_Action__c, CreatedDate ' +
        'FROM Exception_Item__c WHERE Id != null ';

      if (String.isNotBlank(status) && status != 'all') {
        query += ' AND Status__c = :status ';
      }
      if (String.isNotBlank(category) && category != 'all') {
        query += ' AND Category__c = :category ';
      }
      if (String.isNotBlank(severity) && severity != 'all') {
        query += ' AND Severity__c = :severity ';
      }

      query += ' ORDER BY CreatedDate DESC LIMIT 200';

      List<Exception_Item__c> rows = Database.query(query);
      List<ExceptionView> views = new List<ExceptionView>();

      for (Exception_Item__c row : rows) {
        ExceptionView v = new ExceptionView();
        v.id = row.Id;
        v.name = row.Name;
        v.title = row.Title__c;
        v.category = row.Category__c;
        v.severity = row.Severity__c;
        v.status = row.Status__c;
        v.amount = row.Amount__c;
        v.accountId = row.Account__c;
        v.accountName = row.Account__r != null ? row.Account__r.Name : '';
        v.recordId = row.Record_Id__c;
        v.recordType = row.Record_Type__c;
        v.aiReason = row.AI_Reason__c;
        v.recommendedAction = row.Recommended_Action__c;
        v.createdDate = row.CreatedDate;

        String sev = row.Severity__c != null ? row.Severity__c.toLowerCase() : 'medium';
        if (sev == 'critical') v.severityBadgeTone = 'bad';
        else if (sev == 'high') v.severityBadgeTone = 'warn';
        else if (sev == 'medium') v.severityBadgeTone = 'info';
        else v.severityBadgeTone = 'mut';

        views.add(v);
      }
      return views;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Approves an exception item and executes standard resolution.
   */
  @AuraEnabled
  public static String approveException(Id exceptionId) {
    try {
      Exception_Item__c item = [
        SELECT Id, Name, Title__c, Category__c, Status__c, Record_Id__c, Record_Type__c, AI_Reason__c
        FROM Exception_Item__c
        WHERE Id = :exceptionId
        LIMIT 1
      ];

      item.Status__c = 'Approved';
      update item;

      // Log AI Action for audit trail
      RevquilaAgentService.logAction(
        'approve_exception',
        'Manual approval for exception: ' + item.Title__c,
        'Exception approved by ' + UserInfo.getName(),
        'Human override in Exception Inbox',
        50,
        0.0001,
        true,
        item.Id,
        'Human Supervisor'
      );

      return 'Exception item ' + item.Name + ' approved successfully.';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Rejects an exception item with a human justification.
   */
  @AuraEnabled
  public static String rejectException(Id exceptionId, String rejectionReason) {
    try {
      Exception_Item__c item = [
        SELECT Id, Name, Title__c, Status__c, AI_Reason__c
        FROM Exception_Item__c
        WHERE Id = :exceptionId
        LIMIT 1
      ];

      item.Status__c = 'Rejected';
      if (String.isNotBlank(rejectionReason)) {
        item.AI_Reason__c = (String.isNotBlank(item.AI_Reason__c) ? item.AI_Reason__c + '\n' : '') +
          '[REJECTION NOTE by ' + UserInfo.getName() + ']: ' + rejectionReason;
      }
      update item;

      RevquilaAgentService.logAction(
        'reject_exception',
        'Exception rejected: ' + item.Title__c,
        'Reason: ' + rejectionReason,
        'Human rejection in Exception Inbox',
        50,
        0.0001,
        true,
        item.Id,
        'Human Supervisor'
      );

      return 'Exception item ' + item.Name + ' rejected.';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Edits the exception parameters and marks resolved.
   */
  @AuraEnabled
  public static String editException(Id exceptionId, Decimal revisedAmount, String notes) {
    try {
      Exception_Item__c item = [
        SELECT Id, Name, Amount__c, AI_Reason__c, Status__c
        FROM Exception_Item__c
        WHERE Id = :exceptionId
        LIMIT 1
      ];

      if (revisedAmount != null) {
        item.Amount__c = revisedAmount;
      }
      item.Status__c = 'Resolved';
      if (String.isNotBlank(notes)) {
        item.AI_Reason__c = (String.isNotBlank(item.AI_Reason__c) ? item.AI_Reason__c + '\n' : '') +
          '[ADJUSTMENT by ' + UserInfo.getName() + ']: ' + notes;
      }
      update item;

      return 'Exception item ' + item.Name + ' adjusted and resolved.';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Retrieves AI Action Logs for audit trail and telemetry.
   */
  @AuraEnabled
  public static List<LogView> getAiLogs(Integer limitRows) {
    try {
      Integer lim = (limitRows != null && limitRows > 0) ? limitRows : 50;
      List<AI_Action_Log__c> logs = [
        SELECT Id, Name, Action__c, Input__c, Output__c, Reason__c, Tokens__c, Cost__c,
               Success__c, Feedback__c, Provider__c, Record_Id__c, User__c, User__r.Name, CreatedDate
        FROM AI_Action_Log__c
        ORDER BY CreatedDate DESC
        LIMIT :lim
      ];

      List<LogView> views = new List<LogView>();
      for (AI_Action_Log__c l : logs) {
        LogView lv = new LogView();
        lv.id = l.Id;
        lv.name = l.Name;
        lv.action = l.Action__c;
        lv.input = l.Input__c;
        lv.output = l.Output__c;
        lv.reason = l.Reason__c;
        lv.tokens = l.Tokens__c;
        lv.cost = l.Cost__c;
        lv.success = l.Success__c;
        lv.feedback = l.Feedback__c;
        lv.provider = l.Provider__c;
        lv.recordId = l.Record_Id__c;
        lv.userName = l.User__r != null ? l.User__r.Name : '';
        lv.createdDate = l.CreatedDate;
        views.add(lv);
      }
      return views;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Submits thumbs up ('UP') or thumbs down ('DOWN') user feedback on an AI Action Log.
   */
  @AuraEnabled
  public static Boolean submitFeedback(Id logId, String feedback) {
    try {
      AI_Action_Log__c log = [SELECT Id, Feedback__c FROM AI_Action_Log__c WHERE Id = :logId LIMIT 1];
      log.Feedback__c = feedback;
      update log;
      return true;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Returns current autonomy levels and safety guardrail settings from Org Defaults.
   */
  @AuraEnabled
  public static AutonomyConfig getAutonomySettings() {
    try {
      Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
      AutonomyConfig cfg = new AutonomyConfig();
      cfg.autonomyLevel = (secrets != null && String.isNotBlank(secrets.AI_Autonomy_Level__c))
        ? secrets.AI_Autonomy_Level__c
        : 'suggest';
      cfg.killSwitch = (secrets != null && secrets.AI_Kill_Switch__c == true);
      cfg.maxDiscountPercent = (secrets != null && secrets.AI_Max_Discount_Percent__c != null)
        ? secrets.AI_Max_Discount_Percent__c
        : 20.0;
      cfg.maxRefundAmount = (secrets != null && secrets.AI_Max_Refund_Amount__c != null)
        ? secrets.AI_Max_Refund_Amount__c
        : 5000.0;
      return cfg;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Updates autonomy policy and safety threshold settings.
   */
  @AuraEnabled
  public static Boolean saveAutonomySettings(String autonomyLevel, Boolean killSwitch, Decimal maxDiscountPercent, Decimal maxRefundAmount) {
    try {
      RevquilaCore.need(RevquilaCore.isAdmin(), 'Only Revquila Administrators can change AI autonomy settings.');
      Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
      if (secrets == null) {
        secrets = new Revquila_Secrets__c();
      }
      secrets.AI_Autonomy_Level__c = String.isNotBlank(autonomyLevel) ? autonomyLevel : 'suggest';
      secrets.AI_Kill_Switch__c = killSwitch == true;
      secrets.AI_Max_Discount_Percent__c = maxDiscountPercent != null ? maxDiscountPercent : 20.0;
      secrets.AI_Max_Refund_Amount__c = maxRefundAmount != null ? maxRefundAmount : 5000.0;

      upsert as user secrets;
      return true;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}
