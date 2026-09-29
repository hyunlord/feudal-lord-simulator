// ARCH-1 gate ② (spec docs/design/map-archetypes.md AR-2, AR-5): the engine's proof raster of each land — the
// opening state's map at 128×128 (2 px a tile, top-down, not the render's isometric view), coloured by terrain and by
// the ground layer's fill and band, with the opening village and its roads; one file per land and seed, and a sheet
// (lands across, seeds down). Colours are a legend, not art.
//   tsx scripts/archetypeTerrainCapture.ts [outDir=docs/verification/arch1/terrain] [seeds=1,2,3]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MAP_ARCHETYPES } from "../src/content/scenario/archetypes";
import { archetypeGroundLayer } from "../src/world/archetypeGround";
import { createGrowthOpening } from "./phase21OpeningTranslation";
import { encodePng } from "./keyartDerivatives";

const SCALE = 2;
type Colour = readonly [number, number, number];
const TERRAIN: Readonly<Record<string, Colour>> = { forest: [46, 84, 44], water: [58, 98, 150], rock: [128, 124, 116] };
const FILL: Readonly<Record<string, Colour>> = {
  "terrain/grass": [118, 150, 78], "terrain/coastal_grass": [164, 170, 110], "terrain/chalk_down": [196, 198, 164],
  "terrain/heath": [132, 104, 110], "terrain/woodland_floor": [96, 110, 60], "terrain/fen": [104, 130, 96],
};
const BAND: readonly (readonly [string, Colour])[] = [
  ["shore/sand_beach", [222, 206, 150]], ["shore/shingle", [170, 164, 150]], ["shore/salt_marsh", [120, 140, 110]],
  ["boundary/reed_bed", [150, 150, 84]], ["boundary/", [150, 170, 110]],
];
const SEA: Colour = [40, 74, 128];
const ROAD: Colour = [176, 142, 96];
const BUILDING: Colour = [150, 52, 40];

function raster(archetypeIndex: number, seed: number): { width: number; height: number; data: Uint8Array } {
  const archetype = MAP_ARCHETYPES[archetypeIndex]!;
  const { state } = createGrowthOpening(seed, archetype.id);
  const terrains = state.tiles.map(tile => tile.terrain);
  const layer = archetypeGroundLayer(archetype, terrains, state.width, state.height, seed);
  const width = state.width * SCALE, height = state.height * SCALE;
  const data = new Uint8Array(width * height * 4);
  for (const tile of state.tiles) {
    const index = tile.ty * state.width + tile.tx;
    const bandKey = layer.keys[layer.band[index]!]!;
    let colour: Colour = TERRAIN[tile.terrain] ?? FILL[layer.keys[layer.fill[index]!]!] ?? [255, 0, 255];
    if (tile.terrain === "water" && (tile.tx === 0 || tile.ty === 0) && archetype.terrain.sea !== undefined) colour = SEA;
    if (layer.band[index] !== 0) colour = BAND.find(([prefix]) => bandKey.startsWith(prefix))?.[1] ?? colour;
    if (tile.hasRoad) colour = ROAD;
    if (tile.buildingId !== null) colour = BUILDING;
    const decal = layer.decal[index] !== 0;
    for (let dy = 0; dy < SCALE; dy += 1) for (let dx = 0; dx < SCALE; dx += 1) {
      const at = ((tile.ty * SCALE + dy) * width + tile.tx * SCALE + dx) * 4;
      const shade = decal && dx === 0 && dy === 0 ? 0.8 : 1;
      data[at] = Math.round(colour[0] * shade); data[at + 1] = Math.round(colour[1] * shade); data[at + 2] = Math.round(colour[2] * shade); data[at + 3] = 255;
    }
  }
  return { width, height, data };
}

const out = resolve(process.argv[2] ?? "docs/verification/arch1/terrain");
const seeds = (process.argv[3] ?? "1,2,3").split(",").map(Number);
mkdirSync(out, { recursive: true });
const tiles = MAP_ARCHETYPES.map((_, archetypeIndex) => seeds.map(seed => raster(archetypeIndex, seed)));
const gap = 4;
const cell = tiles[0]![0]!;
const sheet = { width: MAP_ARCHETYPES.length * (cell.width + gap) - gap, height: seeds.length * (cell.height + gap) - gap, data: new Uint8Array(0) };
sheet.data = new Uint8Array(sheet.width * sheet.height * 4).fill(255);
tiles.forEach((column, x) => column.forEach((image, y) => {
  writeFileSync(resolve(out, `${MAP_ARCHETYPES[x]!.id.split(":")[1]}-seed${seeds[y]}.png`), encodePng(image));
  for (let row = 0; row < image.height; row += 1) {
    sheet.data.set(image.data.subarray(row * image.width * 4, (row + 1) * image.width * 4),
      ((y * (cell.height + gap) + row) * sheet.width + x * (cell.width + gap)) * 4);
  }
}));
writeFileSync(resolve(out, "sheet.png"), encodePng(sheet));
process.stdout.write(`${JSON.stringify({ out, lands: MAP_ARCHETYPES.map(archetype => archetype.id), seeds, size: [cell.width, cell.height] })}\n`);
