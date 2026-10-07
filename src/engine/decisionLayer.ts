/**
 * DEC-TRACE §1 (docs/design/dec-trace.md, P-D5, decision GP-7): the layers of decision in lord mode. A matter is heavy
 * when one of its choices carries a weight (rights, land, marriage, inheritance, wardship, a large sum, a promise of
 * years, a faction's rupture, a crisis); heavy matters come to the lord, the rest are the steward's, answered by the
 * lord's standing policy for their kind (`StandingSetting`). What a choice does is measured by running it on a copy of
 * the state (P-D4: the engine's own values, not a guess).
 */
import {
  COMMAND_WEIGHT, DECISION_WEIGHT_BALANCE, DEFAULT_STANDING_SETTING, type DecisionWeight, type StandingSetting,
} from "../content/stewardPolicyConfig";
import { BALANCE } from "../content/balanceConfig";
import { TIMBER_TRADE_BALANCE } from "../content/timberTradeConfig";
import type { GameState } from "./engine.types";
import { estateYearIncome } from "./negotiation";
import type { RegistryOccurrence } from "./registry.types";
import { applyHold, bindEntry, runCommands, v4EnabledChoices, v4Entry, v4SenderFaction } from "./registryV4";
import { stewardshipOf } from "./stewardship";

/** The user's decision (2026-10-06): a tenth of the estate's year of income, a pound at least. */
export function largeSumLine(state: GameState): number {
  return Math.max(DECISION_WEIGHT_BALANCE.largeSumFloor, Math.ceil(estateYearIncome(state) * DECISION_WEIGHT_BALANCE.largeSumPermille / 1000));
}

/** The lord's standing policy for a kind of small matter (a home petition's kind, or `sender:<faction>` for an event). */
export function standingSetting(state: Pick<GameState, "stewardship">, key: string): StandingSetting {
  return stewardshipOf(state).standing?.[key] ?? DEFAULT_STANDING_SETTING;
}

/** What one choice of an offer does, measured on a copy. */
export interface ChoiceWeighing {
  readonly id: string;
  readonly commands: readonly string[];
  /** Pennies the choice commits from the lord's purse (subsidies, a timber order at its dearest, dues forgone for a year, paid now). */
  readonly spend: number;
  /** Pennies of it the treasury pays now (absent: none). */
  readonly paid?: number;
  /** The sender's relation change (a hold's cost). */
  readonly senderDelta: number;
  readonly weights: readonly DecisionWeight[];
}

const subsidyTotal = (state: GameState) => (state.agency?.subsidies ?? []).reduce((sum, subsidy) => sum + subsidy.amount, 0);
const STALL_INCOME = "stall_fee";

function stallYearIncome(state: GameState): number {
  const from = state.tick - BALANCE.TICKS_PER_YEAR;
  return (state.ledger?.entries ?? []).filter(entry => entry.tick > from && entry.amount > 0 && entry.category === STALL_INCOME).reduce((sum, entry) => sum + entry.amount, 0);
}

/** What a choice commits, from the state before and after it (on a copy). */
function spendOf(before: GameState, after: GameState): { readonly spend: number; readonly paid: number } {
  const subsidies = subsidyTotal(after) - subsidyTotal(before);
  const timber = ((after.timberOrder ?? 0) - (before.timberOrder ?? 0)) * Math.max(TIMBER_TRADE_BALANCE.price, TIMBER_TRADE_BALANCE.hamletPrice);
  const dues = Math.round(((before.agency?.duesPermille ?? 1000) - (after.agency?.duesPermille ?? 1000)) * stallYearIncome(before) / 1000);
  const paid = before.treasuryCoin - after.treasuryCoin;
  return { spend: subsidies + timber + dues + paid, paid };
}

/**
 * DEC-TRACE §1: an offer's choices weighed — each enabled choice run on a copy (or its hold's cost taken), its weights
 * from its commands, its sum against the large-sum line, a hold's cost against the rupture line. Null when the offer's
 * entry or targets are gone.
 */
export function weighOffer(state: GameState, occurrence: RegistryOccurrence): { readonly weights: readonly DecisionWeight[]; readonly choices: readonly ChoiceWeighing[] } | null {
  const entry = occurrence.source === "v4" ? v4Entry(occurrence.entryId) : undefined;
  const bound = entry === undefined ? null : bindEntry(state, entry, occurrence.bound);
  if (entry === undefined || bound === null) return null;
  const line = largeSumLine(state);
  const sender = v4SenderFaction(entry.id);
  const relation = state.factions?.factions.find(faction => faction.id === sender)?.relation ?? 0;
  const choices: ChoiceWeighing[] = [];
  for (const id of v4EnabledChoices(state, entry, bound)) {
    const choice = entry.choices.find(candidate => candidate.id === id)!;
    const weights = new Set<DecisionWeight>();
    for (const command of choice.commands) {
      const weight = COMMAND_WEIGHT[command.type];
      if (weight !== undefined) weights.add(weight);
    }
    let spend = 0;
    let paid = 0;
    let senderDelta = 0;
    if (choice.commands.length === 0) {
      const held = applyHold(state, entry, bound);
      senderDelta = held?.hold.faction === sender ? held?.hold.delta ?? 0 : 0;
    } else {
      const after = runCommands(state, choice.commands, { state, bound, vars: {} });
      if (after !== null) ({ spend, paid } = spendOf(state, after));
    }
    if (Math.abs(spend) >= line) weights.add("large_sum");
    if (senderDelta < 0 && relation + senderDelta <= DECISION_WEIGHT_BALANCE.ruptureRelation) weights.add("faction_rupture");
    choices.push({ id, commands: choice.commands.map(command => command.type), spend, ...(paid > 0 ? { paid } : {}), senderDelta, weights: [...weights].sort() });
  }
  const weights = [...new Set(choices.flatMap(choice => choice.weights))].sort();
  return { weights, choices };
}

/**
 * DEC-TRACE §1: the choice the steward takes under a stance — lightly: the most given (the petitioner's side); strictly:
 * the least given (the purse's side); as custom has it: the least change. A steward does not put a matter off (a hold
 * only costs): he holds only when no other choice is open; nor does he pay more than the treasury holds (FIX-14's rule).
 * Ties go to the canon's order. Null for "bring it to me".
 */
export function stewardPick(setting: StandingSetting, choices: readonly ChoiceWeighing[], treasury = Infinity): string | null {
  if (setting === "lord" || choices.length === 0) return null;
  const payable = choices.filter(choice => (choice.paid ?? 0) <= treasury);
  const acting = payable.filter(choice => choice.commands.length > 0);
  const pool = acting.length > 0 ? acting : payable.length > 0 ? payable : choices;
  const order = (pick: (left: ChoiceWeighing, right: ChoiceWeighing) => number) => [...pool].sort((left, right) => pick(left, right) || pool.indexOf(left) - pool.indexOf(right))[0]!.id;
  if (setting === "lenient") return order((left, right) => right.spend - left.spend);
  if (setting === "strict") return order((left, right) => left.spend - right.spend);
  return order((left, right) => Math.abs(left.spend) - Math.abs(right.spend) || left.commands.length - right.commands.length);
}
