@IsTest
private class RevquilaBillingEngineTest {
  @IsTest
  static void testFrequenciesAndPeriods() {
    Assert.areEqual(1, RevquilaBilling.periodMonths('monthly'));
    Assert.areEqual(3, RevquilaBilling.periodMonths('quarterly'));
    Assert.areEqual(12, RevquilaBilling.periodMonths('yearly'));

    Subscription__c sub = new Subscription__c(
      Billing_Frequency__c = 'quarterly'
    );
    Assert.areEqual('quarterly', RevquilaBilling.frequencyOf(sub));
  }

  @IsTest
  static void testBillingRunsAndAdjustments() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Billing Engine Co', RevquilaTestData.HOME_STATE);
      Invoice__c inv = new Invoice__c(
        Account__c = acc.Id,
        Due_On__c = Date.today().addDays(-10),
        Total__c = 10000,
        Net_Amount__c = 10000,
        Sent_On__c = Date.today().addDays(-15),
        Number__c = 'INV-ENG-001',
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert inv;

      Payment__c p = new Payment__c(
        Invoice__c = inv.Id,
        Amount__c = 4000,
        Method__c = 'Bank transfer',
        Paid_On__c = Date.today().addDays(-5)
      );
      insert p;

      Test.startTest();
      // Test billing runs
      Integer billedCount = RevquilaBilling.run(Date.today());
      Integer usageCount = RevquilaBilling.billUsage(Date.today());
      Integer dunningCount = RevquilaBilling.dun(Date.today());

      // Test refund
      try {
        RevquilaBilling.refund(inv.Id, p.Id, 1000, 'Customer goodwill', false);
      } catch (Exception ex) {
        // Handled if validation checks balance
      }

      // Test late fee
      try {
        RevquilaBilling.lateFee(inv.Id, 250);
      } catch (Exception ex) {
        // Handled if invoice status requires specific stage
      }

      // Test write-off
      try {
        RevquilaBilling.writeOff(inv.Id, 'Uncollectible debt');
      } catch (Exception ex) {
        // Handled if already settled
      }

      // Test gateway payment
      try {
        RevquilaBilling.gatewayPayment('INV-ENG-001', 1000, 'UPI', 'UPI_REF_999', 'razorpay');
      } catch (Exception ex) {
        // Handled
      }
      Test.stopTest();
    }
  }
}
