import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { foodShortage } from "../src/engine/foodShortage";
import { rebuildBurntHouse } from "../src/engine/fire";
import { createMemoryPlatformServices } from "../src/platform/memoryPlatform";
import { setPlatformServicesForTest } from "../src/platform/platform";
import { decodeSave } from "../src/save/saveCodec";
import { newGameState } from "../src/state/newGame";
import { burntHouseView } from "../src/ui/burntHouseModel";
import { CommandPins, publicWorkPins } from "../src/ui/hud/CommandPins";
import { foodBreakdown } from "../src/ui/hud/foodBreakdownModel";
import { GoalPinBlock } from "../src/ui/hud/GoalPinBlock";
import { chapterFlow, goalPin, goalPinFor } from "../src/ui/hud/goalPinModel";
import { SeasonLedgerCard } from "../src/ui/hud/SeasonLedgerCard";
import { SeasonNotice } from "../src/ui/hud/SeasonNotice";
import { BurntHouseSection, MapCardExtras } from "../src/ui/MapCardExtras";
import { seasonLedgerChoice, setSeasonLedgerAuto } from "../src/ui/seasonLedgerPreference";
import { GoalDrawer } from "../src/ui/tutorial/TutorialShell";

// LM-R1 hud: the playtest's six blockers (docs/qa/playtest-20261002) and lord mode's command pins, on real states — the
// v24 chapter-1 town under wall construction, a new campaign and the lord's slice.

const wallTown = () => decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;

test("#1: the pin is the town goal, the very next thing it waits on and where to go for it", () => {
  const town = wallTown();
  const pin = goalPin(town);
  assert.equal(pin?.title, "목책 마을");
  assert.deepEqual(pin?.count, { current: 0, target: 1 });
  assert.match(pin?.next?.line ?? "", /^성벽 \d+\/\d+구간 완공$/);
  assert.deepEqual(pin?.next?.action, { kind: "goals" });
  // A hamlet short of timber for the proclamation: "목재 250단까지 n단 부족", the stock ledger (no full store holds it).
  const hamlet: GameState = { ...town, era: "hamlet", palisade: null, constructionSites: town.constructionSites.filter(site => site.kind !== "palisade_segment") };
  const goal = { id: "palisade", title: "목책 마을", description: "", criteria: [{ id: "era", label: "시장도시 이상", current: 0, target: 1, met: false }], holdTicks: 0, requiredHoldTicks: 0 } as const;
  assert.deepEqual(goalPinFor(hamlet, goal).next, { line: "목재 250단까지 54단 부족", cta: "저장·생산 보기", action: { kind: "ledger" } });
  // Every storehouse full (of logs) and a sawmill's timber with nowhere to go: the pin goes to the nearest full store.
  const saw = town.buildings.find(building => building.kind === "sawmill")!;
  const blocked: GameState = { ...hamlet, buildings: hamlet.buildings.map(building => building.kind === "storehouse" ? { ...building, inventory: { logs: 200 }, reserved: {} }
    : building.id === saw.id ? { ...building, inventory: { ...building.inventory, timber: 6 } } : building) };
  const toStore = goalPinFor(blocked, goal).next;
  assert.equal(toStore?.cta, "창고 보기");
  assert.equal(toStore?.action.kind, "inspect");
  assert.equal(blocked.buildings.find(building => toStore?.action.kind === "inspect" && building.id === toStore.action.buildingId)?.kind, "storehouse");
  // Every criterion met: hold it.
  const held = goalPinFor(town, { ...goal, criteria: [{ ...goal.criteria[0], current: 1, met: true }], requiredHoldTicks: 600, holdTicks: 100 });
  assert.equal(held.count, null);
  assert.match(held.next?.line ?? "", /^모든 조건을 갖췄습니다 — .+ 더 유지하십시오$/);
  // The sandbox and lord mode have no goal: no pin.
  assert.equal(goalPin(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!), null);
});

