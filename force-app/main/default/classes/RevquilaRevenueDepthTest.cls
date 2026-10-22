/**
 * RevquilaRevenueDepthTest
 * Test suite for ASC 606 Revenue Recognition depth:
 * 1. Multiple Performance Obligations (SSP allocation)
 * 2. Contract Modifications (Prospective, Cumulative Catch-up, Termination)
 * 3. Credit Note revenue adjustments (Deferred & Contra-Revenue)
 * 4. Unbilled Revenue (Contract Asset) & Usage Accrual
 * 5. Month-End Period Lock Governance (Locking, Reopening, Validation)
 * 6. External Accounting Sync (Tally XML, QuickBooks JSON, Zoho Books JSON)
 * 7. Advanced Reports (Rollforward, Billings vs Revenue, Revenue by Product)
 * 8. Controller endpoints
 */
@IsTest
private class RevquilaRevenueDepthTest {

    @TestSetup
    static void setupData() {
        Account acc = new Account(Name = 'Acme ASC 606 Corp');
        insert acc;

        // Products for Multi-POB testing
        Product2 licProd = new Product2(
            Name = 'Cloud Enterprise License',
            ProductCode = 'LIC-01',
            IsActive = true,
            Recurring__c = true,
            POB_Type__c = 'license',
            Revenue_Method__c = 'ratable',
            SSP__c = 10000.00
        );
        Product2 impProd = new Product2(
            Name = 'FastTrack Implementation',
            ProductCode = 'IMP-01',
            IsActive = true,
            Recurring__c = false,
            POB_Type__c = 'implementation',
            Revenue_Method__c = 'milestone',
            SSP__c = 2000.00
        );
        Product2 supProd = new Product2(
            Name = 'Premium 24x7 Support',
            ProductCode = 'SUP-01',
            IsActive = true,
            Recurring__c = true,
            POB_Type__c = 'support',
            Revenue_Method__c = 'ratable',
            SSP__c = 3000.00
        );
        Product2 usageProd = new Product2(
            Name = 'API Consumption Unit',
            ProductCode = 'USG-01',
            IsActive = true,
            Recurring__c = false,
            Pricing_Method__c = 'usage',
            POB_Type__c = 'usage',
            Revenue_Method__c = 'ratable',
            SSP__c = 1.00
        );
        insert new List<Product2>{ licProd, impProd, supProd, usageProd };

        // Contract & Subscription
        Contract__c contr = new Contract__c(
            Account__c = acc.Id,
            Annual_Value__c = 12000.00,
            Start_Date__c = Date.today().toStartOfMonth(),
            End_Date__c = Date.today().toStartOfMonth().addMonths(12).addDays(-1),
            Status__c = 'active'
        );
        insert contr;

        Subscription__c sub = new Subscription__c(
            Account__c = acc.Id,
            Contract__c = contr.Id,
            Start_Date__c = Date.today().toStartOfMonth(),
            Renewal_Date__c = Date.today().toStartOfMonth().addMonths(12),
            Status__c = 'active',
            Billing_Frequency__c = 'monthly'
        );
        insert sub;

        Subscription_Item__c subItem = new Subscription_Item__c(
            Subscription__c = sub.Id,
            Product__c = licProd.Id,
            Description__c = 'Cloud Enterprise License',
            Quantity__c = 10,
            Unit_Price__c = 120.00
        );
        Subscription_Item__c usageItem = new Subscription_Item__c(
            Subscription__c = sub.Id,
            Product__c = usageProd.Id,
            Description__c = 'API Usage Units',
            Quantity__c = 1000,
            Unit_Price__c = 0.50,
            Usage_Based__c = true,
            Usage_Price__c = 0.50
        );
        insert new List<Subscription_Item__c>{ subItem, usageItem };

        // Invoice with 3 bundled POB lines: Total $10,000 (SSP is $15,000)
        Invoice__c inv = new Invoice__c(
            Account__c = acc.Id,
            Subscription__c = sub.Id,
            Issued_On__c = Date.today(),
            Period_Start__c = Date.today().toStartOfMonth(),
            Period_End__c = Date.today().toStartOfMonth().addMonths(12).addDays(-1),
            Total__c = 10000.00,
            Net_Amount__c = 10000.00,
            Exchange_Rate__c = 1.0,
            Country__c = 'US',
            Currency_Code__c = 'USD'
        );
        insert inv;

        Invoice_Line__c l1 = new Invoice_Line__c(
            Invoice__c = inv.Id,
            Product__c = licProd.Id,
            Quantity__c = 1,
            Unit_Price__c = 8000.00,
            Net_Amount__c = 8000.00,
            Start_Date__c = inv.Period_Start__c,
            End_Date__c = inv.Period_End__c,
            Recurring__c = true,
            Term_Months__c = 12
        );
        Invoice_Line__c l2 = new Invoice_Line__c(
            Invoice__c = inv.Id,
            Product__c = impProd.Id,
            Quantity__c = 1,
            Unit_Price__c = 1000.00,
            Net_Amount__c = 1000.00,
            Start_Date__c = inv.Period_Start__c,
            End_Date__c = inv.Period_Start__c.addMonths(1),
            Recurring__c = false
        );
        Invoice_Line__c l3 = new Invoice_Line__c(
            Invoice__c = inv.Id,
            Product__c = supProd.Id,
            Quantity__c = 1,
            Unit_Price__c = 1000.00,
            Net_Amount__c = 1000.00,
            Start_Date__c = inv.Period_Start__c,
            End_Date__c = inv.Period_End__c,
            Recurring__c = true,
            Term_Months__c = 12
        );
        insert new List<Invoice_Line__c>{ l1, l2, l3 };
    }

