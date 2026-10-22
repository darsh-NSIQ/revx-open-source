/**
 * Handler for Revquila Quote Trigger.
 * Integrates Sales Cloud sync, Enterprise Audit Trail, and Sales Commission calculations.
 */
public with sharing class RevquilaQuoteTriggerHandler {
    public static void afterInsert(List<Quote__c> newQuotes) {
        if (RevquilaSyncGuard.bypassTriggers) return;
        RevquilaSalesSyncService.handleQuotesAfterUpdate(newQuotes, null);
    }

    public static void afterUpdate(List<Quote__c> newQuotes, Map<Id, Quote__c> oldMap) {
        if (RevquilaSyncGuard.bypassTriggers) return;
        RevquilaSalesSyncService.handleQuotesAfterUpdate(newQuotes, oldMap);

        List<Quote__c> signedQuotes = new List<Quote__c>();
        List<Audit_Trail_Entry__c> auditList = new List<Audit_Trail_Entry__c>();

        for (Quote__c q : newQuotes) {
            Quote__c oldQ = oldMap != null ? oldMap.get(q.Id) : null;
            if (oldQ == null) continue;

            // Check if quote became signed or approved
            Boolean becameSigned = (q.Status__c == 'Signed' && oldQ.Status__c != 'Signed');
            if (becameSigned) {
                signedQuotes.add(q);
            }

            // Audit status changes
            if (q.Status__c != oldQ.Status__c) {
                String eventType = (q.Status__c == 'Approved' || q.Status__c == 'Rejected') ?
                                   RevquilaAuditService.EVENT_APPROVAL : RevquilaAuditService.EVENT_PRICING;
                auditList.add(new Audit_Trail_Entry__c(
                    Event_Type__c = eventType,
                    Record_Id__c = q.Id,
                    Record_Name__c = q.Name,
                    Object_Api_Name__c = 'Quote__c',
                    Action__c = 'Status Changed to ' + q.Status__c,
                    Old_Value__c = 'Status: ' + oldQ.Status__c + ', Total: ' + oldQ.Total__c,
                    New_Value__c = 'Status: ' + q.Status__c + ', Total: ' + q.Total__c,
                    User_Name__c = UserInfo.getName(),
                    User_Email__c = UserInfo.getUserEmail(),
                    Reason__c = 'Quote workflow progression',
                    Timestamp__c = System.now()
                ));
            }

            // Audit discount total change
            if (q.Discount_Total__c != oldQ.Discount_Total__c && q.Discount_Total__c != null) {
                auditList.add(new Audit_Trail_Entry__c(
                    Event_Type__c = RevquilaAuditService.EVENT_DISCOUNT,
                    Record_Id__c = q.Id,
                    Record_Name__c = q.Name,
                    Object_Api_Name__c = 'Quote__c',
                    Action__c = 'Discount Override',
                    Old_Value__c = 'Discount: ' + oldQ.Discount_Total__c,
                    New_Value__c = 'Discount: ' + q.Discount_Total__c,
                    User_Name__c = UserInfo.getName(),
                    User_Email__c = UserInfo.getUserEmail(),
                    Reason__c = 'Pricing revision',
                    Timestamp__c = System.now()
                ));
            }
        }

        if (!signedQuotes.isEmpty()) {
            try {
                RevquilaCommissionService.calculateForQuotes(signedQuotes);
            } catch (Exception ex) {
                System.debug(LoggingLevel.WARN, 'Commission calculation deferred: ' + ex.getMessage());
            }
        }

        if (!auditList.isEmpty()) {
            try {
                RevquilaAuditService.logAll(auditList);
            } catch (Exception ex) {
                System.debug(LoggingLevel.WARN, 'Audit trail logging deferred: ' + ex.getMessage());
            }
        }
    }
}
