/**
 * Trigger Handler for Payment__c records.
 * Manages installment auto-allocation, commission processing, and audit trail synchronization.
 */
public with sharing class RevquilaPaymentTriggerHandler {
  public static void handleAfterInsert(List<Payment__c> newPayments) {
    if (RevquilaSyncGuard.bypassTriggers) return;
    Set<Id> invoiceIds = new Set<Id>();
    List<Audit_Trail_Entry__c> auditList = new List<Audit_Trail_Entry__c>();

    for (Payment__c p : newPayments) {
      if (p.Invoice__c != null && p.Amount__c != null && p.Amount__c > 0) {
        invoiceIds.add(p.Invoice__c);
      }
      auditList.add(new Audit_Trail_Entry__c(
        Event_Type__c = 'Pricing Change',
        Record_Id__c = p.Id,
        Record_Name__c = 'Payment ' + p.Amount__c,
        Object_Api_Name__c = 'Payment__c',
        Action__c = 'Payment Recorded',
        Old_Value__c = null,
        New_Value__c = 'Amount: ' + p.Amount__c + ', Method: ' + p.Method__c,
        User_Name__c = UserInfo.getName(),
        User_Email__c = UserInfo.getUserEmail(),
        Reason__c = 'Customer settlement',
        Timestamp__c = System.now()
      ));
    }

    if (!auditList.isEmpty()) {
      try {
        RevquilaAuditService.logAll(auditList);
      } catch (Exception ex) {
        System.debug(LoggingLevel.WARN, 'Audit logging deferred: ' + ex.getMessage());
      }
    }

    if (invoiceIds.isEmpty()) return;

    Map<Id, Invoice__c> invMap = new Map<Id, Invoice__c>([
      SELECT Id, Name, Payment_Status__c, Total__c, Balance__c, Has_Payment_Plan__c, OwnerId
      FROM Invoice__c
      WHERE Id IN :invoiceIds
      WITH SYSTEM_MODE
    ]);

    List<Invoice__c> paidInvoices = new List<Invoice__c>();
    for (Payment__c p : newPayments) {
      if (invMap.containsKey(p.Invoice__c)) {
        Invoice__c inv = invMap.get(p.Invoice__c);
        if (inv.Has_Payment_Plan__c == true) {
          RevquilaIndiaPaymentsService.allocatePaymentToInstallments(p.Invoice__c, p.Amount__c, p.Id);
        }
        if (inv.Payment_Status__c == 'Paid' || inv.Balance__c <= 0) {
          paidInvoices.add(inv);
        }
      }
    }

    if (!paidInvoices.isEmpty()) {
      try {
        RevquilaCommissionService.calculateForInvoices(paidInvoices);
      } catch (Exception ex) {
        System.debug(LoggingLevel.WARN, 'Commission calculation deferred: ' + ex.getMessage());
      }
    }
  }
}
