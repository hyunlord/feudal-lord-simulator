import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingKind,
} from "../content/buildingConfig";
import type { TileCoordinate } from "../world/grid";
import { PlacementFailure } from "../world/placement";

const PLACEMENT_FEEDBACK_DURATION_MS = {
  success: 600,
  failure: 4500,
} as const;

export type PlacementTool =
  | {
      readonly kind: "building";
      readonly buildingKind: BuildingKind;
    }
  | {
      readonly kind: "road";
    };

export type PlacementFeedbackAnchor =
  | {
      readonly kind: "tile";
      readonly tile: TileCoordinate;
    }
  | {
      readonly kind: "path";
      readonly path: readonly TileCoordinate[];
    };

export type PlacementFeedbackKind = keyof typeof PLACEMENT_FEEDBACK_DURATION_MS;

export interface CreatePlacementFeedbackRequest {
  readonly kind: PlacementFeedbackKind;
  readonly message: string;
  readonly anchor: PlacementFeedbackAnchor;
  readonly nowMs: number;
}

export interface PlacementFeedback {
  readonly kind: PlacementFeedbackKind;
  readonly message: string;
  readonly anchor: PlacementFeedbackAnchor;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export type PlacementFailureReason = PlacementFailure;

function assertNever(value: never): string {
  return value;
}

export function formatPlacementFailure(
  reason: PlacementFailureReason,
  buildingKind: BuildingKind,
): string {
  switch (reason) {
    case PlacementFailure.occupied:
      return "이미 건물이 있습니다";
    case PlacementFailure.wrong_terrain:
      return "물 위에는 지을 수 없습니다";
    case PlacementFailure.out_of_bounds:
      return "영지 밖입니다";
    case PlacementFailure.needs_road:
      return "길에 닿아야 합니다 — 먼저 길을 놓으세요";
    case PlacementFailure.needs_adjacent_terrain:
      return "숲 옆에 지어야 합니다";
    case PlacementFailure.insufficient_timber: {
      const timberCost = BUILDING_CONFIG_BY_KIND[buildingKind].buildCost.timber ?? 0;
      return `목재가 부족합니다 (필요 ${timberCost})`;
    }
    case PlacementFailure.locked_era:
      return "목책마을 이후 건설할 수 있습니다";
    default:
      return assertNever(reason);
  }
}

export function getPlacementToolStatus(tool: PlacementTool | null): string {
  if (tool === null) return "도구를 선택하세요";

  switch (tool.kind) {
    case "building":
      return `지을 곳을 클릭하세요 — ${BUILDING_CONFIG_BY_KIND[tool.buildingKind].name} · 취소하려면 Esc`;
    case "road":
      return "드래그하여 길을 놓으세요 · 취소하려면 Esc";
    default:
      return assertNever(tool);
  }
}

export function createPlacementFeedback(
  request: CreatePlacementFeedbackRequest,
): PlacementFeedback {
  return {
    kind: request.kind,
    message: request.message,
    anchor: request.anchor,
    createdAtMs: request.nowMs,
    expiresAtMs: request.nowMs + PLACEMENT_FEEDBACK_DURATION_MS[request.kind],
  };
}

export function isPlacementFeedbackVisible(
  feedback: PlacementFeedback | null,
  nowMs: number,
): boolean {
  return feedback !== null && nowMs < feedback.expiresAtMs;
}
