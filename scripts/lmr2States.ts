// LM-R2 states (`lord2` state set, DGX ~/fls-lmr2-states): the lord screens' states from real play — a lord-mode town
// from 1300 played by commands only (scripts/marriagePath.ts: the offer, the counter taken, the promises kept, the will
// let stand, the contested estate sued for, the inheritance), then the inherited estate's stewardship by its commands
// (scripts/stewardshipPaths.ts' inheritedState and the lord's answers). Nothing injected: each state is the first tick
// the game shows the thing (before the path answers it).
//  - offer-countered: the lord's offer countered, the counter waiting (negotiation `countered`);
//  - marriage-contracted: the marriage contracted (stage `contracted`), its promises written;
//  - will-change: the father's new will to answer (marriageDecisionDue `will_change`);
//  - contested: the estate contested (stage `contested`) and the lord's suit on its claim under way;
//  - inherited: the estate inherited, its oversight delegated to a steward (an off-map stewardship);
//  - audit-pending: that estate's first Michaelmas audited by a visit, the finding waiting for the lord's answer;
//  - attention-overloaded: then the estate taken under the lord's own oversight within the visit's year (load > capacity);
//  - promises: a path where the lord keeps only his first promise — some kept, some broken, one still open;
//  - neighbour-suit: after the inheritance, played on by the lord bot's commands: a neighbour house suing the lord to
//    recover a piece he won of its estate (ER-21, plaintiff ≠ lord).
// Beside them lord2.json: for each, the seed, tick, year and what it holds. Seeds 1–5 in turn until each is found.
//   tsx scripts/lmr2States.ts <out-dir> [lastSeed=5]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 혼인·청지기·약속·소송 경로(scripts/lmr2States.ts)", { remote: "scripts/remote/run.sh render-LMR2-shell-<sha7> -- node_modules/.bin/tsx scripts/lmr2States.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { marriageDecisionDue, MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { diplomacyOf } from "../src/engine/negotiation";
import { stateCalendar } from "../src/engine/scenarioState";
import { attention, nextMichaelmas, pendingAudits, stewardCandidates, stewardshipOf } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { lordBotCommands } from "../src/engine/lordBot";
import { gameReducer } from "../src/state/gameStore";
import { marriagePath } from "./marriagePath";

const YEAR = 4_000;
const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/lmr2States.ts <out-dir> [lastSeed]");
const lastSeed = Number(process.argv[3] ?? 5);
mkdirSync(out, { recursive: true });

export const LORD2_STATES = ["offer-countered", "marriage-contracted", "will-change", "contested", "inherited", "audit-pending",
  "attention-overloaded", "promises", "neighbour-suit"] as const;
