/**
 * Unit tests for RevquilaQuoteToCashFlowService:
 * Verifies end-to-end execution of all 8 Quote-to-Cash stages.
 */
@IsTest
private class RevquilaQuoteToCashFlowServiceTest {

  @TestSetup
  static void setupData() {
    RevquilaTestData.products();
  }

  @IsTest
  static void testRunFullFlowSuccess() {
    Test.startTest();
    RevquilaQuoteToCashFlowService.FlowExecutionResult res =
      RevquilaQuoteToCashFlowService.runFullFlow('Enterprise Test Corp', 150000.00, 'director@enterprisetest.com');
    Test.stopTest();

    System.assertNotEquals(null, res, 'Result should not be null');
    System.assertEquals(true, res.success, 'Flow should succeed: ' + res.message);
    System.assertNotEquals(null, res.quoteId, 'Quote ID should be generated');
    System.assertNotEquals(null, res.orderId, 'Order ID should be generated');
    System.assertNotEquals(null, res.contractId, 'Contract ID should be generated');
    System.assertNotEquals(null, res.invoiceId, 'Invoice ID should be generated');
    System.assertNotEquals(null, res.renewalQuoteId, 'Renewal Quote ID should be generated');
    System.assertEquals(8, res.steps.size(), 'All 8 stages should be recorded');

    // Verify stage names
    System.assertEquals('Quotes', res.steps[0].stage);
    System.assertEquals('Approval', res.steps[1].stage);
    System.assertEquals('Sent', res.steps[2].stage);
    System.assertEquals('Signed', res.steps[3].stage);
    System.assertEquals('Orders', res.steps[4].stage);
    System.assertEquals('Invoiced', res.steps[5].stage);
    System.assertEquals('Paid', res.steps[6].stage);
    System.assertEquals('Deferred', res.steps[7].stage);
  }

  @IsTest
  static void testRunFlowInvocable() {
    RevquilaQuoteToCashFlowService.FlowRequest req = new RevquilaQuoteToCashFlowService.FlowRequest();
    req.companyName = 'Agentforce AI Tech';
    req.dealAmount = 85000.00;
    req.contactEmail = 'buyer@agentforce.com';

    Test.startTest();
    List<RevquilaQuoteToCashFlowService.FlowExecutionResult> results =
      RevquilaQuoteToCashFlowService.runFlowInvocable(new List<RevquilaQuoteToCashFlowService.FlowRequest>{ req });
    Test.stopTest();

    System.assertEquals(1, results.size());
    System.assertEquals(true, results[0].success);
    System.assertNotEquals(null, results[0].gstIrn, 'GST IRN should be generated');
  }

  @IsTest
  static void testFlowWithDefaults() {
    Test.startTest();
    RevquilaQuoteToCashFlowService.FlowExecutionResult res =
      RevquilaQuoteToCashFlowService.runFullFlow(null, null, null);
    Test.stopTest();

    System.assertNotEquals(null, res);
    System.assertEquals(true, res.success);
  }
}
