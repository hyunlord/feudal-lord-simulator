import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { ReactElement, ReactNode } from "react";

import { MONEY_LABEL } from "../src/content/moneyCopy.ko";
import type { GameState } from "../src/engine/engine.types";
import {
  accountBalance,
  EMPTY_LEDGER,
  LEDGER_PERIOD_TICKS,
  LEDGER_RETAINED_PERIODS,
  LEDGER_ROLLUP_PERIODS,
  LedgerSourceError,
  postLedgerEntries,
  treasuryBalance,
} from "../src/ledger/ledger";
import { LEDGER_ACCOUNTS, LEDGER_CATEGORIES, type LedgerEntry, type LedgerPosting } from "../src/ledger/ledger.types";
import { ledgerView } from "../src/ledger/ledgerView";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { highlightedHouseTiles } from "../src/ui/diagnosticOverlayModel";
import { LedgerPanelView } from "../src/ui/LedgerPanel";
import { ledgerPanelModel } from "../src/ui/ledgerPanelModel";
import { ledgerBalanceTrace } from "../scripts/ledgerBalanceTrace";

const BASELINE = JSON.parse(readFileSync("fixtures/ledger/world-baseline-8911323.json", "utf8")) as {
  readonly cases: Record<string, { readonly kind: string; readonly ticks: number; readonly stateFile: string | null;
    readonly finalWorldHashWithoutMoney: string }>;
};

const sale = (amount: number, market = "market-1"): LedgerPosting =>
  ({ account: "cash", category: "market_sale", amount, sourceRefs: [{ type: "building", id: market, detail: "sold:bread" }] });

type Ledgered = Pick<GameState, "ledger" | "treasuryCoin" | "tick" | "scenarioId">;

function post(state: Ledgered, tick: number, postings: readonly LedgerPosting[]): Ledgered {
  const next = postLedgerEntries({ ...state, tick }, postings);
  return { ...state, tick, ledger: next.ledger, treasuryCoin: next.treasuryCoin };
}

test("L-1 money is shown as 돈 and no player-facing 금화 remains outside the render session's files", () => {
  assert.equal(MONEY_LABEL, "돈");
  const offenders: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (path === join("src", "render") || path === join("src", "world", "boundary")) continue;
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && readFileSync(path, "utf8").includes("금화")) offenders.push(path);
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});

for (const [name, expected] of Object.entries(BASELINE.cases)) {
  // B3 gate 1 compared the treasury with the pre-ledger code. C2 changes the money rules on purpose (spec M-*),
  // so the trace now checks that the cached treasury equals the ledger's cash balance on every tick and that the
  // world without money fields is still the pre-C2 world (no upkeep went unpaid in these cases).
  test(`L-10 ${name}: the cache matches the ledger on every tick and the money-free world is the pinned F0-A world`, async () => {
    const result = await ledgerBalanceTrace(".", expected.kind, expected.ticks, expected.stateFile ?? undefined);
    assert.equal(result.cacheMismatches, 0);
    assert.equal(result.finalWorldHashWithoutMoney, expected.finalWorldHashWithoutMoney);
  });
}

test("L-3 before the first posting the treasury is the opening balance; the first posting records it", () => {
  const state: Ledgered = { tick: 40, treasuryCoin: 120, scenarioId: "core:campaign_market_town" };
  assert.equal(treasuryBalance(state), 120);
  const next = post(state, 80, [sale(5)]);
  assert.equal(next.treasuryCoin, 125);
  assert.equal(treasuryBalance(next), 125);
  assert.deepEqual(next.ledger!.entries.map(entry => [entry.id, entry.category, entry.amount, entry.sourceRefs[0].type]),
    [["ledger-000001", "opening_balance", 120, "scenario"], ["ledger-000002", "market_sale", 5, "building"]]);
  assert.equal(DEFAULT_GAME_STATE.ledger, undefined);
  assert.deepEqual(LEDGER_CATEGORIES, ["opening_balance", "market_sale", "construction", "upkeep",
    "toll", "stall_fee", "rent", "mill_toll", "demesne_sale", "project"]);
});

