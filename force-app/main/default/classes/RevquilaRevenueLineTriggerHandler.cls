/**
 * RevquilaRevenueLineTriggerHandler
 * Enforces month-end period lock governance on Revenue_Schedule_Line__c.
 */
public with sharing class RevquilaRevenueLineTriggerHandler {
    public static Boolean bypassPeriodLock = false;

    public static void beforeInsert(List<Revenue_Schedule_Line__c> newLines) {
        if (bypassPeriodLock || RevquilaSyncGuard.bypassTriggers) return;
        RevquilaRevenueDepthService.validatePeriodNotLocked(newLines);
    }

    public static void beforeUpdate(List<Revenue_Schedule_Line__c> newLines, Map<Id, Revenue_Schedule_Line__c> oldMap) {
        if (bypassPeriodLock || RevquilaSyncGuard.bypassTriggers) return;
        List<Revenue_Schedule_Line__c> linesToCheck = new List<Revenue_Schedule_Line__c>();
        for (Revenue_Schedule_Line__c line : newLines) {
            Revenue_Schedule_Line__c oldLine = oldMap.get(line.Id);
            // Allow system toggling of the lock status flag itself
            if (line.Period_Locked__c != oldLine.Period_Locked__c &&
                line.Amount__c == oldLine.Amount__c &&
                line.Recognized__c == oldLine.Recognized__c &&
                line.Period_Start__c == oldLine.Period_Start__c &&
                line.Period_End__c == oldLine.Period_End__c) {
                continue;
            }
            if (oldLine.Period_Locked__c) {
                line.addError('This revenue schedule line is in a LOCKED accounting period. Modifications are prohibited.');
            } else {
                linesToCheck.add(line);
            }
        }
        if (!linesToCheck.isEmpty()) {
            RevquilaRevenueDepthService.validatePeriodNotLocked(linesToCheck);
        }
    }

    public static void beforeDelete(List<Revenue_Schedule_Line__c> oldLines) {
        if (bypassPeriodLock || RevquilaSyncGuard.bypassTriggers) return;
        for (Revenue_Schedule_Line__c line : oldLines) {
            if (line.Period_Locked__c) {
                line.addError('Cannot delete a revenue schedule line in a LOCKED accounting period.');
            }
        }
        RevquilaRevenueDepthService.validatePeriodNotLocked(oldLines);
    }
}
