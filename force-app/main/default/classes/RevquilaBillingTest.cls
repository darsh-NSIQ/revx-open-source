/** Invoices, subscriptions, the dashboard and the lookups, all on a quote that was signed. */
@IsTest
private class RevquilaBillingTest {
  // A signed quote for 10 seats (recurring) and an implementation, in the home state, not yet invoiced
  private static Id signedQuote(Account account, Map<String, Id> products) {
    Id quoteId = RevquilaQuoteController.saveQuote(
      RevquilaTestData.quoteJson(
        account.Id,
        new List<RevquilaPricing.LineInput>{
          RevquilaTestData.line(products.get('PLAT'), 10, 0),
          RevquilaTestData.line(products.get('IMPL'), 1, 0)
        },
        null
      )
    );
    RevquilaQuoteController.act(quoteId, 'send', null);
    RevquilaQuoteController.act(quoteId, 'sign', null);
    return quoteId;
  }

  // Activates the quote's order and raises its invoice, as the Order 360 page does
  private static void invoiceOf(Id quoteId) {
    Id orderId = RevquilaQuoteController.getQuote(quoteId).orderId;
    RevquilaOrderController.activate(orderId);
    RevquilaOrderController.invoice(orderId);
  }

  private static void expectFailure(String expected, Exception e) {
    Assert.isTrue(e.getMessage().contains(expected), e.getMessage());
  }

