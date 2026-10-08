import type { ResourceType } from '../content/resourceConfig';
import type { GameState } from './engine.types';
import { stateCalendar } from './scenarioState';
import type { Person } from './persons.types';
export type Context = Readonly<Record<string, unknown>>;
export const codepoint = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
export function boundId(bound: Context, key: string, field = 'id'): string | undefined {
  const value = bound[key];
  if (typeof value !== 'object' || value === null || !(field in value)) return undefined;
  const id: unknown = Reflect.get(value, field);
  return typeof id === 'string' ? id : undefined;
}
export function livingResidents(state: GameState): readonly Person[] {
  return (state.persons?.people ?? []).filter(person => person.alive && person.leftYear === undefined && stateCalendar(state).year - person.birthYear >= 16
    && state.houses.some(house => house.buildingId === person.householdId && house.residents > 0 && house.abandonedTick === undefined))
    .sort((a, b) => codepoint(a.id, b.id));
}
export function stock(state: GameState, resource: ResourceType): number {
  return state.buildings.reduce((sum, building) => sum + (building.inventory[resource] ?? 0), 0);
}
export function snapshot(subjectKey: string, partyIds: readonly string[], materialBefore: Context, triggerEvidence: Context): Context {
  return { subjectKey, partyIds: [...new Set(partyIds)].sort(codepoint), materialBefore, triggerEvidence };
}
