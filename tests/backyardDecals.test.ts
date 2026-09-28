/**
 * INSTALL-27 backyard decals (src/render/backyardDecals.ts, drawn by drawBackyardDecals.ts; rules in
 * src/content/backyardConfig.ts): the occupation mapping, the circumstance order, winter, the deterministic A / B, the
 * zoom rule (IN7-D1's 0.8), and the placement on the cells behind the house, away from its road.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { YARD_CIRCUMSTANCES, YARD_OCCUPATION_BY_CRAFT, YARD_OCCUPATION_BY_TRADE, YARD_OCCUPATION_KINDS, YARD_RULES, YARD_SHARED_KINDS,
  YARD_UNPICTURED_TRADES } from "../src/content/backyardConfig";
import type { Building } from "../src/content/buildingConfig";
import { CRAFT_DEFINITIONS } from "../src/content/crafts/craftDefinitions";
import { advanceCloth, spinningSlot } from "../src/engine/cloth";
import type { GameState } from "../src/engine/engine.types";
import { MASTER_TRADES } from "../src/engine/persons";
import type { Person } from "../src/engine/persons.types";
import type { House } from "../src/population/population.types";
import { backyardDecals, backyardLayout, backyardPlan, yardKey, yardMoveIns, yardOccupation, yardPictureKind, yardSharedKey, yardVariant,
  type YardHousehold } from "../src/render/backyardDecals";
import { drawBackyardDecals, YARD_DECAL_MIN_ZOOM, yardClipPolygons, yardDecalRect, yardDecalsDrawnAt, YARD_SCALE } from "../src/render/drawBackyardDecals";
import { CART_LOAD_MIN_ZOOM } from "../src/render/drawWalkers";
import { WAVE27_YARD_IMAGES, type Wave27YardKey } from "../src/render/wave27YardManifest.generated";
import { decodeSave } from "../src/save/saveCodec";
import { clothTown } from "./helpers/clothTown";

const load = (name: string) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v26/${name}.save.json`))).envelope.state as GameState;
/** The town in a calendar season (1 summer, 3 winter), in a later year than its ledger. */
const inSeason = (state: GameState, season: number): GameState => ({ ...state, tick: Math.floor(state.tick / 4_000) * 4_000 + 4_000 + season * 1_000 + 500 });
const TOWNS = ["palisade-construction", "four-farms", "population-176", "timber-shortage", "zoned-opening"] as const;
const person = (id: string, role: Person["role"], occupation: string) => ({ id, role, occupation });
const fed: YardHousehold["house"] = { level: 2, residents: 5 };
const household = (fields: Partial<YardHousehold> = {}): YardHousehold => ({ house: fed, members: [], tick: 10_000, winter: false, movedInTick: null, ...fields });

test("Given the manifest When every picture the rules can name is looked up Then each has its a / b (and the four shared props) at their record sizes", () => {
  for (const kind of [...YARD_OCCUPATION_KINDS, ...YARD_CIRCUMSTANCES]) for (const variant of ["a", "b"]) {
    const meta = WAVE27_YARD_IMAGES[`yard_${kind}_${variant}` as Wave27YardKey];
    assert.ok(meta !== undefined, `${kind} ${variant}`);
    assert.deepEqual([meta.width, meta.height, meta.anchor.x, meta.anchor.y, meta.footprint.x, meta.footprint.y], [256, 128, 128, 104, 2, 1]);
  }
  for (const kind of YARD_SHARED_KINDS) {
    const meta = WAVE27_YARD_IMAGES[`yard_${kind}` as Wave27YardKey];
    assert.deepEqual([meta.width, meta.height, meta.anchor.x, meta.anchor.y, meta.footprint.x, meta.footprint.y], [128, 64, 64, 52, 1, 1]);
  }
  assert.equal(Object.keys(WAVE27_YARD_IMAGES).length, 40);
  for (const kind of [...Object.values(YARD_OCCUPATION_BY_TRADE), ...Object.values(YARD_OCCUPATION_BY_CRAFT)]) assert.ok(YARD_OCCUPATION_KINDS.includes(kind));
});

