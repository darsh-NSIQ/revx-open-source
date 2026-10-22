@IsTest
private class RevquilaManufacturingControllerTest {

  @TestSetup
  static void setupData() {
    Account acc = new Account(Name = 'Test Manufacturing Corp');
    insert acc;

    Product2 prod = new Product2(Name = 'Industrial Sensor Unit', IsActive = true);
    insert prod;
  }

  @IsTest
  static void testManufacturingFlow() {
    Account acc = [SELECT Id FROM Account LIMIT 1];

    Test.startTest();
    Map<String, Object> createRes = RevquilaManufacturingController.createSampleAgreement(acc.Id);
    System.assertEquals(true, createRes.get('success'), 'Agreement should be created');
    Id agreementId = (Id) createRes.get('agreementId');

    List<Sales_Agreement__c> agrs = RevquilaManufacturingController.getAgreements(acc.Id);
    System.assertNotEquals(0, agrs.size(), 'Agreements should be fetched');

    List<Sales_Agreement_Schedule__c> scheds = RevquilaManufacturingController.getSchedules(agreementId);
    System.assertNotEquals(0, scheds.size(), 'Schedules should be retrieved');

    Map<String, Object> releaseRes = RevquilaManufacturingController.releaseOrderFromSchedule(scheds[0].Id);
    System.assertEquals(true, releaseRes.get('success'), 'Order should be released: ' + releaseRes.get('message'));

    // Test idempotent second release
    Map<String, Object> releaseRes2 = RevquilaManufacturingController.releaseOrderFromSchedule(scheds[0].Id);
    System.assertEquals(true, releaseRes2.get('success'), 'Second release should be handled gracefully');

    Test.stopTest();

    Sales_Agreement_Schedule__c updatedSched = [
      SELECT Status__c, Actual_Quantity__c, Order__c
      FROM Sales_Agreement_Schedule__c
      WHERE Id = :scheds[0].Id
    ];
    System.assertEquals('Released', updatedSched.Status__c, 'Schedule status should be Released');
    System.assertNotEquals(null, updatedSched.Order__c, 'Order should be linked');
  }
}
