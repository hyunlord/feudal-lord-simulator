import { markAutoplaySearchLimit, spendAutoplaySearch } from './autoplaySearchBudget';
import type { Building, BuildingKind } from '../content/buildingConfig';
import type { TileCoordinate } from '../geometry/tileGeometry';
import { resolveBuildingRoute } from './routing';
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
import { charterTimberOrder } from './timberTrade';
import { stretchedWallCandidates, wallRoom } from './autoplayWallRoom';
import { holdsCharterSearch, palisadeFootprintsForState } from './palisadeFootprints';
import { computePalisadeProposal, type PalisadePath, type PalisadeProposalResult } from '../world/palisadeGeometry';
import { findAutoplayServiceWitness } from './autoplayServiceSpaceWitness';
import { serviceSpaceBuildings } from './autoplayServiceSpaceRoutes';
import { CHARTER_RING } from '../content/charterRingConfig';
import type { CharterWallFailureReason } from './townAgency.types';

/**
 * GROW-BLOCK (GB-1, the user's ruling 2026-10-09): why the last charter wall search found no wall — the town agency
 * reads it right after its walk (lord mode) and keeps it as the charter's failure (`AgencyState.charterWallFailure`).
 */
export interface CharterSearchReport { readonly reason: CharterWallFailureReason; readonly homes: readonly string[]; readonly candidates: number }
let lastCharterReport: CharterSearchReport | null = null;
export function takeCharterSearchReport(): CharterSearchReport | null {
  const report = lastCharterReport;
  lastCharterReport = null;
  return report;
}

const GEOMETRY_REASON: Readonly<Partial<Record<string, CharterWallFailureReason>>> = {
  water_crossing: 'water', out_of_bounds: 'edge', building_clearance: 'buildings', insufficient_enclosure: 'buildings',
  collinear_footprints: 'buildings', self_intersection: 'buildings', open_polygon: 'buildings', empty_perimeter: 'buildings', no_footprints: 'buildings',
};

/** The homes a wall would cut from the service space they rely on (a market's or church's pad, its road). */
function homesLosingService(state: GameState, path: PalisadePath): readonly string[] {
  const projected = confirmPalisadeProclamation(state, path);
  if (projected === state) return [];
  return serviceSpaceBuildings(state).filter(home => home.kind === 'house' && findAutoplayServiceWitness(state, home) !== null)
    .filter(home => { const after = projected.buildings.find(building => building.id === home.id); return after === undefined || findAutoplayServiceWitness(projected, after) === null; })
    .map(home => home.id);
}

/**
 * GB-1 (lord mode): when the hulls of the town's living core find no wall, a wider ring round every building — its
 * margin rotated by the attempt (a season's retry starts elsewhere) — each checked as the bot checks any wall (the
 * proclamation's rules, the service space, the lots, the route access), within its own small budget.
 */
function widerRing(state: GameState, attempt: number, remaining: number, targetLots: number): PalisadePath | null {
  const margins = CHARTER_RING.wideMargins.map((_, index, all) => all[(index + attempt) % all.length]!);
  const anchors = palisadeFootprintsForState(state);
  let inspected = 0;
  for (const margin of margins) {
    const result = computePalisadeProposal(state, anchors, path => {
      if (inspected >= CHARTER_RING.wideInspections || !spendAutoplaySearch(4)) return false;
      inspected += 1;
      if (remaining > 0 && !wallRoom(state, path, remaining).roomy) return false;
      const projected = confirmPalisadeProclamation(state, path);
      if (projected === state || !preservesAutoplayServiceSpace(state, { kind: 'proclaim_era' }, projected)) return false;
      if (remaining > 0 && wallInteriorCells(projected) < targetLots * LABOUR_BALANCE.wallCellsPerLot) return false;
      const access = previewPalisadeRouteAccess(state, path);
      return access.unreachableSiteIds.length === 0 && access.unavailableSiteIds.length === 0;
    }, [margin]);
    if (result.ok) return result.path;
  }
  return null;
}

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
 * C4 (AL-8): once ale is required (chapter 2), the bot builds a malt kiln within `KILN_NEAR_BARN` road tiles of the barn
 * that will grow the barley (decision AL13: run 3's kilns stood 14–30 tiles from it and starved for barley 79–89 % of
 * the time), then sets that barn to barley. The barn is the smallest the town's wheat can spare — the wheat outlook
 * without it still meets the planner's margin (AF-13). No barn to spare: the food step plants with a wider margin until
 * one is (`aleWantsBarley`). The households brew by themselves.
 * (Run 1 switched a barn at 1318 before its kiln: three towns of five lost their bread to it, decision AL5.)
 */
