/**
 * Market coverage probe (BOT-1 analysis, read-only): the most homes the markets the facility cap allows
 * (lots ÷ 24 + 1, efficientGrowthAcceptance `markets`) can reach, counting the markets that stand and free market
 * sites (stone-town placement rules without the material check, the advisor's setback). Market service reaches a home
 * within footprint distance 8 (`serviceRadius`); road links and capacity are not modelled.
 *
 *   npx tsx scripts/marketCoverageProbe.ts <state.json[.gz]>...
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from '../src/content/buildingConfig';
import { isBuildingConstructionSite } from '../src/economy/construction';
import type { GameState } from '../src/engine/engine.types';
import { hasAutoplayBuildingClearance } from '../src/engine/autoplaySetback';
import { buildingFootprintDistance } from '../src/geometry/buildingDistance';
import { housingLotCount } from '../src/population/housing';
import type { TileCoordinate } from '../src/world/grid';
import { canPlaceBuilding } from '../src/world/placement';
import { loadAutoplayFixture } from './autoplayStallProbe';

const REACH = BUILDING_CONFIG_BY_KIND.market.serviceRadius;
const footprint = (kind: BuildingKind, tile: TileCoordinate): Building => ({ id: `market-coverage-${kind}`, kind, tx: tile.tx, ty: tile.ty,
  workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });
const bits = (mask: bigint): number => mask.toString(2).split('').filter(bit => bit === '1').length;

export function marketCoverage(state: GameState) {
  const planned = (kind: 'house' | 'market') => state.constructionSites.flatMap(site =>
    isBuildingConstructionSite(site) && site.kind === kind ? [footprint(kind, site)] : []);
  const homes = [...state.buildings.filter(building => building.kind === 'house'), ...planned('house')];
  const markets = [...state.buildings.filter(building => building.kind === 'market'), ...planned('market')];
  const maskOf = (market: Building) => homes.reduce((mask, home, index) =>
    buildingFootprintDistance(home, market) <= REACH ? mask | (1n << BigInt(index)) : mask, 0n);
  const covered = markets.reduce((mask, market) => mask | maskOf(market), 0n);
  const unlocked = { ...state, era: 'stone_town' as const };
  const sites = state.tiles.flatMap(tile => {
    const placement = canPlaceBuilding(unlocked, 'market', tile.tx, tile.ty);
    if ((!placement.ok && placement.reason !== 'insufficient_materials') || !hasAutoplayBuildingClearance(state, 'market', tile)) return [];
    const mask = maskOf(footprint('market', tile));
    return mask === 0n ? [] : [{ tile: { tx: tile.tx, ty: tile.ty }, mask }];
  });
  const free = Math.max(0, Math.ceil(housingLotCount(state) / 24) + 1 - markets.length);
  let best = { reach: bits(covered), sites: [] as TileCoordinate[] };
  for (const [index, left] of sites.entries()) {
    if (free < 1) break;
    const one = covered | left.mask;
    if (bits(one) > best.reach) best = { reach: bits(one), sites: [left.tile] };
    if (free < 2) continue;
    for (const right of sites.slice(index + 1)) {
      const two = one | right.mask;
      if (bits(two) > best.reach) best = { reach: bits(two), sites: [left.tile, right.tile] };
    }
  }
  return { tick: state.tick, homes: homes.length, markets: markets.length, freeMarkets: free, reachedNow: bits(covered),
    bestReach: best.reach, bestSites: best.sites, freeSites: sites.length };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const path of process.argv.slice(2)) process.stdout.write(`${JSON.stringify(marketCoverage(loadAutoplayFixture(resolve(path))))}\n`);
}
