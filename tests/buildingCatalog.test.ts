import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BUILDING_CATALOG, buildingEntry, buildingGlyph, CATALOG_BUILDING_KINDS, CATEGORY_GLYPH } from "../src/content/buildingCatalog";
import { BUILDING_COPY, buildingCopy, buildingHistoryName } from "../src/content/buildingCatalog.ko";
import { BUILDING_CONFIG, BUILDING_CONFIG_BY_KIND, isRetiredBuildingKind } from "../src/content/buildingConfig";
import { historicalFacilityManifest } from "../src/render/historicalFacilityManifest";
import { spriteMeta } from "../src/render/worldAssets";
import { buildingHasPicture } from "../src/render/buildingNameChip";
import { buildingBodyProfile } from "../src/render/buildingVisualState";
import { BUILD_CATEGORIES, buildCategory, buildThumbnail } from "../src/ui/buildMenuPresentation";
import { BUILD_TOOL_OPTIONS } from "../src/ui/buildMenuModel";
import { uiIconStyle } from "../src/ui/uiArt";

// BLD-REG: the building catalog — one line per engine kind and its words — and the gate that no other UI or render
// file keeps a table over every building kind or switches over one.

test("the catalog has one line and one copy line for each engine building kind, in the engine's order, named as the engine names them", () => {
  assert.deepEqual([...CATALOG_BUILDING_KINDS], BUILDING_CONFIG.map(definition => definition.kind));
  assert.deepEqual(Object.keys(BUILDING_COPY), BUILDING_CONFIG.map(definition => definition.kind));
  for (const definition of BUILDING_CONFIG) assert.equal(buildingCopy(definition.kind).name, definition.name, definition.kind);
  // The build menu lists the placeable kinds in that order, by their words.
  assert.deepEqual(BUILD_TOOL_OPTIONS.filter(option => option.tool !== "road").map(option => option.tool),
    CATALOG_BUILDING_KINDS.filter(kind => !isRetiredBuildingKind(kind)));
  for (const option of BUILD_TOOL_OPTIONS) if (option.tool !== "road") assert.equal(option.purpose, buildingCopy(option.tool).purpose);
});

test("every picture the catalog names exists: facility art, sprite keys, thumbnails, icon cells", () => {
  const facilityIds: ReadonlySet<string> = new Set(historicalFacilityManifest.map(entry => entry.id));
  for (const kind of CATALOG_BUILDING_KINDS) {
    const entry = buildingEntry(kind);
    const art = entry.facilityArt;
    if (art !== undefined) for (const id of "id" in art ? [art.id] : [art.quiet, art.active]) assert.ok(facilityIds.has(id), `${kind}: facility ${id}`);
    if (entry.spriteKey !== undefined) assert.notEqual(spriteMeta(entry.spriteKey), null, `${kind}: sprite ${entry.spriteKey}`);
    const thumbnail = buildThumbnail(kind);
    if (entry.thumbnail !== undefined) {
      assert.ok(thumbnail !== null, `${kind}: thumbnail`);
      assert.ok(existsSync(join("public", thumbnail.replace(/^\//, ""))), `${kind}: ${thumbnail}`);
    }
    for (const cell of [entry.menuIcon, entry.signIcon]) if (cell !== undefined) assert.ok(uiIconStyle("building", cell, 24) !== null, `${kind}: icon ${cell}`);
    assert.ok(BUILD_CATEGORIES.some(category => category.key === buildCategory(kind)), kind);
  }
  // Every kind the game places today has a picture; the fallback (a timber body and its name chip) is for the kinds to come.
  for (const kind of ["house", "well", "storehouse", "granary", "chapel", "farmstead", "mill", "logging_camp", "sawmill", "quarry", "masonry", "market", "church", "keep"] as const) {
    assert.ok(buildingHasPicture(kind), `${kind}: has a picture`);
  }
});

test("a kind without a glyph takes its category's; without a body, a timber body the width of its footprint", () => {
  for (const kind of CATALOG_BUILDING_KINDS) assert.equal(buildingGlyph(kind), buildingEntry(kind).glyph ?? CATEGORY_GLYPH[buildingEntry(kind).category]);
  // The body comes from the catalog's palette tokens (the mill: 38 × 62, a cone roof).
  assert.deepEqual({ ...buildingBodyProfile("mill", 0), fill: undefined, roofColor: undefined },
    { width: 38, height: 62, roof: 24, fill: undefined, roofColor: undefined, roofShape: "cone" });
  assert.equal(BUILDING_CONFIG_BY_KIND.storehouse.width, 2);
});

test("the chronicle names a building by its catalog line and leaves any other id as it is", () => {
  assert.equal(buildingHistoryName("logging_camp"), "벌목장");
  assert.equal(buildingHistoryName("keep"), "성채", "the keep has a chronicle name now");
  assert.equal(buildingHistoryName("stone_wall_segment"), "stone_wall_segment");
  assert.equal(Object.keys(BUILDING_CATALOG).length, BUILDING_CONFIG.length);
});

/** Every .ts / .tsx file under a directory. */
function sources(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "fixtures" || name === "node_modules" ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("no table over every building kind and no switch over one outside the catalog (BLD-REG gate ②)", () => {
  // The engine's rule files are theirs (the kind's rules, its builder ticks, its unlock stage); the catalog is the list.
  const ENGINE = ["engine", "economy", "population", "zones", "world", "save", "ledger", "agents"];
  const ALLOWED = new Set(["src/content/buildingCatalog.ts", "src/content/buildingCatalog.ko.ts", "src/content/buildingConfig.ts"]);
  // Keyed by something else that happens to share the kinds' names: the glyphs (by glyph key) and the tutorial's steps.
  const OTHER_KEYS = new Set(["src/ui/BuildGlyph.tsx", "src/ui/tutorial/tutorialCopy.ko.ts"]);
  const kinds = new Set<string>(BUILDING_CONFIG.map(definition => definition.kind));
  // A table that must name every kind: a Record over the kinds or the tools (not inside Partial) or a mapped type.
  const COMPLETE = /(?<!Partial<)Record<\s*(?:BuildingKind|PlacementTool)\b|\[\s*\w+\s+in\s+(?:BuildingKind|PlacementTool)\s*\]/g;
  const offenders: string[] = [];
  for (const path of sources("src")) {
    if (ENGINE.includes(path.split("/")[1]!) || ALLOWED.has(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(COMPLETE)) offenders.push(`${path}: ${match[0]}`);
    // A switch over a kind or a tool with two or more building kinds as cases.
    for (const match of text.matchAll(/switch\s*\(([^)]*)\)\s*\{/g)) {
      if (!/kind|tool/i.test(match[1]!)) continue;
      const cases = new Set([...text.slice(match.index, match.index + 3_000).matchAll(/case\s+["'](\w+)["']/g)].map(entry => entry[1]!).filter(name => kinds.has(name)));
      if (cases.size >= 2) offenders.push(`${path}: switch (${match[1]}) over ${[...cases].join(", ")}`);
    }
    // An unannotated table: six or more building kinds as object keys in one file.
    if (!OTHER_KEYS.has(path)) {
      const keys = new Set([...text.matchAll(/(?:^|[\s{,])(\w+)\s*:/g)].map(entry => entry[1]!).filter(name => kinds.has(name)));
      if (keys.size >= 6) offenders.push(`${path}: an object with ${keys.size} building kinds as keys`);
    }
  }
  assert.deepEqual(offenders, []);
});
