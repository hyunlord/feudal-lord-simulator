// LAND-UI (LU-D7): the land picker's small map of each land's opening — the browser port of the engine's proof raster
// (scripts/archetypeTerrainCapture.ts): top-down, 2 px a tile, coloured by terrain and by the ground layer's fill and
// band, with the river and its fords (state.river), the opening village's roads and buildings. Colours are the
// canonical ramps (content/palette.ts); the picture is decoration beside the land's name.
import { PALETTE, RAMPS } from "../content/palette";
import { DEFAULT_SCENARIO_ID } from "../content/scenario/coreScenarios";
import { archetypeById } from "../content/scenario/registry";
import { newGameState } from "../state/newGame";
import { archetypeGroundLayer } from "../world/archetypeGround";

/** Device pixels per tile (a 64-tile map is 128 px; the picker shows it at 64 CSS px). */
export const LAND_PREVIEW_SCALE = 2;

type Channels = readonly [number, number, number];

function channels(hex: string): Channels {
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
}

const TERRAIN: Readonly<Record<string, Channels>> = { forest: channels(RAMPS.foliage[2]), water: channels(RAMPS.water[2]), rock: channels(RAMPS.stone[3]) };
const FILL: Readonly<Record<string, Channels>> = {
  "terrain/grass": channels(RAMPS.foliage[4]), "terrain/coastal_grass": channels(RAMPS.foliage[5]), "terrain/chalk_down": channels(RAMPS.plaster[4]),
  "terrain/heath": channels(RAMPS.earth[3]), "terrain/woodland_floor": channels(RAMPS.foliage[3]), "terrain/fen": channels(RAMPS.slate[3]),
};
const BAND: readonly (readonly [string, Channels])[] = [
  ["shore/sand_beach", channels(RAMPS.thatch[5])], ["shore/shingle", channels(RAMPS.stone[4])], ["shore/salt_marsh", channels(RAMPS.foliage[3])],
  ["boundary/reed_bed", channels(RAMPS.thatch[3])], ["boundary/", channels(RAMPS.foliage[5])],
];
const SEA = channels(RAMPS.water[1]);
const RIVER = channels(RAMPS.water[4]);
const FORD = channels(RAMPS.water[5]);
const ROAD = channels(RAMPS.earth[4]);
const BUILDING = channels(PALETTE.vermilion);
const GRASS = FILL["terrain/grass"]!;

export interface LandPreviewPixels {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major (an ImageData's layout). */
  readonly data: Uint8ClampedArray;
}

/** The opening map of a land and seed as RGBA, or null for an unknown land or a seed it does not have. */
export function landPreviewPixels(archetypeId: string, seed: number): LandPreviewPixels | null {
  const archetype = archetypeById(archetypeId);
  const state = archetype === undefined ? null : newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed });
  if (archetype === undefined || state === null) return null;
  const layer = archetypeGroundLayer(archetype, state.tiles.map(tile => tile.terrain), state.width, state.height, seed);
  const river = new Set(state.river?.cells ?? []);
  const fords = new Set(state.river?.fords ?? []);
  const width = state.width * LAND_PREVIEW_SCALE, height = state.height * LAND_PREVIEW_SCALE;
  const data = new Uint8ClampedArray(width * height * 4);
  for (const tile of state.tiles) {
    const index = tile.ty * state.width + tile.tx;
    let colour = TERRAIN[tile.terrain] ?? FILL[layer.keys[layer.fill[index]!]!] ?? GRASS;
    if (tile.terrain === "water" && (tile.tx === 0 || tile.ty === 0) && archetype.terrain.sea !== undefined) colour = SEA;
    if (river.has(index)) colour = fords.has(index) ? FORD : RIVER;
    if (layer.band[index] !== 0) {
      const bandKey = layer.keys[layer.band[index]!]!;
      colour = BAND.find(([prefix]) => bandKey.startsWith(prefix))?.[1] ?? colour;
    }
    if (tile.hasRoad) colour = ROAD;
    if (tile.buildingId !== null) colour = BUILDING;
    const decal = layer.decal[index] !== 0;
    for (let dy = 0; dy < LAND_PREVIEW_SCALE; dy += 1) for (let dx = 0; dx < LAND_PREVIEW_SCALE; dx += 1) {
      const at = ((tile.ty * LAND_PREVIEW_SCALE + dy) * width + tile.tx * LAND_PREVIEW_SCALE + dx) * 4;
      const shade = decal && dx === 0 && dy === 0 ? 0.8 : 1;
      data[at] = Math.round(colour[0] * shade); data[at + 1] = Math.round(colour[1] * shade); data[at + 2] = Math.round(colour[2] * shade); data[at + 3] = 255;
    }
  }
  return { width, height, data };
}

// Cache (AGENTS rule 10): (a) key `${archetypeId}|${seed}`; (b) nothing else enters — the scenario is fixed (the
// default campaign; a land's opening map does not depend on it) and a land's opening is a pure function of
// (land, seed); (c) each picture builds a whole opening state (~8 ms) and the picker redraws on every pick. At most
// 4 lands × 5 seeds + the riverside = 21 pictures of 64 KB.
const previews = new Map<string, LandPreviewPixels | null>();

export function cachedLandPreview(archetypeId: string, seed: number): LandPreviewPixels | null {
  const key = `${archetypeId}|${seed}`;
  if (!previews.has(key)) previews.set(key, landPreviewPixels(archetypeId, seed));
  return previews.get(key) ?? null;
}
