import type { PalisadeSegment, PalisadeState } from "../engine/engine.types";
import {
  palisadePathVisible,
  palisadeRenderAnchor,
  palisadeSegmentPath,
} from "./palisadeRenderGeometry";
import type { TileRange } from "./renderVisibility";

export type PalisadeSegmentRenderItem = {
  readonly kind: "palisade_segment";
  readonly id: string;
  readonly segment: PalisadeSegment;
  readonly gate: PalisadeState["gate"] | null;
  readonly depth: number;
  readonly anchorTx: number;
};

export function palisadeSegmentRenderItems(
  palisade: PalisadeState | null | undefined,
  range: TileRange,
): readonly PalisadeSegmentRenderItem[] {
  if (palisade === undefined || palisade === null) return [];
  const items: PalisadeSegmentRenderItem[] = [];
  for (const segment of palisade.segments) {
    const item = palisadeSegmentRenderItem(segment, palisade, range);
    if (item !== null) items.push(item);
  }
  return items;
}

function palisadeSegmentRenderItem(
  segment: PalisadeSegment,
  palisade: PalisadeState,
  range: TileRange,
): PalisadeSegmentRenderItem | null {
  if (!segment.completed) return null;
  const path = palisadeSegmentPath(segment);
  if (!palisadePathVisible(path, range)) return null;
  const anchor = palisadeRenderAnchor(path);
  return {
    kind: "palisade_segment",
    id: segment.id,
    segment,
    gate: segmentHasGate(segment, palisade) ? palisade.gate : null,
    depth: anchor.depth,
    anchorTx: anchor.anchorTx,
  };
}

function segmentHasGate(segment: PalisadeSegment, palisade: PalisadeState): boolean {
  return segment.edgePath.some((point) =>
    point.x === palisade.gate.x && point.y === palisade.gate.y
  );
}
