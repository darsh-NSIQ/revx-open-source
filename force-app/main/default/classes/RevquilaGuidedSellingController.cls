/**
 * Guided Selling & New-Hire Co-pilot Controller
 * Guides sales reps (especially new hires) through an interactive question flow,
 * recommends optimal packages/bundles, provides real-time coaching guardrails,
 * and creates ready-to-close draft quotes with 1 click.
 */
public with sharing class RevquilaGuidedSellingController {

  public class OptionItem {
    @AuraEnabled public String id;
    @AuraEnabled public String label;
    @AuraEnabled public String description;
    @AuraEnabled public String badge;
    public OptionItem(String id, String label, String description, String badge) {
      this.id = id;
      this.label = label;
      this.description = description;
      this.badge = badge;
    }
  }

  public class ProductRecommendation {
    @AuraEnabled public Id productId;
    @AuraEnabled public String productCode;
    @AuraEnabled public String name;
    @AuraEnabled public String family;
    @AuraEnabled public Decimal unitPrice;
    @AuraEnabled public Decimal suggestedQty;
    @AuraEnabled public Decimal discountPct;
    @AuraEnabled public String role; // 'Core', 'Recommended Add-on', 'Optional Booster'
    @AuraEnabled public String whyRecommended;
  }

  public class PackageProposal {
    @AuraEnabled public String packageCode;
    @AuraEnabled public String title;
    @AuraEnabled public String tag;
    @AuraEnabled public String summary;
    @AuraEnabled public Decimal totalListPrice;
    @AuraEnabled public Decimal suggestedDiscount;
    @AuraEnabled public Decimal estimatedNetPrice;
    @AuraEnabled public Decimal estimatedMRR;
    @AuraEnabled public Decimal winProbability;
    @AuraEnabled public String coachingNote;
    @AuraEnabled public List<ProductRecommendation> products;
  }

  public class ConfigData {
    @AuraEnabled public List<OptionItem> industries;
    @AuraEnabled public List<OptionItem> companySizes;
    @AuraEnabled public List<OptionItem> businessModels;
    @AuraEnabled public List<OptionItem> featureOptions;
    @AuraEnabled public List<Map<String, String>> accounts;
  }

  @AuraEnabled(cacheable=true)
  public static ConfigData getConfigData() {
    ConfigData cfg = new ConfigData();
    cfg.industries = new List<OptionItem>{
      new OptionItem('saas', 'B2B SaaS / Cloud Software', 'High recurring revenue focus with annual upfront or monthly billing', 'High Volume'),
      new OptionItem('fintech', 'FinTech & Payments', 'Strict compliance, high transaction volumes, audit requirements', 'Regulatory'),
      new OptionItem('healthcare', 'HealthTech & Life Sciences', 'HIPAA compliant data, multi-entity invoicing, long contracts', 'Enterprise'),
      new OptionItem('manufacturing', 'Manufacturing & Hardware', 'Hardware + AMC + recurrent service subscriptions', 'Hybrid'),
      new OptionItem('services', 'Professional & Consulting Services', 'Milestone revenue recognition, time & materials, retainer billing', 'Services')
    };

    cfg.companySizes = new List<OptionItem>{
      new OptionItem('starter', 'Startup / Emerging (1 - 25 Users)', 'Fast sales cycle, lean approval workflow, low discount tolerance', '1-25 seats'),
      new OptionItem('growth', 'Scale-up / Mid-Market (26 - 150 Users)', 'Multi-currency, volume pricing tiers, deal desk review', '26-150 seats'),
      new OptionItem('enterprise', 'Global Enterprise (150+ Users)', 'Custom contract terms, strict legal SLA, ASC 606 compliance', '150+ seats')
    };

    cfg.businessModels = new List<OptionItem>{
      new OptionItem('subscription', 'Pure Subscription (Flat / Per-seat)', 'Predictable ARR, automated renewals, co-terming', 'Predictable'),
      new OptionItem('consumption', 'Consumption / Usage-Based', 'Pay-as-you-go, streaming event rating, prepaid credits', 'Usage'),
      new OptionItem('hybrid', 'Hybrid (Platform Base + Usage Overage)', 'Highest NRR model, base platform fee plus metered tiers', 'Recommended')
    };

    cfg.featureOptions = new List<OptionItem>{
      new OptionItem('ai_advisor', 'AI Deal Advisor & Smart Scoring', 'Natural language win probability & auto-approval suggestions', 'AI Powered'),
      new OptionItem('usage_metering', 'Real-time Event Metering Engine', 'Sub-second event aggregation for API calls, tokens & storage', 'Consumption'),
      new OptionItem('asc606', 'ASC 606 / IFRS 15 Revenue Schedules', 'Automated deferred-to-recognized revenue waterfalls', 'Compliance'),
      new OptionItem('multi_currency', 'Multi-currency & Daily FX Engine', 'Automated ECB exchange rates and dual-book reporting', 'Global'),
      new OptionItem('collections', 'Autonomous Dunning & Collections', 'Multi-channel WhatsApp/Email recovery with promise-to-pay', 'Cash Flow')
    };

    cfg.accounts = new List<Map<String, String>>();
    for (Account acc : [
      SELECT Id, Name, Segment__c, Industry, BillingCountry
      FROM Account
      ORDER BY LastModifiedDate DESC
      LIMIT 30
    ]) {
      cfg.accounts.add(new Map<String, String>{
        'id' => acc.Id,
        'name' => acc.Name,
        'segment' => acc.Segment__c != null ? acc.Segment__c : 'Standard',
        'industry' => acc.Industry != null ? acc.Industry : 'Technology',
        'country' => acc.BillingCountry != null ? acc.BillingCountry : 'US'
      });
    }

    return cfg;
  }

  @AuraEnabled
  public static List<PackageProposal> evaluateProposals(
    String industry,
    String companySize,
    String businessModel,
    List<String> selectedFeatures
  ) {
    List<PackageProposal> proposals = new List<PackageProposal>();

    // Query available products
    List<Product2> dbProducts = [
      SELECT Id, Name, ProductCode, Family, Description, IsActive
      FROM Product2
      WHERE IsActive = true
      LIMIT 50
    ];

    Id coreId = dbProducts.isEmpty() ? null : dbProducts[0].Id;
    String coreName = dbProducts.isEmpty() ? 'RevX Core Platform' : dbProducts[0].Name;

    // Build Package 1: Recommended Fit
    PackageProposal p1 = new PackageProposal();
    p1.packageCode = 'RECOMMENDED';
    p1.title = companySize == 'enterprise' ? 'Enterprise Sovereign Suite' : (companySize == 'growth' ? 'Scale Growth Engine' : 'Rapid Launch Essentials');
    p1.tag = 'BEST FIT';
    p1.summary = 'Tailored to ' + (industry != null ? industry.toUpperCase() : 'your') + ' with optimal pricing and automated guardrails.';
    p1.suggestedDiscount = companySize == 'enterprise' ? 12 : (companySize == 'growth' ? 8 : 5);
    p1.winProbability = companySize == 'enterprise' ? 78 : 88;
    p1.coachingNote = 'Ramp-up Hint: ' + (companySize == 'enterprise'
      ? 'Deals in this tier close 30% faster when packaging ASC 606 and AI Advisor together. Keep discount <= 15% to avoid executive escalation.'
      : 'Standard contract length of 12 months with annual upfront payment gives highest margin.');

    p1.products = new List<ProductRecommendation>();
    ProductRecommendation r1 = new ProductRecommendation();
    r1.productId = coreId;
    r1.productCode = 'REVX-PLATFORM';
    r1.name = coreName;
    r1.family = 'Software';
    r1.unitPrice = companySize == 'enterprise' ? 3500 : (companySize == 'growth' ? 1800 : 750);
    r1.suggestedQty = 1;
    r1.discountPct = p1.suggestedDiscount;
    r1.role = 'Core Platform';
    r1.whyRecommended = 'Required foundational module providing unified quote-to-cash workflow.';
    p1.products.add(r1);

    ProductRecommendation r2 = new ProductRecommendation();
    r2.productId = dbProducts.size() > 1 ? dbProducts[1].Id : coreId;
    r2.productCode = 'REVX-SEATS';
    r2.name = 'User Licences (' + (companySize == 'enterprise' ? '100 Pack' : (companySize == 'growth' ? '30 Pack' : '10 Pack')) + ')';
    r2.family = 'Licenses';
    r2.unitPrice = companySize == 'enterprise' ? 65 : (companySize == 'growth' ? 75 : 85);
    r2.suggestedQty = companySize == 'enterprise' ? 100 : (companySize == 'growth' ? 30 : 10);
    r2.discountPct = p1.suggestedDiscount;
    r2.role = 'Core Seats';
    r2.whyRecommended = 'Sized according to target company headcount.';
    p1.products.add(r2);

    if (selectedFeatures != null && selectedFeatures.contains('ai_advisor')) {
      ProductRecommendation r3 = new ProductRecommendation();
      r3.productId = dbProducts.size() > 2 ? dbProducts[2].Id : coreId;
      r3.productCode = 'REVX-AI';
      r3.name = 'RevX AI Deal Advisor & Copilot';
      r3.family = 'Add-on';
      r3.unitPrice = 500;
      r3.suggestedQty = 1;
      r3.discountPct = 0;
      r3.role = 'Recommended Add-on';
      r3.whyRecommended = 'Selected in feature needs; provides auto-scoring and pricing margin intelligence.';
      p1.products.add(r3);
    }

    if (businessModel == 'consumption' || businessModel == 'hybrid' || (selectedFeatures != null && selectedFeatures.contains('usage_metering'))) {
      ProductRecommendation r4 = new ProductRecommendation();
      r4.productId = dbProducts.size() > 3 ? dbProducts[3].Id : coreId;
      r4.productCode = 'REVX-METER';
      r4.name = 'Usage Metering Engine (100k Events Base)';
      r4.family = 'Usage';
      r4.unitPrice = 400;
      r4.suggestedQty = 1;
      r4.discountPct = 0;
      r4.role = 'Consumption Module';
      r4.whyRecommended = 'Required for streaming usage billing and metered overage calculations.';
      p1.products.add(r4);
    }

    // Totals
    Decimal listTotal = 0;
    Decimal netTotal = 0;
    for (ProductRecommendation r : p1.products) {
      Decimal lineList = r.unitPrice * r.suggestedQty;
      Decimal lineNet = lineList * (1 - (r.discountPct / 100));
      listTotal += lineList;
      netTotal += lineNet;
    }
    p1.totalListPrice = listTotal.setScale(2);
    p1.estimatedNetPrice = netTotal.setScale(2);
    p1.estimatedMRR = (netTotal / 12).setScale(2);
    proposals.add(p1);

    // Build Package 2: Value Alternative (Starter/Lite)
    PackageProposal p2 = new PackageProposal();
    p2.packageCode = 'VALUE';
    p2.title = 'Core Foundation Edition';
    p2.tag = 'LEAN ENTRY';
    p2.summary = 'Lightweight entry configuration focused on baseline CPQ and Invoicing.';
    p2.suggestedDiscount = 5;
    p2.winProbability = 72;
    p2.coachingNote = 'Ramp-up Hint: Good fallback option if prospect has tight budget constraints. Rep can pitch upgrade path after 6 months.';
    p2.products = new List<ProductRecommendation>{ r1, r2 };
    Decimal p2List = (r1.unitPrice * r1.suggestedQty) + (r2.unitPrice * r2.suggestedQty);
    p2.totalListPrice = p2List.setScale(2);
    p2.estimatedNetPrice = (p2List * 0.95).setScale(2);
    p2.estimatedMRR = (p2.estimatedNetPrice / 12).setScale(2);
    proposals.add(p2);

    return proposals;
  }

  @AuraEnabled
  public static Id createQuoteFromProposal(
    Id accountId,
    String packageName,
    Decimal discountPct,
    String productsJson
  ) {
    if (accountId == null) {
      throw new AuraHandledException('Please select an Account to generate a quote.');
    }

    Account acc = [
      SELECT Id, Name, BillingCountry, Price_Book__c, Payment_Terms__c
      FROM Account
      WHERE Id = :accountId
      LIMIT 1
    ];

    RevquilaQuoteController.QuoteInput qInput = new RevquilaQuoteController.QuoteInput();
    qInput.accountId = acc.Id;
    qInput.country = String.isNotBlank(acc.BillingCountry) ? acc.BillingCountry : 'US';
    qInput.terms = String.isNotBlank(acc.Payment_Terms__c) ? acc.Payment_Terms__c : 'Net 30';
    qInput.validDays = 30;
    qInput.notes = 'Generated via RevX Guided Selling Co-pilot for ' + packageName + '.';
    qInput.lines = new List<RevquilaPricing.LineInput>();

    List<Object> rawList = (List<Object>) JSON.deserializeUntyped(productsJson);
    for (Object obj : rawList) {
      Map<String, Object> item = (Map<String, Object>) obj;
      RevquilaPricing.LineInput line = new RevquilaPricing.LineInput();
      if (item.containsKey('productId') && item.get('productId') != null) {
        try {
          line.productId = (Id) String.valueOf(item.get('productId'));
        } catch (Exception e) {}
      }
      line.name = String.valueOf(item.get('name'));
      line.qty = item.containsKey('suggestedQty') ? Decimal.valueOf(String.valueOf(item.get('suggestedQty'))) : 1;
      line.price = item.containsKey('unitPrice') ? Decimal.valueOf(String.valueOf(item.get('unitPrice'))) : 100;
      line.discount = item.containsKey('discountPct') ? Decimal.valueOf(String.valueOf(item.get('discountPct'))) : discountPct;
      qInput.lines.add(line);
    }

    return RevquilaQuoteController.saveQuote(JSON.serialize(qInput));
  }
}
