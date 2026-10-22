/**
 * What every Revquila controller shares: the error it throws, the timeline it writes to,
 * the line and event shapes it returns to the screens, who may do what, display numbers,
 * notifications, the integration log and the platform event.
 */
public with sharing class RevquilaCore {
  /** Something the user can fix. Its message is shown to them as it is. */
  public class ProblemException extends Exception {
  }

  /** One line of a quote, an order or an invoice, as the screens show it. */
  public class LineView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Id productId;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String unit;
    @AuraEnabled
    public Decimal price;
    @AuraEnabled
    public Decimal qty;
    @AuraEnabled
    public Decimal discount;
    @AuraEnabled
    public Decimal listAmount;
    @AuraEnabled
    public Decimal net;
    @AuraEnabled
    public Boolean recurring;
    /** The discount a price rule added for the quantity, on top of `discount`. */
    @AuraEnabled
    public Decimal ruleDiscount = 0;
    @AuraEnabled
    public Id bundleId;
    @AuraEnabled
    public String bundleName;
    @AuraEnabled
    public String groupName;
    @AuraEnabled
    public Boolean optional = false;
    @AuraEnabled
    public String segment;
    @AuraEnabled
    public Integer termMonths;
    @AuraEnabled
    public Date startDate;
    @AuraEnabled
    public Date endDate;
    /** The configuration attributes picked, as JSON: [{name, value, adjust}]. */
    @AuraEnabled
    public String attributes;
    @AuraEnabled
    public Decimal unitCost = 0;
    @AuraEnabled
    public String pricingMethod;
    @AuraEnabled
    public String feature;
    @AuraEnabled
    public Boolean usageBased = false;
    @AuraEnabled
    public String priceSource;
    @AuraEnabled
    public String family;
  }

  /** One entry on a record's timeline. */
  public class EventView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String title;
    @AuraEnabled
    public String detail;
    @AuraEnabled
    public String tone;
    @AuraEnabled
    public String kind;
    @AuraEnabled
    public Datetime occurredOn;
    @AuraEnabled
    public Date dateValue;
    @AuraEnabled
    public Decimal numberValue;
    @AuraEnabled
    public String movement;
  }

  public static final String TONE_ACCENT = 'acc';
  public static final String TONE_GOOD = 'good';
  public static final String TONE_WARN = 'warn';
  public static final String TONE_BAD = 'bad';
  public static final String TONE_TEAL = 'teal';

  // the lifecycle moments automation, sync and the platform event fire at
  public static final String QUOTE_CREATED = 'quote_created';
  public static final String QUOTE_SUBMITTED = 'quote_submitted';
  public static final String QUOTE_APPROVED = 'quote_approved';
  public static final String QUOTE_REJECTED = 'quote_rejected';
  public static final String QUOTE_SENT = 'quote_sent';
  public static final String QUOTE_SIGNED = 'quote_signed';
  public static final String QUOTE_EXPIRED = 'quote_expired';
  public static final String ORDER_ACTIVATED = 'order_activated';
  public static final String INVOICE_RAISED = 'invoice_raised';
  public static final String INVOICE_SENT = 'invoice_sent';
  public static final String INVOICE_OVERDUE = 'invoice_overdue';
  public static final String INVOICE_PAID = 'invoice_paid';
  public static final String PAYMENT_RECEIVED = 'payment_received';
  public static final String SUBSCRIPTION_CHANGED = 'subscription_changed';
  public static final String SUBSCRIPTION_CANCELLED = 'subscription_cancelled';
  public static final String RENEWAL_DUE = 'renewal_due';
  public static final String CONTRACT_EXPIRED = 'contract_expired';

  /** The error an @AuraEnabled method throws so the screen can show the message. */
  public static AuraHandledException failure(String message) {
    AuraHandledException e = new AuraHandledException(message);
    e.setMessage(message);
    return e;
  }

  /** Turns anything a controller caught into an error the screen can show. */
  public static AuraHandledException failure(Exception e) {
    if (e instanceof AuraHandledException) {
      return (AuraHandledException) e;
    }
    if (e instanceof ProblemException) {
      return failure(e.getMessage());
    }
    if (e instanceof DmlException) {
      return failure(((DmlException) e).getDmlMessage(0));
    }
    if (e instanceof QueryException || e instanceof SecurityException) {
      return failure(
        'You do not have access to do that. Ask an admin for the RevX User permission set.'
      );
    }
    return failure('Something went wrong: ' + e.getMessage());
  }

  public static void need(Boolean condition, String message) {
    if (condition != true) {
      throw new ProblemException(message);
    }
  }

  // ---------------------------------------------------------------- who may do what

  /** The namespace prefix custom permissions and components carry in this org, with the two underscores. */
  public static String prefix() {
    String className = RevquilaCore.class.getName();
    return className.contains('.') ? className.substringBefore('.') + '__' : '';
  }

  /** Whether the user has a Revquila custom permission, by its bare name. */
  public static Boolean hasPermission(String name) {
    if (String.isBlank(name)) {
      return true;
    }
    return FeatureManagement.checkPermission(prefix() + name);
  }

  /** Whether the user may do an action, by the permission Setup maps it to. An admin may do everything. */
  public static Boolean allowed(String action) {
    if (isAdmin()) {
      return true;
    }
    return hasPermission(RevquilaSettings.current().permissions.get(action));
  }

  /** Someone who can publish settings: the Revquila Admin permission set. */
  public static Boolean isAdmin() {
    return Schema.sObjectType.Config_Version__c.isCreateable();
  }

  /** Approving and rejecting quotes takes the permission Setup maps to `approve`. */
  public static Boolean canApprove() {
    return allowed('approve');
  }

  /** The permissions the current user holds, for the screens. */
  public static Map<String, Boolean> grants() {
    Map<String, Boolean> grants = new Map<String, Boolean>();
    for (String action : RevquilaSettings.current().permissions.keySet()) {
      grants.put(action, allowed(action));
    }
    grants.put('admin', isAdmin());
    return grants;
  }

  // ---------------------------------------------------------------- timeline

  /** A timeline entry for a quote, an invoice, an order, a contract or a subscription. Not inserted: the caller inserts them together. */
  public static Revenue_Event__c event(
    Id parentId,
    String title,
    String detail,
    String tone
  ) {
    Revenue_Event__c entry = new Revenue_Event__c(
      Title__c = title == null ? null : title.abbreviate(255),
      Detail__c = String.isBlank(detail) ? null : detail.abbreviate(255),
      Tone__c = tone,
      Occurred_On__c = System.now()
    );
    SObjectType parent = parentId.getSobjectType();
    if (parent == Quote__c.SObjectType) {
      entry.Quote__c = parentId;
    } else if (parent == Invoice__c.SObjectType) {
      entry.Invoice__c = parentId;
    } else if (parent == Order__c.SObjectType) {
      entry.Order__c = parentId;
    } else if (parent == Contract__c.SObjectType) {
      entry.Contract__c = parentId;
    } else {
      entry.Subscription__c = parentId;
    }
    return entry;
  }

  public static List<EventView> eventViews(List<Revenue_Event__c> rows) {
    List<EventView> views = new List<EventView>();
    for (Revenue_Event__c row : rows) {
      EventView view = new EventView();
      view.id = row.Id;
      view.title = row.Title__c;
      view.detail = row.Detail__c;
      view.tone = row.Tone__c;
      view.kind = row.Kind__c;
      view.occurredOn = row.Occurred_On__c;
      view.dateValue = row.Date_Value__c;
      view.numberValue = row.Number_Value__c;
      view.movement = row.Movement__c;
      views.add(view);
    }
    return views;
  }

  /** The timeline of one record, newest first. */
  public static List<EventView> eventsOf(String field, Id parentId) {
    return eventViews(
      (List<Revenue_Event__c>) Database.query(
        'SELECT Id, Title__c, Detail__c, Tone__c, Kind__c, Occurred_On__c, Date_Value__c, Number_Value__c, Movement__c ' +
          'FROM Revenue_Event__c WHERE ' +
          field +
          ' = :parentId ORDER BY Occurred_On__c DESC, Name DESC LIMIT 200',
        AccessLevel.USER_MODE
      )
    );
  }

  // ---------------------------------------------------------------- numbers and money

  public static Decimal orZero(Decimal value) {
    return value == null ? 0 : value;
  }

  public static Decimal money(Decimal value) {
    return orZero(value).setScale(2, RoundingMode.HALF_UP);
  }

  /** An exchange rate as saved: 1 when the record predates currencies. */
  public static Decimal rate(Decimal value) {
    return value == null || value <= 0 ? 1 : value;
  }

  /** An amount in a record's currency, in the home currency. */
  public static Decimal toBase(Decimal amount, Decimal exchangeRate) {
    return money(orZero(amount) / rate(exchangeRate));
  }

  /** The share of `amount` that `from`..`to` is of `periodStart`..`periodEnd`, by days. */
  public static Decimal prorate(
    Decimal amount,
    Date fromDay,
    Date toDay,
    Date periodStart,
    Date periodEnd
  ) {
    Integer periodDays = Math.max(1, periodStart.daysBetween(periodEnd) + 1);
    Integer days = Math.max(0, fromDay.daysBetween(toDay) + 1);
    return money(orZero(amount) * Math.min(days, periodDays) / periodDays);
  }

  /** A date as a timeline entry words it, the same for every user: 30 Oct 2026. */
  public static String dayText(Date value) {
    return Datetime.newInstance(value.year(), value.month(), value.day())
      .format('d MMM yyyy');
  }

  /** The number a record shows: Setup's numbering over the auto-number. Written straight after insert. */
  public static String stampNumber(SObject record, String kind) {
    Id recordId = record.Id;
    String autoNumber = String.valueOf(
      Database.query(
          'SELECT Name FROM ' +
            String.valueOf(recordId.getSobjectType()) +
            ' WHERE Id = :recordId',
          AccessLevel.SYSTEM_MODE
        )[0]
        .get('Name')
    );
    String shown = RevquilaSettings.current().displayNumber(kind, autoNumber);
    SObject change = recordId.getSobjectType().newSObject(recordId);
    change.put('Display_Number__c', shown);
    update as user change;
    record.put('Display_Number__c', shown);
    return shown;
  }

  /** The number a record shows: its display number when stamped, else its auto-number. */
  public static String shownNumber(SObject record) {
    Object shown = record.get('Display_Number__c');
    return shown instanceof String && String.isNotBlank((String) shown)
      ? (String) shown
      : (String) record.get('Name');
  }

  /** A random token for a portal link. */
  public static String token() {
    return EncodingUtil.convertToHex(Crypto.generateAesKey(128)).left(32);
  }

  // ---------------------------------------------------------------- notifications, log, event

  /** In-app notifications for users. Inserted at once; nothing when the setting is off. */
  public static void notify(
    Set<Id> userIds,
    String kind,
    String title,
    String detail,
    Id recordId
  ) {
    RevquilaSettings settings = RevquilaSettings.current();
    if (!settings.notifyInApp || !settings.notifies(kind) || userIds == null) {
      return;
    }
    List<Notification__c> rows = new List<Notification__c>();
    for (Id userId : userIds) {
      if (userId == null) {
        continue;
      }
      rows.add(
        new Notification__c(
          User__c = userId,
          Kind__c = kind,
          Title__c = title == null ? null : title.abbreviate(255),
          Detail__c = detail == null ? null : detail.abbreviate(255),
          Record_Id__c = recordId,
          Occurred_On__c = System.now()
        )
      );
    }
    if (!rows.isEmpty()) {
      Database.insert(rows, false, AccessLevel.SYSTEM_MODE);
    }
  }

  /** One line in the integration log. Never throws. */
  public static void log(
    String kind,
    String target,
    String status,
    String request,
    String response,
    Id recordId
  ) {
    try {
      Database.insert(
        new Integration_Log__c(
          Kind__c = kind,
          Target__c = target == null ? null : target.abbreviate(255),
          Status__c = status,
          Request__c = request == null ? null : request.abbreviate(32000),
          Response__c = response == null ? null : response.abbreviate(32000),
          Record_Id__c = recordId,
          Occurred_On__c = System.now()
        ),
        false,
        AccessLevel.SYSTEM_MODE
      );
    } catch (Exception e) {
      System.debug(LoggingLevel.WARN, 'Revquila log failed: ' + e.getMessage());
    }
  }

  /** Publishes the platform event for a moment, so Flows and outside systems can react. */
  public static void publish(String kind, Id recordId, Map<String, Object> payload) {
    try {
      EventBus.publish(
        new Revquila_Event__e(
          Kind__c = kind,
          Record_Id__c = recordId,
          Payload__c = JSON.serialize(payload)
        )
      );
    } catch (Exception e) {
      System.debug(LoggingLevel.WARN, 'Revquila event failed: ' + e.getMessage());
    }
  }

  // ---------------------------------------------------------------- screens: extra fields

  /** The admin's extra fields for a screen that exist on the object and the user can read, as a SOQL fragment. */
  public static List<String> extraFields(String screen, SObjectType type) {
    List<String> names = new List<String>();
    List<String> wanted = RevquilaSettings.current().layouts.get(screen);
    if (wanted == null) {
      return names;
    }
    Map<String, Schema.SObjectField> fields = type.getDescribe()
      .fields.getMap();
    for (String name : wanted) {
      Schema.SObjectField field = fields.get(name);
      if (field != null && field.getDescribe().isAccessible()) {
        names.add(field.getDescribe().getName());
      }
    }
    return names;
  }

  /** The values of the extra fields on a row, as text, for the screens. */
  public static Map<String, String> extraValues(SObject row, List<String> names) {
    Map<String, String> values = new Map<String, String>();
    for (String name : names) {
      Object value = row.get(name);
      String text = '';
      if (value instanceof Date) {
        text = dayText((Date) value);
      } else if (value instanceof Datetime) {
        text = ((Datetime) value).format('d MMM yyyy HH:mm');
      } else if (value != null) {
        text = String.valueOf(value);
      }
      values.put(name, text);
    }
    return values;
  }
}