@IsTest
private class RevquilaDocumentControllerTest {
  private static User revquilaUser() {
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
      WHERE Name = 'Revquila_User'
      LIMIT 1
    ];
    insert new PermissionSetAssignment(
      AssigneeId = person.Id,
      PermissionSetId = permissions.Id
    );
    return person;
  }

  private static String payload(Map<String, Object> overrides) {
    Map<String, Object> model = new Map<String, Object>{
      'kind' => 'quote',
      'title' => 'Quotation',
      'documentNumber' => 'Q-00424',
      'layout' => 'modern',
      'font' => 'serif',
      'pageSize' => 'Letter',
      'accent' => '#2e844a',
      'accentSoft' => '#e6f1ea',
      'showLogo' => true,
      'logoUrl' => '',
      'logoRight' => true,
      'watermark' => 'DRAFT',
      'companyName' => 'Revquila Demo Pvt Ltd',
      'companyLines' => new List<String>{ 'Pune' },
      'customerName' => 'Orbit Retail',
      'meta' => new List<Object>{
        new Map<String, Object>{ 'label' => 'Date', 'value' => '30 Sep 2026' }
      },
      'rows' => new List<Object>{
        new Map<String, Object>{
          'no' => '1',
          'name' => 'Platform licence',
          'qty' => '25',
          'amount' => '3,00,000.00'
        }
      },
      'totalLabel' => 'Total',
      'totalValue' => 'INR 4,60,200.00',
      'termsLines' => new List<String>{ 'Net 30' },
      'signatory' => 'Authorised Signatory',
      'somethingNewer' => 'ignored'
    };
    model.putAll(overrides);
    return JSON.serialize(model);
  }

  private static RevquilaDocumentController pageFor(String snapshotId) {
    PageReference page = Page.RevquilaDocument;
    page.getParameters().put('id', snapshotId);
    Test.setCurrentPage(page);
    return new RevquilaDocumentController();
  }

  @IsTest
  static void aSavedDocumentRendersForTheUserWhoGeneratedIt() {
    System.runAs(revquilaUser()) {
      Id snapshotId = RevquilaDocumentController.saveSnapshot(
        payload(new Map<String, Object>())
      );

      RevquilaDocumentController controller = pageFor(snapshotId);

      Assert.isTrue(controller.found, 'The snapshot is found');
      Assert.isFalse(controller.missing, 'Found and missing are opposites');
      Assert.areEqual('Q-00424', controller.model.documentNumber);
      Assert.areEqual('modern', controller.layout);
      Assert.areEqual('#2e844a', controller.accent);
      Assert.areEqual('#e6f1ea', controller.accentSoft);
      Assert.areEqual('letter', controller.paper);
      Assert.areEqual('serif', controller.fontFamily);
      Assert.isTrue(controller.logoOnRight, 'Logo position is kept');
      Assert.isFalse(controller.logoOnLeft, 'Only one logo position');
      Assert.isTrue(
        controller.defaultLogo,
        'No uploaded logo shows the Revquila logo'
      );
      Assert.isFalse(controller.customLogo, 'There is no uploaded logo');
      Assert.isTrue(controller.hasTerms, 'Terms are printed');
      Assert.isTrue(controller.hasSignatory, 'The signatory is printed');
      Assert.isTrue(controller.hasWatermark, 'A draft is watermarked');
      Assert.isFalse(controller.hasNotes, 'Missing lists become empty');
      Assert.isFalse(controller.hasBank, 'Missing lists become empty');
      Assert.areEqual(1, controller.model.rows.size(), 'Lines are kept');
      Assert.isTrue(
        controller.model.settled.isEmpty(),
        'A missing list is empty, not null'
      );
    }
  }

  @IsTest
  static void valuesThatReachTheStylesheetAreChecked() {
    System.runAs(revquilaUser()) {
      Id snapshotId = RevquilaDocumentController.saveSnapshot(
        payload(
          new Map<String, Object>{
            'accent' => 'red; } body { display: none',
            'accentSoft' => null,
            'layout' => 'x } body { color: red',
            'font' => 'Comic Sans',
            'pageSize' => '1mm 1mm',
            'logoUrl' => 'https://example.com/tracker.png'
          }
        )
      );

      RevquilaDocumentController controller = pageFor(snapshotId);

      Assert.areEqual('#0176d3', controller.accent, 'A bad colour is replaced');
      Assert.areEqual(
        '#e1eefa',
        controller.accentSoft,
        'A missing tint is replaced'
      );
      Assert.areEqual('classic', controller.layout, 'An unknown layout');
      Assert.areEqual('sans-serif', controller.fontFamily, 'An unknown font');
      Assert.areEqual('A4', controller.paper, 'An unknown page size');
      Assert.areEqual(
        '',
        controller.model.logoUrl,
        'Only a logo stored by Revquila is loaded'
      );
    }
  }

  @IsTest
  static void anUploadedLogoIsUsed() {
    System.runAs(revquilaUser()) {
      Id snapshotId = RevquilaDocumentController.saveSnapshot(
        payload(
          new Map<String, Object>{
            'logoUrl' => '/sfc/servlet.shepherd/version/download/068000000000001AAA',
            'logoRight' => false
          }
        )
      );

      RevquilaDocumentController controller = pageFor(snapshotId);

      Assert.isTrue(controller.customLogo, 'The uploaded logo is shown');
      Assert.isFalse(controller.defaultLogo, 'Not both logos');
      Assert.isTrue(controller.logoOnLeft, 'Logo on the left');
    }
  }

  @IsTest
  static void aSnapshotIsPrivateToItsOwner() {
    Id snapshotId;
    User owner = revquilaUser();
    User someoneElse = revquilaUser();
    System.runAs(owner) {
      snapshotId = RevquilaDocumentController.saveSnapshot(
        payload(new Map<String, Object>())
      );
    }
    System.runAs(someoneElse) {
      RevquilaDocumentController controller = pageFor(snapshotId);
      Assert.isTrue(controller.missing, 'Another user cannot open it');
      Assert.areEqual('classic', controller.layout, 'Defaults when missing');
      Assert.areEqual('#0176d3', controller.accent, 'Defaults when missing');
      Assert.areEqual(
        '#e1eefa',
        controller.accentSoft,
        'Defaults when missing'
      );
      Assert.areEqual('A4', controller.paper, 'Defaults when missing');
      Assert.isFalse(controller.hasWatermark, 'Nothing to print');
      Assert.isFalse(controller.customLogo, 'Nothing to print');
      Assert.isFalse(controller.defaultLogo, 'Nothing to print');
      Assert.isFalse(controller.hasSignatory, 'Nothing to print');
    }
  }

  @IsTest
  static void aLinkWithoutAValidIdShowsNothing() {
    System.runAs(revquilaUser()) {
      Assert.isTrue(pageFor('not-an-id').missing, 'A bad id');
      Assert.isTrue(pageFor(null).missing, 'No id');
    }
  }

  @IsTest
  static void onlyAReadableDocumentIsSaved() {
    System.runAs(revquilaUser()) {
      for (
        String bad : new List<String>{
          null,
          '',
          'not json',
          '{"title":"No number"}'
        }
      ) {
        try {
          RevquilaDocumentController.saveSnapshot(bad);
          Assert.fail('Expected a failure for: ' + bad);
        } catch (AuraHandledException e) {
          Assert.isTrue(
            e.getMessage().contains('could not be read'),
            e.getMessage()
          );
        }
      }
      Assert.areEqual(
        0,
        [SELECT COUNT() FROM Document_Snapshot__c],
        'Nothing was saved'
      );
    }
  }

  @IsTest
  static void aDocumentThatIsTooLongIsRefused() {
    System.runAs(revquilaUser()) {
      try {
        RevquilaDocumentController.saveSnapshot(
          payload(new Map<String, Object>{ 'footer' => 'x'.repeat(125000) })
        );
        Assert.fail('Expected a failure');
      } catch (AuraHandledException e) {
        Assert.isTrue(e.getMessage().contains('too long'), e.getMessage());
      }
    }
  }

  @IsTest
  static void generatingNeedsTheRevquilaUserPermissionSet() {
    Profile standard = [
      SELECT Id
      FROM Profile
      WHERE Name = 'Standard User'
      LIMIT 1
    ];
    User outsider = new User(
      Alias = 'rqnone',
      Email = 'revquila.test@example.com',
      EmailEncodingKey = 'UTF-8',
      LastName = 'Outsider',
      LanguageLocaleKey = 'en_US',
      LocaleSidKey = 'en_US',
      ProfileId = standard.Id,
      TimeZoneSidKey = 'Asia/Kolkata',
      Username = 'revquila.outsider.' +
        Crypto.getRandomInteger() +
        '@example.com'
    );
    insert outsider;
    System.runAs(outsider) {
      try {
        RevquilaDocumentController.saveSnapshot(
          payload(new Map<String, Object>())
        );
        Assert.fail('Expected a failure');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('Revquila User permission set'),
          e.getMessage()
        );
      }
    }
  }
}