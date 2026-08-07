import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG, type BuildingKind } from "../src/content/buildingConfig";
import {
  createConstructionSite,
  type ConstructionSite,
} from "../src/economy/construction";
import { advanceTick } from "../src/engine/tick";
import { placeBuilding, placeRoadLine } from "../src/engine/gameActions";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { getTile } from "../src/world/grid";

const VALID_ORIGINS = {
  house: { tx: 1, ty: 1 },
  well: { tx: 3, ty: 1 },
  storehouse: { tx: 5, ty: 1 },
  granary: { tx: 8, ty: 1 },
  chapel: { tx: 10, ty: 1 },
  wheat_farm: { tx: 11, ty: 1 },
  mill: { tx: 14, ty: 1 },
  logging_camp: { tx: 16, ty: 1 },
  sawmill: { tx: 18, ty: 1 },
} as const satisfies Record<BuildingKind, { readonly tx: number; readonly ty: number }>;

function constructionSites(state: GameState): readonly ConstructionSite[] {
  const sites = Reflect.get(state, "constructionSites");
  assert.ok(Array.isArray(sites), "constructionSites must be an array");
  return sites;
}

function wallTick(state: GameState): number {
  const value = Reflect.get(state, "wallTick");
  assert.equal(typeof value, "number", "wallTick must be a number");
  return value;
}

function nextConstructionOrdinal(state: GameState): number {
  const value = Reflect.get(state, "nextConstructionOrdinal");
  assert.equal(typeof value, "number", "nextConstructionOrdinal must be a number");
  return value;
}

function buildableSettlement(treasuryTimber = 500): GameState {
  const roadTxs = new Set(Array.from({ length: 22 }, (_unused, index) => index));
  return {
    ...DEFAULT_GAME_STATE,
    tiles: DEFAULT_GAME_STATE.tiles.map((tile) => ({
      ...tile,
      terrain: tile.tx === 17 && tile.ty === 2 ? "forest" : "grass",
      buildingId: null,
      hasRoad: tile.ty === 0 && roadTxs.has(tile.tx),
    })),
    buildings: [],
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber,
    roadRevision: 1,
    pathCache: {},
  };
}

function siteWorldWithCommitment(site: ConstructionSite, treasuryTimber: number): GameState {
  return Object.assign(buildableSettlement(treasuryTimber), {
    constructionSites: [site],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 2,
  });
}

test("placement identity site creation and direct tick semantics are explicit", () => {
  // Given
  const roaded = placeRoadLine(DEFAULT_GAME_STATE, { tx: 2, ty: 0 }, { tx: 4, ty: 0 });

  // When
  const invalid = placeBuilding(roaded, "house", { tx: 0, ty: 0 });
  const placed = placeBuilding(roaded, "well", { tx: 2, ty: 1 });
  const advanced = advanceTick(roaded);

  // Then
  assert.equal(invalid, roaded);
  assert.equal(placed.buildings.length, roaded.buildings.length);
  assert.equal(constructionSites(placed).at(-1)?.kind, "well");
  assert.equal(placed.houses.length, roaded.houses.length);
  assert.equal(advanced.tick, roaded.tick + 1);
});

test("placeBuilding creates one occupied construction site without finished consumers", () => {
  // Given
  const state = buildableSettlement();
  const origin = VALID_ORIGINS.storehouse;

  // When
  const next = placeBuilding(state, "storehouse", origin);

  // Then
  const [site] = constructionSites(next);
  assert.equal(constructionSites(next).length, 1);
  assert.equal(site?.kind, "storehouse");
  assert.equal(site?.id, "construction-site-000001");
  assert.equal(site?.startedTick, wallTick(state));
  assert.deepEqual(next.buildings, state.buildings);
  assert.deepEqual(next.houses, state.houses);
  assert.equal(next.treasuryTimber, state.treasuryTimber);
  assert.equal(getTile(next, { tx: 5, ty: 1 })?.buildingId, site?.id);
  assert.equal(getTile(next, { tx: 6, ty: 1 })?.buildingId, site?.id);
  assert.equal(getTile(next, { tx: 5, ty: 2 })?.buildingId, site?.id);
  assert.equal(getTile(next, { tx: 6, ty: 2 })?.buildingId, site?.id);
});

