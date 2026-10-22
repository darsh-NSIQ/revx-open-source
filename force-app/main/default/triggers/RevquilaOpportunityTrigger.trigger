/**
 * Trigger on Opportunity for Two-Way Stage and Line Sync with RevX Quotes.
 */
trigger RevquilaOpportunityTrigger on Opportunity (after update) {
    if (Trigger.isAfter && Trigger.isUpdate) {
        RevquilaOpportunityTriggerHandler.afterUpdate(Trigger.new, Trigger.oldMap);
    }
}
