import type { Building } from "../economy/economy.types";

export type HouseMaterialEra = "hamlet" | "palisade" | "stone";

export type HouseMaterialWave = {
  readonly startedAtMs: number;
  readonly orderedHouseIds: readonly string[];
  readonly targetMaterialEra: Exclude<HouseMaterialEra, "hamlet">;
};

type Point = {
  readonly x: number;
  readonly y: number;
};

const WAVE_DURATION_MS = 4_000;

export function createHouseMaterialWave(input: {
  readonly buildings: readonly Building[];
  readonly center: Point;
  readonly startedAtMs: number;
  readonly targetMaterialEra?: Exclude<HouseMaterialEra, "hamlet">;
}): HouseMaterialWave {
  return {
    startedAtMs: input.startedAtMs,
    targetMaterialEra: input.targetMaterialEra ?? "palisade",
    orderedHouseIds: [...input.buildings]
      .filter((building): building is Building => building.kind === "house")
      .sort((left, right) => compareHouseWaveOrder(left, right, input.center))
      .map((building) => building.id),
  };
}

export function houseMaterialEraForBuilding(input: {
  readonly building: Building;
  readonly wave: HouseMaterialWave | null;
  readonly nowMs: number;
  readonly era?: HouseMaterialEra;
}): HouseMaterialEra {
  const fallback = input.era ?? "hamlet";
  if (input.building.kind !== "house" || input.wave === null) return fallback;
  const index = input.wave.orderedHouseIds.indexOf(input.building.id);
  if (index < 0) return fallback;
  const elapsed = Math.max(0, input.nowMs - input.wave.startedAtMs);
  const completed = Math.min(
    input.wave.orderedHouseIds.length,
    Math.floor(elapsed / WAVE_DURATION_MS * input.wave.orderedHouseIds.length),
  );
  return index < completed ? input.wave.targetMaterialEra : previousMaterialEra(input.wave.targetMaterialEra);
}

export function houseMaterialEraFromEra(era: "hamlet" | "palisade" | "stone_town"): HouseMaterialEra {
  switch (era) {
    case "hamlet":
      return "hamlet";
    case "palisade":
      return "palisade";
    case "stone_town":
      return "stone";
  }
}

export function palisadeCenter(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function compareHouseWaveOrder(left: Building, right: Building, center: Point): number {
  const distance = squaredDistance(left, center) - squaredDistance(right, center);
  return distance !== 0 ? distance : left.id.localeCompare(right.id);
}

function previousMaterialEra(target: Exclude<HouseMaterialEra, "hamlet">): HouseMaterialEra {
  switch (target) {
    case "palisade":
      return "hamlet";
    case "stone":
      return "palisade";
  }
}

function squaredDistance(building: Building, center: Point): number {
  return (building.tx - center.x) ** 2 + (building.ty - center.y) ** 2;
}
