/**
 * Loads a set of demo records so a new org has something to look at: five products, twelve
 * accounts with a contact each, eight quotes at every stage, twelve invoices across the ageing
 * bands and nine subscriptions with renewals coming up. Every date is relative to today.
 *
 * It is an admin tool (Setup > Demo data), not part of the product's flows. It creates products
 * and contacts, which a Revquila user has no right to, so it reads and writes in system mode
 * (said explicitly on every statement) after checking the caller is a Revquila Admin, and it
 * back-dates records in a way the normal actions never do. It refuses to run twice.
 */
public with sharing class RevquilaDemoData {
  private static final String MARKER = 'Orbit Retail: 25-seat rollout';

  // code, name, unit, yearly or one-time price, recurring
  private static final List<List<String>> PRODUCT_ROWS = new List<List<String>>{
    new List<String>{
      'PLAT',
      'Platform licence',
      'per user, yearly',
      '12000',
      'y'
    },
    new List<String>{
      'ANLY',
      'Analytics add-on',
      'per user, yearly',
      '3000',
      'y'
    },
    new List<String>{ 'SUPP', 'Premium support', 'yearly', '90000', 'y' },
    new List<String>{ 'IMPL', 'Implementation', 'one-time', '150000', 'n' },
    new List<String>{ 'TRNG', 'Onboarding training', 'one-time', '40000', 'n' },
    new List<String>{ 'GROW', 'Growth bundle', 'bundle', '0', 'n' }
  };

  // the bundle's options: "CODE qty"
  private static final String BUNDLE_CODE = 'GROW';
  private static final String BUNDLE_OPTIONS = 'PLAT 25, ANLY 25, TRNG 1';

  // name, product code (blank: any), from quantity, discount %
  private static final List<List<String>> RULE_ROWS = new List<List<String>>{
    new List<String>{ 'Platform: 150 seats and up', 'PLAT', '150', '5' },
    new List<String>{ 'Platform: 250 seats and up', 'PLAT', '250', '10' },
    new List<String>{ 'Analytics: 150 seats and up', 'ANLY', '150', '5' }
  };

  // name, contact first name, contact last name, city, state, GST state code
  private static final List<List<String>> ACCOUNT_ROWS = new List<List<String>>{
    new List<String>{
      'Orbit Retail',
      'Neha',
      'Kulkarni',
      'Mumbai',
      'Maharashtra',
      '27'
    },
    new List<String>{
      'Bluepeak Software',
      'Rohan',
      'Iyer',
      'Bengaluru',
      'Karnataka',
      '29'
    },
    new List<String>{
      'Kavya Logistics',
      'Kavya',
      'Desai',
      'Ahmedabad',
      'Gujarat',
      '24'
    },
    new List<String>{
      'Zenith Forgings',
      'Vikram',
      'Joshi',
      'Pune',
      'Maharashtra',
      '27'
    },
    new List<String>{
      'Nimbus Health',
      'Anita',
      'Rao',
      'Hyderabad',
      'Telangana',
      '36'
    },
    new List<String>{
      'Saffron Foods',
      'Manish',
      'Agarwal',
      'Jaipur',
      'Rajasthan',
      '08'
    },
    new List<String>{
      'Tarang Media',
      'Priya',
      'Nair',
      'Mumbai',
      'Maharashtra',
      '27'
    },
    new List<String>{
      'Helio Energy',
      'Arjun',
      'Menon',
      'Chennai',
      'Tamil Nadu',
      '33'
    },
    new List<String>{
      'Lotus Textiles',
      'Farah',
      'Sheikh',
      'Surat',
      'Gujarat',
      '24'
    },
    new List<String>{
      'Cobalt Systems',
      'Sandeep',
      'Verma',
      'Noida',
      'Uttar Pradesh',
      '09'
    },
    new List<String>{
      'Vega Pharma',
      'Deepa',
      'Pillai',
      'Kochi',
      'Kerala',
      '32'
    },
    new List<String>{
      'Indus Freight',
      'Harpreet',
      'Gill',
      'Ludhiana',
      'Punjab',
      '03'
    }
  };

  // account, reference, status, days ago, payment terms, lines as "CODE qty discount"
  private static final List<List<String>> QUOTE_ROWS = new List<List<String>>{
    new List<String>{
      'Orbit Retail',
      MARKER,
      'draft',
      '0',
      'Net 30',
      'PLAT 25, SUPP 1'
    },
    new List<String>{
      'Bluepeak Software',
      'Bluepeak: platform and analytics',
      'approval',
      '0',
      'Net 30',
      'PLAT 80 18, ANLY 80 18'
    },
    new List<String>{
      'Kavya Logistics',
      'Kavya Logistics: fleet team onboarding',
      'approval',
      '1',
      'Net 60',
      'PLAT 40, IMPL 1, TRNG 1'
    },
    new List<String>{
      'Zenith Forgings',
      'Zenith Forgings: plant-wide licence',
      'approval',
      '1',
      'Net 30',
      'PLAT 120 22, SUPP 1 22, IMPL 1'
    },
    new List<String>{
      'Nimbus Health',
      'Nimbus Health: renewal and analytics',
      'sent',
      '4',
      'Net 30',
      'PLAT 70 10, ANLY 70 10, SUPP 1, TRNG 1'
    },
    new List<String>{
      'Saffron Foods',
      'Saffron Foods: sales team licence',
      'signed',
      '8',
      'Net 30',
      'PLAT 35 5, IMPL 1'
    },
    new List<String>{
      'Tarang Media',
      'Tarang Media: starter plan',
      'invoiced',
      '12',
      'Net 30',
      'PLAT 15, TRNG 1'
    },
    new List<String>{
      'Helio Energy',
      'Helio Energy: enterprise rollout',
      'paid',
      '23',
      'Net 30',
      'PLAT 110 12, ANLY 110 12, SUPP 1, IMPL 1'
    }
  };

  // account, renews in days, items as "CODE qty", auto-renew, status, cancel reason
  private static final List<List<String>> SUBSCRIPTION_ROWS = new List<List<String>>{
    new List<String>{
      'Nimbus Health',
      '28',
      'PLAT 70, ANLY 70, SUPP 1',
      'n',
      'active',
      ''
    },
    new List<String>{ 'Tarang Media', '41', 'PLAT 15', 'y', 'active', '' },
    new List<String>{
      'Helio Energy',
      '54',
      'PLAT 110, ANLY 110, SUPP 1',
      'y',
      'active',
      ''
    },
    new List<String>{ 'Orbit Retail', '73', 'PLAT 20', 'y', 'active', '' },
    new List<String>{
      'Saffron Foods',
      '86',
      'PLAT 35, SUPP 1',
      'n',
      'active',
      ''
    },
    new List<String>{
      'Cobalt Systems',
      '124',
      'PLAT 60, ANLY 60',
      'y',
      'paused',
      ''
    },
    new List<String>{
      'Bluepeak Software',
      '171',
      'PLAT 50, ANLY 50',
      'y',
      'active',
      ''
    },
    new List<String>{
      'Zenith Forgings',
      '243',
      'PLAT 90, SUPP 1',
      'y',
      'active',
      ''
    },
    new List<String>{
      'Lotus Textiles',
      '15',
      'PLAT 18',
      'n',
      'cancelled',
      'Moved to an in-house tool'
    }
  };

  // account, issued days ago, due in days, lines, then what happened:
  // "draft", "paid N" (in full, N days ago), "part P" (P percent paid), and "reminded a b c" (days ago)
  private static final List<List<String>> INVOICE_ROWS = new List<List<String>>{
    new List<String>{ 'Tarang Media', '7', '23', 'PLAT 15, TRNG 1', '' },
    new List<String>{
      'Helio Energy',
      '18',
      '12',
      'PLAT 110 12, ANLY 110 12, SUPP 1, IMPL 1',
      'paid 11'
    },
    new List<String>{
      'Indus Freight',
      '3',
      '27',
      'PLAT 30 5, TRNG 1',
      'draft'
    },
    new List<String>{
      'Vega Pharma',
      '10',
      '20',
      'PLAT 45 8, SUPP 1',
      'paid 2'
    },
    new List<String>{
      'Cobalt Systems',
      '14',
      '16',
      'PLAT 60 10, ANLY 60 10',
      ''
    },
    new List<String>{
      'Orbit Retail',
      '36',
      '-6',
      'PLAT 20, IMPL 1',
      'part 40; reminded 3'
    },
    new List<String>{
      'Zenith Forgings',
      '25',
      '5',
      'PLAT 90 10, SUPP 1',
      'part 60'
    },
    new List<String>{
      'Nimbus Health',
      '52',
      '-22',
      'PLAT 70 10, SUPP 1',
      'part 50; reminded 19 15 8'
    },
    new List<String>{
      'Bluepeak Software',
      '40',
      '-10',
      'PLAT 50 5, ANLY 50 5',
      'paid 5; reminded 7'
    },
    new List<String>{
      'Kavya Logistics',
      '75',
      '-45',
      'PLAT 25, TRNG 1',
      'reminded 42 38 31'
    },
    new List<String>{
      'Saffron Foods',
      '95',
      '-65',
      'PLAT 35 5, SUPP 1',
      'reminded 62 58 51'
    },
    new List<String>{
      'Lotus Textiles',
      '130',
      '-100',
      'PLAT 18, IMPL 1',
      'reminded 97 93 86'
    }
  };

  /** Whether the demo records are already in the org. */
  @AuraEnabled
  public static Boolean isLoaded() {
    return [
        SELECT COUNT()
        FROM Quote__c
        WHERE Reference__c = :MARKER
        WITH SYSTEM_MODE
      ] > 0;
  }

  /** Loads the demo records. Needs the Revquila Admin permission set. Returns what it created, in words. */
  @AuraEnabled
  public static String load() {
    Boolean prevBypass = RevquilaSyncGuard.bypassTriggers;
    RevquilaSyncGuard.bypassTriggers = true;
    try {
      if (!Schema.sObjectType.Config_Version__c.isCreateable()) {
        throw new RevquilaCore.ProblemException(
          'You need the Revquila Admin permission set to load the demo records.'
        );
      }
      if (isLoaded()) {
        if (
          [
            SELECT COUNT()
            FROM Bundle_Option__c
            WITH SYSTEM_MODE
          ] == 0 ||
          [SELECT COUNT() FROM Price_Rule__c WITH SYSTEM_MODE] == 0
        ) {
          return topUp();
        }
        throw new RevquilaCore.ProblemException(
          'The demo records are already loaded.'
        );
      }
      Map<String, Id> products = ensureProducts();
      Map<String, Account> accounts = ensureAccounts();
      Map<String, Id> contacts = ensureContacts(accounts);
      Map<String, Subscription__c> subscriptions = loadSubscriptions(
        accounts,
        products
      );
      Map<String, Quote__c> quotes = loadQuotes(
        accounts,
        contacts,
        products,
        subscriptions
      );
      loadInvoices(accounts, contacts, products, subscriptions, quotes);
      topUp();
      return QUOTE_ROWS.size() +
        ' quotes, ' +
        INVOICE_ROWS.size() +
        ' invoices and ' +
        SUBSCRIPTION_ROWS.size() +
        ' subscriptions loaded, with a bundle, price rules, orders and contracts';
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    } finally {
      RevquilaSyncGuard.bypassTriggers = prevBypass;
    }
  }

  // ---------------------------------------------------------------- products, accounts, contacts

  private static Map<String, Id> ensureProducts() {
    Map<String, Id> byCode = new Map<String, Id>();
    Set<String> codes = new Set<String>();
    for (List<String> row : PRODUCT_ROWS) {
      codes.add(code(row[0]));
    }
    for (Product2 existing : [
      SELECT Id, ProductCode
      FROM Product2
      WHERE ProductCode IN :codes
      WITH SYSTEM_MODE
    ]) {
      byCode.put(existing.ProductCode, existing.Id);
    }
    List<Product2> created = new List<Product2>();
    Map<String, Decimal> prices = new Map<String, Decimal>();
    for (List<String> row : PRODUCT_ROWS) {
      prices.put(code(row[0]), Decimal.valueOf(row[3]));
      if (!byCode.containsKey(code(row[0]))) {
        created.add(
          new Product2(
            ProductCode = code(row[0]),
            Name = row[1],
            Unit__c = row[2],
            Recurring__c = row[4] == 'y',
            Bundle__c = row[0] == BUNDLE_CODE,
            IsActive = true
          )
        );
      }
    }
    insert as system created;
    List<PricebookEntry> entries = new List<PricebookEntry>();
    for (Product2 product : created) {
      byCode.put(product.ProductCode, product.Id);
      entries.add(
        new PricebookEntry(
          Pricebook2Id = RevquilaPricing.standardPriceBookId(),
          Product2Id = product.Id,
          UnitPrice = prices.get(product.ProductCode),
          IsActive = true
        )
      );
    }
    insert as system entries;
    return byCode;
  }

  // A demo product's code, kept apart from the org's own products
  private static String code(String shortCode) {
    return 'RQ-' + shortCode;
  }

  private static Map<String, Account> ensureAccounts() {
    Map<String, Account> byName = new Map<String, Account>();
    Set<String> names = new Set<String>();
    for (List<String> row : ACCOUNT_ROWS) {
      names.add(row[0]);
    }
    for (Account existing : [
      SELECT Id, Name, BillingState
      FROM Account
      WHERE Name IN :names
      WITH SYSTEM_MODE
    ]) {
      byName.put(existing.Name, existing);
    }
    List<Account> created = new List<Account>();
    for (List<String> row : ACCOUNT_ROWS) {
      if (!byName.containsKey(row[0])) {
        Account account = new Account(
          Name = row[0],
          BillingCity = row[3],
          BillingState = row[4],
          BillingCountry = 'India',
          // a placeholder in the GSTIN format: state code, PAN, entity, check digits
          Tax_Registration_Number__c = row[5] + 'AAAAA0000A1Z5'
        );
        created.add(account);
        byName.put(row[0], account);
      }
    }
    // An org with state and country picklists may not list a demo state. The address is
    // optional, so an account that is refused is loaded again without it.
    List<Account> plain = new List<Account>();
    List<Database.SaveResult> results = Database.insert(
      created,
      allowDuplicates(),
      AccessLevel.SYSTEM_MODE
    );
    for (Integer index = 0; index < results.size(); index++) {
      if (!results[index].isSuccess()) {
        Account withoutAddress = new Account(
          Name = created[index].Name,
          Tax_Registration_Number__c = created[index].Tax_Registration_Number__c
        );
        plain.add(withoutAddress);
        byName.put(withoutAddress.Name, withoutAddress);
      }
    }
    Database.insert(plain, allowDuplicates(), AccessLevel.SYSTEM_MODE);
    return byName;
  }

  // Demo records are loaded even when a duplicate rule thinks it has seen one before,
  // and one that is refused for another reason does not stop the rest
  private static Database.DMLOptions allowDuplicates() {
    Database.DMLOptions options = new Database.DMLOptions();
    options.DuplicateRuleHeader.allowSave = true;
    options.optAllOrNone = false;
    return options;
  }

  // The state each demo account is in, which is its place of supply
  private static String stateOf(String accountName) {
    for (List<String> row : ACCOUNT_ROWS) {
      if (row[0] == accountName) {
        return row[4];
      }
    }
    return RevquilaSettings.current().homeRegion;
  }

  private static Map<String, Id> ensureContacts(Map<String, Account> accounts) {
    Map<String, Id> byAccount = new Map<String, Id>();
    Set<Id> accountIds = new Set<Id>();
    for (Account account : accounts.values()) {
      accountIds.add(account.Id);
    }
    for (Contact existing : [
      SELECT Id, Account.Name
      FROM Contact
      WHERE AccountId IN :accountIds
      WITH SYSTEM_MODE
      ORDER BY CreatedDate DESC
    ]) {
      byAccount.put(existing.Account.Name, existing.Id);
    }
    List<Contact> created = new List<Contact>();
    List<String> accountNames = new List<String>();
    for (List<String> row : ACCOUNT_ROWS) {
      if (!byAccount.containsKey(row[0])) {
        created.add(
          new Contact(
            AccountId = accounts.get(row[0]).Id,
            FirstName = row[1],
            LastName = row[2],
            Title = 'Finance lead',
            Email = (row[1] + '.' + row[2]).toLowerCase() + '@example.com'
          )
        );
        accountNames.add(row[0]);
      }
    }
    insert as system created;
    for (Integer index = 0; index < created.size(); index++) {
      byAccount.put(accountNames[index], created[index].Id);
    }
    return byAccount;
  }

  // ---------------------------------------------------------------- subscriptions

  private static Map<String, Subscription__c> loadSubscriptions(
    Map<String, Account> accounts,
    Map<String, Id> products
  ) {
    Map<Id, RevquilaPricing.Product> catalogue = catalogue(products);
    Date today = Date.today();
    RevquilaSettings.Market home = RevquilaSettings.current().home;
    Map<String, Subscription__c> byAccount = new Map<String, Subscription__c>();
    for (List<String> row : SUBSCRIPTION_ROWS) {
      Date renewal = today.addDays(Integer.valueOf(row[1]));
      byAccount.put(
        row[0],
        new Subscription__c(
          Account__c = accounts.get(row[0]).Id,
          Start_Date__c = renewal.addDays(
            -RevquilaSubscriptionController.TERM_DAYS
          ),
          Renewal_Date__c = renewal,
          Auto_Renew__c = row[3] == 'y',
          Status__c = row[4],
          Cancel_Reason__c = String.isBlank(row[5]) ? null : row[5],
          Exchange_Rate__c = 1,
          Currency_Code__c = home.currencyCode,
          Country__c = home.countryName
        )
      );
    }
    insert as system byAccount.values();

    List<Subscription_Item__c> items = new List<Subscription_Item__c>();
    List<Revenue_Event__c> events = new List<Revenue_Event__c>();
    for (List<String> row : SUBSCRIPTION_ROWS) {
      Subscription__c subscription = byAccount.get(row[0]);
      Decimal mrr = 0;
      Decimal openingMrr = 0;
      Integer seats = 0;
      Integer openingSeats = 0;
      Integer position = 0;
      for (RevquilaPricing.LineInput line : lines(row[2], products)) {
        RevquilaPricing.Product product = catalogue.get(line.productId);
        items.add(
          new Subscription_Item__c(
            Subscription__c = subscription.Id,
            Product__c = product.id,
            Description__c = product.name,
            Unit__c = product.unit,
            Unit_Price__c = product.price,
            Quantity__c = line.qty
          )
        );
        // every demo subscription started with fewer seats of its first product
        Decimal opening = line.qty;
        if (position == 0) {
          opening = Math.max(
            1,
            (line.qty * 0.7).setScale(0, RoundingMode.HALF_UP)
          );
          seats = line.qty.intValue();
          openingSeats = opening.intValue();
        }
        mrr += product.price * line.qty / 12;
        openingMrr += product.price * opening / 12;
        position++;
      }
      Datetime started = atNoon(subscription.Start_Date__c);
      // the seats were added part-way through the term so far
      Integer elapsed = subscription.Start_Date__c.daysBetween(today);
      events.add(
        change(
          subscription.Id,
          'Subscription started',
          openingSeats + ' seats',
          RevquilaCore.TONE_ACCENT,
          started,
          openingMrr
        )
      );
      events.add(
        change(
          subscription.Id,
          'Seats added',
          openingSeats + ' to ' + seats,
          RevquilaCore.TONE_GOOD,
          started.addDays(Math.min(140, elapsed / 2)),
          mrr
        )
      );
      if (row[4] == RevquilaSubscriptionController.PAUSED) {
        events.add(
          change(
            subscription.Id,
            'Subscription paused',
            'Billing stops until it is resumed',
            RevquilaCore.TONE_WARN,
            System.now().addDays(-20),
            0
          )
        );
      } else if (row[4] == RevquilaSubscriptionController.CANCELLED) {
        events.add(
          change(
            subscription.Id,
            'Subscription cancelled',
            row[5],
            RevquilaCore.TONE_BAD,
            System.now().addDays(-45),
            0
          )
        );
      }
    }
    insert as system items;
    insert as system events;
    return byAccount;
  }

  private static Revenue_Event__c change(
    Id subscriptionId,
    String title,
    String detail,
    String tone,
    Datetime occurredOn,
    Decimal mrr
  ) {
    Revenue_Event__c entry = RevquilaCore.event(
      subscriptionId,
      title,
      detail,
      tone
    );
    entry.Occurred_On__c = occurredOn;
    entry.Kind__c = RevquilaSubscriptionController.KIND_MRR;
    entry.Number_Value__c = RevquilaCore.money(mrr);
    return entry;
  }

  // ---------------------------------------------------------------- quotes

  private static Map<String, Quote__c> loadQuotes(
    Map<String, Account> accounts,
    Map<String, Id> contacts,
    Map<String, Id> products,
    Map<String, Subscription__c> subscriptions
  ) {
    Date today = Date.today();
    RevquilaSettings.Market home = RevquilaSettings.current().home;
    Integer validDays = RevquilaSettings.current().quoteValidDays;
    Map<String, Quote__c> byAccount = new Map<String, Quote__c>();
    Map<String, RevquilaPricing.Totals> totalsByAccount = new Map<String, RevquilaPricing.Totals>();
    for (List<String> row : QUOTE_ROWS) {
      Account account = accounts.get(row[0]);
      String status = row[2];
      Date quoteDate = today.addDays(-Integer.valueOf(row[3]));
      RevquilaPricing.Totals totals = RevquilaPricing.price(
        lines(row[5], products),
        stateOf(row[0]),
        row[4]
      );
      Quote__c quote = new Quote__c(
        Account__c = account.Id,
        Contact__c = contacts.get(row[0]),
        Reference__c = row[1],
        Status__c = status,
        Version__c = 1,
        Payment_Terms__c = row[4],
        Valid_Days__c = validDays,
        Quote_Date__c = quoteDate,
        Valid_Until__c = quoteDate.addDays(validDays),
        Region__c = stateOf(row[0]),
        Exchange_Rate__c = 1,
        Currency_Code__c = home.currencyCode,
        Country__c = home.countryName,
        Base_Net_Amount__c = totals.net
      );
      stamp(quote, totals);
      if (status == RevquilaQuoteController.APPROVAL) {
        quote.Approval_Decision__c = 'pending';
        quote.Approval_Requested_On__c = atNoon(quoteDate);
      }
      Integer stage = stageOf(status);
      if (stage >= 3) {
        quote.Sent_On__c = quoteDate.addDays(1);
      }
      if (stage >= 4) {
        quote.Signed_On__c = quoteDate.addDays(4);
      }
      byAccount.put(row[0], quote);
      totalsByAccount.put(row[0], totals);
    }
    insert as system byAccount.values();

    List<Quote_Line__c> quoteLines = new List<Quote_Line__c>();
    List<Revenue_Event__c> events = new List<Revenue_Event__c>();
    List<Subscription__c> started = new List<Subscription__c>();
    for (List<String> row : QUOTE_ROWS) {
      Quote__c quote = byAccount.get(row[0]);
      RevquilaPricing.Totals totals = totalsByAccount.get(row[0]);
      Integer position = 0;
      for (RevquilaCore.LineView line : totals.lines) {
        position++;
        quoteLines.add(
          new Quote_Line__c(
            Quote__c = quote.Id,
            Product__c = line.productId,
            Description__c = line.name,
            Unit__c = line.unit,
            Unit_Price__c = line.price,
            Quantity__c = line.qty,
            Discount__c = line.discount,
            List_Amount__c = line.listAmount,
            Net_Amount__c = line.net,
            Recurring__c = line.recurring,
            Sort_Order__c = position
          )
        );
      }
      Datetime created = atNoon(quote.Quote_Date__c);
      Integer stage = stageOf(quote.Status__c);
      events.add(
        at(
          quote.Id,
          'Quote created',
          quote.Reference__c,
          RevquilaCore.TONE_ACCENT,
          created
        )
      );
      if (quote.Status__c == RevquilaQuoteController.APPROVAL) {
        events.add(
          at(
            quote.Id,
            'Approval requested',
            totals.policyIssue,
            RevquilaCore.TONE_WARN,
            created
          )
        );
      }
      if (stage >= 3) {
        events.add(
          at(
            quote.Id,
            'Marked as sent',
            'Version 1 locked',
            RevquilaCore.TONE_ACCENT,
            created.addDays(1)
          )
        );
      }
      if (stage >= 4) {
        events.add(
          at(
            quote.Id,
            'Signed',
            'Version 1 accepted by the customer',
            RevquilaCore.TONE_TEAL,
            created.addDays(4)
          )
        );
        // the account's demo subscription is the one this quote started
        Subscription__c subscription = subscriptions.get(row[0]);
        if (subscription != null) {
          started.add(
            new Subscription__c(Id = subscription.Id, Quote__c = quote.Id)
          );
        }
      }
      if (stage >= 5) {
        events.add(
          at(
            quote.Id,
            'Invoice raised',
            'Due as per ' + quote.Payment_Terms__c,
            RevquilaCore.TONE_ACCENT,
            created.addDays(5)
          )
        );
      }
      if (stage >= 6) {
        events.add(
          at(
            quote.Id,
            'Paid in full',
            'The invoice is settled',
            RevquilaCore.TONE_GOOD,
            created.addDays(12)
          )
        );
      }
    }
    insert as system quoteLines;
    insert as system events;
    update as system started;
    return byAccount;
  }

  // How far along the quote-to-cash path a status is: 1 drafted … 6 paid
  private static Integer stageOf(String status) {
    if (status == RevquilaQuoteController.PAID) {
      return 6;
    }
    if (status == RevquilaQuoteController.INVOICED) {
      return 5;
    }
    if (status == RevquilaQuoteController.SIGNED) {
      return 4;
    }
    return status == RevquilaQuoteController.SENT ? 3 : 1;
  }

  // ---------------------------------------------------------------- invoices

  private static void loadInvoices(
    Map<String, Account> accounts,
    Map<String, Id> contacts,
    Map<String, Id> products,
    Map<String, Subscription__c> subscriptions,
    Map<String, Quote__c> quotes
  ) {
    Date today = Date.today();
    RevquilaSettings.Market home = RevquilaSettings.current().home;
    List<Invoice__c> invoices = new List<Invoice__c>();
    List<RevquilaPricing.Totals> totals = new List<RevquilaPricing.Totals>();
    for (List<String> row : INVOICE_ROWS) {
      Account account = accounts.get(row[0]);
      RevquilaPricing.Totals priced = RevquilaPricing.price(
        lines(row[3], products),
        stateOf(row[0]),
        (String) null
      );
      Date issued = today.addDays(-Integer.valueOf(row[1]));
      // an invoiced or paid demo quote for the same account is the one this invoice came from
      Quote__c quote = quotes.get(row[0]);
      Boolean fromQuote = quote != null && stageOf(quote.Status__c) >= 5;
      Subscription__c subscription = subscriptions.get(row[0]);
      Invoice__c invoice = new Invoice__c(
        Account__c = account.Id,
        Contact__c = contacts.get(row[0]),
        Quote__c = fromQuote ? quote.Id : null,
        Subscription__c = subscription == null ? null : subscription.Id,
        Reference__c = fromQuote ? quote.Reference__c : null,
        Payment_Terms__c = 'Net 30',
        Region__c = stateOf(row[0]),
        Issued_On__c = issued,
        Due_On__c = today.addDays(Integer.valueOf(row[2])),
        Sent_On__c = row[4].contains('draft') ? null : issued,
        Exchange_Rate__c = 1,
        Currency_Code__c = home.currencyCode,
        Country__c = home.countryName,
        Base_Net_Amount__c = priced.net
      );
      stamp(invoice, priced);
      invoices.add(invoice);
      totals.add(priced);
    }
    insert as system invoices;

    String prefix = RevquilaSettings.current().invoicePrefix;
    Map<Id, Invoice__c> sequences = new Map<Id, Invoice__c>(
      [
        SELECT Id, Name
        FROM Invoice__c
        WHERE Id IN :invoices
        WITH SYSTEM_MODE
      ]
    );
    List<Invoice__c> numbered = new List<Invoice__c>();
    List<Invoice_Line__c> invoiceLines = new List<Invoice_Line__c>();
    List<Payment__c> payments = new List<Payment__c>();
    List<Revenue_Event__c> events = new List<Revenue_Event__c>();
    for (Integer index = 0; index < invoices.size(); index++) {
      Invoice__c invoice = invoices[index];
      RevquilaPricing.Totals priced = totals[index];
      String happened = INVOICE_ROWS[index][4];
      numbered.add(
        new Invoice__c(
          Id = invoice.Id,
          Number__c = prefix + sequences.get(invoice.Id).Name
        )
      );
      Integer position = 0;
      for (RevquilaCore.LineView line : priced.lines) {
        position++;
        invoiceLines.add(
          new Invoice_Line__c(
            Invoice__c = invoice.Id,
            Product__c = line.productId,
            Description__c = line.name,
            Unit__c = line.unit,
            Unit_Price__c = line.price,
            Quantity__c = line.qty,
            Discount__c = line.discount,
            List_Amount__c = line.listAmount,
            Net_Amount__c = line.net,
            Recurring__c = line.recurring,
            Sort_Order__c = position
          )
        );
      }
      Datetime raised = atNoon(invoice.Issued_On__c);
      events.add(
        at(
          invoice.Id,
          'Invoice raised',
          invoice.Quote__c == null
            ? 'Billing for the subscription'
            : 'From the signed quote',
          RevquilaCore.TONE_ACCENT,
          raised
        )
      );
      if (invoice.Sent_On__c != null) {
        events.add(
          at(
            invoice.Id,
            'Marked as sent',
            null,
            RevquilaCore.TONE_ACCENT,
            raised
          )
        );
      }
      for (String part : happened.split(';')) {
        List<String> words = part.trim().split(' ');
        if (words[0] == 'paid') {
          payments.add(
            new Payment__c(
              Invoice__c = invoice.Id,
              Amount__c = priced.total,
              Base_Amount__c = priced.total,
              Method__c = 'Bank transfer',
              Reference__c = 'NEFT',
              Paid_On__c = today.addDays(-Integer.valueOf(words[1]))
            )
          );
        } else if (words[0] == 'part') {
          Decimal partAmt = RevquilaCore.money(
            priced.total * Integer.valueOf(words[1]) / 100
          );
          payments.add(
            new Payment__c(
              Invoice__c = invoice.Id,
              Amount__c = partAmt,
              Base_Amount__c = partAmt,
              Method__c = 'UPI',
              Paid_On__c = invoice.Issued_On__c.addDays(9)
            )
          );
        } else if (words[0] == 'reminded') {
          for (Integer count = 1; count < words.size(); count++) {
            Revenue_Event__c reminder = at(
              invoice.Id,
              'Reminder ' + count,
              null,
              RevquilaCore.TONE_WARN,
              System.now().addDays(-Integer.valueOf(words[count]))
            );
            reminder.Kind__c = RevquilaInvoiceController.KIND_REMINDER;
            events.add(reminder);
          }
        }
      }
    }
    update as system numbered;
    insert as system invoiceLines;
    insert as system payments;
    insert as system events;
  }

  // ---------------------------------------------------------------- CPQ: bundle, rules, orders, contracts, currency

  /**
   * Adds what the CPQ screens show to an org whose demo records predate them: the bundle and
   * its options, the price rules, an order and a contract behind every signed quote, and the
   * home currency on records saved before currencies were kept.
   */
  private static String topUp() {
    Map<String, Id> products = ensureProducts();
    Integer added = 0;
    if (
      [
        SELECT COUNT()
        FROM Bundle_Option__c
        WHERE Bundle__c = :products.get(code(BUNDLE_CODE))
        WITH SYSTEM_MODE
      ] == 0
    ) {
      List<Bundle_Option__c> options = new List<Bundle_Option__c>();
      Integer position = 0;
      for (RevquilaPricing.LineInput line : lines(BUNDLE_OPTIONS, products)) {
        position++;
        options.add(
          new Bundle_Option__c(
            Bundle__c = products.get(code(BUNDLE_CODE)),
            Product__c = line.productId,
            Quantity__c = line.qty,
            Required__c = position == 1,
            Sort_Order__c = position
          )
        );
      }
      insert as system options;
      added += options.size();
    }
    if ([SELECT COUNT() FROM Price_Rule__c WITH SYSTEM_MODE] == 0) {
      List<Price_Rule__c> rules = new List<Price_Rule__c>();
      for (List<String> row : RULE_ROWS) {
        rules.add(
          new Price_Rule__c(
            Name = row[0],
            Product__c = String.isBlank(row[1])
              ? null
              : products.get(code(row[1])),
            Min_Quantity__c = Decimal.valueOf(row[2]),
            Discount__c = Decimal.valueOf(row[3]),
            Active__c = true,
            Note__c = 'Volume discount, given without approval'
          )
        );
      }
      insert as system rules;
      added += rules.size();
    }
    added += backfillCurrency();
    added += bookOrders();
    return added + ' CPQ records added';
  }

  // Records saved before currencies were kept are in the home currency at a rate of 1
  private static Integer backfillCurrency() {
    RevquilaSettings.Market home = RevquilaSettings.current().home;
    Integer changed = 0;
    for (
      String name : new List<String>{
        'Quote__c',
        'Invoice__c',
        'Order__c',
        'Subscription__c',
        'Contract__c'
      }
    ) {
      List<SObject> rows = Database.query(
        'SELECT Id FROM ' +
          name +
          ' WHERE Exchange_Rate__c = NULL OR Currency_Code__c = NULL LIMIT 2000',
        AccessLevel.SYSTEM_MODE
      );
      for (SObject row : rows) {
        row.put('Exchange_Rate__c', 1);
        row.put('Currency_Code__c', home.currencyCode);
        row.put('Country__c', home.countryName);
      }
      if (!rows.isEmpty()) {
        update as system rows;
        changed += rows.size();
      }
    }
    List<Quote__c> quotes = [
      SELECT Id, Net_Amount__c
      FROM Quote__c
      WHERE Base_Net_Amount__c = NULL
      WITH SYSTEM_MODE
      LIMIT 2000
    ];
    if (!quotes.isEmpty()) {
      for (Quote__c quote : quotes) {
        quote.Base_Net_Amount__c = quote.Net_Amount__c;
      }
      update as system quotes;
    }
    List<Invoice__c> invoices = [
      SELECT Id, Net_Amount__c
      FROM Invoice__c
      WHERE Base_Net_Amount__c = NULL
      WITH SYSTEM_MODE
      LIMIT 2000
    ];
    if (!invoices.isEmpty()) {
      for (Invoice__c invoice : invoices) {
        invoice.Base_Net_Amount__c = invoice.Net_Amount__c;
      }
      update as system invoices;
    }
    List<Payment__c> payments = [
      SELECT Id, Amount__c
      FROM Payment__c
      WHERE Base_Amount__c = NULL
      WITH SYSTEM_MODE
      LIMIT 2000
    ];
    if (!payments.isEmpty()) {
      for (Payment__c payment : payments) {
        payment.Base_Amount__c = payment.Amount__c;
      }
      update as system payments;
    }
    return changed;
  }

  // Every signed, invoiced or paid quote without an order gets one, and a contract when it recurs
  private static Integer bookOrders() {
    Set<Id> withOrder = new Set<Id>();
    for (Order__c order : [
      SELECT Quote__c
      FROM Order__c
      WHERE Quote__c != NULL
      WITH SYSTEM_MODE
    ]) {
      withOrder.add(order.Quote__c);
    }
    List<Quote__c> quotes = new List<Quote__c>();
    for (Quote__c quote : [
      SELECT
        Id,
        Name,
        Account__c,
        Contact__c,
        Reference__c,
        Status__c,
        Payment_Terms__c,
        Region__c,
        Country__c,
        Currency_Code__c,
        Exchange_Rate__c,
        Base_Net_Amount__c,
        Notes__c,
        Subtotal__c,
        Discount_Total__c,
        Net_Amount__c,
        Tax_Amount__c,
        Total__c,
        Tax_Breakup__c,
        Signed_On__c,
        (
          SELECT
            Product__c,
            Description__c,
            Unit__c,
            Unit_Price__c,
            Quantity__c,
            Discount__c,
            Rule_Discount__c,
            Bundle__c,
            List_Amount__c,
            Net_Amount__c,
            Recurring__c
          FROM Lines__r
          ORDER BY Sort_Order__c
        )
      FROM Quote__c
      WHERE Status__c IN ('signed', 'invoiced', 'paid')
      WITH SYSTEM_MODE
      LIMIT 500
    ]) {
      if (!withOrder.contains(quote.Id)) {
        quotes.add(quote);
      }
    }
    if (quotes.isEmpty()) {
      return 0;
    }
    Map<Id, Subscription__c> subscriptions = new Map<Id, Subscription__c>();
    for (Subscription__c subscription : [
      SELECT Id, Quote__c, Start_Date__c, Renewal_Date__c, Auto_Renew__c
      FROM Subscription__c
      WHERE Quote__c IN :quotes
      WITH SYSTEM_MODE
    ]) {
      subscriptions.put(subscription.Quote__c, subscription);
    }
    Map<Id, Invoice__c> invoices = new Map<Id, Invoice__c>();
    for (Invoice__c invoice : [
      SELECT Id, Quote__c
      FROM Invoice__c
      WHERE Quote__c IN :quotes
      WITH SYSTEM_MODE
    ]) {
      invoices.put(invoice.Quote__c, invoice);
    }

    Map<Id, Contract__c> contracts = new Map<Id, Contract__c>();
    for (Quote__c quote : quotes) {
      Decimal annual = 0;
      for (Quote_Line__c line : quote.Lines__r) {
        if (line.Recurring__c) {
          annual += RevquilaCore.orZero(line.Net_Amount__c);
        }
      }
      if (annual == 0) {
        continue;
      }
      Subscription__c subscription = subscriptions.get(quote.Id);
      Date signed = quote.Signed_On__c == null
        ? Date.today()
        : quote.Signed_On__c;
      Date starts = subscription == null ? signed : subscription.Start_Date__c;
      contracts.put(
        quote.Id,
        new Contract__c(
          Account__c = quote.Account__c,
          Contact__c = quote.Contact__c,
          Quote__c = quote.Id,
          Subscription__c = subscription == null ? null : subscription.Id,
          Reference__c = quote.Reference__c,
          Status__c = RevquilaContractController.ACTIVE,
          Start_Date__c = starts,
          End_Date__c = subscription == null
            ? starts.addDays(RevquilaSubscriptionController.TERM_DAYS - 1)
            : subscription.Renewal_Date__c.addDays(-1),
          Term_Months__c = 12,
          Signed_On__c = signed,
          Auto_Renew__c = subscription == null
            ? true
            : subscription.Auto_Renew__c,
          Annual_Value__c = RevquilaCore.money(annual),
          Notes__c = quote.Notes__c,
          Country__c = quote.Country__c,
          Currency_Code__c = quote.Currency_Code__c,
          Exchange_Rate__c = RevquilaCore.rate(quote.Exchange_Rate__c)
        )
      );
    }
    insert as system contracts.values();

    Map<Id, Order__c> orders = new Map<Id, Order__c>();
    for (Quote__c quote : quotes) {
      Date signed = quote.Signed_On__c == null
        ? Date.today()
        : quote.Signed_On__c;
      Boolean invoiced = quote.Status__c != RevquilaQuoteController.SIGNED;
      orders.put(
        quote.Id,
        new Order__c(
          Account__c = quote.Account__c,
          Contact__c = quote.Contact__c,
          Quote__c = quote.Id,
          Contract__c = contracts.containsKey(quote.Id)
            ? contracts.get(quote.Id).Id
            : null,
          Reference__c = quote.Reference__c,
          Status__c = invoiced
            ? RevquilaOrderController.INVOICED
            : RevquilaOrderController.BOOKED,
          Order_Date__c = signed,
          Activated_On__c = invoiced ? signed : null,
          Payment_Terms__c = quote.Payment_Terms__c,
          Region__c = quote.Region__c,
          Country__c = quote.Country__c,
          Currency_Code__c = quote.Currency_Code__c,
          Exchange_Rate__c = RevquilaCore.rate(quote.Exchange_Rate__c),
          Base_Net_Amount__c = quote.Base_Net_Amount__c,
          Notes__c = quote.Notes__c,
          Subtotal__c = quote.Subtotal__c,
          Discount_Total__c = quote.Discount_Total__c,
          Net_Amount__c = quote.Net_Amount__c,
          Tax_Amount__c = quote.Tax_Amount__c,
          Total__c = quote.Total__c,
          Tax_Breakup__c = quote.Tax_Breakup__c
        )
      );
    }
    insert as system orders.values();

    List<Order_Line__c> orderLines = new List<Order_Line__c>();
    List<Revenue_Event__c> events = new List<Revenue_Event__c>();
    List<Invoice__c> linked = new List<Invoice__c>();
    for (Quote__c quote : quotes) {
      Order__c order = orders.get(quote.Id);
      Integer position = 0;
      for (Quote_Line__c line : quote.Lines__r) {
        position++;
        orderLines.add(
          new Order_Line__c(
            Order__c = order.Id,
            Product__c = line.Product__c,
            Description__c = line.Description__c,
            Unit__c = line.Unit__c,
            Unit_Price__c = line.Unit_Price__c,
            Quantity__c = line.Quantity__c,
            Discount__c = line.Discount__c,
            Rule_Discount__c = line.Rule_Discount__c,
            Bundle__c = line.Bundle__c,
            List_Amount__c = line.List_Amount__c,
            Net_Amount__c = line.Net_Amount__c,
            Recurring__c = line.Recurring__c,
            Sort_Order__c = position
          )
        );
      }
      Datetime booked = atNoon(order.Order_Date__c);
      events.add(
        at(
          order.Id,
          'Order booked',
          'From quote ' + quote.Name,
          RevquilaCore.TONE_ACCENT,
          booked
        )
      );
      if (order.Status__c == RevquilaOrderController.INVOICED) {
        events.add(
          at(
            order.Id,
            'Order activated',
            'Ready to invoice',
            RevquilaCore.TONE_GOOD,
            booked
          )
        );
        events.add(
          at(
            order.Id,
            'Invoice raised',
            null,
            RevquilaCore.TONE_ACCENT,
            booked.addDays(1)
          )
        );
      }
      if (contracts.containsKey(quote.Id)) {
        events.add(
          at(
            contracts.get(quote.Id).Id,
            'Contract signed',
            'From quote ' + quote.Name + ' · 12-month term',
            RevquilaCore.TONE_TEAL,
            booked
          )
        );
      }
      if (invoices.containsKey(quote.Id)) {
        linked.add(
          new Invoice__c(Id = invoices.get(quote.Id).Id, Order__c = order.Id)
        );
      }
    }
    insert as system orderLines;
    insert as system events;
    update as system linked;
    return orders.size() + contracts.size();
  }

  // ---------------------------------------------------------------- helpers

  // "PLAT 80 18, ANLY 80" -> the product, quantity and discount % of each line
  private static List<RevquilaPricing.LineInput> lines(
    String text,
    Map<String, Id> products
  ) {
    List<RevquilaPricing.LineInput> inputs = new List<RevquilaPricing.LineInput>();
    for (String part : text.split(', ')) {
      List<String> words = part.split(' ');
      RevquilaPricing.LineInput input = new RevquilaPricing.LineInput();
      input.productId = products.get(code(words[0]));
      input.qty = Decimal.valueOf(words[1]);
      input.discount = words.size() > 2 ? Decimal.valueOf(words[2]) : 0;
      inputs.add(input);
    }
    return inputs;
  }

  private static Map<Id, RevquilaPricing.Product> catalogue(
    Map<String, Id> products
  ) {
    Map<Id, RevquilaPricing.Product> byId = new Map<Id, RevquilaPricing.Product>();
    for (
      RevquilaPricing.Product product : RevquilaPricing.products(
        new Set<Id>(products.values())
      )
    ) {
      byId.put(product.id, product);
    }
    return byId;
  }

  private static void stamp(SObject record, RevquilaPricing.Totals totals) {
    record.put('Subtotal__c', totals.subtotal);
    record.put('Discount_Total__c', totals.discountTotal);
    record.put('Net_Amount__c', totals.net);
    record.put('Tax_Amount__c', totals.tax);
    record.put('Total__c', totals.total);
    record.put('Tax_Breakup__c', JSON.serialize(totals.taxLines));
    if (record instanceof Quote__c) {
      record.put('Max_Discount__c', totals.maxDiscount);
      record.put('Policy_Issue__c', totals.policyIssue);
    }
  }

  private static Revenue_Event__c at(
    Id parentId,
    String title,
    String detail,
    String tone,
    Datetime occurredOn
  ) {
    Revenue_Event__c entry = RevquilaCore.event(parentId, title, detail, tone);
    // never in the future, however the demo dates fall
    entry.Occurred_On__c = occurredOn > System.now()
      ? System.now()
      : occurredOn;
    return entry;
  }

  private static Datetime atNoon(Date day) {
    Datetime noon = Datetime.newInstance(day, Time.newInstance(12, 0, 0, 0));
    return noon > System.now() ? System.now() : noon;
  }
}