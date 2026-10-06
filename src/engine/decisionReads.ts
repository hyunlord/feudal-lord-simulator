/**
 * DEC-TRACE §2–§4 read models (docs/design/dec-trace.md; the render request docs/requests/engine-deccard-gp7.md §2–§5).
 * What the screens read of the thread: the consequences in a span ("in 13xx, because of your decision"), the year's
 * review, who remembers a decision, the standing policies with what each setting does, and the steward's report. They
 * read the state only (the rules never read them). Lord mode.
 */
import { HOME_PETITION_CUSTOM, STANDING_SETTINGS, type StandingSetting } from "../content/stewardPolicyConfig";
import { HOME_PETITION_KINDS, PETITION_KINDS } from "../content/stewardshipConfig";
import { HOME_ESTATE_ID } from "../content/estateConfig";
import { V4_SENDER_FACTION } from "../content/registry/registryHoldCopy.ko";
import { BALANCE } from "../content/balanceConfig";
import { standingSetting } from "./decisionLayer";
import { v4SenderFaction } from "./registryV4";
import { traceOf } from "./decisionTrace";
import type { GameState } from "./engine.types";
import type { HistoryRecord } from "./history.types";
import { scenarioOf } from "./scenarioState";
import type { EstatePetitionKind, HomePetitionKind } from "./stewardship.types";

const YEAR = BALANCE.TICKS_PER_YEAR;

/** One line of what followed a decision. */
export interface TraceRow {
  readonly recordId: string;
  readonly tick: number;
  /** What followed (`ConsequenceKey`, or `relation` for a faction's mind moved by the decision itself). */
  readonly key: string;
  /** The faction (or "town") it fell on. */
  readonly actor: string;
  /** A count or a sum when it has one (a relation's change, households, pennies). */
  readonly delta: number | null;
  /** One cause among others (P-C2). */
  readonly part: boolean;
  readonly decisionId: string;
  /** The decision's own tick (null when its record is gone). */
  readonly decisionTick: number | null;
}

const recordById = (state: GameState) => new Map((state.history?.records ?? []).map(record => [record.id, record] as const));

function rowDelta(record: HistoryRecord): number | null {
  const params = record.params ?? {};
  for (const key of ["households", "money", "income", "brought", "revealed"]) if (typeof params[key] === "number") return params[key] as number;
  return null;
}

/**
 * DEC-TRACE §2 API (`traceInRange`): what followed decisions in [from, to) — the history's records with the decisions
 * behind them, and the factions' minds the decisions moved at once (their memories) — in time order.
 */
export function traceInRange(state: GameState, fromTick: number, toTick: number): readonly TraceRow[] {
  const records = recordById(state);
  const rows: TraceRow[] = [];
  for (const record of state.history?.records ?? []) {
    if (record.tick < fromTick || record.tick >= toTick || record.because === undefined) continue;
    const actor = record.subject.type === "faction" ? record.subject.id : String(record.params?.faction ?? "town");
    for (const because of record.because) {
      rows.push({ recordId: record.id, tick: record.tick, key: because.key, actor, delta: rowDelta(record), part: because.part === true,
        decisionId: because.decisionId, decisionTick: records.get(because.decisionId)?.tick ?? null });
    }
  }
  for (const faction of state.factions?.factions ?? []) {
    for (const memory of faction.memory) {
      if (memory.decisionId === undefined || memory.tick < fromTick || memory.tick >= toTick) continue;
      rows.push({ recordId: memory.recordId, tick: memory.tick, key: "relation", actor: faction.id, delta: memory.delta, part: false,
        decisionId: memory.decisionId, decisionTick: records.get(memory.decisionId)?.tick ?? null });
    }
  }
  return rows.sort((left, right) => left.tick - right.tick || (left.recordId < right.recordId ? -1 : 1));
}

/** DEC-TRACE §2 API (`decisionRemembers`): who remembers a decision — the factions whose minds it moved, and by how much. */
export function decisionRemembers(state: GameState, decisionId: string): readonly { readonly actor: string; readonly delta: number; readonly tick: number; readonly recordId: string }[] {
  return (state.factions?.factions ?? []).flatMap(faction => faction.memory.filter(memory => memory.decisionId === decisionId)
    .map(memory => ({ actor: faction.id, delta: memory.delta, tick: memory.tick, recordId: memory.recordId })));
}

