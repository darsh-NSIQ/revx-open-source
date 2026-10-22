/**
 * The Revquila REST API for outside systems, as the calling user with their access:
 *   GET  /services/apexrest/revquila/v1/quotes/{id}         one quote
 *   GET  .../v1/invoices/{id}, .../v1/orders/{id}, .../v1/contracts/{id}, .../v1/subscriptions/{id}
 *   GET  .../v1/accounts/{id}/statement                    open invoices and aging
 *   GET  .../v1/products                                   the catalog
 *   POST .../v1/quotes                                     a quote as JSON (the quote form's shape); returns { id }
 *   POST .../v1/quotes/{id}/{action}                        submit, approve, reject, recall, send, sign, revise; body { note }
 *   POST .../v1/orders/{id}/activate | /invoice
 *   POST .../v1/usage                                      { itemId, date, quantity, note }
 *   POST .../v1/payments                                   { invoiceId, amount, method, reference, date }
 *   POST .../v1/billing/run                                raises what is due today
 * Errors come back with status 400 and { "error": "..." }.
 */
@RestResource(urlMapping='/revquila/v1/*')
global with sharing class RevquilaApi {
  @HttpGet
  global static void read() {
    RestResponse response = RestContext.response;
    List<String> parts = path();
    try {
      Object result;
      String kind = parts.isEmpty() ? '' : parts[0].toLowerCase();
      Id recordId = parts.size() > 1 && parts[1] instanceof Id ? (Id) parts[1] : null;
      if (kind == 'quotes' && recordId != null) {
        result = RevquilaQuoteController.getQuote(recordId);
      } else if (kind == 'invoices' && recordId != null) {
        result = RevquilaInvoiceController.getInvoice(recordId);
      } else if (kind == 'orders' && recordId != null) {
        result = RevquilaOrderController.getOrder(recordId);
      } else if (kind == 'contracts' && recordId != null) {
        result = RevquilaContractController.getContract(recordId);
      } else if (kind == 'subscriptions' && recordId != null) {
        result = RevquilaSubscriptionController.getSubscription(recordId);
      } else if (kind == 'accounts' && recordId != null && parts.size() > 2 && parts[2].toLowerCase() == 'statement') {
        result = RevquilaInvoiceController.getStatement(recordId);
      } else if (kind == 'products') {
        result = RevquilaPricing.products();
      } else {
        throw new RevquilaCore.ProblemException('Unknown resource.');
      }
      send(response, 200, result);
    } catch (Exception e) {
      send(response, 400, new Map<String, Object>{ 'error' => e.getMessage() });
    }
  }

  @HttpPost
  global static void write() {
    RestResponse response = RestContext.response;
    List<String> parts = path();
    String body = RestContext.request.requestBody == null ? '' : RestContext.request.requestBody.toString();
    try {
      Map<String, Object> input = String.isBlank(body)
        ? new Map<String, Object>()
        : (Map<String, Object>) JSON.deserializeUntyped(body);
      String kind = parts.isEmpty() ? '' : parts[0].toLowerCase();
      Id recordId = parts.size() > 1 && parts[1] instanceof Id ? (Id) parts[1] : null;
      String action = parts.size() > 2 ? parts[2].toLowerCase() : null;
      Object result;
      if (kind == 'quotes' && recordId == null) {
        result = new Map<String, Object>{ 'id' => RevquilaQuoteController.saveQuote(body) };
      } else if (kind == 'quotes' && action != null) {
        RevquilaQuoteController.act(recordId, action, (String) input.get('note'));
        result = new Map<String, Object>{ 'ok' => true };
      } else if (kind == 'orders' && action == 'activate') {
        RevquilaOrderController.activate(recordId);
        result = new Map<String, Object>{ 'ok' => true };
      } else if (kind == 'orders' && action == 'invoice') {
        result = new Map<String, Object>{ 'invoiceId' => RevquilaOrderController.invoice(recordId) };
      } else if (kind == 'usage') {
        RevquilaSubscriptionController.logUsage(
          (Id) String.valueOf(input.get('itemId')),
          input.get('date') == null ? null : Date.valueOf(String.valueOf(input.get('date'))),
          Decimal.valueOf(String.valueOf(input.get('quantity'))),
          (String) input.get('note')
        );
        result = new Map<String, Object>{ 'ok' => true };
      } else if (kind == 'payments') {
        RevquilaInvoiceController.recordPayment(
          (Id) String.valueOf(input.get('invoiceId')),
          Decimal.valueOf(String.valueOf(input.get('amount'))),
          (String) input.get('method'),
          (String) input.get('reference'),
          input.get('date') == null ? null : Date.valueOf(String.valueOf(input.get('date')))
        );
        result = new Map<String, Object>{ 'ok' => true };
      } else if (kind == 'billing' && parts.size() > 1 && parts[1].toLowerCase() == 'run') {
        result = new Map<String, Object>{ 'result' => RevquilaBillingController.runBilling(Date.today()) };
      } else {
        throw new RevquilaCore.ProblemException('Unknown resource.');
      }
      send(response, 200, result);
    } catch (Exception e) {
      send(response, 400, new Map<String, Object>{ 'error' => e.getMessage() });
    }
  }

  // The parts of the path after /revquila/v1/
  private static List<String> path() {
    String rest = RestContext.request.requestURI.substringAfter('/revquila/v1/');
    List<String> parts = new List<String>();
    for (String part : rest.split('/')) {
      if (String.isNotBlank(part)) {
        parts.add(part);
      }
    }
    return parts;
  }

  private static void send(RestResponse response, Integer status, Object body) {
    response.statusCode = status;
    response.addHeader('Content-Type', 'application/json');
    response.responseBody = Blob.valueOf(JSON.serialize(body));
  }
}