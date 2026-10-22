/**
 * The one rules engine behind approval rules, product rules, automation rules and the
 * conditions on price rules: a list of conditions ({field, op, value}) is matched against a
 * context, a flat map of what is known about the record (quote.net, quote.country,
 * account.segment, products.families and so on). Every op is written for a non-technical admin:
 * equals, not_equals, contains, not_contains, gt, gte, lt, lte, in, not_in, blank, not_blank.
 */
public with sharing class RevquilaRules {
  /** Whether every condition holds for the context. No conditions: always true. */
  public static Boolean matches(
    List<RevquilaSettings.Condition> conditions,
    Map<String, Object> context
  ) {
    if (conditions == null) {
      return true;
    }
    for (RevquilaSettings.Condition condition : conditions) {
      if (condition == null || String.isBlank(condition.field)) {
        continue;
      }
      if (!holds(condition, context.get(condition.field))) {
        return false;
      }
    }
    return true;
  }

  /** The conditions saved as JSON on a record, or none. */
  public static List<RevquilaSettings.Condition> parse(String saved) {
    if (String.isBlank(saved)) {
      return new List<RevquilaSettings.Condition>();
    }
    try {
      return (List<RevquilaSettings.Condition>) JSON.deserialize(
        saved,
        List<RevquilaSettings.Condition>.class
      );
    } catch (Exception e) {
      return new List<RevquilaSettings.Condition>();
    }
  }

  private static Boolean holds(
    RevquilaSettings.Condition condition,
    Object actual
  ) {
    String op = condition.op == null ? 'equals' : condition.op.toLowerCase();
    String wanted = condition.value == null ? '' : condition.value.trim();
    if (op == 'blank') {
      return isBlank(actual);
    }
    if (op == 'not_blank') {
      return !isBlank(actual);
    }
    // a set in the context (product families, codes) matches when any member does
    if (actual instanceof Set<String>) {
      Set<String> members = (Set<String>) actual;
      Boolean matched = false;
      for (String member : members) {
        if (holdsText(op, member, wanted)) {
          matched = true;
        }
      }
      if (op == 'not_equals' || op == 'not_contains' || op == 'not_in') {
        return members.isEmpty() || !anyPositive(op, members, wanted);
      }
      return matched;
    }
    if (actual instanceof Decimal || actual instanceof Integer) {
      Decimal amount = actual instanceof Integer
        ? Decimal.valueOf((Integer) actual)
        : (Decimal) actual;
      Decimal target;
      try {
        target = Decimal.valueOf(wanted.replaceAll('[^0-9.\\-]', ''));
      } catch (Exception e) {
        return false;
      }
      if (op == 'gt') {
        return amount > target;
      }
      if (op == 'gte') {
        return amount >= target;
      }
      if (op == 'lt') {
        return amount < target;
      }
      if (op == 'lte') {
        return amount <= target;
      }
      if (op == 'not_equals') {
        return amount != target;
      }
      return amount == target;
    }
    if (actual instanceof Boolean) {
      Boolean flag = (Boolean) actual;
      Boolean target = wanted.equalsIgnoreCase('true') || wanted == '1' || wanted.equalsIgnoreCase('yes') || wanted.equalsIgnoreCase('on');
      return op == 'not_equals' ? flag != target : flag == target;
    }
    if (actual instanceof Date) {
      Date day = (Date) actual;
      Date target;
      try {
        target = Date.valueOf(wanted);
      } catch (Exception e) {
        return false;
      }
      if (op == 'gt') {
        return day > target;
      }
      if (op == 'gte') {
        return day >= target;
      }
      if (op == 'lt') {
        return day < target;
      }
      if (op == 'lte') {
        return day <= target;
      }
      if (op == 'not_equals') {
        return day != target;
      }
      return day == target;
    }
    return holdsText(op, actual == null ? '' : String.valueOf(actual), wanted);
  }

  private static Boolean anyPositive(String op, Set<String> members, String wanted) {
    String positive = op.substring(4);
    for (String member : members) {
      if (holdsText(positive, member, wanted)) {
        return true;
      }
    }
    return false;
  }

  private static Boolean holdsText(String op, String actual, String wanted) {
    String have = actual == null ? '' : actual.trim().toLowerCase();
    String want = wanted.toLowerCase();
    if (op == 'equals') {
      return have == want;
    }
    if (op == 'not_equals') {
      return have != want;
    }
    if (op == 'contains') {
      return have.contains(want);
    }
    if (op == 'not_contains') {
      return !have.contains(want);
    }
    if (op == 'starts_with') {
      return have.startsWith(want);
    }
    if (op == 'in' || op == 'not_in') {
      Boolean found = false;
      for (String option : want.split(',')) {
        if (option.trim() == have) {
          found = true;
        }
      }
      return op == 'in' ? found : !found;
    }
    // a amount op on text: compare as numbers when both are
    try {
      Decimal amount = Decimal.valueOf(have);
      Decimal target = Decimal.valueOf(want);
      if (op == 'gt') {
        return amount > target;
      }
      if (op == 'gte') {
        return amount >= target;
      }
      if (op == 'lt') {
        return amount < target;
      }
      if (op == 'lte') {
        return amount <= target;
      }
    } catch (Exception e) {
      return false;
    }
    return false;
  }

  private static Boolean isBlank(Object actual) {
    if (actual == null) {
      return true;
    }
    if (actual instanceof String) {
      return String.isBlank((String) actual);
    }
    if (actual instanceof Set<String>) {
      return ((Set<String>) actual).isEmpty();
    }
    return false;
  }

  /** The fields a rule can look at, with a label and a kind, for the Setup rule builder. */
  public class ContextField {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String kind; // text | amount | boolean | set | date
    public ContextField(String name, String label, String kind) {
      this.name = name;
      this.label = label;
      this.kind = kind;
    }
  }

  public static List<ContextField> contextFields() {
    return new List<ContextField>{
      new ContextField('quote.net', 'Quote net amount (home currency)', 'number'),
      new ContextField('quote.total', 'Quote total with tax', 'number'),
      new ContextField('quote.maxDiscount', 'Highest line discount %', 'number'),
      new ContextField('quote.margin', 'Margin %', 'number'),
      new ContextField('quote.terms', 'Payment terms', 'text'),
      new ContextField('quote.termMonths', 'Term in months', 'number'),
      new ContextField('quote.country', 'Country', 'text'),
      new ContextField('quote.region', 'Region / state', 'text'),
      new ContextField('quote.type', 'Quote type (new, amendment, renewal)', 'text'),
      new ContextField('quote.lineCount', 'Number of lines', 'number'),
      new ContextField('quote.recurring', 'Has recurring products', 'boolean'),
      new ContextField('quote.hasCustom', 'Has custom items', 'boolean'),
      new ContextField('quote.priceEdited', 'A unit price was edited', 'boolean'),
      new ContextField('account.name', 'Account name', 'text'),
      new ContextField('account.segment', 'Account segment', 'text'),
      new ContextField('account.industry', 'Account industry', 'text'),
      new ContextField('products.families', 'Product families on the quote', 'set'),
      new ContextField('products.codes', 'Product codes on the quote', 'set'),
      new ContextField('products.names', 'Product names on the quote', 'set'),
      new ContextField('owner.name', 'Quote owner', 'text'),
      new ContextField('owner.role', 'Owner role', 'text'),
      new ContextField('invoice.total', 'Invoice total', 'number'),
      new ContextField('invoice.daysOverdue', 'Days overdue', 'number'),
      new ContextField('subscription.mrr', 'Subscription MRR', 'number')
    };
  }
}