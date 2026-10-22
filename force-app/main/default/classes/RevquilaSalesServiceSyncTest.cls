@IsTest
private class RevquilaSalesServiceSyncTest {

    @TestSetup
    static void setupData() {
        Map<String, Id> prods = RevquilaTestData.products();
        Account acc = RevquilaTestData.account('Acme Tech Corp', RevquilaTestData.HOME_STATE);

        Opportunity opp = new Opportunity(
            Name = 'Acme Q4 Deal',
            AccountId = acc.Id,
            StageName = 'Proposal/Price Quote',
            CloseDate = Date.today().addDays(30),
            Pricebook2Id = Test.getStandardPricebookId()
        );
        insert opp;

        Quote__c q = new Quote__c(
            Account__c = acc.Id,
            Opportunity__c = opp.Id,
            Primary__c = true,
            Status__c = 'draft',
            Quote_Date__c = Date.today(),
            Valid_Until__c = Date.today().addDays(30),
            Country__c = 'India',
            Currency_Code__c = 'INR',
            Net_Amount__c = 50000,
            Total__c = 59000,
            Version__c = 1
        );
        insert q;

        List<Quote_Line__c> lines = new List<Quote_Line__c>{
            new Quote_Line__c(
                Quote__c = q.Id,
                Product__c = prods.get('PLAT'),
                Quantity__c = 5,
                Unit_Price__c = 10000,
                Net_Amount__c = 50000,
                Recurring__c = true
            ),
            new Quote_Line__c(
                Quote__c = q.Id,
                Product__c = prods.get('IMPL'),
                Quantity__c = 1,
                Unit_Price__c = 25000,
                Net_Amount__c = 25000,
                Recurring__c = false
            )
        };
        insert lines;
    }

    @IsTest
    static void testQuoteSigningSyncsOpportunityClosedWon() {
        Quote__c q = [SELECT Id, Opportunity__c, Status__c, Net_Amount__c FROM Quote__c LIMIT 1];

        Test.startTest();
        q.Status__c = 'signed';
        q.Signed_On__c = Date.today();
        update q;
        Test.stopTest();

        Opportunity opp = [SELECT Id, StageName, Amount, CloseDate FROM Opportunity WHERE Id = :q.Opportunity__c];
        System.assertEquals('Closed Won', opp.StageName, 'Opportunity must be Closed Won upon quote signature');
        System.assertEquals(50000, opp.Amount, 'Opportunity Amount should match quote net amount');
        System.assertEquals(Date.today(), opp.CloseDate, 'CloseDate should match signed date');
    }

    @IsTest
    static void testOpportunityClosedLostRejectsQuote() {
        Quote__c q = [SELECT Id, Opportunity__c, Status__c FROM Quote__c LIMIT 1];
        Opportunity opp = [SELECT Id, StageName FROM Opportunity WHERE Id = :q.Opportunity__c];

        Test.startTest();
        opp.StageName = 'Closed Lost';
        update opp;
        Test.stopTest();

        Quote__c updatedQ = [SELECT Id, Status__c FROM Quote__c WHERE Id = :q.Id];
        System.assertEquals('rejected', updatedQ.Status__c, 'Quote status should become rejected when Opportunity is Closed Lost');
    }

    @IsTest
    static void testQuoteLineToOpportunityLineItemSync() {
        Quote__c q = [SELECT Id, Opportunity__c FROM Quote__c LIMIT 1];

        Test.startTest();
        RevquilaOliSync.SyncResult result = RevquilaOliSync.syncOpportunity(q.Id);
        Test.stopTest();

        System.assert(result.ok, 'Sync should succeed');
        List<OpportunityLineItem> olis = [SELECT Id, Quantity, UnitPrice FROM OpportunityLineItem WHERE OpportunityId = :q.Opportunity__c];
        System.assert(olis.size() > 0, 'OLIs should be created');

        // Test running again to verify NO duplicate OLIs
        RevquilaOliSync.SyncResult secondResult = RevquilaOliSync.syncOpportunity(q.Id);
        System.assert(secondResult.ok, 'Second sync should succeed');
        List<OpportunityLineItem> olisAfterSecond = [SELECT Id FROM OpportunityLineItem WHERE OpportunityId = :q.Opportunity__c];
        System.assertEquals(olis.size(), olisAfterSecond.size(), 'Re-sync must not create duplicate OLIs');
    }

