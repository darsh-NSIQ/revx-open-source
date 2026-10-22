/**
 * RevquilaQuickActionController:
 * High-velocity CPQ quick actions for Opportunity and Account pages.
 * Supports 1-click Quote generation directly from Opportunities (cloning lines and terms)
 * and real-time Financial 360 dossier modal for Accounts.
 */
public with sharing class RevquilaQuickActionController {

  @AuraEnabled
  public static Map<String, Object> createQuoteFromOpportunity(Id oppId) {
    Map<String, Object> res = new Map<String, Object>();
    try {
      if (oppId == null) {
        throw new AuraHandledException('Opportunity ID is required.');
      }

      Opportunity opp = [
        SELECT Id, Name, AccountId, Amount, CloseDate, Description
        FROM Opportunity
        WHERE Id = :oppId
        LIMIT 1
      ];

      // 1. Create CPQ Quote
      Quote__c q = new Quote__c();
      q.Opportunity__c = opp.Id;
      q.Account__c = opp.AccountId;
      q.Status__c = 'Draft';
      q.Start_Date__c = Date.today();
      q.Valid_Until__c = (opp.CloseDate != null && opp.CloseDate >= Date.today()) ? opp.CloseDate : Date.today().addDays(30);
      q.Subtotal__c = opp.Amount != null ? opp.Amount : 0;
      q.Total__c = q.Subtotal__c;
      q.Notes__c = 'Fast Quote generated from Opportunity: ' + opp.Name;
      insert q;

      // 2. Map OpportunityLineItems if present
      List<OpportunityLineItem> olis = [
        SELECT Id, Product2Id, Quantity, UnitPrice, TotalPrice, Description
        FROM OpportunityLineItem
        WHERE OpportunityId = :opp.Id
      ];

      if (!olis.isEmpty()) {
        List<Quote_Line__c> qLines = new List<Quote_Line__c>();
        for (OpportunityLineItem oli : olis) {
          Quote_Line__c ql = new Quote_Line__c();
          ql.Quote__c = q.Id;
          ql.Product__c = oli.Product2Id;
          ql.Quantity__c = oli.Quantity != null ? oli.Quantity : 1;
          ql.Unit_Price__c = oli.UnitPrice != null ? oli.UnitPrice : 0;
          ql.Net_Amount__c = oli.TotalPrice != null ? oli.TotalPrice : (ql.Quantity__c * ql.Unit_Price__c);
          ql.Description__c = String.isNotBlank(oli.Description) ? oli.Description : 'Opportunity Line Item';
          qLines.add(ql);
        }
        insert qLines;
      }

      res.put('success', true);
      res.put('quoteId', q.Id);
      res.put('message', 'Successfully generated CPQ Quote from Opportunity!');
    } catch (Exception ex) {
      res.put('success', false);
      res.put('message', ex.getMessage());
    }
    return res;
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getAccountFinancial360(Id accountId) {
    Map<String, Object> dossier = new Map<String, Object>();
    try {
      if (accountId == null) {
        throw new AuraHandledException('Account ID is required.');
      }

      Account acc = [SELECT Id, Name FROM Account WHERE Id = :accountId LIMIT 1];
      dossier.put('accountId', acc.Id);
      dossier.put('accountName', acc.Name);

      // Invoices
      List<Invoice__c> invoices = [
        SELECT Id, Name, Total__c, Balance__c, Payment_Status__c, Issued_On__c, Due_On__c
        FROM Invoice__c
        WHERE Account__c = :accountId
        ORDER BY CreatedDate DESC
        LIMIT 10
      ];

      Decimal totalInvoiced = 0;
      Decimal totalOutstanding = 0;
      for (Invoice__c inv : invoices) {
        if (inv.Total__c != null) totalInvoiced += inv.Total__c;
        if (inv.Balance__c != null && inv.Balance__c > 0) totalOutstanding += inv.Balance__c;
      }

      // Subscriptions
      List<Subscription__c> subs = [
        SELECT Id, Name, Status__c, Contract_MRR__c, Start_Date__c, Ends_On__c
        FROM Subscription__c
        WHERE Account__c = :accountId
        LIMIT 10
      ];

      Decimal totalMrr = 0;
      for (Subscription__c s : subs) {
        if (s.Contract_MRR__c != null && s.Status__c == 'Active') totalMrr += s.Contract_MRR__c;
      }

      // Quotes
      List<Quote__c> quotes = [
        SELECT Id, Name, Total__c, Status__c, Valid_Until__c
        FROM Quote__c
        WHERE Account__c = :accountId
        ORDER BY CreatedDate DESC
        LIMIT 5
      ];

      // Orders
      List<Order__c> orders = [
        SELECT Id, Name, Total__c, Status__c, Order_Date__c
        FROM Order__c
        WHERE Account__c = :accountId
        ORDER BY CreatedDate DESC
        LIMIT 5
      ];

      dossier.put('totalInvoiced', totalInvoiced);
      dossier.put('totalOutstanding', totalOutstanding);
      dossier.put('activeSubscriptionsCount', subs.size());
      dossier.put('totalMrr', totalMrr);
      dossier.put('invoices', invoices);
      dossier.put('subscriptions', subs);
      dossier.put('quotes', quotes);
      dossier.put('orders', orders);
      dossier.put('success', true);
    } catch (Exception e) {
      dossier.put('success', false);
      dossier.put('message', e.getMessage());
    }
    return dossier;
  }
}
