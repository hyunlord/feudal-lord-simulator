/**
 * LAND-UI (Wave 34): the fords that carry a road (LU-D3, LU-D4), the fen's drainage works by stage (LU-D5), the drain
 * tool (LU-D6) and the MA-10 refusal copy by what a building needs beside it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, FEN_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID } from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { drainagePlan, type DrainageRefusal, type DrainageWork } from "../src/engine/drainage";
import type { GameState } from "../src/engine/engine.types";
import { newGameState } from "../src/state/newGame";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { bridgeAt } from "../src/world/bridges";
import { PlacementFailure } from "../src/world/placement";
import { bridgeRailPieces } from "../src/render/drawBridges";
import { bridgeSpans } from "../src/render/groundSceneParts";
import {
  bridgeDeckAt, cellsBox, ditchRows, drainEdges, drainStage, fordGroups, plankBridges, regionSheet, workPlan,
} from "../src/render/landWorksModel";
import { chunkWorks, landWorksChunkToken, landWorksWaterCells } from "../src/render/landWorksIndex";
import { fordKey, stageKey, worksSeason } from "../src/render/wave34Art";
import { WAVE34_WORKS } from "../src/render/wave34WorksManifest.generated";
import { drainCancel, drainSelect, type DrainToolContext } from "../src/render/canvasDrainRuntime";
import { createCanvasMutableRefs } from "../src/render/canvasRuntimeRefs";
import { canvasCursorClass } from "../src/render/GameCanvas";
import { tileToScreen } from "../src/render/iso";
import { formatPlacementFailure } from "../src/render/placementFeedback";
import { buildingTileMarks } from "../src/render/placementTileMarks";
import { PLACEMENT_CHIP_COPY } from "../src/ui/placementChipCopy.ko";
import { DRAINAGE_COPY } from "../src/ui/drainageCopy.ko";
import { drainPreview, drainToolAvailable } from "../src/ui/drainToolModel";
import { roadPlacementPrediction } from "../src/ui/placementPrediction";
import { buildingCopy } from "../src/content/buildingCatalog.ko";
import type { GameAction } from "../src/state/gameStore.types";

const land = (archetypeId: string, seed: number): GameState => {
  const state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId, seed });
  assert.ok(state !== null, `${archetypeId} ${seed}`);
  return state;
};

/** A state with a road laid on every cell of a ford group and its two bank cells (the crossing, FD-1). */
function withFordRoad(state: GameState, cells: readonly number[], axis: "ne" | "nw"): GameState {
  const { width } = state;
  const step = axis === "nw" ? 1 : width;
  const road = new Set([...cells, cells[0]! - step, cells[cells.length - 1]! + step]);
  return { ...state, tiles: state.tiles.map((tile, index) => road.has(index) ? { ...tile, hasRoad: true } : tile) };
}

test("LU-D3/D4 ford groups on the coast, downs and forest edge (seeds 1-3): joined cells along one axis, 1 or 2 wide; none on the riverside and the fen", () => {
  for (const id of [COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID]) for (const seed of [1, 2, 3]) {
    const state = land(id, seed);
    const groups = fordGroups(state);
    assert.ok(groups.length > 0, `${id} ${seed} has fords`);
    assert.deepEqual(groups.flatMap(group => group.cells).sort((a, b) => a - b), [...state.river!.fords], "every ford cell in exactly one group");
    for (const group of groups) {
      const xs = group.cells.map(cell => cell % state.width), ys = group.cells.map(cell => Math.floor(cell / state.width));
      assert.ok(group.width === 1 || group.width === 2, `${id} ${seed}: width ${group.width}`);
      assert.equal(group.width, group.cells.length);
      if (group.width === 2) {
        // Two cells: the crossing runs along the axis they spread on (nw: along tx; ne: along ty).
        assert.equal(group.axis, xs[0] !== xs[1] ? "nw" : "ne");
        assert.ok(Math.abs(xs[0]! - xs[1]!) + Math.abs(ys[0]! - ys[1]!) === 1, "the two cells touch");
      } else {
        // One cell: from its flow — e / w crosses along ty (ne), n / s along tx (nw).
        const flow = state.river!.flow[state.river!.cells.indexOf(group.cells[0]!)];
        assert.equal(group.axis, flow === "e" || flow === "w" ? "ne" : "nw");
      }
      assert.deepEqual(group.centre, { tx: xs.reduce((a, b) => a + b, 0) / xs.length, ty: ys.reduce((a, b) => a + b, 0) / ys.length });
      assert.equal(group.road, false, "a new game has no road on its fords");
      // LU-D4: width 1 draws the w2 sheet; the sheet's axis is the group's.
      assert.equal(fordKey(group.width, group.axis, "summer"), `ford_w2_${group.axis}_summer`);
    }
  }
  assert.deepEqual(fordGroups(DEFAULT_GAME_STATE), []);
  for (const seed of [1, 2, 3]) assert.deepEqual(fordGroups(land(FEN_ARCHETYPE_ID, seed)), []);
});