test("Given households When their yard trade is read Then the brewing craft comes first, then the head's, spouse's and others' trades; labour and unmapped trades give none", () => {
  const brewing = { crafts: [{ craftId: "brew_ale", workers: 1, input: {}, output: {}, stock: {} }] };
  assert.equal(yardOccupation(brewing, [person("p-1", "head", "miller")]), "brewer");
  assert.equal(yardOccupation({}, [person("p-1", "head", "miller")]), "miller");
  assert.equal(yardOccupation({}, [person("p-2", "spouse", "chapman"), person("p-1", "head", "labourer")]), "merchant");
  assert.equal(yardOccupation({}, [person("p-9", "kin", "sawyer"), person("p-3", "spouse", "storekeeper")]), "merchant", "the spouse before kin");
  assert.equal(yardOccupation({}, [person("p-9", "child", "husbandman"), person("p-4", "child", "woodward")]), "carpenter", "the rest by id");
  const mapped: Record<string, string> = { husbandman: "farmer", miller: "miller", granger: "miller", sawyer: "carpenter", woodward: "carpenter",
    chapman: "merchant", storekeeper: "merchant" };
  for (const [trade, kind] of Object.entries(mapped)) assert.equal(yardOccupation({}, [person("p-1", "head", trade)]), kind, trade);
  for (const trade of ["labourer", "child", "mason", "quarrier", "steward", "lord", "lady"]) assert.equal(yardOccupation({}, [person("p-1", "head", trade)]), null, trade);
  assert.equal(yardOccupation({ crafts: [{ craftId: null, workers: 0, input: {}, output: {}, stock: {} }] }, []), null);
});

const slot = (craftId: string | null) => ({ craftId, workers: craftId === null ? 0 : 1, input: {}, output: {}, stock: {} });

test("Given households spinning at home (C5) When their yard trade is read Then spinning is the weaver's yard, before the members' trades; brewing and spinning: the house id picks one", () => {
  assert.equal(yardOccupation({ crafts: [slot(null), slot("spin_yarn")] }, [person("p-1", "head", "miller")]), "weaver");
  const both = Array.from({ length: 40 }, (_, at) => ({ buildingId: `house-${at}`, crafts: [slot("brew_ale"), slot("spin_yarn")] }));
  const picked = both.map(house => yardOccupation(house, [person("p-1", "head", "chapman")]));
  assert.deepEqual(new Set(picked), new Set(["brewer", "weaver"]), "both trades show across the town");
  assert.deepEqual(both.map(house => yardOccupation(house, [])), picked, "the same house, the same yard; the members' trades wait");
  assert.equal(yardPictureKind(household({ house: { ...fed, crafts: [slot(null), slot("spin_yarn")] } })), "weaver");
});

