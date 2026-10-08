import type { GameState } from './engine.types';
import { estatesOf } from './estates';
import { boundId, snapshot, type Context } from './registryPetitionContextFacts';
import { readFixedContext } from './registryPetitionContextIdentity';
import { stateCalendar } from './scenarioState';
import { heldOffMapEstates, stewardshipOf } from './stewardship';

/** 147: the recorded death replacement, not any deceased candidate belonging to the estate. */
export function stewardSuccessionContext(state: GameState, bound: Context, fixed?: Context): Context | null {
  if (state.agency === undefined) return null;
  const pinned = fixed === undefined ? undefined : readFixedContext(fixed);
  if (pinned === null) return null;
  const estate = heldOffMapEstates(state).find(item => item.id === boundId(bound, 'estate'));
  if (estate === undefined) return null;
  const stewardship = stewardshipOf(state);
  const people = estatesOf(state).people;
  const year = stateCalendar(state).year;
  const living = (id: string) => people.some(person => person.id === id && person.alive && person.leftYear === undefined && year - person.birthYear >= 16);
  const current = stewardship.stewards.find(item => item.personId === boundId(bound, 'currentSteward', 'personId')
    && item.estateId === estate.id && item.status === 'serving' && living(item.personId));
  const oversight = stewardship.oversight.find(item => item.estateId === estate.id && item.stewardId === current?.personId);
  if (current === undefined || oversight === undefined) return null;
  const peasant = stewardship.stewards.find(item => item.personId === boundId(bound, 'peasantCandidate', 'personId')
    && item.estateId === estate.id && item.status === 'candidate' && item.disposition === 'peasant' && living(item.personId));
  const merchant = stewardship.stewards.find(item => item.personId === boundId(bound, 'merchantCandidate', 'personId')
    && item.estateId === estate.id && item.status === 'candidate' && item.disposition === 'merchant' && living(item.personId));
  if (peasant === undefined || merchant === undefined || peasant.personId === merchant.personId) return null;
  const records = state.history?.records ?? [];
  const transition = records.find(record => record.template === 'stewardship.steward_died' && record.tick <= state.tick
    && record.tick === current.since && record.tick === oversight.since && record.params?.stewardId === current.personId
    && typeof record.params.deceasedId === 'string'
    && (pinned === undefined || pinned.triggerEvidence.transitionRecordId === record.id));
  if (transition === undefined) return null;
  const deceased = stewardship.stewards.find(item => item.personId === transition.params?.deceasedId && item.estateId === estate.id && item.status === 'dead');
  const person = people.find(item => item.id === deceased?.personId && !item.alive && item.deathYear !== undefined);
  const appointment = records.find(record => record.template === 'stewardship.oversight' && record.tick === transition.tick
    && record.params?.estate === estate.id && record.params.stewardId === current.personId);
  if (deceased === undefined || person === undefined || appointment === undefined) return null;
  const context = snapshot(estate.id, [deceased.personId, current.personId, peasant.personId, merchant.personId],
    { mode: oversight.mode, auditMode: oversight.auditMode },
    { transitionRecordId: transition.id, appointmentRecordId: appointment.id, tick: transition.tick,
      deceasedId: deceased.personId, successorId: current.personId, deathYear: person.deathYear, deathCause: person.deathCause ?? null });
  if (pinned === undefined) return context;
  if (pinned.subjectKey !== context.subjectKey || JSON.stringify(pinned.partyIds) !== JSON.stringify(context.partyIds)
    || JSON.stringify(pinned.triggerEvidence) !== JSON.stringify(context.triggerEvidence)) return null;
  return fixed ?? null;
}
