import type { GameState } from "../engine/engine.types";
import { constructionSiteDisplayName } from "../economy/construction";

// F0-V: sites that finished between two states (the site is gone and a building took its id, as the renderer's
// completion tracker checks). The app groups those within GROUP_MS into one toast shown for TOAST_MS.
export const COMPLETION_GROUP_MS = 1_500;
export const COMPLETION_TOAST_MS = 4_000;

export function completedSiteNames(previous: GameState, next: GameState): readonly string[] {
  if (previous.constructionSites === next.constructionSites) return [];
  const live = new Set(next.constructionSites.map(site => site.id));
  const built = new Set(next.buildings.map(building => building.id));
  return previous.constructionSites.filter(site => !live.has(site.id) && built.has(site.id)
    && site.kind !== "palisade_segment" && site.kind !== "stone_wall_segment").map(constructionSiteDisplayName);
}
