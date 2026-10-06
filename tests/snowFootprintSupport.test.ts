import assert from 'node:assert/strict';
import test from 'node:test';
import { c25BoardState } from '../scripts/c25Board';
import { createSnowFootprintHistory } from '../src/render/snowFootprintHistory';
import { createFootprintGroundSupport, footprintHull } from '../src/render/snowFootprintSupport';
import { walkerVisualAnchor } from '../src/render/walkerAnchor';
import { roadAlignedWalkers } from '../src/render/walkerRoadAlignment';
import { stepWalkerAlongPath } from '../src/agents/movement';
import type { Walker } from '../src/agents/walker.types';
import { tileToScreen } from '../src/render/iso';

const initial = c25BoardState();
function walker(tx: number, ty: number): Walker {
  return { id: 'observed', kind: 'builder', homeBuildingId: 'home', siteId: 'site', slotIndex: 0, position: { tx, ty }, path: [], pathIndex: 0, previousTile: null, cargo: null, spawnedTick: 3400 };
}
const shore = { ...initial, buildings: [], palisade: null, tick: 3500,
  tiles: initial.tiles.map(tile => ({ ...tile, hasRoad: tile.ty === 2, buildingId: null, terrain: tile.ty === 3 ? 'water' as const : 'grass' as const })) };
test('row2 road / row3 water ty2.4 counterexample cannot emit an observed strip', () => {
  const history = createSnowFootprintHistory();
  for (let i = 0; i < 25; i++) assert.deepEqual(history.observe({ ...shore, tick: 3500 + i }, [walker(2 + i * 0.1, 2.4)]), []);
  assert.equal(createFootprintGroundSupport(shore)({ x: 6.4, y: 85.76 }), false);
});
test('whole nonzero alpha support rejects a dry centre whose edge touches water, building or nonroad', () => {
  const stamp = tileToScreen(3, 2.45), point = { x: stamp.sx, y: stamp.sy };
  assert.equal(createFootprintGroundSupport(shore)(point), false);
  const id = 'wave39:snow/footprints_snow_a-v1';
  assert.ok(footprintHull(id, point).some(p => p.y > 2.5));
  for (const block of [{ terrain: 'grass' as const, buildingId: 'occupied', hasRoad: true }, { terrain: 'grass' as const, buildingId: null, hasRoad: false }]) {
    const state = { ...shore, tiles: shore.tiles.map(t => t.ty === 3 ? { ...t, ...block } : t) };
    assert.equal(createFootprintGroundSupport(state)(point, id), false);
  }
});
test('real C25 road geometry supports complete source footprints, including an observed engine-stepped road route', () => {
  const state = { ...initial, tick: 3500 };
  const support = createFootprintGroundSupport(state);
  const allowed = state.tiles.filter(t => t.hasRoad).filter(tile => {
    const anchor = walkerVisualAnchor(tile); return support({ x: anchor.sx, y: anchor.sy });
  });
  assert.ok(allowed.length > 0);
  let total = 0;
  // Existing board roads, production movement and production road alignment; no fabricated support callback.
  for (const tile of allowed) {
    const route = [0, 1, 2, 3].map(dx => ({ tx: tile.tx + dx, ty: tile.ty }));
    if (!route.every(p => state.tiles[p.ty * state.width + p.tx]?.hasRoad)) continue;
    const history = createSnowFootprintHistory();
    let actor: Walker = { ...walker(tile.tx, tile.ty), path: route };
    for (let i = 0; i < 30; i++) {
      const frame = { ...state, tick: 3500 + i };
      const prints = history.observe(frame, roadAlignedWalkers(frame, [actor]));
      total += prints.length;
      actor = stepWalkerAlongPath(actor, 0.1);
    }
  }
  assert.ok(total > 0, 'normal road routes must produce supported observed footprints');
});

import { advanceTick } from '../src/engine/tick';
test('actual engine ticks preserve observed snow tracks along an existing C25 road', () => {
  // Given: the production board, a supported existing route and the real tick reducer.
  let state = { ...initial, tick: 3500 };
  const support = createFootprintGroundSupport(state);
  const start = state.tiles.find(tile => {
    const anchor = walkerVisualAnchor(tile);
    return support({ x: anchor.sx, y: anchor.sy }) && [0, 1, 2, 3].every(dx => state.tiles[tile.ty * state.width + tile.tx + dx]?.hasRoad);
  });
  assert.ok(start);
  const route = [0, 1, 2, 3].map(dx => ({ tx: start.tx + dx, ty: start.ty }));
  let actor: Walker = { ...walker(start.tx, start.ty), path: route };
  const history = createSnowFootprintHistory();
  let observed = 0;
  // When: rendering each actual simulation step while movement follows the engine route.
  for (let i = 0; i < 30; i++) {
    observed += history.observe(state, roadAlignedWalkers(state, [actor])).length;
    state = advanceTick(state);
    actor = stepWalkerAlongPath(actor, 0.1);
  }
  // Then: ordinary ticks do not continuously reset the observed history.
  assert.ok(observed > 0);
  assert.equal(state.tick, 3530);
});
