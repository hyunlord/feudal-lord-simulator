// D1a-2 gate measurements in Node, shared by tests/roadRibbon.test.ts and the report JSON.
//   gate 1 junctions: pixels (zoom 1 screen space, 2x2 supersampled) covered by two or more different chain ribbons
//          around every degree >= 3 node; "before" = the D1a drawing (every chain runs to the node centre).
//   gate 2 portals: lateral offset of the drawn centreline from the structure axis over the locked span, and the
//          tangent angle difference, at every bridge deck start and gate crossing.
//   gate 3 walkers: distance from the drawn walker position to the ribbon centreline, sampled every 0.05 tile along
//          every chain's cell-centre path (the path walkers actually take).
//   gate 4 shoulders: same-variant tuft pairs closer than 4 tiles, spacing per side, and phase agreement of the sides.
// Usage: npx tsx scripts/roadRibbonGates.ts > docs/verification/d1a2-road/gates-node.json
import type { GameState } from "../src/engine/engine.types";
import { buildGroundBoundaryScene, type GroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { alignedRoadPosition, alignmentIndex, roadPull } from "../src/render/walkerRoadAlignment";
import { nearestPointOnPolyline, type BoundaryPoint } from "../src/world/boundary/boundaryGeometry";
import { polylineLength, type RoadChain } from "../src/world/boundary/roadCenterline";
import { SHOULDER_REPEAT_RADIUS, subLine } from "../src/world/boundary/roadRibbonLayout";
import { BOUNDARY_FIXTURES } from "./boundaryFixtureStates";

const round = (value: number): number => Math.round(value * 1000) / 1000;

type Quad = readonly BoundaryPoint[];
/** Screen-space quads (zoom 1, pixels) of one chain's ribbon between two arc lengths, at the drawn half width. */
function ribbonQuads(chain: RoadChain, from: number, to: number, halfWidth: number): Quad[] {
  const line = subLine(chain.closed ? [...chain.centreline, chain.centreline[0] as BoundaryPoint] : chain.centreline, from, to);
  const quads: Quad[] = [];
  for (let index = 0; index + 1 < line.length; index += 1) {
    const a = line[index] as BoundaryPoint; const b = line[index + 1] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-6) continue;
    const n = { x: -(b.y - a.y) / length * halfWidth, y: (b.x - a.x) / length * halfWidth };
    quads.push([{ x: a.x + n.x, y: a.y + n.y }, { x: b.x + n.x, y: b.y + n.y }, { x: b.x - n.x, y: b.y - n.y }, { x: a.x - n.x, y: a.y - n.y }].map(iso));
  }
  return quads;
}
const iso = (point: BoundaryPoint): BoundaryPoint => ({ x: (point.x - point.y) * 32, y: (point.x + point.y) * 16 });

function insideQuad(point: BoundaryPoint, quad: Quad): boolean {
  let sign = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const a = quad[index] as BoundaryPoint; const b = quad[(index + 1) % quad.length] as BoundaryPoint;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const current = Math.sign(cross);
    if (sign === 0) sign = current; else if (current !== sign) return false;
  }
  return true;
}

