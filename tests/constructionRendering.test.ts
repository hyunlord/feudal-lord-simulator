import assert from "node:assert/strict";
import test from "node:test";

import type {
  BuildingConstructionSite,
  PalisadeConstructionSite,
} from "../src/economy/construction";
import { createPalisadeConstructionSite } from "../src/economy/construction";
import { SEMANTIC_PALETTE } from "../src/content/palette";
import {
  constructionCompletionEffects,
  constructionSiteRenderSignature,
  drawConstructionSite,
} from "../src/render/drawConstructionSites";
import { drawPalisadeRun, drawPalisadeSegment } from "../src/render/drawPalisadeSegments";
import { constructionSiteLabelAnchor, constructionSiteLabelBoxes } from "../src/render/constructionSiteLabelLayout";
import { building, state as makeState } from "./stoneWallConversionFixtures";
import { loggedContext } from "./constructionRenderingFixtures";

test("proposal plot remains visibly distinct at minimum zoom", () => {
  // Given
  const context = loggedContext();

  // When
  drawPalisadeRun(context, {
    path: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
    style: "plot",
    zoom: 0.5,
  });

  // Then
  assert.ok(context.calls.includes("setLineDash:8,8"));
  assert.ok(context.calls.includes(`strokeStyle:${SEMANTIC_PALETTE.gold}`));
  assert.equal(context.lineWidth, 4);
});

function site(patch: Partial<BuildingConstructionSite> = {}): BuildingConstructionSite {
  return {
    id: "construction-site-000001",
    kind: "storehouse",
    tx: 2,
    ty: 1,
    required: { timber: 40 },
    delivered: { timber: 12 },
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 800,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
    ...patch,
  };
}

function wallSite(patch: Partial<PalisadeConstructionSite> = {}): PalisadeConstructionSite {
  return {
    ...createPalisadeConstructionSite({
      id: "wall-a-segment-000",
      wallId: "wall-a",
      segmentIndex: 0,
      gateDistance: 0,
      order: 0,
      path: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
      startedTick: 0,
    }),
    ...patch,
  };
}

test("constructionSiteRenderSignature exposes the exact four visual stage names", () => {
  // Given
  const base = site();

  // When / Then
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 0 }), "plot");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 200 }), "foundation");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 440 }), "frame");
  assert.equal(constructionSiteRenderSignature({ ...base, builderTicks: 680 }), "roof");
});

test("drawConstructionSite records distinct plot foundation frame and roof signatures with a builder mark", () => {
  // Given
  const stages = [
    site({ builderTicks: 0 }),
    site({ builderTicks: 200 }),
    site({ builderTicks: 440 }),
    site({ builderTicks: 680 }),
  ] as const;

  // When
  const signatures = stages.map((stageSite) => {
    const context = loggedContext();
    drawConstructionSite(context, { site: stageSite, zoom: 0.5 });
    const expectedCalls = new Set([
      "moveTo:48,48",
      "moveTo:88,52",
      "rect:33,44,70,12",
      "moveTo:46,40",
      "rect:41,10,10,40",
      "rect:86,10,10,40",
      "moveTo:36,14",
      "lineTo:69,-10",
      "fillRect:63,37,10,8",
      "fillRect:67,29,2,8",
    ]);
    return context.calls.filter((call) => expectedCalls.has(call));
  });

  // Then
  assert.deepEqual(signatures.map((signature) => signature.slice(-4)), [
    ["moveTo:48,48", "moveTo:88,52", "fillRect:63,37,10,8", "fillRect:67,29,2,8"],
    ["rect:33,44,70,12", "moveTo:46,40", "fillRect:63,37,10,8", "fillRect:67,29,2,8"],
    ["rect:41,10,10,40", "rect:86,10,10,40", "fillRect:63,37,10,8", "fillRect:67,29,2,8"],
    ["moveTo:36,14", "lineTo:69,-10", "fillRect:63,37,10,8", "fillRect:67,29,2,8"],
  ]);
});

test("drawConstructionSite writes the exact current stall label with delivered and required counts", () => {
  // Given
  const context = loggedContext();

  // When
  drawConstructionSite(context, { site: site(), zoom: 1 });

  // Then
  assert.ok(context.calls.includes("measureText:🪵 목재 오는 중 (12/40)"));
  // The 2x2 storehouse footprint centre is (32, 64); the roof-stage art tops out 52 px above it (y 12).
  assert.ok(context.calls.includes("fillText:🪵 목재 오는 중 (12/40),-40,-5"));
  assert.ok(context.calls.includes("fillRect:-44,-18,152,18"), "box centred on the footprint, above the art");
});

