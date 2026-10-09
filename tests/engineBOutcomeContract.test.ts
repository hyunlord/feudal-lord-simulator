import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { registryV4Support, v4Entry, type V4Choice } from '../src/engine/registryV4';

const path = 'docs/design/engine-B-outcomes.json';
function object(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return Object.fromEntries(Object.entries(value));
}
function array(value: unknown): readonly unknown[] { assert.ok(Array.isArray(value)); return value; }
function text(value: unknown): string { assert.equal(typeof value, 'string'); assert.ok(typeof value === 'string' && value.trim().length > 0); return value; }
function read(): Record<string, unknown> { assert.ok(existsSync(path), 'outcome contract must exist'); return object(JSON.parse(readFileSync(path, 'utf8'))); }
function rows(): readonly Record<string, unknown>[] { return array(read().events).map(object); }
function choices(): readonly Record<string, unknown>[] { return rows().flatMap(row => array(row.choices).map(object)); }
function outcomes(): readonly Record<string, unknown>[] { return choices().flatMap(choice => array(choice.outcomes).map(object)); }
function validateOutcome(value: unknown): void {
  const row = object(value), target = object(row.target), link = object(row.primaryDirectDecisionLink);
  for (const key of ['id', 'explicitCondition', 'playerVisibleChange', 'knownGap']) text(row[key]);
  for (const key of ['kind', 'path', 'binding']) text(target[key]);
  assert.ok(['immediate', 'conditional', 'persistent'].includes(text(row.effectKind)));
  assert.ok(['immediate', 'product_expectation', 'condition_dependent'].includes(text(row.windowBasis)));
  assert.ok(row.withinSeasons === null || (typeof row.withinSeasons === 'number' && Number.isInteger(row.withinSeasons) && row.withinSeasons >= 0));
  if (row.withinSeasons === null) assert.equal(row.windowBasis, 'condition_dependent');
  assert.equal(link.required, true); assert.equal(link.identity, 'successful_answer_history_id'); text(link.condition);
  for (const key of ['surfaces', 'expectedResultTemplates', 'sourceRefs']) assert.ok(array(row[key]).length > 0);
  for (const surface of array(row.surfaces)) text(surface);
  for (const template of array(row.expectedResultTemplates)) text(template);
  if (array(row.expectedResultTemplates).includes('consequence')) assert.ok(array(row.expectedResultKeys).length > 0);
  for (const key of array(row.expectedResultKeys)) text(key);
  for (const source of array(row.sourceRefs).map(object)) {
    assert.ok(existsSync(text(source.path)), `missing source ${source.path}`);
    assert.ok(typeof source.line === 'number' && source.line > 0 && Number.isInteger(source.line));
  }
}

test('given current executable support, every event and supported choice has one contract', () => {
  const expected = registryV4Support().filter(row => row.runs);
  const actual = rows();
  assert.equal(expected.length, 56);
  assert.deepEqual(actual.map(row => row.id).sort(), expected.map(row => row.id).sort());
  assert.equal(choices().length, 163);
  for (const row of actual) {
    const entry = expected.find(candidate => candidate.id === row.id); assert.ok(entry);
    assert.deepEqual(array(row.choices).map(choice => object(choice).id).sort(), entry.choices.filter(choice => choice.supported).map(choice => choice.id).sort());
  }
});

test('given current command and revalidation contracts, outcome rows retain exact inputs', () => {
  for (const row of rows()) {
    const entry = v4Entry(text(row.id)); assert.ok(entry);
    text(object(row.applicability).condition);
    for (const value of array(row.choices)) {
      const choice = object(value);
      const canonical: V4Choice | undefined = entry.choices.find(item => item.id === choice.id); assert.ok(canonical);
      assert.deepEqual(choice.commands, canonical.commands.map(command => ({ type: command.type, args: command.args ?? {} })));
      assert.deepEqual(object(choice.applicability).choiceConditions, canonical.conditions?.ast ?? { all: [] });
      text(object(choice.applicability).condition);
    }
  }
});

test('given each supported answer, target, timing, visible result and source are meaningful', () => {
  for (const choice of choices()) {
    assert.ok(array(choice.outcomes).length > 0);
    const ids = array(choice.outcomes).map(outcome => object(outcome).id);
    assert.equal(new Set(ids).size, ids.length);
    for (const outcome of array(choice.outcomes)) validateOutcome(outcome);
  }
});

