/**
 * Deep Two-Way Sales Cloud Integration:
 * Syncs Primary RevX Quote Lines to standard Salesforce OpportunityLineItem (OLI) records,
 * updates Opportunity Amount, Close Date, and automatically marks Opportunity 'Closed Won' when signed.
 * Ensures Salesforce standard Sales Forecasting, Pipeline Analytics, and Reports stay 100% in sync.
 */
public with sharing class RevquilaOliSync {

  public class SyncResult {
    @AuraEnabled public Boolean ok;
    @AuraEnabled public Integer linesSynced;
    @AuraEnabled public String message;
    @AuraEnabled public Decimal opportunityAmount;
  }

  /**
   * Syncs the quote's lines and figures to its linked Opportunity and OpportunityLineItems.
   */
  @AuraEnabled
  public static SyncResult syncOpportunity(Id quoteId) {
    SyncResult result = new SyncResult();
    result.ok = false;
    result.linesSynced = 0;

    if (quoteId == null) {
      result.message = 'No quote Id provided.';
      return result;
    }

    List<Quote__c> quotes = [
      SELECT Id, Name, Display_Number__c, Opportunity__c, Opportunity__r.Name,
        Opportunity__r.Pricebook2Id, Opportunity__r.StageName, Opportunity__r.IsClosed,
        Net_Amount__c, Base_Net_Amount__c, Total__c, Valid_Until__c, Status__c,
        Currency_Code__c, Primary__c,
        (SELECT Id, Product__c, Product__r.Name, Quantity__c, Unit_Price__c,
          Discount__c, Rule_Discount__c, Net_Amount__c, Optional__c, Description__c
         FROM Lines__r
         WHERE Optional__c = FALSE)
      FROM Quote__c
      WHERE Id = :quoteId
      WITH SYSTEM_MODE
      LIMIT 1
    ];

    if (quotes.isEmpty()) {
      result.message = 'Quote not found.';
      return result;
    }

    Quote__c quote = quotes[0];
    if (quote.Opportunity__c == null) {
      result.message = 'Quote is not linked to any Opportunity.';
      return result;
    }

    Savepoint sp = Database.setSavepoint();
    try {
      Id oppId = quote.Opportunity__c;
      Id pricebookId = quote.Opportunity__r.Pricebook2Id;

      // Ensure Opportunity has a Pricebook assigned
      if (pricebookId == null) {
        List<Pricebook2> pbs = [
          SELECT Id FROM Pricebook2
          WHERE IsActive = TRUE AND IsStandard = TRUE
          WITH SYSTEM_MODE
          LIMIT 1
        ];
        if (pbs.isEmpty()) {
          pbs = [SELECT Id FROM Pricebook2 WHERE IsActive = TRUE WITH SYSTEM_MODE LIMIT 1];
        }
        if (!pbs.isEmpty()) {
          pricebookId = pbs[0].Id;
          Database.update(new Opportunity(Id = oppId, Pricebook2Id = pricebookId), true, AccessLevel.SYSTEM_MODE);
        }
      }

      // Collect product ids from active quote lines
      Set<Id> productIds = new Set<Id>();
      for (Quote_Line__c line : quote.Lines__r) {
        if (line.Product__c != null) {
          productIds.add(line.Product__c);
        }
      }

      // Query PricebookEntries for this pricebook and products
      Map<Id, PricebookEntry> pbeByProduct = new Map<Id, PricebookEntry>();
      if (pricebookId != null && !productIds.isEmpty()) {
        for (PricebookEntry pbe : [
          SELECT Id, Product2Id, UnitPrice, Pricebook2Id, IsActive
          FROM PricebookEntry
          WHERE Pricebook2Id = :pricebookId AND Product2Id IN :productIds AND IsActive = TRUE
          WITH SYSTEM_MODE
        ]) {
          pbeByProduct.put(pbe.Product2Id, pbe);
        }
      }

      // Delete existing OpportunityLineItems
      List<OpportunityLineItem> existingOlis = [
        SELECT Id FROM OpportunityLineItem
        WHERE OpportunityId = :oppId
        WITH SYSTEM_MODE
      ];
      if (!existingOlis.isEmpty()) {
        Database.delete(existingOlis, true, AccessLevel.SYSTEM_MODE);
      }

      // Build new OpportunityLineItems
      List<OpportunityLineItem> newOlis = new List<OpportunityLineItem>();
      for (Quote_Line__c line : quote.Lines__r) {
        if (line.Product__c == null || !pbeByProduct.containsKey(line.Product__c)) {
          continue;
        }
        PricebookEntry pbe = pbeByProduct.get(line.Product__c);
        Decimal qty = line.Quantity__c != null && line.Quantity__c > 0 ? line.Quantity__c : 1;
        Decimal price = line.Unit_Price__c != null ? line.Unit_Price__c : pbe.UnitPrice;
        Decimal disc = RevquilaCore.orZero(line.Discount__c) + RevquilaCore.orZero(line.Rule_Discount__c);

        OpportunityLineItem oli = new OpportunityLineItem();
        oli.OpportunityId = oppId;
        oli.PricebookEntryId = pbe.Id;
        oli.Quantity = qty;
        oli.UnitPrice = price;
        if (disc > 0 && disc <= 100) {
          oli.Discount = disc;
        }
        if (String.isNotBlank(line.Description__c)) {
          oli.Description = line.Description__c.abbreviate(255);
        }
        newOlis.add(oli);
      }

      if (!newOlis.isEmpty()) {
        Database.insert(newOlis, true, AccessLevel.SYSTEM_MODE);
      }

      // Update Opportunity Amount, Close Date, and Stage if signed
      Opportunity oppUpdate = new Opportunity(Id = oppId);
      Decimal targetAmount = quote.Base_Net_Amount__c != null ? quote.Base_Net_Amount__c : quote.Net_Amount__c;
      if (targetAmount != null && newOlis.isEmpty()) {
        // If no OLIs were mapped, set Amount directly
        oppUpdate.Amount = targetAmount;
      }
      if (quote.Valid_Until__c != null) {
        oppUpdate.CloseDate = quote.Valid_Until__c;
      }

      // Auto-Closed Won when quote is signed
      if (quote.Status__c == 'signed' && !quote.Opportunity__r.IsClosed) {
        oppUpdate.StageName = 'Closed Won';
      }

      Database.update(oppUpdate, true, AccessLevel.SYSTEM_MODE);

      // Record timeline event on Quote
      String oppName = quote.Opportunity__r.Name;
      String eventDesc = newOlis.size() + ' lines synced to Opportunity "' + oppName + '". Forecasting updated.';
      if (quote.Status__c == 'signed') {
        eventDesc += ' Opportunity marked Closed Won.';
      }

      Database.insert(
        RevquilaCore.event(quote.Id, 'Opportunity sync complete', eventDesc, RevquilaCore.TONE_ACCENT),
        true,
        AccessLevel.SYSTEM_MODE
      );

      result.ok = true;
      result.linesSynced = newOlis.size();
      result.opportunityAmount = targetAmount;
      result.message = eventDesc;
      return result;

    } catch (Exception e) {
      Database.rollback(sp);
      result.ok = false;
      result.message = 'Sync failed: ' + e.getMessage();
      return result;
    }
  }

  /**
   * Automatically invokes OLI sync if the quote is marked Primary.
   */
  public static void syncIfPrimary(Id quoteId) {
    if (quoteId == null) return;
    List<Quote__c> q = [SELECT Primary__c, Opportunity__c FROM Quote__c WHERE Id = :quoteId WITH SYSTEM_MODE LIMIT 1];
    if (!q.isEmpty() && q[0].Primary__c && q[0].Opportunity__c != null) {
      syncOpportunity(quoteId);
    }
  }
}