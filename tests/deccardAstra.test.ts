/**
 * DEC-CARD A1, A2, A4, A5 (Astra's lord-mode play, 2026-10-06; docs/qa/lordplay-20261006/TOP10_FRICTION.md #2, #4, #5, #7):
 * lord mode's advice names the lord's levers instead of asking him to build; the camera comes back to the town on a
 * load and a "내 도시로" control stands in the pill; a recurring rate card says what came of the last answer of its
 * kind; the treasury breaks down by estate. The sandbox and the campaign look and play as before.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { V4_COPY } from "../src/content/registry/v4Copy.generated";
import { DEFAULT_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { subsidyRefusal, townCentre } from "../src/engine/townAgency";
import type { LedgerEntry } from "../src/ledger/ledger.types";
import { advanceTick } from "../src/engine/tick";
import { createMemoryPlatformServices } from "../src/platform/memoryPlatform";
import { setPlatformServicesForTest } from "../src/platform/platform";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import type { StoryBeat, StoryKind } from "../src/ui/eventStory";
import { storyBeats } from "../src/ui/eventStory";
import { EVENT_STORY_COPY } from "../src/ui/eventStoryCopy.ko";
import { StatusPill } from "../src/ui/hud/HudShell";
import { hudStuckRows } from "../src/ui/hud/stuckStockView";
import { statusPillModel } from "../src/ui/hud/statusPillModel";
import { inspectorModel, siteActions } from "../src/ui/inspectorModel";
import { lordAdvice, lordLeanSeason, lordLevers, lordSeasonHint } from "../src/ui/lord/advice/lordAdvice";
import { LORD_ADVICE_COPY } from "../src/ui/lord/advice/lordAdviceCopy.ko";
import { lordForecastLine, withLordAdvice } from "../src/ui/lord/advice/lordBeatAdvice";
import { lordBlockerActions } from "../src/ui/lord/advice/lordInspector";
import { townSeatTile } from "../src/ui/lord/camera/townSeat";
import { cameraKey, readCameraTile, viewCentreTile } from "../src/ui/lord/camera/useLordCamera";
import { sinceLastAnswer } from "../src/ui/lord/since/sinceLastModel";
import { TreasuryByEstate } from "../src/ui/lord/treasury/TreasuryByEstate";
import { entryEstate, treasuryByEstate } from "../src/ui/lord/treasury/treasuryModel";
import { SettlementPanel } from "../src/ui/SettlementPanel";
import { SETTLEMENT_PANEL_COPY } from "../src/ui/settlementPanelCopy.ko";
import { SCENARIO_COPY } from "../src/content/scenario/scenarioCopy.ko";
import { constructionAccessModel } from "../src/ui/constructionAccessModel";

/** Words that ask the player to build or paint himself (the sandbox's advice). */
const BUILD = /(지으세요|지어 |지으면|이어 주세요|놓으세요|늘리세요|칠하세요|칠하십시오|두십시오|갖추|갖춰)/;

const run = (state: GameState, ticks: number): GameState => { let next = state; for (let index = 0; index < ticks; index += 1) next = advanceTick(next); return next; };
/** The lord's slice, seed 1, a year in (its town has stores, a mill, piles and sites by then). */
const lord: GameState = run(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!, 4_000);
const campaign: GameState = run(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, seed: 1 })!, 4_000);
const sandbox: GameState = newGameState({ scenarioId: SANDBOX_SCENARIO_ID, seed: 1 })!;

function inspectorLines(state: GameState): readonly string[] {
  const stuck = hudStuckRows(state);
  return [...state.buildings.map(entry => entry.id), ...state.constructionSites.map(entry => entry.id)]
    .flatMap(id => inspectorModel(state, id, stuck)?.actions ?? []);
}

