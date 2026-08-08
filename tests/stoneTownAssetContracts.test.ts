import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { RAMPS } from "../src/content/palette";
import { drawBuildings } from "../src/render/drawBuildings";
import { drawPalisadeSegment } from "../src/render/drawPalisadeSegments";
import { writePng, type RgbaImage } from "../scripts/processBuildingSprite";
import { processWorldSprite } from "../scripts/worldSpritePipeline";
import {
  STONE_TOWN_ASSET_CANDIDATE_COUNT,
  STONE_TOWN_ASSET_GENERATION_CONTRACTS,
  STONE_TOWN_ASSET_KEYS,
  STONE_TOWN_ASSET_SPECS,
} from "../scripts/worldAssetContracts";
import { assertStoneTownSelectedAssetSet } from "../scripts/verifyWorldAssets";

type LoggedContext = CanvasRenderingContext2D & {
  readonly calls: readonly string[];
};

const rgba = (hex: string, alpha = 255): readonly [number, number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
};

const blank = (width: number, height: number): RgbaImage => ({
  dimensions: { width, height },
  rgba: new Uint8Array(width * height * 4),
});

const fill = (
  image: RgbaImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
  colour: readonly [number, number, number, number],
): void => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) image.rgba.set(colour, (y * image.dimensions.width + x) * 4);
  }
};

const selectedFixture = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), "stone-town-selected-"));
  for (const key of STONE_TOWN_ASSET_KEYS) {
    const spec = STONE_TOWN_ASSET_SPECS[key];
    const image = blank(spec.width, spec.height);
    fill(image, 8, 8, spec.width - 8, Math.min(spec.baselineY, spec.height - 1), rgba(RAMPS.stone[2]));
    writePng(path.join(root, `${key}.png`), image);
  }
  return root;
};

const loggedContext = (): LoggedContext => {
  const calls: string[] = [];
  const context = {
    canvas: { width: 800, height: 600 },
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineCap: "butt",
    lineJoin: "miter",
    lineWidth: 0,
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    ellipse: () => calls.push("ellipse"),
    fill: () => calls.push("fill"),
    fillRect: () => calls.push("fillRect"),
    lineTo: () => calls.push("lineTo"),
    moveTo: () => calls.push("moveTo"),
    rect: () => calls.push("rect"),
    restore: () => calls.push("restore"),
    save: () => calls.push("save"),
    setLineDash: () => calls.push("setLineDash"),
    stroke: () => calls.push("stroke"),
    strokeRect: () => calls.push("strokeRect"),
  };
  return context as unknown as LoggedContext;
};

