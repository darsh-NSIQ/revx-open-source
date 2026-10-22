/**
 * Static recursion control and sync state manager for RevX Sales & Service Cloud sync.
 */
public with sharing class RevquilaSyncGuard {
    public static Boolean bypassTriggers = false;
    private static Set<Id> quotesInFlight = new Set<Id>();
    private static Set<Id> oppsInFlight = new Set<Id>();
    public static Boolean isSyncingLines = false;

    public static Boolean shouldSyncQuote(Id quoteId) {
        if (quoteId == null || quotesInFlight.contains(quoteId)) {
            return false;
        }
        quotesInFlight.add(quoteId);
        return true;
    }

    public static Boolean shouldSyncOpportunity(Id oppId) {
        if (oppId == null || oppsInFlight.contains(oppId)) {
            return false;
        }
        oppsInFlight.add(oppId);
        return true;
    }

    public static void releaseQuote(Id quoteId) {
        quotesInFlight.remove(quoteId);
    }

    public static void releaseOpportunity(Id oppId) {
        oppsInFlight.remove(oppId);
    }

    public static void clear() {
        quotesInFlight.clear();
        oppsInFlight.clear();
        isSyncingLines = false;
    }
}
