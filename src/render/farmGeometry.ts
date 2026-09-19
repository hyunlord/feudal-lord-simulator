import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { tileToScreen, TILE_H, TILE_W } from "./iso";

export type FarmGrowthStage = "worked" | "seedling" | "growing" | "ripe";
type Point = Readonly<{ x: number; y: number }>;

export const FARM_REGISTRATION = {
  width: 1774, height: 887, anchorX: 885, anchorY: 530,
  scaleX: TILE_W * 2 / 1640,
  upperScaleY: TILE_H / 423,
  lowerScaleY: TILE_H / 320,
} as const;

export function farmGrowthStage(building: Pick<Building, "productionProgress">): FarmGrowthStage {
  const period = BUILDING_CONFIG_BY_KIND.wheat_farm.production?.ticksPerOutput ?? 40;
  const fraction = building.productionProgress / period;
  if (fraction < 0.25) return "worked";
  if (fraction < 0.5) return "seedling";
  if (fraction < 0.75) return "growing";
  return "ripe";
}

export function farmGroundPoint(source: Point): Point {
  const r = FARM_REGISTRATION;
  return {
    x: (source.x - r.anchorX) * r.scaleX,
    y: (source.y - r.anchorY) * (source.y < r.anchorY ? r.upperScaleY : r.lowerScaleY),
  };
}

export function farmGroundCenter(building: Pick<Building, "tx" | "ty">): Point {
  const center = tileToScreen(building.tx + 0.5, building.ty + 0.5);
  return { x: center.sx, y: center.sy };
}

/** Ground-only contour: shared farm edges are untouched; exposed edges recede into owned land. */
export function farmBoundary(building: Pick<Building, "tx" | "ty">, buildings: readonly Building[]) {
  const points: { readonly tx: number; readonly ty: number }[] = [];
  const sides = [
    { x: -0.5, y: -0.5, dx: 1, dy: 0, nx: 0, ny: 1 },
    { x: 1.5, y: -0.5, dx: 0, dy: 1, nx: -1, ny: 0 },
    { x: 1.5, y: 1.5, dx: -1, dy: 0, nx: 0, ny: -1 },
    { x: -0.5, y: 1.5, dx: 0, dy: -1, nx: 1, ny: 0 },
  ] as const;
  for (const side of sides) for (let tile = 0; tile < 2; tile += 1) {
    const x = building.tx + side.x + side.dx * tile;
    const y = building.ty + side.y + side.dy * tile;
    const outsideX = x + side.dx * 0.5 - side.nx * 0.5;
    const outsideY = y + side.dy * 0.5 - side.ny * 0.5;
    const shared = buildings.some(other => other.kind === "wheat_farm"
      && outsideX >= other.tx && outsideX < other.tx + 2
      && outsideY >= other.ty && outsideY < other.ty + 2);
    const phase = x * 1.73 + y * 2.31;
    for (let step = 0; step < 8; step += 1) {
      const fraction = step / 8;
      const inset = shared ? 0 : Math.sin(Math.PI * fraction) ** 2
        * (0.045 + 0.022 * Math.sin(phase + fraction * Math.PI * 2));
      points.push({ tx: x + side.dx * fraction + side.nx * inset,
        ty: y + side.dy * fraction + side.ny * inset });
    }
  }
  return points;
}
