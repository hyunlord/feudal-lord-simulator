/**
 * ARCH-1b (spec docs/design/map-archetypes.md MA-9): a river across the map — deterministic in (land, seed).
 *
 * The channel is the cheapest 4-neighbour path from one map edge to the opposite edge (or, on the coast, to the sea)
 * over the land's elevation, bent by a noise term, through the lakes it meets (still water costs little). The town site
 * and the logging camp's copse are closed to it, so the opening village and the first street stand on every seed. Its
 * width wanders between the land's least and most (the riverside town's and the fen's river 2–4, the other lands' brook
 * 1–2). Every channel cell keeps the direction the water leaves it (downstream), for the render's current arrows and
 * mill races (Wave 29); fords are the narrow reaches, bridge sites the straight crossings with open banks.
 */
import { hashSeed } from "../content/seedHash";
import type { TerrainType } from "../content/terrainConfig";
import { fbm } from "./noise";

export type FlowDirection = "n" | "e" | "s" | "w";

export interface RiverData {
  /** `river` (2–4 wide) or `brook` (1–2). */
  readonly kind: "river" | "brook";
  /** The channel's tile indices (row-major), ascending. */
  readonly cells: readonly number[];
  /** The direction the water leaves each channel cell, one letter per cell in `cells` order (n, e, s, w in grid axes). */
  readonly flow: string;
  /** Narrow reaches (width ≤ 2 with open banks): tile indices of the ford's channel cells. */
  readonly fords: readonly number[];
  /** Straight crossings of at most 4 channel cells with open banks on both sides: one bank tile and the crossing's axis. */
  readonly bridgeSites: readonly { readonly tx: number; readonly ty: number; readonly axis: "x" | "y" }[];
}

export interface RiverSpec {
  readonly kind: "river" | "brook";
  readonly minWidth: number;
  readonly maxWidth: number;
  /** The water the channel ends in: the opposite map edge, or the sea (water joined to the map's edge). */
  readonly mouth: "edge" | "sea";
}

interface Rect { readonly minTx: number; readonly maxTx: number; readonly minTy: number; readonly maxTy: number }

/** Tiles from the side edges within which the channel pays more (MA-9). */
const SIDE_MARGIN = 7;
/** The meander's centre line lies this many tiles (plus the seed's 0–6) from the edge across the flow (MA-9). */
const MEANDER_CENTRE = 13;
/** Tiles around the town site within which the channel pays more (MA-9). */
const SITE_ROOM = 6;
/** What a tile off the centre line costs the channel, per tile. */
const MEANDER_PULL = 1.4;

const STEPS = [{ tx: 0, ty: -1, dir: "n" }, { tx: 1, ty: 0, dir: "e" }, { tx: 0, ty: 1, dir: "s" }, { tx: -1, ty: 0, dir: "w" }] as const;

/** A binary heap of (cost, index), smallest first; ties by index so the path is deterministic. */
class Heap {
  private readonly items: [number, number][] = [];
  get size(): number { return this.items.length; }
  push(cost: number, index: number): void {
    const items = this.items;
    items.push([cost, index]);
    let at = items.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (this.less(items[parent]!, items[at]!)) break;
      [items[parent], items[at]] = [items[at]!, items[parent]!];
      at = parent;
    }
  }
  pop(): [number, number] {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1, right = left + 1;
        let best = at;
        if (left < items.length && this.less(items[left]!, items[best]!)) best = left;
        if (right < items.length && this.less(items[right]!, items[best]!)) best = right;
        if (best === at) break;
        [items[best], items[at]] = [items[at]!, items[best]!];
        at = best;
      }
    }
    return top;
  }
  private less(a: [number, number], b: [number, number]): boolean { return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]); }
}

const inRect = (rect: Rect, tx: number, ty: number) => tx >= rect.minTx && tx <= rect.maxTx && ty >= rect.minTy && ty <= rect.maxTy;

/** Water joined to the map's edge (the sea). */
function seaCells(terrains: readonly TerrainType[], width: number, height: number): Uint8Array {
  const sea = new Uint8Array(terrains.length);
  const queue: number[] = [];
  for (let index = 0; index < terrains.length; index += 1) {
    const tx = index % width, ty = Math.floor(index / width);
    if (terrains[index] === "water" && (tx === 0 || ty === 0 || tx === width - 1 || ty === height - 1)) { sea[index] = 1; queue.push(index); }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const tx = index % width, ty = Math.floor(index / width);
    for (const step of STEPS) {
      const x = tx + step.tx, y = ty + step.ty;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const next = y * width + x;
      if (sea[next] === 0 && terrains[next] === "water") { sea[next] = 1; queue.push(next); }
    }
  }
  return sea;
}

