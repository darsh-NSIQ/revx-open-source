@IsTest
private class RevquilaOrderControllerTest {
  @IsTest
  static void testOrderLifecycle() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Order Co', RevquilaTestData.HOME_STATE);
      Map<String, Id> products = RevquilaTestData.products();

      Order__c ord = new Order__c(
        Account__c = acc.Id,
        Status__c = 'booked',
        Order_Date__c = Date.today(),
        Payment_Terms__c = 'Net 30',
        Region__c = RevquilaTestData.HOME_STATE,
        Country__c = 'India',
        Currency_Code__c = 'INR',
        Exchange_Rate__c = 1,
        Subtotal__c = 10000,
        Total__c = 11800,
        Net_Amount__c = 10000,
        Tax_Amount__c = 1800
      );
      insert ord;

      Order_Line__c line = new Order_Line__c(
        Order__c = ord.Id,
        Product__c = products.get('PLAT'),
        Description__c = 'Platform licence',
        Unit__c = 'year',
        Unit_Price__c = 10000,
        Quantity__c = 1,
        List_Amount__c = 10000,
        Net_Amount__c = 10000,
        Recurring__c = true,
        Term_Months__c = 12,
        Start_Date__c = Date.today(),
        End_Date__c = Date.today().addDays(364),
        Sort_Order__c = 1
      );
      insert line;

      Test.startTest();
      List<RevquilaOrderController.OrderView> listViews = RevquilaOrderController.getOrders();
      Assert.isFalse(listViews.isEmpty());

      RevquilaOrderController.OrderView view = RevquilaOrderController.getOrder(ord.Id);
      Assert.areEqual(ord.Id, view.id);

      RevquilaOrderController.saveOrder(
        ord.Id,
        Date.today(),
        'Net 60',
        'PO-9999',
        'Special terms',
        RevquilaTestData.HOME_STATE
      );

      RevquilaOrderController.activate(ord.Id);

      Order__c activeOrd = [SELECT Status__c FROM Order__c WHERE Id = :ord.Id];
      Assert.areEqual(RevquilaOrderController.ACTIVE, activeOrd.Status__c);

      RevquilaOrderController.cancel(ord.Id, 'Test cancellation');
      Test.stopTest();

      Order__c cancelledOrd = [SELECT Status__c FROM Order__c WHERE Id = :ord.Id];
      Assert.areEqual(RevquilaOrderController.CANCELLED, cancelledOrd.Status__c);
    }
  }

  @IsTest
  static void testNegativeValidations() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Order Co 2', RevquilaTestData.HOME_STATE);
      Order__c ord = new Order__c(
        Account__c = acc.Id,
        Status__c = 'booked',
        Order_Date__c = Date.today(),
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert ord;

      try {
        RevquilaOrderController.invoice(ord.Id);
        Assert.fail('Cannot invoice booked order before activation');
      } catch (AuraHandledException e) {
        Assert.isNotNull(e.getMessage());
      }

      try {
        RevquilaOrderController.cancel(ord.Id, '');
        Assert.fail('Cancel needs a reason');
      } catch (AuraHandledException e) {
        Assert.isNotNull(e.getMessage());
      }
    }
  }
}
