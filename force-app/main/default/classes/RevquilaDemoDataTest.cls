@IsTest
private class RevquilaDemoDataTest {
  @IsTest
  static void anAdminLoadsTheDemoRecordsOnce() {
    User admin = RevquilaTestData.newUser(true);
    System.runAs(admin) {
      Assert.isFalse(RevquilaDemoData.isLoaded(), 'Nothing is loaded yet');

      Test.startTest();
      String summary = RevquilaDemoData.load();
      Test.stopTest();

      Assert.isTrue(
        summary.startsWith('8 quotes, 12 invoices and 9 subscriptions loaded'),
        summary
      );
      Assert.isTrue(RevquilaDemoData.isLoaded());
      Assert.areEqual(12, [SELECT COUNT() FROM Account]);
      Assert.areEqual(12, [SELECT COUNT() FROM Contact]);
      Assert.areEqual(6, RevquilaLookupController.getProducts().size());

      // the screens read the demo records like any others
      Map<String, Integer> quotes = new Map<String, Integer>();
      for (
        RevquilaQuoteController.QuoteView quote : RevquilaQuoteController.getQuotes()
      ) {
        Integer soFar = quotes.containsKey(quote.status)
          ? quotes.get(quote.status)
          : 0;
        quotes.put(quote.status, soFar + 1);
        Assert.isFalse(quote.lines.isEmpty(), quote.name + ' has lines');
      }
      Assert.areEqual(3, quotes.get('approval'), 'Three wait for approval');
      Assert.areEqual(1, quotes.get('draft'));
      Assert.areEqual(1, quotes.get('paid'));

      Map<String, Integer> invoices = new Map<String, Integer>();
      for (
        RevquilaInvoiceController.InvoiceView invoice : RevquilaInvoiceController.getInvoices()
      ) {
        Integer soFar = invoices.containsKey(invoice.status)
          ? invoices.get(invoice.status)
          : 0;
        invoices.put(invoice.status, soFar + 1);
        Assert.isTrue(invoice.name.startsWith('INV-'), invoice.name);
      }
      Assert.areEqual(1, invoices.get('draft'));
      Assert.areEqual(3, invoices.get('paid'));
      Assert.areEqual(5, invoices.get('overdue'));
      Assert.areEqual(1, invoices.get('partial'));
      Assert.areEqual(2, invoices.get('sent'));

      List<RevquilaSubscriptionController.SubscriptionView> subscriptions = RevquilaSubscriptionController.getSubscriptions();
      Assert.areEqual(9, subscriptions.size());
      Assert.areEqual(
        'Lotus Textiles',
        subscriptions[0].account,
        'Soonest renewal first'
      );
      Assert.areEqual('cancelled', subscriptions[0].status);

      RevquilaDashboardController.Dashboard dashboard = RevquilaDashboardController.getDashboard();
      Assert.areEqual(477500, dashboard.mrr, 'The seven active subscriptions');
      Assert.areEqual(5, dashboard.overdueCount);
      Assert.areEqual(3, dashboard.waitingQuotes.size());
      Assert.areEqual(5, dashboard.renewals.size());
      Assert.isTrue(dashboard.collected > 0, 'Payments in the last 30 days');
      Assert.isTrue(
        dashboard.mrrSeries[0].value < dashboard.mrr,
        'MRR grew over the six months'
      );

      // a paid demo quote is tied to its invoice and its subscription
      Quote__c paid = [SELECT Id FROM Quote__c WHERE Status__c = 'paid'];
      RevquilaQuoteController.QuoteView helio = RevquilaQuoteController.getQuote(
        paid.Id
      );
      Assert.areEqual('paid', helio.invoiceStatus);
      Assert.isNotNull(helio.subscriptionId);

      try {
        RevquilaDemoData.load();
        Assert.fail('The demo records load only once');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('already loaded'),
          e.getMessage()
        );
      }
      Assert.areEqual(
        8,
        [SELECT COUNT() FROM Quote__c],
        'Nothing was added twice'
      );
    }
  }

  @IsTest
  static void loadingNeedsTheAdminPermissionSet() {
    User rep = RevquilaTestData.newUser(false);
    System.runAs(rep) {
      try {
        RevquilaDemoData.load();
        Assert.fail('A rep must not load the demo records');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('Revquila Admin'),
          e.getMessage()
        );
      }
      Assert.areEqual(0, [SELECT COUNT() FROM Account]);
    }
  }
}