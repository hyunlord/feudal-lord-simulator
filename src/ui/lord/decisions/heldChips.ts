import type { GameState } from "../../../engine/engine.types";
import { openHomePetitions } from "../../lordCardsModel";
import { openRegistryCards } from "../../registryCardModel";
import { lordMatterChipIds } from "./lordMattersDue";

/**
 * LS1-7 (lord-screen-v1.md; the user's ruling 2026-10-15): the chips held on the rail until answered or past — the
 * engine's matters due (lordMatterChipIds) and, by their engine deadlines, the home estate's petitions and the registry's
 * offers. A card put off (나중에, or a receipt's close returning to the map) is found again by its chip, and newer chips
 * do not push it out. No deadline is computed here: each is the engine's (`petition.deadline`, `occurrence.deadline`).
 */
export function heldChipIds(state: GameState): ReadonlySet<string> {
  const ids = new Set(lordMatterChipIds(state));
  for (const petition of openHomePetitions(state)) ids.add(`home-petition:${petition.id}`);
  for (const card of openRegistryCards(state)) ids.add(`registry:${card.occurrence.id}`);
  return ids;
}
