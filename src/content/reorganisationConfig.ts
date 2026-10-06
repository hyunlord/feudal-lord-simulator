/**
 * F4-A chapter 4's reorganisation (spec docs/design/chapter-four-reorganisation.md RG-*): after the Black Death the town
 * grows rich on cloth and asks for rights — the wage competition, the textile street, the alehouses, the petitions, the
 * guild, the earl's warning, the poll tax and the rumour of 1381, the charter. Values are integers (permille for
 * fractions, pennies for money) and a hypothesis (decision RG3), to be tuned after play.
 */
import type { PetitionDef } from "./chapterConfig";
import { packChapter } from "./packSettings";

/** RG-1: a scenario that lists this id in `activeEvents` has the reorganisation. */
export const REORGANISATION_SEQUENCE_ID = "reorganisation_1362";

/** RG-5…RG-9: the four decisions, one petition each (the Wave 21 chapter-4 decision cards, 1:1). */
export const GUILD_CHARTER_PETITION_ID = "guild_charter";
export const TAX_COLLECTION_PETITION_ID = "tax_collection";
export const CLOTH_OR_GRAIN_PETITION_ID = "cloth_or_grain";
export const BOROUGH_CHARTER_PETITION_ID = "borough_charter";
export const REORGANISATION_PETITION_IDS = [GUILD_CHARTER_PETITION_ID, CLOTH_OR_GRAIN_PETITION_ID, TAX_COLLECTION_PETITION_ID, BOROUGH_CHARTER_PETITION_ID] as const;
export type ReorganisationPetitionId = (typeof REORGANISATION_PETITION_IDS)[number];

/** RG-9: the rights a partial charter hands the town (their holder `townsfolk`). */
export const MARKET_TOLLS_RIGHT_ID = "market_tolls";
export const BRIDGE_TOLLS_RIGHT_ID = "bridge_tolls";

export const REORGANISATION_BALANCE = {
  /** RG-1: the sandbox's sequence begins in the spring of this year (the campaign's with chapter 4). */
  sandboxStartYear: 1364,

  /** RG-2 the wage competition: a season after the start, for this many seasons, a household in `permille` a season leaves. */
  wageCompetitionAfter: 1,
  wageCompetitionSeasons: 4,
  wageCompetitionPermille: 350,

  /** RG-1 the textile street: from this many seasons after the start, the first season with this many weaver's houses. */
  textileStreetAfter: 4,
  textileStreetWeavers: 2,
  /** RG-1 the alehouses: from this many seasons after the start, the alehouses and the casks drunk last season. */
  alehouseBoomAfter: 8,
  alehouseBoomAlehouses: 3,
  alehouseBoomDrunk: 12,
  /** RG-1 the petitions: from the spring of `surgeFromYear` once both have come, else in the spring of `surgeLatestYear`. */
  surgeFromYear: 1368,
  surgeLatestYear: 1372,
  /** RG-1: the guild's demand this many seasons after the surge; the cloth-or-grain question as many after the guild's. */
  guildAfterSurge: 4,
  clothAfterGuild: 4,
  /** RG-4: the earl warns once the town community's influence reaches this (from the guild's demand). */
  warningInfluence: 50,

  /** RG-6 the poll tax: the petition in the spring of 1377; its collections once answered (year, in-year season: 0 spring … 3 winter). */
  pollTaxYear: 1377,
  pollTaxCollections: [[1377, 1], [1379, 0], [1381, 1]] as readonly (readonly [number, number])[],
  /** The lord's share of a collection, a penny an adult (14 and over): the town's composition, or the lord's collectors. */
  delegatedPerAdult: 1,
  directPerAdult: 3,
  adultAge: 14,

  /** RG-8 the rumour of 1381 (summer): its causes' pressure; the collectors are chased at `revoltThreshold` or more. */
  rebellionYear: 1381,
  rebellionSeason: 1,
  revoltThreshold: 50,
  pressure: {
    direct_collection: 40,
    labour_services: 20,
    wages_bound: 10,
    guild_refused: 10,
    cloth_specialised: 10,
    commons_estranged: 10,
  },

  /** RG-9: the town's demand for a charter — sooner with a guild (the spring of this year), else later. */
  autonomyWithGuildYear: 1382,
  autonomyYear: 1384,
  /** RG-9: a partial charter: the town's yearly fee farm (spring), the toll share left to the lord (permille). */
  feeFarm: 120,
  bridgeTollPermille: 500,
  /** RG-9: a refusal's backlash in chapter 5 is the town's influence, at least this. */
  backlashFloor: 30,

  /** RG-10: chapter 4 ends at the latest in the spring of this year. */
  chapterEndYear: packChapter(4).toYear,

  /** RG-5 the guild: the cloth buildings' working time with it (permille), the weaving time after a refusal, the households that leave. */
  guildTicksPermille: 750,
  refusedWeavingPermille: 1_250,
  refusedWeaverHouseholds: 2,

  /** RG-3 the cloth trade from chapter 4: the price (the owners'), specialised; the seal; the lord's cloth toll (a share of the price). */
  clothPrice: 40,
  specialisedClothPrice: 50,
  ulnagePerCloth: 8,
  clothTollPermille: 200,
  /** RG-3: the dyes the merchants bring a working dyehouse each season from chapter 4 (up to `CLOTH_BALANCE.dyesHeld`). */
  dyesPerSeason: 20,
  /** RG-7: a specialised town's share of a bad harvest (a wet summer, a dearth — its ploughland under sheep), permille. */
  specialisedHarvestPermille: 850,

  /** RG-4 influence: the parts and their caps. */
  influence: {
    peoplePerPoint: 20, peopleCap: 40,
    clothPerPoint: 2, clothCap: 30,
    guild: 20,
    rightPoints: 5, rightsCap: 10,
    merchantClothCap: 40, merchantCharter: 10, merchantGuild: 10, merchantGaugePerPoint: 5, merchantGaugeCap: 20,
    secondHousePermille: 600,
  },
} as const;

