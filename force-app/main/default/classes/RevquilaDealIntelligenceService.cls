/**
 * RevquilaDealIntelligenceService
 * AI-driven Deal Intelligence, Win-Rate Predictor & Prescriptive Discount Advisor.
 * Evaluates pricing elasticity, margin health, payment term cash drag, and customer profile
 * to score deals (0-100) and prescribe win-maximizing optimizations.
 */
public with sharing class RevquilaDealIntelligenceService {

  public class RecommendationItem {
    @AuraEnabled public String id { get; set; }
    @AuraEnabled public String title { get; set; }
    @AuraEnabled public String description { get; set; }
    @AuraEnabled public String impactType { get; set; } // 'win_rate', 'margin', 'cashflow'
    @AuraEnabled public Decimal winRateLift { get; set; }
    @AuraEnabled public Decimal marginSaved { get; set; }
    @AuraEnabled public Decimal suggestedDiscount { get; set; }
    @AuraEnabled public String suggestedTerms { get; set; }
    @AuraEnabled public Boolean canAutoApply { get; set; }
  }

  public class DealEvaluationResult {
    @AuraEnabled public Id quoteId { get; set; }
    @AuraEnabled public String quoteName { get; set; }
    @AuraEnabled public String accountName { get; set; }
    @AuraEnabled public Decimal dealScore { get; set; } // 0 to 100
    @AuraEnabled public Decimal winProbability { get; set; } // 0.00 to 100.00%
    @AuraEnabled public String ratingTier { get; set; } // Hot, Strong, Moderate, At Risk, Critical Risk
    @AuraEnabled public String marginHealth { get; set; } // Healthy, Acceptable, Eroded, Negative
    @AuraEnabled public Decimal currentDiscountPct { get; set; }
    @AuraEnabled public Decimal optimalDiscountPct { get; set; }
    @AuraEnabled public Decimal currentMarginPct { get; set; }
    @AuraEnabled public Decimal potentialMarginSavings { get; set; }
    @AuraEnabled public String paymentTerms { get; set; }
    @AuraEnabled public Decimal quoteTotal { get; set; }
    @AuraEnabled public DateTime evaluatedAt { get; set; }
    @AuraEnabled public List<RecommendationItem> recommendations { get; set; }
    @AuraEnabled public List<String> strategicInsights { get; set; }
    @AuraEnabled public Map<String, Decimal> scoreFactorBreakdown { get; set; }

    public DealEvaluationResult() {
      this.recommendations = new List<RecommendationItem>();
      this.strategicInsights = new List<String>();
      this.scoreFactorBreakdown = new Map<String, Decimal>();
    }
  }

  /**
   * Evaluates a quote's deal dynamics, computes scores, and generates prescriptive guidance.
   */
  public static DealEvaluationResult evaluateQuote(Id quoteId) {
    if (String.isBlank(quoteId)) {
      throw new IllegalArgumentException('Quote Id is required for Deal Intelligence evaluation.');
    }

    List<Quote__c> quotes = [
      SELECT Id, Name, Display_Number__c, Account__c, Account__r.Name, Account__r.Industry,
             Net_Amount__c, Subtotal__c, Total__c, Discount_Total__c, Margin_Percent__c,
             Payment_Terms__c, Term_Months__c, Type__c, Status__c,
             AI_Deal_Score__c, AI_Win_Probability__c, AI_Deal_Rating__c,
             AI_Optimal_Discount__c, AI_Margin_Health__c, AI_Deal_Insights__c
      FROM Quote__c
      WHERE Id = :quoteId
      WITH USER_MODE
      LIMIT 1
    ];

    if (quotes.isEmpty()) {
      throw new IllegalArgumentException('Quote record not found: ' + quoteId);
    }
    Quote__c q = quotes[0];

    List<Quote_Line__c> lines = [
      SELECT Id, Description__c, Product__c, Product__r.Name, Quantity__c, Unit_Price__c,
             Net_Amount__c, Discount__c, Rule_Discount__c, Recurring__c
      FROM Quote_Line__c
      WHERE Quote__c = :quoteId
      WITH USER_MODE
    ];

    DealEvaluationResult result = new DealEvaluationResult();
    result.quoteId = q.Id;
    result.quoteName = q.Display_Number__c != null ? q.Display_Number__c : q.Name;
    result.accountName = q.Account__r != null ? q.Account__r.Name : 'Prospective Client';
    result.paymentTerms = String.isNotBlank(q.Payment_Terms__c) ? q.Payment_Terms__c : 'Net 30';
    result.quoteTotal = q.Total__c != null ? q.Total__c : 0;
    result.evaluatedAt = System.now();

    // 1. Calculate discount and margin percentages
    Decimal subtotal = q.Subtotal__c != null && q.Subtotal__c > 0 ? q.Subtotal__c : (q.Net_Amount__c != null ? q.Net_Amount__c : 0);
    Decimal discountTotal = q.Discount_Total__c != null ? q.Discount_Total__c : 0;
    Decimal currentDiscount = subtotal > 0 ? ((discountTotal / subtotal) * 100).setScale(2) : 0;
    result.currentDiscountPct = currentDiscount;

    Decimal marginPct = q.Margin_Percent__c != null ? q.Margin_Percent__c : 68.0;
    result.currentMarginPct = marginPct;

    // 2. Compute Scoring Factors
    // A. Price Competitiveness & Elasticity Score (Base 40 pts)
    Decimal priceScore = 0;
    Decimal winProb = 0;
    Decimal optimalDiscount = 10.0;

    if (currentDiscount == 0) {
      priceScore = 22; // High margin, but buyers often expect standard SaaS concessions
      winProb = 58;
      optimalDiscount = 6.0;
    } else if (currentDiscount > 0 && currentDiscount <= 12) {
      priceScore = 38; // Optimal sweet spot
      winProb = 84;
      optimalDiscount = currentDiscount;
    } else if (currentDiscount > 12 && currentDiscount <= 20) {
      priceScore = 32;
      winProb = 74;
      optimalDiscount = 11.5;
    } else if (currentDiscount > 20 && currentDiscount <= 30) {
      priceScore = 24;
      winProb = 62;
      optimalDiscount = 14.0;
    } else {
      // > 30% discount - margin erosion & signals budget/fit problem
      priceScore = 14;
      winProb = 46;
      optimalDiscount = 15.0;
    }
    result.optimalDiscountPct = optimalDiscount;

    // B. Margin Health Factor (Base 30 pts)
    Decimal marginScore = 0;
    String marginHealth = 'Healthy';
    if (marginPct >= 65) {
      marginScore = 30;
      marginHealth = 'Healthy';
    } else if (marginPct >= 45) {
      marginScore = 22;
      marginHealth = 'Acceptable';
    } else if (marginPct >= 20) {
      marginScore = 12;
      marginHealth = 'Eroded';
    } else {
      marginScore = 4;
      marginHealth = 'Negative';
    }
    result.marginHealth = marginHealth;

    // C. Payment Terms & Cashflow Drag (Base 15 pts)
    Decimal termsScore = 0;
    String terms = result.paymentTerms.toLowerCase();
    if (terms.contains('receipt') || terms.contains('advance') || terms.contains('net 15')) {
      termsScore = 15;
      winProb += 4;
    } else if (terms.contains('net 30')) {
      termsScore = 12;
    } else if (terms.contains('net 45') || terms.contains('net 60')) {
      termsScore = 6;
      winProb -= 6;
    } else {
      // Net 90 or extreme credit
      termsScore = 2;
      winProb -= 12;
    }

    // D. Term Duration & Multi-Year LTV (Base 15 pts)
    Decimal termMonths = q.Term_Months__c != null ? q.Term_Months__c : 12;
    Decimal termScore = 0;
    if (termMonths >= 36) {
      termScore = 15;
      winProb += 6;
    } else if (termMonths >= 24) {
      termScore = 12;
      winProb += 3;
    } else if (termMonths >= 12) {
      termScore = 10;
    } else {
      termScore = 5;
      winProb -= 5;
    }

    // Clamp win probability
    if (winProb > 98) winProb = 98;
    if (winProb < 15) winProb = 15;
    result.winProbability = winProb.setScale(1);

    // Compute Overall Deal Score
    Decimal overallScore = (priceScore + marginScore + termsScore + termScore);
    if (overallScore > 100) overallScore = 100;
    if (overallScore < 10) overallScore = 10;
    result.dealScore = overallScore.setScale(0);

    // Factor Breakdown map
    result.scoreFactorBreakdown.put('Price Competitiveness', priceScore);
    result.scoreFactorBreakdown.put('Margin Health', marginScore);
    result.scoreFactorBreakdown.put('Payment Terms Drag', termsScore);
    result.scoreFactorBreakdown.put('Contract LTV Duration', termScore);

    // Rating Tier
    if (overallScore >= 80) result.ratingTier = 'Hot';
    else if (overallScore >= 68) result.ratingTier = 'Strong';
    else if (overallScore >= 52) result.ratingTier = 'Moderate';
    else if (overallScore >= 38) result.ratingTier = 'At Risk';
    else result.ratingTier = 'Critical Risk';

    // Calculate Potential Margin Dollar Savings
    if (currentDiscount > optimalDiscount && subtotal > 0) {
      Decimal savedDollars = (subtotal * ((currentDiscount - optimalDiscount) / 100)).setScale(2);
      result.potentialMarginSavings = savedDollars;
    } else {
      result.potentialMarginSavings = 0;
    }

    // 3. Generate Prescriptive Recommendations
    buildPrescriptiveRecommendations(result, q, currentDiscount, optimalDiscount, subtotal);

    // 4. Strategic Insights & Competitor Battlecards
    buildStrategicInsights(result, q, lines);

    // 5. Persist AI Scores on Quote__c
    saveScoresToQuote(q, result);

    return result;
  }

  /**
   * One-click AI action to apply recommended discount and terms directly to the quote.
   */
  public static DealEvaluationResult applyOptimization(Id quoteId, Decimal targetDiscount, String targetTerms) {
    Quote__c q = [SELECT Id, Subtotal__c, Payment_Terms__c FROM Quote__c WHERE Id = :quoteId WITH USER_MODE LIMIT 1];

    if (String.isNotBlank(targetTerms)) {
      q.Payment_Terms__c = targetTerms;
    }

    List<Quote_Line__c> lines = [
      SELECT Id, Unit_Price__c, Quantity__c, Discount__c, Net_Amount__c
      FROM Quote_Line__c
      WHERE Quote__c = :quoteId
      WITH USER_MODE
    ];

    if (targetDiscount != null && targetDiscount >= 0 && !lines.isEmpty()) {
      for (Quote_Line__c l : lines) {
        l.Discount__c = targetDiscount;
        Decimal gross = (l.Unit_Price__c != null ? l.Unit_Price__c : 0) * (l.Quantity__c != null ? l.Quantity__c : 1);
        l.Net_Amount__c = gross * (1.0 - (targetDiscount / 100.0));
      }
      SObjectAccessDecision lineDecision = Security.stripInaccessible(AccessType.UPDATABLE, lines);
      update lineDecision.getRecords();
    }

    SObjectAccessDecision qDecision = Security.stripInaccessible(AccessType.UPDATABLE, new List<Quote__c>{ q });
    update qDecision.getRecords();

    // Re-evaluate deal
    return evaluateQuote(quoteId);
  }

  // =========================================================================
  // HELPER LOGIC: RECOMMENDATIONS & INSIGHTS
  // =========================================================================

  private static void buildPrescriptiveRecommendations(DealEvaluationResult res, Quote__c q, Decimal currDisc, Decimal optDisc, Decimal subtotal) {
    Integer recIdx = 1;

    // Recommendation 1: Discount Right-Sizing
    if (currDisc > optDisc) {
      RecommendationItem r1 = new RecommendationItem();
      r1.id = 'rec-' + (recIdx++);
      r1.title = 'Optimize Discount to ' + optDisc + '%';
      r1.impactType = 'margin';
      r1.marginSaved = res.potentialMarginSavings;
      r1.winRateLift = 1.5; // Marginally impacts win-rate positively by eliminating over-discounting skepticism
      r1.suggestedDiscount = optDisc;
      r1.description = 'Current discount of ' + currDisc + '% exceeds the industry sweet spot of ' + optDisc + '%. Reducing to ' + optDisc + '% preserves $' + res.potentialMarginSavings + ' in ARR margin with zero win-rate degradation.';
      r1.canAutoApply = true;
      res.recommendations.add(r1);
    } else if (currDisc == 0 && res.winProbability < 65) {
      RecommendationItem r1 = new RecommendationItem();
      r1.id = 'rec-' + (recIdx++);
      r1.title = 'Offer Strategic 6% Competitive Concession';
      r1.impactType = 'win_rate';
      r1.winRateLift = 18.0;
      r1.suggestedDiscount = 6.0;
      r1.description = 'Quote currently offers 0% discount. Enterprise procurement frequently rejects 0% concession proposals. Introducing a 6% commitment incentive boosts Win Probability from ' + res.winProbability + '% to ' + (res.winProbability + 18) + '%.';
      r1.canAutoApply = true;
      res.recommendations.add(r1);
    }

    // Recommendation 2: Payment Terms Cashflow Accelerators
    if (res.paymentTerms.equalsIgnoreCase('Net 60') || res.paymentTerms.equalsIgnoreCase('Net 90')) {
      RecommendationItem r2 = new RecommendationItem();
      r2.id = 'rec-' + (recIdx++);
      r2.title = 'Accelerate Cash Flow: Switch from ' + res.paymentTerms + ' to Net 30';
      r2.impactType = 'cashflow';
      r2.winRateLift = 8.0;
      r2.suggestedTerms = 'Net 30';
      r2.description = res.paymentTerms + ' terms introduce severe DSO (Days Sales Outstanding) risk. Counter-offer Net 30 with 2% early-pay incentive to improve cash collection velocity.';
      r2.canAutoApply = true;
      res.recommendations.add(r2);
    }

    // Recommendation 3: Multi-Year Duration Upsell
    Decimal termMonths = q.Term_Months__c != null ? q.Term_Months__c : 12;
    if (termMonths < 24) {
      RecommendationItem r3 = new RecommendationItem();
      r3.id = 'rec-' + (recIdx++);
      r3.title = 'Propose 24-Month Lock-In with Price Protection';
      r3.impactType = 'win_rate';
      r3.winRateLift = 12.0;
      r3.description = 'Multi-year commitments protect ARR and lock in customer retention. Offer a 3% second-year price-cap to secure a 2-year subscription.';
      r3.canAutoApply = false;
      res.recommendations.add(r3);
    }
  }

  private static void buildStrategicInsights(DealEvaluationResult res, Quote__c q, List<Quote_Line__c> lines) {
    res.strategicInsights.add('Deal Momentum: Deal score rated ' + res.ratingTier + ' (' + res.dealScore + '/100) based on ' + lines.size() + ' line items totaling $' + res.quoteTotal + '.');

    if (res.currentMarginPct >= 65) {
      res.strategicInsights.add('Strong Gross Margin (' + res.currentMarginPct + '%): Quote maintains superior unit economics well above the 55% target threshold.');
    } else {
      res.strategicInsights.add('Margin Alert: Gross margin is currently ' + res.currentMarginPct + '%. Scrutinize third-party or professional services labor costs before signing.');
    }

    res.strategicInsights.add('Negotiation Playbook: Lead with RevX native Salesforce Quote-to-Cash architecture (no external iPaaS sync latency) as the decisive competitive differentiator against standalone billing point solutions.');
  }

  private static void saveScoresToQuote(Quote__c q, DealEvaluationResult res) {
    try {
      q.AI_Deal_Score__c = res.dealScore;
      q.AI_Win_Probability__c = res.winProbability;
      q.AI_Deal_Rating__c = res.ratingTier;
      q.AI_Optimal_Discount__c = res.optimalDiscountPct;
      q.AI_Margin_Health__c = res.marginHealth;
      q.AI_Last_Analyzed__c = res.evaluatedAt;

      // Summary string for insights
      String insightsSummary = 'Deal Score: ' + res.dealScore + '/100 (' + res.ratingTier + ')\n' +
        'Win Probability: ' + res.winProbability + '%\n' +
        'Optimal Discount: ' + res.optimalDiscountPct + '%\n' +
        'Margin Health: ' + res.marginHealth + ' (' + res.currentMarginPct + '%)\n' +
        'Key Guidance: ' + (res.recommendations.isEmpty() ? 'No adjustments needed.' : res.recommendations[0].title);
      q.AI_Deal_Insights__c = insightsSummary.left(4000);

      SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<Quote__c>{ q });
      update decision.getRecords();
    } catch (Exception ex) {
      System.debug(LoggingLevel.WARN, 'Could not persist AI deal scores: ' + ex.getMessage());
    }
  }
}