test("#10: the chapter's flow beside the town goal; #1: the finished goals fold under the pin", () => {
  const town = wallTown();
  const chapter = chapterFlow(town);
  assert.deepEqual(chapter, { number: 1, title: "제1장 · 촌락에서 시장도시로", goal: "시장도시를 선포하고 대기근을 넘긴다", reached: 0, total: 1 });
  assert.equal(chapterFlow(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!), null);
  const pinMarkup = renderToStaticMarkup(createElement(GoalPinBlock, { pin: goalPin(town), chapter, onAction: () => undefined }));
  assert.match(pinMarkup, /class="goal-pin-column goal-pin-chapter".*class="goal-pin-column goal-pin-town"/);
  assert.match(pinMarkup, /도시 목표와 따로 흘러갑니다/);
  assert.match(pinMarkup, /class="goal-pin-cta ui-btn[^"]*"/);
  const log = [{ id: "well", title: "우물", already: false }, { id: "house", title: "집", already: true }];
  const drawer = renderToStaticMarkup(createElement(GoalDrawer, { open: true, log, pin: createElement("p", { className: "pin" }, "pin") }));
  // The pin first, then the log inside a closed <details>.
  assert.ok(drawer.indexOf('class="pin"') < drawer.indexOf("goal-drawer-done"));
  assert.match(drawer, /<details class="goal-drawer-done ui-disclosure">/);
  assert.doesNotMatch(drawer, /<details[^>]* open/);
  assert.match(drawer, /끝낸 목표 2개/);
});

test("#5: the food cell splits into total, milling, carrying, access and the households going hungry (FIX-16)", () => {
  const town = wallTown();
  const model = foodBreakdown(town);
  assert.deepEqual(model.rows.map(row => row.key), ["total", "milling", "carrying", "access", "starving"]);
  assert.match(model.rows[0]!.value, /^곳간의 빵 [\d,]+덩이 · 밀 [\d,]+자루 — [\d,]+일$/);
  assert.equal(model.starving, foodShortage(town).starvingHouseholds);
  // Bound wheat in a barn the engine marks stuck: "묶인 밀 n자루 — 풀리면 +n일", the most urgent after hunger.
  const barn = town.buildings.find(building => building.kind === "farmstead")!;
  const bound: GameState = { ...town, buildings: town.buildings.map(building => building.id === barn.id
    ? { ...building, inventory: { ...building.inventory, wheat: 782 }, stuckSinceTick: { wheat: town.tick - 400 } } : building) };
  const carrying = foodBreakdown(bound).rows.find(row => row.key === "carrying")!;
  assert.match(carrying.value, /^묶인 밀 782자루 — 풀리면 \+[\d,]+일$/);
  assert.equal(carrying.urgent, true);
  // A household starving: the starving row is the urgent one and goes to that house.
  const house = town.houses.find(entry => entry.residents > 0)!;
  const hungry: GameState = { ...bound, houses: bound.houses.map(entry => entry.buildingId === house.buildingId
    ? { ...entry, breadStock: 0, starvationGraceUntilTick: 0, emptyFoodTicks: 100_000 } : entry) };
  const hungryModel = foodBreakdown(hungry);
  assert.equal(hungryModel.starving, foodShortage(hungry).starvingHouseholds);
  assert.ok(hungryModel.starving >= 1);
  assert.equal(hungryModel.urgent?.key, "starving");
  assert.equal(hungryModel.rows.find(row => row.key === "starving")?.value, `${hungryModel.starving}가구`);
});

