// Probe P1 (read-only design evidence): curve -> 4-connected cell raster -> smoothed render centreline.
// Tile space: cell (tx,ty) covers [tx-0.5,tx+0.5]^2 (matches render/iso.ts tileToScreen centre convention).
// Run: npx --prefix /tmp/fls-r1 tsx p1-road-raster.ts
type P = { x: number; y: number };
type C = { tx: number; ty: number };

const QUANT = 8; // control points quantised to 1/8 tile
const q = (p: P): P => ({ x: Math.round(p.x * QUANT) / QUANT, y: Math.round(p.y * QUANT) / QUANT });

function catmull(points: readonly P[], samplesPerSpan = 40): P[] {
  const pts = points.map(q);
  const out: P[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let s = 0; s < samplesPerSpan; s++) {
      const t = s / samplesPerSpan, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts.at(-1)!);
  return out;
}

function distToPolyline(p: P, line: readonly P[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, b = line[i]!;
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

// Rule R1: cell under each dense sample; diagonal transitions get the connector whose centre is closer
// to the curve; exact ties resolve horizontally first (same tie rule as world/roadGraph.ts roadLine).
function raster(curve: readonly P[]): C[] {
  const cells: C[] = [];
  const push = (c: C) => {
    const last = cells.at(-1);
    if (last && last.tx === c.tx && last.ty === c.ty) return;
    if (cells.length >= 2) { const prev = cells.at(-2)!; if (prev.tx === c.tx && prev.ty === c.ty) { cells.pop(); return; } }
    cells.push(c);
  };
  for (const p of curve) {
    const c = { tx: Math.round(p.x), ty: Math.round(p.y) };
    const last = cells.at(-1);
    if (last && Math.abs(c.tx - last.tx) === 1 && Math.abs(c.ty - last.ty) === 1) {
      const h = { tx: c.tx, ty: last.ty }, v = { tx: last.tx, ty: c.ty };
      const dh = distToPolyline({ x: h.tx, y: h.ty }, curve), dv = distToPolyline({ x: v.tx, y: v.ty }, curve);
      push(dh <= dv + 1e-9 ? h : v);
    }
    push(c);
  }
  return cells;
}

// Render rule S1: centreline = cell-centre chain smoothed by k rounds of Chaikin corner cutting (ends pinned).
function chaikin(line: readonly P[], rounds: number): P[] {
  let cur = [...line];
  for (let r = 0; r < rounds; r++) {
    const next: P[] = [cur[0]!];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i]!, b = cur[i + 1]!;
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(cur.at(-1)!);
    cur = next;
  }
  return cur;
}
// Render rule S2: moving average of cell centres over a window of w cells along the chain, then Chaikin x2.
function movingAverage(line: readonly P[], w: number): P[] {
  const h = Math.floor(w / 2);
  return line.map((_, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(line.length - 1, i + h); j++) { sx += line[j]!.x; sy += line[j]!.y; n++; }
    return { x: sx / n, y: sy / n };
  });
}


