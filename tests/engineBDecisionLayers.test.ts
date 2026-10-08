import assert from 'node:assert/strict';
import test from 'node:test';
import holdRecommendations from '../docs/design/content-drafts-20261002/v4.2/HOLD_RECOMMENDATIONS.json';
import { ENGINE_B_DECISION_LAYERS } from '../src/content/registry/engineBDecisionLayers.ko';
import { PETITION_CONTEXT_STRATEGIES } from '../src/content/registry/petitionContextConfig';

test('decision weights cover the implemented contexts and chapter lifecycles exactly', () => {
  // Given: the actual implemented context strategy set and two chapter lifecycles.
  const expected = [...Object.keys(PETITION_CONTEXT_STRATEGIES), 'ck_evt_057', 'ck_evt_058'].sort();
  // When: the editorial handoff is enumerated.
  const actual = Object.keys(ENGINE_B_DECISION_LAYERS).sort();
  // Then: no implemented event is omitted and no unrelated event is enabled by this data.
  assert.equal(expected.length, 27);
  assert.deepEqual(actual, expected);
});

test('decision weights never include the v4.2 held recommendations', () => {
  // Given: the authoritative hold list, not a duplicated ID list.
  assert.equal(holdRecommendations.entries.length, 38);
  // When: it is intersected with the handoff.
  const overlap = holdRecommendations.entries.filter(entry => Object.hasOwn(ENGINE_B_DECISION_LAYERS, entry.id));
  // Then: held content remains outside this implemented slice.
  assert.deepEqual(overlap, []);
});

test('rights and land choices remain lord decisions while routine money stays steward work', () => {
  // Given: decisions whose consequences differ despite all mentioning money or management.
  const lordIds = ['057', '061', '067', '075', '076', '077', '078', '147'].map(id => `ck_evt_${id}`);
  // When: their editorial classifications are read.
  const actual = Object.entries(ENGINE_B_DECISION_LAYERS).filter(([, value]) => value.weight === 'lord').map(([id]) => id);
  // Then: titles or small payments do not promote routine work.
  assert.deepEqual(actual.sort(), lordIds.sort());
  assert.equal(ENGINE_B_DECISION_LAYERS['ck_evt_057']?.layer, 'rights');
  assert.equal(ENGINE_B_DECISION_LAYERS['ck_evt_075']?.layer, 'rights');
  for (const value of Object.values(ENGINE_B_DECISION_LAYERS)) {
    assert.match(value.reason, /[가-힣]/u);
    assert.equal(value.layer === null, value.weight === 'steward');
  }
});

test('an unclassified ID remains unknown instead of silently becoming steward work', () => {
  // Given: an ID outside the implemented slice.
  const unknownId = 'ck_evt_999';
  // When: a caller indexes the handoff.
  const decision = ENGINE_B_DECISION_LAYERS[unknownId];
  // Then: no fallback routing policy is invented.
  assert.equal(decision, undefined);
  assert.equal(Object.hasOwn(ENGINE_B_DECISION_LAYERS, unknownId), false);
});

test('editorial land labels match upstream oversight command weights', () => {
  for (const id of ['067', '076', '078', '147']) assert.equal(ENGINE_B_DECISION_LAYERS[`ck_evt_${id}`]?.layer, 'land');
});
