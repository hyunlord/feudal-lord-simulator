import assert from "node:assert/strict";
import test from "node:test";

import type { ConstructionSite } from "../src/economy/construction";
import { createPalisadeConstructionSite } from "../src/economy/construction";
import { constructionSiteCardModel } from "../src/ui/constructionSiteCardModel";

const SITE = {
  id: "construction-site-000001",
  kind: "sawmill",
  tx: 4,
  ty: 7,
  required: { timber: 30 },
  delivered: { timber: 12 },
  reserved: { timber: 8 },
  builderTicks: 120,
  requiredBuilderTicks: 600,
  assignedBuilders: 2,
  stall: "no_route",
  startedTick: 9,
} as const satisfies ConstructionSite;

test("construction site card model exposes four separate progress rows and an actionable route label", () => {
  // Given / When
  const model = constructionSiteCardModel(SITE);

  // Then
  assert.equal(model.siteId, "construction-site-000001");
  assert.equal(model.name, "제재소 부지");
  assert.equal(model.currentStallLabel, "🚧 창고에서 길이 이어지지 않음");
  assert.deepEqual(
    model.rows.map((row) => row.label),
    ["부지", "자재 확보", "자재 배달", "건축 작업"],
  );
  assert.deepEqual(
    model.rows.map((row) => row.value),
    [
      "4, 7 · 제재소",
      "목재 12/30 확보 · 예약 8",
      "목재 10 남음",
      "120/600틱 · 일꾼 2명",
    ],
  );
  assert.doesNotMatch(JSON.stringify(model), /no_route/);
});

test("construction site card model keeps no-material sites split without inventing a combined bar", () => {
  // Given
  const houseSite = {
    ...SITE,
    kind: "house",
    required: {},
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 240,
    assignedBuilders: 0,
    stall: "no_builders",
  } satisfies ConstructionSite;

  // When
  const model = constructionSiteCardModel(houseSite);

  // Then
  assert.equal(model.name, "오두막 부지");
  assert.equal(model.currentStallLabel, "👷 일꾼 없음");
  assert.deepEqual(model.rows, [
    { label: "부지", value: "4, 7 · 오두막" },
    { label: "자재 확보", value: "필요 없음" },
    { label: "자재 배달", value: "배달 대기 없음" },
    { label: "건축 작업", value: "0/240틱 · 일꾼 0명" },
  ]);
  assert.doesNotMatch(JSON.stringify(model), /no_builders/);
});

test("construction site card model reuses resource-aware material stall labels", () => {
  // Given
  const materialSite = {
    ...SITE,
    required: { timber: 12 },
    delivered: { timber: 4 },
    reserved: {},
  } satisfies ConstructionSite;

  // When / Then
  assert.equal(
    constructionSiteCardModel({ ...materialSite, stall: "awaiting_materials" }).currentStallLabel,
    "🪵 목재 오는 중 (4/12)",
  );
  assert.equal(
    constructionSiteCardModel({ ...materialSite, stall: "no_material_source" }).currentStallLabel,
    "🪵 창고에 목재 없음",
  );
});

test("queued palisade segment model identifies gate-outward position without adding a stall state", () => {
  // Given
  const active = createPalisadeConstructionSite({
    id: "wall-a-segment-000",
    wallId: "wall-a",
    segmentIndex: 0,
    gateDistance: 0,
    order: 0,
    path: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
    startedTick: 0,
  });
  const queued = createPalisadeConstructionSite({
    id: "wall-a-segment-001",
    wallId: "wall-a",
    segmentIndex: 1,
    gateDistance: 4,
    order: 1,
    path: [{ x: 2, y: 0 }, { x: 4, y: 0 }],
    startedTick: 0,
  });

  // When
  const model = constructionSiteCardModel(queued, {
    constructionSites: [active, queued],
    cancellationDisabledReason: "목책 시대 선포 후에는 성벽 구간 공사를 취소할 수 없습니다",
  });

  // Then
  assert.equal(queued.stall, "awaiting_materials");
  assert.equal(model.currentStallLabel, "대기 중 · 성문 기준 2번째 구간");
  assert.deepEqual(model.cancellation, {
    enabled: false,
    reason: "목책 시대 선포 후에는 성벽 구간 공사를 취소할 수 없습니다",
  });
});
