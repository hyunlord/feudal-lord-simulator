import assert from "node:assert/strict";
import test from "node:test";
import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { STARTING_HOUSE_ID } from "../src/state/openingVillage";
import { buildingInspectorModel } from "../src/render/buildingInspectorModel";
import { DiagnosticCard, placeDiagnosticCard } from "../src/render/DiagnosticCard";

test("diagnostic card placement stays in viewport and outside its selected target", () => {
  const position = placeDiagnosticCard(
    { width: 375, height: 667 },
    { x: 300, y: 300, width: 40, height: 40 },
    { width: 280, height: 230 },
  );
  assert.ok(position.x >= 8 && position.x + 280 <= 367);
  assert.ok(position.y >= 8 && position.y + 230 <= 659);
  const overlaps = position.x < 340 && position.x + 280 > 300
    && position.y < 340 && position.y + 230 > 300;
  assert.equal(overlaps, false);
});

test("a degraded home card separates living grade from preserved architecture", () => {
  const state = { ...DEFAULT_GAME_STATE, houses: DEFAULT_GAME_STATE.houses.map(house => ({ ...house, level: 1, builtLevel: 3, residents: 2 })) };
  const model = houseDiagnosisModel(state, STARTING_HOUSE_ID);
  assert.ok(model);
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 8, y: 8 }, model: { kind: "house", value: model },
  }));
  assert.match(markup, /생활 등급 1/);
  assert.match(markup, /건축 단계/);
  assert.match(markup, /3단계/);
  assert.match(markup, new RegExp(model.conditionLabel));
});

test("house card renders its complete water and bread cause chain result", () => {
  const houseModel = {
    buildingId: "house", name: "오두막", level: 1, builtLevel: 1, condition: "maintained", conditionLabel: "관리 양호", residents: 3,
    thumbnailUrl: "/assets/buildings/house_l1.png", capacity: 8, footprintLabel: "1×1", mergeOptions: [], mergeStatus: "2등급부터 합필할 수 있습니다.",
    water: { kind: "well_too_far", label: "우물이 너무 멉니다 — 거리 8 / 범위 6", distance: 8, serviceRadius: 6 },
    bread: { kind: "road_disconnected", label: "곡창에서 이 집까지 도로가 이어지지 않음" },
    population: { kind: "declining", label: "감소 중 — 식량 없음, 340틱 경과", elapsedTicks: 340 },
    protection: { kind: "inactive", label: "성벽 미완성", amenityBonus: 0 },
    market: { kind: "no_market", label: "시장 없음", serviceRadius: 8 },
    church: { kind: "missing", label: "교회 없음", distance: Infinity, serviceRadius: 12 },
    stoneHouse: { kind: "blocked", label: "도시 대가옥 불가 — 물 공급 필요", blockers: ["물 공급 필요"] },
  } as const;
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 640, y: 8 },
    model: {
      kind: "house",
      value: houseModel,
    },
  }));
  assert.match(markup, /aria-label="오두막 원인 진단"/);
  assert.match(markup, /주민 3명/);
  assert.match(markup, /우물이 너무 멉니다 — 거리 8 \/ 범위 6/);
  assert.match(markup, /곡창에서 이 집까지 도로가 이어지지 않음/);
  assert.match(markup, /인구/);
  assert.match(markup, /감소 중 — 식량 없음, 340틱 경과/);
  assert.match(markup, /house_l1.png/);
  assert.match(markup, /주택 발전 조건/);
  assert.match(markup, /시장 없음/);
  assert.match(markup, /도시 대가옥 불가 — 물 공급 필요/);
  assert.doesNotMatch(markup, /style="left:/);
});

test("walker card renders route, mission and cancellation facts", () => {
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 8, y: 8 },
    model: {
      kind: "walker",
      value: {
        walkerId: "carter", roleLabel: "운반인", cargoLabel: "통나무 4",
        sourceLabel: "벌목소", sourceDirectionLabel: null, sourceDistance: null,
        destinationLabel: "제재소", statusLabel: "배송 취소",
        remainingDistance: 7, etaTicks: 88, housesPassed: 2, tilesTravelled: null,
        cancellationLabel: "도로가 끊김",
      },
    },
  }));
  assert.match(markup, /aria-label="운반인 임무 진단"/);
  for (const label of ["통나무 4", "벌목소", "제재소", "배송 취소", "거리 7", "예상 88틱", "지난 집 2", "도로가 끊김"]) {
    assert.match(markup, new RegExp(label));
  }
});

test("construction site card renders four named rows and a cancel control", () => {
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 8, y: 8 },
    model: {
      kind: "construction_site",
      value: {
        siteId: "construction-site-000001",
        name: "제재소 부지",
        currentStallLabel: "🚧 창고에서 길이 이어지지 않음",
        rows: [
          { label: "부지", value: "4, 7 · 제재소" },
          { label: "자재 확보", value: "목재 12/30 확보 · 예약 8" },
          { label: "자재 배달", value: "목재 10 남음" },
          { label: "건축 작업", value: "120/600틱 · 일꾼 2명" },
        ],
      },
    },
  }));

  assert.match(markup, /aria-label="제재소 부지 건설 진단"/);
  for (const label of ["부지", "자재 확보", "자재 배달", "건축 작업"]) {
    assert.match(markup, new RegExp(`<dt>${label}</dt>`));
  }
  assert.match(markup, /🚧 창고에서 길이 이어지지 않음/);
  assert.doesNotMatch(markup, /no_route/);
  assert.match(markup, /data-action="cancel-construction"/);
  assert.match(markup, /공사 포기/);
});

