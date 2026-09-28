/**
 * INSTALL-28 the countryside outside the walls (Wave 28): field-edge strips on arable and pasture zones, point props
 * and wildflower patches on open country, seasons, detail levels, the stony-archetype rule and the ≤ 15 % coverage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { countryKey, pieceBlit, STRIP_SCALE, stripBlits } from "../src/render/countrysideArt";
import { countrysideDrawnAt, withCountryside } from "../src/render/countrysideDraw";
import { countryLand, SETTLED_REACH, type CountryLandInput, type CountryStripPiece } from "../src/render/countrysideLand";
import { buildCountryside, constructionSiteCells, countrysideOf, stonyArchetype } from "../src/render/countrysideLayout";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import { WAVE28_COUNTRY_IMAGES } from "../src/render/wave28CountryManifest.generated";
import type { Tile } from "../src/world/world.types";
import { cellInsideWall, zonesOf } from "../src/zones/zoneEdits";
import type { Zone, ZoneKind } from "../src/zones/zone.types";
import { countrysideCoverage } from "./helpers/countrysideCoverage";

const fixture = (name: string): GameState =>
  decodeSave(readFileSync(new URL(`../fixtures/saves/v26/${name}.save.json`, import.meta.url))).envelope.state;

const SIZE = 24;
function grassTiles(edit: (tile: Tile) => Tile = tile => tile): Tile[] {
  return Array.from({ length: SIZE * SIZE }, (_, index) => edit({ tx: index % SIZE, ty: Math.floor(index / SIZE), terrain: "grass", buildingId: null, hasRoad: false }));
}
function rectZone(id: number, kind: ZoneKind, x0: number, y0: number, x1: number, y1: number): Zone {
  const membership: number[] = [];
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) membership.push(y * SIZE + x);
  return { id: `zone-${String(id).padStart(6, "0")}`, kind, strokes: [], membership, createdOrdinal: id };
}
const input = (over: Partial<CountryLandInput>): CountryLandInput => ({ width: SIZE, height: SIZE, tiles: grassTiles(), zones: [], wall: null, siteCells: [], seed: 7, stony: false, ...over });
/** The two cells on either side of a strip piece's tile edge. */
const sides = (piece: CountryStripPiece): readonly [number, number] => piece.axis === "x"
  ? [piece.ty * SIZE + piece.tx, (piece.ty + 1) * SIZE + piece.tx] : [piece.ty * SIZE + piece.tx, piece.ty * SIZE + piece.tx + 1];

test("hedges run only on the edges where an arable or pasture zone meets other land, one piece per edge", () => {
  const zone = rectZone(1, "arable", 6, 6, 11, 9); // 6 x 4 cells: 20 boundary edges
  const land = countryLand(input({ zones: [zone] }));
  const cells = new Set(zone.membership);
  assert.equal(land.strips.length, 20);
  for (const piece of land.strips) {
    const [a, b] = sides(piece);
    assert.notEqual(cells.has(a), cells.has(b), `${piece.id} lies on a zone boundary`);
    assert.ok(piece.family === "hedgerow_a" || piece.family === "hedgerow_b", piece.family);
  }
  assert.equal(new Set(land.strips.map(piece => piece.id)).size, land.strips.length);
  // Burgage plots, orchards and the rest carry no hedge of their own.
  assert.equal(countryLand(input({ zones: [rectZone(1, "burgage", 6, 6, 11, 9), rectZone(2, "orchard", 14, 6, 16, 8)] })).strips.length, 0);
});

test("the hedge grows with its zone: the new boundary gets pieces, the old one inside the field loses them", () => {
  const small = rectZone(1, "pasture", 6, 6, 9, 9);
  const grown = { ...rectZone(1, "pasture", 6, 6, 12, 9), strokes: small.strokes };
  const before = countryLand(input({ zones: [small] })).strips;
  const after = countryLand(input({ zones: [grown] })).strips;
  assert.equal(before.length, 16);
  assert.equal(after.length, 22);
  const members = new Set(grown.membership);
  for (const piece of after) { const [a, b] = sides(piece); assert.notEqual(members.has(a), members.has(b)); }
  // The old east edge (between x = 9 and x = 10) is inside the grown field now.
  assert.ok(before.some(piece => piece.axis === "y" && piece.tx === 9));
  assert.ok(!after.some(piece => piece.axis === "y" && piece.tx === 9));
});

