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
import { HEADLAND, RIDGE_PERIOD, RIDGE_REPEAT_RADIUS, RIDGE_ROWS_PER_STRIP, RIDGE_SPAN } from "../src/world/boundary/arableFields";
import { YARD_SUBCELLS } from "../src/world/boundary/buildingGrounds";
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

test("Given the seed 2 arable scene When its strips are laid out Then they follow the zone's axis, show all four crop states, skip the farms and keep a 0.15-0.25 tile headland", () => {
  const state = arableScene();
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
  const farms = new Set<string>();
  for (const farm of state.buildings.filter(building => building.kind === "wheat_farm")) {
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) farms.add(`${farm.tx + dx},${farm.ty + dy}`);
  }
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
    assert.equal(pairsWithin(props.filter(prop => prop.kind.startsWith("orchard")).map(prop => ({ x: prop.x, y: prop.y, v: prop.kind })), 1.5), 0, "orchard neighbours");
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

test("Given house yards When hurdles and beds are placed Then panels sit on whole yard edges that no road, yard or frontage takes, meet post to post, and beds lie inside their yard", () => {
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
      // Posts on the yard rectangle's whole-tile lattice: socket (64, -32) = one tile along -y, mirrored one along -x.
      assert.ok(Number.isInteger(piece.anchor.x) && Number.isInteger(piece.anchor.y), piece.id);
      const ends = piece.kind === "corner"
        ? [{ x: piece.anchor.x, y: piece.anchor.y + 1 }, { x: piece.anchor.x + 1, y: piece.anchor.y }]
        : [piece.mirror ? { x: piece.anchor.x - 1, y: piece.anchor.y } : { x: piece.anchor.x, y: piece.anchor.y - 1 }];
      for (const end of [piece.anchor, ...ends]) {
        const { tx, ty, width, height } = yard.footprint;
        assert.ok(end.x >= tx - 1 && end.x <= tx + width && end.y >= ty - 1 && end.y <= ty + height, `${piece.id} post off its yard rectangle`);
      }
      // The panel's inner side is this yard, its outer side no other yard, and it is not on the frontage side.
      const from = piece.kind === "corner" ? ends[0]! : piece.anchor; const to = piece.kind === "corner" ? piece.anchor : ends[0]!;
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      const along = { x: to.x - from.x, y: to.y - from.y };
      const apron = aprons.find(candidate => candidate.buildingId === piece.buildingId);
      const centre = { x: yard.footprint.tx + (yard.footprint.width - 1) / 2, y: yard.footprint.ty + (yard.footprint.height - 1) / 2 };
      const outward = along.x === 0 ? { x: Math.sign(mid.x - centre.x), y: 0 } : { x: 0, y: Math.sign(mid.y - centre.y) };
      assert.ok(apron === undefined || apron.normal.x !== outward.x || apron.normal.y !== outward.y, `${piece.id} on the frontage`);
      const outside = at(yard, mid.x + outward.x / 16, mid.y + outward.y / 16);
      assert.ok(outside === undefined, `${piece.id} against yard ${outside}`);
    }
    for (const bed of scene.yardProps.beds) {
      const yard = yardOf.get(bed.buildingId);
      assert.ok(yard !== undefined);
      assert.equal(at(yard, bed.anchor.x, bed.anchor.y), bed.buildingId, "bed inside its yard");
    }
  }
  // The real-input cottages: at least one north corner piece and panels on both axes.
  const hurdles = buildGroundBoundaryScene(arableScene()).yardProps.hurdles;
  assert.ok(hurdles.some(piece => piece.kind === "corner"));
  assert.ok(hurdles.some(piece => piece.kind === "straight" && piece.mirror) && hurdles.some(piece => piece.kind === "straight" && !piece.mirror));
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
