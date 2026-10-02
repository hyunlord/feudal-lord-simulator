/**
 * LM-E8 (spec docs/design/lord-slice.md): the lord's vertical slice — its scenario, its end and the auto-pause's reasons.
 */
import { RESTORE_RIGHT_PETITION_ID } from "./chapterConfig";
import { GREAT_FAMINE_EVENT_ID } from "./eventConfig";
import { BOROUGH_AUTONOMY_PETITION_ID } from "./legacyConfig";
import { BOROUGH_CHARTER_PETITION_ID, GUILD_CHARTER_PETITION_ID } from "./reorganisationConfig";

/** LS-1: the slice's scenario — the demesne and its market town, three neighbour estates, from 1300, always lord mode. */
export { LORD_SLICE_SCENARIO_ID } from "./scenario/coreScenarios";
/** LS-1: the slice ends after this many years, or this many after the lord came to hold a second estate (the sooner). */
export const LORD_SLICE_YEARS = 20;
export const LORD_SLICE_AFTER_SECOND_ESTATE_YEARS = 5;
/** LS-1: the goal's span the player is told (years): "is this town the result of my decisions?" */
export const LORD_SLICE_GOAL_YEARS = { min: 12, max: 20 } as const;
/**
 * LS-1: the factions the slice introduces (the town's dealings: the overlord, the bishop, the two merchant houses, the
 * townsfolk). The crown (events only) and the two neighbour lords (the estate cards' houses) stay in the simulation.
 */
export const LORD_SLICE_FACTIONS = ["overlord", "bishop", "merchant_house_1", "merchant_house_2", "town"] as const;

/** LS-2: why the game stops for the lord (design 3.5); nothing else stops it (a house finished, a shop opened). */
export const PAUSE_REASONS = ["counter_offer", "major_death", "inheritance", "judgment", "rights_petition", "estate_crisis", "estate_gained", "estate_lost"] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number];

/** LS-2: the petitions that put one of the lord's rights at stake (a right to restore, the town's charters and autonomy). */
export const RIGHTS_PETITION_IDS: readonly string[] = [RESTORE_RIGHT_PETITION_ID, GUILD_CHARTER_PETITION_ID, BOROUGH_CHARTER_PETITION_ID, BOROUGH_AUTONOMY_PETITION_ID];

/** LS-2: the ledger lines that stop the game, by reason (each read from the line itself; see `pauseReasons`). */
export const PAUSE_TEMPLATES: Readonly<Record<string, PauseReason>> = {
  "negotiation.countered": "counter_offer",
  "faction.leader_succeeded": "major_death",
  "stewardship.steward_died": "major_death",
  "marriage.father_died": "major_death",
  "legacy.succession": "inheritance",
  "lord.wardship_begun": "inheritance",
  "legacy.heir_seated": "inheritance",
  "marriage.inherited": "inheritance",
  "marriage.contested": "inheritance",
  "marriage.lost": "inheritance",
  "estate.suit_judged": "judgment",
  "decline.entered": "estate_crisis",
  "plague.arrived": "estate_crisis",
  "war.raid": "estate_crisis",
};
/** LS-2: an event's arrival that is an estate's crisis (fires and dearth rehearsals are not). */
export const CRISIS_EVENT_DEFS: readonly string[] = [GREAT_FAMINE_EVENT_ID];
