import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import type { GameState } from './engine.types';
import { codepoint, livingResidents, snapshot, type Context } from './registryPetitionContextFacts';
import { stateCalendar } from './scenarioState';
import { stuckStock } from './stuckStock';
import type { FixedContext } from './registryPetitionContextIdentity';

export function logisticsContext(state: GameState, fixed?: FixedContext): Context | null {
  const agency = state.agency;
  if (agency === undefined) return null;
  const year = stateCalendar(state).year;
  const carter = livingResidents(state).find(person => (fixed === undefined || fixed.partyIds.includes(person.id)) && person.role === 'head' && year - person.birthYear >= 16
    && state.trades?.households.some(trade => trade.houseId === person.householdId && trade.tradeId === 'carter'));
  if (carter === undefined) return null;
  const entries = [...stuckStock(state)].sort((a, b) => codepoint(a.buildingId, b.buildingId) || codepoint(a.resource, b.resource));
  for (const entry of entries) {
    if (fixed !== undefined && (entry.buildingId !== fixed.subjectKey || entry.resource !== fixed.triggerEvidence.resource)) continue;
    if (entry.source !== 'stock' || entry.reason !== 'no_carrier' || entry.amount <= 0
      || (entry.resource !== 'wheat' && entry.resource !== 'barley')) continue;
    const building = state.buildings.find(item => item.id === entry.buildingId);
    if (building === undefined) continue;
    const required = BUILDING_CONFIG_BY_KIND[building.kind].workersRequired;
    const movable = availableStock(building, entry.resource);
    if (required <= 0 || building.workers >= required || movable <= 0) continue;
    return snapshot(building.id, [carter.id], {
      granarySubsidy: agency.subsidies.find(item => item.kind === 'granary')?.amount ?? 0,
      storehouseSubsidy: agency.subsidies.find(item => item.kind === 'storehouse')?.amount ?? 0,
      timberOrder: state.timberOrder ?? 0,
    }, {
      buildingId: building.id, resource: entry.resource, amount: entry.amount, movable,
      workers: building.workers, workersRequired: required, reason: entry.reason,
      stuckSinceTick: building.stuckSinceTick?.[entry.resource] ?? null,
      carterHouseholdId: carter.householdId,
    });
  }
  return null;
}
