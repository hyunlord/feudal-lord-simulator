import assert from 'node:assert/strict';
import test from 'node:test';
import { computeReachablePalisadeProposalForState, previewPalisadeRouteAccess } from '../src/engine/palisadeRouteAccess';
import { nearestWallAnchorCandidate, proposalPredictionLines } from '../src/ui/wallPrediction';
import { constructionAccessModel, currentConstructionSiteLabel, suggestedConstructionRoad } from '../src/ui/constructionAccessModel';
import type { GameState } from '../src/engine/engine.types';
import { advanceTick } from '../src/engine/tick';
import { placeRoadLine } from '../src/engine/gameActions';
import { buildingRoadAccessTiles, resolveBuildingToConstructionSiteRoute } from '../src/engine/routing';
import { wallCarryRoute } from '../src/engine/wallCarryRoute';
import { WALL_CARRY_COST_FACTOR } from '../src/content/wallConstructionConfig';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from '../src/engine/simulationPorts';
import type { ConstructionSite } from '../src/economy/construction';
import { spawnCarter } from '../src/agents/deliveryCommon';
import { constructionMaterialDiagnosis } from '../src/ui/constructionMaterialDiagnosis';
import { walkerDiagnosisModel } from '../src/ui/walkerDiagnosisModel';
import { BALANCE } from '../src/content/balanceConfig';
import { stepCarters } from '../src/agents/deliveryStep';
import type { CarterWalker } from '../src/agents/walker.types';
import { beforePalisadeProclamation, afterPalisadeProclamation } from './wallCarryFixtures';

function proposed(): { readonly state: GameState; readonly proposed: ReturnType<typeof previewPalisadeRouteAccess> } {
  const state = beforePalisadeProclamation();
  const proposal = computeReachablePalisadeProposalForState(state);
  assert.equal(proposal.ok, true);
  if (!proposal.ok) throw new Error('Natural state did not yield a palisade proposal');
  return { state, proposed: previewPalisadeRouteAccess(state, proposal.path) };
}

test('T1: natural 25-minute proposal with no anchored segment warns that one road link is required', () => {
  const { state, proposed: access } = proposed();
  assert.equal(access.segments.length, 12);
  assert.equal(access.reachableSiteIds.length, 0);
  assert.equal(access.unreachableSiteIds.length, 12);
  assert.ok(proposalPredictionLines(state, access.projected.palisade?.polygon ?? []).some(line =>
    line.text.includes('길을 한 곳 이어야 합니다')));
  const candidate = nearestWallAnchorCandidate(access);
  assert.ok(candidate !== null && candidate.roadTiles > 0);
  assert.ok(access.segments.some(segment => segment.siteId === candidate.siteId));
});

function connectedNaturalState(): GameState {
  const { state, proposed: access } = proposed();
  const suggestions = access.projected.constructionSites
    .map(site => suggestedConstructionRoad(access.projected, site))
    .filter(path => path.length > 0)
    .sort((left, right) => left.length - right.length);
  const road = suggestions[0];
  assert.ok(road !== undefined);
  const first = road[0], last = road[road.length - 1];
  assert.ok(first !== undefined && last !== undefined);
  assert.ok(road.every(tile => tile.tx === first.tx || tile.ty === first.ty));
  const connected = placeRoadLine(state, first, last);
  assert.notEqual(connected, state);
  assert.equal(connected.tiles.filter(tile => tile.hasRoad).length - state.tiles.filter(tile => tile.hasRoad).length, 1);
  const after = previewPalisadeRouteAccess(connected, access.projected.palisade?.polygon ?? []);
  assert.equal(after.segments.length, 12);
  assert.equal(after.reachableSiteIds.length, 12);
  assert.equal(after.unreachableSiteIds.length, 0);
  return after.projected;
}

test('T2: one road line from a reachable source to one ring segment supplies all 12 sites', () => {
  const state = connectedNaturalState();
  assert.equal(state.constructionSites.filter(site => site.kind === 'palisade_segment').length, 12);
  const carried = state.constructionSites.find(site => site.kind === 'palisade_segment'
    && constructionAccessModel(state, site).cause === 'none'
    && currentConstructionSiteLabel(state, site).includes('벽을 따라 운반'));
  assert.ok(carried !== undefined);
});

