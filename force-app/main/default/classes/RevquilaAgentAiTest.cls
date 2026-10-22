@isTest
private class RevquilaAgentAiTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(
      Name = 'Acme Corp',
      BillingCountry = 'India',
      BillingState = 'Karnataka',
      Payment_Terms__c = 'Net 30'
    );
    insert acc;

    Product2 prod = new Product2(
      Name = 'Cloud Enterprise Suite',
      Family = 'Software',
      IsActive = true
    );
    insert prod;

    Id stdPbId = Test.getStandardPricebookId();
    PricebookEntry pbe = new PricebookEntry(
      Pricebook2Id = stdPbId,
      Product2Id = prod.Id,
      UnitPrice = 1200.0,
      IsActive = true
    );
    insert pbe;

    // Create an overdue invoice
    Invoice__c inv = new Invoice__c(
      Account__c = acc.Id,
      Total__c = 1500.0,
      Due_On__c = Date.today().addDays(-10),
      Sent_On__c = Date.today().addDays(-20),
      Written_Off__c = false,
      Currency_Code__c = 'INR'
    );
    insert inv;

    // Create an active subscription and items
    Subscription__c sub = new Subscription__c(
      Account__c = acc.Id,
      Status__c = 'active',
      Start_Date__c = Date.today().addMonths(-11),
      Renewal_Date__c = Date.today().addDays(15),
      Auto_Renew__c = true
    );
    insert sub;

    Subscription_Item__c item = new Subscription_Item__c(
      Subscription__c = sub.Id,
      Product__c = prod.Id,
      Quantity__c = 5,
      Unit_Price__c = 1200.0
    );
    insert item;

    // Create an active contract linked to subscription
    Contract__c c = new Contract__c(
      Account__c = acc.Id,
      Subscription__c = sub.Id,
      Status__c = 'active',
      Start_Date__c = Date.today().addMonths(-11),
      End_Date__c = Date.today().addDays(15),
      Annual_Value__c = 12000.0,
      Uplift_Percent__c = 5.0
    );
    insert c;

    // Expiring quote within 7 days
    Quote__c expiringQ = new Quote__c(
      Account__c = acc.Id,
      Status__c = 'sent',
      Net_Amount__c = 3500.0,
      Valid_Until__c = Date.today().addDays(3),
      Currency_Code__c = 'INR'
    );
    insert expiringQ;

    // Create an initial exception item
    Exception_Item__c ex = new Exception_Item__c(
      Category__c = 'Quote Policy',
      Title__c = 'Pending Discount Review',
      AI_Reason__c = 'Discount exceeds 20%',
      Recommended_Action__c = 'Approve or reject',
      Severity__c = 'High',
      Status__c = 'Pending',
      Account__c = acc.Id,
      Amount__c = 5000.0
    );
    insert ex;

    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    if (secrets == null) secrets = new Revquila_Secrets__c();
    secrets.AI_Kill_Switch__c = false;
    secrets.AI_Autonomy_Level__c = 'suggest';
    secrets.AI_Max_Discount_Percent__c = 20.0;
    secrets.AI_Max_Refund_Amount__c = 5000.0;
    upsert secrets;
  }

  @isTest
  static void testCommandQuoteSuggestAndExecute() {
    Account acc = [SELECT Id, Name FROM Account WHERE Name = 'Acme Corp' LIMIT 1];

    Test.startTest();
    // 1. Suggest mode (preview)
    RevquilaAgentService.AgentExecutionResult preview = RevquilaAgentService.processCommand(
      'create a quote for Acme Corp, 25 licenses, 10% discount, Net 30',
      false,
      null
    );
    System.assert(preview.success, 'Preview should succeed');
    System.assert(preview.requiresConfirmation, 'Should require confirmation');
    System.assertEquals('create_quote', preview.action, 'Action should be create_quote');

    // 2. Direct execution
    RevquilaAgentService.AgentExecutionResult executed = RevquilaAgentService.processCommand(
      'create a quote for Acme Corp, 25 licenses, 10% discount, Net 30',
      true,
      null
    );
    System.assert(executed.success, 'Direct execution should succeed');
    System.assertNotEquals(null, executed.resultRecordId, 'Quote record ID should be populated');
    Test.stopTest();
  }

  @isTest
  static void testCommandExcessDiscountException() {
    Test.startTest();
    // Request 35% discount when max limit is 20%
    RevquilaAgentService.AgentExecutionResult res = RevquilaAgentService.processCommand(
      'create a quote for Acme Corp, 50 licenses, 35% discount, Net 30',
      false,
      null
    );
    System.assert(res.requiresApproval, 'Should require approval for excessive discount');
    System.assertNotEquals(null, res.exceptionItemId, 'Exception item should be created');

    Exception_Item__c createdEx = [SELECT Id, Status__c, Category__c FROM Exception_Item__c WHERE Id = :res.exceptionItemId];
    System.assertEquals('Pending', createdEx.Status__c, 'Status should be Pending');
    System.assertEquals('Quote Policy', createdEx.Category__c, 'Category should be Quote Policy');
    Test.stopTest();
  }

  @isTest
  static void testKillSwitchEnforcement() {
    // Enable Kill Switch
    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    if (secrets == null) secrets = new Revquila_Secrets__c();
    secrets.AI_Kill_Switch__c = true;
    secrets.AI_Max_Discount_Percent__c = 20.0;
    secrets.AI_Max_Refund_Amount__c = 5000.0;
    upsert secrets;

    Test.startTest();
    RevquilaAgentService.AgentExecutionResult res = RevquilaAgentService.processCommand(
      'create a quote for Acme Corp, 10 licenses',
      false,
      null
    );
    System.assertEquals(false, res.success, 'Action should be blocked by kill switch');
    System.assert(res.resultMessage.contains('Kill Switch'), 'Message should indicate kill switch');
    Test.stopTest();

    // Reset kill switch
    secrets.AI_Kill_Switch__c = false;
    upsert secrets;
  }

  @isTest
  static void testSensitiveDataMasking() {
    String raw = 'Customer John Doe with card 4111 2222 3333 4444 and email john@acme.com and GSTIN 29ABCDE1234F1Z5';
    String masked = RevquilaAgentService.maskSensitiveData(raw);

    System.assert(!masked.contains('4111 2222 3333 4444'), 'Credit card must be masked');
    System.assert(!masked.contains('john@acme.com'), 'Email must be masked');
    System.assert(!masked.contains('29ABCDE1234F1Z5'), 'GSTIN must be masked');
    System.assert(masked.contains('[CARD_REDACTED]'), 'Card token placeholder should exist');
  }

  @isTest
  static void testSendRemindersAndMrrAnalysis() {
    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    if (secrets == null) secrets = new Revquila_Secrets__c();
    secrets.AI_Kill_Switch__c = false;
    secrets.AI_Autonomy_Level__c = 'limits';
    secrets.AI_Max_Discount_Percent__c = 20.0;
    secrets.AI_Max_Refund_Amount__c = 5000.0;
    upsert secrets;

    Test.startTest();
    RevquilaAgentService.AgentExecutionResult reminders = RevquilaAgentService.processCommand(
      'send reminders to all overdue invoices',
      true,
      null
    );
    System.assert(reminders.success, 'Reminders should succeed: ' + reminders.resultMessage);

    RevquilaAgentService.AgentExecutionResult mrr = RevquilaAgentService.processCommand(
      'what was last quarter MRR growth?',
      false,
      null
    );
    System.assert(mrr.success, 'MRR growth should succeed');

    RevquilaAgentService.AgentExecutionResult bal = RevquilaAgentService.processCommand(
      'what is the balance for Acme Corp?',
      false,
      null
    );
    System.assert(bal.success, 'Balance check should succeed');
    Test.stopTest();
  }

  @isTest
  static void testExceptionInboxTriage() {
    Exception_Item__c ex = [SELECT Id FROM Exception_Item__c LIMIT 1];

    Test.startTest();
    List<RevquilaExceptionInboxController.ExceptionView> items = RevquilaExceptionInboxController.getExceptions('all', 'all', 'Pending');
    System.assert(!items.isEmpty(), 'Should return pending exceptions');

    // Approve
    String appRes = RevquilaExceptionInboxController.approveException(ex.Id);
    System.assert(appRes.contains('approved'), 'Exception should be approved');

    // Reject
    String rejRes = RevquilaExceptionInboxController.rejectException(ex.Id, 'Discount too deep');
    System.assert(rejRes.contains('rejected'), 'Exception should be rejected');

    // Edit
    String editRes = RevquilaExceptionInboxController.editException(ex.Id, 4000.0, 'Negotiated down');
    System.assert(editRes.contains('resolved'), 'Exception should be resolved');
    Test.stopTest();
  }

  @isTest
  static void testAiLogsAndAutonomySettings() {
    Test.startTest();
    // Log an action
    Id logId = RevquilaAgentService.logAction('test_action', 'Test prompt', 'Test output', 'Testing', 100, 0.0002, true, null, 'Test Provider');
    System.assertNotEquals(null, logId, 'Log ID should not be null');

    // Feedback
    Boolean fbRes = RevquilaExceptionInboxController.submitFeedback(logId, 'UP');
    System.assertEquals(true, fbRes, 'Feedback should be saved');

    // Get logs
    List<RevquilaExceptionInboxController.LogView> logs = RevquilaExceptionInboxController.getAiLogs(10);
    System.assert(!logs.isEmpty(), 'Logs should not be empty');

    // Autonomy config
    Boolean saved = RevquilaExceptionInboxController.saveAutonomySettings('limits', false, 15.0, 10000.0);
    System.assertEquals(true, saved, 'Autonomy settings should save');

    RevquilaExceptionInboxController.AutonomyConfig cfg = RevquilaExceptionInboxController.getAutonomySettings();
    System.assertEquals('limits', cfg.autonomyLevel, 'Autonomy level should match');
    System.assertEquals(15.0, cfg.maxDiscountPercent, 'Discount limit should match');
    Test.stopTest();
  }

  @isTest
  static void testDailyBriefingJob() {
    Test.startTest();
    RevquilaDailyBriefingJob.BriefingSummary summary = RevquilaDailyBriefingJob.getDailyBriefing();
    System.assertNotEquals(null, summary, 'Summary should be generated');
    System.assert(summary.digestText.contains('Morning Revenue Briefing'), 'Digest should contain title');

    // Run job execution
    RevquilaDailyBriefingJob job = new RevquilaDailyBriefingJob();
    job.execute(null);
    Test.stopTest();
  }

  @isTest
  static void testAutopilotAndRenewExecution() {
    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    if (secrets == null) secrets = new Revquila_Secrets__c();
    secrets.AI_Kill_Switch__c = false;
    secrets.AI_Autonomy_Level__c = 'autopilot';
    secrets.AI_Max_Discount_Percent__c = 20.0;
    secrets.AI_Max_Refund_Amount__c = 5000.0;
    secrets.Slack_Webhook__c = 'https://hooks.slack.com/services/test/mock/123';
    upsert secrets;

    Test.startTest();
    // Autopilot execution of contract renewal
    RevquilaAgentService.AgentExecutionResult renewRes = RevquilaAgentService.processCommand(
      'renew Acme Corp contract for 12 months with 5% uplift',
      false,
      null
    );
    System.assert(renewRes.success, 'Renew command should succeed: ' + renewRes.resultMessage);

    // Fallback prompt
    RevquilaAgentService.AgentExecutionResult copilotRes = RevquilaAgentService.processCommand(
      'hello what can you do?',
      false,
      null
    );
    System.assert(copilotRes.success, 'Copilot fallback should succeed');

    // Negative case: empty prompt
    try {
      RevquilaAgentService.processCommand('', false, null);
      System.assert(false, 'Should throw exception for empty prompt');
    } catch (Exception e) {
      System.assert(true, 'Expected ProblemException');
    }

    // Daily briefing with Slack webhook
    RevquilaDailyBriefingJob.BriefingSummary summary = RevquilaDailyBriefingJob.runBriefingJob();
    System.assertNotEquals(null, summary, 'Summary should be returned');
    Test.stopTest();
  }
}
