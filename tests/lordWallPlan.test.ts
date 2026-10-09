/**
 * GROW-BLOCK (the screen's part, the user's ruling 2026-10-09): in lord mode the era console's one primary is the town's
 * palisade plan, "마을의 목책 계획", read from the engine's charterWallPlan — per stage: waiting (each unmet condition,
 * who builds the engine's project, the lord's lever and its place), sites (the sites holding the search, their age, the
 * sites the town gave up in its own record's words), searching / asked, failed (why in plain words, the homes a wall
 * would cut off with [위치로], the attempts, when it searches again). No drawing button in lord mode; the sandbox keeps it.
 * In-process states are the lord's slice (the engine's read on it; a stage the opening does not hold is that read with
 * its stage set). GROWPLAN_STATES=<dir> (scripts/growPlanStates.ts, DGX ~/fls-growplan-states) adds the bot's real ones.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../src/content/buildingConfig";
import { CHARTER_RING } from "../src/content/charterRingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { AGENCY_WEEK_TICKS } from "../src/content/townAgencyConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { charterWallPlan, type CharterWallPlan } from "../src/engine/charterPlan";
import type { GameState } from "../src/engine/engine.types";
import { advanceHistory } from "../src/engine/history";
import { scenarioOf } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { advanceTownAgency } from "../src/engine/townAgency";
import type { CharterWallFailureReason } from "../src/engine/townAgency.types";
import { newGameState } from "../src/state/newGame";
import { stripComments } from "../scripts/checks/surfaceRegistry.mjs";
import { calendarArrivalLabel } from "../src/ui/calendarArrival";
import { buildEraConsoleModel, EraConsole } from "../src/ui/EraConsole";
import { lordLeverPlaces, needOfProject, whoBuilds } from "../src/ui/lord/advice/lordAdvice";
import { lordWallPlan, wallPlanView, type LordWallPlanView } from "../src/ui/lord/advice/lordWall";
import { LORD_WALL_COPY as COPY } from "../src/ui/lord/advice/lordWallCopy.ko";
import { WallPlan } from "../src/ui/lord/advice/WallPlan";
import { WALL_DRAFT_COPY } from "../src/ui/wallDraftCopy.ko";

const noop = () => undefined;
const lordGame = (): GameState => { let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!; for (let tick = 0; tick < 10; tick += 1) state = advanceTick(state); return state; };
const planHtml = (plan: LordWallPlanView) => renderToStaticMarkup(createElement(WallPlan, { plan, commands: { onConditions: noop, onZones: noop, onLookAt: noop } }));
const consoleHtml = (state: GameState) => renderToStaticMarkup(createElement(EraConsole, { model: buildEraConsoleModel({ state, draft: null }), onBeginProposal: noop, onConfirmProposal: noop, onCancelProposal: noop }));
/** The engine's read of a state, with the stage a test needs (its requirements, failure and the state's own sites stay the engine's). */
const asStage = (state: GameState, stage: CharterWallPlan["stage"], sites: CharterWallPlan["sites"] = []): CharterWallPlan => ({ ...charterWallPlan(state)!, stage, sites });
const SCREEN_RULES = /title=|[\u{1F300}-\u{1FAFF}☀-➿]/u;

test("GROW-BLOCK plan, waiting: each unmet condition with who builds the engine's project and the lord's first lever, the way to where he sets it", () => {
  const state = lordGame();
  const engine = charterWallPlan(state)!;
  const plan = lordWallPlan(state)!;
  assert.equal(plan.stage, "waiting");
  const unmet = engine.requirements.filter(requirement => !requirement.met);
  assert.deepEqual(plan.conditions.map(condition => condition.key), unmet.map(requirement => requirement.key));
  assert.equal(plan.line, COPY.stage.waiting(unmet.length));
  for (const requirement of unmet) {
    const condition = plan.conditions.find(entry => entry.key === requirement.key)!;
    assert.equal(condition.project, requirement.project !== null && requirement.project in BUILDING_CONFIG_BY_KIND ? whoBuilds(requirement.project as BuildingKind) : COPY.noProject, requirement.key);
    const need = needOfProject(requirement.project);
    assert.deepEqual(condition.lever, need === null ? null : lordLeverPlaces(state, need)[0] ?? null, requirement.key);
  }
  const population = plan.conditions.find(condition => condition.key === "population")!;
  assert.equal(population.lever?.place, "zone", "the houses' lever: 명령 › 장려 구역");
  const html = planHtml(plan);
  assert.match(html, /data-wall-plan-stage="waiting"/);
  assert.match(html, /data-wall-plan-go="zone"/);
  assert.equal(html.match(/ui-btn--primary/g), null, "the plan has secondaries only");
  assert.doesNotMatch(html, SCREEN_RULES);
  assert.equal(lordWallPlan(state), plan, "once per state");
});

