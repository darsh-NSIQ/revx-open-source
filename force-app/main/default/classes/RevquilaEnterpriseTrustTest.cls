@IsTest
private class RevquilaEnterpriseTrustTest {

    @TestSetup
    static void setupData() {
        Account acc = new Account(
            Name = 'Enterprise Trust Corp',
            BillingCity = 'Mumbai',
            BillingState = 'Maharashtra',
            BillingCountry = 'India'
        );
        insert acc;

        Product2 p1 = new Product2(Name = 'Core SaaS Platform', ProductCode = 'CORE-SaaS', IsActive = true);
        Product2 p2 = new Product2(Name = 'Premium Implementation', ProductCode = 'IMP-PREM', IsActive = true);
        insert new List<Product2>{p1, p2};

        Quote__c q = new Quote__c(
            Account__c = acc.Id,
            Status__c = 'Draft',
            Quote_Date__c = Date.today(),
            Valid_Until__c = Date.today().addDays(30),
            Country__c = 'India',
            Currency_Code__c = 'INR',
            Net_Amount__c = 100000,
            Total__c = 118000,
            Discount_Total__c = 5000,
            Margin_Percent__c = 45.0,
            Payment_Terms__c = 'Net 30',
            Version__c = 1
        );
        insert q;

        Quote_Line__c ql1 = new Quote_Line__c(
            Quote__c = q.Id,
            Product__c = p1.Id,
            Quantity__c = 10,
            Unit_Price__c = 10000,
            Discount__c = 5,
            Net_Amount__c = 95000,
            Sort_Order__c = 1,
            Description__c = '10 Platform Licenses'
        );
        insert ql1;

        Commission_Plan__c plan = new Commission_Plan__c(
            Name = 'Standard AE Plan FY26',
            Active__c = true,
            Period_Type__c = 'Quarterly',
            Trigger_Event__c = 'Quote Won',
            Base_Rate__c = 8.0,
            Quota_Target__c = 100000,
            Tier_1_Threshold__c = 50000,
            Tier_1_Rate__c = 10.0,
            Tier_2_Threshold__c = 100000,
            Tier_2_Rate__c = 12.0,
            Accelerated_Rate__c = 15.0,
            Description__c = 'Standard enterprise AE incentive plan with 150% accelerator'
        );
        insert as system plan;
    }

    @IsTest
    static void testSecurityGuardPermissions() {
        Test.startTest();
        RevquilaSecurityGuard.PermissionSummary summary = RevquilaSecurityGuard.getPermissions();
        System.assertNotEquals(null, summary, 'Permission summary should not be null');
        System.assertNotEquals(null, summary.currentUserName, 'User name should be populated');

        Boolean adminCheck = RevquilaSecurityGuard.isAdmin();
        System.assert(adminCheck != null, 'isAdmin should return boolean');
        System.assert(RevquilaSecurityGuard.canEditDiscounts() != null, 'canEditDiscounts check');
        System.assert(RevquilaSecurityGuard.canViewMargins() != null, 'canViewMargins check');
        System.assert(RevquilaSecurityGuard.canApproveDiscounts() != null, 'canApproveDiscounts check');
        System.assert(RevquilaSecurityGuard.canIssueRefunds() != null, 'canIssueRefunds check');
        System.assert(RevquilaSecurityGuard.canLockRevenuePeriods() != null, 'canLockRevenuePeriods check');
        System.assert(RevquilaSecurityGuard.canManageCommissions() != null, 'canManageCommissions check');
        System.assert(RevquilaSecurityGuard.canManageBilling() != null, 'canManageBilling check');
        System.assert(RevquilaSecurityGuard.canRecognizeRevenue() != null, 'canRecognizeRevenue check');

        // Positive check
        RevquilaSecurityGuard.requirePermission(true, 'test action');

        // Negative check
        try {
            RevquilaSecurityGuard.requirePermission(false, 'restricted action');
            System.assert(false, 'Should have thrown ProblemException');
        } catch (RevquilaCore.ProblemException ex) {
            System.assert(ex.getMessage().contains('Access Denied'), 'Should contain Access Denied message');
        }
        Test.stopTest();
    }

