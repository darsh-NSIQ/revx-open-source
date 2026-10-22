/**
 * The daily jobs, scheduled from Setup > Jobs at the hour set there: expire quotes past their
 * date, raise the invoices that are due, bill usage, run dunning, renew or end subscriptions
 * and contracts, raise renewal quotes ahead of the date, tell owners about renewals coming
 * up, recognise revenue, and fetch exchange rates. Each step is its own transaction, so one
 * that fails does not stop the others; failures go to the integration log.
 */
public with sharing class RevquilaJobs implements Schedulable, Queueable, Database.AllowsCallouts {
  public static final String JOB_NAME = 'Revquila daily jobs';
  public static final List<String> STEPS = new List<String>{
    'quotes',
    'billing',
    'dunning',
    'renewals',
    'contracts',
    'revenue',
    'fx'
  };

  public class Status {
    @AuraEnabled
    public Boolean scheduled = false;
    @AuraEnabled
    public Integer hour;
    @AuraEnabled
    public Datetime nextRun;
    @AuraEnabled
    public Datetime lastRun;
    @AuraEnabled
    public List<String> lastResults = new List<String>();
  }

  private Integer stepIndex = 0;
  private Date asOf;

  public RevquilaJobs() {
    this(0, Date.today());
  }

  public RevquilaJobs(Integer stepIndex, Date asOf) {
    this.stepIndex = stepIndex;
    this.asOf = asOf;
  }

  public void execute(SchedulableContext context) {
    System.enqueueJob(new RevquilaJobs(0, Date.today()));
  }

  public void execute(QueueableContext context) {
    if (stepIndex >= STEPS.size()) {
      return;
    }
    String step = STEPS[stepIndex];
    String result;
    try {
      result = runStep(step, asOf);
      RevquilaCore.log('job', step, 'ok', null, result, null);
    } catch (Exception e) {
      RevquilaCore.log('job', step, 'failed', null, e.getMessage() + '\n' + e.getStackTraceString(), null);
    }
    if (stepIndex + 1 < STEPS.size() && !Test.isRunningTest()) {
      System.enqueueJob(new RevquilaJobs(stepIndex + 1, asOf));
    }
  }

  /** Runs one step now and says what it did. */
  public static String runStep(String step, Date asOf) {
    RevquilaSettings settings = RevquilaSettings.current();
    if (step == 'quotes') {
      return settings.expireQuotes ? expireQuotes(asOf) + ' quotes expired' : 'Quote expiry is off';
    }
    if (step == 'billing') {
      if (!settings.autoRunBilling) {
        return 'The billing run is off';
      }
      return RevquilaBilling.run(asOf) + ' invoices raised';
    }
    if (step == 'dunning') {
      return RevquilaBilling.dun(asOf) + ' dunning steps run';
    }
    if (step == 'renewals') {
      return renewals(asOf);
    }
    if (step == 'contracts') {
      return settings.expireContracts ? expireContracts(asOf) + ' contracts ended' : 'Contract expiry is off';
    }
    if (step == 'revenue') {
      return settings.autoRecognize ? RevquilaRevenue.recognize(asOf) + ' revenue periods recognised' : 'Automatic recognition is off';
    }
    if (step == 'fx') {
      return settings.fxAutoFetch ? RevquilaFx.fetch() : 'Rate fetching is off';
    }
    return 'Unknown step';
  }

  // ---------------------------------------------------------------- steps

  /** Marks quotes whose valid-until date has passed, and that were not signed, as expired. */
  public static Integer expireQuotes(Date asOf) {
    List<Quote__c> stale = [
      SELECT Id, Name
      FROM Quote__c
      WHERE Valid_Until__c < :asOf AND Status__c IN ('draft', 'approval', 'approved', 'rejected', 'sent')
      WITH USER_MODE
      LIMIT 500
    ];
    List<Quote__c> changes = new List<Quote__c>();
    List<Revenue_Event__c> events = new List<Revenue_Event__c>();
    for (Quote__c quote : stale) {
      changes.add(new Quote__c(Id = quote.Id, Status__c = 'expired'));
      events.add(RevquilaCore.event(quote.Id, 'Expired', 'Past its valid-until date', RevquilaCore.TONE_BAD));
    }
    update as user changes;
    insert as user events;
    for (Quote__c quote : stale) {
      RevquilaCore.publish(RevquilaCore.QUOTE_EXPIRED, quote.Id, new Map<String, Object>{ 'quote.number' => quote.Name });
    }
    return changes.size();
  }

  /**
   * Subscriptions at or past their renewal date renew (auto-renew on: a new term, priced with
   * the uplift, billed by schedules) or end (auto-renew off, or set to end). Ahead of the date,
   * a renewal quote is raised for those that do not renew by themselves, and the owner is told.
   */
  public static String renewals(Date asOf) {
    RevquilaSettings settings = RevquilaSettings.current();
    Integer renewed = 0;
    Integer ended = 0;
    Integer quoted = 0;
    for (Subscription__c subscription : [
      SELECT Id, Name, Account__c, Auto_Renew__c, Renewal_Date__c, Cancel_Reason__c, Term_Months__c, Contract__c,
        Contract__r.Evergreen__c, Contract__r.Uplift_Percent__c
      FROM Subscription__c
      WHERE Status__c = 'active' AND Renewal_Date__c <= :asOf
      WITH USER_MODE
      LIMIT 100
    ]) {
      Savepoint point = Database.setSavepoint();
      try {
        Boolean evergreen = subscription.Contract__r?.Evergreen__c == true;
        if ((subscription.Auto_Renew__c && settings.autoRenew && String.isBlank(subscription.Cancel_Reason__c)) || evergreen) {
          Decimal uplift = subscription.Contract__r?.Uplift_Percent__c != null ? subscription.Contract__r.Uplift_Percent__c : settings.renewalUplift;
          RevquilaSubscriptionController.renewTerm(subscription.Id, uplift);
          renewed++;
        } else {
          RevquilaSubscriptionController.endTerm(subscription.Id);
          ended++;
        }
      } catch (Exception e) {
        Database.rollback(point);
        RevquilaCore.log('job', 'renew ' + subscription.Name, 'failed', null, e.getMessage(), subscription.Id);
      }
    }
    // ahead of the date: a renewal quote for those that need a signature, and a heads-up for the owner
    Date horizon = asOf.addDays(settings.renewalLeadDays);
    for (Subscription__c subscription : [
      SELECT Id, Name, Account__r.Name, OwnerId, Renewal_Date__c, Auto_Renew__c, Contract__c, Contract__r.Renewal_Quote__c
      FROM Subscription__c
      WHERE Status__c = 'active' AND Renewal_Date__c > :asOf AND Renewal_Date__c <= :horizon
      WITH USER_MODE
      LIMIT 100
    ]) {
      Integer daysLeft = asOf.daysBetween(subscription.Renewal_Date__c);
      if (!subscription.Auto_Renew__c && subscription.Contract__c != null && subscription.Contract__r.Renewal_Quote__c == null) {
        try {
          RevquilaContractController.renewalQuote(subscription.Contract__c);
          quoted++;
        } catch (Exception e) {
          RevquilaCore.log('job', 'renewal quote ' + subscription.Name, 'failed', null, e.getMessage(), subscription.Id);
        }
      }
      if (daysLeft == 90 || daysLeft == 60 || daysLeft == 30) {
        RevquilaSubscriptionController.fireFor(subscription.Id, RevquilaCore.RENEWAL_DUE);
      }
    }
    return renewed + ' renewed, ' + ended + ' ended, ' + quoted + ' renewal quotes raised';
  }

  /** Ends contracts past their end date that did not renew. */
  public static Integer expireContracts(Date asOf) {
    List<Contract__c> ended = new List<Contract__c>();
    List<Revenue_Event__c> events = new List<Revenue_Event__c>();
    for (Contract__c contract : [
      SELECT Id, Name
      FROM Contract__c
      WHERE Status__c = 'active' AND End_Date__c < :asOf AND Evergreen__c = FALSE AND Auto_Renew__c = FALSE
      WITH USER_MODE
      LIMIT 200
    ]) {
      ended.add(new Contract__c(Id = contract.Id, Status__c = 'expired'));
      events.add(RevquilaCore.event(contract.Id, 'Contract ended', 'The term ran out without a renewal', RevquilaCore.TONE_WARN));
    }
    update as user ended;
    insert as user events;
    for (Contract__c contract : ended) {
      RevquilaCore.publish(RevquilaCore.CONTRACT_EXPIRED, contract.Id, new Map<String, Object>());
    }
    return ended.size();
  }

  // ---------------------------------------------------------------- Setup > Jobs

  public static Status status() {
    Status status = new Status();
    status.hour = RevquilaSettings.current().jobsHour;
    for (CronTrigger job : [
      SELECT Id, NextFireTime, PreviousFireTime, CronExpression
      FROM CronTrigger
      WHERE CronJobDetail.Name = :JOB_NAME
      LIMIT 1
    ]) {
      status.scheduled = true;
      status.nextRun = job.NextFireTime;
      status.lastRun = job.PreviousFireTime;
    }
    for (Integration_Log__c row : [
      SELECT Target__c, Status__c, Response__c, Occurred_On__c
      FROM Integration_Log__c
      WHERE Kind__c = 'job'
      WITH USER_MODE
      ORDER BY Occurred_On__c DESC
      LIMIT 7
    ]) {
      status.lastResults.add(row.Target__c + ': ' + (row.Status__c == 'ok' ? '' : 'FAILED ') + String.valueOf(row.Response__c).abbreviate(140));
      if (status.lastRun == null) {
        status.lastRun = row.Occurred_On__c;
      }
    }
    return status;
  }

  /** Schedules the daily run at an hour, replacing any earlier schedule. */
  public static void schedule(Integer hour) {
    RevquilaCore.need(RevquilaCore.allowed('settings'), 'You need the RevX Admin permission set to schedule the jobs.');
    unschedule();
    Integer at = hour == null || hour < 0 || hour > 23 ? 2 : hour;
    System.schedule(JOB_NAME, '0 0 ' + at + ' * * ?', new RevquilaJobs());
  }

  public static void unschedule() {
    for (CronTrigger job : [SELECT Id FROM CronTrigger WHERE CronJobDetail.Name = :JOB_NAME]) {
      System.abortJob(job.Id);
    }
  }

  /** Runs every step now, in the background. */
  public static Id runNow() {
    RevquilaCore.need(RevquilaCore.allowed('settings') || RevquilaCore.allowed('billing'), 'You need RevX Admin or Finance to run the jobs.');
    return System.enqueueJob(new RevquilaJobs(0, Date.today()));
  }
}