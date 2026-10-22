/**
 * The product catalog behind the Catalog and Pricing tabs: products with their standard
 * prices and pricing settings, bundles with their features and options, price tiers, price
 * rules, contracted prices and price books. Reading is for every user; changing needs the
 * Revquila Admin permission set, which is what the object permissions say.
 */
public with sharing class RevquilaCatalogController {
  public class Catalog {
    @AuraEnabled
    public List<RevquilaPricing.Product> products;
    @AuraEnabled
    public List<RevquilaPricing.PriceRule> rules;
    @AuraEnabled
    public Boolean canManage;
  }

  /** What the product form sends. */
  public class ProductInput {
    public Id id;
    public String name;
    public String code;
    public String family;
    public String unit;
    public Decimal price;
    public Boolean recurring;
    public Boolean bundle;
    public String description;
    public Decimal cost;
    public String pricingMethod;
    public String billingFrequency;
    public String taxCategory;
    public Integer defaultTermMonths;
    public String usageUnit;
    /** [{name, options: [{label, adjust}]}] as JSON. */
    public String attributes;
    public Decimal percentOfTotal;
    public String revenueMethod;
  }

  public class OptionInput {
    public Id productId;
    public Decimal qty;
    public Boolean required;
    public Boolean selected;
    /** The feature the option belongs to, by the `key` the screen gave the feature. */
    public String featureKey;
  }

  public class FeatureInput {
    public String key;
    public String name;
    public Integer minOptions;
    public Integer maxOptions;
    public String note;
  }

  public class BundleInput {
    public List<FeatureInput> features;
    public List<OptionInput> options;
  }

  public class TierInput {
    public Decimal fromQty;
    public Decimal toQty;
    public Decimal unitPrice;
    public Decimal flatPrice;
  }

  public class RuleInput {
    public Id id;
    public String name;
    public Id productId;
    public Decimal minQty;
    public Decimal discount;
    public Boolean active;
    public String note;
    public String scope;
    public Decimal minTerm;
    public Decimal minAmount;
    public String action;
    public Decimal setPrice;
    public Id addProductId;
    public Decimal addQty;
    public String country;
    public String family;
    public String segment;
    public String conditions;
    public Integer priority;
  }

  public class ContractedInput {
    public Id id;
    public Id accountId;
    public Id productId;
    public Decimal unitPrice;
    public Decimal discount;
    public Date startDate;
    public Date endDate;
    public Boolean active;
    public String note;
  }

  public class BookEntry {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Id productId;
    @AuraEnabled
    public String product;
    @AuraEnabled
    public Decimal price;
    @AuraEnabled
    public Decimal standardPrice;
    @AuraEnabled
    public Boolean active;
  }

  public class PriceBook {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String description;
    @AuraEnabled
    public Boolean active;
    @AuraEnabled
    public Boolean standard;
    @AuraEnabled
    public List<BookEntry> entries = new List<BookEntry>();
  }

  /** Whether the user may add and change products, bundles and price rules. */
  public static Boolean canManage() {
    return Schema.sObjectType.Product2.isCreateable() &&
      Schema.sObjectType.Price_Rule__c.isCreateable();
  }

  private static void needManage() {
    if (!canManage()) {
      throw new RevquilaCore.ProblemException('You need the Revquila Admin permission set to change the catalog.');
    }
  }

  @AuraEnabled
  public static Catalog getCatalog() {
    try {
      Catalog catalog = new Catalog();
      catalog.products = RevquilaPricing.products();
      catalog.rules = new List<RevquilaPricing.PriceRule>();
      for (Price_Rule__c row : [
        SELECT
          Id,
          Name,
          Product__c,
          Product__r.Name,
          Min_Quantity__c,
          Discount__c,
          Active__c,
          Note__c,
          Scope__c,
          Min_Term__c,
          Min_Amount__c,
          Action__c,
          Set_Price__c,
          Add_Product__c,
          Add_Product__r.Name,
          Add_Quantity__c,
          Country__c,
          Family__c,
          Segment__c,
          Conditions__c,
          Priority__c
        FROM Price_Rule__c
        WITH USER_MODE
        ORDER BY Product__r.Name NULLS FIRST, Min_Quantity__c
        LIMIT 500
      ]) {
        catalog.rules.add(RevquilaPricing.ruleView(row));
      }
      catalog.canManage = canManage();
      return catalog;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- products

  /** Creates or changes a product and its standard price. `input` is a ProductInput as JSON. Returns the product's id. */
  @AuraEnabled
  public static Id saveProduct(String input) {
    try {
      ProductInput request = (ProductInput) JSON.deserialize(
        input,
        ProductInput.class
      );
      need(String.isNotBlank(request.name), 'Name the product.');
      need(
        request.price != null && request.price >= 0,
        'Enter the list price, 0 or more.'
      );
      need(request.cost == null || request.cost >= 0, 'The cost is 0 or more.');
      String method = String.isBlank(request.pricingMethod) ? 'unit' : request.pricingMethod;
      need(
        new Set<String>{ 'unit', 'tiered', 'block', 'percent_of_total', 'usage' }.contains(method),
        'Pick how the product is priced.'
      );
      need(
        method != 'percent_of_total' || (request.percentOfTotal != null && request.percentOfTotal > 0 && request.percentOfTotal <= 100),
        'Enter the percent of the other lines, above 0 and up to 100.'
      );
      if (String.isNotBlank(request.attributes)) {
        try {
          JSON.deserializeUntyped(request.attributes);
        } catch (Exception e) {
          throw new RevquilaCore.ProblemException('The configuration choices could not be read.');
        }
      }
      Product2 product = new Product2(
        Name = request.name.trim().abbreviate(255),
        ProductCode = String.isBlank(request.code)
          ? null
          : request.code.trim().abbreviate(255),
        Family = String.isBlank(request.family) ? null : request.family.trim(),
        Description = String.isBlank(request.description) ? null : request.description.trim().abbreviate(4000),
        Unit__c = String.isBlank(request.unit)
          ? null
          : request.unit.trim().abbreviate(80),
        Recurring__c = request.recurring == true || method == 'usage',
        Bundle__c = request.bundle == true,
        Cost__c = request.cost,
        Pricing_Method__c = method,
        Billing_Frequency__c = String.isBlank(request.billingFrequency) ? null : request.billingFrequency,
        Tax_Category__c = String.isBlank(request.taxCategory) ? null : request.taxCategory.trim().abbreviate(80),
        Default_Term_Months__c = request.defaultTermMonths,
        Usage_Unit__c = String.isBlank(request.usageUnit) ? null : request.usageUnit.trim().abbreviate(40),
        Attributes__c = String.isBlank(request.attributes) ? null : request.attributes,
        Percent_Of_Total__c = request.percentOfTotal,
        Revenue_Method__c = String.isBlank(request.revenueMethod) ? null : request.revenueMethod,
        IsActive = true
      );
      if (request.id == null) {
        insert as user product;
      } else {
        product.Id = request.id;
        update as user product;
      }
      Id bookId = RevquilaPricing.standardPriceBookId();
      List<PricebookEntry> entries = [
        SELECT Id
        FROM PricebookEntry
        WHERE Pricebook2Id = :bookId AND Product2Id = :product.Id
        WITH USER_MODE
        LIMIT 1
      ];
      Decimal price = RevquilaCore.money(request.price);
      if (entries.isEmpty()) {
        insert as user new PricebookEntry(
          Pricebook2Id = bookId,
          Product2Id = product.Id,
          UnitPrice = price,
          IsActive = true
        );
      } else {
        update as user new PricebookEntry(
          Id = entries[0].Id,
          UnitPrice = price,
          IsActive = true
        );
      }
      return product.Id;
    } catch (JSONException e) {
      throw RevquilaCore.failure(
        'The product could not be read. Reload the page and try again.'
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Retires a product: it stays on old quotes but cannot be added to new ones. */
  @AuraEnabled
  public static void retireProduct(Id productId) {
    try {
      update as user new Product2(Id = productId, IsActive = false);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- bundles

  /** Replaces the options of a bundle. `input` is a list of OptionInput as JSON. */
  @AuraEnabled
  public static void saveBundleOptions(Id bundleId, String input) {
    try {
      BundleInput bundle = new BundleInput();
      bundle.features = new List<FeatureInput>();
      bundle.options = (List<OptionInput>) JSON.deserialize(
        input,
        List<OptionInput>.class
      );
      replaceBundle(bundleId, bundle);
    } catch (JSONException e) {
      throw RevquilaCore.failure(
        'The bundle could not be read. Reload the page and try again.'
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Replaces a bundle's features (option groups: pick at least / at most) and its options.
   * `input` is a BundleInput as JSON; an option names its feature by the feature's key.
   */
  @AuraEnabled
  public static void saveBundle(Id bundleId, String input) {
    try {
      replaceBundle(bundleId, (BundleInput) JSON.deserialize(input, BundleInput.class));
    } catch (JSONException e) {
      throw RevquilaCore.failure('The bundle could not be read. Reload the page and try again.');
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static void replaceBundle(Id bundleId, BundleInput bundle) {
    needManage();
    List<FeatureInput> features = bundle.features == null ? new List<FeatureInput>() : bundle.features;
    List<OptionInput> options = bundle.options == null ? new List<OptionInput>() : bundle.options;
    Map<String, Integer> optionsPerFeature = new Map<String, Integer>();
    for (OptionInput option : options) {
      need(option.productId != null, 'Pick a product for every option.');
      need(option.productId != bundleId, 'A bundle cannot contain itself.');
      need(
        option.qty != null && option.qty >= 1,
        'Every option needs a quantity of 1 or more.'
      );
      if (String.isNotBlank(option.featureKey)) {
        optionsPerFeature.put(option.featureKey, (optionsPerFeature.containsKey(option.featureKey) ? optionsPerFeature.get(option.featureKey) : 0) + 1);
      }
    }
    List<Bundle_Feature__c> featureRows = new List<Bundle_Feature__c>();
    Integer position = 0;
    for (FeatureInput feature : features) {
      need(String.isNotBlank(feature.name), 'Name every feature.');
      Integer minimum = feature.minOptions == null ? 0 : feature.minOptions;
      Integer maximum = feature.maxOptions == null ? 0 : feature.maxOptions;
      need(minimum >= 0 && maximum >= 0, 'Pick at least and at most are 0 or more.');
      need(maximum == 0 || maximum >= minimum, feature.name + ': "at most" is less than "at least".');
      Integer count = optionsPerFeature.containsKey(feature.key) ? optionsPerFeature.get(feature.key) : 0;
      need(minimum <= count, feature.name + ' asks for ' + minimum + ' but has ' + count + ' options.');
      position++;
      featureRows.add(
        new Bundle_Feature__c(
          Name = feature.name.trim().abbreviate(80),
          Bundle__c = bundleId,
          Min_Options__c = minimum,
          Max_Options__c = maximum,
          Note__c = String.isBlank(feature.note) ? null : feature.note.trim().abbreviate(255),
          Sort_Order__c = position
        )
      );
    }
    delete as user [
      SELECT Id
      FROM Bundle_Option__c
      WHERE Bundle__c = :bundleId
      WITH USER_MODE
    ];
    delete as user [
      SELECT Id
      FROM Bundle_Feature__c
      WHERE Bundle__c = :bundleId
      WITH USER_MODE
    ];
    insert as user featureRows;
    Map<String, Id> featureIds = new Map<String, Id>();
    for (Integer index = 0; index < features.size(); index++) {
      if (String.isNotBlank(features[index].key)) {
        featureIds.put(features[index].key, featureRows[index].Id);
      }
    }
    List<Bundle_Option__c> rows = new List<Bundle_Option__c>();
    position = 0;
    for (OptionInput option : options) {
      position++;
      rows.add(
        new Bundle_Option__c(
          Bundle__c = bundleId,
          Product__c = option.productId,
          Quantity__c = option.qty,
          Required__c = option.required == true,
          Selected__c = option.selected != false,
          Feature__c = String.isBlank(option.featureKey) ? null : featureIds.get(option.featureKey),
          Sort_Order__c = position
        )
      );
    }
    insert as user rows;
  }

  // ---------------------------------------------------------------- tiers

  /** Replaces the price tiers of a tiered or block product. `input` is a list of TierInput as JSON. */
  @AuraEnabled
  public static void saveTiers(Id productId, String input) {
    try {
      needManage();
      List<TierInput> tiers = (List<TierInput>) JSON.deserialize(input, List<TierInput>.class);
      List<Price_Tier__c> rows = new List<Price_Tier__c>();
      Decimal lastTo = 0;
      Integer position = 0;
      for (TierInput tier : tiers) {
        position++;
        need(tier.fromQty != null && tier.fromQty >= 1, 'Tier ' + position + ': "from" is 1 or more.');
        need(tier.toQty == null || tier.toQty >= tier.fromQty, 'Tier ' + position + ': "to" is below "from".');
        need(tier.fromQty > lastTo, 'Tier ' + position + ' overlaps the one before it.');
        need(
          (tier.unitPrice != null && tier.unitPrice >= 0) || (tier.flatPrice != null && tier.flatPrice >= 0),
          'Tier ' + position + ': enter a unit price or a flat price.'
        );
        need(tier.toQty != null || position == tiers.size(), 'Only the last tier can have no upper bound.');
        lastTo = tier.toQty == null ? tier.fromQty : tier.toQty;
        rows.add(
          new Price_Tier__c(
            Product__c = productId,
            From_Quantity__c = tier.fromQty,
            To_Quantity__c = tier.toQty,
            Unit_Price__c = tier.unitPrice,
            Flat_Price__c = tier.flatPrice,
            Sort_Order__c = position
          )
        );
      }
      delete as user [SELECT Id FROM Price_Tier__c WHERE Product__c = :productId WITH USER_MODE];
      insert as user rows;
    } catch (JSONException e) {
      throw RevquilaCore.failure('The tiers could not be read. Reload the page and try again.');
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- price rules

  /** Creates or changes a price rule. `input` is a RuleInput as JSON. Returns the rule's id. */
  @AuraEnabled
  public static Id savePriceRule(String input) {
    try {
      RuleInput request = (RuleInput) JSON.deserialize(input, RuleInput.class);
      need(String.isNotBlank(request.name), 'Name the rule.');
      String scope = String.isBlank(request.scope) ? 'quantity' : request.scope;
      String action = String.isBlank(request.action) ? 'discount' : request.action;
      need(new Set<String>{ 'quantity', 'term', 'amount' }.contains(scope), 'Pick what the rule counts.');
      need(new Set<String>{ 'discount', 'set_price', 'add_product' }.contains(action), 'Pick what the rule does.');
      if (scope == 'quantity') {
        need(request.minQty != null && request.minQty >= 1, 'The quantity must be 1 or more.');
      } else if (scope == 'term') {
        need(request.minTerm != null && request.minTerm >= 1, 'The term must be 1 month or more.');
      } else {
        need(request.minAmount != null && request.minAmount > 0, 'The amount must be above 0.');
      }
      if (action == 'discount') {
        need(
          request.discount != null &&
            request.discount > 0 &&
            request.discount <= 100,
          'The discount must be above 0 and up to 100.'
        );
      } else if (action == 'set_price') {
        need(request.setPrice != null && request.setPrice >= 0, 'Enter the price to set, 0 or more.');
      } else {
        need(request.addProductId != null, 'Pick the product to add.');
      }
      if (String.isNotBlank(request.conditions)) {
        try {
          JSON.deserialize(request.conditions, List<RevquilaSettings.Condition>.class);
        } catch (Exception e) {
          throw new RevquilaCore.ProblemException('The conditions could not be read.');
        }
      }
      Price_Rule__c rule = new Price_Rule__c(
        Name = request.name.trim().abbreviate(80),
        Product__c = request.productId,
        Min_Quantity__c = scope == 'quantity' ? request.minQty : 1,
        Discount__c = action == 'discount' ? request.discount : null,
        Active__c = request.active != false,
        Note__c = String.isBlank(request.note)
          ? null
          : request.note.trim().abbreviate(255),
        Scope__c = scope,
        Min_Term__c = scope == 'term' ? request.minTerm : null,
        Min_Amount__c = scope == 'amount' ? request.minAmount : null,
        Action__c = action,
        Set_Price__c = action == 'set_price' ? request.setPrice : null,
        Add_Product__c = action == 'add_product' ? request.addProductId : null,
        Add_Quantity__c = action == 'add_product' ? (request.addQty == null || request.addQty < 1 ? 1 : request.addQty) : null,
        Country__c = String.isBlank(request.country) ? null : request.country.trim().abbreviate(80),
        Family__c = String.isBlank(request.family) ? null : request.family.trim().abbreviate(80),
        Segment__c = String.isBlank(request.segment) ? null : request.segment.trim().abbreviate(40),
        Conditions__c = String.isBlank(request.conditions) ? null : request.conditions,
        Priority__c = request.priority == null ? 100 : request.priority
      );
      if (request.id == null) {
        insert as user rule;
      } else {
        rule.Id = request.id;
        update as user rule;
      }
      return rule.Id;
    } catch (JSONException e) {
      throw RevquilaCore.failure(
        'The rule could not be read. Reload the page and try again.'
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  @AuraEnabled
  public static void deletePriceRule(Id ruleId) {
    try {
      delete as user new Price_Rule__c(Id = ruleId);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- contracted prices

  /** Every contracted price, by account then product. */
  @AuraEnabled
  public static List<RevquilaPricing.ContractedPrice> getContractedPrices() {
    try {
      List<RevquilaPricing.ContractedPrice> prices = new List<RevquilaPricing.ContractedPrice>();
      for (Contracted_Price__c row : [
        SELECT Id, Account__c, Account__r.Name, Product__c, Product__r.Name, Unit_Price__c, Discount__c,
          Start_Date__c, End_Date__c, Active__c, Note__c
        FROM Contracted_Price__c
        WITH USER_MODE
        ORDER BY Account__r.Name, Product__r.Name
        LIMIT 1000
      ]) {
        prices.add(RevquilaPricing.contractedView(row));
      }
      return prices;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Creates or changes a contracted price. `input` is a ContractedInput as JSON. Returns its id. */
  @AuraEnabled
  public static Id saveContractedPrice(String input) {
    try {
      ContractedInput request = (ContractedInput) JSON.deserialize(input, ContractedInput.class);
      need(request.accountId != null, 'Pick the account.');
      need(request.productId != null, 'Pick the product.');
      need(
        (request.unitPrice != null && request.unitPrice >= 0) || (request.discount != null && request.discount > 0 && request.discount <= 100),
        'Enter the agreed unit price, or a discount above 0 and up to 100.'
      );
      need(request.startDate == null || request.endDate == null || request.endDate >= request.startDate, '"Until" is before "from".');
      Contracted_Price__c row = new Contracted_Price__c(
        Account__c = request.accountId,
        Product__c = request.productId,
        Unit_Price__c = request.unitPrice,
        Discount__c = request.unitPrice != null ? null : request.discount,
        Start_Date__c = request.startDate,
        End_Date__c = request.endDate,
        Active__c = request.active != false,
        Note__c = String.isBlank(request.note) ? null : request.note.trim().abbreviate(255)
      );
      if (request.id == null) {
        insert as user row;
      } else {
        row.Id = request.id;
        update as user row;
      }
      return row.Id;
    } catch (JSONException e) {
      throw RevquilaCore.failure('The price could not be read. Reload the page and try again.');
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  @AuraEnabled
  public static void deleteContractedPrice(Id priceId) {
    try {
      delete as user new Contracted_Price__c(Id = priceId);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- price books

  /** The price books other than the standard one, each with its entries beside the standard price. */
  @AuraEnabled
  public static List<PriceBook> getPriceBooks() {
    try {
      Map<Id, Decimal> standard = new Map<Id, Decimal>();
      for (RevquilaPricing.Product product : RevquilaPricing.products()) {
        standard.put(product.id, product.price);
      }
      Map<Id, PriceBook> books = new Map<Id, PriceBook>();
      for (Pricebook2 row : [
        SELECT Id, Name, Description, IsActive, IsStandard
        FROM Pricebook2
        WHERE IsStandard = FALSE
        WITH USER_MODE
        ORDER BY Name
        LIMIT 200
      ]) {
        PriceBook book = new PriceBook();
        book.id = row.Id;
        book.name = row.Name;
        book.description = row.Description;
        book.active = row.IsActive;
        book.standard = row.IsStandard;
        books.put(row.Id, book);
      }
      if (!books.isEmpty()) {
        for (PricebookEntry row : [
          SELECT Id, Pricebook2Id, Product2Id, Product2.Name, UnitPrice, IsActive
          FROM PricebookEntry
          WHERE Pricebook2Id IN :books.keySet()
          WITH USER_MODE
          ORDER BY Product2.Name
          LIMIT 5000
        ]) {
          BookEntry entry = new BookEntry();
          entry.id = row.Id;
          entry.productId = row.Product2Id;
          entry.product = row.Product2.Name;
          entry.price = row.UnitPrice;
          entry.standardPrice = standard.get(row.Product2Id);
          entry.active = row.IsActive;
          books.get(row.Pricebook2Id).entries.add(entry);
        }
      }
      return books.values();
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Creates or renames a price book, or turns it on or off. Returns its id. */
  @AuraEnabled
  public static Id savePriceBook(Id bookId, String name, String description, Boolean active) {
    try {
      needManage();
      need(String.isNotBlank(name), 'Name the price book.');
      Pricebook2 book = new Pricebook2(
        Name = name.trim().abbreviate(255),
        Description = String.isBlank(description) ? null : description.trim().abbreviate(255),
        IsActive = active != false
      );
      if (bookId == null) {
        insert as user book;
      } else {
        book.Id = bookId;
        update as user book;
      }
      return book.Id;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Sets a product's price in a price book, or takes it out when `price` is empty. */
  @AuraEnabled
  public static void savePriceBookEntry(Id bookId, Id productId, Decimal price) {
    try {
      needManage();
      need(bookId != null && productId != null, 'Pick the price book and the product.');
      List<PricebookEntry> entries = [
        SELECT Id
        FROM PricebookEntry
        WHERE Pricebook2Id = :bookId AND Product2Id = :productId
        WITH USER_MODE
        LIMIT 1
      ];
      if (price == null) {
        if (!entries.isEmpty()) {
          update as user new PricebookEntry(Id = entries[0].Id, IsActive = false);
        }
        return;
      }
      need(price >= 0, 'The price is 0 or more.');
      if (entries.isEmpty()) {
        insert as user new PricebookEntry(Pricebook2Id = bookId, Product2Id = productId, UnitPrice = RevquilaCore.money(price), IsActive = true);
      } else {
        update as user new PricebookEntry(Id = entries[0].Id, UnitPrice = RevquilaCore.money(price), IsActive = true);
      }
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Gives an account its own price book, or takes it away when `bookId` is empty. */
  @AuraEnabled
  public static void setAccountPriceBook(Id accountId, Id bookId) {
    try {
      needManage();
      update as user new Account(Id = accountId, Price_Book__c = bookId);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static void need(Boolean condition, String message) {
    if (condition != true) {
      throw new RevquilaCore.ProblemException(message);
    }
  }
}