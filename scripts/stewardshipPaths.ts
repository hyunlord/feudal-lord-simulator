// LM-E4 (spec docs/design/stewardship.md SW-10): the stewardship from the inheritance — the marriage's human path
// (scripts/marriagePath.ts) to the third neighbour's estate, then by commands only:
//   compare: the same seed and inheritance, three stewards (one of each disposition) × delegated or overseen directly,
//            two years each — the estate's yield, what reached the treasury, what was kept back and found, the
//            petitions and who answered them, the tenants' and merchants' goodwill (the lord answers what comes to him
//            the same way in every run: the tenants' asks granted, the merchants' refused; audits tolerated, so the
//            steward stays).
//   path:    a person's path — the estate delegated to the steward with the highest rents (the greedy one), the
//            exceptions set (£1 or more, a right, a marriage come to the lord), the first Michaelmas audited by a visit,
//            what it finds punished, a second year to the next Michaelmas by the accounts.
// Reads only the screens' APIs; never edits the state.
//   tsx scripts/stewardshipPaths.ts compare|path <seed> > out.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameState } from "../src/engine/engine.types";
import { historySummary } from "../src/engine/history";
import { stateCalendar } from "../src/engine/scenarioState";
import { attention, lordEstatePetitions, nextMichaelmas, pendingAudits, stewardCandidates, stewardshipOf } from "../src/engine/stewardship";
import type { OversightMode, StewardDisposition } from "../src/engine/stewardship.types";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { marriagePath } from "./marriagePath";

const YEAR = 4000;

/** The marriage's path to the inheritance, then on to the season the estate's oversight begins. */
export function inheritedState(seed: number): GameState {
  const path = marriagePath({ seed, keepState: true });
  if (path.stage !== "inherited" || path.state === undefined) throw new Error(`seed ${seed}: the marriage ended ${path.stage}, not inherited`);
  let state = path.state;
  while (state.stewardship === undefined) state = advanceTick(state);
  return state;
}

type Send = (action: Parameters<typeof gameReducer>[1], label: string) => void;

/**
 * The lord's fixed answers: what reaches him — the tenants' asks granted, the merchants' refused; an audit by `audit`
 * (`punish`: what was kept back found is punished, errors alone are let be).
 */
function lordAnswers(state: GameState, send: Send, audit: "tolerate" | "punish") {
  for (const petition of lordEstatePetitions(state)) send({ type: "answer_estate_petition", petitionId: petition.id, grant: petition.group === "tenants" }, `answer_estate_petition(${petition.kind})`);
  for (const found of pendingAudits(state)) {
    const choice = audit === "punish" && found.revealedKept > 0 ? "punish" : "tolerate";
    send({ type: "answer_audit", auditId: found.id, choice }, `answer_audit(${choice})`);
  }
}

export function compareRun(start: GameState, disposition: StewardDisposition, mode: OversightMode, years = 2) {
  let state = start;
  const send: Send = action => { state = gameReducer(state, action); };
  const steward = stewardCandidates(state, MARRIAGE_ESTATE_ID).find(entry => entry.record.disposition === disposition)!;
  send({ type: "set_estate_oversight", estateId: MARRIAGE_ESTATE_ID, mode, stewardId: steward.record.personId }, "set_estate_oversight");
  const treasury = treasuryBalance(state);
  const from = state.tick;
  for (let tick = 0; tick < years * YEAR; tick += 1) {
    state = advanceTick(state);
    if (state.tick % 50 === 0) lordAnswers(state, send, "tolerate");
  }
  const own = stewardshipOf(state);
  const seasons = own.summaries.filter(entry => entry.tick > from);
  const petitions = own.petitions.filter(entry => entry.tick > from);
  const count = (group: string, status: string, by?: string) => petitions.filter(entry => entry.group === group && entry.status === status && (by === undefined || entry.decidedBy === by)).length;
  const oversight = own.oversight.find(entry => entry.estateId === MARRIAGE_ESTATE_ID)!;
  const audits = own.audits.filter(entry => entry.tick > from);
  const estateIncome = (state.ledger?.entries ?? []).filter(entry => entry.tick > from && entry.category === "estate_income").reduce((sum, entry) => sum + entry.amount, 0);
  return {
    disposition, mode, steward: { ability: steward.record.ability, loyalty: steward.record.loyalty, connection: steward.record.connection },
    yielded: seasons.reduce((sum, entry) => sum + entry.income, 0), toTreasury: estateIncome,
    kept: seasons.reduce((sum, entry) => sum + entry.kept, 0), errors: seasons.reduce((sum, entry) => sum + entry.error, 0),
    found: audits.reduce((sum, entry) => sum + entry.revealedKept, 0), hidden: audits.reduce((sum, entry) => sum + entry.hidden, 0),
    rates: { rent: seasons.at(-1)?.rentPermille, dues: seasons.at(-1)?.duesPermille },
    petitions: { tenantsGranted: count("tenants", "granted"), tenantsRefused: count("tenants", "refused"), merchantsGranted: count("merchants", "granted"),
      merchantsRefused: count("merchants", "refused"), lapsed: petitions.filter(entry => entry.status === "lapsed").length,
      bySteward: petitions.filter(entry => entry.decidedBy === "steward").length, byLord: petitions.filter(entry => entry.decidedBy === "lord").length },
    tenants: oversight.tenants, merchants: oversight.merchants, overloadedSeasons: seasons.filter(entry => entry.overloaded).length,
    treasuryChange: treasuryBalance(state) - treasury,
  };
}

