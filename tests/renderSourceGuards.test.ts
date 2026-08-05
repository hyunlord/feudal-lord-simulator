import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const SOURCE_ROOT = new URL("../src", import.meta.url);

async function sourceFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

test("render modules do not bypass the universal style helper for direct strokes or effects", async () => {
  // Given
  const files = await sourceFiles(SOURCE_ROOT.pathname);
  const violations: string[] = [];

  // When
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const relative = file.slice(SOURCE_ROOT.pathname.length + 1);
    if (relative !== "render/style.ts" && /\bstrokeStyle\b/.test(source)) {
      violations.push(`${relative}:strokeStyle`);
    }
    if (/createLinearGradient|createRadialGradient|shadowBlur/.test(source)) {
      violations.push(`${relative}:effect`);
    }
  }

  // Then
  assert.deepEqual(violations, []);
});

test("source files keep palette literals and sprite blits behind the Phase 4D boundaries", async () => {
  // Given
  const files = await sourceFiles(SOURCE_ROOT.pathname);
  const violations: string[] = [];

  // When
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const relative = file.slice(SOURCE_ROOT.pathname.length + 1);
    if (relative !== "content/palette.ts" && /#[0-9A-Fa-f]{3,8}\b/.test(source)) {
      violations.push(`${relative}:hex`);
    }
    if (/\bdrawImage\s*\(/.test(source) && relative !== "render/worldSprite.ts") {
      violations.push(`${relative}:drawImage`);
    }
  }

  // Then
  assert.deepEqual(violations, []);
});

test("GameCanvas starts world asset preload without blocking first paint", async () => {
  // Given
  const source = await readFile(new URL("../src/render/GameCanvas.tsx", import.meta.url), "utf8");

  // When
  const importsPreloader = /import\s+\{\s*preloadWorldAssets\s*\}\s+from\s+"\.\/worldAssets";/.test(source);
  const startsPreloaderWithoutAwait = /\bvoid\s+preloadWorldAssets\s*\(\s*\)/.test(source);
  const awaitsPreloader = /\bawait\s+preloadWorldAssets\s*\(\s*\)/.test(source);

  // Then
  assert.equal(importsPreloader, true);
  assert.equal(startsPreloaderWithoutAwait, true);
  assert.equal(awaitsPreloader, false);
});
