@IsTest
private class RevquilaAgentforceActionsTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Agentforce Test Corp', Billing_Email__c = 'agentforce@example.com');
    insert acc;

    Contact con = new Contact(FirstName = 'Agent', LastName = 'Force', Email = 'agentforce@example.com', AccountId = acc.Id);
    insert con;

    Quote__c q = new Quote__c(
      Account__c = acc.Id,
      Contact__c = con.Id,
      Status__c = 'draft',
      Currency_Code__c = 'USD',
      Total__c = 50000,
      Notes__c = 'Agentforce Test Quote'
    );
    insert q;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Contact__c = con.Id,
      Total__c = 12000,
      Due_On__c = Date.today().addDays(-30),
      Sent_On__c = Date.today().addDays(-45),
      Currency_Code__c = 'USD'
    );
    insert inv;
  }

  @IsTest
  static void testDealOptimization() {
    Quote__c q = [SELECT Id FROM Quote__c LIMIT 1];

    RevquilaAgentforceActions.AiRequest req = new RevquilaAgentforceActions.AiRequest();
    req.capability = 'deal_optimization';
    req.recordId = q.Id;

    Test.startTest();
    List<RevquilaAgentforceActions.AiResult> res = RevquilaAgentforceActions.execute(new List<RevquilaAgentforceActions.AiRequest>{ req });
    Test.stopTest();

    System.assertEquals(1, res.size(), 'Should return one result');
    System.assert(res[0].success, 'Execution should succeed');
    System.assertNotEquals(null, res[0].winProbability, 'Win probability should be calculated');
  }

  @IsTest
  static void testDunningReminder() {
    Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];

    RevquilaAgentforceActions.AiRequest req = new RevquilaAgentforceActions.AiRequest();
    req.capability = 'dunning_reminder';
    req.recordId = inv.Id;
    req.tone = 'firm';

    Test.startTest();
    List<RevquilaAgentforceActions.AiResult> res = RevquilaAgentforceActions.execute(new List<RevquilaAgentforceActions.AiRequest>{ req });
    Test.stopTest();

    System.assertEquals(1, res.size(), 'Should return one result');
    System.assert(res[0].success, 'Execution should succeed');
    System.assertNotEquals(null, res[0].outputText, 'Output text should not be null');
    System.assertNotEquals(null, res[0].subjectLine, 'Subject line should not be null');
  }

  @IsTest
  static void testProposalPitch() {
    Quote__c q = [SELECT Id FROM Quote__c LIMIT 1];

    RevquilaAgentforceActions.AiRequest req = new RevquilaAgentforceActions.AiRequest();
    req.capability = 'proposal_pitch';
    req.recordId = q.Id;
    req.tone = 'persuasive';

    Test.startTest();
    List<RevquilaAgentforceActions.AiResult> res = RevquilaAgentforceActions.execute(new List<RevquilaAgentforceActions.AiRequest>{ req });
    Test.stopTest();

    System.assertEquals(1, res.size(), 'Should return one result');
    System.assert(res[0].success, 'Execution should succeed');
  }

  @IsTest
  static void testAccountSummary() {
    Account acc = [SELECT Id FROM Account LIMIT 1];

    RevquilaAgentforceActions.AiRequest req = new RevquilaAgentforceActions.AiRequest();
    req.capability = 'account_summary';
    req.recordId = acc.Id;

    Test.startTest();
    List<RevquilaAgentforceActions.AiResult> res = RevquilaAgentforceActions.execute(new List<RevquilaAgentforceActions.AiRequest>{ req });
    Test.stopTest();

    System.assertEquals(1, res.size(), 'Should return one result');
    System.assert(res[0].success, 'Execution should succeed');
  }

  @IsTest
  static void testManufacturingRunrate() {
    Account acc = [SELECT Id FROM Account LIMIT 1];
    Sales_Agreement__c agr = new Sales_Agreement__c(
      Account__c = acc.Id,
      Total_Committed_Quantity__c = 1000,
      Total_Actual_Quantity__c = 400,
      Pricing_Tier__c = 'Tier 1'
    );
    insert agr;

    RevquilaAgentforceActions.AiRequest req = new RevquilaAgentforceActions.AiRequest();
    req.capability = 'manufacturing_runrate';
    req.recordId = agr.Id;

    Test.startTest();
    List<RevquilaAgentforceActions.AiResult> res = RevquilaAgentforceActions.execute(new List<RevquilaAgentforceActions.AiRequest>{ req });
    Test.stopTest();

    System.assertEquals(1, res.size(), 'Should return one result');
    System.assert(res[0].success, 'Execution should succeed');
    System.assert(res[0].outputText.contains('Committed Units'), 'Output should contain commitment summary');
  }
}
