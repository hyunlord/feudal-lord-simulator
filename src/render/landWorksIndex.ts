import type { GameState } from "../engine/engine.types";
import { GROUND_CHUNK_TILES } from "./groundSceneParts";
import { drainEdges, fordGroups, plankBridges, workPlan, type DrainEdge, type FordGroup, type WorkPlan } from "./landWorksModel";
import { doneEdgeKey, fordKey, stageKey, WORKS_SEASONS, worksArtReady, type WorksKey } from "./wave34Art";

// LAND-UI: the land works of a state, indexed by ground chunk (8 x 8 tiles), for landWorksDraw.ts and the chunk key.
// Cache (AGENTS rule 10):
// (a) Key: the state's tiles array (roads and drained terrain change it), its `river` and its `drainage` objects (the
//     works' progress and diggers change it each tick while works are open), by identity; the per-chunk lists are
//     filled on first ask under the same key.
// (b) Nothing else enters: fords read the river and the road bits of the tiles; works read the drainage and the
//     tiles (the bank cell); the art readiness is not cached (landWorksChunkToken reads it each call).
// (c) Why: groundReadiness asks for every visible and ring chunk every frame; the works and fords are rebuilt only
//     when one of the three inputs moves, and a chunk with no works reads as "" (its key stays as it was).

export type ChunkWorks = {
  readonly fords: readonly FordGroup[];
  readonly works: readonly WorkPlan[];
  readonly edges: readonly DrainEdge[];
  readonly bridges: readonly { readonly tx: number; readonly ty: number }[];
  /** Every Wave 34 picture the chunk draws, in both seasons (so a staged raster of the next season is keyed too). */
  readonly keys: readonly WorksKey[];
  /** The chunk's works signature: ford groups, works with stage and diggers, the drained count. */
  readonly signature: string;
};

type Index = {
  readonly tiles: GameState["tiles"];
  readonly river: GameState["river"];
  readonly drainage: GameState["drainage"];
  readonly fords: readonly FordGroup[];
  readonly works: readonly WorkPlan[];
  readonly edges: readonly DrainEdge[];
  readonly bridges: readonly { readonly tx: number; readonly ty: number }[];
  readonly drained: number;
  readonly chunks: Map<number, ChunkWorks>;
  water: ReadonlySet<number> | null;
};

const EMPTY: ChunkWorks = { fords: [], works: [], edges: [], bridges: [], keys: [], signature: "" };
/** Tiles a works picture may reach past its cells (the ford's banks, props rising above their cell). */
const REACH = 2;
let last: Index | null = null;

export function landWorksIndex(state: GameState): Index {
  if (last !== null && last.tiles === state.tiles && last.river === state.river && last.drainage === state.drainage) return last;
  const drained = state.drainage?.drained ?? [];
  last = {
    tiles: state.tiles, river: state.river, drainage: state.drainage,
    fords: fordGroups(state).filter(group => group.road),
    works: (state.drainage?.works ?? []).map(work => workPlan(state, work)),
    edges: drainEdges(drained, state.width, state.height),
    bridges: plankBridges(drained, state.width),
    drained: drained.length, chunks: new Map(), water: null,
  };
  return last;
}

/** What chunk (cx, cy) draws of the land works (EMPTY for most chunks, and for every chunk of a land without any). */
export function chunkWorks(state: GameState, cx: number, cy: number): ChunkWorks {
  const index = landWorksIndex(state);
  if (index.fords.length + index.works.length + index.edges.length === 0) return EMPTY;
  const id = cy * 4096 + cx;
  const known = index.chunks.get(id);
  if (known !== undefined) return known;
  const left = cx * GROUND_CHUNK_TILES - 0.5 - REACH, right = (cx + 1) * GROUND_CHUNK_TILES - 0.5 + REACH;
  const top = cy * GROUND_CHUNK_TILES - 0.5 - REACH, bottom = (cy + 1) * GROUND_CHUNK_TILES - 0.5 + REACH;
  const near = (tx: number, ty: number, pad = 0) => tx + pad >= left && tx - pad <= right && ty + pad >= top && ty - pad <= bottom;
  const fords = index.fords.filter(group => near(group.centre.tx, group.centre.ty));
  const works = index.works.filter(work => work.box.maxTx >= left && work.box.minTx <= right && work.box.maxTy >= top && work.box.minTy <= bottom);
  const edges = index.edges.filter(edge => near(edge.tx, edge.ty));
  const bridges = index.bridges.filter(bridge => near(bridge.tx, bridge.ty));
  const keys = new Set<WorksKey>();
  for (const season of WORKS_SEASONS) {
    for (const group of fords) keys.add(fordKey(group.width, group.axis, season));
    for (const work of works) keys.add(stageKey(work.stage, work.region, season));
    if (edges.length > 0) keys.add(doneEdgeKey(season));
  }
  for (const work of works) {
    if (work.digging) { keys.add("drain_earth_cart"); keys.add("drain_soil_heap"); }
    if (work.stage === 2) keys.add("drain_sluice");
  }
  if (bridges.length > 0) keys.add("drain_plank_bridge");
  const signature = [...fords.map(group => `f${group.cells[0]}${group.axis}`), ...works.map(work => `w${work.id}.${work.stage}${work.digging ? "d" : ""}`),
    ...(edges.length > 0 ? [`e${index.drained}`] : [])].join(",");
  const entry: ChunkWorks = fords.length + works.length + edges.length === 0 ? EMPTY : { fords, works, edges, bridges, keys: [...keys].sort(), signature };
  index.chunks.set(id, entry);
  return entry;
}

/**
 * The chunk key part for the land works (drawTerrainBoundaryV2 groundReadiness): "" for a chunk without any, else the
 * works signature and the readiness of the chunk's Wave 34 pictures (asking starts their loads).
 */
export function landWorksChunkToken(state: GameState, plan: { readonly cx: number; readonly cy: number }): string {
  const works = chunkWorks(state, plan.cx, plan.cy);
  if (works === EMPTY) return "";
  return `:lw${worksArtReady(works.keys) ? 1 : 0}${works.signature}`;
}

/**
 * The water cells the land works cover — a road ford group's cells and the stage-3 works' cells — where the Wave 29
 * water motion (drawn live over the chunks) should not run over the stones, banks or drying mud (records/README).
 */
export function landWorksWaterCells(state: GameState): ReadonlySet<number> {
  const index = landWorksIndex(state);
  if (index.water === null) {
    index.water = new Set([...index.fords.flatMap(group => group.cells), ...index.works.filter(work => work.stage === 3).flatMap(work => work.cells)]);
  }
  return index.water;
}