test("drawConstructionSite ties its label to its own footprint with a leader line down to the site", () => {
  // Given
  const context = loggedContext();

  // When
  drawConstructionSite(context, { site: site(), zoom: 1 });

  // Then: a vertical stroke from the box's bottom centre to the footprint centre, drawn with the ink outline.
  const leader = context.calls.indexOf("moveTo:32,0");
  assert.ok(leader > 0);
  assert.equal(context.calls[leader + 1], "lineTo:32,64");
  assert.equal(context.calls[leader + 2], "stroke");
  assert.ok(context.calls.slice(0, leader).includes("strokeStyle:#2A2118"));
});

test("neighbouring construction labels step up instead of overlapping", () => {
  // Given: two labelled sites side by side whose labels would share a row.
  const first = site({ id: "construction-site-000001", stall: "no_builders", delivered: { timber: 40 } });
  const second = site({ id: "construction-site-000002", tx: 3, ty: 1, stall: "no_builders", delivered: { timber: 40 } });
  const state = makeState({ width: 8, height: 8, palisade: null, houses: [], walkers: [], buildings: [],
    constructionSites: [first, second] });

  // When: the label layout still steps rows, and F0-V's site plaques (drawn with a state) step the same way.
  const boxes = constructionSiteLabelBoxes([{ site: first, label: "👷 일꾼 없음" }, { site: second, label: "👷 일꾼 없음" }], 1, text => text.length * 8);
  const firstContext = loggedContext();
  const secondContext = loggedContext();
  drawConstructionSite(firstContext, { site: first, state, zoom: 1 });
  drawConstructionSite(secondContext, { site: second, state, zoom: 1 });

  // Then
  const a = boxes.get(first.id);
  const b = boxes.get(second.id);
  assert.ok(a !== undefined && b !== undefined);
  assert.ok(b.y + b.height <= a.y, "the later label sits a full row above the earlier one");
  assert.equal(b.leaderX, constructionSiteLabelAnchor(second).x, "still centred on its own site");
  const plaque = (calls: readonly string[]) => calls.filter(call => call.startsWith("fillRect:")).map(call => call.slice(9).split(",").map(Number))
    .find(([, , width, height]) => width === 72 && height! > 10);
  const firstPlaque = plaque(firstContext.calls);
  const secondPlaque = plaque(secondContext.calls);
  assert.ok(firstPlaque !== undefined && secondPlaque !== undefined, "each site draws a 72 px plaque");
  assert.ok(secondPlaque[1]! + secondPlaque[3]! <= firstPlaque[1]!, "the later plaque sits above the earlier one");
  assert.equal(secondPlaque[0]! + 36, constructionSiteLabelAnchor(second).x, "centred on its own site");
});

test("drawConstructionSite shows the live road break before the stored delivery stall catches up", () => {
  // Given
  const stalledSite = site({ kind: "well", tx: 5, ty: 5 });
  const state = makeState({
    width: 8, height: 8, palisade: null, houses: [], walkers: [],
    buildings: [building("source", "storehouse", 1, 1, { inventory: { timber: 20 } })],
    constructionSites: [stalledSite],
    tiles: Array.from({ length: 64 }, (_, index) => {
      const tx = index % 8, ty = Math.floor(index / 8);
      return {
        tx, ty, terrain: "grass" as const, hasRoad: tx === 2 && ty === 3,
        buildingId: tx === 5 && ty === 5 ? stalledSite.id : null,
      };
    }),
  });
  const context = loggedContext();

  // When
  drawConstructionSite(context, { site: stalledSite, state, zoom: 1 });

  // Then: F0-V's plaque names the live road break (the blocker), not the stored delivery stall.
  assert.ok(context.calls.some(call => call.startsWith("fillText:길 끊김")), JSON.stringify(context.calls.filter(call => call.startsWith("fillText"))));
  assert.equal(context.calls.some(call => call.includes("목재 오는 중") || call.includes("목재 0/")), false);
});

