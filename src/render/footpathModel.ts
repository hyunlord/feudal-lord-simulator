import type { GameState } from "../engine/engine.types";
import { landOf } from "../engine/land";

// NAT-5 (Wave 42): how the engine's footpaths (landOf(state).footpaths, LG-3 ②) are laid in pieces, by the connection
// contract of the batch (assets-inbox/wave42/candidates-20261002/records/CONNECTIONS.md, assets.csv):
//  - A cell joins its four edge neighbours: NE (tx, ty - 1), SE (tx + 1, ty), SW (tx, ty + 1), NW (tx - 1, ty). The
//    strips run along the two ground axes only: path_clear_ne SW -> NE (along -ty), path_clear_nw NW -> SE (along +tx).
//  - The pack's joins: corner_ne (SW, NW), corner_nw (SE, NE), fork_ne (SW, NE, NW), fork_nw (SE, NW, NE). Every file
//    is no_flip (RUN-03 for trees; the batch for every Wave 42 picture), so the other four joins are never a mirrored
//    piece: the top and bottom corners (NE + NW, SE + SW), the two other forks and the crossing are strip halves that
//    meet at the cell centre (each half runs from its port to the centre, 8 UV px over it), an end is one half that
//    fades out past the centre, and a lone cell a short stub along the NE axis fading at both ends. FOOTPATH_RULES.
//  - Strengths: the pack's joins are clear only and it has no faint/muddy transitions, and the engine keeps no wear of a
//    path past the year's count, so every path is clear (faint and muddy are not installed; engine handoff).
//  - Worn areas: the pack draws single tracks, and a town's walks to its well, market and church wear bands and patches
//    several cells wide (a forest town's common: a 20 x 8 patch). Laid cell by cell, a patch is a lattice of crossing
//    strips; so the picture draws the patch's centre lines — the cells kept by thinning the worn cells (Zhang-Suen, the
//    ends kept) — and a band or patch reads as the path along its middle. Every drawn cell is a worn cell or a bridge.
//  - Diagonal steps: the engine's walks are straight lines (Bresenham), so a path can step diagonally where the strips
//    cannot. Such a step is drawn through one orthogonal cell between the two (the first of (B.tx, A.ty), (A.tx, B.ty)
//    that is open ground: no water, road or building), a corner on each side — or not at all when neither is open or
//    a road lies between (the ends then meet the road).
//  - Ends meet the town: a cell with at most one path neighbour also joins one road or building beside it (straight on
//    first, else NE, SE, SW, NW), so a path runs under the road ribbon or the building instead of stopping short.

export type Port = "NE" | "SE" | "SW" | "NW";
export const PORTS: readonly Port[] = ["NE", "SE", "SW", "NW"];
export const PORT_STEP: Readonly<Record<Port, readonly [number, number]>> = { NE: [0, -1], SE: [1, 0], SW: [0, 1], NW: [-1, 0] };
const OPPOSITE: Readonly<Record<Port, Port>> = { NE: "SW", SW: "NE", SE: "NW", NW: "SE" };

export type FootpathShape = "dot" | "end" | "straight_ne" | "straight_nw" | "corner_ne" | "corner_nw" | "corner_n" | "corner_s"
  | "fork_ne" | "fork_nw" | "fork_se" | "fork_sw" | "cross";
export type ConnectorBase = "path_clear_corner_ne" | "path_clear_corner_nw" | "path_clear_fork_ne" | "path_clear_fork_nw";
export type FootpathRule = {
  readonly shape: FootpathShape;
  /** The pack's join drawn on the cell (null: strips only). */
  readonly connector: ConnectorBase | null;
  /** The strip halves drawn from the cell centre out to these ports. */
  readonly halves: readonly Port[];
};

