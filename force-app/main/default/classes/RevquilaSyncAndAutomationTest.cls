@IsTest
private class RevquilaSyncAndAutomationTest {
  @IsTest
  static void testSyncFieldsAndDescribe() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Test.startTest();
      List<RevquilaSync.FieldView> accFields = RevquilaSync.fields('Account');
      Assert.isFalse(accFields.isEmpty());

      List<RevquilaSync.FieldView> conFields = RevquilaSync.fields('Contact');
      Assert.isFalse(conFields.isEmpty());

      List<RevquilaSync.FieldView> oppFields = RevquilaSync.fields('Opportunity');
      Assert.isFalse(oppFields.isEmpty());

      List<RevquilaSync.FieldView> quoteFields = RevquilaSync.fieldsOf(Quote__c.SObjectType, false);
      Assert.isFalse(quoteFields.isEmpty());

      try {
        RevquilaSync.fields('InvalidTarget');
        Assert.fail('Invalid target should throw');
      } catch (RevquilaCore.ProblemException e) {
        Assert.isNotNull(e.getMessage());
      }
      Test.stopTest();
    }
  }

  @IsTest
  static void testConvertForTypes() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      // 1. Currency / Double / Percent
      Object c1 = RevquilaSync.convertFor(Opportunity.SObjectType, 'Amount', 123.45);
      Assert.areEqual(123.45, c1);
      Object c2 = RevquilaSync.convertFor(Opportunity.SObjectType, 'Amount', '250.75');
      Assert.areEqual(250.75, c2);

      // 2. Integer
      Object i1 = RevquilaSync.convertFor(Account.SObjectType, 'NumberOfEmployees', 12);
      Assert.areEqual(12, i1);
      Object i2 = RevquilaSync.convertFor(Account.SObjectType, 'NumberOfEmployees', 24.0);
      Assert.areEqual(24, i2);
      Object i3 = RevquilaSync.convertFor(Account.SObjectType, 'NumberOfEmployees', '36');
      Assert.areEqual(36, i3);

      // 3. Boolean
      Object b1 = RevquilaSync.convertFor(Opportunity.SObjectType, 'IsPrivate', true);
      Assert.areEqual(true, b1);
      Object b2 = RevquilaSync.convertFor(Opportunity.SObjectType, 'IsPrivate', 'true');
      Assert.areEqual(true, b2);
      Object b3 = RevquilaSync.convertFor(Opportunity.SObjectType, 'IsPrivate', '1');
      Assert.areEqual(true, b3);
      Object b4 = RevquilaSync.convertFor(Opportunity.SObjectType, 'IsPrivate', 'false');
      Assert.areEqual(false, b4);

      // 4. Date
      Date today = Date.today();
      Object d1 = RevquilaSync.convertFor(Opportunity.SObjectType, 'CloseDate', today);
      Assert.areEqual(today, d1);
      Object d2 = RevquilaSync.convertFor(Opportunity.SObjectType, 'CloseDate', Datetime.now());
      Assert.areEqual(today, d2);
      Object d3 = RevquilaSync.convertFor(Opportunity.SObjectType, 'CloseDate', String.valueOf(today));
      Assert.areEqual(today, d3);

      // 5. Datetime
      Datetime now = Datetime.now();
      Object dt1 = RevquilaSync.convertFor(Opportunity.SObjectType, 'CreatedDate', now);
      Assert.areEqual(now, dt1);
      Object dt2 = RevquilaSync.convertFor(Opportunity.SObjectType, 'CreatedDate', today);
      Assert.isNotNull(dt2);
      Object dt3 = RevquilaSync.convertFor(Opportunity.SObjectType, 'CreatedDate', String.valueOf(now));
      Assert.isNotNull(dt3);

      // 6. String / Text
      Object s1 = RevquilaSync.convertFor(Account.SObjectType, 'Description', 'REF-999');
      Assert.areEqual('REF-999', s1);

      // 7. Null & Non-existent
      Assert.isNull(RevquilaSync.convertFor(Account.SObjectType, 'Description', null));
      try {
        RevquilaSync.convertFor(Account.SObjectType, 'NonExistentFieldXYZ__c', 'Value');
        Assert.fail('Non existent field should throw');
      } catch (RevquilaCore.ProblemException e) {
        Assert.isNotNull(e.getMessage());
      }
    }
  }

  @IsTest
  static void testSyncFireRules() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Sync Fire Co', RevquilaTestData.HOME_STATE);
      acc.OwnerId = admin.Id;
      Database.update(acc, AccessLevel.SYSTEM_MODE);
      Quote__c quote = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Reference__c = 'TEST-SYNC-1',
        Total__c = 15000,
        Net_Amount__c = 15000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert quote;

      // Configure sync rules in RevquilaSettings
      String noteField = RevquilaCore.prefix() + 'Notes__c';
      String configJson = '{' +
        '"sync": {' +
          '"rules": [' +
            '{"trigger":"quote_signed","target":"Quote","field":"' + noteField + '","source":"value","value":"Custom Synced Notes"},' +
            '{"trigger":"quote_signed","target":"Quote","field":"InvalidFieldXYZ__c","source":"value","value":"Fail"},' +
            '{"trigger":"quote_signed","target":"Quote","field":"' + noteField + '","source":"unknown_source"}' +
          ']' +
        '}' +
      '}';
      RevquilaSettings.use(configJson);

      Test.startTest();
      Map<String, Object> figures = new Map<String, Object>{
        'quote.net' => 15000,
        'quote.total' => 15000,
        'today' => Date.today()
      };
      RevquilaSync.fire('quote_signed', quote, figures);
      Test.stopTest();

      Quote__c updatedQuote = [SELECT Notes__c FROM Quote__c WHERE Id = :quote.Id];
      Assert.areEqual('Custom Synced Notes', updatedQuote.Notes__c);
    }
  }

  @IsTest
  static void testAutomationAllMomentsAndActions() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Automation Co', RevquilaTestData.HOME_STATE);
      acc.OwnerId = admin.Id;
      Database.update(acc, AccessLevel.SYSTEM_MODE);
      Quote__c quote = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Reference__c = 'TEST-AUTO-MOMENTS',
        Total__c = 50000,
        Net_Amount__c = 50000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert quote;

      // Configure automation rules with all action types
      String autoConfig = '{' +
        '"notifyInApp": true,' +
        '"notifyEmail": true,' +
        '"notifications": {' +
          '"approvalPending": true,' +
          '"quoteSigned": true,' +
          '"invoiceOverdue": true,' +
          '"paymentReceived": true,' +
          '"renewalDue": true' +
        '},' +
        '"emailTemplates": {' +
          '"approval_pending": {"subject":"Approval required for {{record.number}}","body":"Please approve."}' +
        '},' +
        '"automation": {' +
          '"rules": [' +
            '{' +
              '"name": "Rule 1 Notify and Task",' +
              '"active": true,' +
              '"event": "quote_created",' +
              '"actions": [' +
                '{"type":"notify","to":"owner,user:' + admin.Id + '","title":"New Quote {{record.number}}","message":"Review now"},' +
                '{"type":"task","assignTo":"owner","subject":"Follow up on {{record.number}}","body":"Task description","value":"2"},' +
                '{"type":"field","target":"Quote","field":"' + RevquilaCore.prefix() + 'Notes__c","source":"value","value":"Updated by Rule"},' +
                '{"type":"webhook","url":"https://example.com/webhook","message":"Webhook triggered"},' +
                '{"type":"slack","url":"https://hooks.slack.com/test","message":"Slack notification"},' +
                '{"type":"email","to":"contact","subject":"Hello","body":"World"},' +
                '{"type":"flow","flow":"AutoFlowTest"}' +
              ']' +
            '}' +
          ']' +
        '}' +
      '}';
      RevquilaSettings.use(autoConfig);

      RevquilaAutomation.Context ctx = new RevquilaAutomation.Context();
      ctx.recordId = quote.Id;
      ctx.recordKind = 'quote';
      ctx.quote = quote;
      ctx.facts = new Map<String, Object>{
        'record.number' => 'Q-100',
        'account.name' => 'Acme Test',
        'quote.policyIssue' => 'High discount',
        'quote.note' => 'Discount rejected',
        'payment.amount' => 'INR 50,000',
        'subscription.daysLeft' => '30'
      };
      ctx.users.put('owner', new Set<Id>{ admin.Id });
      ctx.users.put('approvers', new Set<Id>{ admin.Id });
      ctx.users.put('account_owner', new Set<Id>{ admin.Id });
      ctx.emails.put('contact', 'contact@example.com');
      ctx.emails.put('billing', 'billing@example.com');
      ctx.emails.put('owner', 'owner@example.com');
      ctx.targets.put('Account', acc.Id);
      ctx.targets.put('Quote', quote.Id);

      Test.startTest();
      // Test firing for each moment to hit builtIn branches
      List<String> moments = new List<String>{
        'quote_created',
        RevquilaCore.QUOTE_SUBMITTED,
        RevquilaCore.QUOTE_APPROVED,
        RevquilaCore.QUOTE_REJECTED,
        RevquilaCore.QUOTE_SENT,
        RevquilaCore.QUOTE_SIGNED,
        RevquilaCore.INVOICE_SENT,
        RevquilaCore.INVOICE_RAISED,
        RevquilaCore.INVOICE_OVERDUE,
        RevquilaCore.PAYMENT_RECEIVED,
        RevquilaCore.INVOICE_PAID,
        RevquilaCore.RENEWAL_DUE
      };

      for (String m : moments) {
        ctx.moment = m;
        RevquilaAutomation.fire(ctx);
      }
      Test.stopTest();

      Quote__c updated = [SELECT Notes__c FROM Quote__c WHERE Id = :quote.Id];
      Assert.areEqual('Updated by Rule', updated.Notes__c);
    }
  }

  @IsTest
  static void testRevquilaActionsAllVerbs() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Action Co', RevquilaTestData.HOME_STATE);
      Quote__c quote = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Reference__c = 'ACT-Q1',
        Total__c = 10000,
        Net_Amount__c = 10000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert quote;

      Invoice__c inv = new Invoice__c(
        Account__c = acc.Id,
        Due_On__c = Date.today().addDays(30),
        Total__c = 5000,
        Net_Amount__c = 5000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert inv;

      Contract__c contr = new Contract__c(
        Account__c = acc.Id,
        Status__c = 'active',
        Start_Date__c = Date.today().addDays(-30),
        End_Date__c = Date.today().addDays(335),
        Term_Months__c = 12,
        Auto_Renew__c = true,
        Exchange_Rate__c = 1,
        Currency_Code__c = 'INR',
        Country__c = 'India'
      );
      insert contr;

      Subscription__c sub = new Subscription__c(
        Account__c = acc.Id,
        Contract__c = contr.Id,
        Status__c = 'active',
        Start_Date__c = Date.today().addDays(-30),
        Renewal_Date__c = Date.today().addDays(335),
        Exchange_Rate__c = 1,
        Currency_Code__c = 'INR',
        Country__c = 'India'
      );
      insert sub;

      List<String> actions = new List<String>{
        'submit_quote',
        'approve_quote',
        'reject_quote',
        'send_quote',
        'sign_quote',
        'revise_quote',
        'activate_order',
        'invoice_order',
        'record_payment',
        'payment_link',
        'log_usage',
        'renewal_quote',
        'amend_contract',
        'cancel_subscription',
        'run_billing',
        'run_dunning',
        'recognize_revenue',
        'generate_einvoice',
        'issue_credit_note',
        'sync_opportunity',
        'ai_quote_advice',
        'ai_proposal',
        'provision_service_cloud',
        'publish_event',
        'resend_invoice',
        'request_refund',
        'unknown_custom_action'
      };

      List<RevquilaActions.Request> requests = new List<RevquilaActions.Request>();
      for (String a : actions) {
        RevquilaActions.Request r = new RevquilaActions.Request();
        r.action = a;
        r.recordId = a.contains('quote') ? quote.Id : (a.contains('invoice') || a.contains('payment') ? inv.Id : (a.contains('contract') ? contr.Id : sub.Id));
        r.amount = 100;
        r.quantity = 10;
        r.note = 'Test note';
        r.dateValue = Date.today();
        requests.add(r);
      }

      Test.startTest();
      List<RevquilaActions.Result> results = RevquilaActions.run(requests);
      Assert.areEqual(actions.size(), results.size());
      Test.stopTest();
    }
  }

  @IsTest
  static void testApprovalChains() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Approvals Co', RevquilaTestData.HOME_STATE);
      Quote__c quote = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Total__c = 100000,
        Net_Amount__c = 100000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert quote;

      String configRules = '{' +
        '"approvalsMode": "rules",' +
        '"approvalRules": [' +
          '{' +
            '"name": "High Value Quote",' +
            '"active": true,' +
            '"conditions": [{"field":"quote.net","op":"gt","value":"50000"}],' +
            '"steps": [' +
              '{"approver":"user:' + admin.Id + '","label":"VP Sales","isParallel":false},' +
              '{"approver":"permission:Approve_Quotes","label":"Finance","isParallel":true},' +
              '{"approver":"manager","label":"Manager","isParallel":false},' +
              '{"approver":"role:CEO","label":"Executive","isParallel":false}' +
            ']' +
          '}' +
        ']' +
      '}';
      RevquilaSettings.use(configRules);

      Test.startTest();
      Map<String, Object> facts = new Map<String, Object>{ 'quote.net' => 100000 };
      List<Approval_Step__c> firstSteps = RevquilaApprovals.start(quote, facts);
      Assert.isFalse(firstSteps.isEmpty());

      List<RevquilaApprovals.StepView> stepViews = RevquilaApprovals.steps(quote.Id);
      Assert.isFalse(stepViews.isEmpty());

      Boolean canDec = RevquilaApprovals.canDecide(quote.Id);
      Assert.isTrue(canDec);

      RevquilaApprovals.Outcome outcome = RevquilaApprovals.decide(quote.Id, true, 'Approved step 1');
      Assert.isNotNull(outcome);

      if (RevquilaApprovals.canDecide(quote.Id)) {
        RevquilaApprovals.Outcome rejOutcome = RevquilaApprovals.decide(quote.Id, false, 'Rejected step 2');
        Assert.isTrue(rejOutcome.rejected);
      }
      Test.stopTest();
    }
  }

  @IsTest
  static void testSyncGuardMethods() {
    Id dummyQuoteId = 'a00000000000001AAA';
    Id dummyOppId = '006000000000001AAA';

    Assert.isTrue(RevquilaSyncGuard.shouldSyncQuote(dummyQuoteId));
    Assert.isFalse(RevquilaSyncGuard.shouldSyncQuote(dummyQuoteId));
    RevquilaSyncGuard.releaseQuote(dummyQuoteId);
    Assert.isTrue(RevquilaSyncGuard.shouldSyncQuote(dummyQuoteId));

    Assert.isTrue(RevquilaSyncGuard.shouldSyncOpportunity(dummyOppId));
    Assert.isFalse(RevquilaSyncGuard.shouldSyncOpportunity(dummyOppId));
    RevquilaSyncGuard.releaseOpportunity(dummyOppId);
    Assert.isTrue(RevquilaSyncGuard.shouldSyncOpportunity(dummyOppId));

    RevquilaSyncGuard.clear();
    Assert.isFalse(RevquilaSyncGuard.shouldSyncQuote(null));
    Assert.isFalse(RevquilaSyncGuard.shouldSyncOpportunity(null));
  }
}
