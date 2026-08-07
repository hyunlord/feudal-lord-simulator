import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingKind,
} from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import {
  CONSTRUCTION,
  advanceConstructionWork,
  canCompleteConstruction,
  constructionCancellationRefunds,
  constructionDeliveryNeed,
  constructionMaterialStatus,
  constructionOnSiteLabel,
  constructionSiteId,
  constructionStage,
  constructionStall,
  createConstructionSite,
  requiredConstructionMaterials,
} from "../src/economy/construction";

const BUILDING_KINDS = [
  "house",
  "well",
  "logging_camp",
  "sawmill",
  "mill",
  "storehouse",
  "granary",
  "chapel",
  "wheat_farm",
] as const satisfies readonly BuildingKind[];

test("BUILDING_CONFIG keeps the construction recipe inputs that the domain model mirrors", () => {
  // Given
  const expectedRecipes = {
    house: {},
    well: { timber: 10 },
    logging_camp: { timber: 15 },
    sawmill: { timber: 30 },
    mill: { timber: 30 },
    storehouse: { timber: 40 },
    granary: { timber: 40 },
    chapel: { timber: 40 },
    wheat_farm: { timber: 20 },
  } as const satisfies Record<BuildingKind, object>;

  // When
  const actualRecipes = Object.fromEntries(
    BUILDING_KINDS.map((kind) => [
      kind,
      BUILDING_CONFIG_BY_KIND[kind].buildCost,
    ]),
  );

  // Then
  assert.deepEqual(actualRecipes, expectedRecipes);
});

test("CONSTRUCTION constants pin builder capacity, visibility floor, and required work by building kind", () => {
  // Given / When / Then
  assert.equal(CONSTRUCTION.MAX_BUILDERS_PER_SITE, 3);
  assert.equal(CONSTRUCTION.MIN_VISIBLE_TICKS, 60);
  assert.deepEqual(CONSTRUCTION.REQUIRED_BUILDER_TICKS, {
    house: 240,
    well: 200,
    logging_camp: 400,
    sawmill: 600,
    mill: 600,
    storehouse: 800,
    granary: 800,
    chapel: 600,
    wheat_farm: 500,
  } satisfies Record<BuildingKind, number>);
});

test("createConstructionSite mirrors recipes and stores wall startedTick without creating finished progress", () => {
  // Given
  const site = createConstructionSite({
    ordinal: 9,
    kind: "mill",
    tx: 4,
    ty: 7,
    startedTick: 123,
  });

  // When / Then
  assert.deepEqual(site, {
    id: "construction-site-000009",
    kind: "mill",
    tx: 4,
    ty: 7,
    required: { timber: 30 },
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 600,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 123,
  });
  assert.deepEqual(requiredConstructionMaterials("house"), {});
});

test("constructionSiteId uses zero-padded ordinals so 9 sorts before 10 and increasing ordinals never reuse ids", () => {
  // Given
  const ids = [9, 10, 11].map(constructionSiteId);

  // When / Then
  assert.deepEqual(ids, [
    "construction-site-000009",
    "construction-site-000010",
    "construction-site-000011",
  ]);
  assert.deepEqual([...ids].sort(), ids);
  assert.equal(new Set(ids).size, ids.length);
});

test("constructionMaterialStatus reports delivered completeness and outstanding delivery need separately from reservations", () => {
  // Given
  const site = {
    ...createConstructionSite({ ordinal: 1, kind: "storehouse", tx: 0, ty: 0, startedTick: 0 }),
    delivered: { timber: 12 },
    reserved: { timber: 7 },
  };

  // When
  const status = constructionMaterialStatus(site);
  const deliveryNeed = constructionDeliveryNeed(site);

  // Then
  assert.deepEqual(status, {
    complete: false,
    delivered: { timber: 12 },
    outstanding: { timber: 28 },
  });
  assert.deepEqual(deliveryNeed, { timber: 21 });
});

test("constructionStall exercises all five exact stall values and separates source absence from missing routes", () => {
  // Given
  const waitingSite = {
    ...createConstructionSite({ ordinal: 1, kind: "well", tx: 3, ty: 3, startedTick: 0 }),
    delivered: { timber: 4 },
  };
  const completeSite = {
    ...waitingSite,
    delivered: { timber: 10 },
  };
  const activeSite = {
    ...completeSite,
    assignedBuilders: 1,
  };

  // When / Then
  assert.equal(
    constructionStall(waitingSite, [{ id: "store-1", stock: { timber: 12 }, hasRoute: true }]),
    "awaiting_materials",
  );
  assert.equal(
    constructionStall(waitingSite, [{ id: "store-1", stock: { timber: 12 }, hasRoute: false }]),
    "no_route",
  );
  assert.equal(constructionStall(waitingSite, []), "no_material_source");
  assert.equal(constructionStall(completeSite, []), "no_builders");
  assert.equal(constructionStall(activeSite, []), "none");
});

