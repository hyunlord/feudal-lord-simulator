import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { MAX_LOOPS, SOUND_BANK } from "../src/audio/audioEngine";
import { houseSmokeStrength, millOvenBurning } from "../src/render/roofSmoke";
import { historicalHouseAssetManifest } from "../src/render/historicalHouseAssetManifest.generated";
import { ROOF_SMOKE_ANCHORS } from "../src/render/roofSmokeAnchors.generated";
import { WAVE26_HOUSE_VARIANTS } from "../src/render/wave26HouseManifest.generated";
import { WAVE30_PAIR_HOUSE_VARIANTS } from "../src/render/wave30PairHouseManifest.generated";
import { houseCompoundAssetManifest } from "../src/render/houseCompoundAssetManifest.generated";
import type { HousePainting } from "../src/render/houseVariantChoice";
import { emphasisedSigns, MAX_EMPHASIS, worldSigns, type WorldSign } from "../src/render/worldSigns";
import { SIGNAL_PERSIST_TICKS } from "../src/render/signalPersistence";
import { isMarketDay } from "../src/render/presentation/residentTrips";
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

test("INSTALL-7 S12 / abandoned x F0-A: a leaving household shows its bundles, an abandoned house its own sign, whatever its larder", () => {
  const base = DEFAULT_GAME_STATE;
  const fed = base.houses.map(house => ({ ...house, residents: 3, breadStock: 4 }));
  const kinds = (houses: typeof fed) => worldSigns({ ...base, houses }).map(sign => sign.kind).filter(kind => kind !== "empty_plot");
  assert.deepEqual(kinds(fed), []);
  assert.deepEqual(kinds(fed.map((house, index) => index === 0 ? { ...house, leavingSinceTick: 5 } : house)), ["leaving_family"]);
  assert.deepEqual(kinds(fed.map((house, index) => index === 1 ? { ...house, residents: 0, breadStock: 0, abandonedTick: 9 } : house)), ["abandoned_house"]);
});