const rule = (shape: FootpathShape, connector: ConnectorBase | null, halves: readonly Port[] = []): FootpathRule => ({ shape, connector, halves });
/** The connection rule table, keyed by the joined ports in PORTS order joined with "+" ("" for a lone cell). */
export const FOOTPATH_RULES: Readonly<Record<string, FootpathRule>> = {
  "": rule("dot", null),
  NE: rule("end", null, ["NE"]), SE: rule("end", null, ["SE"]), SW: rule("end", null, ["SW"]), NW: rule("end", null, ["NW"]),
  "NE+SW": rule("straight_ne", null, ["NE", "SW"]),
  "SE+NW": rule("straight_nw", null, ["SE", "NW"]),
  "SW+NW": rule("corner_ne", "path_clear_corner_ne"),
  "NE+SE": rule("corner_nw", "path_clear_corner_nw"),
  "NE+NW": rule("corner_n", null, ["NE", "NW"]),
  "SE+SW": rule("corner_s", null, ["SE", "SW"]),
  "NE+SW+NW": rule("fork_ne", "path_clear_fork_ne"),
  "NE+SE+NW": rule("fork_nw", "path_clear_fork_nw"),
  "NE+SE+SW": rule("fork_se", null, ["NE", "SE", "SW"]),
  "SE+SW+NW": rule("fork_sw", null, ["SE", "SW", "NW"]),
  "NE+SE+SW+NW": rule("cross", null, ["NE", "SE", "SW", "NW"]),
};

export function portsKey(ports: Iterable<Port>): string {
  const set = new Set(ports);
  return PORTS.filter(port => set.has(port)).join("+");
}

export function footpathRule(ports: Iterable<Port>): FootpathRule {
  const found = FOOTPATH_RULES[portsKey(ports)];
  if (found === undefined) throw new Error(`no footpath rule for ${portsKey(ports)}`);
  return found;
}

export type FootpathPiece = {
  readonly cell: number;
  readonly tx: number;
  readonly ty: number;
  readonly ports: readonly Port[];
  readonly rule: FootpathRule;
  /** A cell the engine does not list: drawn to carry a diagonal step. */
  readonly bridge: boolean;
};

type Tiles = Pick<GameState, "tiles" | "width" | "height">;
const openGround = (state: Tiles, tx: number, ty: number): boolean => {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  const tile = state.tiles[ty * state.width + tx];
  return tile !== undefined && tile.terrain !== "water" && !tile.hasRoad && tile.buildingId === null;
};
const anchorAt = (state: Tiles, tx: number, ty: number): boolean => {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
  const tile = state.tiles[ty * state.width + tx];
  return tile !== undefined && (tile.hasRoad || tile.buildingId !== null);
};

/** Every drawn footpath cell and its piece, in cell order (the engine's paths, the bridges of their diagonal steps). */
export function footpathPieces(state: Tiles, footpaths: readonly number[]): readonly FootpathPiece[] {
  const { width } = state;
  const cells = thinned(state, footpaths.filter(cell => openGround(state, cell % width, Math.floor(cell / width))));
  const bridges = new Set<number>();
  const has = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < width && ty < state.height && (cells.has(ty * width + tx) || bridges.has(ty * width + tx));
  for (const cell of [...cells].sort((a, b) => a - b)) {
    const tx = cell % width, ty = Math.floor(cell / width);
    for (const dy of [1, -1]) {
      if (ty + dy < 0 || ty + dy >= state.height || tx + 1 >= width || !cells.has((ty + dy) * width + tx + 1)) continue;
      if (has(tx + 1, ty) || has(tx, ty + dy) || anchorAt(state, tx + 1, ty) || anchorAt(state, tx, ty + dy)) continue;
      const through = openGround(state, tx + 1, ty) ? [tx + 1, ty] : openGround(state, tx, ty + dy) ? [tx, ty + dy] : null;
      if (through !== null) bridges.add((through[1] ?? 0) * width + (through[0] ?? 0));
    }
  }
  const pieces: FootpathPiece[] = [];
  for (const cell of [...cells, ...bridges].sort((a, b) => a - b)) {
    const tx = cell % width, ty = Math.floor(cell / width);
    const ports = PORTS.filter(port => has(tx + PORT_STEP[port][0], ty + PORT_STEP[port][1]));
    if (ports.length <= 1) {
      const order = ports.length === 1 ? [OPPOSITE[ports[0] ?? "NE"], ...PORTS] : PORTS;
      const anchor = order.find(port => !ports.includes(port) && anchorAt(state, tx + PORT_STEP[port][0], ty + PORT_STEP[port][1]));
      if (anchor !== undefined) ports.push(anchor);
    }
    pieces.push({ cell, tx, ty, ports: PORTS.filter(port => ports.includes(port)), rule: footpathRule(ports), bridge: bridges.has(cell) });
  }
  return pieces;
}