export function junctionOverlap(scene: GroundBoundaryScene): { junctions: number; degree3: number; degree4: number; overlapPx: number; beforeOverlapPx: number; armsReachCentre: boolean } {
  const { roads, ribbons } = scene;
  const halfWidth = ribbons.width / 2;
  let overlapPx = 0; let beforeOverlapPx = 0; let junctions = 0; let degree3 = 0; let degree4 = 0; let armsReachCentre = true;
  roads.fixedPoints.forEach((point, fixedIndex) => {
    const patch = ribbons.junctions[fixedIndex];
    if (patch === null || patch === undefined) return;
    junctions += 1;
    if (patch.arms.length >= 4) degree4 += 1; else degree3 += 1;
    for (const arm of patch.arms) {
      const first = arm.points[0] as BoundaryPoint;
      if (Math.hypot(first.x - point.tx, first.y - point.ty) > 1e-9) armsReachCentre = false;
    }
    const chains = [...new Set(patch.arms.flatMap(arm => arm.chain === null ? [] : [arm.chain]))];
    const after = chains.map(index => {
      const chain = roads.chains[index] as RoadChain; const trim = ribbons.trims[index] as { start: number; end: number };
      return ribbonQuads(chain, trim.start, polylineLength(chain.centreline) - trim.end, halfWidth);
    });
    const before = chains.map(index => { const chain = roads.chains[index] as RoadChain; return ribbonQuads(chain, 0, polylineLength(chain.centreline), halfWidth); });
    const centre = iso({ x: point.tx, y: point.ty });
    for (let y = centre.y - 40; y <= centre.y + 40; y += 0.5) for (let x = centre.x - 64; x <= centre.x + 64; x += 0.5) {
      const sample = { x, y };
      const count = (sets: Quad[][]): number => sets.filter(quads => quads.some(quad => insideQuad(sample, quad))).length;
      if (count(after) >= 2) overlapPx += 0.25;
      if (count(before) >= 2) beforeOverlapPx += 0.25;
    }
  });
  return { junctions, degree3, degree4, overlapPx, beforeOverlapPx: Math.round(beforeOverlapPx), armsReachCentre };
}

export type PortalRow = { kind: "gate" | "bridge"; cell: [number, number]; drawn: "chain" | "junction" | "plaza" | "stub"; span: number; maxLateral: number; maxAngleDeg: number; samples: number; plazaCovered?: boolean };

