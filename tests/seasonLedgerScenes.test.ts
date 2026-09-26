import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { EMPTY_HISTORY } from "../src/engine/history";
import type { HistoryRecord } from "../src/engine/history.types";
import type { SeasonLedger } from "../src/engine/season.types";
import { seasonJustClosed, seasonLedgerCardModel } from "../src/ui/seasonLedgerCard";
import { recordScene, seasonLedgerScenes } from "../src/ui/seasonLedgerScenes";
import { WAVE19_IMAGES } from "../src/ui/wave19ArtManifest.generated";

// UI-4b: the season ledger card's three scenes come from the history ledger (severity first), one per Wave 19 icon,
// and a quiet season falls back to its numbers; the 53 Wave 19 files are installed and registered.
const TOWN = { type: "town" as const, id: "town" };
let ordinal = 0;
const record = (tick: number, template: string, severity: 0 | 1 | 2 | 3, params: Record<string, number | string> = {}, kind: HistoryRecord["kind"] = "event"): HistoryRecord =>
  ({ id: `h-${String(++ordinal).padStart(6, "0")}`, tick, kind, template, params, subject: TOWN, severity });
const ledger = (startTick: number, over: Partial<SeasonLedger> = {}): SeasonLedger => ({ season: 1, year: 1301, startTick, endTick: startTick + 1_000, income: 40, expense: 30,
  stockDelta: { bread: 5, wheat: 0, timber: 0, stone: 0 }, popDelta: 2, notableEvents: [], nextObjectiveHint: null, ...over });
const stateWith = (records: readonly HistoryRecord[], ledgers: readonly SeasonLedger[]) => ({
  scenarioId: "core:campaign_market_town", history: { ...EMPTY_HISTORY, records }, seasons: { history: ledgers } }) as never;

test("Given the Wave 19 install When the manifest is read Then 53 files are installed, 24 of them scene icons, frames with their 9-slice insets", () => {
  const entries = Object.entries(WAVE19_IMAGES);
  assert.equal(entries.length, 53);
  assert.equal(entries.filter(([key]) => key.startsWith("scene_")).length, 24);
  for (const [, image] of entries) assert.ok(existsSync(new URL(`../public/${image.url}`, import.meta.url)), image.url);
  const nine = entries.filter(([, image]) => "nineSlice" in image).map(([key]) => key).sort();
  assert.ok(nine.includes("frame_record_event") && nine.includes("frame_biography") && nine.includes("frame_decision_compare"));
  assert.equal(readFileSync(new URL("../docs/provenance/assets.csv", import.meta.url), "utf8").split("\n").filter(line => line.includes("public/assets/wave19/")).length, 53);
});

test("Given a season with a famine, a first market and burnt houses When its scenes are picked Then the weightiest records lead, one scene per icon with its count", () => {
  const before = ledger(0); const closed = ledger(1_000);
  const records = [
    record(1_000, "ledger.season", 0, { popDelta: 3 }, "ledger"), // the season before closing: not this season's
    record(1_100, "person.burnt", 1, {}, "person"), record(1_120, "person.burnt", 1, {}, "person"), record(1_130, "person.burnt", 1, {}, "person"),
    record(1_200, "milestone.first_building", 1, { building: "market" }, "milestone"),
    record(1_300, "event.rumour", 1, { defId: "great_famine" }),
    record(1_400, "event.arrived", 2, { defId: "great_famine" }),
    record(2_000, "ledger.population", 1, { percent: -8 }, "ledger"),
  ];
  const scenes = seasonLedgerScenes(stateWith(records, [before, closed]), closed, before);
  assert.deepEqual(scenes, [{ id: "great_famine", value: null }, { id: "fire", value: "3채" }, { id: "market_busy", value: null }]);
  const model = seasonLedgerCardModel(stateWith(records, [before, closed]));
  assert.equal(model?.scenesLine, "이 계절의 장면: 대기근 · 화재 3채 · 장날 성황");
});

test("Given a quiet season When its ledger has no changes Then the scenes come from its numbers, weighted as before", () => {
  const closed = ledger(1_000, { popDelta: -2, stockDelta: { bread: -30, wheat: 0, timber: -3, stone: 0 }, notableEvents: [{ kind: "first_winter_warning" }] });
  const scenes = seasonLedgerScenes(stateWith([], [closed]), closed, undefined);
  assert.deepEqual(scenes.map(scene => scene.id), ["bread_shortage", "population_down", "market_busy"]);
  assert.deepEqual(scenes.map(scene => scene.value), ["−30", "−2", "+10d"]);
});

test("Given every ledger template When mapped Then each change has a scene and forecasts and everyday lines have none", () => {
  assert.equal(recordScene({ template: "event.rumour", params: { defId: "fire" } }), null);
  assert.equal(recordScene({ template: "ledger.season", params: {} }), null);
  assert.equal(recordScene({ template: "event.arrived", params: { defId: "dearth_rehearsal" } }), "poor_harvest");
  assert.equal(recordScene({ template: "event.recovered", params: { defId: "great_famine" } }), "winter_survived");
  assert.equal(recordScene({ template: "decision.petition_response", params: { chosen: "accept" } }), "charter");
  assert.equal(recordScene({ template: "decision.famine_response", params: { chosen: "relief" } }), "bread_reserve");
  assert.equal(recordScene({ template: "milestone.first_building", params: { building: "church" } }), "complete_public");
  assert.equal(recordScene({ template: "ledger.treasury_turn", params: { net: -12 } }), "market_quiet");
  assert.equal(recordScene({ template: "era.entered", params: { eraId: "famine" } }), "great_famine");
});

test("Given the engine keeps eight closed seasons When a ninth and later seasons close Then each still opens its card, and a load opens none", () => {
  assert.equal(seasonJustClosed(null, 1_000, null), true, "the first season");
  assert.equal(seasonJustClosed(8_000, 9_000, 8_000), true, "the ninth: the count stays eight, the end moves on");
  assert.equal(seasonJustClosed(9_000, 9_000, 8_000), false, "no new season");
  assert.equal(seasonJustClosed(3_000, 9_000, 8_000), false, "a load several seasons on");
  assert.equal(seasonJustClosed(null, 9_000, 8_000), false, "a save opened mid-game");
});