test("GROW-BLOCK plan: the console's one primary opens the plan; no drawing or recommendation in lord mode, the sandbox keeps its drawing", () => {
  const state = lordGame();
  const model = buildEraConsoleModel({ state, draft: null });
  assert.deepEqual([model.action.label, model.action.enabled, model.action.reason], [COPY.plan, true, lordWallPlan(state)!.line]);
  const html = consoleHtml(state);
  assert.equal(html.match(/ui-btn--primary/g)?.length, 1, "one primary");
  assert.match(html, /data-wall-plan="open"[^>]*>마을의 목책 계획</);
  assert.match(html, /aria-expanded="false"/);
  assert.ok(!html.includes(`>${WALL_DRAFT_COPY.drawTool}<`) && !html.includes(`>${WALL_DRAFT_COPY.recommend}<`), "no hand drawing in lord mode");
  assert.equal(model.lordPlan, lordWallPlan(state));
  const { agency: _agency, ...sandbox } = state;
  const sandboxModel = buildEraConsoleModel({ state: sandbox as GameState, draft: null });
  assert.deepEqual([sandboxModel.lordPlan, sandboxModel.action.label], [null, WALL_DRAFT_COPY.drawTool]);
});

test("GROW-BLOCK plan, sites: the sites holding the search with how long each has stood, and a site the town gave up in its record's words", () => {
  let state = lordGame();
  for (let tick = 0; tick < 400 && !state.constructionSites.some(isBuildingConstructionSite); tick += 1) state = advanceTick(state);
  const site = state.constructionSites.find(isBuildingConstructionSite)!;
  // GB-4 as the engine's own test makes it: a site no road reached for a year, given up at the town's week.
  const week = (Math.floor(state.tick / AGENCY_WEEK_TICKS) + 1) * AGENCY_WEEK_TICKS;
  const before = { ...state, tick: week, constructionSites: state.constructionSites.map(entry => entry.id !== site.id ? entry
    : { ...entry, stall: "no_route" as const, builderTicks: 0, delivered: {}, startedTick: week - CHARTER_RING.abandonTicks - 10 }) };
  const after = advanceHistory(before, advanceTownAgency(before));
  assert.equal(after.agency!.abandonedSites!.length, 1);
  const open = [{ id: "site-a", kind: "granary", since: after.tick - 4_000 - 1_000 }, { id: "site-b", kind: "well", since: after.tick - 500 }, { id: "site-c", kind: "chapel", since: null }];
  const plan = wallPlanView(after, asStage(after, "sites", open))!;
  assert.equal(plan.line, COPY.stage.sites(3));
  assert.deepEqual(plan.sites, [COPY.site(BUILDING_CONFIG_BY_KIND.granary.name, COPY.age(1, 1)), COPY.site(BUILDING_CONFIG_BY_KIND.well.name, COPY.age(0, 0)),
    COPY.site(BUILDING_CONFIG_BY_KIND.chapel.name, COPY.ageUnknown)]);
  assert.equal(plan.abandoned.length, 1);
  assert.match(plan.abandoned[0]!, /공사를 접었다 — 1년 동안 길이 닿지 않았다$/, "the engine's record sentence");
  assert.deepEqual([plan.conditions, plan.failure, plan.ringAllowed], [[], null, false]);
  const html = planHtml(plan);
  assert.match(html, /data-wall-plan-site="2"/);
  assert.match(html, /마을이 요즘 접은 공사/);
  assert.doesNotMatch(html, SCREEN_RULES);
});

