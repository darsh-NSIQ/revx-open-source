/**
 * Records and users the Revquila tests share.
 * Create the users first in a test: users and permission sets cannot be written after other records.
 */
@IsTest
public class RevquilaTestData {
  public static final String HOME_STATE = 'Maharashtra';

  /** A Standard User with Revquila User, and Revquila Admin too when admin is true. */
  public static User newUser(Boolean admin) {
    Profile standard = [
      SELECT Id
      FROM Profile
      WHERE Name = 'Standard User'
      LIMIT 1
    ];
    String unique = String.valueOf(Crypto.getRandomInteger()).replace('-', '');
    User person = new User(
      Alias = 'rq' + unique.left(5),
      Email = 'revquila.test@example.com',
      EmailEncodingKey = 'UTF-8',
      LastName = admin ? 'Approver' : 'Rep',
      LanguageLocaleKey = 'en_US',
      LocaleSidKey = 'en_US',
      ProfileId = standard.Id,
      TimeZoneSidKey = 'Asia/Kolkata',
      Username = 'revquila.test.' + unique + '@example.com'
    );
    insert person;
    List<String> names = new List<String>{ 'Revquila_User' };
    if (admin) {
      names.add('Revquila_Admin');
    }
    List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
    for (PermissionSet permissions : [
      SELECT Id
      FROM PermissionSet
      WHERE Name IN :names
    ]) {
      assignments.add(
        new PermissionSetAssignment(
          AssigneeId = person.Id,
          PermissionSetId = permissions.Id
        )
      );
    }
    insert assignments;
    return person;
  }

  /**
   * Two products with standard prices: PLAT (12,000 a year, recurring) and IMPL (150,000, one-time).
   * Returns their ids by code. Written as the test's own user, the way an admin sets products up.
   */
  public static Map<String, Id> products() {
    Map<String, Id> byCode = new Map<String, Id>();
    System.runAs(new User(Id = UserInfo.getUserId())) {
      List<Product2> products = new List<Product2>{
        new Product2(
          Name = 'Platform licence',
          ProductCode = 'PLAT',
          Unit__c = 'per user, yearly',
          Recurring__c = true,
          IsActive = true
        ),
        new Product2(
          Name = 'Implementation',
          ProductCode = 'IMPL',
          Unit__c = 'one-time',
          IsActive = true
        ),
        new Product2(Name = 'Retired', ProductCode = 'OLD', IsActive = false)
      };
      insert as system products;
      List<Decimal> prices = new List<Decimal>{ 12000, 150000, 500 };
      List<PricebookEntry> entries = new List<PricebookEntry>();
      for (Integer index = 0; index < products.size(); index++) {
        byCode.put(products[index].ProductCode, products[index].Id);
        entries.add(
          new PricebookEntry(
            Pricebook2Id = Test.getStandardPricebookId(),
            Product2Id = products[index].Id,
            UnitPrice = prices[index],
            IsActive = true
          )
        );
      }
      insert as system entries;
    }
    return byCode;
  }

  /** An account in a state, with one contact. */
  public static Account account(String name, String state) {
    Account account = new Account(
      Name = name,
      BillingCity = 'Pune',
      BillingState = state,
      // an org with state and country picklists needs the country with the state
      BillingCountry = 'India',
      Tax_Registration_Number__c = '27AAAAA0000A1Z5'
    );
    // a duplicate rule in the org must not decide whether a test can set up its records
    Database.DMLOptions options = new Database.DMLOptions();
    options.DuplicateRuleHeader.allowSave = true;
    System.runAs(new User(Id = UserInfo.getUserId())) {
      Database.insert(account, options, AccessLevel.SYSTEM_MODE);
      Database.insert(
        new Contact(
          AccountId = account.Id,
          FirstName = 'Neha',
          LastName = 'Kulkarni',
          Email = 'neha@example.com'
        ),
        options,
        AccessLevel.SYSTEM_MODE
      );
    }
    return account;
  }

  public static RevquilaPricing.LineInput line(
    Id productId,
    Decimal qty,
    Decimal discount
  ) {
    RevquilaPricing.LineInput input = new RevquilaPricing.LineInput();
    input.productId = productId;
    input.qty = qty;
    input.discount = discount;
    return input;
  }

  public static RevquilaPricing.LineInput customLine(
    String name,
    Decimal price,
    Decimal qty
  ) {
    RevquilaPricing.LineInput input = new RevquilaPricing.LineInput();
    input.name = name;
    input.unit = 'one-time';
    input.price = price;
    input.qty = qty;
    input.discount = 0;
    return input;
  }

  /** What the quote form sends for a new quote. */
  public static String quoteJson(
    Id accountId,
    List<RevquilaPricing.LineInput> lines,
    String terms
  ) {
    RevquilaQuoteController.QuoteInput input = new RevquilaQuoteController.QuoteInput();
    input.accountId = accountId;
    input.terms = terms;
    input.lines = lines;
    return JSON.serialize(input);
  }
}