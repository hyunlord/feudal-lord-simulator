import type { GameState } from "../engine/engine.types";
import type { DrainageWork } from "../engine/drainage";
import { bridgeAt, isFordRoad, type BridgeSpan } from "../world/bridges";
import type { TileCoordinate } from "../world/grid";
import type { WallGrid } from "../world/wallTraversal";
import type { FlowDirection } from "../world/river";

// LAND-UI (Wave 34): what the ground chunks draw for the land's works — the fords that carry a road (LU-D3), the fen's
// drainage works by stage (LU-D5) and the drained ground's edge — as plain data, in tile coordinates. The drawing is
// landWorksDraw.ts; this file has no canvas, so the tests read it in Node.
//  - Fords: RiverData.fords lists cells only. A group is the 4-joined ford cells (the engine puts each ford on one
//    straight crossing, perpendicular to the flow, a dozen path steps from the next: river.ts). Axis: flow e / w
//    crosses along ty, the `ne` sheet; flow n / s crosses along tx, the `nw` sheet (records/README: ne runs to the
//    screen's upper right, nw to its lower right). Width = the group's cells; there is no w1 sheet, so a single cell
//    takes w2 centred on it (LU-D4). Only a group carrying a road draws (isFordRoad, FD-1); bare fords stay water.
//  - Works: stage by workDone / workNeeded (< 1/3 staked, < 2/3 ditched, else drying). Stage 1 stakes the perimeter
//    cells; stage 2 digs two ditch rows along tx (the v3 stage-3 sheet's ditch direction); stage 3 is one region
//    sheet (3x3 when the cells' box is at most 3x3, else 5x5) on the box centre, clipped to the cells. DrainageWork
//    keeps no origin (engine handoff), so the box centre stands for it.
//  - Drained: the edges between a drained cell and any other cell carry the finished drain strip.

export type FordAxis = "ne" | "nw";
export type FordGroup = {
  readonly cells: readonly number[];
  readonly axis: FordAxis;
  /** Cells in the crossing (1 or 2 from the engine); the sheet drawn is max(2, width). */
  readonly width: number;
  /** The crossing's centre, tile coordinates. */
  readonly centre: { readonly tx: number; readonly ty: number };
  readonly road: boolean;
};

export type DrainStage = 1 | 2 | 3;
export type TileBox = { readonly minTx: number; readonly maxTx: number; readonly minTy: number; readonly maxTy: number };
export type WorkPlan = {
  readonly id: string;
  readonly stage: DrainStage;
  readonly cells: readonly number[];
  readonly box: TileBox;
  readonly digging: boolean;
  /** Stage 1: the perimeter cells and which way their stake line runs ("ty": along ty, the tile as painted; "tx": mirrored). */
  readonly stakes: readonly { readonly cell: number; readonly along: "tx" | "ty" }[];
  /** Stage 2: the ditched cells (two rows along tx). */
  readonly ditches: readonly number[];
  /** Stage 3: the region sheet. */
  readonly region: "3x3" | "5x5";
  /** A grass cell on the bank beside the works (the earth cart), or null. */
  readonly bank: number | null;
};
/** One edge of the drained set: the side of `cell` facing a cell that is not drained. */
export type DrainEdge = { readonly tx: number; readonly ty: number; readonly side: "n" | "e" | "s" | "w" };

/** LU-D3 (FD-1): the bridge span a road tile draws — none on a ford road, which wades (no deck, rails or shore lock). */
export function bridgeDeckAt(state: WallGrid, coordinate: TileCoordinate): BridgeSpan | null {
  return isFordRoad(state, coordinate) ? null : bridgeAt(state, coordinate);
}

export function fordAxis(flow: FlowDirection): FordAxis {
  return flow === "e" || flow === "w" ? "ne" : "nw";
}

