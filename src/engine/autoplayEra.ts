import { markAutoplaySearchLimit, spendAutoplaySearch } from './autoplaySearchBudget';
import type { BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import { computeReachablePalisadeProposalForState } from './palisadeRouteAccess';
import { confirmPalisadeProclamation } from './palisade';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { evaluateEraRequirements } from './era';
import { aleRequired, setFarmsteadCrop } from './ale';
import { arableSupplyShort } from './autoplayArable';
import { farmsteadYears } from '../zones/arableOutlook';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { LABOUR_BALANCE } from '../content/balanceConfig';
import { housingLotCount } from '../population/housing';
import { cellInsideWall } from '../zones/zoneEdits';
import { previewPalisadeRouteAccess } from './palisadeRouteAccess';
import { stretchedWallCandidates, wallRoom } from './autoplayWallRoom';

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
 * C4 (AL-8): once ale is required (chapter 2), the bot builds a malt kiln first; when it stands, it sets to barley the
 * smallest barn the town's wheat can spare — the wheat outlook without it still meets the planner's margin (AF-13). No
 * barn to spare: the food step plants with a wider margin until one is (`aleWantsBarley`). The households brew by themselves.
 * (Run 1 switched a barn at 1318 before its kiln: three towns of five lost their bread to it, decision AL5.)
 */
export function aleChainAction(state: GameState, buildAction: (state: GameState, kind: BuildingKind) => AutoplayAction): AutoplayAction {
  if (!aleRequired(state) || state.era === "hamlet") return NONE;
  if (!hasBuiltOrPlannedBuilding(state, "malt_kiln")) {
    const action = buildAction(state, "malt_kiln");
    return action.kind === "none" ? NONE : action;
  }
  if (!state.buildings.some(building => building.kind === "malt_kiln") || state.buildings.some(building => building.crop === "barley")) return NONE;
  const years = new Map(farmsteadYears(state).map(year => [year.farmsteadId, year.wheat]));
  const spare = state.buildings.filter(building => building.kind === "farmstead")
    .sort((a, b) => (years.get(a.id) ?? 0) - (years.get(b.id) ?? 0) || a.id.localeCompare(b.id))
    .find(barn => !arableSupplyShort(setFarmsteadCrop(state, barn.id, "barley")));
  return spare === undefined ? NONE : { kind: "set_farmstead_crop", buildingId: spare.id, crop: "barley" };
}

/** C4 (AL-8): the kiln stands and no barn grows barley yet — the food step plants with `ALE_ARABLE_MARGIN_PERMILLE`. */
export const ALE_ARABLE_MARGIN_PERMILLE = 1500;
export function aleWantsBarley(state: GameState): boolean {
  return aleRequired(state) && state.buildings.some(building => building.kind === "malt_kiln") && !state.buildings.some(building => building.crop === "barley");
}

/**
 * FIX-5 (WR-11): the stone-wall variant's own step — two quarries and two masonries, then the stone proclamation as
 * soon as its conditions hold. Unlike the era phase it does not wait for every building site to finish (a growing town
 * always has one, which kept the variant's stone project behind the houses in its first run); the second pair doubles
 * the stone (one pair made about five a thousand ticks, too few for 400 by 1340 in four seeds of five).
 */
export const STONE_PROJECT_PAIRS = 2;
export function stoneProjectAction(state: GameState, buildAction: (state: GameState, kind: BuildingKind) => AutoplayAction): AutoplayAction {
  if (state.era !== "palisade") return NONE;
  const count = (kind: BuildingKind) => state.buildings.filter(building => building.kind === kind).length
    + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;
  for (let pair = 1; pair <= STONE_PROJECT_PAIRS; pair += 1) {
    for (const kind of ["quarry", "masonry"] as const) {
      if (count(kind) >= pair) continue;
      const action = buildAction(state, kind);
      if (action.kind !== "none") return action;
    }
  }
  return evaluateEraRequirements(state).every(requirement => requirement.met) ? { kind: "proclaim_era" } : NONE;
}

/**
 * LB-12 (C3): among the candidate walls, autoplay proclaims the palisade with one that encloses at least
 * `wallCellsPerLot` cells for every lot its policy wants when there is one; otherwise with the first the old rule
 * accepted (waiting for a roomier wall kept seed 3's hamlet at 12 lots). Faster growth met the palisade requirements
 * while seed 3's core was small; its first wall enclosed 135 cells and the 24th plot never fitted (old rules: 147).
 * BOT-2 (AR-11): while lots are still short of the policy, a roomy wall must also hold free house cells for every lot
 * still wanted with roads at most 30 % of the inside (`wallRoom`); when no hull of the buildings has that room, walls
 * stretched toward open land are tried before the old fallback.
 */
export function autoplayEraAction(state: GameState, buildAction: (state: GameState, kind: BuildingKind) => AutoplayAction, targetLots = Infinity): AutoplayAction {
  if (state.population < 60 || state.constructionSites.some(isBuildingConstructionSite)) return NONE;
  const unmet = evaluateEraRequirements(state).filter(requirement => !requirement.met);
  if (unmet.length === 0) {
    if (state.era === 'hamlet') {
      const remaining = Number.isFinite(targetLots) ? targetLots - housingLotCount(state) : 0;
      // AR-11: the room check reads the tiles only, so walls without room are not projected at all.
      const roomFor = (path: Parameters<typeof confirmPalisadeProclamation>[1]) => remaining <= 0 || wallRoom(state, path, remaining).roomy;
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
        const roomy = remaining <= 0
          || (wallInteriorCells(projected) >= targetLots * LABOUR_BALANCE.wallCellsPerLot && wallRoom(state, path, remaining).roomy);
        const result = { allowed, roomy };
        inspected.set(key, result);
        return result;
      };
      // LB-12: a wall with room for every wanted lot first; failing that, any wall the old rule accepted.
      // The wider candidate search (64 anchor/margin attempts instead of 8) is geometry only; each wall it finds is
      // inspected at most once, and at most eight are inspected in all.
      const roomyProposal = computeReachablePalisadeProposalForState(state, path => {
        if (inspected.size >= 8 && !inspected.has(JSON.stringify(path))) return false;
        if (!roomFor(path)) return false;
        const result = inspect(path);
        return result !== null && result.allowed && result.roomy;
      }, 64, () => undefined);
      if (roomyProposal.ok) return { kind: 'proclaim_era', candidatePath: roomyProposal.path };
      // AR-11: no hull of the buildings has room for the lots still wanted — stretch it toward open land.
      if (remaining > 0) {
        for (const path of stretchedWallCandidates(state)) {
          if (!roomFor(path)) continue;
          const result = inspect(path);
          if (result === null) break;
          if (!result.allowed || !result.roomy) continue;
          const access = previewPalisadeRouteAccess(state, path);
          if (access.unreachableSiteIds.length === 0 && access.unavailableSiteIds.length === 0) return { kind: 'proclaim_era', candidatePath: path };
        }
      }
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
