@IsTest
private class RevquilaRulesCoverageTest {
  @IsTest
  static void testRulesEngineAllBranches() {
    // 1. Null / empty conditions
    Assert.isTrue(RevquilaRules.matches(null, new Map<String, Object>()));
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>(), new Map<String, Object>()));

    // Condition with blank field is ignored
    RevquilaSettings.Condition blankCond = new RevquilaSettings.Condition();
    blankCond.field = '';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ blankCond }, new Map<String, Object>()));

    // 2. Parse method
    Assert.areEqual(0, RevquilaRules.parse(null).size());
    Assert.areEqual(0, RevquilaRules.parse('').size());
    Assert.areEqual(0, RevquilaRules.parse('not-a-valid-json').size());
    List<RevquilaSettings.Condition> parsed = RevquilaRules.parse('[{"field":"quote.net","op":"gt","value":"1000"}]');
    Assert.areEqual(1, parsed.size());

    // 3. Context Fields
    List<RevquilaRules.ContextField> fields = RevquilaRules.contextFields();
    Assert.isFalse(fields.isEmpty());

    // 4. Blank & Not Blank operators
    RevquilaSettings.Condition cBlank = new RevquilaSettings.Condition();
    cBlank.field = 'val';
    cBlank.op = 'blank';

    RevquilaSettings.Condition cNotBlank = new RevquilaSettings.Condition();
    cNotBlank.field = 'val';
    cNotBlank.op = 'not_blank';

    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cBlank }, new Map<String, Object>{ 'val' => null }));
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cBlank }, new Map<String, Object>{ 'val' => '   ' }));
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cBlank }, new Map<String, Object>{ 'val' => new Set<String>() }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cBlank }, new Map<String, Object>{ 'val' => 'hello' }));
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNotBlank }, new Map<String, Object>{ 'val' => 'hello' }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNotBlank }, new Map<String, Object>{ 'val' => null }));

    // 5. Set<String> actual
    RevquilaSettings.Condition cSet = new RevquilaSettings.Condition();
    cSet.field = 'families';
    cSet.op = 'contains';
    cSet.value = 'software';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cSet }, new Map<String, Object>{ 'families' => new Set<String>{ 'enterprise software', 'hardware' } }));

    cSet.op = 'not_contains';
    cSet.value = 'cloud';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cSet }, new Map<String, Object>{ 'families' => new Set<String>{ 'enterprise software', 'hardware' } }));

    cSet.op = 'not_equals';
    cSet.value = 'cloud';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cSet }, new Map<String, Object>{ 'families' => new Set<String>{ 'enterprise software', 'hardware' } }));
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cSet }, new Map<String, Object>{ 'families' => new Set<String>() }));

    cSet.op = 'not_in';
    cSet.value = 'cloud,saas';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cSet }, new Map<String, Object>{ 'families' => new Set<String>{ 'hardware' } }));

    // 6. Decimal & Integer actual
    RevquilaSettings.Condition cNum = new RevquilaSettings.Condition();
    cNum.field = 'num';
    
    // gt
    cNum.op = 'gt';
    cNum.value = '100';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 150 }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 50.0 }));

    // gte
    cNum.op = 'gte';
    cNum.value = '100';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 100 }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 99 }));

    // lt
    cNum.op = 'lt';
    cNum.value = '100';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 50 }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 100 }));

    // lte
    cNum.op = 'lte';
    cNum.value = '100';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 100 }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 101 }));

    // not_equals & equals
    cNum.op = 'not_equals';
    cNum.value = '100';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 101 }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 100 }));

    cNum.op = 'equals';
    cNum.value = '100';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 100 }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 99 }));

    // invalid number
    cNum.value = 'invalid';
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cNum }, new Map<String, Object>{ 'num' => 100 }));

    // 7. Boolean actual
    RevquilaSettings.Condition cBool = new RevquilaSettings.Condition();
    cBool.field = 'flag';
    cBool.op = 'equals';
    cBool.value = 'yes';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cBool }, new Map<String, Object>{ 'flag' => true }));
    cBool.value = 'false';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cBool }, new Map<String, Object>{ 'flag' => false }));
    cBool.op = 'not_equals';
    cBool.value = 'on';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cBool }, new Map<String, Object>{ 'flag' => false }));

    // 8. Date actual
    RevquilaSettings.Condition cDate = new RevquilaSettings.Condition();
    cDate.field = 'day';
    Date today = Date.today();
    cDate.value = String.valueOf(today);

    cDate.op = 'equals';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cDate }, new Map<String, Object>{ 'day' => today }));

    cDate.op = 'not_equals';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cDate }, new Map<String, Object>{ 'day' => today.addDays(1) }));

    cDate.op = 'gt';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cDate }, new Map<String, Object>{ 'day' => today.addDays(1) }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cDate }, new Map<String, Object>{ 'day' => today.addDays(-1) }));

    cDate.op = 'gte';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cDate }, new Map<String, Object>{ 'day' => today }));

    cDate.op = 'lt';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cDate }, new Map<String, Object>{ 'day' => today.addDays(-1) }));

    cDate.op = 'lte';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cDate }, new Map<String, Object>{ 'day' => today }));

    cDate.value = 'not-a-date';
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cDate }, new Map<String, Object>{ 'day' => today }));

    // 9. String / Text actual
    RevquilaSettings.Condition cStr = new RevquilaSettings.Condition();
    cStr.field = 'str';

    cStr.op = 'equals';
    cStr.value = 'hello';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => 'hello' }));

    cStr.op = 'not_equals';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => 'world' }));

    cStr.op = 'contains';
    cStr.value = 'ell';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => 'hello' }));

    cStr.op = 'not_contains';
    cStr.value = 'xyz';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => 'hello' }));

    cStr.op = 'starts_with';
    cStr.value = 'hel';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => 'hello' }));

    cStr.op = 'in';
    cStr.value = 'alpha,beta,gamma';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => 'beta' }));
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => 'delta' }));

    cStr.op = 'not_in';
    cStr.value = 'alpha,beta';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => 'gamma' }));

    // Number comparisons on string values
    cStr.op = 'gt';
    cStr.value = '50';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => '100' }));

    cStr.op = 'gte';
    cStr.value = '50';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => '50' }));

    cStr.op = 'lt';
    cStr.value = '50';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => '25' }));

    cStr.op = 'lte';
    cStr.value = '50';
    Assert.isTrue(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => '50' }));

    cStr.op = 'gt';
    cStr.value = 'non-numeric';
    Assert.isFalse(RevquilaRules.matches(new List<RevquilaSettings.Condition>{ cStr }, new Map<String, Object>{ 'str' => '100' }));
  }
}
