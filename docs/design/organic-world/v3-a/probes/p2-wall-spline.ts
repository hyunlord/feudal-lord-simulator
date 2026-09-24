// Probe P2 (read-only): does a smoothed render curve of the real palisade ring block exactly the same
// 4-neighbour tile links as the lattice wall used by world/wallTraversal.ts canTraverseWallBoundary?
// Run: cd /tmp/fls-r1 && npx tsx ~/feudal-lord-analysis/organic-world/probes/p2-wall-spline.ts <state.json>
import { readFileSync } from "node:fs";
import { canTraverseWallBoundary, type WallGrid } from "/tmp/fls-design/src/world/wallTraversal";
import { palisadeRingPoints } from "/tmp/fls-design/src/engine/palisadeSegments";

type P = { x: number; y: number };
const state = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const polygon: P[] = state.palisade.polygon;
const ring = palisadeRingPoints(polygon) as P[];

const latticeWall = { gate: { x: -100, y: -100 }, segments: [{ completed: true, edgePath: polygon }] };
const grid: WallGrid = { tiles: state.tiles, width: state.width, height: state.height, palisade: latticeWall };

function chaikinClosed(pts: readonly P[], rounds: number): P[] {
  let cur = [...pts];
  for (let r = 0; r < rounds; r++) {
    const next: P[] = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i]!, b = cur[(i + 1) % cur.length]!;
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    cur = next;
  }
  return cur;
}
const cross = (a: P, b: P, c: P) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function segHit(a: P, b: P, c: P, d: P): boolean {
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p: P, q: P, r: P) => Math.abs(cross(p, q, r)) < 1e-9 && r.x >= Math.min(p.x, q.x) - 1e-9 && r.x <= Math.max(p.x, q.x) + 1e-9 && r.y >= Math.min(p.y, q.y) - 1e-9 && r.y <= Math.max(p.y, q.y) + 1e-9;
  return on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
function curveBlocks(curve: readonly P[], from: P, to: P): boolean {
  for (let i = 0; i < curve.length; i++) if (segHit(from, to, curve[i]!, curve[(i + 1) % curve.length]!)) return true;
  return false;
}
function distPointSeg(p: P, a: P, b: P) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

const out: string[] = [];
out.push(`state=${process.argv[2]} ringSteps=${ring.length} simplifiedVertices=${polygon.length - 1}`);
// Base "steps": Chaikin on every unit lattice step point. Base "vertices": Chaikin on simplified corners only
// (much stronger rounding). Base "avg5": moving average (window 5) of step points, then Chaikin 3.
function avgClosed(pts: readonly P[], w: number): P[] { const h = Math.floor(w / 2); return pts.map((_, i) => { let x = 0, y = 0; for (let j = -h; j <= h; j++) { const q = pts[(i + j + pts.length) % pts.length]!; x += q.x; y += q.y; } return { x: x / w, y: y / w }; }); }
const variants: [string, P[]][] = [
  ["steps chaikin3", chaikinClosed(ring, 3)],
  ["vertices chaikin4", chaikinClosed(polygon.slice(0, -1), 4)],
  ["avg3 chaikin3", chaikinClosed(avgClosed(ring, 3), 3)],
  ["avg5 chaikin3", chaikinClosed(avgClosed(ring, 5), 3)],
  ["avg9 chaikin3", chaikinClosed(avgClosed(ring, 9), 3)],
];
for (const [rounds, curve] of variants) {
  let links = 0, latticeBlocked = 0, mismatch = 0;
  const examples: string[] = [];
  for (let ty = 0; ty < state.height; ty++) for (let tx = 0; tx < state.width; tx++) {
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const nx = tx + dx, ny = ty + dy;
      if (nx >= state.width || ny >= state.height) continue;
      links++;
      const lat = !canTraverseWallBoundary(grid, { tx, ty }, { tx: nx, ty: ny });
      // tile (tx,ty) centre is at edge-space (tx+0.5, ty+0.5): same convention as wallTraversal.ts:101
      const cur = curveBlocks(curve, { x: tx + 0.5, y: ty + 0.5 }, { x: nx + 0.5, y: ny + 0.5 });
      if (lat) latticeBlocked++;
      if (lat !== cur) { mismatch++; if (examples.length < 6) examples.push(`${tx},${ty}->${nx},${ny} lattice=${lat} curve=${cur}`); }
    }
  }
  let maxDev = 0;
  for (const p of curve) { let d = Infinity; for (let i = 0; i < ring.length; i++) d = Math.min(d, distPointSeg(p, ring[i]!, ring[(i + 1) % ring.length]!)); maxDev = Math.max(maxDev, d); }
  // building clearance from the curve (lattice rule = palisadePathHasBuildingClearance margin 1)
  let minClear = Infinity;
  for (const b of state.buildings) {
    const w = b.kind === "house" && b.houseLot === "horizontal" ? 2 : b.kind === "house" ? 1 : undefined;
    void w;
  }
  const occ = state.tiles.filter((t: any) => t.buildingId !== null);
  for (const t of occ) for (const p of curve) {
    const d = Math.hypot(Math.max(0, Math.abs(p.x - (t.tx + 0.5)) - 0.5), Math.max(0, Math.abs(p.y - (t.ty + 0.5)) - 0.5));
    minClear = Math.min(minClear, d);
  }
  out.push(`${rounds}: curveVertices=${curve.length} links=${links} latticeBlocked=${latticeBlocked} mismatchedLinks=${mismatch} maxDevFromLattice=${maxDev.toFixed(3)} minClearanceToOccupiedCell=${minClear.toFixed(3)}`);
  for (const e of examples) out.push(`  e.g. ${e}`);
}
console.log(out.join("\n"));