/** The worn cells' centre lines: Zhang-Suen thinning (8-neighbour; a cell with one neighbour, an end, is kept). */
export function thinned(state: Pick<GameState, "width" | "height">, cells: readonly number[]): Set<number> {
  const { width, height } = state;
  const kept = new Set(cells);
  const on = (tx: number, ty: number): boolean => tx >= 0 && ty >= 0 && tx < width && ty < height && kept.has(ty * width + tx);
  for (let changed = true; changed;) {
    changed = false;
    for (const pass of [0, 1]) {
      const gone: number[] = [];
      for (const cell of [...kept].sort((a, b) => a - b)) {
        const tx = cell % width, ty = Math.floor(cell / width);
        // P2..P9 clockwise from north (-ty): N, NE, E, SE, S, SW, W, NW.
        const around = [on(tx, ty - 1), on(tx + 1, ty - 1), on(tx + 1, ty), on(tx + 1, ty + 1), on(tx, ty + 1), on(tx - 1, ty + 1), on(tx - 1, ty), on(tx - 1, ty - 1)];
        const count = around.filter(Boolean).length;
        const turns = around.filter((value, index) => !value && around[(index + 1) % 8] === true).length;
        if (count < 2 || count > 6 || turns !== 1) continue;
        const [n, , e, , s, , w] = around;
        if (pass === 0 ? (n && e && s) || (e && s && w) : (n && e && w) || (n && s && w)) continue;
        gone.push(cell);
      }
      for (const cell of gone) kept.delete(cell);
      if (gone.length > 0) changed = true;
    }
  }
  return kept;
}

// Index (AGENTS rule 10):
// (a) Key: the land's footpaths array and the state's tiles array, by identity (the engine makes a new footpaths array
//     once a year; a road or building beside a path changes the tiles), and the map's width; a chunk's list is filled on
//     its first ask under the same key.
// (b) Nothing else enters: the pieces read only the paths and the tiles' terrain, road and building.
// (c) Why: the ground chunks ask for their pieces every frame (their key, footpathDraw.ts); the pieces are worked out
//     once per change and each chunk's list and signature once.
export type ChunkFootpaths = { readonly pieces: readonly FootpathPiece[]; readonly signature: string };
type Index = { readonly footpaths: readonly number[]; readonly tiles: GameState["tiles"]; readonly width: number;
  readonly pieces: readonly FootpathPiece[]; readonly chunks: Map<number, ChunkFootpaths> };
const NONE: ChunkFootpaths = { pieces: [], signature: "" };
/** Cells past a chunk's own whose pieces it draws: a strip runs 8 UV px into the next cell, the chunk clips the rest. */
const RING = 1;
const CHUNK_TILES = 8;
let last: Index | null = null;

export function footpathIndex(state: Pick<GameState, "tiles" | "width" | "height" | "land">): Index {
  const footpaths = landOf(state).footpaths;
  if (last !== null && last.footpaths === footpaths && last.tiles === state.tiles && last.width === state.width) return last;
  last = { footpaths, tiles: state.tiles, width: state.width, pieces: footpaths.length === 0 ? [] : footpathPieces(state, footpaths), chunks: new Map() };
  return last;
}

/** The pieces ground chunk (cx, cy) draws (its cells and a ring of one) and their signature ("" for none). */
export function chunkFootpaths(state: Pick<GameState, "tiles" | "width" | "height" | "land">, cx: number, cy: number): ChunkFootpaths {
  const index = footpathIndex(state);
  if (index.pieces.length === 0) return NONE;
  const id = cy * 4096 + cx;
  const known = index.chunks.get(id);
  if (known !== undefined) return known;
  const minTx = cx * CHUNK_TILES - RING, maxTx = (cx + 1) * CHUNK_TILES - 1 + RING;
  const minTy = cy * CHUNK_TILES - RING, maxTy = (cy + 1) * CHUNK_TILES - 1 + RING;
  const pieces = index.pieces.filter(piece => piece.tx >= minTx && piece.tx <= maxTx && piece.ty >= minTy && piece.ty <= maxTy);
  const entry = pieces.length === 0 ? NONE : { pieces, signature: hashText(pieces.map(piece => `${piece.cell}:${portsKey(piece.ports)}`).join(",")) };
  index.chunks.set(id, entry);
  return entry;
}

/** FNV-1a of a text, base 36 (a chunk key part). */
function hashText(text: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619);
  return `${(hash >>> 0).toString(36)}.${text.length}`;
}
