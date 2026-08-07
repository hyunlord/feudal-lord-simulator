import type { ResourceType } from "../content/resourceConfig";
import type { Building } from "../economy/economy.types";
import type { GameState, ForestHarvest } from "./engine.types";

export const STUMP_OLD_AFTER_TICKS = 600;

export type StumpAge = "fresh" | "old";

type ForestHarvestProductionInput = {
  readonly state: GameState;
  readonly building: Building;
  readonly produced: ResourceType | null;
};

const forestHarvestCoordinateKey = (harvest: Pick<ForestHarvest, "tx" | "ty">): string =>
  `${harvest.tx},${harvest.ty}`;

const forestHarvestOrder = (left: ForestHarvest, right: ForestHarvest): number =>
  left.harvestedAtTick - right.harvestedAtTick || left.ty - right.ty || left.tx - right.tx;

const manhattanDistance = (
  left: Pick<ForestHarvest, "tx" | "ty">,
  right: Pick<ForestHarvest, "tx" | "ty">,
): number => Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);

const canonicalForestHarvests = (
  harvests: readonly ForestHarvest[],
): readonly ForestHarvest[] => [...harvests].sort(forestHarvestOrder);

const currentForestHarvests = (state: GameState): readonly ForestHarvest[] =>
  state.forestHarvests ?? [];

const nextVisualForestHarvest = (
  state: GameState,
  building: Building,
): ForestHarvest | null => {
  const recordedCoordinates = new Set(currentForestHarvests(state).map(forestHarvestCoordinateKey));
  const [nearest] = state.tiles
    .filter((tile) => tile.terrain === "forest" && !recordedCoordinates.has(forestHarvestCoordinateKey(tile)))
    .sort(
      (left, right) =>
        manhattanDistance(left, building) - manhattanDistance(right, building) ||
        left.ty - right.ty ||
        left.tx - right.tx,
    );
  return nearest === undefined
    ? null
    : { tx: nearest.tx, ty: nearest.ty, harvestedAtTick: state.tick };
};

export function forestHarvestsAfterProduction(
  input: ForestHarvestProductionInput,
): readonly ForestHarvest[] {
  const existing = currentForestHarvests(input.state);
  if (input.building.kind !== "logging_camp" || input.produced !== "logs") return existing;
  const next = nextVisualForestHarvest(input.state, input.building);
  return next === null ? existing : canonicalForestHarvests([...existing, next]);
}

export function stumpAgeAt(harvest: ForestHarvest, tick: number): StumpAge {
  return tick - harvest.harvestedAtTick >= STUMP_OLD_AFTER_TICKS ? "old" : "fresh";
}
