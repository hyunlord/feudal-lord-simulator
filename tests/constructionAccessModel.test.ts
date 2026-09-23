import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConstructionSite } from '../src/economy/construction';
import { constructionAccessModel, groupedConstructionCause } from '../src/ui/constructionAccessModel';
import { resolveBuildingToConstructionSiteRoute } from '../src/engine/routing';
import { resolveCanvasClick } from '../src/render/canvasClickResolution';
import { tileToScreen } from '../src/render/iso';
import { building, state as makeState, timberSite } from './stoneWallConversionFixtures';

const site = {
  id: 'well-plan', kind: 'well', tx: 5, ty: 5,
  required: { timber: 10 }, delivered: {}, reserved: {},
  builderTicks: 0, requiredBuilderTicks: 200, assignedBuilders: 1,
  stall: 'no_route', startedTick: 0,
} as const satisfies ConstructionSite;

function disconnectedFixture() {
  return makeState({
    width: 8, height: 8, palisade: null, houses: [], walkers: [],
    buildings: [building('store', 'storehouse', 1, 1, { inventory: { timber: 20 } })],
    constructionSites: [site],
    tiles: Array.from({ length: 64 }, (_, index) => {
      const tx = index % 8, ty = Math.floor(index / 8);
      return {
        tx, ty, terrain: 'grass' as const,
        hasRoad: tx === 2 && ty === 3,
        buildingId: (tx >= 1 && tx <= 2 && ty >= 1 && ty <= 2) ? 'store'
          : (tx === 5 && ty === 5) ? site.id : null,
      };
    }),
  });
}

test('road proposal connects a stalled site, then disappears after the road is built', () => {
  const state = disconnectedFixture();
  const before = constructionAccessModel(state, site);
  assert.equal(before.cause, 'road_disconnected');
  assert.ok(before.suggestedRoad.length > 1);
  assert.ok(before.accessTiles.length > 0);
  const roads = new Set(before.suggestedRoad.map(tile => `${tile.tx},${tile.ty}`));
  const connected = {
    ...state,
    constructionSites: [{ ...site, stall: 'none' as const }],
    tiles: state.tiles.map(tile => roads.has(`${tile.tx},${tile.ty}`) ? { ...tile, hasRoad: true } : tile),
  };
  const completedSite = connected.constructionSites[0];
  assert.ok(completedSite);
  const source = connected.buildings[0];
  assert.ok(source);
  assert.ok(resolveBuildingToConstructionSiteRoute(connected, source, completedSite).path);
  assert.equal(constructionAccessModel(connected, completedSite).cause, 'none');
  assert.equal(constructionAccessModel(connected, completedSite).suggestedRoad.length, 0);
});

test('road proposal starts from a material source instead of a nearer empty storehouse', () => {
  const base = disconnectedFixture();
  const empty = building('empty-store', 'storehouse', 4, 1, { inventory: {} });
  const state = {
    ...base,
    buildings: [...base.buildings, empty],
    tiles: base.tiles.map(tile => ({
      ...tile,
      hasRoad: tile.hasRoad || (tile.ty === 3 && (tile.tx === 4 || tile.tx === 5)),
      buildingId: tile.tx >= 4 && tile.tx <= 5 && tile.ty >= 1 && tile.ty <= 2
        ? empty.id : tile.buildingId,
    })),
  };
  const proposed = constructionAccessModel(state, site).suggestedRoad;
  assert.deepEqual(proposed[0], { tx: 2, ty: 3 });
  const roads = new Set(proposed.map(tile => `${tile.tx},${tile.ty}`));
  const connected = {
    ...state,
    tiles: state.tiles.map(tile => roads.has(`${tile.tx},${tile.ty}`) ? { ...tile, hasRoad: true } : tile),
  };
  const source = state.buildings[0];
  assert.ok(source);
  assert.ok(resolveBuildingToConstructionSiteRoute(connected, source, site).path);
});

test('same cause is grouped across sites without hiding site diagnosis', () => {
  const state = disconnectedFixture();
  const second = { ...site, id: 'second-well', tx: 6, ty: 5 };
  const grouped = { ...state, constructionSites: [site, second] };
  assert.equal(groupedConstructionCause(grouped, 'road_disconnected'), '공사 2구간이 같은 이유로 대기: 도로 미연결');
});

test('a wall segment label can be selected directly without a tile hover', () => {
  const wall = timberSite(0, { stall: 'no_route' });
  const state = { ...disconnectedFixture(), constructionSites: [wall] };
  const first = wall.path[0], last = wall.path[wall.path.length - 1];
  assert.ok(first && last);
  const anchor = tileToScreen((first.x + last.x) / 2, (first.y + last.y) / 2);
  const selected = resolveCanvasClick({
    suppressClick: false, spacePressed: false, dragMode: 'none', hover: null,
    selectedTool: null, state,
    point: { x: anchor.sx, y: anchor.sy - 64 },
    camera: { zoom: 1, panX: 0, panY: 0 },
    viewport: { width: 1600, height: 1100 }, nowMs: 0,
  });
  assert.equal(selected.kind, 'selection');
  if (selected.kind === 'selection') assert.equal(selected.selection?.kind, 'construction_site');
});
