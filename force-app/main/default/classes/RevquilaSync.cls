/**
 * Setup > Salesforce sync: the rules an admin writes to keep the standard sales records in
 * step with Revquila. At a moment (a quote created, submitted, approved, sent or signed, an
 * order activated, an invoice raised or paid) each rule writes one value into one field of the
 * Account, Contact or Opportunity the quote is linked to. The value is a Revquila figure (the
 * quote's net amount, its number, today) or a fixed value the admin typed, such as a stage name.
 *
 * A rule that cannot be applied (a field that does not exist any more, a validation rule on
 * the target) is written to the quote's timeline instead of failing the action.
 */
public with sharing class RevquilaSync {
  public static final String QUOTE_CREATED = RevquilaCore.QUOTE_CREATED;
  public static final String QUOTE_SENT = RevquilaCore.QUOTE_SENT;
  public static final String QUOTE_SIGNED = RevquilaCore.QUOTE_SIGNED;
  public static final String ORDER_ACTIVATED = RevquilaCore.ORDER_ACTIVATED;
  public static final String INVOICE_PAID = RevquilaCore.INVOICE_PAID;

  /** A field of a target object the admin can write to. */
  public class FieldView {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String type;
    @AuraEnabled
    public List<String> options = new List<String>();
  }

  private static final Map<String, SObjectType> TARGETS = new Map<String, SObjectType>{
    'Account' => Account.SObjectType,
    'Contact' => Contact.SObjectType,
    'Opportunity' => Opportunity.SObjectType,
    'Quote' => Quote__c.SObjectType,
    'Invoice' => Invoice__c.SObjectType,
    'Subscription' => Subscription__c.SObjectType,
    'Order' => Order__c.SObjectType,
    'Contract' => Contract__c.SObjectType
  };

  /** The fields of a target the current user may update: name, label, type and picklist values. */
  public static List<FieldView> fields(String target) {
    SObjectType type = TARGETS.get(target);
    if (type == null) {
      throw new RevquilaCore.ProblemException(
        'RevX can write to Account, Contact, Opportunity and its own records.'
      );
    }
    return fieldsOf(type, true);
  }

  /** Every field of a type, updateable ones only when `writable`. */
  public static List<FieldView> fieldsOf(SObjectType type, Boolean writable) {
    List<FieldView> views = new List<FieldView>();
    for (
      Schema.SObjectField field : type.getDescribe().fields.getMap().values()
    ) {
      Schema.DescribeFieldResult describe = field.getDescribe();
      if (!describe.isAccessible()) {
        continue;
      }
      if (writable && (!describe.isUpdateable() || describe.isCalculated())) {
        continue;
      }
      Schema.DisplayType kind = describe.getType();
      if (
        kind == Schema.DisplayType.ID ||
        kind == Schema.DisplayType.ADDRESS ||
        kind == Schema.DisplayType.LOCATION ||
        kind == Schema.DisplayType.BASE64 ||
        (writable && kind == Schema.DisplayType.REFERENCE)
      ) {
        continue;
      }
      FieldView view = new FieldView();
      view.name = describe.getName();
      view.label = describe.getLabel();
      view.type = String.valueOf(kind).toLowerCase();
      if (
        kind == Schema.DisplayType.PICKLIST ||
        kind == Schema.DisplayType.MULTIPICKLIST
      ) {
        for (Schema.PicklistEntry entry : describe.getPicklistValues()) {
          if (entry.isActive() && view.options.size() < 200) {
            view.options.add(entry.getValue());
          }
        }
      }
      views.add(view);
    }
    return views;
  }

  /**
   * Applies every rule of `moment` for a quote. `figures` are the Revquila values a rule can
   * write, by source name: quote.net, quote.total, quote.number, order.number, invoice.number and
   * so on; `today` and `value` are always there.
   */
  public static void fire(
    String moment,
    Quote__c quote,
    Map<String, Object> figures
  ) {
    List<RevquilaSettings.SyncRule> rules = new List<RevquilaSettings.SyncRule>();
    for (
      RevquilaSettings.SyncRule rule : RevquilaSettings.current().syncRules
    ) {
      if (rule.moment == moment) {
        rules.add(rule);
      }
    }
    if (rules.isEmpty()) {
      return;
    }
    Map<String, Id> targetIds = new Map<String, Id>{
      'Account' => quote.Account__c,
      'Contact' => quote.Contact__c,
      'Opportunity' => quote.Opportunity__c,
      'Quote' => quote.Id
    };
    Map<String, SObject> changes = new Map<String, SObject>();
    List<Revenue_Event__c> problems = new List<Revenue_Event__c>();
    for (RevquilaSettings.SyncRule rule : rules) {
      Id targetId = targetIds.get(rule.target);
      SObjectType type = TARGETS.get(rule.target);
      if (targetId == null || type == null) {
        continue;
      }
      try {
        SObject change = changes.get(rule.target);
        if (change == null) {
          change = type.newSObject(targetId);
          changes.put(rule.target, change);
        }
        change.put(
          rule.field,
          convertFor(type, rule.field, valueOf(rule, figures))
        );
      } catch (Exception e) {
        problems.add(
          RevquilaCore.event(
            quote.Id,
            'Sync to ' + rule.target + ' skipped',
            rule.field + ': ' + e.getMessage(),
            RevquilaCore.TONE_WARN
          )
        );
      }
    }
    for (String target : changes.keySet()) {
      try {
        update as user changes.get(target);
      } catch (Exception e) {
        problems.add(
          RevquilaCore.event(
            quote.Id,
            'Sync to ' + target + ' failed',
            e.getMessage(),
            RevquilaCore.TONE_WARN
          )
        );
      }
    }
    insert as user problems;
  }

  private static Object valueOf(
    RevquilaSettings.SyncRule rule,
    Map<String, Object> figures
  ) {
    if (rule.source == null || rule.source == 'value') {
      return rule.value;
    }
    if (rule.source == 'today') {
      return Date.today();
    }
    if (!figures.containsKey(rule.source)) {
      throw new RevquilaCore.ProblemException(
        'RevX has no value called ' + rule.source + ' at this point.'
      );
    }
    return figures.get(rule.source);
  }

  /** The value as the field's type takes it. */
  public static Object convertFor(SObjectType type, String field, Object value) {
    Schema.SObjectField found = type.getDescribe().fields.getMap().get(field);
    if (found == null) {
      throw new RevquilaCore.ProblemException(
        'The field does not exist any more.'
      );
    }
    if (value == null) {
      return null;
    }
    Schema.DisplayType kind = found.getDescribe().getType();
    String text = String.valueOf(value).trim();
    if (
      kind == Schema.DisplayType.CURRENCY ||
      kind == Schema.DisplayType.DOUBLE ||
      kind == Schema.DisplayType.PERCENT
    ) {
      return value instanceof Decimal ? value : Decimal.valueOf(text);
    }
    if (kind == Schema.DisplayType.INTEGER) {
      return value instanceof Decimal
        ? ((Decimal) value).intValue()
        : Integer.valueOf(text);
    }
    if (kind == Schema.DisplayType.BOOLEAN) {
      return value instanceof Boolean
        ? value
        : text.equalsIgnoreCase('true') || text == '1';
    }
    if (kind == Schema.DisplayType.DATE) {
      if (value instanceof Date) {
        return value;
      }
      return value instanceof Datetime
        ? ((Datetime) value).date()
        : Date.valueOf(text);
    }
    if (kind == Schema.DisplayType.DATETIME) {
      if (value instanceof Datetime) {
        return value;
      }
      return value instanceof Date
        ? Datetime.newInstance((Date) value, Time.newInstance(0, 0, 0, 0))
        : Datetime.valueOf(text);
    }
    return text;
  }
}