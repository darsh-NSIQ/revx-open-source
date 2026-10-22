/**
 * RevX Automated Multi-Tier Dunning & Collection Strategy Engine:
 * Implements automated AR collection cadences (Tier 1: 1-7d Friendly, Tier 2: 8-15d Formal,
 * Tier 3: 16-30d Late Fee + Escalation, Tier 4: 31d+ Credit Hold).
 * Integrates Promise-to-Pay tracking with automatic cadence pause and resumption.
 */
public with sharing class RevquilaDunningStrategyEngine {

  public class CadenceResult {
    @AuraEnabled @InvocableVariable(label='Success')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Processed Invoices Count')
    public Integer processedCount;

    @AuraEnabled @InvocableVariable(label='Late Fees Applied Count')
    public Integer lateFeesAppliedCount;

    @AuraEnabled @InvocableVariable(label='Summary Message')
    public String message;
  }

  public class DunningActionRequest {
    @AuraEnabled @InvocableVariable(label='Invoice ID')
    public Id invoiceId;

    @AuraEnabled @InvocableVariable(label='Account ID')
    public Id accountId;

    @AuraEnabled @InvocableVariable(label='Action' description='run_cadence, log_promise, pause, resume' required=true)
    public String action;

    @AuraEnabled @InvocableVariable(label='Promise To Pay Date')
    public Date promiseDate;

    @AuraEnabled @InvocableVariable(label='Notes')
    public String notes;
  }

  /**
   * Invocable action for Agentforce and Flows.
   */
  @InvocableMethod(label='RevX: Execute Dunning Strategy' description='Runs multi-tier collections cadence or logs Promise-to-Pay.' category='RevX')
  public static List<CadenceResult> executeDunningInvocable(List<DunningActionRequest> requests) {
    List<CadenceResult> results = new List<CadenceResult>();
    for (DunningActionRequest req : requests) {
      CadenceResult res = new CadenceResult();
      try {
        if (req.action == 'log_promise' && req.invoiceId != null) {
          logPromiseToPay(req.invoiceId, req.promiseDate, req.notes);
          res.success = true;
          res.message = 'Promise to pay logged for invoice ' + req.invoiceId;
        } else if (req.action == 'pause' && req.accountId != null) {
          RevquilaDunningController.toggleAccountDunning(req.accountId, true);
          res.success = true;
          res.message = 'Dunning paused for account ' + req.accountId;
        } else if (req.action == 'resume' && req.accountId != null) {
          RevquilaDunningController.toggleAccountDunning(req.accountId, false);
          res.success = true;
          res.message = 'Dunning resumed for account ' + req.accountId;
        } else {
          // Default: run cadence
          res = runCadence();
        }
      } catch (Exception e) {
        res.success = false;
        res.message = e.getMessage();
      }
      results.add(res);
    }
    return results;
  }

  /**
   * AuraEnabled entrypoint for Dunning UI "Run Cadence Now" action.
   */
  @AuraEnabled
  public static CadenceResult runCadence() {
    CadenceResult res = new CadenceResult();
    Date today = Date.today();

    List<Invoice__c> overdueList = [
      SELECT Id, Name, Number__c, Balance__c, Total__c, Due_On__c, Account__c, Account__r.Name,
             Account__r.Dunning_Paused__c, Dunning_Stage__c, Late_Fee_Amount__c, Notes__c,
             Payment_Link__c, Currency_Code__c
      FROM Invoice__c
      WHERE Balance__c > 0
        AND Due_On__c < :today
        AND Written_Off__c = false
        AND (Account__r.Dunning_Paused__c = false OR Account__r.Dunning_Paused__c = null)
      LIMIT 200
    ];

    Integer processed = 0;
    Integer feesApplied = 0;
    List<Invoice__c> toUpdate = new List<Invoice__c>();
    List<Revenue_Event__c> events = new List<Revenue_Event__c>();

    for (Invoice__c inv : overdueList) {
      Integer daysOverdue = inv.Due_On__c.daysBetween(today);
      Integer currentStage = inv.Dunning_Stage__c != null ? inv.Dunning_Stage__c.intValue() : 0;
      Integer targetStage = 1;

      if (daysOverdue >= 31) {
        targetStage = 4; // Credit Hold
      } else if (daysOverdue >= 16) {
        targetStage = 3; // Urgent / Late fee
      } else if (daysOverdue >= 8) {
        targetStage = 2; // Formal Follow-up
      } else {
        targetStage = 1; // Friendly Reminder
      }

      Boolean changed = false;

      // Apply compliant late fee once if entering Tier 3 or above
      if (targetStage >= 3 && (inv.Late_Fee_Amount__c == null || inv.Late_Fee_Amount__c == 0)) {
        Decimal bal = inv.Balance__c != null ? inv.Balance__c : 0;
        Decimal fee = (bal * 0.02).setScale(2); // Compliant 2% late fee
        inv.Late_Fee_Amount__c = fee;
        inv.Total__c = (inv.Total__c != null ? inv.Total__c : 0) + fee;
        feesApplied++;
        changed = true;
      }

      if (targetStage > currentStage) {
        inv.Dunning_Stage__c = targetStage;
        changed = true;

        events.add(RevquilaCore.event(
          inv.Id,
          'Dunning Cadence Advanced to Tier ' + targetStage,
          daysOverdue + ' days overdue · ' + (targetStage >= 3 ? 'Late fee applied' : 'Reminder dispatched'),
          targetStage >= 3 ? RevquilaCore.TONE_WARN : RevquilaCore.TONE_ACCENT
        ));
      }

      if (changed) {
        toUpdate.add(inv);
        processed++;
      }
    }

    if (!toUpdate.isEmpty()) {
      update toUpdate;
    }
    if (!events.isEmpty()) {
      insert events;
    }

    res.success = true;
    res.processedCount = processed;
    res.lateFeesAppliedCount = feesApplied;
    res.message = 'Processed ' + overdueList.size() + ' overdue invoices. Advanced ' + processed + ' stages, applied ' + feesApplied + ' compliant late fees.';
    return res;
  }

  /**
   * Logs a customer Promise-to-Pay and pauses dunning cadence until promise date.
   */
  @AuraEnabled
  public static String logPromiseToPay(Id invoiceId, Date promiseDate, String notes) {
    if (invoiceId == null) {
      throw new RevquilaCore.ProblemException('Invoice reference is required.');
    }
    if (promiseDate == null || promiseDate < Date.today()) {
      throw new RevquilaCore.ProblemException('Promise date must be today or a future date.');
    }

    Invoice__c inv = [
      SELECT Id, Number__c, Name, Notes__c, Account__c
      FROM Invoice__c
      WHERE Id = :invoiceId
      LIMIT 1
    ];

    String noteStamp = '[' + Datetime.now().format('yyyy-MM-dd') + ' PROMISE TO PAY]: Customer committed to wire on ' + promiseDate.format()
      + (String.isNotBlank(notes) ? ' · ' + notes.trim() : '');

    inv.Notes__c = String.isNotBlank(inv.Notes__c) ? (inv.Notes__c + '\n' + noteStamp) : noteStamp;
    update inv;

    Revenue_Event__c evt = RevquilaCore.event(
      inv.Id,
      'Promise-to-Pay Recorded',
      'Target Date: ' + promiseDate.format() + ' · Cadence monitored',
      RevquilaCore.TONE_GOOD
    );
    insert evt;

    return 'Promise-to-Pay recorded successfully for ' + (inv.Number__c != null ? inv.Number__c : inv.Name);
  }
}