test("A1: lord mode's inspector never asks the lord to build; it names the town's state and his levers", () => {
  const lines = inspectorLines(lord);
  assert.ok(lines.length > 0);
  for (const line of lines) assert.doesNotMatch(line, BUILD, line);
  assert.ok(lines.some(line => line.includes("명령 ›") || line.includes("방침")), "a lever is named");
  // A water cause asks for a well: the lord's lines say what the town does and the policy that weighs wells.
  const house = lord.buildings.find(entry => entry.kind === "house")!;
  const water = lordBlockerActions(lord, house, { causeId: "water_missing" as never, requirement: "water", reason: "missing", label: "물 없음", sources: [] })!;
  assert.ok(water.some(line => line.includes("우물")), water.join(" / "));
  // A paused workshop keeps its own line (the lord resumes it the same way in both modes).
  assert.equal(lordBlockerActions(lord, house, { causeId: "paused" as never, requirement: "production", reason: "paused", label: "멈춤", sources: [] }), null);
});

test("A1: the campaign's and the sandbox's inspector lines are the sandbox's own (no lord lever anywhere)", () => {
  for (const state of [campaign, sandbox]) {
    for (const line of inspectorLines(state)) assert.ok(!line.includes("명령 ›") && !line.includes("마을의 사업 후보"), line);
    for (const site of state.constructionSites) {
      const access = constructionAccessModel(state, site);
      assert.deepEqual(siteActions(access, state), siteActions(access));
    }
  }
});

test("A1: the levers follow the policy in force and the subsidy on offer (the engine's weights, the engine's refusals)", () => {
  const granary = { kind: "building", building: "granary" } as const;
  const growth = lordLevers(lord, granary);
  assert.match(growth[0]!, /'안정' 방침을 두면 곡창에 점수 \+25/);
  const stable = gameReducer(lord, { type: "set_estate_policy", policy: "stability" });
  const levers = lordLevers(stable, granary);
  assert.match(levers[0]!, /곡창에 장려금을 걸면 10d마다 점수 \+4/, "the policy in force is no lever: the subsidy comes first");
  assert.match(levers[1]!, /지금 '안정' 방침이 곡창에 점수 \+25/);
  assert.equal(subsidyRefusal(stable, "granary", 10), null, "a year in, the treasury allows a 10d subsidy");
  const funded = gameReducer(stable, { type: "set_project_subsidy", kind: "granary", amount: 10 });
  assert.match(lordLevers(funded, granary)[0]!, /곡창 장려금이 한 건에 10d 걸려 있습니다/);
  assert.equal(lordAdvice(lord, granary).length, 2);
  assert.deepEqual(lordLevers(campaign, granary), []);
});

test("A1: the event cards' [조언] and the steward's forecast in lord mode; the campaign's beats come back unchanged", () => {
  const kinds: readonly StoryKind[] = ["fire", "fire_warning", "fire_aftermath", "wet_summer", "bad_harvest", "famine_omen", "palisade", "petition", "first_winter"];
  const beats: StoryBeat[] = kinds.map(kind => ({ id: kind, kind, illustration: null, tile: null, title: kind, line: "", facts: [], advice: `sandbox:${kind}`, decision: null }));
  const lordBeats = withLordAdvice(lord, beats);
  for (const beat of lordBeats) {
    if (beat.kind === "petition" || beat.kind === "first_winter") { assert.equal(beat.advice, `sandbox:${beat.kind}`); continue; }
    assert.notEqual(beat.advice, `sandbox:${beat.kind}`);
    assert.doesNotMatch(beat.advice, BUILD, beat.advice);
  }
  assert.match(lordBeats.find(beat => beat.kind === "fire")!.advice, /우물을 공동체가 짓습니다/);
  assert.equal(withLordAdvice(campaign, beats), beats, "outside lord mode the very same beats");
  assert.match(lordForecastLine(lord, "fire", true)!, /^마른 여름이 옵니다\. 우물을 공동체가 짓습니다/);
  assert.equal(lordForecastLine(lord, "fire", false), null, "a rumour asks nothing yet");
  assert.equal(lordForecastLine(campaign, "famine", true), null);
  // The campaign's real beats keep the sandbox's copy.
  for (const beat of storyBeats(campaign)) if (beat.kind === "first_winter") assert.equal(beat.advice, EVENT_STORY_COPY.firstWinter.advice);
});

