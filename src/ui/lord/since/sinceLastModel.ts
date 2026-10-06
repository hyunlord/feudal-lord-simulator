import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../../content/buildingConfig";
import { V4_COPY } from "../../../content/registry/v4Copy.generated";
import type { GameState } from "../../../engine/engine.types";
import type { HistoryRecord } from "../../../engine/history.types";
import { registryOf } from "../../../engine/registry";
import type { RegistryOccurrence } from "../../../engine/registry.types";
import { v4Entry, type V4Entry } from "../../../engine/registryV4";
import { calendarLabel } from "../../../engine/scenarioState";
import { initialAgency, lordMode } from "../../../engine/townAgency";
import type { EstatePolicy, ReasonName } from "../../../engine/townAgency.types";
import type { LedgerEntry } from "../../../ledger/ledger.types";
import { moneyFull } from "../../money.ko";
import { POLICY_COPY } from "../policyCopy.ko";
import { lordChoiceLabel } from "../policyModel";
import { RECEIPT_COPY } from "../receiptCopy.ko";
import { SINCE_LAST_COPY as COPY } from "./sinceLastCopy.ko";

// DEC-CARD A4 (Astra's lord-mode play): a recurring card — the market dues, the estate policy, a subsidy — says what
// came of the lord's last answer of the same kind before he answers again. "The same kind" is what the card sets (its
// choices' commands): the last registry offer answered whose entry sets the same, or the same condition set on the
// lord tab (its decision record). Then, all read from the engine as it stands:
// - the rate: the one that answer set (the decision's `chosen`, or the choice's own argument) and the one now;
// - the stalls and the dues: the ledger's stall-fee settlement before that answer and the latest after it (each
//   settlement's lines name their market's stalls, `stalls:N`); the ledger keeps about three and a half years;
// - the town's projects started since whose score the condition entered (the receipts' named reasons, TA-4);
// - for a decision on the lord tab, the engine's own forecast and actual two seasons on (HL-3).
// The open card's own occurrence is not its own "last time". Lord mode only; built while the card is up.

type Kind = "market_dues" | "estate_policy" | "project_subsidy";
const COMMAND_KIND: Readonly<Record<string, Kind>> = { set_market_dues: "market_dues", set_estate_policy: "estate_policy", set_project_subsidy: "project_subsidy" };
const KIND_ORDER: readonly Kind[] = ["market_dues", "estate_policy", "project_subsidy"];
/** The receipts' reason a condition enters (TA-4's names). */
const REASON: Readonly<Record<Kind, ReasonName>> = { market_dues: "dues", estate_policy: "policy", project_subsidy: "subsidy" };

export type SinceLastView = Readonly<{ heading: string; lines: readonly string[] }>;

/** The kind a card sets (the first of its choices' conditions), or null for a card that sets none of them. */
function kindOf(entry: V4Entry): Kind | null {
  const kinds = new Set(entry.choices.flatMap(choice => choice.commands.map(command => COMMAND_KIND[command.type]).filter((kind): kind is Kind => kind !== undefined)));
  return KIND_ORDER.find(kind => kinds.has(kind)) ?? null;
}

const when = (state: GameState, tick: number): string => calendarLabel({ ...state, tick });

type Last = Readonly<{ tick: number; what: string; rate: number | null; decision: HistoryRecord | null }>;

/** The rate a registry answer set: its choice's dues argument (a number, or a bound value the occurrence kept). */
function answeredRate(occurrence: RegistryOccurrence, entry: V4Entry): number | null {
  const command = entry.choices.find(choice => choice.id === occurrence.choiceId)?.commands.find(entry => entry.type === "set_market_dues");
  const value = command?.args?.permille;
  if (typeof value === "number") return value;
  const binding = typeof value === "object" && value !== null && "binding" in value ? String((value as { binding: unknown }).binding) : null;
  const bound = binding?.startsWith("bound.") === true ? Number(occurrence.bound?.[binding.slice("bound.".length)]) : NaN;
  return Number.isFinite(bound) ? bound : null;
}

function lastAnswer(state: GameState, kind: Kind, openId: string): Last | null {
  const answers: Last[] = registryOf(state).occurrences.flatMap(occurrence => {
    if (occurrence.id === openId || occurrence.status !== "answered" || occurrence.settledTick === undefined) return [];
    const entry = v4Entry(occurrence.entryId);
    if (entry === undefined || kindOf(entry) !== kind) return [];
    const choice = entry.choices.find(candidate => candidate.id === occurrence.choiceId);
    const label = V4_COPY[entry.id]?.choices[occurrence.choiceId ?? ""]?.label ?? COPY.held;
    return [{ tick: occurrence.settledTick, what: choice?.commands.length === 0 ? COPY.held : label, rate: kind === "market_dues" ? answeredRate(occurrence, entry) : null, decision: null }];
  });
  const decisions: Last[] = (state.history?.records ?? []).filter(record => record.kind === "decision" && record.params?.decisionKind === kind).map(record => {
    const chosen = String(record.params?.chosen ?? record.decision?.chosen ?? "");
    return { tick: record.tick, what: COPY.onTab(lordChoiceLabel(kind, chosen) ?? chosen), rate: kind === "market_dues" && Number.isFinite(Number(chosen)) ? Number(chosen) : null, decision: record };
  });
  return [...answers, ...decisions].sort((left, right) => right.tick - left.tick)[0] ?? null;
}

