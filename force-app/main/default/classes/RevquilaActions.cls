/**
 * Revquila actions for Flow and Process automation: one invocable action, "Revquila: run an
 * action", that takes the action's name and the record it acts on. Each request is run on its
 * own, so one that fails does not stop the others; the result says what happened.
 *
 * Actions: submit_quote, approve_quote, reject_quote, send_quote, sign_quote, revise_quote,
 * activate_order, invoice_order, record_payment, payment_link, log_usage, renewal_quote,
 * amend_contract, cancel_subscription, run_billing, run_dunning, recognize_revenue.
 */
public with sharing class RevquilaActions {
  public class Request {
    @InvocableVariable(label='Action' description='For example sign_quote, activate_order, record_payment' required=true)
    public String action;
    @InvocableVariable(label='Record Id' description='The quote, order, invoice, contract, subscription or subscription item')
    public Id recordId;
    @InvocableVariable(label='Amount' description='For record_payment')
    public Decimal amount;
    @InvocableVariable(label='Quantity' description='For log_usage')
    public Decimal quantity;
    @InvocableVariable(label='Note' description='A reason, a reference or a payment method')
    public String note;
    @InvocableVariable(label='Date' description='For record_payment and log_usage; today when empty')
    public Date dateValue;
  }

  public class Result {
    @InvocableVariable(label='Succeeded')
    public Boolean ok = true;
    @InvocableVariable(label='Message')
    public String message;
    @InvocableVariable(label='Created Record Id' description='The invoice, quote or payment link the action made, when it made one')
    public String resultId;
  }

  @InvocableMethod(label='RevX: Run Action' description='Moves a RevX quote, order, invoice, contract or subscription along.' category='RevX')
  public static List<Result> run(List<Request> requests) {
    List<Result> results = new List<Result>();
    for (Request request : requests) {
      Result result = new Result();
      try {
        result.message = perform(request, result);
      } catch (Exception e) {
        result.ok = false;
        result.message = e.getMessage();
      }
      results.add(result);
    }
    return results;
  }

  private static String perform(Request request, Result result) {
    String action = request.action == null ? '' : request.action.trim().toLowerCase();
    Id recordId = request.recordId;
    if (action.endsWith('_quote') && action != 'renewal_quote') {
      String verb = action.substringBefore('_quote');
      RevquilaQuoteController.act(recordId, verb == 'approve' ? 'approve' : verb, request.note);
      return 'Quote: ' + verb + ' done';
    }
    if (action == 'activate_order') {
      RevquilaOrderController.activate(recordId);
      return 'Order activated';
    }
    if (action == 'invoice_order') {
      result.resultId = RevquilaOrderController.invoice(recordId);
      return 'Invoice raised';
    }
    if (action == 'record_payment') {
      RevquilaInvoiceController.recordPayment(recordId, request.amount, String.isBlank(request.note) ? 'Bank transfer' : request.note, null, request.dateValue);
      return 'Payment recorded';
    }
    if (action == 'payment_link') {
      result.resultId = RevquilaInvoiceController.createPaymentLink(recordId);
      return 'Payment link created';
    }
    if (action == 'log_usage') {
      RevquilaSubscriptionController.logUsage(recordId, request.dateValue, request.quantity, request.note);
      return 'Usage logged';
    }
    if (action == 'renewal_quote') {
      result.resultId = RevquilaContractController.renewalQuote(recordId);
      return 'Renewal quote ready';
    }
    if (action == 'amend_contract') {
      result.resultId = RevquilaContractController.amend(recordId);
      return 'Amendment quote ready';
    }
    if (action == 'cancel_subscription') {
      RevquilaSubscriptionController.cancel(recordId, String.isBlank(request.note) ? 'Cancelled by automation' : request.note, true);
      return 'Set to end on the renewal date';
    }
    if (action == 'run_billing') {
      return RevquilaBillingController.runBilling(request.dateValue);
    }
    if (action == 'run_dunning') {
      return RevquilaBillingController.runDunning();
    }
    if (action == 'recognize_revenue') {
      return RevquilaRevenueController.recognizeNow();
    }
    if (action == 'generate_einvoice') {
      result.resultId = RevquilaInvoiceController.generateEInvoice(recordId);
      return 'GST e-Invoice IRN generated';
    }
    if (action == 'issue_credit_note') {
      RevquilaInvoiceController.issueCreditNote(recordId, request.amount, request.note);
      return 'Credit note issued';
    }
    if (action == 'sync_opportunity') {
      RevquilaOliSync.SyncResult syncRes = RevquilaOliSync.syncOpportunity(recordId);
      return syncRes.message;
    }
    if (action == 'ai_quote_advice') {
      RevquilaAiService.AdviceResult adv = RevquilaAiService.getAdvice(recordId);
      return 'Win Probability: ' + adv.winProbability + '% (' + adv.winConfidence + '). ' + adv.discountAnalysis;
    }
    if (action == 'ai_proposal') {
      RevquilaAiService.AdviceResult adv = RevquilaAiService.getAdvice(recordId);
      return adv.executiveSummary;
    }
    if (action == 'provision_service_cloud') {
      RevquilaServiceCloudService.ProvisionResult prov = RevquilaServiceCloudService.provisionForSubscription(recordId);
      return prov.message;
    }
    if (action == 'publish_event') {
      String kind = String.isNotBlank(request.note) ? request.note : 'custom_event';
      RevquilaCore.publish(kind, recordId, new Map<String, Object>{ 'amount' => request.amount, 'note' => request.note });
      return 'Event ' + kind + ' published';
    }
    if (action == 'resend_invoice') {
      RevquilaInvoiceController.emailInvoice(recordId, null, null);
      return 'Invoice dispatched';
    }
    if (action == 'request_refund') {
      RevquilaAccount360Controller.requestRefund(recordId, request.amount, request.note);
      return 'Refund processed';
    }
    throw new RevquilaCore.ProblemException('Revquila does not know the action ' + request.action + '.');
  }
}