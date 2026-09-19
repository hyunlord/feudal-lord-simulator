import type { TileEdgePoint } from "../world/palisadeGeometry";
import { GATE_HALF_CLEARANCE } from "../world/wallTraversal";
import type { StoneWallNode } from "./stoneWallTopology";

export function gatePortalBranches(node: StoneWallNode): readonly { readonly point: TileEdgePoint; readonly pier: boolean }[] {
  return [...node.neighbors].sort((a, b) => a.x - b.x || a.y - b.y).flatMap(neighbor => {
    const dx = neighbor.x - node.point.x; const dy = neighbor.y - node.point.y;
    const step = Math.max(Math.abs(dx), Math.abs(dy));
    if (step === 0) return [];
    const shared = node.clearanceGates?.some(gate => gate.x === neighbor.x && gate.y === neighbor.y) ?? false;
    const offset = shared ? 0.5 : (GATE_HALF_CLEARANCE + 0.15) / step;
    return [{ point: { x: node.point.x + dx * offset, y: node.point.y + dy * offset }, pier: !shared }];
  });
}

export function gateHasSharedOpening(node: StoneWallNode): boolean {
  return gatePortalBranches(node).some(branch => !branch.pier);
}
