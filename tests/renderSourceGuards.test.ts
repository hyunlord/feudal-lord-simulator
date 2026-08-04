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
