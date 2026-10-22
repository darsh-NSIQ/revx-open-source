@IsTest
private class RevquilaConfigControllerTest {
  private static final String PAYLOAD_ONE = '{"brand":{"accent":"#0176d3"}}';
  private static final String PAYLOAD_TWO = '{"brand":{"accent":"#2e844a"}}';

  private static User userWith(String permissionSetName) {
    Profile standard = [
      SELECT Id
      FROM Profile
      WHERE Name = 'Standard User'
      LIMIT 1
    ];
    String unique = String.valueOf(Crypto.getRandomInteger()).replace('-', '');
    User person = new User(
      Alias = 'rq' + unique.left(5),
      Email = 'revquila.test@example.com',
      EmailEncodingKey = 'UTF-8',
      LastName = 'Tester',
      LanguageLocaleKey = 'en_US',
      LocaleSidKey = 'en_US',
      ProfileId = standard.Id,
      TimeZoneSidKey = 'Asia/Kolkata',
      Username = 'revquila.test.' + unique + '@example.com'
    );
    insert person;
    PermissionSet permissions = [
      SELECT Id
      FROM PermissionSet
      WHERE Name = :permissionSetName
      LIMIT 1
    ];
    insert new PermissionSetAssignment(
      AssigneeId = person.Id,
      PermissionSetId = permissions.Id
    );
    return person;
  }

  @IsTest
  static void nothingPublishedYet() {
    System.runAs(userWith('Revquila_Admin')) {
      Assert.isNull(
        RevquilaConfigController.getActivePayload(),
        'No configuration before the first publish'
      );
      Assert.isTrue(
        RevquilaConfigController.getHistory().isEmpty(),
        'No history before the first publish'
      );
    }
  }

  @IsTest
  static void publishAddsVersionsAndTheNewestIsLive() {
    System.runAs(userWith('Revquila_Admin')) {
      Assert.areEqual(
        1,
        RevquilaConfigController.publish(PAYLOAD_ONE, 'First setup'),
        'First publish is version 1'
      );
      Assert.areEqual(
        2,
        RevquilaConfigController.publish(PAYLOAD_TWO, null),
        'Second publish is version 2'
      );

      Assert.areEqual(
        PAYLOAD_TWO,
        RevquilaConfigController.getActivePayload(),
        'The newest version is live'
      );

      List<RevquilaConfigController.VersionInfo> history = RevquilaConfigController.getHistory();
      Assert.areEqual(2, history.size(), 'Both versions are kept');
      Assert.areEqual(2, history[0].version, 'History is newest first');
      Assert.areEqual(
        'First setup',
        history[1].note,
        'The note is kept with its version'
      );
      Assert.areEqual(
        PAYLOAD_ONE,
        RevquilaConfigController.getPayload(history[1].id),
        'An old version can be read back for a rollback'
      );
    }
  }

  @IsTest
  static void publishRejectsAnythingThatIsNotAJsonObject() {
    System.runAs(userWith('Revquila_Admin')) {
      for (String payload : new List<String>{ null, '', 'not json', '[1,2]' }) {
        try {
          RevquilaConfigController.publish(payload, null);
          Assert.fail('Expected a rejection for: ' + payload);
        } catch (AuraHandledException e) {
          Assert.isTrue(
            e.getMessage().contains('could not be read'),
            e.getMessage()
          );
        }
      }
      Assert.isTrue(
        RevquilaConfigController.getHistory().isEmpty(),
        'Nothing was published'
      );
    }
  }