test("LU-D3 a ford road draws no bridge (deck, rails, shore lock), carries its ford sheet, and keys only the chunks it reaches", () => {
  const coast = land(COASTAL_ARCHETYPE_ID, 1);
  const group = fordGroups(coast).find(entry => entry.width === 2)!;
  const roaded = withFordRoad(coast, group.cells, group.axis);
  const [first] = group.cells;
  const tile = { tx: first! % coast.width, ty: Math.floor(first! / coast.width) };
  assert.notEqual(bridgeAt(roaded, tile), null, "the engine still reads a straight span there");
  assert.equal(bridgeDeckAt(roaded, tile), null, "but the render draws no deck");
  assert.deepEqual(bridgeRailPieces(roaded, roaded.tiles.filter(entry => entry.hasRoad)), [], "no rails");
  assert.deepEqual(bridgeSpans(roaded, roaded.tiles), [], "no span for the shoreline's bridge lock");
  const groups = fordGroups(roaded);
  assert.equal(groups.find(entry => entry.cells[0] === first)?.road, true);
  assert.equal(groups.filter(entry => entry.road).length, 1, "only the roaded group");
  // The chunk holding the ford gets a key part; a chunk far off keeps "" (and so does every riverside chunk).
  const cx = Math.floor(group.centre.tx / 8), cy = Math.floor(group.centre.ty / 8);
  assert.match(landWorksChunkToken(roaded, { cx, cy }), new RegExp(`^:lw[01]f${first}${group.axis}$`));
  assert.equal(landWorksChunkToken(roaded, { cx: cx + 3, cy: cy + 3 }), "");
  assert.equal(landWorksChunkToken(coast, { cx, cy }), "", "a bare ford stays plain water");
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) assert.equal(landWorksChunkToken(DEFAULT_GAME_STATE, { cx: x, cy: y }), "");
  assert.deepEqual([...landWorksWaterCells(roaded)].sort((a, b) => a - b), [...group.cells]);
  assert.ok(chunkWorks(roaded, cx, cy).keys.includes(fordKey(2, group.axis, "winter")), "both seasons' art keyed");
});

test("FD-1 the road prediction counts a ford's cells at a timber each, not as a bridge", () => {
  const coast = land(COASTAL_ARCHETYPE_ID, 1);
  const group = fordGroups(coast).find(entry => entry.width === 2)!;
  const step = group.axis === "nw" ? 1 : coast.width;
  const cells = [group.cells[0]! - step, ...group.cells, group.cells[1]! + step];
  const path = cells.map(cell => ({ tx: cell % coast.width, ty: Math.floor(cell / coast.width) }));
  const prediction = roadPlacementPrediction(coast, path);
  assert.deepEqual(prediction.roadSegments.map(segment => segment.kind), ["land", "ford", "ford", "land"]);
  assert.match(prediction.lines.at(-1)?.text ?? "", /육지 2칸 무료 · 다리 0칸 × 목재 4 · 여울 2칸 × 목재 1 = 2/);
});

const work = (cells: readonly number[], workDone: number, diggers?: number): DrainageWork => ({
  id: `drainage-0-${cells[0]}`, cells, startedTick: 0, timber: cells.length * 5, workNeeded: cells.length * 320, workDone, ...(diggers === undefined ? {} : { diggers }),
});
const square = (width: number, tx: number, ty: number, size: number) =>
  Array.from({ length: size * size }, (_, index) => (ty + Math.floor(index / size)) * width + tx + index % size);

