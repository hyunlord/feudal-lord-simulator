import type { GameState } from "../../engine/engine.types";
import { pauseReasons, type PauseEvent } from "../../engine/autoPause";
import { lordMattersDue, type LordMatterDue } from "../../engine/lordDue";
import { stateCalendar } from "../../engine/scenarioState";
import { stewardshipOf } from "../../engine/stewardship";
import { lordMode } from "../../engine/townAgency";

// LM-R3 (lord slice LS-2, lord-mode design 3.5; the user's ruling 2026-10-09): the screen's half of the auto-pause. It
// stops only for what the engine names — a big event (`pauseReasons`: a counter, a great person's death, an inheritance,
// a judgment, a rights petition put to the lord, an estate's crisis, an estate gained or lost) or a new matter that waits
// for the lord's answer by a time (`lordMattersDue`: the father's will, a contested inheritance, a suit against him at
// its next stage, a forcible entry forewarned; PLAY-2 §4: an audit's finding, an off-map estate's petition). Nothing else: no weight rule of the screen's own (P-T1, P-T3). Here is
// which pairs of states are a turn of the game (a tick batch or a command) and how a season's reasons stop once. A load,
// a new game or the tick going back is no turn: the baseline moves on and nothing stops.

/** One reason to stop: an engine event, or a matter newly due. */
export type AutoPauseItem =
  | { readonly kind: "event"; readonly key: string; readonly event: PauseEvent }
  | { readonly kind: "matter"; readonly key: string; readonly matter: LordMatterDue };

/** What the screen remembers between states: the last state seen, its matters due, and the stops already counted. */
export interface AutoPauseMemory {
  readonly baseline: GameState;
  readonly matters: ReadonlySet<string>;
  readonly seen: ReadonlySet<string>;
}

/** A matter's key: a suit's next stage is a new deadline, so a new matter (the engine's `dueTick` moves with it). */
export const matterKey = (matter: LordMatterDue): string => `matter:${matter.kind}:${matter.id}:${matter.dueTick ?? "open"}`;
const mattersOf = (state: GameState): ReadonlySet<string> => new Set(lordMattersDue(state).map(matterKey));

export const autoPauseMemory = (state: GameState): AutoPauseMemory => ({ baseline: state, matters: mattersOf(state), seen: new Set() });

/** One stop, once: the ledger line it was read from, or the petition. */
export const pauseEventKey = (event: PauseEvent): string => event.recordId ?? `petition:${event.petitionId ?? `${event.reason}:${event.tick}`}`;

/**
 * Whether `state` follows `baseline` in play: a tick batch committed from it (the store's previous state is the baseline
 * itself, compared by identity), or a command on the same tick of the same game. Anything else (a load, a new game, the
 * tick going back) is not.
 */
export function playedOn(baseline: GameState, state: GameState, previous: unknown): boolean {
  if (state.tick > baseline.tick) return previous === baseline;
  return state.tick === baseline.tick && lordMode(baseline) && state.seed === baseline.seed && state.scenarioId === baseline.scenarioId;
}

/**
 * The next memory after `state` and the reasons it newly brings (lord mode only; empty: time runs on). `reset`: no turn
 * (a load, a new game, the tick going back) — the season's stop is forgotten with it.
 */
export function autoPauseStep(memory: AutoPauseMemory, state: GameState, previous: unknown): { readonly memory: AutoPauseMemory; readonly fresh: readonly AutoPauseItem[]; readonly reset?: true } {
  if (state === memory.baseline) return { memory, fresh: [] };
  if (!playedOn(memory.baseline, state, previous)) return { memory: autoPauseMemory(state), fresh: [], reset: true };
  if (!lordMode(state)) return { memory: autoPauseMemory(state), fresh: [] };
  const events: AutoPauseItem[] = pauseReasons(memory.baseline, state).map(event => ({ kind: "event", key: pauseEventKey(event), event }));
  // A contested inheritance comes with its own ledger line (an inheritance event): one line for the one matter. So does
  // an off-map petition a steward brought for a right, in the batch it came (its rights petition's line).
  const contested = events.some(item => item.kind === "event" && item.event.template === "marriage.contested");
  const raised = events.some(item => item.kind === "event" && item.event.template === "stewardship.escalated")
    ? new Set(stewardshipOf(state).petitions.filter(petition => petition.escalated === "rights" && petition.tick > memory.baseline.tick).map(petition => petition.id)) : new Set<string>();
  const due = lordMattersDue(state);
  const matters: AutoPauseItem[] = due.filter(matter => !memory.matters.has(matterKey(matter)) && !(contested && matter.kind === "contested")
    && !(matter.kind === "estate_petition" && raised.has(matter.id)))
    .map(matter => ({ kind: "matter", key: matterKey(matter), matter }));
  const fresh = [...events, ...matters].filter(item => !memory.seen.has(item.key));
  const next = { baseline: state, matters: new Set(due.map(matterKey)), seen: fresh.length === 0 ? memory.seen : new Set([...memory.seen, ...fresh.map(item => item.key)]) };
  return { memory: next, fresh };
}

/** The season a state stands in (the stops are counted by it). */
export const seasonKey = (state: GameState): string => { const date = stateCalendar(state); return `${date.year}:${date.season}`; };

/**
 * The season's stop (the user's ruling): the first reasons of a season stop time; the season's later reasons join its
 * list and never stop it again — while time still stands they join the notice, after the player went on they show as the
 * season's added lines (time runs). `stopped`: time stopped for these; `added`: shown while time runs.
 */
export interface SeasonHold {
  readonly season: string;
  readonly items: readonly AutoPauseItem[];
  readonly shown: readonly AutoPauseItem[];
  readonly mode: "stopped" | "added" | null;
}

/** The hold after `fresh` came in `season`; `stop`: time must stop now (once a season). */
export function seasonTurn(hold: SeasonHold | null, season: string, fresh: readonly AutoPauseItem[]): { readonly hold: SeasonHold | null; readonly stop: boolean } {
  if (fresh.length === 0) return { hold, stop: false };
  if (hold === null || hold.season !== season) return { hold: { season, items: fresh, shown: fresh, mode: "stopped" }, stop: true };
  const items = [...hold.items, ...fresh];
  if (hold.mode === "stopped") return { hold: { ...hold, items, shown: [...hold.shown, ...fresh] }, stop: false };
  return { hold: { ...hold, items, shown: hold.mode === "added" ? [...hold.shown, ...fresh] : fresh, mode: "added" }, stop: false };
}

/** The notice put away: after the player went on (a stop's notice), or dismissed (the added lines). */
export const seasonPutAway = (hold: SeasonHold | null): SeasonHold | null => hold === null ? null : { ...hold, shown: [], mode: null };
