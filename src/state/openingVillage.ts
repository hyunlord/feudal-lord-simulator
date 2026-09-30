import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import type { House } from "../population/population.types";
import type { GameState } from "../engine/engine.types";
import { householdServices } from "../engine/householdServices";
import { MANOR_HOUSEHOLD } from "../engine/persons.types";
import { zonesOf } from "../zones/zoneEdits";
import type { Tile } from "../world/world.types";

export const OPENING_VILLAGE_CENTER = { tx: 45, ty: 41 } as const;
export const STARTING_HOUSE_ID = "house-46-40-0";
export const OPENING_VILLAGE_STARVATION_GRACE_TICKS = 6_000;

// FIX-11 (11, MH-1): the manor house's wanted site, north-west of the opening village (ten tiles west and four north of
// the first cottage); it takes the nearest free grass 2×2 to it.
export const MANOR_HOUSE_TX = 36;
export const MANOR_HOUSE_TY = 36;
export const MANOR_HOUSE_ID = "manor-house-36-36-0";
const MANOR_FROM_FIRST_COTTAGE = { dx: -10, dy: -4 } as const;
/** MH-1: how far (tiles, each way) from the wanted site the manor house looks for free grass. */
const MANOR_SEARCH_REACH = 16;
/** MH-1: no building or road within this many tiles of the manor house's footprint when it is placed. */
const MANOR_CLEARANCE = 5;

const COTTAGE_ORIGINS = [
  { tx: 44, ty: 40 },
  { tx: 46, ty: 40 },
  { tx: 44, ty: 42 },
  { tx: 46, ty: 42 },
] as const;

const ROAD_ORIGINS = [
  { tx: 43, ty: 39 },
  { tx: 44, ty: 39 },
  { tx: 45, ty: 39 },
  { tx: 46, ty: 39 },
  { tx: 47, ty: 39 },
  { tx: 43, ty: 40 },
  { tx: 47, ty: 40 },
  { tx: 43, ty: 41 },
  { tx: 44, ty: 41 },
  { tx: 46, ty: 41 },
  { tx: 47, ty: 41 },
  { tx: 48, ty: 41 },
  { tx: 49, ty: 41 },
  { tx: 50, ty: 41 },
] as const;

const OPENING_BUILDINGS = [
  ...COTTAGE_ORIGINS.map(({ tx, ty }) => ({
    id: cottageId(tx, ty),
    kind: "house" as const,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  })),
  {
    id: `well-${OPENING_VILLAGE_CENTER.tx}-${OPENING_VILLAGE_CENTER.ty}-0`,
    kind: "well",
    tx: OPENING_VILLAGE_CENTER.tx,
    ty: OPENING_VILLAGE_CENTER.ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  },
  {
    id: "granary-42-37-0",
    kind: "granary",
    tx: 42,
    ty: 37,
    workers: 2,
    inventory: { bread: 30 },
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  },
  {
    id: "logging-camp-50-40-0",
    kind: "logging_camp",
    tx: 50,
    ty: 40,
    workers: 3,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  },
  {
    id: "storehouse-41-40-0",
    kind: "storehouse",
    tx: 41,
    ty: 40,
    workers: 1,
    inventory: { logs: 20 },
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  },

] as const satisfies readonly Building[];

function cottageId(tx: number, ty: number): string {
  return `house-${tx}-${ty}-0`;
}

export function openingVillageBuildings(): readonly Building[] {
  return [...OPENING_BUILDINGS];
}

export function openingVillageHouses(): readonly House[] {
  const starting = COTTAGE_ORIGINS.find(
    ({ tx, ty }) => cottageId(tx, ty) === STARTING_HOUSE_ID,
  );
  const ordered = starting === undefined
    ? COTTAGE_ORIGINS
    : [
        starting,
        ...COTTAGE_ORIGINS.filter(({ tx, ty }) => cottageId(tx, ty) !== STARTING_HOUSE_ID),
      ];
  return ordered.map(({ tx, ty }) => ({
    buildingId: cottageId(tx, ty),
    level: 0,
    residents: 3,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    starvationGraceUntilTick: OPENING_VILLAGE_STARVATION_GRACE_TICKS,
    unmetRequirementTicks: 0,
  }));
}

export function applyOpeningVillageToTile(tile: Tile): Tile {
  const building = OPENING_BUILDINGS.find((candidate) => {
    const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
    return (
      tile.tx >= candidate.tx &&
      tile.tx < candidate.tx + definition.width &&
      tile.ty >= candidate.ty &&
      tile.ty < candidate.ty + definition.height
    );
  }) ?? null;
  const hasRoad = ROAD_ORIGINS.some((road) => road.tx === tile.tx && road.ty === tile.ty);
  if (building === null && !hasRoad) return tile;
  return {
    ...tile,
    buildingId: building?.id ?? tile.buildingId,
    hasRoad: tile.hasRoad || hasRoad,
  };
}

