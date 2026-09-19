import type { Building } from "../content/buildingConfig";
import { tileToScreen } from "./iso";
import type { FarmGrowthStage } from "./farmGeometry";

export type CropStage = Exclude<FarmGrowthStage, "worked">;
export type CropRegistration = Readonly<{
  width: number; height: number; anchorX: number; anchorY: number;
  visibleHeight: number; worldHeight: number;
  source: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;
export const CROP_REGISTRATION: Record<CropStage, CropRegistration> = {
  seedling: { width: 1254, height: 1254, anchorX: 652, anchorY: 1017, visibleHeight: 740, worldHeight: 3,
    source: { x: 283, y: 278, width: 742, height: 740 } },
  growing: { width: 1254, height: 1254, anchorX: 650, anchorY: 1108, visibleHeight: 954, worldHeight: 7,
    source: { x: 282, y: 155, width: 737, height: 954 } },
  ripe: { width: 1254, height: 1254, anchorX: 650, anchorY: 1105, visibleHeight: 958, worldHeight: 9,
    source: { x: 244, y: 148, width: 778, height: 958 } },
};

/** Roots belong to a world lattice, so a shared plot edge introduces no extra crop margin. */
export function farmCropRoots(building: Pick<Building, "tx" | "ty">) {
  const roots: { readonly tx: number; readonly ty: number; readonly variation: number }[] = [];
  for (let row = 0; row < 12; row += 1) for (let column = 0; column < 12; column += 1) {
    const gx = building.tx * 6 + column - 3;
    const gy = building.ty * 6 + row - 3;
    const phase = Math.sin(gx * 19.31 + gy * 37.73);
    roots.push({ tx: gx / 6 + 1 / 12 + phase * 0.012 + (Math.abs(gy % 2) - 0.5) * 0.006,
      ty: gy / 6 + 1 / 12 + Math.sin(gx * 41.17 + gy * 11.93) * 0.015,
      variation: 0.92 + (phase + 1) * 0.08 });
  }
  return roots.sort((a, b) => a.tx + a.ty - b.tx - b.ty || a.tx - b.tx);
}

export function cropDestination(root: ReturnType<typeof farmCropRoots>[number], registration: CropRegistration) {
  const { sx, sy } = tileToScreen(root.tx, root.ty);
  const scale = registration.worldHeight / registration.visibleHeight * root.variation;
  return { x: sx - (registration.anchorX - registration.source.x) * scale,
    y: sy - (registration.anchorY - registration.source.y) * scale,
    width: registration.source.width * scale, height: registration.source.height * scale };
}

// A fully opaque interior patch excludes the old plot's authored rim and grass edge.
export const FARM_SOIL_SAMPLE = { x: 690, y: 440, width: 384, height: 192 } as const;
export function farmSoilTiles(building: Pick<Building, "tx" | "ty">) {
  const { sx, sy } = tileToScreen(building.tx + 0.5, building.ty + 0.5);
  const tiles: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[] = [];
  for (let y = Math.floor((sy - 32) / 16) * 16; y < sy + 32; y += 16) {
    for (let x = Math.floor((sx - 64) / 32) * 32; x < sx + 64; x += 32) {
      tiles.push({ x, y, width: 32, height: 16 });
    }
  }
  return tiles;
}
