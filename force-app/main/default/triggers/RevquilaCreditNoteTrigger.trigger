/**
 * RevquilaCreditNoteTrigger
 * Automatically triggers revenue adjustments on credit notes.
 */
trigger RevquilaCreditNoteTrigger on Credit_Note__c (after insert) {
    if (Trigger.isAfter && Trigger.isInsert) {
        RevquilaCreditNoteTriggerHandler.afterInsert(Trigger.new);
    }
}
