/**
 * RevquilaCommissionService
 * Sales commission and incentive calculation engine.
 * Calculates rep earnings and quota attainment driven by closed quotes and paid invoices.
 */
public with sharing class RevquilaCommissionService {

    private static Boolean quotePlanQueried = false;
    private static Commission_Plan__c cachedQuotePlan = null;
    private static Boolean invoicePlanQueried = false;
    private static Commission_Plan__c cachedInvoicePlan = null;

    /**
     * Calculates commission when a quote is signed / closed won.
     */
    public static void calculateForQuotes(List<Quote__c> quotes) {
        if (quotes == null || quotes.isEmpty()) return;

        if (!quotePlanQueried) {
            quotePlanQueried = true;
            List<Commission_Plan__c> plans = [
                SELECT Id, Name, Base_Rate__c, Quota_Target__c, Tier_1_Threshold__c, Tier_1_Rate__c,
                       Tier_2_Threshold__c, Tier_2_Rate__c, Accelerated_Rate__c, Trigger_Event__c, Period_Type__c
                FROM Commission_Plan__c
                WHERE Active__c = TRUE
                WITH USER_MODE
                LIMIT 1
            ];
            cachedQuotePlan = plans.isEmpty() ? null : plans[0];
        }

        if (cachedQuotePlan == null) {
            return; // No active plan configured
        }
        Commission_Plan__c plan = cachedQuotePlan;
        if (plan.Trigger_Event__c != null && plan.Trigger_Event__c != 'Quote Won') {
            return; // Configured for invoice-based commissions
        }

        String currentPeriod = getCurrentPeriod(plan.Period_Type__c);
        processDeals(quotes, null, plan, currentPeriod, 'Quote Won');
    }

    /**
     * Calculates commission when an invoice is fully paid.
     */
    public static void calculateForInvoices(List<Invoice__c> invoices) {
        if (invoices == null || invoices.isEmpty()) return;

        if (!invoicePlanQueried) {
            invoicePlanQueried = true;
            List<Commission_Plan__c> plans = [
                SELECT Id, Name, Base_Rate__c, Quota_Target__c, Tier_1_Threshold__c, Tier_1_Rate__c,
                       Tier_2_Threshold__c, Tier_2_Rate__c, Accelerated_Rate__c, Trigger_Event__c, Period_Type__c
                FROM Commission_Plan__c
                WHERE Active__c = TRUE AND Trigger_Event__c = 'Invoice Paid'
                WITH USER_MODE
                LIMIT 1
            ];
            cachedInvoicePlan = plans.isEmpty() ? null : plans[0];
        }

        if (cachedInvoicePlan == null) {
            return;
        }
        Commission_Plan__c plan = cachedInvoicePlan;
        String currentPeriod = getCurrentPeriod(plan.Period_Type__c);
        processDeals(null, invoices, plan, currentPeriod, 'Invoice Paid');
    }

    /**
     * Internal processor to match rep, calculate tiered payout, and save statement and lines.
     */
    private static void processDeals(
        List<Quote__c> quotes,
        List<Invoice__c> invoices,
        Commission_Plan__c plan,
        String period,
        String eventType
    ) {
        // Collect Rep User IDs
        Set<Id> repIds = new Set<Id>();
        if (quotes != null) {
            for (Quote__c q : quotes) {
                repIds.add(q.OwnerId != null ? q.OwnerId : UserInfo.getUserId());
            }
        }
        if (invoices != null) {
            for (Invoice__c inv : invoices) {
                repIds.add(inv.OwnerId != null ? inv.OwnerId : UserInfo.getUserId());
            }
        }

        // Fetch or create statements for reps in this period
        Map<Id, Commission_Statement__c> repStatements = new Map<Id, Commission_Statement__c>();
        for (Commission_Statement__c cs : [
            SELECT Id, Sales_Rep__c, Total_Sales_Credited__c, Total_Commission_Earned__c,
                   Quota_Target__c, Quota_Attainment_Percent__c, Status__c, Period__c
            FROM Commission_Statement__c
            WHERE Sales_Rep__c IN :repIds AND Period__c = :period
            WITH USER_MODE
        ]) {
            repStatements.put(cs.Sales_Rep__c, cs);
        }

        List<Commission_Statement__c> newStatements = new List<Commission_Statement__c>();
        for (Id repId : repIds) {
            if (!repStatements.containsKey(repId)) {
                Commission_Statement__c cs = new Commission_Statement__c(
                    Sales_Rep__c = repId,
                    Commission_Plan__c = plan.Id,
                    Period__c = period,
                    Total_Sales_Credited__c = 0,
                    Total_Commission_Earned__c = 0,
                    Quota_Target__c = plan.Quota_Target__c != null ? plan.Quota_Target__c : 100000,
                    Quota_Attainment_Percent__c = 0,
                    Status__c = 'Draft'
                );
                newStatements.add(cs);
            }
        }
        if (!newStatements.isEmpty()) {
            insert as system newStatements;
            for (Commission_Statement__c cs : newStatements) {
                repStatements.put(cs.Sales_Rep__c, cs);
            }
        }

        // Process line items and compute rates
        List<Commission_Line__c> linesToInsert = new List<Commission_Line__c>();
        Map<Id, Commission_Statement__c> toUpdate = new Map<Id, Commission_Statement__c>();

        if (quotes != null) {
            for (Quote__c q : quotes) {
                Id repId = q.OwnerId != null ? q.OwnerId : UserInfo.getUserId();
                Commission_Statement__c stmt = repStatements.get(repId);
                Decimal amount = q.Net_Amount__c != null ? q.Net_Amount__c : (q.Total__c != null ? q.Total__c : 0);
                if (amount <= 0) continue;

                Decimal priorSales = stmt.Total_Sales_Credited__c != null ? stmt.Total_Sales_Credited__c : 0;
                Decimal effectiveRate = evaluateTierRate(plan, priorSales + amount);
                Decimal commissionAmt = (amount * (effectiveRate / 100.0)).setScale(2, RoundingMode.HALF_UP);

                Commission_Line__c cl = new Commission_Line__c(
                    Commission_Statement__c = stmt.Id,
                    Quote__c = q.Id,
                    Account_Name__c = q.Name,
                    Deal_Amount__c = amount,
                    Commission_Rate__c = effectiveRate,
                    Commission_Amount__c = commissionAmt,
                    Event_Type__c = eventType,
                    Event_Date__c = Date.today(),
                    Deal_Reference__c = q.Name
                );
                linesToInsert.add(cl);

                stmt.Total_Sales_Credited__c = priorSales + amount;
                stmt.Total_Commission_Earned__c = (stmt.Total_Commission_Earned__c != null ? stmt.Total_Commission_Earned__c : 0) + commissionAmt;
                if (stmt.Quota_Target__c > 0) {
                    stmt.Quota_Attainment_Percent__c = ((stmt.Total_Sales_Credited__c / stmt.Quota_Target__c) * 100).setScale(2);
                }
                toUpdate.put(stmt.Id, stmt);
            }
        }

        if (invoices != null) {
            for (Invoice__c inv : invoices) {
                Id repId = inv.OwnerId != null ? inv.OwnerId : UserInfo.getUserId();
                Commission_Statement__c stmt = repStatements.get(repId);
                Decimal amount = inv.Total__c != null ? inv.Total__c : 0;
                if (amount <= 0) continue;

                Decimal priorSales = stmt.Total_Sales_Credited__c != null ? stmt.Total_Sales_Credited__c : 0;
                Decimal effectiveRate = evaluateTierRate(plan, priorSales + amount);
                Decimal commissionAmt = (amount * (effectiveRate / 100.0)).setScale(2, RoundingMode.HALF_UP);

                Commission_Line__c cl = new Commission_Line__c(
                    Commission_Statement__c = stmt.Id,
                    Invoice__c = inv.Id,
                    Account_Name__c = inv.Name,
                    Deal_Amount__c = amount,
                    Commission_Rate__c = effectiveRate,
                    Commission_Amount__c = commissionAmt,
                    Event_Type__c = eventType,
                    Event_Date__c = Date.today(),
                    Deal_Reference__c = inv.Name
                );
                linesToInsert.add(cl);

                stmt.Total_Sales_Credited__c = priorSales + amount;
                stmt.Total_Commission_Earned__c = (stmt.Total_Commission_Earned__c != null ? stmt.Total_Commission_Earned__c : 0) + commissionAmt;
                if (stmt.Quota_Target__c > 0) {
                    stmt.Quota_Attainment_Percent__c = ((stmt.Total_Sales_Credited__c / stmt.Quota_Target__c) * 100).setScale(2);
                }
                toUpdate.put(stmt.Id, stmt);
            }
        }

        if (!linesToInsert.isEmpty()) {
            insert as system linesToInsert;
        }
        if (!toUpdate.isEmpty()) {
            update as system toUpdate.values();
        }
    }

    /**
     * Determines the applicable rate based on cumulative sales and plan tier thresholds.
     */
    public static Decimal evaluateTierRate(Commission_Plan__c plan, Decimal cumulativeSales) {
        if (plan == null) return 8.0;

        Decimal base = plan.Base_Rate__c != null ? plan.Base_Rate__c : 8.0;
        Decimal quota = plan.Quota_Target__c != null ? plan.Quota_Target__c : 100000;

        // Check Accelerator (>150% Quota)
        if (plan.Accelerated_Rate__c != null && cumulativeSales >= (quota * 1.5)) {
            return plan.Accelerated_Rate__c;
        }
        // Check Tier 2
        if (plan.Tier_2_Threshold__c != null && plan.Tier_2_Rate__c != null && cumulativeSales >= plan.Tier_2_Threshold__c) {
            return plan.Tier_2_Rate__c;
        }
        // Check Tier 1
        if (plan.Tier_1_Threshold__c != null && plan.Tier_1_Rate__c != null && cumulativeSales >= plan.Tier_1_Threshold__c) {
            return plan.Tier_1_Rate__c;
        }
        return base;
    }

    /**
     * Approves a rep commission statement.
     */
    public static void approveStatement(Id statementId) {
        RevquilaSecurityGuard.requirePermission(RevquilaSecurityGuard.canManageCommissions(), 'approve commission statements');

        Commission_Statement__c stmt = [
            SELECT Id, Name, Status__c, Total_Commission_Earned__c, Sales_Rep__r.Name
            FROM Commission_Statement__c
            WHERE Id = :statementId
            WITH USER_MODE
        ];

        stmt.Status__c = 'Approved';
        stmt.Approved_By__c = UserInfo.getUserId();
        stmt.Approved_Date__c = Date.today();
        update as system stmt;

        RevquilaAuditService.log(
            RevquilaAuditService.EVENT_COMMISSION,
            stmt.Id,
            stmt.Name,
            'Commission_Statement__c',
            'Approve Statement',
            'Pending / Draft',
            'Approved',
            'Commission statement approved for payout of ' + stmt.Total_Commission_Earned__c
        );
    }

    /**
     * Marks a commission statement as paid.
     */
    public static void markPaid(Id statementId, Date paymentDate) {
        RevquilaSecurityGuard.requirePermission(RevquilaSecurityGuard.canManageCommissions(), 'disburse commission payouts');

        Commission_Statement__c stmt = [
            SELECT Id, Name, Status__c, Total_Commission_Earned__c
            FROM Commission_Statement__c
            WHERE Id = :statementId
            WITH SYSTEM_MODE
        ];

        stmt.Status__c = 'Paid';
        stmt.Payment_Date__c = (paymentDate != null) ? paymentDate : Date.today();
        update as system stmt;

        RevquilaAuditService.log(
            RevquilaAuditService.EVENT_COMMISSION,
            stmt.Id,
            stmt.Name,
            'Commission_Statement__c',
            'Disburse Commission',
            'Approved',
            'Paid',
            'Disbursed commission payout on ' + stmt.Payment_Date__c
        );
    }

    /**
     * Formats current period key e.g. 2026-Q1 or 2026-03.
     */
    public static String getCurrentPeriod(String periodType) {
        Integer year = Date.today().year();
        Integer month = Date.today().month();
        if (periodType == 'Quarterly') {
            Integer qtr = ((month - 1) / 3) + 1;
            return year + '-Q' + qtr;
        } else if (periodType == 'Annual') {
            return String.valueOf(year);
        } else {
            String mStr = month < 10 ? '0' + month : String.valueOf(month);
            return year + '-' + mStr;
        }
    }
}
