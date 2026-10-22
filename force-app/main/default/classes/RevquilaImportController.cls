/**
 * Setup > Import and export: CSV in for products, prices, accounts, contracted prices and
 * usage; CSV out for quotes, invoices, subscriptions, products and payments. The first row of
 * an import is the header; columns are matched by name, in any order, case ignored.
 */
public with sharing class RevquilaImportController {
  public class Result {
    @AuraEnabled
    public Integer created = 0;
    @AuraEnabled
    public Integer updated = 0;
    @AuraEnabled
    public List<String> errors = new List<String>();
  }

  /** The columns each import reads, for the screen. */
  @AuraEnabled(cacheable=true)
  public static Map<String, List<String>> getTemplates() {
    return new Map<String, List<String>>{
      'products' => new List<String>{ 'Name', 'Code', 'Family', 'Unit', 'Price', 'Recurring', 'Cost', 'Billing Frequency', 'Pricing Method', 'Tax Category' },
      'prices' => new List<String>{ 'Code', 'Price' },
      'accounts' => new List<String>{ 'Name', 'City', 'State', 'Country', 'Tax Registration Number', 'Segment', 'Billing Email', 'Payment Terms' },
      'contracted' => new List<String>{ 'Account', 'Code', 'Unit Price', 'Discount', 'From', 'Until' },
      'usage' => new List<String>{ 'Subscription', 'Code', 'Date', 'Quantity', 'Note' }
    };
  }

  @AuraEnabled
  public static Result importCsv(String kind, String csv) {
    Result result = new Result();
    try {
      List<List<String>> rows = parse(csv);
      RevquilaCore.need(rows.size() > 1, 'The file has a header and no rows.');
      List<String> header = new List<String>();
      for (String cell : rows[0]) {
        header.add(cell.trim().toLowerCase());
      }
      rows.remove(0);
      RevquilaCore.need(rows.size() <= 2000, 'Import at most 2,000 rows at a time.');
      if (kind == 'products' || kind == 'prices') {
        RevquilaCore.need(RevquilaCore.allowed('catalog'), 'You need the Manage Catalog permission to import products.');
        importProducts(kind, header, rows, result);
      } else if (kind == 'accounts') {
        importAccounts(header, rows, result);
      } else if (kind == 'contracted') {
        RevquilaCore.need(RevquilaCore.allowed('catalog'), 'You need the Manage Catalog permission to import contracted prices.');
        importContracted(header, rows, result);
      } else if (kind == 'usage') {
        importUsage(header, rows, result);
      } else {
        throw new RevquilaCore.ProblemException('Pick what the file holds.');
      }
      return result;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static String cell(List<String> header, List<String> row, String name) {
    Integer index = header.indexOf(name);
    if (index < 0 || index >= row.size()) {
      return null;
    }
    String value = row[index].trim();
    return String.isBlank(value) ? null : value;
  }

  private static Decimal toNumber(String value) {
    if (String.isBlank(value)) {
      return null;
    }
    return Decimal.valueOf(value.replaceAll('[^0-9.\\-]', ''));
  }

  private static Boolean yes(String value) {
    return value != null && new Set<String>{ 'true', 'yes', 'y', '1', 'on' }.contains(value.toLowerCase());
  }

  private static void importProducts(String kind, List<String> header, List<List<String>> rows, Result result) {
    Set<String> codes = new Set<String>();
    for (List<String> row : rows) {
      String code = cell(header, row, 'code');
      if (code != null) {
        codes.add(code);
      }
    }
    Map<String, Product2> byCode = new Map<String, Product2>();
    for (Product2 product : [SELECT Id, ProductCode FROM Product2 WHERE ProductCode IN :codes WITH USER_MODE]) {
      byCode.put(product.ProductCode, product);
    }
    Id bookId = RevquilaPricing.standardPriceBookId();
    Map<Id, PricebookEntry> entries = new Map<Id, PricebookEntry>();
    for (PricebookEntry entry : [SELECT Id, Product2Id FROM PricebookEntry WHERE Pricebook2Id = :bookId AND Product2.ProductCode IN :codes WITH USER_MODE]) {
      entries.put(entry.Product2Id, entry);
    }
    Integer line = 1;
    for (List<String> row : rows) {
      line++;
      try {
        String code = cell(header, row, 'code');
        Decimal price = toNumber(cell(header, row, 'price'));
        Product2 product = code == null ? null : byCode.get(code);
        if (kind == 'prices') {
          RevquilaCore.need(product != null, 'no product with code ' + code);
          RevquilaCore.need(price != null && price >= 0, 'no price');
        } else {
          String name = cell(header, row, 'name');
          RevquilaCore.need(name != null || product != null, 'no name');
          Product2 change = new Product2(
            Name = name,
            ProductCode = code,
            Family = cell(header, row, 'family'),
            Unit__c = cell(header, row, 'unit'),
            Recurring__c = yes(cell(header, row, 'recurring')),
            Cost__c = toNumber(cell(header, row, 'cost')),
            Billing_Frequency__c = cell(header, row, 'billing frequency') == null ? null : cell(header, row, 'billing frequency').toLowerCase(),
            Pricing_Method__c = cell(header, row, 'pricing method') == null ? null : cell(header, row, 'pricing method').toLowerCase().replace(' ', '_'),
            Tax_Category__c = cell(header, row, 'tax category'),
            IsActive = true
          );
          if (product == null) {
            insert as user change;
            product = change;
            result.created++;
            if (code != null) {
              byCode.put(code, product);
            }
          } else {
            change.Id = product.Id;
            if (change.Name == null) {
              change.Name = null;
              change = new Product2(Id = product.Id, Family = change.Family, Unit__c = change.Unit__c, Recurring__c = change.Recurring__c, Cost__c = change.Cost__c);
            }
            update as user change;
            result.updated++;
          }
        }
        if (price != null) {
          PricebookEntry entry = entries.get(product.Id);
          if (entry == null) {
            insert as user new PricebookEntry(Pricebook2Id = bookId, Product2Id = product.Id, UnitPrice = price, IsActive = true);
          } else {
            update as user new PricebookEntry(Id = entry.Id, UnitPrice = price, IsActive = true);
          }
          if (kind == 'prices') {
            result.updated++;
          }
        }
      } catch (Exception e) {
        result.errors.add('Row ' + line + ': ' + e.getMessage());
      }
    }
  }

  private static void importAccounts(List<String> header, List<List<String>> rows, Result result) {
    Database.DMLOptions options = new Database.DMLOptions();
    options.DuplicateRuleHeader.allowSave = true;
    Integer line = 1;
    for (List<String> row : rows) {
      line++;
      try {
        String name = cell(header, row, 'name');
        RevquilaCore.need(name != null, 'no name');
        List<Account> existing = [SELECT Id FROM Account WHERE Name = :name WITH USER_MODE LIMIT 1];
        Account account = new Account(
          Name = name,
          BillingCity = cell(header, row, 'city'),
          BillingState = cell(header, row, 'state'),
          BillingCountry = cell(header, row, 'country'),
          Tax_Registration_Number__c = cell(header, row, 'tax registration number'),
          Segment__c = cell(header, row, 'segment'),
          Billing_Email__c = cell(header, row, 'billing email'),
          Payment_Terms__c = cell(header, row, 'payment terms')
        );
        if (existing.isEmpty()) {
          Database.insert(account, options, AccessLevel.USER_MODE);
          result.created++;
        } else {
          account.Id = existing[0].Id;
          Database.update(account, options, AccessLevel.USER_MODE);
          result.updated++;
        }
      } catch (Exception e) {
        result.errors.add('Row ' + line + ': ' + e.getMessage());
      }
    }
  }

  private static void importContracted(List<String> header, List<List<String>> rows, Result result) {
    Integer line = 1;
    for (List<String> row : rows) {
      line++;
      try {
        String accountName = cell(header, row, 'account');
        String code = cell(header, row, 'code');
        List<Account> accounts = [SELECT Id FROM Account WHERE Name = :accountName WITH USER_MODE LIMIT 1];
        List<Product2> products = [SELECT Id FROM Product2 WHERE ProductCode = :code WITH USER_MODE LIMIT 1];
        RevquilaCore.need(!accounts.isEmpty(), 'no account ' + accountName);
        RevquilaCore.need(!products.isEmpty(), 'no product with code ' + code);
        String fromText = cell(header, row, 'from');
        String untilText = cell(header, row, 'until');
        insert as user new Contracted_Price__c(
          Account__c = accounts[0].Id,
          Product__c = products[0].Id,
          Unit_Price__c = toNumber(cell(header, row, 'unit price')),
          Discount__c = toNumber(cell(header, row, 'discount')),
          Start_Date__c = fromText == null ? null : Date.valueOf(fromText),
          End_Date__c = untilText == null ? null : Date.valueOf(untilText),
          Active__c = true,
          Note__c = 'Imported'
        );
        result.created++;
      } catch (Exception e) {
        result.errors.add('Row ' + line + ': ' + e.getMessage());
      }
    }
  }

  private static void importUsage(List<String> header, List<List<String>> rows, Result result) {
    Integer line = 1;
    List<Usage_Record__c> records = new List<Usage_Record__c>();
    for (List<String> row : rows) {
      line++;
      try {
        String subscription = cell(header, row, 'subscription');
        String code = cell(header, row, 'code');
        List<Subscription_Item__c> items = [
          SELECT Id, Subscription__c
          FROM Subscription_Item__c
          WHERE (Subscription__r.Name = :subscription OR Subscription__r.Display_Number__c = :subscription)
            AND Product__r.ProductCode = :code AND Usage_Based__c = TRUE
          WITH USER_MODE
          LIMIT 1
        ];
        RevquilaCore.need(!items.isEmpty(), 'no usage item ' + code + ' on ' + subscription);
        String day = cell(header, row, 'date');
        records.add(
          new Usage_Record__c(
            Subscription_Item__c = items[0].Id,
            Subscription__c = items[0].Subscription__c,
            Usage_Date__c = day == null ? Date.today() : Date.valueOf(day),
            Quantity__c = toNumber(cell(header, row, 'quantity')),
            Note__c = cell(header, row, 'note')
          )
        );
      } catch (Exception e) {
        result.errors.add('Row ' + line + ': ' + e.getMessage());
      }
    }
    insert as user records;
    result.created += records.size();
  }

  // ---------------------------------------------------------------- export

  @AuraEnabled
  public static String exportCsv(String kind) {
    try {
      List<String> lines = new List<String>();
      if (kind == 'quotes') {
        lines.add('Number,Account,Status,Type,Date,Valid until,Currency,Net,Tax,Total,Net (home),Owner');
        for (Quote__c row : [SELECT Name, Display_Number__c, Account__r.Name, Status__c, Type__c, Quote_Date__c, Valid_Until__c, Currency_Code__c, Net_Amount__c, Tax_Amount__c, Total__c, Base_Net_Amount__c, Owner.Name FROM Quote__c WITH USER_MODE ORDER BY Quote_Date__c DESC LIMIT 5000]) {
          lines.add(csvRow(new List<Object>{ RevquilaCore.shownNumber(row), row.Account__r?.Name, row.Status__c, row.Type__c, row.Quote_Date__c, row.Valid_Until__c, row.Currency_Code__c, row.Net_Amount__c, row.Tax_Amount__c, row.Total__c, row.Base_Net_Amount__c, row.Owner.Name }));
        }
      } else if (kind == 'invoices') {
        lines.add('Number,Account,Kind,Issued,Due,Currency,Net,Tax,Total,Paid,Credited,Refunded,Balance,Written off');
        for (Invoice__c row : [SELECT Number__c, Account__r.Name, Kind__c, Issued_On__c, Due_On__c, Currency_Code__c, Net_Amount__c, Tax_Amount__c, Total__c, Paid_Amount__c, Credited_Amount__c, Refunded_Amount__c, Balance__c, Written_Off__c FROM Invoice__c WITH USER_MODE ORDER BY Issued_On__c DESC LIMIT 5000]) {
          lines.add(csvRow(new List<Object>{ row.Number__c, row.Account__r?.Name, row.Kind__c, row.Issued_On__c, row.Due_On__c, row.Currency_Code__c, row.Net_Amount__c, row.Tax_Amount__c, row.Total__c, row.Paid_Amount__c, row.Credited_Amount__c, row.Refunded_Amount__c, row.Balance__c, row.Written_Off__c }));
        }
      } else if (kind == 'subscriptions') {
        lines.add('Number,Account,Status,Start,Renewal,Billing,Currency,MRR,Auto-renew');
        for (Subscription__c row : [SELECT Name, Display_Number__c, Account__r.Name, Status__c, Start_Date__c, Renewal_Date__c, Billing_Frequency__c, Currency_Code__c, Contract_MRR__c, Auto_Renew__c FROM Subscription__c WITH USER_MODE ORDER BY Renewal_Date__c LIMIT 5000]) {
          lines.add(csvRow(new List<Object>{ RevquilaCore.shownNumber(row), row.Account__r?.Name, row.Status__c, row.Start_Date__c, row.Renewal_Date__c, row.Billing_Frequency__c, row.Currency_Code__c, row.Contract_MRR__c, row.Auto_Renew__c }));
        }
      } else if (kind == 'payments') {
        lines.add('Payment,Invoice,Account,Paid on,Amount,Amount (home),Method,Reference,Gateway');
        for (Payment__c row : [SELECT Name, Invoice__r.Number__c, Invoice__r.Account__r.Name, Paid_On__c, Amount__c, Base_Amount__c, Method__c, Reference__c, Gateway__c FROM Payment__c WITH USER_MODE ORDER BY Paid_On__c DESC LIMIT 5000]) {
          lines.add(csvRow(new List<Object>{ row.Name, row.Invoice__r?.Number__c, row.Invoice__r?.Account__r?.Name, row.Paid_On__c, row.Amount__c, row.Base_Amount__c, row.Method__c, row.Reference__c, row.Gateway__c }));
        }
      } else {
        lines.add('Name,Code,Family,Unit,Price,Recurring,Cost,Billing Frequency,Pricing Method,Tax Category');
        for (RevquilaPricing.Product product : RevquilaPricing.products()) {
          lines.add(csvRow(new List<Object>{ product.name, product.code, product.family, product.unit, product.price, product.recurring, product.cost, product.billingFrequency, product.pricingMethod, product.taxCategory }));
        }
      }
      return String.join(lines, '\n');
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  private static String csvRow(List<Object> values) {
    List<String> cells = new List<String>();
    for (Object value : values) {
      if (value == null) {
        cells.add('');
      } else if (value instanceof String) {
        cells.add(RevquilaRevenue.csv((String) value));
      } else {
        cells.add(String.valueOf(value));
      }
    }
    return String.join(cells, ',');
  }

  // A CSV with quoted cells, doubled quotes and line breaks inside quotes
  @TestVisible
  private static List<List<String>> parse(String csv) {
    List<List<String>> rows = new List<List<String>>();
    if (String.isBlank(csv)) {
      return rows;
    }
    List<String> row = new List<String>();
    String current = '';
    Boolean quoted = false;
    Integer length = csv.length();
    for (Integer index = 0; index < length; index++) {
      String ch = csv.substring(index, index + 1);
      if (quoted) {
        if (ch == '"') {
          if (index + 1 < length && csv.substring(index + 1, index + 2) == '"') {
            current += '"';
            index++;
          } else {
            quoted = false;
          }
        } else {
          current += ch;
        }
      } else if (ch == '"') {
        quoted = true;
      } else if (ch == ',') {
        row.add(current);
        current = '';
      } else if (ch == '\n' || ch == '\r') {
        if (ch == '\r' && index + 1 < length && csv.substring(index + 1, index + 2) == '\n') {
          index++;
        }
        row.add(current);
        current = '';
        if (!(row.size() == 1 && String.isBlank(row[0]))) {
          rows.add(row);
        }
        row = new List<String>();
      } else {
        current += ch;
      }
    }
    row.add(current);
    if (!(row.size() == 1 && String.isBlank(row[0]))) {
      rows.add(row);
    }
    return rows;
  }
}