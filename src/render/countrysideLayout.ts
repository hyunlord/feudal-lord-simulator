import type { GameState } from "../engine/engine.types";
import { archetypeOf } from "../content/scenario/registry";
import { scenarioOf } from "../engine/scenarioState";
import { constructionSiteFootprint, isWallConstructionSite } from "../economy/constructionSiteAccessors";
import type { Tile } from "../world/world.types";
import { zonesOf } from "../zones/zoneEdits";
import { COUNTRY_SCALE } from "./countrysideArt";
import { countryHash, countryLand, type CountryLand, type CountryLandInput, type CountryStripPiece } from "./countrysideLand";

// INSTALL-28 point props and wildflower patches on open country (countrysideLand.ts), a deterministic scatter seeded by
// the world seed and the tile: the map is cut into BLOCK x BLOCK cell blocks; a block holds at most one piece when its
// hash falls under BLOCK_CHANCE, on the cell its hash picks, and only if that cell (with the family's footprint) is open
// country. The family is drawn by weight from those the spot allows:
//  - pollard willow only within 2 cells of water; roadside cross only beside a road (4-neighbour);
//  - haystack, hurdle sheepfold and boundary stone weigh more within 3 cells of a field zone;
//  - oak, sheepfold and the large patch need their 3 x 3 cells open, the others their 4-neighbours;
//  - tall props (oak, willow, haystack, fold) keep TALL_SPACING cells (Chebyshev) from each other; no two pieces share a
//    footprint cell;
//  - density cap: the map is also cut into REGION x REGION cell regions, and the pieces anchored in one may paint at most
//    REGION_CAP of its open cells (each piece counted by its painted area: the picture's alpha > 0 pixels, the most of
//    its three seasons, at its draw scale, in tiles of 64 x 32 / 2 px); a piece that would pass the cap is left out.
// The coverage this gives (tests/countryside.test.ts, alpha union over a view) is under 15 % of the screen and of the
// open land in view.

export type CountryPropFamily = "oak_solitary" | "willow_pollard" | "roadside_cross" | "haystack" | "hurdle_fold" | "skep_row" | "boundary_stone";
export type CountryFieldFamily = "wildflower_small" | "wildflower_large";
export type CountryPiece = {
  readonly id: string;
  readonly family: CountryPropFamily | CountryFieldFamily;
  /** Anchor cell (the ground pivot sits on its centre). */
  readonly tx: number;
  readonly ty: number;
  /** Every cell the piece stands on (all open country). */
  readonly cells: readonly number[];
  readonly salt: number;
};
export type Countryside = CountryLand & { readonly props: readonly CountryPiece[]; readonly fields: readonly CountryPiece[] };

export const BLOCK = 3;
export const BLOCK_CHANCE = 0.6;
const TALL_SPACING = 3;
export const REGION = 12;
export const REGION_CAP = 0.13;
/** Alpha > 0 pixels of each family's picture, the most of its three seasons (records/generation-records.csv: w x h − transparent). */
const ALPHA_PIXELS: Readonly<Record<CountryPropFamily | CountryFieldFamily, number>> = {
  oak_solitary: 13_606, willow_pollard: 12_878, roadside_cross: 1_854, haystack: 3_937, hurdle_fold: 4_965, skep_row: 2_015, boundary_stone: 1_508,
  wildflower_small: 2_153, wildflower_large: 11_864,
};
/** A piece's painted area in tiles (a tile's diamond is TILE_W x TILE_H / 2 = 1 024 world px). */
export const paintedTiles = (family: CountryPropFamily | CountryFieldFamily): number => ALPHA_PIXELS[family] * COUNTRY_SCALE[family] ** 2 / 1_024;
const TALL: ReadonlySet<string> = new Set(["oak_solitary", "willow_pollard", "haystack", "hurdle_fold"]);
const ROOMY: ReadonlySet<string> = new Set(["oak_solitary", "hurdle_fold", "wildflower_large"]);
/** Map archetypes whose field edges are stone (none of today's scenarios; `core:open_field` has hedges). */
const STONY_ARCHETYPE = /chalk|heath|downland/;

