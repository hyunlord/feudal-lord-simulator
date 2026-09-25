import assert from "node:assert/strict";
import test from "node:test";
import type { GameState } from "../src/engine/engine.types";
import type { CanvasMutableRefs } from "../src/render/canvasRuntimeRefs";
import { createZoneBrushContext, zoneUndo } from "../src/render/canvasZoneBrushRuntime";
import { ZONE_BRUSH_COPY } from "../src/render/zoneBrushCopy.ko";
import { gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import { zonesOf } from "../src/zones/zoneEdits";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { seedGroundState } from "../scripts/boundaryFixtureStates";
import { c25ZonedState } from "../scripts/c25Board";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { arableStripStateLookup, stripStateKey } from "../src/render/drawArableFields";
import { ROAD_STRIP_SETS } from "../src/render/boundaryAssetManifest";
import { ZONE_VARIANTS } from "../src/render/zoneAssetManifest";
import { arableStripStates } from "../src/zones/arableStrips";
import { ARABLE_CONFIG } from "../src/content/arableConfig";
import { migrateStateV9ToV10 } from "../src/save/migrations/v9ToV10";
import { inYearTick, stepArableFields } from "../src/zones/arableFields";
import { HEADLAND, RIDGE_PERIOD, RIDGE_REPEAT_RADIUS, RIDGE_ROWS_PER_STRIP, RIDGE_SPAN } from "../src/world/boundary/arableFields";
import { YARD_SUBCELLS } from "../src/world/boundary/buildingGrounds";
import type { HurdlePiece } from "../src/world/boundary/yardProps";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import { setBoundaryV2Enabled } from "../src/render/renderBoundaryFlag";

function brushContext(state: GameState) {
  const stateRef = { current: state };
  const actions: GameAction[] = [];
  const refs = { feedbackRef: { current: null }, cameraRef: { current: { panX: 0, panY: 0, zoom: 1 } },
    dragRef: { current: { mode: "none" } }, spacePressed: { current: false }, suppressClick: { current: false } } as unknown as CanvasMutableRefs;
  const context = createZoneBrushContext({ toolRef: { current: { target: "pasture", radius: 2, polygon: false } }, radiusRef: { current: undefined },
    refs, stateRef, dispatch: action => { actions.push(action); stateRef.current = gameReducer(stateRef.current, action); }, clampCamera: camera => camera });
  // Z arrives as the `undo` intent (B9: the keyboard translator maps KeyZ to it).
  const key = (code: "KeyZ") => code === "KeyZ" && zoneUndo(context);
  return { context, stateRef, actions, refs, key };
}

test("Z undoes the last zone stroke through zone_undo_stroke, and says so when there is nothing to undo", () => {
  const base = seedGroundState(2);
  const painted = gameReducer(base, { type: "zone_paint", kind: "pasture", stroke: { tool: "brush", points: [{ x: 30.5, y: 30.5 }], radius: 2 } });
  assert.ok(zonesOf(painted).length > zonesOf(base).length);
  const brush = brushContext(painted);
  assert.equal(brush.key("KeyZ"), true);
  assert.deepEqual(brush.actions, [{ type: "zone_undo_stroke" }]);
  assert.deepEqual(zonesOf(brush.stateRef.current), zonesOf(base));
  assert.equal((brush.refs.feedbackRef.current as { message: string } | null)?.message, ZONE_BRUSH_COPY.undone);
  assert.equal(brush.key("KeyZ"), true);
  assert.equal(brush.actions.length, 1, "an empty undo stack dispatches nothing");
  assert.equal((brush.refs.feedbackRef.current as { message: string } | null)?.message, ZONE_BRUSH_COPY.nothingToUndo);
});

test("Z during a stroke drops the stroke like Esc and undoes nothing", () => {
  const painted = gameReducer(seedGroundState(2), { type: "zone_paint", kind: "pasture", stroke: { tool: "brush", points: [{ x: 30.5, y: 30.5 }], radius: 2 } });
  const brush = brushContext(painted);
  brush.context.zone.gestureRef.current = { mode: "brush", points: [{ x: 34.5, y: 30.5 }] } as never;
  assert.equal(brush.key("KeyZ"), true);
  assert.equal(brush.context.zone.gestureRef.current, null);
  assert.equal(brush.actions.some(action => action.type === "zone_undo_stroke"), false);
});

// ---- C1e field strips, yard props and variant distribution ---------------------------------------------------------
// The arable scene is the real-input state of docs/verification/c1e-fields/scene (C1b natural snapshot + C1d cottages +
// the C1e arable rectangle over the three farms outside the wall, paused with all four crop states showing).

const arableScene = (): GameState => JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/boundary/seed2-arable-scene.json.gz", import.meta.url))).toString("utf8")) as GameState;

/**
 * C1c-2 (AF-3, AF-12): strip states come from field records, not from wheat farms, so the scene is opened as a v10 game
 * (its farms become field cells and a farmstead) and worked from late winter until the farmstead has left strips in
 * all four C1e states (fallow, ploughed, seedling, growing).
 */
function workedArableScene(): GameState {
  const migrated = migrateStateV9ToV10(arableScene());
  // Only the field rule runs here, so the farmsteads are staffed as the labour step would staff them.
  let state: GameState = { ...migrated, tick: migrated.tick - inYearTick(migrated.tick) + ARABLE_CONFIG.fieldWorkFrom, arableFields: [],
    buildings: migrated.buildings.map(building => building.kind === "farmstead" ? { ...building, workers: 4 } : building) };
  for (let tick = 0; tick < 6000; tick += 1) {
    // A game tick rebuilds the building list (labour), which is what the render's strip-state cache keys on.
    const next = stepArableFields(state).state;
    const stepped = { ...next, buildings: [...next.buildings] };
    const seen = new Set(arableStripStateLookup(stepped).values());
    if (["fallow", "ploughed", "seedling", "growing"].every(stage => seen.has(stage as never))) return stepped;
    state = { ...stepped, tick: stepped.tick + 1 };
  }
  throw new Error("the worked scene never showed all four strip states");
}

test("Given the seed 2 arable scene When its strips are laid out Then they follow the zone's axis, show all four crop states, skip the buildings and keep a 0.15-0.25 tile headland", () => {
  const state = workedArableScene();
  const scene = buildGroundBoundaryScene(state);
  const index = scene.zones.zones.findIndex(zone => zone.kind === "arable");
  const field = scene.zones.fields[index];
  assert.ok(field !== null && field !== undefined);
  const zone = zonesOf(state).find(candidate => candidate.id === field.zoneId);
  assert.ok(zone !== undefined);
  const layout = arableStripStates(zone, state);
  assert.equal(field.axis, layout.axis);
  assert.equal(field.axis, "y", "the rectangle is taller than wide");
  assert.ok(HEADLAND >= 0.15 && HEADLAND <= 0.25);
  const states = arableStripStateLookup(state);
  assert.deepEqual(new Set(field.bands.map(band => states.get(band.stripId))), new Set(["ploughed", "seedling", "growing", "fallow"]));
  // No strip lies under a building (the farms are fields now; the farmstead and any other building stay bare, AF-1).
  const farms = new Set(state.tiles.filter(tile => tile.buildingId !== null).map(tile => `${tile.tx},${tile.ty}`));
  const members = new Set(zone.membership);
  for (const band of field.bands) {
    for (let along = band.from; along <= band.to; along += 1) {
      assert.equal(farms.has(`${band.line},${along}`), false, "no strip over a farm footprint");
      assert.ok(members.has(along * state.width + band.line), "strips stay in the zone");
    }
  }
  // Crop rectangles: inside the zone's cells, HEADLAND off every side that faces a cell without crops.
  const cropCell = new Set(field.bands.flatMap(band => Array.from({ length: band.to - band.from + 1 }, (_, i) => `${band.line},${band.from + i}`)));
  for (const rect of field.crop) {
    const tx = Math.round((rect.left + rect.right) / 2); const ty = Math.round((rect.top + rect.bottom) / 2);
    assert.ok(cropCell.has(`${tx},${ty}`));
    if (!cropCell.has(`${tx},${ty - 1}`)) assert.ok(rect.top >= ty - 0.5 + HEADLAND - 1e-9);
    if (!cropCell.has(`${tx},${ty + 1}`)) assert.ok(rect.bottom <= ty + 0.5 - HEADLAND + 1e-9);
    if (!cropCell.has(`${tx - 1},${ty}`)) assert.ok(rect.left >= tx - 0.5 + HEADLAND - 1e-9);
    if (!cropCell.has(`${tx + 1},${ty}`)) assert.ok(rect.right <= tx + 0.5 - HEADLAND + 1e-9);
  }
});

test("Given ridge rows When phases are chosen Then along a row a and b alternate span by span and no two rows within 4 tiles share a phase", () => {
  for (const state of [arableScene(), c25ZonedState()]) {
    const scene = buildGroundBoundaryScene(state);
    for (const field of scene.zones.fields) {
      if (field === null) continue;
      const phaseOf = new Map<number, number>();
      for (const band of field.bands) for (const row of band.rows) {
        const across = band.line * RIDGE_ROWS_PER_STRIP + row.index;
        const known = phaseOf.get(across);
        assert.ok(known === undefined || known === row.phase, "a row keeps one phase across its runs");
        phaseOf.set(across, row.phase);
      }
      for (const [across, phase] of phaseOf) {
        for (const [other, otherPhase] of phaseOf) {
          if (other <= across || (other - across) / RIDGE_ROWS_PER_STRIP >= RIDGE_REPEAT_RADIUS) continue;
          assert.notEqual(phase, otherPhase, `rows ${across} and ${other} line up the same image`);
        }
      }
    }
    // The strip pair: two different images per state, 4 tiles each, so a row's spans alternate a, b, a, b.
    for (const pair of Object.values(ZONE_VARIANTS.ridge)) assert.equal(new Set(pair).size, 2);
    assert.equal(RIDGE_PERIOD, 2 * RIDGE_SPAN);
  }
});

test("Given the zoned boards When decals and fills pick variants Then no family repeats a variant within 4 tiles, and orchard trees never repeat among planting neighbours", () => {
  const pairsWithin = (points: readonly { x: number; y: number; v: string }[], radius: number): number => {
    let count = 0;
    for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i] as { x: number; y: number; v: string }; const b = points[j] as { x: number; y: number; v: string };
      if (a.v === b.v && Math.hypot(a.x - b.x, a.y - b.y) < radius) count += 1;
    }
    return count;
  };
  for (const state of [arableScene(), c25ZonedState(), ...([1, 2, 3, 4, 5] as const).map(seed => seedGroundState(seed))]) {
    const scene = buildGroundBoundaryScene(state);
    const props = scene.zones.props;
    assert.equal(pairsWithin(props.filter(prop => prop.kind.startsWith("haycock")).map(prop => ({ x: prop.x, y: prop.y, v: prop.kind })), 4), 0, "haycocks");
    assert.equal(pairsWithin(scene.zones.fields.flatMap(field => field?.stamps ?? []).map(stamp => ({ x: stamp.anchor.x, y: stamp.anchor.y, v: String(stamp.variant) })), 4), 0, "furrow stamps");
    assert.equal(pairsWithin(scene.yardProps.beds.map(bed => ({ x: bed.anchor.x, y: bed.anchor.y, v: String(bed.variant) })), 4), 0, "croft beds");
    assert.equal(pairsWithin(props.filter(prop => prop.kind.startsWith("orchard")).map(prop => ({ x: prop.x, y: prop.y, v: prop.kind })), 2), 0, "orchard: no same species within 2 tiles (9 species, FS4)");
    assert.ok(props.every(prop => !prop.flip), "trees and haycocks are real variants, never mirrored");
    // Floors: same-kind zones within 4 tiles of each other take different variants (two zones never share an edge pattern).
    const zones = scene.zones.zones;
    for (let i = 0; i < zones.length; i += 1) for (let j = i + 1; j < zones.length; j += 1) {
      const a = zones[i]!; const b = zones[j]!;
      if (a.kind !== b.kind || a.floor === null) continue;
      const gap = Math.hypot(Math.max(0, a.bounds.left - b.bounds.right, b.bounds.left - a.bounds.right), Math.max(0, a.bounds.top - b.bounds.bottom, b.bounds.top - a.bounds.bottom));
      if (gap < 4) assert.notEqual(a.floor, b.floor, `${a.id} and ${b.id}`);
    }
  }
  // Earth road v3: four different spans in turn along a ribbon.
  assert.equal(new Set(ROAD_STRIP_SETS.earth.v3.images).size, 4);
});

