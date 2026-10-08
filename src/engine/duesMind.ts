/**
 * DUES-REL (decision DTR-18; the user's instruction 2026-10-08): the merchant houses' mind follows the stall fee as it
 * stands. Lord mode only.
 * - A registry answer that sets the fee is an agreement with its sender, binding ten years (`agency.duesAgreement`).
 * - Each season the houses sour by a point per 100‰ the fee stands above the agreed rate (or, without an agreement, the
 *   custom), at most three, down to −40; below it they warm the same way, up to +30. The record names the decision that
 *   set the fee standing (`because`).
 * - The lord who raises the fee above an agreement of his own breaks it: the house it was made with −15, the other −5,
 *   once, with the agreement behind it ("○○년 합의를 어겨서"); the agreement ends.
 * The fee's command itself moves no mind (the old −5 a change, DTR-3, is gone): adjusting it costs only while it stands.
 */
import { DUES_FACTIONS, DUES_MIND } from "../content/duesMindConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import type { GameState } from "./engine.types";
import type { HistoryBecause } from "./history.types";
import type { DuesAgreement } from "./townAgency.types";
import { stateCalendar } from "./scenarioState";

const SEASON = PRESSURE_BALANCE.seasonTicks;

/** The agreement in force: made, not broken, within its years (null otherwise). */
export function activeDuesAgreement(state: Pick<GameState, "agency" | "tick">): DuesAgreement | null {
  const agreement = state.agency?.duesAgreement;
  if (agreement === undefined || agreement.brokenTick !== undefined || state.tick - agreement.tick >= DUES_MIND.agreementTicks) return null;
  return agreement;
}

/** The rate the houses measure the fee against: the agreed one, else the custom. */
export function duesReference(state: Pick<GameState, "agency" | "tick">): number {
  return activeDuesAgreement(state)?.permille ?? DUES_MIND.customPermille;
}

/** A registry answer changed the fee: the agreement it makes with the sender (or the state as it was). */
export function agreeDues(before: GameState, after: GameState, faction: string, occurrenceId: string): GameState {
  const agency = after.agency;
  if (agency === undefined || before.agency === undefined || agency.duesPermille === before.agency.duesPermille) return after;
  return { ...after, agency: { ...agency, duesAgreement: { permille: agency.duesPermille, tick: after.tick, faction, occurrenceId } } };
}

/** The lord's own fee: above the agreement in force, it breaks it (the agreement keeps the tick it was broken). */
export function breakDuesAgreement(state: GameState, permille: number): GameState {
  const agreement = activeDuesAgreement(state);
  if (agreement === null || permille <= agreement.permille || state.agency === undefined) return state;
  return { ...state, agency: { ...state.agency, duesAgreement: { ...agreement, brokenTick: state.tick } } };
}

type Draft = {
  readonly tick: number; readonly kind: "faction"; readonly template: "faction.relation"; readonly subject: { readonly type: "faction"; readonly id: string };
  readonly severity: 1; readonly params: Readonly<Record<string, string | number>>; readonly because?: readonly HistoryBecause[];
};

function draft(state: GameState, factionId: string, delta: number, reason: string, because: readonly HistoryBecause[]): Draft[] {
  const faction = state.factions?.factions.find(entry => entry.id === factionId);
  if (faction === undefined || delta === 0) return [];
  return [{ tick: state.tick, kind: "faction", template: "faction.relation", subject: { type: "faction", id: faction.id }, severity: 1,
    params: { faction: faction.id, name: faction.name, delta, reason, relation: Math.max(-100, Math.min(100, faction.relation + delta)) },
    ...(because.length === 0 ? {} : { because }) }];
}

/** The decision that set the fee standing (the latest the thread still holds), or none (the custom from the start). */
function feeDecision(state: GameState): string | undefined {
  return [...(state.trace?.decisions ?? [])].reverse().find(decision => decision.targets.includes("dues"))?.id;
}

/** The fee as it stands: the reference it is measured against and each house's turn a season (before the floor and ceiling). */
export function duesSeasonStep(state: Pick<GameState, "agency" | "tick">): { readonly reference: number; readonly perSeason: number } {
  const reference = duesReference(state);
  const diff = (state.agency?.duesPermille ?? reference) - reference;
  const steps = Math.min(DUES_MIND.seasonCap, Math.round(Math.abs(diff) / DUES_MIND.stepPermille));
  return { reference, perSeason: diff > 0 ? -steps : steps };
}

/** The season's turn: the houses' mind on the fee as it stands (lord mode; nothing between the seasons' first ticks). */
export function duesSeasonDrafts(state: GameState): Draft[] {
  if (state.agency === undefined || state.tick <= 0 || state.tick % SEASON !== 0) return [];
  const { reference, perSeason } = duesSeasonStep(state);
  const steps = Math.abs(perSeason);
  const diff = -perSeason;
  if (steps === 0) return [];
  const decisionId = feeDecision(state);
  const because: HistoryBecause[] = decisionId === undefined ? [] : [{ decisionId, key: "dues_held" }];
  const drafts: Draft[] = [];
  for (const id of DUES_FACTIONS) {
    const relation = state.factions?.factions.find(faction => faction.id === id)?.relation;
    if (relation === undefined) continue;
    const delta = diff > 0 ? Math.max(-steps, Math.min(0, DUES_MIND.floor - relation)) : Math.min(steps, Math.max(0, DUES_MIND.ceiling - relation));
    drafts.push(...draft(state, id, delta, `dues_held:${state.agency.duesPermille}:${reference}`, because));
  }
  return drafts;
}

/** The lord broke an agreement on this command (its `brokenTick` is now): the houses' one sharp turn, the agreement behind it. */
export function duesBreachDrafts(before: GameState, after: GameState): Draft[] {
  const was = activeDuesAgreement(before);
  const now = after.agency?.duesAgreement;
  if (was === null || now === undefined || now.brokenTick !== after.tick) return [];
  // The agreement's own decision: the registry answer the thread kept at its tick.
  const agreed = (after.trace?.decisions ?? []).find(decision => decision.tick === was.tick && decision.targets.includes("dues") && decision.source.startsWith("registry:"));
  const because: HistoryBecause[] = agreed === undefined ? [] : [{ decisionId: agreed.id, key: "agreement_broken" }];
  const reason = `agreement_broken:${stateCalendar({ ...after, tick: was.tick }).year}`;
  return DUES_FACTIONS.flatMap(id => draft(after, id, id === was.faction ? DUES_MIND.breachParty : DUES_MIND.breachOther, reason, because));
}