type Spot = { readonly nearWater: boolean; readonly nearRoad: boolean; readonly nearField: boolean };
const WEIGHTS: readonly (readonly [CountryPropFamily | CountryFieldFamily, (spot: Spot) => number])[] = [
  ["oak_solitary", () => 3],
  ["willow_pollard", spot => (spot.nearWater ? 6 : 0)],
  ["roadside_cross", spot => (spot.nearRoad ? 3 : 0)],
  ["haystack", spot => (spot.nearField ? 3 : 1)],
  ["hurdle_fold", spot => (spot.nearField ? 2 : 0.5)],
  ["skep_row", () => 1],
  ["boundary_stone", spot => (spot.nearField ? 2 : 0.5)],
  ["wildflower_small", () => 4],
  ["wildflower_large", () => 1.5],
];

export function buildCountryside(input: CountryLandInput): Countryside {
  const land = countryLand(input);
  const { width, height, countryside } = land;
  const cells: (Tile | undefined)[] = new Array(width * height);
  for (const tile of input.tiles) cells[tile.ty * width + tile.tx] = tile;
  const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && countryside[y * width + x] === 1;
  const near = (tx: number, ty: number, reach: number, test: (cell: number) => boolean): boolean => {
    for (let y = Math.max(0, ty - reach); y <= Math.min(height - 1, ty + reach); y += 1) {
      for (let x = Math.max(0, tx - reach); x <= Math.min(width - 1, tx + reach); x += 1) if (test(y * width + x)) return true;
    }
    return false;
  };
  const fieldZone = (cell: number): boolean => { const zone = land.zoneOf[cell]!; return zone >= 0 && (input.zones[zone]?.kind === "arable" || input.zones[zone]?.kind === "pasture"); };
  const regionColumns = Math.ceil(width / REGION);
  const budget = new Float64Array(regionColumns * Math.ceil(height / REGION));
  for (let cell = 0; cell < width * height; cell += 1) {
    if (countryside[cell] === 1) budget[Math.floor(Math.floor(cell / width) / REGION) * regionColumns + Math.floor((cell % width) / REGION)]! += REGION_CAP;
  }
  const taken = new Set<number>();
  const tall: { readonly tx: number; readonly ty: number }[] = [];
  const props: CountryPiece[] = []; const fields: CountryPiece[] = [];
  for (let by = 0; by * BLOCK < height; by += 1) for (let bx = 0; bx * BLOCK < width; bx += 1) {
    const hash = countryHash(by * 4_099 + bx, input.seed, 2_811);
    if ((hash % 1_000) / 1_000 >= BLOCK_CHANCE) continue;
    const tx = bx * BLOCK + ((hash >>> 10) % BLOCK); const ty = by * BLOCK + ((hash >>> 13) % BLOCK);
    if (!open(tx, ty)) continue;
    const cross4 = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
    // Cells never wrap across a row: `at` is undefined off the map (tx at 0 or width - 1 on the side).
    const at = (dx: number, dy: number): Tile | undefined => (tx + dx < 0 || tx + dx >= width ? undefined : cells[(ty + dy) * width + tx + dx]);
    const spot: Spot = {
      nearWater: near(tx, ty, 2, cell => cells[cell]?.terrain === "water"),
      nearRoad: cross4.some(([dx, dy]) => at(dx, dy)?.hasRoad === true),
      nearField: near(tx, ty, 3, fieldZone),
    };
    const roomy = [-1, 0, 1].every(dy => [-1, 0, 1].every(dx => open(tx + dx, ty + dy)));
    // A willow's bank may be water; every other piece wants its 4-neighbours open (a cross its road side excepted).
    const clearAround = (family: string): boolean => cross4.every(([dx, dy]) => open(tx + dx, ty + dy)
      || (family === "willow_pollard" && at(dx, dy)?.terrain === "water") || (family === "roadside_cross" && at(dx, dy)?.hasRoad === true));
    const choices = WEIGHTS.map(([family, weight]) => [family, ROOMY.has(family) && !roomy ? 0 : clearAround(family) ? weight(spot) : 0] as const)
      .filter(([, weight]) => weight > 0);
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
    if (total <= 0) continue;
    let pick = (((hash >>> 16) % 1_000) / 1_000) * total;
    const family = (choices.find(([, weight]) => (pick -= weight) < 0) ?? choices[choices.length - 1]!)[0];
    const footprint = ROOMY.has(family) ? [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => (ty + dy) * width + tx + dx)) : [ty * width + tx];
    const isField = family === "wildflower_small" || family === "wildflower_large";
    if (!isField && footprint.some(cell => taken.has(cell))) continue;
    if (TALL.has(family) && tall.some(other => Math.max(Math.abs(other.tx - tx), Math.abs(other.ty - ty)) < TALL_SPACING)) continue;
    const region = Math.floor(ty / REGION) * regionColumns + Math.floor(tx / REGION);
    if (budget[region]! < paintedTiles(family)) continue;
    budget[region]! -= paintedTiles(family);
    const piece: CountryPiece = { id: `country:${family}:${tx},${ty}`, family, tx, ty, cells: footprint, salt: hash >>> 4 };
    if (isField) { fields.push(piece); continue; }
    for (const cell of footprint) taken.add(cell);
    if (TALL.has(family)) tall.push({ tx, ty });
    props.push(piece);
  }
  return { ...land, props, fields };
}

