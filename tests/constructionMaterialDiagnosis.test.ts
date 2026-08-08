import assert from "node:assert/strict";
import test from "node:test";

import type { CarterWalker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import type { ConstructionSite } from "../src/economy/construction";
import {
  constructionMaterialDiagnosis,
} from "../src/ui/constructionMaterialDiagnosis";

function building(id: string, kind: Building["kind"], tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function site(input: {
  readonly stall?: ConstructionSite["stall"];
  readonly required?: ConstructionSite["required"];
  readonly delivered?: ConstructionSite["delivered"];
  readonly reserved?: ConstructionSite["reserved"];
} = {}): ConstructionSite {
  return {
    id: "construction-site-000001",
    kind: "sawmill",
    tx: 4,
    ty: 4,
    required: input.required ?? { timber: 30 },
    delivered: input.delivered ?? { timber: 12 },
    reserved: input.reserved ?? { timber: 8 },
    builderTicks: 0,
    requiredBuilderTicks: 600,
    assignedBuilders: 0,
    stall: input.stall ?? "awaiting_materials",
    startedTick: 0,
  };
}

function carter(input: {
  readonly id: string;
  readonly resource?: "timber" | "stone";
  readonly cancelled?: boolean;
  readonly pathIndex?: number;
}): CarterWalker {
  const resource = input.resource ?? "timber";
  return {
    id: input.id,
    kind: "carter",
    homeBuildingId: "source-store",
    destination: { kind: "construction_site", siteId: "construction-site-000001" },
    mission: "deliver",
    phase: "outbound",
    position: { tx: 2.5, ty: 1 },
    path: [
      { tx: 2, ty: 1 },
      { tx: 3, ty: 1 },
      { tx: 4, ty: 2 },
      { tx: 4, ty: 4 },
    ],
    pathIndex: input.pathIndex ?? 0,
    previousTile: null,
    cargo: { resource, amount: 8 },
    spawnedTick: 120,
    reservation: {
      destination: { kind: "construction_site", siteId: "construction-site-000001" },
      resource,
      amount: 8,
      sourceStockClaim: {
        kind: "building",
        buildingId: "source-store",
        resource,
        amount: 8,
      },
      homeCapacityClaim: null,
    },
    cancellation: input.cancelled === true
      ? { tick: 130, reason: "road_removed", releasedReservation: true }
      : null,
  };
}

test("Given an active material carter When diagnosing a construction site Then it names source direction distance carrier and ETA", () => {
  // Given
  const target = site();
  const source = building("source-store", "storehouse", 2, 1);

  // When
  const diagnostics = constructionMaterialDiagnosis(target, {
    buildings: [source],
    walkers: [
      carter({ id: "carter-z" }),
      carter({ id: "carter-a", pathIndex: 1 }),
    ],
  });

  // Then
  assert.equal(diagnostics.length, 1);
  assert.deepEqual(diagnostics[0], {
    resource: "timber",
    label: "목재 12/30 · 예약 8 · 창고 북서쪽 5칸 · 운반 carter-a · 남은 길 4.5칸 · 예상 33틱",
    delivered: 12,
    required: 30,
    reserved: 8,
    sourceLabel: "창고",
    sourceDirectionLabel: "북서쪽",
    sourceDistance: 5,
    carrierId: "carter-a",
    remainingPathDistance: 4.5,
    etaTicks: 33,
  });
});

test("Given a carter between road tiles When diagnosing ETA Then remaining distance starts at its live position", () => {
  const carrier = carter({ id: "carter-mid", pathIndex: 0 });
  const diagnostics = constructionMaterialDiagnosis(site(), {
    buildings: [building("source-store", "storehouse", 2, 1)],
    walkers: [carrier],
  });

  assert.equal(diagnostics[0]?.remainingPathDistance, 4.5);
  assert.equal(diagnostics[0]?.etaTicks, 33);
});

test("Given a cancelled material carter When diagnosing a construction site Then stale carrier and ETA are not shown", () => {
  // Given
  const target = site();

  // When
  const diagnostics = constructionMaterialDiagnosis(target, {
    buildings: [building("source-store", "storehouse", 2, 1)],
    walkers: [carter({ id: "carter-a", cancelled: true })],
  });

  // Then
  assert.deepEqual(diagnostics.map((diagnosis) => diagnosis.label), [
    "목재 12/30 · 예약 8 · 배정된 운반인 없음 · ETA 확인 불가",
  ]);
  assert.equal(diagnostics[0]?.carrierId, null);
  assert.equal(diagnostics[0]?.etaTicks, null);
});

test("Given no source or disconnected material state When diagnosing a site Then copy is honest without fake ETA", () => {
  // Given / When
  const noSource = constructionMaterialDiagnosis(site({
    stall: "no_material_source",
    delivered: {},
    reserved: {},
  }), { buildings: [], walkers: [] });
  const disconnected = constructionMaterialDiagnosis(site({
    stall: "no_route",
    delivered: {},
    reserved: {},
  }), {
    buildings: [building("source-store", "storehouse", 2, 1)],
    walkers: [],
  });

  // Then
  assert.deepEqual(noSource.map((diagnosis) => diagnosis.label), [
    "목재 0/30 · 공급처 없음 · ETA 확인 불가",
  ]);
  assert.deepEqual(disconnected.map((diagnosis) => diagnosis.label), [
    "목재 0/30 · 공급처까지 도로 없음 · ETA 확인 불가",
  ]);
});
