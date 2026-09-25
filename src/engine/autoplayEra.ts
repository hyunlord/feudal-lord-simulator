import { markAutoplaySearchLimit, spendAutoplaySearch } from './autoplaySearchBudget';
import type { BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { computeReachablePalisadeProposalForState } from './palisadeRouteAccess';
import { confirmPalisadeProclamation } from './palisade';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { evaluateEraRequirements } from './era';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { LABOUR_BALANCE } from '../content/balanceConfig';
import { housingLotCount } from '../population/housing';
import { cellInsideWall } from '../zones/zoneEdits';

const NONE = { kind: 'none' } as const;
function hasBuiltOrPlannedBuilding(state: GameState, kind: BuildingKind): boolean {
  return state.buildings.some(building => building.kind === kind)
    || state.constructionSites.some(site => isBuildingConstructionSite(site) && site.kind === kind);
}
/** LB-12: cells a (projected) wall encloses. */
export function wallInteriorCells(state: GameState): number {
  let cells = 0;
  for (let index = 0; index < state.tiles.length; index += 1) if (cellInsideWall(state, index)) cells += 1;
  return cells;
}

/**
 * LB-12 (C3): among the candidate walls, autoplay proclaims the palisade with one that encloses at least
 * `wallCellsPerLot` cells for every lot its policy wants when there is one; otherwise with the first the old rule
 * accepted (waiting for a roomier wall kept seed 3's hamlet at 12 lots). Faster growth met the palisade requirements
 * while seed 3's core was small; its first wall enclosed 135 cells and the 24th plot never fitted (old rules: 147).
 */
export function autoplayEraAction(state: GameState, buildAction: (state: GameState, kind: BuildingKind) => AutoplayAction, targetLots = Infinity): AutoplayAction {
  if (state.population < 60 || state.constructionSites.some(isBuildingConstructionSite)) return NONE;
  const unmet = evaluateEraRequirements(state).filter(requirement => !requirement.met);
  if (unmet.length === 0) {
    if (state.era === 'hamlet') {
      // Each candidate wall is projected and checked for service space once, and reused by both passes below.
      const inspected = new Map<string, { readonly allowed: boolean; readonly roomy: boolean }>();
      const inspect = (path: Parameters<typeof confirmPalisadeProclamation>[1]) => {
        const key = JSON.stringify(path);
        const cached = inspected.get(key);
        if (cached !== undefined) return cached;
        if (inspected.size >= 8) { markAutoplaySearchLimit(); return null; }
        if (!spendAutoplaySearch(4)) return null;
        const projected = confirmPalisadeProclamation(state, path);
        const allowed = projected !== state && preservesAutoplayServiceSpace(state, { kind: 'proclaim_era' }, projected);
        const roomy = !Number.isFinite(targetLots) || housingLotCount(state) >= targetLots
          || wallInteriorCells(projected) >= targetLots * LABOUR_BALANCE.wallCellsPerLot;
        const result = { allowed, roomy };
        inspected.set(key, result);
        return result;
      };
      // LB-12: a wall with room for every wanted lot first; failing that, any wall the old rule accepted.
      const roomyProposal = computeReachablePalisadeProposalForState(state, path => {
        const result = inspect(path);
        return result !== null && result.allowed && result.roomy;
      }, 8, markAutoplaySearchLimit);
      if (roomyProposal.ok) return { kind: 'proclaim_era', candidatePath: roomyProposal.path };
      const proposal = computeReachablePalisadeProposalForState(state, path => inspect(path)?.allowed === true, 8, markAutoplaySearchLimit);
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
