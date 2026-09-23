import type { ResourceType } from "../content/resourceConfig";

export type WallConstructionPriority = "balanced" | "priority";

export interface WallReserveSource {
  readonly id: string;
  readonly floor: number;
}

export interface WallConstructionReserve {
  readonly resource: "timber" | "stone";
  readonly sources: readonly WallReserveSource[];
  readonly proclaimedTick: number;
}

export function wallDeliveryAvailable(
  reserve: WallConstructionReserve | undefined,
  priority: WallConstructionPriority,
  sourceId: string,
  resource: ResourceType,
  available: number,
): number {
  if (priority === "priority" || reserve?.resource !== resource) return available;
  const floor = reserve.sources.find((source) => source.id === sourceId)?.floor ?? 0;
  return Math.max(0, available - floor);
}