export function stewardshipCompare(seed: number, years = 2) {
  const start = inheritedState(seed);
  const rows = (["merchant", "peasant", "greedy"] as const).flatMap(disposition => (["steward", "direct"] as const).map(mode => compareRun(start, disposition, mode, years)));
  return { seed, from: stateCalendar(start).year, attention: attention(start), rows };
}

export function stewardPath(seed: number) {
  let state = inheritedState(seed);
  const commands: { year: number; command: string }[] = [];
  const send: Send = (action, label) => { const next = gameReducer(state, action); if (next !== state) commands.push({ year: stateCalendar(next).year, command: label }); state = next; };
  const from = state.tick;
  // The steward with the highest rents (the screen shows each candidate's disposition and rates).
  const greedy = stewardCandidates(state, MARRIAGE_ESTATE_ID).find(entry => entry.record.disposition === "greedy")!;
  send({ type: "set_estate_oversight", estateId: MARRIAGE_ESTATE_ID, mode: "steward", stewardId: greedy.record.personId }, "set_estate_oversight(steward)");
  send({ type: "set_exception_rules", rules: { amountAtLeast: 240, rights: true, marriage: true } }, "set_exception_rules(£1, rights, marriage)");
  send({ type: "set_audit_mode", estateId: MARRIAGE_ESTATE_ID, mode: "visit" }, "set_audit_mode(visit)");
  const first = nextMichaelmas(state.tick);
  const end = nextMichaelmas(first + 1) + 1100;
  while (state.tick < end) {
    state = advanceTick(state);
    if (state.tick === first + 1) send({ type: "set_audit_mode", estateId: MARRIAGE_ESTATE_ID, mode: "accounts" }, "set_audit_mode(accounts)");
    if (state.tick % 50 === 0) lordAnswers(state, send, "punish");
  }
  const own = stewardshipOf(state);
  return {
    seed, from: stateCalendar({ ...state, tick: from }).year, to: stateCalendar(state).year, commands,
    stewards: own.stewards.map(entry => ({ id: entry.personId, disposition: entry.disposition, ability: entry.ability, loyalty: entry.loyalty, status: entry.status })),
    audits: own.audits, attention: attention(state),
    escalated: own.petitions.filter(entry => entry.escalated !== undefined && entry.escalated !== "direct").map(entry => ({ kind: entry.kind, rule: entry.escalated, status: entry.status })),
    // (by tick: the ledger folds its old everyday lines each season, so a count from the start would skip some)
    ledger: (state.history?.records ?? []).filter(record => record.tick >= from && (record.template.startsWith("stewardship.") || record.template === "faction.relation"))
      .map(record => `${stateCalendar({ ...state, tick: record.tick }).year} ${historySummary(record, state)}`),
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [what, seed] = process.argv.slice(2);
  const result = what === "path" ? stewardPath(Number(seed ?? 1)) : stewardshipCompare(Number(seed ?? 1));
  process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
}
