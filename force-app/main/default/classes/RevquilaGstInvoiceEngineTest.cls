@IsTest
private class RevquilaGstInvoiceEngineTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(
      Name = 'Tata Consulting Services',
      Tax_Registration_Number__c = '27AAACT2727Q1ZW',
      BillingStreet = 'Nariman Point',
      BillingCity = 'Mumbai',
      BillingPostalCode = '400021'
    );
    insert acc;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Total__c = 118000,
      Tax_Amount__c = 18000,
      Currency_Code__c = 'INR',
      Due_On__c = Date.today().addDays(30)
    );
    insert inv;
  }

  @IsTest
  static void testGenerateEInvoice() {
    Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];

    Test.startTest();
    RevquilaGstInvoiceEngine.GstInvoiceResult res = RevquilaGstInvoiceEngine.generateEInvoice(inv.Id);
    Test.stopTest();

    System.assert(res.success, 'IRN generation should succeed: ' + res.message);
    System.assertNotEquals(null, res.irn, 'IRN hash should not be null');
    System.assertEquals(64, res.irn.length(), 'IRN should be exactly 64 characters SHA-256');
    System.assert(res.qrCodePayload.contains('IRN='), 'QR code payload should contain IRN');
    System.assert(res.nicJsonPayload.contains('1.03'), 'JSON should comply with Schema 1.03');

    Invoice__c updatedInv = [SELECT E_Invoice_IRN__c FROM Invoice__c WHERE Id = :inv.Id];
    System.assertEquals(res.irn, updatedInv.E_Invoice_IRN__c, 'Invoice field should be updated with IRN');
  }

  @IsTest
  static void testInvocableAction() {
    Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];

    RevquilaGstInvoiceEngine.GstInvoiceRequest req = new RevquilaGstInvoiceEngine.GstInvoiceRequest();
    req.invoiceId = inv.Id;
    req.supplierGstin = '27AABCR1234F1Z5';

    Test.startTest();
    List<RevquilaGstInvoiceEngine.GstInvoiceResult> results = RevquilaGstInvoiceEngine.generateEInvoiceInvocable(
      new List<RevquilaGstInvoiceEngine.GstInvoiceRequest>{ req }
    );
    Test.stopTest();

    System.assertEquals(1, results.size(), 'Should return one result');
    System.assert(results[0].success, 'Execution should succeed');
  }
}