test("LU-D5 drainage stages by progress, the region sheet by the cells' box, stakes on the perimeter, two ditch rows", () => {
  assert.deepEqual([0, 0.32, 1 / 3, 0.66, 2 / 3, 0.99].map(done => drainStage({ workDone: done * 300, workNeeded: 300 })), [1, 1, 2, 2, 3, 3]);
  const width = 64;
  const full = square(width, 10, 10, 5);
  const box = cellsBox(full, width);
  assert.deepEqual(box, { minTx: 10, maxTx: 14, minTy: 10, maxTy: 14 });
  assert.equal(regionSheet(box), "5x5");
  assert.equal(regionSheet(cellsBox(square(width, 10, 10, 3), width)), "3x3");
  assert.equal(regionSheet(cellsBox([10 * width + 10, 10 * width + 11, 10 * width + 12, 10 * width + 13], width)), "5x5", "a 4 x 1 box takes the 5 x 5 sheet");
  assert.deepEqual(ditchRows(box), [11, 13]);
  assert.deepEqual(ditchRows(cellsBox(square(width, 10, 10, 3), width)), [11]);
  const state = { ...DEFAULT_GAME_STATE };
  const plan = workPlan(state, work(full, 0, 4));
  assert.equal(new Set(plan.stakes.map(stake => stake.cell)).size, 16, "the 16 perimeter cells of a 5 x 5");
  assert.equal(plan.stakes.length, 20, "the four corners stake both ways");
  assert.equal(plan.stakes.filter(stake => stake.along === "ty").length, 10, "the two tx sides run their stakes along ty");
  assert.deepEqual(plan.ditches, full.filter(cell => [11, 13].includes(Math.floor(cell / width))));
  assert.equal(plan.digging, true);
  assert.deepEqual(plan.cells, full, "stage 3 clips to the work's own cells");
  // An irregular patch (an L) clips to its cells, whatever its box's sheet.
  const ell = [...square(width, 20, 20, 2), 22 * width + 20, 23 * width + 20];
  const ellPlan = workPlan(state, work(ell, 300 * 6));
  assert.equal(ellPlan.stage, 3);
  assert.equal(ellPlan.region, "5x5");
  assert.deepEqual(ellPlan.cells, ell);
  assert.equal(stageKey(3, ellPlan.region, worksSeason(3)), "drain_stage3_drying_winter_5x5");
  assert.equal(stageKey(1, "3x3", worksSeason(0)), "drain_stage1_staked_summer", "LU-D1: spring uses summer");
  assert.equal(worksSeason(2), "summer", "LU-D1: autumn uses summer");
  for (const key of ["drain_stage3_drying_summer_5x5", "drain_stage3_drying_summer_3x3"] as const) assert.equal(WAVE34_WORKS[key].repeat, "region");
  // The region sheet's pivot lands on the box centre: the 5 x 5 sheet at 0.5 spans the box's five tiles.
  const centre = tileToScreen(12, 12), corner = tileToScreen(9.5, 9.5);
  assert.equal(centre.sy - corner.sy, WAVE34_WORKS.drain_stage3_drying_summer_5x5.pivot.y * 0.5);
});

test("LU-D5 the drained set's edge and its plank bridge; the chunk key moves with the stage and the drained count", () => {
  const width = 64;
  const patch = square(width, 30, 30, 3);
  assert.equal(drainEdges(patch, width, 64).length, 12, "a 3 x 3 patch has 12 outer edges");
  assert.deepEqual(plankBridges(patch, width), [{ tx: 31, ty: 30 }], "the middle of the top row");
  const fen = land(FEN_ARCHETYPE_ID, 1);
  const cells = square(width, 30, 30, 5);
  const at = (done: number, drained: readonly number[] = []): GameState => ({ ...fen, drainage: { works: [work(cells, done)], drained } });
  const token = (state: GameState) => landWorksChunkToken(state, { cx: 4, cy: 4 });
  assert.match(token(at(0)), /\.1$/);
  assert.equal(token(at(10)), token(at(0)), "progress inside a stage keeps the key");
  assert.match(token(at(25 * 320 / 2)), /\.2$/);
  assert.match(token(at(25 * 320)), /\.3$/);
  assert.match(token({ ...fen, drainage: { works: [], drained: patch } }), /e9$/);
  assert.match(token({ ...fen, drainage: { works: [{ ...work(cells, 0), diggers: 4 }], drained: [] } }), /\.1d$/, "diggers at work key the cart");
});

