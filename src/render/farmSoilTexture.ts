import type { Building } from "../content/buildingConfig";
import { tileToScreen } from "./iso";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";

const url = assetUrlForBase("assets/buildings/historical-farm/layers/soil_loam-v1.png", import.meta.env?.BASE_URL ?? "/");
// One immutable material buffer is shared by all farms after loading.
let material: RasterizedWorldSprite | null = null;
let status: "idle" | "loading" | "ready" | "missing" = "idle";
let preload: Promise<void> | null = null;

export function preloadFarmSoilTexture(): Promise<void> {
  if (typeof globalThis.Image !== "function") return Promise.resolve();
  preload ??= new Promise<void>(resolve => {
    status = "loading";
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth === 1254 && image.naturalHeight === 1254) {
        material = rasterizeWorldSprite(image, { x: 0, y: 0, width: 1254, height: 1254 }, 128);
      }
      status = material === null ? "missing" : "ready";
      resolve();
    };
    image.onerror = () => { status = "missing"; resolve(); };
    image.src = url;
  });
  return preload;
}

export function farmSoilTextureStatus() { return { stage: "soil", url, status, buffer: material?.source ?? null }; }

export function farmMaterialTiles(building: Pick<Building, "tx" | "ty">) {
  const { sx, sy } = tileToScreen(building.tx + 0.5, building.ty + 0.5);
  const tiles: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[] = [];
  for (let y = Math.floor((sy - 32) / 64) * 64; y < sy + 32; y += 64) {
    for (let x = Math.floor((sx - 64) / 128) * 128; x < sx + 64; x += 128) {
      tiles.push({ x, y, width: 128, height: 64 });
    }
  }
  return tiles;
}

/** Caller clips to the owned farm contour before drawing the shared material. */
export function drawFarmSoilTexture(context: CanvasRenderingContext2D, building: Pick<Building, "tx" | "ty">): boolean {
  if (material === null) return false;
  for (const tile of farmMaterialTiles(building)) {
    drawCroppedWorldSprite(context, material.image, material.source, tile, false, true);
  }
  return true;
}
