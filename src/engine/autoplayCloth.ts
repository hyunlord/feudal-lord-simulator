/**
 * C5 (spec docs/design/cloth-chain.md CL-11): the bot's cloth chain once chapter 3 is over (the campaign's chapter 4, the
 * sandbox's from 1364) — pasture first (two 6×6 strokes outside the wall), a pastoral farm beside it, then the weaver's
 * house, the fulling mill and the dyehouse (both by the water) and the tenter yard, one at a time. The spinning and the
 * market's sale are the rules' own. Chapters 1–3 are left as they were (decision CL7).
 *
 * F4-A (RG-11): in chapter 4, once the first cloth is sold, a second weaver's house (the textile street); once the lord
 * turns to cloth, pasture to 120 cells, a second pastoral farm where 30 cells or more lie beyond the first's reach, and a
 * second tenter yard.
 */
import { CHAPTER_THREE } from '../content/chapterConfig';
import { CLOTH_BALANCE } from '../content/clothConfig';
import { PLAGUE_BALANCE } from '../content/plagueConfig';
import { CLOTH_OR_GRAIN_PETITION_ID } from '../content/reorganisationConfig';
import type { BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import type { TileCoordinate } from '../geometry/tileGeometry';
import type { ZoneStroke } from '../zones/zone.types';
import { cellInsideWall, zonesOf } from '../zones/zoneEdits';
import type { AutoplayAction } from './autoplay.types';
import type { GameState } from './engine.types';
import { calendar, scenarioOf } from './scenarioState';

const NONE: AutoplayAction = { kind: 'none' };
/** CL-11: the pasture the bot paints (cells), each stroke a square this wide, and the least open cells a stroke takes. */
export const BOT_PASTURE_CELLS = 60;
/** RG-11: the pasture of a town turned to cloth. */
export const BOT_SPECIALISED_PASTURE_CELLS = 120;
/** RG-11: the untended pasture (cells) that asks for a second pastoral farm. */
const BOT_UNTENDED_CELLS = 30;
const STROKE = 6;
const MIN_OPEN = 30;
const CHAIN: readonly BuildingKind[] = ['weaver_house', 'fulling_mill', 'dyehouse', 'tenter_yard'];
type ClothBuildAction = (state: GameState, kind: BuildingKind, accepts?: (coordinate: TileCoordinate) => boolean) => AutoplayAction;

/** CL-11: the bot builds cloth after chapter 3 (campaign), from 1364 in the sandbox. */
export function clothTime(state: GameState): boolean {
  if (scenarioOf(state).mode === 'campaign') return (state.politics?.chapter.number ?? 1) > CHAPTER_THREE.chapter;
  return calendar(state.tick, scenarioOf(state).startYear).year >= PLAGUE_BALANCE.chapterEndYear;
}

function builtOrPlanned(state: GameState, kind: BuildingKind): boolean {
  return countBuiltOrPlanned(state, kind) > 0;
}

function countBuiltOrPlanned(state: GameState, kind: BuildingKind): number {
  return state.buildings.filter(building => building.kind === kind).length
    + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;
}

function openCell(state: GameState, tx: number, ty: number, zoned: ReadonlySet<number>): boolean {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  const index = ty * state.width + tx;
  const tile = state.tiles[index]!;
  return tile.terrain === 'grass' && tile.buildingId === null && !tile.hasRoad && !zoned.has(index) && !cellInsideWall(state, index);
}

function square(anchor: TileCoordinate): ZoneStroke {
  return { tool: 'polygon', points: [{ x: anchor.tx, y: anchor.ty }, { x: anchor.tx + STROKE, y: anchor.ty },
    { x: anchor.tx + STROKE, y: anchor.ty + STROKE }, { x: anchor.tx, y: anchor.ty + STROKE }] };
}

/** CL-11: a pasture square of open grass outside the wall, nearest the town's storehouses (then the lived-in houses). */
function pastureStroke(state: GameState): AutoplayAction {
  const zoned = new Set(zonesOf(state).flatMap(zone => zone.membership));
  const pasture = zonesOf(state).filter(zone => zone.kind === 'pasture').flatMap(zone => zone.membership);
  const anchors = state.buildings.filter(building => building.kind === 'storehouse');
  const centre = pasture.length > 0
    ? { tx: pasture.reduce((sum, index) => sum + index % state.width, 0) / pasture.length, ty: pasture.reduce((sum, index) => sum + Math.floor(index / state.width), 0) / pasture.length }
    : anchors.length > 0 ? { tx: anchors[0]!.tx, ty: anchors[0]!.ty } : { tx: state.width / 2, ty: state.height / 2 };
  let best: { anchor: TileCoordinate; distance: number } | null = null;
  for (let ty = 0; ty + STROKE <= state.height; ty += 2) {
    for (let tx = 0; tx + STROKE <= state.width; tx += 2) {
      let open = 0;
      for (let dy = 0; dy < STROKE; dy += 1) for (let dx = 0; dx < STROKE; dx += 1) if (openCell(state, tx + dx, ty + dy, zoned)) open += 1;
      if (open < MIN_OPEN) continue;
      const distance = Math.abs(tx + STROKE / 2 - centre.tx) + Math.abs(ty + STROKE / 2 - centre.ty);
      if (best === null || distance < best.distance || (distance === best.distance && (ty < best.anchor.ty || (ty === best.anchor.ty && tx < best.anchor.tx)))) best = { anchor: { tx, ty }, distance };
    }
  }
  return best === null ? NONE : { kind: 'paint_zone', zone: 'pasture', stroke: square(best.anchor) };
}

/** CL-11: the bot's next cloth step, or none. */
export function clothChainAction(state: GameState, buildAction: ClothBuildAction): AutoplayAction {
  if (!clothTime(state) || state.era === 'hamlet') return NONE;
  const pasture = zonesOf(state).filter(zone => zone.kind === 'pasture').flatMap(zone => zone.membership);
  if (pasture.length < BOT_PASTURE_CELLS) return pastureStroke(state);
  const reach = (farm: TileCoordinate, index: number) => Math.max(Math.abs(index % state.width - farm.tx),
    Math.abs(Math.floor(index / state.width) - farm.ty)) <= CLOTH_BALANCE.pastoralReach;
  if (!builtOrPlanned(state, 'pastoral_farm')) {
    // Beside the pasture, within its reach of most of it.
    return buildAction(state, 'pastoral_farm', coordinate => pasture.filter(index => reach(coordinate, index)).length * 2 >= pasture.length);
  }
  for (const kind of CHAIN) if (!builtOrPlanned(state, kind)) return buildAction(state, kind);
  // RG-11: chapter 4's cloth town — the textile street once cloth sells, the sheep once the lord turns to cloth.
  const reorganisation = state.reorganisation;
  if (reorganisation === undefined || reorganisation.clothSold <= 0) return NONE;
  if (countBuiltOrPlanned(state, 'weaver_house') < 2) return buildAction(state, 'weaver_house');
  if (reorganisation.answers[CLOTH_OR_GRAIN_PETITION_ID] !== 'accept') return NONE;
  if (pasture.length < BOT_SPECIALISED_PASTURE_CELLS) return pastureStroke(state);
  const farms = state.buildings.filter(building => building.kind === 'pastoral_farm');
  const untended = pasture.filter(index => !farms.some(farm => reach(farm, index)));
  if (untended.length >= BOT_UNTENDED_CELLS && countBuiltOrPlanned(state, 'pastoral_farm') < 2) {
    return buildAction(state, 'pastoral_farm', coordinate => untended.filter(index => reach(coordinate, index)).length * 2 >= untended.length);
  }
  if (countBuiltOrPlanned(state, 'tenter_yard') < 2) return buildAction(state, 'tenter_yard');
  return NONE;
}
