/**
 * Service class handling two-way sync between RevX Quotes and Standard Salesforce Opportunities,
 * including Opportunity Line Items (OLI) and PricebookEntry resolution with zero duplicates.
 */
public with sharing class RevquilaSalesSyncService {

    /**
     * Handles Quote changes:
     * 1. Quote Signed -> Opportunity Closed Won + CloseDate + Amount.
     * 2. Quote marked Primary -> Line item sync to OpportunityLineItem.
     */
    public static void handleQuotesAfterUpdate(List<Quote__c> quotes, Map<Id, Quote__c> oldQuotes) {
        Set<Id> oppsToCloseWon = new Set<Id>();
        Map<Id, Quote__c> oppIdToWinningQuote = new Map<Id, Quote__c>();
        Set<Id> quotesNeedingLineSync = new Set<Id>();
        Set<Id> oppIdsToUnmarkOtherPrimaries = new Set<Id>();

        for (Quote__c q : quotes) {
            Quote__c oldQ = oldQuotes != null ? oldQuotes.get(q.Id) : null;
            if (q.Opportunity__c == null) {
                continue;
            }

            Boolean justSigned = (q.Status__c == 'signed' || q.Signed_On__c != null) &&
                (oldQ == null || (oldQ.Status__c != 'signed' && oldQ.Signed_On__c == null));

            if (justSigned) {
                oppsToCloseWon.add(q.Opportunity__c);
                oppIdToWinningQuote.put(q.Opportunity__c, q);
            }

            Boolean primaryChanged = q.Primary__c == true && (oldQ == null || oldQ.Primary__c != true);
            Boolean netChanged = oldQ != null && q.Primary__c == true && q.Net_Amount__c != oldQ.Net_Amount__c;

            if (primaryChanged || netChanged) {
                quotesNeedingLineSync.add(q.Id);
                if (primaryChanged) {
                    oppIdsToUnmarkOtherPrimaries.add(q.Opportunity__c);
                }
            }
        }

        // 1. Unmark other primary quotes on the same Opportunity
        if (!oppIdsToUnmarkOtherPrimaries.isEmpty()) {
            unmarkOtherPrimaryQuotes(oppIdsToUnmarkOtherPrimaries, quotes);
        }

        // 2. Sync Lines to Opportunity Products
        if (!quotesNeedingLineSync.isEmpty() && !RevquilaSyncGuard.isSyncingLines) {
            syncQuoteLinesToOpportunity(quotesNeedingLineSync);
        }

        // 3. Close Won Opportunities on Quote Signature
        if (!oppsToCloseWon.isEmpty()) {
            closeWonOpportunities(oppIdToWinningQuote);
        }
    }

    /**
     * Handles Opportunity stage changes and syncs back to the primary Quote.
     */
    public static void handleOpportunitiesAfterUpdate(List<Opportunity> opps, Map<Id, Opportunity> oldOpps) {
        Map<Id, String> oppIdToNewStage = new Map<Id, String>();

        for (Opportunity opp : opps) {
            Opportunity oldOpp = oldOpps != null ? oldOpps.get(opp.Id) : null;
            if (oldOpp != null && opp.StageName != oldOpp.StageName) {
                if (RevquilaSyncGuard.shouldSyncOpportunity(opp.Id)) {
                    oppIdToNewStage.put(opp.Id, opp.StageName);
                }
            }
        }

        if (oppIdToNewStage.isEmpty()) {
            return;
        }

        try {
            List<Quote__c> quotesToUpdate = new List<Quote__c>();
            List<Quote__c> linkedQuotes = [
                SELECT Id, Opportunity__c, Status__c, Primary__c, Signed_On__c
                FROM Quote__c
                WHERE Opportunity__c IN :oppIdToNewStage.keySet()
                WITH USER_MODE
            ];

            for (Quote__c q : linkedQuotes) {
                String stage = oppIdToNewStage.get(q.Opportunity__c);
                if (stage == null) continue;

                if (stage == 'Closed Won') {
                    if (q.Primary__c == true && q.Status__c != 'signed') {
                        q.Status__c = 'signed';
                        if (q.Signed_On__c == null) {
                            q.Signed_On__c = Date.today();
                        }
                        quotesToUpdate.add(q);
                    }
                } else if (stage == 'Closed Lost') {
                    if (q.Status__c != 'signed' && q.Status__c != 'rejected') {
                        q.Status__c = 'rejected';
                        quotesToUpdate.add(q);
                    }
                }
            }

            if (!quotesToUpdate.isEmpty()) {
                Database.update(quotesToUpdate, AccessLevel.USER_MODE);
            }
        } finally {
            for (Id oppId : oppIdToNewStage.keySet()) {
                RevquilaSyncGuard.releaseOpportunity(oppId);
            }
        }
    }

    /**
     * Un-marks other quotes on the same Opportunity when one is marked Primary.
     */
    private static void unmarkOtherPrimaryQuotes(Set<Id> oppIds, List<Quote__c> triggerQuotes) {
        Set<Id> triggerQuoteIds = new Set<Id>();
        for (Quote__c q : triggerQuotes) {
            triggerQuoteIds.add(q.Id);
        }

        List<Quote__c> others = [
            SELECT Id, Primary__c
            FROM Quote__c
            WHERE Opportunity__c IN :oppIds
              AND Primary__c = true
              AND Id NOT IN :triggerQuoteIds
            WITH USER_MODE
        ];

        if (!others.isEmpty()) {
            for (Quote__c q : others) {
                q.Primary__c = false;
            }
            Database.update(others, AccessLevel.USER_MODE);
        }
    }

    /**
     * Closes Opportunities as Won when Quote is signed.
     */
    private static void closeWonOpportunities(Map<Id, Quote__c> oppIdToWinningQuote) {
        List<Opportunity> oppsToUpdate = new List<Opportunity>();

        List<Opportunity> existingOpps = [
            SELECT Id, StageName, Amount, CloseDate
            FROM Opportunity
            WHERE Id IN :oppIdToWinningQuote.keySet()
            WITH USER_MODE
        ];

        for (Opportunity opp : existingOpps) {
            Quote__c winningQuote = oppIdToWinningQuote.get(opp.Id);
            if (winningQuote == null) continue;

            if (RevquilaSyncGuard.shouldSyncQuote(winningQuote.Id)) {
                opp.StageName = 'Closed Won';
                Decimal quoteAmt = winningQuote.Net_Amount__c != null ? winningQuote.Net_Amount__c : winningQuote.Total__c;
                if (quoteAmt != null) {
                    opp.Amount = quoteAmt;
                }
                opp.CloseDate = winningQuote.Signed_On__c != null ? winningQuote.Signed_On__c : Date.today();
                oppsToUpdate.add(opp);

                // Publish Platform Event for downstream automations & Flows
                RevquilaCore.publish(
                    'quote_signed',
                    winningQuote.Id,
                    new Map<String, Object>{
                        'quoteId' => winningQuote.Id,
                        'opportunityId' => opp.Id,
                        'amount' => opp.Amount,
                        'closeDate' => opp.CloseDate
                    }
                );
            }
        }

        if (!oppsToUpdate.isEmpty()) {
            Database.update(oppsToUpdate, AccessLevel.USER_MODE);
        }
    }

    /**
     * Syncs Quote_Line__c records of primary quotes to standard OpportunityLineItem records.
     * Reuses RevquilaOliSync to prevent code duplication and avoid duplicate OLIs.
     */
    public static void syncQuoteLinesToOpportunity(Set<Id> quoteIds) {
        RevquilaSyncGuard.isSyncingLines = true;
        try {
            for (Id qId : quoteIds) {
                RevquilaOliSync.syncOpportunity(qId);
            }
        } finally {
            RevquilaSyncGuard.isSyncingLines = false;
        }
    }
}
