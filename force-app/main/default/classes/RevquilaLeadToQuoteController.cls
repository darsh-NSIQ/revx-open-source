/**
 * RevX Lead-to-Quote Fast Path Controller:
 * Enables 1-click generation of enterprise CPQ quotes directly from standard Salesforce Leads.
 * Handles automatic lead qualification mapping, account/contact resolution, product line attachment,
 * and seamless handoff into Quote 360 without multi-step manual lead conversion.
 */
public with sharing class RevquilaLeadToQuoteController {

  public class LeadQuoteContext {
    @AuraEnabled public Id leadId;
    @AuraEnabled public String leadName;
    @AuraEnabled public String company;
    @AuraEnabled public String email;
    @AuraEnabled public String phone;
    @AuraEnabled public String country;
    @AuraEnabled public Boolean isConverted;
    @AuraEnabled public Id existingAccountId;
    @AuraEnabled public Id existingContactId;
  }

  public class FastQuoteRequest {
    @AuraEnabled @InvocableVariable(label='Lead ID' required=true)
    public Id leadId;

    @AuraEnabled @InvocableVariable(label='Product Code or Name')
    public String productCode;

    @AuraEnabled @InvocableVariable(label='Quantity')
    public Decimal quantity;

    @AuraEnabled @InvocableVariable(label='Discount %')
    public Decimal discountPercent;

    @AuraEnabled @InvocableVariable(label='Payment Terms')
    public String paymentTerms;

    @AuraEnabled @InvocableVariable(label='Notes')
    public String notes;
  }

  public class FastQuoteResult {
    @AuraEnabled @InvocableVariable(label='Success')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Message')
    public String message;

    @AuraEnabled @InvocableVariable(label='Quote ID')
    public Id quoteId;

    @AuraEnabled @InvocableVariable(label='Quote Number')
    public String quoteNumber;

    @AuraEnabled @InvocableVariable(label='Account ID')
    public Id accountId;

    @AuraEnabled @InvocableVariable(label='Contact ID')
    public Id contactId;
  }

  /**
   * Loads lead context to populate the fast-quoting modal.
   */
  @AuraEnabled(cacheable=true)
  public static LeadQuoteContext getLeadContext(Id leadId) {
    if (leadId == null) {
      throw new RevquilaCore.ProblemException('Lead ID is required.');
    }
    Lead l = [
      SELECT Id, Name, Company, Email, Phone, Country, IsConverted, ConvertedAccountId, ConvertedContactId
      FROM Lead
      WHERE Id = :leadId
      LIMIT 1
    ];

    LeadQuoteContext ctx = new LeadQuoteContext();
    ctx.leadId = l.Id;
    ctx.leadName = l.Name;
    ctx.company = l.Company;
    ctx.email = l.Email;
    ctx.phone = l.Phone;
    ctx.country = l.Country;
    ctx.isConverted = l.IsConverted;
    ctx.existingAccountId = l.ConvertedAccountId;
    ctx.existingContactId = l.ConvertedContactId;

    if (!l.IsConverted && String.isNotBlank(l.Company)) {
      List<Account> accs = [SELECT Id FROM Account WHERE Name = :l.Company LIMIT 1];
      if (!accs.isEmpty()) {
        ctx.existingAccountId = accs[0].Id;
      }
    }
    return ctx;
  }

  /**
   * Invocable entrypoint for Salesforce Agentforce and Flows.
   */
  @InvocableMethod(label='RevX: Fast Quote from Lead' description='Instantly generates a RevX CPQ Quote from a Salesforce Lead.' category='RevX')
  public static List<FastQuoteResult> fastQuoteInvocable(List<FastQuoteRequest> requests) {
    List<FastQuoteResult> results = new List<FastQuoteResult>();
    for (FastQuoteRequest req : requests) {
      results.add(createQuoteFromLead(req));
    }
    return results;
  }

  /**
   * AuraEnabled entrypoint for LWC Lead action.
   */
  @AuraEnabled
  public static FastQuoteResult fastQuote(Id leadId, String productCode, Decimal quantity, Decimal discountPercent, String notes) {
    FastQuoteRequest req = new FastQuoteRequest();
    req.leadId = leadId;
    req.productCode = productCode;
    req.quantity = quantity;
    req.discountPercent = discountPercent;
    req.notes = notes;
    req.paymentTerms = 'net30';
    return createQuoteFromLead(req);
  }

  /**
   * Internal worker method with duplicate rule bypass.
   */
  private static FastQuoteResult createQuoteFromLead(FastQuoteRequest req) {
    FastQuoteResult res = new FastQuoteResult();
    try {
      if (req.leadId == null) {
        throw new RevquilaCore.ProblemException('Lead reference is required.');
      }

      Lead l = [
        SELECT Id, FirstName, LastName, Name, Company, Email, Phone, Country, Street, City, State, PostalCode,
               IsConverted, ConvertedAccountId, ConvertedContactId, ConvertedOpportunityId
        FROM Lead
        WHERE Id = :req.leadId
        LIMIT 1
      ];

      Database.DMLOptions dml = new Database.DMLOptions();
      dml.DuplicateRuleHeader.AllowSave = true;
      dml.optAllOrNone = true;

      // 1. Resolve or create Account
      Account acc;
      if (l.ConvertedAccountId != null) {
        acc = [SELECT Id, Name FROM Account WHERE Id = :l.ConvertedAccountId LIMIT 1];
      } else {
        String compName = String.isNotBlank(l.Company) ? l.Company : (l.Name + ' (Lead)');
        List<Account> existingAccs = [SELECT Id, Name FROM Account WHERE Name = :compName LIMIT 1];
        if (!existingAccs.isEmpty()) {
          acc = existingAccs[0];
        } else {
          acc = new Account(
            Name = compName,
            BillingStreet = l.Street,
            BillingCity = l.City,
            BillingState = l.State,
            BillingPostalCode = l.PostalCode,
            BillingCountry = l.Country,
            Phone = l.Phone,
            Billing_Email__c = l.Email
          );
          Database.insert(acc, dml);
        }
      }

      // 2. Resolve or create Contact
      Contact con;
      if (l.ConvertedContactId != null) {
        con = [SELECT Id, Name, Email FROM Contact WHERE Id = :l.ConvertedContactId LIMIT 1];
      } else if (String.isNotBlank(l.Email)) {
        List<Contact> existingCons = [SELECT Id, Name, Email FROM Contact WHERE Email = :l.Email AND AccountId = :acc.Id LIMIT 1];
        if (!existingCons.isEmpty()) {
          con = existingCons[0];
        } else {
          con = new Contact(
            FirstName = l.FirstName,
            LastName = String.isNotBlank(l.LastName) ? l.LastName : 'Contact',
            Email = l.Email,
            Phone = l.Phone,
            AccountId = acc.Id
          );
          Database.insert(con, dml);
        }
      } else {
        con = new Contact(
          FirstName = l.FirstName,
          LastName = String.isNotBlank(l.LastName) ? l.LastName : 'Contact',
          AccountId = acc.Id
        );
        Database.insert(con, dml);
      }

      // 3. Create Quote record
      Quote__c q = new Quote__c(
        Account__c = acc.Id,
        Contact__c = con.Id,
        Status__c = 'draft',
        Currency_Code__c = 'USD',
        Payment_Terms__c = String.isNotBlank(req.paymentTerms) ? req.paymentTerms : 'net30',
        Valid_Until__c = Date.today().addDays(30),
        Notes__c = String.isNotBlank(req.notes) ? req.notes : ('Fast-quoted from Lead: ' + l.Name),
        Reference__c = 'Lead: ' + l.Id
      );
      insert q;

      // 4. Attach initial product line if specified
      if (String.isNotBlank(req.productCode)) {
        List<Product2> prods = [
          SELECT Id, Name, ProductCode
          FROM Product2
          WHERE ProductCode = :req.productCode OR Name = :req.productCode
          LIMIT 1
        ];
        if (!prods.isEmpty()) {
          Product2 p = prods[0];
          Decimal qty = (req.quantity != null && req.quantity > 0) ? req.quantity : 1;
          Decimal disc = (req.discountPercent != null && req.discountPercent >= 0) ? req.discountPercent : 0;
          Decimal unitPrice = 1000; // Standard base fallback

          Decimal lineTotal = (qty * unitPrice * (1.0 - (disc / 100.0))).setScale(2);

          Quote_Line__c ql = new Quote_Line__c(
            Quote__c = q.Id,
            Product__c = p.Id,
            Quantity__c = qty,
            Unit_Price__c = unitPrice,
            Discount__c = disc,
            Net_Amount__c = lineTotal,
            List_Amount__c = (qty * unitPrice).setScale(2)
          );
          insert ql;

          q.Total__c = lineTotal;
          update q;
        }
      }

      // 5. Log audit event
      Revenue_Event__c evt = RevquilaCore.event(
        q.Id,
        'Lead-to-Quote Fast Path Completed',
        'Initiated from Lead ' + l.Name + ' (' + l.Company + ')',
        RevquilaCore.TONE_GOOD
      );
      insert evt;

      Quote__c freshQ = [SELECT Id, Name FROM Quote__c WHERE Id = :q.Id LIMIT 1];
      res.success = true;
      res.quoteId = freshQ.Id;
      res.quoteNumber = freshQ.Name;
      res.accountId = acc.Id;
      res.contactId = con.Id;
      res.message = 'Successfully generated RevX Quote ' + freshQ.Name + ' for ' + acc.Name;
    } catch (Exception e) {
      res.success = false;
      res.message = 'Failed to generate quote from lead: ' + e.getMessage();
    }
    return res;
  }
}