  @IsTest
  static void usersWithoutTheAdminPermissionSetCanReadButNotPublish() {
    // Both users are created before any record is, so setup and data DML never mix
    User admin = userWith('Revquila_Admin');
    User reader = userWith('Revquila_User');
    System.runAs(admin) {
      Assert.isTrue(
        RevquilaConfigController.canPublish(),
        'An admin can publish'
      );
      RevquilaConfigController.publish(PAYLOAD_ONE, null);
    }
    System.runAs(reader) {
      Assert.isFalse(
        RevquilaConfigController.canPublish(),
        'Setup is read-only without the admin permission set'
      );
      Assert.areEqual(
        PAYLOAD_ONE,
        RevquilaConfigController.getActivePayload(),
        'Everyone reads the live configuration'
      );
      try {
        RevquilaConfigController.publish(PAYLOAD_TWO, null);
        Assert.fail('A user without the admin permission set must not publish');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('Revquila Admin'),
          e.getMessage()
        );
      }
    }
  }

  @IsTest
  static void missingVersionIsReported() {
    System.runAs(userWith('Revquila_Admin')) {
      Id missing =
        Config_Version__c.SObjectType.getDescribe().getKeyPrefix() +
        '000000000000AAA';
      try {
        RevquilaConfigController.getPayload(missing);
        Assert.fail('Expected a missing-version error');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('no longer exists'),
          e.getMessage()
        );
      }
    }
  }

  @IsTest
  static void logoIsStoredAsAFile() {
    System.runAs(userWith('Revquila_Admin')) {
      String url = RevquilaConfigController.uploadLogo(
        'logo.png',
        EncodingUtil.base64Encode(Blob.valueOf('png bytes'))
      );
      Assert.isTrue(
        url.startsWith('/sfc/servlet.shepherd/version/download/068'),
        url
      );
    }
  }

  @IsTest
  static void logoMustBeASmallPngOrJpg() {
    System.runAs(userWith('Revquila_Admin')) {
      try {
        RevquilaConfigController.uploadLogo('logo.svg', 'AAAA');
        Assert.fail('Expected the file type to be rejected');
      } catch (AuraHandledException e) {
        Assert.isTrue(e.getMessage().contains('PNG or JPG'), e.getMessage());
      }
      try {
        RevquilaConfigController.uploadLogo('logo.png', 'A'.repeat(1400001));
        Assert.fail('Expected the file size to be rejected');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('smaller than 1 MB'),
          e.getMessage()
        );
      }
    }
  }

  @IsTest
  static void testHelperQueriesAndPickers() {
    System.runAs(userWith('Revquila_Admin')) {
      Test.startTest();
      Assert.isTrue(RevquilaConfigController.canPublish());

      List<RevquilaSync.FieldView> syncFields = RevquilaConfigController.getSyncFields('Account');
      Assert.isFalse(syncFields.isEmpty());

      List<RevquilaRules.ContextField> ruleFields = RevquilaConfigController.getRuleFields();
      Assert.isFalse(ruleFields.isEmpty());

      List<RevquilaSync.FieldView> objFields = RevquilaConfigController.getObjectFields('Quote');
      Assert.isFalse(objFields.isEmpty());

      List<RevquilaConfigController.Choice> users = RevquilaConfigController.searchUsers('Tester');
      Assert.isNotNull(users);

      List<RevquilaConfigController.Choice> roles = RevquilaConfigController.getRoles();
      Assert.isNotNull(roles);

      List<RevquilaConfigController.Choice> flows = RevquilaConfigController.getFlows();
      Assert.isNotNull(flows);

      List<RevquilaConfigController.Choice> books = RevquilaConfigController.getPriceBooks();
      Assert.isNotNull(books);

      List<RevquilaConfigController.Choice> perms = RevquilaConfigController.getCustomPermissions();
      Assert.isNotNull(perms);

      Map<String, Boolean> secretsStatus = RevquilaConfigController.getSecretsStatus();
      Assert.isNotNull(secretsStatus);

      RevquilaConfigController.saveSecrets('{"gatewayKey":"TEST_KEY","gatewaySecret":"TEST_SECRET"}');

      // Test Jobs management
      RevquilaJobs.Status jobsStatus = RevquilaConfigController.getJobs();
      Assert.isNotNull(jobsStatus);
      RevquilaJobs.Status scheduledStatus = RevquilaConfigController.scheduleJobs(3);
      Assert.isNotNull(scheduledStatus);
      RevquilaJobs.Status unscheduledStatus = RevquilaConfigController.unscheduleJobs();
      Assert.isNotNull(unscheduledStatus);

      // Test Rates and History
      List<RevquilaConfigController.Choice> rateHistory = RevquilaConfigController.getRateHistory();
      Assert.isNotNull(rateHistory);

      // Test Logs and Webhooks
      List<RevquilaConfigController.LogRow> logs = RevquilaConfigController.getLogs('setup', 10);
      Assert.isNotNull(logs);

      String webhookMsg = RevquilaConfigController.testWebhook('https://example.com/webhook');
      Assert.isNotNull(webhookMsg);

      RevquilaConfigController.GatewayStatus gwStatus = RevquilaConfigController.getPaymentGatewayStatus();
      Assert.isNotNull(gwStatus);

      // Test System 360 Health and Diagnostics
      RevquilaConfigController.System360Health health360 = RevquilaConfigController.getSystem360Health();
      Assert.isNotNull(health360);
      Assert.isTrue(health360.healthScore > 0);
      Assert.isNotNull(health360.diagnostics);

      Map<String, Object> diagResult = RevquilaConfigController.runSystem360Diagnostics();
      Assert.isNotNull(diagResult);
      Assert.areEqual('100% Operational', diagResult.get('overallStatus'));

      Test.stopTest();
    }
  }
}