/**
 * What happens around a moment in the quote-to-cash flow, beyond the record itself: the
 * platform event, the built-in notifications and emails, the Salesforce sync rules, and the
 * automation rules an admin writes in Setup ("when a quote is signed and the amount is over
 * 1,00,000, email the CFO, create a task, call this webhook, run this Flow").
 *
 * Nothing here may fail the action that caused it: every step catches and logs.
 */
public with sharing class RevquilaAutomation {
  /** Everything an action can use: the record, the facts, who to reach and the linked records. */
  public class Context {
    public String moment;
    public Id recordId;
    public String recordKind; // quote | invoice | subscription | order | contract
    public Map<String, Object> facts = new Map<String, Object>();
    /** Email addresses by role: contact, billing, owner, account_owner. */
    public Map<String, String> emails = new Map<String, String>();
    /** User ids by role: owner, account_owner, approvers (comma-joined ids). */
    public Map<String, Set<Id>> users = new Map<String, Set<Id>>();
    /** Linked record ids by object: Account, Contact, Opportunity, Quote, Invoice, Subscription. */
    public Map<String, Id> targets = new Map<String, Id>();
    public Quote__c quote;
  }

  /** Runs everything for a moment. */
  public static void fire(Context context) {
    RevquilaSettings settings = RevquilaSettings.current();
    RevquilaCore.publish(context.moment, context.recordId, context.facts);
    if (context.quote != null) {
      try {
        RevquilaSync.fire(context.moment, context.quote, context.facts);
      } catch (Exception e) {
        RevquilaCore.log('sync', context.moment, 'failed', null, e.getMessage(), context.recordId);
      }
    }
    try {
      builtIn(context, settings);
    } catch (Exception e) {
      RevquilaCore.log('notify', context.moment, 'failed', null, e.getMessage(), context.recordId);
    }
    for (RevquilaSettings.AutomationRule rule : settings.automationRules) {
      if (rule.active == false || rule.event != context.moment || rule.actions == null) {
        continue;
      }
      if (!RevquilaRules.matches(rule.conditions, context.facts)) {
        continue;
      }
      for (RevquilaSettings.ActionDef action : rule.actions) {
        try {
          run(action, context, settings);
        } catch (Exception e) {
          RevquilaCore.log('automation', rule.name + ' · ' + action.type, 'failed', JSON.serialize(action), e.getMessage(), context.recordId);
        }
      }
    }
  }

  // The notifications and emails Setup > Notifications switches on, by moment
  private static void builtIn(Context context, RevquilaSettings settings) {
    String moment = context.moment;
    String recordNumber = String.valueOf(context.facts.get('record.number'));
    String account = String.valueOf(context.facts.get('account.name'));
    if (moment == RevquilaCore.QUOTE_SUBMITTED && settings.notifies('approvalPending')) {
      RevquilaCore.notify(context.users.get('approvers'), 'approvalPending', 'Quote ' + recordNumber + ' is waiting for your approval', account + ' · ' + context.facts.get('quote.policyIssue'), context.recordId);
      sendTemplate('approval_pending', 'approvers', context, settings);
    }
    if (moment == RevquilaCore.QUOTE_APPROVED) {
      RevquilaCore.notify(context.users.get('owner'), 'approvalPending', 'Quote ' + recordNumber + ' was approved', account, context.recordId);
    }
    if (moment == RevquilaCore.QUOTE_REJECTED) {
      RevquilaCore.notify(context.users.get('owner'), 'approvalPending', 'Quote ' + recordNumber + ' was rejected', String.valueOf(context.facts.get('quote.note')), context.recordId);
    }
    if (moment == RevquilaCore.QUOTE_SENT) {
      sendTemplate('quote_sent', 'contact', context, settings);
    }
    if (moment == RevquilaCore.QUOTE_SIGNED && settings.notifies('quoteSigned')) {
      RevquilaCore.notify(context.users.get('owner'), 'quoteSigned', 'Quote ' + recordNumber + ' was signed', account, context.recordId);
      sendTemplate('quote_signed', 'owner', context, settings);
    }
    if (moment == RevquilaCore.INVOICE_SENT || moment == RevquilaCore.INVOICE_RAISED) {
      sendTemplate('invoice_sent', 'billing', context, settings);
    }
    if (moment == RevquilaCore.INVOICE_OVERDUE && settings.notifies('invoiceOverdue')) {
      RevquilaCore.notify(context.users.get('account_owner'), 'invoiceOverdue', 'Invoice ' + recordNumber + ' is overdue', account, context.recordId);
    }
    if ((moment == RevquilaCore.PAYMENT_RECEIVED || moment == RevquilaCore.INVOICE_PAID) && settings.notifies('paymentReceived')) {
      RevquilaCore.notify(context.users.get('account_owner'), 'paymentReceived', 'Payment received on ' + recordNumber, account + ' · ' + context.facts.get('payment.amount'), context.recordId);
      if (moment == RevquilaCore.PAYMENT_RECEIVED) {
        sendTemplate('payment_received', 'billing', context, settings);
      }
    }
    if (moment == RevquilaCore.RENEWAL_DUE && settings.notifies('renewalDue')) {
      RevquilaCore.notify(context.users.get('owner'), 'renewalDue', 'Renewal due: ' + account, recordNumber + ' · ' + context.facts.get('subscription.daysLeft') + ' days', context.recordId);
      sendTemplate('renewal_due', 'contact', context, settings);
    }
  }

  // ---------------------------------------------------------------- actions

  private static void run(
    RevquilaSettings.ActionDef action,
    Context context,
    RevquilaSettings settings
  ) {
    String type = action.type == null ? '' : action.type;
    if (type == 'email') {
      String subject = fillIn(action.subject, context.facts);
      String body = fillIn(action.body, context.facts);
      if (String.isNotBlank(action.template)) {
        RevquilaSettings.MailTemplate template = settings.emailTemplates.get(action.template);
        if (template != null) {
          subject = fillIn(template.subject, context.facts);
          body = fillIn(template.body, context.facts);
        }
      }
      for (String address : recipients(action.to, context)) {
        send(address, subject, body, context, 'automation');
      }
    } else if (type == 'notify') {
      Set<Id> users = new Set<Id>();
      for (String role : (action.to == null ? 'owner' : action.to).split(',')) {
        String key = role.trim();
        if (key.startsWith('user:') && key.substringAfter('user:') instanceof Id) {
          users.add((Id) key.substringAfter('user:'));
        } else if (context.users.containsKey(key)) {
          users.addAll(context.users.get(key));
        }
      }
      List<Notification__c> rows = new List<Notification__c>();
      for (Id userId : users) {
        rows.add(new Notification__c(User__c = userId, Kind__c = 'automation', Title__c = fillIn(action.title == null ? action.message : action.title, context.facts).abbreviate(255), Detail__c = fillIn(action.message, context.facts).abbreviate(255), Record_Id__c = context.recordId, Occurred_On__c = System.now()));
      }
      Database.insert(rows, false, AccessLevel.SYSTEM_MODE);
    } else if (type == 'task') {
      Id assignee;
      if (String.isNotBlank(action.assignTo) && action.assignTo.startsWith('user:') && action.assignTo.substringAfter('user:') instanceof Id) {
        assignee = (Id) action.assignTo.substringAfter('user:');
      } else if (context.users.containsKey(action.assignTo == null ? 'owner' : action.assignTo)) {
        for (Id userId : context.users.get(action.assignTo == null ? 'owner' : action.assignTo)) {
          assignee = userId;
        }
      }
      Task task = new Task(
        Subject = fillIn(action.subject == null ? action.title : action.subject, context.facts).abbreviate(255),
        Description = fillIn(action.body == null ? action.message : action.body, context.facts),
        ActivityDate = Date.today().addDays(action.value == null ? 1 : safeInt(action.value, 1)),
        Status = 'Not Started',
        OwnerId = assignee == null ? UserInfo.getUserId() : assignee,
        WhatId = context.targets.get('Account')
      );
      insert as user task;
    } else if (type == 'field') {
      Id targetId = context.targets.get(action.target);
      if (targetId == null) {
        throw new RevquilaCore.ProblemException('No ' + action.target + ' is linked.');
      }
      Object value = action.source == 'today' ? Date.today() : (String.isNotBlank(action.source) && action.source != 'value' ? context.facts.get(action.source) : fillIn(action.value, context.facts));
      SObject change = targetId.getSobjectType().newSObject(targetId);
      change.put(action.field, RevquilaSync.convertFor(targetId.getSobjectType(), action.field, value));
      update as user change;
    } else if (type == 'webhook') {
      if (String.isBlank(action.url)) {
        return;
      }
      Map<String, Object> payload = new Map<String, Object>{
        'event' => context.moment,
        'recordId' => context.recordId,
        'kind' => context.recordKind,
        'facts' => context.facts,
        'message' => fillIn(action.message, context.facts)
      };
      System.enqueueJob(new RevquilaWebhookJob(action.url, JSON.serialize(payload), context.recordId, 'webhook'));
    } else if (type == 'slack') {
      Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
      String url = String.isNotBlank(action.url) ? action.url : (secrets == null ? null : secrets.Slack_Webhook__c);
      if (String.isBlank(url)) {
        return;
      }
      System.enqueueJob(new RevquilaWebhookJob(url, JSON.serialize(new Map<String, Object>{ 'text' => fillIn(action.message, context.facts) }), context.recordId, 'slack'));
    } else if (type == 'flow') {
      if (String.isBlank(action.flow)) {
        return;
      }
      Map<String, Object> inputs = new Map<String, Object>{
        'recordId' => context.recordId,
        'event' => context.moment
      };
      Flow.Interview interview;
      if (action.flow.contains('__')) {
        interview = Flow.Interview.createInterview(action.flow.substringBefore('__'), action.flow.substringAfter('__'), inputs);
      } else {
        interview = Flow.Interview.createInterview(action.flow, inputs);
      }
      interview.start();
    }
  }

  private static Integer safeInt(String value, Integer fallback) {
    try {
      return Integer.valueOf(value.trim());
    } catch (Exception e) {
      return fallback;
    }
  }

  // ---------------------------------------------------------------- email

  /** Sends the template for a key to a role, when the template is on. */
  public static Boolean sendTemplate(
    String key,
    String role,
    Context context,
    RevquilaSettings settings
  ) {
    if (!settings.notifyEmail) {
      return false;
    }
    RevquilaSettings.MailTemplate template = settings.email(key);
    if (template == null) {
      return false;
    }
    Boolean sent = false;
    for (String address : recipients(role, context)) {
      if (send(address, fillIn(template.subject, context.facts), fillIn(template.body, context.facts), context, key)) {
        sent = true;
      }
    }
    return sent;
  }

  /** Sends one email to one address, HTML built from the plain text. Returns whether it went. */
  public static Boolean send(
    String address,
    String subject,
    String body,
    Context context,
    String kind
  ) {
    if (String.isBlank(address) || !address.contains('@')) {
      return false;
    }
    RevquilaSettings settings = RevquilaSettings.current();
    try {
      Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
      email.setToAddresses(new List<String>{ address.trim() });
      if (String.isNotBlank(settings.emailCc)) {
        email.setCcAddresses(settings.emailCc.split('[,;]'));
      }
      if (String.isNotBlank(settings.emailFromName)) {
        email.setSenderDisplayName(settings.emailFromName);
      }
      if (String.isNotBlank(settings.emailReplyTo)) {
        email.setReplyTo(settings.emailReplyTo);
      }
      email.setSubject(String.isBlank(subject) ? 'Revquila' : subject.abbreviate(255));
      String text = body == null ? '' : body;
      email.setPlainTextBody(text);
      email.setHtmlBody(
        '<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#181c25;line-height:1.5">' +
        text.escapeHtml4().replace('\n', '<br/>') +
        '</div>'
      );
      if (context != null && context.targets.get('Contact') != null) {
        email.setTargetObjectId(context.targets.get('Contact'));
        email.setTreatTargetObjectAsRecipient(false);
      }
      email.setSaveAsActivity(false);
      Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
      RevquilaCore.log('email', address, 'ok', subject, kind, context == null ? null : context.recordId);
      return true;
    } catch (Exception e) {
      RevquilaCore.log('email', address, 'failed', subject, e.getMessage(), context == null ? null : context.recordId);
      return false;
    }
  }

  // The addresses a role (or a typed list of addresses) means for this context
  private static List<String> recipients(String to, Context context) {
    List<String> addresses = new List<String>();
    String spec = String.isBlank(to) ? 'contact' : to;
    for (String part : spec.split(',')) {
      String key = part.trim();
      if (key.contains('@')) {
        addresses.add(key);
      } else if (key == 'approvers') {
        Set<Id> users = context.users.get('approvers');
        if (users != null && !users.isEmpty()) {
          for (User person : [SELECT Email FROM User WHERE Id IN :users AND IsActive = TRUE]) {
            addresses.add(person.Email);
          }
        }
      } else if (key.startsWith('user:') && key.substringAfter('user:') instanceof Id) {
        Id userId = (Id) key.substringAfter('user:');
        for (User person : [SELECT Email FROM User WHERE Id = :userId]) {
          addresses.add(person.Email);
        }
      } else if (context.emails.containsKey(key) && String.isNotBlank(context.emails.get(key))) {
        addresses.add(context.emails.get(key));
      }
    }
    return addresses;
  }

  /** Fills {{quote.number}}-style merge fields from the facts. Unknown fields come out empty. */
  public static String fillIn(String template, Map<String, Object> facts) {
    if (String.isBlank(template)) {
      return '';
    }
    String text = template;
    Matcher found = Pattern.compile('\\{\\{\\s*([a-zA-Z0-9_.]+)\\s*\\}\\}').matcher(template);
    Set<String> seen = new Set<String>();
    while (found.find()) {
      String key = found.group(1);
      if (seen.contains(key)) {
        continue;
      }
      seen.add(key);
      Object value = facts.get(key);
      String shown = '';
      if (value instanceof Date) {
        shown = RevquilaCore.dayText((Date) value);
      } else if (value instanceof Decimal) {
        shown = ((Decimal) value).setScale(2, RoundingMode.HALF_UP).toPlainString();
      } else if (value != null) {
        shown = String.valueOf(value);
      }
      text = text.replaceAll('\\{\\{\\s*' + Pattern.quote(key) + '\\s*\\}\\}', Matcher.quoteReplacement(shown));
    }
    return text;
  }
}