export const KILN_NEAR_BARN = 6;
const KILN_SITE_RINGS = [2, 4, KILN_NEAR_BARN] as const;
/**
 * When no barn to spare has room within `KILN_NEAR_BARN` (the smallest barn is often the town's first, hemmed in by
 * houses: probe e075ed8 seed 2 at 119,269 had one legal cell within six tiles of it), the kiln goes a little farther.
 */
const KILN_FALLBACK_RINGS = [8, 10] as const;
type KilnBuildAction = (state: GameState, kind: BuildingKind, accepts?: (coordinate: TileCoordinate) => boolean) => AutoplayAction;

/** The barns the wheat can spare for barley, smallest first (a barn tending no strips would grow nothing: run 2). */
function spareBarns(state: GameState): readonly Building[] {
  const years = new Map(farmsteadYears(state).map(year => [year.farmsteadId, year.wheat]));
  return state.buildings.filter(building => building.kind === "farmstead")
    .sort((a, b) => (years.get(a.id) ?? 0) - (years.get(b.id) ?? 0) || a.id.localeCompare(b.id))
    .filter(barn => (years.get(barn.id) ?? 0) > 0 && !arableSupplyShort(setFarmsteadCrop(state, barn.id, "barley")));
}

/** Road tiles between two buildings (null: no road joins them). */
function roadTiles(state: GameState, from: Building, to: Building): number | null {
  const path = resolveBuildingRoute(state, from, to).path;
  return path === null ? null : path.length - 1;
}

/**
 * A kiln at the coordinate would stand within `KILN_NEAR_BARN` tiles of the barn and, where a road already joins them,
 * within `KILN_NEAR_BARN` road tiles. A site no road reaches yet is taken too: the bot lays the road to it (as for the mill
 * beside a backed-up barn). Requiring a road route here first left every seed without a kiln (probe e075ed8).
 */
