import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { GameState } from "../src/engine/engine.types";
import type { Building } from "../src/content/buildingConfig";
import { createPalisadeConstructionSite } from "../src/economy/construction";
import { completeEligibleConstruction } from "../src/engine/constructionLifecycle";
import { buildingRoadAccessTiles, constructionSiteRoadAccessTiles, resolveBuildingRoute } from "../src/engine/routing";

function fixture(): GameState {
  return { ...DEFAULT_GAME_STATE, width: 8, height: 8, buildings: [], houses: [], walkers: [], constructionSites: [],
    tiles: Array.from({ length: 64 }, (_, i) => ({ tx: i % 8, ty: Math.floor(i / 8), terrain: "grass", hasRoad: true, buildingId: null })),
    roadRevision: 7, pathCache: {}, wallTick: 10000,
    palisade: { id: "wall", gate: { x: 4, y: 7 }, polygon: [], segments: [{ id: "wall-site", order: 0,
      edgePath: [{ x: 4, y: 0 }, { x: 4, y: 4 }], tileCount: 4, completed: true, constructionSiteId: null, material: "timber" }] },
  };
}
function house(tx: number, ty: number): Building {
  return { id: `house-${tx}-${ty}`, kind: "house", tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

test("building access cannot connect through a completed wall, including a compound perimeter", () => {
  const state = fixture();
  assert.equal(buildingRoadAccessTiles(state, house(3, 1)).some(p => p.tx === 4 && p.ty === 1), false);
  const compound = { ...house(2, 1), houseLot: "horizontal" as const };
  assert.equal(buildingRoadAccessTiles(state, compound).some(p => p.tx === 4 && p.ty === 1), false);
  assert.equal(buildingRoadAccessTiles(state, house(3, 1)).some(p => p.tx === 2 && p.ty === 1), true);
});

test("building construction access is blocked across a completed wall", () => {
  const state = fixture();
  const site = { id: "build", kind: "well" as const, tx: 3, ty: 1, required: {}, delivered: {}, reserved: {},
    builderTicks: 0, requiredBuilderTicks: 100, assignedBuilders: 0, stall: "no_builders" as const, startedTick: 0 };
  assert.equal(constructionSiteRoadAccessTiles(state, site).some(p => p.tx === 4 && p.ty === 1), false);
});

test("wall completion invalidates a cached route while unfinished segments remain passable", () => {
  const base = fixture();
  assert.ok(base.palisade);
  const site = createPalisadeConstructionSite({ id: "wall-site", wallId: "wall", segmentIndex: 0, gateDistance: 0, order: 0,
    path: [{ x: 4, y: 0 }, { x: 4, y: 4 }], startedTick: 0 });
  const state: GameState = { ...base, constructionSites: [{ ...site, delivered: site.required, builderTicks: site.requiredBuilderTicks }],
    palisade: { ...base.palisade, segments: base.palisade.segments.map(s => ({ ...s, completed: false, constructionSiteId: site.id })) } };
  const source = house(1, 1), destination = house(6, 1);
  const before = resolveBuildingRoute(state, source, destination);
  assert.ok(before.path);
  const after = completeEligibleConstruction({ ...state, pathCache: before.pathCache });
  assert.equal(after.roadRevision, state.roadRevision + 1);
  assert.deepEqual(after.pathCache, {});
  const route = resolveBuildingRoute(after, source, destination).path;
  assert.ok(route);
  assert.ok(route.length > before.path.length, "new route must go around the completed wall");
  assert.equal(completeEligibleConstruction(after).roadRevision, after.roadRevision);
});

test("removing an auxiliary gate invalidates cached routes even when a loaded state's road revision is unchanged", () => {
  const base = fixture();
  assert.ok(base.palisade);
  const state: GameState = { ...base, palisade: { ...base.palisade, additionalGates: [{ x: 4, y: 2 }],
    segments: base.palisade.segments.map(segment => ({ ...segment, edgePath: [{ x: 4, y: 0 }, { x: 4, y: 8 }] })) } };
  const source = house(1, 1); const destination = house(6, 1);
  const before = resolveBuildingRoute(state, source, destination);
  assert.ok(before.path);
  assert.ok(state.palisade);
  const closed: GameState = { ...state, pathCache: before.pathCache, palisade: { ...state.palisade, additionalGates: [] } };
  const after = resolveBuildingRoute(closed, source, destination);
  assert.ok(after.path);
  assert.equal(closed.roadRevision, state.roadRevision);
  assert.ok(after.path.length > before.path.length);
  assert.ok(after.path.some(point => point.ty >= 6));
});

test("household demand routes detour around real walls and reject isolated households", async () => {
  const { createSimulationRoutePorts } = await import("../src/engine/simulationPorts");
  const { nextHouseDemandTile } = await import("../src/agents/roamingDemand");
  const base = fixture();
  const destination = house(6, 1);
  const start = { tx: 2, ty: 1 };
  const needy = { buildingId: destination.id, tx: 6, ty: 1, residents: 22, breadStock: 0, lastServicedTick: 0 };
  const state = { ...base, buildings: [destination] };
  const roaming = createSimulationRoutePorts(state).roaming;
  const path = roaming.servicePath?.(start, needy);
  assert.ok(path);
  assert.ok(path.some(tile => tile.ty >= 4), "must physically detour around wall end");
  assert.deepEqual(nextHouseDemandTile(start, [needy], roaming, 40), path[1]);
  assert.ok(base.palisade);
  const isolated = { ...state, palisade: { ...base.palisade, gate: { x: 20, y: 20 },
    segments: base.palisade.segments.map(segment => ({ ...segment, edgePath: [{ x: 4, y: 0 }, { x: 4, y: 8 }] })) } };
  assert.equal(nextHouseDemandTile(start, [needy], createSimulationRoutePorts(isolated).roaming, 40), null);
});
