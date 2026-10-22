/**
 * Generated quote and invoice PDFs.
 *
 * The screen builds the page to print (the "print model" of the revquilaDocuments component)
 * and saves it here as a Document_Snapshot__c. The RevquilaDocument Visualforce page uses this
 * class as its controller to render one snapshot as a PDF. A snapshot is private to the user
 * who generated it.
 */
public with sharing class RevquilaDocumentController {
  private static final Integer MAX_PAYLOAD_LENGTH = 120000;
  private static final String DEFAULT_ACCENT = '#0176d3';
  private static final String DEFAULT_ACCENT_SOFT = '#e1eefa';
  private static final Pattern HEX_COLOUR = Pattern.compile(
    '^#[0-9a-fA-F]{6}$'
  );
  // The only logo URL the page will load: a file stored by RevquilaConfigController.uploadLogo
  private static final Pattern LOGO_URL = Pattern.compile(
    '^/sfc/servlet\\.shepherd/version/download/[a-zA-Z0-9]{15,18}$'
  );

  public class Pair {
    public String label { get; set; }
    public String value { get; set; }
    public Boolean strong { get; set; }
  }

  public class Row {
    public String no { get; set; }
    public String name { get; set; }
    public String unit { get; set; }
    public String qty { get; set; }
    public String price { get; set; }
    public String discount { get; set; }
    public String amount { get; set; }
  }

  /** Mirrors what buildPrintModel returns in the revquilaDocuments component. */
  public class PrintModel {
    public String kind { get; set; }
    public String title { get; set; }
    public String documentNumber { get; set; }
    public String layout { get; set; }
    public String font { get; set; }
    public String pageSize { get; set; }
    public String accent { get; set; }
    public String accentSoft { get; set; }
    public Boolean showLogo { get; set; }
    public String logoUrl { get; set; }
    public Boolean logoRight { get; set; }
    public String watermark { get; set; }
    public String companyName { get; set; }
    public List<String> companyLines { get; set; }
    public String companyRegistration { get; set; }
    public String customerName { get; set; }
    public List<String> customerLines { get; set; }
    public String customerRegistration { get; set; }
    public List<Pair> meta { get; set; }
    public Boolean showUnit { get; set; }
    public Boolean showDiscount { get; set; }
    public String priceHeading { get; set; }
    public String amountHeading { get; set; }
    public List<Row> rows { get; set; }
    public List<Pair> totals { get; set; }
    public String totalLabel { get; set; }
    public String totalValue { get; set; }
    public List<Pair> settled { get; set; }
    public List<String> notesLines { get; set; }
    public List<String> termsLines { get; set; }
    public List<String> bankLines { get; set; }
    public String footer { get; set; }
    public String signatory { get; set; }
  }

  /** Saves the print model and returns the id to open the RevquilaDocument page with. */
  @AuraEnabled
  public static Id saveSnapshot(String payload) {
    PrintModel model = parse(payload);
    if (model == null || String.isBlank(model.documentNumber)) {
      throw failure(
        'The document could not be read. Reload the page and try again.'
      );
    }
    if (payload.length() > MAX_PAYLOAD_LENGTH) {
      throw failure('This document is too long to generate as one PDF.');
    }
    if (!Schema.sObjectType.Document_Snapshot__c.isCreateable()) {
      throw failure(
        'You need the Revquila User permission set to generate documents.'
      );
    }
    Document_Snapshot__c snapshot = new Document_Snapshot__c(
      Payload__c = payload,
      Document_Number__c = model.documentNumber.abbreviate(80)
    );
    try {
      insert as user snapshot;
    } catch (DmlException e) {
      throw failure('Could not generate the document: ' + e.getDmlMessage(0));
    }
    return snapshot.Id;
  }

  // ---------------------------------------------------------------- the Visualforce page

  /** Null when the snapshot does not exist or is not the user's to see. */
  public PrintModel model { get; private set; }

  public Boolean found {
    get {
      return model != null;
    }
  }

  public Boolean missing {
    get {
      return model == null;
    }
  }

  public Boolean logoOnLeft {
    get {
      return model != null && model.logoRight != true;
    }
  }

  public Boolean logoOnRight {
    get {
      return model != null && model.logoRight == true;
    }
  }

  /** Show the uploaded logo. */
  public Boolean customLogo {
    get {
      return model != null &&
        model.showLogo == true &&
        String.isNotBlank(model.logoUrl);
    }
  }

  /** Show the Revquila logo, because none was uploaded. */
  public Boolean defaultLogo {
    get {
      return model != null &&
        model.showLogo == true &&
        String.isBlank(model.logoUrl);
    }
  }

  public Boolean hasNotes {
    get {
      return model != null && !model.notesLines.isEmpty();
    }
  }

  public Boolean hasTerms {
    get {
      return model != null && !model.termsLines.isEmpty();
    }
  }

  public Boolean hasBank {
    get {
      return model != null && !model.bankLines.isEmpty();
    }
  }

  public Boolean hasSignatory {
    get {
      return model != null && String.isNotBlank(model.signatory);
    }
  }

  public Boolean hasWatermark {
    get {
      return model != null && String.isNotBlank(model.watermark);
    }
  }

  public String layout {
    get {
      return model == null ? 'classic' : model.layout;
    }
  }

  public String accent {
    get {
      return model == null ? DEFAULT_ACCENT : model.accent;
    }
  }

  public String accentSoft {
    get {
      return model == null ? DEFAULT_ACCENT_SOFT : model.accentSoft;
    }
  }

  /** The page size for the @page rule. */
  public String paper {
    get {
      return model != null && model.pageSize == 'Letter' ? 'letter' : 'A4';
    }
  }

  public String fontFamily {
    get {
      return model != null && model.font == 'serif' ? 'serif' : 'sans-serif';
    }
  }

  public RevquilaDocumentController() {
    String snapshotId = ApexPages.currentPage().getParameters().get('id');
    if (!(snapshotId instanceof Id)) {
      return;
    }
    List<Document_Snapshot__c> rows = [
      SELECT Payload__c
      FROM Document_Snapshot__c
      WHERE Id = :snapshotId
      WITH USER_MODE
    ];
    if (rows.isEmpty()) {
      return;
    }
    model = clean(parse(rows[0].Payload__c));
    if (model != null) {
      ApexPages.currentPage()
        .getHeaders()
        .put(
          'content-disposition',
          'inline; filename="' + fileName(model.documentNumber) + '.pdf"'
        );
    }
  }

  private static PrintModel parse(String payload) {
    if (String.isBlank(payload)) {
      return null;
    }
    try {
      return (PrintModel) JSON.deserialize(payload, PrintModel.class);
    } catch (JSONException e) {
      return null;
    }
  }

  // Everything that reaches the page's CSS or an image URL is checked here; text is escaped by the page
  private static PrintModel clean(PrintModel model) {
    if (model == null) {
      return null;
    }
    if (!isColour(model.accent)) {
      model.accent = DEFAULT_ACCENT;
    }
    if (!isColour(model.accentSoft)) {
      model.accentSoft = DEFAULT_ACCENT_SOFT;
    }
    if (model.logoUrl == null || !LOGO_URL.matcher(model.logoUrl).matches()) {
      model.logoUrl = '';
    }
    if (model.layout != 'modern' && model.layout != 'minimal') {
      model.layout = 'classic';
    }
    model.companyLines = orEmpty(model.companyLines);
    model.customerLines = orEmpty(model.customerLines);
    model.notesLines = orEmpty(model.notesLines);
    model.termsLines = orEmpty(model.termsLines);
    model.bankLines = orEmpty(model.bankLines);
    model.meta = model.meta == null ? new List<Pair>() : model.meta;
    model.totals = model.totals == null ? new List<Pair>() : model.totals;
    model.settled = model.settled == null ? new List<Pair>() : model.settled;
    model.rows = model.rows == null ? new List<Row>() : model.rows;
    return model;
  }

  private static Boolean isColour(String value) {
    return value != null && HEX_COLOUR.matcher(value).matches();
  }

  private static List<String> orEmpty(List<String> lines) {
    return lines == null ? new List<String>() : lines;
  }

  private static String fileName(String documentNumber) {
    String safe = String.isBlank(documentNumber)
      ? ''
      : documentNumber.replaceAll('[^A-Za-z0-9_-]', '');
    return String.isBlank(safe) ? 'document' : safe;
  }

  private static AuraHandledException failure(String message) {
    AuraHandledException e = new AuraHandledException(message);
    e.setMessage(message);
    return e;
  }
}