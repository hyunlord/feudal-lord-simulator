import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, FEN_ARCHETYPE_ID, RIVERSIDE_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import type { DrainageWork } from "../src/engine/drainage";
import type { GameState } from "../src/engine/engine.types";
import { drawWaterMotion, liveReeds, waterChunkToken, waterMapFor } from "../src/render/drawWaterMotion";
import type { GroundChunkPlan } from "../src/render/groundBoundaryScene";
import { landWorksWaterCells } from "../src/render/landWorksDraw";
import { setWaterArtForTest } from "../src/render/waterMotionArt";
import { RACE_MIRROR, landWaterEffects, landWaterPlan, waterMotionPlan } from "../src/render/waterMotionModel";
import { KIND, analyseWater, chunkWater } from "../src/render/waterMotionPlacement";
import { fordRoadCells, millRaceCells, riverFlowCells, screenFlow } from "../src/render/waterRiverFlow";
import type { Wave29WaterKey } from "../src/render/wave29WaterManifest.generated";
import { newGameState } from "../src/state/newGame";
import { shoreline } from "../src/world/boundary/shoreline";
import { canPlaceBuildingBeforeRoad, PlacementFailure } from "../src/world/placement";
import { isFlowingWater } from "../src/world/river";
import { recordingCanvas } from "../scripts/recordingCanvas";

// LAND-UI water: the current arrows follow the engine's river (MA-9), the shape guess stays for saves without one, the
// four new lands draw only their ground.water effects (LU-D2), ford roads carry no flow (FD-1), and a fulling mill's
// ring of flowing water runs as a mill race (MA-10) — drawn only when such a mill is in view.
const land = (archetypeId: string, seed = 1): GameState => {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed });
  assert.ok(state !== null, archetypeId);
  return state;
};

