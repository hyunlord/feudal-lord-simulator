// LM-E1 gates (spec docs/design/town-agency.md TA-7, TA-9): a lord-mode town on one land and seed, from 1300 to
// `lastYear`. The town agency builds; the lord bot only plays the lord — it sets the estate policy, a subsidy and the
// market dues at the start (recorded decisions), answers the chapters' petitions and famine, and grants the town's
// charter and wall requests (the era proclamation, the wall's priority, timber from the traders).
//   tsx scripts/lordModeRun.ts <archetypeId> <seed> <lastYear> <policy> [subsidyKind:amount] [duesPermille] > run.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildingKind } from "../src/content/buildingConfig";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import { chapterDecisionAction } from "../src/engine/autoplayEvents";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { AGENCY_WEEK_TICKS } from "../src/content/townAgencyConfig";
import { auditReceipt, initialAgency, lordRequests } from "../src/engine/townAgency";
import type { EstatePolicy } from "../src/engine/townAgency.types";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { createGrowthOpening } from "./phase21OpeningTranslation";

const YEAR = 4000;

export interface LordModeOptions {
  readonly archetypeId: string;
  readonly seed: number;
  readonly lastYear: number;
  readonly policy: EstatePolicy;
  readonly subsidy?: { readonly kind: BuildingKind; readonly amount: number };
  readonly duesPermille?: number;
}

/** TA-7: the lord's turn before a tick — answers, and (weekly) the town's requests he grants. */
function lordTurn(state: GameState): GameState {
  const answer = chapterDecisionAction(state, "relief", "accept", "pay");
  if (answer !== null) {
    const action = autoplayActionToGameAction(answer, state);
    if (action !== null) return gameReducer(state, action);
  }
  if (state.tick % AGENCY_WEEK_TICKS !== 1) return state;
  const request = lordRequests(state)[0];
  const action = request === undefined ? null : autoplayActionToGameAction(request, state);
  return action === null ? state : gameReducer(state, action);
}

/** TA-9: a fixed-seed sample (the same run gives the same thirty). */
function sampleOf<T>(items: readonly T[], seed: number, count: number): readonly T[] {
  const order = items.map((item, index) => ({ item, key: (Math.imul(index + 1, 2654435761) ^ Math.imul(seed, 40503)) >>> 0 }));
  return order.sort((left, right) => left.key - right.key).slice(0, count).map(entry => entry.item);
}

const levelAtLeast = (state: GameState, level: number) => state.houses.filter(house => house.level >= level && house.residents > 0).length;

export function lordModeRun(options: LordModeOptions) {
  const started = performance.now();
  let state: GameState = { ...(createGrowthOpening(options.seed, options.archetypeId).state as GameState), agency: initialAgency() };
  state = gameReducer(state, { type: "set_estate_policy", policy: options.policy });
  if (options.subsidy !== undefined) state = gameReducer(state, { type: "set_project_subsidy", kind: options.subsidy.kind, amount: options.subsidy.amount });
  if (options.duesPermille !== undefined) state = gameReducer(state, { type: "set_market_dues", permille: options.duesPermille });
  const years: { year: number; population: number; l2: number; l4: number; houses: number; treasury: number; funds: Record<string, number> }[] = [];
  let firstYear = stateCalendar(state).year;
  // TA-9: every receipt audited against the state that entered its week's tick; thirty kept for the report (by hash).
  const audits: { receipt: string; tick: number; actor: string; what: string; planner: string; reasons: string; mismatches: readonly string[] }[] = [];
  let audited = 0, mismatched = 0;
  while (stateCalendar(state).year <= options.lastYear && state.settlement?.outcome !== "abandoned") {
    const before = lordTurn(state);
    state = advanceTick(before);
    const known = before.agency?.nextReceipt ?? 1;
    for (const receipt of (state.agency?.receipts ?? []).filter(entry => Number(entry.id.slice(8)) >= known)) {
      const mismatches = auditReceipt(before, receipt);
      audited += 1;
      if (mismatches.length > 0) mismatched += 1;
      audits.push({ receipt: receipt.id, tick: receipt.tick, actor: receipt.actor, what: receipt.what, planner: receipt.planner,
        reasons: receipt.reasons.map(reason => `${reason.name}${reason.value >= 0 ? "+" : ""}${reason.value}`).join(" "), mismatches });
    }
    if (state.tick % YEAR === 0) {
      years.push({ year: stateCalendar(state).year - 1, population: state.population, l2: levelAtLeast(state, 2), l4: levelAtLeast(state, 4),
        houses: state.houses.length, treasury: treasuryBalance(state),
        funds: Object.fromEntries((state.agency?.actors ?? []).map(actor => [actor.kind, actor.funds])) });
    }
  }
  const kinds: Record<string, number> = {};
  for (const building of state.buildings) kinds[building.kind] = (kinds[building.kind] ?? 0) + 1;
  const receipts = state.agency?.receipts ?? [];
  const byPlanner: Record<string, number> = {};
  for (const receipt of receipts) byPlanner[receipt.planner] = (byPlanner[receipt.planner] ?? 0) + 1;
  return {
    ...options, firstYear, abandoned: state.settlement?.outcome === "abandoned",
    final: { year: stateCalendar(state).year, population: state.population, l2: levelAtLeast(state, 2), l4: levelAtLeast(state, 4),
      houses: state.houses.length, treasury: treasuryBalance(state), kinds,
      housePlots: state.buildings.filter(building => building.kind === "house").map(building => [building.tx, building.ty]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!) },
    receipts: { count: receipts.length, byPlanner, withDecisions: receipts.filter(receipt => receipt.decisionIds.length > 0).length },
    audit: { audited, mismatched, sample: sampleOf(audits, options.seed, 30) },
    years, elapsedSeconds: Math.round((performance.now() - started) / 100) / 10,
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [archetypeId, seed, lastYear, policy, subsidy, dues] = process.argv.slice(2);
  const [kind, amount] = subsidy === undefined || subsidy === "-" ? [] : subsidy.split(":");
  process.stdout.write(`${JSON.stringify(lordModeRun({ archetypeId: archetypeId!, seed: Number(seed), lastYear: Number(lastYear),
    policy: policy as EstatePolicy, ...(kind === undefined ? {} : { subsidy: { kind: kind as BuildingKind, amount: Number(amount) } }),
    ...(dues === undefined ? {} : { duesPermille: Number(dues) }) }), null, 1)}\n`);
}