test('a newly occupied wall-side tile invalidates a cached construction route', () => {
  const state = connectedNaturalState();
  const site = state.constructionSites.filter(candidate => candidate.kind === 'palisade_segment').at(-1);
  const source = state.buildings.find(building => building.kind === 'storehouse');
  assert.ok(site?.kind === 'palisade_segment' && source !== undefined);
  const first = resolveBuildingToConstructionSiteRoute(state, source, site);
  const occupied = first.path?.find(tile => state.tiles[tile.ty * state.width + tile.tx]?.hasRoad === false);
  assert.ok(first.path !== null && occupied !== undefined);
  const tileIndex = occupied.ty * state.width + occupied.tx;
  const blocked = { ...state, pathCache: first.pathCache, tiles: state.tiles.map((tile, index) =>
    index === tileIndex ? { ...tile, buildingId: 'new-construction' } : tile) };
  assert.equal(blocked.roadRevision, state.roadRevision);
  const updated = resolveBuildingToConstructionSiteRoute(blocked, source, site);
  assert.ok(updated.path === null || !updated.path.some(tile => tile.tx === occupied.tx && tile.ty === occupied.ty));
});

test('weighted route, off-road diagonal and completed-site return stay wall-only', () => {
  const state = connectedNaturalState();
  const site = state.constructionSites.filter(candidate => candidate.kind === 'palisade_segment').at(-1);
  const source = state.buildings.find(building => building.kind === 'storehouse');
  assert.ok(site?.kind === 'palisade_segment' && source !== undefined);
  const route = wallCarryRoute(state, buildingRoadAccessTiles(state, source), site);
  assert.ok(route !== null && route.wallSteps > 0);
  const ports = createSimulationRoutePorts(state).delivery;
  const physicalCost = route.path.slice(1).reduce((cost, tile, index) => {
    const from = route.path[index];
    assert.ok(from !== undefined);
    const length = Math.abs(from.tx - tile.tx) + Math.abs(from.ty - tile.ty);
    return cost + length * ((!ports.isRoad(from) || !ports.isRoad(tile)) ? WALL_CARRY_COST_FACTOR : 1);
  }, 0);
  assert.equal(route.cost, physicalCost);
  const carter = spawnCarter({ tick: state.tick, home: source,
    destination: { kind: 'construction_site', siteId: site.id }, path: route.path,
    mission: 'deliver', cargo: { resource: 'timber', amount: 4 },
    reservation: { destination: { kind: 'construction_site', siteId: site.id },
      resource: 'timber', amount: 4,
      sourceStockClaim: { kind: 'building', buildingId: source.id, resource: 'timber', amount: 4 },
      homeCapacityClaim: null } });
  const eta = Math.ceil(route.cost / BALANCE.CARTER_SPEED);
  assert.equal(walkerDiagnosisModel({ ...state, walkers: [carter] }, carter.id)?.etaTicks, eta);
  assert.equal(constructionMaterialDiagnosis(site, { buildings: state.buildings, walkers: [carter],
    isRoad: ports.isRoad }).find(row => row.resource === 'timber')?.etaTicks, eta);
  assert.ok(route.path.some((tile, index) => {
    const from = route.path[index - 1];
    return from !== undefined && Math.abs(from.tx - tile.tx) + Math.abs(from.ty - tile.ty) === 2
      && (!ports.isRoad(from) || !ports.isRoad(tile));
  }));
  const diagonalIndex = route.path.findIndex((tile, index) => {
    const from = route.path[index - 1];
    return from !== undefined && Math.abs(from.tx - tile.tx) + Math.abs(from.ty - tile.ty) === 2
      && (!ports.isRoad(from) || !ports.isRoad(tile));
  });
  assert.ok(diagonalIndex > 0);
  const diagonalStart = route.path[diagonalIndex - 1];
  assert.ok(diagonalStart !== undefined);
  let moving: CarterWalker = { ...carter, pathIndex: diagonalIndex - 1, position: diagonalStart };
  let diagonalTicks = 0;
  while (moving.pathIndex < diagonalIndex && diagonalTicks < 50) {
    const result = stepCarters({ tick: state.tick + diagonalTicks, buildings: state.buildings,
      constructionSites: state.constructionSites, walkers: [moving], treasuryTimber: state.treasuryTimber,
      inventory: createDeliveryInventoryPort(), routes: ports });
    const next = result.walkers.find(walker => walker.kind === 'carter');
    assert.ok(next?.kind === 'carter' && next.cancellation === null);
    moving = next;
    diagonalTicks += 1;
  }
  assert.equal(diagonalTicks, Math.ceil(2 * WALL_CARRY_COST_FACTOR / BALANCE.CARTER_SPEED));
  const innerTile = route.path.find(tile => !ports.isRoad(tile));
  assert.ok(innerTile !== undefined);
  assert.equal(ports.canCarryForDestination?.(innerTile, { kind: 'construction_site', siteId: site.id }), true);
  const ordinary: ConstructionSite = { id: 'ordinary-site', kind: 'well', tx: 1, ty: 1,
    required: { timber: 10 }, delivered: {}, reserved: {}, builderTicks: 0,
    requiredBuilderTicks: 200, assignedBuilders: 1, stall: 'none', startedTick: 0 };
  const ordinaryPorts = createSimulationRoutePorts({ ...state, constructionSites: [...state.constructionSites, ordinary] }).delivery;
  assert.equal(ordinaryPorts.canCarryForDestination?.(innerTile, { kind: 'construction_site', siteId: ordinary.id }), false);
  const completed = { ...state, constructionSites: state.constructionSites.filter(candidate => candidate.id !== site.id),
    palisade: state.palisade === null ? null : { ...state.palisade,
      segments: state.palisade.segments.map(segment => segment.id === site.id
        ? { ...segment, completed: true, constructionSiteId: null } : segment) } };
  assert.equal(createSimulationRoutePorts(completed).delivery.canCarryForDestination?.(innerTile,
    { kind: 'construction_site', siteId: site.id }), true);
  const returnPath = [...route.path].reverse();
  const returner: CarterWalker = { ...carter, phase: 'returning',
    path: returnPath, pathIndex: 0, position: returnPath[0] ?? { tx: 0, ty: 0 } };
  const returning = stepCarters({ tick: completed.tick, buildings: completed.buildings,
    constructionSites: completed.constructionSites, walkers: [returner], treasuryTimber: completed.treasuryTimber,
    inventory: createDeliveryInventoryPort(), routes: createSimulationRoutePorts(completed).delivery });
  assert.ok(returning.walkers.some(walker => walker.kind === 'carter' && walker.cancellation === null));
});

