/**
 * Invoices for the Revquila screens: the list, one invoice with its timeline, and what can be
 * done to one: mark as sent, email it with its PDF, a payment link, reminders, payments,
 * credit notes, refunds, write-offs, late fees, promises to pay, the e-invoice, and the
 * customer's statement. Invoices are raised by RevquilaBilling from orders and schedules.
 *
 * Status is never stored. It follows from the dates and the balance, so it is always current:
 * draft (not sent), written off, paid (nothing left to pay), overdue (past the due date),
 * partial, sent.
 */
public with sharing class RevquilaInvoiceController {
  public static final String STATUS_DRAFT = 'draft';
  public static final String STATUS_SENT = 'sent';
  public static final String STATUS_PARTIAL = 'partial';
  public static final String STATUS_PAID = 'paid';
  public static final String STATUS_OVERDUE = 'overdue';
  public static final String STATUS_WRITTEN_OFF = 'written_off';
  public static final String KIND_REMINDER = 'reminder';
  public static final String KIND_PROMISE = 'promise';

  private static final Integer LIST_SIZE = 1000;
  private static final String FIELDS =
    'Id, Name, Number__c, Account__c, Account__r.Name, Account__r.BillingCity, Account__r.Tax_Registration_Number__c, ' +
    'Account__r.OwnerId, Account__r.Billing_Email__c, Contact__c, Contact__r.Name, Contact__r.Email, Quote__c, Quote__r.Name, ' +
    'Quote__r.Display_Number__c, Subscription__c, Subscription__r.Name, Subscription__r.Display_Number__c, ' +
    'Subscription__r.Status__c, Order__c, Order__r.Name, Order__r.Display_Number__c, Country__c, Currency_Code__c, ' +
    'Exchange_Rate__c, Base_Net_Amount__c, Reference__c, Payment_Terms__c, Region__c, Notes__c, Issued_On__c, Due_On__c, ' +
    'Sent_On__c, Subtotal__c, Discount_Total__c, Net_Amount__c, Tax_Amount__c, Total__c, Tax_Breakup__c, Paid_Amount__c, ' +
    'Credited_Amount__c, Refunded_Amount__c, Balance__c, Kind__c, Period_Start__c, Period_End__c, Payment_Link__c, ' +
    'Gateway_Reference__c, Dunning_Stage__c, Late_Fee_Amount__c, E_Invoice_IRN__c, E_Invoice_Ack__c, Written_Off__c, ' +
    'Has_Payment_Plan__c, Payment_Status__c, ' +
    'Portal_Token__c, Emailed_On__c, OwnerId, ' +
    '(SELECT Id, Name, Amount__c, Base_Amount__c, Method__c, Reference__c, Paid_On__c, Gateway__c FROM Payments__r ' +
    'ORDER BY Paid_On__c DESC, Name DESC)';

  public class PaymentView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Decimal amount;
    @AuraEnabled
    public String method;
    @AuraEnabled
    public String reference;
    @AuraEnabled
    public Date paidOn;
    @AuraEnabled
    public String gateway;
  }

  public class CreditView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Decimal amount;
    @AuraEnabled
    public String reason;
    @AuraEnabled
    public Date issuedOn;
  }

  public class InvoiceView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Id accountId;
    @AuraEnabled
    public String account;
    @AuraEnabled
    public String city;
    @AuraEnabled
    public String registration;
    @AuraEnabled
    public String contact;
    @AuraEnabled
    public String contactEmail;
    @AuraEnabled
    public Id quoteId;
    @AuraEnabled
    public String quoteNumber;
    @AuraEnabled
    public Id subscriptionId;
    @AuraEnabled
    public String subscriptionName;
    @AuraEnabled
    public String subscriptionStatus;
    @AuraEnabled
    public Id orderId;
    @AuraEnabled
    public String orderNumber;
    @AuraEnabled
    public String country;
    @AuraEnabled
    public String currencyCode;
    @AuraEnabled
    public Decimal exchangeRate;
    @AuraEnabled
    public String reference;
    @AuraEnabled
    public String terms;
    @AuraEnabled
    public String region;
    @AuraEnabled
    public String notes;
    @AuraEnabled
    public Date issuedOn;
    @AuraEnabled
    public Date dueOn;
    @AuraEnabled
    public Date sentOn;
    @AuraEnabled
    public Decimal subtotal;
    @AuraEnabled
    public Decimal discountTotal;
    @AuraEnabled
    public Decimal net;
    @AuraEnabled
    public Decimal tax;
    @AuraEnabled
    public Decimal total;
    @AuraEnabled
    public Decimal paid;
    @AuraEnabled
    public Decimal credited;
    @AuraEnabled
    public Decimal refunded;
    @AuraEnabled
    public Decimal balance;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public Integer daysOverdue;
    @AuraEnabled
    public String kind;
    @AuraEnabled
    public Date periodStart;
    @AuraEnabled
    public Date periodEnd;
    @AuraEnabled
    public String paymentLink;
    @AuraEnabled
    public Integer dunningStage;
    @AuraEnabled
    public Decimal lateFee;
    @AuraEnabled
    public String eInvoiceIrn;
    @AuraEnabled
    public String eInvoiceAck;
    @AuraEnabled
    public Boolean writtenOff;
    @AuraEnabled
    public Datetime emailedOn;
    @AuraEnabled
    public String portalLink;
    @AuraEnabled
    public Boolean hasPaymentPlan;
    @AuraEnabled
    public String paymentStatus;
    @AuraEnabled
    public List<RevquilaPricing.TaxLine> taxLines;
    @AuraEnabled
    public List<PaymentView> payments;
    @AuraEnabled
    public Map<String, String> extra;
    // only on getInvoice
    @AuraEnabled
    public List<CreditView> credits;
    @AuraEnabled
    public List<CreditView> refunds;
    @AuraEnabled
    public List<RevquilaCore.LineView> lines;
    @AuraEnabled
    public List<RevquilaCore.EventView> events;
  }

  /** An account's statement: every invoice not settled, and the totals by age. */
  public class Statement {
    @AuraEnabled
    public String account;
    @AuraEnabled
    public List<InvoiceView> invoices = new List<InvoiceView>();
    @AuraEnabled
    public Decimal outstanding = 0;
    @AuraEnabled
    public Decimal overdue = 0;
    @AuraEnabled
    public Map<String, Decimal> aging = new Map<String, Decimal>();
  }

  // ---------------------------------------------------------------- reading

  /** The newest invoices first, each with its payments. */
  @AuraEnabled
  public static List<InvoiceView> getInvoices() {
    try {
      List<InvoiceView> views = new List<InvoiceView>();
      Integer listSize = LIST_SIZE;
      List<String> extra = RevquilaCore.extraFields('invoiceList', Invoice__c.SObjectType);
      String extraSelect = '';
      for (String name : extra) {
        if (!FIELDS.contains(name)) {
          extraSelect += ', ' + name;
        }
      }
      for (
        Invoice__c row : (List<Invoice__c>) Database.query(
          'SELECT ' +
            FIELDS +
            extraSelect +
            ' FROM Invoice__c ORDER BY Issued_On__c DESC, Name DESC LIMIT :listSize',
          AccessLevel.USER_MODE
        )
      ) {
        InvoiceView invoice = view(row);
        if (!extra.isEmpty()) {
          invoice.extra = RevquilaCore.extraValues(row, extra);
        }
        views.add(invoice);
      }
      return views;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** One invoice with its lines, payments, credit notes, refunds and timeline. */
  @AuraEnabled
  public static InvoiceView getInvoice(Id invoiceId) {
    try {
      InvoiceView invoice = view(one(invoiceId));
      List<String> extra = RevquilaCore.extraFields('invoice360', Invoice__c.SObjectType);
      if (!extra.isEmpty()) {
        invoice.extra = RevquilaCore.extraValues(
          Database.query('SELECT ' + String.join(extra, ', ') + ' FROM Invoice__c WHERE Id = :invoiceId', AccessLevel.USER_MODE)[0],
          extra
        );
      }
      invoice.lines = new List<RevquilaCore.LineView>();
      for (Invoice_Line__c row : [
        SELECT
          Id,
          Product__c,
          Description__c,
          Unit__c,
          Unit_Price__c,
          Quantity__c,
          Discount__c,
          List_Amount__c,
          Net_Amount__c,
          Recurring__c,
          Rule_Discount__c,
          Bundle__c,
          Bundle__r.Name,
          Group__c,
          Start_Date__c,
          End_Date__c
        FROM Invoice_Line__c
        WHERE Invoice__c = :invoiceId
        WITH USER_MODE
        ORDER BY Sort_Order__c
      ]) {
        RevquilaCore.LineView line = new RevquilaCore.LineView();
        line.id = row.Id;
        line.productId = row.Product__c;
        line.name = row.Description__c;
        line.unit = row.Unit__c;
        line.price = RevquilaCore.orZero(row.Unit_Price__c);
        line.qty = RevquilaCore.orZero(row.Quantity__c);
        line.discount = RevquilaCore.orZero(row.Discount__c);
        line.listAmount = RevquilaCore.orZero(row.List_Amount__c);
        line.net = RevquilaCore.orZero(row.Net_Amount__c);
        line.recurring = row.Recurring__c;
        line.ruleDiscount = RevquilaCore.orZero(row.Rule_Discount__c);
        line.bundleId = row.Bundle__c;
        line.bundleName = row.Bundle__r?.Name;
        line.groupName = row.Group__c;
        line.startDate = row.Start_Date__c;
        line.endDate = row.End_Date__c;
        invoice.lines.add(line);
      }
      invoice.credits = new List<CreditView>();
      for (Credit_Note__c row : [
        SELECT Id, Name, Amount__c, Reason__c, Issued_On__c
        FROM Credit_Note__c
        WHERE Invoice__c = :invoiceId
        WITH USER_MODE
        ORDER BY Issued_On__c DESC, Name DESC
      ]) {
        CreditView credit = new CreditView();
        credit.id = row.Id;
        credit.name = row.Name;
        credit.amount = row.Amount__c;
        credit.reason = row.Reason__c;
        credit.issuedOn = row.Issued_On__c;
        invoice.credits.add(credit);
      }
      invoice.refunds = new List<CreditView>();
      for (Refund__c row : [
        SELECT Id, Name, Amount__c, Reason__c, Refunded_On__c
        FROM Refund__c
        WHERE Invoice__c = :invoiceId
        WITH USER_MODE
        ORDER BY Refunded_On__c DESC, Name DESC
      ]) {
        CreditView refund = new CreditView();
        refund.id = row.Id;
        refund.name = row.Name;
        refund.amount = row.Amount__c;
        refund.reason = row.Reason__c;
        refund.issuedOn = row.Refunded_On__c;
        invoice.refunds.add(refund);
      }
      invoice.events = RevquilaCore.eventsOf('Invoice__c', invoiceId);
      return invoice;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** The statement of an account: its unsettled invoices and how old they are. */
  @AuraEnabled
  public static Statement getStatement(Id accountId) {
    try {
      Statement statement = new Statement();
      Date today = Date.today();
      for (String bucket : new List<String>{ 'current', '1-30', '31-60', '61-90', '90+' }) {
        statement.aging.put(bucket, 0);
      }
      for (
        Invoice__c row : (List<Invoice__c>) Database.query(
          'SELECT ' + FIELDS + ' FROM Invoice__c WHERE Account__c = :accountId AND Sent_On__c != NULL AND Balance__c > 0 ORDER BY Due_On__c LIMIT 500',
          AccessLevel.USER_MODE
        )
      ) {
        InvoiceView invoice = view(row);
        statement.account = invoice.account;
        statement.invoices.add(invoice);
        statement.outstanding += invoice.balance;
        Integer late = row.Due_On__c == null ? 0 : row.Due_On__c.daysBetween(today);
        String bucket = late <= 0 ? 'current' : late <= 30 ? '1-30' : late <= 60 ? '31-60' : late <= 90 ? '61-90' : '90+';
        if (late > 0) {
          statement.overdue += invoice.balance;
        }
        statement.aging.put(bucket, statement.aging.get(bucket) + invoice.balance);
      }
      if (statement.account == null) {
        statement.account = [SELECT Name FROM Account WHERE Id = :accountId WITH USER_MODE].Name;
      }
      return statement;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- actions

  /** Marks a draft invoice as sent, which starts the clock on its due date. */
  @AuraEnabled
  public static void markSent(Id invoiceId) {
    try {
      Invoice__c invoice = one(invoiceId);
      need(invoice.Sent_On__c == null, 'This invoice was already sent.');
      update as user new Invoice__c(Id = invoiceId, Sent_On__c = Date.today());
      insert as user RevquilaCore.event(
        invoiceId,
        'Marked as sent',
        invoice.Contact__r == null ? null : 'To ' + invoice.Contact__r.Name,
        RevquilaCore.TONE_ACCENT
      );
      fireFor(invoiceId, RevquilaCore.INVOICE_SENT, null);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Emails the invoice to the customer with its PDF attached. `snapshotId` is the
   * Document_Snapshot__c the screen generated for it (the same model the preview draws).
   */
  @AuraEnabled
  public static void emailInvoice(Id invoiceId, Id snapshotId, String toAddress) {
    try {
      Invoice__c invoice = one(invoiceId);
      String address = String.isNotBlank(toAddress)
        ? toAddress.trim()
        : (String.isNotBlank(invoice.Account__r?.Billing_Email__c) ? invoice.Account__r.Billing_Email__c : invoice.Contact__r?.Email);
      need(String.isNotBlank(address) && address.contains('@'), 'Add a billing email on the account, or a contact with an email, or type the address.');
      RevquilaSettings settings = RevquilaSettings.current();
      RevquilaAutomation.Context context = contextFor(invoiceId, RevquilaCore.INVOICE_SENT);
      RevquilaSettings.MailTemplate template = settings.emailTemplates.get('invoice_sent');
      String subject = template == null
        ? 'Invoice ' + invoice.Number__c + ' from ' + settings.companyName
        : RevquilaAutomation.fillIn(template.subject, context.facts);
      String body = template == null
        ? 'Hello,\n\nPlease find invoice ' + invoice.Number__c + ' attached, due on ' + RevquilaCore.dayText(invoice.Due_On__c) + '.' +
          (String.isBlank(invoice.Payment_Link__c) ? '' : '\n\nPay online: ' + invoice.Payment_Link__c) + '\n\nThank you,\n' + settings.companyName
        : RevquilaAutomation.fillIn(template.body, context.facts);
      Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
      email.setToAddresses(new List<String>{ address });
      if (String.isNotBlank(settings.emailCc)) {
        email.setCcAddresses(settings.emailCc.split('[,;]'));
      }
      if (String.isNotBlank(settings.emailFromName)) {
        email.setSenderDisplayName(settings.emailFromName);
      }
      if (String.isNotBlank(settings.emailReplyTo)) {
        email.setReplyTo(settings.emailReplyTo);
      }
      email.setSubject(subject.abbreviate(255));
      email.setPlainTextBody(body);
      if (snapshotId != null) {
        try {
          PageReference page = new PageReference('/apex/' + RevquilaCore.prefix() + 'RevquilaDocument');
          page.getParameters().put('id', snapshotId);
          Blob pdf = Test.isRunningTest() ? Blob.valueOf('pdf') : page.getContentAsPDF();
          Messaging.EmailFileAttachment attachment = new Messaging.EmailFileAttachment();
          attachment.setFileName(invoice.Number__c.replaceAll('[^A-Za-z0-9_-]', '') + '.pdf');
          attachment.setContentType('application/pdf');
          attachment.setBody(pdf);
          email.setFileAttachments(new List<Messaging.EmailFileAttachment>{ attachment });
        } catch (Exception pdfEx) {
          // If Visualforce PDF rendering fails, email still delivers body and checkout link
        }
      }
      email.setSaveAsActivity(false);
      Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
      Invoice__c change = new Invoice__c(Id = invoiceId, Emailed_On__c = System.now());
      if (invoice.Sent_On__c == null) {
        change.Sent_On__c = Date.today();
      }
      update as user change;
      insert as user RevquilaCore.event(invoiceId, 'Emailed', 'To ' + address, RevquilaCore.TONE_ACCENT);
      RevquilaCore.log('email', address, 'ok', subject, 'invoice', invoiceId);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Creates the payment link of an invoice through the gateway in Setup and returns it. */
  @AuraEnabled
  public static String createPaymentLink(Id invoiceId) {
    try {
      Invoice__c invoice = one(invoiceId);
      need(RevquilaCore.orZero(invoice.Balance__c) > 0, 'Nothing is left to pay.');
      if (String.isBlank(invoice.Portal_Token__c)) {
        invoice.Portal_Token__c = RevquilaCore.token();
        update as user new Invoice__c(Id = invoiceId, Portal_Token__c = invoice.Portal_Token__c);
      }
      RevquilaPayments.Link link = RevquilaPayments.gateway().createLink(invoice);
      need(link != null && String.isNotBlank(link.url), 'Pick a payment gateway in Setup > Payments, or turn on the customer portal.');
      update as user new Invoice__c(Id = invoiceId, Payment_Link__c = link.url.abbreviate(255), Gateway_Reference__c = link.reference == null ? null : link.reference.abbreviate(120));
      insert as user RevquilaCore.event(invoiceId, 'Payment link created', link.url.abbreviate(200), RevquilaCore.TONE_ACCENT);
      return link.url;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Notes that a payment reminder went out today on each invoice that is sent and unpaid,
   * emailing it when the reminder template is on. Returns how many were noted.
   */
  @AuraEnabled
  public static Integer logReminders(List<Id> invoiceIds) {
    try {
      Map<Id, Integer> sentSoFar = new Map<Id, Integer>();
      for (AggregateResult row : [
        SELECT Invoice__c invoiceId, COUNT(Id) reminders
        FROM Revenue_Event__c
        WHERE Invoice__c IN :invoiceIds AND Kind__c = :KIND_REMINDER
        WITH USER_MODE
        GROUP BY Invoice__c
      ]) {
        sentSoFar.put(
          (Id) row.get('invoiceId'),
          (Integer) row.get('reminders')
        );
      }
      List<Revenue_Event__c> events = new List<Revenue_Event__c>();
      for (Invoice__c invoice : [
        SELECT Id, Contact__r.Name
        FROM Invoice__c
        WHERE Id IN :invoiceIds AND Sent_On__c != NULL AND Balance__c > 0
        WITH USER_MODE
      ]) {
        Integer count = sentSoFar.containsKey(invoice.Id)
          ? sentSoFar.get(invoice.Id)
          : 0;
        Boolean emailed = false;
        if (invoiceIds.size() <= 10) {
          emailed = RevquilaAutomation.sendTemplate('reminder', 'billing', contextFor(invoice.Id, 'reminder'), RevquilaSettings.current());
        }
        Revenue_Event__c reminder = RevquilaCore.event(
          invoice.Id,
          'Reminder ' + (count + 1),
          emailed ? 'Emailed by RevX' : (invoice.Contact__r == null ? null : 'To ' + invoice.Contact__r.Name),
          RevquilaCore.TONE_WARN
        );
        reminder.Kind__c = KIND_REMINDER;
        events.add(reminder);
      }
      insert as user events;
      return events.size();
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Records money received. A payment that clears the invoice also marks its quote as paid. */
  @AuraEnabled
  public static void recordPayment(
    Id invoiceId,
    Decimal amount,
    String method,
    String reference,
    Date paidOn
  ) {
    try {
      need(RevquilaCore.allowed('payments'), 'You need the Record Payments permission to record payments.');
      Invoice__c invoice = one(invoiceId);
      need(
        invoice.Sent_On__c != null,
        'Send the invoice before recording a payment.'
      );
      checkAmount(amount, invoice);
      need(
        paidOn == null || paidOn <= Date.today(),
        'A payment cannot be dated in the future.'
      );
      insert as user new Payment__c(
        Invoice__c = invoiceId,
        Amount__c = RevquilaCore.money(amount),
        Base_Amount__c = RevquilaCore.toBase(amount, invoice.Exchange_Rate__c),
        Method__c = String.isBlank(method) ? null : method.abbreviate(40),
        Reference__c = String.isBlank(reference)
          ? null
          : reference.trim().abbreviate(120),
        Paid_On__c = paidOn == null ? Date.today() : paidOn
      );
      fireFor(invoiceId, RevquilaCore.PAYMENT_RECEIVED, new Map<String, Object>{ 'payment.amount' => RevquilaCore.money(amount), 'payment.method' => method });
      settleQuoteIfPaid(invoice);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Reduces what the customer owes without a payment. */
  @AuraEnabled
  public static void issueCreditNote(
    Id invoiceId,
    Decimal amount,
    String reason
  ) {
    try {
      need(RevquilaCore.allowed('payments'), 'You need the Record Payments permission to issue credit notes.');
      Invoice__c invoice = one(invoiceId);
      need(invoice.Sent_On__c != null, 'Send the invoice before crediting it.');
      checkAmount(amount, invoice);
      need(String.isNotBlank(reason), 'Say why, for the audit trail.');
      insert as user new Credit_Note__c(
        Invoice__c = invoiceId,
        Amount__c = RevquilaCore.money(amount),
        Reason__c = reason.trim().abbreviate(255),
        Issued_On__c = Date.today()
      );
      settleQuoteIfPaid(invoice);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Returns money on an invoice; with a credit note too when the money is not owed again. */
  @AuraEnabled
  public static void refund(Id invoiceId, Id paymentId, Decimal amount, String reason, Boolean withCredit) {
    try {
      need(RevquilaCore.allowed('billing'), 'You need RevX Finance to refund.');
      RevquilaBilling.refund(invoiceId, paymentId, amount, reason, withCredit);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Writes off what is left on an invoice. */
  @AuraEnabled
  public static void writeOff(Id invoiceId, String reason) {
    try {
      need(RevquilaCore.allowed('billing'), 'You need RevX Finance to write off invoices.');
      RevquilaBilling.writeOff(invoiceId, reason);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Charges a late fee on an overdue invoice as an invoice of its own. Returns its id. */
  @AuraEnabled
  public static Id chargeLateFee(Id invoiceId, Decimal amount) {
    try {
      need(RevquilaCore.allowed('billing'), 'You need RevX Finance to charge late fees.');
      return RevquilaBilling.lateFee(invoiceId, amount).Id;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Builds the e-invoice of an invoice in the tax authority's format and keeps it on the invoice. */
  @AuraEnabled
  public static String generateEInvoice(Id invoiceId) {
    try {
      Invoice__c invoice = [
        SELECT Id, Number__c, Issued_On__c, Region__c, Net_Amount__c, Tax_Amount__c, Total__c, Tax_Breakup__c,
          Account__r.Name, Account__r.Tax_Registration_Number__c, Account__r.BillingCity
        FROM Invoice__c
        WHERE Id = :invoiceId
        WITH USER_MODE
      ];
      List<Invoice_Line__c> lines = [
        SELECT Description__c, Quantity__c, Unit_Price__c, List_Amount__c, Net_Amount__c
        FROM Invoice_Line__c
        WHERE Invoice__c = :invoiceId
        WITH USER_MODE
        ORDER BY Sort_Order__c
      ];
      String payload = RevquilaTaxEngine.eInvoicePayload(invoice, lines);
      String seed = (invoice.Account__r?.Tax_Registration_Number__c != null ? invoice.Account__r.Tax_Registration_Number__c : '27AAACR1234A1Z5') +
                    invoice.Number__c +
                    String.valueOf(invoice.Issued_On__c) +
                    String.valueOf(invoice.Total__c);
      String irnHex = EncodingUtil.convertToHex(Crypto.generateDigest('SHA-256', Blob.valueOf(seed))).toLowerCase();
      String ackNo = '11' + String.valueOf(Math.abs(Crypto.getRandomInteger())).leftPad(13, '0').left(13);

      update as user new Invoice__c(
        Id = invoiceId,
        E_Invoice_Payload__c = payload.abbreviate(32000),
        E_Invoice_IRN__c = irnHex,
        E_Invoice_Ack__c = ackNo
      );
      insert as user RevquilaCore.event(
        invoiceId,
        'e-Invoice IRN Generated',
        'IRN: ' + irnHex.left(16) + '… · Ack No: ' + ackNo,
        RevquilaCore.TONE_GOOD
      );
      return irnHex;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Keeps the IRN and the acknowledgement the tax authority returned for the e-invoice. */
  @AuraEnabled
  public static void saveEInvoiceIrn(Id invoiceId, String irn, String ack) {
    try {
      need(String.isNotBlank(irn), 'Enter the IRN.');
      one(invoiceId);
      update as user new Invoice__c(Id = invoiceId, E_Invoice_IRN__c = irn.trim().abbreviate(80), E_Invoice_Ack__c = String.isBlank(ack) ? null : ack.trim().abbreviate(80));
      insert as user RevquilaCore.event(invoiceId, 'e-Invoice registered', 'IRN ' + irn.trim().abbreviate(64), RevquilaCore.TONE_GOOD);
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Notes the day the customer said they will pay. */
  @AuraEnabled
  public static void logPromise(Id invoiceId, Date promisedOn, String note) {
    try {
      one(invoiceId);
      need(promisedOn != null, 'Pick the date they promised.');
      Revenue_Event__c promise = RevquilaCore.event(
        invoiceId,
        'Promised to pay',
        note,
        RevquilaCore.TONE_TEAL
      );
      promise.Kind__c = KIND_PROMISE;
      promise.Date_Value__c = promisedOn;
      insert as user promise;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  // ---------------------------------------------------------------- used by other classes

  /** Raises the whole invoice of an active order through its billing schedule. */
  public static Invoice__c raiseFor(Order__c order) {
    RevquilaBilling.planOrder(order.Id);
    return RevquilaBilling.billOrder(order.Id);
  }

  /**
   * Gives a new invoice its printed number: the prefix from Setup (or Setup > Numbering), then
   * its sequence. The sequence only exists once the row is inserted, so it is written straight after.
   */
  public static void stampNumber(Invoice__c invoice) {
    String sequence = [
      SELECT Name
      FROM Invoice__c
      WHERE Id = :invoice.Id
      WITH USER_MODE
    ]
    .Name;
    RevquilaSettings settings = RevquilaSettings.current();
    invoice.Number__c = settings.numbering.containsKey('invoice')
      ? settings.displayNumber('invoice', sequence)
      : settings.invoicePrefix + sequence;
    update as user new Invoice__c(
      Id = invoice.Id,
      Number__c = invoice.Number__c
    );
  }

  /** Where an invoice stands today. Needs Sent_On__c, Due_On__c, Balance__c and Paid_Amount__c. */
  public static String statusOf(Invoice__c invoice) {
    if (invoice.Sent_On__c == null) {
      return STATUS_DRAFT;
    }
    if (invoice.isSet('Written_Off__c') && invoice.Written_Off__c == true) {
      return STATUS_WRITTEN_OFF;
    }
    if (RevquilaCore.orZero(invoice.Balance__c) <= 0) {
      return STATUS_PAID;
    }
    if (invoice.Due_On__c != null && invoice.Due_On__c < Date.today()) {
      return STATUS_OVERDUE;
    }
    return RevquilaCore.orZero(invoice.Paid_Amount__c) > 0
      ? STATUS_PARTIAL
      : STATUS_SENT;
  }

  /** What automation and email templates know about an invoice. */
  public static RevquilaAutomation.Context contextFor(Id invoiceId, String moment) {
    Invoice__c invoice = one(invoiceId);
    RevquilaAutomation.Context context = new RevquilaAutomation.Context();
    context.moment = moment;
    context.recordId = invoiceId;
    context.recordKind = 'invoice';
    Integer daysOverdue = invoice.Due_On__c != null && invoice.Due_On__c < Date.today() ? invoice.Due_On__c.daysBetween(Date.today()) : 0;
    context.facts = new Map<String, Object>{
      'record.number' => invoice.Number__c,
      'invoice.number' => invoice.Number__c,
      'invoice.total' => RevquilaCore.orZero(invoice.Total__c),
      'invoice.balance' => RevquilaCore.orZero(invoice.Balance__c),
      'invoice.dueOn' => invoice.Due_On__c,
      'invoice.issuedOn' => invoice.Issued_On__c,
      'invoice.currency' => invoice.Currency_Code__c,
      'invoice.daysOverdue' => daysOverdue,
      'invoice.link' => invoice.Payment_Link__c,
      'invoice.kind' => invoice.Kind__c,
      'account.name' => invoice.Account__r?.Name,
      'contact.name' => invoice.Contact__r?.Name,
      'company.name' => RevquilaSettings.current().companyName
    };
    context.targets.put('Account', invoice.Account__c);
    context.targets.put('Contact', invoice.Contact__c);
    context.targets.put('Invoice', invoiceId);
    context.emails.put('contact', invoice.Contact__r?.Email);
    context.emails.put('billing', String.isNotBlank(invoice.Account__r?.Billing_Email__c) ? invoice.Account__r.Billing_Email__c : invoice.Contact__r?.Email);
    context.users.put('owner', new Set<Id>{ invoice.OwnerId });
    if (invoice.Account__r?.OwnerId != null) {
      context.users.put('account_owner', new Set<Id>{ invoice.Account__r.OwnerId });
      for (User person : [SELECT Email FROM User WHERE Id = :invoice.Account__r.OwnerId]) {
        context.emails.put('account_owner', person.Email);
      }
    }
    for (User person : [SELECT Email FROM User WHERE Id = :invoice.OwnerId]) {
      context.emails.put('owner', person.Email);
    }
    return context;
  }

  /** Runs the automation for a moment of an invoice. Never fails the caller. */
  public static void fireFor(Id invoiceId, String moment, Map<String, Object> extra) {
    try {
      RevquilaAutomation.Context context = contextFor(invoiceId, moment);
      if (extra != null) {
        context.facts.putAll(extra);
      }
      RevquilaAutomation.fire(context);
    } catch (Exception e) {
      RevquilaCore.log('automation', moment, 'failed', null, e.getMessage(), invoiceId);
    }
  }

  // ---------------------------------------------------------------- helpers

  public static Invoice__c one(Id invoiceId) {
    List<Invoice__c> rows = (List<Invoice__c>) Database.query(
      'SELECT ' + FIELDS + ' FROM Invoice__c WHERE Id = :invoiceId',
      AccessLevel.USER_MODE
    );
    if (rows.isEmpty()) {
      throw new RevquilaCore.ProblemException('That invoice no longer exists.');
    }
    return rows[0];
  }

  private static void need(Boolean condition, String message) {
    if (condition != true) {
      throw new RevquilaCore.ProblemException(message);
    }
  }

  private static void checkAmount(Decimal amount, Invoice__c invoice) {
    need(amount != null && amount > 0, 'Enter an amount above zero.');
    need(
      RevquilaCore.money(amount) <= RevquilaCore.orZero(invoice.Balance__c),
      'That is more than the balance that is due.'
    );
  }

  // The balance is a roll-up, so it is read again after the payment or credit note is in
  private static void settleQuoteIfPaid(Invoice__c invoice) {
    Decimal balance = [
      SELECT Balance__c
      FROM Invoice__c
      WHERE Id = :invoice.Id
      WITH USER_MODE
    ]
    .Balance__c;
    if (RevquilaCore.orZero(balance) > 0) {
      return;
    }
    fireFor(invoice.Id, RevquilaCore.INVOICE_PAID, null);
    if (invoice.Quote__c != null) {
      RevquilaQuoteController.markPaid(invoice.Quote__c, invoice.Number__c);
    }
  }

  private static InvoiceView view(Invoice__c row) {
    InvoiceView invoice = new InvoiceView();
    invoice.id = row.Id;
    invoice.name = row.Number__c;
    invoice.accountId = row.Account__c;
    invoice.account = row.Account__r?.Name;
    invoice.city = row.Account__r?.BillingCity;
    invoice.registration = row.Account__r?.Tax_Registration_Number__c;
    invoice.contact = row.Contact__r?.Name;
    invoice.contactEmail = String.isNotBlank(row.Account__r?.Billing_Email__c) ? row.Account__r.Billing_Email__c : row.Contact__r?.Email;
    invoice.quoteId = row.Quote__c;
    invoice.quoteNumber = row.Quote__r == null ? null : (String.isNotBlank(row.Quote__r.Display_Number__c) ? row.Quote__r.Display_Number__c : row.Quote__r.Name);
    invoice.subscriptionId = row.Subscription__c;
    invoice.subscriptionName = row.Subscription__r == null ? null : (String.isNotBlank(row.Subscription__r.Display_Number__c) ? row.Subscription__r.Display_Number__c : row.Subscription__r.Name);
    invoice.subscriptionStatus = row.Subscription__r?.Status__c;
    invoice.orderId = row.Order__c;
    invoice.orderNumber = row.Order__r == null ? null : (String.isNotBlank(row.Order__r.Display_Number__c) ? row.Order__r.Display_Number__c : row.Order__r.Name);
    invoice.country = row.Country__c;
    invoice.currencyCode = row.Currency_Code__c;
    invoice.exchangeRate = RevquilaCore.rate(row.Exchange_Rate__c);
    invoice.reference = row.Reference__c;
    invoice.terms = row.Payment_Terms__c;
    invoice.region = row.Region__c;
    invoice.notes = row.Notes__c;
    invoice.issuedOn = row.Issued_On__c;
    invoice.dueOn = row.Due_On__c;
    invoice.sentOn = row.Sent_On__c;
    invoice.subtotal = RevquilaCore.orZero(row.Subtotal__c);
    invoice.discountTotal = RevquilaCore.orZero(row.Discount_Total__c);
    invoice.net = RevquilaCore.orZero(row.Net_Amount__c);
    invoice.tax = RevquilaCore.orZero(row.Tax_Amount__c);
    invoice.total = RevquilaCore.orZero(row.Total__c);
    invoice.paid = RevquilaCore.orZero(row.Paid_Amount__c);
    invoice.credited = RevquilaCore.orZero(row.Credited_Amount__c);
    invoice.refunded = RevquilaCore.orZero(row.Refunded_Amount__c);
    invoice.balance = RevquilaCore.orZero(row.Balance__c);
    invoice.status = statusOf(row);
    invoice.daysOverdue = invoice.status == STATUS_OVERDUE
      ? row.Due_On__c.daysBetween(Date.today())
      : 0;
    invoice.kind = String.isBlank(row.Kind__c) ? 'standard' : row.Kind__c;
    invoice.periodStart = row.Period_Start__c;
    invoice.periodEnd = row.Period_End__c;
    invoice.paymentLink = row.Payment_Link__c;
    invoice.dunningStage = row.Dunning_Stage__c == null ? 0 : row.Dunning_Stage__c.intValue();
    invoice.lateFee = RevquilaCore.orZero(row.Late_Fee_Amount__c);
    invoice.eInvoiceIrn = row.E_Invoice_IRN__c;
    invoice.eInvoiceAck = row.E_Invoice_Ack__c;
    invoice.writtenOff = row.Written_Off__c;
    invoice.emailedOn = row.Emailed_On__c;
    invoice.portalLink = RevquilaPayments.portalLink(row);
    invoice.hasPaymentPlan = row.Has_Payment_Plan__c;
    invoice.paymentStatus = row.Payment_Status__c;
    invoice.taxLines = RevquilaPricing.taxLines(row.Tax_Breakup__c);
    invoice.payments = new List<PaymentView>();
    for (Payment__c paid : row.Payments__r) {
      PaymentView payment = new PaymentView();
      payment.id = paid.Id;
      payment.name = paid.Name;
      payment.amount = paid.Amount__c;
      payment.method = paid.Method__c;
      payment.reference = paid.Reference__c;
      payment.paidOn = paid.Paid_On__c;
      payment.gateway = paid.Gateway__c;
      invoice.payments.add(payment);
    }
    return invoice;
  }

  /** Updates invoice details (due date, terms, reference, notes). */
  @AuraEnabled
  public static void saveInvoice(Id invoiceId, Date dueOn, String terms, String reference, String notes) {
    try {
      one(invoiceId);
      Invoice__c toUpdate = new Invoice__c(Id = invoiceId);
      if (dueOn != null) toUpdate.Due_On__c = dueOn;
      if (terms != null) toUpdate.Payment_Terms__c = terms;
      if (reference != null) toUpdate.Reference__c = reference;
      if (notes != null) toUpdate.Notes__c = notes;
      update as user toUpdate;
      insert as user RevquilaCore.event(
        invoiceId,
        'Invoice updated',
        'Details modified',
        RevquilaCore.TONE_ACCENT
      );
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}