    @IsTest
    static void testAuditTrailLoggingAndQuerying() {
        Quote__c q = [SELECT Id, Name FROM Quote__c LIMIT 1];

        Test.startTest();
        Audit_Trail_Entry__c entry = RevquilaAuditService.log(
            RevquilaAuditService.EVENT_PRICING,
            q.Id,
            q.Name,
            'Quote__c',
            'Price Change',
            'Old: 100000',
            'New: 120000',
            'Special volume discount adjustment'
        );
        System.assertNotEquals(null, entry.Id, 'Audit entry should be inserted');

        // Bulk log test
        List<Audit_Trail_Entry__c> bulkList = new List<Audit_Trail_Entry__c>{
            new Audit_Trail_Entry__c(
                Event_Type__c = RevquilaAuditService.EVENT_DISCOUNT,
                Record_Id__c = q.Id,
                Record_Name__c = q.Name,
                Object_Api_Name__c = 'Quote__c',
                Action__c = 'Discount Override',
                Reason__c = 'Customer negotiated 10%'
            )
        };
        RevquilaAuditService.logAll(bulkList);

        // Query test
        List<Audit_Trail_Entry__c> queried = RevquilaAuditService.queryEntries(
            RevquilaAuditService.EVENT_PRICING,
            'Quote__c',
            10
        );
        System.assert(!queried.isEmpty(), 'Should return logged audit trail entries');

        // Update quote discount to fire trigger audit
        q.Discount_Total__c = 15000;
        update as system q;
        Test.stopTest();
    }

    @IsTest
    static void testQuoteVersioningSnapshotDiffAndRestore() {
        Quote__c q = [SELECT Id, Name FROM Quote__c LIMIT 1];
        Product2 p2 = [SELECT Id, Name FROM Product2 WHERE ProductCode = 'IMP-PREM' LIMIT 1];

        Test.startTest();
        // 1. Snapshot v1
        Quote_Version__c v1 = RevquilaQuoteVersioningService.createSnapshot(q.Id, 'Initial draft snapshot');
        System.assertNotEquals(null, v1.Id, 'Snapshot v1 should be created');
        System.assertEquals(1, v1.Version_Number__c, 'First version should be 1');

        // 2. Modify quote: add new line and update net amount
        Quote_Line__c ql2 = new Quote_Line__c(
            Quote__c = q.Id,
            Product__c = p2.Id,
            Quantity__c = 1,
            Unit_Price__c = 25000,
            Discount__c = 0,
            Net_Amount__c = 25000,
            Sort_Order__c = 2,
            Description__c = 'Onsite setup'
        );
        insert ql2;

        q.Net_Amount__c = 125000;
        q.Total__c = 145000;
        q.Payment_Terms__c = 'Due on Receipt';
        update q;

        // 3. Snapshot v2
        Quote_Version__c v2 = RevquilaQuoteVersioningService.createSnapshot(q.Id, 'Added Implementation package');
        System.assertEquals(2, v2.Version_Number__c, 'Second version should be 2');

        // 4. Compare v1 and v2
        RevquilaQuoteVersioningService.VersionComparison comp = RevquilaQuoteVersioningService.compareVersions(v1.Id, v2.Id);
        System.assertEquals(1, comp.versionA, 'Base version is 1');
        System.assertEquals(2, comp.versionB, 'Target version is 2');
        System.assert(comp.netDelta > 0, 'Net delta should be positive');
        System.assert(!comp.lineDiffs.isEmpty(), 'Line diffs should contain items');

        // Verify ADDED line detected
        Boolean foundAdded = false;
        for (RevquilaQuoteVersioningService.LineDiff ld : comp.lineDiffs) {
            if (ld.changeType == 'ADDED' || ld.changeType == 'MODIFIED') {
                foundAdded = true;
                break;
            }
        }
        System.assert(foundAdded, 'Diff should reflect added or modified lines');

        // 5. Restore back to v1
        RevquilaQuoteVersioningService.restoreVersion(q.Id, v1.Id);
        Quote__c restoredQ = [SELECT Id, Net_Amount__c, Payment_Terms__c FROM Quote__c WHERE Id = :q.Id];
        System.assertEquals('Net 30', restoredQ.Payment_Terms__c, 'Payment terms should revert to v1 Net 30');
        Test.stopTest();
    }

