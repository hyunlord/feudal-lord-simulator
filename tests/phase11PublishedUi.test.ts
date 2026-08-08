import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import * as worldAssets from "../src/render/worldAssets";
import { drawOnboardingGuidanceOverlay } from "../src/render/onboardingGuidanceOverlay";

const PRODUCTION_UI_FILES = [
  "src/App.tsx",
  "src/render/GameCanvas.tsx",
  "src/ui/BuildMenu.tsx",
  "src/ui/EconomyOverlayControls.tsx",
  "src/ui/EraConsole.tsx",
  "src/ui/InfoPanel.tsx",
  "src/ui/OverlayControls.tsx",
  "src/ui/SpeedControls.tsx",
  "src/ui/eraCeremonyModel.tsx",
] as const;

test("published asset URLs retain the Vite repository base", () => {
  const resolver = (worldAssets as unknown as {
    readonly assetUrlForBase?: (path: string, baseUrl: string) => string;
  }).assetUrlForBase;

  assert.equal(typeof resolver, "function");
  assert.equal(
    resolver?.("public/assets/foliage/tree_oak_small.png", "/feudal-lord-simulator/"),
    "/feudal-lord-simulator/assets/foliage/tree_oak_small.png",
  );
  assert.equal(resolver?.("public/assets/buildings/well.png", "/"), "/assets/buildings/well.png");
});

test("fresh game state contains the authored occupied village", () => {
  assert.equal(DEFAULT_GAME_STATE.population, 12);
  assert.equal(DEFAULT_GAME_STATE.houses.length, 4);
  assert.equal(DEFAULT_GAME_STATE.houses.every((house) => house.residents === 3), true);
  assert.equal(DEFAULT_GAME_STATE.buildings.filter((building) => building.kind === "house").length, 4);
  assert.equal(DEFAULT_GAME_STATE.buildings.filter((building) => building.kind === "well").length, 1);
});

test("the authored opening village keeps all twelve residents through the first five minutes", () => {
  let state = DEFAULT_GAME_STATE;
  let minimumPopulation = state.population;
  for (let tick = 0; tick < 6_000; tick += 1) {
    state = advanceTick(state);
    minimumPopulation = Math.min(minimumPopulation, state.population);
  }

  assert.equal(state.tick, 6_000);
  assert.equal(minimumPopulation, 12);
  assert.ok(state.population >= 12);
  assert.equal(state.houses.every((house) => house.residents >= 3), true);
});

test("production UI contains no known English user-facing literals outside the Korean locale", async () => {
  const forbidden = [
    "Feudal Lord Simulator",
    "Information rail",
    "Court console",
    "Opening guidance",
    "Simulation canvas",
    "Placement seals",
    "Road tool",
    "Royal terrain shield",
    "Royal Demesne",
    "Royal Ledger",
    "Court ledger",
    "Settlement status",
    "Onboarding tasks",
    "Population objective",
    "Economy overlays",
    "Overlays",
    "Road component",
    "Normal speed",
    "Fivefold speed",
    "Palisade age ceremony",
    "Stone Town ceremony",
  ] as const;

  for (const file of PRODUCTION_UI_FILES) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    for (const literal of forbidden) {
      assert.equal(source.includes(literal), false, `${file} contains ${literal}`);
    }
  }
});

test("desktop ledger lays primary and secondary facts across columns instead of clipping rows", async () => {
  const css = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
  const rule = css.match(/\.court-ledger dl\s*\{[\s\S]*?\}/)?.[0] ?? "";
  const ledger = css.match(/\.court-ledger\s*\{[\s\S]*?\}/)?.[0] ?? "";
  const populationToggle = css.match(/\.court-ledger > \.ledger-population-toggle\s*\{[\s\S]*?\}/)?.[0] ?? "";

  assert.match(rule, /grid-template-columns:\s*repeat\(4, auto minmax\(0, 1fr\)\);/);
  assert.match(rule, /font-size:\s*11px;/);
  assert.match(ledger, /height:\s*68px;/);
  assert.doesNotMatch(ledger, /overflow:\s*hidden;/);
  assert.match(populationToggle, /position:\s*absolute;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.court-ledger dl\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, auto minmax\(0, 1fr\)\);/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.court-ledger\s*\{[\s\S]*?height:\s*auto;/);
});

test("a valid onboarding region is one quiet field instead of a tile grid", () => {
  const calls: string[] = [];
  const context = {
    canvas: { clientWidth: 1280, clientHeight: 720 }, fillStyle: "", font: "",
    lineWidth: 0, lineJoin: "miter", lineCap: "butt",
    beginPath: () => calls.push("beginPath"), moveTo: () => undefined,
    lineTo: () => undefined, closePath: () => undefined,
    fill: () => calls.push("fill"), stroke: () => calls.push("stroke"),
    measureText: () => ({ width: 80 }), fillRect: () => calls.push("fillRect"),
    strokeRect: () => undefined, fillText: () => calls.push("fillText"),
    save: () => undefined, restore: () => undefined,
  } as unknown as CanvasRenderingContext2D;

  drawOnboardingGuidanceOverlay(context, {
    targets: [{
      kind: "logging_camp", label: "벌목소를 지을 수 있는 곳", origin: { tx: 2, ty: 2 },
      region: [{ tx: 1, ty: 1 }, { tx: 2, ty: 1 }, { tx: 2, ty: 2 }],
    }],
    zoom: 1,
  });

  assert.equal(calls.filter((call) => call === "fill").length, 1);
  assert.equal(calls.filter((call) => call === "stroke").length, 0);
  assert.equal(calls.filter((call) => call === "fillRect").length, 1);
  assert.equal(calls.filter((call) => call === "fillText").length, 1);
});
