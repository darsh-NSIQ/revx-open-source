@IsTest
private class RevquilaBillingControllerCoverageTest {
  @IsTest
  static void testBillingControllerOverviewAndSchedules() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Billing Overview Co', RevquilaTestData.HOME_STATE);
      
      Order__c ord = new Order__c(
        Account__c = acc.Id,
        Status__c = 'booked',
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert ord;

      Date today = Date.today();
      Billing_Schedule__c sch1 = new Billing_Schedule__c(
        Account__c = acc.Id,
        Order__c = ord.Id,
        Bill_Date__c = today,
        Period_Start__c = today,
        Period_End__c = today.addDays(30),
        Amount__c = 10000,
        Description__c = 'Monthly SaaS',
        Status__c = 'planned',
        Kind__c = 'recurring',
        Country__c = 'India',
        Currency_Code__c = 'INR',
        Exchange_Rate__c = 1
      );
      insert sch1;

      Billing_Schedule__c sch2 = new Billing_Schedule__c(
        Account__c = acc.Id,
        Order__c = ord.Id,
        Bill_Date__c = today.addDays(45),
        Period_Start__c = today.addDays(31),
        Period_End__c = today.addDays(60),
        Amount__c = 10000,
        Description__c = 'Future SaaS',
        Status__c = 'planned',
        Kind__c = 'recurring',
        Country__c = 'India',
        Currency_Code__c = 'INR',
        Exchange_Rate__c = 1
      );
      insert sch2;

      Invoice__c inv = new Invoice__c(
        Account__c = acc.Id,
        Number__c = 'INV-AGING-01',
        Sent_On__c = today.addDays(-40),
        Due_On__c = today.addDays(-10),
        Total__c = 15000,
        Net_Amount__c = 15000,
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1,
        Written_Off__c = false,
        Dunning_Stage__c = 0
      );
      insert inv;

      Usage_Record__c u = new Usage_Record__c(
        Quantity__c = 100,
        Usage_Date__c = today,
        Billed__c = false
      );
      insert u;

      Integration_Log__c log = new Integration_Log__c(
        Kind__c = 'billing',
        Target__c = 'daily_run',
        Status__c = 'ok',
        Response__c = '2 invoices raised',
        Occurred_On__c = Datetime.now()
      );
      insert log;

      Test.startTest();
      RevquilaBillingController.Overview view = RevquilaBillingController.getOverview();
      Assert.isNotNull(view);
      Assert.isTrue(view.dueCount >= 1);
      Assert.isTrue(view.dueAmount > 0);
      Assert.isFalse(view.schedules.isEmpty());
      Assert.isFalse(view.dunning.isEmpty());

      // Test changeSchedule move and skip
      RevquilaBillingController.changeSchedule(sch1.Id, 'move', today.addDays(15));
      Billing_Schedule__c moved = [SELECT Bill_Date__c FROM Billing_Schedule__c WHERE Id = :sch1.Id];
      Assert.areEqual(today.addDays(15), moved.Bill_Date__c);

      RevquilaBillingController.changeSchedule(sch2.Id, 'skip', null);
      Billing_Schedule__c skipped = [SELECT Status__c FROM Billing_Schedule__c WHERE Id = :sch2.Id];
      Assert.areEqual('skipped', skipped.Status__c);

      // Test runBilling and runDunning
      String billingResult = RevquilaBillingController.runBilling(today);
      Assert.isNotNull(billingResult);

      String dunningResult = RevquilaBillingController.runDunning();
      Assert.isNotNull(dunningResult);

      Test.stopTest();
    }
  }

  @IsTest
  static void testBillingControllerNegativeAndValidations() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Negative Billing Co', RevquilaTestData.HOME_STATE);
      Billing_Schedule__c sch = new Billing_Schedule__c(
        Account__c = acc.Id,
        Bill_Date__c = Date.today(),
        Amount__c = 5000,
        Status__c = 'invoiced',
        Country__c = 'India',
        Currency_Code__c = 'INR',
        Exchange_Rate__c = 1
      );
      insert sch;

      try {
        RevquilaBillingController.changeSchedule(sch.Id, 'skip', null);
        Assert.fail('Changing non-planned schedule should fail');
      } catch (AuraHandledException e) {
        Assert.isNotNull(e.getMessage());
      }
    }
  }
}
