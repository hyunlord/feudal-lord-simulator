/**
 * CLOTH-UI: the cloth chain's HUD and ledger split (CL10, C5).
 *
 * 1. Chain split: the season card's ale row (drink) never includes cloth goods; the cloth row (cloth) lists
 *    the seven in catalog order and only when they are held.
 * 2. townClothView lines (sheep, spinning houses, buildings, closed-season money).
 * 3. Ledger category labels for ulnage and fulling_toll.
 * 4. Chip icons: ResourceGlyph draws the chain sheet for each cloth good once chainCell is assigned.
 * 5. Building menu check: the five cloth buildings have Korean names in buildingCatalog.ko.ts.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { RESOURCE_CATALOG, RESOURCE_CHAIN_SHEET_CELLS, resourceEntry } from "../src/content/resourceCatalog";
import type { GameState } from "../src/engine/engine.types";
import { EMPTY_HISTORY } from "../src/engine/history";
import type { SeasonLedger } from "../src/engine/season.types";
import { LEDGER_CATEGORY_LABELS } from "../src/ledger/ledgerCopy.ko";
import { ResourceGlyph } from "../src/ui/ResourceArtwork";
import { seasonLedgerCardModel } from "../src/ui/seasonLedgerCard";
import { TOWN_CLOTH_COPY } from "../src/ui/townClothCopy.ko";
import { townClothView } from "../src/ui/townClothModel";
import { clothTown, paintPasture } from "./helpers/clothTown";

// --- helpers --------------------------------------------------------------------------------------------------------

const CLOTH_GOODS = ["fleece", "yarn", "raw_cloth", "fulled_cloth", "dyes", "dyed_cloth", "finished_cloth"] as const;
const ALE_GOODS = ["barley", "malt", "ale"] as const;

const ledger = (startTick: number, over: Partial<SeasonLedger> = {}): SeasonLedger => ({
  season: 1, year: 1368, startTick, endTick: startTick + 1_000, income: 60, expense: 20,
  stockDelta: { bread: 0, wheat: 0, timber: 0, stone: 0 }, popDelta: 0,
  notableEvents: [], nextObjectiveHint: null, ...over,
});

/** A minimal bare-ledger state (no world): isWorld() returns false, so cloth/drink come back empty. */
const bareState = (ledgers: readonly SeasonLedger[]): GameState =>
  ({ scenarioId: "core:campaign_market_town", history: { ...EMPTY_HISTORY, records: [] }, seasons: { history: ledgers }, buildings: [] }) as never;

// --- 1. chain split -------------------------------------------------------------------------------------------------

test("CL10: every cloth good has a chainCell whose value matches its resource id", () => {
  for (const id of CLOTH_GOODS) {
    const entry = resourceEntry(id);
    assert.ok(entry.chainCell !== undefined, `${id} must have chainCell assigned`);
    assert.equal(entry.chainCell, id, `${id}: chainCell must equal its resource id`);
  }
});

test("CL10: no cloth good's chainCell matches an ale good's chainCell", () => {
  const aleChainCells = new Set(ALE_GOODS.map(id => resourceEntry(id).chainCell));
  for (const id of CLOTH_GOODS) {
    assert.ok(!aleChainCells.has(resourceEntry(id).chainCell),
      `${id}: chainCell must not be shared with ale chain`);
  }
});

test("CL10: the season card drink field (ale row) is empty when no world state is provided", () => {
  const model = seasonLedgerCardModel(bareState([ledger(0), ledger(1_000)]));
  assert.ok(model !== null);
  // Bare state: isWorld() is false → drink and cloth are both empty
  assert.deepEqual(model.drink, []);
  assert.equal(model.drinkLine, null);
  // cloth row is also empty in a bare state
  assert.deepEqual(model.cloth, []);
  assert.equal(model.clothLine, null);
  assert.deepEqual(model.clothLines, []);
});

test("CL10: drink field never contains cloth goods — ALE_CHAIN is explicitly {barley, malt, ale}", () => {
  // Verify no cloth good is in the ale chain by checking resource ids
  const clothSet = new Set<string>(CLOTH_GOODS);
  const aleSet = new Set<string>(ALE_GOODS);
  for (const id of CLOTH_GOODS) assert.ok(!aleSet.has(id), `${id} must not be an ale good`);
  for (const id of ALE_GOODS) assert.ok(!clothSet.has(id), `${id} must not be a cloth good`);
});

test("CL10: cloth goods appear in catalog order (hudPriority 10–16, matching the CLOTH_CHAIN order)", () => {
  const clothInCatalogOrder = RESOURCE_CATALOG
    .filter(entry => (CLOTH_GOODS as readonly string[]).includes(entry.id))
    .map(entry => entry.id);
  assert.deepEqual(clothInCatalogOrder, [...CLOTH_GOODS],
    "cloth goods must appear in catalog order, matching CLOTH_CHAIN");
});

// --- 2. townClothView ------------------------------------------------------------------------------------------------

