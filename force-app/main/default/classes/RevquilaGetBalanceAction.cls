/**
 * Agentforce & Salesforce Flow Builder Action:
 * "RevX: Get Customer Balance & AR Status"
 * Enables Einstein Agents, Agentforce Bots, and Flows to retrieve customer
 * outstanding balances, overdue invoices, and churn risk via natural language.
 */
public with sharing class RevquilaGetBalanceAction {
  public class BalanceRequest {
    @InvocableVariable(label='Record Id (Account or Case)' description='The Salesforce Account ID or Case ID' required=true)
    public Id recordId;
  }

  public class BalanceResponse {
    @InvocableVariable(label='Account Name')
    public String accountName;
    @InvocableVariable(label='Outstanding Balance ($)')
    public Decimal outstandingBalance;
    @InvocableVariable(label='Overdue Balance ($)')
    public Decimal overdueBalance;
    @InvocableVariable(label='Active MRR ($)')
    public Decimal activeMrr;
    @InvocableVariable(label='Active ARR ($)')
    public Decimal activeArr;
    @InvocableVariable(label='Churn Risk')
    public String churnRisk;
    @InvocableVariable(label='SLA Entitlement Tier')
    public String entitlementTier;
    @InvocableVariable(label='Natural Language Summary')
    public String summary;
  }

  @InvocableMethod(
    label='RevX: Get Customer Balance & AR Status'
    description='Retrieves customer outstanding balance, overdue invoices, active MRR/ARR, and churn risk for Agentforce and Flow.'
    category='RevX'
  )
  public static List<BalanceResponse> getCustomerBalance(List<BalanceRequest> requests) {
    List<BalanceResponse> responses = new List<BalanceResponse>();
    for (BalanceRequest req : requests) {
      BalanceResponse res = new BalanceResponse();
      try {
        RevquilaAccount360Controller.Account360Data data = RevquilaAccount360Controller.getAccountSummary(req.recordId);
        if (data != null) {
          res.accountName = data.accountName;
          res.outstandingBalance = data.outstandingBalance;
          res.overdueBalance = data.overdueBalance;
          res.activeMrr = data.mrr;
          res.activeArr = data.arr;
          res.churnRisk = data.churnRisk;
          res.entitlementTier = data.entitlementTier;
          res.summary = data.accountName + ' has an outstanding balance of $' + data.outstandingBalance.setScale(2) +
            (data.overdueBalance > 0 ? ' ($' + data.overdueBalance.setScale(2) + ' is OVERDUE)' : ' (no overdue invoices)') +
            '. Active MRR is $' + data.mrr.setScale(2) + ' with ' + data.entitlementTier +
            '. Churn risk is ' + data.churnRisk + '.';
        } else {
          res.summary = 'No account or billing context found for the provided record ID.';
        }
      } catch (Exception e) {
        res.summary = 'Error retrieving revenue context: ' + e.getMessage();
      }
      responses.add(res);
    }
    return responses;
  }
}