// LM-E9 gates (spec docs/design/registry.md ER-7, ER-8): worked examples on the lord's slice as a new game makes it —
// an instalment plan paid year by year to its term (what the cash cannot cover goes to arrears), a market-dues remission that waives the dues and restores them at its
// end, and a ruling that narrows a right's scope (the piece keeps its share of the year's worth). Each step lists the
// year, the treasury, the dues, the term's state and the ledger lines the registry posted.
//   tsx scripts/registryTermExamples.ts > examples.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { RegistryEntry } from "../src/content/registry/registryTypes";
import type { GameState } from "../src/engine/engine.types";
import { estatePortfolio, estatesOf } from "../src/engine/estates";
import { fileSuit } from "../src/engine/estateSuits";
import { advanceRegistry, applyChoice, registryOf } from "../src/engine/registry";
import { stateCalendar } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { newGameState } from "../src/state/newGame";

const YEAR = 4000;

const entry = (id: string, choice: RegistryEntry["choices"][number], bind: RegistryEntry["bind"] = "none"): RegistryEntry => ({
  id, kind: "event", source: "example", years: { fromYear: 1300, toYear: 1450 },
  frequency: { chancePermille: 1000, weight: 1, minGapSeasons: 0, maxPerYear: 1 }, recurrence: { mode: "once", cooldownSeasons: 0, maxOccurrences: 1 },
  sender: "town", bind, choices: [{ id: "decline", effects: [{ command: "none" }] }, choice], precedent: false, artId: null,
});

function row(state: GameState, step: string) {
  const term = registryOf(state).terms.at(-1);
  const lines = (state.ledger?.entries ?? []).filter(line => line.category === "instalment")
    .map(line => ({ year: stateCalendar({ ...state, tick: line.tick }).year, account: line.account, amount: line.amount }));
  return { step, year: stateCalendar(state).year, treasury: treasuryBalance(state), duesPermille: state.agency?.duesPermille ?? null,
    term: term === undefined ? null : { kind: term.kind, what: term.what, settledYears: term.settledYears, status: term.status, endYear: stateCalendar({ ...state, tick: term.endTick }).year },
    instalmentLines: lines, arrears: (state.money?.arrears ?? []).filter(arrear => arrear.category === "instalment").reduce((sum, arrear) => sum + arrear.amount, 0) };
}

/** Year turns from `state`, one row each, until the last term ends (and one year past it). */
function yearsOn(state: GameState, label: string, rows: unknown[]): GameState {
  let next = state;
  for (let year = 1; year <= 6; year += 1) {
    next = advanceRegistry({ ...next, tick: state.tick + year * YEAR });
    rows.push(row(next, `${label} year turn ${year}`));
    if (registryOf(next).terms.every(term => term.status === "ended") && year > 1) break;
  }
  return next;
}

export function registryTermExamples() {
  const start = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 }) as GameState;
  const base: GameState = { ...start, tick: start.tick + 5 * YEAR };

  const instalments: unknown[] = [row(base, "before")];
  const plan = applyChoice(base, entry("example:instalments", { id: "plan", effects: [{ command: "term", term: "installments", what: "debt", amountPerYear: 50, years: 3 }] }), "plan", "", "occ-plan");
  if (plan === null) throw new Error("the instalment plan did not start");
  instalments.push(row(plan, "answered: 50 a year for 3 years"));
  yearsOn(plan, "instalments", instalments);

  const remission: unknown[] = [row(base, "before")];
  const waived = applyChoice(base, entry("example:remission", { id: "waive", effects: [{ command: "term", term: "remission", what: "market_dues", amountPerYear: 250, years: 2 }] }), "waive", "", "occ-waive");
  if (waived === null) throw new Error("the remission did not start (no market dues on this slice?)");
  remission.push(row(waived, "answered: dues at 250 permille for 2 years"));
  yearsOn(waived, "remission", remission);

  const claim = estatesOf(base).claims.find(entry => entry.status === "open") ?? estatesOf(base).claims[0];
  let scope: unknown = { skipped: "the slice has no claim to sue" };
  if (claim !== undefined) {
    const suing = fileSuit(base, claim.id);
    const suit = estatesOf(suing).suits.at(-1);
    if (suit?.pieceId !== undefined) {
      const ruled = applyChoice(suing, entry("example:scope", { id: "narrow", effects: [{ command: "rights_scope", sharePermille: 600 }] }, "open_suit"), "narrow", suit.id, "occ-rule");
      const piece = (state: GameState) => estatePortfolio(state).find(estate => estate.id === suit.estateId)?.pieces.find(entry => entry.id === suit.pieceId);
      scope = { claim: claim.id, suit: suit.id, estate: suit.estateId, piece: suit.pieceId, ruling: "600 permille of the right",
        before: { yearValue: piece(suing)?.yearValue ?? null, scope: piece(suing)?.scope ?? null },
        after: ruled === null ? "refused" : { yearValue: piece(ruled)?.yearValue ?? null, scope: piece(ruled)?.scope ?? null } };
    }
  }
  return { scenario: LORD_SLICE_SCENARIO_ID, seed: 1, instalments, remission, scope };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(registryTermExamples(), null, 1)}\n`);
}
