import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { pixelFactsSource, TIMBER_WALL_TEXTURE, wallRasterImageUrls } from "../scripts/buildPixelFacts";
import { FOLIAGE_RAMP_PIXELS, IMAGE_OPAQUE_BOUNDS, RAIN_KEPT_RUNS, SNOW_FLAKE_PIXELS, WEATHER_MEAN_RGBA } from "../src/render/pixelFacts.generated";
import { SEASON_IMAGES } from "../src/render/seasonArtManifest.generated";
import { WAVE23_IMAGES, type Wave23Key } from "../src/render/wave23ArtManifest.generated";
import { RAIN_DRAW } from "../src/render/weatherLayers";
import { runtimeWorldAssetManifest } from "../src/render/worldAssetManifest.generated";

// SMOOTH-2R: the build-time pixel facts (scripts/buildPixelFacts.ts) stand in for every pixel read while the game plays.
const ROOT = new URL("..", import.meta.url).pathname;

test("no render or UI file reads pixels back except the heraldry composer", () => {
  // Given: the one reader left is EmblemImage (UI-5): it composes arms from mask pixels when a card first shows a
  // household's emblem (CPU canvases, willReadFrequently; each mask and composite cached), not in the frame loop.
  const allowed = new Set(["src/ui/heraldry/EmblemImage.tsx"]);
  const files = (function walk(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(directory, entry.name))
      : /\.(ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []);
  })(join(ROOT, "src"));
  // When
  const readers = files.map(file => relative(ROOT, file)).filter(file => /\.getImageData\s*\(/.test(readFileSync(join(ROOT, file), "utf8")));
  // Then
  assert.deepEqual(readers.filter(file => !allowed.has(file)), []);
});

test("every image the wall rasters draw has opaque bounds inside the image", () => {
  const urls = wallRasterImageUrls();
  assert.ok(urls.includes(TIMBER_WALL_TEXTURE));
  assert.ok(readFileSync(join(ROOT, "src/render/timberWallAssets.ts"), "utf8").includes(TIMBER_WALL_TEXTURE));
  for (const url of urls) {
    const facts = IMAGE_OPAQUE_BOUNDS[url];
    assert.ok(facts !== undefined, url);
    assert.ok(facts.left >= 0 && facts.top >= 0 && facts.right <= facts.width && facts.bottom <= facts.height, url);
    assert.ok(facts.right > facts.left && facts.bottom > facts.top, `${url} is not blank`);
  }
});

test("the foliage sprites have no pixel of a ramp colour, so the tree tone's tint is the sprite itself", () => {
  const foliage = runtimeWorldAssetManifest.assets.filter(asset => asset.category === "foliage").map(asset => asset.key);
  assert.deepEqual(Object.keys(FOLIAGE_RAMP_PIXELS).sort(), [...foliage].sort());
  for (const key of ["tree_oak_large", "tree_oak_small", "tree_pine_tall", "tree_pine_short", "tree_birch", "tree_dead"]) assert.equal(FOLIAGE_RAMP_PIXELS[key], 0, key);
  assert.deepEqual(Object.values(FOLIAGE_RAMP_PIXELS).filter(count => count !== 0), []);
});

test("rain cells, snow frames and weather tints each have their facts", () => {
  for (const key of Object.keys(RAIN_DRAW) as Wave23Key[]) {
    const meta = WAVE23_IMAGES[key];
    assert.ok("frames" in meta && "columns" in meta.frames);
    const cells = RAIN_KEPT_RUNS[key]!;
    assert.equal(cells.length, meta.frames.columns * meta.frames.rows, key);
    for (const encoded of cells) {
      // Decoded runs stay inside the cell and cover each row left to right.
      const bytes = Buffer.from(encoded, "base64"); let at = 0; let rows = 0; let kept = 0;
      while (at < bytes.length) {
        const runs = bytes[at++]!; let end = 0;
        for (let run = 0; run < runs; run += 1) { const start = end + bytes[at++]!; end = start + bytes[at++]! + 1; kept += end - start; }
        assert.ok(end <= meta.frames.cellWidth); rows += 1;
      }
      assert.equal(rows, meta.frames.cellHeight, key);
      assert.ok(kept > 0 && kept < meta.frames.cellWidth * meta.frames.cellHeight, key);
    }
  }
  const snow = SEASON_IMAGES.snowfall_sheet;
  assert.equal(SNOW_FLAKE_PIXELS.length, snow.frames.count);
  for (const pixels of SNOW_FLAKE_PIXELS) {
    assert.ok(pixels.length > 0 && pixels.length % 2 === 0);
    for (let index = 0; index < pixels.length; index += 2) assert.ok(pixels[index]! < snow.frames.width && pixels[index + 1]! < snow.frames.height);
  }
  for (const key of ["frost_morning_tint", "overcast_tint", "wet_ground_sheen"] as const) {
    const mean = WEATHER_MEAN_RGBA[key];
    assert.ok(mean !== null && mean !== undefined && mean.every(channel => channel >= 0 && channel <= 255), key);
  }
});

test("the generated pixel facts match the shipped PNGs", (context) => {
  const probe = readFileSync(join(ROOT, "public", wallRasterImageUrls()[0]!));
  if (probe.readUInt32BE(0) !== 0x89504e47) { context.skip("PNGs are Git LFS pointers here"); return; }
  assert.equal(readFileSync(join(ROOT, "src/render/pixelFacts.generated.ts"), "utf8"), pixelFactsSource(), "run npx tsx scripts/buildPixelFacts.ts");
});
