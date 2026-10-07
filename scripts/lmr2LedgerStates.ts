// LM-R2 (ledger area) states, played on from the lord2 paths (scripts/lmr2States.ts) by commands only — nothing
// injected: the ledger's 캡처 관문 needs a promise due within a season and on its last day, and the suit at each stage,
// which the lord2 set (each state at the first tick the game shows its thing) does not hold.
//  - promise-due / promise-due-today: the same path as lord2 "promises" (seed 1, the lord keeps only his first promise;
//    scripts/marriagePath.ts), played on to the first tick an open promise of the lord's is within a season of its
//    deadline (deadline − tick ≤ 1000), then to its deadline's own day;
//  - suit-evidence / suit-patronage / suit-hearing / suit-enforcing / suit-closed: the same path as lord2 "contested"
//    (seed 5, the will let stand; the path sues for the estate — the deed, the witnesses, the charter, the bishop as
//    patron — and enforces), each at the first tick of its stage, before the path answers it.
// Beside them ledger2.json: for each, the seed, tick, year and what it holds.
//   tsx scripts/lmr2LedgerStates.ts <out-dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 약속·소송 상태(scripts/lmr2LedgerStates.ts)", { remote: "scripts/remote/run.sh render-LMR2-ledger-<sha7> -- node_modules/.bin/tsx scripts/lmr2LedgerStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BALANCE } from "../src/content/balanceConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import type { SuitStage } from "../src/engine/estates.types";
import { diplomacyOf } from "../src/engine/negotiation";
import { stateCalendar } from "../src/engine/scenarioState";
import { marriagePath } from "./marriagePath";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/lmr2LedgerStates.ts <out-dir>");
mkdirSync(out, { recursive: true });
const SEASON = BALANCE.TICKS_PER_YEAR / 4;
const DAY = BALANCE.TICKS_PER_YEAR / 360;

export const LEDGER2_STATES = ["promise-due", "promise-due-today", "suit-evidence", "suit-patronage", "suit-hearing", "suit-enforcing", "suit-closed"] as const;
type Name = (typeof LEDGER2_STATES)[number];
const found = new Map<Name, Record<string, unknown>>();
const save = (name: Name, state: GameState, seed: number, holds: Record<string, unknown>) => {
  if (found.has(name)) return;
  const date = stateCalendar(state);
  found.set(name, { seed, tick: state.tick, year: date.year, season: date.season, ...holds });
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name}: seed ${seed} tick ${state.tick} (${date.year} ${date.season}) ${JSON.stringify(holds)}\n`);
};

// The promise path: lord2 "promises" (the lord keeps only his first promise), played on.
{
  let kept: string | null = null;
  marriagePath({ seed: 1, lastYear: 1335, keepPromise: (_state, promise) => { if (kept === null) kept = promise.id; return promise.id === kept; }, observe: state => {
    const promises = diplomacyOf(state).promises;
    const lords = promises.filter(entry => entry.promisor === LORD);
    if (!lords.some(entry => entry.status === "kept") || !lords.some(entry => entry.status === "broken")) return undefined;
    const open = lords.filter(entry => entry.status === "open" && entry.deadline >= state.tick).sort((a, b) => a.deadline - b.deadline)[0];
    if (open === undefined) return undefined;
    const holds = { promise: open.id, term: open.term, amount: open.amount ?? 0, left: open.deadline - state.tick, statuses: promises.map(entry => `${entry.id} ${entry.status}`) };
    if (open.deadline - state.tick <= SEASON) save("promise-due", state, 1, holds);
    if (Math.floor(open.deadline / DAY) === Math.floor(state.tick / DAY)) { save("promise-due-today", state, 1, holds); return true; }
    return undefined;
  } });
}

// The suit path: lord2 "contested" (the will let stand), the lord's suit for the estate at each stage.
{
  const names: Partial<Record<SuitStage, Name>> = { evidence: "suit-evidence", patronage: "suit-patronage", hearing: "suit-hearing", enforcing: "suit-enforcing", closed: "suit-closed" };
  marriagePath({ seed: 5, willAnswer: "let_it_be", lastYear: 1330, observe: state => {
    const plan = diplomacyOf(state).marriage;
    const suit = plan === undefined ? undefined : estatesOf(state).suits.find(entry => entry.claimId === plan.claimId && entry.plaintiff === LORD);
    if (suit === undefined) return undefined;
    const name = names[suit.stage];
    if (name !== undefined) save(name, state, 5, { suit: suit.id, stage: suit.stage, patron: suit.patron ?? null, verdict: suit.verdict ?? null,
      enforcements: suit.enforcements, hold: suit.hold ?? null, evidence: estatesOf(state).claims.find(entry => entry.id === suit.claimId)?.evidence.map(entry => entry.kind) });
    return suit.stage === "closed" ? true : undefined;
  } });
}

writeFileSync(join(out, "ledger2.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
const missing = LEDGER2_STATES.filter(name => !found.has(name));
process.stderr.write(`ledger2 ${LEDGER2_STATES.length - missing.length}/${LEDGER2_STATES.length}${missing.length === 0 ? "" : `, missing ${missing.join(" ")}`}\n`);
// The enforcing stage comes only when the possessor holds on after a judgment for the lord; the rest must be there.
if (missing.some(name => name !== "suit-enforcing")) process.exitCode = 1;
