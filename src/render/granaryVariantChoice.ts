import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { storageUsage } from "../economy/storage";
import type { GameState } from "../engine/engine.types";
import { textRandom, touching } from "./buildingVariants";
import { seasonBlend, seasonForObject } from "./seasonTransition";
import { WAVE32_GRANARY_VARIANTS, type Wave32GranaryKey } from "./wave32GranaryManifest.generated";

// INSTALL-32 which Wave 32 painting a granary shows instead of barn.png, and which of its layers lie on it: pure choices
// read from the saved state, nothing stored.
// Choice, per granary, as INSTALL-26's per household: seed = hash(world seed, building id), uniform over a, b and c, so
// a granary keeps its painting and a rebuilt one (a new id) is a new pick. Neighbour push as Wave 2's and Wave 26's: a
// touching granary earlier in (ty, tx) order with the same raw pick takes the next painting (raw picks only).
// Layers, drawn in this order on the painting (each painted on its own canvas; Astra's records set no thresholds):
//   1. weathered — kept by fewer hands than it needs (workers < workersRequired) while running: the granary's
//      "run down" (the house takes weathered when strained or neglected; a granary has no household, no rent and no
//      upkeep, and the engine keeps no build tick, so the house's ten-year rule has nothing to read);
//   2. full / half / empty — its stock ratio, storageUsage (all it holds, wheat, bread and barley) over its capacity,
//      the card's own reading. Under the fill: the weathered layer repaints the door and would shut an open one;
//   3. boarded — shut: paused by the lord (or idled by unpaid upkeep, which a granary never owes). The boards take the
//      fill's place: they are nailed over the closed door, and over the open door's sacks they read as a heap;
//   4. snow — winter by the houses' rule (each roof at its own moment while the season turns). Roof only, so it lies
//      over any of the above: a full granary under snow keeps its open door and sacks.

export type Wave32Granary = (typeof WAVE32_GRANARY_VARIANTS)[number];
export type GranaryFill = "full" | "half" | "empty";
export type GranaryLayers = { readonly weathered: boolean; readonly fill: GranaryFill | null; readonly boarded: boolean; readonly snow: boolean };

/** Stock ratio from which a granary shows its full layer (two thirds, where the Wave 7 door pile reached its top). */
export const GRANARY_FULL_FROM = 2 / 3;
/** Stock ratio from which it shows its half layer; below it the door is shut on a near-empty floor (the empty layer). */
export const GRANARY_HALF_FROM = 1 / 5;
const CHOICE_STREAM = 1;

/** The pick before the neighbour push. */
export function rawGranaryVariant(worldSeed: number, buildingId: string): Wave32Granary {
  const index = Math.floor(textRandom(worldSeed, buildingId, CHOICE_STREAM) * WAVE32_GRANARY_VARIANTS.length);
  return WAVE32_GRANARY_VARIANTS[index] as Wave32Granary;
}

/** Every granary's painting by building id, after the neighbour push. */
export function granaryVariantAssignments(state: Pick<GameState, "seed" | "buildings">): ReadonlyMap<string, Wave32Granary> {
  const granaries = state.buildings.filter(building => building.kind === "granary");
  const raw = new Map(granaries.map(building => [building.id, rawGranaryVariant(state.seed, building.id)]));
  const result = new Map<string, Wave32Granary>();
  for (const building of granaries) {
    const pick = raw.get(building.id) as Wave32Granary;
    const pushed = granaries.some(other => other !== building && raw.get(other.id) === pick && touching(other, building)
      && (other.ty < building.ty || (other.ty === building.ty && other.tx < building.tx)));
    result.set(building.id, pushed ? WAVE32_GRANARY_VARIANTS[(WAVE32_GRANARY_VARIANTS.indexOf(pick) + 1) % WAVE32_GRANARY_VARIANTS.length] as Wave32Granary : pick);
  }
  return result;
}

/** What the granary holds over what it can hold (0 for a kind without room). */
export function granaryStockRatio(building: Building): number {
  const usage = storageUsage(building);
  return usage.capacity > 0 ? usage.used / usage.capacity : 0;
}

export function granaryFill(ratio: number): GranaryFill {
  return ratio >= GRANARY_FULL_FROM ? "full" : ratio >= GRANARY_HALF_FROM ? "half" : "empty";
}

/** The granary's layers now (see the order above). */
export function granaryLayers(state: Pick<GameState, "tick" | "scenarioId">, building: Building): GranaryLayers {
  const shut = building.operationPaused === true || building.upkeepUnpaid === true;
  const unkept = !shut && building.workers < BUILDING_CONFIG_BY_KIND[building.kind].workersRequired;
  // INSTALL-15's rule, as the houses': while the season turns, each roof takes or loses its snow at its own moment.
  const snow = seasonForObject(seasonBlend(state), building.tx * 31 + building.ty * 17) === 3;
  return { weathered: unkept, fill: shut ? null : granaryFill(granaryStockRatio(building)), boarded: shut, snow };
}

/** The layer pictures of `variant` for `layers`, in draw order. */
export function granaryLayerKeys(variant: Wave32Granary, layers: GranaryLayers): readonly Wave32GranaryKey[] {
  const states = [layers.weathered ? "weathered" : null, layers.fill, layers.boarded ? "boarded" : null, layers.snow ? "snow" : null];
  return states.filter(state => state !== null).map(state => `${variant.key}_${state}` as Wave32GranaryKey);
}
