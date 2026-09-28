import type { PalisadePath } from "../world/palisadeGeometry";
import { isPointInsidePalisade } from "../world/palisadeGeometry";
import { boundaryHash } from "../world/boundary/boundaryGeometry";
import type { Tile } from "../world/world.types";
import type { Zone, ZoneKind } from "../zones/zone.types";

// INSTALL-28 the countryside outside the walls (Wave 28): which land is open country, and the field edges. Pure in its
// input (the tiles, zones, wall line, construction-site cells, seed and whether the map is stony), so the same town
// always gets the same hedges and props; nothing here is saved or read by rules.
//
// Open country (`countryside`, the only land a point prop or wildflower patch stands on) is a grass cell with no road,
// building, zone or construction site that lies outside the settled area:
//  - inside the wall line (the palisade or stone wall polygon, the same test the wall rules use) or next to it (one
//    cell, so nothing stands against the wall's outer face), and
//  - within SETTLED_REACH cells (Chebyshev) of a building footprint, a construction site or a burgage plot — a town
//    without a wall is settled only there (its houses' yards, village life and plots keep their room).
//
// Field edges: every tile edge where an arable or pasture zone meets land that is not one (no zone, or another kind)
// carries a strip, unless the other side is water, forest, a building, a construction site or off the map, or either
// side lies inside the wall. Where two field zones meet, the edge is a baulk (the unploughed bank between fields).
// Edges are joined into straight runs (same line, same field side, same strip class). A run is a dry-stone wall on a
// stony map (chalk down or heath archetype) or where its outer cells touch rock (the stones cleared from the field);
// otherwise hedgerow a or b by its hash. Along a road the run keeps a gap: the middle edge of every stretch whose other
// side is road (the field gate). As a zone grows its edges move out with it, so the hedge grows with the field.

export const SETTLED_REACH = 3;
const FIELD_KINDS: ReadonlySet<ZoneKind> = new Set(["arable", "pasture"]);

export type CountryLandInput = {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Tile[];
  readonly zones: readonly Zone[];
  /** The wall line in tile-edge coordinates (PalisadeState.polygon), or null when the town has none. */
  readonly wall: PalisadePath | null;
  /** Cells claimed by construction sites (building footprints and the cells along a wall site's path). */
  readonly siteCells: readonly number[];
  readonly seed: number;
  /** The map archetype is stony (chalk down, heath): every field edge run is a dry-stone wall. */
  readonly stony: boolean;
};

export type CountryStripFamily = "hedgerow_a" | "hedgerow_b" | "baulk" | "dry_stone_wall";

/**
 * One tile edge of a strip. `axis` "x": the edge between (tx, ty) and (tx, ty + 1), running along x; "y": between
 * (tx, ty) and (tx + 1, ty), running along y. `step` counts edges from the run's screen-left end (the texture runs on).
 */
export type CountryStripPiece = {
  readonly id: string;
  readonly family: CountryStripFamily;
  readonly axis: "x" | "y";
  readonly tx: number;
  readonly ty: number;
  readonly step: number;
  /** Where the run starts in the 512 px repeat, as a fraction (0..1). */
  readonly offset: number;
  readonly depth: number;
};

export type CountryLand = {
  readonly width: number;
  readonly height: number;
  /** 1 = open country (see above). */
  readonly countryside: Uint8Array;
  /** Zone index per cell (the input order), -1 for none. */
  readonly zoneOf: Int32Array;
  readonly strips: readonly CountryStripPiece[];
};

type Edge = { readonly along: number; readonly road: boolean; readonly rocky: boolean };

export function countryLand(input: CountryLandInput): CountryLand {
  const { width, height, tiles } = input;
  const size = width * height;
  const cells: (Tile | undefined)[] = new Array(size);
  for (const tile of tiles) cells[tile.ty * width + tile.tx] = tile;
  const zoneOf = new Int32Array(size).fill(-1);
  input.zones.forEach((zone, index) => { for (const cell of zone.membership) if (cell >= 0 && cell < size) zoneOf[cell] = index; });
  const inside = new Uint8Array(size);
  if (input.wall !== null && input.wall.length > 2) {
    for (let cell = 0; cell < size; cell += 1) {
      if (isPointInsidePalisade({ x: (cell % width) + 0.5, y: Math.floor(cell / width) + 0.5 }, input.wall)) inside[cell] = 1;
    }
  }
  const sites = new Uint8Array(size);
  for (const cell of input.siteCells) if (cell >= 0 && cell < size) sites[cell] = 1;
  // Settled: the wall's inside plus one cell, and SETTLED_REACH around buildings, sites and burgage plots.
  const settled = new Uint8Array(size);
  const mark = (cell: number, reach: number): void => {
    const tx = cell % width; const ty = Math.floor(cell / width);
    for (let y = Math.max(0, ty - reach); y <= Math.min(height - 1, ty + reach); y += 1) {
      for (let x = Math.max(0, tx - reach); x <= Math.min(width - 1, tx + reach); x += 1) settled[y * width + x] = 1;
    }
  };
  for (let cell = 0; cell < size; cell += 1) {
    const zone = zoneOf[cell]!;
    if (inside[cell] === 1) mark(cell, 1);
    if (cells[cell]?.buildingId != null || sites[cell] === 1 || (zone >= 0 && input.zones[zone]?.kind === "burgage")) mark(cell, SETTLED_REACH);
  }
  const countryside = new Uint8Array(size);
  for (let cell = 0; cell < size; cell += 1) {
    const tile = cells[cell];
    if (tile !== undefined && tile.terrain === "grass" && !tile.hasRoad && tile.buildingId === null && zoneOf[cell] === -1
      && sites[cell] === 0 && settled[cell] === 0) countryside[cell] = 1;
  }
  return { width, height, countryside, zoneOf, strips: fieldEdgeStrips(input, cells, zoneOf, inside, sites) };
}