test("Given the engine's trades and crafts When the yard tables are checked Then each is decided (a picture or none) and no row names a trade the engine does not give", () => {
  // INSTALL-27: C5's five buildings have no MASTER_TRADES entry (their staff are counts), so no shepherd, weaver, fuller,
  // dyer or tenterer is a person's trade yet; this fails when the engine names one, for backyardConfig to decide.
  const trades = new Set(Object.values(MASTER_TRADES).map(trade => trade.occupation));
  for (const trade of trades) assert.ok(YARD_OCCUPATION_BY_TRADE[trade] !== undefined || YARD_UNPICTURED_TRADES.includes(trade), `undecided trade ${trade}`);
  for (const trade of [...Object.keys(YARD_OCCUPATION_BY_TRADE), ...YARD_UNPICTURED_TRADES]) assert.ok(trades.has(trade), `no engine trade ${trade}`);
  for (const kind of ["pastoral_farm", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard"]) assert.equal(MASTER_TRADES[kind], undefined, kind);
  assert.deepEqual(CRAFT_DEFINITIONS.map(craft => craft.id).sort(), Object.keys(YARD_OCCUPATION_BY_CRAFT).sort());
  const used = new Set([...Object.values(YARD_OCCUPATION_BY_TRADE), ...Object.values(YARD_OCCUPATION_BY_CRAFT)]);
  assert.deepEqual(YARD_OCCUPATION_KINDS.filter(kind => !used.has(kind)), ["baker", "blacksmith", "dyer", "tanner", "shepherd", "fisher"]);
});

test("Given the C5 town with fleece in its stores in summer When its women take up spinning Then its yards are the brewers' and the weavers' by house", () => {
  const town = clothTown();
  const store = town.buildings.filter(building => building.kind === "storehouse").sort((a, b) => a.id.localeCompare(b.id))[0]!;
  // A spinning batch (every 400 ticks) in a later year's summer (season 1).
  const tick = Math.floor(town.tick / 4_000) * 4_000 + 4_000 + 1_200;
  const spun = advanceCloth({ ...town, tick, buildings: town.buildings.map(entry => entry.id === store.id ? { ...entry, inventory: { ...entry.inventory, fleece: 200 } } : entry) });
  const spinning = spun.houses.filter(house => spinningSlot(house) !== null);
  assert.ok(spinning.length >= 10);
  assert.deepEqual(new Set(spinning.map(house => yardOccupation(house, []))), new Set(["brewer", "weaver"]));
  let checked = 0;
  for (const decal of backyardDecals(spun)) {
    const house = spun.houses.find(entry => entry.buildingId === decal.buildingId)!;
    if (spinningSlot(house) === null || decal.cells.length < 2) continue;
    assert.ok(decal.key.startsWith(`yard_${yardOccupation(house, [])}_`), `${decal.buildingId}: ${decal.key}`);
    checked += 1;
  }
  assert.ok(checked > 0);
});

test("Given a household's circumstances When its yard picture is chosen Then winter > vacant > hungry > newcomer > trade > prosperous / strained", () => {
  const miller = [person("p-1", "head", "miller")];
  assert.equal(yardPictureKind(household({ winter: true, house: { ...fed, abandonedTick: 1 }, members: miller })), "winter");
  assert.equal(yardPictureKind(household({ house: { ...fed, abandonedTick: 1, foodShortSinceTick: 1 }, members: miller })), "vacant");
  assert.equal(yardPictureKind(household({ house: { ...fed, residents: 0 } })), "vacant");
  assert.equal(yardPictureKind(household({ house: { ...fed, foodShortSinceTick: 9_000 }, members: miller, movedInTick: 9_900 })), "hungry");
  assert.equal(yardPictureKind(household({ house: { ...fed, leavingSinceTick: 9_000 } })), "hungry");
  assert.equal(yardPictureKind(household({ members: miller, movedInTick: 10_000 - YARD_RULES.newcomerTicks + 1 })), "newcomer");
  assert.equal(yardPictureKind(household({ members: miller, movedInTick: 10_000 - YARD_RULES.newcomerTicks })), "miller", "the newcomer's season is out");
  assert.equal(yardPictureKind(household({ house: { ...fed, level: 4 }, members: miller })), "miller");
  assert.equal(yardPictureKind(household({ house: { ...fed, level: YARD_RULES.prosperousMinLevel } })), "prosperous");
  for (const level of [0, 1, 2]) assert.equal(yardPictureKind(household({ house: { ...fed, level } })), "strained", `level ${level}`);
  // The shared 1 x 1 prop: only the rain barrel in hardship and in winter.
  for (const kind of ["winter", "vacant", "hungry"] as const) assert.equal(yardSharedKey("house-1-1-0", kind), "yard_rain_barrel");
  const shared = new Set(Array.from({ length: 40 }, (_, index) => yardSharedKey(`house-${index}`, "prosperous")));
  assert.deepEqual([...shared].sort(), YARD_SHARED_KINDS.map(kind => `yard_${kind}`).sort());
});

test("Given a household id When its A / B is picked twice, and across ids Then it is the same each time and both variants occur", () => {
  const ids = Array.from({ length: 30 }, (_, index) => `construction-site-${String(index).padStart(6, "0")}`);
  for (const id of ids) for (const kind of ["miller", "prosperous", "winter"] as const) {
    assert.equal(yardVariant(id, kind), yardVariant(id, kind));
    assert.equal(yardKey(id, kind), `yard_${kind}_${yardVariant(id, kind)}`);
  }
  assert.deepEqual(new Set(ids.map(id => yardVariant(id, "prosperous"))), new Set(["a", "b"]));
  for (const name of TOWNS) {
    const state = inSeason(load(name), 1);
    assert.deepEqual(backyardDecals(structuredClone(state) as GameState), backyardDecals(state), `${name}: a copy gives the same yards`);
  }
});

test("Given a town in winter and in summer When its yards are chosen Then every winter yard is the snow picture (or the rain barrel), none in summer", () => {
  for (const name of TOWNS) {
    const winter = backyardDecals(inSeason(load(name), 3));
    const summer = backyardDecals(inSeason(load(name), 1));
    assert.ok(winter.length > 0, name);
    for (const decal of winter) assert.ok(decal.key.startsWith("yard_winter_") || decal.key === "yard_rain_barrel", `${name}: ${decal.key}`);
    assert.ok(summer.every(decal => !decal.key.startsWith("yard_winter_")), name);
  }
});

test("Given the zoom When yards would be drawn Then they show from IN7-D1's 0.8 (the cart loads' rule) and not below", () => {
  assert.equal(YARD_DECAL_MIN_ZOOM, CART_LOAD_MIN_ZOOM);
  assert.equal(YARD_DECAL_MIN_ZOOM, 0.8);
  assert.equal(yardDecalsDrawnAt(0.79), false);
  assert.equal(yardDecalsDrawnAt(0.8), true);
  assert.equal(yardDecalsDrawnAt(1.4), true);
  // With pictures loaded (a stand-in Image), zoom 0.7 draws nothing and zoom 1 draws each yard in view, clipped.
  const restore = (globalThis as { Image?: unknown }).Image;
  (globalThis as { Image?: unknown }).Image = class { onload: (() => void) | null = null; naturalWidth = 256; naturalHeight = 128;
    set src(_url: string) { queueMicrotask(() => this.onload?.()); } };
  try {
    const state = inSeason(load("palisade-construction"), 1);
    const range = { minTx: 0, minTy: 0, maxTx: state.width - 1, maxTy: state.height - 1 };
    const calls: string[] = [];
    const context = { save: () => calls.push("save"), restore: () => calls.push("restore"), beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      closePath: () => {}, clip: () => calls.push("clip"), translate: () => {}, scale: () => calls.push("mirror"), drawImage: () => calls.push("drawImage"),
      getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), imageSmoothingEnabled: false } as unknown as CanvasRenderingContext2D;
    drawBackyardDecals(context, state, range, 1);
    return Promise.resolve().then(() => {
      calls.length = 0;
      drawBackyardDecals(context, state, range, 0.7);
      assert.deepEqual(calls, []);
      drawBackyardDecals(context, state, range, 1);
      const yards = backyardPlan(state);
      assert.equal(calls.filter(call => call === "drawImage").length, yards.length);
      assert.equal(calls.filter(call => call === "clip").length, yards.length);
    }).finally(() => { (globalThis as { Image?: unknown }).Image = restore; });
  } catch (error) {
    (globalThis as { Image?: unknown }).Image = restore;
    throw error;
  }
});

/** A new-game map with one house at (12, 11) on open grass, and road or buildings on the given cells. */
function plot(roads: readonly [number, number][], blocks: readonly [number, number][] = []): { state: GameState; id: string } {
  const base = load("new-game");
  const template = base.buildings.find(building => building.kind === "house")!;
  const id = "house-test-yard";
  const house: Building = { ...template, id, tx: 12, ty: 11 };
  const wells: Building[] = blocks.map(([tx, ty], index) => ({ ...template, id: `well-test-${index}`, kind: "well", tx, ty }));
  const owner = new Map<number, string>([[11 * base.width + 12, id], ...wells.map(well => [well.ty * base.width + well.tx, well.id] as const)]);
  const road = new Set(roads.map(([tx, ty]) => ty * base.width + tx));
  const tiles = base.tiles.map((tile, index) => ({ ...tile, buildingId: owner.get(index) ?? tile.buildingId, hasRoad: road.has(index) || tile.hasRoad }));
  const record: House = { ...base.houses[0]!, buildingId: id, level: 3, residents: 4 };
  return { state: { ...base, tiles, buildings: [...base.buildings, house, ...wells], houses: [...base.houses, record], zones: [] } as GameState, id };
}
const line = (from: number, to: number, at: (index: number) => [number, number]) => Array.from({ length: to - from + 1 }, (_, index) => at(from + index));

test("Given a house with its road on one side When its yard is laid out Then the picture stands on two cells on the far side, along the road", () => {
  const south = plot(line(8, 16, tx => [tx, 12]));
  const yard = backyardLayout(south.state).find(layout => layout.buildingId === south.id)!;
  assert.equal(yard.cells.length, 2);
  assert.ok(yard.cells.every(cell => cell.ty === 10), "behind the house, away from the road at ty 12");
  assert.ok(yard.cells.some(cell => cell.tx === 12), "one cell directly behind");
  assert.equal(Math.abs(yard.cells[0]!.tx - yard.cells[1]!.tx), 1);
  assert.equal(backyardDecals(inSeason(south.state, 1)).find(decal => decal.buildingId === south.id)!.mirror, false, "a pair along x takes the picture as painted");
  const west = plot(line(8, 14, ty => [11, ty]));
  const across = backyardDecals(inSeason(west.state, 1)).find(decal => decal.buildingId === west.id)!;
  assert.ok(across.cells.every(cell => cell.tx === 13), "road at tx 11: the yard at tx 13");
  assert.equal(across.mirror, true, "a pair along y is mirrored");
  // The back blocked (a well behind): a side without road access takes it; nothing free: no yard.
  const blocked = plot(line(8, 16, tx => [tx, 12]), [[12, 10]]);
  const side = backyardLayout(blocked.state).find(layout => layout.buildingId === blocked.id)!;
  assert.ok(side.cells.every(cell => cell.tx === 13) && side.cells.length === 2, JSON.stringify(side.cells));
  const boxed = plot([...line(8, 16, tx => [tx, 12]), ...line(8, 16, tx => [tx, 10]), [11, 11], [13, 11]]);
  assert.equal(backyardLayout(boxed.state).find(layout => layout.buildingId === boxed.id), undefined);
  // One free back cell and no free neighbour along the road: the 1 x 1 shared prop there.
  const narrow = plot(line(8, 16, tx => [tx, 12]), [[11, 10], [13, 10], [11, 11], [13, 11]]);
  const single = backyardDecals(inSeason(narrow.state, 1)).find(decal => decal.buildingId === narrow.id)!;
  assert.deepEqual(single.cells, [{ tx: 12, ty: 10 }]);
  assert.equal(WAVE27_YARD_IMAGES[single.key].category, "common");
});

test("Given the fixture towns When their yards are laid out Then no yard cell is a road, building, water or field cell, and no two yards share one", () => {
  for (const name of TOWNS) {
    const state = inSeason(load(name), 1);
    const fields = new Set((state.zones ?? []).filter(zone => zone.kind !== "burgage").flatMap(zone => zone.membership));
    const seen = new Set<number>();
    for (const decal of backyardDecals(state)) {
      for (const cell of decal.cells) {
        const index = cell.ty * state.width + cell.tx;
        const tile = state.tiles[index]!;
        assert.ok(!tile.hasRoad && tile.buildingId === null && tile.terrain !== "water" && !fields.has(index), `${name} ${decal.id} ${cell.tx},${cell.ty}`);
        assert.ok(!seen.has(index), `${name}: ${cell.tx},${cell.ty} twice`);
        seen.add(index);
      }
      for (const cell of decal.spill) assert.ok(!state.tiles[cell.ty * state.width + cell.tx]!.hasRoad, `${name}: spill on a road`);
      assert.equal(yardClipPolygons(decal.cells, decal.spill).length, decal.cells.length + decal.spill.length);
      const rect = yardDecalRect(decal);
      if (decal.cells.length === 2) assert.equal(rect.width, 256 * YARD_SCALE);
    }
  }
});

test("Given a household that moved in When its history holds the record Then its yard is the newcomer's for one season, and the plan cache follows it", () => {
  const { state, id } = plot(line(8, 16, tx => [tx, 12]));
  const summer = inSeason(state, 1);
  const history = { records: [{ id: "h-000001", tick: summer.tick - 10, kind: "person", template: "person.move_in", subject: { type: "household", id },
    severity: 0, place: { tx: 12, ty: 11, buildingId: id } }], snapshots: [], nextOrdinal: 2 } as unknown as NonNullable<GameState["history"]>;
  const moved = { ...summer, history };
  assert.equal(yardMoveIns(moved).get(id), summer.tick - 10);
  const key = (at: GameState) => backyardPlan(at).find(decal => decal.buildingId === id)!.key;
  assert.match(key(moved), /^yard_newcomer_/);
  assert.equal(backyardPlan(moved), backyardPlan(moved), "cached");
  assert.match(key({ ...moved, tick: summer.tick - 10 + YARD_RULES.newcomerTicks }), /^yard_prosperous_/, "the season is out: the cache lets go");
  // Measured for the cache comment: the uncached town against a cached call.
  const town = inSeason(load("palisade-construction"), 1);
  const started = performance.now();
  for (let round = 0; round < 20; round += 1) backyardDecals(town, backyardLayout(town));
  const uncached = (performance.now() - started) / 20;
  backyardPlan(town);
  const again = performance.now();
  for (let round = 0; round < 1_000; round += 1) backyardPlan(town);
  console.log(`backyard plan, palisade-construction (${town.buildings.filter(building => building.kind === "house").length} houses): uncached ${uncached.toFixed(3)} ms, cached ${((performance.now() - again) / 1_000).toFixed(4)} ms`);
});