test("A1: the lean season, the season card's hint and the settlement panel in lord mode", () => {
  const lean = lordLeanSeason(lord)!;
  assert.doesNotMatch(lean.why, BUILD);
  assert.match(lean.why, /곡창과 밭은 마을이 짓습니다/);
  assert.equal(lordLeanSeason(campaign), null);
  const hint = lordSeasonHint(lord, "harvest_reserve", "다음: 식량 — 경작지 12칸이 필요합니다", { arableCells: 12, farmstead: false, mill: false })!;
  assert.match(hint, /^다음: 식량 — 경작지 12칸이 필요합니다 — 마을이 짓습니다\. /);
  assert.doesNotMatch(hint.slice(hint.indexOf("마을이 짓습니다")), BUILD);
  assert.equal(lordSeasonHint(campaign, "harvest_reserve", "x", undefined), null);
  const lordPanel = renderToStaticMarkup(createElement(SettlementPanel, { state: lord, onRestart: () => undefined }));
  assert.ok(lordPanel.includes(LORD_ADVICE_COPY.larderRule) && !lordPanel.includes(SCENARIO_COPY.sandboxGoal));
  const sandboxPanel = renderToStaticMarkup(createElement(SettlementPanel, { state: sandbox, onRestart: () => undefined }));
  assert.ok(sandboxPanel.includes(SETTLEMENT_PANEL_COPY.larderRule) && sandboxPanel.includes(SCENARIO_COPY.sandboxGoal));
});

test("A2: the town's seat, the camera kept per game, and the pill's 내 도시로 in lord mode only", () => {
  const manor = lord.buildings.find(entry => entry.kind === "manor_house")!;
  assert.deepEqual(townSeatTile(lord), { tx: manor.tx + 1, ty: manor.ty + 1 }, "the 3 × 3 manor's middle tile");
  const bare = { ...lord, buildings: lord.buildings.filter(entry => entry.kind !== "manor_house" && entry.kind !== "keep") };
  assert.deepEqual(townSeatTile(bare), townCentre(bare));
  assert.equal(cameraKey(lord), `fls.lordCamera.v1:${LORD_SLICE_SCENARIO_ID}:${lord.seed}`);
  assert.deepEqual(viewCentreTile({ x: 30, y: 60, width: 60, height: 20 }, { width: 64, height: 64 }), { tx: 32, ty: 37 });
  const memory = createMemoryPlatformServices();
  setPlatformServicesForTest(memory);
  try {
    assert.equal(readCameraTile(cameraKey(lord)), null);
    memory.preferences.set(cameraKey(lord), "31,40");
    assert.deepEqual(readCameraTile(cameraKey(lord)), { tx: 31, ty: 40 });
    memory.preferences.set(cameraKey(lord), "nonsense");
    assert.equal(readCameraTile(cameraKey(lord)), null);
  } finally { setPlatformServicesForTest(null); }
  const pill = (state: GameState) => renderToStaticMarkup(createElement(StatusPill, { state, model: statusPillModel(state), onOpenLedger: () => undefined,
    onOpenPopulation: () => undefined, onInspect: () => undefined }));
  const seat = townSeatTile(lord)!;
  assert.ok(pill(lord).includes(`data-town-seat="${seat.tx},${seat.ty}"`) && pill(lord).includes("내 도시로"));
  assert.ok(!pill(campaign).includes("status-pill-town") && !pill(sandbox).includes("status-pill-town"));
});

/** A cash line as the ledger keeps it (a test's own entry). */
const entry = (id: number, tick: number, category: LedgerEntry["category"], amount: number, sourceRefs: LedgerEntry["sourceRefs"]): LedgerEntry =>
  ({ id: `ledger-t${id}`, tick, account: "cash", category, amount, sourceRefs });
const withEntries = (state: GameState, entries: readonly LedgerEntry[]): GameState =>
  ({ ...state, ledger: { ...state.ledger!, entries: [...state.ledger!.entries, ...entries] } });