/**
 * MA-9: carve the channel into `terrains` (in place: channel cells become water) and return its data, or null when no
 * path exists. `lift(index)` is the land's elevation; `closed` the rectangles the channel may not enter; `source` the
 * edge it rises at — it runs to the opposite edge, or on the coast to the sea.
 */
export function carveRiver(terrains: TerrainType[], width: number, height: number, seed: number, spec: RiverSpec,
  lift: (index: number) => number, closed: readonly Rect[], source: RiverSource): RiverData | null {
  const count = width * height;
  const cost = new Float64Array(count);
  // The meander: a bending centre line (a sine of the seed's wavelength and phase, and slow noise) the channel pays to
  // leave, on the far side of the map from the town site (west of it running south, north of it running east); the
  // side edges parallel to the flow cost more near the rim, so the river crosses the map instead of hugging it.
  const acrossNorthSouth = source === "north" || source === "south";
  const amplitude = spec.kind === "river" ? 5 : 3.5;
  const wavelength = 20 + hashSeed(seed, "river:wave") % 12;
  const phase = (hashSeed(seed, "river:phase") % 628) / 100;
  // The centre line lies in the half of the map away from the town site (the first closed rectangle): west of it or
  // north of it for the riverside town's own site, the other side when the guardrail's seeds move the site there.
  const extent = acrossNorthSouth ? width : height;
  const site = closed[0];
  const siteAcross = site === undefined ? extent : acrossNorthSouth ? (site.minTx + site.maxTx) / 2 : (site.minTy + site.maxTy) / 2;
  const fromEdge = MEANDER_CENTRE + hashSeed(seed, "river:centre") % 7;
  const centre = siteAcross >= extent / 2 ? fromEdge : extent - 1 - fromEdge;
  for (let index = 0; index < count; index += 1) {
    const tx = index % width, ty = Math.floor(index / width);
    if (closed.some(rect => inRect(rect, tx, ty))) { cost[index] = Number.POSITIVE_INFINITY; continue; }
    const along = acrossNorthSouth ? ty : tx, across = acrossNorthSouth ? tx : ty;
    const target = centre + amplitude * Math.sin(along * 2 * Math.PI / wavelength + phase) + (fbm(along * 0.07, 3.5, seed + 71_003, 2) - 0.5) * 12;
    const side = Math.min(across, extent - 1 - across);
    const rim = side < SIDE_MARGIN ? (SIDE_MARGIN - side) * 2 : 0;
    const off = MEANDER_PULL * Math.abs(across - target);
    // The town's room: near the site the channel pays more, so it does not wrap the town's ground.
    const gap = site === undefined ? SITE_ROOM : Math.max(site.minTx - tx, tx - site.maxTx, site.minTy - ty, ty - site.maxTy, 0);
    const room = gap < SITE_ROOM ? (SITE_ROOM - gap) * 1.5 : 0;
    cost[index] = (terrains[index] === "water" ? 0.3 : 0.6 + 3 * lift(index) + (terrains[index] === "rock" ? 6 : 0)) + rim + off + room;
  }
  const sea = spec.mouth === "sea" ? seaCells(terrains, width, height) : null;
  const onEdge = (edge: RiverSource, tx: number, ty: number) =>
    edge === "north" ? ty === 0 : edge === "south" ? ty === height - 1 : edge === "west" ? tx === 0 : tx === width - 1;
  const opposite = ({ north: "south", south: "north", west: "east", east: "west" } as const)[source];
  const isSource = (tx: number, ty: number) => onEdge(source, tx, ty);
  const isMouth = (index: number) => sea !== null ? sea[index] === 1 : onEdge(opposite, index % width, Math.floor(index / width));
  const best = new Float64Array(count).fill(Number.POSITIVE_INFINITY);
  const from = new Int32Array(count).fill(-1);
  const heap = new Heap();
  for (let index = 0; index < count; index += 1) {
    const tx = index % width, ty = Math.floor(index / width);
    if (!isSource(tx, ty) || !Number.isFinite(cost[index]!) || (sea !== null && sea[index] === 1)) continue;
    best[index] = cost[index]!;
    heap.push(best[index]!, index);
  }
  let end = -1;
  while (heap.size > 0) {
    const [total, index] = heap.pop();
    if (total > best[index]!) continue;
    if (isMouth(index)) { end = index; break; }
    const tx = index % width, ty = Math.floor(index / width);
    for (const step of STEPS) {
      const x = tx + step.tx, y = ty + step.ty;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const next = y * width + x;
      const through = total + cost[next]!;
      if (through < best[next]!) { best[next] = through; from[next] = index; heap.push(through, next); }
    }
  }
  if (end < 0) return null;
  const path: number[] = [];
  for (let at = end; at >= 0; at = from[at]!) path.push(at);
  path.reverse();

  // The channel: each path cell widened to its reach's width (a square brush), the water's direction downstream.
  const direction = new Map<number, FlowDirection>();
  const reachWidth: number[] = [];
  const span = spec.maxWidth - spec.minWidth;
  for (let step = 0; step < path.length; step += 1) {
    const index = path[step]!;
    const tx = index % width, ty = Math.floor(index / width);
    const reach = spec.minWidth + Math.min(span, Math.floor(fbm(step * 0.11, 0.5, seed + 71_211, 2) * (span + 1)));
    reachWidth.push(reach);
    const next = path[step + 1] ?? index;
    const dir: FlowDirection = next - index === 1 ? "e" : next - index === -1 ? "w" : next - index === width ? "s" : next - index === -width ? "n"
      : step > 0 ? direction.get(path[step - 1]!)! : ({ north: "s", south: "n", west: "e", east: "w" } as const)[source];
    const low = -Math.floor((reach - 1) / 2), high = Math.ceil((reach - 1) / 2);
    for (let dy = low; dy <= high; dy += 1) for (let dx = low; dx <= high; dx += 1) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= width || y >= height || closed.some(rect => inRect(rect, x, y))) continue;
      const cell = y * width + x;
      if (sea !== null && sea[cell] === 1) continue;
      if (!direction.has(cell) || (dx === 0 && dy === 0)) direction.set(cell, dir);
    }
  }
  const cells = [...direction.keys()].sort((a, b) => a - b);
  for (const cell of cells) terrains[cell] = "water";

  const channel = new Set(cells);
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && terrains[y * width + x] === "grass";
  // Bridge sites and fords: along the path, straight crossings (perpendicular to the flow) of at most four channel
  // cells with open banks on both sides; a ford where the crossing is at most two. Spaced a dozen steps apart.
  const bridgeSites: { tx: number; ty: number; axis: "x" | "y" }[] = [];
  const fords: number[] = [];
  let lastSite = -100;
  for (let step = 0; step < path.length; step += 1) {
    if (step - lastSite < 12) continue;
    const index = path[step]!;
    const tx = index % width, ty = Math.floor(index / width);
    const dir = direction.get(index)!;
    const across = dir === "n" || dir === "s" ? { tx: 1, ty: 0, axis: "x" as const } : { tx: 0, ty: 1, axis: "y" as const };
    let lowEnd = 0, highEnd = 0;
    while (channel.has((ty - (lowEnd + 1) * across.ty) * width + tx - (lowEnd + 1) * across.tx) && lowEnd < 5) lowEnd += 1;
    while (channel.has((ty + (highEnd + 1) * across.ty) * width + tx + (highEnd + 1) * across.tx) && highEnd < 5) highEnd += 1;
    const crossing = lowEnd + highEnd + 1;
    const bankA = { tx: tx - (lowEnd + 1) * across.tx, ty: ty - (lowEnd + 1) * across.ty };
    const bankB = { tx: tx + (highEnd + 1) * across.tx, ty: ty + (highEnd + 1) * across.ty };
    if (crossing > 4 || !open(bankA.tx, bankA.ty) || !open(bankB.tx, bankB.ty)) continue;
    bridgeSites.push({ tx: bankA.tx, ty: bankA.ty, axis: across.axis });
    if (crossing <= 2 && reachWidth[step]! <= 2) {
      for (let offset = -lowEnd; offset <= highEnd; offset += 1) fords.push((ty + offset * across.ty) * width + tx + offset * across.tx);
    }
    lastSite = step;
  }
  const flow = cells.map(cell => direction.get(cell)!).join("");
  return { kind: spec.kind, cells, flow, fords: [...new Set(fords)].sort((a, b) => a - b), bridgeSites };
}

