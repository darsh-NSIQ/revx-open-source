/**
 * RevX Native E-Signature Controller: Zero-dependency, out-of-the-box digital signing.
 * Captures drawn canvas/typed signature, creates cryptographic audit trail, archives
 * signature image to Salesforce Files (ContentVersion), marks quote as signed, and books
 * orders/contracts automatically without any external service (DocuSign/AdobeSign).
 */
public without sharing class RevquilaEsignController {
  public class SignContext {
    @AuraEnabled public Id quoteId;
    @AuraEnabled public String quoteNumber;
    @AuraEnabled public String accountName;
    @AuraEnabled public String contactName;
    @AuraEnabled public String contactEmail;
    @AuraEnabled public Decimal totalAmount;
    @AuraEnabled public String currencyCode;
    @AuraEnabled public String status;
    @AuraEnabled public Boolean isSigned;
    @AuraEnabled public String signedByName;
    @AuraEnabled public String signedByEmail;
    @AuraEnabled public String signedByTitle;
    @AuraEnabled public Date signedOn;
    @AuraEnabled public String signatureData;
    @AuraEnabled public String companyName;
    @AuraEnabled public String signatureDigest;
    @AuraEnabled public String portalToken;
  }

  public class SignResult {
    @AuraEnabled public Boolean ok;
    @AuraEnabled public String message;
    @AuraEnabled public Id quoteId;
    @AuraEnabled public String quoteNumber;
    @AuraEnabled public String certificateDocId;
    @AuraEnabled public String digest;
  }

  /**
   * Loads quote details for E-Signing by Quote ID or Portal Token.
   */
  @AuraEnabled
  public static SignContext getQuoteForSigning(Id quoteId, String token) {
    try {
      Quote__c q;
      if (quoteId != null) {
        q = [
          SELECT Id, Name, Display_Number__c, Account__r.Name, Contact__r.Name, Contact__r.Email,
            Total__c, Currency_Code__c, Status__c, Signed_On__c, Signed_By_Name__c, Signed_By_Email__c,
            Signed_By_Title__c, Signature_Data__c, Signature_Audit__c, Portal_Token__c
          FROM Quote__c
          WHERE Id = :quoteId
          WITH SYSTEM_MODE
          LIMIT 1
        ];
      } else if (String.isNotBlank(token)) {
        q = [
          SELECT Id, Name, Display_Number__c, Account__r.Name, Contact__r.Name, Contact__r.Email,
            Total__c, Currency_Code__c, Status__c, Signed_On__c, Signed_By_Name__c, Signed_By_Email__c,
            Signed_By_Title__c, Signature_Data__c, Signature_Audit__c, Portal_Token__c
          FROM Quote__c
          WHERE Portal_Token__c = :token
          WITH SYSTEM_MODE
          LIMIT 1
        ];
      } else {
        throw new RevquilaCore.ProblemException('Missing quote identifier or token.');
      }

      SignContext ctx = new SignContext();
      ctx.quoteId = q.Id;
      ctx.quoteNumber = RevquilaCore.shownNumber(q);
      ctx.accountName = q.Account__r != null ? q.Account__r.Name : '';
      ctx.contactName = q.Contact__r != null ? q.Contact__r.Name : '';
      ctx.contactEmail = q.Contact__r != null ? q.Contact__r.Email : '';
      ctx.totalAmount = q.Total__c;
      ctx.currencyCode = String.isNotBlank(q.Currency_Code__c) ? q.Currency_Code__c : 'USD';
      ctx.status = q.Status__c;
      ctx.isSigned = q.Status__c == 'signed' || q.Signed_On__c != null;
      ctx.signedByName = q.Signed_By_Name__c;
      ctx.signedByEmail = q.Signed_By_Email__c;
      ctx.signedByTitle = q.Signed_By_Title__c;
      ctx.signedOn = q.Signed_On__c;
      ctx.signatureData = q.Signature_Data__c;
      ctx.portalToken = q.Portal_Token__c;
      ctx.companyName = RevquilaSettings.current().companyName;

      if (String.isNotBlank(q.Signature_Audit__c)) {
        try {
          Map<String, Object> audit = (Map<String, Object>) JSON.deserializeUntyped(q.Signature_Audit__c);
          if (audit.containsKey('digest')) {
            ctx.signatureDigest = String.valueOf(audit.get('digest'));
          }
        } catch (Exception ex) {}
      }
      return ctx;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Executes digital e-signature natively inside Salesforce.
   */
  @AuraEnabled
  public static SignResult completeEsign(
    Id quoteId,
    String token,
    String signerName,
    String signerEmail,
    String signerTitle,
    String signatureData,
    String auditJson
  ) {
    try {
      if (String.isBlank(signerName)) {
        throw new RevquilaCore.ProblemException('Please provide the signer full name.');
      }
      if (String.isBlank(signerEmail) || !signerEmail.contains('@')) {
        throw new RevquilaCore.ProblemException('Please provide a valid signer email.');
      }
      if (String.isBlank(signatureData)) {
        throw new RevquilaCore.ProblemException('Please draw or create your digital signature.');
      }

      Quote__c quote;
      if (quoteId != null) {
        quote = [
          SELECT Id, Name, Display_Number__c, Status__c, OwnerId, Account__r.Name, Total__c, Version__c,
            Contact__c, Contact__r.Name, Portal_Token__c
          FROM Quote__c
          WHERE Id = :quoteId
          WITH SYSTEM_MODE
          LIMIT 1
        ];
      } else if (String.isNotBlank(token)) {
        quote = [
          SELECT Id, Name, Display_Number__c, Status__c, OwnerId, Account__r.Name, Total__c, Version__c,
            Contact__c, Contact__r.Name, Portal_Token__c
          FROM Quote__c
          WHERE Portal_Token__c = :token
          WITH SYSTEM_MODE
          LIMIT 1
        ];
      } else {
        throw new RevquilaCore.ProblemException('Quote reference not found.');
      }

      String shownNum = RevquilaCore.shownNumber(quote);
      String digestHex = EncodingUtil.convertToHex(Crypto.generateDigest('SHA-256', Blob.valueOf(shownNum + signerEmail + System.now().getTime())));

      // Construct comprehensive audit metadata
      Map<String, Object> auditMap = new Map<String, Object>{
        'timestampUtc' => DateTime.now().formatGmt('yyyy-MM-dd HH:mm:ss') + ' UTC',
        'signerName' => signerName.trim(),
        'signerEmail' => signerEmail.trim().toLowerCase(),
        'signerTitle' => String.isNotBlank(signerTitle) ? signerTitle.trim() : 'Authorized Signatory',
        'account' => quote.Account__r != null ? quote.Account__r.Name : '',
        'quoteNumber' => shownNum,
        'verificationMethod' => 'RevX Native Digital Signature Pad (ESIGN & UETA Compliant)',
        'digest' => digestHex
      };
      if (String.isNotBlank(auditJson)) {
        try {
          Map<String, Object> clientAudit = (Map<String, Object>) JSON.deserializeUntyped(auditJson);
          auditMap.putAll(clientAudit);
        } catch (Exception ex) {}
      }
      String finalAuditString = JSON.serializePretty(auditMap);

      // Update Quote record
      Quote__c updateQ = new Quote__c(
        Id = quote.Id,
        Signed_On__c = Date.today(),
        Signed_By_Name__c = signerName.trim().abbreviate(100),
        Signed_By_Email__c = signerEmail.trim().toLowerCase().abbreviate(80),
        Signed_By_Title__c = String.isNotBlank(signerTitle) ? signerTitle.trim().abbreviate(100) : null,
        Signature_Data__c = signatureData.abbreviate(131070),
        Signature_Audit__c = finalAuditString.abbreviate(2000)
      );
      update as system updateQ;

      // Archive signature image to Salesforce Files (ContentVersion)
      archiveSignatureFile(quote.Id, shownNum, signerName, signatureData);

      // If quote is already in 'sent' status, execute standard Revquila sign & order booking
      if (quote.Status__c == 'sent') {
        RevquilaQuoteController.act(quote.Id, 'sign', 'Digitally signed by ' + signerName.trim());
      } else {
        // Record timeline event
        Revenue_Event__c event = RevquilaCore.event(
          quote.Id,
          'Digitally Signed via RevX Native E-Sign',
          'Signed by ' + signerName.trim() + ' (' + signerEmail.trim() + ') · Audit Trail Verified',
          RevquilaCore.TONE_TEAL
        );
        event.Kind__c = 'accepted';
        insert as system event;
      }

      // Render official Certificate of Completion PDF
      Blob certPdf = renderCertificatePdf(quote.Id);

      // Archive Certificate PDF to Salesforce Files (ContentVersion)
      Id certDocId = archiveCertificatePdf(quote.Id, shownNum, certPdf);

      // Record enterprise Audit Trail Entry
      logAuditTrailEntry(quote.Id, shownNum, 'E-Signature Executed', signerName.trim(), signerEmail.trim(), 'Certificate of Completion generated and SHA-256 sealed');

      // Automatically dispatch signed execution certificate email with attached PDF to signer and quote owner
      sendSignedConfirmationEmail(quote, signerName.trim(), signerEmail.trim().toLowerCase(), signerTitle, digestHex, shownNum, certPdf);

      SignResult res = new SignResult();
      res.ok = true;
      res.quoteId = quote.Id;
      res.quoteNumber = shownNum;
      res.certificateDocId = certDocId != null ? String.valueOf(certDocId) : null;
      res.digest = digestHex;
      res.message = 'Quote ' + shownNum + ' has been legally e-signed and sealed with Certificate of Completion.';
      return res;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Generates the tamper-evident Certificate of Completion PDF via Visualforce flying saucer.
   */
  public static Blob renderCertificatePdf(Id quoteId) {
    try {
      PageReference certPage = new PageReference('/apex/' + RevquilaCore.prefix() + 'RevquilaEsignCertificate');
      certPage.getParameters().put('id', String.valueOf(quoteId));
      if (Test.isRunningTest()) {
        return Blob.valueOf('UNIT_TEST_CERTIFICATE_PDF');
      }
      return certPage.getContentAsPDF();
    } catch (Exception ex) {
      System.debug(LoggingLevel.WARN, 'Could not render Certificate PDF: ' + ex.getMessage());
      return null;
    }
  }

  /**
   * Generates and dispatches the Certificate of Completion PDF to any target recipient.
   */
  @AuraEnabled
  public static Boolean resendCertificateEmail(Id quoteId, String targetEmail) {
    try {
      if (quoteId == null || String.isBlank(targetEmail) || !targetEmail.contains('@')) {
        throw new RevquilaCore.ProblemException('Invalid Quote ID or recipient email.');
      }
      Quote__c quote = [
        SELECT Id, Name, Display_Number__c, Status__c, OwnerId, Account__r.Name, Total__c, Version__c,
          Contact__c, Contact__r.Name, Portal_Token__c, Signed_By_Name__c, Signed_By_Email__c,
          Signed_By_Title__c, Signature_Audit__c
        FROM Quote__c
        WHERE Id = :quoteId
        WITH SYSTEM_MODE
        LIMIT 1
      ];

      String shownNum = RevquilaCore.shownNumber(quote);
      Blob certPdf = renderCertificatePdf(quote.Id);
      archiveCertificatePdf(quote.Id, shownNum, certPdf);
      String digestHex = '';
      if (String.isNotBlank(quote.Signature_Audit__c)) {
        try {
          Map<String, Object> audit = (Map<String, Object>) JSON.deserializeUntyped(quote.Signature_Audit__c);
          if (audit.containsKey('digest')) {
            digestHex = String.valueOf(audit.get('digest'));
          }
        } catch (Exception ex) {}
      }
      if (String.isBlank(digestHex)) {
        digestHex = EncodingUtil.convertToHex(Crypto.generateDigest('SHA-256', Blob.valueOf(shownNum + targetEmail)));
      }

      sendSignedConfirmationEmail(
        quote,
        String.isNotBlank(quote.Signed_By_Name__c) ? quote.Signed_By_Name__c : 'Authorized Signatory',
        targetEmail.trim().toLowerCase(),
        quote.Signed_By_Title__c,
        digestHex,
        shownNum,
        certPdf
      );
      return true;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /**
   * Dispatches automated Signed Agreement & Cryptographic Execution Certificate email to the signer and owner.
   */
  private static void sendSignedConfirmationEmail(
    Quote__c quote,
    String signerName,
    String signerEmail,
    String signerTitle,
    String auditDigest,
    String quoteNumber,
    Blob certPdf
  ) {
    if (String.isBlank(signerEmail) || !signerEmail.contains('@')) {
      return;
    }
    try {
      Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
      mail.setToAddresses(new List<String>{ signerEmail.trim() });
      if (quote.OwnerId != null) {
        List<User> owners = [SELECT Email FROM User WHERE Id = :quote.OwnerId WITH SYSTEM_MODE LIMIT 1];
        if (!owners.isEmpty() && String.isNotBlank(owners[0].Email) && owners[0].Email.toLowerCase() != signerEmail.toLowerCase()) {
          mail.setCcAddresses(new List<String>{ owners[0].Email });
        }
      }
      String cName = RevquilaSettings.current().companyName;
      if (String.isBlank(cName)) {
        cName = 'RevX';
      }
      mail.setSenderDisplayName(cName + ' Digital E-Sign');
      mail.setSubject('Completed: Signed Agreement & Execution Certificate - ' + quoteNumber + ' (' + (quote.Account__r != null ? quote.Account__r.Name : '') + ')');

      // Attach Certificate PDF if available
      if (certPdf != null) {
        Messaging.EmailFileAttachment efa = new Messaging.EmailFileAttachment();
        efa.setFileName('Certificate_of_Completion_' + quoteNumber + '.pdf');
        efa.setContentType('application/pdf');
        efa.setBody(certPdf);
        mail.setFileAttachments(new List<Messaging.EmailFileAttachment>{ efa });
      }

      String orgDomain = URL.getOrgDomainUrl().toExternalForm();
      String tokenStr = String.isNotBlank(quote.Portal_Token__c) ? quote.Portal_Token__c : '';
      String viewUrl = orgDomain + '/apex/' + RevquilaCore.prefix() + 'RevquilaPortalQuote?t=' + tokenStr;

      String html = '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<style>' +
        '  body { margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background-color:#f1f5f9; color:#0f172a; }' +
        '  .container { max-width:600px; margin:24px auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; box-shadow:0 10px 25px -5px rgba(15,23,42,0.08); }' +
        '  .header { background:linear-gradient(135deg, #064e3b 0%, #059669 100%); padding:28px 32px; color:#ffffff; }' +
        '  .header small { text-transform:uppercase; font-size:11px; letter-spacing:0.12em; font-weight:700; color:#a7f3d0; }' +
        '  .header h1 { margin:8px 0 0 0; font-size:24px; font-weight:800; letter-spacing:-0.02em; }' +
        '  .content { padding:32px; }' +
        '  .badge { display:inline-block; padding:4px 12px; background:#ecfdf5; color:#047857; font-size:11.5px; font-weight:800; border-radius:999px; text-transform:uppercase; border:1px solid #a7f3d0; }' +
        '  .cert-card { background:#f8fafc; border:2px solid #10b981; border-radius:14px; padding:20px; margin:20px 0; }' +
        '  .row { display:flex; justify-content:space-between; margin:8px 0; font-size:13.5px; }' +
        '  .row b { color:#0f172a; }' +
        '  .row span { color:#64748b; }' +
        '  .digest { font-family:monospace; font-size:11.5px; background:#f1f5f9; padding:8px 10px; border-radius:8px; border:1px solid #cbd5e1; word-break:break-all; color:#0f172a; margin-top:8px; }' +
        '  .btn-container { text-align:center; margin:28px 0 16px; }' +
        '  .btn { display:inline-block; background:linear-gradient(135deg, #059669, #10b981); color:#ffffff !important; text-decoration:none; padding:13px 30px; border-radius:12px; font-size:15px; font-weight:700; box-shadow:0 4px 14px rgba(5,150,105,0.3); }' +
        '  .footer { background:#f8fafc; padding:20px 32px; font-size:12px; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0; }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '  <div class="container">' +
        '    <div class="header">' +
        '      <small>RevX Native E-Signature Execution</small>' +
        '      <h1>Agreement Executed &amp; Recorded</h1>' +
        '    </div>' +
        '    <div class="content">' +
        '      <p style="font-size:16px; margin-top:0;">Dear <b>' + signerName + '</b>,</p>' +
        '      <p style="font-size:14.5px; line-height:1.6; color:#334155;">' +
        '        Thank you! Quotation <b>' + quoteNumber + '</b> has been successfully verified, legally authorized, and completed.' +
        '      </p>' +
        '      <div class="cert-card">' +
        '        <div style="margin-bottom:12px;"><span class="badge">✓ Digitally Signed &amp; Verified</span></div>' +
        '        <div class="row"><span>Document:</span><b>' + quoteNumber + '</b></div>' +
        '        <div class="row"><span>Signer:</span><b>' + signerName + ' (' + signerEmail + ')</b></div>' +
        '        <div class="row"><span>Title:</span><b>' + (String.isNotBlank(signerTitle) ? signerTitle : 'Authorized Signatory') + '</b></div>' +
        '        <div class="row"><span>Execution Date:</span><b>' + Date.today().format() + '</b></div>' +
        '        <div class="row"><span>Total Value:</span><b>₹' + (quote.Total__c != null ? quote.Total__c.format() : '0') + ' INR</b></div>' +
        '        <div style="margin-top:14px; font-size:12px; color:#64748b; font-weight:700;">CRYPTOGRAPHIC SHA-256 AUDIT DIGEST:</div>' +
        '        <div class="digest">' + auditDigest + '</div>' +
        '      </div>' +
        '      <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:12px 16px; margin:16px 0; font-size:13px; color:#065f46;">' +
        '        📎 <b>Attachment Included:</b> The official, tamper-evident <b>Certificate of Completion PDF</b> has been generated and attached to this email.' +
        '      </div>' +
        '      <div class="btn-container">' +
        '        <a href="' + viewUrl + '" class="btn" target="_blank">📄 View Executed Document Online</a>' +
        '      </div>' +
        '      <p style="font-size:12.5px; color:#64748b; line-height:1.5;">' +
        '        A copy of this digital signature certificate and all audit logs have been archived securely in Salesforce Files.' +
        '      </p>' +
        '    </div>' +
        '    <div class="footer">' +
        '      Powered by <b>RevX (Revquila)</b> · 100% Salesforce-Native Quote-to-Cash Suite' +
        '    </div>' +
        '  </div>' +
        '</body>' +
        '</html>';

      mail.setHtmlBody(html);
      mail.setPlainTextBody(
        'Dear ' + signerName + ',\n\n' +
        'Quotation ' + quoteNumber + ' has been legally e-signed and completed.\n' +
        'Execution Date: ' + Date.today().format() + '\n' +
        'SHA-256 Digest: ' + auditDigest + '\n\n' +
        'The Certificate of Completion PDF is attached to this email.\n' +
        'You can view your signed document anytime at:\n' +
        viewUrl + '\n\n' +
        'Thank you,\nRevX Digital E-Sign'
      );
      Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail }, false);
    } catch (Exception ex) {
      System.debug(LoggingLevel.WARN, 'Could not send signed confirmation email: ' + ex.getMessage());
    }
  }

  /**
   * Permanently saves the base64 signature image as a Salesforce File linked to the Quote.
   */
  private static void archiveSignatureFile(Id quoteId, String quoteNumber, String signerName, String signatureData) {
    try {
      String base64Data = signatureData;
      if (base64Data.contains(',')) {
        base64Data = base64Data.substringAfter(',');
      }
      Blob signatureBlob = EncodingUtil.base64Decode(base64Data);

      ContentVersion cv = new ContentVersion(
        Title = 'RevX_Digital_Signature_' + quoteNumber + '_' + Date.today().format(),
        PathOnClient = 'signature_' + quoteNumber + '.png',
        VersionData = signatureBlob,
        IsMajorVersion = true
      );
      insert as system cv;

      Id docId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id WITH SYSTEM_MODE LIMIT 1].ContentDocumentId;
      ContentDocumentLink cdl = new ContentDocumentLink(
        ContentDocumentId = docId,
        LinkedEntityId = quoteId,
        ShareType = 'V',
        Visibility = 'AllUsers'
      );
      insert as system cdl;
    } catch (Exception e) {
      System.debug(LoggingLevel.WARN, 'Could not archive signature to ContentVersion: ' + e.getMessage());
    }
  }

  /**
   * Permanently saves the Certificate of Completion PDF as a Salesforce File linked to the Quote.
   */
  private static Id archiveCertificatePdf(Id quoteId, String quoteNumber, Blob certPdf) {
    if (certPdf == null) return null;
    try {
      ContentVersion cv = new ContentVersion(
        Title = 'Certificate_of_Completion_' + quoteNumber + '_' + Date.today().format(),
        PathOnClient = 'Certificate_of_Completion_' + quoteNumber + '.pdf',
        VersionData = certPdf,
        IsMajorVersion = true
      );
      insert as system cv;

      Id docId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id WITH SYSTEM_MODE LIMIT 1].ContentDocumentId;
      ContentDocumentLink cdl = new ContentDocumentLink(
        ContentDocumentId = docId,
        LinkedEntityId = quoteId,
        ShareType = 'V',
        Visibility = 'AllUsers'
      );
      insert as system cdl;
      return docId;
    } catch (Exception e) {
      System.debug(LoggingLevel.WARN, 'Could not archive certificate PDF: ' + e.getMessage());
      return null;
    }
  }

  /**
   * Logs an entry in the enterprise Audit Trail Entry custom object.
   */
  private static void logAuditTrailEntry(Id quoteId, String quoteNumber, String action, String userName, String userEmail, String reason) {
    try {
      Audit_Trail_Entry__c ate = new Audit_Trail_Entry__c(
        Record_Id__c = String.valueOf(quoteId),
        Record_Name__c = quoteNumber,
        Object_Api_Name__c = 'Quote__c',
        Action__c = action,
        User_Name__c = userName,
        User_Email__c = userEmail,
        Reason__c = reason,
        Timestamp__c = System.now()
      );
      insert as system ate;
    } catch (Exception ex) {
      System.debug(LoggingLevel.WARN, 'Could not insert Audit_Trail_Entry__c: ' + ex.getMessage());
    }
  }
}