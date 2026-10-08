// SUIT-THREAD (renderer A, the ledger's defence and forcible-entry rows) states for the geometry rows and the captures:
// played on from the lord2 `neighbour-suit` state (scripts/lmr2States.ts: seed 1, 1321, a house's suit against the lord
// just filed) by commands only — nothing injected. Two lords:
//  - `bot`: the lord bot's commands, its defence too (evidence, the bishop's patronage, a concord, the hold, the guard);
//  - `idle`: the same lord who never answers a suit against him or a forewarned entry (the bot's other commands only),
//    so the house's suit runs to its judgment and enforcement and its men come in.
// Each state is the first tick the game shows its thing (after the tick, before the lord's next commands):
//  - defence-patronage / defence-enforcing: a suit against the lord at its patronage stage / its enforcement (the hold);
//  - entry-threat: a forcible entry forewarned (DTR-23 S3);
//  - entry-forced: the lord's novel claim after a house came in by force (`claim.novel`);
//  - neighbour-took: a house's enforcement that took the possession from the lord (`estate.possession_enforced`, §4);
//  - suit-settled: a suit against the lord ended by a final concord.
// Beside them suit-ledger-states.json (each: the path, the tick, the year and what it holds) and a yearly line of the
// neighbours' relations on stderr (a forcible entry needs a house at −60 or below).
//   tsx scripts/suitLedgerStates.ts <lord2-dir> <out-dir> [years=40]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 소송 방어·강제 점거 경로(scripts/suitLedgerStates.ts)", { remote: "scripts/remote/run.sh render-SUIT-states-<sha7> -- node_modules/.bin/tsx scripts/suitLedgerStates.ts ~/fls-lmr2-states <디렉터리>", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import { admitSceneState } from "./sceneState";

const YEAR = 4_000;
const [lord2, out] = [process.argv[2], process.argv[3]];
if (lord2 === undefined || out === undefined) throw new Error("usage: tsx scripts/suitLedgerStates.ts <lord2-dir> <out-dir> [years]");
const years = Number(process.argv[4] ?? 40);
mkdirSync(out, { recursive: true });

const NAMES = ["defence-patronage", "defence-enforcing", "entry-threat", "entry-forced", "neighbour-took", "suit-settled"] as const;
type Name = (typeof NAMES)[number];
const found = new Map<Name, Record<string, unknown>>();
const save = (name: Name, path: string, state: GameState, holds: Record<string, unknown>) => {
  if (found.has(name)) return;
  const date = stateCalendar(state);
  found.set(name, { path, tick: state.tick, year: date.year, season: date.season, ...holds });
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name}: ${path} tick ${state.tick} (${date.year} ${date.season}) ${JSON.stringify(holds)}\n`);
};

/** The lord's answers to a suit against him or a forewarned entry (the `idle` lord leaves them). */
const DEFENCE: ReadonlySet<GameAction["type"]> = new Set(["add_defence_evidence", "seek_defence_patron", "settle_suit", "hold_possession", "guard_possession", "appease_neighbour"]);

function look(path: string, before: GameState, state: GameState): void {
  const estates = estatesOf(state);
  const against = estates.suits.filter(suit => suit.defendant === LORD && suit.plaintiff !== LORD);
  const patronage = against.find(suit => suit.stage === "patronage");
  if (patronage !== undefined) save("defence-patronage", path, state, { suit: patronage.id, plaintiff: patronage.plaintiff });
  const enforcing = against.find(suit => suit.stage === "enforcing");
  if (enforcing !== undefined) save("defence-enforcing", path, state, { suit: enforcing.id, plaintiff: enforcing.plaintiff, hold: enforcing.hold ?? 0 });
  const threat = estates.threats?.find(entry => entry.guarded !== true);
  if (threat !== undefined) save("entry-threat", path, state, { threat: threat.id, house: threat.house, piece: threat.pieceId, due: threat.due });
  const novel = estates.claims.find(claim => claim.claimant === LORD && claim.novel === true && claim.status === "open");
  if (novel !== undefined) save("entry-forced", path, state, { claim: novel.id, piece: novel.pieceId ?? "" });
  const seen = before.history?.records.length ?? 0;
  const took = (state.history?.records ?? []).slice(seen).find(record => record.template === "estate.possession_enforced"
    && record.params?.succeeded === 1 && record.params?.plaintiff !== undefined && record.params.plaintiff !== LORD);
  if (took !== undefined) save("neighbour-took", path, state, { record: took.id, suit: took.params?.suit ?? "" });
  const settled = against.find(suit => suit.settled !== undefined && estatesOf(before).suits.find(entry => entry.id === suit.id)?.settled === undefined);
  if (settled !== undefined) save("suit-settled", path, state, { suit: settled.id, terms: settled.settled });
}

function play(path: "bot" | "idle", start: GameState): void {
  let state = start;
  const end = state.tick + years * YEAR;
  while (state.tick < end && found.size < NAMES.length) {
    for (const { command } of lordBotCommands(state)) if (path === "bot" || !DEFENCE.has(command.type)) state = gameReducer(state, command);
    const before = state;
    state = advanceTick(state);
    look(path, before, state);
    if (state.tick % YEAR === 0) {
      const relations = (state.factions?.factions ?? []).filter(faction => faction.id.startsWith("neighbour")).map(faction => `${faction.id} ${faction.relation}`).join(", ");
      process.stderr.write(`${path} ${stateCalendar(state).year}: ${relations}; threats ${estatesOf(state).threats?.length ?? 0}; found ${found.size}/${NAMES.length}\n`);
    }
  }
}

const started = Date.now();
// The page's own way in (scripts/sceneInjection.mjs): the lord2 file as the geometry rows and captures load it.
const start = admitSceneState(JSON.parse(readFileSync(join(lord2, "neighbour-suit.json"), "utf8")), DEFAULT_GAME_STATE);
play("idle", start);
if (found.size < NAMES.length) play("bot", start);
writeFileSync(join(out, "suit-ledger-states.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
const missing = NAMES.filter(name => !found.has(name));
process.stderr.write(`suit-ledger ${NAMES.length - missing.length}/${NAMES.length}${missing.length === 0 ? "" : `, missing ${missing.join(" ")}`} in ${Math.round((Date.now() - started) / 1000)} s\n`);