/**
 * RG-5…RG-9: how each answer moves the factions (FX-4, a ledger record each), by petition and answer. The earl's
 * warning adds `warnedOverlord` to a partial charter's overlord line.
 */
export const REORGANISATION_RELATIONS: Readonly<Record<ReorganisationPetitionId, Readonly<Record<string, Readonly<Partial<Record<string, number>>>>>>> = {
  guild_charter: {
    accept: { town: 10, merchant_house_1: 5, overlord: -5 },
    refuse: { merchant_house_1: -15, town: -10 },
  },
  tax_collection: {
    accept: { town: 10, commons: 10 },
    refuse: { commons: -10, crown: 5 },
  },
  cloth_or_grain: {
    accept: { merchant_house_1: 10, commons: -5 },
    refuse: { merchant_house_1: -10, commons: 5 },
  },
  borough_charter: {
    accept: { town: 20, merchant_house_1: 10, overlord: -15, crown: 5 },
    refuse: { town: -25, merchant_house_1: -15, commons: -5, overlord: 10 },
  },
};
export const REORGANISATION_EVENT_RELATIONS = {
  warnedOverlord: -10,
  overlordWarning: -10,
  chased: { commons: -10, overlord: -10, crown: -10 },
  quiet: { town: 5 },
} as const;

const QUIET = { right: null, stallFeePermille: 1000, charterFee: 0, gauge: 0 } as const;

/**
 * RG-5…RG-9: the four decisions as petitions (answered by `petition_response`), arriving from `reorganisation.ts`
 * (`trigger: "reorganisation"`); unanswered a season, the lord's silence answers (refuse). Sums depend on the town
 * (`reorganisationDecisionForecast`). `responses` lists the answers each card offers.
 */
export const REORGANISATION_PETITION_DEFS: readonly PetitionDef[] = REORGANISATION_PETITION_IDS.map(id => ({
  id, petitioner: id === GUILD_CHARTER_PETITION_ID ? "craftsmen" as const : id === CLOTH_OR_GRAIN_PETITION_ID ? "merchants" as const : "townsfolk" as const,
  demand: id, fromYear: 1362, toYear: 1450, requiresLots: 0, trigger: "reorganisation" as const,
  responses: ["accept", "refuse"] as const, outcomes: { accept: QUIET, accept_with_price: QUIET, refuse: QUIET }, expiredGauge: 0,
}));