export type RiverSource = "north" | "south" | "west" | "east";

/** MA-9: the edge an inland river rises at — the seed picks north (running south) or west (running east). */
export function riverSource(seed: number): RiverSource {
  return hashSeed(seed, "archetype:river-axis") % 2 === 0 ? "north" : "west";
}

/** MA-9: the Wave 29 current-arrow sheet for a flow direction (the fixed SW view: +x runs south-east, +y south-west). */
export function currentArrowKey(direction: FlowDirection): string {
  return `water/current_arrows_${({ e: "se", s: "sw", w: "nw", n: "ne" } as const)[direction]}_sheet`;
}

/** MA-9: whether a tile is flowing water — the river's channel; a state without a river (older saves) reads all water. */
export function isFlowingWater(state: { readonly river?: RiverData | undefined; readonly tiles: readonly { readonly terrain: TerrainType }[] }, index: number): boolean {
  if (state.river === undefined) return state.tiles[index]?.terrain === "water";
  return state.tiles[index]?.terrain === "water" && binaryHas(state.river.cells, index);
}

function binaryHas(sorted: readonly number[], value: number): boolean {
  let low = 0, high = sorted.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const at = sorted[mid]!;
    if (at === value) return true;
    if (at < value) low = mid + 1; else high = mid - 1;
  }
  return false;
}
