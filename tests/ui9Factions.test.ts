/**
 * UI-9 (F4-A RG-4, RG-7, RG-8, RG-9): factions influence bars, tug-of-war strip, rights
 * transfer and revolt pressure — model-layer tests; no DOM rendering required.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { advanceFactions } from "../src/engine/factions";
import { initialPolitics } from "../src/engine/politics";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { factionRows } from "../src/ui/chronicle/factionTabModel";
import { tugOfWarView, revoltPressureSection } from "../src/ui/chronicle/factionInfluenceModel";
import { lordshipView } from "../src/ui/lordshipModel";
import { reorgLedgerView } from "../src/ui/hud/reorgLedgerModel";
import type { ReorganisationState } from "../src/engine/reorganisation.types";

const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;

// A pre-chapter-4 state with factions initialised (same pattern as factionPortraits.test.ts).
function preChapterFourState(): GameState {
  const raw = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v22/palisade-construction.save.json"))).envelope.state as GameState;
  // Advance tick to a year boundary so advanceFactions initialises the faction list (same pattern as factionPortraits.test.ts).
  const { factions: _f, reorganisation: _r, ...rest } = {
    ...raw, politics: initialPolitics(raw), tick: Math.ceil(raw.tick / YEAR) * YEAR,
  } as GameState & { reorganisation?: unknown };
  return advanceFactions(rest as GameState);
}

// A chapter-4 state: base pre-ch4 state with reorganisation grafted in.
function chapterFourState(overrides: Partial<ReorganisationState> = {}): GameState {
  const base = preChapterFourState();
  const reorg: ReorganisationState = {
    startTick: base.tick,
    answers: {},
    influence: { town: 60, merchant_house_1: 25, merchant_house_2: 15 },
    clothSeasons: [],
    clothSeason: 0,
    clothIncome: 0,
    clothSold: 0,
    pollTax: 0,
    collections: 0,
    wageLeavers: 0,
    weaverLeavers: 0,
    ...overrides,
  };
  return { ...base, reorganisation: reorg };
}

// ── Influence bars ──────────────────────────────────────────────────────────

test("UI-9 RG-4: influence is null for all faction rows before chapter 4", () => {
  const state = preChapterFourState();
  const rows = factionRows(state);
  assert.ok(rows.length > 0, "expected at least one faction row");
  for (const row of rows) {
    assert.equal(row.influence, null, `expected null influence for ${row.id} before ch4`);
  }
});

test("UI-9 RG-4: influence matches engine values for town and merchant factions in chapter 4", () => {
  const state = chapterFourState();
  const rows = factionRows(state);
  const town = rows.find(r => r.id === "town");
  const m1 = rows.find(r => r.id === "merchant_house_1");
  const m2 = rows.find(r => r.id === "merchant_house_2");
  assert.ok(town !== undefined, "expected a town row");
  assert.equal(town.influence, 60);
  assert.ok(m1 !== undefined);
  assert.equal(m1.influence, 25);
  assert.ok(m2 !== undefined);
  assert.equal(m2.influence, 15);
});

test("UI-9 RG-4: factions without influence values return null even in chapter 4", () => {
  const state = chapterFourState();
  const rows = factionRows(state);
  // Overlord and Crown are not in the influence record, so should be null.
  const noInfluence = rows.filter(r => !["town", "merchant_house_1", "merchant_house_2"].includes(r.id));
  for (const row of noInfluence) {
    assert.equal(row.influence, null, `expected null for ${row.id}`);
  }
});

// ── Tug-of-war ──────────────────────────────────────────────────────────────

test("UI-9 RG-4: tugOfWarView returns null before chapter 4", () => {
  const state = preChapterFourState();
  assert.equal(tugOfWarView(state), null);
});

test("UI-9 RG-4: tugOfWarView sums town and merchant influence correctly", () => {
  const state = chapterFourState();
  const tug = tugOfWarView(state);
  assert.ok(tug !== null);
  assert.equal(tug.townSum, 60);
  // merchant_house_1 (25) + merchant_house_2 (15)
  assert.equal(tug.merchantSum, 40);
});

test("UI-9 RG-4: warningActive is false without a warningTick", () => {
  // Default chapterFourState has no warningTick — exactOptionalPropertyTypes prevents passing undefined.
  const state = chapterFourState();
  const tug = tugOfWarView(state);
  assert.ok(tug !== null);
  assert.equal(tug.warningActive, false);
});

test("UI-9 RG-4: warningActive is true when warningTick is set", () => {
  const state = chapterFourState({ warningTick: 2000 });
  const tug = tugOfWarView(state);
  assert.ok(tug !== null);
  assert.equal(tug.warningActive, true);
});

// ── Rights transfer ──────────────────────────────────────────────────────────

test("UI-9 RG-7: rightsTransfer is empty when no rights held by town", () => {
  const state = chapterFourState();
  const view = lordshipView(state);
  assert.equal(view.rightsTransfer.length, 0);
});

test("UI-9 RG-7: rightsTransfer lists market_tolls and bridge_tolls granted to townsfolk", () => {
  const base = chapterFourState();
  const state: GameState = {
    ...base,
    politics: {
      ...(base.politics ?? initialPolitics(base)),
      // Engine sets holder = "townsfolk" when borough_charter is accepted (reorganisation.ts line 240).
      rights: [
        { id: "market_tolls", holder: "townsfolk", grantedTick: base.tick, petitionId: "borough_charter", stallFeePermille: 0 },
        { id: "bridge_tolls", holder: "townsfolk", grantedTick: base.tick, petitionId: "borough_charter", stallFeePermille: 1000 },
      ],
    },
  };
  const view = lordshipView(state);
  // The two rights and the fee farm (the town's duty for them, not a right, RG-9).
  assert.deepEqual(view.rightsTransfer.map(r => r.id), ["market_tolls", "bridge_tolls", "fee_farm"]);
  assert.match(view.rightsTransfer[0]!.line, /^시장 좌판세 → 도시 · \d+년 자치 특허$/);
  assert.match(view.rightsTransfer[1]!.line, /^통행세 절반 → 도시/);
  assert.match(view.rightsTransfer[2]!.line, /10s을 냅니다.*권리가 아니라/);
  // The lord's own rights read as passed; the charter's rights are not repeated among the granted ones.
  assert.ok(view.granted.every(line => !line.includes("townsfolk")), view.granted.join(" | "));
  const market = view.rights.find(right => right.id === "market");
  if (market !== undefined) assert.match(market.status, /도시로 넘김/);
});

test("UI-9 RG-7: a chapter 3 right the town holds (commuted rent) is no charter transfer", () => {
  const base = chapterFourState();
  const state: GameState = { ...base, politics: { ...(base.politics ?? initialPolitics(base)),
    rights: [{ id: "commuted_rent", holder: "townsfolk", grantedTick: base.tick, petitionId: "cash_rent", stallFeePermille: 1000 }] } };
  assert.deepEqual(lordshipView(state).rightsTransfer, []);
});

test("UI-9 RG-7: rights held by merchants do not appear in rightsTransfer", () => {
  const base = chapterFourState();
  const state: GameState = {
    ...base,
    politics: {
      ...(base.politics ?? initialPolitics(base)),
      rights: [
        { id: "market_tolls", holder: "merchants", grantedTick: base.tick, petitionId: "market_charter", stallFeePermille: 0 },
      ],
    },
  };
  const view = lordshipView(state);
  assert.equal(view.rightsTransfer.length, 0, "merchant-held right should not appear in townsfolk transfer list");
});

// ── Fee farm ledger ──────────────────────────────────────────────────────────

test("UI-9 RG-9: reorgLedgerView returns null before chapter 4", () => {
  const state = preChapterFourState();
  assert.equal(reorgLedgerView(state), null);
});

test("UI-9 RG-9: reorgLedgerView returns a row for fee_farm in chapter 4", () => {
  const state = chapterFourState();
  const view = reorgLedgerView(state);
  assert.ok(view !== null, "expected a reorg ledger view in chapter 4");
  const feeFarm = view.rows.find(r => r.category === "fee_farm");
  assert.ok(feeFarm !== undefined, "expected a fee_farm row in the reorg ledger");
  assert.ok(feeFarm.label.length > 0, "expected a non-empty label for fee_farm");
});

test("UI-9 RG-9: reorgLedgerView includes all five chapter 4 categories", () => {
  const state = chapterFourState();
  const view = reorgLedgerView(state);
  assert.ok(view !== null);
  const categories = view.rows.map(r => r.category);
  for (const cat of ["ulnage", "cloth_toll", "fulling_toll", "poll_tax", "fee_farm"] as const) {
    assert.ok(categories.includes(cat), `expected category ${cat} in reorg ledger`);
  }
});

// ── Revolt pressure ──────────────────────────────────────────────────────────

test("UI-9 RG-8: revoltPressureSection returns null before chapter 4", () => {
  const state = preChapterFourState();
  assert.equal(revoltPressureSection(state), null);
});

test("UI-9 RG-8: revoltPressureSection returns a section with total and threshold in chapter 4", () => {
  const state = chapterFourState();
  const section = revoltPressureSection(state);
  assert.ok(section !== null, "expected a revolt pressure section in chapter 4");
  assert.equal(typeof section.total, "number");
  assert.match(section.thresholdLine, /50/, "threshold line should mention 50");
});

test("UI-9 RG-8: pressure cause lines include the cause name and numeric value", () => {
  // direct_collection pressure comes from tax_collection being refused (reorganisation.ts: refused(answers[TAX_COLLECTION_PETITION_ID])).
  const state = chapterFourState({
    answers: { tax_collection: "refuse" },
  });
  const section = revoltPressureSection(state);
  assert.ok(section !== null);
  // At least one cause should be active (direct_collection from refusing tax_collection).
  assert.ok(section.causes.length > 0, "expected at least one pressure cause when tax_collection is refused");
  // Each cause line should have a + sign (e.g. "직접 징수 +40").
  for (const cause of section.causes) {
    assert.match(cause.line, /\+\d/, `cause line should contain "+N": ${cause.line}`);
  }
});

test("UI-9 RG-8: revoltPressure is also present on the rights tab LordshipView in chapter 4", () => {
  const state = chapterFourState();
  const view = lordshipView(state);
  assert.ok(view.revoltPressure !== null, "expected revoltPressure on LordshipView in ch4");
});

test("UI-9 RG-8: revoltPressure is null on LordshipView before chapter 4", () => {
  const state = preChapterFourState();
  const view = lordshipView(state);
  assert.equal(view.revoltPressure, null);
});
