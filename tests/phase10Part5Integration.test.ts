import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { RAMPS } from "../src/content/palette";
import {
  parsePhase10SurfaceSelectionDocument,
  type Phase10SurfaceSelection,
} from "../scripts/integratePhase10SurfaceAssets";
import { writePng, type RgbaImage } from "../scripts/processBuildingSprite";

const sha256 = (filePath: string): string =>
  createHash("sha256").update(readFileSync(filePath)).digest("hex");

const rgb = (hex: string): readonly [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const image = (width: number, height: number, colour: readonly [number, number, number, number]): RgbaImage => {
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < rgba.length; index += 4) rgba.set(colour, index);
  return { dimensions: { width, height }, rgba };
};

const writeFixturePng = (root: string, key: string, candidate: number): string => {
  const filePath = path.join(root, `${key}_${String(candidate).padStart(2, "0")}.png`);
  writePng(filePath, image(8, 8, [...rgb(RAMPS.foliage[2]), 255]));
  return filePath;
};

const writeSelectionDocument = (
  filePath: string,
  selections: readonly Omit<Phase10SurfaceSelection, "sourceAbsPath">[],
  sourceRoot: string,
): void => {
  const serialised = selections.map((selection) => {
    const sourceAbsPath = writeFixturePng(sourceRoot, selection.group, selection.candidate);
    return {
      group: selection.group,
      category: selection.category,
      candidate: selection.candidate,
      seed: selection.seed,
      source_abs_path: sourceAbsPath,
      sha256: sha256(sourceAbsPath),
    };
  });
  writeFileSync(filePath, `${JSON.stringify({ unacceptable_groups: [], selections: serialised }, null, 2)}\n`);
};

const validSelections = (): readonly Omit<Phase10SurfaceSelection, "sourceAbsPath">[] => [
  { group: "tree_oak_large", category: "foliage", candidate: 1, seed: 71000101, sha256: "" },
  { group: "tree_oak_small", category: "foliage", candidate: 1, seed: 71000201, sha256: "" },
  { group: "tree_pine_tall", category: "foliage", candidate: 2, seed: 71000302, sha256: "" },
  { group: "tree_pine_short", category: "foliage", candidate: 6, seed: 71000406, sha256: "" },
  { group: "tree_birch", category: "foliage", candidate: 4, seed: 71000504, sha256: "" },
  { group: "tree_dead", category: "foliage", candidate: 5, seed: 71000605, sha256: "" },
  { group: "grass", category: "terrain", candidate: 6, seed: 71010106, sha256: "" },
  { group: "forest_floor", category: "terrain", candidate: 2, seed: 71010202, sha256: "" },
  { group: "water", category: "terrain", candidate: 2, seed: 71010302, sha256: "" },
  { group: "rock", category: "terrain", candidate: 6, seed: 71010406, sha256: "" },
  { group: "packed_earth_road", category: "terrain", candidate: 5, seed: 71010505, sha256: "" },
];

describe("Phase10 Part5 surface asset integration", () => {
  it("Given the selected surface document When parsed Then exact groups, candidates, seeds, and source hashes are enforced", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phase10-surface-selection-"));
    try {
      const selectionPath = path.join(root, "selections.json");
      writeSelectionDocument(selectionPath, validSelections(), root);

      const parsed = parsePhase10SurfaceSelectionDocument(selectionPath);

      assert.equal(parsed.length, 11);
      assert.deepEqual(
        parsed.map((selection) => [selection.group, selection.category, selection.candidate, selection.seed]),
        validSelections().map((selection) => [selection.group, selection.category, selection.candidate, selection.seed]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("Given an incomplete or unacceptable selection document When parsed Then integration stops before writing assets", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phase10-surface-invalid-"));
    try {
      const selectionPath = path.join(root, "selections.json");
      writeSelectionDocument(selectionPath, validSelections().slice(1), root);
      assert.throws(
        () => parsePhase10SurfaceSelectionDocument(selectionPath),
        /foliage selections must be exactly tree_oak_large/,
      );

      writeFileSync(selectionPath, `${JSON.stringify({ unacceptable_groups: ["water"], selections: [] })}\n`);
      assert.throws(() => parsePhase10SurfaceSelectionDocument(selectionPath), /cannot integrate unacceptable groups: water/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("Given a selected source whose bytes drift When parsed Then sha256 mismatch blocks integration", () => {
    const root = mkdtempSync(path.join(tmpdir(), "phase10-surface-sha-"));
    try {
      const sourceAbsPath = writeFixturePng(root, "tree_oak_large", 1);
      const selectionPath = path.join(root, "selections.json");
      const entries = validSelections().map((selection) => ({
        ...selection,
        source_abs_path: selection.group === "tree_oak_large"
          ? sourceAbsPath
          : writeFixturePng(root, selection.group, selection.candidate),
        sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      }));
      writeFileSync(selectionPath, `${JSON.stringify({ unacceptable_groups: [], selections: entries }, null, 2)}\n`);

      assert.throws(
        () => parsePhase10SurfaceSelectionDocument(selectionPath),
        /source sha256 .* did not match 0123456789abcdef/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
