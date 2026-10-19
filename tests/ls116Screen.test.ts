/**
 * LS1-16 (the user's ruling 2026-10-19, after the check-up run render-VIS-checkup-d7f391e): the screen side of what that
 * run showed — the wall's works said as going on when their segments left fell since the close before (the cause stays the
 * engine's growthBlock), short chips for the registry offers and the growth stop, the wall works' tag kept out of the rail,
 * the year card's repeated lines as one with their count, the famine's chip only while it lasts, and the harness's count
 * of the wall's finished segments.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gunzipSync, gzipSync } from "node:zlib";

import { GREAT_FAMINE_EVENT_ID } from "../src/content/eventConfig";
import { V4_COPY } from "../src/content/registry/v4Copy.generated";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { storyBeats } from "../src/ui/eventStory";
import { coversBox } from "../src/ui/hud/hudCover";
import { GROWTH_COPY } from "../src/ui/lord/growth/growthCopy.ko";
import { townSnapshot } from "../src/ui/lord/seasonBand/seasonBandModel";
import { clearTownCloses, lastWallProgress, recordTownClose, wallProgressAt } from "../src/ui/lord/seasonBand/townCloses";
import { REGISTRY_CARD_COPY } from "../src/ui/registryCardCopy.ko";
import { lordYearReview } from "../src/ui/results/lordYearReview";

const sites = (palisade: number, stone = 0) => [...Array.from({ length: palisade }, () => ({ kind: "palisade_segment" })),
  ...Array.from({ length: stone }, () => ({ kind: "stone_wall_segment" }))] as unknown as GameState["constructionSites"];
const town = (constructionSites: GameState["constructionSites"]) => townSnapshot({ ...DEFAULT_GAME_STATE, constructionSites });

test("1: fewer segments left than at the close before — the works go on (left and wall named); none fewer — the engine's words", () => {
  clearTownCloses();
  recordTownClose(1316, 3, town(sites(16)));
  recordTownClose(1317, 0, town(sites(8)));
  assert.deepEqual(wallProgressAt(1317, 0), { left: 8, kind: "palisade" }, "the winter close before a spring");
  assert.deepEqual(lastWallProgress(), { left: 8, kind: "palisade" });
  assert.equal(GROWTH_COPY.reason("wall_building", null, lastWallProgress()), "목책 공사 중 · 8구간 남음");
  recordTownClose(1317, 1, town(sites(8)));
  assert.equal(lastWallProgress(), null, "no segment built since: the works stopped");
  assert.equal(GROWTH_COPY.reason("wall_building", null, lastWallProgress()), "목책 공사가 멈춰 있습니다");
  recordTownClose(1317, 2, town(sites(0, 5)));
  recordTownClose(1317, 3, town(sites(0, 3)));
  assert.equal(GROWTH_COPY.reason("wall_building", null, lastWallProgress()), "성벽 공사 중 · 3구간 남음");
  assert.equal(GROWTH_COPY.reason("food", null, { left: 3, kind: "stone" }), "먹을 것이 모자란 집이 있습니다", "only the wall's cause reads the works");
  clearTownCloses();
  assert.equal(wallProgressAt(1317, 3), null, "a close the screen did not see: the engine's words");
});

test("2: the growth stop's and every registry offer's chip has a short form; the whole words stay the card's", () => {
  assert.equal(GROWTH_COPY.chip.short("wall_building", null), "정체 · 목책 공사");
  assert.equal(GROWTH_COPY.chip.short("no_lots", null), "정체 · 집터 없음");
  assert.equal(GROWTH_COPY.chip.short("service_missing", "church"), "정체 · 교회");
  const chips = Object.values(V4_COPY).map(copy => REGISTRY_CARD_COPY.chip(copy.senderFaction));
  assert.ok(chips.every(chip => /^(가문|도시|상인|교회|왕실|농민|이웃|길드|영지) 제안$/.test(chip)), "every canon offer has its party's word");
  assert.equal(REGISTRY_CARD_COPY.chip("도시 공동체·거래 당사자"), "도시 제안", "the first party");
  assert.equal(REGISTRY_CARD_COPY.chip("지도 밖 영지의 소작인·상인"), "영지 제안");
  assert.equal(REGISTRY_CARD_COPY.chip(undefined), "제안");
});

test("3: a tag box meeting the rail's area is covered; one beside it is not", () => {
  const rail = [{ x: 1120, y: 120, w: 160, h: 150 }];
  assert.equal(coversBox({ x: 1100, y: 160, w: 160, h: 18 }, rail), true);
  assert.equal(coversBox({ x: 900, y: 160, w: 160, h: 18 }, rail), false);
  assert.equal(coversBox({ x: 1130, y: 300, w: 160, h: 18 }, rail), false);
});

test("4: the year card says a repeated decision once with its count, and decisions saying the same as one group", () => {
  // render-VIS-checkup-d7f391e, seed 1, the 1311 spring state (1310's card): three "걸려 온 소송에 증거를 냈다" groups and the
  // marriage's steps each its own group before.
  const raw = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/ls116/seed1-1311-spring.json.gz", import.meta.url))).toString()) as GameState;
  const view = lordYearReview(raw, 1310);
  const headings = view.threads.map(group => group.heading);
  assert.equal(headings.filter(heading => heading.includes("걸려 온 소송에 증거를 냈다")).length, 1);
  const marriage = view.threads.flatMap(group => group.lines).filter(line => line.startsWith("혼인이 한 걸음 나아갔다"));
  assert.deepEqual(marriage, ["혼인이 한 걸음 나아갔다", "혼인이 한 걸음 나아갔다 (여러 까닭 가운데 하나) (6건)"]);
  assert.ok(headings.some(heading => heading.endsWith("외 2건")), "the group standing for more decisions says how many");
  const lines = view.threads.flatMap(group => group.lines);
  assert.equal(new Set(lines.filter(line => !line.startsWith("계절 결산"))).size, lines.filter(line => !line.startsWith("계절 결산")).length, "no line twice");
});

test("5: the famine's chip while it lasts (the engine's arrival); gone at its end tick, through the recovery", () => {
  const record = { id: "evt-famine", defId: GREAT_FAMINE_EVENT_ID, kind: "dearth", startTick: 60_000, endTick: 69_500, recoveryUntilTick: 71_500,
    response: { choice: "relief", tick: 60_000 }, losses: { harvestLost: 0 } };
  const at = (tick: number) => ({ ...structuredClone(DEFAULT_GAME_STATE), tick,
    events: { ...DEFAULT_GAME_STATE.events, records: [record] } } as unknown as GameState);
  assert.ok(storyBeats(at(69_000)).some(beat => beat.kind === "famine"), "before its end");
  assert.ok(!storyBeats(at(69_500)).some(beat => beat.kind === "famine"), "at its end");
  assert.ok(!storyBeats(at(70_000)).some(beat => beat.kind === "famine"), "in the recovery");
});

test("6: the harness counts the wall's finished segments by the engine's `completed`, and the segments left", () => {
  const dir = mkdtempSync(join(tmpdir(), "ls116-facts-"));
  mkdirSync(join(dir, "states"));
  const state = { ...DEFAULT_GAME_STATE, palisade: { segments: [{ completed: true }, { completed: true }, { completed: false }] }, constructionSites: sites(1) };
  writeFileSync(join(dir, "states", "1317-s1.json.gz"), gzipSync(JSON.stringify(state)));
  const out = execFileSync(process.execPath, ["--import", "tsx", "scripts/visibleChangeFacts.ts", dir], { encoding: "utf8" });
  const facts = JSON.parse(out) as { facts: { palisade: { segments: number; built: number; left: number } } }[];
  assert.deepEqual(facts[0]!.facts.palisade, { segments: 3, built: 2, left: 1 });
});
