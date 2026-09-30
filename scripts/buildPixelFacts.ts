// SMOOTH-2R: pixel facts measured from the shipped PNGs at build time, so the game never reads pixels back while it
// plays (getImageData). Writes src/render/pixelFacts.generated.ts:
//  - IMAGE_OPAQUE_BOUNDS: per image drawn into the cached wall rasters (wall strips and modules, gate parts, the
//    palisade texture, the stone wall pieces), the box of its pixels with alpha > 0 (right and bottom exclusive);
//    worldRasterCache trims a raster to the drawn pieces' bounds (rasterDrawBounds.ts);
//  - FOLIAGE_RAMP_PIXELS: per foliage sprite, its pixels that are exactly a foliage ramp colour — the only pixels the
//    tree tone's ramp tint recolours (foliageRampTintPixels). Every one is 0 (the painted art has no flat ramp colour),
//    so the tint is the image itself; the script stops if a sprite ever has some (the tint would then need variants);
//  - RAIN_KEPT_RUNS: per rain sheet cell, its pixels over RAIN_ALPHA_FLOOR as row runs (base64: per row a run count,
//    then per run the gap from the last run's end and the length - 1, one byte each), the cell's halo clear;
//  - SNOW_FLAKE_PIXELS: per snowfall frame, its pixels over the flake floor (x, y pairs, row by row), the flake path;
//  - WEATHER_MEAN_RGBA: per weather tint, its colour averaged by alpha and its mean alpha (0-255), the flat tint.
// Run: npx tsx scripts/buildPixelFacts.ts   (--check: exit 1 when the committed file differs)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodePng, type Rgba } from "./keyartDerivatives";
import { RAMPS } from "../src/content/palette";
import { gateAssetStatuses } from "../src/render/gateArtAssets";
import { SEASON_IMAGES } from "../src/render/seasonArtManifest.generated";
import { STONE_WALL_SOURCES } from "../src/render/stoneWallGeometry";
import { TERRAIN_VARIANT_ASSETS, WALL_FACE_KEYS } from "../src/render/terrainVariantManifest";
import { WAVE23_IMAGES, type Wave23Key } from "../src/render/wave23ArtManifest.generated";
import { RAIN_ALPHA_FLOOR, RAIN_DRAW } from "../src/render/weatherLayers";
import { runtimeWorldAssetManifest } from "../src/render/worldAssetManifest.generated";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUT = path.join(ROOT, "src/render/pixelFacts.generated.ts");
/** The flake floor of seasonFx.ts (a snowfall pixel over it is a flake). */
export const SNOW_ALPHA_FLOOR = 24;
/** timberWallAssets.ts's texture (loaded by a literal url there). */
export const TIMBER_WALL_TEXTURE = "assets/buildings/historical-gate/palisade_straight_nw_se.png";

/** The images the cached wall rasters draw (right: the runtime lookup key, the url from "assets/"). */
export function wallRasterImageUrls(): readonly string[] {
  const faces = TERRAIN_VARIANT_ASSETS.filter(asset => (WALL_FACE_KEYS as readonly string[]).includes(asset.key)).map(asset => asset.url);
  const gates = gateAssetStatuses().map(asset => asset.url.slice(asset.url.indexOf("assets/")));
  const stone = Object.values(STONE_WALL_SOURCES).map(source => `assets/buildings/historical-wall/${source.filename}`);
  return [...new Set([...faces, ...gates, TIMBER_WALL_TEXTURE, ...stone])].sort();
}

const read = (url: string): Rgba => decodePng(readFileSync(path.join(ROOT, "public", url)));

function opaqueBounds(image: Rgba) {
  let left = image.width; let top = image.height; let right = 0; let bottom = 0;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
  }
  return right <= left ? { width: image.width, height: image.height, left: 0, top: 0, right: 0, bottom: 0 }
    : { width: image.width, height: image.height, left, top, right, bottom };
}

function rampPixels(image: Rgba): number {
  const ramp = new Set(RAMPS.foliage.map(hex => Number.parseInt(hex.slice(1), 16)));
  let count = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    if (image.data[index + 3] !== 0 && ramp.has((image.data[index]! << 16) | (image.data[index + 1]! << 8) | image.data[index + 2]!)) count += 1;
  }
  return count;
}

function keptRuns(image: Rgba, cell: { x: number; y: number; width: number; height: number }, floor: number): string {
  if (cell.width > 256) throw new Error("a rain cell wider than 256 px does not fit the run bytes");
  const bytes: number[] = [];
  for (let y = 0; y < cell.height; y += 1) {
    const runs: [number, number][] = [];
    for (let x = 0; x < cell.width; x += 1) {
      const kept = image.data[((cell.y + y) * image.width + cell.x + x) * 4 + 3]! > floor;
      if (!kept) continue;
      const last = runs.at(-1);
      if (last !== undefined && last[0] + last[1] === x) last[1] += 1; else runs.push([x, 1]);
    }
    bytes.push(runs.length);
    let end = 0;
    for (const [start, length] of runs) { bytes.push(start - end, length - 1); end = start + length; }
  }
  return Buffer.from(bytes).toString("base64");
}

