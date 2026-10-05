/**
 * NAT-5 Wave 42 land change stages (scripts/installWave42.py; src/render/landStage*.ts, footpath*.ts): the 36 current
 * pictures installed byte for byte, the stage -> picture mapping on the engine's stages, the footpath connection rule
 * table of records/CONNECTIONS.md (no mirrored piece), the strips' mapping, and the ground chunk re-rasters a stage
 * change costs.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FALLOW_SAPLING_YEARS, FALLOW_SCRUB_YEARS } from "../src/content/landConfig";
import type { GameState } from "../src/engine/engine.types";
import { footpathRuns, stripTransform } from "../src/render/footpathDraw";
import { FOOTPATH_RULES, PORTS, PORT_STEP, footpathPieces, footpathRule, portsKey, type Port } from "../src/render/footpathModel";
import { tileToScreen } from "../src/render/iso";
import { fallowItems, withLandFallow } from "../src/render/landStageItems";
import { fallowPicture, stageSeason, treeStagePicture } from "../src/render/landStageModel";
import { WAVE42_STAGES } from "../src/render/wave42StageManifest.generated";
import type { Tile } from "../src/world/world.types";

const YEAR = 4_000;
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const csv = (path: string) => readFileSync(path, "utf8").split(/\r?\n/);

test("36 current Wave 42 pictures installed byte for byte, never a superseded file, with provenance and installed_by NAT-5", () => {
  const inbox = csv("assets-inbox/INBOX_LEDGER.csv");
  const ledger = csv("docs/provenance/assets.csv");
  assert.equal(Object.keys(WAVE42_STAGES).length, 36);
  for (const [key, meta] of Object.entries(WAVE42_STAGES)) {
    const runtime = `public/${meta.url}`;
    const rows = inbox.filter(line => line.startsWith("wave42,") && line.split(",")[1]?.endsWith(`/assets/${meta.folder}/${key}.png`));
    const current = rows.filter(line => line.split(",")[3] === "confirmed" && line.split(",")[4] === "");
    assert.equal(current.length, 1, `${key}: one current confirmed file`);
    const source = `assets-inbox/${current[0]?.split(",")[1]}`;
    assert.equal(sha(runtime), sha(source), key);
    assert.ok(current[0]?.trimEnd().endsWith(",NAT-5"), `${key} installed_by`);
    for (const other of rows.filter(line => line !== current[0])) assert.notEqual(sha(`assets-inbox/${other.split(",")[1]}`), sha(runtime), `${key}: not ${other.split(",")[1]}`);
    const row = ledger.find(line => line.includes(`,${runtime},`));
    assert.ok(row !== undefined && row.includes(sha(runtime)) && row.includes(",runtime,"), `${key} provenance`);
  }
  // The reworks and the bramble v3 are what is installed.
  assert.equal(sha("public/assets/wave42/regrowth/sapling_1to3_summer.png"), sha("assets-inbox/wave42/rework-20261002/assets/regrowth/sapling_1to3_summer.png"));
  assert.equal(sha("public/assets/wave42/abandoned/abandoned_grass_winter.png"), sha("assets-inbox/wave42/rework-20261002/assets/abandoned/abandoned_grass_winter.png"));
  assert.equal(sha("public/assets/wave42/abandoned/abandoned_bramble_summer.png"), sha("assets-inbox/wave42/bramble-v3-20261002/assets/abandoned/abandoned_bramble_summer.png"));
  const startup = readFileSync("scripts/checks/startupArtList.ts", "utf8") + readFileSync("src/render/preloadGameArt.ts", "utf8");
  assert.equal(/wave42/i.test(startup), false, "not in the startup preload");
});

test("Given the engine's stages Then each draws its picture, in summer or winter (spring and autumn draw summer)", () => {
  const felled = { tx: 3, ty: 5, harvestedAtTick: 0 };
  const timeline = [0, YEAR, 2 * YEAR, 3.5 * YEAR, 5 * YEAR].map(tick => treeStagePicture(felled, tick).replace(/(oak_large|ash_small)_/, ""));
  assert.deepEqual(timeline, ["stump_fresh", "stump_mossy", "sapling_1to3", "sapling_4to8", treeStagePicture(felled, 5 * YEAR)]);
  assert.match(timeline[4] ?? "", /^young_wood_[ab]$/);
  for (const plot of [true, false]) {
    assert.equal(fallowPicture(plot, 0, 0), plot ? "abandoned_grass" : "abandoned_overgrown_furrows");
    assert.equal(fallowPicture(plot, 0, FALLOW_SCRUB_YEARS * YEAR - 1), plot ? "abandoned_grass" : "abandoned_overgrown_furrows");
    assert.equal(fallowPicture(plot, 0, FALLOW_SCRUB_YEARS * YEAR), "abandoned_bramble");
    assert.equal(fallowPicture(plot, 0, FALLOW_SAPLING_YEARS * YEAR), "abandoned_saplings");
  }
  assert.deepEqual(([0, 1, 2, 3] as const).map(stageSeason), ["summer", "summer", "summer", "winter"]);
  for (const base of ["stump_oak_large_fresh", "stump_ash_small_mossy", "sapling_1to3", "sapling_4to8", "young_wood_a", "young_wood_b", "abandoned_grass",
    "abandoned_overgrown_furrows", "abandoned_bramble", "abandoned_saplings"]) {
    for (const season of ["summer", "winter"]) assert.ok(`${base}_${season}` in WAVE42_STAGES, `${base}_${season}`);
  }
});

test("Given every neighbour pattern Then the rule table gives the pack's join or strip halves, never a mirrored piece", () => {
  assert.equal(Object.keys(FOOTPATH_RULES).length, 16);
  const expected: Record<string, [string, string | null]> = {
    "": ["dot", null], NE: ["end", null], SE: ["end", null], SW: ["end", null], NW: ["end", null],
    "NE+SW": ["straight_ne", null], "SE+NW": ["straight_nw", null],
    "SW+NW": ["corner_ne", "path_clear_corner_ne"], "NE+SE": ["corner_nw", "path_clear_corner_nw"], "NE+NW": ["corner_n", null], "SE+SW": ["corner_s", null],
    "NE+SW+NW": ["fork_ne", "path_clear_fork_ne"], "NE+SE+NW": ["fork_nw", "path_clear_fork_nw"], "NE+SE+SW": ["fork_se", null], "SE+SW+NW": ["fork_sw", null],
    "NE+SE+SW+NW": ["cross", null],
  };
  for (const [key, [shape, connector]] of Object.entries(expected)) {
    const found = footpathRule(key === "" ? [] : key.split("+") as Port[]);
    assert.deepEqual([found.shape, found.connector], [shape, connector], key);
    const ports = key === "" ? [] : key.split("+");
    if (connector !== null) {
      // The join's own ports (CONNECTIONS.md, the manifest) are exactly the cell's: no rotation, no flip.
      for (const season of ["summer", "winter"]) {
        const name = `${connector}_${season}` as keyof typeof WAVE42_STAGES;
        const meta = WAVE42_STAGES[name];
        assert.ok(meta !== undefined);
        assert.deepEqual(Object.keys("ports" in meta ? meta.ports : {}).sort(), [...ports].sort(), `${connector} ports`);
      }
      assert.deepEqual(found.halves, []);
    } else if (shape !== "dot") assert.deepEqual([...found.halves].sort(), [...ports].sort(), `${key}: a half to each port`);
  }
  assert.equal(portsKey(["NW", "NE"]), "NE+NW");
  assert.equal(/flip|mirror|scale\(-1/i.test(readFileSync("src/render/footpathDraw.ts", "utf8").replace(/never a reflection|no_flip|mirrored/g, "")), false);
});

const grid = (width: number, height: number, edit: (tile: Tile) => Tile = tile => tile): Pick<GameState, "tiles" | "width" | "height"> => ({
  width, height, tiles: Array.from({ length: width * height }, (_, index) => edit({ tx: index % width, ty: Math.floor(index / width), terrain: "grass", hasRoad: false, buildingId: null })),
});

test("Given footpath cells Then each takes the piece of its neighbours: straight, corner, T, cross, end and a lone cell", () => {
  const state = grid(12, 12);
  const at = (tx: number, ty: number) => ty * 12 + tx;
  // A plus at (5, 5), an arm along +tx to (8, 5) that turns to +ty at (8, 7), and a lone cell at (1, 10).
  const cells = [at(5, 3), at(5, 4), at(5, 5), at(5, 6), at(5, 7), at(4, 5), at(3, 5), at(6, 5), at(7, 5), at(8, 5), at(8, 6), at(8, 7), at(1, 10)];
  const shapes = new Map(footpathPieces(state, cells).map(piece => [`${piece.tx},${piece.ty}`, piece.rule.shape]));
  assert.equal(shapes.get("5,5"), "cross");
  assert.equal(shapes.get("5,4"), "straight_ne");
  assert.equal(shapes.get("5,3"), "end");
  assert.equal(shapes.get("7,5"), "straight_nw");
  assert.equal(shapes.get("8,5"), "corner_ne", "from NW to SW: the pack's corner_ne");
  assert.equal(shapes.get("8,7"), "end");
  assert.equal(shapes.get("1,10"), "dot");
  const tee = new Map(footpathPieces(state, [at(1, 2), at(2, 2), at(3, 2), at(4, 2), at(5, 2), at(3, 3), at(3, 4)]).map(piece => [`${piece.tx},${piece.ty}`, piece.rule]));
  assert.deepEqual([tee.get("3,2")?.shape, tee.get("3,2")?.connector], ["fork_sw", null]);
  const forkNe = new Map(footpathPieces(state, [at(1, 2), at(2, 2), at(3, 2), at(3, 1), at(3, 0), at(3, 3), at(3, 4)]).map(piece => [`${piece.tx},${piece.ty}`, piece.rule]));
  assert.deepEqual([forkNe.get("3,2")?.shape, forkNe.get("3,2")?.connector], ["fork_ne", "path_clear_fork_ne"]);
});

test("Given a worn patch Then the picture draws its centre line, not a lattice", () => {
  const state = grid(14, 10);
  const at = (tx: number, ty: number) => ty * 14 + tx;
  // A band three cells wide along +tx from (2, 3) to (11, 5).
  const band = Array.from({ length: 10 }, (_, dx) => [at(2 + dx, 3), at(2 + dx, 4), at(2 + dx, 5)]).flat();
  const pieces = footpathPieces(state, band);
  assert.ok(pieces.length <= 12, `${pieces.length} cells drawn of 30`);
  assert.equal(pieces.filter(piece => piece.rule.shape === "cross").length, 0);
  assert.ok(pieces.filter(piece => piece.rule.shape === "straight_nw").length >= 5, "one track along the band");
  assert.ok(pieces.every(piece => band.includes(piece.cell) || piece.bridge));
});

test("Given a diagonal step, water, a road or a building Then the step goes through one open cell and ends meet the town", () => {
  const at = (tx: number, ty: number) => ty * 10 + tx;
  const open = grid(10, 10);
  const stepped = footpathPieces(open, [at(2, 2), at(3, 3)]);
  assert.deepEqual(stepped.map(piece => [piece.tx, piece.ty, piece.bridge, piece.rule.shape]), [[2, 2, false, "end"], [3, 2, true, "corner_ne"], [3, 3, false, "end"]]);
  const wet = grid(10, 10, tile => (tile.tx === 3 && tile.ty === 2 ? { ...tile, terrain: "water" } : tile));
  assert.deepEqual(footpathPieces(wet, [at(2, 2), at(3, 3)]).filter(piece => piece.bridge).map(piece => [piece.tx, piece.ty]), [[2, 3]]);
  const town = grid(10, 10, tile => (tile.tx === 6 ? { ...tile, hasRoad: true } : tile.tx === 2 && tile.ty === 7 ? { ...tile, buildingId: "home" } : tile));
  const pieces = footpathPieces(town, [at(5, 4), at(4, 4), at(6, 4), at(2, 6)]);
  assert.equal(pieces.some(piece => piece.tx === 6), false, "never on the road");
  assert.deepEqual(pieces.find(piece => piece.tx === 5)?.ports, ["SE", "NW"], "the path's end runs on under the road");
  assert.deepEqual(pieces.find(piece => piece.tx === 2)?.ports, ["SW"], "a lone cell beside a house joins the house");
});

test("Given a run of pieces Then the strip halves merge along their line, overlap a join by 8 UV px and fade past an end", () => {
  const state = grid(12, 12);
  const at = (tx: number, ty: number) => ty * 12 + tx;
  const runs = footpathRuns(footpathPieces(state, [at(5, 2), at(5, 3), at(5, 4), at(5, 5)]));
  assert.equal(runs.length, 1, "one continuous run, no restarts or overlaps between cells");
  const run = runs[0];
  assert.ok(run !== undefined);
  // NE axis at tx 5: u = -ty * 128; the run spans from (5, 5)'s centre to (5, 2)'s centre, fading at both ends.
  assert.deepEqual([run.axis, run.line, run.from, run.to, run.fadeFrom, run.fadeTo], ["ne", 5, -5 * 128 + 64, -2 * 128 + 64, true, true]);
  // The mapping puts u at a cell's SW port on its SW edge midpoint, u + 128 on its NE one, v = 32 on the centre line.
  for (const [axis, line, cellTx, cellTy, entry, exit] of [["ne", 5, 5, 3, [5, 3.5], [5, 2.5]], ["nw", 4, 7, 4, [6.5, 4], [7.5, 4]]] as const) {
    const from = axis === "ne" ? -cellTy * 128 : cellTx * 128;
    const [a, b, c, d, e, f] = stripTransform(axis, line, from);
    const world = (x: number, v: number) => ({ sx: a * x + c * v + e, sy: b * x + d * v + f });
    for (const [x, tile] of [[0, entry], [128, exit]] as const) {
      const expected = tileToScreen(tile[0], tile[1]);
      assert.ok(Math.abs(world(x, 32).sx - expected.sx) < 1e-9 && Math.abs(world(x, 32).sy - expected.sy) < 1e-9, `${axis} ${x}`);
    }
    assert.ok(a * d - b * c > 0, "positive determinant: never a reflection");
  }
  const bend = footpathRuns(footpathPieces(state, [at(5, 1), at(5, 2), at(5, 3), at(6, 3), at(7, 3)]));
  assert.equal(bend.length, 2);
  assert.ok(bend.every(entry => entry.fadeFrom !== entry.fadeTo), "each arm fades only at its end");
  assert.ok(PORTS.every(port => PORT_STEP[port].some(step => step !== 0)));
});

test("Given fallow cells Then their pictures join the object queue by depth, a plot's just before its house", () => {
  const base = grid(8, 8, tile => (tile.tx === 2 && tile.ty === 2 ? { ...tile, buildingId: "home" } : tile));
  const state = { ...base, tick: 2 * YEAR + 10, land: { footfall: [], footpaths: [], fallow: [[2 * 8 + 2, 2 * YEAR], [5 * 8 + 4, 0]] as [number, number][] } } as unknown as GameState;
  const items = fallowItems(state);
  assert.deepEqual(items.map(item => [item.id, item.piece.picture]), [["fallow:18", "abandoned_grass"], ["fallow:44", "abandoned_saplings"]]);
  assert.ok((items[0]?.depth ?? 0) < 4, "a plot's fallow sorts before its house");
  assert.equal(fallowItems(state), items, "the same list until the year turns");
  const range = { minTx: 0, maxTx: 7, minTy: 0, maxTy: 7 };
  const queue = [{ kind: "building", id: "home", depth: 4, anchorTx: 2 }] as unknown as Parameters<typeof withLandFallow>[0];
  const merged = withLandFallow(queue, state, range);
  assert.deepEqual(merged.map(item => item.id), ["fallow:18", "home", "fallow:44"]);
});

test("Given a drawn town When one footpath, one felled tree or one fallow cell changes Then only the touched ground chunks re-raster (none for the objects)", async () => {
  const { seedGroundState } = await import("../scripts/boundaryFixtureStates");
  const { measureRebake, withOneFallowTurned, withOneMoreFootpath, withOneTreeOlder } = await import("../scripts/nat5StageRebake");
  const town = seedGroundState(2);
  const open = (cell: number) => { const tile = town.tiles[cell]; return tile !== undefined && tile.terrain === "grass" && !tile.hasRoad && tile.buildingId === null; };
  const row = Array.from({ length: 24 }, (_, dx) => 40 * town.width + 26 + dx).filter(open);
  const forest = town.tiles.findIndex(tile => tile.terrain === "forest" && tile.buildingId === null && !tile.hasRoad);
  assert.ok(row.length >= 6 && forest >= 0);
  const state: GameState = { ...town, tick: 1_500, land: { footfall: [], footpaths: row, fallow: [[row[0] ?? 0, 0]] },
    forestHarvests: [{ tx: forest % town.width, ty: Math.floor(forest / town.width), harvestedAtTick: 1_000 }] };
  const camera = { tx: 38, ty: 40, zoom: 1, width: 1280, height: 800 };
  const footpath = measureRebake(state, withOneMoreFootpath(state, camera), camera);
  assert.ok(footpath.rerastered.length >= 1 && footpath.rerastered.length <= 4, footpath.rerastered.join(","));
  assert.ok(footpath.chunksInView >= 20, `${footpath.chunksInView} chunks in view`);
  const tree = measureRebake(state, withOneTreeOlder(state, camera), camera);
  assert.deepEqual([tree.rerastered, tree.contentRasters, tree.objectQueueChanged], [[], 0, true]);
  const fallow = measureRebake(state, withOneFallowTurned(state), camera);
  assert.deepEqual([fallow.rerastered, fallow.contentRasters, fallow.objectQueueChanged], [[], 0, true]);
});