function fieldEdgeStrips(input: CountryLandInput, cells: readonly (Tile | undefined)[], zoneOf: Int32Array, inside: Uint8Array, sites: Uint8Array): CountryStripPiece[] {
  const { width, height, zones } = input;
  const isField = (cell: number): boolean => { const zone = zoneOf[cell]!; return zone >= 0 && FIELD_KINDS.has(zones[zone]!.kind); };
  const rockNear = (cell: number): boolean => {
    const tx = cell % width; const ty = Math.floor(cell / width);
    for (let y = ty - 1; y <= ty + 1; y += 1) for (let x = tx - 1; x <= tx + 1; x += 1) {
      if (x >= 0 && y >= 0 && x < width && y < height && cells[y * width + x]?.terrain === "rock") return true;
    }
    return false;
  };
  // Runs keyed by axis, line, field side and class ("h": hedge or wall, "b": baulk).
  const runs = new Map<string, Edge[]>();
  const add = (key: string, edge: Edge): void => { const list = runs.get(key); if (list === undefined) runs.set(key, [edge]); else list.push(edge); };
  for (let ty = 0; ty < height; ty += 1) for (let tx = 0; tx < width; tx += 1) {
    const cell = ty * width + tx;
    for (const axis of ["x", "y"] as const) {
      const nx = axis === "y" ? tx + 1 : tx; const ny = axis === "x" ? ty + 1 : ty;
      if (nx >= width || ny >= height) continue;
      const other = ny * width + nx;
      if (zoneOf[cell] === zoneOf[other] || inside[cell] === 1 || inside[other] === 1) continue;
      const line = axis === "x" ? ty : tx; const along = axis === "x" ? tx : ty;
      if (isField(cell) && isField(other)) { add(`${axis}:${line}:0:b`, { along, road: false, rocky: false }); continue; }
      const field = isField(cell) ? cell : isField(other) ? other : -1;
      if (field < 0) continue;
      const outer = field === cell ? other : cell;
      const tile = cells[outer];
      // A forest cell under a road is road (trees stand only where nothing was built or laid).
      if (tile === undefined || tile.terrain === "water" || (tile.terrain === "forest" && !tile.hasRoad) || tile.buildingId !== null || sites[outer] === 1) continue;
      add(`${axis}:${line}:${field === cell ? 1 : -1}:h`, { along, road: tile.hasRoad, rocky: rockNear(outer) });
    }
  }
  const pieces: CountryStripPiece[] = [];
  for (const key of [...runs.keys()].sort()) {
    const [axis, lineText, , kind] = key.split(":") as ["x" | "y", string, string, "h" | "b"];
    const line = Number(lineText);
    const edges = runs.get(key)!.sort((a, b) => a.along - b.along);
    for (let start = 0; start < edges.length;) {
      let end = start;
      while (end + 1 < edges.length && edges[end + 1]!.along === edges[end]!.along + 1) end += 1;
      const run = edges.slice(start, end + 1);
      start = end + 1;
      const first = run[0]!.along; const last = run[run.length - 1]!.along;
      const hash = boundaryHash(first * 131 + line, input.seed, axis === "x" ? 2_801 : 2_803);
      const family: CountryStripFamily = kind === "b" ? "baulk" : input.stony || run.some(edge => edge.rocky) ? "dry_stone_wall"
        : hash % 2 === 0 ? "hedgerow_a" : "hedgerow_b";
      const gaps = roadGates(run);
      for (const edge of run) {
        if (gaps.has(edge.along)) continue;
        const tx = axis === "x" ? edge.along : line; const ty = axis === "x" ? line : edge.along;
        // Screen-left end first: an x run goes right as tx grows, a y run goes left as ty grows.
        const step = axis === "x" ? edge.along - first : last - edge.along;
        // Depth: the edge's middle ((tx, ty + 0.5) or (tx + 0.5, ty)), as the yard hurdles sort.
        pieces.push({ id: `country-strip:${key}:${first}:${edge.along}`, family, axis, tx, ty, step, offset: ((hash >>> 8) % 512) / 512, depth: tx + ty + 0.5 });
      }
    }
  }
  return pieces;
}

/** The middle edge of every stretch of a run whose other side is road: the field's gate onto it. */
function roadGates(run: readonly Edge[]): ReadonlySet<number> {
  const gaps = new Set<number>();
  for (let index = 0; index < run.length;) {
    if (!run[index]!.road) { index += 1; continue; }
    let end = index;
    while (end + 1 < run.length && run[end + 1]!.road) end += 1;
    gaps.add(run[Math.floor((index + end) / 2)]!.along);
    index = end + 1;
  }
  return gaps;
}
