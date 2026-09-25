import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createMemoryPlatformServices } from "../src/platform/memoryPlatform";
import { platformServices, setPlatformServicesForTest } from "../src/platform/platform";
import { openPlatformSaveStorage } from "../src/platform/saveStoragePlatform";
import { createSaveService } from "../src/save/saveService";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

// B9 gate 5: saves and loads go through PlatformServices.storage only.

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Where a save adapter or a browser store may be named: the platform layer, and src/save which defines the classes. */
const ALLOWED = [join("src", "platform") + "/", join("src", "save") + "/"];
const PATTERNS: readonly [string, RegExp][] = [
  ["constructs a save adapter", /new\s+(?:IndexedDbSaveStorage|MemorySaveStorage)\b/],
  ["opens IndexedDB", /indexedDB\s*\.\s*open\b|openSaveDatabase\s*\(/],
  ["uses localStorage / sessionStorage", /\b(?:localStorage|sessionStorage)\b/],
];

test("Given the game source When it is scanned Then only the platform layer opens save adapters or browser stores", () => {
  const offenders = sourceFiles("src")
    .filter(path => !ALLOWED.some(prefix => path.startsWith(prefix)))
    .flatMap(path => {
      const text = readFileSync(path, "utf8");
      return PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([what]) => `${path}: ${what}`);
    });
  assert.deepEqual(offenders, []);
  // src/save may define and name the adapters, but never touch a browser store itself.
  const saveStores = sourceFiles(join("src", "save")).filter(path => /\b(?:localStorage|sessionStorage)\b|indexedDB\s*\.\s*open\b/.test(readFileSync(path, "utf8")));
  assert.deepEqual(saveStores, []);
});

test("Given a platform When the game opens its saves Then it gets exactly PlatformServices.storage and a save round-trips through it", async () => {
  const platform = createMemoryPlatformServices();
  setPlatformServicesForTest(platform);
  try {
    const opened = await openPlatformSaveStorage();
    assert.equal(opened.storage, platformServices().storage);
    assert.equal(opened.storage, platform.storage);
    assert.deepEqual({ kind: opened.kind, persistent: opened.persistent }, { kind: "memory", persistent: false });
    const service = createSaveService({ storage: opened.storage, now: () => new Date("2026-09-25T00:00:00.000Z") });
    const written = await service.saveManual(DEFAULT_GAME_STATE);
    const listed = await platform.storage.list();
    assert.deepEqual(listed.map(meta => meta.slotId), [written.meta.slotId]);
    const loaded = await service.load(written.meta.slotId);
    assert.ok(loaded !== null);
    assert.deepEqual(loaded.state, DEFAULT_GAME_STATE);
  } finally {
    setPlatformServicesForTest(null);
  }
});
