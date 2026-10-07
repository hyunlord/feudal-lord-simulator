import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { GENTRY_NAMES_KO } from "../src/content/gentryNames";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { EMPTY_STEWARDSHIP } from "../src/engine/stewardship";
import type { RegionalMapEntry } from "../src/render/art/artContract";
import { ART_REGISTRY } from "../src/render/art/wave42Registry";
import catalog from "../src/render/art/catalog.json";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";
import { RegionPanel, regionGate } from "../src/ui/lord/region/RegionPanel";
import { FLAG_ART, FLAG_BASE, flagArtId, REGION_MAP_ID, REGION_PART_IDS, SITE_ART, siteSlots } from "../src/ui/lord/region/regionArt";
import { REGION_COPY } from "../src/ui/lord/region/regionCopy.ko";
import { assignSlots, MARKER_SCALE, markerLayout, regionChosen, regionEstates, regionFlag, type RegionFlag } from "../src/ui/lord/region/regionModel";
import { REGION_SURFACES } from "../src/ui/lord/region/surfaces";
import { readPng } from "../scripts/processBuildingSprite";

// LM-R2 (region area): the lord screen's single region map — the catalog bundle (slots measured on the records' assembly
// proof), the flags from the engine's possession and oversight, the arms only on a flag's empty base, the markers'
// registration, the screen itself. LMR2_STATES=<dir> (scripts/lmr2States.ts, DGX ~/fls-lmr2-states) adds the real
// delegated / direct / neighbour-suit states; without it those cases are built in-process from the lord's slice.

/** The lord's slice a few days in (the factions, and so the neighbour houses' names and arms, exist from the first tick). */
function slice(): GameState {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
  for (let tick = 0; tick < 60; tick += 1) state = advanceTick(state);
  return state;
}
const mapEntry = (): RegionalMapEntry => {
  const entry = ART_REGISTRY.entry(REGION_MAP_ID);
  assert.equal(entry?.kind, "regional-map");
  return entry as RegionalMapEntry;
};
const noop = () => undefined;
const states = process.env.LMR2_STATES;
const lord2 = (name: string): GameState | null => states === undefined || !existsSync(join(states, `${name}.json`)) ? null
  : JSON.parse(readFileSync(join(states, `${name}.json`), "utf8")) as GameState;
/** The lord's slice with the third neighbour inherited (title and possession the lord's) under `mode`: the inherited state's shape. */
function inheritedAs(mode: "direct" | "steward"): GameState {
  const state = slice();
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id === "estate-neighbour-3" ? { ...estate, titleHolder: LORD, possessor: LORD } : estate) },
    stewardship: { ...EMPTY_STEWARDSHIP, oversight: [{ estateId: "estate-neighbour-3", mode, stewardId: "est-000002", auditMode: "visit", tenants: 0, merchants: 0, undetected: 0, since: 0 }] } };
}

test("the bundle: the map, three sites, three flags and the menu's eight icons; the abbey held; the map's slots from the proof", () => {
  const bundle = (catalog as { bundleId: string; entries: { id: string; kind: string; image: { url: string } }[] }[]).find(item => item.bundleId === "lord-region");
  assert.ok(bundle !== undefined);
  const nav = ["character", "council", "dynasty", "estates", "marriage", "military", "petitions", "region"].map(id => `lord.nav.${id}`);
  assert.deepEqual(bundle.entries.map(entry => entry.id).sort(), [REGION_MAP_ID, ...REGION_PART_IDS, ...nav].sort());
  assert.equal(bundle.entries.some(entry => entry.image.url.includes("map_abbey")), false, "map_abbey has no estate to stand for");
  for (const entry of bundle.entries) assert.ok(existsSync(join("public", entry.image.url)), entry.image.url);
  const map = mapEntry();
  assert.deepEqual(map.coordinateSpace, { width: 1600, height: 1000 });
  assert.deepEqual(siteSlots(map).map(slot => slot.id), ["manor", "market", "mill", "abbey"]);
  // The proof stood every flag at one offset from its site (scripts/installLmr2Region.py measured each one apart).
  for (const slot of siteSlots(map)) assert.deepEqual(slot.flag === null ? null : [slot.flag.x - slot.site.x, slot.flag.y - slot.site.y], [28, -15], slot.id);
  for (const id of REGION_PART_IDS) assert.equal(ART_REGISTRY.entry(id)?.kind, "ui-image", id);
});

