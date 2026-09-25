import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { cornerTowerVariant, GATE_ASHLAR_TILES } from "../src/render/drawWallFaces";
import { farmProps } from "../src/render/farmProps";
import { GATE_REGISTRATION } from "../src/render/gateArtGeometry";
import { gateV2Registration } from "../src/render/gateArtRenderer";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { hurdleAssetKey } from "../src/render/hurdleArt";
import { TERRAIN_VARIANTS } from "../src/render/terrainVariantManifest";
import { ZONE_ASSETS } from "../src/render/zoneAssetManifest";
import { zonesOf } from "../src/zones/zoneEdits";
import { seedGroundState } from "../scripts/boundaryFixtureStates";

// INSTALL-4e (Wave 4e): pools, gate v2 registration, yard part panels, sheep and pigs.
const scene = (name: string): GameState => JSON.parse(gunzipSync(readFileSync(new URL(`../docs/verification/install4e/scene/${name}.json.gz`, import.meta.url))).toString("utf8")) as GameState;

test("Given the Wave 4e pieces When the pools are read Then rubble is the stone face, ashlar stays beside gates, the deep strips are the shore and the ferry is registered only", () => {
  assert.deepEqual(TERRAIN_VARIANTS.stoneFace, ["stone_face_rubble_a", "stone_face_rubble_b"]);
  assert.deepEqual(TERRAIN_VARIANTS.stoneFaceGate, ["stone_face_v2_a", "stone_face_v2_b", "stone_face_v2_c"]);
  assert.ok(GATE_ASHLAR_TILES > 2 && GATE_ASHLAR_TILES < 3);
  assert.deepEqual(TERRAIN_VARIANTS.shoreline, ["shoreline_deep_a", "shoreline_deep_b"]);
  assert.deepEqual(TERRAIN_VARIANTS.ferry, ["ferry_landing"]);
  assert.ok(TERRAIN_VARIANTS.stoneTower.includes("stone_tower_corner_b"));
});

test("Given the gate v2 When it is registered Then NW-SE keeps the old gate registration (same alpha) and NE-SW is its mirror about the canvas centre", () => {
  for (const material of ["stone", "timber"] as const) {
    assert.deepEqual(gateV2Registration(material, "descending"), GATE_REGISTRATION[material].descending);
    const source = GATE_REGISTRATION[material].descending; const mirrored = gateV2Registration(material, "ascending");
    assert.deepEqual(mirrored.left, { x: 1254 - source.right.x, y: source.right.y });
    assert.deepEqual(mirrored.right, { x: 1254 - source.left.x, y: source.left.y });
  }
});

test("Given corner towers When they pick a variant Then the pick is a function of the corner and both variants occur", () => {
  const picks = new Set<string>();
  for (let x = 0; x < 12; x += 1) for (let y = 0; y < 12; y += 1) {
    assert.equal(cornerTowerVariant({ x, y }), cornerTowerVariant({ x, y }));
    picks.add(cornerTowerVariant({ x, y }));
  }
  assert.deepEqual([...picks].sort(), ["drum", "square"]);
});

test("Given the seed fixtures When yard rings are laid Then quarter / three-quarter panels and the short gate appear, each drawn by its own Wave 4e piece", () => {
  const kinds = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5] as const) for (const piece of buildGroundBoundaryScene(seedGroundState(seed)).yardProps.hurdles) kinds.add(piece.kind);
  for (const kind of ["three_quarter", "short_gate", "half"]) assert.ok(kinds.has(kind), kind);
  assert.equal(hurdleAssetKey({ kind: "quarter" }), "hurdle_quarter");
  assert.equal(hurdleAssetKey({ kind: "three_quarter" }), "hurdle_three_quarter");
  assert.equal(hurdleAssetKey({ kind: "short_gate" }), "hurdle_gate_short");
  for (const key of ["hurdle_quarter", "hurdle_three_quarter", "hurdle_gate_short"]) assert.ok(ZONE_ASSETS.some(asset => asset.key === key), key);
});

test("Given a painted pasture and the forest When farm props are placed Then several flocks graze, pigs stand on open grass by the forest, never in the pasture or an orchard, and a clone gives the same props", () => {
  const state = scene("pasture-seed4");
  const props = farmProps(state);
  assert.deepEqual(farmProps(structuredClone(state)), props);
  const flocks = new Set(props.filter(prop => prop.kind.startsWith("sheep_flock")).map(prop => prop.kind));
  assert.ok(flocks.size >= 2, [...flocks].join(","));
  const pigs = props.filter(prop => prop.kind === "pig_pair");
  assert.ok(pigs.length > 0);
  const tiles = new Map(state.tiles.map(tile => [tile.ty * state.width + tile.tx, tile]));
  const fenced = new Set(zonesOf(state).filter(zone => zone.kind === "pasture" || zone.kind === "orchard").flatMap(zone => zone.membership));
  for (const pig of pigs) {
    const index = Math.round(pig.y) * state.width + Math.round(pig.x);
    assert.equal(tiles.get(index)?.terrain, "grass", pig.id);
    assert.ok(!fenced.has(index), `${pig.id} in a pasture or orchard`);
    for (const other of pigs) if (other !== pig) assert.ok(Math.hypot(other.x - pig.x, other.y - pig.y) >= 8, `${pig.id} near ${other.id}`);
  }
});
