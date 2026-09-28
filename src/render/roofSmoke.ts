import { buildingEntry } from "../content/buildingCatalog";
import { BUILDING_CONFIG_BY_KIND, operationSuspended, type Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { housePressureStatus } from "../population/housePressure";
import { frameBuildingVariant } from "./buildingVariants";
import { shownHouseVariantUrl } from "./wave26HouseArt";
import { historicalHouseAssetMeta, historicalHouseSpriteRect } from "./historicalHouseAssets";
import { houseCompoundAssetMeta, houseCompoundSpriteRect } from "./houseCompoundAssets";
import { millRegistration } from "./animatedMill";
import { historicalFacilityAssetId, historicalFacilitySpriteRect } from "./historicalFacilityAssets";
import type { HistoricalFacilityAssetId } from "./historicalFacilityManifest";
import { tileToScreen, TILE_H } from "./iso";
import { ROOF_SMOKE_ANCHORS } from "./roofSmokeAnchors.generated";
import { visibilityArt } from "./visibilityArtManifest";
import { drawWave7 } from "./wave7Art";
import { drawCroppedWorldSprite } from "./worldSprite";

// F0-V operating signs (visibility design 1절, D6): smoke is "lived in and fed". A house with residents and bread in
// its stock smokes from its ridge (no chimneys: roof smoke, scripts/roofSmokeAnchors.py); its last loaf gives a thin
// plume; an empty house, or residents with no bread (world sign S4, worldSigns.ts), give none. The mill's bread oven smokes while the mill runs (workers, not paused
// or unpaid, wheat in hand or baking under way), and the malt kiln's flue while it malts (INSTALL-3). Presentation only: read from the state, nothing stored.

// INSTALL-23b (user judgement 2026-09-28): the plume moves on the frame's wall clock (`nowMs`), so it rises while the
// game is paused, as water and weather do (the village's animals stop: lifeClock.ts). It was on the game clock
// (SMOKE_TICK_MS a tick, the 1x tick of the F0-V observation, 192 ticks in 10.3 s): a paused frame was still and 5x
// ran the smoke five times faster. Without a frame clock (a caller that passes none) it keeps the game clock.
const SMOKE_TICK_MS = 54;
export function smokeClockMs(tick: number): number { return tick * SMOKE_TICK_MS; }
export function smokeTimeMs(input: { readonly nowMs?: number; readonly state: { readonly tick: number } }): number {
  return input.nowMs ?? smokeClockMs(input.state.tick);
}

export function houseSmokeStrength(state: Pick<GameState, "houses">, building: Pick<Building, "id">): number {
  const house = state.houses.find(candidate => candidate.buildingId === building.id);
  if (house === undefined || house.residents <= 0 || house.breadStock <= 0) return 0;
  const pressure = housePressureStatus(house);
  if (pressure === "abandoned") return 0;
  // F0-A stage 1 (떠날 준비): the hearth is kept low whatever the larder holds.
  return pressure === "leaving" || house.breadStock <= 1 ? 0.35 : 1;
}

/** A working fire burns (BLD-REG: a kind whose catalog `smoke` is `work_fire` — the mill's oven) while it is manned and has its input or a batch under way. */
export function millOvenBurning(building: Building): boolean {
  const input = BUILDING_CONFIG_BY_KIND[building.kind].production?.input ?? null;
  return buildingEntry(building.kind).smoke === "work_fire" && building.workers > 0 && !operationSuspended(building)
    && ((input === null ? 0 : building.inventory[input] ?? 0) > 0 || building.productionProgress > 0);
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
  const url = shownHouseVariantUrl(building, level) ?? frameBuildingVariant(building)?.url ?? meta.url;
  const anchor = ROOF_SMOKE_ANCHORS[url] ?? ROOF_SMOKE_ANCHORS[meta.url];
  if (anchor === undefined) return;
  drawSmokePlume(context, rect.x + anchor.fx * rect.width, rect.y + anchor.fy * rect.height, strength, nowMs, building.tx * 7 + building.ty * 3);
}

/** The mill's oven dome (about 87 % across and 66 % down its body art). */
const MILL_OVEN = { fx: 0.87, fy: 0.66 } as const;
/**
 * INSTALL-3: the malt kiln's flue top on each Wave 3 painting, as a fraction of its facility crop (160 x 128), read off
 * the art: a's squat stone flue at (47, 46), b's round kiln's flue at (127, 35). It is the one flue the no-chimney rule
 * lets smoke — a working fire, only while the kiln malts.
 */
const FACILITY_FLUES: Readonly<Partial<Record<HistoricalFacilityAssetId, { readonly fx: number; readonly fy: number }>>> = {
  malthouse_a: { fx: 47 / 160, fy: 46 / 128 }, malthouse_b: { fx: 127 / 160, fy: 35 / 128 },
};
/** A working fire's smoke (catalog `smoke: "work_fire"`) while it burns: the mill's oven, the kiln's flue. */
export function drawWorkFireSmoke(context: CanvasRenderingContext2D, building: Building, state: GameState, nowMs: number): void {
  if (!millOvenBurning(building)) return;
  if (building.kind !== "mill") {
    const id = historicalFacilityAssetId(building, state);
    const flue = id === null ? undefined : FACILITY_FLUES[id];
    const rect = historicalFacilitySpriteRect(building);
    if (flue !== undefined && rect !== null) drawSmokePlume(context, rect.x + flue.fx * rect.width, rect.y + flue.fy * rect.height, 1, nowMs, building.tx, true);
    return;
  }
  const center = tileToScreen(building.tx, building.ty);
  const scale = millRegistration.bodyDisplayWidth / millRegistration.body.width;
  const left = center.sx - millRegistration.bodyCentreX * scale;
  const top = center.sy + TILE_H / 2 - millRegistration.groundY * scale;
  drawSmokePlume(context, left + MILL_OVEN.fx * millRegistration.body.width * scale, top + MILL_OVEN.fy * millRegistration.body.height * scale, 1, nowMs, building.tx, true);
}

/** INSTALL-7: world px per sheet px of the Wave 7 smoke (a 48 x 80 roof cell is ~14 px wide at zoom 1). */
const SMOKE_SCALE = 0.3;
const SMOKE_FRAME_MS = 180;

/** A rising plume from (x, y): the Wave 7 four-frame sheet (the weak sheet for a thin plume, the oven sheet for the
 * mill), else the two Wave 6 frames alternating, 12 x 24 world px. */
function drawSmokePlume(context: CanvasRenderingContext2D, x: number, y: number, strength: number, nowMs: number, seed: number, oven = false): void {
  const frame = Math.floor(nowMs / SMOKE_FRAME_MS + seed);
  const sheet = oven ? "oven_smoke_sheet" : strength < 0.6 ? "roof_smoke_weak_sheet" : "roof_smoke_sheet";
  context.save();
  context.globalAlpha *= oven ? 0.9 : 0.55 + 0.45 * strength;
  const drawn = drawWave7(context, sheet, x, y, SMOKE_SCALE, frame);
  context.restore();
  if (drawn) return;
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
