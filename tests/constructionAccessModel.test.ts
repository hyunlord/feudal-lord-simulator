import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConstructionSite } from '../src/economy/construction';
import { constructionAccessModel, currentConstructionSiteLabel, groupedConstructionCause, legalNewRoad, roadConnectsConstructionSite } from '../src/ui/constructionAccessModel';
import { suggestedNewRoadRuns } from '../src/render/constructionAccessOverlay';
import { resolveBuildingToConstructionSiteRoute } from '../src/engine/routing';
import { placeRoadLine } from '../src/engine/gameActions';
import { cachedPlacementPreview } from '../src/render/placementPredictionRuntime';
import { constructionSiteCardModel } from '../src/ui/constructionSiteCardModel';
import { resolveCanvasClick } from '../src/render/canvasClickResolution';
import { tileToScreen } from '../src/render/iso';
import { building, palisade, palisadeSegment, state as makeState, timberSite } from './stoneWallConversionFixtures';

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

test('stale delivery status yields to the current disconnected-road diagnosis on the map and card', () => {
  // Given: road access changed before the next construction tick updated the stored stall.
  const staleSite = { ...site, stall: 'awaiting_materials' as const };
  const state = { ...disconnectedFixture(), constructionSites: [staleSite] };

  // When / Then: the visible summaries agree with the selected site's live cause.
  assert.equal(constructionAccessModel(state, staleSite).cause, 'road_disconnected');
  assert.equal(currentConstructionSiteLabel(state, staleSite), '🚧 도로 미연결');
  assert.equal(constructionSiteCardModel(staleSite, { accessState: state }).currentStallLabel, '🚧 도로 미연결');
});

test('current route labels keep material, reserve, and worker stalls intact', () => {
  // Given
  const state = disconnectedFixture();

  // When / Then
  assert.equal(currentConstructionSiteLabel(state, { ...site, stall: 'no_material_source' }), '🪵 창고에 목재 없음');
  assert.equal(currentConstructionSiteLabel(state, { ...site, stall: 'reserve_held' }), '🪵 비축분 유지 중');
  assert.equal(currentConstructionSiteLabel(state, { ...site, stall: 'no_builders' }), '👷 일꾼 없음');
});

test('current route labels clear a stale no-route stall after a real material road connects', () => {
  // Given
  const disconnected = disconnectedFixture();
  const plannedRoad = constructionAccessModel(disconnected, site).missingRoadTiles;
  const roads = new Set(plannedRoad.map(tile => `${tile.tx},${tile.ty}`));
  const connected = {
    ...disconnected,
    tiles: disconnected.tiles.map(tile => roads.has(`${tile.tx},${tile.ty}`) ? { ...tile, hasRoad: true } : tile),
  };

  // When / Then
  const source = connected.buildings[0];
  assert.ok(source);
  assert.equal(resolveBuildingToConstructionSiteRoute(connected, source, site).path !== null, true);
  assert.equal(currentConstructionSiteLabel(connected, site), '🪵 목재 오는 중 (0/10)');
});

