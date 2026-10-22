/**
 * Controller for Revquila India Payments, Mandates, Installments,
 * Bank Statement CSV Reconciliation, and Coupons Workspace.
 */
public with sharing class RevquilaIndiaPaymentsController {

  public class WorkspaceOverview {
    @AuraEnabled public Decimal totalReconciled = 0;
    @AuraEnabled public Integer activeMandatesCount = 0;
    @AuraEnabled public Integer pendingInstallmentsCount = 0;
    @AuraEnabled public Integer exceptionCount = 0;
    @AuraEnabled public List<BankStatementDto> statements = new List<BankStatementDto>();
    @AuraEnabled public List<MandateDto> mandates = new List<MandateDto>();
    @AuraEnabled public List<InstallmentDto> installments = new List<InstallmentDto>();
    @AuraEnabled public List<CouponDto> coupons = new List<CouponDto>();
    @AuraEnabled public List<InvoiceOptionDto> openInvoices = new List<InvoiceOptionDto>();
    @AuraEnabled public List<SubscriptionOptionDto> activeSubscriptions = new List<SubscriptionOptionDto>();
  }

  public class BankStatementDto {
    @AuraEnabled public Id id;
    @AuraEnabled public String name;
    @AuraEnabled public String bankName;
    @AuraEnabled public Datetime uploadDate;
    @AuraEnabled public Integer totalLines;
    @AuraEnabled public Integer matchedLines;
    @AuraEnabled public Integer mismatchedLines;
    @AuraEnabled public Decimal totalAmount;
    @AuraEnabled public Decimal reconciledAmount;
    @AuraEnabled public String status;
  }

  public class MandateDto {
    @AuraEnabled public Id subscriptionId;
    @AuraEnabled public String subscriptionNumber;
    @AuraEnabled public String accountName;
    @AuraEnabled public String mandateId;
    @AuraEnabled public String mandateType;
    @AuraEnabled public String mandateStatus;
    @AuraEnabled public Decimal maxAmount;
    @AuraEnabled public Date authDate;
    @AuraEnabled public Decimal mrr;
  }

  public class InstallmentDto {
    @AuraEnabled public Id id;
    @AuraEnabled public Id invoiceId;
    @AuraEnabled public String invoiceNumber;
    @AuraEnabled public String accountName;
    @AuraEnabled public Integer sequence;
    @AuraEnabled public Date dueDate;
    @AuraEnabled public Decimal amount;
    @AuraEnabled public Decimal paidAmount;
    @AuraEnabled public String status;
    @AuraEnabled public String notes;
  }

  public class CouponDto {
    @AuraEnabled public Id id;
    @AuraEnabled public String code;
    @AuraEnabled public String name;
    @AuraEnabled public String discountType;
    @AuraEnabled public Decimal discountValue;
    @AuraEnabled public Integer freeTrialDays;
    @AuraEnabled public Date validUntil;
    @AuraEnabled public Integer timesRedeemed;
    @AuraEnabled public Integer maxRedemptions;
    @AuraEnabled public Boolean isActive;
  }

  public class InvoiceOptionDto {
    @AuraEnabled public Id id;
    @AuraEnabled public String label;
    @AuraEnabled public Decimal balance;
    @AuraEnabled public String accountName;
  }

  public class SubscriptionOptionDto {
    @AuraEnabled public Id id;
    @AuraEnabled public String label;
    @AuraEnabled public String accountName;
    @AuraEnabled public Decimal mrr;
    @AuraEnabled public String mandateStatus;
  }

  @AuraEnabled(cacheable=false)
  public static WorkspaceOverview getOverview() {
    WorkspaceOverview result = new WorkspaceOverview();

    // 1. Bank Statements
    for (Bank_Statement__c bs : [
      SELECT Id, Name, Bank_Name__c, Upload_Date__c, Total_Lines__c, Matched_Lines__c,
             Mismatched_Lines__c, Total_Credit_Amount__c, Reconciled_Amount__c, Status__c
      FROM Bank_Statement__c
      ORDER BY CreatedDate DESC
      LIMIT 25
    ]) {
      BankStatementDto dto = new BankStatementDto();
      dto.id = bs.Id;
      dto.name = bs.Name;
      dto.bankName = bs.Bank_Name__c;
      dto.uploadDate = bs.Upload_Date__c;
      dto.totalLines = bs.Total_Lines__c != null ? bs.Total_Lines__c.intValue() : 0;
      dto.matchedLines = bs.Matched_Lines__c != null ? bs.Matched_Lines__c.intValue() : 0;
      dto.mismatchedLines = bs.Mismatched_Lines__c != null ? bs.Mismatched_Lines__c.intValue() : 0;
      dto.totalAmount = bs.Total_Credit_Amount__c != null ? bs.Total_Credit_Amount__c : 0;
      dto.reconciledAmount = bs.Reconciled_Amount__c != null ? bs.Reconciled_Amount__c : 0;
      dto.status = bs.Status__c;
      result.statements.add(dto);
      result.totalReconciled += dto.reconciledAmount;
    }

    // 2. Mandates on Subscriptions
    for (Subscription__c s : [
      SELECT Id, Display_Number__c, Name, Account__r.Name, Mandate_Id__c, Mandate_Type__c,
             Mandate_Status__c, Mandate_Max_Amount__c, Mandate_Auth_Date__c, Contract_MRR__c
      FROM Subscription__c
      WHERE Mandate_Status__c != null
      ORDER BY LastModifiedDate DESC
      LIMIT 50
    ]) {
      MandateDto dto = new MandateDto();
      dto.subscriptionId = s.Id;
      dto.subscriptionNumber = String.isNotBlank(s.Display_Number__c) ? s.Display_Number__c : s.Name;
      dto.accountName = s.Account__r != null ? s.Account__r.Name : '';
      dto.mandateId = s.Mandate_Id__c;
      dto.mandateType = s.Mandate_Type__c;
      dto.mandateStatus = s.Mandate_Status__c;
      dto.maxAmount = s.Mandate_Max_Amount__c != null ? s.Mandate_Max_Amount__c : 0;
      dto.authDate = s.Mandate_Auth_Date__c;
      dto.mrr = s.Contract_MRR__c != null ? s.Contract_MRR__c : 0;
      result.mandates.add(dto);

      if (s.Mandate_Status__c == 'active' || s.Mandate_Status__c == 'authenticated') {
        result.activeMandatesCount++;
      }
    }

    // 3. Open Installments
    for (Installment__c inst : [
      SELECT Id, Invoice__c, Invoice__r.Number__c, Invoice__r.Account__r.Name, Sequence__c,
             Due_Date__c, Amount__c, Paid_Amount__c, Status__c, Notes__c
      FROM Installment__c
      WHERE Status__c != 'Paid' AND Status__c != 'Cancelled'
      ORDER BY Due_Date__c ASC
      LIMIT 50
    ]) {
      InstallmentDto dto = new InstallmentDto();
      dto.id = inst.Id;
      dto.invoiceId = inst.Invoice__c;
      dto.invoiceNumber = inst.Invoice__r != null ? inst.Invoice__r.Number__c : '';
      dto.accountName = (inst.Invoice__r != null && inst.Invoice__r.Account__r != null) ? inst.Invoice__r.Account__r.Name : '';
      dto.sequence = inst.Sequence__c != null ? inst.Sequence__c.intValue() : 1;
      dto.dueDate = inst.Due_Date__c;
      dto.amount = inst.Amount__c;
      dto.paidAmount = inst.Paid_Amount__c != null ? inst.Paid_Amount__c : 0;
      dto.status = inst.Status__c;
      dto.notes = inst.Notes__c;
      result.installments.add(dto);
      result.pendingInstallmentsCount++;
    }

    // 4. Coupons
    for (Coupon__c c : [
      SELECT Id, Name, Code__c, Discount_Type__c, Discount_Value__c, Free_Trial_Days__c,
             Valid_Until__c, Times_Redeemed__c, Max_Redemptions__c, Is_Active__c
      FROM Coupon__c
      ORDER BY CreatedDate DESC
      LIMIT 25
    ]) {
      CouponDto dto = new CouponDto();
      dto.id = c.Id;
      dto.code = c.Code__c;
      dto.name = c.Name;
      dto.discountType = c.Discount_Type__c;
      dto.discountValue = c.Discount_Value__c;
      dto.freeTrialDays = c.Free_Trial_Days__c != null ? c.Free_Trial_Days__c.intValue() : 0;
      dto.validUntil = c.Valid_Until__c;
      dto.timesRedeemed = c.Times_Redeemed__c != null ? c.Times_Redeemed__c.intValue() : 0;
      dto.maxRedemptions = c.Max_Redemptions__c != null ? c.Max_Redemptions__c.intValue() : 0;
      dto.isActive = c.Is_Active__c;
      result.coupons.add(dto);
    }

    // 5. Open Invoices for quick Installment & Reconciliation dropdowns
    for (Invoice__c inv : [
      SELECT Id, Number__c, Name, Balance__c, Account__r.Name
      FROM Invoice__c
      WHERE Balance__c > 0
      ORDER BY Due_On__c ASC
      LIMIT 40
    ]) {
      InvoiceOptionDto opt = new InvoiceOptionDto();
      opt.id = inv.Id;
      opt.label = (String.isNotBlank(inv.Number__c) ? inv.Number__c : inv.Name) + ' (' + (inv.Account__r != null ? inv.Account__r.Name : '') + ' - ₹' + inv.Balance__c + ')';
      opt.balance = inv.Balance__c;
      opt.accountName = inv.Account__r != null ? inv.Account__r.Name : '';
      result.openInvoices.add(opt);
    }

    // 6. Active Subscriptions for Mandate & Coupon setup
    for (Subscription__c sub : [
      SELECT Id, Display_Number__c, Name, Account__r.Name, Contract_MRR__c, Mandate_Status__c
      FROM Subscription__c
      WHERE Status__c = 'active'
      ORDER BY CreatedDate DESC
      LIMIT 40
    ]) {
      SubscriptionOptionDto opt = new SubscriptionOptionDto();
      opt.id = sub.Id;
      opt.label = (String.isNotBlank(sub.Display_Number__c) ? sub.Display_Number__c : sub.Name) + ' (' + (sub.Account__r != null ? sub.Account__r.Name : '') + ')';
      opt.accountName = sub.Account__r != null ? sub.Account__r.Name : '';
      opt.mrr = sub.Contract_MRR__c != null ? sub.Contract_MRR__c : 0;
      opt.mandateStatus = sub.Mandate_Status__c;
      result.activeSubscriptions.add(opt);
    }

    // 7. Count open exceptions in Exception Inbox
    result.exceptionCount = [
      SELECT COUNT()
      FROM Exception_Item__c
      WHERE Status__c = 'Pending' AND (Category__c = 'Payment Mismatch' OR Category__c = 'Failed Payment')
    ];

    return result;
  }

  @AuraEnabled
  public static RevquilaIndiaPaymentsService.ReconciliationSummary uploadBankStatement(String bankName, String csvContent) {
    return RevquilaIndiaPaymentsService.reconcileBankStatement(bankName, csvContent);
  }

  @AuraEnabled
  public static void resolveBankLine(Id bankLineId, Id invoiceId) {
    RevquilaIndiaPaymentsService.manuallyResolveBankLine(bankLineId, invoiceId);
  }

  @AuraEnabled
  public static RevquilaIndiaPaymentsService.MandateResult setupMandate(Id subscriptionId, String mandateType) {
    return RevquilaIndiaPaymentsService.createMandateLink(subscriptionId, mandateType);
  }

  @AuraEnabled
  public static List<Installment__c> setupInstallments(Id invoiceId, Integer count, String splitType) {
    return RevquilaIndiaPaymentsService.createInstallmentPlan(invoiceId, count, splitType, null, null);
  }

  @AuraEnabled
  public static RevquilaIndiaPaymentsService.CouponResult applyCoupon(Id subscriptionId, String couponCode) {
    return RevquilaIndiaPaymentsService.validateAndApplyCoupon(subscriptionId, couponCode);
  }

  @AuraEnabled
  public static RevquilaIndiaPaymentsService.RetryResult triggerRetry(String invoiceIdentifier, String reason) {
    return RevquilaIndiaPaymentsService.handlePaymentFailure(invoiceIdentifier, reason);
  }

  @AuraEnabled
  public static Coupon__c createCouponRecord(
    String code,
    String name,
    String discountType,
    Decimal discountValue,
    Integer trialDays,
    Date validUntil,
    Integer maxRedemptions
  ) {
    Coupon__c c = new Coupon__c(
      Name = String.isNotBlank(name) ? name : code,
      Code__c = code.trim().toUpperCase(),
      Discount_Type__c = String.isNotBlank(discountType) ? discountType : 'Percentage',
      Discount_Value__c = discountValue != null ? discountValue : 10,
      Free_Trial_Days__c = trialDays != null ? trialDays : 0,
      Valid_Until__c = validUntil,
      Max_Redemptions__c = maxRedemptions != null ? maxRedemptions : 100,
      Times_Redeemed__c = 0,
      Is_Active__c = true,
      Applies_To__c = 'All'
    );
    insert as system c;
    return c;
  }

  @AuraEnabled
  public static Map<String, Object> generateUpiPayload(Id invoiceId) {
    Map<String, Object> res = new Map<String, Object>();
    try {
      if (invoiceId == null) {
        throw new AuraHandledException('Invoice ID is required.');
      }

      Invoice__c inv = [
        SELECT Id, Name, Total__c, Balance__c, Account__c, Account__r.Name
        FROM Invoice__c
        WHERE Id = :invoiceId
        LIMIT 1
      ];

      Decimal payAmount = (inv.Balance__c != null && inv.Balance__c > 0) ? inv.Balance__c : (inv.Total__c != null ? inv.Total__c : 0);
      String vpa = 'revx.finance@icici';
      String payeeName = 'RevX Revenue Management';
      String note = 'Invoice ' + inv.Name;

      // Standard NPCI UPI URI
      String upiUri = 'upi://pay?pa=' + EncodingUtil.urlEncode(vpa, 'UTF-8') +
                      '&pn=' + EncodingUtil.urlEncode(payeeName, 'UTF-8') +
                      '&am=' + String.valueOf(payAmount.setScale(2)) +
                      '&cu=INR' +
                      '&tn=' + EncodingUtil.urlEncode(note, 'UTF-8');

      // Dynamic QR server URL
      String qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' + EncodingUtil.urlEncode(upiUri, 'UTF-8');

      res.put('success', true);
      res.put('invoiceId', inv.Id);
      res.put('invoiceNumber', inv.Name);
      res.put('accountName', inv.Account__r != null ? inv.Account__r.Name : '');
      res.put('amount', payAmount);
      res.put('vpa', vpa);
      res.put('upiUri', upiUri);
      res.put('qrUrl', qrUrl);
    } catch (Exception e) {
      res.put('success', false);
      res.put('message', e.getMessage());
    }
    return res;
  }

  @AuraEnabled
  public static Map<String, Object> simulateUpiInstantSettlement(Id invoiceId, String utrRef) {
    Map<String, Object> res = new Map<String, Object>();
    try {
      if (invoiceId == null) {
        throw new AuraHandledException('Invoice ID is required.');
      }

      Invoice__c inv = [
        SELECT Id, Name, Total__c, Balance__c, Account__c, Payment_Status__c
        FROM Invoice__c
        WHERE Id = :invoiceId
        LIMIT 1
      ];

      Decimal payAmt = (inv.Balance__c != null && inv.Balance__c > 0) ? inv.Balance__c : inv.Total__c;
      String refCode = String.isNotBlank(utrRef) ? utrRef : ('UPI-' + String.valueOf(Math.abs(Crypto.getRandomInteger())).substring(0, 8));

      // 1. Create Payment record (auto-rolls up to Invoice.Paid_Amount__c and reduces Balance__c)
      Payment__c p = new Payment__c();
      p.Invoice__c = inv.Id;
      p.Amount__c = payAmt;
      p.Method__c = 'UPI';
      p.Reference__c = refCode;
      p.Paid_On__c = Date.today();
      insert p;

      // 2. Mark Invoice status
      inv.Payment_Status__c = 'Paid';
      update inv;

      res.put('success', true);
      res.put('paymentId', p.Id);
      res.put('utr', refCode);
      res.put('amount', payAmt);
      res.put('message', 'UPI payment successfully verified and recorded!');
    } catch (Exception ex) {
      res.put('success', false);
      res.put('message', ex.getMessage());
    }
    return res;
  }
}