test("L-4 roll-ups keep every account total while only the last 6 periods stay as entries", () => {
  let state: Ledgered = { tick: 0, treasuryCoin: 0 };
  let expected = 0;
  const periods = LEDGER_ROLLUP_PERIODS + 15;
  for (let period = 0; period < periods; period += 1) {
    for (const offset of [80, 1_200, 2_320]) {
      const amount = 2 + ((period + offset) % 7);
      state = post(state, period * LEDGER_PERIOD_TICKS + offset, [sale(amount, `market-${period % 3}`)]);
      expected += amount;
      assert.equal(accountBalance(state.ledger!, "cash"), expected);
      // The memoised balance equals a fresh sum over a copy (no cache entry for the copy).
      assert.equal(accountBalance(structuredClone(state.ledger!), "cash"), expected);
      assert.equal(state.treasuryCoin, expected);
    }
  }
  const ledger = state.ledger!;
  const keepFrom = (periods - LEDGER_RETAINED_PERIODS) * LEDGER_PERIOD_TICKS;
  assert.ok(ledger.entries.every(entry => entry.tick >= keepFrom));
  assert.equal(ledger.entries.length, LEDGER_RETAINED_PERIODS * 3);
  // Per-period roll-ups for periods [now − 120, now − 6] (115 of them), plus one archive roll-up for everything older.
  assert.equal(ledger.rollups.length, (LEDGER_ROLLUP_PERIODS - LEDGER_RETAINED_PERIODS + 1) + 1);
  const archive = ledger.rollups[0]!;
  assert.equal(archive.periodStart, 0);
  assert.ok(archive.periodEnd - archive.periodStart > LEDGER_PERIOD_TICKS);
  const all = ledgerView({ ...state, tick: state.tick }, "cash", "all");
  assert.equal(all.total, expected);
  assert.equal(all.includesRollups, true);
});

test("L-5 an entry without a source is refused by the type and at run time", () => {
  // @ts-expect-error an empty source list is not a LedgerSources tuple
  const empty: LedgerEntry = { id: "ledger-000001", tick: 0, account: "cash", category: "market_sale", amount: 1, sourceRefs: [] };
  assert.equal(empty.sourceRefs.length, 0);
  assert.throws(() => postLedgerEntries({ tick: 1, treasuryCoin: 0 }, [{ ...sale(1), sourceRefs: [] as unknown as LedgerPosting["sourceRefs"] }]), LedgerSourceError);
  assert.throws(() => postLedgerEntries({ tick: 1, treasuryCoin: 0 }, [sale(1.5)]), /whole pennies/);
});

test("L-6 four accounts exist; a sale posts to cash only (arrears is written by unpaid upkeep, C2 M-6)", () => {
  assert.deepEqual(LEDGER_ACCOUNTS, ["cash", "restricted", "arrears", "in_kind"]);
  const state = post({ tick: 0, treasuryCoin: 0 }, 80, [sale(6)]);
  for (const account of ["restricted", "arrears", "in_kind"] as const) {
    assert.equal(accountBalance(state.ledger!, account), 0);
    assert.deepEqual(ledgerView(state, account, "recent").entries, []);
  }
  assert.deepEqual(EMPTY_LEDGER, { entries: [], rollups: [], nextEntryOrdinal: 1 });
});

test("L-7 recent, previous and all windows split the entries by 2,400 ticks", () => {
  let state: Ledgered = { tick: 0, treasuryCoin: 0 };
  state = post(state, 1_000, [sale(2, "market-a")]);
  state = post(state, 3_000, [sale(5, "market-b"), sale(6, "market-a")]);
  const at = { ...state, tick: 4_000 };
  assert.deepEqual(ledgerView(at, "cash", "recent").bySource.map(row => [row.key, row.amount, row.count]), [["building:market-a", 6, 1], ["building:market-b", 5, 1]]);
  assert.deepEqual(ledgerView(at, "cash", "previous").byCategory, [{ category: "opening_balance", amount: 0 }, { category: "market_sale", amount: 2 }]);
  assert.equal(ledgerView(at, "cash", "all").total, 13);
});

function findButtons(node: ReactNode, into: ReactElement<{ onClick?: () => void; "data-source"?: string; "data-entry"?: string; children?: ReactNode }>[] = []) {
  if (Array.isArray(node)) for (const child of node) findButtons(child, into);
  else if (node !== null && typeof node === "object" && "props" in node) {
    const element = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
    if (element.type === "button") into.push(element as never);
    findButtons(element.props.children, into);
  }
  return into;
}

