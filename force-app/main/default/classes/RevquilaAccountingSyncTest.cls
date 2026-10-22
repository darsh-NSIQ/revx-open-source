/**
 * RevquilaAccountingSyncTest
 * Comprehensive unit test suite for Module 6: Direct Accounting Sync (Tally, QuickBooks, Zoho Books).
 * Tests GL mapping seed/save, invoice sync, payment sync, revenue recognition journal entry sync,
 * retry queue, error handling, export generators, and controller methods.
 */
@IsTest
private class RevquilaAccountingSyncTest {

  private class MockAccountingResponse implements HttpCalloutMock {
    private Integer statusCode;
    private String statusText;
    private String body;

    public MockAccountingResponse(Integer code, String status, String body) {
      this.statusCode = code;
      this.statusText = status;
      this.body = body;
    }

    public HttpResponse respond(HttpRequest req) {
      HttpResponse res = new HttpResponse();
      res.setStatusCode(this.statusCode);
      res.setStatus(this.statusText);
      res.setBody(this.body);
      return res;
    }
  }

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Acme Accounting Corp', Tax_Registration_Number__c = '27AAACA1234A1Z5');
    insert acc;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Number__c = 'INV-ACC-001',
      Issued_On__c = Date.today(),
      Due_On__c = Date.today().addDays(30),
      Net_Amount__c = 1000.00,
      Tax_Amount__c = 180.00,
      Total__c = 1180.00,
      Payment_Status__c = 'Unpaid',
      Currency_Code__c = 'INR'
    );
    insert inv;

    Invoice_Line__c line = new Invoice_Line__c(
      Invoice__c = inv.Id,
      Description__c = 'Cloud Enterprise License',
      Quantity__c = 1,
      Unit_Price__c = 1000.00,
      Net_Amount__c = 1000.00
    );
    insert line;

    Payment__c pay = new Payment__c(
      Invoice__c = inv.Id,
      Amount__c = 1180.00,
      Paid_On__c = Date.today(),
      Method__c = 'Bank Transfer',
      Reference__c = 'UTR-99882233'
    );
    insert pay;

    Revenue_Schedule__c sch = new Revenue_Schedule__c(
      Account__c = acc.Id,
      Invoice__c = inv.Id,
      Total__c = 1000.00,
      Start_Date__c = Date.today().toStartOfMonth(),
      End_Date__c = Date.today().addMonths(1),
      Status__c = 'open'
    );
    insert sch;

    Revenue_Schedule_Line__c schLine = new Revenue_Schedule_Line__c(
      Revenue_Schedule__c = sch.Id,
      Amount__c = 500.00,
      Period_Start__c = Date.today().toStartOfMonth(),
      Period_End__c = Date.today(),
      Recognized__c = true,
      Recognized_On__c = Date.today()
    );
    insert schLine;
  }

  @IsTest
  static void testChartOfAccountsMapping() {
    Test.startTest();
    // Test default seeding for all three systems
    List<RevquilaAccountingSyncService.AccountMappingDto> tallyMappings =
      RevquilaAccountingSyncService.getMappings(RevquilaAccountingSyncService.SYSTEM_TALLY);
    System.assertNotEquals(0, tallyMappings.size(), 'Tally mappings should be seeded');

    List<RevquilaAccountingSyncService.AccountMappingDto> qboMappings =
      RevquilaAccountingSyncService.getMappings(RevquilaAccountingSyncService.SYSTEM_QUICKBOOKS);
    System.assertNotEquals(0, qboMappings.size(), 'QBO mappings should be seeded');

    List<RevquilaAccountingSyncService.AccountMappingDto> zohoMappings =
      RevquilaAccountingSyncService.getMappings(RevquilaAccountingSyncService.SYSTEM_ZOHO);
    System.assertNotEquals(0, zohoMappings.size(), 'Zoho mappings should be seeded');

    // Test saving custom mapping
    Chart_of_Accounts_Mapping__c customMap = new Chart_of_Accounts_Mapping__c(
      Target_System__c = RevquilaAccountingSyncService.SYSTEM_TALLY,
      RevX_Account_Type__c = RevquilaAccountingSyncService.AC_SALES_REV,
      External_Account_Name__c = 'Custom Domestic Sales A/c',
      External_GL_Code__c = 'SALES-CUSTOM-999',
      Active__c = true
    );
    RevquilaAccountingSyncService.saveMappings(new List<Chart_of_Accounts_Mapping__c>{ customMap });

    RevquilaAccountingSyncController.saveAccountMappings(
      RevquilaAccountingSyncService.SYSTEM_TALLY,
      new List<Chart_of_Accounts_Mapping__c>{ customMap }
    );
    Test.stopTest();

    List<RevquilaAccountingSyncService.AccountMappingDto> updated =
      RevquilaAccountingSyncController.getAccountMappings(RevquilaAccountingSyncService.SYSTEM_TALLY);
    System.assertNotEquals(0, updated.size(), 'Mappings should be retrieved via controller');
  }

  @IsTest
  static void testInvoiceSyncAllSystems() {
    Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];

    Test.setMock(HttpCalloutMock.class, new MockAccountingResponse(200, 'OK', '{"external_id":"TEST-EXT-101"}'));

    Test.startTest();
    // 1. Tally XML
    RevquilaAccountingSyncService.SyncResult tallyRes =
      RevquilaAccountingSyncService.syncInvoice(RevquilaAccountingSyncService.SYSTEM_TALLY, inv.Id);
    System.assert(tallyRes.isSuccess, 'Tally sync should succeed');
    System.assert(tallyRes.requestPayload.contains('<VOUCHER VCHTYPE="Sales"'), 'Payload should have Tally sales voucher');

    // 2. QuickBooks JSON
    RevquilaAccountingSyncService.SyncResult qboRes =
      RevquilaAccountingSyncService.syncInvoice(RevquilaAccountingSyncService.SYSTEM_QUICKBOOKS, inv.Id);
    System.assert(qboRes.isSuccess, 'QBO sync should succeed');
    System.assert(qboRes.requestPayload.contains('DocNumber'), 'QBO payload should contain DocNumber');

    // 3. Zoho Books JSON
    RevquilaAccountingSyncService.SyncResult zohoRes =
      RevquilaAccountingSyncService.syncInvoice(RevquilaAccountingSyncService.SYSTEM_ZOHO, inv.Id);
    System.assert(zohoRes.isSuccess, 'Zoho sync should succeed');
    System.assert(zohoRes.requestPayload.contains('invoice_number'), 'Zoho payload should contain invoice_number');
    Test.stopTest();

    // Verify logs created
    List<Accounting_Sync_Log__c> logs = [
      SELECT Id, Entity_Type__c, Status__c FROM Accounting_Sync_Log__c WHERE Entity_Type__c = 'Invoice'
    ];
    System.assert(logs.size() >= 3, 'At least 3 sync logs should be generated');
  }

  @IsTest
  static void testPaymentSyncAllSystems() {
    Payment__c pay = [SELECT Id FROM Payment__c LIMIT 1];

    Test.setMock(HttpCalloutMock.class, new MockAccountingResponse(200, 'OK', '{"external_id":"PAY-EXT-202"}'));

    Test.startTest();
    // 1. Tally
    RevquilaAccountingSyncService.SyncResult tallyRes =
      RevquilaAccountingSyncService.syncPayment(RevquilaAccountingSyncService.SYSTEM_TALLY, pay.Id);
    System.assert(tallyRes.isSuccess, 'Tally payment sync should succeed');
    System.assert(tallyRes.requestPayload.contains('VCHTYPE="Receipt"'), 'Should be Receipt voucher');

    // 2. QBO
    RevquilaAccountingSyncService.SyncResult qboRes =
      RevquilaAccountingSyncService.syncPayment(RevquilaAccountingSyncService.SYSTEM_QUICKBOOKS, pay.Id);
    System.assert(qboRes.isSuccess, 'QBO payment sync should succeed');

    // 3. Zoho
    RevquilaAccountingSyncService.SyncResult zohoRes =
      RevquilaAccountingSyncService.syncPayment(RevquilaAccountingSyncService.SYSTEM_ZOHO, pay.Id);
    System.assert(zohoRes.isSuccess, 'Zoho payment sync should succeed');
    Test.stopTest();

    List<Accounting_Sync_Log__c> logs = [
      SELECT Id, Entity_Type__c FROM Accounting_Sync_Log__c WHERE Entity_Type__c = 'Payment'
    ];
    System.assert(logs.size() >= 3, 'At least 3 payment sync logs created');
  }

  @IsTest
  static void testJournalEntrySyncAllSystems() {
    Test.setMock(HttpCalloutMock.class, new MockAccountingResponse(201, 'Created', '{"external_id":"JE-EXT-303"}'));

    Test.startTest();
    Date fromDate = Date.today().toStartOfMonth();
    Date toDate = Date.today();

    // 1. Tally
    RevquilaAccountingSyncService.SyncResult tallyRes =
      RevquilaAccountingSyncService.syncJournalEntry(RevquilaAccountingSyncService.SYSTEM_TALLY, fromDate, toDate);
    System.assert(tallyRes.isSuccess, 'Tally journal entry should succeed');
    System.assert(tallyRes.requestPayload.contains('VCHTYPE="Journal"'), 'Should be Journal voucher');

    // 2. QBO
    RevquilaAccountingSyncService.SyncResult qboRes =
      RevquilaAccountingSyncService.syncJournalEntry(RevquilaAccountingSyncService.SYSTEM_QUICKBOOKS, fromDate, toDate);
    System.assert(qboRes.isSuccess, 'QBO journal entry should succeed');

    // 3. Zoho
    RevquilaAccountingSyncService.SyncResult zohoRes =
      RevquilaAccountingSyncService.syncJournalEntry(RevquilaAccountingSyncService.SYSTEM_ZOHO, fromDate, toDate);
    System.assert(zohoRes.isSuccess, 'Zoho journal entry should succeed');
    Test.stopTest();

    List<Accounting_Sync_Log__c> logs = [
      SELECT Id, Entity_Type__c FROM Accounting_Sync_Log__c WHERE Entity_Type__c = 'Journal Entry'
    ];
    System.assert(logs.size() >= 3, 'At least 3 journal logs created');
  }

  @IsTest
  static void testRetryAndManualResync() {
    Invoice__c inv = [SELECT Id, Name, Number__c FROM Invoice__c LIMIT 1];

    // Create a failed log
    Accounting_Sync_Log__c failedLog = new Accounting_Sync_Log__c(
      Target_System__c = RevquilaAccountingSyncService.SYSTEM_TALLY,
      Entity_Type__c = RevquilaAccountingSyncService.ENTITY_INVOICE,
      Record_Id__c = inv.Id,
      Record_Name__c = inv.Number__c,
      Status__c = RevquilaAccountingSyncService.STATUS_FAILED,
      Error_Message__c = 'Simulated network timeout',
      Retry_Count__c = 0,
      Synced_At__c = System.now().addHours(-1)
    );
    insert failedLog;

    Test.setMock(HttpCalloutMock.class, new MockAccountingResponse(200, 'OK', '{"external_id":"RETRY-SUCCESS-404"}'));

    Test.startTest();
    RevquilaAccountingSyncService.SyncResult resyncRes =
      RevquilaAccountingSyncService.resyncLog(failedLog.Id);
    System.assert(resyncRes.isSuccess, 'Resync should succeed');

    Accounting_Sync_Log__c updated = [
      SELECT Id, Retry_Count__c, Status__c FROM Accounting_Sync_Log__c WHERE Id = :failedLog.Id
    ];
    System.assertEquals(1, updated.Retry_Count__c, 'Retry count should increment to 1');
    System.assertEquals(RevquilaAccountingSyncService.STATUS_SUCCESS, updated.Status__c, 'Status should update to Success');

    // Also test controller resync method
    RevquilaAccountingSyncService.SyncResult ctrlRes =
      RevquilaAccountingSyncController.resyncLogRecord(failedLog.Id);
    System.assert(ctrlRes.isSuccess, 'Controller resync should succeed');
    Test.stopTest();
  }

  @IsTest
  static void testControllerOverviewAndExports() {
    Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
    Payment__c pay = [SELECT Id FROM Payment__c LIMIT 1];

    Test.setMock(HttpCalloutMock.class, new MockAccountingResponse(200, 'OK', '{"external_id":"CTRL-505"}'));

    Test.startTest();
    // Trigger via controller
    RevquilaAccountingSyncController.triggerInvoiceSync(RevquilaAccountingSyncService.SYSTEM_TALLY, inv.Id);
    RevquilaAccountingSyncController.triggerPaymentSync(RevquilaAccountingSyncService.SYSTEM_QUICKBOOKS, pay.Id);
    RevquilaAccountingSyncController.triggerJournalSync(RevquilaAccountingSyncService.SYSTEM_ZOHO, Date.today().toStartOfMonth(), Date.today());

    // Overview
    RevquilaAccountingSyncController.OverviewDto ov =
      RevquilaAccountingSyncController.getOverview(RevquilaAccountingSyncService.SYSTEM_TALLY);
    System.assertNotEquals(null, ov, 'Overview should not be null');
    System.assert(ov.totalSyncs >= 1, 'Total syncs should reflect records');

    // Logs query
    List<RevquilaAccountingSyncController.LogViewDto> logs =
      RevquilaAccountingSyncController.getSyncLogs(RevquilaAccountingSyncService.SYSTEM_TALLY, 'All', 50);
    System.assertNotEquals(0, logs.size(), 'Logs should be returned');

    // Recent items
    List<Invoice__c> recentInvs = RevquilaAccountingSyncController.getRecentInvoices();
    System.assertNotEquals(0, recentInvs.size(), 'Recent invoices should be returned');

    List<Payment__c> recentPays = RevquilaAccountingSyncController.getRecentPayments();
    System.assertNotEquals(0, recentPays.size(), 'Recent payments should be returned');

    // Export formats
    String tallyXml = RevquilaAccountingSyncController.exportAccountingData(
      RevquilaAccountingSyncService.SYSTEM_TALLY, 'Invoice', Date.today().toStartOfMonth(), Date.today()
    );
    System.assert(tallyXml.contains('<ENVELOPE>'), 'Tally export should contain ENVELOPE');

    String qboJson = RevquilaAccountingSyncController.exportAccountingData(
      RevquilaAccountingSyncService.SYSTEM_QUICKBOOKS, 'Invoice', Date.today().toStartOfMonth(), Date.today()
    );
    System.assert(qboJson.contains('DocNumber') || qboJson.startsWith('['), 'QBO export should produce JSON');

    String zohoCsv = RevquilaAccountingSyncController.exportAccountingData(
      RevquilaAccountingSyncService.SYSTEM_ZOHO, 'Invoice', Date.today().toStartOfMonth(), Date.today()
    );
    System.assert(zohoCsv.contains('Invoice Number'), 'Zoho export should produce CSV header');
    Test.stopTest();
  }

  @IsTest
  static void testNegativeAndEdgeCases() {
    Test.startTest();
    // Null invoice Id
    RevquilaAccountingSyncService.SyncResult invNull =
      RevquilaAccountingSyncService.syncInvoice(RevquilaAccountingSyncService.SYSTEM_TALLY, null);
    System.assertEquals(false, invNull.isSuccess, 'Null invoice Id should fail gracefully');

    // Non-existent invoice Id
    Id fakeId = UserInfo.getUserId();
    RevquilaAccountingSyncService.SyncResult invFake =
      RevquilaAccountingSyncService.syncInvoice(RevquilaAccountingSyncService.SYSTEM_TALLY, fakeId);
    System.assertEquals(false, invFake.isSuccess, 'Fake invoice Id should fail gracefully');

    // Null payment Id
    RevquilaAccountingSyncService.SyncResult payNull =
      RevquilaAccountingSyncService.syncPayment(RevquilaAccountingSyncService.SYSTEM_QUICKBOOKS, null);
    System.assertEquals(false, payNull.isSuccess, 'Null payment Id should fail gracefully');

    // Null log Id resync
    RevquilaAccountingSyncService.SyncResult logNull =
      RevquilaAccountingSyncService.resyncLog(null);
    System.assertEquals(false, logNull.isSuccess, 'Null log Id resync should fail gracefully');

    // Journal entry with no recognized lines
    RevquilaAccountingSyncService.SyncResult jeEmpty =
      RevquilaAccountingSyncService.syncJournalEntry(
        RevquilaAccountingSyncService.SYSTEM_TALLY,
        Date.today().addYears(-10),
        Date.today().addYears(-9)
      );
    System.assert(jeEmpty.isSuccess, 'Empty journal range should return clean no-op');
    Test.stopTest();
  }

  @IsTest
  static void testCalloutHttpErrorResponse() {
    Invoice__c inv = [SELECT Id FROM Invoice__c LIMIT 1];
    Test.setMock(HttpCalloutMock.class, new MockAccountingResponse(500, 'Internal Server Error', '{"error":"Accounting Gateway down"}'));

    Test.startTest();
    RevquilaAccountingSyncService.SyncResult res =
      RevquilaAccountingSyncService.syncInvoice(RevquilaAccountingSyncService.SYSTEM_TALLY, inv.Id);
    Test.stopTest();

    System.assertNotEquals(null, res, 'Result should be returned on 500 error');
  }
}
