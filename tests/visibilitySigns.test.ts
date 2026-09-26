import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { MAX_LOOPS, SOUND_BANK } from "../src/audio/audioEngine";
import { houseSmokeStrength, millOvenBurning } from "../src/render/roofSmoke";
import { ROOF_SMOKE_ANCHORS } from "../src/render/roofSmokeAnchors.generated";
import { emphasisedSigns, MAX_EMPHASIS, worldSigns, type WorldSign } from "../src/render/worldSigns";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const ROOT = new URL("..", import.meta.url).pathname;

test("F0-V smoke: a lived-in house with bread smokes, its last loaf thinly; empty or breadless houses do not", () => {
  const house = (residents: number, breadStock: number) => ({ houses: [{ ...DEFAULT_GAME_STATE.houses[0]!, buildingId: "h", residents, breadStock }] });
  assert.equal(houseSmokeStrength(house(0, 5), { id: "h" }), 0);
  assert.equal(houseSmokeStrength(house(4, 0), { id: "h" }), 0);
  assert.equal(houseSmokeStrength(house(4, 1), { id: "h" }), 0.35);
  assert.equal(houseSmokeStrength(house(4, 6), { id: "h" }), 1);
  const pressured = (patch: Record<string, number>) => ({ houses: [{ ...house(4, 6).houses[0]!, ...patch }] });
  assert.equal(houseSmokeStrength(pressured({ leavingSinceTick: 10 }), { id: "h" }), 0.35, "F0-A leaving: a thin plume");
  assert.equal(houseSmokeStrength(pressured({ abandonedTick: 20, residents: 0 }), { id: "h" }), 0, "F0-A abandoned: none");
});

test("F0-V S4 x F0-A: a leaving household or an abandoned house is a cold house even with bread in store", () => {
  const base = DEFAULT_GAME_STATE;
  const fed = base.houses.map(house => ({ ...house, residents: 3, breadStock: 4 }));
  const cold = (houses: typeof fed) => worldSigns({ ...base, houses }).filter(sign => sign.kind === "cold_house").length;
  assert.equal(cold(fed), 0);
  assert.equal(cold(fed.map((house, index) => index === 0 ? { ...house, leavingSinceTick: 5 } : house)), 1);
  assert.equal(cold(fed.map((house, index) => index === 1 ? { ...house, residents: 0, breadStock: 0, abandonedTick: 9 } : house)), 1);
});

test("F0-V smoke: the mill oven burns only while the mill runs (workers, wheat or baking, not paused, not unpaid)", () => {
  const mill = { id: "m", kind: "mill" as const, tx: 1, ty: 1, workers: 2, inventory: { wheat: 3 }, reserved: {}, stockReserved: {}, productionProgress: 0 };
  assert.equal(millOvenBurning(mill), true);
  assert.equal(millOvenBurning({ ...mill, workers: 0 }), false);
  assert.equal(millOvenBurning({ ...mill, inventory: {} }), false);
  assert.equal(millOvenBurning({ ...mill, inventory: {}, productionProgress: 0.4 }), true);
  assert.equal(millOvenBurning({ ...mill, operationPaused: true }), false);
  assert.equal(millOvenBurning({ ...mill, upkeepUnpaid: true }), false);
});

test("F0-V smoke anchors: every house art the game draws has a ridge point inside its bounds", () => {
  const anchors = Object.entries(ROOF_SMOKE_ANCHORS);
  assert.equal(anchors.length, 29, "5 houses, 6 pairs and their 18 Wave 2 variants");
  assert.ok(anchors.every(([, anchor]) => anchor.fx > 0 && anchor.fx < 1 && anchor.fy >= 0 && anchor.fy < 0.5));
});

test("F0-V world signs: road cut, cold house and empty plot appear only under their condition; at most three in view are emphasised, road cut first", () => {
  const base = DEFAULT_GAME_STATE;
  const signs = worldSigns(base);
  for (const sign of signs) assert.ok(["road_cut", "cold_house", "empty_plot"].includes(sign.kind));
  const cold = worldSigns({ ...base, houses: base.houses.map(house => ({ ...house, residents: 3, breadStock: 0 })) });
  assert.equal(cold.filter(sign => sign.kind === "cold_house").length, base.houses.length);
  const fed = worldSigns({ ...base, houses: base.houses.map(house => ({ ...house, residents: 3, breadStock: 4 })) });
  assert.equal(fed.filter(sign => sign.kind === "cold_house").length, 0);
  const many: WorldSign[] = [
    ...Array.from({ length: 4 }, (_, index) => ({ kind: "empty_plot" as const, tx: index, ty: 0, toward: null })),
    { kind: "cold_house", tx: 9, ty: 9, toward: null }, { kind: "road_cut", tx: 20, ty: 20, toward: null },
  ];
  const emphasised = emphasisedSigns(many, { x: 0, y: 0 });
  assert.equal(emphasised.length, MAX_EMPHASIS);
  assert.deepEqual(emphasised.map(sign => sign.kind), ["road_cut", "cold_house", "empty_plot"]);
  const inView = emphasisedSigns(many, { x: 0, y: 0 }, 400);
  assert.ok(!inView.some(sign => sign.kind === "road_cut"), "the road cut at (20,20) is out of view and takes no ring");
});

test("F0-V sounds: the 15 P0 sounds are installed, on three buses, with at most four loops", () => {
  const entries = Object.entries(SOUND_BANK);
  assert.equal(entries.length, 15);
  assert.deepEqual([...new Set(entries.map(([, entry]) => entry.bus))].sort(), ["alert", "ui", "world"]);
  assert.deepEqual(entries.filter(([, entry]) => !existsSync(join(ROOT, "public", entry.file))).map(([id]) => id), []);
  assert.equal(MAX_LOOPS, 4);
  assert.ok(existsSync(join(ROOT, "docs/AUDIO_LICENSES.md")) && existsSync(join(ROOT, "public/licenses/audio/Kenney-impact-sounds-License.txt")));
});