/** The ford groups of a state's river, with whether each carries a road. */
export function fordGroups(state: Pick<GameState, "river" | "tiles" | "width" | "height" | "palisade">): readonly FordGroup[] {
  const river = state.river;
  if (river === undefined || river.fords.length === 0) return [];
  const { width } = state;
  const fords = new Set(river.fords);
  const seen = new Set<number>();
  const groups: FordGroup[] = [];
  for (const start of river.fords) {
    if (seen.has(start)) continue;
    const cells: number[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const cell = queue.pop()!;
      cells.push(cell);
      const x = cell % width;
      for (const next of [cell - width, cell + width, x > 0 ? cell - 1 : -1, x < width - 1 ? cell + 1 : -1]) {
        if (next >= 0 && fords.has(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    cells.sort((a, b) => a - b);
    const xs = cells.map(cell => cell % width), ys = cells.map(cell => Math.floor(cell / width));
    // Two or more cells: the crossing runs along the axis they spread on; one cell: from its flow.
    const spreadX = Math.max(...xs) - Math.min(...xs), spreadY = Math.max(...ys) - Math.min(...ys);
    const flow = river.flow[binaryIndex(river.cells, cells[0]!)] as FlowDirection | undefined ?? "s";
    const axis: FordAxis = spreadX > spreadY ? "nw" : spreadY > spreadX ? "ne" : fordAxis(flow);
    const centre = { tx: xs.reduce((sum, x) => sum + x, 0) / cells.length, ty: ys.reduce((sum, y) => sum + y, 0) / cells.length };
    const road = cells.some(cell => isFordRoad(state, { tx: cell % width, ty: Math.floor(cell / width) }));
    groups.push({ cells, axis, width: cells.length, centre, road });
  }
  return groups.sort((a, b) => a.cells[0]! - b.cells[0]!);
}

/** LU-D5: the stage a work shows. */
export function drainStage(work: Pick<DrainageWork, "workDone" | "workNeeded">): DrainStage {
  const done = work.workNeeded <= 0 ? 1 : work.workDone / work.workNeeded;
  return done < 1 / 3 ? 1 : done < 2 / 3 ? 2 : 3;
}

export function cellsBox(cells: readonly number[], width: number): TileBox {
  const xs = cells.map(cell => cell % width), ys = cells.map(cell => Math.floor(cell / width));
  return { minTx: Math.min(...xs), maxTx: Math.max(...xs), minTy: Math.min(...ys), maxTy: Math.max(...ys) };
}

/** LU-D5: the region sheet for a box — 3x3 when it fits in three by three, else 5x5. */
export function regionSheet(box: TileBox): "3x3" | "5x5" {
  return box.maxTx - box.minTx < 3 && box.maxTy - box.minTy < 3 ? "3x3" : "5x5";
}

/** The box's centre in tile coordinates (the region sheet's pivot goes there). */
export function boxCentre(box: TileBox): { readonly tx: number; readonly ty: number } {
  return { tx: (box.minTx + box.maxTx) / 2, ty: (box.minTy + box.maxTy) / 2 };
}

/** The ditch rows (ty) of a box: two for four rows or more, one otherwise. */
export function ditchRows(box: TileBox): readonly number[] {
  const rows = box.maxTy - box.minTy + 1;
  return rows >= 4 ? [box.minTy + 1, box.maxTy - 1] : [box.minTy + Math.floor((rows - 1) / 2)];
}

export function workPlan(state: Pick<GameState, "tiles" | "width" | "height">, work: DrainageWork): WorkPlan {
  const { width, height } = state;
  const own = new Set(work.cells);
  const box = cellsBox(work.cells, width);
  const stakes: { cell: number; along: "tx" | "ty" }[] = [];
  for (const cell of work.cells) {
    const x = cell % width;
    // A side open along tx (its -x / +x neighbour is outside) runs its stake line along ty, and the other way round.
    if ((x === 0 || !own.has(cell - 1)) || (x === width - 1 || !own.has(cell + 1))) stakes.push({ cell, along: "ty" });
    if (!own.has(cell - width) || !own.has(cell + width)) stakes.push({ cell, along: "tx" });
  }
  const rows = new Set(ditchRows(box));
  const ditches = work.cells.filter(cell => rows.has(Math.floor(cell / width)));
  // The bank cell nearest the box's front corner (largest tx + ty): where the earth cart stands in view.
  let bank: number | null = null;
  for (const cell of work.cells) {
    const x = cell % width, y = Math.floor(cell / width);
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || state.tiles[ny * width + nx]?.terrain !== "grass") continue;
      const next = ny * width + nx;
      if (bank === null || nx + ny > bank % width + Math.floor(bank / width) || (nx + ny === bank % width + Math.floor(bank / width) && next < bank)) bank = next;
    }
  }
  return { id: work.id, stage: drainStage(work), cells: work.cells, box, digging: (work.diggers ?? 0) > 0, stakes, ditches, region: regionSheet(box), bank };
}

/** The drained set's outer edges, in cell order. */
export function drainEdges(drained: readonly number[], width: number, height: number): readonly DrainEdge[] {
  const set = new Set(drained);
  const edges: DrainEdge[] = [];
  for (const cell of drained) {
    const tx = cell % width, ty = Math.floor(cell / width);
    if (ty === 0 || !set.has(cell - width)) edges.push({ tx, ty, side: "n" });
    if (tx === width - 1 || !set.has(cell + 1)) edges.push({ tx, ty, side: "e" });
    if (ty === height - 1 || !set.has(cell + width)) edges.push({ tx, ty, side: "s" });
    if (tx === 0 || !set.has(cell - 1)) edges.push({ tx, ty, side: "w" });
  }
  return edges;
}

/** Where a plank bridge crosses each drained patch's drain: the middle cell of the patch's top (smallest ty) row, its north side. */
export function plankBridges(drained: readonly number[], width: number): readonly { readonly tx: number; readonly ty: number }[] {
  const set = new Set(drained);
  const seen = new Set<number>();
  const bridges: { tx: number; ty: number }[] = [];
  for (const start of drained) {
    if (seen.has(start)) continue;
    const patch: number[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const cell = queue.pop()!;
      patch.push(cell);
      const x = cell % width;
      for (const next of [cell - width, cell + width, x > 0 ? cell - 1 : -1, x < width - 1 ? cell + 1 : -1]) {
        if (next >= 0 && set.has(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    const top = Math.min(...patch.map(cell => Math.floor(cell / width)));
    const row = patch.filter(cell => Math.floor(cell / width) === top).sort((a, b) => a - b);
    const cell = row[Math.floor((row.length - 1) / 2)]!;
    bridges.push({ tx: cell % width, ty: top });
  }
  return bridges;
}

/** Index of `value` in a sorted array (or -1). */
function binaryIndex(sorted: readonly number[], value: number): number {
  let low = 0, high = sorted.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const at = sorted[mid]!;
    if (at === value) return mid;
    if (at < value) low = mid + 1; else high = mid - 1;
  }
  return -1;
}
