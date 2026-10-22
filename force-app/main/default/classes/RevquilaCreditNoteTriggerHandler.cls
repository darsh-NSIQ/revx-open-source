/**
 * RevquilaCreditNoteTriggerHandler
 * Handles automatic revenue recognition adjustments when credit notes are issued.
 */
public with sharing class RevquilaCreditNoteTriggerHandler {
    public static void afterInsert(List<Credit_Note__c> newNotes) {
        if (RevquilaSyncGuard.bypassTriggers) return;
        for (Credit_Note__c cn : newNotes) {
            if (cn.Invoice__c != null && cn.Amount__c != null && cn.Amount__c > 0) {
                RevquilaRevenueDepthService.applyCreditNoteRevenueAdjustment(cn.Id);
            }
        }
    }
}