test("drawConstructionSite gives queued palisade segments a dashed gate-order label without a stall label", () => {
  // Given
  const context = loggedContext();

  // When
  drawConstructionSite(context, {
    site: wallSite(),
    schedule: { kind: "queued", position: 2 },
    zoom: 1,
  });

  // Then
  assert.ok(context.calls.includes("setLineDash:6,4"));
  assert.ok(context.calls.includes("measureText:성벽 2번째 대기"));
  assert.ok(context.calls.includes("fillText:성벽 2번째 대기,42,0"));
  assert.equal(context.calls.some((call) => call.includes("목재 오는 중")), false);
});

test("drawConstructionSite records four active palisade construction stages along the wall edge", () => {
  // Given
  const stages = [
    wallSite({ builderTicks: 0, delivered: { timber: 60 }, stall: "no_builders" }),
    wallSite({ builderTicks: 30, delivered: { timber: 60 }, stall: "no_builders" }),
    wallSite({ builderTicks: 72, delivered: { timber: 60 }, stall: "none" }),
    wallSite({ builderTicks: 108, delivered: { timber: 60 }, assignedBuilders: 1, stall: "none" }),
  ] as const;

  // When
  const signatures = stages.map((stageSite) => {
    const context = loggedContext();
    drawConstructionSite(context, {
      site: stageSite,
      schedule: { kind: "active" },
      zoom: 1,
    });
    return context.calls;
  });

  // Then
  assert.deepEqual(signatures.map((signature) => signature.includes("moveTo:0,16")), [
    true,
    true,
    true,
    true,
  ]);
  assert.deepEqual(signatures.map((signature) => signature.includes("lineTo:128,80")), [
    true,
    true,
    true,
    true,
  ]);
  assert.ok(signatures[0]?.includes("setLineDash:4,4"));
  assert.ok(signatures[1]?.includes("fillRect:61,34,7,16"));
  assert.ok(signatures[2]?.includes("fillRect:29,-4,6,38"));
  assert.ok(signatures[2]?.includes("fillRect:93,28,6,38"));
  assert.ok(signatures[3]?.includes("fillRect:61,43,10,8"));
  assert.ok(signatures[3]?.includes("fillRect:65,35,2,8"));
});

test("drawPalisadeSegment opens a timber passage with flanking piers and a raised lintel", () => {
  // Given
  const plainContext = loggedContext();
  const gateContext = loggedContext();
  const segment = {
    id: "wall-a-segment-000",
    order: 0,
    edgePath: [{ x: 1, y: 1 }, { x: 5, y: 1 }],
    tileCount: 4,
    completed: true,
    constructionSiteId: null,
  } as const;

  // When
  drawPalisadeSegment(plainContext, { segment, gate: null, zoom: 1 });
  drawPalisadeSegment(gateContext, { segment, gate: { x: 3, y: 1 }, zoom: 1 });

  // Then
  const plainPosts = plainContext.calls.filter((call) => call.startsWith("fillRect:"));
  const gatePosts = gateContext.calls.filter((call) => call.startsWith("fillRect:"));
  assert.equal(plainPosts.length, 4, "preserve four cumulative-distance posts on the completed run");
  assert.equal(gatePosts.length, 4, "two distant wall posts plus two gate piers");
  assert.equal(gatePosts.filter(call => call.endsWith(",8,32")).length, 2);
  for (const call of gatePosts) {
    const [x, , width] = call.slice("fillRect:".length).split(",").map(Number);
    assert.ok(x !== undefined && width !== undefined);
    assert.ok(x + width <= 39 || x >= 89, "ground posts stay outside the road passage");
  }
  assert.equal(gateContext.calls.filter(call => call === "moveTo:64,21").length, 2,
    "both lintel halves meet above the walker's head");
  assert.ok(!gateContext.calls.includes("fillRect:61,43,12,16"), "no solid gate marker blocks the passage");
});

test("constructionCompletionEffects derives a short pop and dust from previous and current snapshots only", () => {
  // Given
  const previous = [site({ id: "construction-site-000001", tx: 2, ty: 1 })];
  const current = [site({ id: "construction-site-000002", tx: 5, ty: 1 })];

  // When
  const fresh = constructionCompletionEffects({ previous, current, nowMs: 1_000, startedAtMs: 900 });
  const expired = constructionCompletionEffects({ previous, current, nowMs: 1_101, startedAtMs: 900 });

  // Then
  assert.deepEqual(fresh, [{ id: "construction-site-000001", tx: 2, ty: 1, ageMs: 100 }]);
  assert.deepEqual(expired, []);
  assert.deepEqual(previous.map(({ id }) => id), ["construction-site-000001"]);
});
