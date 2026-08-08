import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { CONSTRUCTION, createConstructionSite } from "../src/economy/construction";
import { placeBuilding } from "../src/engine/gameActions";
import type { GameState } from "../src/engine/engine.types";
import { buildingBodyProfile } from "../src/render/buildingVisualState";
import { buildToolAffordability, buildToolTooltipLines } from "../src/ui/buildMenuModel";
import { canPlaceBuilding, PlacementFailure } from "../src/world/placement";
import type { Tile } from "../src/world/world.types";

const VALID_ORIGINS = {
  church: { tx: 3, ty: 2 },
  keep: { tx: 7, ty: 2 },
} as const satisfies Record<"church" | "keep", { readonly tx: number; readonly ty: number }>;

function tile(tx: number, ty: number, hasRoad = false): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad };
}

function storehouse(stock: Partial<Building["inventory"]>): Building {
  return {
    id: "store",
    kind: "storehouse",
    tx: 0,
    ty: 0,
    workers: 0,
    inventory: stock,
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function world(input: {
  readonly era?: GameState["era"];
  readonly timber?: number;
  readonly stone?: number;
  readonly roadY?: number;
  readonly buildings?: readonly Building[];
  readonly constructionSites?: GameState["constructionSites"];
} = {}): GameState {
  const roadY = input.roadY ?? 1;
  const width = 12;
  const height = 7;
  return {
    tick: 0,
    seed: 1,
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index) =>
      tile(index % width, Math.floor(index / width), Math.floor(index / width) === roadY),
    ),
    buildings: [...(input.buildings ?? [storehouse({ stone: input.stone ?? 0 })])],
    constructionSites: [...(input.constructionSites ?? [])],
    wallTick: 0,
    era: input.era ?? "stone_town",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: input.timber ?? 0,
    treasuryCoin: 0,
    roadRevision: 1,
    pathCache: {},
    forestHarvests: [],
  };
}

test("Given Stone Town When reading civic building config Then church and keep have exact contracts", () => {
  // Given / When
  const church = BUILDING_CONFIG_BY_KIND.church;
  const keep = BUILDING_CONFIG_BY_KIND.keep;

  // Then
  assert.deepEqual(church, {
    kind: "church",
    name: "교회",
    width: 2,
    height: 2,
    workersRequired: 0,
    buildCost: { timber: 100, stone: 60 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "stone_town",
    production: null,
    storageCapacity: 0,
    serviceRadius: 12,
  });
  assert.deepEqual(keep, {
    kind: "keep",
    name: "성채",
    width: 2,
    height: 2,
    workersRequired: 0,
    buildCost: { stone: 150 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "stone_town",
    production: null,
    storageCapacity: 0,
    serviceRadius: 0,
  });
  assert.equal(BUILDING_CONFIG_BY_KIND.chapel.serviceRadius, 0);
  assert.equal(CONSTRUCTION.REQUIRED_BUILDER_TICKS.church, 900);
  assert.equal(CONSTRUCTION.REQUIRED_BUILDER_TICKS.keep, 1200);
});

test("Given earlier eras When placing church or keep Then they stay locked until Stone Town", () => {
  // Given
  const hamlet = world({ era: "hamlet", timber: 300, stone: 300 });
  const palisade = world({ era: "palisade", timber: 300, stone: 300 });
  const stoneTown = world({ era: "stone_town", timber: 300, stone: 300 });

  // When / Then
  for (const kind of ["church", "keep"] as const satisfies readonly BuildingKind[]) {
    const origin = VALID_ORIGINS[kind];
    assert.deepEqual(canPlaceBuilding(hamlet, kind, origin.tx, origin.ty), {
      ok: false,
      reason: PlacementFailure.locked_era,
    });
    assert.deepEqual(canPlaceBuilding(palisade, kind, origin.tx, origin.ty), {
      ok: false,
      reason: PlacementFailure.locked_era,
    });
    assert.deepEqual(canPlaceBuilding(stoneTown, kind, origin.tx, origin.ty), { ok: true });
  }
});

test("Given multi-resource costs When spending is committed Then placement and menu report exact shortages", () => {
  // Given
  const churchSite = createConstructionSite({
    ordinal: 1,
    kind: "church",
    tx: 3,
    ty: 2,
    startedTick: 0,
  });
  const state = world({
    timber: 120,
    stone: 80,
    constructionSites: [
      {
        ...churchSite,
        delivered: { timber: 40 },
        reserved: { stone: 20 },
      },
    ],
  });

  // When
  const placement = canPlaceBuilding(state, "church", 7, 2);
  const affordability = buildToolAffordability("church", state);
  const tooltip = buildToolTooltipLines("church", state);

  // Then
  assert.deepEqual(placement, {
    ok: false,
    reason: PlacementFailure.insufficient_materials,
    shortfalls: { timber: 40, stone: 20 },
  });
  assert.deepEqual(affordability, {
    affordable: false,
    shortfalls: { timber: 40, stone: 20 },
    spendable: { timber: 60, stone: 40 },
    shortfall: 40,
    spendableTimber: 60,
  });
  assert.ok(tooltip.includes("비용 목재 100 · 석재 60"));
  assert.ok(tooltip.includes("건설 불가 · 부족 목재 40 · 석재 20"));
});

test("Given exact stone stock When placing keep Then it creates a stone-only construction site", () => {
  // Given
  const state = world({ timber: 0, stone: 150 });

  // When
  const next = placeBuilding(state, "keep", VALID_ORIGINS.keep);

  // Then
  const [site] = next.constructionSites;
  assert.equal(site?.kind, "keep");
  assert.deepEqual(site?.required, { stone: 150 });
  assert.equal(next.buildings.length, state.buildings.length);
});

test("Given fallback profiles When comparing civic buildings Then keep is the tallest non-house profile", () => {
  // Given / When
  const profiles = (Object.keys(BUILDING_CONFIG_BY_KIND) as BuildingKind[]).map((kind) => ({
    kind,
    profile: buildingBodyProfile(kind, kind === "house" ? 4 : 0),
  }));
  const keep = profiles.find((entry) => entry.kind === "keep");
  assert.ok(keep !== undefined);
  const keepHeight = keep.profile.height + keep.profile.roof;

  // Then
  for (const entry of profiles) {
    if (entry.kind === "keep" || entry.kind === "house") continue;
    assert.ok(keepHeight > entry.profile.height + entry.profile.roof, `${entry.kind} is taller than keep`);
  }
});
