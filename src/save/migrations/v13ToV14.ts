/**
 * v14 adds F0-C1's chapter 1 (spec `docs/design/flow-chapter-one.md`, FC-1…FC-5): `GameState.politics` (petitions,
 * rights, the merchants' gauge, decisions, chapter ends) and, on event records, an era dearth's harvest years, its
 * population at arrival and end and the lord's answer. A v13 town gets its politics on its first tick (the chapter counted
 * from there). A v13 town that already entered the famine era had no Great Famine then; it is recorded as missed, so it
 * does not start late.
 */
import type { GameState } from "../../engine/engine.types";
import { EVENT_DEF_BY_ID, FAMINE_ERA_ID, GREAT_FAMINE_EVENT_ID } from "../../content/eventConfig";
import { SCENARIOS } from "../../content/scenario/registry";
import { DEFAULT_SCENARIO_ID } from "../../content/scenario/coreScenarios";
import { eraPlannedSeason, eventInstanceId } from "../../engine/eventSchedule";

export function migrateStateV13ToV14(state: GameState): GameState {
  if (SCENARIOS.get(state.scenarioId ?? DEFAULT_SCENARIO_ID) === undefined) return state;
  if (!(state.historicalEras ?? []).some(entry => entry.id === FAMINE_ERA_ID)) return state;
  const def = EVENT_DEF_BY_ID.get(GREAT_FAMINE_EVENT_ID)!;
  const id = eventInstanceId(def, eraPlannedSeason(state, def)!);
  const events = state.events ?? { records: [], burning: [] };
  if (events.records.some(record => record.id === id) || (events.missed ?? []).includes(id)) return state;
  return { ...state, events: { ...events, missed: [...(events.missed ?? []), id] } };
}

export function migrateV13ToV14(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v13 save must be an envelope object');
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== 'object' || envelope.state === null) throw new TypeError('Schema v13 save has no state');
  return { ...envelope, schemaVersion: 14, state: migrateStateV13ToV14(envelope.state as GameState) };
}