/** One stall-fee settlement: the lines posted at one tick, their stalls (from `stalls:N`) and their sum. */
type Settlement = Readonly<{ tick: number; stalls: number; amount: number }>;
function settlements(state: GameState): readonly Settlement[] {
  const byTick = new Map<number, { stalls: number; amount: number }>();
  for (const entry of state.ledger?.entries ?? [] as readonly LedgerEntry[]) {
    if (entry.account !== "cash" || entry.category !== "stall_fee") continue;
    const detail = entry.sourceRefs.map(source => source.detail ?? "").find(text => text.startsWith("stalls:"));
    const was = byTick.get(entry.tick) ?? { stalls: 0, amount: 0 };
    byTick.set(entry.tick, { stalls: was.stalls + (detail === undefined ? 0 : Number(detail.slice("stalls:".length)) || 0), amount: was.amount + entry.amount });
  }
  return [...byTick].map(([tick, sums]) => ({ tick, ...sums })).sort((left, right) => left.tick - right.tick);
}

function duesLines(state: GameState, last: Last): readonly string[] {
  const now = state.agency?.duesPermille ?? initialAgency().duesPermille;
  const lines = [last.rate === null ? COPY.dues.rateNow(now) : COPY.dues.rate(last.rate, now)];
  const all = settlements(state);
  const before = [...all].reverse().find(entry => entry.tick <= last.tick);
  const after = all.at(-1);
  if (after === undefined) lines.push(COPY.dues.noSettlement);
  else if (after.tick <= last.tick) lines.push(COPY.dues.noSettlementSince);
  else if (before === undefined) lines.push(COPY.dues.folded);
  else lines.push(COPY.dues.stalls(before.stalls, after.stalls), COPY.dues.income(before.amount, after.amount));
  return lines;
}

function conditionLines(state: GameState, kind: Kind): readonly string[] {
  const agency = state.agency;
  if (agency === undefined) return [];
  if (kind === "estate_policy") return [COPY.policy.now(POLICY_COPY.policies[agency.policy as EstatePolicy])];
  if (kind === "project_subsidy") return [agency.subsidies.length === 0 ? COPY.subsidy.none
    : COPY.subsidy.now(agency.subsidies.map(entry => POLICY_COPY.subsidyRow(BUILDING_CONFIG_BY_KIND[entry.kind].name, moneyFull(entry.amount))).join(", "))];
  return [];
}

/** The town's projects started since the answer whose score the condition entered, counted by kind. */
function startedLine(state: GameState, kind: Kind, since: number): string {
  const reason = RECEIPT_COPY.reasons[REASON[kind]];
  const counts = new Map<string, number>();
  for (const receipt of state.agency?.receipts ?? []) {
    if (receipt.tick <= since || !receipt.reasons.some(entry => entry.name === REASON[kind] && entry.value !== 0)) continue;
    const name = receipt.what in BUILDING_CONFIG_BY_KIND ? BUILDING_CONFIG_BY_KIND[receipt.what as BuildingKind].name : null;
    if (name !== null) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts.size === 0 ? COPY.startedNone(reason) : COPY.started(reason, [...counts].map(([name, count]) => COPY.count(name, count)).join(" · "));
}

function actualLine(state: GameState, record: HistoryRecord | null): string | null {
  const decision = record?.decision;
  if (decision === undefined) return null;
  const predicted = decision.predicted.treasury;
  const actual = decision.actual?.treasury;
  if (predicted !== undefined && actual !== undefined) return COPY.actual(predicted, actual);
  return decision.actualDueTick === undefined || decision.actualDueTick <= state.tick ? null : COPY.actualDue(when(state, decision.actualDueTick));
}

/** What came of the lord's last answer of the card's kind, or null (not lord mode, a card of no such kind, or a first time). */
export function sinceLastAnswer(state: GameState, entryId: string, occurrenceId: string): SinceLastView | null {
  const entry = v4Entry(entryId);
  if (!lordMode(state) || entry === undefined) return null;
  const kind = kindOf(entry);
  if (kind === null) return null;
  const last = lastAnswer(state, kind, occurrenceId);
  if (last === null) return null;
  const actual = actualLine(state, last.decision);
  return { heading: COPY.heading, lines: [COPY.answered(when(state, last.tick), last.what),
    ...(kind === "market_dues" ? duesLines(state, last) : conditionLines(state, kind)), startedLine(state, kind, last.tick), ...(actual === null ? [] : [actual])] };
}