describe("Stone Town asset generation contracts", () => {
  it("declares the seven exact pre-DGX contracts and six candidate slots", () => {
    assert.deepEqual([...STONE_TOWN_ASSET_KEYS], [
      "quarry",
      "masonry",
      "market",
      "church",
      "keep",
      "house_l4",
      "stone_wall_segment",
    ]);
    assert.equal(STONE_TOWN_ASSET_CANDIDATE_COUNT, 6);
    assert.deepEqual(
      Object.fromEntries(STONE_TOWN_ASSET_KEYS.map((key) => [key, [STONE_TOWN_ASSET_SPECS[key].width, STONE_TOWN_ASSET_SPECS[key].height]])),
      {
        quarry: [160, 120],
        masonry: [112, 120],
        market: [176, 136],
        church: [176, 208],
        keep: [176, 232],
        house_l4: [112, 160],
        stone_wall_segment: [96, 80],
      },
    );
    assert.equal(STONE_TOWN_ASSET_GENERATION_CONTRACTS.keep.referenceKeys.join(","), "house_03,mill_02,granary_08");
    assert.match(STONE_TOWN_ASSET_GENERATION_CONTRACTS.market.form, /trestle tables/);
    assert.doesNotMatch(STONE_TOWN_ASSET_GENERATION_CONTRACTS.church.form, /function|implementation|sprite key/u);
  });

  it("rejects missing, extra, wrong-size, non-palette, and baked-background selected PNGs", () => {
    const root = selectedFixture();
    try {
      assert.doesNotThrow(() => assertStoneTownSelectedAssetSet(root));

      rmSync(path.join(root, "market.png"));
      assert.throws(() => assertStoneTownSelectedAssetSet(root), /missing PNG.*market\.png/);

      const replacement = selectedFixture();
      try {
        writePng(path.join(replacement, "extra.png"), blank(8, 8));
        assert.throws(() => assertStoneTownSelectedAssetSet(replacement), /unexpected PNG.*extra\.png/);
      } finally {
        rmSync(replacement, { recursive: true, force: true });
      }

      const invalid = selectedFixture();
      try {
        writePng(path.join(invalid, "keep.png"), blank(176, 231));
        assert.throws(() => assertStoneTownSelectedAssetSet(invalid), /keep.*176x231.*176x232/);
        const offPalette = blank(176, 232);
        fill(offPalette, 12, 12, 40, 40, [1, 2, 3, 255]);
        writePng(path.join(invalid, "keep.png"), offPalette);
        assert.throws(() => assertStoneTownSelectedAssetSet(invalid), /keep.*non-canonical colour/);
        const opaqueBackground = blank(176, 232);
        fill(opaqueBackground, 0, 0, 176, 232, rgba(RAMPS.earth[2]));
        writePng(path.join(invalid, "keep.png"), opaqueBackground);
        assert.throws(() => assertStoneTownSelectedAssetSet(invalid), /keep.*transparent background|baked opaque background/);
      } finally {
        rmSync(invalid, { recursive: true, force: true });
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps processed stone wall candidates inside the transparent release boundary", () => {
    const root = selectedFixture();
    try {
      const source = blank(1024, 1024);
      fill(source, 0, 0, 1024, 1024, rgba(RAMPS.stone[2]));
      writePng(path.join(root, "stone_wall_segment.png"), processWorldSprite(source, "stone_wall_segment"));

      assert.doesNotThrow(() => assertStoneTownSelectedAssetSet(root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps runtime fallbacks drawable when all seven new selected PNGs are absent", () => {
    const context = loggedContext();
    drawBuildings(context, {
      state: {
        tick: 0,
        seed: 1,
        width: 8,
        height: 3,
        tiles: [],
        buildings: [
          { id: "quarry", kind: "quarry", tx: 0, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
          { id: "masonry", kind: "masonry", tx: 2, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
          { id: "market", kind: "market", tx: 3, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
          { id: "church", kind: "church", tx: 4, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
          { id: "keep", kind: "keep", tx: 5, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
          { id: "house", kind: "house", tx: 6, ty: 0, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
        ],
        constructionSites: [],
        houses: [{ buildingId: "house", level: 4, residents: 32, hasWater: true, breadStock: 10, lastServicedTick: 0, unmetRequirementTicks: 0 }],
        walkers: [],
        population: 32,
        idleWorkers: 0,
        treasuryTimber: 0,
        treasuryCoin: 0,
        wallTick: 0,
        era: "stone_town",
        eraProclaimedTick: 0,
        palisade: null,
        forestHarvests: [],
        nextConstructionOrdinal: 1,
        roadRevision: 0,
        pathCache: {},
      },
      tiles: [],
      range: { minTx: 0, minTy: 0, maxTx: 8, maxTy: 3 },
      zoom: 0.7,
    });
    drawPalisadeSegment(context, {
      segment: {
        id: "stone-wall",
        order: 0,
        gateDistance: 0,
        edgePath: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
        tileCount: 1,
        completed: true,
        constructionSiteId: null,
        material: "stone",
        replacementConstructionSiteId: null,
      },
      gate: null,
      zoom: 0.7,
    });

    assert.equal(context.calls.filter((call) => call === "fill").length >= 6, true);
    assert.ok(context.calls.includes("fillRect"));
  });
});
