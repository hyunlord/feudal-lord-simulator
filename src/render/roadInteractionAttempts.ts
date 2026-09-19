import { roadPlacementFailure, roadTimberCost } from "../engine/roadPlacement";
import type { GameState } from "../engine/engine.types";
import type { GameAction } from "../state/gameStore.types";
import { getTile, type TileCoordinate } from "../world/grid";
import { PlacementFailure } from "../world/placement";
import { roadLine } from "../world/roadGraph";
import {
  createPlacementFeedback,
  formatPlacementFailure,
  type PlacementFeedback,
} from "./placementFeedback";

export const MODELED_ROAD_TIMBER_COST = 0;

export type RoadAttemptOutcome = {
  readonly action: GameAction | null;
  readonly feedback: PlacementFeedback;
  readonly keepToolArmed: true;
};

export function resolveRoadPlacementAttempt(input: {
  readonly state: GameState;
  readonly start: TileCoordinate;
  readonly destination: TileCoordinate;
  readonly nowMs: number;
}): RoadAttemptOutcome {
  const path = roadLine(input.start, input.destination);
  const failure = roadFailure(input.state, path);
  if (failure !== null) {
    return {
      action: null,
      feedback: createPlacementFeedback({
        kind: "failure",
        message: failure === PlacementFailure.wrong_terrain ? "다리는 풀밭 양안을 직선으로 연결하세요 (물 최대 8칸)" : failure === PlacementFailure.insufficient_materials ? `다리 목재가 부족합니다 (필요 ${roadTimberCost(input.state, path)})` : formatPlacementFailure({ reason: failure, buildingKind: "house" }),
        anchor: { kind: "path", path },
        nowMs: input.nowMs,
      }),
      keepToolArmed: true,
    };
  }

  return {
    action: { type: "place_road_line", start: input.start, destination: input.destination },
    feedback: createPlacementFeedback({
      kind: "success",
      message: `길을 놓았습니다 · 목재 ${roadTimberCost(input.state, path)}`,
      anchor: { kind: "path", path },
      nowMs: input.nowMs,
    }),
    keepToolArmed: true,
  };
}

export function resolveRoadRemovalAttempt(input: {
  readonly state: GameState;
  readonly tile: TileCoordinate;
  readonly nowMs: number;
}): RoadAttemptOutcome {
  const tile = getTile(input.state, input.tile);
  if (tile?.hasRoad !== true) {
    return {
      action: null,
      feedback: createPlacementFeedback({
        kind: "failure",
        message: "걷어낼 길이 없습니다",
        anchor: { kind: "tile", tile: input.tile },
        nowMs: input.nowMs,
      }),
      keepToolArmed: true,
    };
  }

  return {
    action: { type: "remove_road", tx: input.tile.tx, ty: input.tile.ty },
    feedback: createPlacementFeedback({
      kind: "success",
      message: "길을 걷어냈습니다",
      anchor: { kind: "tile", tile: input.tile },
      nowMs: input.nowMs,
    }),
    keepToolArmed: true,
  };
}

export function roadFailure(
  state: GameState,
  path: readonly TileCoordinate[],
): PlacementFailure | null {
  return roadPlacementFailure(state, path);
}
