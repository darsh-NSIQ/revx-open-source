/**
 * RevX Agentforce Invocable Actions:
 * Bridges Salesforce Agentforce autonomous agents, Einstein Bots, and Salesforce Flows
 * to RevX AI Revenue Engine (Deal Optimization, Win Probability, AI Dunning, Proposal Pitches).
 */
public with sharing class RevquilaAgentforceActions {

  public class AiRequest {
    @InvocableVariable(label='AI Capability' description='deal_optimization, dunning_reminder, proposal_pitch, account_summary' required=true)
    public String capability;

    @InvocableVariable(label='Record Id' description='Target Quote, Invoice, or Account ID' required=true)
    public Id recordId;

    @InvocableVariable(label='Tone' description='polite, firm, urgent, executive')
    public String tone;

    @InvocableVariable(label='User Prompt' description='Optional prompt or query context')
    public String userPrompt;
  }

  public class AiResult {
    @InvocableVariable(label='Is Successful')
    public Boolean success;

    @InvocableVariable(label='AI Output Text')
    public String outputText;

    @InvocableVariable(label='Win Probability')
    public Integer winProbability;

    @InvocableVariable(label='Recommended Discount %')
    public Decimal recommendedDiscount;

    @InvocableVariable(label='Risk Warnings')
    public String riskWarnings;

    @InvocableVariable(label='Subject Line')
    public String subjectLine;
  }

  @InvocableMethod(label='RevX AI: Agentforce Revenue Assistant' description='Powers Agentforce and Einstein Bots with RevX deal optimization, dunning collections drafting, and revenue intelligence.' category='RevX AI')
  public static List<AiResult> execute(List<AiRequest> requests) {
    List<AiResult> results = new List<AiResult>();

    for (AiRequest req : requests) {
      AiResult res = new AiResult();
      res.success = true;
      try {
        String cap = String.isNotBlank(req.capability) ? req.capability.toLowerCase().trim() : 'deal_optimization';

        if (cap == 'deal_optimization') {
          RevquilaAiService.AdviceResult advice = RevquilaAiService.getAdvice(req.recordId);
          res.winProbability = advice.winProbability;
          res.recommendedDiscount = advice.benchmarkDiscount;
          res.riskWarnings = advice.riskWarnings != null ? String.join(advice.riskWarnings, '; ') : 'None';
          res.outputText = advice.executiveSummary + '\n\n' + advice.discountAnalysis;
          res.subjectLine = 'Deal Optimization: ' + advice.winProbability + '% Win Probability';
        } else if (cap == 'dunning_reminder') {
          Map<String, Object> dunning = RevquilaDunningController.draftAiDunningNotice(req.recordId, req.tone);
          res.subjectLine = (String) dunning.get('subject');
          res.outputText = (String) dunning.get('body');
        } else if (cap == 'proposal_pitch') {
          Map<String, String> proposalMap = RevquilaAiController.generateProposal(req.recordId);
          res.outputText = (proposalMap != null && proposalMap.containsKey('executiveSummary')) ? proposalMap.get('executiveSummary') : 'Proposal generated successfully.';
          res.subjectLine = 'Executive Proposal Pitch';
        } else if (cap == 'account_summary') {
          Account acc = [
            SELECT Id, Name, Billing_Email__c, Auto_Pay__c
            FROM Account
            WHERE Id = :req.recordId
            LIMIT 1
          ];
          List<Invoice__c> openInvs = [
            SELECT Id, Balance__c
            FROM Invoice__c
            WHERE Account__c = :acc.Id AND Balance__c > 0
          ];
          Decimal openBalance = 0;
          for (Invoice__c inv : openInvs) {
            openBalance += (inv.Balance__c != null ? inv.Balance__c : 0);
          }
          Integer subCount = [SELECT COUNT() FROM Subscription__c WHERE Account__c = :acc.Id];
          res.outputText = 'Account: ' + acc.Name + '\nActive Subscriptions: ' + subCount + '\nOpen Invoices: ' + openInvs.size() + '\nOutstanding Balance: $' + openBalance;
          res.subjectLine = 'Revenue 360 Summary for ' + acc.Name;
        } else if (cap == 'manufacturing_runrate' || cap == 'mfg_agreement_copilot') {
          Sales_Agreement__c agr = [
            SELECT Id, Name, Account__r.Name, Total_Committed_Quantity__c,
                   Total_Actual_Quantity__c, Total_Committed_Amount__c,
                   Total_Actual_Amount__c, Pricing_Tier__c, Status__c
            FROM Sales_Agreement__c
            WHERE Id = :req.recordId
            LIMIT 1
          ];
          Decimal committed = agr.Total_Committed_Quantity__c != null ? agr.Total_Committed_Quantity__c : 0;
          Decimal actual = agr.Total_Actual_Quantity__c != null ? agr.Total_Actual_Quantity__c : 0;
          Decimal pct = (committed > 0) ? ((actual / committed) * 100).setScale(1) : 0;

          res.outputText = 'Agreement: ' + agr.Name + ' (' + agr.Account__r.Name + ')\n' +
                           'Committed Units: ' + committed + ' | Fulfilled: ' + actual + ' (' + pct + '%)\n' +
                           'Tier: ' + agr.Pricing_Tier__c + '\n' +
                           (pct < 50 ? '⚠️ High Under-Consumption Risk: Schedule pacing is behind run-rate quota.' : '✅ Healthy Run-Rate: Batch deliveries on schedule.');
          res.subjectLine = 'Run-Rate AI Audit: ' + agr.Name + ' (' + pct + '% Fulfilled)';
          res.winProbability = Integer.valueOf(Math.min(100, Math.max(0, pct)));
        } else {
          res.success = false;
          res.outputText = 'Unknown AI Capability: ' + req.capability;
        }
      } catch (Exception e) {
        res.success = false;
        res.outputText = 'Error: ' + e.getMessage();
      }
      results.add(res);
    }

    return results;
  }
}
