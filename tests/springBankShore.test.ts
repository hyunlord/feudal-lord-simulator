import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { newGameState } from '../src/state/newGame';
import { DEFAULT_SCENARIO_ID } from '../src/content/scenario/coreScenarios';
import { decodeSave, encodeSave } from '../src/save/saveCodec';
import type { GameState } from '../src/engine/engine.types';
import { shoreline } from '../src/world/boundary/shoreline';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { isSpringWorldEntry } from '../src/render/art/springWorldValidation';
import { springBankAnchors, springBankFitsShore, springBankSupport } from '../src/render/springBankShore';
import { tileToScreen, screenToTile } from '../src/render/iso';
const entry = ART_REGISTRY.entry('wave43:swollen_stream_bank_spring'); assert.ok(isSpringWorldEntry(entry));
function straight(waterRight: boolean): GameState {
  const saved = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v47/chapter-four-town.save.json'))).envelope.state as GameState;
  return { ...saved, width: 24, height: 24, tiles: Array.from({ length: 576 }, (_, i) => ({ tx: i % 24, ty: Math.floor(i / 24), terrain: ((i % 24 >= 12) === waterRight) ? 'water' : 'grass', hasRoad: false, buildingId: null })) };
}
test('Given the unmirrored bank artwork When matching shores Then opposite water orientation and floating inland anchors are rejected', () => {
  const wrong = straight(false), shore = shoreline({ ...wrong, bridges: [] });
  assert.equal(springBankFitsShore(wrong, shore, entry, { tx: 12, ty: 12 }), false);
  assert.equal(springBankFitsShore(wrong, shore, entry, { tx: 18, ty: 12 }), false);
});
test('Given a production new-game save When matching the native bank Then complete correctly oriented placement survives the save codec', () => {
  const initial = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: 'core:open_field', seed: 2 }); assert.ok(initial);
  const saved = encodeSave({ state: initial, createdAt: '2026-10-06T00:00:00Z', savedAt: '2026-10-06T00:00:00Z' });
  const state = decodeSave(saved.bytes).envelope.state as GameState;
  const shore = shoreline({ ...state, bridges: [] });
  const anchors = springBankAnchors(state, shore, entry); assert.ok(anchors.length > 0);
  for (const anchor of anchors) assert.ok(springBankFitsShore(state, shore, entry, anchor));
});
test('Given a fractional source pivot When reserving support Then all returned cells are actual integer tiles', () => {
  const anchor = { tx: 13.328125, ty: 4.921875 };
  const support = springBankSupport(entry, anchor);
  assert.ok(support.length > 8);
  assert.ok(support.every(cell => Number.isInteger(cell.tx) && Number.isInteger(cell.ty)));
  const foot = tileToScreen(anchor.tx, anchor.ty), { pivot, scale } = entry.geometry;
  for (const [x, y] of [[1, 1], [254, 1], [1, 126], [254, 126]]) {
    assert.ok(x !== undefined && y !== undefined);
    const ground = screenToTile(foot.sx + (x - pivot.x) * scale, foot.sy + (y - pivot.y) * scale);
    assert.ok(support.some(cell => cell.tx === Math.round(ground.tx) && cell.ty === Math.round(ground.ty)));
  }
});
