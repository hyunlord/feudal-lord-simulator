import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ART_REGISTRY } from "../src/render/art/wave42Registry";
import { drawHudCanvasIcon, drawServiceEdge, drawTilePattern, HUD_PATTERN_ART, HUD_REASON_ART } from "../src/render/hudCanvasArt";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { alertStackRows } from "../src/ui/alertStackModel";
import { CRISIS_ART, HUD_ART, HudArt, ZONE_SIZE_ART } from "../src/ui/hud/hudArt";
import { UiIcon } from "../src/ui/UiIcon";
import { placementChipModel } from "../src/ui/placementChip";
import { loadSaveFile } from "../scripts/loadSaveFile";

// INSTALL-18: the Wave 18 HUD pictures — each id the HUD asks for is a ui-image entry of the hud-wave18 bundle at the
// width it is drawn at; the rows carry their crisis kind; with no picture the current look stays.

const entry = (id: string) => {
  const found = ART_REGISTRY.entry(id);
  assert.ok(found !== null && found.kind === "ui-image", `${id} is a ui-image entry`);
  return found;
};

test("every HUD picture id is a ui-image at the CSS width the HUD draws it", () => {
  const widths: [string, number][] = [
    [HUD_ART.population, 24], [HUD_ART.food, 24], [HUD_ART.money, 24], [HUD_ART.build, 32], [HUD_ART.ledger, 32],
    [HUD_ART.lock, 24], [HUD_ART.confirm, 32], [HUD_ART.cancel, 32], [HUD_ART.barred, 14],
    ...[HUD_ART.brush, HUD_ART.polygon, HUD_ART.erase, HUD_ART.undo, HUD_ART.redo].map(id => [id, 24] as [string, number]),
    ...Object.values(ZONE_SIZE_ART).map(([id, width]) => [id, width] as [string, number]),
    ...Object.values(CRISIS_ART).map(id => [id, 36] as [string, number]),
    ...Object.values(HUD_REASON_ART).flatMap(id => [[id!, 20], [id!, 24]] as [string, number][]),
    ...Object.values(HUD_PATTERN_ART).map(id => [id, 64] as [string, number]),
    ["hud.patterns.pattern_service_range_edge", 128], ["hud.misc.pulse_ring", 288],
  ];
  for (const [id, width] of widths) {
    const art = entry(id);
    assert.ok(art.kind === "ui-image" && art.cssWidths.includes(width), `${id} declares ${width}`);
    assert.ok(art.image.url.startsWith("assets/wave18/"), id);
  }
  const patterns = Object.values(HUD_PATTERN_ART).map(entry);
  assert.ok(patterns.every(art => art.image.width === 64 && art.image.height === 32), "patterns are the 64 × 32 tile diamond");
  const ring = entry("hud.misc.pulse_ring");
  assert.deepEqual([ring.image.width, ring.image.height], [288, 96], "three 96 px frames");
});

test("the installed pictures carry installed_by INSTALL-18 once captured in play (CRLF rows); the materials mark waits", () => {
  const ledger = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8");
  const bundle = ART_REGISTRY.entries().filter(art => art.id.startsWith("hud."));
  assert.equal(bundle.length, 33);
  for (const art of bundle) {
    const line = ledger.split("\r\n").find(row => row.startsWith(`wave18,${art.provenance.inboxFile.replace("assets-inbox/", "")},`));
    assert.ok(line !== undefined, art.id);
    assert.equal(line.endsWith(",INSTALL-18"), art.id !== "hud.reasons.reason_material_shortage", art.id);
  }
});

test("the skipped pictures are not in the catalog and their ledger rows say why", () => {
  const ledger = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8");
  for (const name of ["main/dock_steward", "misc/hud_hide", "reasons/reason_tree", "reasons/reason_slope_rock",
    "reused/pill_season_spring", "reused/pill_season_summer", "reused/pill_season_autumn", "reused/pill_season_winter"]) {
    const line = ledger.split("\r\n").find(row => row.includes(`wave18/candidates-v1/assets/${name}.png`));
    assert.ok(line !== undefined && line.includes("INSTALL-18 설치 안 함") && !line.endsWith(",INSTALL-18"), name);
    assert.equal(ART_REGISTRY.entry(`hud.${name.replace("/", ".")}`), null, name);
  }
});

