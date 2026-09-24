import type { GameState } from './engine.types';
import { measuredFoodDecision } from './autoplayFoodMeasuredDecision';

export function shouldRetryAutoplayAfterMillReplenishment(previous: GameState, current: GameState): boolean {
  if (current.tick <= previous.tick) return false;
  const mills = current.buildings.filter(building => building.kind === 'mill');
  if (mills.length === 0 || mills.some(mill => (mill.inventory.wheat ?? 0) <= 0)) return false;
  const oldMills = new Map(previous.buildings.filter(building => building.kind === 'mill').map(mill => [mill.id, mill]));
  if (oldMills.size !== mills.length || mills.some(mill => !oldMills.has(mill.id))) return false;
  if (!mills.some(mill => (oldMills.get(mill.id)?.inventory.wheat ?? 0) === 0)) return false;
  return measuredFoodDecision(previous).reason === 'wheat_transport_blocked'
    && measuredFoodDecision(current).reason === 'wheat_transport_blocked';
}
