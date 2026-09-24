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

function inRoadCell(p: P, set: ReadonlySet<string>): boolean { return set.has(`${Math.round(p.x)},${Math.round(p.y)}`); }

function evaluateOld(name: string, control: readonly P[]) {
  const curve = catmull(control);
  const cells = raster(curve);
  const connected = cells.every((c, i) => i === 0 || Math.abs(c.tx - cells[i - 1]!.tx) + Math.abs(c.ty - cells[i - 1]!.ty) === 1);
  const set = new Set(cells.map(c => `${c.tx},${c.ty}`));
  const centres = cells.map(c => ({ x: c.tx, y: c.ty }));
  const arc = curve.reduce((s, p, i) => i === 0 ? 0 : s + Math.hypot(p.x - curve[i - 1]!.x, p.y - curve[i - 1]!.y), 0);
  const maxCentreDist = Math.max(...centres.map(c => distToPolyline(c, curve)));
  const rows: string[] = [];
  for (const [label, render] of [["S1 chaikin3", chaikin(centres, 3)], ["S3 avg3+chaikin3", chaikin(movingAverage(centres, 3), 3)], ["S2 avg5+chaikin2", chaikin(movingAverage(centres, 5), 2)]] as const) {
    // interior only (skip 1.5 tiles at each end where pinning dominates)
    const interior = render.filter(p => distToPolyline(p, [curve[0]!]) > 1.5 && distToPolyline(p, [curve.at(-1)!]) > 1.5);
    const devFromIntent = Math.max(...interior.map(p => distToPolyline(p, curve)));
    // ribbon half-width 0.40 tile: sample points across the ribbon and count those outside road cells
    let outside = 0, total = 0, outsideFar = 0;
    for (let i = 1; i < render.length; i++) {
      const a = render[i - 1]!, b = render[i]!; const len = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
      const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      for (const off of [-0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4]) {
        const p = { x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off };
        total++;
        if (!inRoadCell(p, set)) {
          outside++;
          // distance to nearest road cell square
          let d = Infinity;
          for (const c of cells) d = Math.min(d, Math.hypot(Math.max(0, Math.abs(p.x - c.tx) - 0.5), Math.max(0, Math.abs(p.y - c.ty) - 0.5)));
          if (d > 0.25) outsideFar++;
        }
      }
    }
    // cells whose centre is NOT covered by the ribbon (a road the player cannot see)
    const uncovered = centres.filter(c => distToPolyline(c, render) > 0.4).length;
    rows.push(`  ${label}: maxDevFromIntent=${devFromIntent.toFixed(3)} ribbonOutsideCells=${(100 * outside / total).toFixed(1)}% outside>0.25tile=${outsideFar} cellCentresNotUnderRibbon=${uncovered}`);
  }
  console.log(`${name}: arc=${arc.toFixed(1)} cells=${cells.length} cells/arc=${(cells.length / arc).toFixed(2)} 4conn=${connected} maxCellCentreToIntent=${maxCentreDist.toFixed(3)}`);
  for (const r of rows) console.log(r);
}


// 8-connected raster (explicit diagonal links): cell under each dense sample, no connector insertion.
function raster8(curve: readonly P[]): C[] {
  const cells: C[] = [];
  for (const p of curve) { const c = { tx: Math.round(p.x), ty: Math.round(p.y) }; const l = cells.at(-1); if (!l || l.tx !== c.tx || l.ty !== c.ty) cells.push(c); }
  return cells;
}
function metrics(label: string, curve: readonly P[], cells: C[], render: P[], half: number) {
  const set = new Set(cells.map(c => `${c.tx},${c.ty}`));
  const interior = render.filter(p => distToPolyline(p, [curve[0]!]) > 1.5 && distToPolyline(p, [curve.at(-1)!]) > 1.5);
  const dev = Math.max(...interior.map(p => distToPolyline(p, curve)));
  let outside = 0, total = 0, far = 0;
  const offs = Array.from({ length: 9 }, (_, i) => -half + (2 * half * i) / 8);
  for (let i = 1; i < render.length; i++) {
    const a = render[i - 1]!, b = render[i]!; const len = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    for (const off of offs) { const p = { x: (a.x + b.x) / 2 + nx * off, y: (a.y + b.y) / 2 + ny * off }; total++;
      if (!inRoadCell(p, set)) { outside++; let d = Infinity; for (const c of cells) d = Math.min(d, Math.hypot(Math.max(0, Math.abs(p.x - c.tx) - 0.5), Math.max(0, Math.abs(p.y - c.ty) - 0.5))); if (d > 0.25) far++; } }
  }
  // "visibly touched" = ribbon covers some part of the cell: centre within half+0.5*sqrt2 is too loose; use sampling of cell area
  let untouched = 0;
  for (const c of cells) { let hit = false; for (let u = -0.45; u <= 0.45 && !hit; u += 0.15) for (let v = -0.45; v <= 0.45 && !hit; v += 0.15) if (distToPolyline({ x: c.tx + u, y: c.ty + v }, render) <= half) hit = true; if (!hit) untouched++; }
  let coverSum = 0; for (const c of cells) { let n = 0, h = 0; for (let u = -0.45; u <= 0.46; u += 0.1) for (let v = -0.45; v <= 0.46; v += 0.1) { n++; if (distToPolyline({ x: c.tx + u, y: c.ty + v }, render) <= half) h++; } coverSum += h / n; }
  return `  ${label} half=${half}: devFromIntent=${dev.toFixed(2)} ribbonOutside=${(100 * outside / total).toFixed(1)}% (>0.25:${far}) cellsUntouched=${untouched} meanCellCover=${(100 * coverSum / cells.length).toFixed(0)}%`;
}
const cases: [string, P[]][] = [
  ["straight 45deg", [{ x: 2, y: 2 }, { x: 18, y: 18 }]],
  ["straight 26.6deg", [{ x: 2, y: 2 }, { x: 22, y: 12 }]],
  ["gentle arc r~12", Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI / 2; return { x: 4 + 12 * Math.sin(a), y: 4 + 12 - 12 * Math.cos(a) }; })],
  ["S-curve", [{ x: 2, y: 10 }, { x: 8, y: 6 }, { x: 14, y: 12 }, { x: 20, y: 8 }, { x: 26, y: 10 }]],
];
for (const [name, ctrl] of cases) {
  const curve = catmull(ctrl);
  for (const [mode, cells] of [["4conn", raster(curve)], ["8conn", raster8(curve)]] as const) {
    const centres = cells.map(c => ({ x: c.tx, y: c.ty }));
    console.log(`${name} ${mode}: cells=${cells.length} maxCentreToIntent=${Math.max(...centres.map(c => distToPolyline(c, curve))).toFixed(2)}`);
    for (const half of [0.21, 0.4]) {
      console.log(metrics("S1 chaikin3", curve, cells, chaikin(centres, 3), half));
      console.log(metrics("S2 avg5+ch2", curve, cells, chaikin(movingAverage(centres, 5), 2), half));
    }
  }
}
