import { markAutoplaySearchLimit, spendAutoplaySearch } from './autoplaySearchBudget';
import type { BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { computeReachablePalisadeProposalForState } from './palisadeRouteAccess';
import { confirmPalisadeProclamation } from './palisade';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { evaluateEraRequirements } from './era';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { housingLotCount } from '../population/housing';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { autoplayCanPlace } from './autoplayZones';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';

const NONE = { kind: 'none' } as const;
function hasBuiltOrPlannedBuilding(state: GameState, kind: BuildingKind): boolean {
  return state.buildings.some(building => building.kind === kind)
    || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === kind);
}
/**
 * LB-12 (C3): free grass inside a projected wall where the advisor could still place a house once it stands.
 * A wall that leaves fewer than the lots the policy still wants is not proclaimed yet: the town grows on and the next
 * proposal encloses more. Faster food growth used to meet the palisade requirements while the core was small, and
 * the wall then fenced seed 3 in at 19–22 lots (gate ② regression).
 */
export function wallPlotRoom(state: GameState): number {
  const polygon = state.palisade?.polygon;
  if (polygon === undefined) return 0;
  let room = 0;
  for (const tile of state.tiles) {
    if (tile.terrain !== "grass" || tile.hasRoad || tile.buildingId !== null) continue;
    // The house placement the advisor itself uses (clearance, legality incl. wall clearance, inside the wall); a road
    // to the plot may still be laid later, as the housing search does.
    if (hasAutoplayBuildingClearance(state, "house", tile) && autoplayCanPlace(state, "house", tile.tx, tile.ty)
      && preservesAutoplayWallSpace(state, "house", tile)) room += 1;
  }
  return room;
}

export function autoplayEraAction(state: GameState, buildAction: (state: GameState, kind: BuildingKind) => AutoplayAction, targetLots = Infinity): AutoplayAction {
  if (state.population < 60 || state.constructionSites.some(isBuildingConstructionSite)) return NONE;
  const unmet = evaluateEraRequirements(state).filter(requirement => !requirement.met);
  if (unmet.length === 0) {
    if (state.era === 'hamlet') {
      const inspected = new Map<string, boolean>();
      const proposal = computeReachablePalisadeProposalForState(state, path => {
        const key = JSON.stringify(path);
        const cached = inspected.get(key);
        if (cached !== undefined) return cached;
        if (inspected.size >= 8) { markAutoplaySearchLimit(); return false; }
        if (!spendAutoplaySearch(4)) return false;
        const projected = confirmPalisadeProclamation(state, path);
        const wanted = Math.max(0, targetLots - housingLotCount(state));
        const allowed = projected !== state && (wanted === 0 || !Number.isFinite(wanted) || wallPlotRoom(projected) >= wanted)
          && preservesAutoplayServiceSpace(state, { kind: 'proclaim_era' }, projected);
        inspected.set(key, allowed);
        return allowed;
      }, 8, markAutoplaySearchLimit);
      if (proposal.ok) return { kind: 'proclaim_era', candidatePath: proposal.path };
      if (proposal.reason === 'rejected_candidate') return NONE;
    }
    return { kind: 'proclaim_era' };
  }
  for (const requirement of unmet) {
    let kind: BuildingKind | null = null;
    switch (requirement.key) {
      case "granary": case "chapel": case "market": case "masonry":
        kind = requirement.key;
        break;
      case "stone":
        kind = !hasBuiltOrPlannedBuilding(state, "quarry") ? "quarry" : "masonry";
        break;
      case "population": case "timber": case "coin":
        break;
    }
    if (kind !== null && !hasBuiltOrPlannedBuilding(state, kind)) {
      const action = buildAction(state, kind);
      if (action.kind !== "none") return action;
    }
  }
  return NONE;
}
