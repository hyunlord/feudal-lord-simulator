import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareArtContractStates } from '../scripts/artContractStates';
import { paintZone } from '../src/zones/zoneEdits';
import { stateCalendar } from '../src/engine/scenarioState';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { admitSceneState, staleStateKeys } from '../scripts/sceneState';
import { decodeSave, encodeSave } from '../src/save/saveCodec';
import { WAVE42_STAGES } from '../src/render/wave42StageManifest.generated';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';

const wave20: unknown = JSON.parse(readFileSync(new URL('./fixtures/art-house-bundle.json', import.meta.url), 'utf8'));
test('prepared scenes cover all 36 land assets and all 32 new house assets at both zooms', () => {
  const prepared = prepareArtContractStates(DEFAULT_GAME_STATE, wave20);
  assert.equal(Object.keys(prepared.states).length, 6);
  assert.equal(prepared.views.length, 20);
  const expected = [...ART_REGISTRY.entries('land-stage').filter(entry => entry.id in WAVE42_STAGES), ...createArtRegistry([wave20]).entries()]
    .map(entry => `/${entry.image.url}`);
  for (const zoom of [1, 0.6]) {
    const urls = new Set(prepared.views.filter(view => view.zoom === zoom).flatMap(view => view.expectedRequests));
    assert.equal([...urls].filter(url => url.startsWith('/assets/wave42/')).length, 36);
    assert.equal([...urls].filter(url => url.startsWith('/assets/wave20/')).length, 32);
    assert.deepEqual([...urls].sort(), [...new Set(expected)].sort());
  }
  for (const view of prepared.views) {
    const state = prepared.states[view.state];
    assert.ok(state);
    assert.equal(stateCalendar(state).season, view.season === 'summer' ? 1 : 3);
    assert.ok(view.expectedRequests.length > 0);
  }
});
test('fixture generation is deterministic and preserves the input save', () => {
  const before = JSON.stringify(DEFAULT_GAME_STATE);
  const first = prepareArtContractStates(DEFAULT_GAME_STATE, wave20);
  assert.equal(JSON.stringify(prepareArtContractStates(DEFAULT_GAME_STATE, wave20)), JSON.stringify(first));
  assert.equal(JSON.stringify(DEFAULT_GAME_STATE), before);
  assert.equal(first.provenance.classification, 'prepared-save-fixture');
});

test('before and after house views keep identical saved states and camera identities', () => {
  const prepared = prepareArtContractStates(DEFAULT_GAME_STATE, wave20);
  assert.equal(prepared.landViews.length, 12);
  assert.equal(prepared.houseAfterViews.length, 8);
  assert.equal(prepared.houseBeforeViews.length, 8);
  for (const [index, before] of prepared.houseBeforeViews.entries()) {
    const after = prepared.houseAfterViews[index];
    assert.ok(after);
    const { expectedRequests: oldUrls, ...beforeIdentity } = before;
    const { expectedRequests: newUrls, ...afterIdentity } = after;
    assert.deepEqual(beforeIdentity, afterIdentity);
    assert.ok(oldUrls.length > 0);
    assert.ok(newUrls.some(url => url.startsWith('/assets/wave20/')));
    for (const url of oldUrls) {
      assert.equal(url.startsWith('/assets/wave20/'), false);
      assert.ok(readFileSync(new URL(`../public${url}`, import.meta.url)).length > 0, url);
    }
  }
});

test('every prepared save round-trips through the codec and passes browser scene admission', () => {
  const prepared = prepareArtContractStates(DEFAULT_GAME_STATE, wave20);
  for (const [name, state] of Object.entries(prepared.states)) {
    assert.deepEqual(staleStateKeys(state, DEFAULT_GAME_STATE), [], name);
    assert.equal(admitSceneState(state, DEFAULT_GAME_STATE), state);
    const bytes = encodeSave({ state, createdAt: '2026-10-05T00:00:00Z', savedAt: '2026-10-05T00:00:00Z' }).bytes;
    const restored = decodeSave(bytes).envelope.state;
    assert.deepEqual(restored, JSON.parse(JSON.stringify(state)), name);
    assert.deepEqual(admitSceneState(JSON.parse(new TextDecoder().decode(bytes)), DEFAULT_GAME_STATE), restored);
    assert.equal(state.zoneUndo, undefined);
    assert.deepEqual(state.arableFields ?? [], []);
  }
});

test('clearing a prepared board removes real zone history with its zones', () => {
  const first = paintZone(DEFAULT_GAME_STATE, 'burgage', { tool: 'brush', points: [{ x: 30, y: 30 }], radius: 2 });
  const base = paintZone(first, 'burgage', { tool: 'brush', points: [{ x: 40, y: 40 }], radius: 2 });
  assert.ok(base.zoneUndo?.some(record => record.nextZoneOrdinal > 1));
  const before = JSON.stringify(base);
  const prepared = prepareArtContractStates(base, wave20);
  for (const state of Object.values(prepared.states)) {
    assert.equal(state.zoneUndo, undefined);
    assert.deepEqual(state.zones, []);
    assert.deepEqual(staleStateKeys(state, DEFAULT_GAME_STATE), []);
  }
  assert.equal(JSON.stringify(base), before);
});