test("townClothView returns null for a town with no pasture zones and no cloth goods in inventory", () => {
  const base = clothTown();
  const noZones: GameState = { ...base, zones: [] };
  const view = townClothView(noZones);
  // All buildings' inventories start empty, no pasture → sheep = 0, goods = all 0 → null
  assert.equal(view, null, "townClothView must be null when no sheep and no goods held");
});

test("townClothView sheep line mentions sheep count and pasture cells once a pasture is painted", () => {
  const base = clothTown();
  const withPasture = paintPasture(base, { tx: 5, ty: 5 });
  const view = townClothView(withPasture);
  assert.ok(view !== null, "townClothView must not be null after painting a pasture");
  assert.ok(view.sheep.includes("양"), `sheep line must include 양 (got: ${view.sheep})`);
  assert.ok(view.sheep.includes("목초지"), `sheep line must include 목초지 (got: ${view.sheep})`);
});

test("townClothView.closedSeason is null when no cloth ledger income exists", () => {
  const base = clothTown();
  const withPasture = paintPasture(base, { tx: 5, ty: 5 });
  const view = townClothView(withPasture);
  assert.ok(view !== null);
  // A fresh chapter-four-town has no fulling_toll or ulnage entries
  assert.equal(view.closedSeason, null,
    "closedSeason must be null when there is no cloth income in the ledger");
});

test("TOWN_CLOTH_COPY.closedSeason formats ulnage and fulling_toll amounts correctly", () => {
  const line = TOWN_CLOTH_COPY.closedSeason(4, 3);
  assert.ok(line.includes("직물 인장세"), `must mention ulnage label (got: ${line})`);
  assert.ok(line.includes("+4d"), `must include ulnage amount (got: ${line})`);
  assert.ok(line.includes("축융 사용료"), `must mention fulling_toll label (got: ${line})`);
  assert.ok(line.includes("+3d"), `must include fulling_toll amount (got: ${line})`);
});

test("TOWN_CLOTH_COPY.buildingCount and buildingsLine format correctly", () => {
  assert.equal(TOWN_CLOTH_COPY.buildingCount("직조공 집", 2), "직조공 집 2동");
  assert.equal(TOWN_CLOTH_COPY.buildingCount("축융 방앗간", 1), "축융 방앗간 1동");
  assert.equal(TOWN_CLOTH_COPY.buildingsLine(["목축 농장 1동", "직조공 집 2동"]), "목축 농장 1동 · 직조공 집 2동");
  assert.equal(TOWN_CLOTH_COPY.buildingsLine([]), "");
});

// --- 3. ledger category labels --------------------------------------------------------------------------------------

test("LEDGER_CATEGORY_LABELS has correct labels for ulnage and fulling_toll", () => {
  assert.equal(LEDGER_CATEGORY_LABELS.ulnage, "직물 인장세",
    "ulnage label must be '직물 인장세'");
  assert.ok(LEDGER_CATEGORY_LABELS.fulling_toll.includes("축융"),
    `fulling_toll label must mention '축융' (got: ${LEDGER_CATEGORY_LABELS.fulling_toll})`);
});

// --- 4. chip icons (ResourceGlyph) ----------------------------------------------------------------------------------

test("ResourceGlyph renders chain-sheet icons for all seven cloth goods", () => {
  for (const id of CLOTH_GOODS) {
    const markup = renderToStaticMarkup(createElement(ResourceGlyph, { resource: id }));
    assert.match(markup, new RegExp(`data-icon="chain\\.${id}"`),
      `${id}: ResourceGlyph must render chain icon`);
    assert.match(markup, /icon_resource_chain_sheet\.png/,
      `${id}: ResourceGlyph must use the chain sheet`);
  }
});

test("the cloth goods' chain-sheet positions are 3–9 (after the ale chain's 0–2)", () => {
  const expectedPositions: Readonly<Record<string, number>> = {
    fleece: 3, yarn: 4, raw_cloth: 5, fulled_cloth: 6, dyed_cloth: 7, finished_cloth: 8, dyes: 9,
  };
  for (const [id, pos] of Object.entries(expectedPositions)) {
    assert.equal(RESOURCE_CHAIN_SHEET_CELLS.indexOf(id as typeof RESOURCE_CHAIN_SHEET_CELLS[number]), pos,
      `${id} must be at sheet position ${pos}`);
  }
});

// --- 5. building menu names -----------------------------------------------------------------------------------------

test("the five cloth buildings have Korean names in buildingCatalog.ko.ts", () => {
  const expected: Readonly<Record<string, string>> = {
    pastoral_farm: "목축 농장",
    weaver_house: "직조공 집",
    fulling_mill: "축융 방앗간",
    dyehouse: "염색집",
    tenter_yard: "텐터 틀",
  };
  for (const [kind, name] of Object.entries(expected)) {
    const config = BUILDING_CONFIG_BY_KIND[kind as keyof typeof BUILDING_CONFIG_BY_KIND];
    assert.equal(config.name, name, `${kind} must have Korean name "${name}"`);
  }
});
