/**
 * Payment gateways: a payment link on an invoice, and a refund through the gateway. Built in:
 * manual (the portal's pay page, or no link), Razorpay (Payment Links API) and Stripe (Checkout
 * Sessions). Any Apex class named in Setup > Plugins implementing Gateway works the same way.
 * Keys live in Revquila Secrets (Setup > Integrations), never in the configuration.
 * Payments made through a gateway arrive on RevquilaPaymentWebhook.
 */
public with sharing class RevquilaPayments {
  public class Link {
    public String url;
    public String reference;
  }

  public interface Gateway {
    /** A link the customer pays the invoice's balance through, or null when there is none. */
    Link createLink(Invoice__c invoice);
    /** Returns the money through the gateway. Returns the gateway's reference, or null when it could not. */
    String refund(Payment__c payment, Decimal amount, String reason);
  }

  public static Gateway gateway() {
    RevquilaSettings settings = RevquilaSettings.current();
    String name = settings.plugins.get('payment');
    if (String.isBlank(name)) {
      name = settings.gateway;
    }
    if (name == 'razorpay') {
      return new Razorpay();
    }
    if (name == 'stripe') {
      return new Stripe();
    }
    if (String.isBlank(name) || name == 'manual') {
      return new Manual();
    }
    try {
      Object instance = Type.forName(name).newInstance();
      if (instance instanceof Gateway) {
        return (Gateway) instance;
      }
    } catch (Exception e) {
      RevquilaCore.log('gateway', name, 'failed', null, e.getMessage(), null);
    }
    return new Manual();
  }

  /** The portal's pay page for an invoice, when the portal is on. */
  public static String portalLink(Invoice__c invoice) {
    RevquilaSettings settings = RevquilaSettings.current();
    if (!settings.portalEnabled || String.isBlank(settings.portalUrl) || String.isBlank(invoice.Portal_Token__c)) {
      return null;
    }
    String base = settings.portalUrl.removeEnd('/');
    return base + '/' + RevquilaCore.prefix() + 'RevquilaPortalInvoice?t=' + invoice.Portal_Token__c;
  }

  public class Manual implements Gateway {
    public Link createLink(Invoice__c invoice) {
      String url = portalLink(invoice);
      if (url == null) {
        return null;
      }
      Link link = new Link();
      link.url = url;
      link.reference = 'portal';
      return link;
    }
    public String refund(Payment__c payment, Decimal amount, String reason) {
      return null;
    }
  }

  private static String basicAuth(String key, String secret) {
    return 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(key + ':' + secret));
  }

  private static Revquila_Secrets__c secrets() {
    Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
    RevquilaCore.need(
      secrets != null && String.isNotBlank(secrets.Gateway_Key__c) && String.isNotBlank(secrets.Gateway_Secret__c),
      'Enter the gateway key and secret in Setup > Integrations first.'
    );
    return secrets;
  }

  /** Razorpay Payment Links: one link per invoice for its balance, in the invoice's currency. */
  public class Razorpay implements Gateway {
    public Link createLink(Invoice__c invoice) {
      Revquila_Secrets__c keys = secrets();
      Map<String, Object> body = new Map<String, Object>{
        'amount' => (RevquilaCore.orZero(invoice.Balance__c) * 100).intValue(),
        'currency' => invoice.Currency_Code__c == null ? 'INR' : invoice.Currency_Code__c,
        'description' => 'Invoice ' + invoice.Number__c,
        'reference_id' => invoice.Number__c,
        'notes' => new Map<String, Object>{ 'invoice' => invoice.Number__c, 'revquila' => invoice.Id },
        'callback_method' => 'get'
      };
      String portal = portalLink(invoice);
      if (portal != null) {
        body.put('callback_url', portal);
      }
      HttpRequest request = new HttpRequest();
      request.setEndpoint('https://api.razorpay.com/v1/payment_links');
      request.setMethod('POST');
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Authorization', basicAuth(keys.Gateway_Key__c, keys.Gateway_Secret__c));
      request.setTimeout(20000);
      request.setBody(JSON.serialize(body));
      HttpResponse response = new Http().send(request);
      RevquilaCore.log('gateway', 'razorpay payment_links', response.getStatusCode() == 200 ? 'ok' : 'failed', JSON.serialize(body), response.getBody(), invoice.Id);
      RevquilaCore.need(response.getStatusCode() == 200, 'Razorpay refused the link: ' + response.getBody().abbreviate(200));
      Map<String, Object> answer = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
      Link link = new Link();
      link.url = String.valueOf(answer.get('short_url'));
      link.reference = String.valueOf(answer.get('id'));
      return link;
    }

    public String refund(Payment__c payment, Decimal amount, String reason) {
      if (String.isBlank(payment.Gateway_Reference__c)) {
        return null;
      }
      Revquila_Secrets__c keys = secrets();
      HttpRequest request = new HttpRequest();
      request.setEndpoint('https://api.razorpay.com/v1/payments/' + payment.Gateway_Reference__c + '/refund');
      request.setMethod('POST');
      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Authorization', basicAuth(keys.Gateway_Key__c, keys.Gateway_Secret__c));
      request.setTimeout(20000);
      request.setBody(JSON.serialize(new Map<String, Object>{ 'amount' => (amount * 100).intValue(), 'notes' => new Map<String, Object>{ 'reason' => reason } }));
      HttpResponse response = new Http().send(request);
      RevquilaCore.log('gateway', 'razorpay refund', response.getStatusCode() == 200 ? 'ok' : 'failed', null, response.getBody(), payment.Id);
      RevquilaCore.need(response.getStatusCode() == 200, 'Razorpay refused the refund: ' + response.getBody().abbreviate(200));
      return String.valueOf(((Map<String, Object>) JSON.deserializeUntyped(response.getBody())).get('id'));
    }
  }

  /** Stripe Checkout: one session per invoice for its balance. */
  public class Stripe implements Gateway {
    public Link createLink(Invoice__c invoice) {
      Revquila_Secrets__c keys = secrets();
      String portal = portalLink(invoice);
      String success = portal == null ? 'https://example.com/paid' : portal;
      String currencyCode = (invoice.Currency_Code__c == null ? 'USD' : invoice.Currency_Code__c).toLowerCase();
      String body =
        'mode=payment' +
        '&success_url=' + EncodingUtil.urlEncode(success, 'UTF-8') +
        '&cancel_url=' + EncodingUtil.urlEncode(success, 'UTF-8') +
        '&client_reference_id=' + EncodingUtil.urlEncode(invoice.Number__c, 'UTF-8') +
        '&metadata[invoice]=' + EncodingUtil.urlEncode(invoice.Number__c, 'UTF-8') +
        '&line_items[0][quantity]=1' +
        '&line_items[0][price_data][currency]=' + currencyCode +
        '&line_items[0][price_data][unit_amount]=' + (RevquilaCore.orZero(invoice.Balance__c) * 100).intValue() +
        '&line_items[0][price_data][product_data][name]=' + EncodingUtil.urlEncode('Invoice ' + invoice.Number__c, 'UTF-8');
      HttpRequest request = new HttpRequest();
      request.setEndpoint('https://api.stripe.com/v1/checkout/sessions');
      request.setMethod('POST');
      request.setHeader('Content-Type', 'application/x-www-form-urlencoded');
      request.setHeader('Authorization', 'Bearer ' + keys.Gateway_Secret__c);
      request.setTimeout(20000);
      request.setBody(body);
      HttpResponse response = new Http().send(request);
      RevquilaCore.log('gateway', 'stripe checkout', response.getStatusCode() == 200 ? 'ok' : 'failed', body, response.getBody(), invoice.Id);
      RevquilaCore.need(response.getStatusCode() == 200, 'Stripe refused the link: ' + response.getBody().abbreviate(200));
      Map<String, Object> answer = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
      Link link = new Link();
      link.url = String.valueOf(answer.get('url'));
      link.reference = String.valueOf(answer.get('id'));
      return link;
    }

    public String refund(Payment__c payment, Decimal amount, String reason) {
      if (String.isBlank(payment.Gateway_Reference__c)) {
        return null;
      }
      Revquila_Secrets__c keys = secrets();
      HttpRequest request = new HttpRequest();
      request.setEndpoint('https://api.stripe.com/v1/refunds');
      request.setMethod('POST');
      request.setHeader('Content-Type', 'application/x-www-form-urlencoded');
      request.setHeader('Authorization', 'Bearer ' + keys.Gateway_Secret__c);
      request.setTimeout(20000);
      request.setBody('payment_intent=' + EncodingUtil.urlEncode(payment.Gateway_Reference__c, 'UTF-8') + '&amount=' + (amount * 100).intValue());
      HttpResponse response = new Http().send(request);
      RevquilaCore.log('gateway', 'stripe refund', response.getStatusCode() == 200 ? 'ok' : 'failed', null, response.getBody(), payment.Id);
      RevquilaCore.need(response.getStatusCode() == 200, 'Stripe refused the refund: ' + response.getBody().abbreviate(200));
      return String.valueOf(((Map<String, Object>) JSON.deserializeUntyped(response.getBody())).get('id'));
    }
  }

  /** Verifies a webhook body against the secret: hex HMAC-SHA256 (Razorpay, generic) or Stripe's t=..,v1=.. header. */
  public static Boolean verify(String body, String signatureHeader, String secret) {
    if (String.isBlank(secret)) {
      return false;
    }
    if (String.isBlank(signatureHeader)) {
      return false;
    }
    if (signatureHeader.contains('v1=')) {
      String timestamp = signatureHeader.substringBetween('t=', ',');
      String expected = EncodingUtil.convertToHex(
        Crypto.generateMac('hmacSHA256', Blob.valueOf(timestamp + '.' + body), Blob.valueOf(secret))
      );
      for (String part : signatureHeader.split(',')) {
        if (part.trim().startsWith('v1=') && part.trim().substringAfter('v1=') == expected) {
          return true;
        }
      }
      return false;
    }
    String expected = EncodingUtil.convertToHex(
      Crypto.generateMac('hmacSHA256', Blob.valueOf(body), Blob.valueOf(secret))
    );
    return expected.equalsIgnoreCase(signatureHeader.trim());
  }

  /**
   * Pings the active payment gateway with stored credentials to verify connectivity.
   */
  public static Map<String, Object> testConnection(String gatewayName) {
    Map<String, Object> result = new Map<String, Object>();
    Revquila_Secrets__c keys = Revquila_Secrets__c.getOrgDefaults();
    if (keys == null || String.isBlank(keys.Gateway_Secret__c)) {
      result.put('ok', false);
      result.put('message', 'Please save your Gateway Secret Key first.');
      return result;
    }
    String gw = String.isNotBlank(gatewayName) ? gatewayName.toLowerCase() : 'stripe';
    try {
      HttpRequest req = new HttpRequest();
      req.setMethod('GET');
      req.setTimeout(15000);

      if (gw == 'stripe') {
        req.setEndpoint('https://api.stripe.com/v1/balance');
        req.setHeader('Authorization', 'Bearer ' + keys.Gateway_Secret__c.trim());
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() == 200) {
          Boolean isLive = res.getBody().contains('"livemode": true') || res.getBody().contains('"livemode":true');
          result.put('ok', true);
          result.put('message', 'Successfully connected to Stripe API (' + (isLive ? 'Live Mode' : 'Test Mode') + ').');
        } else {
          result.put('ok', false);
          result.put('message', 'Stripe rejected credentials (' + res.getStatusCode() + '): ' + res.getBody().abbreviate(180));
        }
      } else if (gw == 'razorpay') {
        if (String.isBlank(keys.Gateway_Key__c)) {
          result.put('ok', false);
          result.put('message', 'Please enter both Razorpay Key ID and Key Secret.');
          return result;
        }
        req.setEndpoint('https://api.razorpay.com/v1/payments?count=1');
        req.setHeader('Authorization', basicAuth(keys.Gateway_Key__c.trim(), keys.Gateway_Secret__c.trim()));
        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() == 200) {
          result.put('ok', true);
          result.put('message', 'Successfully connected to Razorpay Payments API.');
        } else {
          result.put('ok', false);
          result.put('message', 'Razorpay rejected credentials (' + res.getStatusCode() + '): ' + res.getBody().abbreviate(180));
        }
      } else {
        result.put('ok', true);
        result.put('message', 'Manual mode active (customer portal payment).');
      }
    } catch (Exception e) {
      result.put('ok', false);
      result.put('message', 'Connection failed: ' + e.getMessage());
    }
    return result;
  }
}