test('T3: one anchored natural perimeter completes all segments without another road', t => {
  let state = connectedNaturalState();
  const baselineRoads = state.tiles.filter(tile => tile.hasRoad).length;
  const completed = new Map<string, number>();
  for (let count = 0; count < 70_000 && completed.size < 12; count += 1) {
    state = advanceTick(state);
    for (const segment of state.palisade?.segments ?? []) {
      if (segment.completed && !completed.has(segment.id)) completed.set(segment.id, state.tick);
    }
  }
  assert.equal(state.tiles.filter(tile => tile.hasRoad).length, baselineRoads);
  if (completed.size < 12) {
    const waiting = state.palisade?.segments.filter(segment => !segment.completed).map(segment => ({
      id: segment.id,
      site: state.constructionSites.find(site => site.id === segment.constructionSiteId),
    }));
    t.diagnostic(`Unfinished at tick ${state.tick}: ${JSON.stringify(waiting)}`);
  }
  assert.equal(completed.size, 12);
  t.diagnostic(`Completion ticks: ${[...completed].map(([id, tick]) => `${id}:${tick}`).join(', ')}`);
});

test('T4: first post-proclamation natural snapshot has no anchor and cannot progress without a road', t => {
  let state = afterPalisadeProclamation();
  const sites = state.constructionSites.filter(site => site.kind === 'palisade_segment');
  assert.equal(sites.length, 12);
  for (let count = 0; count < 12_000; count += 1) state = advanceTick(state);
  assert.equal(state.palisade?.segments.filter(segment => segment.completed).length, 0);
  t.diagnostic(`Natural minute-035 tick 46908 + 12000 unchanged roads: ${state.tick}, 0/12 complete; original minute-060 was tick 194386, 10/12 after player roads`);
});
