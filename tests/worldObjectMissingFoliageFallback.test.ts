import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { SEMANTIC_PALETTE } from "../src/content/palette";

function runMissingFoliageScenario(): Readonly<Record<string, unknown>> {
  const script = `
class MissingFoliageImage {
  onload = null;
  onerror = null;
  #src = "";

  get src() {
    return this.#src;
  }

  set src(value) {
    this.#src = value;
    queueMicrotask(() => {
      if (value.endsWith("/tree_oak_large.png") || value.endsWith("/stump_fresh.png")) {
        this.onerror?.(new Event("error"));
        return;
      }
      this.onload?.(new Event("load"));
    });
  }
}

function loggedContext() {
  const calls = [];
  let globalAlpha = 1;
  let imageSmoothingEnabled = true;
  let fillStyle = "";
  let strokeStyle = "";
  const context = {
    canvas: { width: 256, height: 256 },
    calls,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value) {
      fillStyle = value;
      calls.push("fillStyle:" + value);
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value) {
      strokeStyle = value;
      calls.push("strokeStyle:" + value);
    },
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(value) {
      globalAlpha = value;
      calls.push("globalAlpha:" + value);
    },
    get imageSmoothingEnabled() {
      return imageSmoothingEnabled;
    },
    set imageSmoothingEnabled(value) {
      imageSmoothingEnabled = value;
      calls.push("smoothing:" + value);
    },
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    setTransform: (a, b, c, d, e, f) => calls.push("setTransform:" + [a, b, c, d, e, f].join(",")),
    drawImage: () => calls.push("drawImage"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    moveTo: (x, y) => calls.push("moveTo:" + x + "," + y),
    lineTo: (x, y) => calls.push("lineTo:" + x + "," + y),
    rect: (x, y, width, height) => calls.push("rect:" + x + "," + y + "," + width + "," + height),
    ellipse: (x, y, rx, ry) => calls.push("ellipse:" + x + "," + y + "," + rx + "," + ry),
    arc: (x, y, radius) => calls.push("arc:" + x + "," + y + "," + radius),
    fillRect: (x, y, width, height) => calls.push("fillRect:" + x + "," + y + "," + width + "," + height),
    strokeRect: (x, y, width, height) => calls.push("strokeRect:" + x + "," + y + "," + width + "," + height),
    fillText: (text, x, y) => calls.push("fillText:" + text + "," + x + "," + y),
  };
  return context;
}

Object.defineProperty(globalThis, "Image", { configurable: true, value: MissingFoliageImage });
const { SEMANTIC_PALETTE } = await import("./src/content/palette.ts");
const { drawStumpDescriptor, drawTreeDescriptor } = await import("./src/render/drawTrees.ts");
const { preloadWorldAssets, spriteMeta } = await import("./src/render/worldAssets.ts");
const { drawWorldSpriteAtWorldAnchor } = await import("./src/render/worldSprite.ts");
await preloadWorldAssets();

const context = loggedContext();
const spriteOptions = { camera: { zoom: 1, panX: 96, panY: 64 }, viewport: { width: 256, height: 256 } };
const directTreeSpriteDrawn = drawWorldSpriteAtWorldAnchor(context, "tree_oak_large", 4, 2, spriteOptions);
const directStumpSpriteDrawn = drawWorldSpriteAtWorldAnchor(context, "stump_fresh", 1, 1, spriteOptions);

drawTreeDescriptor(context, {
  tick: 0,
  tree: {
    id: "tree:missing",
    x: 64,
    y: 96,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    silhouette: "rounded",
    tone: SEMANTIC_PALETTE.forest,
    phase: 0,
    sortY: 96,
    anchorTx: 4,
    anchorTy: 2,
    spriteKey: "tree_oak_large",
  },
  zoom: 1,
  spriteOptions,
});
drawStumpDescriptor(context, {
  descriptor: {
    id: "stump:missing",
    x: 128,
    y: 120,
    scale: 1,
    sortY: 120,
    anchorTx: 1,
    anchorTy: 1,
    spriteKey: "stump_fresh",
  },
  zoom: 1,
  spriteOptions,
});

console.log(JSON.stringify({
  treeStatus: spriteMeta("tree_oak_large")?.status,
  stumpStatus: spriteMeta("stump_fresh")?.status,
  directTreeSpriteDrawn,
  directStumpSpriteDrawn,
  calls: context.calls,
}));
`;
  return JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
    cwd: process.cwd(),
    encoding: "utf8",
  }));
}

test("visible missing tree and stump sprites fall back to procedural marks", () => {
  // Given
  const result = runMissingFoliageScenario();
  const calls = result["calls"];

  // Then
  assert.ok(Array.isArray(calls));
  assert.equal(result["treeStatus"], "missing");
  assert.equal(result["stumpStatus"], "missing");
  assert.equal(result["directTreeSpriteDrawn"], false);
  assert.equal(result["directStumpSpriteDrawn"], false);
  assert.equal(calls.includes("drawImage"), false);
  assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.forest}`));
  assert.ok(calls.includes(`fillStyle:${SEMANTIC_PALETTE.earthDark}`));
  assert.ok(calls.includes("rect:62,76,4,24"));
  assert.ok(calls.includes("ellipse:64,68,17,14"));
  assert.ok(calls.includes("ellipse:128,117,11,5"));
});
