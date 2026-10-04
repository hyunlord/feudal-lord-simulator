import { gateArtAxis, gateOffAxisPiers } from "./gateArtGeometry";
import { palisadeRenderAnchor } from "./palisadeRenderGeometry";
import { unitEdgeKey, type WallNode } from "../world/boundary/wallBaseline";
import type { TileEdgePoint } from "../world/palisadeGeometry";

// NAT-2 QA-003 (wall strips): which wall item draws a corner gate's art and which its off-axis pier. The art must lie
// over its axis arm's strip (its flank covers that arm's cleared end, as at a straight gate) and over an off-axis arm
// that runs back, under one that runs forward; the pier caps the off-axis arm's strip, so that arm's item draws it
// after its own face. So the axis arm's item draws the art, or, when the off-axis arm runs back, whichever of the two
// the object queue draws last (compareRenderItems: depth, anchor tx, then id). Straight gates keep their owner.

function drawnLast(point: TileEdgePoint, arms: readonly TileEdgePoint[], material: string): string {
  const order = arms.map(arm => ({ key: unitEdgeKey(point, arm), ...palisadeRenderAnchor([point, arm]) }))
    .sort((a, b) => a.depth - b.depth || a.anchorTx - b.anchorTx || `${material}:${a.key}`.localeCompare(`${material}:${b.key}`));
  return (order[order.length - 1] as { key: string }).key;
}

/** The end module capping a gate's arm (drawWallModules: a corner gate's off-axis pier, QA-003 the jamb or door post),
 * with the gate it stands by. */
export type GateEndNode = WallNode & { readonly gateEnd: true; readonly gate: TileEdgePoint };

/** The modules the wall item of unit edge `key` draws for a corner gate with art (its piers as end modules, in draw
 * order), or null for any other node. */
export function cornerGateModules(node: WallNode, key: string): readonly WallNode[] | null {
  if (node.kind !== "gate") return null;
  const legacy = { point: node.point, neighbors: node.neighbors, kind: "gate" as const };
  const axis = gateArtAxis(legacy);
  const piers = gateOffAxisPiers(legacy);
  if (axis === null || piers.behind.length + piers.front.length === 0) return null;
  const axisArm = node.neighbors.find(arm => (axis === "descending" ? arm.y === node.point.y : arm.x === node.point.x));
  const offArm = node.neighbors.find(arm => arm !== axisArm);
  if (axisArm === undefined || offArm === undefined) return null;
  const offKey = unitEdgeKey(node.point, offArm);
  const artKey = piers.behind.length > 0 ? drawnLast(node.point, [axisArm, offArm], node.materials.includes("stone") ? "stone" : "timber")
    : unitEdgeKey(node.point, axisArm);
  const pier = (point: TileEdgePoint): GateEndNode => ({ ...node, kind: "terminal", point, neighbors: [], gateEnd: true, gate: node.point });
  return [...(key === offKey ? piers.behind.map(pier) : []), ...(key === artKey ? [node] : []), ...(key === offKey ? piers.front.map(pier) : [])];
}