/** The edges a hurdle piece covers (tile-centre coordinates; straight / gate one tile, half half a tile, corner two arms). */
function hurdleEdges(piece: HurdlePiece): readonly { readonly from: { x: number; y: number }; readonly to: { x: number; y: number } }[] {
  const { x, y } = piece.anchor;
  if (piece.kind === "corner") {
    const arms = piece.vertex === "east" ? [[-1, 0], [0, 1]] : piece.vertex === "south" ? [[-1, 0], [0, -1]] : piece.vertex === "west" ? [[1, 0], [0, -1]] : [[1, 0], [0, 1]];
    return arms.map(([dx, dy]) => ({ from: { x, y }, to: { x: x + (dx as number), y: y + (dy as number) } }));
  }
  const length = piece.kind === "half" || piece.kind === "short_gate" ? 0.5 : piece.kind === "quarter" ? 0.25 : piece.kind === "three_quarter" ? 0.75 : 1;
  return [{ from: { x, y }, to: piece.mirror ? { x: x - length, y } : { x, y: y - length } }];
}

test("Given house yards When hurdles and beds are placed Then panels sit on whole yard edges that no road or other yard takes, meet post to post, the gate stands on the frontage side, and beds lie inside their yard", () => {
  for (const state of [arableScene(), ...([1, 3, 5] as const).map(seed => seedGroundState(seed))]) {
    const scene = buildGroundBoundaryScene(state);
    const { yards, aprons } = scene.grounds;
    const yardOf = new Map(yards.map(yard => [yard.buildingId, yard]));
    const owner = new Map<number, string>();
    for (const yard of yards) for (const subcell of yard.subcells) owner.set(subcell, yard.buildingId);
    const at = (yard: (typeof yards)[number], x: number, y: number): string | undefined =>
      owner.get(Math.floor((y + 0.5) * YARD_SUBCELLS) * yard.subcellStride + Math.floor((x + 0.5) * YARD_SUBCELLS));
    for (const piece of scene.yardProps.hurdles) {
      const yard = yardOf.get(piece.buildingId);
      assert.ok(yard !== undefined);
      const { tx, ty, width, height } = yard.footprint;
      // Posts on the yard rectangle's lattice: whole tiles, quarters only for part panels and the short gate (INSTALL-4e).
      const part = piece.kind === "half" || piece.kind === "quarter" || piece.kind === "three_quarter" || piece.kind === "short_gate";
      assert.ok(Number.isInteger(piece.anchor.x * 4) && Number.isInteger(piece.anchor.y * 4), piece.id);
      if (!part) assert.ok(Number.isInteger(piece.anchor.x) && Number.isInteger(piece.anchor.y), piece.id);
      const centre = { x: tx + (width - 1) / 2, y: ty + (height - 1) / 2 };
      const apron = aprons.find(candidate => candidate.buildingId === piece.buildingId);
      for (const { from, to } of hurdleEdges(piece)) {
        for (const end of [from, to]) assert.ok(end.x >= tx - 1 && end.x <= tx + width && end.y >= ty - 1 && end.y <= ty + height, `${piece.id} post off its yard rectangle`);
        // The panel's inner side is this yard, its outer side no other yard.
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const outward = from.y === to.y ? { x: 0, y: Math.sign(mid.y - centre.y) } : { x: Math.sign(mid.x - centre.x), y: 0 };
        assert.equal(at(yard, mid.x - outward.x / 16, mid.y - outward.y / 16), piece.buildingId, `${piece.id} inner side`);
        const outside = at(yard, mid.x + outward.x / 16, mid.y + outward.y / 16);
        assert.ok(outside === undefined, `${piece.id} against yard ${outside}`);
        if (piece.kind === "gate" || piece.kind === "short_gate") assert.ok(apron !== undefined && apron.normal.x === outward.x && apron.normal.y === outward.y, `${piece.id} gate off the frontage side`);
      }
    }
    for (const bed of scene.yardProps.beds) {
      const yard = yardOf.get(bed.buildingId);
      assert.ok(yard !== undefined);
      assert.equal(at(yard, bed.anchor.x, bed.anchor.y), bed.buildingId, "bed inside its yard");
    }
  }
  // The real-input cottages: corners, a gate and panels on both axes.
  const hurdles = buildGroundBoundaryScene(arableScene()).yardProps.hurdles;
  assert.ok(hurdles.some(piece => piece.kind === "corner"));
  assert.ok(hurdles.some(piece => piece.kind === "gate"));
  assert.ok(hurdles.some(piece => piece.mirror) && hurdles.some(piece => !piece.mirror));
});