function flakePixels(image: Rgba, frame: number, width: number, height: number): number[] {
  const pixels: number[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (image.data[(y * image.width + frame * width + x) * 4 + 3]! > SNOW_ALPHA_FLOOR) pixels.push(x, y);
  }
  return pixels;
}

function meanRgba(image: Rgba): readonly [number, number, number, number] | null {
  let red = 0, green = 0, blue = 0, alpha = 0;
  for (let index = 0; index < image.data.length; index += 4) {
    const a = image.data[index + 3]!;
    red += image.data[index]! * a; green += image.data[index + 1]! * a; blue += image.data[index + 2]! * a; alpha += a;
  }
  return alpha === 0 ? null : [red / alpha, green / alpha, blue / alpha, alpha / (image.data.length / 4)];
}

export function pixelFactsSource(): string {
  const bounds = Object.fromEntries(wallRasterImageUrls().map(url => [url, opaqueBounds(read(url))]));
  const foliage = runtimeWorldAssetManifest.assets.filter(asset => asset.category === "foliage");
  const ramp = Object.fromEntries(foliage.map(asset => [asset.key, rampPixels(decodePng(readFileSync(path.join(ROOT, asset.path))))]));
  const tinted = Object.entries(ramp).filter(([, count]) => count > 0);
  if (tinted.length > 0) throw new Error(`foliage ramp colours in ${tinted.map(([key, count]) => `${key} (${count})`).join(", ")}: the runtime tint is the image itself; add tinted variants first`);
  const rain = Object.fromEntries((Object.keys(RAIN_DRAW) as Wave23Key[]).map(key => {
    const meta = WAVE23_IMAGES[key]; const image = read(meta.url);
    if (!("frames" in meta) || !("columns" in meta.frames)) throw new Error(`${key}: not a sheet`);
    const frames = meta.frames;
    return [key, Array.from({ length: frames.columns * frames.rows }, (_, index) => keptRuns(image,
      { x: (index % frames.columns) * frames.cellWidth, y: Math.floor(index / frames.columns) * frames.cellHeight, width: frames.cellWidth, height: frames.cellHeight }, RAIN_ALPHA_FLOOR))];
  }));
  const snowMeta = SEASON_IMAGES.snowfall_sheet; const snowImage = read(snowMeta.url);
  const snow = Array.from({ length: snowMeta.frames.count }, (_, frame) => flakePixels(snowImage, frame, snowMeta.frames.width, snowMeta.frames.height));
  const tints = (Object.keys(WAVE23_IMAGES) as Wave23Key[]).filter(key => { const meta = WAVE23_IMAGES[key]; return meta.group === "weather" && meta.role === "fill" && !("frames" in meta); });
  const means = Object.fromEntries(tints.map(key => [key, meanRgba(read(WAVE23_IMAGES[key].url))]));
  const json = (value: unknown) => JSON.stringify(value);
  return [
    "// Generated by scripts/buildPixelFacts.ts (SMOOTH-2R): pixel facts of the shipped PNGs, measured at build time so the",
    "// game reads no pixels back while it plays. See the script for each table's format.",
    "export type OpaqueBoundsFacts = Readonly<{ width: number; height: number; left: number; top: number; right: number; bottom: number }>;",
    `export const IMAGE_OPAQUE_BOUNDS: Readonly<Record<string, OpaqueBoundsFacts>> = {\n${Object.entries(bounds).map(([url, box]) => `  ${json(url)}: ${json(box)},`).join("\n")}\n};`,
    `export const FOLIAGE_RAMP_PIXELS: Readonly<Record<string, number>> = ${json(ramp)};`,
    `export const RAIN_KEPT_RUNS: Readonly<Record<string, readonly string[]>> = {\n${Object.entries(rain).map(([key, cells]) => `  ${key}: ${json(cells)},`).join("\n")}\n};`,
    `export const SNOW_FLAKE_PIXELS: readonly (readonly number[])[] = ${json(snow)};`,
    `export const WEATHER_MEAN_RGBA: Readonly<Record<string, readonly [number, number, number, number] | null>> = ${json(means)};`,
    "",
  ].join("\n");
}

if (process.argv[1] !== undefined && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  const source = pixelFactsSource();
  if (process.argv.includes("--check")) {
    const same = readFileSync(OUT, "utf8") === source;
    console.log(same ? "pixel facts: up to date" : "pixel facts: stale (run npx tsx scripts/buildPixelFacts.ts)");
    process.exit(same ? 0 : 1);
  }
  writeFileSync(OUT, source);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${source.length} bytes)`);
}
