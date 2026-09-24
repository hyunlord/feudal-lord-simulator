/**
 * Toll points and carter crossings (spec M-4). A carter pays one toll each time it steps through the
 * opening of a gate on a completed wall stretch, or from a bank onto a bridge. Residents' own walkers
 * (distributors, builders) pay nothing; carters are today's outside traffic (goods and material carts).
 */
import type { SourceRef } from "../contracts";
import type { TileEdgePoint } from "../geometry/tileGeometry";
import type { TilePos, Walker } from "../agents/walker.types";
import { bridgeAt } from "../world/bridges";
import { getTile } from "../world/grid";
import { GATE_HALF_CLEARANCE, wallGatePoints } from "../world/wallTraversal";
import type { GameState, PalisadeState } from "./engine.types";

const EPSILON = 1e-9;

export function gatePointId(gate: TileEdgePoint): string {
  return `gate:${gate.x},${gate.y}`;
}

export function bridgePointId(firstWaterTile: TilePos): string {
  return `bridge:${firstWaterTile.tx},${firstWaterTile.ty}`;
}

/** The ledger source of a toll point: the lord's toll right at that gate or bridge. */
export function tollPointSource(pointId: string): SourceRef {
  return { type: "right", id: pointId, detail: pointId.startsWith("bridge:") ? "bridge" : "gate" };
}

/** Parses `gate:x,y` / `bridge:tx,ty` back to a map position (tile of the point); null for other ids. */
export function tollPointTile(pointId: string): TilePos | null {
  const match = /^(gate|bridge):(-?[\d.]+),(-?[\d.]+)$/.exec(pointId);
  if (match === null) return null;
  return { tx: Math.floor(Number(match[2])), ty: Math.floor(Number(match[3])) };
}

function cross(a: TileEdgePoint, b: TileEdgePoint, c: TileEdgePoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(point: TileEdgePoint, a: TileEdgePoint, b: TileEdgePoint): boolean {
  return Math.abs(cross(a, b, point)) < EPSILON &&
    point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON;
}

function intersects(a: TileEdgePoint, b: TileEdgePoint, c: TileEdgePoint, d: TileEdgePoint): boolean {
  if (onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b)) return true;
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
}

/** Gates standing on a completed stretch, with the wall piece each opening sits on. */
function builtGates(palisade: PalisadeState): readonly { readonly id: string; readonly point: TileEdgePoint; readonly piece: readonly [TileEdgePoint, TileEdgePoint] }[] {
  return wallGatePoints(palisade).flatMap(point => {
    for (const segment of palisade.segments) {
      if (!segment.completed) continue;
      for (let index = 1; index < segment.edgePath.length; index += 1) {
        const a = segment.edgePath[index - 1]; const b = segment.edgePath[index];
        if (a !== undefined && b !== undefined && onSegment(point, a, b)) return [{ id: gatePointId(point), point, piece: [a, b] as const }];
      }
    }
    return [];
  });
}

/** Gate a step between two tiles passes through, or null. The step crosses the wall inside the opening. */
function gateCrossed(palisade: PalisadeState, from: TilePos, to: TilePos): string | null {
  const a = { x: from.tx + 0.5, y: from.ty + 0.5 };
  const b = { x: to.tx + 0.5, y: to.ty + 0.5 };
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  for (const gate of builtGatesCached(palisade)) {
    if (Math.max(Math.abs(middle.x - gate.point.x), Math.abs(middle.y - gate.point.y)) > GATE_HALF_CLEARANCE) continue;
    if (intersects(a, b, gate.piece[0], gate.piece[1])) return gate.id;
  }
  return null;
}

/**
 * Built-gate cache (AGENTS rule 10). (a) Key: the palisade object (WeakMap); every wall edit or completed
 * stretch builds a new palisade object. (b) The result depends only on the palisade's gates and segments.
 * (c) Measured with the tick bench in docs/verification/c2-money/REPORT.md.
 */
const gateCache = new WeakMap<PalisadeState, ReturnType<typeof builtGates>>();
function builtGatesCached(palisade: PalisadeState): ReturnType<typeof builtGates> {
  const cached = gateCache.get(palisade);
  if (cached !== undefined) return cached;
  const gates = builtGates(palisade);
  gateCache.set(palisade, gates);
  return gates;
}

/** Every gate that currently collects toll and owes upkeep (completed stretch), in id order. */
export function builtGatePointIds(palisade: PalisadeState | null): readonly string[] {
  return palisade === null ? [] : builtGatesCached(palisade).map(gate => gate.id).sort();
}

function tollPointOfStep(state: Pick<GameState, "palisade" | "tiles" | "width" | "height">, from: TilePos, to: TilePos): string | null {
  if (Math.abs(from.tx - to.tx) + Math.abs(from.ty - to.ty) !== 1) return null;
  if (state.palisade !== null) {
    const gate = gateCrossed(state.palisade, from, to);
    if (gate !== null) return gate;
  }
  if (getTile(state, to)?.terrain !== "water" || getTile(state, from)?.terrain === "water") return null;
  const span = bridgeAt(state, to);
  return span === null ? null : bridgePointId(span.water[0] ?? to);
}

function addSteps(
  state: Pick<GameState, "palisade" | "tiles" | "width" | "height">,
  path: readonly TilePos[], fromIndex: number, toIndex: number, counts: Map<string, number>,
): void {
  for (let index = Math.max(1, fromIndex + 1); index <= Math.min(toIndex, path.length - 1); index += 1) {
    const from = path[index - 1]; const to = path[index];
    if (from === undefined || to === undefined) continue;
    const point = tollPointOfStep(state, from, to);
    if (point !== null) counts.set(point, (counts.get(point) ?? 0) + 1);
  }
}

/**
 * Crossings made by carters during one movement step, from the walkers before and after it.
 * A carter that kept its path walked from its old to its new path index; one that turned onto a new path
 * that starts where the old one ended first finished the old path; one that left finished its path.
 */
export function carterCrossings(
  state: Pick<GameState, "palisade" | "tiles" | "width" | "height">,
  before: readonly Walker[], after: readonly Walker[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const previous = new Map(before.filter(walker => walker.kind === "carter").map(walker => [walker.id, walker]));
  const same = (left: TilePos | undefined, right: TilePos | undefined) =>
    left !== undefined && right !== undefined && left.tx === right.tx && left.ty === right.ty;
  for (const walker of after) {
    if (walker.kind !== "carter") continue;
    const earlier = previous.get(walker.id);
    previous.delete(walker.id);
    if (earlier === undefined) continue;
    if (earlier.path === walker.path) {
      addSteps(state, walker.path, earlier.pathIndex, walker.pathIndex, counts);
      continue;
    }
    if (same(earlier.path[earlier.path.length - 1], walker.path[0])) {
      addSteps(state, earlier.path, earlier.pathIndex, earlier.path.length - 1, counts);
    }
    addSteps(state, walker.path, 0, walker.pathIndex, counts);
  }
  for (const gone of previous.values()) addSteps(state, gone.path, gone.pathIndex, gone.path.length - 1, counts);
  return counts;
}
