@IsTest
private class RevquilaNewFeaturesTest {

  @TestSetup
  static void setupData() {
    Account acc = RevquilaTestData.account('Test Enterprise Client', RevquilaTestData.HOME_STATE);

    RevquilaTestData.products();

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Sent_On__c = Date.today().addDays(-20),
      Due_On__c = Date.today().addDays(-15),
      Total__c = 12000,
      Currency_Code__c = 'USD',
      Number__c = 'INV-9001'
    );
    insert inv;

    Subscription__c sub = new Subscription__c(
      Account__c = acc.Id,
      Status__c = 'active',
      Start_Date__c = Date.today().addMonths(-2),
      Renewal_Date__c = Date.today().addMonths(10),
      Term_Months__c = 12,
      Display_Number__c = 'SUB-9001'
    );
    insert sub;
  }

  @IsTest
  static void testGuidedSelling() {
    Account acc = [SELECT Id FROM Account LIMIT 1];
    Product2 prod = [SELECT Id, Name FROM Product2 WHERE IsActive = true LIMIT 1];

    Test.startTest();
    RevquilaGuidedSellingController.ConfigData cfg = RevquilaGuidedSellingController.getConfigData();
    Assert.isNotNull(cfg.industries);
    Assert.isNotNull(cfg.companySizes);
    Assert.isFalse(cfg.accounts.isEmpty());

    List<RevquilaGuidedSellingController.PackageProposal> proposals =
      RevquilaGuidedSellingController.evaluateProposals(
        'saas',
        'enterprise',
        'hybrid',
        new List<String>{ 'ai_advisor', 'usage_metering' }
      );
    Assert.isFalse(proposals.isEmpty());

    List<Map<String, Object>> selectedItems = new List<Map<String, Object>>();
    Map<String, Object> item = new Map<String, Object>{
      'productId' => prod.Id,
      'name' => prod.Name,
      'suggestedQty' => 2,
      'unitPrice' => 1500,
      'discountPct' => 10
    };
    selectedItems.add(item);

    Id quoteId = RevquilaGuidedSellingController.createQuoteFromProposal(
      acc.Id,
      'Enterprise Suite',
      10,
      JSON.serialize(selectedItems)
    );
    Assert.isNotNull(quoteId);
    Test.stopTest();
  }

  @IsTest
  static void testDunningEngine() {
    Invoice__c inv = [SELECT Id, Account__c FROM Invoice__c LIMIT 1];

    Test.startTest();
    RevquilaDunningController.AgingSummary summary = RevquilaDunningController.getDunningOverview();
    Assert.isNotNull(summary);
    Assert.isTrue(summary.totalOverdue > 0);

    String promiseMsg = RevquilaDunningController.logPromiseToPay(
      inv.Id,
      Date.today().addDays(7),
      'Will pay via wire on Friday'
    );
    Assert.isTrue(promiseMsg.contains('Promise to pay logged'));

    String noticeMsg = RevquilaDunningController.sendDunningNotice(inv.Id, 'WhatsApp');
    Assert.isTrue(noticeMsg.contains('dunning reminder dispatched'));

    Decimal newBal = RevquilaDunningController.applyLateFee(inv.Id, 2.5);
    Assert.isTrue(newBal > 12000);

    Boolean paused = RevquilaDunningController.toggleAccountDunning(inv.Account__c, true);
    Assert.isTrue(paused);
    Test.stopTest();
  }

  @IsTest
  static void testUsageMetering() {
    Subscription__c sub = [SELECT Id FROM Subscription__c LIMIT 1];

    Test.startTest();
    RevquilaUsageMeteringController.MeteringDashboard md = RevquilaUsageMeteringController.getMeteringDashboard();
    Assert.isNotNull(md);

    Map<String, Object> ingestResult = RevquilaUsageMeteringController.ingestUsageEvent(
      sub.Id,
      'API Calls',
      5000,
      'Batch ingest test'
    );
    Assert.areEqual(true, ingestResult.get('success'));

    String billMsg = RevquilaUsageMeteringController.closeAndBillAccruedUsage(sub.Id);
    Assert.isNotNull(billMsg);
    Test.stopTest();
  }

  @IsTest
  static void testWarRoom() {
    Test.startTest();
    RevquilaWarRoomController.WarRoomData data = RevquilaWarRoomController.getWarRoomData();
    Assert.isNotNull(data);
    Assert.isFalse(data.waterfall.isEmpty());
    Assert.isFalse(data.cohorts.isEmpty());

    RevquilaWarRoomController.SimulationResult sim = RevquilaWarRoomController.simulateScenario(10, 2, 5);
    Assert.isNotNull(sim);
    Assert.isTrue(sim.projectedEndingARR > 0);
    Assert.isTrue(sim.additionalCash > 0);
    Test.stopTest();
  }
}
