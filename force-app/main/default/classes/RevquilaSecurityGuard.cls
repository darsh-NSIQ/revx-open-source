/**
 * RevquilaSecurityGuard
 * Centralized Role-Based Access Control (RBAC) and Field-Level Security evaluator.
 * Evaluates custom permissions and provides permission status to controllers and LWC.
 */
public with sharing class RevquilaSecurityGuard {

    public class PermissionSummary {
        @AuraEnabled public Boolean isAdmin;
        @AuraEnabled public Boolean canEditPrices;
        @AuraEnabled public Boolean canEditDiscounts;
        @AuraEnabled public Boolean canViewMargins;
        @AuraEnabled public Boolean canApproveQuotes;
        @AuraEnabled public Boolean canApproveDiscounts;
        @AuraEnabled public Boolean canIssueRefunds;
        @AuraEnabled public Boolean canLockRevenuePeriods;
        @AuraEnabled public Boolean canManageCommissions;
        @AuraEnabled public Boolean canManageBilling;
        @AuraEnabled public Boolean canRecognizeRevenue;
        @AuraEnabled public String currentUserName;
        @AuraEnabled public String currentUserEmail;
        @AuraEnabled public String currentUserId;
    }

    public static Boolean isAdmin() {
        return RevquilaCore.isAdmin();
    }

    public static Boolean canEditPrices() {
        return isAdmin() || FeatureManagement.checkPermission('Edit_Prices');
    }

    public static Boolean canEditDiscounts() {
        return isAdmin() || FeatureManagement.checkPermission('Edit_Discounts') || FeatureManagement.checkPermission('Edit_Prices');
    }

    public static Boolean canViewMargins() {
        return isAdmin() || FeatureManagement.checkPermission('View_Margins');
    }

    public static Boolean canApproveQuotes() {
        return isAdmin() || FeatureManagement.checkPermission('Approve_Quotes') || FeatureManagement.checkPermission('Approve_Discounts');
    }

    public static Boolean canApproveDiscounts() {
        return isAdmin() || FeatureManagement.checkPermission('Approve_Discounts') || FeatureManagement.checkPermission('Approve_Quotes');
    }

    public static Boolean canIssueRefunds() {
        return isAdmin() || FeatureManagement.checkPermission('Issue_Refunds') || FeatureManagement.checkPermission('Manage_Billing');
    }

    public static Boolean canLockRevenuePeriods() {
        return isAdmin() || FeatureManagement.checkPermission('Lock_Revenue_Periods') || FeatureManagement.checkPermission('Recognize_Revenue');
    }

    public static Boolean canManageCommissions() {
        return isAdmin() || FeatureManagement.checkPermission('Manage_Commissions');
    }

    public static Boolean canManageBilling() {
        return isAdmin() || FeatureManagement.checkPermission('Manage_Billing');
    }

    public static Boolean canRecognizeRevenue() {
        return isAdmin() || FeatureManagement.checkPermission('Recognize_Revenue');
    }

    @AuraEnabled(cacheable=true)
    public static PermissionSummary getPermissions() {
        PermissionSummary summary = new PermissionSummary();
        summary.isAdmin = isAdmin();
        summary.canEditPrices = canEditPrices();
        summary.canEditDiscounts = canEditDiscounts();
        summary.canViewMargins = canViewMargins();
        summary.canApproveQuotes = canApproveQuotes();
        summary.canApproveDiscounts = canApproveDiscounts();
        summary.canIssueRefunds = canIssueRefunds();
        summary.canLockRevenuePeriods = canLockRevenuePeriods();
        summary.canManageCommissions = canManageCommissions();
        summary.canManageBilling = canManageBilling();
        summary.canRecognizeRevenue = canRecognizeRevenue();
        summary.currentUserName = UserInfo.getName();
        summary.currentUserEmail = UserInfo.getUserEmail();
        summary.currentUserId = UserInfo.getUserId();
        return summary;
    }

    public static void requirePermission(Boolean allowed, String actionMessage) {
        if (!allowed) {
            throw new RevquilaCore.ProblemException('Access Denied: You do not have permission to ' + actionMessage + '. Please contact your RevX administrator.');
        }
    }
}
