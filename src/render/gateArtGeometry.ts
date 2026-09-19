import { GATE_HALF_CLEARANCE } from '../world/wallTraversal';
import type { StoneWallNode } from './stoneWallTopology';
import type { StoneWallAxis } from './stoneWallGeometry';
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
export function gateArtAxis(node: StoneWallNode): StoneWallAxis | null {
  if (node.kind !== 'gate' || node.neighbors.length !== 2) return null;
  const [a,b] = node.neighbors;
  if (!a || !b) return null;
  if (a.y === node.point.y && b.y === node.point.y && (a.x-node.point.x)*(b.x-node.point.x)<0) return 'descending';
  if (a.x === node.point.x && b.x === node.point.x && (a.y-node.point.y)*(b.y-node.point.y)<0) return 'ascending';
  return null;
}
export function gateArtPanels(material: GateMaterial, axis: StoneWallAxis) {
  const source = GATE_REGISTRATION[material][axis];
  const half = GATE_HALF_CLEARANCE * 32;
  const flankScale = material === 'stone' ? 0.042 : 0.055;
  return [
    { sourceLeft: 0, sourceRight: source.left.x, targetLeft: -half-source.left.x*flankScale, targetRight: -half },
    { sourceLeft: source.left.x, sourceRight: source.right.x, targetLeft: -half, targetRight: half },
    { sourceLeft: source.right.x, sourceRight: 1254, targetLeft: half, targetRight: half+(1254-source.right.x)*flankScale },
  ];
}