test("#7: the season card opens by itself the first time and asks; later seasons are a notice unless the player chose", () => {
  const memory = createMemoryPlatformServices();
  setPlatformServicesForTest(memory);
  try {
    assert.equal(seasonLedgerChoice(), "unset");
    setSeasonLedgerAuto(false);
    assert.equal(seasonLedgerChoice(), "notice");
    setSeasonLedgerAuto(true);
    assert.equal(seasonLedgerChoice(), "auto");
  } finally {
    setPlatformServicesForTest(null);
  }
  const model = { key: "1300-0", title: "1300년 봄 결산", scenes: [], scenesLine: "", lines: [], drinkLine: null, drink: [], aleLines: [], clothLine: null, cloth: [], clothLines: [], events: [], hint: null };
  const props = { model, onResume: () => undefined, onHint: () => undefined, auto: false, onAutoChange: () => undefined } as unknown as Parameters<typeof SeasonLedgerCard>[0];
  const first = renderToStaticMarkup(createElement(SeasonLedgerCard, { ...props, first: true }));
  assert.match(first, /다음 계절부터 결산은/);
  assert.match(first, /class="season-ledger-first-auto ui-btn[^"]*" aria-pressed="false"/);
  assert.match(first, /class="season-ledger-first-notice ui-btn[^"]*" aria-pressed="true"/);
  assert.doesNotMatch(first, /season-ledger-auto"/);
  const later = renderToStaticMarkup(createElement(SeasonLedgerCard, props));
  assert.doesNotMatch(later, /season-ledger-first/);
  assert.match(later, /계절마다 결산 띄우기: 끔/);
  assert.equal(renderToStaticMarkup(createElement(SeasonNotice, { count: 0, onOpen: () => undefined })), "");
  const notice = renderToStaticMarkup(createElement(SeasonNotice, { count: 3, onOpen: () => undefined }));
  assert.match(notice, /<button type="button" class="season-notice ui-btn[^"]*" data-season-notices="3" aria-label="쌓인 계절 결산 3건 — 누르면 마지막 결산을 엽니다"/);
});

test("#8: a burnt house says whether it is being rebuilt, what that needs and what to do now", () => {
  const town = wallTown();
  const house = town.houses.find(entry => entry.residents > 0)!;
  const burnt: GameState = { ...town, houses: town.houses.map(entry => entry.buildingId === house.buildingId ? { ...entry, burntTick: town.tick - 10, burntByEventId: "fire-1" } : entry) };
  const waiting = burntHouseView(burnt, house.buildingId);
  assert.equal(waiting?.status, "아직 시작하지 않았습니다");
  assert.equal(waiting?.canRebuild, true);
  assert.equal(waiting?.now, "다시 짓기를 누르면 공사장이 섭니다");
  assert.ok((waiting?.conditions.length ?? 0) >= 1);
  const markup = renderToStaticMarkup(createElement(BurntHouseSection, { view: waiting!, onRebuild: () => undefined }));
  assert.match(markup, /<dt>다시 짓는 중<\/dt>.*<dt>필요한 조건<\/dt>.*<dt>지금 할 일<\/dt>/);
  assert.match(markup, /data-action="rebuild-house"/);
  // Started: its work and builders, its materials, no button.
  const started = rebuildBurntHouse(burnt, house.buildingId);
  const rebuilding = burntHouseView(started, house.buildingId);
  assert.match(rebuilding?.status ?? "", /^공사 \d+% · (일꾼 \d+명|일꾼 없음)$/);
  assert.equal(rebuilding?.canRebuild, false);
  // A house's rebuild takes no materials; what holds it is the site's own cause (here: no builder free), and its action.
  assert.deepEqual(rebuilding?.conditions, [{ text: "공사에 나갈 일꾼이 없습니다", met: false }]);
  assert.equal(rebuilding?.now, "주택을 늘리거나 다른 공사를 줄여 일꾼을 확보하세요");
  // Lord mode: the town rebuilds (no button).
  const lord: GameState = { ...burnt, agency: newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!.agency! };
  assert.equal(burntHouseView(lord, house.buildingId)?.canRebuild, false);
  assert.equal(burntHouseView(town, house.buildingId), null);
  // The map's card carries it above its own body.
  assert.match(renderToStaticMarkup(createElement(MapCardExtras, { state: burnt, buildingId: house.buildingId, onJump: () => undefined, onRebuild: () => undefined })), /inspector-burnt/);
  assert.equal(renderToStaticMarkup(createElement(MapCardExtras, { state: town, buildingId: house.buildingId, onJump: () => undefined, onRebuild: () => undefined })), "");
});

test("lord mode: the command pins are the public works (성채) and the encouragement zones; the sandbox has none", () => {
  const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
  const pins = publicWorkPins(lord);
  assert.deepEqual(pins.map(pin => [pin.id, pin.title]), [["work:keep", "성채 짓기"]]);
  const markup = renderToStaticMarkup(createElement(CommandPins, { state: lord, onPublicWork: () => undefined, onZone: () => undefined }));
  assert.match(markup, /<aside class="command-pins" data-frame="strip-bottom" aria-label="영주의 명령">/);
  assert.match(markup, /data-command-pin="zone"/);
  assert.match(markup, /다른 건물은 마을이 스스로 짓습니다/);
  assert.doesNotMatch(markup, /title=/);
  // A keep standing closes its pin with the reason.
  const standing: GameState = { ...lord, buildings: [...lord.buildings, { ...lord.buildings[0]!, id: "keep-1", kind: "keep" }] };
  assert.deepEqual(publicWorkPins(standing).map(pin => [pin.enabled, pin.note]), [[false, "성채 — 이미 섰습니다"]]);
  assert.equal(newGameState({ scenarioId: DEFAULT_SCENARIO_ID })!.agency, undefined);
});

test("lord mode only: App mounts the pins and hides the layer switch only when lordMode(state) is true (source guard)", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  assert.match(app, /const lord = lordMode\(state\);/);
  assert.match(app, /\{lord \? ui\.mode === "build" \? <CommandPins/);
  assert.match(app, /hidden=\{!visibility\.layers \|\| \(lord && ui\.mode !== "zone"\)\}/);
  assert.match(app, /commands=\{lord\}/);
  // Q / E and the pad arm only the public works in lord mode (the engine refuses every other placement there).
  assert.match(app, /if \(tool !== null && lordRef\.current && \(tool === "road" \|\| !LORD_PUBLIC_WORKS\.includes\(tool\)\)\) return;/);
});
