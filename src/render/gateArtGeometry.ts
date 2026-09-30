import { GATE_HALF_CLEARANCE } from '../world/wallTraversal';
import type { StoneWallNode } from './stoneWallTopology';
import type { StoneWallAxis } from './stoneWallGeometry';
import type { TileEdgePoint } from '../world/palisadeGeometry';
import { gateHasSharedOpening, gatePortalBranches } from './gatePortalBranches';
export type GateMaterial = 'stone' | 'timber';
export const GATE_REGISTRATION = {
  stone: {
    descending: { left: { x: 530, y: 792 }, right: { x: 782, y: 962 }, heightScale: 0.048 },
    ascending: { left: { x: 492, y: 1050 }, right: { x: 784, y: 876 }, heightScale: 0.048 },
  },
  timber: {
    descending: { left: { x: 354, y: 763 }, right: { x: 900, y: 1105 }, heightScale: 0.060 },
    ascending: { left: { x: 302, y: 1165 }, right: { x: 950, y: 834 }, heightScale: 0.060 },
  },
} as const;
// NAT-2 QA-003: the engine sets gates on wall corners (every fixture gate on a finished wall is one: a 90 degree turn,
// or an axis arm meeting a diagonal one), where no art was drawn and both cleared arms read as a gap. A corner gate
// draws the art of an axis arm, centred on the gate point as a straight gate (its passage is that arm's traversal
// clearance); the other arm keeps its clearance (walkers cross it too) and ends in a pier (gateOffAxisPiers).
// At a 90 degree corner the art takes the arm whose partner runs back (up the screen), so that arm starts behind the
// gatehouse instead of crossing in front of its passage; a tie (both back or both front) takes descending.
const armAxis = (node: StoneWallNode, arm: TileEdgePoint): StoneWallAxis | null =>
  arm.y === node.point.y ? 'descending' : arm.x === node.point.x ? 'ascending' : null;
export function gateArtAxis(node: StoneWallNode): StoneWallAxis | null {
  if (node.kind !== 'gate' || node.neighbors.length !== 2) return null;
  const [a,b] = node.neighbors;
  if (!a || !b) return null;
  if (a.y === node.point.y && b.y === node.point.y && (a.x-node.point.x)*(b.x-node.point.x)<0) return 'descending';
  if (a.x === node.point.x && b.x === node.point.x && (a.y-node.point.y)*(b.y-node.point.y)<0) return 'ascending';
  if (a.x-node.point.x === -(b.x-node.point.x) && a.y-node.point.y === -(b.y-node.point.y)) return null;
  const axes = [armAxis(node, a), armAxis(node, b)];
  if (axes[0] === null || axes[1] === null) return axes[0] ?? axes[1] ?? null;
  const [xArm, yArm] = axes[0] === 'descending' ? [a, b] : [b, a];
  return yArm.y < node.point.y || xArm.x >= node.point.x ? 'descending' : 'ascending';
}
/** NAT-2 QA-003: the pier points ending a corner gate's off-axis arm, split by depth about the gate (behind: drawn
 * before the art, front: after it). None for a straight gate, a gate without art or one sharing an opening. */
export function gateOffAxisPiers(node: StoneWallNode): { readonly behind: readonly TileEdgePoint[]; readonly front: readonly TileEdgePoint[] } {
  const axis = gateArtAxis(node);
  if (axis === null || gateHasSharedOpening(node)) return { behind: [], front: [] };
  const off = gatePortalBranches(node).filter(branch => branch.pier && armAxis(node, branch.point) !== axis).map(branch => branch.point);
  const depth = node.point.x + node.point.y;
  return { behind: off.filter(point => point.x + point.y < depth), front: off.filter(point => point.x + point.y >= depth) };
}
type GateRegistration = { readonly left: { readonly x: number; readonly y: number }; readonly right: { readonly x: number; readonly y: number }; readonly heightScale: number };
export function gateArtPanels(material: GateMaterial, axis: StoneWallAxis, source: GateRegistration = GATE_REGISTRATION[material][axis]) {
  const half = GATE_HALF_CLEARANCE * 32;
  const flankScale = material === 'stone' ? 0.042 : 0.055;
  return [
    { sourceLeft: 0, sourceRight: source.left.x, targetLeft: -half-source.left.x*flankScale, targetRight: -half },
    { sourceLeft: source.left.x, sourceRight: source.right.x, targetLeft: -half, targetRight: half },
    { sourceLeft: source.right.x, sourceRight: 1254, targetLeft: half, targetRight: half+(1254-source.right.x)*flankScale },
  ];
}
