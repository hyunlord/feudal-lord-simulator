import assert from "node:assert/strict";
import test from "node:test";

import { TREE_SWAY_MAX_MS, TREE_SWAY_MIN_MS, objectPhase, treeSway, treeSwayPeriodMs } from "../src/render/renderMotion";
import { resetSeasonBlendForTest, seasonBlend, seasonForObject, SEASON_FADE_MS } from "../src/render/seasonTransition";
import { drawWorldSpriteAtWorldAnchor, type WorldSpriteContext } from "../src/render/worldSprite";
import { spriteMeta } from "../src/render/worldAssets";

// NAT-2 (QA-001): the trees sway on the wall clock — slowly (3–6 s, each tree its own period and phase), half the old
// reach, moving while paused and at the same pace at every speed — by a lean about the trunk's foot, not a slide.

const phases = Array.from({ length: 200 }, (_, index) => objectPhase("tree", index % 17, Math.floor(index / 17)));

test("NAT-2: each tree sways once in 3 to 6 seconds, trees out of step", () => {
  for (const phase of phases) {
    const period = treeSwayPeriodMs(phase);
    assert.ok(period >= TREE_SWAY_MIN_MS && period <= TREE_SWAY_MAX_MS, `period ${period}`);
    // 12 s at 60 frames a second: a slow sway crosses zero at most 2 × 12 / 3 = 8 times (the old tick sway at 5x: 275).
    let crossings = 0; let last = treeSway(0, phase, 1);
    for (let frame = 1; frame <= 720; frame += 1) {
      const now = treeSway(frame * 1000 / 60, phase, 1);
      if (Math.sign(now) !== Math.sign(last) && now !== 0) crossings += 1;
      last = now;
    }
    assert.ok(crossings <= 8, `crossings ${crossings}`);
  }
  const periods = new Set(phases.map(phase => Math.round(treeSwayPeriodMs(phase) / 100)));
  assert.ok(periods.size >= 20, `distinct periods ${periods.size}`);
});

test("NAT-2: the sway reaches at most half the old slide (±1 × scale, was ±2 × scale) and moves while paused", () => {
  for (const scale of [0.6, 1, 1.4]) {
    let peak = 0;
    for (let ms = 0; ms < 12_000; ms += 16) peak = Math.max(peak, Math.abs(treeSway(ms, phases[3]!, scale)));
    assert.ok(peak <= scale * 1 + 1e-9 && peak >= scale * 0.95, `peak ${peak} at scale ${scale}`);
  }
  // The input is the wall clock alone: the paused game's tick does not enter, and the crown still moves.
  assert.notEqual(treeSway(1_000, phases[0]!, 1), treeSway(1_500, phases[0]!, 1));
  assert.equal(treeSway(1_000, phases[0]!, 1), treeSway(1_000, phases[0]!, 1));
});

type Call = { readonly transform: readonly number[]; readonly dx: number; readonly dy: number; readonly width: number; readonly height: number };
function recordingContext(): WorldSpriteContext & { readonly calls: Call[] } {
  let transform = [1, 0, 0, 1, 0, 0];
  const calls: Call[] = [];
  return {
    canvas: { width: 800, height: 600 }, globalAlpha: 1, imageSmoothingEnabled: true, calls,
    save: () => {}, restore: () => {},
    setTransform: (a, b, c, d, e, f) => { transform = [a, b, c, d, e, f]; },
    drawImage: (_image, dx, dy, width, height) => { calls.push({ transform: [...transform], dx, dy, width, height }); },
  };
}
const apply = (t: readonly number[], x: number, y: number) => ({ x: t[0]! * x + t[2]! * y + t[4]!, y: t[1]! * x + t[3]! * y + t[5]! });