function kilnNearBarn(state: GameState, barn: Building, coordinate: TileCoordinate, ring: number, roadLimit: number): boolean {
  if (Math.abs(coordinate.tx - barn.tx) + Math.abs(coordinate.ty - barn.ty) > ring) return false;
  const kiln: Building = { id: `kiln-candidate:${coordinate.tx},${coordinate.ty}`, kind: "malt_kiln", tx: coordinate.tx, ty: coordinate.ty, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const tiles = roadTiles(state, barn, kiln);
  return tiles === null || tiles <= roadLimit;
}

export function aleChainAction(state: GameState, buildAction: KilnBuildAction): AutoplayAction {
  if (!aleRequired(state) || state.era === "hamlet") return NONE;
  const barley = state.buildings.find(building => building.crop === "barley");
  if (!hasBuiltOrPlannedBuilding(state, "malt_kiln")) {
    const barns = barley === undefined ? spareBarns(state) : [barley];
    for (const rings of [KILN_SITE_RINGS, KILN_FALLBACK_RINGS]) {
      for (const barn of barns) {
        for (const ring of rings) {
          const action = buildAction(state, "malt_kiln", coordinate => kilnNearBarn(state, barn, coordinate, ring, Math.max(ring, KILN_NEAR_BARN)));
          if (action.kind !== "none") return action;
        }
      }
    }
    return NONE;
  }
  const kiln = state.buildings.find(building => building.kind === "malt_kiln");
  if (kiln === undefined || barley !== undefined) return NONE;
  // The spare barn nearest the kiln by road (the one it was built beside, unless the wheat has changed since).
  const spare = [...spareBarns(state)].map((barn, order) => ({ barn, order, tiles: roadTiles(state, kiln, barn) ?? Infinity }))
    .sort((a, b) => a.tiles - b.tiles || a.order - b.order)[0]?.barn;
  return spare === undefined ? NONE : { kind: "set_farmstead_crop", buildingId: spare.id, crop: "barley" };
}

/** C4 (AL-8): ale is required and no barn grows barley yet — the food step plants with `ALE_ARABLE_MARGIN_PERMILLE`. */
export const ALE_ARABLE_MARGIN_PERMILLE = 1500;
export function aleWantsBarley(state: GameState): boolean {
  return aleRequired(state) && state.era !== "hamlet" && !state.buildings.some(building => building.crop === "barley");
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
  const unmet = evaluateEraRequirements(state).filter(requirement => !requirement.met);
  // GB-6: met, only the core's sites getting on hold the charter's search; unmet, any open site still waits (the bot
  // lays one requirement's building at a time).
  if (state.population < 60 || state.constructionSites.some(site => unmet.length === 0 ? holdsCharterSearch(state, site) : isBuildingConstructionSite(site))) return NONE;
  if (unmet.length === 0) {
    if (state.era === 'hamlet') {
      const remaining = Number.isFinite(targetLots) ? targetLots - housingLotCount(state) : 0;
      // AR-11: the room check reads the tiles only, so walls without room are not projected at all.
      const roomFor = (path: Parameters<typeof confirmPalisadeProclamation>[1]) => remaining <= 0 || wallRoom(state, path, remaining).roomy;
      // Each candidate wall is projected and checked for service space once, and reused by both passes below.
      const inspected = new Map<string, { readonly allowed: boolean; readonly roomy: boolean }>();
      // GB-1: why the walls inspected were refused (the first refused one's path kept for the homes it would cut off).
      const refusals = { rules: 0, service: 0, lots: 0 };
      let firstServiceRefusal: PalisadePath | null = null;
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
        if (projected === state) refusals.rules += 1;
        else if (!allowed) { refusals.service += 1; firstServiceRefusal ??= path; }
        else if (!roomy) refusals.lots += 1;
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
      // GB-1 (lord mode only — the sandbox bot keeps its rule and its guardrail): a wider ring before giving up, and why.
      if (state.agency !== undefined) {
        const wide = widerRing(state, state.agency.charterWallFailure?.attempts ?? 0, remaining, targetLots);
        if (wide !== null) return { kind: 'proclaim_era', candidatePath: wide };
        lastCharterReport = charterReport(state, proposal, refusals, firstServiceRefusal, inspected.size);
        // GROW-BLOCK-2a ①: no wall found is a failed search, kept with its reason — never a request without a wall. The
        // lord's bot cannot proclaim one (it searches the same rules), so seed 9 asked thirty years with no failure on
        // record and never searched again (engine-GROW2-remeasure-588d28d: 528 from 1317 to the end).
        return NONE;
      }
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
      case "timber": {
        // FIX-13 (FX13-5) / FIX-14: the charter waits on timber the town's stores cannot reach (its sawmills stood idle
        // a whole window, the receivers full) — the shortfall bought from the traders (FIX-10 TT-4b's rule, TT-5's trade point).
        const order = charterTimberOrder(state, requirement.target);
        if (order !== null) return { kind: "order_timber", amount: order };
        break;
      }
      case "population": case "coin":
        break;
    }
    if (kind !== null && !hasBuiltOrPlannedBuilding(state, kind)) {
      const action = buildAction(state, kind);
      if (action.kind !== "none") return action;
    }
  }
  return NONE;
}

/** GB-1: the search's failure as the town keeps it — the commonest refusal among the walls inspected, or the geometry's. */
function charterReport(state: GameState, proposal: PalisadeProposalResult, refusals: { readonly rules: number; readonly service: number; readonly lots: number },
  firstServiceRefusal: PalisadePath | null, candidates: number): CharterSearchReport {
  if (proposal.ok) return { reason: 'other', homes: [], candidates };
  if (proposal.reason !== 'rejected_candidate') return { reason: GEOMETRY_REASON[proposal.reason] ?? 'other', homes: [], candidates };
  const top = Math.max(refusals.rules, refusals.service, refusals.lots);
  if (top > 0 && refusals.service === top) return { reason: 'service_space', homes: firstServiceRefusal === null ? [] : homesLosingService(state, firstServiceRefusal), candidates };
  if (top > 0 && refusals.lots === top) return { reason: 'lots', homes: [], candidates };
  if (top > 0) return { reason: 'rules', homes: [], candidates };
  return { reason: 'route', homes: [], candidates };
}
