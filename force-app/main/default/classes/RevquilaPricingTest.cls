@IsTest
private class RevquilaPricingTest {
  private static final String US_SETTINGS =
    '{"company":{"state":"Texas"},' +
    '"tax":{"mode":"regional","system":"Sales tax","rate":0,' +
    '"regionRates":[{"region":"California","rate":7.25},{"region":"Texas","rate":6.25}]},' +
    '"pricing":{"discountLimit":10,"standardTerms":"Net 15","quoteValidDays":45},' +
    '"billing":{"invoicePrefix":"","invoiceDueDays":20}}';

  @IsTest
  static void aCustomerInTheHomeRegionGetsBothHalvesOfASplitTax() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    System.runAs(rep) {
      RevquilaPricing.Totals totals = RevquilaPricing.price(
        new List<RevquilaPricing.LineInput>{
          RevquilaTestData.line(products.get('PLAT'), 25, 10),
          RevquilaTestData.customLine('Data migration', 25000, 2)
        },
        RevquilaTestData.HOME_STATE,
        'Net 30'
      );

      Assert.areEqual(350000, totals.subtotal, '25 x 12,000 + 2 x 25,000');
      Assert.areEqual(30000, totals.discountTotal, '10% of 300,000');
      Assert.areEqual(320000, totals.net);
      Assert.areEqual(57600, totals.tax, '18% of the net');
      Assert.areEqual(377600, totals.total);
      Assert.areEqual(10, totals.maxDiscount);
      Assert.isNull(
        totals.policyIssue,
        'Inside the 15% limit on standard terms'
      );
      Assert.areEqual(2, totals.taxLines.size(), 'CGST and SGST');
      Assert.areEqual('CGST 9%', totals.taxLines[0].label);
      Assert.areEqual(28800, totals.taxLines[0].amount);
      Assert.areEqual('SGST 9%', totals.taxLines[1].label);
      Assert.areEqual(28800, totals.taxLines[1].amount);

      RevquilaCore.LineView licence = totals.lines[0];
      Assert.areEqual('Platform licence', licence.name);
      Assert.areEqual(
        12000,
        licence.price,
        'The list price, not what was sent'
      );
      Assert.areEqual(270000, licence.net);
      Assert.isTrue(licence.recurring, 'Recurring comes from the product');
      Assert.isFalse(totals.lines[1].recurring, 'A custom item is one-time');
      Assert.isNull(totals.lines[1].productId);
    }
  }

  @IsTest
  static void aCustomerElsewhereGetsTheCrossRegionLine() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    System.runAs(rep) {
      RevquilaPricing.Totals totals = RevquilaPricing.price(
        new List<RevquilaPricing.LineInput>{
          RevquilaTestData.line(products.get('IMPL'), 1, 0)
        },
        'Karnataka',
        'Net 30'
      );
      Assert.areEqual(1, totals.taxLines.size());
      Assert.areEqual('IGST 18%', totals.taxLines[0].label);
      Assert.areEqual(27000, totals.taxLines[0].amount);
      Assert.areEqual(177000, totals.total);
    }
  }

  @IsTest
  static void aDiscountAboveTheLimitOrOtherTermsNeedApproval() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    System.runAs(rep) {
      List<RevquilaPricing.LineInput> deep = new List<RevquilaPricing.LineInput>{
        RevquilaTestData.line(products.get('PLAT'), 10, 22.5)
      };
      Assert.areEqual(
        '22.5% discount, limit is 15%',
        RevquilaPricing.price(deep, RevquilaTestData.HOME_STATE, 'Net 30')
          .policyIssue
      );
      List<RevquilaPricing.LineInput> plain = new List<RevquilaPricing.LineInput>{
        RevquilaTestData.line(products.get('PLAT'), 10, 15)
      };
      Assert.areEqual(
        'Net 60 payment terms',
        RevquilaPricing.price(plain, RevquilaTestData.HOME_STATE, 'Net 60')
          .policyIssue
      );
      Assert.isNull(
        RevquilaPricing.price(plain, RevquilaTestData.HOME_STATE, 'Net 30')
          .policyIssue,
        'Exactly at the limit is inside the policy'
      );
    }
  }

  @IsTest
  static void publishedSettingsDecideTheTaxAndThePolicy() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    System.runAs(rep) {
      RevquilaSettings.use(US_SETTINGS);
      RevquilaPricing.Totals california = RevquilaPricing.price(
        new List<RevquilaPricing.LineInput>{
          RevquilaTestData.line(products.get('PLAT'), 1, 12)
        },
        'California',
        'Net 15'
      );
      Assert.areEqual(10560, california.net);
      Assert.areEqual(765.6, california.tax, '7.25% of 10,560');
      Assert.areEqual(
        'Sales tax 7.25% (California)',
        california.taxLines[0].label
      );
      Assert.areEqual(
        '12% discount, limit is 10%',
        california.policyIssue,
        'The published limit is 10%'
      );

      RevquilaPricing.TaxResult unlisted = RevquilaPricing.taxOn(
        1000,
        'Oregon'
      );
      Assert.areEqual(
        0,
        unlisted.tax,
        'A region that is not listed uses the default rate'
      );
      Assert.areEqual('Sales tax 0% (Oregon)', unlisted.lines[0].label);

      Assert.areEqual(15, RevquilaPricing.dueDays('Net 15'));
      Assert.areEqual(0, RevquilaPricing.dueDays('Due on receipt'));
      Assert.areEqual(
        20,
        RevquilaPricing.dueDays('On delivery'),
        'Terms without a number of days use the billing setting'
      );
      Assert.areEqual(
        '',
        RevquilaSettings.current().invoicePrefix,
        'An empty prefix is kept'
      );
      Assert.areEqual(45, RevquilaSettings.current().quoteValidDays);
    }
  }

  @IsTest
  static void pricesThatIncludeTaxAreWorkedBackToTheNet() {
    RevquilaSettings.use(
      '{"tax":{"mode":"single","system":"VAT","rate":20,"pricesIncludeTax":true}}'
    );
    RevquilaPricing.TaxResult included = RevquilaPricing.taxOn(1200, 'London');
    Assert.areEqual(1000, included.net);
    Assert.areEqual(200, included.tax);
    Assert.areEqual(1200, included.total);
    Assert.areEqual('VAT 20%', included.lines[0].label);

    RevquilaSettings.use('{"tax":{"mode":"none"}}');
    RevquilaPricing.TaxResult untaxed = RevquilaPricing.taxOn(1200, 'Dubai');
    Assert.areEqual(0, untaxed.tax);
    Assert.isTrue(untaxed.lines.isEmpty(), 'No tax line when there is no tax');
  }

  @IsTest
  static void settingsFallBackToTheDefaultsForAnythingMissingOrUnreadable() {
    RevquilaSettings defaults = RevquilaSettings.parse(null);
    Assert.areEqual('split', defaults.taxMode);
    Assert.areEqual(18, defaults.taxRate);
    Assert.areEqual(15, defaults.discountLimit);
    Assert.areEqual('INV-', defaults.invoicePrefix);

    RevquilaSettings partial = RevquilaSettings.parse(
      '{"tax":{"rate":"","mode":"single","splitLabels":["A"]},"pricing":{"discountLimit":"12.5","standardTerms":"  "}}'
    );
    Assert.areEqual('single', partial.taxMode);
    Assert.areEqual(18, partial.taxRate, 'An empty rate falls back');
    Assert.areEqual(
      12.5,
      partial.discountLimit,
      'A number sent as text is read'
    );
    Assert.areEqual('Net 30', partial.standardTerms, 'Blank text falls back');
    Assert.areEqual(
      'CGST',
      partial.splitLabels[0],
      'Both split labels or neither'
    );
    Assert.areEqual(RevquilaTestData.HOME_STATE, partial.homeRegion);
  }

  @IsTest
  static void linesThatCannotBePricedAreRefusedWithAReason() {
    User rep = RevquilaTestData.newUser(false);
    Map<String, Id> products = RevquilaTestData.products();
    System.runAs(rep) {
      Map<String, RevquilaPricing.LineInput> bad = new Map<String, RevquilaPricing.LineInput>{
        'whole number' => RevquilaTestData.line(products.get('PLAT'), 1.5, 0),
        'between 0 and 100' => RevquilaTestData.line(
          products.get('PLAT'),
          1,
          101
        ),
        'name the custom item' => RevquilaTestData.customLine(' ', 10, 1),
        'enter a price' => RevquilaTestData.customLine('Setup', -1, 1),
        'inactive or has no standard price' => RevquilaTestData.line(
          products.get('OLD'),
          1,
          0
        )
      };
      for (String expected : bad.keySet()) {
        try {
          RevquilaPricing.price(
            new List<RevquilaPricing.LineInput>{ bad.get(expected) },
            RevquilaTestData.HOME_STATE,
            'Net 30'
          );
          Assert.fail('Expected a problem about: ' + expected);
        } catch (RevquilaCore.ProblemException e) {
          Assert.isTrue(e.getMessage().contains(expected), e.getMessage());
        }
      }
      try {
        RevquilaPricing.price(
          new List<RevquilaPricing.LineInput>(),
          RevquilaTestData.HOME_STATE,
          'Net 30'
        );
        Assert.fail('Expected a problem about having no lines');
      } catch (RevquilaCore.ProblemException e) {
        Assert.isTrue(e.getMessage().contains('at least one'), e.getMessage());
      }
    }
  }
}