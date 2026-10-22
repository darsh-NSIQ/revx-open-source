@IsTest
private class RevquilaLeadToQuoteControllerTest {

  @TestSetup
  static void setupData() {
    Lead l = new Lead(
      FirstName = 'Sarah',
      LastName = 'Connor',
      Company = 'Cyberdyne Systems',
      Email = 'sconnor@cyberdyne.test',
      Phone = '+1 555-0199'
    );
    insert l;

    Product2 p = new Product2(
      Name = 'Enterprise AI Core',
      ProductCode = 'AI-CORE-ENT',
      IsActive = true
    );
    insert p;
  }

  @IsTest
  static void testGetLeadContext() {
    Lead l = [SELECT Id FROM Lead LIMIT 1];
    Test.startTest();
    RevquilaLeadToQuoteController.LeadQuoteContext ctx = RevquilaLeadToQuoteController.getLeadContext(l.Id);
    Test.stopTest();

    System.assertNotEquals(null, ctx, 'Context should not be null');
    System.assertEquals('Cyberdyne Systems', ctx.company);
  }

  @IsTest
  static void testFastQuoteAura() {
    Lead l = [SELECT Id FROM Lead LIMIT 1];
    Test.startTest();
    RevquilaLeadToQuoteController.FastQuoteResult res = RevquilaLeadToQuoteController.fastQuote(
      l.Id,
      'AI-CORE-ENT',
      2,
      10,
      'Test fast-quote'
    );
    Test.stopTest();

    System.assert(res.success, 'Fast quote should succeed');
    System.assertNotEquals(null, res.quoteId, 'Quote ID should be populated');

    Quote__c q = [SELECT Id, Account__c, Contact__c, Total__c FROM Quote__c WHERE Id = :res.quoteId];
    System.assertNotEquals(null, q.Account__c, 'Account must be linked');
    System.assertNotEquals(null, q.Contact__c, 'Contact must be linked');
  }

  @IsTest
  static void testFastQuoteInvocable() {
    Lead l = [SELECT Id FROM Lead LIMIT 1];
    RevquilaLeadToQuoteController.FastQuoteRequest req = new RevquilaLeadToQuoteController.FastQuoteRequest();
    req.leadId = l.Id;
    req.productCode = 'AI-CORE-ENT';
    req.quantity = 1;
    req.discountPercent = 0;

    Test.startTest();
    List<RevquilaLeadToQuoteController.FastQuoteResult> results = RevquilaLeadToQuoteController.fastQuoteInvocable(
      new List<RevquilaLeadToQuoteController.FastQuoteRequest>{ req }
    );
    Test.stopTest();

    System.assertEquals(1, results.size(), 'Should return one result');
    System.assert(results[0].success, 'Execution should succeed');
  }
}
