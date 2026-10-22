import { PRESSURE_BALANCE } from '../content/balanceConfig';
import type { TileCoordinate } from '../geometry/tileGeometry';
import { applyErase, zonesOf } from '../zones/zoneEdits';
import type { ZoneStroke } from '../zones/zone.types';
import { outsideFieldBlockExists } from './autoplayArable';
import { housingLotsStillNeeded, interiorHouseSites } from './autoplayInteriorPlots';
import type { GameState } from './engine.types';
import { LORD_MODE_POLICY } from './townAgency';

/**
 * LOT-FIX (lord mode, the user's ruling 2026-10-22): a walled town that still wants lots and has no free house site left
 * inside its wall gives one field cell inside the wall back as a house site — the enclosed fields of the hamlet become
 * burgage plots, as walled towns did. The charter's ring takes in most of the hamlet's fields (20 of 23 seeds on the
 * trunk, DGX engine-LOTFIX-wall-trunk-c396781); a town still short of houses then finds every interior site under a
 * field (seeds 26 and 39 under FOOD-P2 stopped at 21 houses, engine-LOTFIX-wall-p2-dbe33af). At a season's close, only:
 *  - the wall closed (`palisade.closedTick`, save v57), lots still wanted (`housingLotsStillNeeded`, the lord's 24);
 *  - no free interior house site the housing step could take (grass, beside a road, under no zone);
 *  - a field cell inside the wall that is such a site but for its field;
 *  - and room for a field block outside the wall (`outsideFieldBlockExists`), so the wheat can move out, not vanish.
 * One cell a season (a house is one cell); the cell keeps every house rule — no new zone kind, the field simply ends.
 */
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

function housingSite(state: GameState, site: TileCoordinate): boolean {
  const tile = state.tiles[site.ty * state.width + site.tx];
  return tile?.terrain === 'grass' && SIDES.some(([dx, dy]) => state.tiles[(site.ty + dy) * state.width + site.tx + dx]?.hasRoad === true);
}

function cellStroke(cell: TileCoordinate): ZoneStroke {
  return { tool: 'polygon', points: [{ x: cell.tx, y: cell.ty }, { x: cell.tx + 1, y: cell.ty }, { x: cell.tx + 1, y: cell.ty + 1 }, { x: cell.tx, y: cell.ty + 1 }] };
}

/** The enclosed field cell to give back as a house site now, or null. */
export function enclosedFieldLot(state: GameState): TileCoordinate | null {
  const wall = state.palisade;
  if (state.agency === undefined || wall === null || wall.closedTick === undefined) return null;
  if (housingLotsStillNeeded(state, LORD_MODE_POLICY.maxHousingLots) === 0) return null;
  const zones = zonesOf(state);
  const zoned = new Set(zones.flatMap(zone => zone.membership));
  const arable = new Set(zones.filter(zone => zone.kind === 'arable').flatMap(zone => zone.membership));
  const sites = interiorHouseSites(state).filter(site => housingSite(state, site));
  if (sites.some(site => !zoned.has(site.ty * state.width + site.tx))) return null;
  const fields = sites.filter(site => arable.has(site.ty * state.width + site.tx));
  if (fields.length === 0 || !outsideFieldBlockExists(state)) return null;
  return [...fields].sort((a, b) => a.ty - b.ty || a.tx - b.tx)[0]!;
}

/** LOT-FIX: at a season's close in lord mode, one enclosed field cell back to the town as a house site (see above). */
export function releaseEnclosedFieldLot(state: GameState): GameState {
  if (state.agency === undefined || state.tick <= 0 || state.tick % PRESSURE_BALANCE.seasonTicks !== 0) return state;
  const cell = enclosedFieldLot(state);
  return cell === null ? state : applyErase(state, cellStroke(cell));
}
