import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import type { GameState } from "../src/engine/engine.types";
import { buildGroundBoundaryScene } from "../src/render/groundBoundaryScene";
import { outlineTolerance } from "../src/world/boundary/boundaryTolerance";
import { BRIDGE_LOCK_FULL, SHALLOW_DEPTH } from "../src/world/boundary/shoreline";
import type { BoundaryPoint } from "../src/world/boundary/boundaryGeometry";
import { seedGroundState } from "../scripts/boundaryFixtureStates";

// D3a shoreline. The bridge scenes are the real-input states of docs/verification/d3a-shoreline/scene (road tool
// drags across water on the seed 2 natural chain and on the 24-lot town fixture).
const fixture = (name: string): GameState =>
  JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/boundary/${name}`, import.meta.url))).toString("utf8")) as GameState;
const bridgeScenes = (): readonly [string, GameState][] => [["seed2-bridge", fixture("seed2-bridge-scene.json.gz")], ["river-bridges", fixture("river-bridges-scene.json.gz")]];
const allScenes = (): readonly [string, GameState][] => [...([1, 2, 3, 4, 5] as const).map(seed => [`seed${seed}`, seedGroundState(seed)] as [string, GameState]), ...bridgeScenes()];

test("Given every fixture and bridge scene When the shoreline is derived Then it stays within 0.35 tile of the water / land cell edges and inside the map", () => {
  for (const [name, state] of allScenes()) {
    const { shore } = buildGroundBoundaryScene(state);
    assert.ok(shore.loops.length > 0, `${name}: water outlined`);
    const report = outlineTolerance(shore.loops, 0.35);
    assert.equal(report.over, 0, `${name}: ${report.over} samples beyond 0.35 (max ${report.max})`);
    for (const loop of shore.loops) for (const point of loop.smoothed) {
      assert.ok(point.x >= -0.5 - 1e-9 && point.y >= -0.5 - 1e-9 && point.x <= state.width - 0.5 + 1e-9 && point.y <= state.height - 0.5 + 1e-9, `${name}: outline off the map`);
    }
    assert.ok(shore.loops.every(loop => loop.landSide === 1), `${name}: water lies left of travel (cellContours orientation)`);
  }
});

test("Given real-input bridges When the shoreline meets them Then the bank is straight at the deck: contact within 0.15 tile, tangent within 5 degrees", () => {
  let ends = 0;
  for (const [name, state] of bridgeScenes()) {
    const { shore } = buildGroundBoundaryScene(state);
    assert.ok(shore.bridgeEnds.length >= 2, `${name}: bridge ends`);
    for (const end of shore.bridgeEnds) {
      ends += 1;
      // Where the deck's centre line crosses the outline near the bank edge, and the outline's direction there.
      let best: { offset: number; angle: number } | null = null;
      for (const loop of shore.loops) for (let index = 0; index < loop.smoothed.length; index += 1) {
        const a = loop.smoothed[index] as BoundaryPoint; const b = loop.smoothed[(index + 1) % loop.smoothed.length] as BoundaryPoint;
        const [ca, cb, along] = end.axis === "y" ? [a.x - end.mid.x, b.x - end.mid.x, (p: BoundaryPoint) => p.y] : [a.y - end.mid.y, b.y - end.mid.y, (p: BoundaryPoint) => p.x];
        if (ca * cb > 0 || ca === cb) continue;
        const t = ca / (ca - cb);
        const cross = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const offset = Math.abs(along(cross) - (end.axis === "y" ? end.mid.y : end.mid.x));
        if (offset > 1) continue;
        const direction = Math.atan2(b.y - a.y, b.x - a.x);
        const edge = end.axis === "y" ? 0 : Math.PI / 2;
        let angle = Math.abs(direction - edge) % Math.PI; angle = Math.min(angle, Math.PI - angle);
        if (best === null || offset < best.offset) best = { offset, angle: angle * 180 / Math.PI };
      }
      assert.ok(best !== null, `${name}: the outline crosses the deck line at ${end.mid.x},${end.mid.y}`);
      assert.ok(best.offset <= 0.15, `${name}: contact ${best.offset.toFixed(3)} tile off the bank edge`);
      assert.ok(best.angle <= 5, `${name}: tangent ${best.angle.toFixed(2)} degrees off the bank edge`);
    }
    // One abutment per bridge, at its back end.
    const spans = new Set(shore.bridgeEnds.map(end => `${end.axis}:${end.axis === "x" ? end.mid.y : end.mid.x}`));
    assert.equal(shore.bridgeEnds.filter(end => end.back).length, spans.size, `${name}: one back end per bridge`);
  }
  assert.ok(ends >= 6);
  assert.ok(BRIDGE_LOCK_FULL >= 0.5);
});

test("Given the shallow decals When they are scattered Then they lie in water cells inside the shallow band and off the bridges", () => {
  for (const [name, state] of allScenes()) {
    const { shore } = buildGroundBoundaryScene(state);
    for (const loop of shore.loops) for (const decal of loop.decals) {
      const tile = state.tiles[Math.round(decal.anchor.y) * state.width + Math.round(decal.anchor.x)];
      assert.equal(tile?.terrain, "water", `${name}: decal on ${tile?.terrain}`);
      let nearest = Infinity;
      for (let index = 0; index < loop.smoothed.length; index += 1) {
        const a = loop.smoothed[index] as BoundaryPoint; const b = loop.smoothed[(index + 1) % loop.smoothed.length] as BoundaryPoint;
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const t = Math.max(0, Math.min(1, ((decal.anchor.x - a.x) * (b.x - a.x) + (decal.anchor.y - a.y) * (b.y - a.y)) / length / length));
        nearest = Math.min(nearest, Math.hypot(decal.anchor.x - (a.x + (b.x - a.x) * t), decal.anchor.y - (a.y + (b.y - a.y) * t)));
      }
      assert.ok(nearest <= SHALLOW_DEPTH + 1e-6, `${name}: decal ${nearest.toFixed(2)} from the shore`);
      for (const end of shore.bridgeEnds) assert.ok(Math.hypot(end.mid.x - decal.anchor.x, end.mid.y - decal.anchor.y) >= 1.2, `${name}: decal on a bridge end`);
    }
  }
});

test("Given the bridge scenes When the scene is built from tiles in reverse order Then the shoreline is identical", () => {
  for (const [, state] of bridgeScenes()) {
    assert.deepEqual(buildGroundBoundaryScene(state, true).shore, buildGroundBoundaryScene(state).shore);
  }
});

test("Given the chunk plans When water is keyed Then only chunks that draw a shore loop or lie in water carry water, and dry chunks keep no water key", () => {
  const state = seedGroundState(2);
  const scene = buildGroundBoundaryScene(state);
  const wet = scene.chunks.filter(plan => plan.waterLoops.length > 0 || plan.waterParity);
  assert.ok(wet.length > 0 && wet.length < scene.chunks.length);
  for (const plan of scene.chunks) {
    for (const index of plan.waterLoops) {
      const bounds = scene.shore.loops[index]?.bounds;
      assert.ok(bounds !== undefined);
    }
  }
  // A chunk with no water tile within reach has no loop and no parity.
  for (const plan of scene.chunks) {
    let water = false;
    for (let ty = plan.cy * 8 - 2; ty < plan.cy * 8 + 10; ty += 1) for (let tx = plan.cx * 8 - 2; tx < plan.cx * 8 + 10; tx += 1) {
      if (state.tiles[ty * state.width + tx]?.terrain === "water" && tx >= 0 && ty >= 0 && tx < state.width && ty < state.height) water = true;
    }
    if (!water) assert.ok(plan.waterLoops.length === 0 && !plan.waterParity, `chunk ${plan.cx},${plan.cy}`);
  }
});
