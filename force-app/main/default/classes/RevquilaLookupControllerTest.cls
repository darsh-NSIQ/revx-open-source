@IsTest
private class RevquilaLookupControllerTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Omni Global Retail Corp');
    insert acc;

    Quote__c q = new Quote__c(
      Account__c = acc.Id,
      Status__c = 'Draft',
      Notes__c = 'Omni Retail CPQ Quote'
    );
    insert q;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Payment_Status__c = 'Draft',
      Total__c = 5000
    );
    insert inv;

    Sales_Agreement__c sa = new Sales_Agreement__c(
      Account__c = acc.Id,
      Status__c = 'Activated',
      Total_Committed_Quantity__c = 1000
    );
    insert sa;
  }

  @IsTest
  static void testGlobalSearchAndMetrics() {
    Test.startTest();
    Map<String, Object> results = RevquilaLookupController.getGlobalSearch('Omni');
    System.assertNotEquals(null, results, 'Search results should not be null');
    List<Account> accs = (List<Account>) results.get('accounts');
    System.assertEquals(1, accs.size(), 'Should find 1 matching account');

    // Test short query edge case
    Map<String, Object> emptyResults = RevquilaLookupController.getGlobalSearch('a');
    System.assertEquals(0, emptyResults.size(), 'Short queries should return empty map');

    // Test Utility Metrics
    Map<String, Object> metrics = RevquilaLookupController.getUtilityMetrics();
    System.assertNotEquals(null, metrics, 'Metrics map should not be null');
    System.assert((Integer) metrics.get('openInvoicesCount') >= 1, 'Should count open invoices');
    System.assert((Integer) metrics.get('activeAgreementsCount') >= 1, 'Should count active agreements');
    Test.stopTest();
  }
}