// ================= Probe P5: zone membership + frontage parcels (design feasibility) =================
import { writeFileSync } from "node:fs";
type Q = { x: number; y: number }; // zone vertices in 1/8-tile integer units
const Q8 = 8;
// Membership rule M1: cell (tx,ty) is a member iff its centre (8tx,8ty) is strictly inside the integer polygon
// (crossing number, half-open on y: exact integer arithmetic -> deterministic across platforms).
function insideInt(px: number, py: number, poly: readonly Q[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a.y > py) !== (b.y > py)) {
      // compare px < a.x + (py-a.y)*(b.x-a.x)/(b.y-a.y) without division
      const lhs = (px - a.x) * (b.y - a.y), rhs = (py - a.y) * (b.x - a.x);
      if ((b.y - a.y) > 0 ? lhs < rhs : lhs > rhs) inside = !inside;
    }
  }
  return inside;
}
function membership(poly: readonly Q[], W: number, H: number, blocked: (tx: number, ty: number) => boolean): Set<string> {
  const out = new Set<string>();
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (!blocked(tx, ty) && insideInt(tx * Q8, ty * Q8, poly)) out.add(`${tx},${ty}`);
  return out;
}
// Parcel rule F1: walk the (ordered) road chain; for each road cell take the member neighbour on the zone side
// as a frontage cell (first-come by chain order); the parcel extends from the frontage cell along the smoothed
// road normal (sampled every 0.25 tile) for DEPTH tiles, claiming member cells not already claimed.
const DEPTH = 3.2;
function parcels(chain: readonly C[], render: readonly P[], members: ReadonlySet<string>) {
  const claimed = new Map<string, number>(); const list: { id: number; front: C; cells: C[]; normal: P; anchor: P }[] = [];
  const nearest = (p: P) => { let bi = 0, bd = Infinity; for (let i = 0; i < render.length; i++) { const d = Math.hypot(render[i]!.x - p.x, render[i]!.y - p.y); if (d < bd) { bd = d; bi = i; } } return bi; };
  for (const road of chain) {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const f = { tx: road.tx + dx, ty: road.ty + dy }; const k = `${f.tx},${f.ty}`;
      if (!members.has(k) || claimed.has(k)) continue;
      const i = nearest({ x: f.tx, y: f.ty }); const a = render[Math.max(0, i - 1)]!, b = render[Math.min(render.length - 1, i + 1)]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1; let n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
      const anchor = render[i]!;
      if ((f.tx - anchor.x) * n.x + (f.ty - anchor.y) * n.y < 0) n = { x: -n.x, y: -n.y };
      const id = list.length; const cells: C[] = [];
      for (let s = 0; s <= DEPTH; s += 0.25) {
        const c = { tx: Math.round(f.tx + n.x * s), ty: Math.round(f.ty + n.y * s) }; const ck = `${c.tx},${c.ty}`;
        if (!members.has(ck)) break; if (claimed.has(ck)) { if (claimed.get(ck) !== id) break; continue; }
        claimed.set(ck, id); cells.push(c);
      }
      if (cells.length > 0) list.push({ id, front: f, cells, normal: n, anchor });
    }
  }
  return { list, claimed };
}
const W = 34, H = 22;
const control: P[] = [{ x: 2, y: 10 }, { x: 8, y: 6 }, { x: 14, y: 12 }, { x: 20, y: 8 }, { x: 26, y: 10 }, { x: 32, y: 9 }];
const curve = catmull(control); const chain = raster(curve); const centres = chain.map(c => ({ x: c.tx, y: c.ty }));
const render = chaikin(movingAverage(centres, 5), 2);
const roadSet = new Set(chain.map(c => `${c.tx},${c.ty}`));
const burgagePoly: Q[] = [[3, 9.5], [8, 5.5], [14, 11.5], [20, 7.5], [27, 9.5], [27, 16], [20, 15], [14, 18], [7, 16], [3, 15]].map(([x, y]) => ({ x: x! * Q8, y: y! * Q8 + 3 }));
const fieldPoly: Q[] = [[5, 1], [13, 0.5], [19, 3], [18, 7], [13, 8.5], [8, 4.5], [4, 6]].map(([x, y]) => ({ x: Math.round(x! * Q8), y: Math.round(y! * Q8) + 5 }));
const blocked = (tx: number, ty: number) => roadSet.has(`${tx},${ty}`);
const bMembers = membership(burgagePoly, W, H, blocked); const fMembers = membership(fieldPoly, W, H, blocked);
const run1 = parcels(chain, render, bMembers);
// determinism: identical recomputation
const again = parcels(chain, render, membership(burgagePoly, W, H, blocked));
const same = JSON.stringify(run1.list.map(p => p.cells)) === JSON.stringify(again.list.map(p => p.cells));
// locality: add a spur road at the far east end; count parcels whose cells change
const spur = [{ tx: 17, ty: 12 }, { tx: 17, ty: 13 }, { tx: 17, ty: 14 }, { tx: 17, ty: 15 }];
const blocked2 = (tx: number, ty: number) => blocked(tx, ty) || spur.some(s => s.tx === tx && s.ty === ty);
const run2 = parcels(chain, render, membership(burgagePoly, W, H, blocked2));
const key = (p: { cells: C[] }) => p.cells.map(c => `${c.tx},${c.ty}`).join(";");
const before = new Set(run1.list.map(key)); const changed = run2.list.filter(p => !before.has(key(p)));
const maxChangedDist = Math.max(0, ...changed.map(p => Math.min(...spur.map(s => Math.abs(s.tx - p.front.tx) + Math.abs(s.ty - p.front.ty)))));
const sizes = run1.list.map(p => p.cells.length);
const unclaimed = [...bMembers].filter(k => !run1.claimed.has(k)).length;
console.log(`burgage members=${bMembers.size} field members=${fMembers.size} parcels=${run1.list.length} parcelSizes(min/mean/max)=${Math.min(...sizes)}/${(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)}/${Math.max(...sizes)} unclaimedBackland=${unclaimed} deterministic=${same} spurChangedParcels=${changed.length} maxManhattanFromSpur=${maxChangedDist}`);

