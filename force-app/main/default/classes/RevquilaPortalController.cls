/**
 * The customer portal: three Visualforce pages a Salesforce Site serves to customers who
 * have a link (?t=<token>): a quote they can read and accept, an invoice they can read and
 * pay, and their account (open invoices and subscriptions). The token is the only key, so
 * this class reads without sharing, and only the record the token opens and its account.
 * Acceptance is recorded on the quote's timeline and the owner is told; the rep marks the
 * quote as signed.
 */
public without sharing class RevquilaPortalController {
  public class Line {
    public String name { get; set; }
    public String unit { get; set; }
    public String qty { get; set; }
    public String price { get; set; }
    public String discount { get; set; }
    public String net { get; set; }
  }

  public class Row {
    public String label { get; set; }
    public String value { get; set; }
    public String url { get; set; }
    public String tone { get; set; }
  }

  public String companyName { get; private set; }
  public String accent { get; private set; }
  public Boolean found { get; private set; }
  public String kind { get; private set; }
  public String title { get; private set; }
  public String docNumber { get; private set; }
  public String accountName { get; private set; }
  public String status { get; private set; }
  public List<Row> facts { get; private set; }
  public List<Line> lines { get; private set; }
  public List<Row> totals { get; private set; }
  public List<Row> related { get; private set; }
  public String notes { get; private set; }
  public String payLink { get; private set; }
  public String bankDetails { get; private set; }
  public Boolean canAccept { get; private set; }
  public Boolean canPay { get; private set; }
  public Boolean accepted { get; private set; }
  public String message { get; private set; }
  public String acceptName { get; set; }
  public String acceptEmail { get; set; }
  public String acceptTitle { get; set; }
  public String signatureData { get; set; }
  public String auditJson { get; set; }
  public Boolean acceptTerms { get; set; }
  public String signedByName { get; private set; }
  public String signedByTitle { get; private set; }
  public Date signedOn { get; private set; }
  public String savedSignature { get; private set; }
  public Boolean paymentSuccess { get; private set; }
  public String gatewayName { get; private set; }
  public String balanceFormatted { get; private set; }
  public String paymentErrorMessage { get; private set; }

  public Id recordId { get; private set; }
  public Id accountId { get; private set; }
  public String token { get; private set; }

  public RevquilaPortalController() {
    RevquilaSettings settings = RevquilaSettings.current();
    companyName = settings.companyName;
    gatewayName = settings.gateway;
    accent = '#0176d3';
    facts = new List<Row>();
    lines = new List<Line>();
    totals = new List<Row>();
    related = new List<Row>();
    found = false;
    canAccept = false;
    canPay = false;
    accepted = false;
    acceptTerms = false;
    String rzpStatus = ApexPages.currentPage().getParameters().get('razorpay_payment_link_status');
    String rzpPaymentId = ApexPages.currentPage().getParameters().get('razorpay_payment_id');
    paymentSuccess = (rzpStatus == 'paid' || String.isNotBlank(rzpPaymentId));
    try {
      String brand = brandAccent();
      if (brand != null) {
        accent = brand;
      }
    } catch (Exception e) {
      accent = '#0176d3';
    }
    token = ApexPages.currentPage().getParameters().get('t');
    if (String.isBlank(token) || !Pattern.matches('[0-9a-fA-F]{32}', token)) {
      return;
    }
    String page = '';
    try {
      if (ApexPages.currentPage() != null && ApexPages.currentPage().getUrl() != null) {
        page = ApexPages.currentPage().getUrl().toLowerCase();
      }
    } catch (Exception ex) {}

    if (page.contains('revquilaportalinvoice') || page.contains('portalinvoice')) {
      loadInvoice(settings);
    } else if (page.contains('revquilaportalquote') || page.contains('portalquote')) {
      loadQuote(settings);
    } else {
      // Robust fallback: auto-detect by token whether record is a Quote or Invoice
      List<Quote__c> qCheck = [SELECT Id FROM Quote__c WHERE Portal_Token__c = :token WITH SYSTEM_MODE LIMIT 1];
      if (!qCheck.isEmpty()) {
        loadQuote(settings);
      } else {
        List<Invoice__c> invCheck = [SELECT Id FROM Invoice__c WHERE Portal_Token__c = :token WITH SYSTEM_MODE LIMIT 1];
        if (!invCheck.isEmpty()) {
          loadInvoice(settings);
        } else {
          loadAccount();
        }
      }
    }
  }

  private static String brandAccent() {
    List<Config_Version__c> latest = [SELECT Payload__c FROM Config_Version__c WITH SYSTEM_MODE ORDER BY Version__c DESC LIMIT 1];
    if (latest.isEmpty()) {
      return null;
    }
    Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(latest[0].Payload__c);
    Object brand = root.get('brand');
    if (brand instanceof Map<String, Object>) {
      Object value = ((Map<String, Object>) brand).get('accent');
      if (value instanceof String && Pattern.matches('#[0-9a-fA-F]{6}', (String) value)) {
        return (String) value;
      }
    }
    return null;
  }

  private static String money(Decimal amount, String currencyCode) {
    return (currencyCode == null ? '' : currencyCode + ' ') + RevquilaCore.money(amount).format();
  }

  private void loadQuote(RevquilaSettings settings) {
    List<Quote__c> rows = [
      SELECT Id, Name, Display_Number__c, Account__c, Account__r.Name, Status__c, Quote_Date__c, Valid_Until__c, Payment_Terms__c,
        Currency_Code__c, Subtotal__c, Discount_Total__c, Net_Amount__c, Tax_Amount__c, Total__c, Tax_Breakup__c, Notes__c,
        Reference__c, OwnerId, Signed_On__c, Signed_By_Name__c, Signed_By_Title__c, Signature_Data__c,
        (SELECT Description__c, Unit__c, Quantity__c, Unit_Price__c, Discount__c, Rule_Discount__c, Net_Amount__c, Optional__c
          FROM Lines__r ORDER BY Sort_Order__c)
      FROM Quote__c
      WHERE Portal_Token__c = :token
      WITH SYSTEM_MODE
      LIMIT 1
    ];
    if (rows.isEmpty()) {
      return;
    }
    Quote__c quote = rows[0];
    found = true;
    kind = 'quote';
    recordId = quote.Id;
    accountId = quote.Account__c;
    title = 'Quotation';
    docNumber = RevquilaCore.shownNumber(quote);
    accountName = quote.Account__r.Name;
    status = quote.Status__c;
    signedOn = quote.Signed_On__c;
    signedByName = quote.Signed_By_Name__c;
    signedByTitle = quote.Signed_By_Title__c;
    savedSignature = quote.Signature_Data__c;
    facts.add(fact('Reference', quote.Reference__c));
    facts.add(fact('Date', quote.Quote_Date__c == null ? '' : RevquilaCore.dayText(quote.Quote_Date__c)));
    facts.add(fact('Valid until', quote.Valid_Until__c == null ? '' : RevquilaCore.dayText(quote.Valid_Until__c)));
    facts.add(fact('Payment terms', quote.Payment_Terms__c));
    for (Quote_Line__c row : quote.Lines__r) {
      lines.add(line(row.Description__c + (row.Optional__c ? ' (optional)' : ''), row.Unit__c, row.Quantity__c, row.Unit_Price__c, RevquilaCore.orZero(row.Discount__c) + RevquilaCore.orZero(row.Rule_Discount__c), row.Net_Amount__c, quote.Currency_Code__c));
    }
    addTotals(quote.Subtotal__c, quote.Discount_Total__c, quote.Net_Amount__c, quote.Tax_Breakup__c, quote.Total__c, quote.Currency_Code__c);
    notes = quote.Notes__c;
    accepted = quote.Status__c == 'signed' || quote.Signed_On__c != null || [SELECT COUNT() FROM Revenue_Event__c WHERE Quote__c = :quote.Id AND Kind__c = 'accepted' WITH SYSTEM_MODE] > 0;
    canAccept = settings.portalAccept && quote.Status__c == 'sent' && !accepted && (quote.Valid_Until__c == null || quote.Valid_Until__c >= Date.today());
  }

  private void loadInvoice(RevquilaSettings settings) {
    List<Invoice__c> rows = [
      SELECT Id, Number__c, Account__c, Account__r.Name, Issued_On__c, Due_On__c, Payment_Terms__c, Currency_Code__c, Subtotal__c,
        Discount_Total__c, Net_Amount__c, Tax_Amount__c, Total__c, Tax_Breakup__c, Balance__c, Paid_Amount__c, Payment_Link__c,
        Notes__c, Reference__c, Sent_On__c,
        (SELECT Description__c, Unit__c, Quantity__c, Unit_Price__c, Discount__c, Rule_Discount__c, Net_Amount__c FROM Lines__r ORDER BY Sort_Order__c)
      FROM Invoice__c
      WHERE Portal_Token__c = :token
      WITH SYSTEM_MODE
      LIMIT 1
    ];
    if (rows.isEmpty()) {
      return;
    }
    Invoice__c invoice = rows[0];
    found = true;
    kind = 'invoice';
    recordId = invoice.Id;
    accountId = invoice.Account__c;
    title = 'Invoice';
    docNumber = invoice.Number__c;
    accountName = invoice.Account__r.Name;
    status = RevquilaCore.orZero(invoice.Balance__c) <= 0 ? 'Paid' : (invoice.Due_On__c != null && invoice.Due_On__c < Date.today() ? 'Overdue' : 'Due');
    facts.add(fact('Issued', invoice.Issued_On__c == null ? '' : RevquilaCore.dayText(invoice.Issued_On__c)));
    facts.add(fact('Due', invoice.Due_On__c == null ? '' : RevquilaCore.dayText(invoice.Due_On__c)));
    facts.add(fact('Payment terms', invoice.Payment_Terms__c));
    facts.add(fact('Balance due', money(invoice.Balance__c, invoice.Currency_Code__c)));
    for (Invoice_Line__c row : invoice.Lines__r) {
      lines.add(line(row.Description__c, row.Unit__c, row.Quantity__c, row.Unit_Price__c, RevquilaCore.orZero(row.Discount__c) + RevquilaCore.orZero(row.Rule_Discount__c), row.Net_Amount__c, invoice.Currency_Code__c));
    }
    addTotals(invoice.Subtotal__c, invoice.Discount_Total__c, invoice.Net_Amount__c, invoice.Tax_Breakup__c, invoice.Total__c, invoice.Currency_Code__c);
    if (RevquilaCore.orZero(invoice.Paid_Amount__c) > 0) {
      totals.add(fact('Paid', '- ' + money(invoice.Paid_Amount__c, invoice.Currency_Code__c)));
      totals.add(fact('Balance due', money(invoice.Balance__c, invoice.Currency_Code__c)));
    }
    notes = invoice.Notes__c;
    balanceFormatted = money(invoice.Balance__c, invoice.Currency_Code__c);
    String link = invoice.Payment_Link__c;
    Boolean hasGateway = settings.portalPay && String.isNotBlank(settings.gateway) && settings.gateway != 'manual';
    Boolean hasExternalLink = String.isNotBlank(link) && !link.containsIgnoreCase('RevquilaPortalInvoice');
    canPay = settings.portalPay && RevquilaCore.orZero(invoice.Balance__c) > 0 && (hasExternalLink || hasGateway);
    payLink = hasExternalLink ? link : null;
    bankDetails = bankDetails();
  }

  private void loadAccount() {
    // the account page opens with a quote's or an invoice's token
    List<Invoice__c> invoices = [SELECT Account__c FROM Invoice__c WHERE Portal_Token__c = :token WITH SYSTEM_MODE LIMIT 1];
    if (!invoices.isEmpty()) {
      accountId = invoices[0].Account__c;
    } else {
      List<Quote__c> quotes = [SELECT Account__c FROM Quote__c WHERE Portal_Token__c = :token WITH SYSTEM_MODE LIMIT 1];
      if (!quotes.isEmpty()) {
        accountId = quotes[0].Account__c;
      }
    }
    if (accountId == null) {
      return;
    }
    found = true;
    kind = 'account';
    title = 'Your account';
    accountName = [SELECT Name FROM Account WHERE Id = :accountId WITH SYSTEM_MODE].Name;
    docNumber = accountName;
    RevquilaSettings settings = RevquilaSettings.current();
    String base = settings.portalUrl == null ? '' : settings.portalUrl.removeEnd('/');
    for (Invoice__c invoice : [
      SELECT Number__c, Balance__c, Due_On__c, Currency_Code__c, Portal_Token__c
      FROM Invoice__c
      WHERE Account__c = :accountId AND Sent_On__c != NULL AND Balance__c > 0
      WITH SYSTEM_MODE
      ORDER BY Due_On__c
      LIMIT 50
    ]) {
      Row row = fact(invoice.Number__c + ' · due ' + (invoice.Due_On__c == null ? '' : RevquilaCore.dayText(invoice.Due_On__c)), money(invoice.Balance__c, invoice.Currency_Code__c));
      if (String.isNotBlank(invoice.Portal_Token__c)) {
        row.url = base + '/' + RevquilaCore.prefix() + 'RevquilaPortalInvoice?t=' + invoice.Portal_Token__c;
      }
      row.tone = invoice.Due_On__c != null && invoice.Due_On__c < Date.today() ? 'bad' : 'acc';
      facts.add(row);
    }
    for (Subscription__c subscription : [
      SELECT Name, Display_Number__c, Status__c, Renewal_Date__c, Contract_MRR__c, Currency_Code__c,
        (SELECT Description__c, Quantity__c FROM Items__r)
      FROM Subscription__c
      WHERE Account__c = :accountId AND Status__c != 'cancelled'
      WITH SYSTEM_MODE
      LIMIT 50
    ]) {
      List<String> items = new List<String>();
      for (Subscription_Item__c item : subscription.Items__r) {
        items.add(item.Quantity__c.intValue() + ' × ' + item.Description__c);
      }
      Row row = fact(RevquilaCore.shownNumber(subscription) + ' · renews ' + (subscription.Renewal_Date__c == null ? '' : RevquilaCore.dayText(subscription.Renewal_Date__c)), String.join(items, ', '));
      row.tone = subscription.Status__c == 'active' ? 'good' : 'mut';
      related.add(row);
    }
  }

  private String bankDetails() {
    List<Config_Version__c> latest = [SELECT Payload__c FROM Config_Version__c WITH SYSTEM_MODE ORDER BY Version__c DESC LIMIT 1];
    if (latest.isEmpty()) {
      return null;
    }
    Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(latest[0].Payload__c);
    Object pdf = root.get('pdf');
    if (pdf instanceof Map<String, Object>) {
      Map<String, Object> settings = (Map<String, Object>) pdf;
      if (settings.get('showBankDetails') == true && settings.get('bankDetails') instanceof String) {
        return (String) settings.get('bankDetails');
      }
    }
    return null;
  }

  private void addTotals(Decimal subtotal, Decimal discount, Decimal net, String taxBreakup, Decimal total, String currencyCode) {
    if (RevquilaCore.orZero(discount) > 0) {
      totals.add(fact('Subtotal', money(subtotal, currencyCode)));
      totals.add(fact('Discount', '- ' + money(discount, currencyCode)));
    }
    totals.add(fact('Net amount', money(net, currencyCode)));
    for (RevquilaPricing.TaxLine tax : RevquilaPricing.taxLines(taxBreakup)) {
      totals.add(fact(tax.label, money(tax.amount, currencyCode)));
    }
    Row grand = fact('Total', money(total, currencyCode));
    grand.tone = 'grand';
    totals.add(grand);
  }

  private static Row fact(String label, String value) {
    Row row = new Row();
    row.label = label;
    row.value = value == null ? '' : value;
    return row;
  }

  private static Line line(String name, String unit, Decimal qty, Decimal price, Decimal discount, Decimal net, String currencyCode) {
    Line row = new Line();
    row.name = name;
    row.unit = unit;
    row.qty = qty == null ? '' : String.valueOf(qty.stripTrailingZeros().toPlainString());
    row.price = RevquilaCore.money(price).format();
    row.discount = discount == null || discount == 0 ? '' : discount.stripTrailingZeros().toPlainString() + '%';
    row.net = RevquilaCore.money(net).format();
    return row;
  }

  /** Records that the customer accepted and e-signed the quote, archives signature, and books order. */
  public PageReference accept() {
    if (!canAccept) {
      message = 'This quote cannot be accepted online any more.';
      return null;
    }
    if (String.isBlank(acceptName) || String.isBlank(acceptEmail) || !acceptEmail.contains('@') || acceptTerms != true) {
      message = 'Enter your name and email, and tick that you accept the quote and its terms.';
      return null;
    }
    if (String.isNotBlank(signatureData)) {
      try {
        RevquilaEsignController.SignResult res = RevquilaEsignController.completeEsign(
          recordId,
          token,
          acceptName,
          acceptEmail,
          acceptTitle,
          signatureData,
          auditJson
        );
        accepted = true;
        canAccept = false;
        signedByName = acceptName.trim();
        signedByTitle = acceptTitle;
        signedOn = Date.today();
        savedSignature = signatureData;
        message = 'Thank you! ' + res.message;
        return null;
      } catch (Exception e) {
        message = 'E-Signature error: ' + e.getMessage();
        return null;
      }
    }
    Quote__c quote = [SELECT Id, Name, Display_Number__c, OwnerId FROM Quote__c WHERE Id = :recordId WITH SYSTEM_MODE];
    Revenue_Event__c entry = RevquilaCore.event(
      quote.Id,
      'Accepted online by ' + acceptName.trim().abbreviate(80),
      acceptEmail.trim().abbreviate(120) + ' · from the customer portal',
      RevquilaCore.TONE_TEAL
    );
    entry.Kind__c = 'accepted';
    Database.insert(entry, true, AccessLevel.SYSTEM_MODE);
    RevquilaCore.notify(new Set<Id>{ quote.OwnerId }, 'quoteSigned', 'Quote ' + RevquilaCore.shownNumber(quote) + ' was accepted online', acceptName.trim() + ' · mark it as signed to book the order', quote.Id);
    RevquilaCore.publish('quote_accepted', quote.Id, new Map<String, Object>{ 'name' => acceptName, 'email' => acceptEmail });
    accepted = true;
    canAccept = false;
    message = 'Thank you. Your acceptance is recorded and ' + companyName + ' will be in touch.';
    return null;
  }

  /** Initiates online payment via Stripe/Razorpay on customer portal. */
  public PageReference payOnline() {
    if (String.isNotBlank(payLink)) {
      PageReference redirect = new PageReference(payLink);
      redirect.setRedirect(true);
      return redirect;
    }
    if (recordId == null) {
      paymentErrorMessage = 'Invoice record not identified.';
      return null;
    }
    try {
      List<Invoice__c> invoices = [
        SELECT Id, Number__c, Balance__c, Currency_Code__c, Portal_Token__c
        FROM Invoice__c
        WHERE Id = :recordId
        WITH SYSTEM_MODE
        LIMIT 1
      ];
      if (invoices.isEmpty() || RevquilaCore.orZero(invoices[0].Balance__c) <= 0) {
        paymentErrorMessage = 'This invoice has already been settled.';
        return null;
      }
      RevquilaPayments.Link created = RevquilaPayments.gateway().createLink(invoices[0]);
      if (created != null && String.isNotBlank(created.url)) {
        Database.update(new Invoice__c(
          Id = recordId,
          Payment_Link__c = created.url.abbreviate(255),
          Gateway_Reference__c = created.reference == null ? null : created.reference.abbreviate(120)
        ), true, AccessLevel.SYSTEM_MODE);
        payLink = created.url;
        PageReference redirect = new PageReference(created.url);
        redirect.setRedirect(true);
        return redirect;
      } else {
        paymentErrorMessage = 'Online checkout session could not be initialized. Please use the direct bank transfer details below.';
      }
    } catch (Exception e) {
      paymentErrorMessage = 'Payment Gateway error: ' + e.getMessage();
    }
    return null;
  }
}