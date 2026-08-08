import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingKind,
} from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
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

export type FormatPlacementFailureRequest = {
  readonly reason: PlacementFailureReason;
  readonly buildingKind: BuildingKind;
  readonly shortfalls?: Partial<Record<ResourceType, number>>;
};

function assertNever(value: never): string {
  return value;
}

export function formatPlacementFailure(
  request: FormatPlacementFailureRequest,
): string {
  const reason = request.reason;
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
    case PlacementFailure.insufficient_materials: {
      const shortfallLabel = resourceAmountsLabel(request.shortfalls ?? {});
      if (shortfallLabel !== "없음") return `자원이 부족합니다 — ${shortfallLabel}`;
      const timberCost = BUILDING_CONFIG_BY_KIND[request.buildingKind].buildCost.timber ?? 0;
      return `목재가 부족합니다 (필요 ${timberCost})`;
    }
    case PlacementFailure.locked_era:
      return "목책마을 이후 건설할 수 있습니다";
    default:
      return assertNever(reason);
  }
}

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
  stone_raw: "원석",
  stone: "석재",
  coin: "금화",
} as const satisfies Record<ResourceType, string>;

function resourceAmountsLabel(amounts: Partial<Record<ResourceType, number>>): string {
  const parts = RESOURCE_TYPES
    .filter((resource) => (amounts[resource] ?? 0) > 0)
    .map((resource) => `${RESOURCE_LABELS[resource]} ${amounts[resource] ?? 0}`);
  return parts.length === 0 ? "없음" : parts.join(" · ");
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