function building(kind: BuildingKind, tx: number, ty: number): Building {
  return { id: `test-${kind}-${tx}-${ty}`, kind, tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

/** The first legal fulling mill site (every rule; materials aside, which come after the water rules). */
function millSite(state: GameState): { readonly tx: number; readonly ty: number } {
  const late = { ...state, era: "stone_town" as const };
  for (let ty = 0; ty < state.height; ty += 1) for (let tx = 0; tx < state.width; tx += 1) {
    const result = canPlaceBuildingBeforeRoad(late, "fulling_mill", tx, ty);
    if (result.ok || result.reason === PlacementFailure.insufficient_materials) return { tx, ty };
  }
  throw new Error("no fulling mill site");
}

const ring = (origin: { readonly tx: number; readonly ty: number }, width: number, height: number): Set<number> => {
  const cells = new Set<number>();
  for (let ty = origin.ty - 1; ty <= origin.ty + height; ty += 1) for (let tx = origin.tx - 1; tx <= origin.tx + width; tx += 1) {
    if (tx >= origin.tx && tx < origin.tx + width && ty >= origin.ty && ty < origin.ty + height) continue;
    cells.add(ty * 64 + tx);
  }
  return cells;
};

test("Given the riverside and the fen When their water is analysed Then every river cell flows by river.flow through currentArrowKey, and other water is still", () => {
  // The sheet of each engine letter (the fixed SW view: +x screen south-east, +y south-west).
  assert.deepEqual(["e", "s", "w", "n", "x"].map(screenFlow), ["se", "sw", "nw", "ne", null]);
  for (const id of [RIVERSIDE_ARCHETYPE_ID, FEN_ARCHETYPE_ID]) {
    // Given
    const state = land(id);
    const river = state.river;
    assert.ok(river !== undefined && river.cells.length > 0, id);

    // When
    const { map } = waterMapFor(state);

    // Then
    let checked = 0;
    river.cells.forEach((index, at) => {
      if (state.tiles[index]?.terrain !== "water") return;
      assert.equal(map.kind[index], KIND.river, `${id} ${index}`);
      assert.equal(map.flow[index], screenFlow(river.flow[at] ?? ""), `${id} ${index}`);
      checked += 1;
    });
    assert.ok(checked > 100, `${id}: ${checked} river cells`);
    const cells = new Set(river.cells);
    const still = state.tiles.filter((tile, index) => tile.terrain === "water" && !cells.has(index));
    for (const tile of still) assert.notEqual(map.kind[tile.ty * state.width + tile.tx], KIND.river, `${id} still water at ${tile.tx},${tile.ty}`);
    // The chunks' arrows are the river's: every listed flow tile in a chunk has that flow in the map.
    const chunk = chunkWater(map, state.tiles, state.seed, Math.floor((river.cells[0]! % 64) / 8), Math.floor(river.cells[0]! / 64 / 8));
    for (const direction of ["ne", "nw", "se", "sw"] as const) for (const tile of chunk.flow[direction]) assert.equal(map.flow[tile.ty * 64 + tile.tx], direction);
  }
});

test("Given a state without a river (a save v31 or older) When its water is analysed Then the shape guess is kept exactly", () => {
  // Given
  const { river: _river, ...withRiver } = land(RIVERSIDE_ARCHETYPE_ID);
  const old = withRiver as GameState;

  // When
  const { map } = waterMapFor(old);
  const guessed = analyseWater(old.tiles, old.width, old.height);

  // Then
  assert.equal(riverFlowCells(old), null);
  assert.deepEqual([...map.kind], [...guessed.kind]);
  assert.deepEqual(map.flow, guessed.flow);
});

test("Given each land When the water plan is made Then the riverside keeps every effect and the four new lands draw only their ground.water list", () => {
  const plan = waterMotionPlan(1, "normal", 1);
  const on = (id: string) => landWaterPlan(plan, landWaterEffects(land(id)));
  // The riverside: the plan as before (LU-D2), even its lakes' foam and reeds.
  assert.equal(landWaterEffects(land(RIVERSIDE_ARCHETYPE_ID)), null);
  assert.equal(landWaterEffects({ scenarioId: DEFAULT_SCENARIO_ID } as GameState), null, "no archetypeId: the scenario's riverside");
  assert.deepEqual(on(RIVERSIDE_ARCHETYPE_ID), plan);
  // The coast: shore foam, no reeds, no shallow ripples.
  assert.deepEqual(on(COASTAL_ARCHETYPE_ID), { deepRipples: true, shallowRipples: false, flow: true, foam: true, reeds: false, glints: true, fish: true });
  // The downs: no fish rings, no foam.
  assert.deepEqual(on(DOWNS_ARCHETYPE_ID), { deepRipples: true, shallowRipples: false, flow: true, foam: false, reeds: false, glints: true, fish: false });
  assert.deepEqual(on(WOODLAND_ARCHETYPE_ID), { deepRipples: true, shallowRipples: false, flow: true, foam: false, reeds: false, glints: true, fish: true });
  // The fen: reed sway and shallow ripples; its meres' deep water lies still, no glints.
  assert.deepEqual(on(FEN_ARCHETYPE_ID), { deepRipples: false, shallowRipples: true, flow: true, foam: false, reeds: true, glints: false, fish: true });
  // Block detail stays off everywhere.
  assert.deepEqual(Object.values(landWaterPlan(waterMotionPlan(0.35, "normal", 1), landWaterEffects(land(FEN_ARCHETYPE_ID)))).some(Boolean), false);
  // The live reeds (and the chunks' token, which leaves the static reeds out) follow the land when it is given.
  setWaterArtForTest(key => ({ label: key }) as unknown as CanvasImageSource);
  try {
    assert.deepEqual([liveReeds(1), liveReeds(1, land(RIVERSIDE_ARCHETYPE_ID)), liveReeds(1, land(FEN_ARCHETYPE_ID)), liveReeds(1, land(COASTAL_ARCHETYPE_ID))], [true, true, true, false]);
    assert.deepEqual([waterChunkToken(1, land(FEN_ARCHETYPE_ID)), waterChunkToken(1, land(DOWNS_ARCHETYPE_ID))], [":i1:r1", ":i1:r0"]);
  } finally { setWaterArtForTest(null); }
});

test("Given ford cells with a road When the water is analysed Then the ford roads and their banks carry no flow, and the bare ford cells still do", () => {
  // Given: the coast's brook (FD-3: fords on brooks only) with a road over every ford cell.
  const coast = land(COASTAL_ARCHETYPE_ID);
  const fords = coast.river?.fords ?? [];
  assert.ok(fords.length > 0);
  const bare = waterMapFor(coast).map;
  assert.ok(fords.every(index => bare.flow[index] !== null), "a bare ford cell is plain flowing water");
  const roads = new Set(fords);
  const forded = { ...coast, tiles: coast.tiles.map((tile, index) => roads.has(index) ? { ...tile, hasRoad: true } : tile) };

  // When
  const { map } = waterMapFor(forded);

  // Then
  assert.deepEqual(fordRoadCells(forded), fords);
  for (const index of fords) {
    assert.equal(map.kind[index], KIND.river, "still river: its neighbours keep their classes");
    assert.equal(map.flow[index], null, `ford road ${index}`);
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) {
      const next = index + dy * 64 + dx;
      if (forded.tiles[next]?.terrain !== "water") assert.equal(map.flow[next], null, `bank ${next}`);
    }
  }
  assert.deepEqual([...map.kind], [...bare.kind]);
  for (let cy = 0; cy < 8; cy += 1) for (let cx = 0; cx < 8; cx += 1) {
    const chunk = chunkWater(map, forded.tiles, forded.seed, cx, cy);
    for (const direction of ["ne", "nw", "se", "sw"] as const) assert.ok(chunk.flow[direction].every(tile => !roads.has(tile.ty * 64 + tile.tx)));
  }
});

test("Given a fulling mill placed by the river When the race is laid Then its ring's flowing water runs as the race in the river's flow, out of the arrows; a dye works gets none", () => {
  for (const id of [RIVERSIDE_ARCHETYPE_ID, FEN_ARCHETYPE_ID]) {
    // Given: a legal fulling mill site (placement checks the same ring for flowing water).
    const state = land(id);
    const site = millSite(state);
    const milled = { ...state, buildings: [...state.buildings, building("fulling_mill", site.tx, site.ty)] };

    // When
    const entry = waterMapFor(milled);
    const flows = riverFlowCells(milled);

    // Then: every race cell lies in the ring; the ring's flowing water is all race, in the river's direction.
    const cells = ring(site, 2, 2);
    assert.ok(entry.race.size > 0, id);
    for (const [index, direction] of entry.race) {
      assert.ok(cells.has(index), `${id} race ${index} in the ring`);
      if (milled.tiles[index]?.terrain === "water") assert.equal(direction, flows?.get(index), `${id} race ${index}`);
      else assert.equal(direction, entry.map.flow[index], `${id} bank ${index}`);
    }
    for (const index of cells) if (isFlowingWater(milled, index)) assert.ok(entry.race.has(index), `${id} flowing ${index} raced`);
    // The arrows leave the race cells; the race lists hold them.
    for (let cy = 0; cy < 8; cy += 1) for (let cx = 0; cx < 8; cx += 1) {
      const chunk = chunkWater(entry.map, milled.tiles, milled.seed, cx, cy, entry.race);
      for (const direction of ["ne", "nw", "se", "sw"] as const) {
        assert.ok(chunk.flow[direction].every(tile => !entry.race.has(tile.ty * 64 + tile.tx)));
        assert.ok(chunk.race[direction].every(tile => entry.race.get(tile.ty * 64 + tile.tx) === direction));
      }
    }
    // A dye works on the same spot (still water will do for it) draws no race.
    const dyed = { ...state, buildings: [...state.buildings, building("dyehouse", site.tx, site.ty)] };
    assert.equal(millRaceCells(dyed, waterMapFor(dyed).map, new Set()).size, 0, `${id} dyehouse`);
  }
});

class RecordingPath { moveTo(): void {} lineTo(): void {} closePath(): void {} addPath(): void {} }

/** One frame of the whole map's water at zoom 1 (every chunk visible), with the art keys it asked for. */
function drawState(state: GameState): { readonly ops: readonly string[]; readonly asked: ReadonlySet<Wave29WaterKey> } {
  const asked = new Set<Wave29WaterKey>();
  setWaterArtForTest(key => { asked.add(key); return { label: key } as unknown as CanvasImageSource; }, (width, height) => {
    const canvas = { label: "", width, height };
    const cut = recordingCanvas(width, height).context;
    return { canvas: canvas as unknown as CanvasImageSource, context: new Proxy(cut, {
      get(target, key) { if (key === "drawImage") return (image: { label: string }) => { canvas.label = image.label; }; return Reflect.get(target, key); },
    }) };
  });
  const previous = (globalThis as { Path2D?: unknown }).Path2D;
  (globalThis as { Path2D?: unknown }).Path2D = RecordingPath;
  try {
    const shore = shoreline({ width: state.width, height: state.height, tiles: state.tiles, seed: state.seed, bridges: [] });
    const loops = shore.loops.map((_, index) => index);
    const chunks = Array.from({ length: 64 }, (_, at) => ({ cx: at % 8, cy: Math.floor(at / 8), waterLoops: loops, waterParity: false }) as unknown as GroundChunkPlan);
    // The whole 64 x 64 map in view (screen x -2,016..2,016, y 0..2,048).
    const { canvas, context } = recordingCanvas(4_400, 2_200);
    context.translate(2_200, 50);
    drawWaterMotion(context, { state, shore, chunks, range: { minTx: 0, minTy: 0, maxTx: 63, maxTy: 63 }, zoom: 1, chunkZoom: 1, nowMs: 1_234, weather: "normal", season: 1 });
    return { ops: canvas.ops, asked };
  } finally {
    (globalThis as { Path2D?: unknown }).Path2D = previous;
    setWaterArtForTest(null);
  }
}

test("Given the drawn water When a land and a fulling mill are on screen Then the land's sheets fill, and the race fills mirrored by its flow only with the mill there", () => {
  const filled = (ops: readonly string[], key: Wave29WaterKey) => ops.some(op => op.startsWith("set fillStyle(pattern") && op.endsWith(`:${key})`));
  // The riverside: deep ripples and arrows; no mill, no race art asked for (no cost).
  const riverside = drawState(land(RIVERSIDE_ARCHETYPE_ID));
  assert.ok(filled(riverside.ops, "ripple_sheet") && filled(riverside.ops, "current_arrows_se_sheet"));
  assert.equal(riverside.asked.has("mill_race_sheet"), false);
  // The fen: no deep ripples, shallow ripples and arrows.
  const fen = drawState(land(FEN_ARCHETYPE_ID));
  assert.deepEqual([filled(fen.ops, "ripple_sheet"), filled(fen.ops, "ripple_shallow_sheet"), filled(fen.ops, "current_arrows_se_sheet")], [false, true, true]);
  assert.equal(fen.ops.includes("set globalAlpha(0.4)"), false, "no glints on the fen");
  // A fulling mill: the race fills with its directions' mirrors, clipped with the arrows.
  const state = land(RIVERSIDE_ARCHETYPE_ID);
  const site = millSite(state);
  const milled = { ...state, buildings: [...state.buildings, building("fulling_mill", site.tx, site.ty)] };
  const race = waterMapFor(milled).race;
  const drawn = drawState(milled);
  assert.ok(filled(drawn.ops, "mill_race_sheet"));
  const at = drawn.ops.findIndex(op => op.endsWith(":mill_race_sheet)"));
  assert.ok(drawn.ops.slice(0, at).some(op => op.startsWith("clip(")), "inside the water clip");
  for (const direction of new Set(race.values())) {
    const mirror = RACE_MIRROR[direction];
    assert.ok(drawn.ops.includes(`pattern.setTransform(${0.5 * mirror.x},0,0,${0.5 * mirror.y},0,0)`), direction);
  }
});

test("Given land works on the water When the motion is laid Then no flow, ripple, glint, fish ring or live reed is on their cells (road fords, stage-3 drainage)", () => {
  // Given: a fen work over the still water round a reed clump, at stage 1 and at stage 3 (LU-D5: done >= 2/3).
  const fen = land(FEN_ARCHETYPE_ID);
  const shore = shoreline({ width: fen.width, height: fen.height, tiles: fen.tiles, seed: fen.seed, bridges: [] });
  const river = new Set(fen.river?.cells ?? []);
  const still = (index: number) => fen.tiles[index]?.terrain === "water" && !river.has(index);
  const clump = shore.loops.flatMap(loop => loop.decals).find(decal => decal.kind === "weed" && still(Math.round(decal.anchor.y) * 64 + Math.round(decal.anchor.x)));
  assert.ok(clump !== undefined);
  const centre = { tx: Math.round(clump.anchor.x), ty: Math.round(clump.anchor.y) };
  const cells = [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => (centre.ty + dy) * 64 + centre.tx + dx)).filter(still);
  const work = (done: number): DrainageWork => ({ id: "drainage-test", cells, startedTick: 0, timber: cells.length * 5, workNeeded: cells.length * 320, workDone: done * cells.length * 320 });
  const staked = { ...fen, drainage: { works: [work(0.1)], drained: [] } };
  const drying = { ...fen, drainage: { works: [work(0.9)], drained: [] } };
  const listed = (state: GameState) => {
    const entry = waterMapFor(state); const found = new Set<number>();
    for (let cy = 0; cy < 8; cy += 1) for (let cx = 0; cx < 8; cx += 1) {
      const chunk = chunkWater(entry.map, state.tiles, state.seed, cx, cy, entry.race, entry.masked);
      for (const tile of [...chunk.deep, ...chunk.shallow, ...Object.values(chunk.flow).flat()]) found.add(tile.ty * 64 + tile.tx);
      for (const spot of [...chunk.glints, ...chunk.fish]) found.add(Math.round((spot.y / 16 + spot.x / 32) / 2) + Math.round((spot.y / 16 - spot.x / 32) / 2) * 64);
    }
    return found;
  };

  // Then: stage 1 leaves the water moving; stage 3 masks every cell of the work.
  assert.equal(landWorksWaterCells(staked).size, 0);
  assert.deepEqual([...landWorksWaterCells(drying)].sort((a, b) => a - b), [...cells].sort((a, b) => a - b));
  assert.ok(cells.some(index => listed(staked).has(index)), "the stage-1 water is in the motion lists");
  const masked = listed(drying);
  assert.ok(cells.every(index => !masked.has(index)), "no stage-3 cell in any list");
  // The live reeds: the clump on the work draws at stage 1, not at stage 3.
  const reeds = (state: GameState) => drawState(state).ops.filter(op => op.startsWith("drawImage(reeds_sway")).length;
  assert.ok(reeds(drying) < reeds(staked), `${reeds(drying)} reeds at stage 3, ${reeds(staked)} at stage 1`);
  // A road ford: its group's cells are masked too (and carry no flow already, FD-1).
  const coast = land(COASTAL_ARCHETYPE_ID);
  const roads = new Set(coast.river?.fords ?? []);
  const forded = { ...coast, tiles: coast.tiles.map((tile, index) => roads.has(index) ? { ...tile, hasRoad: true } : tile) };
  const fordMask = waterMapFor(forded).masked;
  assert.ok(fordMask.size > 0 && [...fordMask].every(index => !listed(forded).has(index)));
});
