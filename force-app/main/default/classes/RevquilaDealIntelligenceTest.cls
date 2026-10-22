/**
 * RevquilaDealIntelligenceTest
 * Comprehensive unit test suite for AI Deal Intelligence, Win-Rate Predictor & Prescriptive Discount Advisor.
 */
@IsTest
private class RevquilaDealIntelligenceTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Global Apex Enterprises', Industry = 'Technology');
    insert acc;

    Product2 prod = new Product2(Name = 'RevX Cloud License', IsActive = true);
    insert prod;

    Quote__c q1 = new Quote__c(
      Account__c = acc.Id,
      Subtotal__c = 10000.00,
      Discount_Total__c = 1200.00, // 12% discount
      Net_Amount__c = 8800.00,
      Total__c = 8800.00,
      Margin_Percent__c = 72.0,
      Payment_Terms__c = 'Net 30',
      Term_Months__c = 12,
      Status__c = 'draft'
    );
    insert q1;

    Quote_Line__c line1 = new Quote_Line__c(
      Quote__c = q1.Id,
      Product__c = prod.Id,
      Quantity__c = 10,
      Unit_Price__c = 1000.00,
      Discount__c = 12.0,
      Net_Amount__c = 8800.00,
      Description__c = '10 Enterprise Licenses'
    );
    insert line1;

    // Quote 2 with excessive discount and Net 60
    Quote__c q2 = new Quote__c(
      Account__c = acc.Id,
      Subtotal__c = 20000.00,
      Discount_Total__c = 8000.00, // 40% discount
      Net_Amount__c = 12000.00,
      Total__c = 12000.00,
      Margin_Percent__c = 35.0,
      Payment_Terms__c = 'Net 60',
      Term_Months__c = 12,
      Status__c = 'draft'
    );
    insert q2;

    Quote_Line__c line2 = new Quote_Line__c(
      Quote__c = q2.Id,
      Product__c = prod.Id,
      Quantity__c = 20,
      Unit_Price__c = 1000.00,
      Discount__c = 40.0,
      Net_Amount__c = 12000.00,
      Description__c = '20 Over-discounted Licenses'
    );
    insert line2;

    // Quote 3 with 0% discount
    Quote__c q3 = new Quote__c(
      Account__c = acc.Id,
      Subtotal__c = 5000.00,
      Discount_Total__c = 0.00,
      Net_Amount__c = 5000.00,
      Total__c = 5000.00,
      Margin_Percent__c = 80.0,
      Payment_Terms__c = 'Net 15',
      Term_Months__c = 36,
      Status__c = 'draft'
    );
    insert q3;
  }

  @IsTest
  static void testOptimalDealEvaluation() {
    Quote__c q1 = [SELECT Id FROM Quote__c WHERE Discount_Total__c = 1200.00 LIMIT 1];

    Test.startTest();
    RevquilaDealIntelligenceService.DealEvaluationResult res =
      RevquilaDealIntelligenceService.evaluateQuote(q1.Id);
    Test.stopTest();

    System.assertNotEquals(null, res, 'Result should be generated');
    System.assert(res.dealScore >= 50 && res.dealScore <= 100, 'Deal score should be in valid range: ' + res.dealScore);
    System.assert(res.winProbability > 50, 'Win probability should be strong');
    System.assertEquals('Healthy', res.marginHealth, 'Margin should be healthy');
    System.assertNotEquals(0, res.strategicInsights.size(), 'Strategic insights should be returned');

    Quote__c updated = [SELECT Id, AI_Deal_Score__c, AI_Win_Probability__c, AI_Deal_Rating__c FROM Quote__c WHERE Id = :q1.Id];
    System.assertNotEquals(null, updated.AI_Deal_Score__c, 'Quote should store AI Deal Score');
    System.assertNotEquals(null, updated.AI_Win_Probability__c, 'Quote should store AI Win Probability');
  }

  @IsTest
  static void testExcessiveDiscountAndTermsRecommendations() {
    Quote__c q2 = [SELECT Id FROM Quote__c WHERE Discount_Total__c = 8000.00 LIMIT 1];

    Test.startTest();
    RevquilaDealIntelligenceService.DealEvaluationResult res =
      RevquilaDealIntelligenceService.evaluateQuote(q2.Id);
    Test.stopTest();

    System.assertNotEquals(null, res, 'Result should be generated');
    System.assert(res.recommendations.size() >= 2, 'Should recommend discount right-sizing and Net 30 switch');

    Boolean hasDiscountRec = false;
    Boolean hasTermsRec = false;
    for (RevquilaDealIntelligenceService.RecommendationItem r : res.recommendations) {
      if (r.impactType == 'margin') hasDiscountRec = true;
      if (r.impactType == 'cashflow') hasTermsRec = true;
    }
    System.assert(hasDiscountRec, 'Should recommend margin-saving discount reduction');
    System.assert(hasTermsRec, 'Should recommend switching from Net 60');
  }

  @IsTest
  static void testZeroDiscountConcessionRecommendation() {
    Quote__c q3 = [SELECT Id FROM Quote__c WHERE Discount_Total__c = 0.00 LIMIT 1];

    Test.startTest();
    RevquilaDealIntelligenceService.DealEvaluationResult res =
      RevquilaDealIntelligenceService.evaluateQuote(q3.Id);
    Test.stopTest();

    System.assertNotEquals(null, res, 'Result should be generated');
    System.assertEquals(0, res.currentDiscountPct, 'Current discount is 0');
  }

  @IsTest
  static void testApplyOptimizationAction() {
    Quote__c q2 = [SELECT Id FROM Quote__c WHERE Discount_Total__c = 8000.00 LIMIT 1];

    Test.startTest();
    RevquilaDealIntelligenceService.DealEvaluationResult updatedRes =
      RevquilaDealIntelligenceService.applyOptimization(q2.Id, 12.0, 'Net 30');
    Test.stopTest();

    Quote__c updated = [SELECT Id, Payment_Terms__c, AI_Deal_Score__c FROM Quote__c WHERE Id = :q2.Id];
    System.assertEquals('Net 30', updated.Payment_Terms__c, 'Payment terms should be updated to Net 30');

    Quote_Line__c updatedLine = [SELECT Id, Discount__c FROM Quote_Line__c WHERE Quote__c = :q2.Id LIMIT 1];
    System.assertEquals(12.0, updatedLine.Discount__c, 'Line discount should be optimized to 12%');
  }

  @IsTest
  static void testControllerEndpoints() {
    Quote__c q1 = [SELECT Id FROM Quote__c LIMIT 1];

    Test.startTest();
    // 1. Analyze
    RevquilaDealIntelligenceService.DealEvaluationResult res =
      RevquilaDealIntelligenceController.getDealAnalysis(q1.Id);
    System.assertNotEquals(null, res, 'Controller should return evaluation');

    // 2. Apply
    RevquilaDealIntelligenceService.DealEvaluationResult optRes =
      RevquilaDealIntelligenceController.applyDealRecommendation(q1.Id, 10.0, 'Net 30');
    System.assertNotEquals(null, optRes, 'Controller should apply recommendation');

    // 3. Recent quotes
    List<Quote__c> recents = RevquilaDealIntelligenceController.getRecentQuotesForScoring();
    System.assertNotEquals(0, recents.size(), 'Recent quotes should be returned');
    Test.stopTest();
  }

  @IsTest
  static void testNegativeCases() {
    Test.startTest();
    try {
      RevquilaDealIntelligenceService.evaluateQuote(null);
      System.assert(false, 'Should have thrown exception for null Quote Id');
    } catch (Exception ex) {
      System.assert(ex.getMessage().contains('required'), 'Expected required error message');
    }

    try {
      Id fakeId = UserInfo.getUserId();
      RevquilaDealIntelligenceController.getDealAnalysis(fakeId);
      System.assert(false, 'Should have thrown exception for non-existent quote');
    } catch (Exception ex) {
      System.assert(ex != null, 'Expected exception on fake quote Id');
    }

    try {
      Id fakeId = UserInfo.getUserId();
      RevquilaDealIntelligenceController.applyDealRecommendation(fakeId, 10.0, 'Net 30');
      System.assert(false, 'Should have thrown exception for non-existent quote in apply recommendation');
    } catch (Exception ex) {
      System.assert(ex != null, 'Expected exception on fake quote Id in apply recommendation');
    }
    Test.stopTest();
  }
}
