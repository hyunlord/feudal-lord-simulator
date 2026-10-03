import type { Building } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { lordHouse } from "../engine/lordshipState";
import { currentYear, manorLord } from "../engine/persons";
import { openPetitions } from "../engine/politics";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { yardHash } from "./backyardDecals";
import { TILE_W, tileToScreen } from "./iso";
import { manifestArt } from "./manifestArt";
import { MANOR_HOUSE_IMAGES, type ManorHouseKey } from "./manorHouseManifest.generated";

// LM-R1 RUN-01 (QA-027; SPECS/wave12-manor.md, SPECS/endings-manors.md): the manor_house building (FIX-11 places it) draws
// Astra's Wave 12 manor — A or B, fixed by the seed and the building id — instead of the placeholder block. Every
// picture is the same 416 x 328 canvas with Astra's own registration: the pivot (A 249, 319; B 251, 319) is the courtyard
// wall's front ground contact, put on the footprint's front vertex. Not historicalFacilitySpriteRect's horizontal
// centring: the pivot stands 41 px right of the canvas middle, so a centred painting would slide off its plot.
// Scale: the paintings' alpha width (x 20–395 = 376 px in all six, measured) at 0.87 of the footprint diamond's width,
// the fill the historical houses and the fitted buildings use (buildingSpriteFit.ts). Astra drew the manor for a 3 × 3
// plot; the engine's is 2 × 2 (buildingConfig), so it is drawn at 2 × 2's size and stays on its own plot.
// Which picture:
//  - empty (A: manor_house_a_empty-v1; B: only v2, the reworked one) when the lordship says no lord lives there: the
//    family left for its country seat (F5-A LG-1 `legacy.family` "departed"), or the ruling house's family, once in
//    the manor, has no lord there any more (engine `manorLord`: it died out or left). Never while a lord lives there,
//    however quiet the house; a town with no persons yet, or whose ruling family the engine has not made yet (a new
//    game's first season, a new house arriving), keeps the occupied picture.
//  - the activity overlay (the rework-20260926 pictures: the hall's open, lit door and the smoke of its hearth, same
//    canvas and rect) over the occupied picture while a petition waits for the lord's answer (engine `openPetitions`),
//    as the petition crowd gathers: the lord is holding court.
// A picture still loading, or missing, draws nothing here and the building falls back to its block (no empty plot).

const art = manifestArt<ManorHouseKey>(MANOR_HOUSE_IMAGES);
/** The manor paintings' alpha width in art px (x 20–395, the same in A, B, both empty pictures and both overlays). */
export const MANOR_ART_WIDTH = 376;
export const MANOR_FILL = 0.87;

/** A or B, fixed by the seed and the building id. */
export function manorHouseVariant(seed: number, buildingId: string): "a" | "b" {
  return yardHash(`${seed}|${buildingId}`, 12) % 2 === 0 ? "a" : "b";
}

/** Whether the lord lives in the manor (see the header). */
export function lordInResidence(state: Pick<GameState, "legacy" | "persons" | "lordship" | "seed" | "tick" | "scenarioId">): boolean {
  if (state.legacy?.family === "departed") return false;
  if (state.persons === undefined) return true;
  // The ruling house's family not made yet (a new game's first season, a new house arriving): its lord is not gone.
  const order = lordHouse(state).order, tag = `lord-house:${order}`;
  if (![...state.persons.people, ...state.persons.past].some(person => person.tags.includes(tag))) return true;
  return manorLord(state.persons.people, order, currentYear(state)) !== undefined;
}

/** The body picture and the overlay over it (null: none). */
export function manorHousePictures(state: GameState, building: Pick<Building, "id">): { readonly body: ManorHouseKey; readonly active: ManorHouseKey | null } {
  const variant = manorHouseVariant(state.seed, building.id);
  if (!lordInResidence(state)) return { body: `manor_${variant}_empty`, active: null };
  return { body: `manor_${variant}`, active: openPetitions(state).length > 0 ? `manor_${variant}_active` : null };
}

/** World px per art px: the paintings' width at MANOR_FILL of the footprint diamond's width. */
export function manorHouseScale(building: Pick<Building, "kind" | "houseLot">): number {
  const size = buildingFootprint(building);
  return MANOR_FILL * (size.width + size.height) * TILE_W / 2 / MANOR_ART_WIDTH;
}

/** The canvas's world rect, its pivot on the footprint's front vertex. */
export function manorHouseRect(building: Building, seed = 0): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const size = buildingFootprint(building);
  const front = tileToScreen(building.tx + size.width - 0.5, building.ty + size.height - 0.5);
  const meta = MANOR_HOUSE_IMAGES[`manor_${manorHouseVariant(seed, building.id)}`];
  const scale = manorHouseScale(building);
  return { x: front.sx - meta.pivot.x * scale, y: front.sy - meta.pivot.y * scale, width: meta.width * scale, height: meta.height * scale };
}

/** Whether the picture the state shows has loaded (the occlusion outline uses the painting's rect only then). */
export function manorHouseReady(building: Building, state: GameState): boolean {
  return art.art(manorHousePictures(state, building).body) !== null;
}

/** Draws the manor (body, then its overlay); false while the body has not loaded. */
export function drawManorHouse(context: CanvasRenderingContext2D, building: Building, state: GameState): boolean {
  const pictures = manorHousePictures(state, building);
  const size = buildingFootprint(building);
  const front = tileToScreen(building.tx + size.width - 0.5, building.ty + size.height - 0.5);
  const scale = manorHouseScale(building);
  if (!art.draw(context, pictures.body, front.sx, front.sy, scale)) return false;
  if (pictures.active !== null) art.draw(context, pictures.active, front.sx, front.sy, scale);
  return true;
}
