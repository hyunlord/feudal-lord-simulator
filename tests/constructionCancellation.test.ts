import assert from "node:assert/strict";
import test from "node:test";

import { cancelConstruction } from "../src/engine/constructionCancellation";
import type { GameState } from "../src/engine/engine.types";
import {
  constructionSiteAnchor,
  createPalisadeConstructionSite,
  type BuildingConstructionSite,
  type ConstructionSite,
} from "../src/economy/construction";
import type { CarterWalker, Walker } from "../src/agents/walker.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { DELIVERY_INVENTORY, building, line, routePort } from "./deliveryFixtures";

function site(
  input: {
    readonly delivered?: ConstructionSite["delivered"];
    readonly reserved?: ConstructionSite["reserved"];
    readonly assignedBuilders?: number;
  } = {},
): BuildingConstructionSite {
  return {
    id: "construction-site-000001",
    kind: "well",
    tx: 2,
    ty: 3,
    required: { timber: 20 },
    delivered: input.delivered ?? {},
    reserved: input.reserved ?? {},
    builderTicks: 0,
    requiredBuilderTicks: 200,
    assignedBuilders: input.assignedBuilders ?? 0,
    stall: "awaiting_materials",
    startedTick: 0,
  };
}

function state(input: {
  readonly constructionSite: ConstructionSite;
  readonly buildings?: GameState["buildings"];
  readonly walkers?: readonly Walker[];
  readonly idleWorkers?: number;
  readonly treasuryTimber?: number;
}): GameState {
  const target = input.constructionSite;
  const anchor = constructionSiteAnchor(target);
  return {
    ...DEFAULT_GAME_STATE,
    buildings: [...(input.buildings ?? [])],
    constructionSites: [target],
    walkers: [...(input.walkers ?? [])],
    idleWorkers: input.idleWorkers ?? 0,
    treasuryTimber: input.treasuryTimber ?? 0,
    tiles: DEFAULT_GAME_STATE.tiles.map((tile) =>
      tile.tx === anchor.tx && tile.ty === anchor.ty
        ? { ...tile, buildingId: target.id }
        : tile,
    ),
  };
}

function siteCarter(input: {
  readonly cargoAmount: number;
  readonly phase?: CarterWalker["phase"];
  readonly cancellation?: CarterWalker["cancellation"];
}): CarterWalker {
  return {
    id: "carter:store-a:10",
    kind: "carter",
    mission: "deliver",
    phase: input.phase ?? "outbound",
    homeBuildingId: "store-a",
    destination: { kind: "construction_site", siteId: "construction-site-000001" },
    reservation: {
      destination: { kind: "construction_site", siteId: "construction-site-000001" },
      resource: "timber",
      amount: input.cargoAmount,
      sourceStockClaim: {
        kind: "building",
        buildingId: "store-a",
        resource: "timber",
        amount: input.cargoAmount,
      },
      homeCapacityClaim: null,
    },
    position: { tx: 2, ty: 3 },
    path: line([0, 0], [1, 0], [2, 0]),
    pathIndex: 2,
    previousTile: null,
    cargo: { resource: "timber", amount: input.cargoAmount },
    spawnedTick: 10,
    cancellation: input.cancellation ?? null,
  };
}

test("cancelConstruction refunds delivered sixty percent and stranded reservations fully to nearest compatible stores", () => {
  // Given
  const target = site({
    delivered: { timber: 12, bread: 5 },
    reserved: { timber: 8, bread: 3 },
  });
  const farStore = building("store-z", "storehouse", { tx: 20, ty: 20 });
  const nearStore = building("store-a", "storehouse", { tx: 4, ty: 3 });
  const granary = building("granary-a", "granary", { tx: 2, ty: 6 });

  // When
  const result = cancelConstruction({
    state: state({ constructionSite: target, buildings: [farStore, nearStore, granary] }),
    siteId: target.id,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}),
  });

  // Then
  assert.deepEqual(result.ledger.deliveredRefund, { bread: 3, timber: 7 });
  assert.deepEqual(result.ledger.reservedRefund, { bread: 3, timber: 8 });
  assert.deepEqual(result.ledger.dropped, {});
  assert.deepEqual(result.state.buildings.find(({ id }) => id === "store-a")?.inventory, {
    timber: 15,
  });
  assert.deepEqual(result.state.buildings.find(({ id }) => id === "granary-a")?.inventory, {
    bread: 6,
  });
  assert.equal(result.state.constructionSites.length, 0);
  assert.equal(result.state.tiles.find((tile) => tile.tx === 2 && tile.ty === 3)?.buildingId, null);
});

test("cancelConstruction uses id tie-breaks, skips full stores, and explicitly drops non-timber no-destination refunds", () => {
  // Given
  const target = site({ delivered: { timber: 10, bread: 2 }, reserved: {} });
  const fullStore = building("store-a", "storehouse", {
    tx: 1,
    ty: 3,
    inventory: { logs: 200 },
  });
  const tieWinner = building("store-b", "storehouse", { tx: 3, ty: 3 });
  const tieLoser = building("store-c", "storehouse", { tx: 1, ty: 5 });

  // When
  const result = cancelConstruction({
    state: state({
      constructionSite: target,
      buildings: [tieLoser, fullStore, tieWinner],
      treasuryTimber: 2,
    }),
    siteId: target.id,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}),
  });

  // Then
  assert.deepEqual(result.state.buildings.find(({ id }) => id === "store-b")?.inventory, {
    timber: 6,
  });
  assert.deepEqual(result.ledger.treasuryRefund, {});
  assert.deepEqual(result.ledger.dropped, { bread: 1 });
  assert.equal(result.state.treasuryTimber, 2);
});

