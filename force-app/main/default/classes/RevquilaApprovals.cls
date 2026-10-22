/**
 * Approval chains. Setup > Approvals holds rules: when the conditions of a rule hold for a
 * quote, its steps are added to the chain, in order. A step names who decides: anyone with a
 * custom permission, one user, the quote owner's manager, or a role. Steps of the same number
 * are decided in parallel. In simple mode (the default) there is one step, for anyone with the
 * approve permission. A delegate in Setup decides for the person they stand in for.
 */
public with sharing class RevquilaApprovals {
  public static final String WAITING = 'waiting';
  public static final String PENDING = 'pending';
  public static final String APPROVED = 'approved';
  public static final String REJECTED = 'rejected';
  public static final String SKIPPED = 'skipped';
  public static final String RECALLED = 'recalled';

  public class StepView {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public Integer step;
    @AuraEnabled
    public String rule;
    @AuraEnabled
    public String approver;
    @AuraEnabled
    public Id approverId;
    @AuraEnabled
    public String kind;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public Datetime decidedOn;
    @AuraEnabled
    public String decidedBy;
    @AuraEnabled
    public String comment;
    @AuraEnabled
    public Boolean mine;
  }

  private static final String FIELDS =
    'Id, Quote__c, Step__c, Rule_Name__c, Approver__c, Approver__r.Name, Approver_Kind__c, Status__c, ' +
    'Decided_On__c, Decided_By__r.Name, Comment__c, Parallel__c';

  /**
   * Starts the chain for a quote: the steps of every matching rule, or the one simple step.
   * Replaces whatever chain the quote had. Returns the steps that are pending now.
   */
  public static List<Approval_Step__c> start(
    Quote__c quote,
    Map<String, Object> facts
  ) {
    RevquilaSettings settings = RevquilaSettings.current();
    delete as user [
      SELECT Id
      FROM Approval_Step__c
      WHERE Quote__c = :quote.Id
      WITH USER_MODE
    ];
    List<Approval_Step__c> steps = new List<Approval_Step__c>();
    Integer position = 0;
    if (settings.approvalsMode == 'rules') {
      for (RevquilaSettings.ApprovalRule rule : settings.approvalRules) {
        if (rule.active == false || rule.steps == null || rule.steps.isEmpty()) {
          continue;
        }
        if (!RevquilaRules.matches(rule.conditions, facts)) {
          continue;
        }
        Integer parallelNumber;
        for (RevquilaSettings.ApprovalStepDef def : rule.steps) {
          if (def.isParallel == true && parallelNumber != null) {
            steps.add(step(quote, parallelNumber, rule.name, def));
          } else {
            position++;
            parallelNumber = position;
            steps.add(step(quote, position, rule.name, def));
          }
        }
      }
    }
    if (steps.isEmpty()) {
      RevquilaSettings.ApprovalStepDef simple = new RevquilaSettings.ApprovalStepDef();
      simple.approver = 'permission:' + settings.permissions.get('approve');
      simple.label = 'Approver';
      steps.add(step(quote, 1, 'Pricing policy', simple));
    }
    List<Approval_Step__c> firstSteps = new List<Approval_Step__c>();
    for (Approval_Step__c row : steps) {
      if (row.Step__c == 1) {
        row.Status__c = PENDING;
        firstSteps.add(row);
      }
    }
    insert as user steps;
    return firstSteps;
  }

  private static Approval_Step__c step(
    Quote__c quote,
    Integer position,
    String ruleName,
    RevquilaSettings.ApprovalStepDef def
  ) {
    Approval_Step__c row = new Approval_Step__c(
      Quote__c = quote.Id,
      Step__c = position,
      Rule_Name__c = ruleName == null ? null : ruleName.abbreviate(120),
      Status__c = WAITING,
      Parallel__c = def.isParallel == true
    );
    String spec = def.approver == null ? '' : def.approver.trim();
    if (spec.startsWith('user:') && spec.substringAfter('user:') instanceof Id) {
      row.Approver__c = (Id) spec.substringAfter('user:');
      row.Approver_Kind__c = 'user';
    } else if (spec == 'manager') {
      Id managerId = managerOf(quote.OwnerId);
      if (managerId != null) {
        row.Approver__c = managerId;
        row.Approver_Kind__c = 'manager';
      } else {
        row.Approver_Kind__c = 'permission:' + RevquilaSettings.current().permissions.get('approve');
      }
    } else if (spec.startsWith('role:') || spec.startsWith('permission:')) {
      row.Approver_Kind__c = spec.abbreviate(80);
    } else {
      row.Approver_Kind__c = 'permission:' + RevquilaSettings.current().permissions.get('approve');
    }
    return row;
  }

  private static Id managerOf(Id userId) {
    if (userId == null) {
      return null;
    }
    List<User> users = [SELECT ManagerId FROM User WHERE Id = :userId LIMIT 1];
    return users.isEmpty() ? null : users[0].ManagerId;
  }

  /** The chain of a quote, first step first. */
  public static List<StepView> steps(Id quoteId) {
    List<StepView> views = new List<StepView>();
    for (
      Approval_Step__c row : (List<Approval_Step__c>) Database.query(
        'SELECT ' + FIELDS + ' FROM Approval_Step__c WHERE Quote__c = :quoteId ORDER BY Step__c, Name',
        AccessLevel.USER_MODE
      )
    ) {
      views.add(view(row));
    }
    return views;
  }

  public static StepView view(Approval_Step__c row) {
    StepView view = new StepView();
    view.id = row.Id;
    view.step = RevquilaCore.orZero(row.Step__c).intValue();
    view.rule = row.Rule_Name__c;
    view.approverId = row.Approver__c;
    view.kind = row.Approver_Kind__c;
    view.approver = describe(row);
    view.status = row.Status__c;
    view.decidedOn = row.Decided_On__c;
    view.decidedBy = row.Decided_By__r?.Name;
    view.comment = row.Comment__c;
    view.mine = row.Status__c == PENDING && canDecide(row);
    return view;
  }

  private static String describe(Approval_Step__c row) {
    if (row.Approver__c != null) {
      return row.Approver__r?.Name + (row.Approver_Kind__c == 'manager' ? ' (manager)' : '');
    }
    String kind = row.Approver_Kind__c == null ? '' : row.Approver_Kind__c;
    if (kind.startsWith('permission:')) {
      return 'Anyone with ' + kind.substringAfter('permission:').replace('_', ' ');
    }
    if (kind.startsWith('role:')) {
      return 'Role: ' + kind.substringAfter('role:');
    }
    return 'An approver';
  }

  /** Whether the current user may decide a step: its approver, their delegate, or the permission or role it names. */
  public static Boolean canDecide(Approval_Step__c row) {
    Id me = UserInfo.getUserId();
    RevquilaSettings settings = RevquilaSettings.current();
    if (row.Approver__c != null) {
      if (row.Approver__c == me) {
        return true;
      }
      // a delegate decides for the person they stand in for
      return settings.delegates.get(row.Approver__c) == me;
    }
    String kind = row.Approver_Kind__c == null ? '' : row.Approver_Kind__c;
    if (kind.startsWith('permission:')) {
      return RevquilaCore.hasPermission(kind.substringAfter('permission:')) || RevquilaCore.isAdmin();
    }
    if (kind.startsWith('role:')) {
      String role = kind.substringAfter('role:');
      Id roleId = UserInfo.getUserRoleId();
      if (roleId == null) {
        return RevquilaCore.isAdmin();
      }
      List<UserRole> roles = [SELECT Name, DeveloperName FROM UserRole WHERE Id = :roleId LIMIT 1];
      return !roles.isEmpty() && (roles[0].Name.equalsIgnoreCase(role) || roles[0].DeveloperName.equalsIgnoreCase(role));
    }
    return RevquilaCore.canApprove();
  }

  /** Whether the user may decide something on the quote right now. */
  public static Boolean canDecide(Id quoteId) {
    for (Approval_Step__c row : pending(quoteId)) {
      if (canDecide(row)) {
        return true;
      }
    }
    return false;
  }

  private static List<Approval_Step__c> pending(Id quoteId) {
    return (List<Approval_Step__c>) Database.query(
      'SELECT ' + FIELDS + ' FROM Approval_Step__c WHERE Quote__c = :quoteId AND Status__c = \'' + PENDING + '\' ORDER BY Step__c, Name',
      AccessLevel.USER_MODE
    );
  }

  /** What a decision did: whether the chain is now complete, and who is up next. */
  public class Outcome {
    public Boolean complete = false;
    public Boolean rejected = false;
    public List<Approval_Step__c> next = new List<Approval_Step__c>();
    public String stepLabel;
  }

  /**
   * Approves or rejects the pending step(s) the user may decide. A rejection ends the chain;
   * an approval moves it to the next step, or completes it when there is none.
   */
  public static Outcome decide(Id quoteId, Boolean approve, String note) {
    List<Approval_Step__c> pendingSteps = pending(quoteId);
    RevquilaCore.need(!pendingSteps.isEmpty(), 'This quote is not waiting for approval.');
    List<Approval_Step__c> mine = new List<Approval_Step__c>();
    for (Approval_Step__c row : pendingSteps) {
      if (canDecide(row)) {
        mine.add(row);
      }
    }
    RevquilaCore.need(
      !mine.isEmpty(),
      'This step is for ' + describe(pendingSteps[0]) + ', not for you.'
    );
    Outcome outcome = new Outcome();
    outcome.stepLabel = 'Step ' + RevquilaCore.orZero(mine[0].Step__c).intValue() + (mine[0].Rule_Name__c == null ? '' : ' · ' + mine[0].Rule_Name__c);
    List<Approval_Step__c> changes = new List<Approval_Step__c>();
    for (Approval_Step__c row : mine) {
      changes.add(
        new Approval_Step__c(
          Id = row.Id,
          Status__c = approve ? APPROVED : REJECTED,
          Decided_On__c = System.now(),
          Decided_By__c = UserInfo.getUserId(),
          Comment__c = String.isBlank(note) ? null : note.trim().abbreviate(255)
        )
      );
    }
    if (!approve) {
      outcome.rejected = true;
      outcome.complete = true;
      for (Approval_Step__c row : [
        SELECT Id
        FROM Approval_Step__c
        WHERE Quote__c = :quoteId AND Status__c IN (:WAITING, :PENDING) AND Id NOT IN :mine
        WITH USER_MODE
      ]) {
        changes.add(new Approval_Step__c(Id = row.Id, Status__c = SKIPPED));
      }
      update as user changes;
      return outcome;
    }
    update as user changes;
    // other approvers of a parallel step still have to decide
    if (!pending(quoteId).isEmpty()) {
      return outcome;
    }
    List<Approval_Step__c> queued = (List<Approval_Step__c>) Database.query(
      'SELECT ' + FIELDS + ' FROM Approval_Step__c WHERE Quote__c = :quoteId AND Status__c = \'' + WAITING + '\' ORDER BY Step__c, Name',
      AccessLevel.USER_MODE
    );
    if (queued.isEmpty()) {
      outcome.complete = true;
      return outcome;
    }
    Decimal nextNumber = queued[0].Step__c;
    List<Approval_Step__c> promoted = new List<Approval_Step__c>();
    for (Approval_Step__c row : queued) {
      if (row.Step__c == nextNumber) {
        promoted.add(new Approval_Step__c(Id = row.Id, Status__c = PENDING));
        row.Status__c = PENDING;
        outcome.next.add(row);
      }
    }
    update as user promoted;
    return outcome;
  }

  /** Takes a quote back from its approvers: every open step is recalled. */
  public static void recall(Id quoteId) {
    List<Approval_Step__c> changes = new List<Approval_Step__c>();
    for (Approval_Step__c row : [
      SELECT Id
      FROM Approval_Step__c
      WHERE Quote__c = :quoteId AND Status__c IN (:WAITING, :PENDING)
      WITH USER_MODE
    ]) {
      changes.add(new Approval_Step__c(Id = row.Id, Status__c = RECALLED));
    }
    update as user changes;
  }

  /** The users who should hear that these steps are pending: named approvers, their delegates, or everyone with the permission. */
  public static Set<Id> approversOf(List<Approval_Step__c> steps) {
    Set<Id> users = new Set<Id>();
    Set<String> permissions = new Set<String>();
    Set<String> roles = new Set<String>();
    RevquilaSettings settings = RevquilaSettings.current();
    for (Approval_Step__c row : steps) {
      if (row.Approver__c != null) {
        users.add(row.Approver__c);
        Id delegate = settings.delegates.get(row.Approver__c);
        if (delegate != null) {
          users.add(delegate);
        }
      } else if (row.Approver_Kind__c != null && row.Approver_Kind__c.startsWith('permission:')) {
        permissions.add(row.Approver_Kind__c.substringAfter('permission:'));
      } else if (row.Approver_Kind__c != null && row.Approver_Kind__c.startsWith('role:')) {
        roles.add(row.Approver_Kind__c.substringAfter('role:'));
      }
    }
    if (!permissions.isEmpty()) {
      users.addAll(usersWithPermission(permissions));
    }
    if (!roles.isEmpty()) {
      for (User person : [
        SELECT Id
        FROM User
        WHERE IsActive = TRUE AND (UserRole.Name IN :roles OR UserRole.DeveloperName IN :roles)
        LIMIT 200
      ]) {
        users.add(person.Id);
      }
    }
    return users;
  }

  /** Active users holding a permission set that grants any of these custom permissions. */
  public static Set<Id> usersWithPermission(Set<String> names) {
    Set<Id> users = new Set<Id>();
    try {
      Set<Id> permissionIds = new Set<Id>();
      for (CustomPermission permission : [
        SELECT Id
        FROM CustomPermission
        WHERE DeveloperName IN :names
      ]) {
        permissionIds.add(permission.Id);
      }
      if (permissionIds.isEmpty()) {
        return users;
      }
      Set<Id> permissionSetIds = new Set<Id>();
      for (SetupEntityAccess access : [
        SELECT ParentId
        FROM SetupEntityAccess
        WHERE SetupEntityId IN :permissionIds
      ]) {
        permissionSetIds.add(access.ParentId);
      }
      for (PermissionSetAssignment assignment : [
        SELECT AssigneeId
        FROM PermissionSetAssignment
        WHERE PermissionSetId IN :permissionSetIds AND Assignee.IsActive = TRUE
        LIMIT 500
      ]) {
        users.add(assignment.AssigneeId);
      }
    } catch (Exception e) {
      RevquilaCore.log('approvals', 'usersWithPermission', 'failed', null, e.getMessage(), null);
    }
    return users;
  }

  /** The quotes with a step the current user may decide right now. */
  public static Set<Id> quotesForMe() {
    Set<Id> quotes = new Set<Id>();
    for (
      Approval_Step__c row : (List<Approval_Step__c>) Database.query(
        'SELECT ' + FIELDS + ' FROM Approval_Step__c WHERE Status__c = \'' + PENDING + '\' LIMIT 500',
        AccessLevel.USER_MODE
      )
    ) {
      if (canDecide(row)) {
        quotes.add(row.Quote__c);
      }
    }
    return quotes;
  }
}