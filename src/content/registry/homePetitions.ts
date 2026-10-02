/**
 * LM-E9 (ER-5): FIX-14's twelve home petitions as registry entries. The home cycle generator (engine/stewardship.ts
 * `homePetitionSeason`) takes its kinds, their order in a cycle and the season's chance from here; each answer runs the
 * existing handler (`answer_estate_petition`), so the treasury and factions move as before (`HOME_PETITION_KINDS`).
 */
import { HOME_PETITION_KINDS, HOME_PETITION_ORDER, HOME_PETITION_PERMILLE } from "../stewardshipConfig";
import type { HomePetitionKind } from "../../engine/stewardship.types";
import type { RegistryEntry } from "./registryTypes";

export const HOME_PETITION_ENTRY_PREFIX = "home:";

export const HOME_PETITION_ENTRIES: readonly RegistryEntry[] = HOME_PETITION_ORDER.map((kind: HomePetitionKind): RegistryEntry => ({
  id: `${HOME_PETITION_ENTRY_PREFIX}${kind}`,
  kind: "petition",
  source: "FIX-14 SW-11",
  window: { fromYear: 1300, toYear: 1450 },
  frequency: { chancePermille: HOME_PETITION_PERMILLE, weight: 1, minGapSeasons: 0, maxPerYear: 4 },
  recurrence: { mode: "cooldown", cooldownSeasons: 0, maxOccurrences: 1_000 },
  sender: HOME_PETITION_KINDS[kind].group,
  bind: "none",
  // The answers are the existing handler's (grant or refuse); the registry does not run their effects again.
  choices: [{ id: "grant", effects: [{ command: "none" }] }, { id: "refuse", effects: [{ command: "none" }] }],
  lapseChoice: "refuse",
  precedent: true,
  artId: null,
  generator: "home_cycle",
}));

/** ER-5: the home kinds in the registry's order (the cycle's base order, each cycle reshuffled from the seed). */
export function homeCycleKinds(entries: readonly RegistryEntry[] = HOME_PETITION_ENTRIES): readonly HomePetitionKind[] {
  return entries.filter(entry => entry.generator === "home_cycle").map(entry => entry.id.slice(HOME_PETITION_ENTRY_PREFIX.length) as HomePetitionKind);
}
