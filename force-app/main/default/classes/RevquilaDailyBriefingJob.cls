/**
 * Revquila Daily Revenue Briefing Job:
 * Schedulable batch & on-demand service that compiles an executive daily digest of
 * expiring quotes (< 7 days), overdue invoices, renewals due (< 30 days), and open high-risk
 * exceptions. Powers the Daily Briefing widget in the Command Center and posts alerts to Slack/email.
 */
public with sharing class RevquilaDailyBriefingJob implements Schedulable {

  public class BriefingSummary {
    @AuraEnabled public Integer expiringQuotesCount = 0;
    @AuraEnabled public Decimal expiringQuotesAmount = 0;
    @AuraEnabled public Integer overdueInvoicesCount = 0;
    @AuraEnabled public Decimal overdueInvoicesAmount = 0;
    @AuraEnabled public Integer renewalsDueCount = 0;
    @AuraEnabled public Decimal renewalsDueAmount = 0;
    @AuraEnabled public Integer pendingExceptionsCount = 0;
    @AuraEnabled public String digestText;
    @AuraEnabled public List<String> actionItems = new List<String>();
    @AuraEnabled public Datetime generatedAt;
  }

  /**
   * Schedulable interface implementation.
   */
  public void execute(SchedulableContext sc) {
    runBriefingJob();
  }

  /**
   * Generates the briefing and dispatches multi-channel alerts (Notification__c, Slack).
   */
  public static BriefingSummary runBriefingJob() {
    BriefingSummary summary = getDailyBriefing();

    // 1. Create a platform Notification__c record
    try {
      Notification__c notif = new Notification__c(
        User__c = UserInfo.getUserId(),
        Kind__c = 'daily_briefing',
        Title__c = ('Daily Briefing: ' + summary.overdueInvoicesCount + ' Overdue, ' + summary.expiringQuotesCount + ' Expiring Quotes').abbreviate(255),
        Detail__c = ('Total Overdue: ₹' + summary.overdueInvoicesAmount.setScale(2).toPlainString() + ' across ' + summary.overdueInvoicesCount + ' bills.').abbreviate(255),
        Occurred_On__c = System.now()
      );
      Database.insert(new List<Notification__c>{ notif }, false, AccessLevel.USER_MODE);
    } catch (Exception e) {
      System.debug(LoggingLevel.WARN, 'Could not insert Notification__c: ' + e.getMessage());
    }

    // 2. Dispatch Slack notification if configured
    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    if (secrets != null && String.isNotBlank(secrets.Slack_Webhook__c)) {
      sendSlackDigest(secrets.Slack_Webhook__c, summary);
    }

    return summary;
  }

  /**
   * AuraEnabled method to fetch live daily briefing data for the Command Center.
   */
  @AuraEnabled
  public static BriefingSummary getDailyBriefing() {
    BriefingSummary res = new BriefingSummary();
    res.generatedAt = Datetime.now();
    Date today = Date.today();

    // 1. Expiring Quotes within 7 days
    Date quoteExpiryLimit = today.addDays(7);
    for (Quote__c q : [
      SELECT Id, Net_Amount__c
      FROM Quote__c
      WHERE Status__c IN ('draft', 'sent', 'approval')
        AND Valid_Until__c <= :quoteExpiryLimit
        AND Valid_Until__c >= :today
      WITH USER_MODE
    ]) {
      res.expiringQuotesCount++;
      res.expiringQuotesAmount += (q.Net_Amount__c != null ? q.Net_Amount__c : 0);
    }

    // 2. Overdue Invoices
    for (Invoice__c inv : [
      SELECT Id, Balance__c
      FROM Invoice__c
      WHERE Written_Off__c = false
        AND Sent_On__c != null
        AND Balance__c > 0
        AND Due_On__c < :today
      WITH USER_MODE
    ]) {
      res.overdueInvoicesCount++;
      res.overdueInvoicesAmount += (inv.Balance__c != null ? inv.Balance__c : 0);
    }

    // 3. Renewals Due within 30 days
    Date renewalLimit = today.addDays(30);
    for (Contract__c c : [
      SELECT Id, Annual_Value__c
      FROM Contract__c
      WHERE Status__c = 'active'
        AND End_Date__c <= :renewalLimit
        AND End_Date__c >= :today
      WITH USER_MODE
    ]) {
      res.renewalsDueCount++;
      res.renewalsDueAmount += (c.Annual_Value__c != null ? c.Annual_Value__c : 0);
    }

    // 4. Pending Exception Items
    res.pendingExceptionsCount = [
      SELECT COUNT()
      FROM Exception_Item__c
      WHERE Status__c = 'Pending'
    ];

    // Build Markdown Digest
    String md = '### 🌅 RevX Morning Revenue Briefing\n\n' +
      '• **Overdue Collections:** **' + res.overdueInvoicesCount + ' invoices** totaling **₹' + res.overdueInvoicesAmount.setScale(2).toPlainString() + '**\n' +
      '• **Expiring Quotes (<7 Days):** **' + res.expiringQuotesCount + ' deals** valued at **₹' + res.expiringQuotesAmount.setScale(2).toPlainString() + '**\n' +
      '• **Renewals Pipeline (<30 Days):** **' + res.renewalsDueCount + ' contracts** representing **₹' + res.renewalsDueAmount.setScale(2).toPlainString() + '** ARR\n' +
      '• **Exception Inbox:** **' + res.pendingExceptionsCount + ' items** awaiting managerial approval\n\n';

    if (res.overdueInvoicesCount > 0) {
      res.actionItems.add('Execute Dunning Batch: Send reminders to all ' + res.overdueInvoicesCount + ' overdue bills.');
    }
    if (res.expiringQuotesCount > 0) {
      res.actionItems.add('Quote Follow-up: Re-engage contacts on ' + res.expiringQuotesCount + ' expiring quotes before validity closes.');
    }
    if (res.renewalsDueCount > 0) {
      res.actionItems.add('Initiate Renewals: Apply contracted 5% uplift to ' + res.renewalsDueCount + ' upcoming contracts.');
    }
    if (res.pendingExceptionsCount > 0) {
      res.actionItems.add('Clear Exceptions: Triage ' + res.pendingExceptionsCount + ' flagged items in the Exception Inbox.');
    }

    res.digestText = md;
    return res;
  }

  /**
   * Async Slack Dispatcher.
   */
  @future(callout=true)
  private static void sendSlackDigest(String webhookUrl, String payloadJson) {
    try {
      HttpRequest req = new HttpRequest();
      req.setEndpoint(webhookUrl);
      req.setMethod('POST');
      req.setHeader('Content-Type', 'application/json');
      req.setBody(payloadJson);
      new Http().send(req);
    } catch (Exception e) {
      System.debug(LoggingLevel.WARN, 'Slack webhook callout failed: ' + e.getMessage());
    }
  }

  private static void sendSlackDigest(String webhookUrl, BriefingSummary summary) {
    Map<String, Object> slackBody = new Map<String, Object>{
      'text' => '🌅 *RevX Daily Revenue Briefing*\n' +
        '• Overdue AR: *₹' + summary.overdueInvoicesAmount.setScale(2).toPlainString() + '* (' + summary.overdueInvoicesCount + ' bills)\n' +
        '• Expiring Quotes: *₹' + summary.expiringQuotesAmount.setScale(2).toPlainString() + '* (' + summary.expiringQuotesCount + ' deals)\n' +
        '• Upcoming Renewals: *₹' + summary.renewalsDueAmount.setScale(2).toPlainString() + '* (' + summary.renewalsDueCount + ' contracts)\n' +
        '• Pending Exceptions: *' + summary.pendingExceptionsCount + ' items*'
    };
    sendSlackDigest(webhookUrl, JSON.serialize(slackBody));
  }
}
