@IsTest
private class RevquilaIndiaPaymentsTest {

  private class MockHttp implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest req) {
      HttpResponse res = new HttpResponse();
      res.setHeader('Content-Type', 'application/json');
      res.setStatusCode(200);
      if (req.getEndpoint().contains('subscriptions')) {
        res.setBody('{"id":"sub_mock_123","short_url":"https://rzp.io/i/sub_mock_123","status":"created"}');
      } else {
        res.setBody('{"id":"pay_mock_123","status":"captured"}');
      }
      return res;
    }
  }

  @TestSetup
  static void setupTestData() {
    Account acc = new Account(
      Name = 'Acme Technologies Private Limited',
      BillingCity = 'Bengaluru',
      BillingState = 'Karnataka',
      BillingCountry = 'India'
    );
    insert acc;

    Subscription__c sub = new Subscription__c(
      Account__c = acc.Id,
      Status__c = 'active',
      Billing_Frequency__c = 'monthly',
      Start_Date__c = Date.today(),
      Renewal_Date__c = Date.today().addMonths(12)
    );
    insert sub;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Subscription__c = sub.Id,
      Total__c = 100000.00,
      Net_Amount__c = 100000.00,
      Issued_On__c = Date.today(),
      Due_On__c = Date.today().addDays(15),
      Number__c = 'INV-99001',
      Currency_Code__c = 'INR'
    );
    insert inv;

    Coupon__c cp = new Coupon__c(
      Name = 'Festive 20',
      Code__c = 'FESTIVE20',
      Discount_Type__c = 'Percentage',
      Discount_Value__c = 20,
      Free_Trial_Days__c = 14,
      Valid_Until__c = Date.today().addDays(30),
      Max_Redemptions__c = 50,
      Times_Redeemed__c = 0,
      Is_Active__c = true
    );
    insert cp;

    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    if (secrets.Id == null) {
      secrets = new Revquila_Secrets__c();
    }
    secrets.Gateway_Key__c = 'rzp_test_key123';
    secrets.Gateway_Secret__c = 'rzp_test_sec123';
    secrets.Webhook_Secret__c = 'whsec_test123';
    upsert secrets;
  }

  @IsTest
  static void testMandateCreationAndLifecycle() {
    Subscription__c sub = [SELECT Id FROM Subscription__c LIMIT 1];
    Test.setMock(HttpCalloutMock.class, new MockHttp());

    Test.startTest();
    RevquilaIndiaPaymentsService.MandateResult res = RevquilaIndiaPaymentsService.createMandateLink(sub.Id, 'UPI_AutoPay');
    Test.stopTest();

    System.assert(res.success, 'Mandate creation should succeed');
    System.assertNotEquals(null, res.mandateId, 'Mandate ID must be populated');

    Subscription__c updated = [SELECT Mandate_Status__c, Mandate_Type__c FROM Subscription__c WHERE Id = :sub.Id];
    System.assertEquals('created', updated.Mandate_Status__c);
    System.assertEquals('UPI_AutoPay', updated.Mandate_Type__c);

    // Lifecycle update
    RevquilaIndiaPaymentsService.updateMandateStatus(res.mandateId, 'active', 'UPI_AutoPay');
    Subscription__c activeSub = [SELECT Mandate_Status__c, Mandate_Auth_Date__c FROM Subscription__c WHERE Id = :sub.Id];
    System.assertEquals('active', activeSub.Mandate_Status__c);
    System.assertEquals(Date.today(), activeSub.Mandate_Auth_Date__c);
  }

  @IsTest
  static void testSmartRetriesAndExceptionEscalation() {
    Invoice__c inv = [SELECT Id, Number__c FROM Invoice__c LIMIT 1];

    Test.startTest();
    // 1st failure
    RevquilaIndiaPaymentsService.RetryResult r1 = RevquilaIndiaPaymentsService.handlePaymentFailure(inv.Number__c, 'Insufficient balance in UPI account');
    System.assertEquals(1, r1.retryCount);
    System.assertEquals('Retrying', r1.status);
    System.assertEquals(false, r1.escalatedToExceptionInbox);

    // 2nd failure
    RevquilaIndiaPaymentsService.RetryResult r2 = RevquilaIndiaPaymentsService.handlePaymentFailure(inv.Number__c, 'Debit timeout');
    System.assertEquals(2, r2.retryCount);

    // 3rd failure
    RevquilaIndiaPaymentsService.handlePaymentFailure(inv.Number__c, 'UPI pin locked');
    // 4th failure
    RevquilaIndiaPaymentsService.handlePaymentFailure(inv.Number__c, 'Mandate limit reached');

    // 5th failure -> Max retries reached, should escalate to Exception Inbox
    RevquilaIndiaPaymentsService.RetryResult r5 = RevquilaIndiaPaymentsService.handlePaymentFailure(inv.Number__c, 'Hard decline');
    Test.stopTest();

    System.assertEquals(true, r5.escalatedToExceptionInbox);
    System.assertEquals('Failed', r5.status);

    List<Exception_Item__c> excs = [
      SELECT Id, Category__c, Severity__c, Title__c FROM Exception_Item__c
      WHERE Record_Id__c = :inv.Id
    ];
    System.assertEquals(1, excs.size());
    System.assertEquals('Failed Payment', excs[0].Category__c);
    System.assertEquals('High', excs[0].Severity__c);

    Integer retried = RevquilaIndiaPaymentsService.executeScheduledRetries();
    System.assert(retried >= 0);
  }

  @IsTest
  static void testInstallmentPaymentPlanAndAllocation() {
    Invoice__c inv = [SELECT Id, Total__c FROM Invoice__c LIMIT 1];

    Test.startTest();
    // 1. Equal 3-way split
    List<Installment__c> insts = RevquilaIndiaPaymentsService.createInstallmentPlan(inv.Id, 3, 'equal', null, null);
    System.assertEquals(3, insts.size(), 'Should create 3 installments');

    // 2. Milestone 50-25-25 split
    List<Installment__c> milestones = RevquilaIndiaPaymentsService.createInstallmentPlan(inv.Id, 3, 'milestone_50_25_25', null, null);
    System.assertEquals(3, milestones.size());
    System.assertEquals(50000.00, milestones[0].Amount__c);
    System.assertEquals(25000.00, milestones[1].Amount__c);
    System.assertEquals(25000.00, milestones[2].Amount__c);

    // 3. Insert Payment and trigger auto-allocation
    Payment__c p1 = new Payment__c(
      Invoice__c = inv.Id,
      Amount__c = 50000.00,
      Paid_On__c = Date.today(),
      Method__c = 'UPI AutoPay',
      Reference__c = 'PAY-INST-001'
    );
    insert p1;
    Test.stopTest();

    List<Installment__c> updatedInsts = [
      SELECT Id, Status__c, Paid_Amount__c, Sequence__c
      FROM Installment__c
      WHERE Invoice__c = :inv.Id
      ORDER BY Sequence__c ASC
    ];
    System.assertEquals('Paid', updatedInsts[0].Status__c);
    System.assertEquals(50000.00, updatedInsts[0].Paid_Amount__c);
    System.assertEquals('Pending', updatedInsts[1].Status__c);

    // Second partial payment
    RevquilaIndiaPaymentsService.allocatePaymentToInstallments(inv.Id, 10000.00, null);
    Installment__c secondInst = [SELECT Id, Status__c, Paid_Amount__c FROM Installment__c WHERE Id = :updatedInsts[1].Id];
    System.assertEquals('Partially_Paid', secondInst.Status__c);
    System.assertEquals(10000.00, secondInst.Paid_Amount__c);
  }

  @IsTest
  static void testBankStatementCsvReconciliation() {
    Invoice__c inv = [SELECT Id, Number__c, Balance__c, Account__r.Name FROM Invoice__c LIMIT 1];

    String csvContent =
      'Date,UTR,Narration,Amount\n' +
      String.valueOf(Date.today()) + ',UTR9911001,NEFT-INW-' + inv.Number__c + '-HDFC,' + String.valueOf(inv.Balance__c) + '\n' +
      String.valueOf(Date.today()) + ',UTR9911002,NEFT-INW-ACME TECHNOLOGIES PVT LTD,' + String.valueOf(inv.Balance__c) + '\n' +
      String.valueOf(Date.today()) + ',UTR9911003,IMPS-UNKNOWN-SENDER-XYZ,45000.00\n';

    Test.startTest();
    RevquilaIndiaPaymentsService.ReconciliationSummary summary =
      RevquilaIndiaPaymentsService.reconcileBankStatement('HDFC Bank', csvContent);
    Test.stopTest();

    System.assertNotEquals(null, summary.statementId);
    System.assertEquals(3, summary.totalLines);
    System.assert(summary.matchedLines >= 1, 'Should match exact invoice or fuzzy account');
    System.assert(summary.mismatchedLines >= 1, 'Should record mismatch exception');

    // Verify Exception Item created for the mismatched line
    List<Exception_Item__c> excs = [
      SELECT Id, Category__c, Title__c, Amount__c
      FROM Exception_Item__c
      WHERE Category__c = 'Payment Mismatch'
    ];
    System.assert(!excs.isEmpty(), 'Mismatched line must create an Exception Item');

    // Test Manual Resolution of the mismatched line
    Bank_Statement_Line__c mismatchLine = [
      SELECT Id FROM Bank_Statement_Line__c
      WHERE Reconciliation_Status__c = 'Mismatch_Exception'
      LIMIT 1
    ];
    RevquilaIndiaPaymentsService.manuallyResolveBankLine(mismatchLine.Id, inv.Id);

    Bank_Statement_Line__c resolved = [SELECT Reconciliation_Status__c FROM Bank_Statement_Line__c WHERE Id = :mismatchLine.Id];
    System.assertEquals('Manual_Resolved', resolved.Reconciliation_Status__c);
  }

  @IsTest
  static void testCouponsAndTrials() {
    Subscription__c sub = [SELECT Id, Start_Date__c FROM Subscription__c LIMIT 1];

    Test.startTest();
    // 1. Valid coupon application
    RevquilaIndiaPaymentsService.CouponResult res = RevquilaIndiaPaymentsService.validateAndApplyCoupon(sub.Id, 'FESTIVE20');
    System.assertEquals(true, res.success);
    System.assertEquals(20, res.discountPercent);
    System.assertEquals(14, res.freeTrialDays);

    Subscription__c updated = [SELECT Discount_Percent__c, Trial_End_Date__c, Next_Bill_Date__c FROM Subscription__c WHERE Id = :sub.Id];
    System.assertEquals(20, updated.Discount_Percent__c);
    System.assertNotEquals(null, updated.Trial_End_Date__c);
    System.assertEquals(updated.Trial_End_Date__c, updated.Next_Bill_Date__c);

    // 2. Negative: Invalid coupon
    RevquilaIndiaPaymentsService.CouponResult invalidRes = RevquilaIndiaPaymentsService.validateAndApplyCoupon(sub.Id, 'NONEXISTENT');
    System.assertEquals(false, invalidRes.success);

    // 3. Create new coupon record via controller helper
    Coupon__c newCp = RevquilaIndiaPaymentsController.createCouponRecord(
      'DIWALI50', 'Diwali 50% Off', 'Percentage', 50, 30, Date.today().addDays(60), 200
    );
    System.assertNotEquals(null, newCp.Id);
    Test.stopTest();
  }

  @IsTest
  static void testControllerWorkspaceOverviewAndActions() {
    Subscription__c sub = [SELECT Id FROM Subscription__c LIMIT 1];
    sub.Mandate_Status__c = 'active';
    sub.Mandate_Id__c = 'sub_active_123';
    sub.Mandate_Type__c = 'UPI_AutoPay';
    sub.Mandate_Max_Amount__c = 15000;
    sub.Mandate_Auth_Date__c = Date.today();
    update sub;

    Invoice__c inv = [SELECT Id, Number__c FROM Invoice__c LIMIT 1];
    RevquilaIndiaPaymentsService.createInstallmentPlan(inv.Id, 2, 'equal', null, null);

    Test.startTest();
    RevquilaIndiaPaymentsController.WorkspaceOverview overview = RevquilaIndiaPaymentsController.getOverview();
    System.assertNotEquals(null, overview);
    System.assert(!overview.openInvoices.isEmpty());
    System.assert(!overview.activeSubscriptions.isEmpty());
    System.assert(!overview.coupons.isEmpty());
    System.assert(!overview.mandates.isEmpty());
    System.assert(!overview.installments.isEmpty());

    // Controller actions
    RevquilaIndiaPaymentsController.setupMandate(sub.Id, 'e_Mandate_NetBanking');
    RevquilaIndiaPaymentsController.setupInstallments(inv.Id, 2, 'equal');
    RevquilaIndiaPaymentsController.applyCoupon(sub.Id, 'FESTIVE20');
    RevquilaIndiaPaymentsController.triggerRetry(inv.Number__c, 'Timeout');

    String csvContent = 'Date,UTR,Narration,Amount\n' + String.valueOf(Date.today()) + ',UTRCONTROLLER,NEFT-TEST,5000.00\n';
    RevquilaIndiaPaymentsController.uploadBankStatement('Axis Bank', csvContent);

    Bank_Statement_Line__c bsl = [SELECT Id FROM Bank_Statement_Line__c LIMIT 1];
    RevquilaIndiaPaymentsController.resolveBankLine(bsl.Id, inv.Id);
    Test.stopTest();
  }

  @IsTest
  static void testWebhookRecurringEvents() {
    Subscription__c sub = [SELECT Id FROM Subscription__c LIMIT 1];
    sub.Mandate_Id__c = 'sub_rzp_live_999';
    update sub;

    Invoice__c inv = [SELECT Id, Number__c FROM Invoice__c LIMIT 1];

    RestRequest req = new RestRequest();
    RestResponse res = new RestResponse();
    req.requestURI = '/revquila/payments/razorpay';
    req.httpMethod = 'POST';

    // 1. Subscription Authenticated Webhook
    String authBody = '{"event":"subscription.authenticated","payload":{"subscription":{"entity":{"id":"sub_rzp_live_999"}}}}';
    req.requestBody = Blob.valueOf(authBody);
    req.headers.put('X-Razorpay-Signature', EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(authBody), Blob.valueOf('whsec_test123'))));
    RestContext.request = req;
    RestContext.response = res;

    Test.startTest();
    RevquilaPaymentWebhook.receive();

    // 2. Subscription Activated Webhook
    String actBody = '{"event":"subscription.activated","payload":{"subscription":{"entity":{"id":"sub_rzp_live_999"}}}}';
    req.requestBody = Blob.valueOf(actBody);
    req.headers.put('X-Razorpay-Signature', EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(actBody), Blob.valueOf('whsec_test123'))));
    RevquilaPaymentWebhook.receive();

    // 3. Subscription Halted & Cancelled
    String haltBody = '{"event":"subscription.halted","payload":{"subscription":{"entity":{"id":"sub_rzp_live_999"}}}}';
    req.requestBody = Blob.valueOf(haltBody);
    req.headers.put('X-Razorpay-Signature', EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(haltBody), Blob.valueOf('whsec_test123'))));
    RevquilaPaymentWebhook.receive();

    String cancBody = '{"event":"subscription.cancelled","payload":{"subscription":{"entity":{"id":"sub_rzp_live_999"}}}}';
    req.requestBody = Blob.valueOf(cancBody);
    req.headers.put('X-Razorpay-Signature', EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(cancBody), Blob.valueOf('whsec_test123'))));
    RevquilaPaymentWebhook.receive();

    // 4. Subscription Charged Webhook
    String chargeBody = '{"event":"subscription.charged","payload":{"subscription":{"entity":{"id":"sub_rzp_live_999","notes":{"invoice":"' + inv.Number__c + '"}}},"payment":{"entity":{"id":"pay_rec_111","amount":5000000,"method":"upi"}}}}';
    req.requestBody = Blob.valueOf(chargeBody);
    req.headers.put('X-Razorpay-Signature', EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(chargeBody), Blob.valueOf('whsec_test123'))));
    RevquilaPaymentWebhook.receive();

    // 5. Payment Failed Webhook
    String failBody = '{"event":"payment.failed","payload":{"payment":{"entity":{"error_description":"Insufficient Funds","notes":{"invoice":"' + inv.Number__c + '"}}}}}';
    req.requestBody = Blob.valueOf(failBody);
    req.headers.put('X-Razorpay-Signature', EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(failBody), Blob.valueOf('whsec_test123'))));
    RevquilaPaymentWebhook.receive();

    // 6. Standard Razorpay Payment Link
    String linkBody = '{"event":"payment_link.paid","payload":{"payment_link":{"entity":{"reference_id":"' + inv.Number__c + '"}},"payment":{"entity":{"id":"pay_link_222","amount":1000000,"method":"card"}}}}';
    req.requestBody = Blob.valueOf(linkBody);
    req.headers.put('X-Razorpay-Signature', EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(linkBody), Blob.valueOf('whsec_test123'))));
    RevquilaPaymentWebhook.receive();

    // 7. Stripe Checkout Session Webhook
    req.requestURI = '/revquila/payments/stripe';
    String stripeBody = '{"data":{"object":{"client_reference_id":"' + inv.Number__c + '","payment_intent":"pi_stripe_111","amount_total":500000}}}';
    req.requestBody = Blob.valueOf(stripeBody);
    req.headers.put('X-Razorpay-Signature', null);
    req.headers.put('Stripe-Signature', 't=1600000000,v1=' + EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf('1600000000.' + stripeBody), Blob.valueOf('whsec_test123'))));
    RevquilaPaymentWebhook.receive();

    // 8. Generic Webhook
    req.requestURI = '/revquila/payments/generic';
    String genBody = '{"invoice":"' + inv.Number__c + '","reference":"REF-GEN-123","amount":2500.00,"method":"IMPS"}';
    req.requestBody = Blob.valueOf(genBody);
    req.headers.put('Stripe-Signature', null);
    req.headers.put('X-Revquila-Signature', EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(genBody), Blob.valueOf('whsec_test123'))));
    RevquilaPaymentWebhook.receive();

    // 9. Bad Signature negative test
    req.headers.put('X-Revquila-Signature', 'bad_signature_hash');
    RevquilaPaymentWebhook.receive();
    Test.stopTest();
  }

  @IsTest
  static void testUpiPayloadAndInstantSettlement() {
    Account acc = new Account(Name = 'UPI Test Account');
    insert acc;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Total__c = 15000,
      Sent_On__c = Date.today(),
      Payment_Status__c = 'Sent'
    );
    insert inv;

    Test.startTest();
    Map<String, Object> upiData = RevquilaIndiaPaymentsController.generateUpiPayload(inv.Id);
    System.assertEquals(true, upiData.get('success'), 'UPI payload generation should succeed');
    System.assertNotEquals(null, upiData.get('upiUri'), 'UPI URI should be formed');

    Map<String, Object> settleRes = RevquilaIndiaPaymentsController.simulateUpiInstantSettlement(inv.Id, 'UTR123456789');
    System.assertEquals(true, settleRes.get('success'), 'Instant settlement should succeed');
    Test.stopTest();

    Invoice__c updated = [SELECT Balance__c, Payment_Status__c FROM Invoice__c WHERE Id = :inv.Id];
    System.assertEquals(0, updated.Balance__c, 'Balance should be cleared');
    System.assertEquals('Paid', updated.Payment_Status__c, 'Invoice should be Paid');
  }
}
