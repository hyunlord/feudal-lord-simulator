// NAT-1 audit additions (user, 2026-09-30): who builds the roads that keep going into one place, and which people stand
// still. Headless: a new game (the riverside town, seed 1) with the bot on, as the game runs it (the autoplay trace
// driver + advanceTick); no browser.
//   tsx scripts/nat1bProbe.ts <out.json> [ticks=24000]
import { writeFileSync } from "node:fs";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { newGameState } from "../src/state/newGame";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { presentedState } from "../src/render/presentation/presentedState";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

const out = process.argv[2]!; const ticks = Number(process.argv[3] ?? 24_000);
let state: GameState = newGameState({ scenarioId: DEFAULT_GAME_STATE.scenarioId ?? "core:campaign_market_town" }) ?? DEFAULT_GAME_STATE;
const receipts: { tick: number; kind: string; from?: unknown; to?: unknown; result: string; roadTilesAdded: number }[] = [];
let pendingRoads = 0;
const roadTiles = (s: GameState) => s.tiles.reduce((sum, tile) => sum + (tile.hasRoad ? 1 : 0), 0);
const driver = createAutoplayTraceDriver({ id: "nat1b", source: "probe", onDiagnostic: receipt => {
  const action = receipt.advisorAction as { kind: string; from?: unknown; to?: unknown };
  if (action.kind === "place_road") receipts.push({ tick: receipt.tick, kind: action.kind, from: action.from, to: action.to, result: receipt.result, roadTilesAdded: 0 });
} });
// Standing people: sampled every 50 ticks; a walker (engine) or a presented resident whose position did not change over
// STILL samples in a row counts as standing, with its kind and phase.
const SAMPLE = 50; const STILL = 6;
const last = new Map<string, { key: string; still: number }>();
const standing: { tick: number; total: number; still: number; byKind: Record<string, number> }[] = [];
for (let step = 0; step < ticks; step += 1) {
  const before = roadTiles(state);
  const count = receipts.length;
  state = driver.apply(state);
  if (receipts.length > count) { const added = roadTiles(state) - before; const entry = receipts.at(-1)!; entry.roadTilesAdded = added; pendingRoads += 1; }
  state = advanceTick(state);
  if (state.tick % SAMPLE === 0) {
    const shown = presentedState(state).walkers;
    let still = 0; const byKind: Record<string, number> = {};
    for (const walker of shown) {
      const w = walker as unknown as { id: string; kind: string; phase?: string; resident?: unknown; position: { tx: number; ty: number } };
      const key = `${w.position.tx.toFixed(2)},${w.position.ty.toFixed(2)}`;
      const seen = last.get(w.id);
      const next = { key, still: seen !== undefined && seen.key === key ? seen.still + 1 : 0 };
      last.set(w.id, next);
      if (next.still >= STILL) { still += 1; const label = `${w.kind}${w.resident === undefined ? "" : ":resident"}:${w.phase ?? "-"}`; byKind[label] = (byKind[label] ?? 0) + 1; }
    }
    if (state.tick % 1_200 === 0) standing.push({ tick: state.tick, total: shown.length, still, byKind });
  }
}
const repeats = new Map<string, number>();
for (const receipt of receipts) { const key = JSON.stringify([receipt.from, receipt.to]); repeats.set(key, (repeats.get(key) ?? 0) + 1); }
writeFileSync(out, JSON.stringify({ ticks, roadActions: receipts.length, byResult: receipts.reduce<Record<string, number>>((m, r) => { m[r.result] = (m[r.result] ?? 0) + 1; return m; }, {}),
  noRoadAdded: receipts.filter(r => r.roadTilesAdded === 0).length, topRepeats: [...repeats].sort((a, b) => b[1] - a[1]).slice(0, 10), receipts: receipts.slice(0, 400), standing }, null, 1));
console.log(`road actions ${receipts.length}, no road added ${receipts.filter(r => r.roadTilesAdded === 0).length}, top repeat ${[...repeats].sort((a, b) => b[1] - a[1])[0]}`);