test("NAT-2: a leaning sprite keeps its foot and moves its top by the lean (plain and flipped)", () => {
  const key = "tree_oak_large";
  const meta = spriteMeta(key);
  assert.ok(meta !== null);
  for (const flipX of [false, true]) {
    for (const zoom of [1, 2]) {
      const context = recordingContext();
      const image = {} as CanvasImageSource;
      const options = { camera: { zoom, panX: 100, panY: 80 }, image, flipX, viewport: { width: 800, height: 600 } };
      assert.equal(drawWorldSpriteAtWorldAnchor(context, key, 5, 3, { ...options, shearX: 0 }), true);
      assert.equal(drawWorldSpriteAtWorldAnchor(context, key, 5, 3, { ...options, shearX: 1 }), true);
      const [still, leaning] = context.calls as [Call, Call];
      // Foot: the anchor's device row; top: the sprite's top row. The lean moves the top by 1 px × zoom, the foot not at all.
      const footY = still.dy + meta.anchor.y * zoom * meta.renderScale;
      // The column drawn (a flipped sprite is drawn at x 0 under a mirroring transform).
      const x = flipX ? still.width / 2 : still.dx + still.width / 2;
      const footStill = apply(still.transform, x, footY);
      const footLean = apply(leaning.transform, x, footY);
      assert.ok(Math.abs(footLean.x - footStill.x) < 0.05, `foot moved ${footLean.x - footStill.x} (flip ${flipX}, zoom ${zoom})`);
      const topStill = apply(still.transform, x, still.dy);
      const topLean = apply(leaning.transform, x, leaning.dy);
      assert.ok(Math.abs(topLean.x - topStill.x - zoom) < 0.05, `top moved ${topLean.x - topStill.x} (flip ${flipX}, zoom ${zoom})`);
    }
  }
});

test("NAT-2: while the season turns every object switches once, whichever clock asks", () => {
  resetSeasonBlendForTest();
  // A summer tick, then the autumn tick: the fade starts at the frame that sees autumn.
  const summer = { tick: 1_999, scenarioId: undefined } as unknown as Parameters<typeof seasonBlend>[0];
  const autumn = { tick: 2_000, scenarioId: undefined } as unknown as Parameters<typeof seasonBlend>[0];
  const salts = Array.from({ length: 500 }, (_, index) => index * 31 + (index % 7) * 17);
  const shown = new Map<number, number[]>();
  const t0 = 10_000;
  seasonBlend(summer, t0);
  for (let frame = 0; frame <= 150; frame += 1) {
    const frameMs = t0 + 16 + frame * 16;
    // The object pass asks with the frame's clock, the countryside and the roofs a little later in the same frame.
    const blends = [seasonBlend(frame === 0 ? autumn : { ...autumn, tick: 2_000 + frame }, frameMs), seasonBlend(autumn, frameMs + 3)];
    for (const salt of salts) {
      const seasons = shown.get(salt) ?? [];
      seasons.push(seasonForObject(blends[salt % 2]!, salt));
      shown.set(salt, seasons);
    }
  }
  for (const [salt, seasons] of shown) {
    let switches = 0;
    for (let index = 1; index < seasons.length; index += 1) if (seasons[index] !== seasons[index - 1]) switches += 1;
    assert.ok(switches <= 1, `salt ${salt} switched ${switches} times`);
    assert.equal(seasons.at(-1), 2, `salt ${salt} ends in autumn`);
  }
  // It was a fade (most objects still showed summer on its first frame), over by the last frame.
  assert.ok([...shown.values()].filter(seasons => seasons[0] === 1).length > 450);
  assert.ok(150 * 16 > SEASON_FADE_MS);
});

test("NAT-2: the fallback chapel's flag flutters on the wall clock, not the tick", async () => {
  const { drawKindDetail } = await import("../src/render/drawBuildingDetails");
  const flagTips = (tick: number, nowMs: number) => {
    const points: number[] = [];
    const context = new Proxy({}, { get: (_target, name) => name === "lineTo" ? (x: number, y: number) => points.push(x, y) : () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    drawKindDetail(context, { tick, nowMs, center: { x: 100, y: 100 }, kind: "chapel", zoom: 1, architecture: "procedural",
      visualState: { houseProblem: null, production: "idle" } as unknown as Parameters<typeof drawKindDetail>[1]["visualState"] });
    return points.join(",");
  };
  assert.equal(flagTips(10, 1_000), flagTips(99, 1_000), "the tick does not move it");
  assert.notEqual(flagTips(10, 1_000), flagTips(10, 1_400), "the wall clock does (also while paused)");
});