test("no strip against water, forest, a building or a site, or inside the wall; a road side keeps a gate gap", () => {
  const zone = rectZone(1, "arable", 6, 6, 10, 8); // north edge: 5 edges along y = 5.5
  const north = (edit: (tile: Tile) => Tile, extra: Partial<CountryLandInput> = {}) => countryLand(input({ zones: [zone], tiles: grassTiles(edit), ...extra }))
    .strips.filter(piece => piece.axis === "x" && piece.ty === 5);
  assert.equal(north(tile => tile).length, 5);
  assert.equal(north(tile => (tile.ty === 5 ? { ...tile, terrain: "water" } : tile)).length, 0);
  assert.equal(north(tile => (tile.ty === 5 ? { ...tile, terrain: "forest" } : tile)).length, 0);
  assert.equal(north(tile => (tile.ty === 5 ? { ...tile, buildingId: "b1" } : tile)).length, 0);
  assert.equal(north(tile => tile, { siteCells: [5 * SIZE + 6, 5 * SIZE + 7, 5 * SIZE + 8, 5 * SIZE + 9, 5 * SIZE + 10] }).length, 0);
  // A road along the whole north side: one gate in its middle (x = 8), the rest hedged.
  const road = north(tile => (tile.ty === 5 ? { ...tile, hasRoad: true } : tile));
  assert.deepEqual(road.map(piece => piece.tx).sort((a, b) => a - b), [6, 7, 9, 10]);
  // A wall line around the whole field: nothing inside it is hedged.
  const wall = [{ x: 4, y: 4 }, { x: 14, y: 4 }, { x: 14, y: 12 }, { x: 4, y: 12 }, { x: 4, y: 4 }];
  assert.equal(countryLand(input({ zones: [zone], wall })).strips.length, 0);
});

test("two field zones meet on a baulk; field edges by rock, and every edge on a stony map, are dry-stone walls", () => {
  const arable = rectZone(1, "arable", 6, 6, 9, 9); const pasture = rectZone(2, "pasture", 10, 6, 13, 9);
  const land = countryLand(input({ zones: [arable, pasture] }));
  const shared = land.strips.filter(piece => piece.axis === "y" && piece.tx === 9);
  assert.equal(shared.length, 4);
  assert.ok(shared.every(piece => piece.family === "baulk"));
  assert.ok(land.strips.filter(piece => piece.family !== "baulk").every(piece => piece.family.startsWith("hedgerow")));
  // Rock two cells north of the field: the north run (its outer cells touch it) is a wall, the rest stays hedge.
  const rocky = countryLand(input({ zones: [arable], tiles: grassTiles(tile => (tile.ty === 4 && tile.tx === 7 ? { ...tile, terrain: "rock" } : tile)) })).strips;
  assert.ok(rocky.filter(piece => piece.axis === "x" && piece.ty === 5).every(piece => piece.family === "dry_stone_wall"));
  assert.ok(rocky.filter(piece => !(piece.axis === "x" && piece.ty === 5)).every(piece => piece.family.startsWith("hedgerow")));
  const stony = countryLand(input({ zones: [arable, pasture], stony: true })).strips;
  assert.ok(stony.every(piece => piece.family === "dry_stone_wall" || piece.family === "baulk"));
  assert.equal(stonyArchetype("core:chalk_down"), true);
  assert.equal(stonyArchetype("core:heath"), true);
  assert.equal(stonyArchetype("core:open_field"), false);
  assert.equal(stonyArchetype(undefined), false);
});

test("each edge run picks hedgerow a or b by its own hash, the same every build", () => {
  const zones = [rectZone(1, "arable", 2, 2, 8, 6), rectZone(2, "pasture", 12, 12, 20, 18), rectZone(3, "arable", 2, 12, 6, 20)];
  const first = countryLand(input({ zones })).strips; const again = countryLand(input({ zones: zones.map(zone => ({ ...zone })) })).strips;
  assert.deepEqual(first, again);
  const families = new Set(first.map(piece => piece.family));
  assert.ok(families.has("hedgerow_a") && families.has("hedgerow_b"), [...families].join());
  // A run is one family along its length.
  const runs = new Map<string, Set<string>>();
  for (const piece of first) {
    const run = piece.id.split(":").slice(1, 6).join(":"); // country-strip:<axis>:<line>:<side>:<class>:<run start>:<edge>
    runs.set(run, (runs.get(run) ?? new Set()).add(piece.family));
  }
  for (const [run, members] of runs) assert.equal(members.size, 1, run);
});

