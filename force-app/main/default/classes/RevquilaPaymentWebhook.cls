/**
 * Where a payment gateway reports a payment: POST /services/apexrest/revquila/payments/<gateway>.
 * razorpay: the payment_link.paid event, signed with X-Razorpay-Signature.
 * stripe:   the checkout.session.completed event, signed with Stripe-Signature.
 * generic:  { "invoice": "INV-00012", "amount": 1000, "reference": "...", "method": "Card" },
 *           signed with X-Revquila-Signature (HMAC-SHA256 of the body with the webhook secret).
 * Every call is written to the integration log. Runs as the site's guest user or an API user.
 */
@RestResource(urlMapping='/revquila/payments/*')
global with sharing class RevquilaPaymentWebhook {
  @HttpPost
  global static void receive() {
    RestRequest request = RestContext.request;
    RestResponse response = RestContext.response;
    String gateway = request.requestURI.substringAfterLast('/').toLowerCase();
    String body = request.requestBody == null ? '' : request.requestBody.toString();
    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    String secret = secrets == null ? null : secrets.Webhook_Secret__c;
    try {
      String signature = request.headers.get('X-Razorpay-Signature');
      if (signature == null) {
        signature = request.headers.get('Stripe-Signature');
      }
      if (signature == null) {
        signature = request.headers.get('X-RevX-Signature');
      }
      if (signature == null) {
        signature = request.headers.get('X-Revquila-Signature');
      }
      if (!RevquilaPayments.verify(body, signature, secret)) {
        RevquilaCore.log('webhook', gateway, 'rejected', body, 'Bad signature', null);
        response.statusCode = 401;
        response.responseBody = Blob.valueOf('{"ok":false,"error":"signature"}');
        return;
      }
      Map<String, Object> payload = (Map<String, Object>) JSON.deserializeUntyped(body);
      String invoiceNumber;
      String reference;
      Decimal amount;
      String method = 'Online';
      String eventName = payload.containsKey('event') ? String.valueOf(payload.get('event')) : '';
      if (gateway == 'razorpay') {
        Map<String, Object> events = (Map<String, Object>) payload.get('payload');
        if (eventName.startsWith('subscription.')) {
          Map<String, Object> subEntity = events.containsKey('subscription') ? (Map<String, Object>) ((Map<String, Object>) events.get('subscription')).get('entity') : null;
          String subId = subEntity != null ? String.valueOf(subEntity.get('id')) : null;
          if (eventName == 'subscription.authenticated') {
            RevquilaIndiaPaymentsService.updateMandateStatus(subId, 'authenticated', 'UPI_AutoPay');
          } else if (eventName == 'subscription.activated') {
            RevquilaIndiaPaymentsService.updateMandateStatus(subId, 'active', 'UPI_AutoPay');
          } else if (eventName == 'subscription.halted') {
            RevquilaIndiaPaymentsService.updateMandateStatus(subId, 'halted', 'UPI_AutoPay');
          } else if (eventName == 'subscription.cancelled') {
            RevquilaIndiaPaymentsService.updateMandateStatus(subId, 'cancelled', 'UPI_AutoPay');
          } else if (eventName == 'subscription.charged' && events.containsKey('payment')) {
            Map<String, Object> payment = (Map<String, Object>) ((Map<String, Object>) events.get('payment')).get('entity');
            reference = String.valueOf(payment.get('id'));
            amount = Decimal.valueOf(String.valueOf(payment.get('amount'))) / 100;
            method = 'Razorpay UPI AutoPay';
            Map<String, Object> notes = subEntity != null ? (Map<String, Object>) subEntity.get('notes') : null;
            if (notes != null && notes.containsKey('invoice')) {
              invoiceNumber = String.valueOf(notes.get('invoice'));
            }
          }
        } else if (eventName == 'payment.failed') {
          Map<String, Object> payment = events.containsKey('payment') ? (Map<String, Object>) ((Map<String, Object>) events.get('payment')).get('entity') : null;
          Map<String, Object> notes = payment != null ? (Map<String, Object>) payment.get('notes') : null;
          String failedInv = (notes != null && notes.containsKey('invoice')) ? String.valueOf(notes.get('invoice')) : null;
          String failReason = payment != null ? String.valueOf(payment.get('error_description')) : 'Debit authorization failed';
          if (String.isNotBlank(failedInv)) {
            RevquilaIndiaPaymentsService.handlePaymentFailure(failedInv, failReason);
          }
        } else if (events.containsKey('payment_link') && events.containsKey('payment')) {
          Map<String, Object> link = (Map<String, Object>) ((Map<String, Object>) events.get('payment_link')).get('entity');
          Map<String, Object> payment = (Map<String, Object>) ((Map<String, Object>) events.get('payment')).get('entity');
          invoiceNumber = String.valueOf(link.get('reference_id'));
          reference = String.valueOf(payment.get('id'));
          amount = Decimal.valueOf(String.valueOf(payment.get('amount'))) / 100;
          method = 'Razorpay ' + String.valueOf(payment.get('method'));
        }
      } else if (gateway == 'stripe') {
        Map<String, Object> data = (Map<String, Object>) payload.get('data');
        Map<String, Object> session = (Map<String, Object>) data.get('object');
        invoiceNumber = String.valueOf(session.get('client_reference_id'));
        reference = String.valueOf(session.get('payment_intent'));
        amount = Decimal.valueOf(String.valueOf(session.get('amount_total'))) / 100;
        method = 'Stripe';
      } else {
        invoiceNumber = String.valueOf(payload.get('invoice'));
        reference = String.valueOf(payload.get('reference'));
        amount = Decimal.valueOf(String.valueOf(payload.get('amount')));
        if (payload.get('method') != null) {
          method = String.valueOf(payload.get('method'));
        }
      }
      Payment__c paid = null;
      if (String.isNotBlank(invoiceNumber) && amount != null && amount > 0) {
        paid = RevquilaBilling.gatewayPayment(invoiceNumber, amount, method, reference, gateway);
      }
      RevquilaCore.log('webhook', gateway, 'ok', body, paid == null ? (eventName != '' ? eventName : 'already recorded') : paid.Id, paid == null ? null : paid.Invoice__c);
      response.statusCode = 200;
      response.responseBody = Blob.valueOf('{"ok":true}');
    } catch (Exception e) {
      RevquilaCore.log('webhook', gateway, 'failed', body, e.getMessage(), null);
      response.statusCode = 400;
      response.responseBody = Blob.valueOf('{"ok":false,"error":' + JSON.serialize(e.getMessage()) + '}');
    }
  }
}