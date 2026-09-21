import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { GameState } from "../src/engine/engine.types";
import { recomputeConstructionStalls, completeEligibleConstruction } from "../src/engine/constructionLifecycle";
import { createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { advanceTick } from "../src/engine/tick";

function fixture(): GameState {
  return { ...DEFAULT_GAME_STATE, width: 16, height: 5, tick: 6000, wallTick: 6000,
    population: 0, houses: [], walkers: [], palisade: null, treasuryTimber: 0, pathCache: {}, roadRevision: 7,
    buildings: [{ id: "source", kind: "storehouse", tx: 1, ty: 1, workers: 0,
      inventory: { timber: 40 }, stockReserved: {}, reserved: {}, productionProgress: 0 }],
    constructionSites: [{ id: "target", kind: "mill", tx: 13, ty: 2, required: { timber: 30 },
      delivered: {}, reserved: {}, builderTicks: 0, requiredBuilderTicks: 600,
      assignedBuilders: 0, stall: "no_builders", startedTick: 6000 }],
    tiles: Array.from({ length: 80 }, (_, i) => ({ tx: i % 16, ty: Math.floor(i / 16),
      terrain: "grass", buildingId: null, hasRoad: Math.floor(i / 16) === 3 })),
  };
}
const key = "road:7:source->construction_site:target";

test("Given material stock When recomputing stalls with shared ports Then successful routes remain reusable", () => {
  const state = fixture();
  const ports = createSimulationRoutePorts(state);
  const expected = recomputeConstructionStalls(state);
  const actual = recomputeConstructionStalls(state, ports.delivery);
  assert.deepEqual(actual, expected);
  const cached = ports.getPathCache()[key];
  assert.ok(cached);
  recomputeConstructionStalls(state, ports.delivery);
  assert.equal(ports.getPathCache()[key], cached);
});

test("Given a busy source carter When advancing a tick Then stall-only routes persist without changing cargo", () => {
  const dispatched = advanceTick(fixture());
  assert.ok(dispatched.walkers.some(walker => walker.kind === "carter"));
  const next = advanceTick({ ...dispatched, pathCache: {} });
  assert.ok(next.pathCache[key]);
  assert.deepEqual(next.walkers.map(walker => walker.cargo), dispatched.walkers.map(walker => walker.cargo));
});

for (const change of ["progress", "empty-stock", "reserved-stock", "delivered", "reserved-site"] as const) {
  test(`Given stable geometry When ${change} changes Then shared routes preserve current material stall results`, () => {
    const state = fixture();
    const ports = createSimulationRoutePorts(state);
    recomputeConstructionStalls(state, ports.delivery);
    const changed: GameState = { ...state,
      buildings: state.buildings.map(building => ({ ...building,
        inventory: change === "empty-stock" ? {} : building.inventory,
        stockReserved: change === "reserved-stock" ? { timber: 40 } : {},
      })),
      constructionSites: state.constructionSites.map(site => ({ ...site,
        builderTicks: change === "progress" ? 10 : 0,
        delivered: change === "delivered" ? { timber: 30 } : {},
        reserved: change === "reserved-site" ? { timber: 30 } : {},
      })),
    };
    assert.deepEqual(recomputeConstructionStalls(changed, ports.delivery), recomputeConstructionStalls(changed));
  });
}

test("Given a cached route When road revision disconnects it Then null routes and material stalls remain uncached", () => {
  const state = fixture();
  const ports = createSimulationRoutePorts(state);
  recomputeConstructionStalls(state, ports.delivery);
  const changed = { ...state, roadRevision: 8, pathCache: ports.getPathCache(),
    tiles: state.tiles.map(tile => ({ ...tile, hasRoad: false })) };
  const disconnected = createSimulationRoutePorts(changed);
  assert.deepEqual(recomputeConstructionStalls(changed, disconnected.delivery), recomputeConstructionStalls(changed));
  assert.equal(disconnected.delivery.fromBuildingToDestination("source", { kind: "construction_site", siteId: "target" }), null);
  assert.deepEqual(disconnected.getPathCache(), changed.pathCache);
});

test("Given cached material routes When source or site is removed Then a new substep port rejects the absent identity", () => {
  const state = fixture();
  const ports = createSimulationRoutePorts(state);
  recomputeConstructionStalls(state, ports.delivery);
  for (const changed of [{ ...state, buildings: [] }, { ...state, constructionSites: [] }]) {
    const next = createSimulationRoutePorts({ ...changed, pathCache: ports.getPathCache() });
    assert.equal(next.delivery.fromBuildingToDestination("source", { kind: "construction_site", siteId: "target" }), null);
    assert.deepEqual(recomputeConstructionStalls(changed, next.delivery), recomputeConstructionStalls(changed));
  }
});

test("Given a completed building site When completion follows the substep Then old site routes cannot resolve its new building identity", () => {
  const state = fixture();
  const ports = createSimulationRoutePorts(state);
  recomputeConstructionStalls(state, ports.delivery);
  const completed = completeEligibleConstruction({ ...state, wallTick: 10000, pathCache: ports.getPathCache(),
    constructionSites: state.constructionSites.map(site => ({ ...site, delivered: site.required, builderTicks: site.requiredBuilderTicks })) });
  assert.equal(completed.constructionSites.length, 0);
  assert.ok(completed.buildings.some(building => building.id === "target"));
  const next = createSimulationRoutePorts(completed);
  assert.equal(next.delivery.fromBuildingToDestination("source", { kind: "construction_site", siteId: "target" }), null);
  assert.ok(next.delivery.betweenBuildings("source", "target"));
});

test("Given a cached construction route through a gate When that gate closes Then wall topology prevents reuse", () => {
  const base = fixture();
  const state: GameState = { ...base, palisade: { id: "wall", gate: { x: 8, y: 3.5 }, polygon: [],
    segments: [{ id: "barrier", order: 0, edgePath: [{ x: 8, y: 0 }, { x: 8, y: 5 }],
      tileCount: 5, completed: true, constructionSiteId: null, material: "timber" }] } };
  const ports = createSimulationRoutePorts(state);
  recomputeConstructionStalls(state, ports.delivery);
  assert.equal(Object.keys(ports.getPathCache()).length, 1);
  assert.ok(state.palisade);
  const changed: GameState = { ...state, pathCache: ports.getPathCache(),
    palisade: { ...state.palisade, gate: { x: 8, y: 0 } } };
  const closed = createSimulationRoutePorts(changed);
  assert.equal(closed.delivery.fromBuildingToDestination("source", { kind: "construction_site", siteId: "target" }), null);
  assert.deepEqual(recomputeConstructionStalls(changed, closed.delivery), recomputeConstructionStalls(changed));
  assert.deepEqual(closed.getPathCache(), changed.pathCache);
});
