/**
 * deriveActorTemplates.ts - deterministic child / elder walker TEMPLATE sheets derived from the adult civilian sheets.
 *
 * Usage (no npm script; run directly):
 *   npx tsx scripts/deriveActorTemplates.ts
 *
 * Inputs (native 1774x887, 4 columns NE SE SW NW x 2 rows gait frame 0 / 1, cells 443.5 px):
 *   docs/asset-evidence/runtime-sources/runtime-actors-v1/actor_civilian_man-v1.png
 *   docs/asset-evidence/runtime-sources/runtime-actors-v1/actor_civilian_woman-v1.png
 *
 * Outputs (assets-inbox/derived-templates/, Wave 5 walker format 296x148 RGBA, 74x74 cells, same column/row order):
 *   actor_child_template_m-v1.png, actor_child_template_f-v1.png   (from man, woman)
 *   actor_elder_template_m-v1.png, actor_elder_template_f-v1.png   (from man, woman)
 *   provenance-derived-templates.csv, measurements.json, checks/derived-vs-adult.png
 *   README.md (Korean summary + foot / head table, regenerated from the same measurements)
 *
 * These are reskin references for an artist (Wave 5c). They are NOT installed in the game.
 *
 * Pipeline (all geometry in native source pixels, one resample to 74 px cells at the end):
 *   1. Per native cell, measure the figure (alpha >= 128): foot contact = bottom edge of the lowest opaque row at
 *      the midpoint of that row's opaque span; head top = first opaque row; H = foot - top.
 *   2. Render each output cell by inverse mapping every native pixel centre through the transform and sampling the
 *      source cell with bilinear interpolation on premultiplied alpha (samples outside the cell are transparent).
 *        child: scale 0.65 about the foot contact; then enlarge the head region (top 30% of the shrunk figure) by
 *               1.25 about the neck point (neck row = 30% line, neck x = alpha-weighted centre x of the source head
 *               region). The scale ramps linearly from 1.0 at the neck line to 1.25 over the lowest 40% of the head
 *               region so the head stays attached to the shoulders without a width step.
 *        elder: scale vertically 0.95 about the foot contact; above the hip line (50% of the scaled figure height)
 *               skew 8 degrees toward the facing direction (NE/SE screen-right, SW/NW screen-left); the upper body is
 *               then shifted down 1 output px (composited over the lower body), the feet do not move.
 *   3. Area-average downscale (fractional box weights, premultiplied) of the whole 1774x887 canvas to 296x148 -
 *      the same 296/1774 mapping the walker manifest uses for these legacy sheets (verified in measurements.json).
 *   4. Unpremultiply with Math.round, colour 0 where alpha rounds to 0.
 * Output is byte-identical on rerun (pure float64 arithmetic, fixed zlib settings, fixed generatedAt).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { readPng, writePng, type RgbaImage } from "./processBuildingSprite";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_DIR = "docs/asset-evidence/runtime-sources/runtime-actors-v1";
const OUT_DIR = "assets-inbox/derived-templates";
const GENERATED_AT = "2026-09-25";

const DIRECTIONS = ["NE", "SE", "SW", "NW"] as const;
type Direction = (typeof DIRECTIONS)[number];
// Facing on screen: NE / SE walk toward screen-right, SW / NW toward screen-left (checked in measurements.json).
const FACING: Record<Direction, 1 | -1> = { NE: 1, SE: 1, SW: -1, NW: -1 };

const NATIVE_W = 1774;
const NATIVE_H = 887;
const OUT_W = 296;
const OUT_H = 148;
const CELL = 74;
const NATIVE_CELL = NATIVE_W / 4; // 443.5
const SCALE = NATIVE_W / OUT_W; // native px per output px (5.993...)
const OPAQUE = 128;

const CHILD_SCALE = 0.65;
const CHILD_HEAD_FRACTION = 0.3;
const CHILD_HEAD_SCALE = 1.25;
const CHILD_HEAD_RAMP = 0.4; // fraction of the head region (from the neck up) over which the head scale ramps in
const ELDER_VSCALE = 0.95;
const ELDER_HIP_FRACTION = 0.5;
const ELDER_LEAN_DEG = 8;
const ELDER_DROP_PX = 1; // output px

const GATE_FOOT_PX = 1;
const GATE_CHILD_RATIO: readonly [number, number] = [0.65, 0.72];
const GATE_ELDER_RATIO: readonly [number, number] = [0.92, 0.97];

type Variant = "adult" | "child" | "elder";
type Sex = "m" | "f";

type CellGeometry = {
  readonly col: number;
  readonly row: number;
  readonly footX: number;
  readonly footY: number;
  readonly top: number;
  readonly height: number;
  readonly headCentreX: number;
};

type Premult = Float64Array; // r*a, g*a, b*a (0..255*255/255 = 0..255 scale), a (0..255)

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const cellOf = (coordinate: number): number => Math.min(3, Math.floor((coordinate + 0.5) / NATIVE_CELL));
const rowOf = (coordinate: number): number => Math.min(1, Math.floor((coordinate + 0.5) / NATIVE_CELL));
// Native pixel range [start, end) whose pixel centres fall in cell `index` along an axis of `limit` pixels.
const cellRange = (index: number, limit: number): readonly [number, number] => {
  const owner = limit === NATIVE_W ? cellOf : rowOf;
  let start = 0;
  while (owner(start) < index) start += 1;
  let end = start;
  while (end < limit && owner(end) === index) end += 1;
  return [start, end];
};

const alphaAt = (image: RgbaImage, x: number, y: number): number => image.rgba[(y * image.dimensions.width + x) * 4 + 3] ?? 0;

const measureNativeCell = (image: RgbaImage, col: number, row: number): CellGeometry => {
  const [x0, x1] = cellRange(col, NATIVE_W);
  const [y0, y1] = cellRange(row, NATIVE_H);
  let top = -1;
  let bottom = -1;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (alphaAt(image, x, y) >= OPAQUE) {
        if (top < 0) top = y;
        bottom = y;
        break;
      }
    }
  }
  if (top < 0) throw new Error(`empty native cell ${col},${row}`);
  let minX = x1;
  let maxX = x0;
  for (let x = x0; x < x1; x += 1) {
    if (alphaAt(image, x, bottom) >= OPAQUE) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  const footY = bottom + 1;
  const height = footY - top;
  const headBottom = top + CHILD_HEAD_FRACTION * height;
  let weight = 0;
  let sum = 0;
  for (let y = top; y < headBottom; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const a = alphaAt(image, x, y);
      weight += a;
      sum += a * (x + 0.5);
    }
  }
  return { col, row, footX: (minX + maxX + 1) / 2, footY, top, height, headCentreX: sum / weight };
};

// Bilinear sample of premultiplied colour at continuous (x, y), restricted to the source cell (col, row).
const sampleInto = (image: RgbaImage, col: number, row: number, x: number, y: number, out: number[]): void => {
  const px = x - 0.5;
  const py = y - 0.5;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  for (let dy = 0; dy < 2; dy += 1) {
    for (let dx = 0; dx < 2; dx += 1) {
      const sx = ix + dx;
      const sy = iy + dy;
      if (sx < 0 || sy < 0 || sx >= NATIVE_W || sy >= NATIVE_H || cellOf(sx) !== col || rowOf(sy) !== row) continue;
      const w = (dx === 0 ? 1 - fx : fx) * (dy === 0 ? 1 - fy : fy);
      if (w === 0) continue;
      const offset = (sy * NATIVE_W + sx) * 4;
      const a = image.rgba[offset + 3] ?? 0;
      if (a === 0) continue;
      const wa = (w * a) / 255;
      out[0] = (out[0] ?? 0) + wa * (image.rgba[offset] ?? 0);
      out[1] = (out[1] ?? 0) + wa * (image.rgba[offset + 1] ?? 0);
      out[2] = (out[2] ?? 0) + wa * (image.rgba[offset + 2] ?? 0);
      out[3] = (out[3] ?? 0) + w * a;
    }
  }
};

// Child head enlargement: forward map of distance above the neck u -> d, scale k(u) ramping 1 -> 1.25 over [0, b].
const childHeadInverse = (d: number, ramp: number): { readonly u: number; readonly k: number } => {
  const extra = CHILD_HEAD_SCALE - 1;
  const rampTop = ramp * (1 + extra / 2);
  if (d <= rampTop) {
    const u = ((-1 + Math.sqrt(1 + (2 * extra * d) / ramp)) * ramp) / extra;
    return { u, k: 1 + (extra * u) / ramp };
  }
  return { u: ramp + (d - rampTop) / CHILD_HEAD_SCALE, k: CHILD_HEAD_SCALE };
};

const renderVariant = (source: RgbaImage, geometry: readonly CellGeometry[], variant: Variant): Premult => {
  const out = new Float64Array(NATIVE_W * NATIVE_H * 4);
  const sample = [0, 0, 0, 0];
  const lower = [0, 0, 0, 0];
  const lean = Math.tan((ELDER_LEAN_DEG * Math.PI) / 180);
  for (let y = 0; y < NATIVE_H; y += 1) {
    const row = rowOf(y);
    for (let x = 0; x < NATIVE_W; x += 1) {
      const col = cellOf(x);
      const g = geometry[row * 4 + col];
      if (g === undefined) throw new Error("missing geometry");
      const X = x + 0.5;
      const Y = y + 0.5;
      if (variant === "adult") {
        sampleInto(source, col, row, X, Y, sample);
      } else if (variant === "child") {
        const shrunkHeight = CHILD_SCALE * g.height;
        const neckY = g.footY - (1 - CHILD_HEAD_FRACTION) * shrunkHeight;
        const neckX = g.footX + CHILD_SCALE * (g.headCentreX - g.footX);
        let xs = X;
        let ys = Y;
        if (Y < neckY) {
          const { u, k } = childHeadInverse(neckY - Y, CHILD_HEAD_RAMP * CHILD_HEAD_FRACTION * shrunkHeight);
          ys = neckY - u;
          xs = neckX + (X - neckX) / k;
        }
        sampleInto(source, col, row, g.footX + (xs - g.footX) / CHILD_SCALE, g.footY + (ys - g.footY) / CHILD_SCALE, sample);
      } else {
        const hipY = g.footY - ELDER_HIP_FRACTION * ELDER_VSCALE * g.height;
        const drop = ELDER_DROP_PX * SCALE;
        const facing = FACING[DIRECTIONS[col] ?? "NE"];
        sample[0] = 0;
        sample[1] = 0;
        sample[2] = 0;
        sample[3] = 0;
        const upperY = Y - drop;
        if (upperY < hipY) {
          const upperX = X - facing * lean * (hipY - upperY);
          sampleInto(source, col, row, upperX, g.footY + (upperY - g.footY) / ELDER_VSCALE, sample);
        }
        if (Y >= hipY && (sample[3] ?? 0) < 255) {
          sampleInto(source, col, row, X, g.footY + (Y - g.footY) / ELDER_VSCALE, lower);
          const keep = 1 - (sample[3] ?? 0) / 255;
          for (let c = 0; c < 4; c += 1) sample[c] = (sample[c] ?? 0) + (lower[c] ?? 0) * keep;
        }
      }
      const offset = (y * NATIVE_W + x) * 4;
      for (let c = 0; c < 4; c += 1) out[offset + c] = sample[c] ?? 0;
    }
  }
  return out;
};

type Tap = { readonly index: number; readonly weight: number };
const boxTaps = (sourceLength: number, targetLength: number): readonly (readonly Tap[])[] => {
  const ratio = sourceLength / targetLength;
  return Array.from({ length: targetLength }, (_, t) => {
    const start = t * ratio;
    const end = (t + 1) * ratio;
    const taps: Tap[] = [];
    for (let s = Math.floor(start); s < Math.ceil(end) && s < sourceLength; s += 1) {
      const overlap = Math.min(end, s + 1) - Math.max(start, s);
      if (overlap > 0) taps.push({ index: s, weight: overlap / ratio });
    }
    return taps;
  });
};

const areaDownscale = (native: Premult): RgbaImage => {
  const xTaps = boxTaps(NATIVE_W, OUT_W);
  const yTaps = boxTaps(NATIVE_H, OUT_H);
  const horizontal = new Float64Array(OUT_W * NATIVE_H * 4);
  for (let y = 0; y < NATIVE_H; y += 1) {
    for (let x = 0; x < OUT_W; x += 1) {
      for (const tap of xTaps[x] ?? []) {
        const s = (y * NATIVE_W + tap.index) * 4;
        const t = (y * OUT_W + x) * 4;
        for (let c = 0; c < 4; c += 1) horizontal[t + c] = (horizontal[t + c] ?? 0) + (native[s + c] ?? 0) * tap.weight;
      }
    }
  }
  const rgba = new Uint8Array(OUT_W * OUT_H * 4);
  const acc = [0, 0, 0, 0];
  for (let y = 0; y < OUT_H; y += 1) {
    for (let x = 0; x < OUT_W; x += 1) {
      acc.fill(0);
      for (const tap of yTaps[y] ?? []) {
        const s = (tap.index * OUT_W + x) * 4;
        for (let c = 0; c < 4; c += 1) acc[c] = (acc[c] ?? 0) + (horizontal[s + c] ?? 0) * tap.weight;
      }
      const t = (y * OUT_W + x) * 4;
      const a = acc[3] ?? 0;
      const alpha = Math.min(255, Math.max(0, Math.round(a)));
      rgba[t + 3] = alpha;
      if (alpha === 0) continue;
      for (let c = 0; c < 3; c += 1) rgba[t + c] = Math.min(255, Math.max(0, Math.round(((acc[c] ?? 0) * 255) / a)));
    }
  }
  return { dimensions: { width: OUT_W, height: OUT_H }, rgba };
};

type CellMeasure = {
  readonly direction: Direction;
  readonly gaitFrame: number;
  readonly foot: { readonly x: number; readonly y: number };
  readonly headTopY: number;
  readonly headCentreX: number;
  readonly figureHeight: number;
};

const measureOutputCell = (image: RgbaImage, col: number, row: number): CellMeasure => {
  const alpha = (x: number, y: number): number => image.rgba[((row * CELL + y) * OUT_W + col * CELL + x) * 4 + 3] ?? 0;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      if (alpha(x, y) >= OPAQUE) {
        if (top < 0) top = y;
        bottom = y;
        break;
      }
    }
  }
  if (top < 0) throw new Error(`empty output cell ${col},${row}`);
  let minX = CELL;
  let maxX = -1;
  for (let x = 0; x < CELL; x += 1) {
    if (alpha(x, bottom) >= OPAQUE) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  const figureHeight = bottom - top + 1;
  // Head centre: alpha-weighted centre x of the top 20% of the figure.
  let weight = 0;
  let sum = 0;
  for (let y = top; y < top + Math.max(1, Math.round(0.2 * figureHeight)); y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      weight += alpha(x, y);
      sum += alpha(x, y) * x;
    }
  }
  return {
    direction: DIRECTIONS[col] ?? "NE",
    gaitFrame: row,
    foot: { x: (minX + maxX) / 2, y: bottom },
    headTopY: top,
    headCentreX: Math.round((sum / weight) * 100) / 100,
    figureHeight,
  };
};

// Facing check on the front views: centre x of skin-toned pixels in the head region relative to the head centre.
const faceOffset = (image: RgbaImage, g: CellGeometry): number | null => {
  const [x0, x1] = cellRange(g.col, NATIVE_W);
  let count = 0;
  let sum = 0;
  for (let y = g.top; y < g.top + 0.2 * g.height; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const o = (y * NATIVE_W + x) * 4;
      const r = image.rgba[o] ?? 0;
      const gr = image.rgba[o + 1] ?? 0;
      const b = image.rgba[o + 2] ?? 0;
      if ((image.rgba[o + 3] ?? 0) >= 200 && r >= 150 && r - gr >= 25 && gr - b >= 10) {
        count += 1;
        sum += x + 0.5;
      }
    }
  }
  return count < 200 ? null : Math.round((sum / count - g.headCentreX) * 10) / 10;
};

const composeContactSheet = (rows: readonly RgbaImage[]): RgbaImage => {
  const zoom = 3;
  const gap = 6;
  const width = 8 * CELL * zoom;
  const height = rows.length * CELL * zoom + gap;
  const rgba = new Uint8Array(width * height * 4);
  const background = [238, 233, 222];
  const cellLine = [205, 199, 186];
  const ground = [214, 120, 110];
  for (let i = 0; i < width * height; i += 1) {
    rgba.set([...background, 255], i * 4);
  }
  rows.forEach((image, rowIndex) => {
    const originY = rowIndex * CELL * zoom + (rowIndex >= 3 ? gap : 0);
    for (let cell = 0; cell < 8; cell += 1) {
      const col = cell % 4;
      const gait = Math.floor(cell / 4);
      for (let y = 0; y < CELL * zoom; y += 1) {
        for (let x = 0; x < CELL * zoom; x += 1) {
          const tx = cell * CELL * zoom + x;
          const ty = originY + y;
          let base = background;
          if (x === 0 || y === 0) base = cellLine;
          if (y === 67 * zoom) base = ground;
          const s = ((gait * CELL + Math.floor(y / zoom)) * OUT_W + col * CELL + Math.floor(x / zoom)) * 4;
          const a = (image.rgba[s + 3] ?? 0) / 255;
          const t = (ty * width + tx) * 4;
          for (let c = 0; c < 3; c += 1) {
            rgba[t + c] = Math.round((image.rgba[s + c] ?? 0) * a + (base[c] ?? 0) * (1 - a));
          }
          rgba[t + 3] = 255;
        }
      }
    }
  });
  return { dimensions: { width, height }, rgba };
};

type SheetSummary = {
  readonly assetId: string;
  readonly variant: "child" | "elder";
  readonly sourceName: string;
  readonly sha256: string;
  readonly cells: readonly {
    readonly direction: Direction;
    readonly gaitFrame: number;
    readonly adult: CellMeasure;
    readonly derived: CellMeasure;
    readonly footDelta: { readonly x: number; readonly y: number };
    readonly heightRatio: number;
    readonly pass: boolean;
  }[];
};

const readme = (sheets: readonly SheetSummary[], pass: boolean): string => {
  const lines = [
    "# 파생 템플릿 (아이·노인) — 설치하지 않음",
    "",
    "`scripts/deriveActorTemplates.ts`가 성인 원본 `actor_civilian_man-v1.png`·`actor_civilian_woman-v1.png`(1774×887)에서 결정적으로 만든 **Astra 리스킨용 참고 시트**다. 생성 모델을 쓰지 않았고 게임에 설치하지 않는다. 재실행하면 바이트 단위로 같은 파일이 나온다.",
    "",
    "- 형식: 296×148 RGBA, 열 NE·SE·SW·NW, 행 보행 프레임 0·1, 셀 74×74 (Wave 5 walker 형식).",
    "- 셀 정규화: 원본 캔버스 전체를 296/1774로 면적 평균 축소(워커 매니페스트가 레거시 시트를 읽는 방식과 같음, `measurements.json`의 `manifestCheck`에서 발 y·키가 1px 이내로 일치 확인).",
    `- 아이: 발 접점 기준 ${CHILD_SCALE}배 축소 → 축소된 몸의 위 ${CHILD_HEAD_FRACTION * 100}%(머리 영역)를 목 지점 기준 ${CHILD_HEAD_SCALE}배 확대. 목선에서 머리 영역 아래 ${CHILD_HEAD_RAMP * 100}% 구간은 배율을 1.0→${CHILD_HEAD_SCALE}로 서서히 올려 어깨와 끊기지 않게 했다.`,
    `- 노인: 발 접점 기준 세로 ${ELDER_VSCALE}배 → 엉덩이선(키의 ${ELDER_HIP_FRACTION * 100}%) 위 상체를 진행 방향으로 ${ELDER_LEAN_DEG}° 기울임(NE·SE 화면 오른쪽, SW·NW 화면 왼쪽) → 상체만 ${ELDER_DROP_PX}px 아래로 내림. 발은 움직이지 않는다.`,
    "- 리샘플: 원본 해상도에서 프리멀티플라이 알파 쌍선형 샘플링 후 한 번만 면적 평균 축소.",
    "- **보행 교대는 성인 원본의 것을 그대로 쓴다(변경 없음).** 따라서 검증은 아래 발·머리 표뿐이다.",
    "- 여자 원본의 프레임1 셀은 원래 발이 y63–64에 있다(y67 접지선보다 위). 파생 시트도 성인 셀의 발 위치를 그대로 유지한다.",
    "",
    `게이트: 모든 파생 셀의 발 접점이 성인 셀 대비 ±${GATE_FOOT_PX}px, 키 비율 아이 ${GATE_CHILD_RATIO[0]}–${GATE_CHILD_RATIO[1]}, 노인 ${GATE_ELDER_RATIO[0]}–${GATE_ELDER_RATIO[1]}. 결과: **${pass ? "통과" : "실패"}**.`,
    "",
    "측정 정의(셀 좌표, 알파 ≥ 128): 발 = 가장 아래 불투명 행의 불투명 구간 중점(x)과 그 행(y), 머리 위 = 첫 불투명 행, 머리 중심 x = 위 20% 행의 알파 가중 중심, 키 = 발 y − 머리 위 + 1.",
    "",
  ];
  for (const sheet of sheets) {
    const ratios = sheet.cells.map((c) => c.heightRatio);
    lines.push(
      `## ${sheet.assetId}-v1.png (${sheet.variant === "child" ? "아이" : "노인"}, 원본 ${sheet.sourceName})`,
      "",
      `SHA-256 \`${sheet.sha256}\` · 키 비율 ${Math.min(...ratios)}–${Math.max(...ratios)}`,
      "",
      "| 셀 | 성인 발 (x,y) | 파생 발 (x,y) | 발 차이 | 성인 머리 위 y / 중심 x | 파생 머리 위 y / 중심 x | 키 성인→파생 | 비율 | 판정 |",
      "|---|---|---|---|---|---|---|---|---|",
      ...sheet.cells.map((c) =>
        `| ${c.direction}${c.gaitFrame} | ${c.adult.foot.x},${c.adult.foot.y} | ${c.derived.foot.x},${c.derived.foot.y} | ${c.footDelta.x},${c.footDelta.y} | ${c.adult.headTopY} / ${c.adult.headCentreX} | ${c.derived.headTopY} / ${c.derived.headCentreX} | ${c.adult.figureHeight}→${c.derived.figureHeight} | ${c.heightRatio} | ${c.pass ? "통과" : "실패"} |`),
      "",
    );
  }
  lines.push(
    "## 파일",
    "",
    "- `actor_child_template_{m,f}-v1.png`, `actor_elder_template_{m,f}-v1.png`",
    "- `provenance-derived-templates.csv` — `docs/provenance/assets.csv`와 같은 열",
    "- `measurements.json` — 위 표의 원자료, 매니페스트 대조, 방향 확인",
    "- `checks/derived-vs-adult.png` — 3배 최근접 확대. 행 순서: 남 성인·남 아이·남 노인 / 여 성인·여 아이·여 노인, 열 순서: NE0 SE0 SW0 NW0 NE1 SE1 SW1 NW1, 붉은 선 = y67 접지선",
    "",
    "재생성: `npx tsx scripts/deriveActorTemplates.ts`",
    "",
  );
  return lines.join("\n");
};

const csvCell = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const main = (): void => {
  const outDir = path.join(ROOT, OUT_DIR);
  mkdirSync(path.join(outDir, "checks"), { recursive: true });
  const provenanceHeader = readFileSync(path.join(ROOT, "docs/provenance/assets.csv"), "utf8").split("\n")[0]?.trim() ?? "";
  const provenanceRows: string[] = [provenanceHeader];
  const measurements: Record<string, unknown> = {
    generatedBy: "scripts/deriveActorTemplates.ts",
    definitions: {
      grid: "296x148, 74x74 cells, columns NE SE SW NW, rows gait frame 0 / 1; coordinates are cell-local pixels",
      opaque: `alpha >= ${OPAQUE}`,
      foot: "x = midpoint of the opaque span in the lowest opaque row, y = that row",
      headTopY: "first opaque row",
      headCentreX: "alpha-weighted centre x of the top 20% of the figure rows",
      figureHeight: "foot.y - headTopY + 1",
      gates: {
        footPx: GATE_FOOT_PX,
        childHeightRatio: GATE_CHILD_RATIO,
        elderHeightRatio: GATE_ELDER_RATIO,
      },
    },
    parameters: {
      child: { scale: CHILD_SCALE, headFraction: CHILD_HEAD_FRACTION, headScale: CHILD_HEAD_SCALE, headRampFraction: CHILD_HEAD_RAMP },
      elder: { verticalScale: ELDER_VSCALE, hipFraction: ELDER_HIP_FRACTION, leanDegrees: ELDER_LEAN_DEG, upperBodyDropPx: ELDER_DROP_PX, facing: FACING },
    },
    sheets: {} as Record<string, unknown>,
    manifestCheck: {} as Record<string, unknown>,
    facingCheck: {} as Record<string, unknown>,
  };
  const failures: string[] = [];
  const contactRows: RgbaImage[] = [];
  const summaries: SheetSummary[] = [];
  const manifest = readFileSync(path.join(ROOT, "src/render/walkerSheetManifest.generated.ts"), "utf8");

  for (const [sex, sourceName] of [["m", "actor_civilian_man"], ["f", "actor_civilian_woman"]] as const satisfies readonly (readonly [Sex, string])[]) {
    const sourceRel = `${SOURCE_DIR}/${sourceName}-v1.png`;
    const sourceBytes = readFileSync(path.join(ROOT, sourceRel));
    const source = readPng(path.join(ROOT, sourceRel));
    if (source.dimensions.width !== NATIVE_W || source.dimensions.height !== NATIVE_H) throw new Error(`${sourceRel} is not 1774x887`);
    const geometry: CellGeometry[] = [];
    for (let row = 0; row < 2; row += 1) for (let col = 0; col < 4; col += 1) geometry.push(measureNativeCell(source, col, row));

    const adult = areaDownscale(renderVariant(source, geometry, "adult"));
    const adultCells = geometry.map((g) => measureOutputCell(adult, g.col, g.row));

    // The walker manifest reads these legacy sheets at 296/1774; compare its per-frame foot / height to our cells.
    const entryId = sex === "m" ? "legacy_civilian_man" : "legacy_civilian_woman";
    const entryLine = manifest.split("\n").find((line) => line.includes(`"id":"${entryId}"`));
    if (entryLine === undefined) throw new Error(`${entryId} missing from walker manifest`);
    const entry = JSON.parse(entryLine.replace(/,\s*$/, "")) as {
      frames: { direction: Direction; gaitFrame: number; foot: { x: number; y: number }; figureHeight: number }[];
    };
    (measurements.manifestCheck as Record<string, unknown>)[entryId] = entry.frames.map((frame) => {
      const cell = adultCells.find((c) => c.direction === frame.direction && c.gaitFrame === frame.gaitFrame);
      if (cell === undefined) throw new Error("cell missing");
      return {
        direction: frame.direction,
        gaitFrame: frame.gaitFrame,
        manifestFoot: frame.foot,
        manifestFigureHeight: frame.figureHeight,
        measuredFoot: cell.foot,
        measuredFigureHeight: cell.figureHeight,
        footYDelta: Math.round((cell.foot.y + 1 - frame.foot.y) * 100) / 100,
        footXDelta: Math.round((cell.foot.x + 0.5 - frame.foot.x) * 100) / 100,
      };
    });
    (measurements.facingCheck as Record<string, unknown>)[sourceName] = geometry.map((g) => ({
      direction: DIRECTIONS[g.col],
      gaitFrame: g.row,
      assumedFacing: FACING[DIRECTIONS[g.col] ?? "NE"] > 0 ? "screen-right" : "screen-left",
      skinCentreMinusHeadCentreNativePx: faceOffset(source, g),
    }));

    contactRows.push(adult);
    for (const variant of ["child", "elder"] as const) {
      const assetId = `actor_${variant}_template_${sex}`;
      const fileRel = `${OUT_DIR}/${assetId}-v1.png`;
      const derived = areaDownscale(renderVariant(source, geometry, variant));
      writePng(path.join(ROOT, fileRel), derived);
      const derivedSha = sha256(readFileSync(path.join(ROOT, fileRel)));
      contactRows.push(derived);
      const [low, high] = variant === "child" ? GATE_CHILD_RATIO : GATE_ELDER_RATIO;
      const cells = geometry.map((g, index) => {
        const a = adultCells[index];
        if (a === undefined) throw new Error("adult cell missing");
        const d = measureOutputCell(derived, g.col, g.row);
        const ratio = Math.round((d.figureHeight / a.figureHeight) * 1000) / 1000;
        const footDx = d.foot.x - a.foot.x;
        const footDy = d.foot.y - a.foot.y;
        const pass = Math.abs(footDx) <= GATE_FOOT_PX && Math.abs(footDy) <= GATE_FOOT_PX && ratio >= low && ratio <= high;
        if (!pass) failures.push(`${assetId} ${d.direction}${d.gaitFrame}: foot d=(${footDx},${footDy}) ratio=${ratio}`);
        return { direction: d.direction, gaitFrame: d.gaitFrame, adult: a, derived: d, footDelta: { x: footDx, y: footDy }, heightRatio: ratio, pass };
      });
      (measurements.sheets as Record<string, unknown>)[assetId] = { file: fileRel, sha256: derivedSha, source: sourceRel, cells };
      summaries.push({ assetId, variant, sourceName, sha256: derivedSha, cells });
      const manualEdits = variant === "child"
        ? `scripted only: per cell scale ${CHILD_SCALE} about the foot contact; head region (top ${CHILD_HEAD_FRACTION * 100}% of shrunk figure) enlarged ${CHILD_HEAD_SCALE}x about the neck point, scale ramped from 1.0 at the neck over the lowest ${CHILD_HEAD_RAMP * 100}% of the head region; bilinear premultiplied sampling at native 1774x887, area downscale to 296x148; no hand edits`
        : `scripted only: per cell vertical scale ${ELDER_VSCALE} about the foot contact; ${ELDER_LEAN_DEG} deg forward skew above the hip (${ELDER_HIP_FRACTION * 100}% of figure height) toward the facing (NE/SE screen-right, SW/NW screen-left); upper body shifted down ${ELDER_DROP_PX}px over the lower body, feet fixed; bilinear premultiplied sampling at native 1774x887, area downscale to 296x148; no hand edits`;
      provenanceRows.push([
        assetId, "v1", fileRel, derivedSha, sourceRel, sha256(sourceBytes),
        "scripts/deriveActorTemplates.ts (deterministic, no generation)", "not applicable", GENERATED_AT, "not applicable",
        `${sourceName}-v1.png`, "not applicable", "1", manualEdits, "AB_2026-09-19_v1", "S_England_1300_1450_v1",
        "INSTALL-4e (script)", "Astra reskin reference for Wave 5c; not installed", "template",
        `derived ${variant} template from ${sourceName}; walk alternation is the adult original's (unchanged); gate results in ${OUT_DIR}/measurements.json`,
      ].map(csvCell).join(","));
    }
  }

  const contact = composeContactSheet(contactRows);
  writePng(path.join(outDir, "checks/derived-vs-adult.png"), contact);
  writeFileSync(path.join(outDir, "provenance-derived-templates.csv"), `${provenanceRows.join("\n")}\n`);
  measurements.gate = { pass: failures.length === 0, failures };
  writeFileSync(path.join(outDir, "measurements.json"), `${JSON.stringify(measurements, null, 2)}\n`);
  writeFileSync(path.join(outDir, "README.md"), readme(summaries, failures.length === 0));
  if (failures.length > 0) {
    process.stderr.write(`gate failed:\n${failures.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("derived templates written; gate pass\n");
};

main();
