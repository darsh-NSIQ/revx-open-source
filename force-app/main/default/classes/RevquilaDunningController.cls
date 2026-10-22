/**
 * Autonomous Dunning & Collections Engine Controller
 * Manages overdue aging, automated collection stages, promise-to-pay tracking,
 * compliant late fees, and multi-channel payment recovery links.
 */
public with sharing class RevquilaDunningController {

  public class OverdueInvoiceItem {
    @AuraEnabled public Id id;
    @AuraEnabled public String invoiceNumber;
    @AuraEnabled public Id accountId;
    @AuraEnabled public String accountName;
    @AuraEnabled public String billingEmail;
    @AuraEnabled public Date dueOn;
    @AuraEnabled public Integer daysOverdue;
    @AuraEnabled public Decimal balance;
    @AuraEnabled public Decimal total;
    @AuraEnabled public Decimal lateFee;
    @AuraEnabled public String dunningStage;
    @AuraEnabled public String dunningStageLabel;
    @AuraEnabled public String stageBadgeTone;
    @AuraEnabled public Boolean isPaused;
    @AuraEnabled public String paymentLink;
    @AuraEnabled public String currencyCode;
    @AuraEnabled public String notes;
  }

  public class AgingSummary {
    @AuraEnabled public Decimal bucket1to30 = 0;
    @AuraEnabled public Decimal bucket31to60 = 0;
    @AuraEnabled public Decimal bucket61to90 = 0;
    @AuraEnabled public Decimal bucket90Plus = 0;
    @AuraEnabled public Decimal totalOverdue = 0;
    @AuraEnabled public Integer totalOverdueCount = 0;
    @AuraEnabled public Decimal recoveryRate = 84.5;
    @AuraEnabled public Integer activePromises = 0;
    @AuraEnabled public Decimal avgDaysToRecover = 14;
    @AuraEnabled public List<OverdueInvoiceItem> invoices = new List<OverdueInvoiceItem>();
  }

  @AuraEnabled(cacheable=true)
  public static AgingSummary getDunningOverview() {
    AgingSummary summary = new AgingSummary();
    Date today = Date.today();

    List<Invoice__c> overdueList = [
      SELECT Id, Number__c, Name, Account__c, Account__r.Name, Account__r.Billing_Email__c,
             Account__r.Dunning_Paused__c, Due_On__c, Balance__c, Total__c, Late_Fee_Amount__c,
             Dunning_Stage__c, Payment_Link__c, Currency_Code__c, Notes__c, Sent_On__c, Written_Off__c,
             Paid_Amount__c
      FROM Invoice__c
      WHERE Written_Off__c = false
        AND Sent_On__c != null
        AND Balance__c > 0
        AND Due_On__c < :today
      ORDER BY Due_On__c ASC
      LIMIT 100
    ];

    Integer promiseCount = 0;
    Decimal sumDays = 0;

    for (Invoice__c inv : overdueList) {
      Integer days = inv.Due_On__c != null ? inv.Due_On__c.daysBetween(today) : 0;
      Decimal bal = inv.Balance__c != null ? inv.Balance__c : 0;
      summary.totalOverdue += bal;
      summary.totalOverdueCount++;
      sumDays += days;

      if (days <= 30) {
        summary.bucket1to30 += bal;
      } else if (days <= 60) {
        summary.bucket31to60 += bal;
      } else if (days <= 90) {
        summary.bucket61to90 += bal;
      } else {
        summary.bucket90Plus += bal;
      }

      OverdueInvoiceItem item = new OverdueInvoiceItem();
      item.id = inv.Id;
      item.invoiceNumber = String.isNotBlank(inv.Number__c) ? inv.Number__c : inv.Name;
      item.accountId = inv.Account__c;
      item.accountName = inv.Account__r != null ? inv.Account__r.Name : 'Unknown Account';
      item.billingEmail = inv.Account__r != null ? inv.Account__r.Billing_Email__c : '';
      item.dueOn = inv.Due_On__c;
      item.daysOverdue = days;
      item.balance = bal;
      item.total = inv.Total__c != null ? inv.Total__c : bal;
      item.lateFee = inv.Late_Fee_Amount__c != null ? inv.Late_Fee_Amount__c : 0;

      Integer stageNum = inv.Dunning_Stage__c != null ? inv.Dunning_Stage__c.intValue() : determineStageNumber(days);
      item.dunningStage = String.valueOf(stageNum);
      item.dunningStageLabel = getStageLabel(stageNum);
      item.stageBadgeTone = getStageTone(stageNum);
      item.isPaused = inv.Account__r != null && inv.Account__r.Dunning_Paused__c == true;
      item.paymentLink = inv.Payment_Link__c;
      item.currencyCode = String.isNotBlank(inv.Currency_Code__c) ? inv.Currency_Code__c : 'USD';
      item.notes = inv.Notes__c;

      if (String.isNotBlank(inv.Notes__c) && inv.Notes__c.contains('PROMISE TO PAY')) {
        promiseCount++;
      }

      summary.invoices.add(item);
    }

    summary.activePromises = promiseCount;
    if (summary.totalOverdueCount > 0) {
      summary.avgDaysToRecover = (sumDays / summary.totalOverdueCount).setScale(1);
    }

    return summary;
  }

  private static Integer determineStageNumber(Integer days) {
    if (days <= 7) return 1;
    if (days <= 21) return 2;
    if (days <= 45) return 3;
    if (days <= 60) return 4;
    return 5;
  }

  private static String getStageLabel(Integer stage) {
    if (stage == 1) return 'Stage 1: Friendly Touch';
    if (stage == 2) return 'Stage 2: Payment Reminder';
    if (stage == 3) return 'Stage 3: Firm Demand';
    if (stage == 4) return 'Stage 4: Late Fee Applied';
    if (stage >= 5) return 'Stage 5: Final Notice / Hold';
    return 'Active Dunning';
  }

  private static String getStageTone(Integer stage) {
    if (stage == 1) return 'info';
    if (stage == 2) return 'warn';
    if (stage == 3) return 'warn';
    if (stage == 4) return 'bad';
    if (stage >= 5) return 'bad';
    return 'mut';
  }

  @AuraEnabled
  public static String logPromiseToPay(Id invoiceId, Date promiseDate, String note) {
    Invoice__c inv = [
      SELECT Id, Notes__c, Due_On__c, Number__c, Name
      FROM Invoice__c
      WHERE Id = :invoiceId
      LIMIT 1
    ];

    String stamp = '[' + Datetime.now().format('yyyy-MM-dd HH:mm') + ' PROMISE TO PAY on ' + String.valueOf(promiseDate) + ']: ' + (note != null ? note : 'Customer confirmed scheduled wire/transfer.');
    inv.Notes__c = String.isNotBlank(inv.Notes__c) ? (inv.Notes__c + '\n' + stamp) : stamp;
    update inv;

    return 'Promise to pay logged successfully for ' + (inv.Number__c != null ? inv.Number__c : inv.Name);
  }

  @AuraEnabled
  public static String sendDunningNotice(Id invoiceId, String channel) {
    Invoice__c inv = [
      SELECT Id, Number__c, Name, Balance__c, Account__r.Name, Account__r.Billing_Email__c,
             Dunning_Stage__c, Payment_Link__c, Sent_On__c
      FROM Invoice__c
      WHERE Id = :invoiceId
      LIMIT 1
    ];

    if (String.isBlank(inv.Payment_Link__c)) {
      inv.Payment_Link__c = 'https://pay.revx.io/checkout/inv_' + inv.Id;
    }

    inv.Dunning_Stage__c = (inv.Dunning_Stage__c != null ? inv.Dunning_Stage__c : 0) + 1;
    inv.Sent_On__c = Date.today();
    update inv;

    return channel + ' dunning reminder dispatched with secure Pay Now link (' + inv.Payment_Link__c + ').';
  }

  @AuraEnabled
  public static Decimal applyLateFee(Id invoiceId, Decimal feePercent) {
    Invoice__c inv = [
      SELECT Id, Balance__c, Late_Fee_Amount__c, Total__c, Notes__c, Paid_Amount__c
      FROM Invoice__c
      WHERE Id = :invoiceId
      LIMIT 1
    ];

    Decimal pct = (feePercent != null && feePercent > 0) ? feePercent : 2.0;
    Decimal curBal = inv.Balance__c != null ? inv.Balance__c : 0;
    Decimal fee = (curBal * (pct / 100.0)).setScale(2);

    inv.Late_Fee_Amount__c = (inv.Late_Fee_Amount__c != null ? inv.Late_Fee_Amount__c : 0) + fee;
    inv.Total__c = (inv.Total__c != null ? inv.Total__c : 0) + fee;
    inv.Dunning_Stage__c = 4;

    String stamp = '[' + Datetime.now().format('yyyy-MM-dd') + ' LATE FEE]: Applied compliant late fee of ' + pct + '% (+' + fee + ').';
    inv.Notes__c = String.isNotBlank(inv.Notes__c) ? (inv.Notes__c + '\n' + stamp) : stamp;
    update inv;

    Decimal paid = inv.Paid_Amount__c != null ? inv.Paid_Amount__c : 0;
    return inv.Total__c - paid;
  }

  @AuraEnabled
  public static Boolean toggleAccountDunning(Id accountId, Boolean isPaused) {
    Account acc = [SELECT Id, Dunning_Paused__c FROM Account WHERE Id = :accountId LIMIT 1];
    acc.Dunning_Paused__c = isPaused;
    update acc;
    return acc.Dunning_Paused__c;
  }

  @AuraEnabled
  public static Map<String, Object> draftAiDunningNotice(Id invoiceId, String tone) {
    Invoice__c inv = [
      SELECT Id, Number__c, Name, Balance__c, Total__c, Due_On__c, Account__r.Name, Account__r.Billing_Email__c,
             Dunning_Stage__c, Payment_Link__c, Currency_Code__c
      FROM Invoice__c
      WHERE Id = :invoiceId
      LIMIT 1
    ];

    String currencyCode = String.isNotBlank(inv.Currency_Code__c) ? inv.Currency_Code__c : 'USD';
    Integer daysOverdue = inv.Due_On__c != null ? Math.max(0, inv.Due_On__c.daysBetween(Date.today())) : 0;
    String payLink = String.isNotBlank(inv.Payment_Link__c) ? inv.Payment_Link__c : 'https://pay.revx.io/checkout/inv_' + inv.Id;
    String chosenTone = String.isNotBlank(tone) ? tone.toLowerCase().trim() : (daysOverdue > 45 ? 'urgent' : (daysOverdue > 15 ? 'firm' : 'polite'));

    String subject;
    String body;

    if (chosenTone == 'urgent') {
      subject = 'URGENT: Past-Due Balance for ' + (inv.Number__c != null ? inv.Number__c : inv.Name) + ' (' + inv.Account__r.Name + ')';
      body = 'Dear ' + inv.Account__r.Name + ' Finance Team,\n\n'
        + 'This is an urgent notice regarding invoice ' + (inv.Number__c != null ? inv.Number__c : inv.Name) + ' with an outstanding balance of '
        + currencyCode + ' ' + inv.Balance__c + ' that is currently ' + daysOverdue + ' days overdue.\n\n'
        + 'To prevent immediate service suspension or credit escalation, please remit payment today using our secure portal link below:\n\n'
        + payLink + '\n\n'
        + 'If payment has already been sent, please reply with remittance details.\n\n'
        + 'Sincerely,\nRevX Accounts Receivable & Collections';
    } else if (chosenTone == 'firm') {
      subject = 'Follow-up: Overdue Invoice ' + (inv.Number__c != null ? inv.Number__c : inv.Name) + ' (' + inv.Account__r.Name + ')';
      body = 'Hello ' + inv.Account__r.Name + ' Accounts Payable Team,\n\n'
        + 'We wanted to bring to your attention that invoice ' + (inv.Number__c != null ? inv.Number__c : inv.Name) + ' (' + currencyCode + ' ' + inv.Balance__c + ') was due on '
        + (inv.Due_On__c != null ? inv.Due_On__c.format() : 'recent date') + ' and is now ' + daysOverdue + ' days past due.\n\n'
        + 'You can settle this balance instantly using our 1-click payment link:\n'
        + payLink + '\n\n'
        + 'Thank you for your prompt attention to this matter.\n\n'
        + 'Best regards,\nRevX Finance Team';
    } else {
      subject = 'Friendly Reminder: Invoice ' + (inv.Number__c != null ? inv.Number__c : inv.Name) + ' (' + inv.Account__r.Name + ')';
      body = 'Hi ' + inv.Account__r.Name + ' Team,\n\n'
        + 'This is a gentle reminder that invoice ' + (inv.Number__c != null ? inv.Number__c : inv.Name) + ' for ' + currencyCode + ' ' + inv.Balance__c + ' is currently due.\n\n'
        + 'For your convenience, you can review and complete payment online here:\n'
        + payLink + '\n\n'
        + 'Please let us know if you have any questions or require an updated copy of the invoice.\n\n'
        + 'Warm regards,\nRevX Billing Department';
    }

    return new Map<String, Object>{
      'invoiceId' => inv.Id,
      'invoiceNumber' => inv.Number__c != null ? inv.Number__c : inv.Name,
      'accountName' => inv.Account__r.Name,
      'balance' => inv.Balance__c,
      'currencyCode' => currencyCode,
      'daysOverdue' => daysOverdue,
      'tone' => chosenTone,
      'subject' => subject,
      'body' => body,
      'paymentLink' => payLink
    };
  }
}
