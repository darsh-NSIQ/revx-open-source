/**
 * Controller for RevX Account 360 and Case 360 panels.
 * Exposes a unified revenue context (LTV, MRR/ARR, open quotes, subscriptions,
 * invoices, entitlement tiers, and fast actions) on Account, Contact, and Case records.
 */
public with sharing class RevquilaAccount360Controller {
  public class Account360Data {
    @AuraEnabled public Id accountId;
    @AuraEnabled public String accountName;
    @AuraEnabled public String industry;
    @AuraEnabled public String location;
    @AuraEnabled public String segment;
    @AuraEnabled public String taxRegistration;
    @AuraEnabled public String paymentTerms;

    @AuraEnabled public Decimal ltv = 0;
    @AuraEnabled public Decimal mrr = 0;
    @AuraEnabled public Decimal arr = 0;
    @AuraEnabled public Decimal outstandingBalance = 0;
    @AuraEnabled public Decimal overdueBalance = 0;
    @AuraEnabled public String churnRisk;
    @AuraEnabled public String churnRiskTone; // good, warn, bad
    @AuraEnabled public String entitlementTier;

    @AuraEnabled public List<QuoteItem> quotes = new List<QuoteItem>();
    @AuraEnabled public List<SubscriptionItem> subscriptions = new List<SubscriptionItem>();
    @AuraEnabled public List<InvoiceItem> invoices = new List<InvoiceItem>();
  }

  public class QuoteItem {
    @AuraEnabled public Id id;
    @AuraEnabled public String numberText;
    @AuraEnabled public Decimal total;
    @AuraEnabled public String status;
    @AuraEnabled public Date quoteDate;
    @AuraEnabled public Date validUntil;
    @AuraEnabled public Boolean isPrimary;
    @AuraEnabled public Integer version;
  }

  public class SubscriptionItem {
    @AuraEnabled public Id id;
    @AuraEnabled public String numberText;
    @AuraEnabled public String status;
    @AuraEnabled public Decimal mrr;
    @AuraEnabled public Date startDate;
    @AuraEnabled public Date endsOn;
    @AuraEnabled public Date renewalDate;
    @AuraEnabled public Boolean autoRenew;
    @AuraEnabled public String billingFrequency;
  }

  public class InvoiceItem {
    @AuraEnabled public Id id;
    @AuraEnabled public String numberText;
    @AuraEnabled public Decimal total;
    @AuraEnabled public Decimal balance;
    @AuraEnabled public Decimal paid;
    @AuraEnabled public Date dueOn;
    @AuraEnabled public Date issuedOn;
    @AuraEnabled public String status;
    @AuraEnabled public String statusTone;
    @AuraEnabled public String paymentLink;
    @AuraEnabled public String currencyCode;
  }

  /** Resolves Account ID from Account, Contact, or Case recordId */
  public static Id resolveAccountId(Id recordId) {
    if (recordId == null) {
      return null;
    }
    String sObj = recordId.getSObjectType().getDescribe().getName();
    if (sObj == 'Account') {
      return recordId;
    } else if (sObj == 'Contact') {
      List<Contact> contacts = [SELECT AccountId FROM Contact WHERE Id = :recordId WITH USER_MODE LIMIT 1];
      return contacts.isEmpty() ? null : contacts[0].AccountId;
    } else if (sObj == 'Case') {
      List<Case> cases = [SELECT AccountId FROM Case WHERE Id = :recordId WITH USER_MODE LIMIT 1];
      return cases.isEmpty() ? null : cases[0].AccountId;
    }
    return null;
  }

  @AuraEnabled(cacheable=true)
  public static Account360Data getAccountSummary(Id recordId) {
    try {
      Id accountId = resolveAccountId(recordId);
      if (accountId == null) {
        return null;
      }

      Account acc = [
        SELECT Id, Name, Industry, BillingCity, BillingState, BillingCountry,
               Segment__c, Tax_Registration_Number__c, Payment_Terms__c
        FROM Account
        WHERE Id = :accountId
        WITH USER_MODE
        LIMIT 1
      ];

      Account360Data data = new Account360Data();
      data.accountId = acc.Id;
      data.accountName = acc.Name;
      data.industry = acc.Industry;
      data.segment = acc.Segment__c;
      data.taxRegistration = acc.Tax_Registration_Number__c;
      data.paymentTerms = acc.Payment_Terms__c;

      List<String> loc = new List<String>();
      if (String.isNotBlank(acc.BillingCity)) loc.add(acc.BillingCity);
      if (String.isNotBlank(acc.BillingState)) loc.add(acc.BillingState);
      if (String.isNotBlank(acc.BillingCountry)) loc.add(acc.BillingCountry);
      data.location = String.join(loc, ', ');

      // LTV and Balances from Invoices
      AggregateResult[] invAgg = [
        SELECT SUM(Paid_Amount__c) paidSum, SUM(Balance__c) balSum
        FROM Invoice__c
        WHERE Account__c = :accountId
        WITH USER_MODE
      ];
      if (!invAgg.isEmpty()) {
        data.ltv = RevquilaCore.orZero((Decimal) invAgg[0].get('paidSum'));
        data.outstandingBalance = RevquilaCore.orZero((Decimal) invAgg[0].get('balSum'));
      }

      // Overdue balance
      Date today = Date.today();
      AggregateResult[] overdueAgg = [
        SELECT SUM(Balance__c) overdueSum
        FROM Invoice__c
        WHERE Account__c = :accountId AND Balance__c > 0 AND Due_On__c < :today
        WITH USER_MODE
      ];
      if (!overdueAgg.isEmpty()) {
        data.overdueBalance = RevquilaCore.orZero((Decimal) overdueAgg[0].get('overdueSum'));
      }

      // MRR and ARR from Active Subscriptions
      AggregateResult[] subAgg = [
        SELECT SUM(Contract_MRR__c) mrrSum
        FROM Subscription__c
        WHERE Account__c = :accountId AND Status__c = 'active'
        WITH USER_MODE
      ];
      if (!subAgg.isEmpty()) {
        data.mrr = RevquilaCore.orZero((Decimal) subAgg[0].get('mrrSum'));
        data.arr = data.mrr * 12;
      }

      // Churn risk assessment
      if (data.overdueBalance > 0) {
        data.churnRisk = 'High';
        data.churnRiskTone = 'bad';
      } else if (data.outstandingBalance > 0) {
        data.churnRisk = 'Medium';
        data.churnRiskTone = 'warn';
      } else {
        data.churnRisk = 'Low';
        data.churnRiskTone = 'good';
      }

      // Entitlement tier determination
      if (data.mrr >= 5000 || data.segment == 'Enterprise') {
        data.entitlementTier = 'Enterprise 24/7 SLA (1 hr response)';
      } else if (data.mrr >= 1000 || data.segment == 'Mid-Market') {
        data.entitlementTier = 'Premier SLA (4 hr response)';
      } else {
        data.entitlementTier = 'Standard SLA (Next business day)';
      }

      // Recent Quotes
      for (Quote__c q : [
        SELECT Id, Name, Display_Number__c, Total__c, Status__c, Quote_Date__c,
               Valid_Until__c, Primary__c, Version__c
        FROM Quote__c
        WHERE Account__c = :accountId
        WITH USER_MODE
        ORDER BY Quote_Date__c DESC, CreatedDate DESC
        LIMIT 5
      ]) {
        QuoteItem qi = new QuoteItem();
        qi.id = q.Id;
        qi.numberText = String.isNotBlank(q.Display_Number__c) ? q.Display_Number__c : q.Name;
        qi.total = RevquilaCore.orZero(q.Total__c);
        qi.status = q.Status__c;
        qi.quoteDate = q.Quote_Date__c;
        qi.validUntil = q.Valid_Until__c;
        qi.isPrimary = q.Primary__c == true;
        qi.version = q.Version__c == null ? 1 : q.Version__c.intValue();
        data.quotes.add(qi);
      }

      // Recent Subscriptions
      for (Subscription__c s : [
        SELECT Id, Name, Display_Number__c, Status__c, Contract_MRR__c,
               Start_Date__c, Ends_On__c, Renewal_Date__c, Auto_Renew__c, Billing_Frequency__c
        FROM Subscription__c
        WHERE Account__c = :accountId
        WITH USER_MODE
        ORDER BY Start_Date__c DESC, CreatedDate DESC
        LIMIT 5
      ]) {
        SubscriptionItem si = new SubscriptionItem();
        si.id = s.Id;
        si.numberText = String.isNotBlank(s.Display_Number__c) ? s.Display_Number__c : s.Name;
        si.status = s.Status__c;
        si.mrr = RevquilaCore.orZero(s.Contract_MRR__c);
        si.startDate = s.Start_Date__c;
        si.endsOn = s.Ends_On__c;
        si.renewalDate = s.Renewal_Date__c;
        si.autoRenew = s.Auto_Renew__c == true;
        si.billingFrequency = s.Billing_Frequency__c;
        data.subscriptions.add(si);
      }

      // Recent Invoices
      for (Invoice__c inv : [
        SELECT Id, Number__c, Total__c, Balance__c, Paid_Amount__c, Due_On__c,
               Issued_On__c, Sent_On__c, Payment_Link__c, Currency_Code__c
        FROM Invoice__c
        WHERE Account__c = :accountId
        WITH USER_MODE
        ORDER BY Issued_On__c DESC, CreatedDate DESC
        LIMIT 5
      ]) {
        InvoiceItem ii = new InvoiceItem();
        ii.id = inv.Id;
        ii.numberText = inv.Number__c;
        ii.total = RevquilaCore.orZero(inv.Total__c);
        ii.balance = RevquilaCore.orZero(inv.Balance__c);
        ii.paid = RevquilaCore.orZero(inv.Paid_Amount__c);
        ii.dueOn = inv.Due_On__c;
        ii.issuedOn = inv.Issued_On__c;
        ii.paymentLink = inv.Payment_Link__c;
        ii.currencyCode = inv.Currency_Code__c;

        if (inv.Sent_On__c == null) {
          ii.status = 'Draft';
          ii.statusTone = 'mut';
        } else if (ii.balance <= 0) {
          ii.status = 'Paid';
          ii.statusTone = 'good';
        } else if (inv.Due_On__c != null && inv.Due_On__c < today) {
          ii.status = 'Overdue';
          ii.statusTone = 'bad';
        } else {
          ii.status = 'Unpaid';
          ii.statusTone = 'warn';
        }
        data.invoices.add(ii);
      }

      return data;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Generates or retrieves an online payment link for an invoice directly from Case/Account panel */
  @AuraEnabled
  public static String generatePaymentLink(Id invoiceId) {
    return RevquilaInvoiceController.createPaymentLink(invoiceId);
  }

  /** Issues a credit note against an invoice directly from Case/Account panel */
  @AuraEnabled
  public static void issueCreditNote(Id invoiceId, Decimal amount, String reason) {
    RevquilaInvoiceController.issueCreditNote(invoiceId, amount, reason);
  }

  /** Resends the invoice to the customer email */
  @AuraEnabled
  public static void resendInvoice(Id invoiceId, String recipientEmail) {
    RevquilaInvoiceController.emailInvoice(invoiceId, null, recipientEmail);
  }

  /** Requests or issues a refund against an invoice directly from Case/Account panel */
  @AuraEnabled
  public static void requestRefund(Id invoiceId, Decimal amount, String reason) {
    List<Payment__c> payments = [SELECT Id FROM Payment__c WHERE Invoice__c = :invoiceId WITH USER_MODE ORDER BY CreatedDate DESC LIMIT 1];
    Id paymentId = payments.isEmpty() ? null : payments[0].Id;
    RevquilaInvoiceController.refund(invoiceId, paymentId, amount, reason, false);
  }
}