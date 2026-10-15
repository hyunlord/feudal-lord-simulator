import { PRESSURE_BALANCE } from "../../../content/balanceConfig";
import { V4_COPY } from "../../../content/registry/v4Copy.generated";
import { stewardReport } from "../../../engine/decisionReads";
import type { GameState } from "../../../engine/engine.types";
import { v4SenderFaction } from "../../../engine/registryV4";
import { calendarLabel } from "../../../engine/scenarioState";
import { stewardshipOf } from "../../../engine/stewardship";
import { lordMode } from "../../../engine/townAgency";
import { HOME_PETITION_COPY } from "../../lordCardsCopy.ko";
import { parties } from "../../lordCardsModel";
import { estateName } from "../treasury/treasuryModel";
import { STEWARD_COPY as COPY } from "./stewardCopy.ko";
import { factionWord, isHomeKind, kindTitle, SENDER_PREFIX, settingWord } from "./stewardWords";

// DEC-CARD-2 (the user's order 2026-10-08, "청지기가 처리한 일"): the season card's steward section, from the engine's
// `stewardReport` over the closed season's window [start, start + season) — how many he handled under which standing
// policy, the money and the factions those answers moved (`policyRelations`, DTR-16), what he brought to the lord and
// why (`brought[].layer`), what lapsed. Each handled matter opens a drill-in: what it was, the policy used, the result,
// and the way to that kind's policy. An off-map estate's answer has no treasury or relations of its own in the report
// (its goodwill and yield are summed in the estate's season summary): the drill-in says so. Lord mode only.

export type StewardItem = Readonly<{
  /** The standing-policy key it was answered under (null: an event whose sender is no one faction). */
  id: string; kind: string | null; summary: string; where: string; what: string; policy: string; results: readonly string[];
}>;
export type StewardSeasonView = Readonly<{
  /** The count line (null when he handled nothing: `none` instead). */
  handled: string | null;
  none: string | null;
  money: string | null;
  relations: readonly string[];
  toleratedLosses: readonly string[];
  items: readonly StewardItem[];
  brought: readonly string[];
  lapsed: string | null;
}>;

const SEASON = PRESSURE_BALANCE.seasonTicks;
const dateAt = (state: GameState, tick: number) => calendarLabel({ ...state, tick });

/** Why the steward brought a matter: a petition's exception (`amount`·`rights`·`marriage`·`direct`), an event's weights. */
function why(layer: string): string {
  if (Object.hasOwn(COPY.why, layer)) return COPY.why[layer as keyof typeof COPY.why];
  const weights = layer.split(",").map(weight => Object.hasOwn(COPY.weights, weight) ? COPY.weights[weight as keyof typeof COPY.weights] : weight);
  return COPY.weighed(weights);
}

function petitionItems(state: GameState, report: ReturnType<typeof stewardReport>): StewardItem[] {
  const petitions = stewardshipOf(state).petitions;
  return report.handled.map(entry => {
    const petition = petitions.find(candidate => candidate.id === entry.petitionId);
    const policy = settingWord(entry.policy);
    const home = isHomeKind(entry.kind) ? HOME_PETITION_COPY[entry.kind] : null;
    const named = parties(state, petition ?? {});
    const answer = home === null ? (entry.granted ? COPY.grants : COPY.refuses) : entry.granted ? home.grant(named) : home.refuse(named);
    const results = entry.treasury === null ? [COPY.offMapResult] : [COPY.itemTreasury(entry.treasury),
      COPY.itemRelations(Object.entries(entry.relations).filter(([, delta]) => delta !== 0).map(([id, delta]) => COPY.relationMove(factionWord(state, id), delta)))];
    return { id: entry.petitionId, kind: entry.kind, summary: COPY.item(kindTitle(state, entry.kind), policy, entry.granted ? COPY.granted : COPY.refused),
      where: COPY.itemWhere(dateAt(state, entry.tick), estateName(state, entry.estateId)),
      what: home === null ? kindTitle(state, entry.kind) : home.demand(entry.amount, named), policy: COPY.itemPolicy(policy, answer), results };
  });
}

function eventItems(state: GameState, report: ReturnType<typeof stewardReport>): StewardItem[] {
  return report.events.map(event => {
    const copy = V4_COPY[event.entryId];
    const choice = event.choiceId === null ? undefined : copy?.choices[event.choiceId];
    const policy = settingWord(event.policy);
    // The sender's mind on the side taken (the engine's `side`); the rest of the answer's effects are the chronicle's.
    const side = event.side === undefined || event.side.delta === 0 ? [] : [COPY.itemRelations([COPY.relationMove(factionWord(state, event.side.faction), event.side.delta)])];
    const sender = v4SenderFaction(event.entryId);
    return { id: event.occurrenceId, kind: sender === undefined ? null : `${SENDER_PREFIX}${sender}`,
      summary: COPY.item(copy?.title ?? event.entryId, policy, choice?.label ?? COPY.eventNoAnswer),
      where: dateAt(state, event.tick), what: copy?.body ?? event.entryId,
      policy: COPY.itemPolicy(policy, choice === undefined ? COPY.eventNoAnswer : COPY.eventAnswer(choice.label)),
      results: [...side, choice?.chronicle ?? COPY.eventResult] };
  });
}

/** The closed season's steward section (lord mode only, else null), `start` the season's first tick. */
export function seasonStewardView(state: GameState, start: number): StewardSeasonView | null {
  if (!lordMode(state)) return null;
  const report = stewardReport(state, start, start + SEASON);
  const auditItems: StewardItem[] = report.audits.map(audit => ({ id: audit.id,
    kind: audit.policyAuditId === undefined ? null : `audit:${audit.estateId}:${audit.stewardId}`,
    summary: COPY.auditReport(estateName(state, audit.estateId), audit.revealedKept + audit.revealedErrors),
    where: COPY.itemWhere(dateAt(state, audit.tick), estateName(state, audit.estateId)), what: COPY.auditHandled,
    policy: audit.policyAuditId === undefined ? COPY.precedent : COPY.auditActive, results: [COPY.offMapResult] }));
  const items = [...petitionItems(state, report), ...eventItems(state, report), ...auditItems];
  const counts = new Map<string, number>();
  for (const policy of [...report.handled.map(entry => entry.policy), ...report.events.map(event => event.policy)]) counts.set(policy, (counts.get(policy) ?? 0) + 1);
  if (auditItems.length > 0) counts.set(COPY.auditHandled, auditItems.length);
  const known = report.handled.filter(entry => entry.treasury !== null);
  const titles = new Map(stewardshipOf(state).petitions.map(petition => [petition.id, kindTitle(state, petition.kind)]));
  return {
    handled: items.length === 0 ? null : COPY.handledCount(items.length, [...counts].map(([policy, count]) => COPY.policyCount(settingWord(policy), count))),
    none: items.length === 0 ? COPY.none : null,
    money: known.length === 0 ? null : COPY.money(known.reduce((sum, entry) => sum + (entry.treasury ?? 0), 0)),
    toleratedLosses: report.toleratedLosses.map(loss => COPY.auditLoss(estateName(state, loss.estateId), loss.amount)),
    relations: report.policyRelations.map(move => COPY.policyRelation(settingWord(move.policy), factionWord(state, move.faction), move.delta)),
    items,
    brought: report.brought.map(entry => COPY.brought(titles.get(entry.subjectId) ?? V4_COPY[entry.kind]?.title ?? kindTitle(state, entry.kind), why(entry.layer))),
    lapsed: report.lapsed === 0 ? null : COPY.lapsed(report.lapsed),
  };
}
