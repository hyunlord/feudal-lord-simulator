import type { Tile } from "../world.types";
import type { ArableStripLayout } from "../../zones/arableStrips";
import { boundaryHash, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "./boundaryGeometry";

// Arable field layout (C1e, asset spec 4.4): how a painted arable zone is filled with ridge strips. Pure and derived
// (nothing saved or read by rules): the same zone membership, ground and seed always give the same layout.
//  - Strips: the engine's read model (`arableStripStates`, C1c Z-18) cuts the zone into 1-tile runs parallel to its
//    main axis. A run is drawn only over cells that can carry crops: grass, no road, no building (a wheat farm keeps
//    its 2x2 sprite until the engine replaces farms with zone strips, C1c-2).
//  - Rows: every 1-tile strip is two 0.5-tile ridge rows (the 512x64 strip at 128 px per tile, as painted). Each row
//    picks a phase in the two-image period (a | b, 8 tiles) so that no row within 4 tiles shows the same image at the
//    same place: along a row a and b alternate span by span (4 tiles each).
//  - Headland: the crop area is the drawable cells eroded by HEADLAND (square erosion), so every outer edge keeps a
//    soil margin without crops; two strips that touch share no margin (a furrow stamp may mark the join).
//  - Furrow stamps: short 0.75-1.5 tile furrows on the joins between strips, one variant of four, never the same
//    variant within FURROW_REPEAT_RADIUS (a candidate with no free variant is dropped).

export const HEADLAND = 0.2;
export const RIDGE_ROWS_PER_STRIP = 2;
/** Tiles along a ridge row covered by one strip image, and by the a | b pair. */
export const RIDGE_SPAN = 4;
export const RIDGE_PERIOD = RIDGE_SPAN * 2;
/** Row phases are multiples of this (tiles), so rows within the repeat radius can be kept apart exactly. */
export const RIDGE_PHASE_STEP = 0.5;
export const RIDGE_REPEAT_RADIUS = 4;
export const FURROW_VARIANTS = 4;
export const FURROW_REPEAT_RADIUS = 4;
const FURROW_SPACING = 3;
const FURROW_MIN_LENGTH = 0.75;
const FURROW_MAX_LENGTH = 1.5;

export type CropRect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

export type RidgeRow = {
  /** Offset across the strip: row 0 is the -across half. */
  readonly index: number;
  /** Tiles: where the a | b pair starts, as a position along the axis modulo RIDGE_PERIOD. */
  readonly phase: number;
};

export type ArableBand = {
  readonly stripId: string;
  /** Line across the axis (ty for axis x, tx for axis y) and the first / last cell along it. */
  readonly line: number;
  readonly from: number;
  readonly to: number;
  readonly rows: readonly RidgeRow[];
  readonly bounds: BoundaryBounds;
};

export type FurrowStamp = {
  /** Middle of the stroke on the join between two strips (tile-centre coordinates). */
  readonly anchor: BoundaryPoint;
  readonly variant: number;
  /** Stroke length in tiles. */
  readonly length: number;
};

export type ArableField = {
  readonly zoneId: string;
  readonly axis: "x" | "y";
  readonly bands: readonly ArableBand[];
  /** Crop area (drawable cells eroded by HEADLAND) as rectangles with shared edges: one clip path. */
  readonly crop: readonly CropRect[];
  readonly stamps: readonly FurrowStamp[];
  readonly hash: number;
};

export type ArableFieldInput = {
  readonly zoneId: string;
  readonly zoneOrdinal: number;
  readonly layout: ArableStripLayout;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly cells: readonly (Tile | undefined)[];
  readonly seed: number;
  /** Stamps already placed by earlier zones (near rejection runs across zones); appended to. */
  readonly placedStamps: FurrowStamp[];
};

export function arableField(input: ArableFieldInput): ArableField {
  const { mapWidth, mapHeight, layout } = input;
  const axis = layout.axis;
  const member = new Set<number>();
  for (const strip of layout.strips) for (const cell of strip.cells) member.add(cell.ty * mapWidth + cell.tx);
  const drawable = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) return false;
    const index = ty * mapWidth + tx;
    const tile = input.cells[index];
    return member.has(index) && tile !== undefined && tile.terrain === "grass" && !tile.hasRoad && tile.buildingId === null;
  };

  // Bands: runs of drawable cells inside each engine strip.
  const bands: { stripId: string; line: number; from: number; to: number }[] = [];
  for (const strip of layout.strips) {
    let start: number | null = null; let previous: number | null = null;
    const line = axis === "x" ? strip.cells[0]?.ty ?? 0 : strip.cells[0]?.tx ?? 0;
    const flush = () => { if (start !== null && previous !== null) bands.push({ stripId: strip.id, line, from: start, to: previous }); start = null; previous = null; };
    for (const cell of strip.cells) {
      const along = axis === "x" ? cell.tx : cell.ty;
      const ok = drawable(cell.tx, cell.ty);
      if (!ok || (previous !== null && along !== previous + 1)) flush();
      if (ok) { start ??= along; previous = along; }
    }
    flush();
  }

  // Row phases: rows are ordered across the axis (line, then row); each takes the first phase slot from its hash that
  // no row within RIDGE_REPEAT_RADIUS across has taken (slots are 0.5 tile apart, so 16 slots for 8 rows at most).
  const lines = [...new Set(bands.map(band => band.line))].sort((a, b) => a - b);
  const slots = RIDGE_PERIOD / RIDGE_PHASE_STEP;
  const reach = RIDGE_REPEAT_RADIUS * RIDGE_ROWS_PER_STRIP;
  const rowSlot = new Map<number, number>();
  for (const line of lines) {
    for (let row = 0; row < RIDGE_ROWS_PER_STRIP; row += 1) {
      const across = line * RIDGE_ROWS_PER_STRIP + row;
      const taken = new Set<number>();
      for (let back = 1; back < reach; back += 1) { const slot = rowSlot.get(across - back); if (slot !== undefined) taken.add(slot); }
      const first = boundaryHash(across + 7919 * input.zoneOrdinal, input.seed, 71) % slots;
      let slot = first;
      for (let tried = 0; tried < slots; tried += 1) {
        const option = (first + tried * 5) % slots;
        if (!taken.has(option)) { slot = option; break; }
      }
      rowSlot.set(across, slot);
    }
  }
  const tileBounds = (line: number, from: number, to: number): BoundaryBounds => axis === "x"
    ? { left: from - 0.5, top: line - 0.5, right: to + 0.5, bottom: line + 0.5 }
    : { left: line - 0.5, top: from - 0.5, right: line + 0.5, bottom: to + 0.5 };
  const arableBands: ArableBand[] = bands.map(band => ({
    ...band,
    rows: Array.from({ length: RIDGE_ROWS_PER_STRIP }, (_, index) => ({ index, phase: (rowSlot.get(band.line * RIDGE_ROWS_PER_STRIP + index) ?? 0) * RIDGE_PHASE_STEP })),
    bounds: tileBounds(band.line, band.from, band.to),
  }));

  // Crop area: square erosion of the drawable cells by HEADLAND, per cell as up to three rectangles.
  const crop: CropRect[] = [];
  const h = HEADLAND;
  for (const band of bands) {
    for (let along = band.from; along <= band.to; along += 1) {
      const tx = axis === "x" ? along : band.line; const ty = axis === "x" ? band.line : along;
      const at = (dx: number, dy: number): boolean => drawable(tx + dx, ty + dy);
      const n = at(0, -1); const s = at(0, 1); const w = at(-1, 0); const e = at(1, 0);
      const top = (side: boolean, corner: boolean): number => side && corner ? ty - 0.5 : ty - 0.5 + h;
      const bottom = (side: boolean, corner: boolean): number => side && corner ? ty + 0.5 : ty + 0.5 - h;
      crop.push({ left: tx - 0.5 + h, right: tx + 0.5 - h, top: top(n, true), bottom: bottom(s, true) });
      if (w) crop.push({ left: tx - 0.5, right: tx - 0.5 + h, top: top(n, at(-1, -1)), bottom: bottom(s, at(-1, 1)) });
      if (e) crop.push({ left: tx + 0.5 - h, right: tx + 0.5, top: top(n, at(1, -1)), bottom: bottom(s, at(1, 1)) });
    }
  }

  // Furrow stamps on the joins between strips on consecutive lines.
  const stamps: FurrowStamp[] = [];
  const cellAt = (line: number, along: number): readonly [number, number] => axis === "x" ? [along, line] : [line, along];
  for (const line of lines) {
    const alongs = bands.filter(band => band.line === line).flatMap(band => Array.from({ length: band.to - band.from + 1 }, (_, i) => band.from + i));
    const joined = alongs.filter(along => drawable(...cellAt(line, along)) && drawable(...cellAt(line + 1, along))).sort((a, b) => a - b);
    // Runs of joined cells; stamps stay HEADLAND inside each run's ends.
    const runs: [number, number][] = [];
    for (const along of joined) {
      const last = runs[runs.length - 1];
      if (last !== undefined && along === last[1] + 1) last[1] = along; else runs.push([along, along]);
    }
    for (const [first, last] of runs) {
      const low = first - 0.5 + h; const high = last + 0.5 - h;
      for (let centre = low + FURROW_SPACING / 2; centre < high; centre += FURROW_SPACING) {
        const hash = boundaryHash((line + 1) * mapWidth * 4 + Math.round(centre * 4) + 101 * input.zoneOrdinal, input.seed, 73);
        const length = FURROW_MIN_LENGTH + (FURROW_MAX_LENGTH - FURROW_MIN_LENGTH) * ((hash % 1000) / 999);
        const shifted = centre + (((hash >>> 10) % 1000) / 999 - 0.5) * 0.8;
        const middle = Math.min(high - length / 2, Math.max(low + length / 2, shifted));
        if (middle - length / 2 < low - 1e-9 || middle + length / 2 > high + 1e-9) continue;
        const anchor = axis === "x" ? { x: middle, y: line + 0.5 } : { x: line + 0.5, y: middle };
        const near = new Set(input.placedStamps.concat(stamps)
          .filter(other => Math.hypot(other.anchor.x - anchor.x, other.anchor.y - anchor.y) < FURROW_REPEAT_RADIUS).map(other => other.variant));
        const start = (hash >>> 20) % FURROW_VARIANTS;
        let variant = -1;
        for (let tried = 0; tried < FURROW_VARIANTS; tried += 1) {
          const option = (start + tried) % FURROW_VARIANTS;
          if (!near.has(option)) { variant = option; break; }
        }
        if (variant >= 0) stamps.push({ anchor, variant, length });
      }
    }
  }
  input.placedStamps.push(...stamps);

  const hash = hashNumbers([axis === "x" ? 1 : 2,
    ...arableBands.flatMap(band => [band.line, band.from, band.to, ...band.rows.map(row => row.phase)]),
    ...crop.flatMap(rect => [rect.left, rect.top, rect.right, rect.bottom]),
    ...stamps.flatMap(stamp => [stamp.anchor.x, stamp.anchor.y, stamp.variant, stamp.length])]);
  return { zoneId: input.zoneId, axis, bands: arableBands, crop, stamps, hash };
}
