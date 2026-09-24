import { houseConditionArt } from "./houseConditionArt";
import { drawCroppedWorldSprite } from "./worldSprite";
import type { CanvasTransform } from "./style";
export { preloadConstructionArtAssets } from "./constructionArtAssets";
import { constructionArtImage } from "./constructionArtAssets";
import type { Building } from "../content/buildingConfig";
import { RAMPS } from "../content/palette";
import type { HouseCondition } from "../population/houseCondition";
import { historicalHouseAssetMeta, historicalHouseSpriteRect } from "./historicalHouseAssets";
import { houseCompoundAssetMeta, houseCompoundSpriteRect } from "./houseCompoundAssets";
import { frameBuildingVariant } from "./buildingVariants";
import { BUILDING_VARIANT_OVERLAY_REGISTRATION } from "./buildingVariantOverlay.generated";

export type HouseConditionContext = Pick<CanvasRenderingContext2D, "globalAlpha" | "fillStyle" | "beginPath" | "moveTo" | "lineTo" | "closePath" | "fill" | "save" | "restore" | "drawImage" | "imageSmoothingEnabled"> & { getTransform(): CanvasTransform };

type Point = readonly [number, number];
type Quad = readonly [Point, Point, Point, Point];
type Marks = Readonly<{ wall: Point; roof: Point; opening: Quad }>;

// Coordinates refer to the approved source paintings, not world positions.
const SINGLE: Readonly<Record<number, Marks>> = {
  1: { wall: [657, 980], roof: [612, 552], opening: [[295, 690], [357, 718], [357, 770], [295, 741]] },
  2: { wall: [557, 1020], roof: [615, 374], opening: [[307, 803], [515, 887], [489, 945], [300, 858]] },
  3: { wall: [556, 1035], roof: [760, 490], opening: [[322, 822], [530, 899], [506, 958], [320, 882]] },
  4: { wall: [593, 1073], roof: [643, 369], opening: [[369, 859], [572, 933], [552, 986], [359, 908]] },
};
const HORIZONTAL: Readonly<Record<number, Marks>> = {
  2: { wall: [648, 890], roof: [540, 302], opening: [[398, 721], [590, 794], [572, 836], [387, 772]] },
  3: { wall: [659, 927], roof: [596, 309], opening: [[418, 724], [609, 795], [590, 845], [407, 784]] },
  4: { wall: [549, 1000], roof: [486, 335], opening: [[326, 824], [504, 893], [486, 943], [314, 881]] },
};
const VERTICAL: Readonly<Record<number, Marks>> = {
  2: { wall: [353, 944], roof: [384, 422], opening: [[191, 783], [322, 832], [309, 875], [184, 830]] },
  3: { wall: [394, 1000], roof: [450, 420], opening: [[207, 812], [369, 876], [353, 929], [194, 869]] },
  4: { wall: [420, 1055], roof: [414, 340], opening: [[218, 837], [392, 907], [377, 958], [207, 892]] },
};