test("L-8 pressing a ledger source row outlines the selling market through the map highlight channel", () => {
  const market = { id: "market-12-8-0", kind: "market" as const, tx: 12, ty: 8, workers: 3, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const base = { ...structuredClone(DEFAULT_GAME_STATE), buildings: [...DEFAULT_GAME_STATE.buildings, market] } as GameState;
  const posted = post(base, 80, [sale(6, market.id)]);
  const state = { ...base, ...posted } as GameState;
  const model = ledgerPanelModel(state, "cash", "recent");
  assert.deepEqual(model.accounts.map(tab => tab.label), ["현금", "목적 기금", "미납 의무", "현물 의무"]);
  assert.equal(model.sources.find(row => row.buildingIds.includes(market.id))?.glyph, "시");
  const highlighted: (readonly string[])[] = [];
  const tree = LedgerPanelView({ id: "ledger", model, onSelectAccount: () => undefined, onSelectWindow: () => undefined, onHighlightBuildings: ids => highlighted.push(ids) });
  const sourceButton = findButtons(tree).find(button => button.props["data-source"] === `building:${market.id}`);
  assert.ok(sourceButton !== undefined);
  sourceButton.props.onClick!();
  assert.deepEqual(highlighted, [[market.id]]);
  // The ids reach the map as the market's four footprint tiles (houses are no longer the only kind).
  assert.deepEqual(highlightedHouseTiles(state, highlighted[0]!), [{ tx: 12, ty: 8 }, { tx: 13, ty: 8 }, { tx: 12, ty: 9 }, { tx: 13, ty: 9 }]);
  const entryButton = findButtons(tree).find(button => button.props["data-entry"] === "ledger-000002");
  entryButton!.props.onClick!();
  assert.deepEqual(highlighted.at(-1), [market.id]);
});

test("L-9 the current save round-trips the ledger; a v6 save starts it with one opening balance entry", () => {
  assert.ok(SAVE_SCHEMA_VERSION >= 10, "v11 adds households (LB-10) on top");
  const v6 = readFileSync("fixtures/saves/v6/timber-shortage.save.json", "utf8");
  const original = JSON.parse(v6).state as GameState & { coinLedger?: unknown };
  const { envelope, migratedFrom } = decodeSave(new TextEncoder().encode(v6));
  assert.equal(migratedFrom, 6);
  assert.equal("coinLedger" in envelope.state, false);
  assert.deepEqual(envelope.state.ledger, {
    entries: [{ id: "ledger-000001", tick: original.tick, account: "cash", category: "opening_balance", amount: original.treasuryCoin,
      sourceRefs: [{ type: "scenario", id: original.scenarioId, detail: "save_v6" }] }],
    rollups: [],
    nextEntryOrdinal: 2,
  });
  assert.equal(treasuryBalance(envelope.state), original.treasuryCoin);
  const played = post(envelope.state, envelope.state.tick + 80, [sale(6)]);
  const state = { ...envelope.state, ...played } as GameState;
  const again = decodeSave(encodeSave({ state, createdAt: envelope.createdAt, savedAt: envelope.savedAt, gameVersion: envelope.gameVersion }).bytes);
  assert.deepEqual(again.envelope.state.ledger, state.ledger);
  const corrupt = (ledger: unknown, treasuryCoin = state.treasuryCoin) => encodeSave({ state: { ...state, ledger, treasuryCoin } as GameState,
    createdAt: envelope.createdAt, savedAt: envelope.savedAt, gameVersion: envelope.gameVersion }).bytes;
  assert.throws(() => decodeSave(corrupt(state.ledger, state.treasuryCoin + 1)), /cash balance does not match/);
  assert.throws(() => decodeSave(corrupt({ ...state.ledger, entries: state.ledger!.entries.map(entry => ({ ...entry, sourceRefs: [] })) })), /no source/);
  assert.throws(() => decodeSave(corrupt({ ...state.ledger, entries: [...state.ledger!.entries].reverse() })), /out of order/);
  assert.throws(() => decodeSave(corrupt({ ...state.ledger, entries: state.ledger!.entries.map(entry => ({ ...entry, category: "tithe" })) })), /category is unknown/);
});