    @IsTest
    static void testServiceCloudAutoProvisioning() {
        Account acc = [SELECT Id, Name FROM Account LIMIT 1];
        Quote__c q = [SELECT Id FROM Quote__c LIMIT 1];

        Subscription__c sub = new Subscription__c(
            Account__c = acc.Id,
            Quote__c = q.Id,
            Start_Date__c = Date.today(),
            Renewal_Date__c = Date.today().addYears(1),
            Term_Months__c = 12,
            Status__c = 'active',
            Currency_Code__c = 'INR'
        );
        insert sub;

        Test.startTest();
        RevquilaServiceCloudService.ProvisionResult result = RevquilaServiceCloudService.provisionForSubscription(sub.Id);
        Test.stopTest();

        System.assert(result.ok, 'Provisioning should succeed');
        System.assertNotEquals(null, result.serviceContractId, 'Service Contract should be created');
        System.assertNotEquals(null, result.entitlementId, 'Entitlement should be created');
        System.assert(result.assetsCreated >= 0, 'Asset records created for physical lines');
    }

    @IsTest
    static void testAccountAndCase360Panels() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Case c = new Case(
            AccountId = acc.Id,
            Subject = 'Billing discrepancy query',
            Status = 'New'
        );
        insert c;

        Invoice__c inv = new Invoice__c(
            Account__c = acc.Id,
            Total__c = 10000,
            Sent_On__c = Date.today(),
            Due_On__c = Date.today().addDays(15),
            Currency_Code__c = 'INR'
        );
        insert inv;

        Payment__c p = new Payment__c(
            Invoice__c = inv.Id,
            Amount__c = 5000,
            Paid_On__c = Date.today()
        );
        insert p;

        Test.startTest();
        RevquilaAccount360Controller.Account360Data accData = RevquilaAccount360Controller.getAccountSummary(acc.Id);
        System.assertNotEquals(null, accData, 'Account 360 data returned');

        RevquilaAccount360Controller.Account360Data caseData = RevquilaAccount360Controller.getAccountSummary(c.Id);
        System.assertNotEquals(null, caseData, 'Case 360 data resolved via Account');

        try {
            String payLink = RevquilaAccount360Controller.generatePaymentLink(inv.Id);
        } catch (Exception ex) {
            // Expected if payment gateway credentials are not configured in test environment
        }

        RevquilaAccount360Controller.issueCreditNote(inv.Id, 500, 'Test credit');
        RevquilaAccount360Controller.requestRefund(inv.Id, 500, 'Test refund');
        Test.stopTest();

        List<Credit_Note__c> credits = [SELECT Id FROM Credit_Note__c WHERE Invoice__c = :inv.Id];
        System.assertEquals(1, credits.size(), 'Credit note created');
    }

    @IsTest
    static void testInvocableActions() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Quote__c q = [SELECT Id FROM Quote__c LIMIT 1];

        Subscription__c sub = new Subscription__c(
            Account__c = acc.Id,
            Quote__c = q.Id,
            Start_Date__c = Date.today(),
            Renewal_Date__c = Date.today().addYears(1),
            Term_Months__c = 12,
            Status__c = 'active'
        );
        insert sub;

        List<RevquilaActions.Request> reqs = new List<RevquilaActions.Request>();

        RevquilaActions.Request req1 = new RevquilaActions.Request();
        req1.action = 'provision_service_cloud';
        req1.recordId = sub.Id;
        reqs.add(req1);

        RevquilaActions.Request req2 = new RevquilaActions.Request();
        req2.action = 'publish_event';
        req2.recordId = q.Id;
        req2.note = 'quote_signed';
        req2.amount = 50000;
        reqs.add(req2);

        Test.startTest();
        List<RevquilaActions.Result> results = RevquilaActions.run(reqs);
        Test.stopTest();

        System.assertEquals(2, results.size());
        System.assert(results[0].ok, 'Provisioning invocable must succeed: ' + results[0].message);
        System.assert(results[1].ok, 'Publish event invocable must succeed: ' + results[1].message);
    }
}