test("construction site card disables palisade cancellation with an explicit reason", () => {
  const reason = "목책 시대 선포 후에는 성벽 구간 공사를 취소할 수 없습니다";
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 8, y: 8 },
    model: {
      kind: "construction_site",
      value: {
        siteId: "wall-a-segment-000",
        name: "목책 구간 부지",
        currentStallLabel: "대기 중 · 성문 기준 2번째 구간",
        rows: [
          { label: "부지", value: "2, 3 · 목책 구간" },
          { label: "자재 확보", value: "목재 0/30 확보" },
          { label: "자재 배달", value: "목재 30 남음" },
          { label: "건축 작업", value: "0/120틱 · 일꾼 0명" },
        ],
        cancellation: { enabled: false, reason },
      },
    },
  }));

  assert.match(markup, /disabled=""/);
  assert.match(markup, new RegExp(reason));
  assert.match(markup, /공사 포기 불가/);
});


test("house demolition control explains resident departure and no refund", () => {
  const value = houseDiagnosisModel(DEFAULT_GAME_STATE, STARTING_HOUSE_ID);
  assert.ok(value);
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 8, y: 8 },
    model: { kind: "house", value },
    onDemolishHouse: () => undefined,
  }));
  assert.match(markup, /data-action="demolish-house"/);
  assert.match(markup, /주택 철거/);
  assert.match(markup, /주민 3명이 떠납니다/);
  assert.match(markup, /자재와 보관 식량은 반환되지 않습니다/);
});


test("selected facility card retains authoritative operation facts and its actual art", () => {
  const building = DEFAULT_GAME_STATE.buildings.find((candidate) => candidate.kind === "granary");
  assert.ok(building);
  const value = buildingInspectorModel(DEFAULT_GAME_STATE, building.id);
  assert.ok(value);
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 8, y: 8 }, model: { kind: "building", value }, onClose: () => undefined,
  }));
  assert.match(markup, /aria-label="곡창 시설 진단"/);
  assert.match(markup, /barn.png/);
  assert.match(markup, /상세 정보 닫기/);
  for (const row of value.rows) assert.ok(markup.includes(row));
  assert.doesNotMatch(markup, /data-action="demolish-house"/);
});


test("inspector keys stay local while preserving native activation and scrolling", () => {
  const value = houseDiagnosisModel(DEFAULT_GAME_STATE, STARTING_HOUSE_ID);
  assert.ok(value);
  let closed = 0;
  const card = DiagnosticCard({
    position: { x: 8, y: 8 }, model: { kind: "house", value }, onClose: () => { closed += 1; },
  });
  type EventProbe = { readonly key: string; stopPropagation: () => void; preventDefault: () => void };
  assert.ok(isValidElement<{ onKeyDown: (event: EventProbe) => void; onKeyUp?: unknown }>(card));
  for (const key of [" ", "ArrowDown", "Enter", "Escape"]) {
    let stopped = false;
    let prevented = false;
    card.props.onKeyDown({ key, stopPropagation: () => { stopped = true; }, preventDefault: () => { prevented = true; } });
    assert.equal(stopped, true, `${key} must not reach camera controls`);
    assert.equal(prevented, false, `${key} must keep its native browser action`);
  }
  assert.equal(closed, 1);
  assert.equal(card.props.onKeyUp, undefined, "global key releases must still clear held camera keys");
});


test("merge controls preserve each target identity and expose blocked reasons with native disabled buttons", () => {
  const base = houseDiagnosisModel(DEFAULT_GAME_STATE, STARTING_HOUSE_ID);
  assert.ok(base);
  const value = {
    ...base,
    level: 2,
    capacity: 14,
    mergeStatus: "같은 등급의 인접 주택을 선택하세요.",
    mergeOptions: [
      { targetBuildingId: "east", label: "오른쪽 아래 주택과 2×1 합필", enabled: true, reason: null },
      { targetBuildingId: "south", label: "왼쪽 아래 주택과 1×2 합필", enabled: false, reason: "운송이 끝난 뒤 합필할 수 있습니다." },
    ],
  };
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 8, y: 8 }, model: { kind: "house", value }, onMergeHouses: () => undefined,
  }));
  assert.match(markup, /data-target-building-id="east">오른쪽 아래 주택과 2×1 합필/);
  assert.match(markup, /data-target-building-id="south" disabled="">왼쪽 아래 주택과 1×2 합필/);
  assert.match(markup, /운송이 끝난 뒤 합필할 수 있습니다/);
  assert.match(markup, /정원 14명 · 1×1칸/);
});


test("merged card uses its orientation-specific thumbnail and labels a missing compound stage truthfully", () => {
  const base = houseDiagnosisModel(DEFAULT_GAME_STATE, STARTING_HOUSE_ID);
  assert.ok(base);
  for (const axis of ["horizontal", "vertical"]) {
    const value = { ...base, name: "장인가옥 · 합필 주택", thumbnailUrl: `/assets/buildings/house_pair_l2_${axis}.png` };
    const markup = renderToStaticMarkup(createElement(DiagnosticCard, { position: { x: 8, y: 8 }, model: { kind: "house", value } }));
    assert.ok(markup.includes(value.thumbnailUrl));
    assert.doesNotMatch(markup, /house_l2.png/);
  }
  const value = { ...base, thumbnailUrl: null, footprintLabel: "2×1" };
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, { position: { x: 8, y: 8 }, model: { kind: "house", value } }));
  assert.match(markup, /2×1 주택/);
  assert.doesNotMatch(markup, /house_l[0-4].png/);
});
