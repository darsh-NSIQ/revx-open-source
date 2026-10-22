@IsTest
private class RevquilaQuoteControllerTest {
  private static List<RevquilaPricing.LineInput> lines(
    Map<String, Id> products,
    Decimal discount
  ) {
    return new List<RevquilaPricing.LineInput>{
      RevquilaTestData.line(products.get('PLAT'), 10, discount),
      RevquilaTestData.line(products.get('IMPL'), 1, 0)
    };
  }

  private static String titles(RevquilaQuoteController.QuoteView quote) {
    List<String> titles = new List<String>();
    for (RevquilaCore.EventView event : quote.events) {
      titles.add(event.title);
    }
    return String.join(titles, ' | ');
  }

  @IsTest
  static void aQuoteInsideThePolicyIsSavedAsADraftWithItsAmounts() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account('Orbit Retail', 'Karnataka');
    System.runAs(rep) {
      Id quoteId = RevquilaQuoteController.saveQuote(
        RevquilaTestData.quoteJson(account.Id, lines(products, 5), null)
      );

      RevquilaQuoteController.QuoteView quote = RevquilaQuoteController.getQuote(
        quoteId
      );
      Assert.areEqual('draft', quote.status);
      Assert.areEqual('Orbit Retail', quote.account);
      Assert.areEqual('Karnataka', quote.region, 'The account\'s state');
      Assert.areEqual('Net 30', quote.terms, 'The standard terms');
      Assert.areEqual(30, quote.validDays);
      Assert.areEqual(Date.today().addDays(30), quote.validUntil);
      Assert.areEqual('Quick Quote', quote.reference);
      Assert.areEqual(270000, quote.subtotal);
      Assert.areEqual(264000, quote.net, '5% off the 120,000 licence line');
      Assert.areEqual(47520, quote.tax);
      Assert.areEqual('IGST 18%', quote.taxLines[0].label);
      Assert.areEqual(2, quote.lines.size());
      Assert.areEqual('Platform licence', quote.lines[0].name);
      Assert.isNull(quote.policyIssue);
      Assert.areEqual('Quote created', titles(quote));
      Assert.isTrue(quote.name.startsWith('Q-'), quote.name);

      List<RevquilaQuoteController.QuoteView> listed = RevquilaQuoteController.getQuotes();
      Assert.areEqual(1, listed.size());
      Assert.areEqual(2, listed[0].lines.size(), 'The list carries the lines');
      Assert.isFalse(
        RevquilaQuoteController.canApprove(),
        'A rep cannot approve'
      );
    }
  }

  @IsTest
  static void aQuoteOutsideThePolicyGoesThroughApprovalToPaid() {
    User approver = RevquilaTestData.newUser(true);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account(
      'Bluepeak Software',
      RevquilaTestData.HOME_STATE
    );
    System.runAs(approver) {
      Id quoteId = RevquilaQuoteController.saveQuote(
        RevquilaTestData.quoteJson(account.Id, lines(products, 20), null)
      );
      RevquilaQuoteController.QuoteView quote = RevquilaQuoteController.getQuote(
        quoteId
      );
      Assert.areEqual('approval', quote.status, 'Straight to an approver');
      Assert.areEqual('pending', quote.approvalDecision);
      Assert.areEqual('20% discount, limit is 15%', quote.policyIssue);

      try {
        RevquilaQuoteController.act(quoteId, 'send', null);
        Assert.fail('A quote waiting for approval cannot be sent');
      } catch (AuraHandledException e) {
        Assert.isTrue(e.getMessage().contains('approved'), e.getMessage());
      }

      Assert.isTrue(RevquilaQuoteController.canApprove());
      RevquilaQuoteController.act(quoteId, 'approve', null);
      RevquilaQuoteController.act(quoteId, 'send', null);
      RevquilaQuoteController.act(quoteId, 'sign', null);
      Id orderId = RevquilaQuoteController.getQuote(quoteId).orderId;
      RevquilaOrderController.activate(orderId);
      RevquilaOrderController.invoice(orderId);

      quote = RevquilaQuoteController.getQuote(quoteId);
      Assert.areEqual('invoiced', quote.status);
      Assert.areEqual('approved', quote.approvalDecision);
      Assert.areEqual('Approver', quote.approvalDecidedBy);
      Assert.areEqual(Date.today(), quote.sentOn);
      Assert.areEqual(Date.today(), quote.signedOn);
      Assert.isNotNull(
        quote.subscriptionId,
        'The recurring line started a subscription'
      );
      Assert.areEqual('active', quote.subscriptionStatus);
      Assert.isNotNull(quote.invoiceId);
      Assert.isTrue(
        quote.invoiceNumber.startsWith('INV-'),
        quote.invoiceNumber
      );
      Assert.areEqual('sent', quote.invoiceStatus);
      String story = titles(quote);
      for (
        String expected : new List<String>{
          'Approval requested',
          'Approved by Approver',
          'Marked as sent',
          'Signed',
          'Subscription started',
          'Invoice raised'
        }
      ) {
        Assert.isTrue(
          story.contains(expected),
          expected + ' missing in: ' + story
        );
      }

      // the subscription bills what the customer pays: 10 seats at 12,000 less 20%
      Subscription__c subscription = [
        SELECT
          Contract_MRR__c,
          Renewal_Date__c,
          (SELECT Unit_Price__c FROM Items__r)
        FROM Subscription__c
        WHERE Id = :quote.subscriptionId
      ];
      Assert.areEqual(8000, subscription.Contract_MRR__c);
      Assert.areEqual(
        1,
        subscription.Items__r.size(),
        'Only the recurring line'
      );
      Assert.areEqual(9600, subscription.Items__r[0].Unit_Price__c);
      Assert.areEqual(Date.today().addDays(365), subscription.Renewal_Date__c);

      RevquilaInvoiceController.InvoiceView invoice = RevquilaInvoiceController.getInvoice(
        quote.invoiceId
      );
      Assert.areEqual(
        quote.total,
        invoice.total,
        'The invoice is for what was quoted'
      );
      Assert.areEqual(Date.today().addDays(30), invoice.dueOn, 'Net 30');
      Assert.areEqual(quote.subscriptionId, invoice.subscriptionId);
      Assert.areEqual(2, invoice.lines.size());

      Test.startTest();
      RevquilaInvoiceController.recordPayment(
        quote.invoiceId,
        invoice.total,
        'Bank transfer',
        'NEFT 1',
        Date.today()
      );
      Assert.areEqual(
        'paid',
        RevquilaQuoteController.getQuote(quoteId).status,
        'Settling the invoice marks the quote as paid'
      );

      try {
        RevquilaQuoteController.act(quoteId, 'revise', null);
        Assert.fail('A paid quote cannot be revised');
      } catch (AuraHandledException e) {
        Assert.isTrue(e.getMessage().contains('revised'), e.getMessage());
      }
      Test.stopTest();
    }
  }

  @IsTest
  static void onlyAnApproverDecidesAndARejectionNeedsAReason() {
    User rep = RevquilaTestData.newUser(false);
    User approver = RevquilaTestData.newUser(true);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account(
      'Zenith Forgings',
      RevquilaTestData.HOME_STATE
    );
    Id quoteId;
    System.runAs(rep) {
      quoteId = RevquilaQuoteController.saveQuote(
        RevquilaTestData.quoteJson(account.Id, lines(products, 0), 'Net 60')
      );
      Assert.areEqual(
        'Net 60 payment terms',
        RevquilaQuoteController.getQuote(quoteId).policyIssue
      );
      try {
        RevquilaQuoteController.act(quoteId, 'approve', null);
        Assert.fail('A rep must not approve');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('Admin') || e.getMessage().contains('Approve Quotes'),
          e.getMessage()
        );
      }
      try {
        RevquilaQuoteController.approveAll(new List<Id>{ quoteId });
        Assert.fail('A rep must not approve in bulk either');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('Admin') || e.getMessage().contains('Approve Quotes'),
          e.getMessage()
        );
      }
    }
    System.runAs(approver) {
      try {
        RevquilaQuoteController.act(quoteId, 'reject', ' ');
        Assert.fail('A rejection needs a reason');
      } catch (AuraHandledException e) {
        Assert.isTrue(e.getMessage().contains('why'), e.getMessage());
      }
      RevquilaQuoteController.act(quoteId, 'reject', 'Use Net 30');
      RevquilaQuoteController.QuoteView rejected = RevquilaQuoteController.getQuote(
        quoteId
      );
      Assert.areEqual('rejected', rejected.status);
      Assert.areEqual('Use Net 30', rejected.approvalNote);

      // the rep fixes it: standard terms, so it is a plain draft again
      RevquilaQuoteController.QuoteInput fixed = new RevquilaQuoteController.QuoteInput();
      fixed.quoteId = quoteId;
      fixed.terms = 'Net 30';
      fixed.lines = lines(products, 0);
      RevquilaQuoteController.saveQuote(JSON.serialize(fixed));
      RevquilaQuoteController.QuoteView draft = RevquilaQuoteController.getQuote(
        quoteId
      );
      Assert.areEqual('draft', draft.status);
      Assert.isNull(draft.policyIssue);
      Assert.isTrue(
        titles(draft).contains('Quote edited'),
        'The edit is on the timeline'
      );
      Assert.areEqual('Changed payment terms', draft.events[0].detail);

      try {
        RevquilaQuoteController.act(quoteId, 'submit', null);
        Assert.fail('A quote inside the policy needs no approval');
      } catch (AuraHandledException e) {
        Assert.isTrue(e.getMessage().contains('no approval'), e.getMessage());
      }
    }
  }

  @IsTest
  static void aDraftCanBeEditedSubmittedRevisedAndCloned() {
    User approver = RevquilaTestData.newUser(true);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account(
      'Nimbus Health',
      RevquilaTestData.HOME_STATE
    );
    System.runAs(approver) {
      Id quoteId = RevquilaQuoteController.saveQuote(
        RevquilaTestData.quoteJson(account.Id, lines(products, 0), null)
      );

      // saving the same thing again changes nothing
      RevquilaQuoteController.QuoteInput same = new RevquilaQuoteController.QuoteInput();
      same.quoteId = quoteId;
      same.lines = lines(products, 0);
      RevquilaQuoteController.saveQuote(JSON.serialize(same));
      Assert.areEqual(
        'Quote created',
        titles(RevquilaQuoteController.getQuote(quoteId)),
        'No edit is logged when nothing changed'
      );

      // a deeper discount and a custom item put it outside the policy, still as a draft
      RevquilaQuoteController.QuoteInput deeper = new RevquilaQuoteController.QuoteInput();
      deeper.quoteId = quoteId;
      deeper.notes = 'Go-live before March';
      deeper.reference = 'Nimbus rollout';
      deeper.validDays = 45;
      deeper.lines = lines(products, 30);
      deeper.lines.add(RevquilaTestData.customLine('Data migration', 20000, 1));
      RevquilaQuoteController.saveQuote(JSON.serialize(deeper));
      RevquilaQuoteController.QuoteView draft = RevquilaQuoteController.getQuote(
        quoteId
      );
      Assert.areEqual('draft', draft.status);
      Assert.areEqual(3, draft.lines.size());
      Assert.areEqual('Data migration', draft.lines[2].name);
      Assert.areEqual('Go-live before March', draft.notes);
      Assert.areEqual(Date.today().addDays(45), draft.validUntil);
      Assert.areEqual(
        'Changed validity, reference, notes, products and prices',
        draft.events[0].detail
      );

      RevquilaQuoteController.act(quoteId, 'submit', null);
      Assert.areEqual(
        1,
        RevquilaQuoteController.approveAll(new List<Id>{ quoteId }),
        'One quote was waiting'
      );
      RevquilaQuoteController.act(quoteId, 'send', null);

      try {
        RevquilaQuoteController.saveQuote(JSON.serialize(deeper));
        Assert.fail('A quote that went out cannot be edited');
      } catch (AuraHandledException e) {
        Assert.isTrue(e.getMessage().contains('Revise'), e.getMessage());
      }
      RevquilaQuoteController.act(quoteId, 'revise', null);
      RevquilaQuoteController.QuoteView revised = RevquilaQuoteController.getQuote(
        quoteId
      );
      Assert.areEqual('draft', revised.status);
      Assert.areEqual(2, revised.version);
      Assert.isNull(revised.sentOn);

      Test.startTest();
      Id copyId = RevquilaQuoteController.cloneQuote(quoteId);
      RevquilaQuoteController.QuoteView copy = RevquilaQuoteController.getQuote(
        copyId
      );
      Test.stopTest();
      Assert.areNotEqual(quoteId, copyId);
      Assert.areEqual(1, copy.version);
      Assert.areEqual(3, copy.lines.size());
      Assert.areEqual(
        'approval',
        copy.status,
        'The copy is outside the policy too'
      );
      Assert.areEqual('Nimbus rollout', copy.reference);
      Assert.isTrue(titles(copy).contains('Cloned from'), titles(copy));
    }
  }

  @IsTest
  static void whatCannotBeSavedIsRefusedWithAReason() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    Account account = RevquilaTestData.account(
      'Helio Energy',
      RevquilaTestData.HOME_STATE
    );
    System.runAs(rep) {
      RevquilaQuoteController.QuoteInput tooLong = new RevquilaQuoteController.QuoteInput();
      tooLong.accountId = account.Id;
      tooLong.validDays = 400;
      tooLong.lines = lines(products, 0);
      Map<String, String> bad = new Map<String, String>{
        'Pick the account' => RevquilaTestData.quoteJson(
          null,
          lines(products, 0),
          null
        ),
        'at least one product' => RevquilaTestData.quoteJson(
          account.Id,
          new List<RevquilaPricing.LineInput>(),
          null
        ),
        '1 to 365 days' => JSON.serialize(tooLong),
        'could not be read' => 'not json'
      };
      for (String expected : bad.keySet()) {
        try {
          RevquilaQuoteController.saveQuote(bad.get(expected));
          Assert.fail('Expected a failure about: ' + expected);
        } catch (AuraHandledException e) {
          Assert.isTrue(e.getMessage().contains(expected), e.getMessage());
        }
      }
      Assert.areEqual(0, [SELECT COUNT() FROM Quote__c], 'Nothing was saved');

      Id quoteId = RevquilaQuoteController.saveQuote(
        RevquilaTestData.quoteJson(account.Id, lines(products, 0), null)
      );
      for (String action : new List<String>{ 'sign', 'invoice', 'dance' }) {
        try {
          RevquilaQuoteController.act(quoteId, action, null);
          Assert.fail('A draft cannot: ' + action);
        } catch (AuraHandledException e) {
          Assert.isFalse(String.isBlank(e.getMessage()));
        }
      }
      delete as system [SELECT Id FROM Quote__c];
      try {
        RevquilaQuoteController.getQuote(quoteId);
        Assert.fail('Expected a failure for a quote that is gone');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('no longer exists'),
          e.getMessage()
        );
      }
    }
  }
}