import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const SOURCE_ROOT = path.resolve("src");
const PURE_DIRECTORIES = ["world", "economy", "population", "agents", "engine"] as const;

async function sourceFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(absolute)));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

test("the simulation axes preserve the Stage2 dependency boundary", async () => {
  const forbiddenByAxis = {
    world: ["population", "agents", "engine"],
    economy: ["world", "population", "agents", "engine"],
    population: ["world", "economy", "agents", "engine"],
    agents: ["world", "population", "engine"],
  } as const;
  const violations: string[] = [];

  for (const [axis, forbidden] of Object.entries(forbiddenByAxis)) {
    for (const file of await sourceFiles(path.join(SOURCE_ROOT, axis))) {
      const source = await readFile(file, "utf8");
      for (const dependency of forbidden) {
        if (new RegExp(`from ["']\\.\\./${dependency}(?:/|["'])`).test(source)) {
          violations.push(`${path.relative(SOURCE_ROOT, file)} -> ${dependency}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("simulation and engine modules stay free of React, DOM, and Canvas APIs", async () => {
  const violations: string[] = [];
  for (const directory of PURE_DIRECTORIES) {
    for (const file of await sourceFiles(path.join(SOURCE_ROOT, directory))) {
      const source = await readFile(file, "utf8");
      if (/from ["']react["']|\bdocument\.|\bwindow\.|CanvasRenderingContext2D|\.getContext\(/.test(source)) {
        violations.push(path.relative(SOURCE_ROOT, file));
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("screen-coordinate transforms remain confined to render", async () => {
  const violations: string[] = [];
  for (const directory of PURE_DIRECTORIES) {
    for (const file of await sourceFiles(path.join(SOURCE_ROOT, directory))) {
      const source = await readFile(file, "utf8");
      if (/\b(?:ScreenPos|screenToTile|tileToScreen|TILE_W|TILE_H|\bsx\b|\bsy\b)/.test(source)) {
        violations.push(path.relative(SOURCE_ROOT, file));
      }
    }
  }
  assert.deepEqual(violations, []);
});