/** The fen's first mere with a plan of at least four cells. */
function mere(state: GameState): { tx: number; ty: number } {
  const tile = state.tiles.find(entry => entry.terrain === "water" && drainagePlan(state, entry.tx, entry.ty).ok
    && (drainagePlan(state, entry.tx, entry.ty) as { cells: readonly number[] }).cells.length >= 4);
  assert.ok(tile !== undefined);
  return { tx: tile.tx, ty: tile.ty };
}

test("LU-D6 the drain chip: cells, timber and seasons over a mere; each refusal in Korean", () => {
  const fen = land(FEN_ARCHETYPE_ID, 1);
  assert.equal(drainToolAvailable(fen), true);
  assert.equal(drainToolAvailable(DEFAULT_GAME_STATE), false, "the card is fen-only");
  const at = mere(fen);
  const plan = drainagePlan(fen, at.tx, at.ty) as Extract<ReturnType<typeof drainagePlan>, { ok: true }>;
  const preview = drainPreview(fen, at);
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.cells, plan.cells);
  assert.deepEqual(preview.lines.map(line => line.text), [`${DRAINAGE_COPY.chipTitle} · ${DRAINAGE_COPY.cells(plan.cells.length)}`,
    DRAINAGE_COPY.timber(plan.timber), DRAINAGE_COPY.seasons(plan.seasons, 4), DRAINAGE_COPY.confirm]);
  const refused = (state: GameState, tile: { tx: number; ty: number }, reason: DrainageRefusal) => {
    const result = drainPreview(state, tile);
    assert.equal(result.reason, reason);
    assert.deepEqual(result.lines.map(line => [line.severity, line.text]), [["block", DRAINAGE_COPY.refusal[reason]]]);
    assert.deepEqual(result.cells, []);
  };
  const { archetypeId: _fen, ...riverside } = fen;
  refused(riverside, at, "not_fen");
  const grass = fen.tiles.find(entry => entry.terrain === "grass")!;
  refused(fen, grass, "not_still_water");
  // No bank: the mere ringed with rock (nothing of it touches grass).
  const ringed = { ...fen, tiles: fen.tiles.map(tile => Math.max(Math.abs(tile.tx - at.tx), Math.abs(tile.ty - at.ty)) <= 2 ? { ...tile, terrain: "water" as const }
    : Math.max(Math.abs(tile.tx - at.tx), Math.abs(tile.ty - at.ty)) <= 4 ? { ...tile, terrain: "rock" as const } : tile) };
  refused(ringed, at, "no_bank");
  const started = gameReducer(fen, { type: "drain_fen", tx: at.tx, ty: at.ty });
  refused(started, at, "busy");
  refused({ ...fen, drainage: { works: [work([1], 0), work([2], 0)], drained: [] } }, at, "too_many_works");
  refused({ ...fen, treasuryTimber: 0, buildings: fen.buildings.map(building => ({ ...building, inventory: { ...building.inventory, timber: 0 } })) }, at, "insufficient_timber");
  for (const reason of Object.keys(DRAINAGE_COPY.refusal)) assert.match(DRAINAGE_COPY.refusal[reason as DrainageRefusal], /[가-힣]/);
});

