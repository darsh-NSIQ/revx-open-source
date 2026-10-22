/**
 * What the quote form picks from: products and their list prices, accounts, and an account's
 * contacts, open opportunities and recent quotes. Accounts, contacts, opportunities and
 * products are the standard Salesforce objects, so Revquila works on the records the org already has.
 */
public with sharing class RevquilaLookupController {
  private static final Integer SUGGESTIONS = 8;

  public class AccountView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String city;
    @AuraEnabled
    public String region;
    @AuraEnabled
    public String registration;
  }

  /** A record to pick from a list: its name and one line about it. */
  public class Option {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String detail;
    @AuraEnabled
    public Decimal amount;
  }

  public class AccountContext {
    @AuraEnabled
    public AccountView account;
    @AuraEnabled
    public List<Option> contacts = new List<Option>();
    @AuraEnabled
    public List<Option> opportunities = new List<Option>();
    @AuraEnabled
    public List<Option> recentQuotes = new List<Option>();
  }

  /** Every active product that has a standard price. */
  @AuraEnabled
  public static List<RevquilaPricing.Product> getProducts() {
    try {
      return RevquilaPricing.products();
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Accounts whose name contains the text, or the most recently changed ones when it is empty. */
  @AuraEnabled
  public static List<AccountView> searchAccounts(String term) {
    try {
      List<AccountView> found = new List<AccountView>();
      String text = String.isBlank(term) ? '' : term.trim();
      // % and _ are wildcards in LIKE, so they are escaped to be searched for as typed
      String likeText =
        '%' +
        text.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') +
        '%';
      for (
        Account row : String.isBlank(text)
          ? [
              SELECT
                Id,
                Name,
                BillingCity,
                BillingState,
                Tax_Registration_Number__c
              FROM Account
              WITH USER_MODE
              ORDER BY LastModifiedDate DESC
              LIMIT :SUGGESTIONS
            ]
          : [
              SELECT
                Id,
                Name,
                BillingCity,
                BillingState,
                Tax_Registration_Number__c
              FROM Account
              WHERE Name LIKE :likeText
              WITH USER_MODE
              ORDER BY Name
              LIMIT :SUGGESTIONS
            ]
      ) {
        found.add(view(row));
      }
      return found;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** The account with its contacts, its open opportunities and its latest quotes. */
  @AuraEnabled
  public static AccountContext getAccountContext(Id accountId) {
    try {
      List<Account> accounts = [
        SELECT Id, Name, BillingCity, BillingState, Tax_Registration_Number__c
        FROM Account
        WHERE Id = :accountId
        WITH USER_MODE
      ];
      if (accounts.isEmpty()) {
        throw new RevquilaCore.ProblemException(
          'That account no longer exists.'
        );
      }
      AccountContext context = new AccountContext();
      context.account = view(accounts[0]);
      for (Contact row : [
        SELECT Id, Name, Title, Email
        FROM Contact
        WHERE AccountId = :accountId
        WITH USER_MODE
        ORDER BY Name
        LIMIT 50
      ]) {
        context.contacts.add(
          option(
            row.Id,
            row.Name,
            String.isBlank(row.Title) ? row.Email : row.Title
          )
        );
      }
      for (Opportunity row : [
        SELECT Id, Name, StageName
        FROM Opportunity
        WHERE AccountId = :accountId AND IsClosed = FALSE
        WITH USER_MODE
        ORDER BY CloseDate
        LIMIT 20
      ]) {
        context.opportunities.add(option(row.Id, row.Name, row.StageName));
      }
      for (Quote__c row : [
        SELECT Id, Name, Reference__c, Net_Amount__c
        FROM Quote__c
        WHERE Account__c = :accountId
        WITH USER_MODE
        ORDER BY Quote_Date__c DESC, Name DESC
        LIMIT 3
      ]) {
        Option quote = option(row.Id, row.Name, row.Reference__c);
        quote.amount = row.Net_Amount__c;
        context.recentQuotes.add(quote);
      }
      return context;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Creates an account from the quote form. An account with exactly that name is reused instead. */
  @AuraEnabled
  public static AccountView createAccount(String name, String region) {
    try {
      if (String.isBlank(name)) {
        throw new RevquilaCore.ProblemException('Enter the account name.');
      }
      String accountName = name.trim().abbreviate(255);
      List<Account> existing = [
        SELECT Id, Name, BillingCity, BillingState, Tax_Registration_Number__c
        FROM Account
        WHERE Name = :accountName
        WITH USER_MODE
        LIMIT 1
      ];
      if (!existing.isEmpty()) {
        return view(existing[0]);
      }
      Account created = new Account(Name = accountName);
      if (String.isNotBlank(region)) {
        created.BillingState = region.trim();
        created.BillingCountry = RevquilaSettings.current().countryName;
      }
      try {
        insert as user created;
      } catch (DmlException e) {
        if (e.getDmlType(0) == StatusCode.DUPLICATES_DETECTED) {
          throw new RevquilaCore.ProblemException(
            'Salesforce already has an account that looks like this one. Search for it instead.'
          );
        }
        if (created.BillingState == null) {
          throw e;
        }
        // An org with state and country picklists refuses a state that is not on its list.
        // The address is optional here: the quote keeps its own place of supply.
        created = new Account(Name = accountName);
        insert as user created;
      }
      return view(created);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static AccountView view(Account row) {
    AccountView account = new AccountView();
    account.id = row.Id;
    account.name = row.Name;
    account.city = row.BillingCity;
    account.region = row.BillingState;
    account.registration = row.Tax_Registration_Number__c;
    return account;
  }

  private static Option option(Id id, String name, String detail) {
    Option choice = new Option();
    choice.id = id;
    choice.name = name;
    choice.detail = detail;
    return choice;
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getGlobalSearch(String term) {
    Map<String, Object> results = new Map<String, Object>();
    if (String.isBlank(term) || term.trim().length() < 2) {
      return results;
    }
    String wildcard = '%' + term.trim() + '%';

    // Accounts
    List<Account> accs = [
      SELECT Id, Name, BillingCity
      FROM Account
      WHERE Name LIKE :wildcard
      LIMIT 4
    ];
    results.put('accounts', accs);

    // Quotes
    List<Quote__c> quotes = [
      SELECT Id, Name, Total__c, Status__c, Account__r.Name
      FROM Quote__c
      WHERE Name LIKE :wildcard
      LIMIT 4
    ];
    results.put('quotes', quotes);

    // Invoices
    List<Invoice__c> invoices = [
      SELECT Id, Name, Total__c, Balance__c, Payment_Status__c, Account__r.Name
      FROM Invoice__c
      WHERE Name LIKE :wildcard
      LIMIT 4
    ];
    results.put('invoices', invoices);

    // Orders
    List<Order__c> orders = [
      SELECT Id, Name, Total__c, Status__c, Account__r.Name
      FROM Order__c
      WHERE Name LIKE :wildcard
      LIMIT 4
    ];
    results.put('orders', orders);

    // Sales Agreements
    List<Sales_Agreement__c> agrs = [
      SELECT Id, Name, Total_Committed_Quantity__c, Status__c, Account__r.Name
      FROM Sales_Agreement__c
      WHERE Name LIKE :wildcard
      LIMIT 4
    ];
    results.put('agreements', agrs);

    return results;
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getUtilityMetrics() {
    Map<String, Object> m = new Map<String, Object>();
    m.put('openInvoicesCount', [SELECT COUNT() FROM Invoice__c WHERE Balance__c > 0]);
    m.put('activeSubsCount', [SELECT COUNT() FROM Subscription__c WHERE Status__c = 'Active']);
    m.put('openQuotesCount', [SELECT COUNT() FROM Quote__c WHERE Status__c = 'Draft']);
    m.put('activeAgreementsCount', [SELECT COUNT() FROM Sales_Agreement__c WHERE Status__c = 'Activated']);
    return m;
  }
}