test("GROW-BLOCK plan, failed: why in plain words for each of the engine's eight reasons, the homes cut off with [위치로], the attempts, the next search as a season", () => {
  const state = lordGame();
  const house = state.buildings.find(building => building.kind === "house")!;
  const reasons: readonly CharterWallFailureReason[] = ["water", "edge", "buildings", "service_space", "rules", "lots", "route", "other"];
  assert.equal(new Set(reasons.map(reason => COPY.reasons[reason])).size, 8, "eight different words");
  for (const reason of reasons) {
    assert.match(COPY.reasons[reason], /[가-힣]/);
    assert.doesNotMatch(COPY.reasons[reason], /[A-Za-z]{2,}/);
    const failed = { ...state, agency: { ...state.agency!, charterWallFailure: { tick: state.tick, reason, homes: reason === "service_space" ? [house.id] : [], attempts: 2 } } };
    const engine = asStage(failed, "failed");
    const plan = wallPlanView(failed, engine)!;
    assert.equal(plan.line, COPY.stage.failed);
    assert.equal(plan.failure!.why, COPY.reasons[reason]);
    assert.equal(plan.failure!.attempts, COPY.attempts(2));
    assert.equal(plan.failure!.retry, COPY.retry(calendarArrivalLabel(failed.tick, engine.failure!.retryTick, scenarioOf(failed).startYear)));
    assert.equal(plan.ringAllowed, true, "the seam for the lord's ring: failed only");
    if (reason === "service_space") {
      assert.deepEqual([plan.failure!.homes, plan.failure!.homeTile], [COPY.homes(1), { tx: house.tx, ty: house.ty }]);
      const html = planHtml(plan);
      assert.match(html, /data-wall-plan-look="home"/);
      assert.doesNotMatch(html, SCREEN_RULES);
    } else assert.deepEqual([plan.failure!.homes, plan.failure!.homeTile], [null, null]);
  }
});

test("GROW-BLOCK plan, searching and asked: the town's turn, its request answered on its own chip; past the hamlet nothing", () => {
  const state = lordGame();
  assert.equal(wallPlanView(state, asStage(state, "searching"))!.line, COPY.stage.searching);
  const asked = wallPlanView(state, asStage(state, "asked"))!;
  assert.deepEqual([asked.line, asked.conditions, asked.ringAllowed], [COPY.stage.asked, [], false]);
  assert.equal(wallPlanView(state, asStage(state, "past")), null);
  assert.equal(lordWallPlan({ ...state, era: "palisade" }), null);
});

test("GROW-BLOCK plan: no engine rule copied — the screen reads the stage, the projects and the retry from charterWallPlan", () => {
  for (const file of ["src/ui/lord/advice/lordWall.ts", "src/ui/lord/advice/WallPlan.tsx", "src/ui/EraConsole.tsx"]) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const copied of ["ERA_REQUIREMENT_PROJECT", "CHARTER_RING", "lordRequests", "charterRetryTick", "charterWallTried", "isBuildingConstructionSite", "abandonTicks"]) {
      assert.ok(!source.includes(copied), `${file} reads ${copied} itself`);
    }
  }
  const wall = stripComments(readFileSync("src/ui/lord/advice/lordWall.ts", "utf8"));
  assert.ok(!wall.includes("evaluateEraRequirements"), "the conditions are the plan's");
  assert.doesNotMatch(wall, /"population"|"granary"|"logging_camp"/, "no condition → project pairing of the screen's own");
});

const statesDir = process.env.GROWPLAN_STATES;
test("GROW-BLOCK plan on the bot's real states (GROWPLAN_STATES): each stage as the engine reads it", t => {
  if (statesDir === undefined || !existsSync(statesDir)) { t.skip("GROWPLAN_STATES not set: scripts/growPlanStates.ts writes them on the DGX"); return; }
  let seen = 0;
  for (const stage of ["waiting", "sites", "searching", "asked", "failed"] as const) {
    const path = join(statesDir, `plan-${stage}.json`);
    if (!existsSync(path)) continue;
    seen += 1;
    const state = JSON.parse(readFileSync(path, "utf8")) as GameState;
    const engine = charterWallPlan(state)!;
    const plan = lordWallPlan(state)!;
    assert.deepEqual([engine.stage, plan.stage], [stage, stage], path);
    assert.equal(plan.ringAllowed, stage === "failed");
    if (stage === "waiting") assert.equal(plan.conditions.length, engine.requirements.filter(requirement => !requirement.met).length);
    if (stage === "sites") assert.equal(plan.sites.length, engine.sites.length);
    if (stage === "failed") assert.equal(plan.failure!.why, COPY.reasons[engine.failure!.reason]);
    const html = planHtml(plan);
    assert.match(html, new RegExp(`data-wall-plan-stage="${stage}"`));
    assert.doesNotMatch(html, SCREEN_RULES, path);
    assert.equal(consoleHtml(state).match(/ui-btn--primary/g)?.length, 1, `${stage}: one primary`);
  }
  assert.ok(seen >= 3, `at least waiting, sites and failed: ${seen}`);
});
