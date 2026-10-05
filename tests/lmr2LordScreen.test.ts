import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { lordMode } from "../src/engine/townAgency";
import { GameProvider } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { LedgerDrawer } from "../src/ui/hud/HudShell";
import { LORD_NAV, LordScreen, navIconId, shownScreen } from "../src/ui/lord/screen/LordScreen";
import { LORD_SCREEN_COPY } from "../src/ui/lord/screen/lordScreenCopy.ko";
import { escapeOnce, INITIAL_UI_STATE, panelSlot, reduceUi, timeStopped, type UiEvent } from "../src/ui/stateMachine/uiStateMachine";
import { SURFACES } from "../src/ui/surfaces.registry";
import { isRegistryPart, unregisteredSurfaces } from "../scripts/checks/surfaceRegistry.mjs";

// LM-R2 scaffold: the lord screen host (a side panel in the slot, lord mode only), its menu, the 12 px text floor on
// the lord screens' styles, and the per-area row files the registry spreads.
const lordState = () => newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
const noop = () => undefined;

test("the lord screen takes the one panel slot, keeps time running and goes on Esc", () => {
  const run = (events: readonly UiEvent[]) => events.reduce(reduceUi, INITIAL_UI_STATE);
  const open = run([{ type: "open_ledger" }, { type: "open_lord" }]);
  assert.equal(panelSlot(open), "lord", "the ledger gives the slot to the lord screen");
  assert.equal(timeStopped(open), false, "a side panel, not a modal");
  assert.equal(panelSlot(reduceUi(open, { type: "select" })), "inspector");
  assert.equal(escapeOnce(open).mode, "idle");
  assert.equal(reduceUi(open, { type: "toggle_lord" }).mode, "idle");
  assert.equal(run([{ type: "push_modal", modal: "pause_menu" }, { type: "open_lord" }]).mode, "idle", "a modal holds the screen");
});

