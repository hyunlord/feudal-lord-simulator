import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CarterWalker } from "../src/agents/walker.types";
import { SEMANTIC_PALETTE } from "../src/content/palette";
import { RESOURCE_CATALOG, resourceEntry } from "../src/content/resourceCatalog";
import { RESOURCE_COPY, resourceName } from "../src/content/resourceCatalog.ko";
import { RESOURCE_TYPES, STORABLE_RESOURCE_TYPES, STORAGE_KIND_BY_RESOURCE, type ResourceType } from "../src/content/resourceConfig";
import { cargoColor, cartLoadArt } from "../src/render/drawWalkers";
import { walkerOccupation } from "../src/render/walkerLook";
import { walkerPresentationFor } from "../src/render/walkerPresentation";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { buildCostLabel } from "../src/ui/buildMenuPresentation";
import type { BuildToolOption } from "../src/ui/buildMenuModel";
import { ledgerMatrix } from "../src/ui/hud/statusPillModel";
import { economyStockTotals } from "../src/ui/ledgerModel";
import { ResourceArtwork } from "../src/ui/ResourceArtwork";

// RES-REG: the goods are listed once (src/content/resourceCatalog.ts + .ko.ts). Every test here walks RESOURCE_TYPES,
// so a good added to the list is covered without touching this file (resourceCatalogExtensibility.test.ts adds one).

test("the catalog keeps the engine's order and store kinds (the loops over goods walk this order)", () => {
  assert.deepEqual(RESOURCE_TYPES.slice(0, 6), ["wheat", "bread", "logs", "timber", "stone_raw", "stone"]);
  assert.equal(RESOURCE_TYPES.at(-1), "coin");
  assert.equal(new Set(RESOURCE_TYPES).size, RESOURCE_CATALOG.length);
  assert.deepEqual(STORABLE_RESOURCE_TYPES, RESOURCE_TYPES.filter(resource => resource !== "coin"));
  assert.equal(STORAGE_KIND_BY_RESOURCE.wheat, "granary");
  assert.equal(STORAGE_KIND_BY_RESOURCE.bread, "granary");
  for (const resource of ["logs", "timber", "stone_raw", "stone"] as const) assert.equal(STORAGE_KIND_BY_RESOURCE[resource], "storehouse");
  assert.deepEqual(Object.keys(RESOURCE_COPY).sort(), [...RESOURCE_TYPES].sort());
});

test("one name per good: the ledger, the build menu and the construction cards say the same word", () => {
  const names = { wheat: "밀", bread: "빵", logs: "통나무", timber: "목재", stone_raw: "원석", stone: "석재", coin: "돈" } as const;
  for (const [resource, name] of Object.entries(names)) assert.equal(resourceName(resource as keyof typeof names), name);
});

function carterWith(resource: ResourceType): CarterWalker {
  return {
    id: `carter-${resource}`, kind: "carter", homeBuildingId: "store", mission: "deliver", phase: "outbound",
    destination: { kind: "construction_site", siteId: "site" }, position: { tx: 2.5, ty: 1 }, path: [{ tx: 2, ty: 1 }, { tx: 3, ty: 1 }],
    pathIndex: 0, previousTile: null, cargo: { resource, amount: 4 }, spawnedTick: 0, cancellation: null,
    reservation: { destination: { kind: "construction_site", siteId: "site" }, resource, amount: 4,
      sourceStockClaim: { kind: "building", buildingId: "store", resource, amount: 4 }, homeCapacityClaim: null },
  };
}

