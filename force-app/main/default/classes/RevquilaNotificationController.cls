/** The bell on every Revquila page: the current user's notifications. */
public with sharing class RevquilaNotificationController {
  public class Item {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String title;
    @AuraEnabled
    public String detail;
    @AuraEnabled
    public String kind;
    @AuraEnabled
    public Id recordId;
    @AuraEnabled
    public Boolean read;
    @AuraEnabled
    public Datetime occurredOn;
  }

  public class Inbox {
    @AuraEnabled
    public List<Item> items = new List<Item>();
    @AuraEnabled
    public Integer unread = 0;
  }

  @AuraEnabled
  public static Inbox getInbox() {
    try {
      Inbox inbox = new Inbox();
      Id me = UserInfo.getUserId();
      for (Notification__c row : [
        SELECT Id, Title__c, Detail__c, Kind__c, Record_Id__c, Read__c, Occurred_On__c
        FROM Notification__c
        WHERE User__c = :me
        WITH USER_MODE
        ORDER BY Occurred_On__c DESC
        LIMIT 30
      ]) {
        Item item = new Item();
        item.id = row.Id;
        item.title = row.Title__c;
        item.detail = row.Detail__c;
        item.kind = row.Kind__c;
        item.recordId = row.Record_Id__c instanceof Id ? (Id) row.Record_Id__c : null;
        item.read = row.Read__c;
        item.occurredOn = row.Occurred_On__c;
        inbox.items.add(item);
      }
      inbox.unread = [SELECT COUNT() FROM Notification__c WHERE User__c = :me AND Read__c = FALSE WITH USER_MODE];
      return inbox;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }

  /** Marks notifications as read; none named: every one of the user's. */
  @AuraEnabled
  public static void markRead(List<Id> ids) {
    try {
      Id me = UserInfo.getUserId();
      List<Notification__c> rows = ids == null || ids.isEmpty()
        ? [SELECT Id FROM Notification__c WHERE User__c = :me AND Read__c = FALSE WITH USER_MODE LIMIT 500]
        : [SELECT Id FROM Notification__c WHERE User__c = :me AND Id IN :ids WITH USER_MODE];
      for (Notification__c row : rows) {
        row.Read__c = true;
      }
      update as user rows;
    } catch (Exception e) {
      throw RevquilaCore.failure(e);
    }
  }
}