test("Given fenced house yards When their rings are checked Then each edge is covered once, what stays open cannot be fenced, one gate stands on a fenceable frontage side and every vertex between two panels is a corner piece (C1f)", () => {
  let yardsChecked = 0; let gates = 0; let corners = 0; let halves = 0;
  for (const state of [arableScene(), c25ZonedState(), ...([1, 2, 3, 4, 5] as const).map(seed => seedGroundState(seed))]) {
    const scene = buildGroundBoundaryScene(state);
    const { yards, aprons } = scene.grounds;
    const owner = new Map<number, string>();
    for (const yard of yards) for (const subcell of yard.subcells) owner.set(subcell, yard.buildingId);
    const byYard = new Map<string, HurdlePiece[]>();
    for (const piece of scene.yardProps.hurdles) byYard.set(piece.buildingId, [...(byYard.get(piece.buildingId) ?? []), piece]);
    for (const [buildingId, pieces] of byYard) {
      const yard = yards.find(candidate => candidate.buildingId === buildingId)!;
      const at = (x: number, y: number): string | undefined =>
        owner.get(Math.floor((y + 0.5) * YARD_SUBCELLS) * yard.subcellStride + Math.floor((x + 0.5) * YARD_SUBCELLS));
      yardsChecked += 1;
      const { tx, ty, width, height } = yard.footprint;
      const left = tx - 1; const top = ty - 1; const right = tx + width; const bottom = ty + height;
      // Quarter-tile coverage of the rectangle's sides.
      const cover = new Map<string, number>();
      for (const piece of pieces) for (const { from, to } of hurdleEdges(piece)) {
        const steps = Math.round(Math.hypot(to.x - from.x, to.y - from.y) * 4);
        for (let k = 0; k < steps; k += 1) {
          const a = { x: from.x + (to.x - from.x) * k / steps, y: from.y + (to.y - from.y) * k / steps };
          const b = { x: from.x + (to.x - from.x) * (k + 1) / steps, y: from.y + (to.y - from.y) * (k + 1) / steps };
          const key = `${Math.min(a.x, b.x)},${Math.min(a.y, b.y)},${a.y === b.y ? "x" : "y"}`;
          cover.set(key, (cover.get(key) ?? 0) + 1);
        }
      }
      for (const [key, count] of cover) assert.equal(count, 1, `${buildingId} edge ${key} covered ${count} times`);
      const centre = { x: tx + (width - 1) / 2, y: ty + (height - 1) / 2 };
      const halfOpen: string[] = [];
      for (const [line, alongX] of [[top, true], [bottom, true], [left, false], [right, false]] as const) {
        for (let along = alongX ? left : top; along < (alongX ? right : bottom) - 1e-9; along += 0.25) {
          const key = alongX ? `${along},${line},x` : `${line},${along},y`;
          if (cover.has(key)) continue;
          const outward = alongX ? { x: 0, y: Math.sign(line - centre.y) } : { x: Math.sign(line - centre.x), y: 0 };
          // Open quarter-edge: the yard does not fill both its subcells (a cut or the rounded corner), or another yard
          // lies outside.
          const open = [1 / 16, 3 / 16].every(offset => {
            const mid = alongX ? { x: along + offset, y: line } : { x: line, y: along + offset };
            return at(mid.x - outward.x / 16, mid.y - outward.y / 16) === buildingId && at(mid.x + outward.x / 16, mid.y + outward.y / 16) === undefined;
          });
          if (open) halfOpen.push(key);
        }
      }
      // What stays open must be a rounded-corner sliver or part of an edge cut other than in half (listed as a want).
      for (const key of halfOpen) {
        const [xs, ys, axis] = key.split(",");
        const x = Number(xs); const y = Number(ys);
        // The rounded corner (radius 0.35) reaches into the half tile at each end of a side.
        const corner = (axis === "x" ? (x < left + 0.5 || x + 0.25 > right - 0.5) : (y < top + 0.5 || y + 0.25 > bottom - 0.5));
        const wanted = scene.yardProps.wants.some(want => want.buildingId === buildingId && want.kind === "half"
          && Math.abs(want.at.x - (axis === "x" ? Math.floor(x) + 0.5 : x)) < 1e-9 && Math.abs(want.at.y - (axis === "x" ? y : Math.floor(y) + 0.5)) < 1e-9);
        assert.ok(corner || wanted, `${buildingId} quarter-edge ${key} fenceable but open`);
      }
      const gateCount = pieces.filter(piece => piece.kind === "gate" || piece.kind === "short_gate").length;
      assert.ok(gateCount <= 1, `${buildingId} gates ${gateCount}`);
      const apron = aprons.find(candidate => candidate.buildingId === buildingId);
      const outwardOf = (from: { x: number; y: number }, to: { x: number; y: number }) =>
        from.y === to.y ? { x: 0, y: Math.sign(from.y - centre.y) } : { x: Math.sign(from.x - centre.x), y: 0 };
      const frontFenced = apron !== undefined && pieces.some(piece => piece.kind === "straight" && hurdleEdges(piece).some(({ from, to }) =>
        outwardOf(from, to).x === apron.normal.x && outwardOf(from, to).y === apron.normal.y));
      if (frontFenced) assert.equal(gateCount, 1, `${buildingId} fenced frontage side without a gate`);
      // No vertex joins two straight panels: a corner piece stands there instead.
      const straightEnds = new Map<string, number>();
      for (const piece of pieces) if (piece.kind === "straight") for (const { from, to } of hurdleEdges(piece)) for (const end of [from, to]) {
        if ((end.x === left || end.x === right) && (end.y === top || end.y === bottom)) straightEnds.set(`${end.x},${end.y}`, (straightEnds.get(`${end.x},${end.y}`) ?? 0) + 1);
      }
      for (const [vertex, count] of straightEnds) assert.ok(count < 2, `${buildingId} vertex ${vertex} joins two straight panels`);
      gates += gateCount; corners += pieces.filter(piece => piece.kind === "corner").length; halves += pieces.filter(piece => piece.kind === "half").length;
    }
  }
  assert.ok(yardsChecked > 5 && gates > 0 && corners > 0 && halves > 0, `yards ${yardsChecked}, gates ${gates}, corners ${corners}, halves ${halves}`);
});

