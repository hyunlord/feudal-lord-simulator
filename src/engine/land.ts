/**
 * LM-E5 (spec docs/design/living-growth.md LG-3): the land changes by itself, and the state says how (the screens draw
 * it). ① A felled tree (a `forestHarvests` record) is a stump, then a sapling, then grown: a grown cell outside any
 * zone, building or road loses its record and stands as forest again (a logging camp may fell it again). ② The town's
 * trips over open ground — each resident's walk each season to its nearest well, market and church where no road
 * takes it, and the builders' steps to their sites — wear footpaths; a footpath not walked grows over. ③ A plot whose
 * house stands empty and a strip nobody tends go to grass, then scrub, then saplings, year by year, until used again.
 * Nothing here moves goods, people or money.
 */
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import {
  BUILDER_SAMPLE_TICKS, FALLOW_SAPLING_YEARS, FALLOW_SCRUB_YEARS, FIELD_HAND_TRIPS, FOOTFALL_TARGETS, FOOTPATH_KEEP, FOOTPATH_MAKE, GROWN_YEARS,
  STUMP_YEARS, WOODCUTTER_TRIPS,
} from "../content/landConfig";
import { arableLayouts, stripTending } from "../zones/arableFields";
import { zonesOf } from "../zones/zoneEdits";
import type { ForestHarvest, GameState } from "./engine.types";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = 4 * SEASON;

/** LG-3: the land's own state (absent until its first season). Cells are row-major indexes; pairs are [cell, value]. */
export interface LandState {
  /** ② This year's trips over each open cell so far. */
  readonly footfall: readonly (readonly [number, number])[];
  /** ② The footpaths now. */
  readonly footpaths: readonly number[];
  /** ③ Each abandoned cell and the tick it was left. */
  readonly fallow: readonly (readonly [number, number])[];
}

const EMPTY_LAND: LandState = { footfall: [], footpaths: [], fallow: [] };

/** LG-3 ① API: a felled tree's stage now — a stump, a sapling, or grown. */
export function treeStage(harvest: Pick<ForestHarvest, "harvestedAtTick">, tick: number): "stump" | "sapling" | "grown" {
  const age = tick - harvest.harvestedAtTick;
  return age < STUMP_YEARS * YEAR ? "stump" : age < GROWN_YEARS * YEAR ? "sapling" : "grown";
}

/** LG-3 ③ API: an abandoned cell's stage — grass, scrub or saplings. */
export function fallowStage(since: number, tick: number): "grass" | "scrub" | "sapling" {
  const years = Math.floor((tick - since) / YEAR);
  return years < FALLOW_SCRUB_YEARS ? "grass" : years < FALLOW_SAPLING_YEARS ? "scrub" : "sapling";
}

/** LG-3 API: the land's state (empty before its first season). */
export function landOf(state: Pick<GameState, "land">): LandState {
  return state.land ?? EMPTY_LAND;
}

/** The cells a straight walk from one tile to another crosses (Bresenham), its ends left out. */
function walkCells(width: number, from: { tx: number; ty: number }, to: { tx: number; ty: number }): number[] {
  const cells: number[] = [];
  let x = from.tx, y = from.ty;
  const dx = Math.abs(to.tx - x), dy = -Math.abs(to.ty - y), stepX = x < to.tx ? 1 : -1, stepY = y < to.ty ? 1 : -1;
  let error = dx + dy;
  for (let guard = 0; guard < 512 && (x !== to.tx || y !== to.ty); guard += 1) {
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += stepX; }
    if (twice <= dx) { error += dx; y += stepY; }
    if (x !== to.tx || y !== to.ty) cells.push(y * width + x);
  }
  return cells;
}

/**
 * ② A season's trips over open cells: each resident of a lived-in house to its nearest service of each kind, the
 * woodcutters to the trees felled this season, the field hands from their farmstead to the strips they tend.
 */
export function seasonFootfall(state: GameState): Map<number, number> {
  const tally = new Map<number, number>();
  const open = (cell: number) => { const tile = state.tiles[cell]; return tile !== undefined && !tile.hasRoad && tile.buildingId === null && tile.terrain !== "water"; };
  const byId = new Map(state.buildings.map(building => [building.id, building]));
  const services = FOOTFALL_TARGETS.map(kinds => state.buildings.filter(building => kinds.includes(building.kind)));
  for (const house of state.houses) {
    const home = byId.get(house.buildingId);
    if (home === undefined || house.residents <= 0) continue;
    for (const kind of services) {
      const nearest = [...kind].sort((a, b) => Math.abs(a.tx - home.tx) + Math.abs(a.ty - home.ty) - (Math.abs(b.tx - home.tx) + Math.abs(b.ty - home.ty)) || a.id.localeCompare(b.id))[0];
      if (nearest === undefined) continue;
      for (const cell of walkCells(state.width, home, nearest)) if (open(cell)) tally.set(cell, (tally.get(cell) ?? 0) + house.residents);
    }
  }
  const walk = (from: { tx: number; ty: number }, to: { tx: number; ty: number }, trips: number) => {
    for (const cell of walkCells(state.width, from, to)) if (open(cell)) tally.set(cell, (tally.get(cell) ?? 0) + trips);
  };
  // The woodcutters: from the nearest logging camp to each tree felled this season (felling, trimming, hauling).
  const camps = state.buildings.filter(building => building.kind === "logging_camp");
  for (const harvest of (state.forestHarvests ?? []).filter(entry => state.tick - entry.harvestedAtTick <= SEASON)) {
    const camp = [...camps].sort((a, b) => Math.abs(a.tx - harvest.tx) + Math.abs(a.ty - harvest.ty) - (Math.abs(b.tx - harvest.tx) + Math.abs(b.ty - harvest.ty)) || a.id.localeCompare(b.id))[0];
    if (camp !== undefined) walk(camp, harvest, WOODCUTTER_TRIPS);
  }
  // The field hands: from each farmstead to the strips it tends.
  if (zonesOf(state).some(zone => zone.kind === "arable")) {
    const layouts = arableLayouts(state);
    const tending = stripTending(state, layouts);
    for (const layout of layouts) for (const strip of layout.strips) {
      const farmstead = byId.get(tending.get(strip.id)?.farmsteadId ?? "");
      const first = strip.cells[0];
      if (tending.get(strip.id)?.status === "tended" && farmstead !== undefined && first !== undefined) walk(farmstead, first, FIELD_HAND_TRIPS);
    }
  }
  return tally;
}

