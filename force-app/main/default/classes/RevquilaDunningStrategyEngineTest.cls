@IsTest
private class RevquilaDunningStrategyEngineTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Dunning Test Corp', Dunning_Paused__c = false);
    insert acc;

    Invoice__c inv1 = new Invoice__c(
      Account__c = acc.Id,
      Total__c = 10000,
      Due_On__c = Date.today().addDays(-10), // Tier 2
      Currency_Code__c = 'USD'
    );
    insert inv1;

    Invoice__c inv2 = new Invoice__c(
      Account__c = acc.Id,
      Total__c = 20000,
      Due_On__c = Date.today().addDays(-25), // Tier 3 (late fee)
      Currency_Code__c = 'USD'
    );
    insert inv2;
  }

  @IsTest
  static void testRunCadence() {
    Test.startTest();
    RevquilaDunningStrategyEngine.CadenceResult res = RevquilaDunningStrategyEngine.runCadence();
    Test.stopTest();

    System.assert(res.success, 'Cadence execution should succeed');
    System.assert(res.processedCount >= 2, 'Should process both overdue invoices');
  }

  @IsTest
  static void testPromiseToPay() {
    Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];

    Test.startTest();
    String msg = RevquilaDunningStrategyEngine.logPromiseToPay(inv.Id, Date.today().addDays(7), 'Payment authorized by CFO');
    Test.stopTest();

    System.assert(msg.contains('Promise-to-Pay'), 'Should confirm promise to pay');
  }

  @IsTest
  static void testInvocableAction() {
    Account acc = [SELECT Id FROM Account LIMIT 1];
    Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];

    RevquilaDunningStrategyEngine.DunningActionRequest req1 = new RevquilaDunningStrategyEngine.DunningActionRequest();
    req1.action = 'run_cadence';

    RevquilaDunningStrategyEngine.DunningActionRequest req2 = new RevquilaDunningStrategyEngine.DunningActionRequest();
    req2.action = 'pause';
    req2.accountId = acc.Id;

    Test.startTest();
    List<RevquilaDunningStrategyEngine.CadenceResult> res = RevquilaDunningStrategyEngine.executeDunningInvocable(
      new List<RevquilaDunningStrategyEngine.DunningActionRequest>{ req1, req2 }
    );
    Test.stopTest();

    System.assertEquals(2, res.size(), 'Should return 2 results');
    System.assert(res[0].success);
    System.assert(res[1].success);
  }
}
