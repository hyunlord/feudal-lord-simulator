import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import type { House } from "../population/population.types";
import type { Tile } from "../world/world.types";

export const OPENING_VILLAGE_CENTER = { tx: 45, ty: 41 } as const;
export const STARTING_HOUSE_ID = "house-46-40-0";
export const OPENING_VILLAGE_STARVATION_GRACE_TICKS = 6_000;

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
