/**
 * The published Revquila settings on the server, read once per transaction: markets and tax,
 * the pricing policy, approval chains, product rules, automation rules, billing and dunning,
 * revenue recognition, documents and emails, numbering, permissions, plugins, the portal.
 *
 * The settings are one JSON document, published from the Setup tab (see RevquilaConfigController).
 * The defaults below are used until something is published, and for any value a published
 * version does not have. They must stay the same as DEFAULT_CONFIG in the revquilaConfig component.
 */
public with sharing class RevquilaSettings {
  /** A country Revquila sells into: its tax system and its currency. The home market is `tax` in Setup. */
  public class Market {
    public String country = 'IN'; // ISO 3166-1 alpha-2
    public String countryName = 'India';
    public String currencyCode = 'INR';
    public String taxMode = 'split'; // none | single | split | regional
    public String taxSystem = 'GST';
    public Decimal taxRate = 18;
    public List<String> splitLabels = new List<String>{ 'CGST', 'SGST' };
    public String crossLabel = 'IGST';
    public Map<String, Decimal> regionRates = new Map<String, Decimal>();
    public Boolean pricesIncludeTax = false;
    /** Units of this currency per one unit of the home currency. 1 for the home market. */
    public Decimal exchangeRate = 1;
    /** A rate per product tax category, for example Reduced => 5. */
    public Map<String, Decimal> categoryRates = new Map<String, Decimal>();
    /** The price book quotes in this market price from, when not the standard one. */
    public Id priceBookId;
  }

  /** One rule of Setup > Salesforce sync: at `trigger`, write `source` into `field` of the linked `target`. */
  public class SyncRule {
    public String moment;
    public String target; // Opportunity | Account | Contact
    public String field;
    public String source; // value | quote.net | today | ...
    public String value;
  }

  /** One condition of a rule: a field of the context compared with a value. */
  public class Condition {
    public String field;
    public String op;
    public String value;
  }

  public class ApprovalStepDef {
    public String approver; // permission:Approve_Quotes | user:<id> | manager | owner
    public String label;
    public Boolean isParallel;
  }

  public class ApprovalRule {
    public String id;
    public String name;
    public Boolean active;
    public List<Condition> conditions;
    public List<ApprovalStepDef> steps;
  }

  public class ProductRule {
    public String id;
    public String name;
    public Boolean active;
    public String kind; // validation | selection | alert
    public List<Condition> conditions;
    public String message;
    public String productId; // the product that triggers the rule, when one does
    public String addProductId;
    public Decimal addQty;
    public String removeProductId;
  }

  public class ActionDef {
    public String type; // email | task | field | webhook | flow | notify | slack
    public String template;
    public String to; // owner | approvers | contact | billing | account_owner | user:<id> | an address
    public String subject;
    public String body;
    public String assignTo;
    public String target; // Quote | Opportunity | Account | Contact | Invoice | Subscription
    public String field;
    public String source;
    public String value;
    public String url;
    public String flow;
    public String message;
    public String title;
  }

  public class AutomationRule {
    public String id;
    public String name;
    public Boolean active;
    public String event;
    public List<Condition> conditions;
    public List<ActionDef> actions;
  }

  public class DunningStep {
    public Integer days;
    public String action; // email | fee | notify | task
    public String template;
    public Decimal feePercent;
  }

  public class DocTemplate {
    public String id;
    public String name;
    public String kind; // quote | invoice | order | statement
    public String title;
    public String intro;
    public List<String> sections;
    public String language;
    public List<String> clauseIds;
    public Boolean isDefault;
  }

  public class Clause {
    public String id;
    public String title;
    public String text;
    public List<String> kinds;
    public List<Condition> conditions;
  }

  public class MailTemplate {
    public String key; // quote_sent | invoice_sent | reminder | payment_received | renewal_due | approval_pending | quote_signed | statement | payment_link
    public String subject;
    public String body;
    public Boolean enabled;
  }

  public class NumberFormat {
    public String prefix;
    public Integer digits;
  }

  public Market home = new Market();
  public List<Market> markets = new List<Market>();
  // company: the region a split tax treats as home
  public String homeRegion = 'Maharashtra';
  public String companyName = 'RevX Demo Pvt Ltd';
  public String companyEmail = 'accounts@example.com';
  // pricing
  public Decimal discountLimit = 15;
  public String standardTerms = 'Net 30';
  public Integer quoteValidDays = 30;
  public Decimal marginFloor = 0;
  public Integer termDefaultMonths = 12;
  public Decimal renewalUplift = 0;
  public Integer renewalLeadDays = 60;
  public Boolean expireQuotes = true;
  public Boolean allowPriceEdit = false;
  // approvals
  public String approvalsMode = 'simple'; // simple | rules
  public List<ApprovalRule> approvalRules = new List<ApprovalRule>();
  public Map<Id, Id> delegates = new Map<Id, Id>();
  // product rules and automation
  public List<ProductRule> productRules = new List<ProductRule>();
  public List<AutomationRule> automationRules = new List<AutomationRule>();
  // billing
  public String invoicePrefix = 'INV-';
  public Integer invoiceDueDays = 30;
  public String scheduleFrequency = 'yearly'; // yearly | quarterly | monthly | product
  public Boolean billInAdvance = true;
  public Integer billingDay = 0;
  public Boolean consolidate = false;
  public Boolean autoRunBilling = true;
  public List<DunningStep> dunning = new List<DunningStep>();
  public Boolean chargeLateFee = false;
  public Decimal lateFeePercent = 0;
  public Boolean prorate = true;
  public Boolean usageEnabled = true;
  public Boolean autoRenew = true;
  public Boolean expireContracts = true;
  // revenue recognition
  public String revenueMethod = 'ratable';
  public String revenuePeriods = 'monthly';
  public Boolean autoRecognize = true;
  // tax
  public String taxProvider = 'builtin'; // builtin | avalara | <Apex class>
  public Boolean taxExemptions = true;
  public Boolean eInvoiceEnabled = false;
  public String eInvoiceProvider = 'manual';
  public Boolean vatCheck = true;
  // currency
  public String fxProvider = 'none'; // none | frankfurter | <Apex class>
  public Boolean fxAutoFetch = false;
  // payments
  public String gateway = 'manual'; // manual | razorpay | stripe | <Apex class>
  public Boolean paymentLinks = true;
  public Boolean autoPay = false;
  // documents and emails
  public List<DocTemplate> docTemplates = new List<DocTemplate>();
  public List<Clause> clauses = new List<Clause>();
  public Map<String, MailTemplate> emailTemplates = new Map<String, MailTemplate>();
  public String emailFromName;
  public String emailReplyTo;
  public String emailCc;
  // screens: extra fields per screen key, for example quoteList => [Custom_Field__c]
  public Map<String, List<String>> layouts = new Map<String, List<String>>();
  // numbering per record kind
  public Map<String, NumberFormat> numbering = new Map<String, NumberFormat>();
  // which custom permission each action needs
  public Map<String, String> permissions = new Map<String, String>{
    'approve' => 'Approve_Quotes',
    'catalog' => 'Manage_Catalog',
    'billing' => 'Manage_Billing',
    'payments' => 'Record_Payments',
    'revenue' => 'Recognize_Revenue',
    'settings' => 'Manage_Settings',
    'prices' => 'Edit_Prices'
  };
  // Apex classes that replace the built-in engines
  public Map<String, String> plugins = new Map<String, String>();
  // portal
  public Boolean portalEnabled = true;
  public String portalUrl = '';
  public Boolean portalAccept = true;
  public Boolean portalPay = true;
  // notifications
  public Boolean notifyInApp = true;
  public Boolean notifyEmail = true;
  public Map<String, Boolean> notifications = new Map<String, Boolean>();
  public Boolean slackEnabled = false;
  public Integer jobsHour = 2;
  // Salesforce sync
  public List<SyncRule> syncRules = new List<SyncRule>();

  // the home market's tax, as the older code reads it
  public String taxMode {
    get {
      return home.taxMode;
    }
  }
  public String taxSystem {
    get {
      return home.taxSystem;
    }
  }
  public Decimal taxRate {
    get {
      return home.taxRate;
    }
  }
  public List<String> splitLabels {
    get {
      return home.splitLabels;
    }
  }
  public String crossLabel {
    get {
      return home.crossLabel;
    }
  }
  public Map<String, Decimal> regionRates {
    get {
      return home.regionRates;
    }
  }
  public Boolean pricesIncludeTax {
    get {
      return home.pricesIncludeTax;
    }
  }
  public String countryName {
    get {
      return home.countryName;
    }
  }

  private static RevquilaSettings cached;

  /** The live settings. */
  public static RevquilaSettings current() {
    if (cached == null) {
      List<Config_Version__c> latest = [
        SELECT Payload__c
        FROM Config_Version__c
        WITH SYSTEM_MODE
        ORDER BY Version__c DESC
        LIMIT 1
      ];
      cached = parse(latest.isEmpty() ? null : latest[0].Payload__c);
    }
    return cached;
  }

  /** Makes a payload the settings for the rest of the transaction. Tests use it instead of publishing. */
  @TestVisible
  private static void use(String payload) {
    cached = parse(payload);
  }

  /** The market for a country given by code or name. Blank or unknown: the home market. */
  public Market market(String country) {
    if (String.isNotBlank(country)) {
      String wanted = country.trim();
      if (
        wanted.equalsIgnoreCase(home.country) ||
        wanted.equalsIgnoreCase(home.countryName)
      ) {
        return home;
      }
      for (Market candidate : markets) {
        if (
          wanted.equalsIgnoreCase(candidate.country) ||
          wanted.equalsIgnoreCase(candidate.countryName)
        ) {
          return candidate;
        }
      }
    }
    return home;
  }

  /** The email template for a key, or null when it is off or missing. */
  public MailTemplate email(String key) {
    MailTemplate template = emailTemplates.get(key);
    return template == null || template.enabled == false ? null : template;
  }

  /** The number a record prints: the prefix and digits set for its kind, over the auto-number's digits. */
  public String displayNumber(String kind, String autoNumber) {
    NumberFormat format = numbering.get(kind);
    if (format == null || String.isBlank(autoNumber)) {
      return autoNumber;
    }
    String digits = autoNumber.replaceAll('[^0-9]', '');
    Integer width = format.digits == null || format.digits < 1
      ? digits.length()
      : format.digits;
    while (digits.length() < width) {
      digits = '0' + digits;
    }
    return (format.prefix == null ? '' : format.prefix) + digits;
  }

  public static RevquilaSettings parse(String payload) {
    RevquilaSettings settings = new RevquilaSettings();
    if (String.isBlank(payload)) {
      return settings;
    }
    Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(
      payload
    );
    settings.home = market(section(root, 'tax'), settings.home);
    settings.home.exchangeRate = 1;
    if (root.get('markets') instanceof List<Object>) {
      for (Object row : (List<Object>) root.get('markets')) {
        if (row instanceof Map<String, Object>) {
          Market market = market((Map<String, Object>) row, new Market());
          if (market.exchangeRate == null || market.exchangeRate <= 0) {
            market.exchangeRate = 1;
          }
          settings.markets.add(market);
        }
      }
    }
    Map<String, Object> company = section(root, 'company');
    settings.homeRegion = text(company, 'state', settings.homeRegion);
    settings.companyName = text(company, 'name', settings.companyName);
    settings.companyEmail = text(company, 'email', settings.companyEmail);

    Map<String, Object> pricing = section(root, 'pricing');
    settings.discountLimit = amount(
      pricing,
      'discountLimit',
      settings.discountLimit
    );
    settings.standardTerms = text(
      pricing,
      'standardTerms',
      settings.standardTerms
    );
    settings.quoteValidDays = amount(
        pricing,
        'quoteValidDays',
        settings.quoteValidDays
      )
      .intValue();
    settings.marginFloor = amount(pricing, 'marginFloor', 0);
    settings.termDefaultMonths = amount(pricing, 'termDefaultMonths', 12)
      .intValue();
    settings.renewalUplift = amount(pricing, 'renewalUplift', 0);
    settings.renewalLeadDays = amount(pricing, 'renewalLeadDays', 60)
      .intValue();
    settings.expireQuotes = flag(pricing, 'expireQuotes', true);
    settings.allowPriceEdit = flag(pricing, 'allowPriceEdit', false);

    Map<String, Object> approvals = section(root, 'approvals');
    settings.approvalsMode = text(approvals, 'mode', 'simple');
    try {
      if (approvals.get('rules') instanceof List<Object>) {
        settings.approvalRules = (List<ApprovalRule>) JSON.deserialize(
          JSON.serialize(approvals.get('rules')),
          List<ApprovalRule>.class
        );
      }
    } catch (Exception e) {
      settings.approvalRules = new List<ApprovalRule>();
    }
    if (approvals.get('delegates') instanceof List<Object>) {
      for (Object row : (List<Object>) approvals.get('delegates')) {
        if (row instanceof Map<String, Object>) {
          Map<String, Object> delegate = (Map<String, Object>) row;
          String fromUser = text(delegate, 'from', null);
          String toUser = text(delegate, 'to', null);
          String until = text(delegate, 'until', null);
          Boolean live = until == null;
          if (!live) {
            try {
              live = Date.valueOf(until) >= Date.today();
            } catch (Exception e) {
              live = true;
            }
          }
          if (
            live &&
            fromUser instanceof Id &&
            toUser instanceof Id
          ) {
            settings.delegates.put((Id) fromUser, (Id) toUser);
          }
        }
      }
    }
    try {
      if (root.get('productRules') instanceof List<Object>) {
        settings.productRules = (List<ProductRule>) JSON.deserialize(
          JSON.serialize(root.get('productRules')),
          List<ProductRule>.class
        );
      }
    } catch (Exception e) {
      settings.productRules = new List<ProductRule>();
    }
    Map<String, Object> automation = section(root, 'automation');
    try {
      if (automation.get('rules') instanceof List<Object>) {
        settings.automationRules = (List<AutomationRule>) JSON.deserialize(
          JSON.serialize(automation.get('rules')),
          List<AutomationRule>.class
        );
      }
    } catch (Exception e) {
      settings.automationRules = new List<AutomationRule>();
    }

    Map<String, Object> billing = section(root, 'billing');
    // an empty prefix is a valid choice, so only a missing one falls back
    if (billing.get('invoicePrefix') instanceof String) {
      settings.invoicePrefix = (String) billing.get('invoicePrefix');
    }
    settings.invoiceDueDays = amount(
        billing,
        'invoiceDueDays',
        settings.invoiceDueDays
      )
      .intValue();
    settings.lateFeePercent = amount(billing, 'lateFeePercent', 0);
    Map<String, Object> schedule = section(billing, 'schedule');
    settings.scheduleFrequency = text(schedule, 'frequency', 'yearly');
    settings.billInAdvance = flag(schedule, 'inAdvance', true);
    settings.billingDay = amount(schedule, 'billingDay', 0).intValue();
    settings.consolidate = flag(schedule, 'consolidate', false);
    settings.autoRunBilling = flag(schedule, 'autoRun', true);
    settings.chargeLateFee = flag(billing, 'chargeLateFee', false);
    settings.prorate = flag(billing, 'prorate', true);
    settings.usageEnabled = flag(billing, 'usageEnabled', true);
    settings.autoRenew = flag(billing, 'autoRenew', true);
    settings.expireContracts = flag(billing, 'expireContracts', true);
    try {
      if (billing.get('dunning') instanceof List<Object>) {
        settings.dunning = (List<DunningStep>) JSON.deserialize(
          JSON.serialize(billing.get('dunning')),
          List<DunningStep>.class
        );
      }
    } catch (Exception e) {
      settings.dunning = new List<DunningStep>();
    }
    if (settings.dunning.isEmpty() && billing.get('reminderDays') instanceof List<Object>) {
      // the older setting: reminders on these days after the due date
      for (Object days : (List<Object>) billing.get('reminderDays')) {
        DunningStep step = new DunningStep();
        step.days = Decimal.valueOf(String.valueOf(days)).intValue();
        step.action = 'email';
        step.template = 'reminder';
        settings.dunning.add(step);
      }
    }

    Map<String, Object> revenue = section(root, 'revenue');
    settings.revenueMethod = text(revenue, 'method', 'ratable');
    settings.revenuePeriods = text(revenue, 'periods', 'monthly');
    settings.autoRecognize = flag(revenue, 'autoRecognize', true);

    Map<String, Object> tax = section(root, 'tax');
    settings.taxProvider = text(tax, 'provider', 'builtin');
    settings.taxExemptions = flag(tax, 'exemptions', true);
    settings.vatCheck = flag(tax, 'vatCheck', true);
    Map<String, Object> eInvoice = section(tax, 'eInvoice');
    settings.eInvoiceEnabled = flag(eInvoice, 'enabled', false);
    settings.eInvoiceProvider = text(eInvoice, 'provider', 'manual');

    Map<String, Object> fx = section(root, 'fx');
    settings.fxProvider = text(fx, 'provider', 'none');
    settings.fxAutoFetch = flag(fx, 'autoFetch', false);

    Map<String, Object> payments = section(root, 'payments');
    settings.gateway = text(payments, 'gateway', 'manual');
    settings.paymentLinks = flag(payments, 'paymentLinks', true);
    settings.autoPay = flag(payments, 'autoPay', false);

    Map<String, Object> documents = section(root, 'documents');
    try {
      if (documents.get('templates') instanceof List<Object>) {
        settings.docTemplates = (List<DocTemplate>) JSON.deserialize(
          JSON.serialize(documents.get('templates')),
          List<DocTemplate>.class
        );
      }
      if (documents.get('clauses') instanceof List<Object>) {
        settings.clauses = (List<Clause>) JSON.deserialize(
          JSON.serialize(documents.get('clauses')),
          List<Clause>.class
        );
      }
    } catch (Exception e) {
      settings.docTemplates = new List<DocTemplate>();
      settings.clauses = new List<Clause>();
    }
    Map<String, Object> emails = section(root, 'emails');
    settings.emailFromName = text(emails, 'fromName', null);
    settings.emailReplyTo = text(emails, 'replyTo', null);
    settings.emailCc = text(emails, 'cc', null);
    try {
      if (emails.get('templates') instanceof List<Object>) {
        for (
          MailTemplate template : (List<MailTemplate>) JSON.deserialize(
            JSON.serialize(emails.get('templates')),
            List<MailTemplate>.class
          )
        ) {
          if (template.key != null) {
            settings.emailTemplates.put(template.key, template);
          }
        }
      }
    } catch (Exception e) {
      settings.emailTemplates = new Map<String, MailTemplate>();
    }

    Map<String, Object> layouts = section(root, 'layouts');
    for (String screen : layouts.keySet()) {
      Map<String, Object> layout = section(layouts, screen);
      List<String> names = new List<String>();
      if (layout.get('fields') instanceof List<Object>) {
        for (Object name : (List<Object>) layout.get('fields')) {
          if (name instanceof String && String.isNotBlank((String) name)) {
            names.add((String) name);
          }
        }
      }
      settings.layouts.put(screen, names);
    }
    Map<String, Object> formats = section(root, 'numbering');
    for (String kind : formats.keySet()) {
      Map<String, Object> format = section(formats, kind);
      if (format.isEmpty()) {
        continue;
      }
      NumberFormat value = new NumberFormat();
      value.prefix = format.get('prefix') instanceof String
        ? (String) format.get('prefix')
        : '';
      value.digits = amount(format, 'digits', 0).intValue();
      settings.numbering.put(kind, value);
    }
    Map<String, Object> permissions = section(root, 'permissions');
    for (String action : permissions.keySet()) {
      String name = text(permissions, action, null);
      if (name != null) {
        settings.permissions.put(action, name);
      }
    }
    Map<String, Object> plugins = section(root, 'plugins');
    for (String engine : plugins.keySet()) {
      String name = text(plugins, engine, null);
      if (name != null) {
        settings.plugins.put(engine, name);
      }
    }
    Map<String, Object> portal = section(root, 'portal');
    settings.portalEnabled = flag(portal, 'enabled', true);
    settings.portalUrl = text(portal, 'siteUrl', '');
    settings.portalAccept = flag(portal, 'allowAccept', true);
    settings.portalPay = flag(portal, 'allowPay', true);

    Map<String, Object> notifications = section(root, 'notifications');
    for (String key : notifications.keySet()) {
      if (notifications.get(key) instanceof Boolean) {
        settings.notifications.put(key, (Boolean) notifications.get(key));
      }
    }
    Map<String, Object> channels = section(notifications, 'channels');
    settings.notifyInApp = flag(channels, 'inApp', true);
    settings.notifyEmail = flag(channels, 'email', true);
    settings.slackEnabled = flag(channels, 'slack', false);
    settings.jobsHour = amount(section(root, 'jobs'), 'dailyHour', 2).intValue();

    Map<String, Object> sync = section(root, 'sync');
    if (sync.get('rules') instanceof List<Object>) {
      for (Object row : (List<Object>) sync.get('rules')) {
        if (!(row instanceof Map<String, Object>)) {
          continue;
        }
        Map<String, Object> values = (Map<String, Object>) row;
        SyncRule rule = new SyncRule();
        rule.moment = text(values, 'trigger', null);
        rule.target = text(values, 'target', null);
        rule.field = text(values, 'field', null);
        rule.source = text(values, 'source', 'value');
        rule.value = values.get('value') == null
          ? null
          : String.valueOf(values.get('value'));
        if (rule.moment != null && rule.target != null && rule.field != null) {
          settings.syncRules.add(rule);
        }
      }
    }
    return settings;
  }

  /** Whether a notification kind is on (every kind is on until switched off). */
  public Boolean notifies(String kind) {
    return notifications.get(kind) != false;
  }

  // A market from its JSON, over the values `market` starts with
  private static Market market(Map<String, Object> tax, Market market) {
    market.country = text(tax, 'country', market.country);
    market.countryName = text(tax, 'countryName', market.countryName);
    market.currencyCode = text(tax, 'currency', market.currencyCode);
    market.taxMode = text(tax, 'mode', market.taxMode);
    market.taxSystem = text(tax, 'system', market.taxSystem);
    market.taxRate = amount(tax, 'rate', market.taxRate);
    market.crossLabel = text(tax, 'crossLabel', market.crossLabel);
    market.pricesIncludeTax = tax.get('pricesIncludeTax') == true;
    market.exchangeRate = amount(tax, 'exchangeRate', market.exchangeRate);
    String priceBook = text(tax, 'priceBookId', null);
    if (priceBook instanceof Id) {
      market.priceBookId = (Id) priceBook;
    }
    if (tax.get('splitLabels') instanceof List<Object>) {
      List<Object> labels = (List<Object>) tax.get('splitLabels');
      if (labels.size() == 2) {
        market.splitLabels = new List<String>{
          String.valueOf(labels[0]),
          String.valueOf(labels[1])
        };
      }
    }
    if (tax.get('regionRates') instanceof List<Object>) {
      market.regionRates = new Map<String, Decimal>();
      for (Object row : (List<Object>) tax.get('regionRates')) {
        Map<String, Object> regionRate = (Map<String, Object>) row;
        String region = text(regionRate, 'region', null);
        if (region != null) {
          market.regionRates.put(region, amount(regionRate, 'rate', 0));
        }
      }
    }
    if (tax.get('categories') instanceof List<Object>) {
      market.categoryRates = new Map<String, Decimal>();
      for (Object row : (List<Object>) tax.get('categories')) {
        if (row instanceof Map<String, Object>) {
          Map<String, Object> category = (Map<String, Object>) row;
          String name = text(category, 'name', null);
          if (name != null) {
            market.categoryRates.put(
              name.toLowerCase(),
              amount(category, 'rate', 0)
            );
          }
        }
      }
    }
    return market;
  }

  private static Map<String, Object> section(
    Map<String, Object> root,
    String key
  ) {
    Object value = root.get(key);
    return value instanceof Map<String, Object>
      ? (Map<String, Object>) value
      : new Map<String, Object>();
  }

  private static String text(
    Map<String, Object> values,
    String key,
    String fallback
  ) {
    Object value = values.get(key);
    return value instanceof String && String.isNotBlank((String) value)
      ? ((String) value).trim()
      : fallback;
  }

  private static Boolean flag(
    Map<String, Object> values,
    String key,
    Boolean fallback
  ) {
    Object value = values.get(key);
    return value instanceof Boolean ? (Boolean) value : fallback;
  }

  // A number, however the JSON wrote it. An empty or unreadable value falls back.
  private static Decimal amount(
    Map<String, Object> values,
    String key,
    Decimal fallback
  ) {
    Object value = values.get(key);
    if (value == null || value instanceof Boolean) {
      return fallback;
    }
    try {
      return Decimal.valueOf(String.valueOf(value).trim());
    } catch (TypeException e) {
      return fallback;
    }
  }
}