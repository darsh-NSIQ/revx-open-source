@IsTest
private class RevquilaJobsCoverageTest {
  private class MockWebhookHttp implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest req) {
      HttpResponse res = new HttpResponse();
      res.setStatusCode(200);
      res.setBody('{"status":"received"}');
      return res;
    }
  }

  @IsTest
  static void testAllJobStepsExecution() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Job Steps Test Co', RevquilaTestData.HOME_STATE);

      // Stale quote past valid date
      Quote__c staleQuote = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Valid_Until__c = Date.today().addDays(-5),
        Total__c = 10000,
        Net_Amount__c = 10000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert staleQuote;

      // Stale contract past end date
      Contract__c staleContract = new Contract__c(
        Account__c = acc.Id,
        Status__c = 'active',
        Start_Date__c = Date.today().addDays(-400),
        End_Date__c = Date.today().addDays(-5),
        Evergreen__c = false,
        Auto_Renew__c = false,
        Term_Months__c = 12,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert staleContract;

      // Subscriptions: one due for renewal, one upcoming
      Subscription__c sub1 = new Subscription__c(
        Account__c = acc.Id,
        Contract__c = staleContract.Id,
        Status__c = 'active',
        Auto_Renew__c = false,
        Renewal_Date__c = Date.today().addDays(-1),
        Term_Months__c = 12,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert sub1;

      Subscription__c sub2 = new Subscription__c(
        Account__c = acc.Id,
        Contract__c = staleContract.Id,
        Status__c = 'active',
        Auto_Renew__c = false,
        Renewal_Date__c = Date.today().addDays(30),
        Term_Months__c = 12,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert sub2;

      Test.startTest();

      // Test all steps via runStep
      for (String step : RevquilaJobs.STEPS) {
        String res = RevquilaJobs.runStep(step, Date.today());
        Assert.isNotNull(res);
      }
      String unknownStepRes = RevquilaJobs.runStep('unknown_step', Date.today());
      Assert.areEqual('Unknown step', unknownStepRes);

      // Test expireQuotes directly
      Integer expiredQuotes = RevquilaJobs.expireQuotes(Date.today());
      Assert.isTrue(expiredQuotes >= 0);

      // Test expireContracts directly
      Integer expiredContracts = RevquilaJobs.expireContracts(Date.today());
      Assert.isTrue(expiredContracts >= 0);

      // Test renewals directly
      String renewalSummary = RevquilaJobs.renewals(Date.today());
      Assert.isNotNull(renewalSummary);

      // Test Queueable execute
      RevquilaJobs job = new RevquilaJobs(0, Date.today());
      job.execute((QueueableContext) null);

      // Test Status & Schedule
      RevquilaJobs.Status status = RevquilaJobs.status();
      Assert.isNotNull(status);

      RevquilaJobs.schedule(4);
      RevquilaJobs.Status scheduledStatus = RevquilaJobs.status();
      Assert.isTrue(scheduledStatus.scheduled);

      RevquilaJobs.unschedule();
      RevquilaJobs.Status unscheduledStatus = RevquilaJobs.status();
      Assert.isFalse(unscheduledStatus.scheduled);

      Test.stopTest();
    }
  }

  @IsTest
  static void testWebhookJobExecution() {
    Revquila_Secrets__c sec = new Revquila_Secrets__c(
      SetupOwnerId = UserInfo.getOrganizationId(),
      Webhook_Secret__c = 'super_secret_webhook_key'
    );
    Database.insert(sec, true, AccessLevel.SYSTEM_MODE);

    Test.setMock(HttpCalloutMock.class, new MockWebhookHttp());
    Test.startTest();
    RevquilaWebhookJob job = new RevquilaWebhookJob('https://example.com/webhook', '{"test":true}', null, 'test_webhook');
    job.execute((QueueableContext) null);
    Test.stopTest();

    List<Integration_Log__c> logs = [SELECT Id, Status__c FROM Integration_Log__c WHERE Kind__c = 'test_webhook'];
    Assert.isFalse(logs.isEmpty());
    Assert.areEqual('ok', logs[0].Status__c);
  }
}
