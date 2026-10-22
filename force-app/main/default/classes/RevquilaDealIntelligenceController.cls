/**
 * RevquilaDealIntelligenceController
 * AuraEnabled Controller for the RevX AI Deal Intelligence & Win-Rate Predictor LWC.
 */
public with sharing class RevquilaDealIntelligenceController {

  @AuraEnabled
  public static RevquilaDealIntelligenceService.DealEvaluationResult getDealAnalysis(Id quoteId) {
    try {
      return RevquilaDealIntelligenceService.evaluateQuote(quoteId);
    } catch (Exception ex) {
      throw new AuraHandledException('Deal Evaluation Error: ' + ex.getMessage());
    }
  }

  @AuraEnabled
  public static RevquilaDealIntelligenceService.DealEvaluationResult applyDealRecommendation(Id quoteId, Decimal suggestedDiscount, String suggestedTerms) {
    try {
      return RevquilaDealIntelligenceService.applyOptimization(quoteId, suggestedDiscount, suggestedTerms);
    } catch (Exception ex) {
      throw new AuraHandledException('Failed to apply AI recommendation: ' + ex.getMessage());
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<Quote__c> getRecentQuotesForScoring() {
    return [
      SELECT Id, Name, Display_Number__c, Account__r.Name, Total__c, Status__c,
             AI_Deal_Score__c, AI_Win_Probability__c, AI_Deal_Rating__c
      FROM Quote__c
      WITH USER_MODE
      ORDER BY LastModifiedDate DESC
      LIMIT 25
    ];
  }
}
