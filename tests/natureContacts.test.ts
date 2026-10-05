import assert from 'node:assert/strict';
import test from 'node:test';
import { c25BoardState } from '../scripts/c25Board';
import { roadRainContacts, rainContactAge } from '../src/render/natureContacts';
import { roofContactDomain } from '../src/render/natureRoof';
import { setBoundaryV2Enabled } from '../src/render/renderBoundaryFlag';
import { setPresentationPreference } from '../src/render/presentationPreferences';
import masks from '../src/render/art/natureRoofMasks.json';

test('roof contact uses registered ink spans and applies the actually drawn crop transform', () => {
  const mask = masks[0]; assert.ok(mask); const bodyId = mask.bodyIds[0]; assert.ok(bodyId);
  const drawn = { at: { x: 0, y: 0 }, layers: [], body: { bodyId,
    sourceRect: { x: 0, y: 0, width: mask.width, height: mask.height },
    targetRect: { x: 100, y: 200, width: mask.width / 2, height: mask.height / 2 } } };
  const spans = roofContactDomain(drawn); assert.ok(spans); assert.equal(spans.length, mask.spans.length);
  const span = mask.spans[0]; assert.ok(span);
  assert.equal(spans[0]?.x, 100 + (span[0] ?? 0) / 2);
  assert.equal(spans[0]?.y, 200 + (span[1] ?? 0) / 2);
  assert.equal(roofContactDomain({ ...drawn, body: { ...drawn.body, bodyId: 'unregistered' } }), null);
  assert.ok(spans.reduce((sum, item) => sum + item.width * item.height, 0) < drawn.body.targetRect.width * drawn.body.targetRect.height * 0.5);
});
test('road contacts are culled by actual visible road cells and never use water or building cells', () => {
  const state = c25BoardState(); setBoundaryV2Enabled(true);
  try {
    const contacts = roadRainContacts(state, state.tiles);
    assert.ok(contacts.length > 0); assert.ok(contacts.every(contact => Number.isFinite(contact.x) && Number.isFinite(contact.y)));
    assert.deepEqual(roadRainContacts(state, []), []);
    assert.deepEqual(roadRainContacts(state, state.tiles.filter(tile => !tile.hasRoad)), []);
    assert.deepEqual(roadRainContacts(state, state.tiles.filter(tile => tile.terrain === 'water')), []);
    assert.ok(contacts.some(contact => contact.group === 'soil'));
    assert.ok(contacts.some(contact => contact.group === 'stone'));
  } finally { setBoundaryV2Enabled(false); }
});
test('rain contact animation uses deterministic simulation phase and obeys both switches', () => {
  const state = { ...c25BoardState(), seed: 1, tick: 17000 };
  setPresentationPreference('weatherFx', true); setPresentationPreference('rainOverlay', true);
  assert.equal(rainContactAge(state, 0, 0, 0), rainContactAge(structuredClone(state), 0, 0, 0));
  const phases = Array.from({ length: 18 }, (_, i) => rainContactAge({ ...state, tick: state.tick + i }, 0, 0, 0));
  assert.ok(phases.some(age => age !== null)); assert.ok(phases.some(age => age === null));
  setPresentationPreference('rainOverlay', false); assert.equal(rainContactAge(state, 0, 0, 0), null);
  setPresentationPreference('rainOverlay', true); setPresentationPreference('weatherFx', false);
  assert.equal(rainContactAge(state, 0, 0, 0), null); setPresentationPreference('weatherFx', true);
});