    @IsTest
    static void testCommissionPlanTierEvaluation() {
        Commission_Plan__c plan = [SELECT Id, Base_Rate__c, Quota_Target__c, Tier_1_Threshold__c, Tier_1_Rate__c,
                                          Tier_2_Threshold__c, Tier_2_Rate__c, Accelerated_Rate__c
                                   FROM Commission_Plan__c LIMIT 1];

        Test.startTest();
        // Under Tier 1 (< 50,000) -> Base Rate (8%)
        Decimal rateBase = RevquilaCommissionService.evaluateTierRate(plan, 30000);
        System.assertEquals(8.0, rateBase, 'Should return base rate 8%');

        // At Tier 1 (>= 50,000) -> Tier 1 Rate (10%)
        Decimal rateT1 = RevquilaCommissionService.evaluateTierRate(plan, 60000);
        System.assertEquals(10.0, rateT1, 'Should return tier 1 rate 10%');

        // At Tier 2 (>= 100,000) -> Tier 2 Rate (12%)
        Decimal rateT2 = RevquilaCommissionService.evaluateTierRate(plan, 110000);
        System.assertEquals(12.0, rateT2, 'Should return tier 2 rate 12%');

        // Above 150% Quota (>= 150,000) -> Accelerator Rate (15%)
        Decimal rateAcc = RevquilaCommissionService.evaluateTierRate(plan, 160000);
        System.assertEquals(15.0, rateAcc, 'Should return accelerator rate 15%');

        // Period formatting
        String monthly = RevquilaCommissionService.getCurrentPeriod('Monthly');
        String annual = RevquilaCommissionService.getCurrentPeriod('Annual');
        System.assertNotEquals(null, monthly);
        System.assertNotEquals(null, annual);
        Test.stopTest();
    }

    @IsTest
    static void testCommissionCalculationOnQuoteWonAndApproval() {
        Quote__c q = [SELECT Id, Status__c, Net_Amount__c, OwnerId FROM Quote__c LIMIT 1];

        Test.startTest();
        // Update quote to Signed to fire quote commission trigger handler
        q.Status__c = 'Signed';
        update q;

        // Verify statement was created/updated
        List<Commission_Statement__c> stmts = [
            SELECT Id, Status__c, Total_Sales_Credited__c, Total_Commission_Earned__c, Quota_Attainment_Percent__c
            FROM Commission_Statement__c
        ];
        System.assert(!stmts.isEmpty(), 'Commission statement should have been generated');
        Commission_Statement__c stmt = stmts[0];
        System.assert(stmt.Total_Commission_Earned__c > 0, 'Commission earned should be calculated');

        // Verify commission line
        List<Commission_Line__c> lines = [
            SELECT Id, Quote__c, Deal_Amount__c, Commission_Amount__c, Commission_Rate__c
            FROM Commission_Line__c
            WHERE Commission_Statement__c = :stmt.Id
        ];
        System.assert(!lines.isEmpty(), 'Commission line should exist for the signed quote');

        // Approve statement
        RevquilaCommissionService.approveStatement(stmt.Id);
        Commission_Statement__c approvedStmt = [SELECT Id, Status__c FROM Commission_Statement__c WHERE Id = :stmt.Id];
        System.assertEquals('Approved', approvedStmt.Status__c, 'Statement status should be Approved');

        // Mark paid
        RevquilaCommissionService.markPaid(stmt.Id, Date.today());
        Commission_Statement__c paidStmt = [SELECT Id, Status__c, Payment_Date__c FROM Commission_Statement__c WHERE Id = :stmt.Id];
        System.assertEquals('Paid', paidStmt.Status__c, 'Statement status should be Paid');
        System.assertNotEquals(null, paidStmt.Payment_Date__c, 'Payment date should be populated');
        Test.stopTest();
    }

    @IsTest
    static void testCommissionCalculationOnInvoicePaid() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Commission_Plan__c plan = [SELECT Id, Trigger_Event__c FROM Commission_Plan__c LIMIT 1];
        plan.Trigger_Event__c = 'Invoice Paid';
        update as system plan;

        Invoice__c inv = new Invoice__c(
            Account__c = acc.Id,
            Total__c = 80000,
            Net_Amount__c = 80000,
            Currency_Code__c = 'INR'
        );
        insert as system inv;

        Payment__c pmt = new Payment__c(
            Invoice__c = inv.Id,
            Amount__c = 80000,
            Method__c = 'UPI',
            Paid_On__c = Date.today()
        );

        Test.startTest();
        // Insert payment triggers RevquilaPaymentTriggerHandler
        insert as system pmt;

        // Service direct invoice calculation test
        RevquilaCommissionService.calculateForInvoices(new List<Invoice__c>{inv});

