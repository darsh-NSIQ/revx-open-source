@IsTest
private class RevquilaRenewalAiServiceTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Renewal AI Test Corp');
    insert acc;

    Contract__c c = new Contract__c(
      Account__c = acc.Id,
      Status__c = 'active',
      Start_Date__c = Date.today().addDays(-275),
      End_Date__c = Date.today().addDays(90)
    );
    insert c;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Total__c = 50000,
      Due_On__c = Date.today().addDays(-60),
      Currency_Code__c = 'USD'
    );
    insert inv;
  }

  @IsTest
  static void testAnalyzeContract() {
    Contract__c c = [SELECT Id FROM Contract__c LIMIT 1];

    Test.startTest();
    RevquilaRenewalAiService.RenewalAnalysis a = RevquilaRenewalAiService.analyzeContract(c.Id);
    Test.stopTest();

    System.assertNotEquals(null, a, 'Analysis should not be null');
    System.assert(a.healthScore > 0, 'Health score should be positive');
    System.assertNotEquals(null, a.riskTier, 'Risk tier should be assigned');
    System.assertNotEquals(null, a.aiStrategy, 'AI strategy should be formulated');
  }

  @IsTest
  static void testCreateRenewalQuote() {
    Contract__c c = [SELECT Id FROM Contract__c LIMIT 1];

    Test.startTest();
    Id quoteId = RevquilaRenewalAiService.createRenewalQuote(c.Id);
    Test.stopTest();

    System.assertNotEquals(null, quoteId, 'Renewal quote should be created');
    Quote__c q = [SELECT Id, Type__c, Contract__c FROM Quote__c WHERE Id = :quoteId];
    System.assertEquals('renewal', q.Type__c);
    System.assertEquals(c.Id, q.Contract__c);
  }

  @IsTest
  static void testInvocableAction() {
    Contract__c c = [SELECT Id FROM Contract__c LIMIT 1];

    RevquilaRenewalAiService.RenewalRequest req = new RevquilaRenewalAiService.RenewalRequest();
    req.contractId = c.Id;
    req.action = 'draft_quote';

    Test.startTest();
    List<RevquilaRenewalAiService.RenewalAnalysis> listRes = RevquilaRenewalAiService.evaluateRenewalInvocable(
      new List<RevquilaRenewalAiService.RenewalRequest>{ req }
    );
    Test.stopTest();

    System.assertEquals(1, listRes.size(), 'Should return one result');
    System.assertNotEquals(null, listRes[0].renewalQuoteId, 'Quote ID should be returned');
  }
}
