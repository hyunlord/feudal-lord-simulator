import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

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

test("house card renders its complete water and bread cause chain result", () => {
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 640, y: 8 },
    model: {
      kind: "house",
      value: {
        buildingId: "house", name: "오두막", level: 1, residents: 3,
        water: { kind: "well_too_far", label: "우물이 너무 멉니다 — 거리 8 / 범위 6", distance: 8, serviceRadius: 6 },
        bread: { kind: "road_disconnected", label: "곡창에서 이 집까지 도로가 이어지지 않음" },
        population: { kind: "declining", label: "감소 중 — 식량 없음, 340틱 경과", elapsedTicks: 340 },
      },
    },
  }));
  assert.match(markup, /aria-label="오두막 원인 진단"/);
  assert.match(markup, /주민 3명/);
  assert.match(markup, /우물이 너무 멉니다 — 거리 8 \/ 범위 6/);
  assert.match(markup, /곡창에서 이 집까지 도로가 이어지지 않음/);
  assert.match(markup, /인구/);
  assert.match(markup, /감소 중 — 식량 없음, 340틱 경과/);
  assert.match(
    markup,
    /left:min\(640px, calc\(100% - min\(300px, calc\(100% - 16px\)\) - 8px\)\)/,
  );
});

test("walker card renders route, mission and cancellation facts", () => {
  const markup = renderToStaticMarkup(createElement(DiagnosticCard, {
    position: { x: 8, y: 8 },
    model: {
      kind: "walker",
      value: {
        walkerId: "carter", roleLabel: "운반인", cargoLabel: "통나무 4",
        sourceLabel: "벌목소", destinationLabel: "제재소", statusLabel: "배송 취소",
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
        currentStall: "no_route",
        rows: [
          { label: "부지", value: "4, 7 · 제재소" },
          { label: "자재 확보", value: "목재 12/30 확보 · 예약 8" },
          { label: "자재 배달", value: "목재 10 남음 · 정체 no_route" },
          { label: "건축 작업", value: "120/600틱 · 일꾼 2명" },
        ],
      },
    },
  }));

  assert.match(markup, /aria-label="제재소 부지 건설 진단"/);
  for (const label of ["부지", "자재 확보", "자재 배달", "건축 작업"]) {
    assert.match(markup, new RegExp(`<dt>${label}</dt>`));
  }
  assert.match(markup, /정체 no_route/);
  assert.match(markup, /data-action="cancel-construction"/);
  assert.match(markup, /공사 포기/);
});