test("placeBuilding routes every building kind through site placement including houses", () => {
  // Given
  let state = buildableSettlement();

  // When
  for (const definition of BUILDING_CONFIG) {
    state = placeBuilding(state, definition.kind, VALID_ORIGINS[definition.kind]);
  }

  // Then
  assert.deepEqual(
    constructionSites(state).map((site) => site.kind),
    BUILDING_CONFIG.map((definition) => definition.kind),
  );
  assert.deepEqual(state.buildings, []);
  assert.deepEqual(state.houses, []);
});

test("construction site ids are stable zero-padded ordinals that sort after nine", () => {
  // Given
  let state: GameState = Object.assign(buildableSettlement(), {
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 9,
  });

  // When
  state = placeBuilding(state, "well", { tx: 3, ty: 1 });
  state = placeBuilding(state, "mill", { tx: 14, ty: 1 });

  // Then
  const ids = constructionSites(state).map((site) => site.id);
  assert.deepEqual(ids, ["construction-site-000009", "construction-site-000010"]);
  assert.deepEqual([...ids].sort(), ids);
  assert.equal(nextConstructionOrdinal(state), 11);
});

test("site commitments reject overcommitted placement without mutating state", () => {
  // Given
  const state = buildableSettlement(40);

  // When
  const first = placeBuilding(state, "storehouse", VALID_ORIGINS.storehouse);
  const rejected = placeBuilding(first, "granary", VALID_ORIGINS.granary);

  // Then
  assert.notEqual(first, state);
  assert.equal(rejected, first);
  assert.equal(constructionSites(first).length, 1);
  assert.equal(nextConstructionOrdinal(first), 2);
});

test("delivered and reserved construction materials reduce only uncommitted placement spend", () => {
  // Given
  const site = {
    ...createConstructionSite({
      ordinal: 1,
      kind: "storehouse",
      tx: 5,
      ty: 1,
      startedTick: 0,
    }),
    delivered: { timber: 10 },
    reserved: { timber: 15 },
  };
  const state = siteWorldWithCommitment(site, 55);

  // When
  const accepted = placeBuilding(state, "storehouse", VALID_ORIGINS.granary);
  const rejected = placeBuilding(accepted, "wheat_farm", VALID_ORIGINS.wheat_farm);

  // Then
  assert.notEqual(accepted, state);
  assert.equal(rejected, accepted);
  assert.equal(constructionSites(accepted).length, 2);
  assert.equal(nextConstructionOrdinal(accepted), 3);
});

test("advance frame applies speed as deterministic substeps while wall time advances once", () => {
  // Given
  const state = buildableSettlement();

  // When
  const direct = advanceTick(state);
  const framed = gameReducer(state, { type: "advance_frame", speed: 5 });

  // Then
  assert.equal(direct.tick, state.tick + 1);
  assert.equal(framed.tick, state.tick + 5);
  assert.equal(wallTick(framed), wallTick(state) + 1);
});

test("advanceTick advances one simulation tick and one wall tick for direct harness paths", () => {
  // Given
  const state = buildableSettlement();

  // When
  const next = advanceTick(state);

  // Then
  assert.equal(next.tick, state.tick + 1);
  assert.equal(wallTick(next), wallTick(state) + 1);
});

test("sixty direct advanceTick calls satisfy the construction wall-time floor and complete ready sites", () => {
  // Given
  const initialSite = createConstructionSite({
    ordinal: 1,
    kind: "well",
    tx: 3,
    ty: 1,
    startedTick: 0,
  });
  const readySite = {
    ...initialSite,
    delivered: initialSite.required,
    builderTicks: initialSite.requiredBuilderTicks,
  };
  let state: GameState = Object.assign(buildableSettlement(), {
    constructionSites: [readySite],
    wallTick: 0,
  });

  // When
  for (let tick = 0; tick < 60; tick += 1) {
    state = advanceTick(state);
  }

  // Then
  assert.equal(wallTick(state), 60);
  assert.deepEqual(constructionSites(state), []);
  assert.equal(state.buildings.find(({ id }) => id === readySite.id)?.kind, "well");
});