  @IsTest
  static void anInvoiceIsPaidDownByPaymentsAndCreditNotes() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account(
      'Tarang Media',
      RevquilaTestData.HOME_STATE
    );
    System.runAs(rep) {
      Id quoteId = signedQuote(account, products);
      invoiceOf(quoteId);
      Id invoiceId = RevquilaQuoteController.getQuote(quoteId).invoiceId;

      Test.startTest();
      RevquilaInvoiceController.InvoiceView invoice = RevquilaInvoiceController.getInvoice(
        invoiceId
      );
      Assert.areEqual(318600, invoice.total, '270,000 plus 18%');
      Assert.areEqual('sent', invoice.status);
      Assert.areEqual('Tarang Media', invoice.account);
      Assert.areEqual(2, invoice.taxLines.size(), 'CGST and SGST, as quoted');

      try {
        RevquilaInvoiceController.recordPayment(
          invoiceId,
          400000,
          'UPI',
          null,
          null
        );
        Assert.fail('More than the balance');
      } catch (AuraHandledException e) {
        expectFailure('more than the balance', e);
      }
      try {
        RevquilaInvoiceController.recordPayment(
          invoiceId,
          0,
          'UPI',
          null,
          null
        );
        Assert.fail('Nothing to record');
      } catch (AuraHandledException e) {
        expectFailure('above zero', e);
      }
      try {
        RevquilaInvoiceController.recordPayment(
          invoiceId,
          100,
          'UPI',
          null,
          Date.today().addDays(2)
        );
        Assert.fail('Dated in the future');
      } catch (AuraHandledException e) {
        expectFailure('future', e);
      }
      try {
        RevquilaInvoiceController.issueCreditNote(invoiceId, 100, ' ');
        Assert.fail('A credit note needs a reason');
      } catch (AuraHandledException e) {
        expectFailure('why', e);
      }
      try {
        RevquilaInvoiceController.logPromise(invoiceId, null, 'soon');
        Assert.fail('A promise needs a date');
      } catch (AuraHandledException e) {
        expectFailure('date', e);
      }
      try {
        RevquilaInvoiceController.markSent(invoiceId);
        Assert.fail('Already sent');
      } catch (AuraHandledException e) {
        expectFailure('already sent', e);
      }

      RevquilaInvoiceController.recordPayment(
        invoiceId,
        118600,
        'UPI',
        ' ref 1 ',
        Date.today().addDays(-1)
      );
      RevquilaInvoiceController.issueCreditNote(invoiceId, 18600, 'Goodwill');
      RevquilaInvoiceController.logPromise(
        invoiceId,
        Date.today().addDays(5),
        'After their board meeting'
      );
      Assert.areEqual(
        1,
        RevquilaInvoiceController.logReminders(new List<Id>{ invoiceId })
      );
      Assert.areEqual(
        1,
        RevquilaInvoiceController.logReminders(new List<Id>{ invoiceId })
      );

      invoice = RevquilaInvoiceController.getInvoice(invoiceId);
      Assert.areEqual('partial', invoice.status);
      Assert.areEqual(118600, invoice.paid);
      Assert.areEqual(18600, invoice.credited);
      Assert.areEqual(181400, invoice.balance);
      Assert.areEqual(1, invoice.payments.size());
      Assert.areEqual('ref 1', invoice.payments[0].reference);
      Assert.areEqual('Goodwill', invoice.credits[0].reason);
      List<String> titles = new List<String>();
      for (RevquilaCore.EventView event : invoice.events) {
        if (!event.title.contains('Credit Note')) {
          titles.add(event.title);
        }
      }
      Assert.areEqual(
        'Reminder 2 | Reminder 1 | Promised to pay | Invoice raised',
        String.join(titles, ' | '),
        'Newest first'
      );
      Assert.areEqual(Date.today().addDays(5), invoice.events[2].dateValue);
      Assert.areEqual(
        'invoiced',
        RevquilaQuoteController.getQuote(quoteId).status
      );

      // a credit note that clears the rest settles the quote too
      RevquilaInvoiceController.issueCreditNote(
        invoiceId,
        181400,
        'Written off'
      );
      Assert.areEqual(
        'paid',
        RevquilaInvoiceController.getInvoice(invoiceId).status
      );
      Assert.areEqual('paid', RevquilaQuoteController.getQuote(quoteId).status);
      Assert.areEqual(
        0,
        RevquilaInvoiceController.logReminders(new List<Id>{ invoiceId }),
        'A settled invoice is not chased'
      );
      Test.stopTest();
    }
  }

  @IsTest
  static void statusFollowsTheDatesAndADraftIsSentByHand() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account(
      'Kavya Logistics',
      RevquilaTestData.HOME_STATE
    );
    System.runAs(rep) {
      Id quoteId = signedQuote(account, products);
      invoiceOf(quoteId);
      Id invoiceId = RevquilaQuoteController.getQuote(quoteId).invoiceId;

      Test.startTest();
      // past its due date
      update as system new Invoice__c(
        Id = invoiceId,
        Due_On__c = Date.today().addDays(-12)
      );
      RevquilaInvoiceController.InvoiceView late = RevquilaInvoiceController.getInvoices()[0];
      Assert.areEqual('overdue', late.status);
      Assert.areEqual(12, late.daysOverdue);

      // back to a draft, as an invoice that was never sent
      update as system new Invoice__c(Id = invoiceId, Sent_On__c = null);
      Assert.areEqual(
        'draft',
        RevquilaInvoiceController.getInvoice(invoiceId).status
      );
      try {
        RevquilaInvoiceController.recordPayment(
          invoiceId,
          100,
          'UPI',
          null,
          null
        );
        Assert.fail('A draft takes no payment');
      } catch (AuraHandledException e) {
        expectFailure('Send the invoice', e);
      }
      RevquilaInvoiceController.markSent(invoiceId);
      Assert.areEqual(
        Date.today(),
        RevquilaInvoiceController.getInvoice(invoiceId).sentOn
      );

      // the overdue balance shows on the account's subscription and on the dashboard
      RevquilaSubscriptionController.SubscriptionView subscription = RevquilaSubscriptionController.getSubscriptions()[0];
      RevquilaSubscriptionController.SubscriptionView subDetail = RevquilaSubscriptionController.getSubscription(subscription.id);
      Assert.isNotNull(subDetail);
      Assert.areEqual(318600, subscription.overdueOnAccount);
      RevquilaDashboardController.Dashboard dashboard = RevquilaDashboardController.getDashboard();
      Assert.areEqual(318600, dashboard.overdue);
      Assert.areEqual(1, dashboard.overdueCount);
      Assert.areEqual(1, dashboard.invoicesOpen);
      Assert.areEqual(0, dashboard.invoicesPaid);
      Assert.areEqual(10000, dashboard.mrr, '10 seats at 12,000 a year');
      Assert.areEqual(6, dashboard.mrrSeries.size(), 'Six month-ends');
      Assert.areEqual(
        10000,
        dashboard.mrrSeries[5].value,
        'Ends on today\'s MRR'
      );
      Assert.areEqual(
        0,
        dashboard.mrrSeries[0].value,
        'Nothing was billing five months ago'
      );
      Assert.areEqual(1, dashboard.quoteCounts.get('invoiced'));
      Assert.areEqual(1, dashboard.recentQuotes.size());
      Assert.isTrue(dashboard.waitingQuotes.isEmpty());
      Assert.isTrue(
        dashboard.renewals.isEmpty(),
        'It renews in a year, not in 90 days'
      );
      Assert.isFalse(dashboard.canApprove);

      RevquilaInvoiceController.recordPayment(
        invoiceId,
        318600,
        'Card',
        null,
        null
      );
      dashboard = RevquilaDashboardController.getDashboard();
      Assert.areEqual(318600, dashboard.collected);
      Assert.areEqual(1, dashboard.collectedCount);
      Assert.areEqual(
        318600,
        dashboard.collectedSeries[5].value,
        'This month so far'
      );
      Assert.areEqual(0, dashboard.overdue);
      Assert.areEqual(1, dashboard.invoicesPaid);
      Test.stopTest();
    }
  }

  @IsTest
  static void aSubscriptionCanBeChangedPausedCancelledAndRenewed() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account(
      'Helio Energy',
      RevquilaTestData.HOME_STATE
    );
    System.runAs(rep) {
      Id quoteId = signedQuote(account, products);
      Id subscriptionId = RevquilaQuoteController.getQuote(quoteId)
        .subscriptionId;
      RevquilaSubscriptionController.SubscriptionView subscription = RevquilaSubscriptionController.getSubscription(
        subscriptionId
      );
      Assert.areEqual('active', subscription.status);
      Assert.areEqual(10000, subscription.contractMrr);
      Assert.areEqual(1, subscription.items.size());
      Assert.areEqual('Platform licence', subscription.items[0].name);
      Assert.areEqual('Subscription started', subscription.events[0].title);
      Assert.areEqual(10000, subscription.events[0].numberValue);
      Assert.isTrue(subscription.invoices.isEmpty(), 'Not invoiced yet');
      Id itemId = subscription.items[0].id;

      try {
        RevquilaSubscriptionController.changeQuantity(itemId, 10);
        Assert.fail('The same quantity');
      } catch (AuraHandledException e) {
        expectFailure('already has', e);
      }
      try {
        RevquilaSubscriptionController.changeQuantity(itemId, 0);
        Assert.fail('Below one');
      } catch (AuraHandledException e) {
        expectFailure('1 or more', e);
      }
      RevquilaSubscriptionController.changeQuantity(itemId, 15);
      RevquilaSubscriptionController.setAutoRenew(subscriptionId, false);
      RevquilaSubscriptionController.logNote(
        subscriptionId,
        'CFO wants a call'
      );
      RevquilaSubscriptionController.pause(subscriptionId);
      try {
        RevquilaSubscriptionController.changeQuantity(itemId, 20);
        Assert.fail('A paused subscription is not changed');
      } catch (AuraHandledException e) {
        expectFailure('active', e);
      }
      try {
        RevquilaSubscriptionController.pause(subscriptionId);
        Assert.fail('Already paused');
      } catch (AuraHandledException e) {
        expectFailure('active', e);
      }

      subscription = RevquilaSubscriptionController.getSubscription(
        subscriptionId
      );
      Assert.areEqual('paused', subscription.status);
      Assert.areEqual(15000, subscription.contractMrr);
      Assert.isFalse(subscription.autoRenew);
      Assert.areEqual('Subscription paused', subscription.events[0].title);
      Assert.areEqual(
        0,
        subscription.events[0].numberValue,
        'Nothing is billed while paused'
      );
      Assert.areEqual('Note', subscription.events[1].title);
      Assert.areEqual('Quantity increased', subscription.events[3].title);
      Assert.areEqual(
        'Platform licence: 10 to 15',
        subscription.events[3].detail
      );
      Assert.areEqual(15000, subscription.events[3].numberValue);
      Assert.areEqual(
        0,
        RevquilaDashboardController.getDashboard().mrr,
        'A paused subscription is out of the MRR'
      );

      RevquilaSubscriptionController.resume(subscriptionId);
      try {
        RevquilaSubscriptionController.resume(subscriptionId);
        Assert.fail('Already running');
      } catch (AuraHandledException e) {
        expectFailure('paused', e);
      }

      Test.startTest();
      Id renewalId = RevquilaSubscriptionController.renew(subscriptionId);
      RevquilaQuoteController.QuoteView renewal = RevquilaQuoteController.getQuote(
        renewalId
      );
      Assert.areEqual('draft', renewal.status);
      Assert.areEqual(15, renewal.lines[0].qty, 'Today\'s quantity');
      Assert.isTrue(
        renewal.reference.contains('renewal of SUB-'),
        renewal.reference
      );

      RevquilaSubscriptionController.cancel(subscriptionId, 'Budget cut', true);
      subscription = RevquilaSubscriptionController.getSubscription(
        subscriptionId
      );
      Assert.areEqual(
        'active',
        subscription.status,
        'It runs to the end of the term'
      );
      Assert.areEqual('Budget cut', subscription.cancelReason);
      RevquilaSubscriptionController.setAutoRenew(subscriptionId, true);
      Assert.isNull(
        RevquilaSubscriptionController.getSubscription(subscriptionId)
          .cancelReason,
        'Turning auto-renew back on takes the cancellation back'
      );

      try {
        RevquilaSubscriptionController.cancel(subscriptionId, '', false);
        Assert.fail('A cancellation needs a reason');
      } catch (AuraHandledException e) {
        expectFailure('why', e);
      }
      RevquilaSubscriptionController.cancel(
        subscriptionId,
        'Closed down',
        false
      );
      Assert.areEqual(
        'cancelled',
        RevquilaSubscriptionController.getSubscription(subscriptionId).status
      );
      try {
        RevquilaSubscriptionController.setAutoRenew(subscriptionId, true);
        Assert.fail('A cancelled subscription cannot renew');
      } catch (AuraHandledException e) {
        expectFailure('cancelled', e);
      }
      try {
        RevquilaSubscriptionController.logNote(subscriptionId, ' ');
        Assert.fail('An empty note');
      } catch (AuraHandledException e) {
        expectFailure('note', e);
      }
      Test.stopTest();
    }
  }

  @IsTest
  static void theQuoteFormFindsProductsAccountsAndTheirContext() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account('Orbit Retail', 'Gujarat');
    RevquilaTestData.account('Orbital 100%', 'Kerala');
    System.runAs(rep) {
      List<RevquilaPricing.Product> catalogue = RevquilaLookupController.getProducts();
      Assert.areEqual(2, catalogue.size(), 'Only active products');
      Assert.areEqual('Implementation', catalogue[0].name, 'By name');
      Assert.areEqual(150000, catalogue[0].price);
      Assert.isTrue(catalogue[1].recurring);

      Assert.areEqual(
        2,
        RevquilaLookupController.searchAccounts('orbit').size()
      );
      Assert.areEqual(2, RevquilaLookupController.searchAccounts(null).size());
      List<RevquilaLookupController.AccountView> literal = RevquilaLookupController.searchAccounts(
        '100%'
      );
      Assert.areEqual(
        1,
        literal.size(),
        'The % is searched for, not used as a wildcard'
      );
      Assert.areEqual('Kerala', literal[0].region);

      signedQuote(account, products);
      RevquilaLookupController.AccountContext context = RevquilaLookupController.getAccountContext(
        account.Id
      );
      Assert.areEqual('Gujarat', context.account.region);
      Assert.areEqual('27AAAAA0000A1Z5', context.account.registration);
      Assert.areEqual(1, context.contacts.size());
      Assert.areEqual('Neha Kulkarni', context.contacts[0].name);
      Assert.areEqual(1, context.recentQuotes.size());
      Assert.areEqual(270000, context.recentQuotes[0].amount);
      Assert.isTrue(context.opportunities.isEmpty());

      Assert.areEqual(
        account.Id,
        RevquilaLookupController.createAccount(' Orbit Retail ', 'Goa').id,
        'An account with that name is reused'
      );
      RevquilaLookupController.AccountView created = RevquilaLookupController.createAccount(
        'New Co',
        'Goa'
      );
      Assert.areEqual('Goa', created.region);
      Assert.areEqual(1, [SELECT COUNT() FROM Account WHERE Name = 'New Co']);
      try {
        RevquilaLookupController.createAccount(' ', null);
        Assert.fail('A name is needed');
      } catch (AuraHandledException e) {
        expectFailure('account name', e);
      }
    }
  }
}