/**
 * RevquilaRevenueLineTrigger
 * Enforces month-end period lock protections for revenue schedule lines.
 */
trigger RevquilaRevenueLineTrigger on Revenue_Schedule_Line__c (before insert, before update, before delete) {
    if (Trigger.isBefore) {
        if (Trigger.isInsert) {
            RevquilaRevenueLineTriggerHandler.beforeInsert(Trigger.new);
        } else if (Trigger.isUpdate) {
            RevquilaRevenueLineTriggerHandler.beforeUpdate(Trigger.new, Trigger.oldMap);
        } else if (Trigger.isDelete) {
            RevquilaRevenueLineTriggerHandler.beforeDelete(Trigger.old);
        }
    }
}