/** ③ The cells left: the plots of houses standing empty and the strips nobody tends. */
function abandonedCells(state: GameState): Set<number> {
  const cells = new Set<number>();
  const empty = new Set(state.houses.filter(house => house.residents <= 0).map(house => house.buildingId));
  if (empty.size > 0) state.tiles.forEach((tile, index) => { if (tile.buildingId !== null && empty.has(tile.buildingId)) cells.add(index); });
  if (zonesOf(state).some(zone => zone.kind === "arable")) {
    const layouts = arableLayouts(state);
    const tending = stripTending(state, layouts);
    for (const layout of layouts) for (const strip of layout.strips) {
      if (tending.get(strip.id)?.status !== "tended") for (const cell of strip.cells) cells.add(cell.ty * state.width + cell.tx);
    }
  }
  return cells;
}

/** ① The grown trees' records go where the cell stands open (a zone, a building or a road keeps it cleared). */
function regrownHarvests(state: GameState): readonly ForestHarvest[] {
  const harvests = state.forestHarvests ?? [];
  if (!harvests.some(harvest => treeStage(harvest, state.tick) === "grown")) return harvests;
  const zoned = new Set(zonesOf(state).flatMap(zone => zone.membership));
  const kept = harvests.filter(harvest => {
    if (treeStage(harvest, state.tick) !== "grown") return true;
    const cell = harvest.ty * state.width + harvest.tx;
    const tile = state.tiles[cell];
    return zoned.has(cell) || tile === undefined || tile.hasRoad || tile.buildingId !== null;
  });
  return kept.length === harvests.length ? harvests : kept;
}

/** LG-3: one tick of the land — the builders' steps, each season's trips, each year's paths, regrowth and fallow. */
export function advanceLand(state: GameState): GameState {
  if (state.tick <= 0) return state;
  const seasonStart = state.tick % SEASON === 0;
  const builders = state.tick % BUILDER_SAMPLE_TICKS === 0 && state.walkers.some(walker => walker.kind === "builder");
  if (!seasonStart && !builders) return state;
  const land = landOf(state);
  const footfall = new Map(land.footfall);
  const step = (cell: number) => footfall.set(cell, (footfall.get(cell) ?? 0) + 1);
  if (builders) {
    for (const walker of state.walkers) {
      if (walker.kind !== "builder") continue;
      const cell = Math.round(walker.position.ty) * state.width + Math.round(walker.position.tx);
      const tile = state.tiles[cell];
      if (tile !== undefined && !tile.hasRoad && tile.buildingId === null) step(cell);
    }
  }
  if (!seasonStart) return { ...state, land: { ...land, footfall: [...footfall].sort((a, b) => a[0] - b[0]) } };
  for (const [cell, trips] of seasonFootfall(state)) footfall.set(cell, (footfall.get(cell) ?? 0) + trips);
  let next: LandState = { ...land, footfall: [...footfall].sort((a, b) => a[0] - b[0]) };
  let forestHarvests = state.forestHarvests;
  if (state.tick % YEAR === 0) {
    // ② The year's trips make the paths: walked enough, a path; a path barely walked grows over. The count starts again.
    const paths = new Set(land.footpaths);
    for (const [cell, trips] of footfall) if (trips >= FOOTPATH_MAKE) paths.add(cell);
    for (const cell of land.footpaths) if ((footfall.get(cell) ?? 0) < FOOTPATH_KEEP) paths.delete(cell);
    for (const cell of [...paths]) { const tile = state.tiles[cell]; if (tile === undefined || tile.hasRoad || tile.buildingId !== null) paths.delete(cell); }
    // ③ The fallow: cells left keep the tick they were left; cells used again leave the list.
    const left = abandonedCells(state);
    const since = new Map(land.fallow);
    const fallow = [...left].sort((a, b) => a - b).map(cell => [cell, since.get(cell) ?? state.tick] as const);
    next = { footfall: [], footpaths: [...paths].sort((a, b) => a - b), fallow };
    // ① The grown trees.
    forestHarvests = regrownHarvests(state);
  }
  return { ...state, land: next, ...(forestHarvests === state.forestHarvests ? {} : { forestHarvests }) };
}
