/**
 * Posts a JSON payload to a URL after the transaction that asked for it has committed, signed
 * with the webhook secret (X-Revquila-Signature: HMAC-SHA256 of the body), and logs the answer.
 * The URL's host must be a Remote Site Setting, which the admin adds in Setup.
 */
public with sharing class RevquilaWebhookJob implements Queueable, Database.AllowsCallouts {
  private final String url;
  private final String payload;
  private final Id recordId;
  private final String kind;

  public RevquilaWebhookJob(String url, String payload, Id recordId, String kind) {
    this.url = url;
    this.payload = payload;
    this.recordId = recordId;
    this.kind = kind;
  }

  public void execute(QueueableContext context) {
    try {
      HttpRequest request = new HttpRequest();
      request.setEndpoint(url);
      request.setMethod('POST');
      request.setHeader('Content-Type', 'application/json');
      request.setTimeout(20000);
      Revquila_Secrets__c secrets = Revquila_Secrets__c.getOrgDefaults();
      if (secrets != null && String.isNotBlank(secrets.Webhook_Secret__c)) {
        Blob signature = Crypto.generateMac(
          'hmacSHA256',
          Blob.valueOf(payload),
          Blob.valueOf(secrets.Webhook_Secret__c)
        );
        request.setHeader('X-Revquila-Signature', EncodingUtil.convertToHex(signature));
      }
      request.setBody(payload);
      HttpResponse response = new Http().send(request);
      RevquilaCore.log(
        kind,
        url,
        response.getStatusCode() >= 200 && response.getStatusCode() < 300 ? 'ok' : 'failed',
        payload,
        response.getStatusCode() + ' ' + response.getBody(),
        recordId
      );
    } catch (Exception e) {
      RevquilaCore.log(kind, url, 'failed', payload, e.getMessage(), recordId);
    }
  }
}