export interface YearDecision {
  readonly decisionId: string;
  readonly tick: number;
  readonly kind: string;
  readonly by: "lord" | "steward";
  readonly subjectId: string;
  readonly chosen: string;
  /** P-D5: the weights that brought it to the lord (empty for the steward's and the lord's small settings). */
  readonly weights: readonly string[];
  readonly predicted: Readonly<Record<string, number>>;
  readonly actual: Readonly<Record<string, number>> | null;
  readonly actualDueTick: number | null;
}

/**
 * DEC-TRACE §4 API (`yearReview`): "what your decisions changed this year" — the year's decisions (the lord's and the
 * steward's, the lapsed), and what followed in the year from the decisions of this year and the years before.
 */
export function yearReview(state: GameState, year: number): { readonly decisions: readonly YearDecision[]; readonly consequences: readonly TraceRow[] } {
  const from = (year - scenarioOf(state).startYear) * YEAR;
  const to = from + YEAR;
  const traced = new Map(traceOf(state).decisions.map(decision => [decision.id, decision] as const));
  const decisions = (state.history?.records ?? []).filter(record => record.kind === "decision" && record.tick >= from && record.tick < to && traced.has(record.id))
    .map(record => {
      const decision = traced.get(record.id)!;
      return { decisionId: record.id, tick: record.tick, kind: decision.kind, by: decision.by, subjectId: String(record.params?.subjectId ?? record.params?.defId ?? ""),
        chosen: record.decision?.chosen ?? String(record.params?.chosen ?? ""), weights: decision.weights, predicted: record.decision?.predicted ?? {},
        actual: record.decision?.actual ?? null, actualDueTick: record.decision?.actualDueTick ?? null };
    });
  return { decisions, consequences: traceInRange(state, from, to) };
}

/** What one setting does to a kind of small matter (the steward's answer, the treasury, the factions). */
export interface SettingAnswer {
  /** Granted (true), refused (false), or by the steward's disposition / the event's choices (null). */
  readonly granted: boolean | null;
  /** −1 the pennies go out, 0 nothing, 1 they come in (null when it varies). */
  readonly treasury: -1 | 0 | 1 | null;
  readonly factions: Readonly<Record<string, number>>;
}

export interface StandingPolicyView {
  readonly kind: string;
  readonly family: "manor" | "estate" | "event";
  /** P-D5: a kind always the lord's whatever the setting (none of the small kinds is). */
  readonly heavy: boolean;
  readonly heavyBecause: string | null;
  readonly setting: StandingSetting;
  readonly answers: Readonly<Record<Exclude<StandingSetting, "lord">, SettingAnswer>>;
  readonly handledThisYear: number;
  readonly last: { readonly tick: number; readonly granted: boolean | null } | null;
}

/**
 * DEC-TRACE §1 API (`standingPolicies`): each kind of small matter with its setting and what each setting does — the home
 * petitions (by the manor's table and custom), the off-map estates' petitions (customary: the steward's disposition), and
 * the events by their sender (lightly: the most given, strictly: the least, customary: the least change).
 */
