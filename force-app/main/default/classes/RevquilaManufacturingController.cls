/**
 * RevquilaManufacturingController:
 * Bridges Manufacturing Cloud run-rate commitments with RevX Quote-to-Cash.
 * Supports tracking long-term sales agreements, delivery schedules, and 1-click
 * order release directly into RevX Orders and GST Invoices.
 */
public with sharing class RevquilaManufacturingController {

  @AuraEnabled(cacheable=true)
  public static List<Sales_Agreement__c> getAgreements(Id accountId) {
    if (accountId != null) {
      return [
        SELECT Id, Name, Account__c, Account__r.Name, Status__c,
               Start_Date__c, End_Date__c, Total_Committed_Quantity__c,
               Total_Actual_Quantity__c, Total_Committed_Amount__c,
               Total_Actual_Amount__c, Pricing_Tier__c, Notes__c, CreatedDate
        FROM Sales_Agreement__c
        WHERE Account__c = :accountId
        ORDER BY CreatedDate DESC
        LIMIT 50
      ];
    }
    return [
      SELECT Id, Name, Account__c, Account__r.Name, Status__c,
             Start_Date__c, End_Date__c, Total_Committed_Quantity__c,
             Total_Actual_Quantity__c, Total_Committed_Amount__c,
             Total_Actual_Amount__c, Pricing_Tier__c, Notes__c, CreatedDate
      FROM Sales_Agreement__c
      ORDER BY CreatedDate DESC
      LIMIT 50
    ];
  }

  @AuraEnabled(cacheable=true)
  public static List<Sales_Agreement_Schedule__c> getSchedules(Id agreementId) {
    if (agreementId == null) {
      return new List<Sales_Agreement_Schedule__c>();
    }
    return [
      SELECT Id, Name, Sales_Agreement__c, Period_Name__c, Scheduled_Date__c,
             Planned_Quantity__c, Actual_Quantity__c, Agreed_Unit_Price__c,
             Planned_Amount__c, Actual_Amount__c, Status__c,
             Order__c, Order__r.Name
      FROM Sales_Agreement_Schedule__c
      WHERE Sales_Agreement__c = :agreementId
      ORDER BY Scheduled_Date__c ASC NULLS LAST, CreatedDate ASC
      LIMIT 100
    ];
  }

  @AuraEnabled
  public static Map<String, Object> releaseOrderFromSchedule(Id scheduleId) {
    Map<String, Object> result = new Map<String, Object>();
    try {
      if (scheduleId == null) {
        throw new AuraHandledException('Schedule ID is required.');
      }

      Sales_Agreement_Schedule__c sched = [
        SELECT Id, Name, Sales_Agreement__c, Sales_Agreement__r.Name,
               Sales_Agreement__r.Account__c, Period_Name__c, Scheduled_Date__c,
               Planned_Quantity__c, Agreed_Unit_Price__c, Planned_Amount__c,
               Status__c, Order__c
        FROM Sales_Agreement_Schedule__c
        WHERE Id = :scheduleId
        LIMIT 1
      ];

      if (sched.Status__c == 'Released' && sched.Order__c != null) {
        result.put('success', true);
        result.put('orderId', sched.Order__c);
        result.put('message', 'Schedule has already been released to Order.');
        return result;
      }

      // 1. Create RevX Order
      Order__c ord = new Order__c();
      ord.Account__c = sched.Sales_Agreement__r.Account__c;
      ord.Order_Date__c = sched.Scheduled_Date__c != null ? sched.Scheduled_Date__c : Date.today();
      ord.Status__c = 'booked';
      ord.Subtotal__c = sched.Planned_Amount__c != null ? sched.Planned_Amount__c : (sched.Planned_Quantity__c * sched.Agreed_Unit_Price__c);
      ord.Total__c = ord.Subtotal__c;
      ord.Notes__c = 'Auto-released from Manufacturing Agreement ' + sched.Sales_Agreement__r.Name + ' (' + sched.Period_Name__c + ')';
      insert ord;

      // 2. Attach Line Item
      Product2 prod = null;
      List<Product2> prods = [SELECT Id, Name FROM Product2 WHERE IsActive = true LIMIT 1];
      if (!prods.isEmpty()) {
        prod = prods[0];
      }

      Order_Line__c line = new Order_Line__c();
      line.Order__c = ord.Id;
      line.Quantity__c = sched.Planned_Quantity__c;
      line.Unit_Price__c = sched.Agreed_Unit_Price__c;
      line.Net_Amount__c = ord.Subtotal__c;
      line.Description__c = 'Batch delivery commitment: ' + sched.Period_Name__c;
      if (prod != null) {
        line.Product__c = prod.Id;
      }
      insert line;

      // 3. Update Schedule
      sched.Status__c = 'Released';
      sched.Order__c = ord.Id;
      sched.Actual_Quantity__c = sched.Planned_Quantity__c;
      sched.Actual_Amount__c = ord.Subtotal__c;
      update sched;

      // 4. Update parent agreement totals
      updateAgreementActuals(sched.Sales_Agreement__c);

      result.put('success', true);
      result.put('orderId', ord.Id);
      result.put('message', 'Successfully generated Order ' + ord.Id + ' from schedule!');
    } catch (Exception ex) {
      result.put('success', false);
      result.put('message', ex.getMessage());
    }
    return result;
  }

  @AuraEnabled
  public static Map<String, Object> createSampleAgreement(Id accountId) {
    Map<String, Object> res = new Map<String, Object>();
    try {
      if (accountId == null) {
        Account a = [SELECT Id FROM Account LIMIT 1];
        accountId = a.Id;
      }

      Sales_Agreement__c sa = new Sales_Agreement__c();
      sa.Account__c = accountId;
      sa.Status__c = 'Activated';
      sa.Start_Date__c = Date.today();
      sa.End_Date__c = Date.today().addMonths(12);
      sa.Pricing_Tier__c = 'Tier 1 Enterprise Volume (15% Flat Rebate)';
      sa.Notes__c = 'Automated run-rate commitment for FY2026/27. Monthly 5,000 unit batch pull with ASC 606 revenue recognition.';
      sa.Total_Committed_Quantity__c = 60000;
      sa.Total_Committed_Amount__c = 1500000;
      sa.Total_Actual_Quantity__c = 0;
      sa.Total_Actual_Amount__c = 0;
      insert sa;

      List<Sales_Agreement_Schedule__c> schedules = new List<Sales_Agreement_Schedule__c>();
      for (Integer i = 1; i <= 6; i++) {
        Sales_Agreement_Schedule__c s = new Sales_Agreement_Schedule__c();
        s.Sales_Agreement__c = sa.Id;
        s.Period_Name__c = 'Batch ' + i + ' - ' + DateTime.newInstance(Date.today().addMonths(i - 1), Time.newInstance(0,0,0,0)).format('MMM yyyy');
        s.Scheduled_Date__c = Date.today().addMonths(i - 1);
        s.Planned_Quantity__c = 5000;
        s.Agreed_Unit_Price__c = 25.00;
        s.Planned_Amount__c = 125000.00;
        s.Actual_Quantity__c = 0;
        s.Actual_Amount__c = 0;
        s.Status__c = (i == 1) ? 'Pending' : 'Pending';
        schedules.add(s);
      }
      insert schedules;

      res.put('success', true);
      res.put('agreementId', sa.Id);
      res.put('message', 'Created sample Sales Agreement and schedules.');
    } catch (Exception e) {
      res.put('success', false);
      res.put('message', e.getMessage());
    }
    return res;
  }

  private static void updateAgreementActuals(Id agreementId) {
    if (agreementId == null) return;
    List<Sales_Agreement_Schedule__c> allScheds = [
      SELECT Actual_Quantity__c, Actual_Amount__c
      FROM Sales_Agreement_Schedule__c
      WHERE Sales_Agreement__c = :agreementId
    ];
    Decimal totalQty = 0;
    Decimal totalAmt = 0;
    for (Sales_Agreement_Schedule__c sc : allScheds) {
      if (sc.Actual_Quantity__c != null) totalQty += sc.Actual_Quantity__c;
      if (sc.Actual_Amount__c != null) totalAmt += sc.Actual_Amount__c;
    }
    Sales_Agreement__c parent = new Sales_Agreement__c(
      Id = agreementId,
      Total_Actual_Quantity__c = totalQty,
      Total_Actual_Amount__c = totalAmt
    );
    update parent;
  }
}