test("the flags' empty bases are where the pictures leave them (measured again on the runtime PNGs)", () => {
  for (const flag of ["direct", "delegated", "neighbour"] as const) {
    const entry = ART_REGISTRY.entry(flagArtId(flag))!;
    const { dimensions: { width, height }, rgba } = readPng(join("public", entry.image.url));
    assert.deepEqual([width, height], [FLAG_ART.width, FLAG_ART.height]);
    const light = (x: number, y: number) => { const at = (y * width + x) * 4; return rgba[at + 3]! > 200 && (rgba[at]! * 299 + rgba[at + 1]! * 587 + rgba[at + 2]! * 114) / 1000 > 190; };
    const seen = new Set<number>(); let best: number[] = [];
    for (let start = 0; start < width * height; start += 1) {
      if (seen.has(start) || !light(start % width, Math.floor(start / width))) continue;
      const patch: number[] = []; const stack = [start]; seen.add(start);
      while (stack.length > 0) {
        const at = stack.pop()!; patch.push(at);
        const x = at % width; const y = Math.floor(at / width);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
          const next = ny * width + nx;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && !seen.has(next) && light(nx, ny)) { seen.add(next); stack.push(next); }
        }
      }
      if (patch.length > best.length) best = patch;
    }
    const xs = best.map(at => at % width); const ys = best.map(at => Math.floor(at / width));
    assert.deepEqual(FLAG_BASE[flag], { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1 }, flag);
  }
});

test("the opening: the home market town direct with the lord's arms, three neighbours each on its own place, the old lord's base empty", () => {
  const state = slice();
  assert.equal(regionGate(state), null, "the map opens in lord mode");
  const views = regionEstates(state, mapEntry());
  assert.deepEqual(views.map(view => [view.estateId, view.site, view.flag, view.slot?.id]), [
    [HOME_ESTATE_ID, "market", "direct", "market"],
    ["estate-neighbour-1", "manor", "neighbour", "manor"],
    ["estate-neighbour-2", "mill", "neighbour", "mill"],
    ["estate-neighbour-3", "manor", "neighbour", "abbey"],
  ]);
  const factions = state.factions!.factions;
  assert.equal(views[0]!.arms?.emblem.kind, "arms");
  const ko = (id: string) => { const name = factions.find(faction => faction.id === id)!.name; return GENTRY_NAMES_KO[name] ?? name; };
  assert.equal(views[1]!.arms?.house, ko("neighbour_1"));
  assert.equal(views[2]!.arms?.house, ko("neighbour_2"));
  assert.equal(views[1]!.name, REGION_COPY.estateName(ko("neighbour_1")), "the estate by its house's Korean name");
  assert.ok(views.every(view => !/[A-Za-z]/.test(view.name)), JSON.stringify(views.map(view => view.name)));
  assert.equal(views[3]!.arms, null, "the old lord's house has no arms in the engine");
  assert.ok(views.every(view => view.label.length > 0 && view.label.includes(REGION_COPY.flags[view.flag])));
  assert.deepEqual(regionEstates(state, null).map(view => view.slot), [null, null, null, null], "no map entry: the estates are listed, not placed");
});

test("the third neighbour inherited: delegated to a steward, direct when the lord takes it himself (oversightViews)", () => {
  for (const [mode, flag] of [["steward", "delegated"], ["direct", "direct"]] as const) {
    const state = inheritedAs(mode);
    const estate = estatesOf(state).estates.find(entry => entry.id === "estate-neighbour-3")!;
    assert.equal(regionFlag(state, estate), flag);
    const view = regionEstates(state, mapEntry()).find(entry => entry.estateId === "estate-neighbour-3")!;
    assert.equal(view.arms?.emblem.kind, "arms", "the lord's arms on what he possesses");
    const chosen = regionChosen(state, "estate-neighbour-3")!;
    assert.ok(chosen.rows.some(row => row.key === "flag" && row.value.startsWith(REGION_COPY.flags[flag])));
  }
});

test("lord2 states (LMR2_STATES): inherited is delegated, attention-overloaded direct, neighbour-suit keeps a neighbour's flag over the lord's won pieces", { skip: states === undefined ? "LMR2_STATES not set (scripts/lmr2States.ts on the DGX: ~/fls-lmr2-states)" : false }, () => {
  const expect: Record<string, RegionFlag> = { inherited: "delegated", "attention-overloaded": "direct", "neighbour-suit": "delegated", "offer-countered": "neighbour" };
  for (const [name, flag] of Object.entries(expect)) {
    const state = lord2(name);
    if (state === null) { assert.fail(`${name}.json missing in ${states}`); }
    const views = regionEstates(state, mapEntry());
    assert.equal(views.find(view => view.estateId === "estate-neighbour-3")!.flag, flag, name);
    assert.equal(views.find(view => view.home)!.flag, "direct", name);
    assert.ok(views.every(view => view.slot !== null), name);
  }
  // Per-render cost (lead note 2026-10-06): one view call on a real state, measured (the panel memoises it per state).
  for (const name of ["inherited", "neighbour-suit"]) {
    const state = lord2(name)!;
    const time = (run: () => unknown) => { run(); const start = performance.now(); for (let i = 0; i < 20; i += 1) run(); return (performance.now() - start) / 20; };
    console.log(`${name}: regionEstates ${time(() => regionEstates(state, mapEntry())).toFixed(3)} ms, regionChosen ${time(() => regionChosen(state, "estate-neighbour-1")).toFixed(3)} ms`);
  }
  const inherited = lord2("inherited")!;
  assert.ok(regionChosen(inherited, "estate-neighbour-3")!.rows.some(row => row.key === "steward"), "the delegated estate names its steward");
  const suit = lord2("neighbour-suit")!;
  const neighbour = regionChosen(suit, "estate-neighbour-1")!;
  assert.equal(regionFlag(suit, estatesOf(suit).estates.find(estate => estate.id === "estate-neighbour-1")!), "neighbour");
  assert.ok(neighbour.rows.some(row => row.key === "lordPieces" && row.value.includes(REGION_COPY.pieces.fishery)), JSON.stringify(neighbour.rows));
});