test("Given the arable scene When it is built from tiles in reverse order Then fields, floors and yard props are identical", () => {
  const state = arableScene();
  const forward = buildGroundBoundaryScene(state); const reversed = buildGroundBoundaryScene(state, true);
  assert.deepEqual(reversed.zones.fields, forward.zones.fields);
  assert.deepEqual(reversed.zones.zones, forward.zones.zones);
  assert.deepEqual(reversed.yardProps, forward.yardProps);
});

test("Given a crop state change When chunk keys are read Then only chunks drawing that strip change their key", () => {
  const state = arableScene();
  const scene = buildGroundBoundaryScene(state);
  const states = arableStripStateLookup(state);
  const changed = scene.zones.arableBands[0];
  assert.ok(changed !== undefined);
  const next = new Map(states);
  next.set(changed.stripId, states.get(changed.stripId) === "growing" ? "fallow" : "growing");
  let moved = 0; let kept = 0;
  for (const plan of scene.chunks) {
    const before = stripStateKey(scene.zones, plan.arableBands, states); const after = stripStateKey(scene.zones, plan.arableBands, next);
    const draws = plan.arableBands.some(index => scene.zones.arableBands[index]?.stripId === changed.stripId);
    assert.equal(before !== after, draws);
    if (draws) moved += 1; else if (plan.arableBands.length > 0) kept += 1;
  }
  assert.ok(moved > 0 && kept > 0);
});

