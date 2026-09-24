import assert from 'node:assert/strict';
import test from 'node:test';
import { createStoneWallConstructionSite } from '../src/economy/construction';
import { palisadeConstructionSchedule } from '../src/domain/palisadeConstructionSchedule';
import { allocateBuildingAndConstructionLabour } from '../src/population/labour';
import { advanceConstructionSites } from '../src/engine/constructionLifecycle';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { afterPalisadeProclamation } from './wallCarryFixtures';
import { suggestedConstructionRoad } from '../src/ui/constructionAccessModel';
import { placeRoadLine } from '../src/engine/gameActions';
import { resolveBuildingToConstructionSiteRoute } from '../src/engine/routing';
import type { GameState } from '../src/engine/engine.types';

const stone = (order: number) => createStoneWallConstructionSite({
  id: `seg-${order}-stone`, wallId: 'wall', segmentIndex: order, gateDistance: order,
  order, path: [{ x: order, y: 0 }, { x: order + 1, y: 0 }], startedTick: 0,
});

test('R-T8: stone order zero without a route does not block supplied later sites', () => {
  const blocked = { ...stone(0), stall: 'no_route' as const };
  const supplied = [1, 2, 3].map(order => ({ ...stone(order), delivered: stone(order).required }));
  const sites = [blocked, ...supplied];
  assert.equal(palisadeConstructionSchedule(blocked, sites).kind, 'queued');
  assert.ok(supplied.every(site => palisadeConstructionSchedule(site, sites).kind === 'active'));
  const allocation = allocateBuildingAndConstructionLabour([], sites, 100,
    { era: 'stone_town', tick: 5000, eraProclaimedTick: 0 });
  assert.equal(allocation.constructionSites[0]?.stall, 'no_route');
  assert.ok(allocation.constructionSites.slice(1).every(site => site.assignedBuilders === 3));
  let state: GameState = { ...DEFAULT_GAME_STATE, constructionSites: allocation.constructionSites };
  for (let tick = 0; tick < 3000; tick += 1) state = { ...state, constructionSites: advanceConstructionSites(state) };
  assert.equal(state.constructionSites[0]?.builderTicks, 0);
  assert.ok(state.constructionSites.slice(1).every(site => site.builderTicks === site.requiredBuilderTicks));
  const repaired = state.constructionSites.map(site => ({ ...site, delivered: site.required, stall: 'none' as const, assignedBuilders: 3 }));
  state = { ...state, constructionSites: repaired };
  for (let tick = 0; tick < 3000; tick += 1) state = { ...state, constructionSites: advanceConstructionSites(state) };
  assert.ok(state.constructionSites.every(site => site.builderTicks === site.requiredBuilderTicks));
});

test('R-T9: the existing stone replacement sites share one anchored wall carry ring', () => {
  const natural = afterPalisadeProclamation();
  const sites = natural.constructionSites.flatMap(site => site.kind === 'palisade_segment'
    ? [createStoneWallConstructionSite({ ...site, id: `${site.id}-stone` })] : []);
  assert.equal(sites.length, 12);
  let state: GameState = { ...natural, constructionSites: sites,
    buildings: natural.buildings.map(building => building.kind === 'storehouse'
      ? { ...building, inventory: { stone: 200 } } : building) };
  const roads = sites.map(site => suggestedConstructionRoad(state, site)).filter(path => path.length > 0)
    .sort((a, b) => a.length - b.length);
  const path = roads[0];
  assert.ok(path !== undefined);
  for (const tile of path) state = placeRoadLine(state, tile, tile);
  const source = state.buildings.find(building => building.kind === 'storehouse');
  assert.ok(source);
  assert.ok(sites.every(site => resolveBuildingToConstructionSiteRoute(state, source, site).path !== null));
});