/** Cells a construction site claims: a building site's footprint, and the four cells around each point of a wall site's path. */
export function constructionSiteCells(state: Pick<GameState, "constructionSites" | "width">): number[] {
  const cells: number[] = [];
  for (const site of state.constructionSites) {
    if (isWallConstructionSite(site)) {
      for (const point of site.path) for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
        if (point.x + dx >= 0 && point.x + dx < state.width && point.y + dy >= 0) cells.push((point.y + dy) * state.width + point.x + dx);
      }
      continue;
    }
    const footprint = constructionSiteFootprint(site);
    for (let y = footprint.ty; y < footprint.ty + footprint.height; y += 1) for (let x = footprint.tx; x < footprint.tx + footprint.width; x += 1) cells.push(y * state.width + x);
  }
  return cells;
}

/** A map archetype whose field edges are dry-stone walls (chalk down, heath). */
export function stonyArchetype(archetypeId: string | undefined): boolean {
  return archetypeId !== undefined && STONY_ARCHETYPE.test(archetypeId);
}

// Cache (AGENTS rule 10): the last layout, keyed on the tiles array (a road, terrain or building-footprint change
// replaces it), the zones array (a zone edit replaces it), the wall line (the palisade polygon array: proclaiming or
// moving the wall replaces it; segment progress does not), the construction sites' cells (a site placed, moved or
// finished; recomputed only when the sites array is replaced), the seed and the scenario (its archetype).
// Left out on purpose: ticks, walkers, stocks, crops, house levels and the season — none of them decides which land is
// open or where a zone's edge runs (the season only picks the picture at draw time). Measured (Mac, tsx; the v26 save
// fixtures, tests/countryside.test.ts `countrysideBuildMs`): a build 0.7–3.8 ms, a hit 0.001–0.007 ms; without the
// cache every frame would pay the build.
let last: { readonly tiles: readonly Tile[]; readonly zones: GameState["zones"]; readonly wall: unknown; readonly sites: string;
  readonly seed: number; readonly scenario: string | undefined; readonly layout: Countryside } | null = null;
let lastSites: { readonly sites: GameState["constructionSites"]; readonly key: string; readonly cells: readonly number[] } | null = null;

export function countrysideOf(state: GameState): Countryside {
  if (lastSites?.sites !== state.constructionSites) {
    const cells = constructionSiteCells(state);
    lastSites = { sites: state.constructionSites, key: cells.join(","), cells };
  }
  const sites = lastSites.key; const wall = state.palisade?.polygon ?? null;
  if (last !== null && last.tiles === state.tiles && last.zones === state.zones && last.wall === wall && last.sites === sites
    && last.seed === state.seed && last.scenario === state.scenarioId) return last.layout;
  const layout = buildCountryside({ width: state.width, height: state.height, tiles: state.tiles, zones: zonesOf(state),
    wall, siteCells: lastSites.cells, seed: state.seed, stony: stonyArchetype(archetypeOf(scenarioOf(state))?.id) });
  last = { tiles: state.tiles, zones: state.zones, wall, sites, seed: state.seed, scenario: state.scenarioId, layout };
  return layout;
}

export type { CountryStripPiece };
