/**
 * Handler for Opportunity Trigger sync with RevX Quotes.
 */
public with sharing class RevquilaOpportunityTriggerHandler {
    public static void afterUpdate(List<Opportunity> newOpps, Map<Id, Opportunity> oldMap) {
        if (RevquilaSyncGuard.bypassTriggers) return;
        RevquilaSalesSyncService.handleOpportunitiesAfterUpdate(newOpps, oldMap);
    }
}