test("A4: a dues card says what came of the last dues answer — the rate, the stalls, the dues, the actual", () => {
  const dues = "ck_evt_005";
  assert.equal(sinceLastAnswer(lord, dues, "open"), null, "no earlier answer: nothing to say");
  const market = { type: "building", id: "market-test", detail: "stalls:3" } as const;
  const before = withEntries(lord, [entry(1, lord.tick - 10, "stall_fee", 12, [market])]);
  const set = gameReducer(before, { type: "set_market_dues", permille: 750 });
  const later = withEntries({ ...set, tick: set.tick + 500 }, [entry(2, set.tick + 400, "stall_fee", 15, [{ ...market, detail: "stalls:5" }])]);
  const view = sinceLastAnswer(later, dues, "open")!;
  assert.match(view.lines[0]!, /영주 탭에서 좌판세 평소의 75%/);
  assert.ok(view.lines.includes("좌판세: 그때 평소의 75%로 정했고 지금도 같습니다"));
  assert.ok(view.lines.includes("좌판: 그때 3칸 → 지금 5칸"));
  assert.ok(view.lines.includes("좌판세 한 번 정산: 그때 1s → 지금 1s 3d"));
  assert.ok(view.lines.some(line => line.startsWith("두 계절 뒤 금고의 실제는")));
  // A registry answer of the same kind, later, is the last one: its choice's own rate and words.
  const answered = { id: "registry:ck_evt_005:x:1", entryId: dues, boundId: "", offeredTick: later.tick - 50, deadline: later.tick + 500, status: "answered" as const,
    choiceId: "b", settledTick: later.tick - 20, receipt: { draw: 0, chancePermille: 1000, conditions: [] }, source: "v4" as const };
  const viaCard = { ...later, registry: { ...later.registry!, occurrences: [...later.registry!.occurrences, answered] } } as GameState;
  const card = sinceLastAnswer(viaCard, dues, "open")!;
  assert.ok(card.lines[0]!.endsWith(V4_COPY[dues]!.choices.b!.label));
  assert.ok(card.lines.includes("좌판세: 그때 평소의 125%로 정함 · 지금 평소의 75%"));
  assert.equal(sinceLastAnswer(viaCard, dues, answered.id)?.lines[0], view.lines[0], "the open card's own occurrence is not its last time");
  assert.equal(sinceLastAnswer(campaign, dues, "open"), null);
});

test("A5: the treasury by estate — an estate's own lines, the town's as the home estate's, the four questions", () => {
  assert.equal(entryEstate({ sourceRefs: [{ type: "building", id: "house-1" }] }), HOME_ESTATE_ID);
  assert.equal(entryEstate({ sourceRefs: [{ type: "actor", id: "estate:estate-b" }, { type: "claim", id: "p" }] }), "estate-b");
  const t = lord.tick;
  const state = withEntries(lord, [
    entry(11, t - 5, "estate_income", 100, [{ type: "actor", id: "estate:estate-b" }, { type: "actor", id: "person:s" }]),
    entry(12, t - 4, "marriage_portion", 60, [{ type: "actor", id: "house:x" }]),
    entry(13, t - 3, "project_subsidy", -20, [{ type: "actor", id: "merchants" }]),
  ]);
  const view = treasuryByEstate(state)!;
  assert.equal(view.estates[0]!.estateId, HOME_ESTATE_ID, "the home estate first");
  const other = view.estates.find(row => row.estateId === "estate-b")!;
  assert.deepEqual(other.groups.map(group => group.line), ["지대·영지 수입 +8s 4d"]);
  const home = view.estates[0]!;
  assert.ok(home.groups.some(group => group.group === "contracts" && group.line === "계약·약속 +5s"));
  assert.ok(home.groups.some(group => group.group === "spending" && group.parts.some(part => part.startsWith("사업 장려금 −1s 8d"))));
  const markup = renderToStaticMarkup(createElement(TreasuryByEstate, { state }));
  assert.ok(markup.includes('data-estate="estate-b"') && markup.includes("영지별 금고 출납"));
  assert.equal(treasuryByEstate(campaign), null);
  assert.equal(renderToStaticMarkup(createElement(TreasuryByEstate, { state: campaign })), "");
});
