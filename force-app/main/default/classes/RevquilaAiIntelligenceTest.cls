@IsTest
private class RevquilaAiIntelligenceTest {
  private class AiMock implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest req) {
      HttpResponse res = new HttpResponse();
      res.setHeader('Content-Type', 'application/json');
      res.setStatusCode(200);
      String endpoint = req.getEndpoint();
      if (endpoint.contains('api.openai.com/v1/chat/completions')) {
        String body = req.getBody();
        if (body.contains('Say ping')) {
          res.setBody('{"choices":[{"message":{"content":"pong"}}]}');
        } else if (body.contains('RevX AI Copilot')) {
          res.setBody('{"choices":[{"message":{"content":"This is an AI copilot chat response from OpenAI."}}]}');
        } else {
          res.setBody('{"choices":[{"message":{"content":"{\\"winProbability\\":\\"88\\",\\"winConfidence\\":\\"High\\",\\"benchmarkDiscount\\":\\"10.5\\",\\"actualDiscount\\":\\"12.0\\",\\"discountAnalysis\\":\\"Deal is strong\\",\\"recommendations\\":[\\"Incentivize annual upfront\\"],\\"riskWarnings\\":[\\"Low risk\\"],\\"executiveSummary\\":\\"Executive summary\\",\\"clientPitchEmail\\":\\"Dear Customer\\"}"}}]}');
        }
      } else if (endpoint.contains('generativelanguage.googleapis.com')) {
        String body = req.getBody();
        if (body.contains('ping')) {
          res.setBody('{"candidates":[{"content":{"parts":[{"text":"pong"}]}}]}');
        } else {
          res.setBody('{"candidates":[{"content":{"parts":[{"text":"{\\"winProbability\\":\\"92\\",\\"winConfidence\\":\\"Very High\\",\\"benchmarkDiscount\\":\\"14.0\\",\\"actualDiscount\\":\\"10.0\\",\\"discountAnalysis\\":\\"Healthy margin\\",\\"recommendations\\":[\\"Highlight SLAs\\"],\\"riskWarnings\\":[\\"Adheres to policy\\"],\\"executiveSummary\\":\\"Gemini summary\\",\\"clientPitchEmail\\":\\"Dear Partner\\"}"}]}}]}');
        }
      } else {
        res.setBody('{}');
      }
      return res;
    }
  }

  @IsTest
  static void testHeuristicDealAdviceBranches() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('AI Deal Advice Co', RevquilaTestData.HOME_STATE);
      acc.Industry = 'Technology';
      update acc;

      Map<String, Id> prodIds = RevquilaTestData.products();
      Id platId = prodIds.get('PLAT');

      // 1. High discount quote with policy issue and non-standard terms
      Quote__c q1 = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Reference__c = 'AI-Q1',
        Total__c = 100000,
        Net_Amount__c = 80000,
        Max_Discount__c = 35.0,
        Margin_Percent__c = 15.0,
        Payment_Terms__c = 'Net 60',
        Policy_Issue__c = 'Exceeds standard 15% discount limit',
        Term_Months__c = 24,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert q1;

      Quote_Line__c line1 = new Quote_Line__c(
        Quote__c = q1.Id,
        Product__c = platId,
        Quantity__c = 5,
        Unit_Price__c = 12000,
        List_Amount__c = 60000,
        Net_Amount__c = 40000,
        Discount__c = 33.3,
        Sort_Order__c = 1
      );
      insert line1;

      Test.startTest();
      RevquilaAiService.AdviceResult adv1 = RevquilaAiService.getAdvice(q1.Id);
      Assert.isNotNull(adv1);
      Assert.isFalse(adv1.isLiveAi);
      Assert.areEqual('RevX Heuristic AI Engine', adv1.providerUsed);
      Assert.isTrue(adv1.actualDiscount >= 35.0);
      Assert.isFalse(adv1.riskWarnings.isEmpty());
      Assert.isFalse(adv1.recommendations.isEmpty());
      Assert.isFalse(adv1.upsellSuggestions.isEmpty());

      // 2. Zero discount quote (full list price) with Net 30
      Quote__c q2 = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Reference__c = 'AI-Q2',
        Total__c = 50000,
        Net_Amount__c = 50000,
        Max_Discount__c = 0,
        Margin_Percent__c = 45.0,
        Payment_Terms__c = 'Net 30',
        Term_Months__c = 12,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert q2;

      RevquilaAiService.AdviceResult adv2 = RevquilaAiService.getAdvice(q2.Id);
      Assert.isNotNull(adv2);
      Assert.areEqual(0, adv2.actualDiscount);
      Assert.isTrue(adv2.discountAnalysis.contains('0% discount'));

      Test.stopTest();
    }
  }

  @IsTest
  static void testLiveOpenAiAdvice() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Revquila_Secrets__c sec = new Revquila_Secrets__c(
        SetupOwnerId = UserInfo.getOrganizationId(),
        AI_Provider__c = 'openai',
        AI_Api_Key__c = 'sk-test-live-openai-key',
        AI_Model__c = 'gpt-4o-mini'
      );
      Database.insert(sec, true, AccessLevel.SYSTEM_MODE);

      Account acc = RevquilaTestData.account('Live AI Advice Co', RevquilaTestData.HOME_STATE);
      Quote__c q = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Reference__c = 'LIVE-AI-Q',
        Total__c = 120000,
        Net_Amount__c = 100000,
        Max_Discount__c = 10.0,
        Margin_Percent__c = 35.0,
        Payment_Terms__c = 'Net 30',
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert q;

      Test.setMock(HttpCalloutMock.class, new AiMock());
      Test.startTest();
      RevquilaAiService.AdviceResult openAiAdv = RevquilaAiService.getAdvice(q.Id);
      Assert.isNotNull(openAiAdv);
      Test.stopTest();
    }
  }

  @IsTest
  static void testLiveGeminiAdvice() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Revquila_Secrets__c sec = new Revquila_Secrets__c(
        SetupOwnerId = UserInfo.getOrganizationId(),
        AI_Provider__c = 'gemini',
        AI_Api_Key__c = 'gemini-key-123',
        AI_Model__c = 'gemini-1.5-flash'
      );
      Database.insert(sec, true, AccessLevel.SYSTEM_MODE);

      Account acc = RevquilaTestData.account('Live Gemini Advice Co', RevquilaTestData.HOME_STATE);
      Quote__c q = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Reference__c = 'LIVE-GEM-Q',
        Total__c = 120000,
        Net_Amount__c = 100000,
        Max_Discount__c = 10.0,
        Margin_Percent__c = 35.0,
        Payment_Terms__c = 'Net 30',
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert q;

      Test.setMock(HttpCalloutMock.class, new AiMock());
      Test.startTest();
      RevquilaAiService.AdviceResult geminiAdv = RevquilaAiService.getAdvice(q.Id);
      Assert.isNotNull(geminiAdv);
      Test.stopTest();
    }
  }

  @IsTest
  static void testConnectionTests() {
    Test.setMock(HttpCalloutMock.class, new AiMock());
    Test.startTest();

    // Local
    Map<String, Object> connLocal = RevquilaAiService.testConnection('local', null, null);
    Assert.isTrue((Boolean) connLocal.get('ok'));

    // Empty Key
    Map<String, Object> connEmptyKey = RevquilaAiService.testConnection('openai', '', 'gpt-4o-mini');
    Assert.isFalse((Boolean) connEmptyKey.get('ok'));

    // OpenAI
    Map<String, Object> connOpenAi = RevquilaAiService.testConnection('openai', 'sk-test', 'gpt-4o-mini');
    Assert.isTrue((Boolean) connOpenAi.get('ok'));

    // Gemini
    Map<String, Object> connGemini = RevquilaAiService.testConnection('gemini', 'gem-test', 'gemini-1.5-flash');
    Assert.isTrue((Boolean) connGemini.get('ok'));

    // Unsupported
    Map<String, Object> connOther = RevquilaAiService.testConnection('claude', 'key', 'model');
    Assert.isFalse((Boolean) connOther.get('ok'));

    Test.stopTest();
  }

  @IsTest
  static void testConversationalChatbotEngine() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Chatbot Test Co', RevquilaTestData.HOME_STATE);
      Quote__c q = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'approved',
        Display_Number__c = 'Q-REVX-001',
        Total__c = 75000,
        Net_Amount__c = 75000,
        Max_Discount__c = 5.0,
        Margin_Percent__c = 40.0,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert q;

      Invoice__c inv = new Invoice__c(
        Account__c = acc.Id,
        Number__c = 'INV-CHAT-01',
        Sent_On__c = Date.today().addDays(-5),
        Due_On__c = Date.today().addDays(25),
        Total__c = 75000,
        Net_Amount__c = 75000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert inv;

      Test.startTest();

      // 1. Empty greeting
      RevquilaAiService.ChatResponse chat1 = RevquilaAiService.chat('', null);
      Assert.isNotNull(chat1);
      Assert.isFalse(chat1.suggestedActions.isEmpty());

      // 2. Balance & Overdue inquiry
      RevquilaAiService.ChatResponse chatBal = RevquilaAiService.chat('What is customer balance and overdue?', inv.Id);
      Assert.isNotNull(chatBal);
      Assert.isTrue(chatBal.reply.contains('Receivables'));

      // 3. Discount & pricing rules
      RevquilaAiService.ChatResponse chatDisc = RevquilaAiService.chat('Explain discount rules and margin tiers', q.Id);
      Assert.isNotNull(chatDisc);
      Assert.isTrue(chatDisc.reply.contains('Pricing'));

      // 4. GST & e-Invoice
      RevquilaAiService.ChatResponse chatGst = RevquilaAiService.chat('Help me with gst and einvoice compliance', inv.Id);
      Assert.isNotNull(chatGst);
      Assert.isTrue(chatGst.reply.contains('GST'));

      // 5. Quote & deal win advisor
      RevquilaAiService.ChatResponse chatDeal = RevquilaAiService.chat('Give me deal advice and win probability', q.Id);
      Assert.isNotNull(chatDeal);
      Assert.isTrue(chatDeal.reply.contains('Deal'));

      // 6. Generic quote overview
      RevquilaAiService.ChatResponse chatQuoteGen = RevquilaAiService.chat('How do quotes work?', null);
      Assert.isNotNull(chatQuoteGen);

      // 7. Renewals & subscriptions
      RevquilaAiService.ChatResponse chatRenew = RevquilaAiService.chat('How do renew and churn alerts work?', acc.Id);
      Assert.isNotNull(chatRenew);
      Assert.isTrue(chatRenew.reply.contains('Renewal'));

      // 8. General help
      RevquilaAiService.ChatResponse chatHelp = RevquilaAiService.chat('Hello, help me navigate RevX', null);
      Assert.isNotNull(chatHelp);

      Test.stopTest();
    }
  }

  @IsTest
  static void testLiveChatOpenAi() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Revquila_Secrets__c sec = new Revquila_Secrets__c(
        SetupOwnerId = UserInfo.getOrganizationId(),
        AI_Provider__c = 'openai',
        AI_Api_Key__c = 'sk-live-chat-test'
      );
      Database.insert(sec, true, AccessLevel.SYSTEM_MODE);

      Account acc = RevquilaTestData.account('Live Chat Co', RevquilaTestData.HOME_STATE);
      Quote__c q = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Total__c = 50000,
        Net_Amount__c = 50000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert q;

      Test.setMock(HttpCalloutMock.class, new AiMock());
      Test.startTest();
      RevquilaAiService.ChatResponse openAiChat = RevquilaAiService.chat('Can we discount 10%?', q.Id);
      Assert.isNotNull(openAiChat);
      Test.stopTest();
    }
  }

  @IsTest
  static void testLiveChatGemini() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Revquila_Secrets__c sec = new Revquila_Secrets__c(
        SetupOwnerId = UserInfo.getOrganizationId(),
        AI_Provider__c = 'gemini',
        AI_Api_Key__c = 'gemini-live-chat-test'
      );
      Database.insert(sec, true, AccessLevel.SYSTEM_MODE);

      Account acc = RevquilaTestData.account('Live Gemini Chat Co', RevquilaTestData.HOME_STATE);
      Quote__c q = new Quote__c(
        Account__c = acc.Id,
        Status__c = 'draft',
        Total__c = 50000,
        Net_Amount__c = 50000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert q;

      Test.setMock(HttpCalloutMock.class, new AiMock());
      Test.startTest();
      RevquilaAiService.ChatResponse geminiChat = RevquilaAiService.chat('Can we discount 10%?', q.Id);
      Assert.isNotNull(geminiChat);
      Test.stopTest();
    }
  }

  @IsTest
  static void testAiNegativeValidations() {
    try {
      RevquilaAiService.getAdvice('001000000000000AAA');
      Assert.fail('Invalid quote should throw exception');
    } catch (RevquilaCore.ProblemException e) {
      Assert.isNotNull(e.getMessage());
    }
  }
}