test("cancelConstruction falls timber back to treasury only when no compatible store accepts it", () => {
  // Given
  const target = site({ delivered: { timber: 12 }, reserved: { timber: 8 } });

  // When
  const result = cancelConstruction({
    state: state({
      constructionSite: target,
      buildings: [building("granary-a", "granary")],
      treasuryTimber: 3,
    }),
    siteId: target.id,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}),
  });

  // Then
  assert.deepEqual(result.ledger.treasuryRefund, { timber: 15 });
  assert.deepEqual(result.ledger.dropped, {});
  assert.equal(result.state.treasuryTimber, 18);
});

test("cancelConstruction manually cancels active site carters and leaves in-flight cargo to the return lifecycle", () => {
  // Given
  const target = site({ delivered: { timber: 12 }, reserved: { timber: 8 }, assignedBuilders: 3 });
  const carter = siteCarter({ cargoAmount: 8 });
  const store = building("store-a", "storehouse", { tx: 0, ty: 0, inventory: { timber: 4 } });

  // When
  const result = cancelConstruction({
    state: state({
      constructionSite: target,
      buildings: [store],
      walkers: [
        carter,
        { id: "builder:construction-site-000001:0", kind: "builder", homeBuildingId: target.id, siteId: target.id, slotIndex: 0, position: { tx: 2.25, ty: 3.25 }, path: [], pathIndex: 0, previousTile: null, cargo: null, spawnedTick: 0 },
      ],
      idleWorkers: 1,
    }),
    siteId: target.id,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({ "2,0->store-a": line([2, 0], [1, 0], [0, 0]) }),
  });
  const returning = result.state.walkers.find(
    (walker): walker is CarterWalker => walker.kind === "carter",
  );

  // Then
  assert.deepEqual(result.ledger.deliveredRefund, { timber: 7 });
  assert.deepEqual(result.ledger.reservedRefund, {});
  assert.equal(returning?.phase, "returning");
  assert.equal(returning?.cancellation?.reason, "manual");
  assert.deepEqual(returning?.cargo, { resource: "timber", amount: 8 });
  assert.equal(result.state.walkers.some((walker) => walker.kind === "builder"), false);
  assert.equal(result.state.idleWorkers, 4);
});

test("cancelConstruction is idempotent after the site is already absent", () => {
  // Given
  const current = state({
    constructionSite: site({ delivered: { timber: 12 }, reserved: { timber: 8 } }),
    buildings: [building("store-a", "storehouse")],
  });
  const first = cancelConstruction({
    state: current,
    siteId: "construction-site-000001",
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}),
  });

  // When
  const second = cancelConstruction({
    state: first.state,
    siteId: "construction-site-000001",
    inventory: DELIVERY_INVENTORY,
    routes: routePort({}),
  });

  // Then
  assert.equal(second.state, first.state);
  assert.deepEqual(second.ledger.deliveredRefund, {});
  assert.deepEqual(second.ledger.reservedRefund, {});
  assert.deepEqual(second.ledger.dropped, {});
});

test("cancelConstruction leaves proclaimed palisade segments unchanged without refunds or cargo cleanup", () => {
  // Given
  const wallSite = createPalisadeConstructionSite({
    id: "wall-a-segment-000",
    wallId: "wall-a",
    segmentIndex: 0,
    gateDistance: 0,
    order: 0,
    path: [{ x: 2, y: 3 }, { x: 4, y: 3 }],
    startedTick: 0,
  });
  const current = state({
    constructionSite: {
      ...wallSite,
      delivered: { timber: 12 },
      reserved: { timber: 8 },
      assignedBuilders: 3,
    },
    buildings: [building("store-a", "storehouse", { tx: 0, ty: 0 })],
    walkers: [siteCarter({ cargoAmount: 8 })],
    idleWorkers: 1,
  });
  const proclaimed: GameState = {
    ...current,
    era: "palisade",
    eraProclaimedTick: 0,
    palisade: {
      id: "wall-a",
      polygon: [{ x: 2, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 5 }, { x: 2, y: 5 }, { x: 2, y: 3 }],
      gate: { x: 2, y: 3 },
      segments: [{
        id: "wall-a-segment-000",
        order: 0,
        edgePath: wallSite.path,
        tileCount: 2,
        completed: false,
        constructionSiteId: wallSite.id,
      }],
    },
  };

  // When
  const result = cancelConstruction({
    state: proclaimed,
    siteId: wallSite.id,
    inventory: DELIVERY_INVENTORY,
    routes: routePort({ "2,0->store-a": line([2, 0], [1, 0], [0, 0]) }),
  });

  // Then
  assert.equal(result.state, proclaimed);
  assert.deepEqual(result.ledger.deliveredRefund, {});
  assert.deepEqual(result.ledger.reservedRefund, {});
  assert.deepEqual(result.ledger.treasuryRefund, {});
  assert.deepEqual(result.ledger.dropped, {});
});