test("constructionOnSiteLabel returns exact Korean labels for each blocking cause", () => {
  // Given
  const site = {
    ...createConstructionSite({ ordinal: 1, kind: "well", tx: 0, ty: 0, startedTick: 0 }),
    delivered: { timber: 4 },
  };

  // When / Then
  assert.equal(constructionOnSiteLabel({ ...site, stall: "awaiting_materials" }), "🪵 목재 오는 중 (4/10)");
  assert.equal(constructionOnSiteLabel({ ...site, stall: "no_material_source" }), "🪵 창고에 목재 없음");
  assert.equal(constructionOnSiteLabel({ ...site, stall: "no_route" }), "🚧 창고에서 길이 이어지지 않음");
  assert.equal(constructionOnSiteLabel({ ...site, stall: "no_builders" }), "👷 일꾼 없음");
  assert.equal(constructionOnSiteLabel({ ...site, stall: "none" }), "");
});

test("constructionStage changes display-only appearance exactly at 25, 55, and 85 percent", () => {
  // Given
  const site = createConstructionSite({ ordinal: 1, kind: "house", tx: 0, ty: 0, startedTick: 0 });

  // When / Then
  assert.equal(constructionStage({ ...site, builderTicks: 59 }), "marked_plot");
  assert.equal(constructionStage({ ...site, builderTicks: 60 }), "foundation");
  assert.equal(constructionStage({ ...site, builderTicks: 131 }), "foundation");
  assert.equal(constructionStage({ ...site, builderTicks: 132 }), "frame");
  assert.equal(constructionStage({ ...site, builderTicks: 203 }), "frame");
  assert.equal(constructionStage({ ...site, builderTicks: 204 }), "roof");
});

test("advanceConstructionWork requires complete materials and assigned builders before accumulating work", () => {
  // Given
  const waitingForMaterials = {
    ...createConstructionSite({ ordinal: 1, kind: "well", tx: 0, ty: 0, startedTick: 0 }),
    assignedBuilders: 3,
  };
  const waitingForBuilders = {
    ...waitingForMaterials,
    delivered: { timber: 10 },
    assignedBuilders: 0,
  };
  const ready = {
    ...waitingForBuilders,
    assignedBuilders: 3,
    builderTicks: 198,
  };

  // When / Then
  assert.equal(advanceConstructionWork(waitingForMaterials).builderTicks, 0);
  assert.equal(advanceConstructionWork(waitingForBuilders).builderTicks, 0);
  assert.equal(advanceConstructionWork(ready).builderTicks, 200);
});

test("canCompleteConstruction enforces atomic material, builder tick, and minimum wall tick prerequisites", () => {
  // Given
  const ready = {
    ...createConstructionSite({ ordinal: 1, kind: "house", tx: 2, ty: 2, startedTick: 10 }),
    builderTicks: 240,
    assignedBuilders: 3,
  };
  const materialSite = {
    ...createConstructionSite({ ordinal: 2, kind: "well", tx: 3, ty: 3, startedTick: 10 }),
    delivered: { timber: 10 },
    builderTicks: 200,
    assignedBuilders: 3,
  };

  // When / Then
  assert.equal(canCompleteConstruction(ready, 70), true);
  assert.equal(canCompleteConstruction(ready, 69), false);
  assert.equal(canCompleteConstruction({ ...ready, builderTicks: 239 }, 70), false);
  assert.equal(canCompleteConstruction(materialSite, 70), true);
  assert.equal(canCompleteConstruction({ ...materialSite, delivered: { timber: 9 } }, 70), false);
});

test("constructionCancellationRefunds floors 60 percent delivered refunds and releases reserved materials fully", () => {
  // Given
  const site = {
    ...createConstructionSite({ ordinal: 1, kind: "storehouse", tx: 0, ty: 0, startedTick: 0 }),
    delivered: { timber: 17 },
    reserved: { timber: 5 },
  };

  // When
  const refunds = constructionCancellationRefunds(site);

  // Then
  assert.deepEqual(refunds, {
    deliveredRefund: { timber: 10 },
    deliveredLost: { timber: 7 },
    reservedRelease: { timber: 5 },
  });
});

test("construction helpers handle every resource without unsafe parser fallbacks", () => {
  // Given
  const required = {
    wheat: 4,
    bread: 3,
    logs: 2,
    timber: 1,
  } satisfies Partial<Record<ResourceType, number>>;
  const site = {
    ...createConstructionSite({ ordinal: 1, kind: "house", tx: 0, ty: 0, startedTick: 0 }),
    required,
    delivered: { wheat: 1, bread: 3, logs: 0, timber: 1 },
    reserved: { wheat: 1, logs: 1 },
  };

  // When / Then
  assert.deepEqual(constructionMaterialStatus(site).outstanding, { wheat: 3, logs: 2 });
  assert.deepEqual(constructionDeliveryNeed(site), { wheat: 2, logs: 1 });
});