type Name = (typeof LORD2_STATES)[number];
const found = new Map<Name, Record<string, unknown>>();
const save = (name: Name, state: GameState, seed: number, holds: Record<string, unknown>) => {
  if (found.has(name)) return;
  const date = stateCalendar(state);
  found.set(name, { seed, tick: state.tick, year: date.year, season: date.season, ...holds });
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name}: seed ${seed} tick ${state.tick} (${date.year} ${date.season}) ${JSON.stringify(holds)}\n`);
};
const lordSuits = (state: GameState) => estatesOf(state).suits.filter(suit => suit.plaintiff === LORD);

/** The marriage's states as the path meets them; the inherited town when it gets there. */
function marriageStates(seed: number): GameState | null {
  const path = marriagePath({ seed, willAnswer: "let_it_be", lastYear: 1330, keepState: true, observe: state => {
    const diplomacy = diplomacyOf(state);
    const countered = diplomacy.negotiations.find(entry => entry.status === "countered");
    if (countered !== undefined) save("offer-countered", state, seed, { negotiation: countered.id, changes: countered.counter?.changes.length ?? 0, tier: countered.counter?.acceptance.tier });
    const plan = diplomacy.marriage;
    if (plan?.stage === "contracted") save("marriage-contracted", state, seed, { promises: diplomacy.promises.map(entry => `${entry.id} ${entry.term} ${entry.status}`) });
    if (marriageDecisionDue(state) === "will_change") save("will-change", state, seed, { stage: plan?.stage });
    const suit = plan?.claimId === undefined ? undefined : estatesOf(state).suits.find(entry => entry.claimId === plan.claimId && entry.stage !== "closed");
    if (plan?.stage === "contested" && suit !== undefined) save("contested", state, seed, { suit: suit.id, stage: suit.stage, claim: plan.claimId });
  } });
  process.stderr.write(`seed ${seed}: the marriage ${path.stage} in ${path.finalYear}\n`);
  return path.stage === "inherited" && path.state !== undefined ? path.state as GameState : null;
}

function stewardshipStates(seed: number, inherited: GameState): void {
  let state = inherited;
  while (state.stewardship === undefined) state = advanceTick(state);
  const greedy = stewardCandidates(state, MARRIAGE_ESTATE_ID).find(entry => entry.record.disposition === "greedy");
  if (greedy === undefined) { process.stderr.write(`seed ${seed}: no steward candidates\n`); return; }
  state = gameReducer(state, { type: "set_estate_oversight", estateId: MARRIAGE_ESTATE_ID, mode: "steward", stewardId: greedy.record.personId });
  state = gameReducer(state, { type: "set_audit_mode", estateId: MARRIAGE_ESTATE_ID, mode: "visit" });
  state = advanceTick(state);
  const oversight = () => stewardshipOf(state).oversight.find(entry => entry.estateId === MARRIAGE_ESTATE_ID);
  save("inherited", state, seed, { stage: diplomacyOf(state).marriage?.stage, mode: oversight()?.mode, steward: oversight()?.stewardId, audit: oversight()?.auditMode });
  const after = state;
  // The first Michaelmas (a visit): its finding waits; within the visit's year the lord takes the estate himself.
  const michaelmas = nextMichaelmas(state.tick);
  while (state.tick <= michaelmas + 1 && pendingAudits(state).length === 0) state = advanceTick(state);
  if (pendingAudits(state).length > 0) save("audit-pending", state, seed, { audits: pendingAudits(state).map(audit => `${audit.id} ${audit.mode} kept ${audit.revealedKept} errors ${audit.revealedErrors}`) });
  state = gameReducer(state, { type: "set_estate_oversight", estateId: MARRIAGE_ESTATE_ID, mode: "direct" });
  state = advanceTick(state);
  const load = attention(state);
  if (load.overloaded) save("attention-overloaded", state, seed, { capacity: load.capacity, load: load.load, reasons: load.reasons.map(reason => `${reason.name} ${reason.value}`) });
  else process.stderr.write(`seed ${seed}: attention ${load.load}/${load.capacity}, not overloaded\n`);
  // ER-21: a house sues to recover a piece the lord won of its estate (the Paston rule; the inherited estate is wholly
  // his, so the pieces come from his own suits on the claims the neighbours' papers raise) — the lord bot's commands play
  // on (its suits, stewardship, marriage and registry answers: scripts/eventArtStates.ts' way), the estate delegated.
  state = gameReducer(after, { type: "set_audit_mode", estateId: MARRIAGE_ESTATE_ID, mode: "accounts" });
  const end = state.tick + 45 * YEAR;
  while (state.tick < end && !found.has("neighbour-suit")) {
    for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
    state = advanceTick(state);
    const suit = estatesOf(state).suits.find(entry => entry.plaintiff !== LORD && entry.stage !== "closed");
    if (suit !== undefined) save("neighbour-suit", state, seed, { suit: suit.id, plaintiff: suit.plaintiff, estate: suit.estateId, stage: suit.stage, lordSuits: lordSuits(state).length });
  }
}

/** A path where the lord keeps only his first promise: the rest lapse at their deadlines (broken). */
function promiseStates(seed: number): void {
  let kept: string | null = null;
  marriagePath({ seed, lastYear: 1335, keepPromise: (_state, promise) => { if (kept === null) kept = promise.id; return promise.id === kept; }, observe: state => {
    const promises = diplomacyOf(state).promises;
    const lords = promises.filter(entry => entry.promisor === LORD);
    const open = promises.filter(entry => entry.status === "open");
    if (lords.some(entry => entry.status === "kept") && lords.some(entry => entry.status === "broken") && open.length > 0) {
      save("promises", state, seed, { promises: promises.map(entry => `${entry.id} ${entry.promisor === LORD ? "lord" : entry.promisor} ${entry.term} ${entry.status} due ${entry.deadline - state.tick}`) });
      return true;
    }
    return undefined;
  } });
}

for (let seed = 1; seed <= lastSeed && found.size < LORD2_STATES.length; seed += 1) {
  const marriageNames: readonly Name[] = ["offer-countered", "marriage-contracted", "will-change", "contested", "inherited", "audit-pending", "attention-overloaded", "neighbour-suit"];
  if (marriageNames.some(name => !found.has(name))) {
    const inherited = marriageStates(seed);
    if (inherited !== null && ["inherited", "audit-pending", "attention-overloaded", "neighbour-suit"].some(name => !found.has(name as Name))) stewardshipStates(seed, inherited);
  }
  if (!found.has("promises")) promiseStates(seed);
}
writeFileSync(join(out, "lord2.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
const missing = LORD2_STATES.filter(name => !found.has(name));
process.stderr.write(`lord2 ${LORD2_STATES.length - missing.length}/${LORD2_STATES.length}${missing.length === 0 ? "" : `, missing ${missing.join(" ")}`}\n`);
if (missing.length > 0) process.exitCode = 1;
