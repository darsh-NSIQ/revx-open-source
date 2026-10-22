/**
 * RevX Milestone & Advance Billing Schedule Controller:
 * Empowers enterprise teams to split contract/order billing into milestone schedules (e.g. 30/40/30, 50/50, or custom).
 * Tracks schedule execution states, and generates invoices upon milestone achievement.
 */
public with sharing class RevquilaBillingScheduleController {

  public class ScheduleView {
    @AuraEnabled public Id id;
    @AuraEnabled public String name;
    @AuraEnabled public String description;
    @AuraEnabled public Decimal amount;
    @AuraEnabled public Date billDate;
    @AuraEnabled public String status;
    @AuraEnabled public Id invoiceId;
    @AuraEnabled public String invoiceNumber;
    @AuraEnabled public String currencyCode;
    @AuraEnabled public Id orderId;
    @AuraEnabled public Id accountId;
  }

  public class MilestoneRequest {
    @AuraEnabled @InvocableVariable(label='Order ID' required=true)
    public Id orderId;

    @AuraEnabled @InvocableVariable(label='Preset Type' description='30_40_30, 50_50, or quarterly_advance')
    public String preset;

    @AuraEnabled @InvocableVariable(label='Custom Description')
    public String description;

    @AuraEnabled @InvocableVariable(label='Amount')
    public Decimal amount;

    @AuraEnabled @InvocableVariable(label='Target Bill Date')
    public Date billDate;
  }

  public class MilestoneResult {
    @AuraEnabled @InvocableVariable(label='Success')
    public Boolean success;

    @AuraEnabled @InvocableVariable(label='Message')
    public String message;

    @AuraEnabled @InvocableVariable(label='Schedules Created Count')
    public Integer count;

    @AuraEnabled @InvocableVariable(label='Generated Invoice ID')
    public Id invoiceId;
  }

  /**
   * Retrieves all billing schedules for an Order or Account.
   */
  @AuraEnabled(cacheable=true)
  public static List<ScheduleView> getSchedules(Id parentId) {
    if (parentId == null) {
      return new List<ScheduleView>();
    }
    List<Billing_Schedule__c> rows = [
      SELECT Id, Name, Description__c, Amount__c, Bill_Date__c, Status__c, Invoice__c,
             Invoice__r.Name, Currency_Code__c, Order__c, Account__c
      FROM Billing_Schedule__c
      WHERE Order__c = :parentId OR Account__c = :parentId
      ORDER BY Bill_Date__c ASC, CreatedDate ASC
      LIMIT 100
    ];

    List<ScheduleView> out = new List<ScheduleView>();
    for (Billing_Schedule__c bs : rows) {
      ScheduleView v = new ScheduleView();
      v.id = bs.Id;
      v.name = bs.Name;
      v.description = bs.Description__c;
      v.amount = bs.Amount__c;
      v.billDate = bs.Bill_Date__c;
      v.status = bs.Status__c;
      v.invoiceId = bs.Invoice__c;
      v.invoiceNumber = bs.Invoice__r != null ? bs.Invoice__r.Name : null;
      v.currencyCode = bs.Currency_Code__c != null ? bs.Currency_Code__c : 'USD';
      v.orderId = bs.Order__c;
      v.accountId = bs.Account__c;
      out.add(v);
    }
    return out;
  }

  /**
   * Invocable action for Agentforce / Flow.
   */
  @InvocableMethod(label='RevX: Manage Milestone Billing Schedule' description='Creates or executes milestone billing schedules for orders.' category='RevX')
  public static List<MilestoneResult> manageMilestoneInvocable(List<MilestoneRequest> requests) {
    List<MilestoneResult> results = new List<MilestoneResult>();
    for (MilestoneRequest req : requests) {
      MilestoneResult res = new MilestoneResult();
      try {
        if (String.isNotBlank(req.preset)) {
          Integer created = applyPreset(req.orderId, req.preset);
          res.success = true;
          res.count = created;
          res.message = 'Created ' + created + ' milestone schedules using ' + req.preset + ' preset.';
        } else if (req.amount != null && req.amount > 0) {
          Id schedId = addCustomSchedule(req.orderId, req.description, req.amount, req.billDate);
          res.success = true;
          res.count = 1;
          res.message = 'Created custom milestone schedule: ' + req.description;
        } else {
          res.success = false;
          res.message = 'Please specify preset or milestone amount.';
        }
      } catch (Exception e) {
        res.success = false;
        res.message = e.getMessage();
      }
      results.add(res);
    }
    return results;
  }

  /**
   * Applies standard milestone billing presets.
   */
  @AuraEnabled
  public static Integer applyPreset(Id orderId, String preset) {
    Order__c ord = [
      SELECT Id, Name, Account__c, Total__c, Currency_Code__c, Order_Date__c
      FROM Order__c
      WHERE Id = :orderId
      LIMIT 1
    ];

    Decimal total = ord.Total__c != null && ord.Total__c > 0 ? ord.Total__c : 10000;
    String curr = ord.Currency_Code__c != null ? ord.Currency_Code__c : 'USD';
    Date startDate = ord.Order_Date__c != null ? ord.Order_Date__c : Date.today();

    List<Billing_Schedule__c> toInsert = new List<Billing_Schedule__c>();

    if (preset == '30_40_30') {
      toInsert.add(new Billing_Schedule__c(
        Order__c = ord.Id,
        Account__c = ord.Account__c,
        Description__c = 'Milestone 1: 30% Advance Execution Deposit',
        Amount__c = (total * 0.30).setScale(2),
        Bill_Date__c = startDate,
        Currency_Code__c = curr,
        Status__c = 'planned'
      ));
      toInsert.add(new Billing_Schedule__c(
        Order__c = ord.Id,
        Account__c = ord.Account__c,
        Description__c = 'Milestone 2: 40% Delivery / UAT Acceptance',
        Amount__c = (total * 0.40).setScale(2),
        Bill_Date__c = startDate.addDays(60),
        Currency_Code__c = curr,
        Status__c = 'planned'
      ));
      toInsert.add(new Billing_Schedule__c(
        Order__c = ord.Id,
        Account__c = ord.Account__c,
        Description__c = 'Milestone 3: 30% Go-Live & Final Signoff',
        Amount__c = (total * 0.30).setScale(2),
        Bill_Date__c = startDate.addDays(120),
        Currency_Code__c = curr,
        Status__c = 'planned'
      ));
    } else if (preset == '50_50') {
      toInsert.add(new Billing_Schedule__c(
        Order__c = ord.Id,
        Account__c = ord.Account__c,
        Description__c = 'Milestone 1: 50% Contract Execution',
        Amount__c = (total * 0.50).setScale(2),
        Bill_Date__c = startDate,
        Currency_Code__c = curr,
        Status__c = 'planned'
      ));
      toInsert.add(new Billing_Schedule__c(
        Order__c = ord.Id,
        Account__c = ord.Account__c,
        Description__c = 'Milestone 2: 50% Final Project Delivery',
        Amount__c = (total * 0.50).setScale(2),
        Bill_Date__c = startDate.addDays(90),
        Currency_Code__c = curr,
        Status__c = 'planned'
      ));
    } else { // quarterly_advance
      Decimal qAmt = (total / 4.0).setScale(2);
      for (Integer i = 0; i < 4; i++) {
        toInsert.add(new Billing_Schedule__c(
          Order__c = ord.Id,
          Account__c = ord.Account__c,
          Description__c = 'Quarterly Installment ' + (i + 1) + ' of 4',
          Amount__c = qAmt,
          Bill_Date__c = startDate.addMonths(i * 3),
          Currency_Code__c = curr,
          Status__c = 'planned'
        ));
      }
    }

    insert toInsert;
    return toInsert.size();
  }

  /**
   * Adds a single custom milestone schedule.
   */
  @AuraEnabled
  public static Id addCustomSchedule(Id orderId, String description, Decimal amount, Date billDate) {
    Order__c ord = [SELECT Id, Account__c, Currency_Code__c FROM Order__c WHERE Id = :orderId LIMIT 1];
    Billing_Schedule__c bs = new Billing_Schedule__c(
      Order__c = ord.Id,
      Account__c = ord.Account__c,
      Description__c = String.isNotBlank(description) ? description : 'Custom Milestone',
      Amount__c = amount,
      Bill_Date__c = billDate != null ? billDate : Date.today(),
      Currency_Code__c = ord.Currency_Code__c != null ? ord.Currency_Code__c : 'USD',
      Status__c = 'planned'
    );
    insert bs;
    return bs.Id;
  }

  /**
   * Generates a tax invoice for the milestone when reached.
   */
  @AuraEnabled
  public static Id invoiceMilestone(Id scheduleId) {
    Billing_Schedule__c bs = [
      SELECT Id, Name, Description__c, Amount__c, Currency_Code__c, Order__c, Account__c, Status__c, Invoice__c
      FROM Billing_Schedule__c
      WHERE Id = :scheduleId
      LIMIT 1
    ];

    if (bs.Invoice__c != null) {
      return bs.Invoice__c;
    }

    Invoice__c inv = new Invoice__c(
      Account__c = bs.Account__c,
      Order__c = bs.Order__c,
      Payment_Status__c = 'unpaid',
      Due_On__c = Date.today().addDays(30),
      Currency_Code__c = bs.Currency_Code__c != null ? bs.Currency_Code__c : 'USD',
      Notes__c = 'Invoice raised for ' + bs.Description__c,
      Total__c = bs.Amount__c
    );
    insert inv;

    Invoice_Line__c line = new Invoice_Line__c(
      Invoice__c = inv.Id,
      Quantity__c = 1,
      Unit_Price__c = bs.Amount__c,
      Net_Amount__c = bs.Amount__c,
      List_Amount__c = bs.Amount__c
    );
    insert line;

    bs.Status__c = 'invoiced';
    bs.Invoice__c = inv.Id;
    update bs;

    return inv.Id;
  }
}
