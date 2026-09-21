import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { buildingHasRequiredRoadAccess } from '../src/engine/roadAccess';
import { placeRoadLine } from '../src/engine/gameActions';
import type { GameState } from '../src/engine/engine.types';
import type { Building } from '../src/content/buildingConfig';
const home: Building = { id: 'candidate', kind: 'masonry', tx: 3, ty: 1, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
function grid(): GameState {
  return { ...DEFAULT_GAME_STATE, width: 7, height: 7, buildings: [], constructionSites: [], palisade: null,
    tiles: Array.from({ length: 49 }, (_, i) => ({ tx: i % 7, ty: Math.floor(i / 7), terrain: 'grass', hasRoad: false, buildingId: null })) };
}
test('Given a hypothetical masonry When its only adjacent road is absent or behind a completed wall Then exact existing access rejects it', () => {
  const base = grid(); assert.equal(buildingHasRequiredRoadAccess(base, home), false);
  const road = { ...base, tiles: base.tiles.map(tile => ({ ...tile, hasRoad: tile.tx === 4 && tile.ty === 1 })) };
  assert.equal(buildingHasRequiredRoadAccess(road, home), true);
  const closed = { ...road, palisade: { id: 'wall', gate: { x: 4, y: 6 }, polygon: [],
    segments: [{ id: 'edge', order: 0, edgePath: [{ x: 4, y: 0 }, { x: 4, y: 4 }], tileCount: 4, completed: true, constructionSiteId: null }] } };
  assert.equal(buildingHasRequiredRoadAccess(closed, home), false);
  assert.equal(buildingHasRequiredRoadAccess({ ...closed, buildings: [home] }, home), false);
});
test('Given a legal bridge When a candidate touches its side Then access rejects that side and accepts its bank road', () => {
  const base = grid(), river: GameState = { ...base, treasuryTimber: 100, tiles: base.tiles.map(tile => ({ ...tile, terrain: tile.tx >= 2 && tile.tx <= 4 ? 'water' : 'grass' })) };
  const bridge = placeRoadLine(river, { tx: 1, ty: 3 }, { tx: 5, ty: 3 });
  assert.notEqual(bridge, river);
  assert.equal(buildingHasRequiredRoadAccess(bridge, { ...home, tx: 3, ty: 2 }), false);
  assert.equal(buildingHasRequiredRoadAccess(bridge, { ...home, tx: 1, ty: 2 }), true);
});
test('Given a wider footprint When only the second perimeter cell touches a road Then exact existing access retains it', () => {
  const base = grid(), store: Building = { ...home, kind: 'storehouse', tx: 0, ty: 0 };
  const road = { ...base, tiles: base.tiles.map(tile => ({ ...tile, hasRoad: tile.tx === 2 && tile.ty === 1 })) };
  assert.equal(buildingHasRequiredRoadAccess(road, store), true);
});
