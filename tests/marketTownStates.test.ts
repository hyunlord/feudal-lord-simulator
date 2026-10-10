/**
 * MARKET-TOWN: the geometry audit's `market` rows (src/ui/lord/market/surfaces.ts) stand on the three states
 * scripts/marketTownStates.ts writes (the lord bot's slice past the market charter's proclamation) and the ui-geometry
 * task requires each. MARKET_STATES=<dir> (DGX ~/fls-market-states) adds the states themselves: each past the hamlet,
 * the engine's plan `past`, and the lord's era console showing the plan's past line with no plan button of its own.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BALANCE } from "../src/content/balanceConfig";
import { charterWallPlan } from "../src/engine/charterPlan";
import type { GameState } from "../src/engine/engine.types";
import { buildEraConsoleModel, EraConsole } from "../src/ui/EraConsole";
import { lordWallPlan, lordWallPlanDone } from "../src/ui/lord/advice/lordWall";
import { LORD_WALL_COPY as COPY } from "../src/ui/lord/advice/lordWallCopy.ko";
import { MARKET_SURFACES } from "../src/ui/lord/market/surfaces";
import { SURFACES } from "../src/ui/surfaces.registry";

const NAMES = ["market-proclaimed", "market-season-eve", "market-years"] as const;
const SEASON = BALANCE.TICKS_PER_YEAR / 4;
const noop = () => undefined;
const consoleHtml = (state: GameState) => renderToStaticMarkup(createElement(EraConsole, { model: buildEraConsoleModel({ state, draft: null }), onBeginProposal: noop, onConfirmProposal: noop, onCancelProposal: noop }));

test("MARKET-TOWN rows: each on a market state the script writes, each state required by the ui-geometry task, the console rows ask for the past line", () => {
  assert.ok(MARKET_SURFACES.length >= 12 && MARKET_SURFACES.length <= 20, `${MARKET_SURFACES.length} rows`);
  for (const row of MARKET_SURFACES) {
    assert.ok(SURFACES.includes(row), `${row.id} is in the registry`);
    assert.ok(row.scene.kind === "state" && row.scene.set === "market" && (NAMES as readonly string[]).includes(row.scene.name), row.id);
  }
  const consoles = MARKET_SURFACES.filter(row => row.root === ".era-console");
  assert.deepEqual(consoles.map(row => row.scene.kind === "state" ? row.scene.name : null), ["market-proclaimed", "market-years"]);
  for (const row of consoles) assert.ok(row.requires?.includes(".era-plan-done"), row.id);
  const task = readFileSync("scripts/remote/tasks.sh", "utf8");
  assert.match(task, /market=\$\{MARKET_STATES:-\$HOME\/fls-market-states\}/);
  for (const name of NAMES) assert.ok(task.includes(`"$market/${name}.json"`), name);
  assert.match(readFileSync("scripts/uiGeometryAudit.mjs", "utf8"), /market: 'states-market'/);
});

const statesDir = process.env.MARKET_STATES;
test("MARKET-TOWN states (MARKET_STATES): past the hamlet, the plan past, the console's past line and no plan button", t => {
  if (statesDir === undefined || !existsSync(statesDir)) { t.skip("MARKET_STATES not set: scripts/marketTownStates.ts writes them on the DGX"); return; }
  for (const name of NAMES) {
    const state = JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
    assert.notEqual(state.era, "hamlet", name);
    assert.equal(charterWallPlan(state)?.stage, "past", name);
    assert.equal(lordWallPlan(state), null, name);
    assert.equal(lordWallPlanDone(state), COPY.stage.past, name);
    const html = consoleHtml(state);
    assert.match(html, new RegExp(`class="era-action-reason era-plan-done">${COPY.stage.past}<`), name);
    assert.ok(!html.includes("data-wall-plan=\"open\""), name);
  }
  const eve = JSON.parse(readFileSync(join(statesDir, "market-season-eve.json"), "utf8")) as GameState;
  assert.equal(SEASON - (eve.tick % SEASON), 40, "the eve is 40 ticks before a season's close");
});
