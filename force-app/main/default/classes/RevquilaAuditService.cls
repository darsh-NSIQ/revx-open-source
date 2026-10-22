/**
 * RevquilaAuditService
 * Immutable enterprise audit trail logger.
 * Captures changes across Pricing, Discounts, Approvals, Revenue Period Locks, Refunds, and Commissions.
 */
public with sharing class RevquilaAuditService {

    public static final String EVENT_PRICING = 'Pricing Change';
    public static final String EVENT_DISCOUNT = 'Discount Override';
    public static final String EVENT_APPROVAL = 'Approval Action';
    public static final String EVENT_PERIOD_LOCK = 'Period Lock';
    public static final String EVENT_PERIOD_REOPEN = 'Period Reopen';
    public static final String EVENT_REFUND = 'Refund Issued';
    public static final String EVENT_COMMISSION = 'Commission Action';
    public static final String EVENT_QUOTE_RESTORE = 'Quote Restored';

    /**
     * Records a single audit trail entry with full user context and timestamps.
     */
    public static Audit_Trail_Entry__c log(
        String eventType,
        Id recordId,
        String recordName,
        String objectName,
        String action,
        String oldValue,
        String newValue,
        String reason
    ) {
        Audit_Trail_Entry__c entry = new Audit_Trail_Entry__c(
            Event_Type__c = eventType,
            Record_Id__c = recordId != null ? String.valueOf(recordId) : null,
            Record_Name__c = String.isBlank(recordName) ? 'Record' : recordName.abbreviate(255),
            Object_Api_Name__c = objectName,
            Action__c = String.isBlank(action) ? 'Update' : action.abbreviate(100),
            Old_Value__c = oldValue != null ? oldValue.left(32000) : null,
            New_Value__c = newValue != null ? newValue.left(32000) : null,
            User_Name__c = UserInfo.getName(),
            User_Email__c = UserInfo.getUserEmail(),
            Reason__c = String.isBlank(reason) ? 'Standard system workflow' : reason.abbreviate(255),
            Timestamp__c = System.now(),
            IP_Address__c = 'Internal'
        );

        insert as system entry;
        return entry;
    }

    /**
     * Bulk logs a collection of audit trail entries.
     */
    public static void logAll(List<Audit_Trail_Entry__c> entries) {
        if (entries == null || entries.isEmpty()) {
            return;
        }
        for (Audit_Trail_Entry__c row : entries) {
            if (row.Timestamp__c == null) {
                row.Timestamp__c = System.now();
            }
            if (String.isBlank(row.User_Name__c)) {
                row.User_Name__c = UserInfo.getName();
            }
            if (String.isBlank(row.User_Email__c)) {
                row.User_Email__c = UserInfo.getUserEmail();
            }
        }
        insert as system entries;
    }

    /**
     * Queries audit trail entries with filtering by event type, object, or general search.
     */
    public static List<Audit_Trail_Entry__c> queryEntries(String eventType, String objectName, Integer recordLimit) {
        Integer lim = (recordLimit != null && recordLimit > 0) ? Math.min(recordLimit, 200) : 100;
        String query = 'SELECT Id, Name, Event_Type__c, Record_Id__c, Record_Name__c, Object_Api_Name__c, ' +
                       'Action__c, Old_Value__c, New_Value__c, User_Name__c, User_Email__c, Reason__c, ' +
                       'Timestamp__c, IP_Address__c ' +
                       'FROM Audit_Trail_Entry__c ';
        
        List<String> conditions = new List<String>();
        if (String.isNotBlank(eventType) && eventType != 'All') {
            conditions.add('Event_Type__c = :eventType');
        }
        if (String.isNotBlank(objectName) && objectName != 'All') {
            conditions.add('Object_Api_Name__c = :objectName');
        }
        
        if (!conditions.isEmpty()) {
            query += 'WHERE ' + String.join(conditions, ' AND ') + ' ';
        }
        query += 'ORDER BY Timestamp__c DESC, CreatedDate DESC LIMIT :lim';

        return Database.query(query);
    }
}