/**
 * FIX-1: a new game shows the services its village already has. Houses are created without water and the tick sets
 * `hasWater` from the service allocation (`updateHousing`), so a paused first frame reported a missing well beside
 * the village well. The same allocation runs once here when the state is made; nothing else changes (bread still
 * arrives by distribution, and the opening grace covers it).
 */
export function withOpeningVillageServices<State extends GameState>(state: State): State {
  const services = householdServices(state);
  return { ...state, houses: state.houses.map(house => {
    const hasWater = services.houses.get(house.buildingId)?.water.kind === "served";
    return hasWater === house.hasWater ? house : { ...house, hasWater };
  }) };
}

/**
 * FIX-11 (11, MH-1, MH-2): gives a town its manor house — a new map (every land, every opening) and a save from before
 * FIX-11 (the v35 migration). The free 2×2 nearest to ten tiles west and four north of the first cottage (the opening
 * village's north-west, (36,36) on the default opening), within sixteen tiles of it — free means grass and no painted
 * zone, with no building or road within five tiles. A town with no free 2×2 left keeps no manor house (the family then shows as "시골 장원", UI10-D2).
 * Pure: returns a new state.
 */
export function placeManorSite<State extends GameState>(state: State): State {
  if (state.buildings.some(building => building.kind === "manor_house")) return state;
  const def = BUILDING_CONFIG_BY_KIND.manor_house;
  const zoned = new Set(zonesOf(state).flatMap(zone => zone.membership));
  const free = (tx: number, ty: number): boolean => {
    for (let dy = 0; dy < def.height; dy += 1) for (let dx = 0; dx < def.width; dx += 1) {
      const index = (ty + dy) * state.width + tx + dx;
      const tile = state.tiles[index];
      if (tile === undefined || tile.terrain !== "grass" || zoned.has(index)) return false;
    }
    // MH-1: clear of the village by MANOR_CLEARANCE tiles, so the living core's wall (margin 2–3) and its roads keep
    // their room; the town grows up to it later.
    for (let y = ty - MANOR_CLEARANCE; y < ty + def.height + MANOR_CLEARANCE; y += 1) {
      for (let x = tx - MANOR_CLEARANCE; x < tx + def.width + MANOR_CLEARANCE; x += 1) {
        const tile = x < 0 || y < 0 || x >= state.width || y >= state.height ? undefined : state.tiles[y * state.width + x];
        if (tile !== undefined && (tile.buildingId !== null || tile.hasRoad)) return false;
      }
    }
    return true;
  };
  const cottage = state.buildings.filter(building => building.kind === "house").sort((left, right) => left.ty - right.ty || left.tx - right.tx)[0];
  const want = cottage === undefined ? { tx: MANOR_HOUSE_TX, ty: MANOR_HOUSE_TY }
    : { tx: cottage.tx + MANOR_FROM_FIRST_COTTAGE.dx, ty: cottage.ty + MANOR_FROM_FIRST_COTTAGE.dy };
  const sites: { tx: number; ty: number; distance: number }[] = [];
  const low = (value: number) => Math.max(0, value - MANOR_SEARCH_REACH);
  for (let ty = low(want.ty); ty + def.height - 1 <= Math.min(state.height - 1, want.ty + MANOR_SEARCH_REACH); ty += 1) {
    for (let tx = low(want.tx); tx + def.width - 1 <= Math.min(state.width - 1, want.tx + MANOR_SEARCH_REACH); tx += 1) {
      if (free(tx, ty)) sites.push({ tx, ty, distance: (tx - want.tx) ** 2 + (ty - want.ty) ** 2 });
    }
  }
  const site = sites.sort((left, right) => left.distance - right.distance || left.ty - right.ty || left.tx - right.tx)[0];
  if (site === undefined) return state;
  const id = `manor-house-${site.tx}-${site.ty}-0`;
  const manor: Building = { id, kind: "manor_house", tx: site.tx, ty: site.ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const tiles = state.tiles.map(tile =>
    tile.tx >= site.tx && tile.tx < site.tx + def.width && tile.ty >= site.ty && tile.ty < site.ty + def.height ? { ...tile, buildingId: id } : tile);
  return { ...state, buildings: [...state.buildings, manor], tiles };
}

/**
 * FIX-11 (11): true when the manor house has no lord's household members assigned (empty display — the lord's
 * family has not yet been established or all members have died or left).
 */
export function manorVacant(state: GameState): boolean {
  return !(state.persons?.people ?? []).some(p => p.householdId === MANOR_HOUSEHOLD);
}