function pointInPolygon(point: BoundaryPoint, polygon: readonly BoundaryPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index] as BoundaryPoint; const b = polygon[previous] as BoundaryPoint;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function portalAlignment(scene: GroundBoundaryScene): PortalRow[] {
  const { roads } = scene;
  const rows: PortalRow[] = [];
  roads.fixedPoints.forEach(point => {
    for (const portal of point.portals) {
      const drawn: PortalRow["drawn"] = point.kinds.includes("plaza") ? "plaza" : point.degree + point.bridgeDirections.length >= 3 ? "junction"
        : point.degree === 0 ? "stub" : "chain";
      // Straight on past the cell centre only when the road leaves along the axis.
      const straightOn = roads.chains.some(chain => {
        const cells = chain.cells;
        return cells.some((cell, index) => cell.tx === point.tx && cell.ty === point.ty
          && [cells[index - 1], cells[index + 1]].some(next => next !== undefined && next.tx === point.tx + portal.axis.x && next.ty === point.ty + portal.axis.y));
      });
      const span = drawn === "chain" && straightOn ? 0.7 : 0.5;
      let maxLateral = 0; let maxAngle = 0; let samples = 0;
      if (drawn !== "plaza") {
        // The road through the portal: the crossing chain (gate), the chain that runs on along the axis, the chain
        // extended to the deck start, or a lone bank's stub (bridge). Side arms of a junction gate cell are not the portal.
        const fixedIndex = roads.fixedPoints.indexOf(point);
        const stubLines = (scene.ribbons.stubs[fixedIndex] ?? []).map(end => [{ x: point.tx, y: point.ty }, end]);
        const lines = [...stubLines, ...roads.chains.filter(chain => {
          const has = (tx: number, ty: number): boolean => chain.cells.some(cell => cell.tx === tx && cell.ty === ty);
          const endsAtAnchor = [chain.centreline[0], chain.centreline[chain.centreline.length - 1]]
            .some(end => end !== undefined && Math.hypot(end.x - portal.anchor.x, end.y - portal.anchor.y) < 1e-9);
          return has(point.tx, point.ty) && (endsAtAnchor || has(point.tx - portal.axis.x, point.ty - portal.axis.y) || has(point.tx + portal.axis.x, point.ty + portal.axis.y));
        }).map(chain => chain.centreline)];
        for (const line of lines) {
          if (line.length < 2) continue;
          for (let index = 1; index < line.length; index += 1) {
            const a = line[index - 1] as BoundaryPoint; const b = line[index] as BoundaryPoint;
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            if (length < 1e-9) continue;
            const steps = Math.max(1, Math.ceil(length / 0.02));
            for (let step = 0; step <= steps; step += 1) {
              const p = { x: a.x + (b.x - a.x) * step / steps, y: a.y + (b.y - a.y) * step / steps };
              const along = (p.x - portal.anchor.x) * portal.axis.x + (p.y - portal.anchor.y) * portal.axis.y;
              const lateral = Math.abs((p.x - portal.anchor.x) * portal.axis.y - (p.y - portal.anchor.y) * portal.axis.x);
              if (along < -1e-9 || along > span + 1e-9 || lateral > 0.5) continue;
              samples += 1;
              maxLateral = Math.max(maxLateral, lateral);
              // A chord that starts on the span end belongs to the curve beyond the lock.
              if (step === steps || along > span - 1e-6) continue;
              const cos = Math.abs(((b.x - a.x) * portal.axis.x + (b.y - a.y) * portal.axis.y) / length);
              maxAngle = Math.max(maxAngle, Math.acos(Math.min(1, cos)) * 180 / Math.PI);
            }
          }
        }
      }
      let plazaCovered: boolean | undefined;
      if (drawn === "plaza") {
        // The plaza outline must hold the ribbon-wide corridor from the opening to this (plaza) cell centre.
        const normal = { x: -portal.axis.y, y: portal.axis.x };
        const corridor: BoundaryPoint[] = [];
        for (let t = 0; t <= 0.5001; t += 0.1) for (const side of [-1, 1]) {
          corridor.push({ x: portal.anchor.x + portal.axis.x * t + normal.x * side * scene.ribbons.width / 2, y: portal.anchor.y + portal.axis.y * t + normal.y * side * scene.ribbons.width / 2 });
        }
        // Covered by the plaza fill or by the ribbon of a chain leaving this cell (the plaza's rounded corner).
        const leaving = roads.chains.filter(chain => chain.cells.some(cell => cell.tx === point.tx && cell.ty === point.ty));
        plazaCovered = corridor.every(sample => roads.plazaLoops.some(loop => pointInPolygon(sample, loop.smoothed))
          || leaving.some(chain => { const near = nearestPointOnPolyline(sample, chain.centreline, chain.closed); return Math.hypot(near.x - sample.x, near.y - sample.y) <= scene.ribbons.width / 2 + 1e-6; }));
      }
      rows.push({ kind: portal.kind, cell: [point.tx, point.ty], drawn, span, maxLateral: round(maxLateral), maxAngleDeg: round(maxAngle), samples, ...(plazaCovered === undefined ? {} : { plazaCovered }) });
    }
  });
  return rows;
}

export function walkerDeviation(scene: GroundBoundaryScene, state: GameState): { samples: number; before: number; after: number; afterFullPull: number } {
  const index = alignmentIndex(scene.roads, state.width, state.height, state.tiles);
  let samples = 0; let before = 0; let after = 0; let afterFullPull = 0;
  for (const chain of scene.roads.chains) {
    const cells = chain.closed ? [...chain.cells, chain.cells[0]] : chain.cells;
    for (let step = 1; step < cells.length; step += 1) {
      const a = cells[step - 1] as { tx: number; ty: number }; const b = cells[step] as { tx: number; ty: number };
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const position = { tx: a.tx + (b.tx - a.tx) * t, ty: a.ty + (b.ty - a.ty) * t };
        const tx = Math.round(position.tx); const ty = Math.round(position.ty);
        if (index.road[ty * state.width + tx] !== 1) continue;
        const chains = scene.roads.chains.filter(candidate => candidate.cells.some(cell => cell.tx === tx && cell.ty === ty));
        const distanceTo = (point: BoundaryPoint): number => Math.min(...chains.map(candidate => {
          const nearest = nearestPointOnPolyline(point, candidate.centreline, candidate.closed);
          return Math.hypot(nearest.x - point.x, nearest.y - point.y);
        }));
        const drawn = alignedRoadPosition(index, position);
        const raw = distanceTo({ x: position.tx, y: position.ty });
        const aligned = distanceTo({ x: drawn.tx, y: drawn.ty });
        samples += 1;
        before = Math.max(before, raw);
        after = Math.max(after, aligned);
        const pull = roadPull(index, position);
        if (pull !== null && Math.hypot(pull.x, pull.y) > 0 && aligned < 1e-6) afterFullPull = Math.max(afterFullPull, aligned);
      }
    }
  }
  return { samples, before: round(before), after: round(after), afterFullPull: round(afterFullPull) };
}