test("LU-D6 the drain tool's clicks: a plan sends drain_fen, a refusal shows placement failure feedback, a right click disarms", () => {
  const fen = land(FEN_ARCHETYPE_ID, 1);
  const at = mere(fen);
  const sent: GameAction[] = [];
  let disarmed = 0;
  const context: DrainToolContext = { armedRef: { current: true }, disarmRef: { current: () => { disarmed += 1; } },
    refs: createCanvasMutableRefs({ zoom: 1, panX: 0, panY: 0 }), stateRef: { current: fen }, dispatch: action => { sent.push(action); } };
  const world = (tile: { tx: number; ty: number }) => { const point = tileToScreen(tile.tx, tile.ty); return { x: point.sx, y: point.sy }; };
  assert.equal(drainSelect(context, world(at)), true);
  assert.deepEqual(sent, [{ type: "drain_fen", tx: at.tx, ty: at.ty }]);
  assert.equal(context.refs.feedbackRef.current?.kind, "success");
  const grass = fen.tiles.find(entry => entry.terrain === "grass")!;
  assert.equal(drainSelect(context, world(grass)), true);
  assert.equal(sent.length, 1, "a refusal sends nothing");
  assert.deepEqual([context.refs.feedbackRef.current?.kind, context.refs.feedbackRef.current?.message], ["failure", DRAINAGE_COPY.refusal.not_still_water]);
  assert.equal(drainCancel(context), true);
  assert.equal(disarmed, 1);
  context.armedRef.current = false;
  assert.equal(drainSelect(context, world(at)), false, "unarmed, the click is the map's");
  assert.equal(drainCancel(context), false);
  assert.match(canvasCursorClass(null, null, false, true), /placement-armed/);
});

test("LU-D6 arming the drain tool clears the other tools, and they clear it (App)", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  assert.match(app, /setPalisadeDraft\(null\); setSelectedTool\(tool\); setDrainTool\(false\);/, "picking a building or the road drops it");
  assert.match(app, /const selectDrainTool = \(armed: boolean\) => \{\s*setDrainTool\(armed\); if \(armed\) \{ setPalisadeDraft\(null\); setSelectedTool\(null\); setZoneTool\(null\);/);
  assert.match(app, /if \(zoneTool !== null \|\| palisadeDraft !== null\) setDrainTool\(false\);/, "a zone brush or a wall draft drops it");
  assert.match(app, /if \(!placing\) setDrainTool\(false\);/, "Esc (leaving placement) drops it");
  assert.match(app, /\|\| drainTool\) sendUi\(\{ type: "pick_tool"/, "arming it closes the drawer like a tool");
});

test("MA-10 the needs-beside refusal names what each building needs", () => {
  const message = (buildingKind: Parameters<typeof formatPlacementFailure>[0]["buildingKind"]) =>
    formatPlacementFailure({ reason: PlacementFailure.needs_adjacent_terrain, buildingKind });
  assert.equal(message("fulling_mill"), "흐르는 물가 옆에 지어야 합니다 — 강이나 개울");
  assert.equal(message("dyehouse"), "물가 옆에 지어야 합니다");
  assert.equal(message("logging_camp"), "숲 옆에 지어야 합니다");
  assert.equal(message("quarry"), "바위 옆에 지어야 합니다");
  const marks = (kind: "fulling_mill" | "dyehouse" | "logging_camp") => buildingTileMarks(DEFAULT_GAME_STATE, kind, [{ tx: 5, ty: 5 }, { tx: 6, ty: 5 }],
    { ok: false, reason: PlacementFailure.needs_adjacent_terrain }).find(mark => mark.icon)?.reason;
  assert.deepEqual([marks("fulling_mill"), marks("dyehouse"), marks("logging_camp")], ["needs_flowing_water", "needs_water", "needs_forest"]);
  assert.equal(PLACEMENT_CHIP_COPY.reasons.needs_flowing_water(), "흐르는 물가 옆이어야 함");
  assert.equal(PLACEMENT_CHIP_COPY.reasons.needs_water(), "물가 옆이어야 함");
  assert.match(buildingCopy("fulling_mill").purpose, /흐르는 물가에만/);
  assert.match(buildingCopy("dyehouse").purpose, /물가에만/);
});

test("INSTALL (LAND-UI) Wave 34: 28 confirmed pictures, no stage-3 v1 tile, loaded on first draw only", () => {
  const keys = Object.keys(WAVE34_WORKS);
  assert.equal(keys.length, 28);
  assert.equal(keys.some(key => /-v\d$/.test(key)), false);
  assert.equal(keys.includes("drain_stage3_drying_summer"), false, "the superseded v1 tiles are not installed");
  for (const key of keys) assert.ok(readFileSync(`public/${WAVE34_WORKS[key as keyof typeof WAVE34_WORKS].url}`).length > 0);
  const startup = readFileSync("scripts/checks/startupArtList.ts", "utf8") + readFileSync("src/render/preloadGameArt.ts", "utf8");
  assert.equal(/wave34/i.test(startup), false, "not in the startup preload");
});