export function standingPolicies(state: GameState): readonly StandingPolicyView[] {
  const yearFrom = state.tick - (state.tick % YEAR);
  const petitions = state.stewardship?.petitions ?? [];
  const views: StandingPolicyView[] = [];
  const lastOf = (match: (petition: (typeof petitions)[number]) => boolean) => {
    const handled = petitions.filter(petition => petition.decidedBy === "steward" && match(petition));
    const last = handled.at(-1);
    return { handledThisYear: handled.filter(petition => petition.tick >= yearFrom).length, last: last === undefined ? null : { tick: last.tick, granted: last.status === "granted" } };
  };
  for (const kind of Object.keys(HOME_PETITION_KINDS) as HomePetitionKind[]) {
    const def = HOME_PETITION_KINDS[kind];
    const answer = (granted: boolean): SettingAnswer => ({ granted, treasury: granted ? def.grant.income : def.refuse.income, factions: granted ? def.grant.factions : def.refuse.factions });
    views.push({ kind, family: "manor", heavy: false, heavyBecause: null, setting: standingSetting(state, kind),
      answers: { customary: answer(HOME_PETITION_CUSTOM[kind]), lenient: answer(true), strict: answer(false) },
      ...lastOf(petition => petition.estateId === HOME_ESTATE_ID && petition.kind === kind) });
  }
  for (const kind of Object.keys(PETITION_KINDS) as EstatePetitionKind[]) {
    const fixed = (granted: boolean | null): SettingAnswer => ({ granted, treasury: null, factions: {} });
    views.push({ kind, family: "estate", heavy: false, heavyBecause: null, setting: standingSetting(state, kind),
      answers: { customary: fixed(null), lenient: fixed(true), strict: fixed(false) }, ...lastOf(petition => petition.estateId !== HOME_ESTATE_ID && petition.kind === kind) });
  }
  const occurrences = state.registry?.occurrences ?? [];
  for (const faction of [...new Set(Object.values(V4_SENDER_FACTION))].sort()) {
    const key = `sender:${faction}`;
    const mine = occurrences.filter(occurrence => occurrence.decidedBy === "steward" && v4SenderFaction(occurrence.entryId) === faction);
    const vary: SettingAnswer = { granted: null, treasury: null, factions: {} };
    const last = mine.at(-1);
    views.push({ kind: key, family: "event", heavy: false, heavyBecause: null, setting: standingSetting(state, key),
      answers: { customary: vary, lenient: { ...vary, factions: { [faction]: 1 } }, strict: { ...vary, factions: { [faction]: -1 } } },
      handledThisYear: mine.filter(occurrence => occurrence.offeredTick >= yearFrom).length, last: last === undefined ? null : { tick: last.offeredTick, granted: null } });
  }
  return views;
}

/** DEC-TRACE §1 API (`stewardReport`): what the steward handled in [from, to), what he brought to the lord and why, what lapsed. */
export function stewardReport(state: GameState, fromTick: number, toTick: number) {
  const petitions = (state.stewardship?.petitions ?? []).filter(petition => petition.tick >= fromTick && petition.tick < toTick);
  const handled = petitions.filter(petition => petition.decidedBy === "steward").map(petition => {
    const home = petition.estateId === HOME_ESTATE_ID ? HOME_PETITION_KINDS[petition.kind as HomePetitionKind] : undefined;
    const granted = petition.status === "granted";
    const effect = home === undefined ? undefined : granted ? home.grant : home.refuse;
    return { petitionId: petition.id, estateId: petition.estateId, kind: petition.kind, policy: petition.policy ?? (petition.precedent === true ? "precedent" : "customary"),
      granted, amount: petition.amount, tick: petition.tick, treasury: effect === undefined ? null : effect.income * petition.amount, relations: effect?.factions ?? {} };
  });
  const events = (state.registry?.occurrences ?? []).filter(occurrence => occurrence.decidedBy === "steward" && occurrence.offeredTick >= fromTick && occurrence.offeredTick < toTick)
    .map(occurrence => ({ occurrenceId: occurrence.id, entryId: occurrence.entryId, choiceId: occurrence.choiceId ?? null, policy: occurrence.policy ?? "customary", tick: occurrence.offeredTick,
      ...(occurrence.side === undefined ? {} : { side: occurrence.side }) }));
  const brought = [...petitions.filter(petition => petition.decidedBy !== "steward" && petition.escalated !== undefined)
    .map(petition => ({ subjectId: petition.id, kind: petition.kind, layer: petition.escalated! as string })),
  ...(state.registry?.occurrences ?? []).filter(occurrence => occurrence.decidedBy !== "steward" && (occurrence.weights?.length ?? 0) > 0 && occurrence.offeredTick >= fromTick && occurrence.offeredTick < toTick)
    .map(occurrence => ({ subjectId: occurrence.id, kind: occurrence.entryId, layer: occurrence.weights!.join(",") }))];
  const lapsed = petitions.filter(petition => petition.status === "lapsed").length
    + (state.registry?.occurrences ?? []).filter(occurrence => occurrence.status === "lapsed" && (occurrence.settledTick ?? -1) >= fromTick && (occurrence.settledTick ?? -1) < toTick).length;
  return { handled, events, brought, lapsed };
}

/** The settings a standing policy takes (for the screens' choice). */
export const standingSettings = (): readonly StandingSetting[] => STANDING_SETTINGS;
