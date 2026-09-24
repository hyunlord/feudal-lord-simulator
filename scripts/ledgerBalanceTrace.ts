// Gate ① of B3: the treasury derived from the ledger equals the pre-ledger treasury on every tick.
// Usage: tsx scripts/ledgerBalanceTrace.ts <repoRoot> <case> <ticks> [stateFile]
//   case = new-game | state (stateFile: bare GameState JSON or save file, opened through that root's decodeSave)
// Runs the actual autoplay driver + advanceTick of <repoRoot> (old or new code) and prints one JSON line:
// the per-tick treasury sequence hash, the final state hash without ledger fields, and for new code the
// check that the cached treasuryCoin equals the ledger's cash balance on every tick.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type AnyState = Record<string, unknown> & { tick: number; treasuryCoin: number };

async function load<T>(root: string, path: string): Promise<T> {
  return await import(pathToFileURL(resolve(root, path)).href) as T;
}

export async function ledgerBalanceTrace(root: string, kind: string, ticks: number, stateFile?: string) {
  const { advanceTick } = await load<{ advanceTick: (state: AnyState) => AnyState }>(root, "src/engine/tick.ts");
  const { DEFAULT_GAME_STATE } = await load<{ DEFAULT_GAME_STATE: AnyState }>(root, "src/state/gameStore.ts");
  const { decodeSave, encodeSave } = await load<{
    decodeSave: (bytes: Uint8Array) => { envelope: { state: AnyState } };
    encodeSave: (input: { state: AnyState; createdAt: string; savedAt: string; gameVersion: string }) => { bytes: Uint8Array };
  }>(root, "src/save/saveCodec.ts");
  const { createAutoplayTraceDriver } = await load<{ createAutoplayTraceDriver: (input: unknown) => { apply: (state: AnyState) => AnyState } }>(root, "scripts/economyHarnessAutoplay.ts");
  const { canonicalStateHash } = await load<{ canonicalStateHash: (value: unknown) => string }>(root, "scripts/verifySaveDeterminism.ts");
  let ledgerApi: { treasuryBalance: (state: AnyState) => number; accountBalance: (ledger: unknown, account: string) => number } | null = null;
  try {
    ledgerApi = await load(root, "src/ledger/ledger.ts");
  } catch {
    ledgerApi = null;
  }
  let state: AnyState = kind === "new-game"
    ? structuredClone(DEFAULT_GAME_STATE)
    : decodeSave(new Uint8Array(readFileSync(stateFile!))).envelope.state;
  const driver = createAutoplayTraceDriver({ id: `ledger-trace-${kind}`, source: kind, policy: { maxHousingLots: 24 } });
  const sequence = createHash("sha256");
  const startTick = state.tick;
  let cacheMismatches = 0;
  let changes = 0;
  let previous = ledgerApi === null ? state.treasuryCoin : ledgerApi.treasuryBalance(state);
  const started = performance.now();
  for (let step = 0; step < ticks; step += 1) {
    state = advanceTick(driver.apply(state));
    const treasury = ledgerApi === null ? state.treasuryCoin : ledgerApi.treasuryBalance(state);
    if (ledgerApi !== null && state.ledger !== undefined && ledgerApi.accountBalance(state.ledger, "cash") !== state.treasuryCoin) cacheMismatches += 1;
    if (treasury !== previous) changes += 1;
    previous = treasury;
    sequence.update(`${state.tick}:${treasury};`);
  }
  const elapsedMs = performance.now() - started;
  const fixed = "2026-09-25T00:00:00.000Z";
  const saveBytes = encodeSave({ state, createdAt: fixed, savedAt: fixed, gameVersion: "trace" }).bytes.byteLength;
  const { coinLedger: _coinLedger, ledger, ...rest } = state as AnyState & { coinLedger?: unknown; ledger?: { entries: unknown[]; rollups: unknown[] } };
  // C2: the world without any money field (treasury, ledger, money-rule counts, unpaid flags). Equal before and
  // after C2 while no upkeep goes unpaid and no stone-wall project is proclaimed.
  const { treasuryCoin: _treasury, money: _money, buildings, ...world } = rest as AnyState & { money?: unknown; buildings: Record<string, unknown>[] };
  const worldBuildings = buildings.map(({ upkeepUnpaid: _unpaid, ...building }) => building);
  return {
    kind, stateFile: stateFile ?? null, startTick, endTick: state.tick, ticks,
    treasurySequenceSha256: sequence.digest("hex"), finalTreasury: previous, treasuryChanges: changes,
    finalStateHashWithoutLedger: canonicalStateHash(rest),
    finalWorldHashWithoutMoney: canonicalStateHash({ ...world, buildings: worldBuildings }),
    ledger: ledger === undefined ? null : { entries: ledger.entries.length, rollups: ledger.rollups.length },
    cacheMismatches: ledgerApi === null ? null : cacheMismatches,
    msPerTick: Number((elapsedMs / ticks).toFixed(3)),
    saveBytes,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [root, kind, ticks, stateFile] = process.argv.slice(2);
  if (root === undefined || kind === undefined || ticks === undefined) throw new RangeError("Usage: ledgerBalanceTrace.ts <repoRoot> <case> <ticks> [stateFile]");
  const result = await ledgerBalanceTrace(resolve(root), kind, Number(ticks), stateFile === undefined ? undefined : resolve(stateFile));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