test('given conditional future outcomes, a decision card cannot stand in for result proof', () => {
  for (const outcome of outcomes().filter(row => row.effectKind === 'conditional')) {
    assert.equal(outcome.withinSeasons, null);
    assert.equal(outcome.windowBasis, 'condition_dependent');
    assert.ok(!array(outcome.expectedResultTemplates).includes('decision.card'));
  }
  assert.equal(read().status, 'expectations_not_runtime_verification');
});

test('given cancel and refusal, immediate meaningful settlement is not future success', () => {
  const cancel = rows().find(row => row.id === 'ck_evt_046'); assert.ok(cancel);
  const choice = array(cancel.choices).map(object).find(row => row.id === 'cancel'); assert.ok(choice);
  assert.ok(array(choice.outcomes).map(object).some(row => row.effectKind === 'immediate' && object(row.target).path === 'state.timberOrder'));
  assert.ok(!array(choice.outcomes).map(object).some(row => array(row.expectedResultKeys).includes('goods_delivered')));
  const counter = rows().find(row => row.id === 'ck_evt_011'); assert.ok(counter);
  const refused = array(counter.choices).map(object).find(row => array(row.commands).some(command => object(object(command).args).accept === false)); assert.ok(refused);
  assert.ok(array(refused.outcomes).map(object).some(row => row.effectKind === 'immediate' && text(row.playerVisibleChange).includes('withdrawn')));
});

test('given known trace defects, named events retain explicit gaps without lowering rights', () => {
  for (const suffix of ['083', '061', '077', '130', '038', '140', '092', '211', '046', '209']) {
    const row = rows().find(item => item.id === `ck_evt_${suffix}`); assert.ok(row);
    assert.ok(text(row.knownGap).length > 35);
  }
  for (const id of ['ck_evt_083', 'ck_evt_144']) assert.match(text(object(rows().find(row => row.id === id)?.applicability).condition), /lasting|rights/);
});

test('given malformed expectations, missing condition or result identity is rejected', () => {
  const original = outcomes()[0]; assert.ok(original);
  assert.throws(() => validateOutcome({ ...original, explicitCondition: '' }));
  assert.throws(() => validateOutcome({ ...original, target: { kind: 'estate', path: '', binding: 'bound.estate.id' } }));
  assert.throws(() => validateOutcome({ ...original, primaryDirectDecisionLink: { required: false, identity: 'root_candidate', condition: 'same target' } }));
  assert.throws(() => validateOutcome({ ...original, expectedResultTemplates: ['consequence'], expectedResultKeys: [] }));
});

test('given real history producers, faction namespace and enforcement failure remain exact', () => {
  const all = outcomes();
  for (const outcome of all) {
    assert.ok(!array(outcome.expectedResultTemplates).some(value => ['estate.enforcement_failed', 'estate.suit_evidence', 'petition.answered'].includes(text(value))));
    assert.ok(!array(outcome.expectedResultKeys).includes('faction_acted'));
    assert.equal(object(outcome.requiredProbe).status, 'required_not_observed');
  }
  const faction = all.filter(row => text(row.id).endsWith('hold-faction-followup'));
  assert.ok(faction.length > 0);
  for (const outcome of faction) {
    assert.deepEqual(outcome.expectedResultTemplates, ['faction.act']);
    assert.deepEqual(outcome.expectedBecauseKeys, ['faction_act']);
    assert.deepEqual(outcome.expectedResultKeys, []);
  }
  assert.match(text(object(read().evidenceRules).metrics), /neither satisfy.*nor remove mature answers/);
});

test('given each outcome, the desired display deadline is finite and tied to its concrete effect', () => {
  for (const outcome of outcomes()) {
    const display = object(outcome.displayExpectation);
    assert.equal(display.status, 'desired_not_observed');
    assert.ok(['answer_committed', 'condition_satisfied', 'domain_transition'].includes(text(display.anchor)));
    assert.ok(typeof display.withinSeasons === 'number' && Number.isInteger(display.withinSeasons) && display.withinSeasons >= 0 && display.withinSeasons <= 4);
    assert.equal(display.conditionId, `${text(outcome.id)}:display-condition`);
    assert.ok(array(display.requiredFacts).length >= 2);
    const observable = object(display.observableTarget);
    assert.deepEqual(observable.target, outcome.target);
    assert.deepEqual(observable.templates, outcome.expectedResultTemplates);
    assert.equal(observable.playerVisibleChange, outcome.playerVisibleChange);
    if (outcome.effectKind === 'conditional') {
      assert.equal(display.anchor, 'domain_transition');
      assert.equal(outcome.withinSeasons, null);
    } else {
      assert.equal(display.anchor, 'answer_committed');
      assert.equal(display.withinSeasons, 0);
    }
  }
});