test("props and patches stand only on open country: grass, no road, building, zone or site, outside the wall and the settled area", () => {
  for (const name of ["new-game", "population-176", "palisade-construction", "zone-undo", "four-farms"]) {
    const state = fixture(name);
    const layout = countrysideOf(state);
    assert.ok(layout.props.length > 0 && layout.fields.length > 0, name);
    const zoneCells = new Set(zonesOf(state).flatMap(zone => zone.membership));
    const sites = new Set(constructionSiteCells(state));
    const built = state.tiles.filter(tile => tile.buildingId !== null);
    for (const piece of [...layout.props, ...layout.fields]) {
      for (const cell of piece.cells) {
        const tile = state.tiles[cell]!;
        assert.equal(layout.countryside[cell], 1, `${name} ${piece.id}`);
        assert.equal(tile.terrain, "grass", `${name} ${piece.id} terrain`);
        assert.ok(!tile.hasRoad && tile.buildingId === null && !zoneCells.has(cell) && !sites.has(cell), `${name} ${piece.id} forbidden`);
        assert.ok(!cellInsideWall(state, cell), `${name} ${piece.id} inside the wall`);
        assert.ok(built.every(other => Math.max(Math.abs(other.tx - tile.tx), Math.abs(other.ty - tile.ty)) > SETTLED_REACH), `${name} ${piece.id} settled`);
      }
    }
    // No two props share a cell.
    const cells = layout.props.flatMap(piece => piece.cells);
    assert.equal(new Set(cells).size, cells.length, name);
  }
});

test("the scatter is deterministic in the seed and the tiles, and moves with the seed", () => {
  const state = fixture("zone-undo");
  const build = (seed: number, tiles: readonly Tile[] = state.tiles) => buildCountryside({ width: state.width, height: state.height, tiles, zones: zonesOf(state),
    wall: state.palisade?.polygon ?? null, siteCells: constructionSiteCells(state), seed, stony: false });
  const a = build(state.seed); const b = build(state.seed, [...state.tiles].reverse());
  assert.deepEqual({ props: a.props, fields: a.fields, strips: a.strips }, { props: b.props, fields: b.fields, strips: b.strips });
  assert.notDeepEqual(a.props, build(state.seed + 1).props);
  // Willows stand by water, crosses by a road.
  for (const piece of a.props.filter(prop => prop.family === "willow_pollard")) {
    assert.ok(state.tiles.some(tile => tile.terrain === "water" && Math.max(Math.abs(tile.tx - piece.tx), Math.abs(tile.ty - piece.ty)) <= 2), piece.id);
  }
});

test("seasons: spring and summer share the summer files, autumn and winter have their own, for every family", () => {
  const families = [...new Set(Object.values(WAVE28_COUNTRY_IMAGES).map(meta => meta.family))];
  assert.equal(families.length, 13);
  for (const family of families) {
    assert.equal(countryKey(family, 0), `${family}_summer`);
    assert.equal(countryKey(family, 1), `${family}_summer`);
    assert.equal(countryKey(family, 2), `${family}_autumn`);
    assert.equal(countryKey(family, 3), `${family}_winter`);
    for (const season of [0, 1, 2, 3] as const) assert.ok(countryKey(family, season) in WAVE28_COUNTRY_IMAGES);
  }
  const piece = countrysideOf(fixture("new-game")).props[0]!;
  assert.equal(pieceBlit(piece, 3).key, `${piece.family}_winter`);
});

test("a strip piece covers its tile edge exactly: 32 px across, its ground line on the edge, the shear by axis", () => {
  const piece: CountryStripPiece = { id: "t", family: "hedgerow_a", axis: "x", tx: 5, ty: 3, step: 9, offset: 0.9, depth: 8.5 };
  for (const axis of ["x", "y"] as const) {
    const blits = stripBlits({ ...piece, axis }, 1);
    assert.ok(blits.length >= 1 && blits.length <= 2);
    assert.ok(Math.abs(blits.reduce((sum, blit) => sum + blit.source.width * STRIP_SCALE, 0) - 32) < 1e-9);
    for (const blit of blits) {
      assert.equal(blit.m[1], (axis === "x" ? 0.5 : -0.5) * STRIP_SCALE);
      assert.equal(blit.m[2], 0); // the vertical axis is kept
      assert.ok(blit.source.x >= 0 && blit.source.x + blit.source.width <= 512 + 1e-9);
    }
    // The ground line (source y = 56) at the first slice's left end is the edge's screen-left corner.
    const [a, b, c, d, e, f] = blits[0]!.m;
    const corner = axis === "x" ? { x: (5 - 0.5 - 3.5) * 32, y: (5 - 0.5 + 3.5) * 16 } : { x: (5.5 - 3.5) * 32, y: (5.5 + 3.5) * 16 };
    assert.ok(Math.abs(a * 0 + c * 56 + e - corner.x) < 1e-9 && Math.abs(b * 0 + d * 56 + f - corner.y) < 1e-9, axis);
  }
});