test("the menu: every lord-components-region item, each shut with its reason until its area opens it; the screen empty", () => {
  const state = lordState();
  assert.deepEqual(LORD_NAV.map(item => item.id), ["character", "dynasty", "region", "estates", "council", "marriage", "ledger", "petitions", "military"]);
  assert.equal(shownScreen(state, "marriage"), null, "the scaffold opens no screen");
  const html = renderToStaticMarkup(createElement(LordScreen, { state, dispatch: noop, screen: null, focus: null, onOpen: noop, onClose: noop, onPerson: undefined }));
  assert.match(html, /^<aside class="slot-panel lord-screen" data-frame="slot"/);
  for (const item of LORD_NAV) {
    assert.match(html, new RegExp(`data-lord-nav="${item.id}"[^>]*disabled=""`), `${item.id} shut`);
    assert.ok(html.includes(LORD_SCREEN_COPY.labels[item.id]), item.id);
  }
  assert.ok(html.includes(`<span class="lord-screen-nav-reason">${LORD_SCREEN_COPY.noRules}</span>`), "military: no rules");
  assert.ok(html.includes(`<p class="lord-screen-empty">${LORD_SCREEN_COPY.none}</p>`));
  assert.equal(html.includes("lord-screen-nav-icon"), false, "no icon until the region bundle's parts load");
  assert.equal(navIconId("region"), "lord.nav.region");
  assert.doesNotMatch(html, /\stitle="/);
});

test("lord mode only: the way in shows in the lord tab when App passes it, and App mounts the host only in lord mode (source guard)", () => {
  const state = lordState();
  assert.ok(lordMode(state));
  const drawer = (onOpenLord?: () => void) => renderToStaticMarkup(createElement(GameProvider, null,
    createElement(LedgerDrawer, { state, onInspect: noop, onClose: noop, viewTab: null, mapTab: null, initialTab: "lord", onOpenLord })));
  assert.match(drawer(noop), /data-lord-open="true"/);
  assert.doesNotMatch(drawer(), /data-lord-open/);
  assert.equal(lordMode(newGameState({ scenarioId: DEFAULT_SCENARIO_ID })!), false);
  const app = readFileSync("src/App.tsx", "utf8");
  assert.match(app, /onOpenLord=\{lord \? \(\) => openLord\(\) : undefined\}/);
  assert.match(app, /\{lord && ui\.mode === "lord" \? <LordScreen /);
});

/** Every font size a stylesheet sets, with its line (px only: another unit cannot be checked against the floor). */
function fontSizes(css: string): { readonly line: number; readonly value: string }[] {
  const out: { line: number; value: string }[] = [];
  css.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, " ")).split("\n").forEach((text, index) => {
    for (const match of text.matchAll(/font-size:\s*([^;}]+)/g)) out.push({ line: index + 1, value: match[1]!.trim() });
    // The shorthand's size: the token before an optional /line-height, after the style and weight.
    for (const match of text.matchAll(/(?<![-\w])font:\s*([^;}]+)/g)) {
      const size = match[1]!.match(/(?:^|\s)([\d.]+[a-z%]+)(?:\/|\s)/);
      if (size !== null) out.push({ line: index + 1, value: size[1]! });
    }
  });
  return out;
}
const tooSmall = (value: string): boolean => {
  if (/^var\(|^inherit$|^(?:smaller|larger)$/.test(value)) return value === "smaller";
  const px = value.match(/^([\d.]+)px$/);
  return px === null || Number(px[1]) < 12;
};

test("12 px floor: no font size under 12 px (or in an unchecked unit) in the lord screens' stylesheets or inline styles", () => {
  const sheets = readdirSync("src/styles").filter(name => /^lord(Screen|Negotiation|Ledger|Estates|Region)\.css$/.test(name));
  assert.equal(sheets.length, 5);
  const offenders = sheets.flatMap(name => fontSizes(readFileSync(`src/styles/${name}`, "utf8")).filter(size => tooSmall(size.value)).map(size => `${name}:${size.line} ${size.value}`));
  const inline = readdirSync("src/ui/lord", { recursive: true, encoding: "utf8" }).filter(name => /\.(tsx|ts)$/.test(name))
    .flatMap(name => [...readFileSync(`src/ui/lord/${name}`, "utf8").matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)].filter(match => Number(match[1]) < 12).map(match => `${name} fontSize ${match[1]}`));
  assert.deepEqual([...offenders, ...inline], []);
  assert.deepEqual(fontSizes(".a { font-size: 11px }\n.b { font: 600 10px/1.3 serif; }\n.c { font-size: 0.8rem; }").map(size => size.value), ["11px", "10px", "0.8rem"]);
  assert.ok(["11px", "10px", "0.8rem", "smaller"].every(tooSmall) && !["12px", "13px", "var(--font-body)"].some(tooSmall));
});

test("each area's rows file is spread into the registry and read by the registry check", () => {
  assert.ok(isRegistryPart("src/ui/lord/estates/surfaces.ts") && !isRegistryPart("src/ui/lord/estates/deep/surfaces.ts") && !isRegistryPart("src/ui/surfaces.ts"));
  assert.ok(SURFACES.some(row => row.id === "lord.screen"));
  const files: Record<string, string> = {
    "src/ui/surfaces.registry.ts": "export const SURFACES = [];\nexport const NOT_SURFACES = {};",
    "src/ui/lord/estates/surfaces.ts": "export const ESTATES_SURFACES = [{ root: \".estate-card\" }];",
    "src/ui/lord/estates/EstateCard.tsx": "export const A = () => <section className=\"estate-card\" data-frame=\"slot\">x</section>;",
    "src/ui/lord/ledger/LedgerPanel.tsx": "export const B = () => <section className=\"promise-card\" data-frame=\"slot\">y</section>;",
  };
  const result = unregisteredSurfaces({ list: () => Object.keys(files), read: (path: string) => files[path]! });
  assert.deepEqual([...new Set(result.missing.map((row: { names: string[] }) => row.names.join(".")))], ["promise-card"]);
});
