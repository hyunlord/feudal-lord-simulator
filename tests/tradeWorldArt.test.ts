import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Walker } from "../src/agents/walker.types";
import { tradeWorldGroundProps } from "../src/render/tradeWorldGround";
import catalog from "../src/render/art/catalog.json";
import { createArtRegistry } from "../src/render/art/artRegistry";
import { decodeSave } from "../src/save/saveCodec";
import type { GameState } from "../src/engine/engine.types";
import { initialAgency } from "../src/engine/townAgency";
import { buildingFootprint } from "../src/geometry/buildingFootprint";
import { withTradeWorldProps } from "../src/render/tradeWorldDraw";
import { sortRenderItems } from "../src/render/objectRenderSort";
import type { RenderQueueItem } from "../src/render/objectRenderTypes";
import { depthKey } from "../src/render/iso";
import {
  RB_TRADE_BREAD_IDS,
  RB_TRADE_FIRST_BATCH_TARGET_COUNT,
  RB_TRADE_GROUND_TARGET_COUNT,
  RB_TRADE_REVIEW_TARGET_COUNT,
  tradeWorldCatalogSummary,
  tradeWorldHeldCargoForWalker,
  tradeWorldEntries,
} from "../src/render/tradeWorldArt";

const load = (name: string): GameState => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v47/${name}.save.json`))).envelope.state as GameState;
const lord = (state: GameState): GameState => ({ ...state, agency: initialAgency() });

test("Given the RB-TRADE catalog When it is loaded Then it registers the connected 72 target and not the deferred cargo", () => {
  const summary = tradeWorldCatalogSummary();
  assert.deepEqual(summary, { ground: 68, bread: 4, reviewPool: 94, firstBatchTarget: 72, activeEntries: 72 });
  assert.equal(RB_TRADE_GROUND_TARGET_COUNT, 68);
  assert.equal(RB_TRADE_FIRST_BATCH_TARGET_COUNT, 72);
  assert.equal(RB_TRADE_REVIEW_TARGET_COUNT, 94);
  assert.deepEqual(RB_TRADE_BREAD_IDS, ["cargo_bread_basket_NE", "cargo_bread_basket_SE", "cargo_bread_basket_SW", "cargo_bread_basket_NW"]);
  assert.doesNotThrow(() => createArtRegistry(catalog));
  assert.equal(tradeWorldEntries.some(entry => entry.id === "cargo_timber_short_bundle_NE"), false);
  assert.equal(tradeWorldEntries.some(entry => entry.id === "front_carrier_a"), false);
});

test("Given current trade households When ground props are planned Then front, yard and street consumers use real trade facts and placement guards", () => {
  const state = lord(load("chapter-four-town"));
  const props = tradeWorldGroundProps(state);
  assert.equal(props.length, 0, "legacy save has no actual TradeState households; do not invent them");
  assert.equal(props.some(prop => prop.assetId === "front_carrier_a" || prop.assetId === "front_carrier_b"), false);
  assert.equal(props.some(prop => prop.assetId.includes("water_power") || prop.assetId.includes("waterside")), false, "water assets need a proven water condition fixture");
  for (const prop of props) {
    const tile = state.tiles[prop.cell.ty * state.width + prop.cell.tx];
    assert.ok(tile !== undefined && tile.buildingId === null && !tile.hasRoad && tile.terrain !== "water" && tile.terrain !== "rock", prop.id);
  }
});

test("Given bread and cart walkers When held cargo is selected Then only actual non-cart bread cargo gets a grip asset", () => {
  const distributor = {
    id: "bread-runner",
    kind: "distributor",
    homeBuildingId: "home",
    position: { tx: 1, ty: 1 },
    path: [{ tx: 2, ty: 1 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "bread", amount: 3 },
    spawnedTick: 0,
    phase: "roaming",
    junctionVisits: 0,
    tilesTravelled: 0,
    priorTile: null,
  } satisfies Walker;
  const empty = { ...distributor, cargo: { resource: "bread", amount: 0 } } satisfies Walker;
  const cart = {
    ...distributor,
    kind: "carter",
    mission: "deliver",
    phase: "outbound",
    destination: { kind: "building", buildingId: "granary" },
    reservation: { destination: { kind: "building", buildingId: "granary" }, resource: "bread", amount: 3, sourceStockClaim: null, homeCapacityClaim: null },
    cancellation: null,
  } satisfies Walker;
  const held = tradeWorldHeldCargoForWalker(distributor);
  assert.equal(held?.assetId, "cargo_bread_basket_SE");
  assert.equal(tradeWorldHeldCargoForWalker(empty), null);
  assert.equal(tradeWorldHeldCargoForWalker(cart), null);
});

test("Given the runtime files When the catalog is checked Then every active RB-TRADE source and runtime byte is present", () => {
  assert.equal(tradeWorldEntries.length, 72);
  for (const entry of tradeWorldEntries) {
    assert.equal(createHash("sha256").update(readFileSync(entry.provenance.inboxFile)).digest("hex"), entry.provenance.sourceSha256, entry.id);
    assert.equal(createHash("sha256").update(readFileSync(`public/${entry.image.url}`)).digest("hex"), entry.provenance.runtimeSha256, entry.id);
  }
});

// Deliberately synthetic sparse spatial unit. It is never exported as a naturally evolved scene.
function spatialUnit(tradeId: 'tailor' | 'cooper' | 'shoemaker' | 'fuller'): GameState {
  const state = lord(load('chapter-four-town'));
  const house = state.houses[0];
  const building = state.buildings.find(item => item.id === house?.buildingId);
  assert.ok(house !== undefined && building !== undefined);
  const owner = { ...building, tx: 10, ty: 10 };
  const { abandonedTick: _abandoned, burntTick: _burnt, ...occupied } = house;
  const { persons: _persons, ...withoutPersons } = state;
  return { ...withoutPersons, tick: 1500, buildings: [owner], houses: [{ ...occupied, residents: 4 }], walkers: [], palisade: null,
    constructionSites: [], forestHarvests: [], zones: [],
    tiles: state.tiles.map(tile => ({ ...tile, terrain: 'grass', buildingId: tile.tx === 10 && tile.ty === 10 ? owner.id : null,
      hasRoad: tile.tx === 10 && tile.ty === 11 })),
    trades: { households: [{ houseId: owner.id, tradeId, workshop: tradeId === 'fuller' ? 'water_mill' : tradeId === 'cooper' ? 'big_yard' : 'front_shop',
      sinceTick: 0, productivityPermille: 1000, idleSeasons: 0, receipt: { tick: 0, reasons: [], score: 1, chancePermille: 1000, of: 1 } }],
      streets: [{ tradeId, houseIds: [owner.id], namedTick: 0 }], stock: {}, chains: {}, haulage: { season: 0, last: 0 }, quits: [] },
  };
}

test('synthetic spatial unit preserves household meanings and selects all three consumers where free space exists', () => {
  const tailor = tradeWorldGroundProps(spatialUnit('tailor'));
  const cooper = tradeWorldGroundProps(spatialUnit('cooper'));
  const shoemaker = tradeWorldGroundProps(spatialUnit('shoemaker'));
  assert.ok(tailor.some(prop => prop.consumer === 'front'));
  assert.ok(cooper.some(prop => prop.consumer === 'street'));
  assert.ok(cooper.some(prop => prop.consumer === 'yard'));
  for (const prop of shoemaker.filter(prop => prop.assetId.startsWith('front_shoemaker'))) assert.ok(prop.y < 10);
  assert.equal(tradeWorldGroundProps(spatialUnit('fuller')).some(prop => prop.assetId.includes('water') || prop.assetId.startsWith('front_fuller')), false);
});

test('ground consumers recompute from changed trade facts even when the static world queue is cached', async () => {
  const { objectRenderItemsForFrame } = await import('../src/render/renderObjectFrameCache');
  const state = spatialUnit('cooper');
  const range = { minTx: 0, minTy: 0, maxTx: state.width - 1, maxTy: state.height - 1 };
  const first = objectRenderItemsForFrame({ state, visibleTiles: state.tiles, range, includeGroundCover: false });
  assert.ok(first.some(item => item.kind === 'trade_prop'));
  const without = { ...state, trades: { ...state.trades, households: [], streets: [], stock: {}, chains: {}, haulage: { season: 0, last: 0 }, quits: [] } } satisfies GameState;
  const second = objectRenderItemsForFrame({ state: without, visibleTiles: state.tiles, range, includeGroundCover: false });
  assert.equal(second.some(item => item.kind === 'trade_prop'), false);
  const restored = objectRenderItemsForFrame({ state, visibleTiles: state.tiles, range, includeGroundCover: false });
  assert.deepEqual(restored.filter(item => item.kind === 'trade_prop'), first.filter(item => item.kind === 'trade_prop'));
});

test('spatial rejection omits props instead of painting onto a road, occupied cell, or another prop', () => {
  const state = spatialUnit('cooper');
  const props = tradeWorldGroundProps(state);
  assert.ok(props.length > 0);
  const blocked = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: tile.buildingId === null })) };
  assert.equal(tradeWorldGroundProps(blocked).length, 0);
  const cells = props.flatMap(prop => prop.cells.map(cell => `${cell.tx},${cell.ty}`));
  assert.equal(new Set(cells).size, cells.length);
  assert.equal(tradeWorldGroundProps({ ...state, trades: { ...state.trades, households: [], streets: [], stock: {}, chains: {}, haulage: { season: 0, last: 0 }, quits: [] } }).length, 0);
});

test('unaltered saved bread payloads select four authored directions without inventing lord-mode or trade membership', () => {
  const state = load('chapter-four-town');
  const ids = new Set(state.walkers.flatMap(walker => {
    const held = tradeWorldHeldCargoForWalker(walker);
    return held === null ? [] : [held.assetId];
  }));
  assert.deepEqual([...ids].sort(), [...RB_TRADE_BREAD_IDS].sort());
});

test('Given a topologically ordered wall and building When trade props join Then existing object order is preserved', () => {
  const state = spatialUnit('cooper');
  const building = state.buildings[0];
  assert.ok(building !== undefined);
  const { width, height } = buildingFootprint(building);
  const queue = sortRenderItems<RenderQueueItem>([
    { kind: 'building', id: 'existing-building', building, depth: 20, anchorTx: 10 },
    { kind: 'palisade_segment', id: 'existing-wall', depth: 19, anchorTx: 10, gate: null,
      segment: { id: 'front-wall', order: 0, tileCount: width, completed: true, constructionSiteId: null,
        edgePath: [{ x: building.tx, y: building.ty + height }, { x: building.tx + width, y: building.ty + height }] } },
  ]);
  assert.deepEqual(queue.map(item => item.id), ['existing-building', 'existing-wall']);
  const range = { minTx: 0, minTy: 0, maxTx: state.width - 1, maxTy: state.height - 1 };
  const merged = withTradeWorldProps(queue, state, range);
  assert.ok(merged.some(item => item.kind === 'trade_prop'));
  assert.deepEqual(merged.filter(item => item.kind !== 'trade_prop'), queue);
});

test('Given equal depth and anchor When trade props join Then the shared vertical tie breaker precedes ids', () => {
  const state = spatialUnit('cooper');
  const prop = tradeWorldGroundProps(state)[0];
  const building = state.buildings[0];
  assert.ok(prop !== undefined && building !== undefined);
  const existing: RenderQueueItem = { kind: 'building', id: 'zz-existing',
    building: { ...building, ty: prop.y - 1 }, depth: depthKey(prop.x, prop.y), anchorTx: prop.x };
  const range = { minTx: 0, minTy: 0, maxTx: state.width - 1, maxTy: state.height - 1 };
  const merged = withTradeWorldProps([existing], state, range);
  const propIndex = merged.findIndex(item => item.id === prop.id);
  assert.ok(propIndex >= 0);
  assert.ok(merged.indexOf(existing) < propIndex);
});