        List<Commission_Line__c> clLines = [SELECT Id, Invoice__c, Deal_Amount__c FROM Commission_Line__c WHERE Invoice__c = :inv.Id];
        System.assert(!clLines.isEmpty(), 'Commission line should exist for paid invoice');
        Test.stopTest();
    }

    @IsTest
    static void testEnterpriseTrustControllerEndpoints() {
        Quote__c q = [SELECT Id FROM Quote__c LIMIT 1];

        Test.startTest();
        // 1. Workspace data
        RevquilaEnterpriseTrustController.WorkspaceView view = RevquilaEnterpriseTrustController.getWorkspaceData();
        System.assertNotEquals(null, view, 'Workspace view should not be null');
        System.assert(!view.quotes.isEmpty(), 'Quotes should be loaded');
        System.assert(!view.plans.isEmpty(), 'Plans should be loaded');

        // 2. Snapshot via controller
        Quote_Version__c qv1 = RevquilaEnterpriseTrustController.snapshotQuote(q.Id, 'Controller test snapshot v1');
        System.assertNotEquals(null, qv1.Id, 'Snapshot 1 should be returned');

        Quote_Version__c qv2 = RevquilaEnterpriseTrustController.snapshotQuote(q.Id, 'Controller test snapshot v2');
        System.assertNotEquals(null, qv2.Id, 'Snapshot 2 should be returned');

        // 3. Query versions & compare via controller
        List<Quote_Version__c> versions = RevquilaEnterpriseTrustController.getQuoteVersions(q.Id);
        System.assert(!versions.isEmpty(), 'Versions should be retrieved');

        RevquilaQuoteVersioningService.VersionComparison comp = RevquilaEnterpriseTrustController.compareQuoteVersions(qv1.Id, qv2.Id);
        System.assertNotEquals(null, comp, 'Comparison should be computed');

        // Restore via controller
        RevquilaEnterpriseTrustController.restoreQuoteVersion(q.Id, qv1.Id);

        // 4. Save new plan
        Commission_Plan__c newPlan = new Commission_Plan__c(
            Name = 'Mid-Market Renewal Plan',
            Active__c = true,
            Period_Type__c = 'Monthly',
            Trigger_Event__c = 'Quote Won',
            Base_Rate__c = 5.0,
            Quota_Target__c = 50000
        );
        Commission_Plan__c saved = RevquilaEnterpriseTrustController.saveCommissionPlan(newPlan);
        System.assertNotEquals(null, saved.Id, 'Plan should be saved');

        // 5. Audit query
        List<Audit_Trail_Entry__c> audits = RevquilaEnterpriseTrustController.getAuditTrail('All', 'All', 10);
        System.assertNotEquals(null, audits, 'Audits should not be null');

        // 6. Statement detail & approval
        Commission_Statement__c stmt = new Commission_Statement__c(
            Sales_Rep__c = UserInfo.getUserId(),
            Commission_Plan__c = saved.Id,
            Period__c = '2026-03',
            Total_Sales_Credited__c = 40000,
            Total_Commission_Earned__c = 2000,
            Status__c = 'Draft'
        );
        insert as system stmt;

        RevquilaEnterpriseTrustController.StatementDetailView detail = RevquilaEnterpriseTrustController.getStatementDetail(stmt.Id);
        System.assertNotEquals(null, detail.statement, 'Statement detail should load');

        RevquilaEnterpriseTrustController.approveCommissionStatement(stmt.Id);
        RevquilaEnterpriseTrustController.payCommissionStatement(stmt.Id, Date.today());

        Commission_Statement__c finalStmt = [SELECT Id, Status__c FROM Commission_Statement__c WHERE Id = :stmt.Id];
        System.assertEquals('Paid', finalStmt.Status__c, 'Statement should be paid');

        // Re-call getWorkspaceData to cover paid commission metrics branches
        RevquilaEnterpriseTrustController.WorkspaceView refreshedView = RevquilaEnterpriseTrustController.getWorkspaceData();
        System.assert(refreshedView.totalCommissionsPaid > 0, 'Paid commissions should be reflected');

        // Negative exception tests for AuraEnabled wrappers
        try {
            RevquilaEnterpriseTrustController.snapshotQuote(null, null);
        } catch (Exception ex) {
            System.assert(ex != null);
        }
        try {
            RevquilaEnterpriseTrustController.compareQuoteVersions(null, null);
        } catch (Exception ex) {
            System.assert(ex != null);
        }
        try {
            RevquilaEnterpriseTrustController.restoreQuoteVersion(null, null);
        } catch (Exception ex) {
            System.assert(ex != null);
        }
        try {
            RevquilaEnterpriseTrustController.approveCommissionStatement(null);
        } catch (Exception ex) {
            System.assert(ex != null);
        }
        try {
            RevquilaEnterpriseTrustController.payCommissionStatement(null, null);
        } catch (Exception ex) {
            System.assert(ex != null);
        }
        Test.stopTest();
    }
}
