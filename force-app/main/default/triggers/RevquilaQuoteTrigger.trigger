/**
 * Trigger on Quote__c for Sales Cloud sync, Platform Events, and Governance.
 */
trigger RevquilaQuoteTrigger on Quote__c (after insert, after update) {
    if (Trigger.isAfter) {
        if (Trigger.isInsert) {
            RevquilaQuoteTriggerHandler.afterInsert(Trigger.new);
        } else if (Trigger.isUpdate) {
            RevquilaQuoteTriggerHandler.afterUpdate(Trigger.new, Trigger.oldMap);
        }
    }
}