test("a marker: the site on its foot at the slot, the flag on its pole's foot at the records' offset, the arms inside the flag's base", () => {
  const slot = siteSlots(mapEntry()).find(entry => entry.id === "manor")!;
  for (const scale of [MARKER_SCALE.fit, MARKER_SCALE.full]) {
    const layout = markerLayout(slot, scale, "direct", true, true);
    assert.equal(layout.anchorX * 2, layout.width, "the slot point at the box's centre");
    assert.ok(layout.width >= 44 && layout.height >= 44, "a touch target");
    assert.equal(layout.site!.left + SITE_ART.pivot.x * scale, layout.anchorX);
    assert.equal(layout.site!.top + SITE_ART.pivot.y * scale, layout.anchorY);
    assert.equal(layout.site!.width, 96 * scale);
    const foot = { x: layout.flag!.left + FLAG_ART.pivot.x * scale, y: layout.flag!.top + FLAG_ART.pivot.y * scale };
    assert.ok(Math.abs(foot.x - (layout.anchorX + 28 * scale)) <= 0.5 && Math.abs(foot.y - (layout.anchorY - 15 * scale)) <= 0.5, JSON.stringify(foot));
    const base = FLAG_BASE.direct;
    const arms = layout.arms!;
    assert.ok(arms.left >= layout.flag!.left + base.x * scale - 0.5 && arms.left + arms.width <= layout.flag!.left + (base.x + base.width) * scale + 0.5);
    assert.ok(arms.top >= layout.flag!.top + base.y * scale - 0.5 && arms.top + arms.height <= layout.flag!.top + (base.y + base.height) * scale + 0.5);
    for (const box of [layout.site!, layout.flag!]) assert.ok(box.left >= 0 && box.top >= 0 && box.left + box.width <= layout.width && box.top + box.height <= layout.height);
  }
  assert.equal(markerLayout(slot, 0.5, "neighbour", true, false).arms, null, "no arms: the base stays empty");
  assert.equal(markerLayout(slot, 0.5, null, true, true).arms, null, "no flag picture: no base, no arms");
});

test("slots: an estate takes its own site's place, the rest the next free place in the records' order", () => {
  const slots = siteSlots(mapEntry());
  const taken = assignSlots([{ id: "a", kind: "manor" }, { id: "b", kind: "manor" }, { id: "c", kind: "fishery" }, { id: "d", kind: "market_town" }, { id: "e", kind: "manor" }], slots);
  assert.deepEqual(["a", "b", "c", "d", "e"].map(id => taken.get(id)?.id ?? null), ["manor", "mill", "abbey", "market", null]);
});

test("the screen: the map, its own zoom, the estates as kit buttons with their labels, the flag key; no title attribute", () => {
  const state = inheritedAs("steward");
  const html = renderToStaticMarkup(createElement(RegionPanel, { state, dispatch: noop, focus: "estate-neighbour-3", onOpen: noop, onPerson: undefined }));
  for (const step of ["fit", "half", "full"]) assert.match(html, new RegExp(`data-region-zoom-step="${step}"`));
  for (const id of estatesOf(state).estates.map(estate => estate.id)) assert.match(html, new RegExp(`class="lord-region-site ui-btn ui-btn--surface"[^>]*data-region-estate="${id}"`));
  assert.match(html, /data-region-estate="estate-neighbour-3" data-region-flag="delegated"/);
  assert.match(html, /data-region-chosen="estate-neighbour-3"/, "opened on an estate: that estate is chosen");
  assert.match(html, /data-region-open="estate-neighbour-3"/);
  assert.match(html, /data-region-map="plain"/, "no Image in node: the plain map, the estates still on it");
  assert.equal(html.includes("lord-region-arms"), false, "no flag picture loaded: no base, so no arms");
  assert.doesNotMatch(html, /\stitle="/);
  assert.equal((html.match(/ui-btn--primary/g) ?? []).length, 0, "equal choices: no primary");
});

test("the rows reach the screen through its menu item on lord2 states", () => {
  assert.ok(REGION_SURFACES.length > 0);
  for (const row of REGION_SURFACES) {
    assert.equal(row.scene.kind, "state");
    assert.ok(row.open.some(step => "click" in step && step.click === "[data-lord-nav='region']"), row.id);
  }
});