test("INSTALL-7 S9 / S6: a paused or unpaid building shows the latch; a market on a market day with nothing to sell the empty stall", () => {
  const base = DEFAULT_GAME_STATE;
  const mill = { id: "mill-x", kind: "mill" as const, tx: 30, ty: 30, workers: 1, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const kinds = (buildings: typeof base.buildings, tick = base.tick) => worldSigns({ ...base, tick, buildings }).map(sign => sign.kind);
  assert.ok(!kinds([...base.buildings, mill]).includes("idle_latch"));
  assert.ok(kinds([...base.buildings, { ...mill, operationPaused: true }]).includes("idle_latch"));
  assert.ok(kinds([...base.buildings, { ...mill, upkeepUnpaid: true }]).includes("idle_latch"));
  const market = { ...mill, id: "market-x", kind: "market" as const };
  const marketDay = Array.from({ length: 4_000 }, (_, tick) => tick).find(tick => isMarketDay(tick))!;
  const ordinary = Array.from({ length: 4_000 }, (_, tick) => tick).find(tick => !isMarketDay(tick))!;
  assert.ok(kinds([...base.buildings, market], marketDay).includes("empty_stall"), "market day, nothing to sell");
  assert.ok(!kinds([...base.buildings, market], ordinary).includes("empty_stall"), "not a market day");
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
  assert.equal(anchors.length, 67, "5 houses, 6 pairs, their 18 Wave 2 variants, the 20 Wave 26 paintings (INSTALL-26) and the 18 Wave 30 pairs (INSTALL-30)");
  // INSTALL-26: a Wave 26 anchor is a fraction of the approved bounds; its ridge is inside the painting's own crop, which
  // may reach above them (fy below 0; the 4-decimal rounding leaves up to a thousandth of the crop). INSTALL-30: a
  // Wave 30 pair's likewise, of the approved pair's bounds.
  const crops = new Map<string, HousePainting>([...WAVE26_HOUSE_VARIANTS.map(variant => [`assets/wave26/house/${variant.key}.png`, variant] as const),
    ...WAVE30_PAIR_HOUSE_VARIANTS.map(variant => [`assets/wave30/house_pair/${variant.key}.png`, variant] as const)]);
  for (const [url, anchor] of anchors) {
    const variant = crops.get(url);
    const bounds = variant === undefined ? null : "lot" in variant
      ? houseCompoundAssetManifest.find(meta => meta.level === variant.level && meta.axis === variant.lot)!.alphaBounds
      : historicalHouseAssetManifest.find(meta => meta.level === variant.level)!.alphaBounds;
    const x = variant === undefined || bounds === null ? anchor.fx : (bounds.x + anchor.fx * bounds.width - variant.crop.x) / variant.crop.width;
    const y = variant === undefined || bounds === null ? anchor.fy : (bounds.y + anchor.fy * bounds.height - variant.crop.y) / variant.crop.height;
    assert.ok(x > 0 && x < 1 && y > -0.001 && y < 0.5, url);
  }
});

test("F0-V world signs: road cut, cold house and empty plot appear only under their condition; at most three in view are emphasised, road cut first", () => {
  const base = DEFAULT_GAME_STATE;
  const signs = worldSigns(base);
  for (const sign of signs) assert.ok(["road_cut", "cold_house", "empty_plot"].includes(sign.kind));
  const coldHouses = base.houses.map(house => ({ ...house, residents: 3, breadStock: 0 }));
  worldSigns({ ...base, tick: 500, houses: coldHouses });
  const cold = worldSigns({ ...base, tick: 500 + SIGNAL_PERSIST_TICKS, houses: coldHouses });
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

test("R0-1: a new game shows no cold house; an empty larder shows after a cycle, or at once from the engine's shortage start", () => {
  const fresh = worldSigns(DEFAULT_GAME_STATE);
  assert.equal(fresh.filter(sign => sign.kind === "cold_house").length, 0, "the opening village before its first bread round");
  const empty = DEFAULT_GAME_STATE.houses.map(house => ({ ...house, residents: 3, breadStock: 0 }));
  const cold = (tick: number, houses = empty) => worldSigns({ ...DEFAULT_GAME_STATE, tick, houses }).filter(sign => sign.kind === "cold_house").length;
  assert.equal(cold(2_000), 0);
  assert.equal(cold(2_100), 0, "a larder empty for 100 ticks is one bread round, not a signal");
  assert.equal(cold(2_000 + SIGNAL_PERSIST_TICKS), empty.length);
  const shortLong = empty.map(house => ({ ...house, foodShortSinceTick: 1_000 }));
  assert.equal(cold(5_000, shortLong), empty.length, "the engine has counted the shortage since 1,000 (a load mid-shortage)");
});

test("F0-V sounds: the 15 P0 sounds are installed, on three buses, with at most four loops", () => {
  const entries = Object.entries(SOUND_BANK);
  const P0 = ["place_ok", "place_cancel", "place_blocked", "alert_info", "alert_warn", "alert_urgent", "hammer_1", "hammer_2", "hammer_3",
    "unload_wood", "unload_stone", "stage_thud", "complete", "cart_loop", "spring_ambience"];
  assert.deepEqual(P0.filter(id => !(id in SOUND_BANK)), [], "AUDIO-1 adds to the bank; the P0 sounds stay");
  assert.deepEqual([...new Set(entries.map(([, entry]) => entry.bus))].sort(), ["alert", "ui", "world"]);
  assert.deepEqual(entries.filter(([, entry]) => !existsSync(join(ROOT, "public", entry.file))).map(([id]) => id), []);
  assert.equal(MAX_LOOPS, 4);
  assert.ok(existsSync(join(ROOT, "docs/AUDIO_LICENSES.md")) && existsSync(join(ROOT, "public/licenses/audio/Kenney-impact-sounds-License.txt")));
});
