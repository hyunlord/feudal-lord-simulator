import type { GameState } from './engine.types';
import { buildingRoadAccessTiles } from './routing';
import { boundId, codepoint, snapshot, type Context } from './registryPetitionContextFacts';
import { readFixedContext } from './registryPetitionContextIdentity';
import { lordEstatePetitions } from './stewardship';

/** 056 needs a market approach, not an invented road-damage or cart-delay state. */
export function marketRoadPetitionContext(state: GameState, bound: Context, fixed?: Context): Context | null {
  if (state.agency === undefined) return null;
  const petition = lordEstatePetitions(state).find(item => item.id === boundId(bound, 'estatePetition')
    && item.estateId === 'estate-home' && item.kind === 'road_bridge' && item.deadline >= state.tick);
  if (petition === undefined) return null;
  const pinned = fixed === undefined ? undefined : readFixedContext(fixed);
  if (pinned === null) return null;
  const markets = state.buildings.filter(building => building.kind === 'market'
    && (pinned === undefined || building.id === pinned.triggerEvidence.marketId)).sort((a, b) => codepoint(a.id, b.id));
  for (const market of markets) {
    const roads = [...buildingRoadAccessTiles(state, market)].sort((a, b) => a.ty - b.ty || a.tx - b.tx);
    const road = pinned === undefined ? roads[0] : roads.find(tile => tile.tx === pinned.triggerEvidence.roadTx && tile.ty === pinned.triggerEvidence.roadTy);
    if (road === undefined) continue;
    const context = snapshot(petition.id, [petition.group], {}, { estateId: petition.estateId,
      marketId: market.id, marketTx: market.tx, marketTy: market.ty, roadTx: road.tx, roadTy: road.ty });
    if (pinned === undefined) return context;
    return pinned.subjectKey === petition.id && pinned.partyIds.length === 1 && pinned.partyIds[0] === petition.group
      && JSON.stringify(pinned.triggerEvidence) === JSON.stringify(context.triggerEvidence) ? fixed ?? null : null;
  }
  return null;
}