export function drawHouseCondition(
  context: HouseConditionContext,
  building: Building,
  builtLevel: number,
  condition: HouseCondition,
): void {
  if (building.kind !== "house" || condition === "maintained") return;
  const frame = conditionFrame(building, builtLevel);
  if (frame !== null) {
    const artwork = houseConditionArt(builtLevel, building.houseLot ?? "single", condition);
    if (artwork?.image !== null && artwork?.image !== undefined) {
      const { meta, rect } = frame;
      const sx = artwork.meta.width / meta.width;
      const sy = artwork.meta.height / meta.height;
      const bounds = meta.alphaBounds;
      drawCroppedWorldSprite(context, artwork.image, { x: bounds.x * sx, y: bounds.y * sy,
        width: bounds.width * sx, height: bounds.height * sy }, rect, false, true);
      return;
    }
  }
  const marks = (building.houseLot === undefined ? SINGLE : building.houseLot === "horizontal" ? HORIZONTAL : VERTICAL)[builtLevel];
  if (frame === null || marks === undefined) return;
  const { meta, rect } = frame;
  const point = ([x, y]: Point): Point => [rect.x + (x - meta.alphaBounds.x) * rect.width / meta.alphaBounds.width,
    rect.y + (y - meta.alphaBounds.y) * rect.height / meta.alphaBounds.height];
  const polygon = (points: readonly Point[]): void => {
    context.beginPath();
    points.forEach((value, index) => { const [x, y] = point(value); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); });
    context.closePath();
    context.fill();
  };
  context.save();
  try {
    const sheet = constructionArtImage('condition');
    if (sheet !== null) {
      // Plaster wear and loose timber are suitable for these historical facades.
      // The stone-bordered boarded opening in the sheet is intentionally unused.
      context.imageSmoothingEnabled = true;
      const decal = (crop: readonly [number, number, number, number], anchor: Point, sourceWidth: number): void => {
        const [x, y] = point(anchor);
        const width = sourceWidth * rect.width / meta.alphaBounds.width;
        const height = width * crop[3] / crop[2];
        drawCroppedWorldSprite(context, sheet, { x: crop[0], y: crop[1], width: crop[2], height: crop[3] },
          { x: x - width / 2, y: y - height / 2, width, height }, false, true);
      };
      context.globalAlpha *= condition === 'strained' ? 0.65 : 0.9;
      decal([30, 230, 292, 410], marks.wall, 64);
      if (condition === 'strained') return;
      if (builtLevel >= 2) decal([345, 300, 326, 310], marks.roof, 130);
      if (condition !== 'vacant') return;
      const [a, b, c, d] = marks.opening;
      const center: Point = [(a[0] + b[0] + c[0] + d[0]) / 4, (a[1] + b[1] + c[1] + d[1]) / 4];
      decal([694, 292, 321, 315], center, (b[0] - a[0]) * 0.80);
      return;
    }
    const [wx, wy] = marks.wall;
    context.globalAlpha *= condition === "strained" ? 0.42 : 0.68;
    context.fillStyle = RAMPS.earth[2];
    polygon([[wx, wy], [wx + 27, wy + 8], [wx + 24, wy + 60], [wx - 9, wy + 48], [wx - 15, wy + 22]]);
    if (condition === "strained") return;
    const [rx, ry] = marks.roof;
    context.fillStyle = RAMPS.timber[3];
    polygon([[rx, ry], [rx + 87, ry + 37], [rx + 67, ry + 67], [rx - 20, ry + 30]]);
    if (condition !== "vacant") return;
    context.globalAlpha /= 0.68;
    context.fillStyle = RAMPS.timber[3];
    polygon(marks.opening);
    context.fillStyle = RAMPS.timber[4];
    const [a, b] = marks.opening;
    polygon([a, b, [b[0], b[1] + 8], [a[0], a[1] + 8]]);
  } finally {
    context.restore();
  }
}

function conditionFrame(building: Building, level: number) {
  if (building.houseLot === undefined) {
    const meta = historicalHouseAssetMeta(level);
    return meta === null ? null : { meta, rect: variantRegisteredRect(building, meta.alphaBounds, historicalHouseSpriteRect(building, meta)) };
  }
  const meta = houseCompoundAssetMeta(building, level);
  return meta === null ? null : { meta, rect: variantRegisteredRect(building, meta.alphaBounds, houseCompoundSpriteRect(building, meta)) };
}

/**
 * Overlays are authored on the base body. On a variant they follow scripts/registerVariantOverlays.py:
 * variant point = scale * base point + (dx, dy) in authored pixels, so the whole overlay frame moves and scales.
 */
function variantRegisteredRect(building: Building, bounds: Readonly<{ x: number; y: number; width: number; height: number }>,
  rect: Readonly<{ x: number; y: number; width: number; height: number }>) {
  const url = frameBuildingVariant(building)?.url ?? null;
  const registration = url === null ? undefined : BUILDING_VARIANT_OVERLAY_REGISTRATION.find(entry => entry.url === url);
  if (registration === undefined) return rect;
  const perX = rect.width / bounds.width; const perY = rect.height / bounds.height;
  return {
    x: rect.x + ((registration.scale - 1) * bounds.x + registration.dx) * perX,
    y: rect.y + ((registration.scale - 1) * bounds.y + registration.dy) * perY,
    width: rect.width * registration.scale, height: rect.height * registration.scale,
  };
}
