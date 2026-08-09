import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PALETTE } from "../src/content/palette";

const EXPECTED_PALETTE = {
  ink: "#3A2E1F",
  inkLight: "#5A4A35",
  parchment: "#E8DCC0",
  parchmentDark: "#C9B896",
  vellum: "#F2E9D4",
  vermilion: "#C8102E",
  gold: "#D4AF37",
  goldDark: "#A8862A",
  ultramarine: "#1E3A8A",
  sage: "#7A8450",
  sageDark: "#5C6640",
  forest: "#42522F",
  earth: "#8A6F4E",
  earthDark: "#6B5438",
  stone: "#8A8578",
  stoneDark: "#615D53",
  water: "#4A6B7C",
  winterGrey: "#8A9BA8",
  snow: "#DCE4E8",
} as const;

async function listSourceFiles(root: string): Promise<readonly string[]> {
  const entries = await readdir(root);
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry);
    const fileStat = await stat(absolutePath);
    if (fileStat.isDirectory()) {
      files.push(...(await listSourceFiles(absolutePath)));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(absolutePath);
    }
  }
  return files;
}

test("PALETTE exposes exactly the nineteen canonical manuscript colours", () => {
  assert.deepEqual(PALETTE, EXPECTED_PALETTE);
  assert.equal(Object.keys(PALETTE).length, 19);
});

test("source hex literals live only in src/content/palette.ts", async () => {
  const sourceRoot = path.resolve("src");
  const sourceFiles = await listSourceFiles(sourceRoot);
  const offenders: string[] = [];

  for (const sourceFile of sourceFiles) {
    if (sourceFile === path.join(sourceRoot, "content", "palette.ts")) {
      continue;
    }
    const contents = await readFile(sourceFile, "utf8");
    if (/#(?:[0-9A-Fa-f]{3}){1,2}\b/.test(contents)) {
      offenders.push(path.relative(process.cwd(), sourceFile));
    }
  }

  assert.deepEqual(offenders, []);
});

test("source CSS colour function literals live only in src/render/style.ts", async () => {
  const sourceRoot = path.resolve("src");
  const sourceFiles = await listSourceFiles(sourceRoot);
  const offenders: string[] = [];

  for (const sourceFile of sourceFiles) {
    if (sourceFile === path.join(sourceRoot, "render", "style.ts")) {
      continue;
    }
    const contents = await readFile(sourceFile, "utf8");
    if (/\b(?:rgb|rgba|hsl|hsla)\(/i.test(contents)) {
      offenders.push(path.relative(process.cwd(), sourceFile));
    }
  }

  assert.deepEqual(offenders, []);
});