export function shoulderStats(scene: GroundBoundaryScene): { tufts: number; sameVariantWithin4: number; minSpacing: number; maxSpacing: number; sidesInPhase: number; chainsWithTufts: number } {
  const all = [...scene.ribbons.shoulders.flat(), ...scene.ribbons.capDecals.flatMap(decal => decal === null ? [] : [decal])];
  let same = 0;
  for (let i = 0; i < all.length; i += 1) for (let j = i + 1; j < all.length; j += 1) {
    const a = all[i]!; const b = all[j]!;
    if (a.variant === b.variant && Math.hypot(a.anchor.x - b.anchor.x, a.anchor.y - b.anchor.y) < SHOULDER_REPEAT_RADIUS) same += 1;
  }
  let minSpacing = Infinity; let maxSpacing = 0; let inPhase = 0; let pairs = 0; let chainsWithTufts = 0;
  for (const list of scene.ribbons.shoulders) {
    if (list.length > 0) chainsWithTufts += 1;
    for (const side of [1, -1] as const) {
      const arcs = list.filter(decal => decal.side === side).map(decal => decal.arc).sort((a, b) => a - b);
      for (let k = 1; k < arcs.length; k += 1) {
        const gap = (arcs[k] as number) - (arcs[k - 1] as number);
        // Gaps longer than the spacing mean a tuft between them was skipped (ground not free, or no variant left).
        if (gap <= 1.5 + 1e-9) { minSpacing = Math.min(minSpacing, gap); maxSpacing = Math.max(maxSpacing, gap); }
      }
    }
    const top = list.filter(decal => decal.side === 1).map(decal => decal.arc);
    const bottom = list.filter(decal => decal.side === -1).map(decal => decal.arc);
    for (const arc of top) { pairs += 1; if (bottom.some(other => Math.abs(other - arc) < 0.1)) inPhase += 1; }
  }
  return { tufts: all.length, sameVariantWithin4: same, minSpacing: round(minSpacing), maxSpacing: round(maxSpacing),
    sidesInPhase: pairs === 0 ? 0 : round(inPhase / pairs), chainsWithTufts };
}

export function ribbonGates(): unknown {
  return BOUNDARY_FIXTURES.map(fixture => {
    const state = fixture.state();
    const scene = buildGroundBoundaryScene(state);
    const portals = portalAlignment(scene);
    return {
      fixture: fixture.name,
      junctions: junctionOverlap(scene),
      portals: { count: portals.length, measured: portals.filter(row => row.drawn !== "plaza").length,
        maxLateral: Math.max(0, ...portals.map(row => row.maxLateral)), maxAngleDeg: Math.max(0, ...portals.map(row => row.maxAngleDeg)),
        plazaPortalsCovered: portals.filter(row => row.drawn === "plaza").every(row => row.plazaCovered === true), rows: portals },
      walkers: walkerDeviation(scene, state),
      shoulders: shoulderStats(scene),
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(`${JSON.stringify(ribbonGates(), null, 2)}\n`);
