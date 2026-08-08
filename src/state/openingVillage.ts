import type { Building } from "../content/buildingConfig";
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
  { tx: 45, ty: 41 },
  { tx: 46, ty: 41 },
  { tx: 47, ty: 41 },
  { tx: 48, ty: 41 },
  { tx: 49, ty: 41 },
  { tx: 50, ty: 41 },
  { tx: 51, ty: 41 },
  { tx: 52, ty: 41 },
] as const;

function cottageId(tx: number, ty: number): string {
  return `house-${tx}-${ty}-0`;
}

function openingBuildingAt(tx: number, ty: number): Building | null {
  if (tx === OPENING_VILLAGE_CENTER.tx && ty === OPENING_VILLAGE_CENTER.ty) {
    return {
      id: `well-${tx}-${ty}-0`,
      kind: "well",
      tx,
      ty,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    };
  }
  if (COTTAGE_ORIGINS.some((origin) => origin.tx === tx && origin.ty === ty)) {
    return {
      id: cottageId(tx, ty),
      kind: "house",
      tx,
      ty,
      workers: 0,
      inventory: {},
      reserved: {},
      stockReserved: {},
      productionProgress: 0,
    };
  }
  return null;
}

export function openingVillageBuildings(): readonly Building[] {
  const buildings = COTTAGE_ORIGINS.map(({ tx, ty }) => openingBuildingAt(tx, ty)).filter(
    (building): building is Building => building !== null,
  );
  const well = openingBuildingAt(OPENING_VILLAGE_CENTER.tx, OPENING_VILLAGE_CENTER.ty);
  return well === null ? buildings : [...buildings, well];
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
  const building = openingBuildingAt(tile.tx, tile.ty);
  const hasRoad = ROAD_ORIGINS.some((road) => road.tx === tile.tx && road.ty === tile.ty);
  if (building === null && !hasRoad) return tile;
  return {
    ...tile,
    buildingId: building?.id ?? tile.buildingId,
    hasRoad: tile.hasRoad || hasRoad,
  };
}
