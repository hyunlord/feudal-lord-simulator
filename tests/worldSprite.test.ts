import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { preloadWorldAssets } from "../src/render/worldAssets";
import {
  drawWorldSprite,
  drawWorldSpriteAtWorldAnchor,
  type WorldSpriteContext,
} from "../src/render/worldSprite";

class ReadyImage {
  onload: ((event: Event) => unknown) | null = null;
  onerror: OnErrorEventHandler = null;
  complete = false;
  naturalWidth = 0;
  #src = "";

  get src(): string {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => {
      this.complete = true;
      this.naturalWidth = 1;
      this.onload?.(new Event("load"));
    });
  }
}

type DrawCall = {
  readonly dx: number;
  readonly dy: number;
  readonly width: number;
  readonly height: number;
};

type Recorder = {
  readonly context: WorldSpriteContext;
  readonly calls: readonly string[];
  readonly drawCalls: readonly DrawCall[];
};

type FakeState = {
  alpha: number;
  smoothing: boolean;
};

const recordingContext = (
  width = 1024,
  height = 768,
  drawFailure: Error | null = null,
): Recorder => {
  const calls: string[] = [];
  const drawCalls: DrawCall[] = [];
  const stack: FakeState[] = [];
  let state: FakeState = { alpha: 0.42, smoothing: true };
  const context: WorldSpriteContext = {
    canvas: { width, height },
    save: () => {
      calls.push("save");
      stack.push({ ...state });
    },
    restore: () => {
      calls.push("restore");
      const restored = stack.pop();
      if (restored !== undefined) state = restored;
    },
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) =>
      calls.push(`setTransform:${a},${b},${c},${d},${e},${f}`),
    drawImage: (_image: CanvasImageSource, dx: number, dy: number, drawWidth: number, drawHeight: number) => {
      drawCalls.push({ dx, dy, width: drawWidth, height: drawHeight });
      calls.push(`drawImage:${dx},${dy},${drawWidth},${drawHeight}`);
      if (drawFailure !== null) throw drawFailure;
    },
    get globalAlpha() {
      return state.alpha;
    },
    set globalAlpha(value: number) {
      state = { ...state, alpha: value };
      calls.push(`globalAlpha:${value}`);
    },
    get imageSmoothingEnabled() {
      return state.smoothing;
    },
    set imageSmoothingEnabled(value: boolean) {
      state = { ...state, smoothing: value };
      calls.push(`smoothing:${value}`);
    },
  };
  return { context, calls, drawCalls };
};

describe("world sprite blitter", () => {
  before(async () => {
    Object.defineProperty(globalThis, "Image", { configurable: true, value: ReadyImage });
    await preloadWorldAssets();
  });

  it("Given an unknown sprite When drawing Then false performs no draw", () => {
    const recorder = recordingContext();

    const drawn = drawWorldSprite(recorder.context, "missing_key", 2, 3);

    assert.equal(drawn, false);
    assert.deepEqual(recorder.drawCalls, []);
  });

  it("Given 1x1 and 2x2 sprites When drawing Then manifest bottom-center anchors meet forward tile anchors", () => {
    const one = recordingContext();
    const two = recordingContext();

    const camera = { zoom: 1, panX: 200, panY: 100 };

    assert.equal(drawWorldSprite(one.context, "well", 2, 4, { camera }), true);
    assert.equal(drawWorldSprite(two.context, "house_l3", 2, 4, { camera }), true);

    assert.deepEqual(one.drawCalls[0], { dx: 100, dy: 132, width: 72, height: 80 });
    assert.deepEqual(two.drawCalls[0], { dx: 56, dy: 52, width: 160, height: 192 });
  });

  it("Given pan zoom and DPR When drawing Then destination rectangles snap in device space", () => {
    const recorder = recordingContext(1200, 900);

    const drawn = drawWorldSprite(recorder.context, "house_l1", 2, 3, {
      camera: { zoom: 1.25, panX: 10.2, panY: 5.7 },
      dpr: 2,
      scale: 1,
    });

    assert.equal(drawn, true);
    assert.deepEqual(recorder.drawCalls[0], { dx: -180, dy: -49, width: 240, height: 300 });
    assert.ok(recorder.calls.includes("setTransform:1,0,0,1,0,0"));
  });

  it("Given a culled destination When drawing Then no image draw occurs and state is restored", () => {
    const recorder = recordingContext(64, 64);

    const drawn = drawWorldSprite(recorder.context, "house_l1", 0, 0, {
      camera: { zoom: 1, panX: -1000, panY: -1000 },
    });

    assert.equal(drawn, false);
    assert.deepEqual(recorder.drawCalls, []);
    assert.equal(recorder.context.globalAlpha, 0.42);
    assert.equal(recorder.context.imageSmoothingEnabled, true);
  });

  it("Given scale alpha and a foliage world anchor When drawing Then draw state is temporary", () => {
    const recorder = recordingContext();

    const drawn = drawWorldSpriteAtWorldAnchor(recorder.context, "shrub_b", 1.25, 2.5, {
      alpha: 0.25,
      camera: { zoom: 1, panX: 100, panY: 50 },
      scale: 0.5,
    });

    assert.equal(drawn, true);
    assert.deepEqual(recorder.drawCalls[0], { dx: 52, dy: 99, width: 16, height: 11 });
    assert.ok(recorder.calls.includes("globalAlpha:0.105"));
    assert.ok(recorder.calls.includes("smoothing:false"));
    assert.equal(recorder.context.globalAlpha, 0.42);
    assert.equal(recorder.context.imageSmoothingEnabled, true);
    assert.deepEqual(recorder.calls.slice(-1), ["restore"]);
  });

  it("Given a ready tree asset When drawing foliage Then the authored sprite path returns true", () => {
    const recorder = recordingContext();

    const drawn = drawWorldSpriteAtWorldAnchor(recorder.context, "tree_oak_large", 3, 4, {
      camera: { zoom: 1, panX: 100, panY: 50 },
    });

    assert.equal(drawn, true);
    assert.equal(recorder.drawCalls.length, 1);
  });

  it("Given drawImage throws When drawing Then canvas state is still restored", () => {
    const failure = new Error("draw failed");
    const recorder = recordingContext(1024, 768, failure);

    assert.throws(
      () => drawWorldSprite(recorder.context, "house_l1", 2, 3, {
        alpha: 0.25,
        camera: { zoom: 1, panX: 200, panY: 100 },
      }),
      failure,
    );
    assert.equal(recorder.context.globalAlpha, 0.42);
    assert.equal(recorder.context.imageSmoothingEnabled, true);
    assert.deepEqual(recorder.calls.slice(-1), ["restore"]);
  });
});