test("alert rows carry their crisis kind: fire, leaving and a waiting site; unpaid upkeep, an overflowing store, bread", () => {
  const fixtures = `fixtures/saves/v${SAVE_SCHEMA_VERSION}`;
  const town = loadSaveFile(`${fixtures}/zone-undo.save.json`);
  const [burning, leaving] = town.houses;
  assert.ok(burning !== undefined && leaving !== undefined);
  const a = alertStackRows({ ...town, tick: 40,
    events: { ...(town.events ?? { records: [], burning: [] }), burning: [{ buildingId: burning.buildingId, eventId: "test", ignitedTick: 30, outTick: 400, doused: false }] },
    houses: town.houses.map(house => house.buildingId === leaving.buildingId ? { ...house, leavingSinceTick: 30 } : house) });
  assert.deepEqual(a.map(row => row.crisis).sort(), ["construction_blocked", "fire", "household_leaving"]);
  const big = loadSaveFile(`${fixtures}/population-176.save.json`);
  const facility = big.buildings.find(building => building.kind === "logging_camp")!;
  const store = big.buildings.find(building => building.kind === "storehouse")!;
  const b = alertStackRows({ ...big, buildings: big.buildings.map(building => building.id === facility.id ? { ...building, upkeepUnpaid: true as const }
    : building.id === store.id ? { ...building, inventory: { ...building.inventory, timber: 999 } } : building) });
  assert.deepEqual(b.map(row => row.crisis).sort(), ["food_shortage", "storage_full", "upkeep_unpaid"]);
  // A row of a kind Wave 18 did not draw keeps the bell (null).
  assert.ok(alertStackRows(big).some(row => row.crisis === null));
});

test("the chip names the reason behind its line; a road's engine label has none", () => {
  const state = loadSaveFile(`fixtures/saves/v${SAVE_SCHEMA_VERSION}/new-game.save.json`);
  const chip = placementChipModel(state, { tool: "house", reachHouses: null,
    marks: [{ tx: 1, ty: 1, ok: false, reason: "water", icon: true, ring: false }] });
  assert.equal(chip.reasonKind, "water");
  assert.equal(placementChipModel(state, { tool: "road", reachHouses: null, failureLabel: "x" }).reasonKind, null);
});

test("without a loaded picture the HUD keeps its current icon and the canvas its own drawing", () => {
  const fallback = createElement(UiIcon, { sheet: "resource", cell: "coin" });
  const markup = renderToStaticMarkup(createElement(HudArt, { id: HUD_ART.money, width: 24, className: "ui-icon", fallback }));
  assert.match(markup, /data-icon="resource.coin"/);
  assert.doesNotMatch(markup, /data-art=/);
  const context = {} as Parameters<typeof drawTilePattern>[0];
  assert.equal(drawTilePattern(context, HUD_PATTERN_ART.ok, 0, 0), false);
  assert.equal(drawHudCanvasIcon(context, HUD_REASON_ART.water!, 0, 0, 20), false);
  assert.equal(drawServiceEdge(context, 0, 0, 100, 50, 1), false);
});

test("the pulse ring replaces the box-shadow only once loaded, and holds still under reduced motion", () => {
  const css = readFileSync("src/styles/tutorial.css", "utf8");
  assert.match(css, /\[data-pulse\] \{ animation: tutorial-pulse 700ms ease-in-out 2; \}/, "the box-shadow pulse stays the default");
  assert.match(css, /:root\[data-hud-pulse-ring\][^{]*\[data-pulse\]::after \{[^}]*steps\(3\) 2;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*:root\[data-hud-pulse-ring\][^{]*::after \{ animation: hud-pulse-ring-still/);
});
