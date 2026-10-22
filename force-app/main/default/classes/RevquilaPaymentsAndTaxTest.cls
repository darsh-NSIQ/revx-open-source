@IsTest
private class RevquilaPaymentsAndTaxTest {
  private class GatewayHttpMock implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest req) {
      HttpResponse res = new HttpResponse();
      res.setHeader('Content-Type', 'application/json');
      String endpoint = req.getEndpoint();
      if (endpoint.contains('razorpay.com/v1/payment_links')) {
        res.setStatusCode(200);
        res.setBody('{"id":"plink_123","short_url":"https://rzp.io/i/test"}');
      } else if (endpoint.contains('razorpay.com/v1/payments/') && endpoint.contains('/refund')) {
        res.setStatusCode(200);
        res.setBody('{"id":"rfnd_123"}');
      } else if (endpoint.contains('razorpay.com/v1/payments')) {
        res.setStatusCode(200);
        res.setBody('{"items":[]}');
      } else if (endpoint.contains('stripe.com/v1/checkout/sessions')) {
        res.setStatusCode(200);
        res.setBody('{"id":"cs_test_123","url":"https://checkout.stripe.com/pay/cs_test_123"}');
      } else if (endpoint.contains('stripe.com/v1/refunds')) {
        res.setStatusCode(200);
        res.setBody('{"id":"re_123"}');
      } else if (endpoint.contains('stripe.com/v1/balance')) {
        res.setStatusCode(200);
        res.setBody('{"livemode":false}');
      } else if (endpoint.contains('avatax.com')) {
        res.setStatusCode(201);
        res.setBody('{"totalTax":180.00,"summary":[{"taxName":"GST","rate":0.18,"tax":180.00}]}');
      } else {
        res.setStatusCode(200);
        res.setBody('{}');
      }
      return res;
    }
  }

  @TestSetup
  static void setupSecrets() {
    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    if (secrets == null || secrets.Id == null) {
      secrets = new Revquila_Secrets__c(SetupOwnerId = UserInfo.getOrganizationId());
    }
    secrets.Gateway_Key__c = 'rzp_test_key';
    secrets.Gateway_Secret__c = 'rzp_test_secret';
    secrets.Tax_Api_Key__c = 'sandbox:avatax_key_123';
    Database.upsert(secrets, true, AccessLevel.SYSTEM_MODE);
  }

  @IsTest
  static void testGatewaySelectionAndManual() {
    Invoice__c inv = new Invoice__c(
      Due_On__c = Date.today().addDays(30),
      Total__c = 5000,
      Net_Amount__c = 5000,
      Number__c = 'INV-999',
      Portal_Token__c = 'TOKEN123456789',
      Currency_Code__c = 'INR',
      Country__c = 'India',
      Exchange_Rate__c = 1
    );

    Payment__c p = new Payment__c(
      Amount__c = 1000,
      Method__c = 'Card',
      Gateway_Reference__c = 'GATEWAY_REF_123'
    );

    Test.startTest();

    // Test Gateway selection
    RevquilaSettings.use('{"gateway":"razorpay","portalEnabled":true,"portalUrl":"https://portal.revquila.com"}');
    RevquilaPayments.Gateway gwRzp = RevquilaPayments.gateway();
    Assert.isNotNull(gwRzp);

    RevquilaSettings.use('{"gateway":"stripe","portalEnabled":true,"portalUrl":"https://portal.revquila.com"}');
    RevquilaPayments.Gateway gwStripe = RevquilaPayments.gateway();
    Assert.isNotNull(gwStripe);

    RevquilaSettings.use('{"gateway":"manual"}');
    RevquilaPayments.Gateway gwManual = RevquilaPayments.gateway();
    Assert.isNotNull(gwManual);

    // Test Manual Gateway
    RevquilaPayments.Manual manualGw = new RevquilaPayments.Manual();
    RevquilaPayments.Link manualLink = manualGw.createLink(inv);
    manualGw.refund(p, 500, 'Customer requested refund');

    // Test Webhook verification
    String body = '{"event":"payment.captured"}';
    String secret = 'webhook_secret';
    String rzpSig = EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(body), Blob.valueOf(secret)));
    Assert.isTrue(RevquilaPayments.verify(body, rzpSig, secret));
    Assert.isFalse(RevquilaPayments.verify(body, 'invalid_sig', secret));
    Assert.isFalse(RevquilaPayments.verify(body, '', secret));
    Assert.isFalse(RevquilaPayments.verify(body, rzpSig, ''));

    String ts = '1600000000';
    String stripeExpected = EncodingUtil.convertToHex(Crypto.generateMac('hmacSHA256', Blob.valueOf(ts + '.' + body), Blob.valueOf(secret)));
    String stripeHeader = 't=' + ts + ',v1=' + stripeExpected;
    Assert.isTrue(RevquilaPayments.verify(body, stripeHeader, secret));

    RevquilaSettings.use('{"plugins":{"payment":"NonExistentGateway"}}');
    RevquilaPayments.Gateway gwFallback = RevquilaPayments.gateway();
    Assert.isNotNull(gwFallback);

    Test.stopTest();
  }

  @IsTest
  static void testRazorpayCreateLink() {
    Invoice__c inv = new Invoice__c(
      Due_On__c = Date.today().addDays(30),
      Total__c = 5000,
      Net_Amount__c = 5000,
      Number__c = 'INV-999',
      Portal_Token__c = 'TOKEN123456789',
      Currency_Code__c = 'INR',
      Country__c = 'India',
      Exchange_Rate__c = 1
    );

    Test.setMock(HttpCalloutMock.class, new GatewayHttpMock());
    Test.startTest();
    RevquilaPayments.Razorpay rz = new RevquilaPayments.Razorpay();
    RevquilaPayments.Link rzLink = rz.createLink(inv);
    Assert.isNotNull(rzLink);
    Assert.areEqual('plink_123', rzLink.reference);
    Test.stopTest();
  }

  @IsTest
  static void testRazorpayRefund() {
    Payment__c p = new Payment__c(
      Amount__c = 1000,
      Method__c = 'Card',
      Gateway_Reference__c = 'GATEWAY_REF_123'
    );

    Test.setMock(HttpCalloutMock.class, new GatewayHttpMock());
    Test.startTest();
    RevquilaPayments.Razorpay rz = new RevquilaPayments.Razorpay();
    String rzRefund = rz.refund(p, 500, 'Reason for refund');
    Assert.areEqual('rfnd_123', rzRefund);
    Test.stopTest();
  }

  @IsTest
  static void testStripeCreateLink() {
    Invoice__c inv = new Invoice__c(
      Due_On__c = Date.today().addDays(30),
      Total__c = 5000,
      Net_Amount__c = 5000,
      Number__c = 'INV-999',
      Portal_Token__c = 'TOKEN123456789',
      Currency_Code__c = 'INR',
      Country__c = 'India',
      Exchange_Rate__c = 1
    );

    Test.setMock(HttpCalloutMock.class, new GatewayHttpMock());
    Test.startTest();
    RevquilaPayments.Stripe st = new RevquilaPayments.Stripe();
    RevquilaPayments.Link stLink = st.createLink(inv);
    Assert.isNotNull(stLink);
    Assert.areEqual('cs_test_123', stLink.reference);
    Test.stopTest();
  }

  @IsTest
  static void testStripeRefund() {
    Payment__c p = new Payment__c(
      Amount__c = 1000,
      Method__c = 'Card',
      Gateway_Reference__c = 'GATEWAY_REF_123'
    );

    Test.setMock(HttpCalloutMock.class, new GatewayHttpMock());
    Test.startTest();
    RevquilaPayments.Stripe st = new RevquilaPayments.Stripe();
    String stRefund = st.refund(p, 500, 'Stripe refund');
    Assert.areEqual('re_123', stRefund);
    Test.stopTest();
  }

  @IsTest
  static void testGatewayConnections() {
    Test.setMock(HttpCalloutMock.class, new GatewayHttpMock());
    Test.startTest();
    Map<String, Object> connStripe = RevquilaPayments.testConnection('stripe');
    Assert.isTrue((Boolean) connStripe.get('ok'));

    Map<String, Object> connRzp = RevquilaPayments.testConnection('razorpay');
    Assert.isTrue((Boolean) connRzp.get('ok'));

    Map<String, Object> connManual = RevquilaPayments.testConnection('manual');
    Assert.isTrue((Boolean) connManual.get('ok'));
    Test.stopTest();
  }

  @IsTest
  static void testTaxEngineAndVatPatterns() {
    Test.setMock(HttpCalloutMock.class, new GatewayHttpMock());
    Test.startTest();

    // 1. Providers
    RevquilaSettings.use('{"taxProvider":"builtin"}');
    RevquilaTaxEngine.Provider p1 = RevquilaTaxEngine.provider();
    Assert.isNotNull(p1);

    RevquilaSettings.use('{"taxProvider":"avalara"}');
    RevquilaTaxEngine.Provider p2 = RevquilaTaxEngine.provider();
    Assert.isNotNull(p2);

    RevquilaSettings.use('{"plugins":{"tax":"InvalidTaxPlugin"}}');
    RevquilaTaxEngine.Provider p3 = RevquilaTaxEngine.provider();
    Assert.isNotNull(p3);

    // 2. BuiltIn Tax
    RevquilaTaxEngine.BuiltIn builtIn = new RevquilaTaxEngine.BuiltIn();
    RevquilaTaxEngine.Request req = new RevquilaTaxEngine.Request();
    req.amount = 10000;
    req.region = RevquilaTestData.HOME_STATE;
    req.country = 'India';
    RevquilaPricing.TaxResult standardTax = builtIn.tax(req);
    Assert.isNotNull(standardTax);

    req.exempt = true;
    req.exemptionReason = 'SEZ Unit Exemption';
    RevquilaPricing.TaxResult exemptTax = builtIn.tax(req);
    Assert.isNotNull(exemptTax);
    Assert.areEqual(0, exemptTax.tax);

    // 3. Avalara Callout
    RevquilaTaxEngine.Avalara avalara = new RevquilaTaxEngine.Avalara();
    RevquilaTaxEngine.Request avaReq = new RevquilaTaxEngine.Request();
    avaReq.amount = 1000;
    avaReq.region = 'CA';
    avaReq.country = 'US';
    avaReq.postalCode = '90210';
    RevquilaPricing.TaxResult avaResult = avalara.tax(avaReq);
    Assert.isNotNull(avaResult);
    Assert.areEqual(180, avaResult.tax);

    // 4. E-Invoice payload
    Account acc = RevquilaTestData.account('Test GST Co', RevquilaTestData.HOME_STATE);
    acc.Tax_Registration_Number__c = '27AAPFU0939F1ZV';
    acc.BillingCity = 'Mumbai';
    update acc;

    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Number__c = 'INV-GST-01',
      Issued_On__c = Date.today(),
      Due_On__c = Date.today().addDays(30),
      Net_Amount__c = 10000,
      Tax_Amount__c = 1800,
      Total__c = 11800,
      Tax_Breakup__c = '[{"label":"CGST @ 9%","amount":900,"rate":9},{"label":"SGST @ 9%","amount":900,"rate":9}]',
      Currency_Code__c = 'INR',
      Country__c = 'India',
      Region__c = RevquilaTestData.HOME_STATE,
      Exchange_Rate__c = 1
    );
    insert inv;

    Invoice_Line__c line = new Invoice_Line__c(
      Invoice__c = inv.Id,
      Description__c = 'Software Subscription',
      Quantity__c = 1,
      Unit_Price__c = 10000,
      List_Amount__c = 10000,
      Net_Amount__c = 10000
    );
    insert line;

    Invoice__c invFull = [SELECT Id, Number__c, Issued_On__c, Net_Amount__c, Tax_Amount__c, Total__c, Tax_Breakup__c, Region__c, Account__r.Name, Account__r.Tax_Registration_Number__c, Account__r.BillingCity FROM Invoice__c WHERE Id = :inv.Id];
    String einvJson = RevquilaTaxEngine.eInvoicePayload(invFull, new List<Invoice_Line__c>{ line });
    Assert.isTrue(String.isNotBlank(einvJson));
    Assert.isTrue(einvJson.contains('27AAPFU0939F1ZV'));

    // 5. VAT shape checks across countries
    Assert.isTrue(RevquilaTaxEngine.looksValid('IN', '27AAPFU0939F1ZV'));
    Assert.isFalse(RevquilaTaxEngine.looksValid('IN', 'INVALID'));
    Assert.isTrue(RevquilaTaxEngine.looksValid('GB', 'GB123456789'));
    Assert.isTrue(RevquilaTaxEngine.looksValid('DE', 'DE123456789'));
    Assert.isTrue(RevquilaTaxEngine.looksValid('FR', 'FR12345678901'));
    Assert.isTrue(RevquilaTaxEngine.looksValid('IT', 'IT12345678901'));
    Assert.isTrue(RevquilaTaxEngine.looksValid('ES', 'ESA12345678'));
    Assert.isTrue(RevquilaTaxEngine.looksValid('US', 'ANYTHING'));
    Assert.isTrue(RevquilaTaxEngine.looksValid('', ''));

    Test.stopTest();
  }
}
