@IsTest
private class RevquilaQuickActionControllerTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Quick Action Acme Corp');
    insert acc;

    Opportunity opp = new Opportunity(
      Name = 'Acme Q4 Expansion',
      AccountId = acc.Id,
      StageName = 'Proposal/Price Quote',
      CloseDate = Date.today().addDays(15),
      Amount = 75000
    );
    insert opp;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Payment_Status__c = 'Approved',
      Total__c = 10000
    );
    insert inv;

    Payment__c pay = new Payment__c(
      Invoice__c = inv.Id,
      Amount__c = 5000,
      Paid_On__c = Date.today(),
      Method__c = 'UPI'
    );
    insert pay;

    Subscription__c sub = new Subscription__c(
      Account__c = acc.Id,
      Status__c = 'Active',
      Start_Date__c = Date.today(),
      Ends_On__c = Date.today().addYears(1)
    );
    insert sub;
  }

  @IsTest
  static void testCreateQuoteFromOpportunity() {
    Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

    Test.startTest();
    Map<String, Object> res = RevquilaQuickActionController.createQuoteFromOpportunity(opp.Id);
    Test.stopTest();

    System.assertEquals(true, res.get('success'), 'Should create quote successfully');
    Id quoteId = (Id) res.get('quoteId');
    Quote__c q = [SELECT Id, Opportunity__c, Account__c, Total__c FROM Quote__c WHERE Id = :quoteId];
    System.assertEquals(opp.Id, q.Opportunity__c, 'Quote should link back to opportunity');
    System.assertEquals(75000, q.Total__c, 'Quote total should match opportunity amount');
  }

  @IsTest
  static void testAccountFinancial360() {
    Account acc = [SELECT Id FROM Account LIMIT 1];

    Test.startTest();
    Map<String, Object> dossier = RevquilaQuickActionController.getAccountFinancial360(acc.Id);
    Test.stopTest();

    System.assertEquals(true, dossier.get('success'), 'Financial 360 should succeed');
    System.assertEquals(10000, (Decimal) dossier.get('totalInvoiced'), 'Invoiced total should match');
    System.assertEquals(5000, (Decimal) dossier.get('totalOutstanding'), 'Outstanding total should match');
  }
}
