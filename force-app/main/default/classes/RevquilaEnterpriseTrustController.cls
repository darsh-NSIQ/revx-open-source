/**
 * RevquilaEnterpriseTrustController
 * Unified AuraEnabled controller powering Enterprise Trust, Audit Trail, Quote Versions, and Commissions workspace.
 */
public with sharing class RevquilaEnterpriseTrustController {

    public class WorkspaceView {
        @AuraEnabled public RevquilaSecurityGuard.PermissionSummary permissions;
        @AuraEnabled public List<Commission_Plan__c> plans;
        @AuraEnabled public List<Commission_Statement__c> statements;
        @AuraEnabled public List<Audit_Trail_Entry__c> auditEntries;
        @AuraEnabled public List<QuoteView> quotes;
        @AuraEnabled public Decimal totalCommissionsPaid;
        @AuraEnabled public Decimal totalCommissionsPending;
        @AuraEnabled public Integer totalAuditEvents;
        @AuraEnabled public Integer activePlanCount;
    }

    public class QuoteView {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Decimal total;
        @AuraEnabled public Decimal net;
        @AuraEnabled public String status;
        @AuraEnabled public Integer version;
        @AuraEnabled public String accountName;
        @AuraEnabled public Integer versionCount;
    }

    public class StatementDetailView {
        @AuraEnabled public Commission_Statement__c statement;
        @AuraEnabled public List<Commission_Line__c> lines;
    }

    @AuraEnabled
    public static WorkspaceView getWorkspaceData() {
        WorkspaceView view = new WorkspaceView();
        view.permissions = RevquilaSecurityGuard.getPermissions();

        // Commission Plans
        view.plans = [
            SELECT Id, Name, Active__c, Period_Type__c, Trigger_Event__c, Base_Rate__c, Quota_Target__c,
                   Tier_1_Threshold__c, Tier_1_Rate__c, Tier_2_Threshold__c, Tier_2_Rate__c,
                   Accelerated_Rate__c, Description__c, CreatedDate
            FROM Commission_Plan__c
            WITH USER_MODE
            ORDER BY Active__c DESC, CreatedDate DESC
            LIMIT 20
        ];
        view.activePlanCount = 0;
        for (Commission_Plan__c p : view.plans) {
            if (p.Active__c) view.activePlanCount++;
        }

        // Commission Statements
        view.statements = [
            SELECT Id, Name, Sales_Rep__c, Sales_Rep__r.Name, Commission_Plan__c, Commission_Plan__r.Name,
                   Period__c, Total_Sales_Credited__c, Total_Commission_Earned__c, Quota_Target__c,
                   Quota_Attainment_Percent__c, Status__c, Approved_Date__c, Payment_Date__c, Notes__c
            FROM Commission_Statement__c
            WITH USER_MODE
            ORDER BY CreatedDate DESC
            LIMIT 50
        ];

        view.totalCommissionsPaid = 0;
        view.totalCommissionsPending = 0;
        for (Commission_Statement__c s : view.statements) {
            Decimal earned = s.Total_Commission_Earned__c != null ? s.Total_Commission_Earned__c : 0;
            if (s.Status__c == 'Paid') {
                view.totalCommissionsPaid += earned;
            } else {
                view.totalCommissionsPending += earned;
            }
        }

        // Audit Trail Entries
        view.auditEntries = [
            SELECT Id, Name, Event_Type__c, Record_Id__c, Record_Name__c, Object_Api_Name__c,
                   Action__c, Old_Value__c, New_Value__c, User_Name__c, User_Email__c, Reason__c,
                   Timestamp__c, IP_Address__c
            FROM Audit_Trail_Entry__c
            WITH USER_MODE
            ORDER BY Timestamp__c DESC, CreatedDate DESC
            LIMIT 100
        ];
        view.totalAuditEvents = [SELECT count() FROM Audit_Trail_Entry__c WITH USER_MODE];

        // Quotes for version comparison
        List<Quote__c> qList = [
            SELECT Id, Name, Total__c, Net_Amount__c, Status__c, Version__c, Account__c, Account__r.Name,
                   (SELECT Id FROM Quote_Versions__r)
            FROM Quote__c
            WITH USER_MODE
            ORDER BY LastModifiedDate DESC
            LIMIT 30
        ];
        view.quotes = new List<QuoteView>();
        for (Quote__c q : qList) {
            QuoteView qv = new QuoteView();
            qv.id = q.Id;
            qv.name = q.Name;
            qv.total = q.Total__c;
            qv.net = q.Net_Amount__c;
            qv.status = q.Status__c;
            qv.version = q.Version__c != null ? q.Version__c.intValue() : 1;
            qv.accountName = q.Account__r != null ? q.Account__r.Name : '-';
            qv.versionCount = q.Quote_Versions__r != null ? q.Quote_Versions__r.size() : 0;
            view.quotes.add(qv);
        }

        return view;
    }

    @AuraEnabled
    public static List<Audit_Trail_Entry__c> getAuditTrail(String eventType, String objectName, Integer limitCount) {
        return RevquilaAuditService.queryEntries(eventType, objectName, limitCount);
    }

    @AuraEnabled
    public static List<Quote_Version__c> getQuoteVersions(Id quoteId) {
        return [
            SELECT Id, Name, Version_Number__c, Total_Amount__c, Net_Amount__c, Discount_Total__c,
                   Margin_Percent__c, Payment_Terms__c, Status__c, Created_By_Name__c,
                   Version_Reason__c, Changes_Summary__c, Is_Active__c, CreatedDate
            FROM Quote_Version__c
            WHERE Quote__c = :quoteId
            WITH USER_MODE
            ORDER BY Version_Number__c DESC
        ];
    }

    @AuraEnabled
    public static Quote_Version__c snapshotQuote(Id quoteId, String reason) {
        try {
            return RevquilaQuoteVersioningService.createSnapshot(quoteId, reason);
        } catch (Exception e) {
            throw RevquilaCore.failure(e);
        }
    }

    @AuraEnabled
    public static RevquilaQuoteVersioningService.VersionComparison compareQuoteVersions(Id versionAId, Id versionBId) {
        try {
            return RevquilaQuoteVersioningService.compareVersions(versionAId, versionBId);
        } catch (Exception e) {
            throw RevquilaCore.failure(e);
        }
    }

    @AuraEnabled
    public static void restoreQuoteVersion(Id quoteId, Id versionId) {
        try {
            RevquilaQuoteVersioningService.restoreVersion(quoteId, versionId);
        } catch (Exception e) {
            throw RevquilaCore.failure(e);
        }
    }

    @AuraEnabled
    public static Commission_Plan__c saveCommissionPlan(Commission_Plan__c plan) {
        RevquilaSecurityGuard.requirePermission(RevquilaSecurityGuard.canManageCommissions(), 'configure commission plans');
        try {
            upsert as system plan;
            RevquilaAuditService.log(
                RevquilaAuditService.EVENT_COMMISSION,
                plan.Id,
                plan.Name,
                'Commission_Plan__c',
                'Plan Configured',
                null,
                'Base Rate: ' + plan.Base_Rate__c + '%, Quota: ' + plan.Quota_Target__c,
                'Commission plan saved by ' + UserInfo.getName()
            );
            return plan;
        } catch (Exception e) {
            throw RevquilaCore.failure(e);
        }
    }

    @AuraEnabled
    public static StatementDetailView getStatementDetail(Id statementId) {
        StatementDetailView detail = new StatementDetailView();
        detail.statement = [
            SELECT Id, Name, Sales_Rep__c, Sales_Rep__r.Name, Commission_Plan__c, Commission_Plan__r.Name,
                   Period__c, Total_Sales_Credited__c, Total_Commission_Earned__c, Quota_Target__c,
                   Quota_Attainment_Percent__c, Status__c, Approved_Date__c, Payment_Date__c, Notes__c
            FROM Commission_Statement__c
            WHERE Id = :statementId
            WITH USER_MODE
        ];

        detail.lines = [
            SELECT Id, Name, Deal_Reference__c, Account_Name__c, Deal_Amount__c, Commission_Rate__c,
                   Commission_Amount__c, Event_Type__c, Event_Date__c, Quote__c, Invoice__c
            FROM Commission_Line__c
            WHERE Commission_Statement__c = :statementId
            WITH USER_MODE
            ORDER BY Event_Date__c DESC, CreatedDate DESC
        ];
        return detail;
    }

    @AuraEnabled
    public static void approveCommissionStatement(Id statementId) {
        try {
            RevquilaCommissionService.approveStatement(statementId);
        } catch (Exception e) {
            throw RevquilaCore.failure(e);
        }
    }

    @AuraEnabled
    public static void payCommissionStatement(Id statementId, Date paymentDate) {
        try {
            RevquilaCommissionService.markPaid(statementId, paymentDate);
        } catch (Exception e) {
            throw RevquilaCore.failure(e);
        }
    }
}
