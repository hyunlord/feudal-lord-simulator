import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  CANONICAL_PALETTE,
  PALETTE,
  RAMPS,
  SEMANTIC_PALETTE,
} from "../src/content/palette";

const EXPECTED_PALETTE = {
  ink: "#2A2118",
  vermilion: "#A83232",
  gold: "#C9A227",
  ultramarine: "#2A4A8A",
} as const;

const EXPECTED_RAMPS = {
  thatch: ["#4A3B22", "#6B5530", "#8C7040", "#AD8C52", "#C9A868", "#E0C489"],
  timber: ["#2E2418", "#463625", "#5E4A33", "#786044", "#95795A", "#B29578"],
  plaster: ["#6B6152", "#8A8071", "#A99F8E", "#C4BAA8", "#DCD3C1", "#EFE8D8"],
  stone: ["#3D3D3B", "#565654", "#71706D", "#8D8C88", "#A9A8A3", "#C4C3BE"],
  slate: ["#2A3038", "#3D4650", "#525D6A", "#6A7684", "#85919F", "#A2ADB9"],
  earth: ["#33261A", "#4C3A28", "#664F37", "#806548", "#9A7C5C", "#B49573"],
  foliage: ["#1E2B18", "#2E4024", "#405633", "#546D43", "#6A8656", "#82A06B"],
  water: ["#1C3040", "#2A4557", "#3A5C70", "#4D758A", "#6390A6", "#7CACC2"],
} as const;

const EXPECTED_SEMANTIC_PALETTE = {
  ink: EXPECTED_PALETTE.ink,
  inkLight: EXPECTED_RAMPS.timber[2],
  parchment: EXPECTED_RAMPS.plaster[4],
  parchmentDark: EXPECTED_RAMPS.plaster[3],
  vellum: EXPECTED_RAMPS.plaster[5],
  vermilion: EXPECTED_PALETTE.vermilion,
  gold: EXPECTED_PALETTE.gold,
  goldDark: EXPECTED_PALETTE.gold,
  ultramarine: EXPECTED_PALETTE.ultramarine,
  sage: EXPECTED_RAMPS.foliage[4],
  sageDark: EXPECTED_RAMPS.foliage[3],
  forest: EXPECTED_RAMPS.foliage[2],
  earth: EXPECTED_RAMPS.timber[4],
  earthDark: EXPECTED_RAMPS.earth[2],
  stone: EXPECTED_RAMPS.plaster[1],
  stoneDark: EXPECTED_RAMPS.plaster[0],
  water: EXPECTED_RAMPS.water[3],
  winterGrey: EXPECTED_RAMPS.slate[4],
  snow: EXPECTED_RAMPS.plaster[5],
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

test("RAMPS expose exactly eight named six-step material ramps", () => {
  assert.deepEqual(RAMPS, EXPECTED_RAMPS);
  assert.equal(Object.keys(RAMPS).length, 8);
  assert.equal(Object.values(RAMPS).every((ramp) => ramp.length === 6), true);
});

test("PALETTE exposes only ink and the three canonical accent colours", () => {
  assert.deepEqual(PALETTE, EXPECTED_PALETTE);
  assert.equal(Object.keys(PALETTE).length, 4);
});

test("canonical colours are unique and avoid pure black or white", () => {
  const canonicalColours = [...CANONICAL_PALETTE];
  const canonicalSet = new Set<string>(canonicalColours);

  assert.equal(canonicalColours.length, 52);
  assert.equal(canonicalSet.size, canonicalColours.length);
  assert.equal(canonicalSet.has("#000000"), false);
  assert.equal(canonicalSet.has("#FFFFFF"), false);
});

test("semantic compatibility colours resolve to canonical entries", () => {
  const canonicalColours = new Set<string>(CANONICAL_PALETTE);

  assert.deepEqual(SEMANTIC_PALETTE, EXPECTED_SEMANTIC_PALETTE);
  assert.equal(
    Object.values(SEMANTIC_PALETTE).every((colour) => canonicalColours.has(colour)),
    true,
  );
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