test("detail levels: blocks draw nothing, simplified keeps the strips, haystacks and folds, full draws all", () => {
  const strip: CountryStripPiece = { id: "t", family: "hedgerow_b", axis: "y", tx: 1, ty: 1, step: 0, offset: 0, depth: 2.5 };
  const prop = (family: "oak_solitary" | "haystack" | "skep_row") => ({ id: family, family, tx: 1, ty: 1, cells: [25], salt: 3 });
  assert.deepEqual([0.5, 0.6, 1].map(zoom => countrysideDrawnAt(strip, zoom)), [false, true, true]);
  assert.deepEqual([0.5, 0.6, 1].map(zoom => countrysideDrawnAt(prop("haystack"), zoom)), [false, true, true]);
  assert.deepEqual([0.5, 0.6, 1].map(zoom => countrysideDrawnAt(prop("oak_solitary"), zoom)), [false, false, true]);
  assert.deepEqual([0.5, 0.6, 1].map(zoom => countrysideDrawnAt(prop("skep_row"), zoom)), [false, false, true]);
});

test("strips and props join the object queue in depth order", () => {
  const state = fixture("zone-undo");
  const range = { minTx: 0, minTy: 0, maxTx: state.width - 1, maxTy: state.height - 1 };
  const queue = objectRenderItemsForFrame({ state, visibleTiles: state.tiles, range, includeGroundCover: false });
  const country = queue.filter(item => item.kind === "countryside");
  const layout = countrysideOf(state);
  assert.equal(country.length, layout.strips.length + layout.props.length);
  for (let index = 1; index < queue.length; index += 1) assert.ok(queue[index - 1]!.depth <= queue[index]!.depth, `sorted at ${index}`);
  assert.equal(withCountryside([], state, range).length, country.length);
});

test("coverage: the props, and everything together, stay under 15 % of the screen and of the open land in view", t => {
  // Views of 1440 x 900 over a 3 x 3 grid of the map at zoom 1 (and its middle row at 0.6), in summer and autumn (the
  // autumn patches carry the most alpha); the open-land share only where a tenth of the view or more is open land.
  for (const name of ["new-game", "zone-undo", "palisade-construction", "four-farms"]) {
    const state = fixture(name);
    const worst = { props: 0, all: 0, propsOverOpen: 0, allOverOpen: 0 };
    for (const zoom of [1, 0.6]) for (const ty of zoom === 1 ? [12, 32, 52] : [32]) for (const tx of [12, 32, 52]) for (const season of [1, 2] as const) {
      const coverage = countrysideCoverage(state, { width: 1440, height: 900, zoom, centre: { tx, ty }, season });
      assert.ok(coverage.props <= 0.15 && coverage.all <= 0.15, `${name} z${zoom} (${tx},${ty}) screen ${coverage.all}`);
      worst.props = Math.max(worst.props, coverage.props); worst.all = Math.max(worst.all, coverage.all);
      if (coverage.openPixels < 1440 * 900 * 0.1) continue;
      assert.ok(coverage.allOverOpen <= 0.15, `${name} z${zoom} (${tx},${ty}) open land ${coverage.allOverOpen}`);
      worst.propsOverOpen = Math.max(worst.propsOverOpen, coverage.propsOverOpen); worst.allOverOpen = Math.max(worst.allOverOpen, coverage.allOverOpen);
    }
    const percent = (value: number) => `${(value * 100).toFixed(2)} %`;
    t.diagnostic(`${name}: screen props ${percent(worst.props)}, all ${percent(worst.all)}; open land props ${percent(worst.propsOverOpen)}, all ${percent(worst.allOverOpen)} (worst views)`);
  }
});

test("countrysideBuildMs: a layout builds in a few milliseconds and a cache hit returns the same object", t => {
  const state = fixture("palisade-construction");
  const started = performance.now();
  const built = buildCountryside({ width: state.width, height: state.height, tiles: state.tiles, zones: zonesOf(state), wall: state.palisade?.polygon ?? null,
    siteCells: constructionSiteCells(state), seed: state.seed, stony: false });
  const buildMs = performance.now() - started;
  const first = countrysideOf(state);
  const hitStarted = performance.now();
  const hit = countrysideOf({ ...state, tick: state.tick + 1, walkers: [] });
  const hitMs = performance.now() - hitStarted;
  t.diagnostic(`build ${buildMs.toFixed(2)} ms, hit ${hitMs.toFixed(3)} ms, ${built.props.length} props, ${built.fields.length} patches, ${built.strips.length} strip pieces`);
  assert.equal(hit, first);
  assert.notEqual(countrysideOf({ ...state, tiles: [...state.tiles] }), first);
});
