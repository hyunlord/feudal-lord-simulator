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

function evaluate(name: string, control: readonly P[]) {
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

evaluate("straight 0deg", [{ x: 2, y: 5 }, { x: 22, y: 5 }]);
evaluate("straight 45deg", [{ x: 2, y: 2 }, { x: 18, y: 18 }]);
evaluate("straight 26.6deg (2:1)", [{ x: 2, y: 2 }, { x: 22, y: 12 }]);
evaluate("gentle arc r~12", Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI / 2; return { x: 4 + 12 * Math.sin(a), y: 4 + 12 - 12 * Math.cos(a) }; }));
evaluate("tight arc r~3", Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI / 2; return { x: 4 + 3 * Math.sin(a), y: 4 + 3 - 3 * Math.cos(a) }; }));
evaluate("S-curve", [{ x: 2, y: 10 }, { x: 8, y: 6 }, { x: 14, y: 12 }, { x: 20, y: 8 }, { x: 26, y: 10 }]);
evaluate("river-hugging wiggle", [{ x: 2, y: 4 }, { x: 6, y: 5.5 }, { x: 10, y: 4.5 }, { x: 14, y: 6.5 }, { x: 18, y: 5 }, { x: 22, y: 6 }]);

// ---- Figure F2: iso-projected SVG of intent curve, raster cells and S1/S2 render centrelines ----
import { writeFileSync } from "node:fs";
function isoXY(p: P) { return { x: (p.x - p.y) * 32, y: (p.x + p.y) * 16 }; }
function figure(file: string, title: string, control: readonly P[]) {
  const curve = catmull(control); const cells = raster(curve); const centres = cells.map(c => ({ x: c.tx, y: c.ty }));
  const s1 = chaikin(centres, 3), s2 = chaikin(movingAverage(centres, 5), 2);
  const all = [...curve, ...centres].map(isoXY);
  const minX = Math.min(...all.map(p => p.x)) - 60, maxX = Math.max(...all.map(p => p.x)) + 60;
  const minY = Math.min(...all.map(p => p.y)) - 50, maxY = Math.max(...all.map(p => p.y)) + 40;
  const path = (pts: readonly P[]) => pts.map((p, i) => { const s = isoXY(p); return `${i ? "L" : "M"}${(s.x - minX).toFixed(1)},${(s.y - minY).toFixed(1)}`; }).join("");
  const diamond = (c: C) => { const s = isoXY({ x: c.tx, y: c.ty }); const x = s.x - minX, y = s.y - minY; return `M${x},${y - 16}L${x + 32},${y}L${x},${y + 16}L${x - 32},${y}Z`; };
  const grid: string[] = [];
  const xs = centres.map(c => c.x), ys = centres.map(c => c.y);
  for (let ty = Math.min(...ys) - 2; ty <= Math.max(...ys) + 2; ty++) for (let tx = Math.min(...xs) - 2; tx <= Math.max(...xs) + 2; tx++) grid.push(diamond({ tx, ty }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(maxX - minX).toFixed(0)} ${(maxY - minY + 30).toFixed(0)}" font-family="sans-serif">
<rect width="100%" height="100%" fill="#f6f1e4"/>
<path d="${grid.join("")}" fill="none" stroke="#c9bfa6" stroke-width="0.8"/>
<path d="${cells.map(diamond).join("")}" fill="#c89f6a" fill-opacity="0.55" stroke="#8a6a3e" stroke-width="0.8"/>
<path d="${path(s1)}" fill="none" stroke="#6b4a2a" stroke-opacity="0.35" stroke-width="${0.42 * 2 * 32}" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${path(curve)}" fill="none" stroke="#1d5fa8" stroke-width="2.2" stroke-dasharray="6 4"/>
<path d="${path(s1)}" fill="none" stroke="#3a2412" stroke-width="2"/>
<path d="${path(s2)}" fill="none" stroke="#b3261e" stroke-width="1.6" stroke-dasharray="2 3"/>
<text x="10" y="${(maxY - minY + 20).toFixed(0)}" font-size="13" fill="#222">${title} — 파랑 점선: 플레이어 의도 곡선 · 갈색 칸: 래스터 도로 셀 · 검정 실선+띠: S1 렌더 중심선(셀 충실) · 빨강 점선: S2(의도 충실)</text>
</svg>`;
  writeFileSync(file, svg);
}
figure("../figures/F2a-road-gentle-arc.svg", "완만한 호 r≈12", Array.from({ length: 7 }, (_, i) => { const a = (i / 6) * Math.PI / 2; return { x: 4 + 12 * Math.sin(a), y: 4 + 12 - 12 * Math.cos(a) }; }));
figure("../figures/F2b-road-45deg.svg", "45° 직선", [{ x: 2, y: 2 }, { x: 14, y: 14 }]);
figure("../figures/F2c-road-s-curve.svg", "S자 곡선", [{ x: 2, y: 10 }, { x: 8, y: 6 }, { x: 14, y: 12 }, { x: 20, y: 8 }, { x: 26, y: 10 }]);
