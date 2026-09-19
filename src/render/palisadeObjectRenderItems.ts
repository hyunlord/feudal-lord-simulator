import { timberGatePiers } from "./timberGateGeometry";
import type { PalisadeSegment, PalisadeState } from "../engine/engine.types";
import {
  palisadePathVisible,
  palisadeRenderAnchor,
  palisadeSegmentPath,
} from "./palisadeRenderGeometry";
import { stoneWallTopology, type StoneWallNode } from "./stoneWallTopology";
import type { TileRange } from "./renderVisibility";

export type PalisadeSegmentRenderItem = {
  readonly kind: "palisade_segment";
  readonly id: string;
  readonly segment: PalisadeSegment;
  readonly gate: PalisadeState["gate"] | null;
  readonly gates?: readonly PalisadeState["gate"][];
  readonly depth: number;
  readonly anchorTx: number;
  readonly stoneNodes?: readonly StoneWallNode[];
};

export function palisadeSegmentRenderItems(
  palisade: PalisadeState | null | undefined,
  range: TileRange,
): readonly PalisadeSegmentRenderItem[] {
  if (palisade === undefined || palisade === null) return [];
  const items: PalisadeSegmentRenderItem[] = [];
  const timberTopology = stoneWallTopology({ ...palisade, segments: palisade.segments
    .filter(segment => segment.material !== "stone")
    .map(segment => ({ ...segment, material: "stone" })) });
  for (const edge of timberTopology) {
    const segment = { ...edge.segment, material: "timber" as const };
    const item = palisadeSegmentRenderItem(segment, palisade, range);
    if (item !== null) items.push({ ...item, id: `timber:${edge.key}`, gate: edge.gate, gates: edge.gates,
      stoneNodes: edge.nodes.filter(node => node.kind === "gate") });
  }
  for (const edge of stoneWallTopology(palisade)) {
    const item = palisadeSegmentRenderItem(edge.segment, palisade, range);
    if (item !== null) items.push({ ...item, id: `stone:${edge.key}`, gate: edge.gate, gates: edge.gates, stoneNodes: edge.nodes });
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
  return timberGatePiers(segment.edgePath, palisade.gate).length > 0;
}
