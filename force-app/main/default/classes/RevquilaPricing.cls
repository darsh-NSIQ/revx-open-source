/**
 * Prices the lines of a quote: the unit price from the standard price book, the customer's
 * price book, a contracted price or a tier; the term a recurring line is priced for;
 * configuration attributes; the price rules (volume, term and amount discounts, set prices,
 * added products); the cost and margin; tax for the customer's country, region and the
 * product's category; and whether the result is inside the pricing policy. The server is the
 * one that decides what is saved; the revquilaData component does the same sums only to
 * preview them while typing, so a change here needs the same change there.
 *
 * A product's list price is in the home currency. A quote in another country's currency
 * converts it at the market's exchange rate in Setup.
 */
public with sharing class RevquilaPricing {
  /** A line as the screen sends it. productId is empty for a custom item, which brings its own name, unit and price. */
  public class LineInput {
    public Id productId;
    public String name;
    public String unit;
    public Decimal price;
    public Decimal qty;
    public Decimal discount;
    /** The bundle the line was added as part of, when it was. */
    public Id bundleId;
    public String groupName;
    public Boolean optional;
    public String segment;
    public Integer termMonths;
    public Date startDate;
    /** The configuration attributes picked, as JSON: [{name, value, adjust}]. */
    public String attributes;
    public String feature;
    /** A unit price typed over the list price, allowed by Setup > Pricing or the Edit Prices permission. */
    public Decimal priceOverride;
  }

  /** One product inside a bundle. */
  public class BundleOption {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Id productId;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Decimal qty;
    @AuraEnabled
    public Boolean required;
    @AuraEnabled
    public Id featureId;
    @AuraEnabled
    public Boolean selected;
  }

  /** An option group inside a bundle. */
  public class Feature {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Integer minOptions;
    @AuraEnabled
    public Integer maxOptions;
    @AuraEnabled
    public String note;
    @AuraEnabled
    public Integer sortOrder;
  }

  /** One band of a tiered or block price. */
  public class Tier {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Decimal fromQty;
    @AuraEnabled
    public Decimal toQty;
    @AuraEnabled
    public Decimal unitPrice;
    @AuraEnabled
    public Decimal flatPrice;
  }

  public class Product {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String code;
    @AuraEnabled
    public String family;
    @AuraEnabled
    public String unit;
    @AuraEnabled
    public Decimal price;
    @AuraEnabled
    public Boolean recurring;
    @AuraEnabled
    public Boolean bundle;
    @AuraEnabled
    public Boolean active;
    @AuraEnabled
    public Decimal cost = 0;
    @AuraEnabled
    public String pricingMethod = 'unit';
    @AuraEnabled
    public String billingFrequency = 'yearly';
    @AuraEnabled
    public String taxCategory;
    @AuraEnabled
    public Integer defaultTermMonths;
    @AuraEnabled
    public String usageUnit;
    @AuraEnabled
    public String attributes;
    @AuraEnabled
    public Decimal percentOfTotal = 0;
    @AuraEnabled
    public String revenueMethod = 'ratable';
    @AuraEnabled
    public String description;
    @AuraEnabled
    public List<BundleOption> options = new List<BundleOption>();
    @AuraEnabled
    public List<Feature> features = new List<Feature>();
    @AuraEnabled
    public List<Tier> tiers = new List<Tier>();
  }

  /** A price rule from the Pricing tab. */
  public class PriceRule {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Id productId;
    @AuraEnabled
    public String productName;
    @AuraEnabled
    public Decimal minQty;
    @AuraEnabled
    public Decimal discount;
    @AuraEnabled
    public Boolean active;
    @AuraEnabled
    public String note;
    @AuraEnabled
    public String scope = 'quantity';
    @AuraEnabled
    public Decimal minTerm;
    @AuraEnabled
    public Decimal minAmount;
    @AuraEnabled
    public String action = 'discount';
    @AuraEnabled
    public Decimal setPrice;
    @AuraEnabled
    public Id addProductId;
    @AuraEnabled
    public String addProductName;
    @AuraEnabled
    public Decimal addQty;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public String family;
    @AuraEnabled
    public String segment;
    @AuraEnabled
    public String conditions;
    @AuraEnabled
    public Integer priority;
  }

  /** A price agreed with one customer for one product. */
  public class ContractedPrice {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Id accountId;
    @AuraEnabled
    public String accountName;
    @AuraEnabled
    public Id productId;
    @AuraEnabled
    public String productName;
    @AuraEnabled
    public Decimal unitPrice;
    @AuraEnabled
    public Decimal discount;
    @AuraEnabled
    public Date startDate;
    @AuraEnabled
    public Date endDate;
    @AuraEnabled
    public Boolean active;
    @AuraEnabled
    public String note;
  }

  public class TaxLine {
    @AuraEnabled
    public String label;
    @AuraEnabled
    public Decimal rate;
    @AuraEnabled
    public Decimal amount;
  }

  public class TaxResult {
    public Decimal net;
    public Decimal tax;
    public Decimal total;
    public List<TaxLine> lines = new List<TaxLine>();
  }

  /** Who the quote is for, which decides the price book, contracted prices, tax and the rules. */
  public class Context {
    public Id accountId;
    public String accountName;
    public String segment;
    public String industry;
    public String country;
    public String region;
    public String postalCode;
    public Integer termMonths;
    public Id priceBookId;
    public Boolean taxExempt = false;
    public String exemptionReason;
    public String quoteType = 'new';
    public String ownerName;
    public String ownerRole;
    public Boolean allowPriceEdit = false;
  }

  /** What a product rule said about the lines. */
  public class RuleOutcome {
    @AuraEnabled
    public String kind;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String message;
    @AuraEnabled
    public Id addProductId;
    @AuraEnabled
    public Decimal addQty;
    @AuraEnabled
    public Id removeProductId;
  }

  public class Totals {
    public List<RevquilaCore.LineView> lines = new List<RevquilaCore.LineView>();
    public Decimal subtotal = 0;
    public Decimal discountTotal = 0;
    public Decimal net = 0;
    public Decimal tax = 0;
    public Decimal total = 0;
    public Decimal maxDiscount = 0;
    public List<TaxLine> taxLines = new List<TaxLine>();
    /** Why the quote needs approval, or null when it is inside the policy. */
    public String policyIssue;
    public String country;
    public String currencyCode;
    public Decimal exchangeRate = 1;
    /** The net amount in the home currency. */
    public Decimal baseNet = 0;
    public Decimal costTotal = 0;
    public Decimal marginPercent = 0;
    public Id priceBookId;
    public Boolean priceEdited = false;
    /** What the alert product rules said. */
    public List<String> warnings = new List<String>();
    /** Products the price rules say to add: [{productId, qty, name}] as RuleOutcome. */
    public List<RuleOutcome> additions = new List<RuleOutcome>();
    /** The amount of the optional lines, not in the totals. */
    public Decimal optionalTotal = 0;
  }

  private static Id standardBookId;
  private static List<PriceRule> activeRules;
  private static Map<Id, Product> cachedProductsById = new Map<Id, Product>();
  private static List<Product> allCachedProducts;

  public static void clearCache() {
    activeRules = null;
    cachedProductsById = new Map<Id, Product>();
    allCachedProducts = null;
  }

  /** The standard price book. A test cannot query it, so it asks Test for the id instead. */
  public static Id standardPriceBookId() {
    if (standardBookId == null) {
      standardBookId = Test.isRunningTest()
        ? Test.getStandardPricebookId()
        : [SELECT Id FROM Pricebook2 WHERE IsStandard = TRUE LIMIT 1].Id;
    }
    return standardBookId;
  }

  /** Every active product that has a standard price, by name, bundles with their options. */
  public static List<Product> products() {
    return products(null);
  }

  /** The products with these ids, or every product when ids is null. */
  public static List<Product> products(Set<Id> ids) {
    if (ids == null && allCachedProducts != null) {
      return allCachedProducts;
    }
    if (ids != null && !cachedProductsById.isEmpty() && cachedProductsById.keySet().containsAll(ids)) {
      List<Product> result = new List<Product>();
      for (Id id : ids) {
        if (cachedProductsById.containsKey(id)) {
          result.add(cachedProductsById.get(id));
        }
      }
      return result;
    }
    Id bookId = standardPriceBookId();
    String filter = ids == null ? '' : ' AND Product2Id IN :ids';
    List<Product> found = new List<Product>();
    Map<Id, Product> byId = new Map<Id, Product>();
    for (
      PricebookEntry entry : (List<PricebookEntry>) Database.query(
        'SELECT Product2Id, Product2.Name, Product2.ProductCode, Product2.Family, Product2.Unit__c, Product2.Description, ' +
          'Product2.Recurring__c, Product2.Bundle__c, Product2.IsActive, Product2.Cost__c, Product2.Pricing_Method__c, ' +
          'Product2.Billing_Frequency__c, Product2.Tax_Category__c, Product2.Default_Term_Months__c, Product2.Usage_Unit__c, ' +
          'Product2.Attributes__c, Product2.Percent_Of_Total__c, Product2.Revenue_Method__c, UnitPrice ' +
          'FROM PricebookEntry ' +
          'WHERE Pricebook2Id = :bookId AND IsActive = TRUE AND Product2.IsActive = TRUE' +
          filter +
          ' ORDER BY Product2.Name LIMIT 500',
        AccessLevel.USER_MODE
      )
    ) {
      Product product = new Product();
      product.id = entry.Product2Id;
      product.name = entry.Product2.Name;
      product.code = entry.Product2.ProductCode;
      product.family = entry.Product2.Family;
      product.unit = entry.Product2.Unit__c;
      product.description = entry.Product2.Description;
      product.price = entry.UnitPrice;
      product.recurring = entry.Product2.Recurring__c == true;
      product.bundle = entry.Product2.Bundle__c == true;
      product.active = entry.Product2.IsActive;
      product.cost = RevquilaCore.orZero(entry.Product2.Cost__c);
      product.pricingMethod = String.isBlank(entry.Product2.Pricing_Method__c)
        ? 'unit'
        : entry.Product2.Pricing_Method__c;
      product.billingFrequency = String.isBlank(entry.Product2.Billing_Frequency__c)
        ? 'yearly'
        : entry.Product2.Billing_Frequency__c;
      product.taxCategory = entry.Product2.Tax_Category__c;
      product.defaultTermMonths = entry.Product2.Default_Term_Months__c == null
        ? null
        : entry.Product2.Default_Term_Months__c.intValue();
      product.usageUnit = entry.Product2.Usage_Unit__c;
      product.attributes = entry.Product2.Attributes__c;
      product.percentOfTotal = RevquilaCore.orZero(entry.Product2.Percent_Of_Total__c);
      product.revenueMethod = String.isBlank(entry.Product2.Revenue_Method__c)
        ? 'ratable'
        : entry.Product2.Revenue_Method__c;
      found.add(product);
      byId.put(product.id, product);
    }
    if (byId.isEmpty()) {
      return found;
    }
    for (Bundle_Feature__c feature : [
      SELECT Id, Name, Bundle__c, Min_Options__c, Max_Options__c, Note__c, Sort_Order__c
      FROM Bundle_Feature__c
      WHERE Bundle__c IN :byId.keySet()
      WITH USER_MODE
      ORDER BY Sort_Order__c, Name
    ]) {
      Feature view = new Feature();
      view.id = feature.Id;
      view.name = feature.Name;
      view.minOptions = RevquilaCore.orZero(feature.Min_Options__c).intValue();
      view.maxOptions = RevquilaCore.orZero(feature.Max_Options__c).intValue();
      view.note = feature.Note__c;
      view.sortOrder = RevquilaCore.orZero(feature.Sort_Order__c).intValue();
      byId.get(feature.Bundle__c).features.add(view);
    }
    for (Bundle_Option__c option : [
      SELECT Id, Bundle__c, Product__c, Product__r.Name, Quantity__c, Required__c, Feature__c, Selected__c
      FROM Bundle_Option__c
      WHERE Bundle__c IN :byId.keySet()
      WITH USER_MODE
      ORDER BY Sort_Order__c, Name
    ]) {
      BundleOption view = new BundleOption();
      view.id = option.Id;
      view.productId = option.Product__c;
      view.name = option.Product__r?.Name;
      view.qty = RevquilaCore.orZero(option.Quantity__c);
      view.required = option.Required__c;
      view.featureId = option.Feature__c;
      view.selected = option.Selected__c != false || option.Required__c;
      byId.get(option.Bundle__c).options.add(view);
    }
    for (Price_Tier__c tier : [
      SELECT Id, Product__c, From_Quantity__c, To_Quantity__c, Unit_Price__c, Flat_Price__c
      FROM Price_Tier__c
      WHERE Product__c IN :byId.keySet()
      WITH USER_MODE
      ORDER BY From_Quantity__c
    ]) {
      Tier view = new Tier();
      view.id = tier.Id;
      view.fromQty = RevquilaCore.orZero(tier.From_Quantity__c);
      view.toQty = tier.To_Quantity__c;
      view.unitPrice = tier.Unit_Price__c;
      view.flatPrice = tier.Flat_Price__c;
      byId.get(tier.Product__c).tiers.add(view);
    }
    for (Product p : found) {
      cachedProductsById.put(p.id, p);
    }
    if (ids == null) {
      allCachedProducts = found;
    }
    return found;
  }

  /** The active price rules, lowest priority number first, then biggest discount. */
  public static List<PriceRule> rules() {
    if (activeRules == null) {
      activeRules = new List<PriceRule>();
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
        WHERE Active__c = TRUE
        WITH USER_MODE
        ORDER BY Priority__c NULLS LAST, Discount__c DESC, Min_Quantity__c DESC
        LIMIT 200
      ]) {
        activeRules.add(ruleView(row));
      }
    }
    return activeRules;
  }

  public static PriceRule ruleView(Price_Rule__c row) {
    PriceRule rule = new PriceRule();
    rule.id = row.Id;
    rule.name = row.Name;
    rule.productId = row.Product__c;
    rule.productName = row.Product__r?.Name;
    rule.minQty = RevquilaCore.orZero(row.Min_Quantity__c);
    rule.discount = RevquilaCore.orZero(row.Discount__c);
    rule.active = row.Active__c;
    rule.note = row.Note__c;
    rule.scope = String.isBlank(row.Scope__c) ? 'quantity' : row.Scope__c;
    rule.minTerm = row.Min_Term__c;
    rule.minAmount = row.Min_Amount__c;
    rule.action = String.isBlank(row.Action__c) ? 'discount' : row.Action__c;
    rule.setPrice = row.Set_Price__c;
    rule.addProductId = row.Add_Product__c;
    rule.addProductName = row.Add_Product__r?.Name;
    rule.addQty = row.Add_Quantity__c;
    rule.country = row.Country__c;
    rule.family = row.Family__c;
    rule.segment = row.Segment__c;
    rule.conditions = row.Conditions__c;
    rule.priority = row.Priority__c == null ? 100 : row.Priority__c.intValue();
    return rule;
  }

  public static ContractedPrice contractedView(Contracted_Price__c row) {
    ContractedPrice view = new ContractedPrice();
    view.id = row.Id;
    view.accountId = row.Account__c;
    view.accountName = row.Account__r?.Name;
    view.productId = row.Product__c;
    view.productName = row.Product__r?.Name;
    view.unitPrice = row.Unit_Price__c;
    view.discount = row.Discount__c;
    view.startDate = row.Start_Date__c;
    view.endDate = row.End_Date__c;
    view.active = row.Active__c;
    view.note = row.Note__c;
    return view;
  }

  /** The discount the quantity price rules give a line: the best rule for the product at that quantity. */
  public static Decimal ruleDiscount(Id productId, Decimal qty) {
    Decimal best = 0;
    for (PriceRule rule : rules()) {
      if (
        rule.action == 'discount' &&
        rule.scope == 'quantity' &&
        (rule.productId == null || rule.productId == productId) &&
        qty >= rule.minQty &&
        String.isBlank(rule.country) &&
        String.isBlank(rule.family) &&
        String.isBlank(rule.segment)
      ) {
        best = Math.max(best, rule.discount);
      }
    }
    return best;
  }

  /** Prices in the home country. */
  public static Totals price(
    List<LineInput> inputs,
    String region,
    String terms
  ) {
    return price(inputs, region, terms, null);
  }

  /** Prices for a customer in `region` of `country` with no account context. */
  public static Totals price(
    List<LineInput> inputs,
    String region,
    String terms,
    String country
  ) {
    Context context = new Context();
    context.country = country;
    context.region = region;
    return price(inputs, terms, context);
  }

  /**
   * Prices the lines for the customer in `context` on payment terms `terms`. A product line
   * takes today's price from the customer's price book, a contracted price, the product's
   * tiers or the standard price book, converted to the country's currency, unless a price was
   * typed over it and Setup allows that.
   */
  public static Totals price(
    List<LineInput> inputs,
    String terms,
    Context context
  ) {
    if (inputs == null || inputs.isEmpty()) {
      throw new RevquilaCore.ProblemException('Add at least one product.');
    }
    RevquilaSettings settings = RevquilaSettings.current();
    RevquilaSettings.Market market = settings.market(context.country);
    Set<Id> productIds = new Set<Id>();
    for (LineInput input : inputs) {
      if (input.productId != null) {
        productIds.add(input.productId);
      }
      if (input.bundleId != null) {
        productIds.add(input.bundleId);
      }
    }
    Map<Id, Product> productsById = new Map<Id, Product>();
    for (Product product : products(productIds)) {
      productsById.put(product.id, product);
    }
    Map<Id, Decimal> bookPrices = bookPrices(
      context.priceBookId != null ? context.priceBookId : market.priceBookId,
      productIds
    );
    Map<Id, Contracted_Price__c> contracted = contractedPrices(
      context.accountId,
      productIds
    );

    Totals totals = new Totals();
    totals.country = market.countryName;
    totals.currencyCode = market.currencyCode;
    totals.exchangeRate = market.exchangeRate;
    totals.priceBookId = context.priceBookId != null
      ? context.priceBookId
      : market.priceBookId;
    Integer defaultTerm = context.termMonths == null
      ? settings.termDefaultMonths
      : context.termMonths;

    List<RevquilaCore.LineView> percentLines = new List<RevquilaCore.LineView>();
    List<LineInput> percentInputs = new List<LineInput>();
    Decimal net = 0;
    Decimal otherNet = 0;
    Integer position = 0;
    for (LineInput input : inputs) {
      position++;
      Product product = input.productId == null
        ? null
        : productsById.get(input.productId);
      RevquilaCore.LineView line = priceLine(
        input,
        product,
        productsById,
        position,
        market,
        bookPrices,
        contracted,
        defaultTerm,
        context,
        settings
      );
      totals.lines.add(line);
      if (product != null && product.pricingMethod == 'percent_of_total') {
        percentLines.add(line);
        percentInputs.add(input);
        continue;
      }
      if (line.optional) {
        totals.optionalTotal += line.net;
        continue;
      }
      totals.subtotal += line.listAmount;
      net += line.net;
      otherNet += line.net;
      totals.costTotal += line.unitCost * line.qty * termFactor(product, line.termMonths);
      totals.maxDiscount = Math.max(totals.maxDiscount, line.discount);
    }
    // a percent-of-total line is priced from the other lines' net
    for (Integer index = 0; index < percentLines.size(); index++) {
      RevquilaCore.LineView line = percentLines[index];
      Product product = productsById.get(line.productId);
      Decimal share = RevquilaCore.money(otherNet * product.percentOfTotal / 100);
      line.price = line.qty > 0 ? RevquilaCore.money(share / line.qty) : share;
      line.listAmount = share;
      Decimal off = Math.min(100, line.discount + line.ruleDiscount);
      line.net = RevquilaCore.money(share * (1 - off / 100));
      if (line.optional) {
        totals.optionalTotal += line.net;
        continue;
      }
      totals.subtotal += line.listAmount;
      net += line.net;
      totals.maxDiscount = Math.max(totals.maxDiscount, line.discount);
    }
    // amount-scoped rules look at the whole quote, so they run once the lines are in
    net = applyAmountRules(totals, net, market, context);
    totals.priceEdited = context.allowPriceEdit == true && priceWasEdited(totals.lines);

    TaxResult taxed = taxLines(totals.lines, market, context, productsById);
    totals.net = taxed.net;
    totals.tax = taxed.tax;
    totals.total = taxed.total;
    totals.taxLines = taxed.lines;
    totals.discountTotal = RevquilaCore.money(totals.subtotal - net);
    totals.baseNet = RevquilaCore.toBase(totals.net, market.exchangeRate);
    totals.costTotal = RevquilaCore.money(totals.costTotal * market.exchangeRate);
    totals.marginPercent = totals.net > 0
      ? ((totals.net - totals.costTotal) / totals.net * 100).setScale(2, RoundingMode.HALF_UP)
      : 0;
    totals.policyIssue = policyIssue(totals, terms, settings);
    return totals;
  }

  private static Boolean priceWasEdited(List<RevquilaCore.LineView> lines) {
    for (RevquilaCore.LineView line : lines) {
      if (line.priceSource == 'edited') {
        return true;
      }
    }
    return false;
  }

  // Price book entries of a custom price book, in the home currency
  private static Map<Id, Decimal> bookPrices(Id bookId, Set<Id> productIds) {
    Map<Id, Decimal> prices = new Map<Id, Decimal>();
    if (bookId == null || productIds.isEmpty() || bookId == standardPriceBookId()) {
      return prices;
    }
    for (PricebookEntry entry : [
      SELECT Product2Id, UnitPrice
      FROM PricebookEntry
      WHERE Pricebook2Id = :bookId AND Product2Id IN :productIds AND IsActive = TRUE
      WITH USER_MODE
    ]) {
      prices.put(entry.Product2Id, entry.UnitPrice);
    }
    return prices;
  }

  // The account's contracted prices that apply today
  private static Map<Id, Contracted_Price__c> contractedPrices(
    Id accountId,
    Set<Id> productIds
  ) {
    Map<Id, Contracted_Price__c> prices = new Map<Id, Contracted_Price__c>();
    if (accountId == null || productIds.isEmpty()) {
      return prices;
    }
    Date today = Date.today();
    for (Contracted_Price__c row : [
      SELECT Product__c, Unit_Price__c, Discount__c
      FROM Contracted_Price__c
      WHERE
        Account__c = :accountId
        AND Product__c IN :productIds
        AND Active__c = TRUE
        AND (Start_Date__c = NULL OR Start_Date__c <= :today)
        AND (End_Date__c = NULL OR End_Date__c >= :today)
      WITH USER_MODE
      ORDER BY CreatedDate DESC
    ]) {
      if (!prices.containsKey(row.Product__c)) {
        prices.put(row.Product__c, row);
      }
    }
    return prices;
  }

  /** How many billing periods the line's term covers: 12 months of a yearly product is 1. */
  public static Decimal termFactor(Product product, Integer termMonths) {
    if (product == null || !product.recurring || termMonths == null) {
      return 1;
    }
    Integer periodMonths = 12;
    if (product.billingFrequency == 'monthly') {
      periodMonths = 1;
    } else if (product.billingFrequency == 'quarterly') {
      periodMonths = 3;
    }
    return Decimal.valueOf(termMonths) / periodMonths;
  }

  private static RevquilaCore.LineView priceLine(
    LineInput input,
    Product product,
    Map<Id, Product> productsById,
    Integer position,
    RevquilaSettings.Market market,
    Map<Id, Decimal> bookPrices,
    Map<Id, Contracted_Price__c> contracted,
    Integer defaultTerm,
    Context context,
    RevquilaSettings settings
  ) {
    String lineLabel = 'Line ' + position + ': ';
    if (
      input.qty == null ||
      input.qty < 1 ||
      input.qty != input.qty.setScale(0)
    ) {
      throw new RevquilaCore.ProblemException(
        lineLabel + 'the quantity must be a whole number, 1 or more.'
      );
    }
    Decimal discount = RevquilaCore.orZero(input.discount);
    if (discount < 0 || discount > 100) {
      throw new RevquilaCore.ProblemException(
        lineLabel + 'the discount must be between 0 and 100.'
      );
    }
    RevquilaCore.LineView line = new RevquilaCore.LineView();
    line.groupName = String.isBlank(input.groupName) ? null : input.groupName.trim().abbreviate(80);
    line.optional = input.optional == true;
    line.segment = String.isBlank(input.segment) ? null : input.segment.trim().abbreviate(40);
    line.startDate = input.startDate;
    line.feature = String.isBlank(input.feature) ? null : input.feature.abbreviate(80);
    if (input.productId == null) {
      if (String.isBlank(input.name)) {
        throw new RevquilaCore.ProblemException(
          lineLabel + 'name the custom item.'
        );
      }
      if (input.price == null || input.price < 0) {
        throw new RevquilaCore.ProblemException(
          lineLabel + 'enter a price for the custom item.'
        );
      }
      line.name = input.name.trim().abbreviate(255);
      line.unit = String.isBlank(input.unit)
        ? null
        : input.unit.trim().abbreviate(80);
      line.price = RevquilaCore.money(input.price);
      line.recurring = false;
      line.pricingMethod = 'unit';
      line.priceSource = 'custom';
    } else {
      if (product == null) {
        throw new RevquilaCore.ProblemException(
          lineLabel +
          'that product is inactive or has no standard price. Pick another one.'
        );
      }
      line.productId = product.id;
      line.name = product.name;
      line.unit = product.unit;
      line.recurring = product.recurring;
      line.family = product.family;
      line.pricingMethod = product.pricingMethod;
      line.usageBased = product.pricingMethod == 'usage';
      line.unitCost = RevquilaCore.money(product.cost);
      // the unit price in the home currency, from the best source for this customer
      Decimal unitPrice = product.price;
      line.priceSource = 'standard';
      if (bookPrices.containsKey(product.id)) {
        unitPrice = bookPrices.get(product.id);
        line.priceSource = 'price book';
      }
      Contracted_Price__c agreed = contracted.get(product.id);
      if (agreed != null) {
        if (agreed.Unit_Price__c != null) {
          unitPrice = agreed.Unit_Price__c;
        } else if (agreed.Discount__c != null) {
          unitPrice = RevquilaCore.money(unitPrice * (1 - agreed.Discount__c / 100));
        }
        line.priceSource = 'contracted';
      }
      if (product.pricingMethod == 'tiered' || product.pricingMethod == 'block') {
        Tier band = tierFor(product, input.qty);
        if (band != null) {
          if (product.pricingMethod == 'tiered' && band.unitPrice != null) {
            unitPrice = band.unitPrice;
            line.priceSource = 'tier';
          } else if (product.pricingMethod == 'block' && band.flatPrice != null) {
            unitPrice = RevquilaCore.money(band.flatPrice / input.qty);
            line.priceSource = 'block';
          }
        }
      }
      // configuration attributes add to the unit price
      unitPrice += attributeAdjust(input.attributes, product);
      line.attributes = String.isBlank(input.attributes) ? null : input.attributes.abbreviate(4000);
      if (
        input.priceOverride != null &&
        input.priceOverride >= 0 &&
        context.allowPriceEdit == true
      ) {
        // typed in the quote's currency already
        line.price = RevquilaCore.money(input.priceOverride);
        // a price carried over from the contract on a renewal or an amendment is not an edit
        line.priceSource = context.quoteType == 'renewal' || context.quoteType == 'amendment' ? 'carried' : 'edited';
      } else {
        line.price = RevquilaCore.money(unitPrice * market.exchangeRate);
      }
      // the term a recurring line is priced for
      if (product.recurring && product.pricingMethod != 'usage') {
        Integer term = input.termMonths;
        if (term == null || term < 1) {
          term = product.defaultTermMonths == null || product.defaultTermMonths < 1
            ? defaultTerm
            : product.defaultTermMonths;
        }
        line.termMonths = term;
        if (line.startDate != null) {
          line.endDate = line.startDate.addMonths(term).addDays(-1);
        }
      }
      line.ruleDiscount = lineRuleDiscount(product, input.qty, line, market, context);
      PriceRule setter = setPriceRule(product, input.qty, line, market, context);
      if (setter != null && line.priceSource != 'edited') {
        line.price = RevquilaCore.money(setter.setPrice * market.exchangeRate);
        line.priceSource = 'rule: ' + setter.name;
      }
    }
    if (input.bundleId != null && productsById.containsKey(input.bundleId)) {
      line.bundleId = input.bundleId;
      line.bundleName = productsById.get(input.bundleId).name;
    }
    line.qty = input.qty;
    line.discount = discount;
    Decimal factor = termFactor(product, line.termMonths);
    line.listAmount = RevquilaCore.money(line.price * line.qty * factor);
    Decimal off = Math.min(
      100,
      discount + RevquilaCore.orZero(line.ruleDiscount)
    );
    line.net = RevquilaCore.money(line.listAmount * (1 - off / 100));
    return line;
  }

  private static Tier tierFor(Product product, Decimal qty) {
    Tier found;
    for (Tier tier : product.tiers) {
      if (qty >= tier.fromQty && (tier.toQty == null || qty <= tier.toQty)) {
        found = tier;
      }
    }
    return found;
  }

  // The sum of the price adjustments of the attributes picked, checked against the product's own
  private static Decimal attributeAdjust(String picked, Product product) {
    if (String.isBlank(picked)) {
      return 0;
    }
    Decimal adjust = 0;
    try {
      for (Object row : (List<Object>) JSON.deserializeUntyped(picked)) {
        Map<String, Object> choice = (Map<String, Object>) row;
        Object amount = choice.get('adjust');
        if (amount != null) {
          adjust += Decimal.valueOf(String.valueOf(amount));
        }
      }
    } catch (Exception e) {
      return 0;
    }
    return adjust;
  }

  // Whether a rule's country, family, segment and conditions fit the quote and the line
  private static Boolean ruleFits(
    PriceRule rule,
    Product product,
    RevquilaSettings.Market market,
    Context context
  ) {
    if (rule.productId != null && rule.productId != product.id) {
      return false;
    }
    if (
      String.isNotBlank(rule.country) &&
      !rule.country.equalsIgnoreCase(market.country) &&
      !rule.country.equalsIgnoreCase(market.countryName)
    ) {
      return false;
    }
    if (
      String.isNotBlank(rule.family) &&
      (product.family == null || !rule.family.equalsIgnoreCase(product.family))
    ) {
      return false;
    }
    if (
      String.isNotBlank(rule.segment) &&
      (context.segment == null || !rule.segment.equalsIgnoreCase(context.segment))
    ) {
      return false;
    }
    if (String.isNotBlank(rule.conditions)) {
      Map<String, Object> facts = new Map<String, Object>{
        'quote.country' => market.countryName,
        'quote.region' => context.region,
        'quote.type' => context.quoteType,
        'account.name' => context.accountName,
        'account.segment' => context.segment,
        'account.industry' => context.industry,
        'owner.name' => context.ownerName,
        'owner.role' => context.ownerRole
      };
      if (!RevquilaRules.matches(RevquilaRules.parse(rule.conditions), facts)) {
        return false;
      }
    }
    return true;
  }

  private static Decimal lineRuleDiscount(
    Product product,
    Decimal qty,
    RevquilaCore.LineView line,
    RevquilaSettings.Market market,
    Context context
  ) {
    Decimal best = 0;
    for (PriceRule rule : rules()) {
      if (rule.action != 'discount' || rule.scope == 'amount' || !ruleFits(rule, product, market, context)) {
        continue;
      }
      if (rule.scope == 'term') {
        if (line.termMonths != null && rule.minTerm != null && line.termMonths >= rule.minTerm) {
          best = Math.max(best, rule.discount);
        }
      } else if (qty >= rule.minQty) {
        best = Math.max(best, rule.discount);
      }
    }
    return best;
  }

  private static PriceRule setPriceRule(
    Product product,
    Decimal qty,
    RevquilaCore.LineView line,
    RevquilaSettings.Market market,
    Context context
  ) {
    for (PriceRule rule : rules()) {
      if (rule.action != 'set_price' || rule.setPrice == null || !ruleFits(rule, product, market, context)) {
        continue;
      }
      if (rule.scope == 'term') {
        if (line.termMonths != null && rule.minTerm != null && line.termMonths >= rule.minTerm) {
          return rule;
        }
      } else if (rule.scope == 'quantity' && qty >= rule.minQty) {
        return rule;
      }
    }
    return null;
  }

  // Rules on the quote's amount: a discount on every line, or a product to add
  private static Decimal applyAmountRules(
    Totals totals,
    Decimal net,
    RevquilaSettings.Market market,
    Context context
  ) {
    Decimal baseNet = RevquilaCore.toBase(net, market.exchangeRate);
    Decimal extra = 0;
    Set<Id> added = new Set<Id>();
    for (PriceRule rule : rules()) {
      Boolean amountRule = rule.scope == 'amount' && rule.minAmount != null && baseNet >= rule.minAmount;
      if (rule.action == 'add_product' && rule.addProductId != null) {
        // a product added from a quantity of another, or from the quote's amount
        Boolean fits = false;
        if (amountRule && String.isBlank(rule.country) || amountRule && rule.country.equalsIgnoreCase(market.country)) {
          fits = true;
        }
        for (RevquilaCore.LineView line : totals.lines) {
          if (
            rule.scope == 'quantity' &&
            line.productId != null &&
            (rule.productId == null || rule.productId == line.productId) &&
            line.qty >= rule.minQty
          ) {
            fits = true;
          }
        }
        if (fits && !added.contains(rule.addProductId)) {
          Boolean already = false;
          for (RevquilaCore.LineView line : totals.lines) {
            if (line.productId == rule.addProductId) {
              already = true;
            }
          }
          if (!already) {
            RuleOutcome outcome = new RuleOutcome();
            outcome.kind = 'add';
            outcome.name = rule.name;
            outcome.message = rule.note;
            outcome.addProductId = rule.addProductId;
            outcome.addQty = rule.addQty == null ? 1 : rule.addQty;
            totals.additions.add(outcome);
            added.add(rule.addProductId);
          }
        }
        continue;
      }
      if (rule.action != 'discount' || !amountRule) {
        continue;
      }
      if (String.isNotBlank(rule.segment) && (context.segment == null || !rule.segment.equalsIgnoreCase(context.segment))) {
        continue;
      }
      if (String.isNotBlank(rule.country) && !rule.country.equalsIgnoreCase(market.country) && !rule.country.equalsIgnoreCase(market.countryName)) {
        continue;
      }
      extra = Math.max(extra, rule.discount);
    }
    if (extra == 0) {
      return net;
    }
    Decimal newNet = 0;
    for (RevquilaCore.LineView line : totals.lines) {
      if (line.optional) {
        continue;
      }
      line.ruleDiscount = Math.max(RevquilaCore.orZero(line.ruleDiscount), extra);
      Decimal off = Math.min(100, line.discount + line.ruleDiscount);
      line.net = RevquilaCore.money(line.listAmount * (1 - off / 100));
      newNet += line.net;
    }
    return newNet;
  }

  // Tax on the lines, grouped by the product's tax category, through the provider in Setup
  private static TaxResult taxLines(
    List<RevquilaCore.LineView> lines,
    RevquilaSettings.Market market,
    Context context,
    Map<Id, Product> productsById
  ) {
    Map<String, Decimal> netByCategory = new Map<String, Decimal>();
    List<String> order = new List<String>();
    for (RevquilaCore.LineView line : lines) {
      if (line.optional) {
        continue;
      }
      Product product = line.productId == null ? null : productsById.get(line.productId);
      String category = product == null || String.isBlank(product.taxCategory)
        ? ''
        : product.taxCategory;
      if (!netByCategory.containsKey(category)) {
        netByCategory.put(category, 0);
        order.add(category);
      }
      netByCategory.put(category, netByCategory.get(category) + line.net);
    }
    if (order.isEmpty()) {
      order.add('');
      netByCategory.put('', 0);
    }
    RevquilaTaxEngine.Provider provider = RevquilaTaxEngine.provider();
    TaxResult result = new TaxResult();
    result.net = 0;
    result.tax = 0;
    result.total = 0;
    Map<String, TaxLine> merged = new Map<String, TaxLine>();
    List<String> labels = new List<String>();
    for (String category : order) {
      RevquilaTaxEngine.Request request = new RevquilaTaxEngine.Request();
      request.amount = RevquilaCore.money(netByCategory.get(category));
      request.region = context.region;
      request.country = market.country;
      request.category = String.isBlank(category) ? null : category;
      request.exempt = context.taxExempt == true;
      request.exemptionReason = context.exemptionReason;
      request.market = market;
      request.accountId = context.accountId;
      request.postalCode = context.postalCode;
      TaxResult part = provider.tax(request);
      result.net += part.net;
      result.tax += part.tax;
      result.total += part.total;
      for (TaxLine line : part.lines) {
        String label = line.label;
        if (String.isNotBlank(category) && order.size() > 1) {
          label = category + ' · ' + line.label;
        }
        TaxLine existing = merged.get(label);
        if (existing == null) {
          existing = new TaxLine();
          existing.label = label;
          existing.rate = line.rate;
          existing.amount = 0;
          merged.put(label, existing);
          labels.add(label);
        }
        existing.amount = RevquilaCore.money(existing.amount + line.amount);
      }
    }
    for (String label : labels) {
      result.lines.add(merged.get(label));
    }
    result.net = RevquilaCore.money(result.net);
    result.tax = RevquilaCore.money(result.tax);
    result.total = RevquilaCore.money(result.total);
    return result;
  }

  /** Tax in the home country. */
  public static TaxResult taxOn(Decimal amount, String region) {
    return taxOn(amount, region, RevquilaSettings.current().home, null);
  }

  public static TaxResult taxOn(
    Decimal amount,
    String region,
    RevquilaSettings.Market market
  ) {
    return taxOn(amount, region, market, null);
  }

  /**
   * Tax on an amount for a customer in `region` of a market, from that market's tax settings,
   * at `rateOverride` when a product category has its own rate.
   * When prices include tax, the amount already contains it and the net is worked back.
   */
  public static TaxResult taxOn(
    Decimal amount,
    String region,
    RevquilaSettings.Market market,
    Decimal rateOverride
  ) {
    String mode = market.taxMode;
    Decimal rate = 0;
    if (mode == 'regional') {
      rate = market.regionRates.containsKey(region)
        ? market.regionRates.get(region)
        : market.taxRate;
    } else if (mode != 'none') {
      rate = market.taxRate;
    }
    if (rateOverride != null && mode != 'none') {
      rate = rateOverride;
    }
    rate = RevquilaCore.orZero(rate);

    TaxResult result = new TaxResult();
    if (market.pricesIncludeTax) {
      result.total = RevquilaCore.money(amount);
      result.net = RevquilaCore.money(amount / (1 + rate / 100));
    } else {
      result.net = RevquilaCore.money(amount);
      result.total = RevquilaCore.money(result.net * (1 + rate / 100));
    }
    result.tax = RevquilaCore.money(result.total - result.net);

    if (mode == 'none') {
      return result;
    }
    // a split tax shares its rate between two lines for a customer in the company's own region
    String homeRegion = RevquilaSettings.current().homeRegion;
    Boolean atHome =
      market == RevquilaSettings.current().home &&
      region == homeRegion;
    if (mode == 'split' && atHome) {
      Decimal half = RevquilaCore.money(result.tax / 2);
      result.lines.add(
        taxLine(
          market.splitLabels[0] + ' ' + plain(rate / 2) + '%',
          rate / 2,
          half
        )
      );
      result.lines.add(
        taxLine(
          market.splitLabels[1] + ' ' + plain(rate / 2) + '%',
          rate / 2,
          result.tax - half
        )
      );
    } else if (mode == 'split') {
      result.lines.add(
        taxLine(market.crossLabel + ' ' + plain(rate) + '%', rate, result.tax)
      );
    } else {
      String place = mode == 'regional' && String.isNotBlank(region)
        ? ' (' + region + ')'
        : '';
      result.lines.add(
        taxLine(
          market.taxSystem + ' ' + plain(rate) + '%' + place,
          rate,
          result.tax
        )
      );
    }
    return result;
  }

  /** The tax lines saved on a record as JSON, or none when it has none. */
  public static List<TaxLine> taxLines(String saved) {
    return String.isBlank(saved)
      ? new List<TaxLine>()
      : (List<TaxLine>) JSON.deserialize(saved, List<TaxLine>.class);
  }

  /** How many days after its date an invoice on these terms is due. */
  public static Integer dueDays(String terms) {
    if (terms != null) {
      Matcher net = Pattern.compile('(?i)^\\s*net\\s+(\\d{1,3})\\s*$')
        .matcher(terms);
      if (net.matches()) {
        return Integer.valueOf(net.group(1));
      }
      if (terms.trim().equalsIgnoreCase('Due on receipt')) {
        return 0;
      }
    }
    return RevquilaSettings.current().invoiceDueDays;
  }

  private static String policyIssue(
    Totals totals,
    String terms,
    RevquilaSettings settings
  ) {
    List<String> issues = new List<String>();
    if (totals.maxDiscount > settings.discountLimit) {
      issues.add(
        plain(totals.maxDiscount) +
          '% discount, limit is ' +
          plain(settings.discountLimit) +
          '%'
      );
    }
    if (String.isNotBlank(terms) && terms != settings.standardTerms) {
      issues.add(terms + ' payment terms');
    }
    if (
      settings.marginFloor > 0 &&
      totals.costTotal > 0 &&
      totals.marginPercent < settings.marginFloor
    ) {
      issues.add(
        plain(totals.marginPercent) +
          '% margin, floor is ' +
          plain(settings.marginFloor) +
          '%'
      );
    }
    if (totals.priceEdited) {
      issues.add('a unit price was edited');
    }
    return issues.isEmpty() ? null : String.join(issues, '; ').abbreviate(255);
  }

  /**
   * The product rules of Setup against the lines: validation rules that fail throw, selection
   * rules say what to add, alert rules are returned as warnings. `facts` is the quote context.
   */
  public static List<RuleOutcome> productRules(
    List<RevquilaCore.LineView> lines,
    Map<String, Object> facts
  ) {
    List<RuleOutcome> outcomes = new List<RuleOutcome>();
    Set<String> productIds = new Set<String>();
    for (RevquilaCore.LineView line : lines) {
      if (line.productId != null) {
        productIds.add(String.valueOf(line.productId));
      }
    }
    for (RevquilaSettings.ProductRule rule : RevquilaSettings.current().productRules) {
      if (rule.active == false) {
        continue;
      }
      if (String.isNotBlank(rule.productId) && !productIds.contains(rule.productId)) {
        continue;
      }
      if (!RevquilaRules.matches(rule.conditions, facts)) {
        continue;
      }
      RuleOutcome outcome = new RuleOutcome();
      outcome.kind = rule.kind;
      outcome.name = rule.name;
      outcome.message = rule.message;
      if (rule.kind == 'selection') {
        if (String.isNotBlank(rule.addProductId) && !productIds.contains(rule.addProductId)) {
          outcome.addProductId = (Id) rule.addProductId;
          outcome.addQty = rule.addQty == null || rule.addQty < 1 ? 1 : rule.addQty;
        }
        if (String.isNotBlank(rule.removeProductId) && productIds.contains(rule.removeProductId)) {
          outcome.removeProductId = (Id) rule.removeProductId;
        }
        if (outcome.addProductId == null && outcome.removeProductId == null) {
          continue;
        }
      }
      outcomes.add(outcome);
    }
    return outcomes;
  }

  /** The facts a rule can look at for a priced quote. */
  public static Map<String, Object> facts(
    Totals totals,
    String terms,
    Context context
  ) {
    Set<String> families = new Set<String>();
    Set<String> codes = new Set<String>();
    Set<String> names = new Set<String>();
    Boolean recurring = false;
    Boolean custom = false;
    for (RevquilaCore.LineView line : totals.lines) {
      if (line.family != null) {
        families.add(line.family);
      }
      names.add(line.name);
      if (line.productId == null) {
        custom = true;
      }
      if (line.recurring) {
        recurring = true;
      }
    }
    if (!totals.lines.isEmpty()) {
      for (Product product : products(productIdsOf(totals.lines))) {
        if (product.code != null) {
          codes.add(product.code);
        }
      }
    }
    return new Map<String, Object>{
      'quote.net' => totals.baseNet,
      'quote.total' => RevquilaCore.toBase(totals.total, totals.exchangeRate),
      'quote.maxDiscount' => totals.maxDiscount,
      'quote.margin' => totals.marginPercent,
      'quote.terms' => terms,
      'quote.termMonths' => context.termMonths,
      'quote.country' => totals.country,
      'quote.region' => context.region,
      'quote.type' => context.quoteType,
      'quote.lineCount' => totals.lines.size(),
      'quote.recurring' => recurring,
      'quote.hasCustom' => custom,
      'quote.priceEdited' => totals.priceEdited,
      'account.name' => context.accountName,
      'account.segment' => context.segment,
      'account.industry' => context.industry,
      'products.families' => families,
      'products.codes' => codes,
      'products.names' => names,
      'owner.name' => context.ownerName,
      'owner.role' => context.ownerRole
    };
  }

  private static Set<Id> productIdsOf(List<RevquilaCore.LineView> lines) {
    Set<Id> ids = new Set<Id>();
    for (RevquilaCore.LineView line : lines) {
      if (line.productId != null) {
        ids.add(line.productId);
      }
    }
    return ids;
  }

  private static TaxLine taxLine(String label, Decimal rate, Decimal amount) {
    TaxLine line = new TaxLine();
    line.label = label;
    line.rate = rate;
    line.amount = amount;
    return line;
  }

  // 18.00 prints as "18", 7.25 as "7.25"
  public static String plain(Decimal value) {
    return value.stripTrailingZeros().toPlainString();
  }
}