test("every good draws: its artwork or the generic sacks / crates with its name, a cart load, a cargo colour, a carrier", () => {
  for (const resource of RESOURCE_TYPES) {
    const entry = resourceEntry(resource);
    const markup = renderToStaticMarkup(createElement(ResourceArtwork, { kind: resource }));
    const small = renderToStaticMarkup(createElement(ResourceArtwork, { kind: resource, small: true }));
    // ASSET-2: the resource sheet's cell at both sizes; INSTALL-3: else the Wave 3 chain sheet's cell at both sizes;
    // else the generic sacks / crates and the name (small: nothing).
    if (entry.chainCell !== undefined) {
      assert.ok(markup.includes(`data-icon="chain.${entry.chainCell}"`) && small.includes(`data-icon="chain.${entry.chainCell}"`), resource);
      assert.match(markup, /assets\/wave3\/icons\/icon_resource_chain_sheet\.png/, resource);
    } else if (entry.sheetCell === undefined) {
      assert.match(markup, entry.storage === "granary" ? /wave7\/pile\/sacks_1-v1\.png/ : /wave7\/pile\/crates_1-v1\.png/, resource);
      assert.ok(markup.includes(`<span class="resource-name-chip">${resourceName(resource)}</span>`), resource);
      assert.equal(small, "", resource);
    } else {
      assert.ok(markup.includes(`data-icon="resource.${entry.sheetCell}"`) && small.includes(`data-icon="resource.${entry.sheetCell}"`), resource);
    }
    assert.doesNotMatch(markup + small, /runtime-icons-v1/, resource);
    const art = cartLoadArt(resource, "NE");
    if (entry.storage === "none") assert.equal(art, null, resource);
    else assert.equal(art?.key, entry.cartLoadKey === undefined ? (entry.storage === "granary" ? "pile_sacks_1" : "pile_crates_1") : `cart_load_${entry.cartLoadKey}_ne`, resource);
    assert.equal(cargoColor(resource), SEMANTIC_PALETTE[entry.color], resource);
    const walker = carterWith(resource);
    assert.equal(walkerOccupation(walker), entry.carrier, resource);
    assert.equal(walkerPresentationFor(walker).role, entry.carrier === "farmer" || entry.carrier === "logger" ? entry.carrier : "carter", resource);
  }
});

test("every stored good gets a ledger row and a cost line under its name", () => {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const holder = state.buildings[0]!;
  const inventory: Partial<Record<ResourceType, number>> = {};
  for (const resource of STORABLE_RESOURCE_TYPES) inventory[resource] = 3;
  state.buildings[0] = { ...holder, inventory: { ...holder.inventory, ...inventory } };
  const rows = ledgerMatrix(state).rows.map(row => row.resource);
  assert.deepEqual([...rows].sort(), [...STORABLE_RESOURCE_TYPES].sort());
  for (const resource of RESOURCE_TYPES) assert.ok(Number.isFinite(economyStockTotals(state)[resource]), resource);
  for (const resource of RESOURCE_TYPES) {
    // why: buildCostLabel reads only the tool and the cost; the rest of an option (art, lock, purpose) is not needed here.
    const option = { tool: "house", cost: { [resource]: 2 } } as unknown as BuildToolOption;
    assert.equal(buildCostLabel(option), `${resourceName(resource)} 2`, resource);
  }
});

/** Every .ts / .tsx / .mjs file under a directory. */
function sources(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "fixtures" || name === "node_modules" ? [] : sources(path);
    return /\.(ts|tsx|mjs)$/.test(name) ? [path] : [];
  });
}

test("no complete per-good table outside the catalog (RES-REG gate: a new good breaks nothing)", () => {
  const CATALOG = new Set(["src/content/resourceCatalog.ts", "src/content/resourceCatalog.ko.ts"]);
  // A table that must name every good: a Record over the goods (not inside Partial) or a mapped type over them.
  // Partial tables (costs, stocks) are data and stay.
  const COMPLETE = /(?<!Partial<)Record<(?:Storable)?ResourceType\b|\[\s*\w+\s+in\s+(?:Storable)?ResourceType\s*\]/;
  const offenders = ["src", "scripts", "tests"].flatMap(sources)
    .filter(path => !CATALOG.has(path))
    .flatMap(path => readFileSync(path, "utf8").split("\n").map((line, index) => ({ path, line: index + 1, text: line })))
    .filter(row => COMPLETE.test(row.text) && !row.text.includes("COMPLETE ="))
    .map(row => `${row.path}:${row.line}: ${row.text.trim()}`);
  assert.deepEqual(offenders, []);
});
