import assert from "node:assert/strict";
import { test } from "node:test";

import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { walkerPresentationFor, walkerStepLift } from "../src/render/walkerPresentation";
import { loadState } from "../scripts/nat1Occlusion";

// NAT-4 QA-026 (Astra round 14: a carter's walk repeats the same leg spread). The gait does cycle — two frames, a flip
// every half tile — but the walker sheets' two gait rows draw the same leg forward; the body's step rise on the second
// frame gives the walk a beat until the sheets carry the opposite stride (Astra handoff in the NAT-4 world report).

test("NAT-4 QA-026 a walking carter's gait frame flips every half tile (chapter-four-town, 60 ticks)", () => {
  let state: GameState = loadState("fixtures/saves/v41/chapter-four-town.save.json");
  const frames = new Map<string, { frame: number; tx: number; ty: number }[]>();
  for (let tick = 0; tick < 60; tick += 1) {
    state = advanceTick(state);
    for (const walker of state.walkers) {
      if (walker.kind !== "carter") continue;
      const list = frames.get(walker.id) ?? [];
      list.push({ frame: walkerPresentationFor(walker).gaitFrame, tx: walker.position.tx, ty: walker.position.ty });
      frames.set(walker.id, list);
    }
  }
  let checked = 0;
  for (const [id, list] of frames) {
    // Only stretches where the carter walks every tick (a stop holds one frame, as it should).
    let run = 0; let walked = 0; let flips = 0;
    for (let index = 1; index < list.length; index += 1) {
      const a = list[index - 1]!; const b = list[index]!;
      const step = Math.abs(b.tx - a.tx) + Math.abs(b.ty - a.ty);
      if (step < 0.05) { run = 0; continue; }
      walked += step;
      if (b.frame === a.frame) run += step; else { flips += 1; run = 0; }
      assert.ok(run <= 0.75, `${id}: one gait frame held over ${run.toFixed(2)} tiles of walking`);
    }
    if (walked >= 3) { checked += 1; assert.ok(flips >= Math.floor(walked * 2) - 2, `${id}: ${flips} flips over ${walked.toFixed(1)} tiles`); }
  }
  assert.ok(checked >= 3, `${checked} carters walked 3 tiles`);
});

test("NAT-4 QA-026 the step rise: none on the first gait frame, whole device pixels on the second", () => {
  for (const deviceScale of [0.5, 1, 1.4, 2, 4]) {
    const figure = 16;
    assert.equal(walkerStepLift(0, figure, deviceScale), 0);
    const lift = walkerStepLift(1, figure, deviceScale) * deviceScale;
    assert.ok(Number.isInteger(Math.round(lift * 1e9) / 1e9) && lift >= 1, `device scale ${deviceScale}: ${lift} device px`);
    assert.ok(lift <= Math.max(1, 0.1 * figure * deviceScale), `device scale ${deviceScale}: ${lift} device px is a small rise`);
  }
  assert.equal(walkerStepLift(1, 16, 0), 0);
});