// ---- Figure F3: real lots24 wall, lattice ring vs constrained smoothing (avg3+chaikin3), iso-projected ----
import { writeFileSync } from "node:fs";
{
  const smooth = chaikinClosed(avgClosed(ring, 3), 3);
  const iso = (p: P) => ({ x: (p.x - p.y) * 16, y: (p.x + p.y) * 8 }); // edge space, half scale
  const pts = [...ring, ...smooth].map(iso);
  const minX = Math.min(...pts.map(p => p.x)) - 40, maxX = Math.max(...pts.map(p => p.x)) + 40;
  const minY = Math.min(...pts.map(p => p.y)) - 30, maxY = Math.max(...pts.map(p => p.y)) + 30;
  const d = (ps: readonly P[]) => ps.map((p, i) => { const s = iso(p); return `${i ? "L" : "M"}${(s.x - minX).toFixed(1)},${(s.y - minY).toFixed(1)}`; }).join("") + "Z";
  const cell = (tx: number, ty: number) => d([{ x: tx, y: ty }, { x: tx + 1, y: ty }, { x: tx + 1, y: ty + 1 }, { x: tx, y: ty + 1 }]);
  const minTx = Math.min(...ring.map(p => p.x)) - 2, maxTx = Math.max(...ring.map(p => p.x)) + 2;
  const minTy = Math.min(...ring.map(p => p.y)) - 2, maxTy = Math.max(...ring.map(p => p.y)) + 2;
  const layers: Record<string, string[]> = { water: [], forest: [], road: [], building: [] };
  for (const t of state.tiles) {
    if (t.tx < minTx || t.tx > maxTx || t.ty < minTy || t.ty > maxTy) continue;
    if (t.buildingId) layers.building!.push(cell(t.tx, t.ty));
    else if (t.hasRoad) layers.road!.push(cell(t.tx, t.ty));
    else if (t.terrain === "water") layers.water!.push(cell(t.tx, t.ty));
    else if (t.terrain === "forest") layers.forest!.push(cell(t.tx, t.ty));
  }
  const W = (maxX - minX).toFixed(0), H = (maxY - minY + 26).toFixed(0);
  writeFileSync(`${process.env.HOME}/feudal-lord-analysis/organic-world/figures/F3-wall-lattice-vs-smoothed.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="sans-serif">
<rect width="100%" height="100%" fill="#eef0e2"/>
<path d="${layers.forest!.join("")}" fill="#7d9468"/><path d="${layers.water!.join("")}" fill="#8fb3c9"/>
<path d="${layers.road!.join("")}" fill="#cdb48a"/><path d="${layers.building!.join("")}" fill="#8a5a44"/>
<path d="${d(ring)}" fill="none" stroke="#222" stroke-width="1" stroke-dasharray="3 2"/>
<path d="${d(smooth)}" fill="none" stroke="#b3261e" stroke-width="2.2"/>
<text x="8" y="${(maxY - minY + 18).toFixed(0)}" font-size="11" fill="#222">lots24-l4 실제 성벽: 검정 점선 = 격자 모서리 경로(판정 원본) · 빨강 = 구속 스무딩(avg3+Chaikin3) — 8,064개 인접 링크 중 차단 판정 불일치 0, 최대 편차 0.35칸, 건물까지 최소 0.885칸</text>
</svg>`);
}