test("Given the arable scene When the object queue is built Then no grass tuft, bush or stone stands on a crop cell", () => {
  setBoundaryV2Enabled(true);
  const state = arableScene();
  const field = buildGroundBoundaryScene(state).zones.fields.find(candidate => candidate !== null);
  assert.ok(field !== null && field !== undefined);
  const crops = new Set(field.bands.flatMap(band => Array.from({ length: band.to - band.from + 1 }, (_, i) => `${band.line},${band.from + i}`)));
  const tiles = state.tiles.filter(tile => tile.tx >= 40 && tile.tx <= 62 && tile.ty >= 44 && tile.ty <= 63);
  const items = objectRenderItemsForFrame({ state, visibleTiles: tiles, range: { minTx: 40, maxTx: 62, minTy: 44, maxTy: 63 }, includeGroundCover: true });
  const covers = items.filter(item => item.kind === "groundCover");
  assert.ok(covers.length > 0, "the ground around the field keeps its cover");
  for (const item of covers) {
    if (item.kind !== "groundCover") continue;
    assert.equal(crops.has(`${Math.round(item.descriptor.anchorTx)},${Math.round(item.descriptor.anchorTy)}`), false, item.id);
  }
});

test("Given the same buildings, sites and zones When the saved arable field records change Then the strip state lookup is recomputed (C1f)", () => {
  const state = c25ZonedState();
  const first = arableStripStateLookup(state);
  assert.equal(arableStripStateLookup({ ...state }), first, "same inputs: cached");
  const records = { ...state, arableFields: [...(state.arableFields ?? [])] };
  assert.notEqual(arableStripStateLookup(records), first, "a new arableFields array is a new key");
});

test("Given the C25 orchard with 9 species When trees pick variants Then none repeats within 2 tiles (the rule) and, with the farthest-first pick, none within 3 (C1f)", () => {
  const trees = buildGroundBoundaryScene(c25ZonedState()).zones.props.filter(prop => prop.kind.startsWith("orchard"));
  assert.ok(trees.length >= 10 && new Set(trees.map(tree => tree.kind)).size === 9, `trees ${trees.length}`);
  let nearest = Infinity; let within4 = 0;
  for (let i = 0; i < trees.length; i += 1) for (let j = i + 1; j < trees.length; j += 1) {
    const a = trees[i]!; const b = trees[j]!;
    if (a.kind !== b.kind) continue;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    nearest = Math.min(nearest, distance); if (distance < 4) within4 += 1;
  }
  assert.ok(nearest >= 3, `same species ${nearest.toFixed(2)} tiles apart`);
  // Within 4 tiles: 10 of these 12 trees are mutually closer than 4, so 9 species force at least one same pair there;
  // the farthest-first pick reaches that floor.
  assert.ok(within4 <= 1, `same-species pairs within 4 tiles: ${within4}`);
});
