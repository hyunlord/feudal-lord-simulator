import { operationSuspended, type Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { housePressureStatus } from "../population/housePressure";
import { frameBuildingVariant } from "./buildingVariants";
import { historicalHouseAssetMeta, historicalHouseSpriteRect } from "./historicalHouseAssets";
import { houseCompoundAssetMeta, houseCompoundSpriteRect } from "./houseCompoundAssets";
import { millRegistration } from "./animatedMill";
import { tileToScreen, TILE_H } from "./iso";
import { ROOF_SMOKE_ANCHORS } from "./roofSmokeAnchors.generated";
import { visibilityArt } from "./visibilityArtManifest";
import { drawCroppedWorldSprite } from "./worldSprite";

// F0-V operating signs (visibility design 1절, D6): smoke is "lived in and fed". A house with residents and bread in
// its stock smokes from its ridge (no chimneys: roof smoke, scripts/roofSmokeAnchors.py); its last loaf gives a thin
// plume; an empty house, or residents with no bread (world sign S4, worldSigns.ts), give none. The mill's bread oven smokes while the mill runs (workers, not paused
// or unpaid, wheat in hand or baking under way). Presentation only: read from the state, nothing stored.

// The plume moves on the game clock, not the wall clock: a paused frame is still (the C25 browser board opens each
// view twice and hashes it), 5x runs the smoke five times faster. SMOKE_TICK_MS is the 1x tick seen in the F0-V
// observation (192 ticks in 10.3 s, about 54 ms).
const SMOKE_TICK_MS = 54;
export function smokeClockMs(tick: number): number { return tick * SMOKE_TICK_MS; }

export function houseSmokeStrength(state: Pick<GameState, "houses">, building: Pick<Building, "id">): number {
  const house = state.houses.find(candidate => candidate.buildingId === building.id);
  if (house === undefined || house.residents <= 0 || house.breadStock <= 0) return 0;
  const pressure = housePressureStatus(house);
  if (pressure === "abandoned") return 0;
  // F0-A stage 1 (떠날 준비): the hearth is kept low whatever the larder holds.
  return pressure === "leaving" || house.breadStock <= 1 ? 0.35 : 1;
}

export function millOvenBurning(building: Building): boolean {
  return building.kind === "mill" && building.workers > 0 && !operationSuspended(building)
    && ((building.inventory.wheat ?? 0) > 0 || building.productionProgress > 0);
}

/** Smoke from the house's ridge (single or pair art, variants included), when it has any. */
export function drawHouseRoofSmoke(context: CanvasRenderingContext2D, state: Pick<GameState, "houses">, building: Building, level: number, nowMs: number): void {
  const strength = houseSmokeStrength(state, building);
  if (strength === 0) return;
  const pair = building.houseLot !== undefined;
  const meta = pair ? houseCompoundAssetMeta(building, level) : historicalHouseAssetMeta(level);
  if (meta === null) return;
  const rect = pair ? houseCompoundSpriteRect(building, meta as NonNullable<ReturnType<typeof houseCompoundAssetMeta>>)
    : historicalHouseSpriteRect(building, meta as NonNullable<ReturnType<typeof historicalHouseAssetMeta>>);
  const url = frameBuildingVariant(building)?.url ?? meta.url;
  const anchor = ROOF_SMOKE_ANCHORS[url] ?? ROOF_SMOKE_ANCHORS[meta.url];
  if (anchor === undefined) return;
  drawSmokePlume(context, rect.x + anchor.fx * rect.width, rect.y + anchor.fy * rect.height, strength, nowMs, building.tx * 7 + building.ty * 3);
}

/** The mill's oven dome (about 87 % across and 66 % down its body art). */
const MILL_OVEN = { fx: 0.87, fy: 0.66 } as const;
export function drawMillOvenSmoke(context: CanvasRenderingContext2D, building: Building, nowMs: number): void {
  if (!millOvenBurning(building)) return;
  const center = tileToScreen(building.tx, building.ty);
  const scale = millRegistration.bodyDisplayWidth / millRegistration.body.width;
  const left = center.sx - millRegistration.bodyDisplayWidth / 2;
  const top = center.sy + TILE_H / 2 - millRegistration.groundY * scale;
  drawSmokePlume(context, left + MILL_OVEN.fx * millRegistration.body.width * scale, top + MILL_OVEN.fy * millRegistration.body.height * scale, 1, nowMs, building.tx);
}

/** A rising, fading plume from (x, y): the two Wave 6 smoke frames alternating, 12 x 24 world px. */
function drawSmokePlume(context: CanvasRenderingContext2D, x: number, y: number, strength: number, nowMs: number, seed: number): void {
  const phase = ((nowMs / 1_800 + seed * 0.137) % 1 + 1) % 1;
  const image = visibilityArt(Math.floor(nowMs / 450 + seed) % 2 === 0 ? "smoke_a" : "smoke_b");
  if (image === null) return;
  const width = 12 * (0.7 + 0.3 * strength);
  const height = width * 2;
  context.save();
  context.globalAlpha *= strength * (0.85 - 0.45 * phase);
  drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: 32, height: 64 }, { x: x - width / 2, y: y - height - phase * 6, width, height }, false, true);
  context.restore();
}
