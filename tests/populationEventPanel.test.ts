import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PopulationEventPanel } from "../src/ui/PopulationEventPanel";
import type { PopulationEvent } from "../src/ui/populationEventModel";

const EVENTS = [
  { tick: 50, delta: 1, cause: "growth", houseId: "house-a" },
  { tick: 100, delta: -1, cause: "starvation", houseId: "house-b" },
  { tick: 101, delta: -1, cause: "starvation", houseId: "house-c" },
] as const satisfies readonly PopulationEvent[];

test("population panel always renders an intentional empty state", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(PopulationEventPanel, { events: [], onSelectHouseIds: () => undefined }),
  );

  // Then
  assert.match(markup, /aria-label="인구 변화 기록"/);
  assert.match(markup, /아직 기록된 인구 변화가 없습니다/);
});

test("population panel renders newest grouped causes as house-selecting buttons", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(PopulationEventPanel, {
      events: EVENTS,
      onSelectHouseIds: () => undefined,
    }),
  );

  // Then
  assert.match(markup, /인구 2명 감소 — 굶주림/);
  assert.match(markup, /인구 1명 증가 — 성장/);
  assert.equal((markup.match(/<button/g) ?? []).length, 2);
  assert.ok(markup.indexOf("굶주림") < markup.indexOf("성장"));
});
