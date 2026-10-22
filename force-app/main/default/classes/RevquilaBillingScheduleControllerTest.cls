@IsTest
private class RevquilaBillingScheduleControllerTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Milestone Test Corp');
    insert acc;

    Order__c ord = new Order__c(
      Account__c = acc.Id,
      Total__c = 100000,
      Status__c = 'booked',
      Currency_Code__c = 'USD',
      Order_Date__c = Date.today()
    );
    insert ord;
  }

  @IsTest
  static void testPresetsAndQueries() {
    Order__c ord = [SELECT Id FROM Order__c LIMIT 1];

    Test.startTest();
    Integer count304030 = RevquilaBillingScheduleController.applyPreset(ord.Id, '30_40_30');
    System.assertEquals(3, count304030, 'Should create 3 schedules');

    List<RevquilaBillingScheduleController.ScheduleView> listViews = RevquilaBillingScheduleController.getSchedules(ord.Id);
    System.assertEquals(3, listViews.size(), 'Should query 3 schedules');

    Id invId = RevquilaBillingScheduleController.invoiceMilestone(listViews[0].id);
    System.assertNotEquals(null, invId, 'Should generate invoice for milestone');

    Id customId = RevquilaBillingScheduleController.addCustomSchedule(ord.Id, 'Go Live Bonus', 5000, Date.today().addDays(150));
    System.assertNotEquals(null, customId, 'Should create custom schedule');
    Test.stopTest();
  }

  @IsTest
  static void testInvocableAction() {
    Order__c ord = [SELECT Id FROM Order__c LIMIT 1];

    RevquilaBillingScheduleController.MilestoneRequest req = new RevquilaBillingScheduleController.MilestoneRequest();
    req.orderId = ord.Id;
    req.preset = '50_50';

    Test.startTest();
    List<RevquilaBillingScheduleController.MilestoneResult> res = RevquilaBillingScheduleController.manageMilestoneInvocable(
      new List<RevquilaBillingScheduleController.MilestoneRequest>{ req }
    );
    Test.stopTest();

    System.assertEquals(1, res.size(), 'Should return one result');
    System.assert(res[0].success, 'Execution should succeed');
    System.assertEquals(2, res[0].count, '50_50 should create 2 milestones');
  }
}
