import type { GameState } from "../../../engine/engine.types";
import { famineStatus, openPetitions } from "../../../engine/politics";
import { openHomePetitions } from "../../lordCardsModel";
import { openRegistryCards } from "../../registryCardModel";
import { lordMatterChipIds } from "./lordMattersDue";

/**
 * LS1-7 (lord-screen-v1.md; the user's rulings 2026-10-15): the chips held on the rail until answered or past — every
 * decision with a deadline: the engine's matters due (lordMatterChipIds), the home estate's petitions and the registry's
 * offers by their deadlines, a political petition while the engine keeps it open (`openPetitions`: its family's silence
 * rule ends it), the famine while the engine takes an answer (`famineStatus().choices`: its arrival, to `endTick`). A card
 * put off (나중에, or a receipt's close returning to the map) is found again by its chip, and newer chips do not push it
 * out. No deadline is computed here: each end is the engine's. (The town's request has none: it is the week's.)
 */
export function heldChipIds(state: GameState): ReadonlySet<string> {
  const ids = new Set(lordMatterChipIds(state));
  for (const petition of openHomePetitions(state)) ids.add(`home-petition:${petition.id}`);
  for (const card of openRegistryCards(state)) ids.add(`registry:${card.occurrence.id}`);
  for (const petition of openPetitions(state)) ids.add(`petition:${petition.id}`);
  const famine = famineStatus(state);
  if (famine !== null && famine.choices.length > 0) ids.add(`famine:${famine.eventId}`);
  return ids;
}
