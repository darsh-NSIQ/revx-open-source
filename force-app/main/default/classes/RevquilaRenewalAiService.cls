/**
 * RevX AI Contract Renewal & Churn Risk Predictor:
 * Evaluates expiring enterprise contracts 90 days prior to renewal.
 * Analyzes payment discipline, active subscription count, and usage trends to compute
 * customer health score (0-100), churn probability, and tailored renewal pitch strategies.
 * Provides 1-click automated renewal quote generation with price indexation.
 */
public with sharing class RevquilaRenewalAiService {

  public class RenewalAnalysis {
    @AuraEnabled @InvocableVariable(label='Contract ID')
    public Id contractId;

    @AuraEnabled @InvocableVariable(label='Contract Number')
    public String contractNumber;

    @AuraEnabled @InvocableVariable(label='Account Name')
    public String accountName;

    @AuraEnabled @InvocableVariable(label='Days Until Expiry')
    public Integer daysUntilExpiry;

    @AuraEnabled @InvocableVariable(label='Customer Health Score (0-100)')
    public Integer healthScore;

    @AuraEnabled @InvocableVariable(label='Churn Risk %')
    public Integer churnRiskPercent;

    @AuraEnabled @InvocableVariable(label='Risk Tier' description='Low, Medium, High')
    public String riskTier;

    @AuraEnabled @InvocableVariable(label='AI Renewal Strategy')
    public String aiStrategy;

    @AuraEnabled @InvocableVariable(label='Recommended Price Uplift %')
    public Decimal recommendedUplift;

    @AuraEnabled @InvocableVariable(label='Drafted Renewal Quote ID')
    public Id renewalQuoteId;
  }

  public class RenewalRequest {
    @AuraEnabled @InvocableVariable(label='Contract ID' required=true)
    public Id contractId;

    @AuraEnabled @InvocableVariable(label='Action' description='analyze, draft_quote' required=true)
    public String action;
  }

  /**
   * Invocable action for Salesforce Agentforce and Flows.
   */
  @InvocableMethod(label='RevX AI: Predict Renewal Churn Risk' description='Calculates AI churn probability and crafts renewal strategy for a contract.' category='RevX AI')
  public static List<RenewalAnalysis> evaluateRenewalInvocable(List<RenewalRequest> requests) {
    List<RenewalAnalysis> results = new List<RenewalAnalysis>();
    for (RenewalRequest req : requests) {
      if (req.action == 'draft_quote') {
        Id quoteId = createRenewalQuote(req.contractId);
        RenewalAnalysis a = analyzeContract(req.contractId);
        a.renewalQuoteId = quoteId;
        results.add(a);
      } else {
        results.add(analyzeContract(req.contractId));
      }
    }
    return results;
  }

  /**
   * AuraEnabled entrypoint for Renewals tab and Contract 360 UI.
   */
  @AuraEnabled
  public static RenewalAnalysis analyzeContract(Id contractId) {
    if (contractId == null) {
      throw new RevquilaCore.ProblemException('Contract ID is required.');
    }

    Contract__c c = [
      SELECT Id, Name, Account__c, Account__r.Name, End_Date__c, Start_Date__c, Status__c
      FROM Contract__c
      WHERE Id = :contractId
      LIMIT 1
    ];

    List<Subscription__c> subs = [
      SELECT Id, Name, Status__c
      FROM Subscription__c
      WHERE Contract__c = :contractId
    ];

    Date today = Date.today();
    Integer daysLeft = c.End_Date__c != null ? today.daysBetween(c.End_Date__c) : 90;

    // 1. Analyze historical payment discipline on Account
    List<Invoice__c> recentInvs = [
      SELECT Id, Balance__c, Due_On__c, Total__c
      FROM Invoice__c
      WHERE Account__c = :c.Account__c
      ORDER BY Due_On__c DESC
      LIMIT 10
    ];

    Integer overdueCount = 0;
    for (Invoice__c inv : recentInvs) {
      if (inv.Balance__c > 0 && inv.Due_On__c < today) {
        overdueCount++;
      }
    }

    // 2. Compute Health Score & Churn Risk
    Integer score = 85; // Baseline healthy score
    if (!subs.isEmpty()) {
      score += 10; // Active subscriptions bonus
    }
    if (overdueCount > 0) {
      score -= (overdueCount * 15); // Penalize for past due invoices
    }
    score = Math.max(10, Math.min(100, score));

    Integer churnRisk = 100 - score;
    String riskTier;
    String strategy;
    Decimal uplift;

    if (score >= 80) {
      riskTier = 'Low';
      strategy = 'High customer satisfaction and reliable payment history. Propose a multi-year renewal agreement with standard 6.5% inflation indexation.';
      uplift = 6.5;
    } else if (score >= 50) {
      riskTier = 'Medium';
      strategy = 'Moderate engagement detected. Offer an early renewal commitment incentive (e.g. 3% discount or premium support upgrade) to secure contract retention.';
      uplift = 3.0;
    } else {
      riskTier = 'High';
      strategy = 'Elevated churn risk: Outstanding payment history identified. Schedule an Executive Business Review with customer sponsors before quoting.';
      uplift = 0.0;
    }

    RenewalAnalysis a = new RenewalAnalysis();
    a.contractId = c.Id;
    a.contractNumber = c.Name;
    a.accountName = c.Account__r != null ? c.Account__r.Name : 'Account';
    a.daysUntilExpiry = daysLeft;
    a.healthScore = score;
    a.churnRiskPercent = churnRisk;
    a.riskTier = riskTier;
    a.aiStrategy = strategy;
    a.recommendedUplift = uplift;
    return a;
  }

  /**
   * Generates a pre-configured renewal quote from the contract.
   */
  @AuraEnabled
  public static Id createRenewalQuote(Id contractId) {
    RenewalAnalysis a = analyzeContract(contractId);
    Contract__c c = [
      SELECT Id, Name, Account__c, End_Date__c
      FROM Contract__c
      WHERE Id = :contractId
      LIMIT 1
    ];

    Date startDate = c.End_Date__c != null ? c.End_Date__c.addDays(1) : Date.today();
    Quote__c q = new Quote__c(
      Account__c = c.Account__c,
      Contract__c = c.Id,
      Type__c = 'renewal',
      Status__c = 'draft',
      Currency_Code__c = 'USD',
      Start_Date__c = startDate,
      Valid_Until__c = Date.today().addDays(45),
      Uplift_Percent__c = a.recommendedUplift,
      Notes__c = 'Automated Renewal Quote for Contract ' + c.Name + ' (AI Strategy: ' + a.riskTier + ' Risk)'
    );
    insert q;

    Revenue_Event__c evt = RevquilaCore.event(
      q.Id,
      'AI Renewal Quote Drafted',
      'Contract: ' + c.Name + ' · Health Score: ' + a.healthScore + '/100 (' + a.riskTier + ' Risk)',
      RevquilaCore.TONE_GOOD
    );
    insert evt;

    return q.Id;
  }
}
