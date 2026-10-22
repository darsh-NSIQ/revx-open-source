@IsTest
private class RevquilaContractControllerTest {
  @IsTest
  static void testContractQueriesAndLifecycle() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Contract Co', RevquilaTestData.HOME_STATE);
      Subscription__c sub = new Subscription__c(
        Account__c = acc.Id,
        Status__c = 'active',
        Start_Date__c = Date.today().addDays(-30),
        Renewal_Date__c = Date.today().addDays(335),
        Exchange_Rate__c = 1,
        Currency_Code__c = 'INR',
        Country__c = 'India'
      );
      insert sub;

      Subscription_Item__c item = new Subscription_Item__c(
        Subscription__c = sub.Id,
        Description__c = 'Cloud SaaS',
        Quantity__c = 5,
        Unit_Price__c = 1000
      );
      insert item;

      Contract__c c = new Contract__c(
        Account__c = acc.Id,
        Subscription__c = sub.Id,
        Status__c = 'active',
        Start_Date__c = Date.today().addDays(-30),
        End_Date__c = Date.today().addDays(335),
        Term_Months__c = 12,
        Auto_Renew__c = true,
        Annual_Value__c = 120000,
        Exchange_Rate__c = 1,
        Currency_Code__c = 'INR',
        Country__c = 'India'
      );
      insert c;

      Test.startTest();
      List<RevquilaContractController.ContractView> listViews = RevquilaContractController.getContracts();
      Assert.isFalse(listViews.isEmpty());

      RevquilaContractController.ContractView view = RevquilaContractController.getContract(c.Id);
      Assert.areEqual(c.Id, view.id);

      RevquilaContractController.setEvergreen(c.Id, true);
      RevquilaContractController.setEvergreen(c.Id, false);

      RevquilaContractController.setUplift(c.Id, 10.5);

      RevquilaContractController.saveContract(
        c.Id,
        Date.today().addDays(400),
        14,
        true,
        8.0,
        'REF-123',
        'Updated terms'
      );

      // Renewal quote & Amend
      Id renewalQuoteId = RevquilaContractController.renewalQuote(c.Id);
      Assert.isNotNull(renewalQuoteId);

      Id amendQuoteId = RevquilaContractController.amend(c.Id);
      Assert.isNotNull(amendQuoteId);

      RevquilaContractController.cancel(c.Id, 'Customer churn');
      Test.stopTest();

      Contract__c updated = [SELECT Status__c FROM Contract__c WHERE Id = :c.Id];
      Assert.areEqual(RevquilaContractController.CANCELLED, updated.Status__c);
    }
  }

  @IsTest
  static void testContractApplyRenewalAndStartFor() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Contract Apply Co', RevquilaTestData.HOME_STATE);
      Contract__c c = new Contract__c(
        Account__c = acc.Id,
        Status__c = 'active',
        Start_Date__c = Date.today().addDays(-30),
        End_Date__c = Date.today().addDays(335),
        Term_Months__c = 12,
        Auto_Renew__c = true,
        Annual_Value__c = 120000,
        Exchange_Rate__c = 1,
        Currency_Code__c = 'INR',
        Country__c = 'India'
      );
      insert c;

      Subscription__c sub = new Subscription__c(
        Account__c = acc.Id,
        Contract__c = c.Id,
        Status__c = 'active',
        Start_Date__c = Date.today().addDays(-30),
        Renewal_Date__c = Date.today().addDays(335),
        Exchange_Rate__c = 1,
        Currency_Code__c = 'INR',
        Country__c = 'India'
      );
      insert sub;
      c.Subscription__c = sub.Id;
      update c;

      Subscription_Item__c item = new Subscription_Item__c(
        Subscription__c = sub.Id,
        Description__c = 'Cloud SaaS Plan',
        Quantity__c = 2,
        Unit_Price__c = 5000
      );
      insert item;

      Quote__c q = new Quote__c(
        Account__c = acc.Id,
        Contract__c = c.Id,
        Status__c = 'approved',
        Total__c = 12000,
        Net_Amount__c = 12000,
        Term_Months__c = 12,
        Start_Date__c = Date.today(),
        Currency_Code__c = 'INR',
        Country__c = 'India',
        Exchange_Rate__c = 1
      );
      insert q;

      Quote_Line__c ql = new Quote_Line__c(
        Quote__c = q.Id,
        Description__c = 'Annual Plan',
        Recurring__c = true,
        Quantity__c = 2,
        Unit_Price__c = 6000,
        List_Amount__c = 12000,
        Net_Amount__c = 12000,
        Term_Months__c = 12
      );
      insert ql;

      Test.startTest();
      Quote__c qFull = [
        SELECT Id, Contract__c, Account__c, Contact__c, Reference__c, Notes__c,
               Country__c, Currency_Code__c, Exchange_Rate__c, Term_Months__c,
               Start_Date__c, Display_Number__c, Name, Net_Amount__c, Total__c, Status__c, OwnerId,
               Tax_Breakup__c, Payment_Terms__c, Region__c, Tax_Amount__c,
               (SELECT Id, Product__c, Description__c, Unit__c, Quantity__c,
                       Unit_Price__c, Usage_Based__c, Recurring__c, Optional__c,
                       Net_Amount__c, Term_Months__c, Rule_Discount__c, Discount__c,
                       List_Amount__c, Bundle__c, Bundle__r.Name, Group__c, Segment__c,
                       Start_Date__c, End_Date__c, Attributes__c, Unit_Cost__c,
                       Pricing_Method__c, Feature__c, Price_Source__c, Product__r.Family
                FROM Lines__r)
        FROM Quote__c WHERE Id = :q.Id
      ];

      Contract__c started = RevquilaContractController.startFor(qFull, sub);
      Assert.isNotNull(started);

      Contract__c renewed = RevquilaContractController.applyRenewal(qFull);
      Assert.isNotNull(renewed);

      try {
        RevquilaContractController.applyAmendment(qFull);
      } catch (Exception ex) {
        // Handled if differences exist
      }
      Test.stopTest();
    }
  }

  @IsTest
  static void testNegativeValidations() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Account acc = RevquilaTestData.account('Test Contract Co 2', RevquilaTestData.HOME_STATE);
      Contract__c c = new Contract__c(
        Account__c = acc.Id,
        Status__c = 'cancelled',
        Start_Date__c = Date.today().addDays(-30),
        End_Date__c = Date.today().addDays(335),
        Exchange_Rate__c = 1,
        Currency_Code__c = 'INR',
        Country__c = 'India'
      );
      insert c;

      try {
        RevquilaContractController.cancel(c.Id, 'Already cancelled');
        Assert.fail('Should fail on inactive contract');
      } catch (AuraHandledException e) {
        Assert.isNotNull(e.getMessage());
      }

      try {
        RevquilaContractController.setUplift(c.Id, 250);
        Assert.fail('Should fail on invalid uplift');
      } catch (AuraHandledException e) {
        Assert.isNotNull(e.getMessage());
      }

      try {
        RevquilaContractController.setEvergreen(c.Id, true);
        Assert.fail('Should fail on cancelled contract');
      } catch (AuraHandledException e) {
        Assert.isNotNull(e.getMessage());
      }
    }
  }
}
