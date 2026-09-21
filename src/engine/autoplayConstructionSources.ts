import type { Building } from '../content/buildingConfig';
import type { GameState } from './engine.types';

/** Existing road-planner anchors; stock sufficiency remains the delivery engine's decision. */
export function autoplayConstructionSources(state: GameState): readonly Building[] {
  return state.buildings.filter(building => building.id !== 'autoplay-service-space-new'
    && (building.kind === 'storehouse' || (building.inventory.timber ?? 0) > 0
      || (building.inventory.stone ?? 0) > 0 || (state.treasuryTimber > 0 && building.kind === 'house')));
}