// ---- Figure F4 ----
const isoXY = (p: P) => ({ x: (p.x - p.y) * 30 + 22 * 30, y: (p.x + p.y) * 15 + 20 });
const pth = (ps: readonly P[], close = false) => ps.map((p, i) => { const s = isoXY(p); return `${i ? "L" : "M"}${s.x.toFixed(1)},${s.y.toFixed(1)}`; }).join("") + (close ? "Z" : "");
const dia = (c: C) => pth([{ x: c.tx, y: c.ty - 0.5 }, { x: c.tx + 0.5, y: c.ty }, { x: c.tx, y: c.ty + 0.5 }, { x: c.tx - 0.5, y: c.ty }].map(p => ({ x: p.x + (p.y - c.ty) * 0 , y: p.y })), true);
const sq = (c: C) => pth([{ x: c.tx - 0.5, y: c.ty - 0.5 }, { x: c.tx + 0.5, y: c.ty - 0.5 }, { x: c.tx + 0.5, y: c.ty + 0.5 }, { x: c.tx - 0.5, y: c.ty + 0.5 }], true);
void dia;
const hues = ["#d8c690", "#cbb97e", "#e0cf9c", "#c7b173"];
const parcelPaths = run1.list.map(p => `<path d="${p.cells.map(sq).join("")}" fill="${hues[p.id % 4]}" stroke="none"/>`).join("");
const fences = run1.list.map(p => { const t = { x: -p.normal.y, y: p.normal.x }; const last = p.cells.at(-1)!; return pth([{ x: p.front.tx + t.x * 0.5, y: p.front.ty + t.y * 0.5 }, { x: last.tx + t.x * 0.5 + p.normal.x * 0.5, y: last.ty + t.y * 0.5 + p.normal.y * 0.5 }]); }).join("");
const houses = run1.list.map(p => `<path d="${sq(p.front)}" fill="#8a5a44" transform="translate(0,-3)"/>`).join("");
const qp = (poly: readonly Q[]) => pth(poly.map(v => ({ x: v.x / Q8, y: v.y / Q8 })), true);
const fieldCells = [...fMembers].map(k => { const [x, y] = k.split(",").map(Number); return sq({ tx: x!, ty: y! }); }).join("");
const grid: string[] = []; for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) grid.push(sq({ tx, ty }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1720 1000" font-family="sans-serif">
<rect width="100%" height="100%" fill="#e9ecd9"/>
<path d="${grid.join("")}" fill="none" stroke="#cfd3bd" stroke-width="0.7"/>
<defs><pattern id="strips" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)"><rect width="10" height="10" fill="#c9b36a"/><rect width="10" height="4" fill="#a99447"/></pattern></defs>
<path d="${fieldCells}" fill="url(#strips)" opacity="0.9"/>
${parcelPaths}
<path d="${chain.map(sq).join("")}" fill="#b89a6c" opacity="0.45"/>
<path d="${pth(render)}" fill="none" stroke="#8b6b43" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${fences}" fill="none" stroke="#5b4a2e" stroke-width="1.6"/>
${houses}
<path d="${qp(burgagePoly)}" fill="none" stroke="#1d5fa8" stroke-width="2" stroke-dasharray="7 4"/>
<path d="${qp(fieldPoly)}" fill="none" stroke="#1d5fa8" stroke-width="2" stroke-dasharray="7 4"/>
<text x="20" y="970" font-size="20" fill="#222">P5 실제 계산 결과 — 파랑 점선: 플레이어가 그린 구역 형상(zone.geometry) · 채움: 셀 중심 기준 소속(tileMembership) · 굽은 도로 옆 frontage 필지 ${run1.list.length}개(갈색 = 길가 집 자리, 선 = 굽은 도로의 법선을 따르는 필지 경계) · 위쪽: 경작지 띠</text>
</svg>`;
writeFileSync(`${process.env.HOME}/feudal-lord-analysis/organic-world/figures/F4-zone-frontage-parcels.svg`, svg);
