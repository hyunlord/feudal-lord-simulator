import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const SOURCE_ROOT = new URL("../src", import.meta.url);
const REPO_ROOT = new URL("..", import.meta.url);

const PHASE5_RENDER_FILES = [
  "src/render/renderer.ts",
  "src/render/onboardingGuidanceOverlay.ts",
  "src/render/renderVisibility.ts",
  "src/render/renderObjectFrameCache.ts",
  "src/render/objectRenderOrder.ts",
  "src/render/GameCanvas.tsx",
  "src/render/gameCanvasEvents.ts",
  "src/render/gameCanvasFrame.ts",
  "src/render/useGameCanvasRuntime.ts",
  "src/render/overlays.ts",
  "src/render/economyOverlays.ts",
  "src/render/placementFeedbackOverlay.ts",
  "src/render/drawTerrain.ts",
  "src/render/drawBuildings.ts",
  "src/render/drawObjectRenderItems.ts",
  "src/render/constructionRenderItems.ts",
  "src/render/drawConstructionSites.ts",
  "src/render/buildingSprites.ts",
  "tests/renderContracts.test.ts",
  "tests/renderVisibility.test.ts",
  "tests/renderObjectFrameCache.test.ts",
  "tests/constructionRendering.test.ts",
  "tests/constructionRenderCache.test.ts",
  "tests/onboardingGuidanceOverlay.test.ts",
  "tests/renderSourceGuards.test.ts",
] as const;

const PHASE5_IMPLEMENTATION_FILES = [
  "src/render/renderer.ts",
  "src/render/onboardingGuidanceOverlay.ts",
  "src/render/renderVisibility.ts",
  "src/render/renderObjectFrameCache.ts",
  "src/render/objectRenderOrder.ts",
  "src/render/GameCanvas.tsx",
  "src/render/gameCanvasEvents.ts",
  "src/render/gameCanvasFrame.ts",
  "src/render/useGameCanvasRuntime.ts",
  "src/render/economyOverlays.ts",
  "src/render/drawObjectRenderItems.ts",
  "src/render/constructionRenderItems.ts",
  "src/render/drawConstructionSites.ts",
  "src/render/placementFeedbackOverlay.ts",
] as const;

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
  const source = await readFile(new URL("../src/render/useGameCanvasRuntime.ts", import.meta.url), "utf8");

  // When
  const importsPreloader = /import\s+\{\s*preloadWorldAssets\s*\}\s+from\s+"\.\/worldAssets";/.test(source);
  const startsPreloaderWithoutAwait = /\bvoid\s+preloadWorldAssets\s*\(\s*\)/.test(source);
  const awaitsPreloader = /\bawait\s+preloadWorldAssets\s*\(\s*\)/.test(source);

  // Then
  assert.equal(importsPreloader, true);
  assert.equal(startsPreloaderWithoutAwait, true);
  assert.equal(awaitsPreloader, false);
});

test("renderFrame derives and draws onboarding world guidance without changing its public input", async () => {
  // Given
  const source = await readFile(new URL("../src/render/renderer.ts", import.meta.url), "utf8");

  // When
  const importsGuidance = /import\s+\{\s*onboardingWorldGuidanceTargets\s*\}\s+from\s+"..\/ui\/onboardingWorldGuidance";/.test(source);
  const importsOverlay = /import\s+\{\s*drawOnboardingGuidanceOverlay\s*\}\s+from\s+"\.\/onboardingGuidanceOverlay";/.test(source);
  const callsOverlay = /drawOnboardingGuidanceOverlay\(input\.context,\s*\{\s*targets:\s*onboardingWorldGuidanceTargets\(input\.state\),\s*zoom:\s*input\.camera\.zoom,\s*\}\);/.test(source);
  const frameInputBlock = source.match(/export type RenderFrameInput = \{[\s\S]*?\};/)?.[0] ?? "";

  // Then
  assert.equal(importsGuidance, true);
  assert.equal(importsOverlay, true);
  assert.equal(callsOverlay, true);
  assert.equal(/onboarding/i.test(frameInputBlock), false);
});

test("renderFrame computes the object queue once and reuses it across ground and object passes", async () => {
  // Given
  const source = await readFile(new URL("../src/render/renderer.ts", import.meta.url), "utf8");
  const cacheSource = await readFile(
    new URL("../src/render/renderObjectFrameCache.ts", import.meta.url),
    "utf8",
  );

  // When
  const queueBuilds = source.match(/\bbuildObjectRenderItems\s*\(/g) ?? [];
  const cacheQueueBuilds = cacheSource.match(/\bbuildObjectRenderItems\s*\(/g) ?? [];
  const passesQueueToTerrain = /drawTerrain\([\s\S]*objectRenderItems/.test(source);
  const passesQueueToObjects = /drawObjectRenderItems\([\s\S]*objectRenderItems/.test(source);

  // Then
  assert.equal(queueBuilds.length, 0);
  assert.equal(cacheQueueBuilds.length, 1);
  assert.equal(passesQueueToTerrain, true);
  assert.equal(passesQueueToObjects, true);
});

test("Phase 5 render files stay below the pure LOC ceiling", async () => {
  // Given / When
  const counts = await Promise.all(
    PHASE5_RENDER_FILES.map(async (relative) => {
      const source = await readFile(new URL(relative, REPO_ROOT), "utf8");
      const pureLoc = source
        .split("\n")
        .filter((line) => !/^\s*$/.test(line))
        .filter((line) => !/^\s*(\/\/|#|--)/.test(line)).length;
      return { relative, pureLoc };
    }),
  );

  // Then
  assert.deepEqual(
    counts.filter((entry) => entry.pureLoc > 250),
    [],
  );
});

test("Phase 5 render implementation files avoid TypeScript escape hatches", async () => {
  // Given
  const violations: string[] = [];

  // When
  for (const relative of PHASE5_IMPLEMENTATION_FILES) {
    const source = await readFile(new URL(relative, REPO_ROOT), "utf8");
    if (/\bas\s+(any|unknown)\b/.test(source)) violations.push(`${relative}:assertion`);
    if (/@ts-(ignore|expect-error)/.test(source)) violations.push(`${relative}:ts-directive`);
    if (/\w!\./.test(source)) violations.push(`${relative}:non-null`);
  }

  // Then
  assert.deepEqual(violations, []);
});