    @IsTest
    static void testMultiPOBStandaloneSellingPriceAllocation() {
        Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];

        Test.startTest();
        // Invoke Revenue Scheduling with Multi-POB Standalone Selling Price allocation
        RevquilaRevenue.scheduleFor(inv.Id);
        Test.stopTest();

        List<Revenue_Schedule__c> schedules = [
            SELECT Id, Product__r.Name, POB_Type__c, SSP_Price__c, Allocated_Amount__c, Total__c, Method__c,
                   (SELECT Id, Amount__c, Recognized__c FROM Periods__r)
            FROM Revenue_Schedule__c
            WHERE Invoice__c = :inv.Id
            ORDER BY Allocated_Amount__c DESC
        ];

        Assert.areEqual(3, schedules.size(), 'Should create 3 revenue schedules for 3 POB lines');

        Decimal sumAllocated = 0;
        for (Revenue_Schedule__c sch : schedules) {
            sumAllocated += sch.Allocated_Amount__c;
            Assert.isTrue(sch.Allocated_Amount__c > 0, 'Allocated amount must be positive');
            Assert.isNotNull(sch.POB_Type__c, 'POB type must be populated');
            Assert.isFalse(sch.Periods__r.isEmpty(), 'Lines should be generated for schedule');
        }
        Assert.areEqual(10000.00, sumAllocated, 'Sum of allocated amounts must equal total invoice price');
    }

    @IsTest
    static void testContractModificationProspectiveAndTermination() {
        Invoice__c inv = [SELECT Id, Subscription__c FROM Invoice__c LIMIT 1];
        RevquilaRevenue.scheduleFor(inv.Id);

        Test.startTest();
        // 1. Prospective Modification (e.g. Plan Upgrade)
        RevquilaRevenueDepthService.handleContractModification(inv.Subscription__c, 'prospective', 'Upgraded to Premium tier');

        List<Revenue_Schedule__c> modifiedSchedules = [
            SELECT Id, Modification_Type__c
            FROM Revenue_Schedule__c
            WHERE Subscription__c = :inv.Subscription__c
        ];
        Assert.areEqual('prospective', modifiedSchedules[0].Modification_Type__c);

        // 2. Cumulative Catch-up Modification
        RevquilaRevenueDepthService.handleContractModification(inv.Subscription__c, 'cumulative_catch_up', 'Mid-term adjustment');
        modifiedSchedules = [
            SELECT Id, Modification_Type__c
            FROM Revenue_Schedule__c
            WHERE Subscription__c = :inv.Subscription__c
        ];
        Assert.areEqual('cumulative_catch_up', modifiedSchedules[0].Modification_Type__c);

        // 3. Termination
        RevquilaRevenueDepthService.handleContractModification(inv.Subscription__c, 'termination', 'Customer cancelled');
        modifiedSchedules = [
            SELECT Id, Status__c, Modification_Type__c
            FROM Revenue_Schedule__c
            WHERE Subscription__c = :inv.Subscription__c
        ];
        Assert.areEqual('complete', modifiedSchedules[0].Status__c);
        Assert.areEqual('termination', modifiedSchedules[0].Modification_Type__c);
        Test.stopTest();
    }

    @IsTest
    static void testCreditNoteRevenueAdjustment() {
        Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
        RevquilaRevenue.scheduleFor(inv.Id);

        Test.startTest();
        // Create partial credit note
        Credit_Note__c cn = new Credit_Note__c(
            Invoice__c = inv.Id,
            Amount__c = 500.00,
            Reason__c = 'SLA breach credit',
            Issued_On__c = Date.today()
        );
        insert cn; // RevquilaCreditNoteTrigger fires

        // Create excess credit note testing contra-revenue creation
        Credit_Note__c excessCn = new Credit_Note__c(
            Invoice__c = inv.Id,
            Amount__c = 20000.00,
            Reason__c = 'Full goodwill refund',
            Issued_On__c = Date.today()
        );
        insert excessCn;
        Test.stopTest();

        List<Revenue_Schedule_Line__c> contraLines = [
            SELECT Id, Amount__c, Adjustment_Type__c, Recognized__c
            FROM Revenue_Schedule_Line__c
            WHERE Adjustment_Type__c = 'credit_note' AND Amount__c < 0
        ];
        Assert.isFalse(contraLines.isEmpty(), 'Contra-revenue line must be created for excess credit');
    }

    @IsTest
    static void testUnbilledRevenueContractAssetEngine() {
        Subscription__c sub = [SELECT Id FROM Subscription__c LIMIT 1];
        Subscription_Item__c uItem = [SELECT Id FROM Subscription_Item__c WHERE Usage_Based__c = TRUE LIMIT 1];

        // Insert unbilled usage records
        insert new Usage_Record__c(
            Subscription__c = sub.Id,
            Subscription_Item__c = uItem.Id,
            Quantity__c = 200,
            Usage_Date__c = Date.today(),
            Billed__c = false
        );

        Test.startTest();
        Decimal unbilled = RevquilaRevenueDepthService.calculateUnbilledRevenue(sub.Id);
        Assert.areEqual(100.00, unbilled, '200 units * 0.50 rate = $100 unbilled revenue');

        // Accrue unbilled usage
        Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
        RevquilaRevenue.scheduleFor(inv.Id);
        RevquilaRevenueDepthService.accrueUnbilledRevenue(sub.Id, Date.today());
        Test.stopTest();

        List<Revenue_Schedule_Line__c> accrualLines = [
            SELECT Id, Amount__c, Adjustment_Type__c
            FROM Revenue_Schedule_Line__c
            WHERE Adjustment_Type__c = 'unbilled_accrual'
        ];
        Assert.isFalse(accrualLines.isEmpty(), 'Unbilled revenue accrual line must be inserted');
    }

    @IsTest
    static void testPeriodLockGovernanceAndValidation() {
        Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
        RevquilaRevenue.scheduleFor(inv.Id);

        Date startLock = Date.today().toStartOfMonth();
        Date endLock = startLock.addMonths(1).addDays(-1);

        Test.startTest();
        // 1. Lock period
        Revenue_Period_Lock__c lockRec = RevquilaRevenueDepthService.lockPeriod(startLock, endLock, 'Month-end close FY26');
        Assert.areEqual('Locked', lockRec.Status__c);

        // 2. Attempt to update line in locked period (should be blocked by trigger)
        Revenue_Schedule_Line__c lineInPeriod = [
            SELECT Id, Amount__c, Period_Locked__c, Period_End__c
            FROM Revenue_Schedule_Line__c
            WHERE Period_End__c >= :startLock AND Period_End__c <= :endLock
            LIMIT 1
        ];

        Boolean failed = false;
        try {
            lineInPeriod.Amount__c = 9999.00;
            update lineInPeriod;
        } catch (Exception e) {
            failed = true;
        }
        Assert.isTrue(failed, 'Update to line in locked period must fail validation');

        // 3. Reopen period with mandatory reason
        Revenue_Period_Lock__c reopened = RevquilaRevenueDepthService.reopenPeriod(lockRec.Id, 'Auditor requested restatement');
        Assert.areEqual('Reopened', reopened.Status__c);
        Assert.areEqual('Auditor requested restatement', reopened.Reopened_Reason__c);

        // 4. Update is now permitted
        lineInPeriod.Amount__c = 850.00;
        update lineInPeriod;
        Assert.areEqual(850.00, lineInPeriod.Amount__c);
        Test.stopTest();
    }

    @IsTest
    static void testExternalAccountingSyncGenerators() {
        Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
        RevquilaRevenue.scheduleFor(inv.Id);
        RevquilaRevenue.recognize(Date.today().addMonths(1));

        Date fromDate = Date.today().toStartOfMonth().addMonths(-1);
        Date toDate = Date.today().addMonths(6);

        Test.startTest();
        String tallyXml = RevquilaRevenueDepthService.generateTallyXml(fromDate, toDate);
        Assert.isTrue(tallyXml.contains('<TALLYREQUEST>Import Data</TALLYREQUEST>'), 'Should generate Tally XML header');

        String qbJson = RevquilaRevenueDepthService.generateQuickBooksJson(fromDate, toDate);
        Assert.isTrue(qbJson.contains('BatchItemRequest'), 'Should generate QuickBooks batch request');

        String zohoJson = RevquilaRevenueDepthService.generateZohoBooksJson(fromDate, toDate);
        Assert.isTrue(zohoJson.contains('journals'), 'Should generate Zoho Books journals');
        Test.stopTest();
    }

    @IsTest
    static void testASC606AdvancedReporting() {
        Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
        RevquilaRevenue.scheduleFor(inv.Id);

        Date fromDate = Date.today().toStartOfMonth().addMonths(-2);
        Date toDate = Date.today().toStartOfMonth().addMonths(4);

        Test.startTest();
        RevquilaRevenueDepthService.RollforwardReport rollforward = RevquilaRevenueDepthService.getRollforwardReport(fromDate, toDate);
        Assert.isNotNull(rollforward);
        Assert.isTrue(rollforward.newBillings >= 0);

        List<RevquilaRevenueDepthService.BillingVsRevenueMonth> billVsRev = RevquilaRevenueDepthService.getBillingsVsRevenue(fromDate, toDate);
        Assert.isFalse(billVsRev.isEmpty(), 'Billings vs revenue list should not be empty');

        List<RevquilaRevenueDepthService.ProductRevenueSummary> prodRev = RevquilaRevenueDepthService.getRevenueByProduct(fromDate, toDate);
        Assert.isFalse(prodRev.isEmpty(), 'Product revenue breakdown should not be empty');
        Test.stopTest();
    }

    @IsTest
    static void testRevquilaRevenueControllerEndpoints() {
        Invoice__c inv = [SELECT Id, Subscription__c FROM Invoice__c LIMIT 1];
        RevquilaRevenue.scheduleFor(inv.Id);

        Test.startTest();
        RevquilaRevenue.Overview overview = RevquilaRevenueController.getRevenue();
        Assert.isNotNull(overview);
        Assert.isFalse(overview.schedules.isEmpty());

        // Controller period lock endpoints
        Date startLock = Date.today().toStartOfMonth().addMonths(1);
        Date endLock = startLock.addMonths(1).addDays(-1);
        String lockMsg = RevquilaRevenueController.lockAccountingPeriod(startLock, endLock, 'Audit close');
        Assert.isTrue(lockMsg.contains('locked'));

        List<RevquilaRevenueDepthService.PeriodLockView> locks = RevquilaRevenueController.getPeriodLocks();
        Assert.isFalse(locks.isEmpty());

        String reopenMsg = RevquilaRevenueController.reopenAccountingPeriod(locks[0].id, 'Adjustment needed');
        Assert.isTrue(reopenMsg.contains('reopened'));

        // Controller report endpoints
        RevquilaRevenueDepthService.RollforwardReport rf = RevquilaRevenueController.getRollforwardReport(null, null);
        Assert.isNotNull(rf);

        List<RevquilaRevenueDepthService.BillingVsRevenueMonth> bvr = RevquilaRevenueController.getBillingsVsRevenue(null, null);
        Assert.isNotNull(bvr);

        List<RevquilaRevenueDepthService.ProductRevenueSummary> rbp = RevquilaRevenueController.getRevenueByProduct(null, null);
        Assert.isNotNull(rbp);

        // Controller accounting sync
        String tally = RevquilaRevenueController.exportAccountingSync('tally', null, null);
        Assert.isTrue(String.isNotBlank(tally));

        String qb = RevquilaRevenueController.exportAccountingSync('quickbooks', null, null);
        Assert.isTrue(String.isNotBlank(qb));

        String zoho = RevquilaRevenueController.exportAccountingSync('zoho', null, null);
        Assert.isTrue(String.isNotBlank(zoho));

        String csv = RevquilaRevenueController.exportAccountingSync('csv', null, null);
        Assert.isTrue(String.isNotBlank(csv));

        // Controller unbilled revenue
        Decimal unbilledAmt = RevquilaRevenueController.getUnbilledRevenue(inv.Subscription__c);
        Assert.isNotNull(unbilledAmt);

        String accrueMsg = RevquilaRevenueController.accrueUnbilledRevenue(inv.Subscription__c, Date.today());
        Assert.isTrue(accrueMsg.contains('accrued'));

        // Other existing controller methods
        String backfillMsg = RevquilaRevenueController.backfill();
        Assert.isNotNull(backfillMsg);

        String recMsg = RevquilaRevenueController.recognizeNow();
        Assert.isNotNull(recMsg);

        RevquilaRevenue.Overview revOverview = RevquilaRevenueController.getRevenue();
        Assert.isNotNull(revOverview);

        String journalCsv = RevquilaRevenueController.exportJournal(Date.today().addDays(-30), Date.today().addDays(30), false);
        Assert.isNotNull(journalCsv);

        List<Revenue_Schedule__c> scheds = [SELECT Id FROM Revenue_Schedule__c LIMIT 1];
        if (!scheds.isEmpty()) {
            RevquilaRevenueController.recognizeSchedule(scheds[0].Id);
        }
        Test.stopTest();
    }
}