test('road proposal connects a stalled site, then disappears after the road is built', () => {
  const state = disconnectedFixture();
  const before = constructionAccessModel(state, site);
  assert.equal(before.cause, 'road_disconnected');
  assert.ok(before.suggestedRoad.length > 1);
  assert.ok(before.missingRoadTiles.length > 0);
  assert.ok(before.missingRoadTiles.every(tile => !state.tiles.some(existing => existing.tx === tile.tx && existing.ty === tile.ty && existing.hasRoad)));
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

test('T8: dotted construction suggestion begins on buildable ground and never crosses an existing road', () => {
  const state = disconnectedFixture();
  const model = constructionAccessModel(state, site);
  const runs = suggestedNewRoadRuns(state, model.suggestedRoad);
  assert.ok(runs.length > 0);
  assert.deepEqual(runs.flat(), model.missingRoadTiles);
  assert.equal(state.tiles.find(tile => tile.tx === model.suggestedRoad[0]?.tx && tile.ty === model.suggestedRoad[0]?.ty)?.hasRoad, true);
  assert.ok(runs.every(run => run.every(tile => legalNewRoad(state, tile))));
  assert.ok(runs.every(run => run.every(tile => state.tiles.find(existing => existing.tx === tile.tx && existing.ty === tile.ty)?.hasRoad === false)));
});

test('a road already inside a suggestion splits the dotted segments', () => {
  const state = disconnectedFixture();
  const path = [{ tx: 2, ty: 3 }, { tx: 3, ty: 3 }, { tx: 4, ty: 3 }, { tx: 5, ty: 3 }];
  const withMiddleRoad = { ...state, tiles: state.tiles.map(tile => tile.tx === 4 && tile.ty === 3 ? { ...tile, hasRoad: true } : tile) };
  assert.deepEqual(suggestedNewRoadRuns(withMiddleRoad, path), [
    [{ tx: 3, ty: 3 }], [{ tx: 5, ty: 3 }],
  ]);
});

test('one missing road tile predicts a real material route to the selected site', () => {
  const base = disconnectedFixture();
  const oneGapSite = { ...site, tx: 4, ty: 3 };
  const state = {
    ...base,
    constructionSites: [oneGapSite],
    tiles: base.tiles.map(tile => ({
      ...tile,
      buildingId: tile.tx === 4 && tile.ty === 3 ? oneGapSite.id
        : tile.tx === site.tx && tile.ty === site.ty ? null : tile.buildingId,
    })),
  };
  const proposed = constructionAccessModel(state, oneGapSite);
  assert.deepEqual(proposed.missingRoadTiles, [{ tx: 3, ty: 3 }]);
  assert.equal(roadConnectsConstructionSite(state, oneGapSite, [{ tx: 3, ty: 3 }]), true);
  assert.equal(roadConnectsConstructionSite(state, oneGapSite, [{ tx: 3, ty: 4 }]), false);
  assert.equal(roadConnectsConstructionSite({ ...state, buildings: state.buildings.map(source => ({ ...source, inventory: {} })) },
    oneGapSite, [{ tx: 3, ty: 3 }]), false);
  assert.ok(cachedPlacementPreview(state, 'road', { tx: 3, ty: 3 }, null, oneGapSite.id)
    .prediction?.lines.some(line => line.text === '이 길로 연결됩니다 ✓'));
  assert.ok(!cachedPlacementPreview(state, 'road', { tx: 3, ty: 4 }, null, oneGapSite.id)
    .prediction?.lines.some(line => line.text === '이 길로 연결됩니다 ✓'));
  const built = placeRoadLine(state, { tx: 3, ty: 3 }, { tx: 3, ty: 3 });
  assert.notEqual(built, state);
  const source = built.buildings[0];
  assert.ok(source);
  assert.ok(resolveBuildingToConstructionSiteRoute(built, source, oneGapSite).path);
  const completedSite = { ...oneGapSite, stall: 'none' as const };
  assert.equal(constructionAccessModel({ ...built, constructionSites: [completedSite] }, completedSite).cause, 'none');
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

test('selected palisade segment highlights only its missing access road and clears after placement', () => {
  const wall = timberSite(0, { path: [{ x: 3, y: 3 }, { x: 4, y: 3 }], stall: 'no_route' });
  const segment = palisadeSegment(0, { edgePath: wall.path, completed: false, constructionSiteId: wall.id });
  const state = { ...disconnectedFixture(), constructionSites: [wall], palisade: palisade([segment]) };
  const model = constructionAccessModel(state, wall);
  assert.equal(model.cause, 'road_disconnected');
  assert.deepEqual(model.missingRoadTiles, [{ tx: 3, ty: 3 }]);
  assert.deepEqual(constructionSiteCardModel(wall, { accessState: state }).rows.find(row => row.label === '연결 길'), {
    label: '연결 길', value: '강조된 한 칸에 길을 놓으면 공사장에 연결됩니다',
  });
  assert.equal(roadConnectsConstructionSite(state, wall, model.missingRoadTiles), true);
  const built = placeRoadLine(state, { tx: 3, ty: 3 }, { tx: 3, ty: 3 });
  const source = built.buildings[0];
  assert.ok(source);
  assert.ok(resolveBuildingToConstructionSiteRoute(built, source, wall).path);
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
