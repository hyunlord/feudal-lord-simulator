/**
 * F3-A chapter 3's Black Death (spec docs/design/chapter-three-plague.md PL-*): the collapse era of 1348 brings the
 * harbour fever's rumour, the pestilence, the priest's death, the empty streets and fields, the labourers' wage demand,
 * the Crown's statute, the resettlement and the second pestilence of 1361. Values are integers (permille for fractions,
 * pennies for money); times count seasons from the era's first season (spring 1348 for a town that is there).
 */
import type { PetitionDef } from "./chapterConfig";

export const PLAGUE_ERA_ID = "collapse";
/** PL-1: a scenario that lists this id in `activeEvents` has the Black Death. */
export const PLAGUE_SEQUENCE_ID = "black_death_1348";

/** PL-5…PL-8: the four decisions, one petition each (the Wave 21 chapter-3 decision cards, 1:1). */
export const WAGES_PETITION_ID = "wages";
export const LAND_REDISTRIBUTION_PETITION_ID = "land_redistribution";
export const VACANT_PRIEST_PETITION_ID = "vacant_priest";
export const CASH_RENT_PETITION_ID = "cash_rent";
export const PLAGUE_PETITION_IDS = [VACANT_PRIEST_PETITION_ID, WAGES_PETITION_ID, LAND_REDISTRIBUTION_PETITION_ID, CASH_RENT_PETITION_ID] as const;
export type PlaguePetitionId = (typeof PLAGUE_PETITION_IDS)[number];

export const PLAGUE_BALANCE = {
  /** PL-1: a town first seen in the collapse era after this year (an old save) has missed the pestilence. */
  rumourLastYear: 1350,
  /** PL-1: the harbour fever's rumour comes this many seasons after the era's first (summer 1348). */
  rumourSeason: 1,
  /** PL-2: the pestilence arrives this many seasons after the rumour — a coastal or river-mouth town first. */
  coastalArrivalAfterRumour: 1,
  inlandArrivalAfterRumour: 2,
  /** PL-2: it rages this many seasons (about a year), each season's share of its dead (permille, summing to 1,000). */
  arrivalSeasons: 4,
  arrivalShares: [200, 350, 300, 150] as readonly number[],
  /** PL-2: the share of the town's people it takes, permille — the seed picks within (England 30–50 %, the brief 40–50 %). */
  deathPermilleMin: 420,
  deathPermilleMax: 480,
  /**
   * PL-2 weights, permille: the old and the small children die most, then the children; a crowded house (residents at
   * `crowdedPermille` of its room or more) and a house in the town's inner third more; the outer third less.
   */
  ageWeights: [[5, 1_600], [14, 1_200], [55, 800], [Infinity, 1_700]] as readonly (readonly [number, number])[],
  /**
   * PL-2: the pestilence struck whole households — this share of the lived-in houses (permille, the first pestilence;
   * the heaviest-weighted first) loses everyone, counted in the dead; their plots stand empty.
   */
  wipedHousePermille: 150,
  crowdedPermille: 900,
  crowdedWeight: 1_200,
  innerWeight: 1_250,
  outerWeight: 850,

  /** PL-5 wages: the labourers ask this many seasons after the arrival began (winter 1349 for a coastal town). */
  wageDemandAfterArrival: 2,
  /** Raised: the treasury pays each worker in the lord's buildings this a ledger period, to the chapter's end (`wages`). */
  raisedWagePerWorker: 1,
  /** Enforced: each season, one household in `flightPermille` goes where wages are paid (the poorest first). */
  wageFlightPermille: 500,
  /** PL-5 the Statute of Labourers is read in the spring of this year; a lord who raised wages pays the justices' fine. */
  ordinanceYear: 1351,
  statuteFine: 100,

  /** PL-6 the priest's seat: the monastery's stipend (asked), the seasons its priest takes to come. */
  monasteryStipend: 60,
  monasterySeasons: 1,

  /** PL-7 land: the petition comes when the arrival ends; resettlement starts in the spring of this year. */
  resettlementYear: 1352,
  /** The town's own recovery (births, kin from the country), permille of the people at the arrival, a season. */
  recoveryPermille: 6,
  /** New settlers (the accept-with-price answer): households a season into empty houses, people each, the entry fine each. */
  settlerHouseholds: 2,
  settlerPeople: 4,
  entryFine: 10,
  /** Existing households take the empty plots (accept): their level waits this share of its hold, to the chapter's end. */
  expandHoldPermille: 500,

  /** PL-8 labour services: commuted, the rent is this share of the money rent; kept, the lord's upkeep this share. */
  cashRentPermille: 1_250,
  labourServiceUpkeepPermille: 750,
  /** Kept: each season one household in `serviceFlightPermille` runs from its services. */
  serviceFlightPermille: 250,

  /** PL-4 grain: from the arrival to the chapter's end, bread and wheat sell at this share (fewer mouths). */
  grainPricePermille: 800,

  /** PL-9 the second pestilence (1361, the children's plague): its seasons, shares and death permille; the young weigh most. */
  secondYear: 1361,
  secondSeasons: 2,
  secondShares: [600, 400] as readonly number[],
  secondDeathPermille: 120,
  secondAgeWeights: [[14, 2_000], [30, 1_300], [55, 700], [Infinity, 900]] as readonly (readonly [number, number])[],

  /**
   * PL-10 chapter 3 ends (campaign) at the first season from the spring of `chapterEndFromYear` whose people are at least
   * `resettledPermille` of those at the arrival (the resettlement done), else in the spring of `chapterEndYear`.
   */
  chapterEndFromYear: 1362,
  resettledPermille: 700,
  chapterEndYear: 1364,
} as const;

const NO_RIGHT = { right: null, stallFeePermille: 1000 } as const;
const QUIET = { ...NO_RIGHT, charterFee: 0, gauge: 0 } as const;

/**
 * PL-5…PL-8: the four decisions as petitions (answered by `petition_response`). Sums depend on the town (`plagueDecisionForecast`
 * predicts them). They arrive from `plague.ts` (`trigger: "plague"`) and are refused (or, for the priest, filled by a
 * clerk) when left a season unanswered. `responses` lists the answers each card offers.
 */
export const PLAGUE_PETITION_DEFS: readonly PetitionDef[] = [
  { id: VACANT_PRIEST_PETITION_ID, petitioner: "parish", demand: VACANT_PRIEST_PETITION_ID, fromYear: 1348, toYear: 1450, requiresLots: 0, trigger: "plague",
    responses: ["accept", "refuse"], outcomes: { accept: QUIET, accept_with_price: QUIET, refuse: QUIET }, expiredGauge: 0 },
  { id: WAGES_PETITION_ID, petitioner: "labourers", demand: WAGES_PETITION_ID, fromYear: 1348, toYear: 1450, requiresLots: 0, trigger: "plague",
    responses: ["accept", "refuse"], outcomes: { accept: QUIET, accept_with_price: QUIET, refuse: QUIET }, expiredGauge: 0 },
  { id: LAND_REDISTRIBUTION_PETITION_ID, petitioner: "townsfolk", demand: LAND_REDISTRIBUTION_PETITION_ID, fromYear: 1348, toYear: 1450, requiresLots: 0, trigger: "plague",
    responses: ["accept", "accept_with_price"], outcomes: { accept: QUIET, accept_with_price: QUIET, refuse: QUIET }, expiredGauge: 0 },
  { id: CASH_RENT_PETITION_ID, petitioner: "townsfolk", demand: CASH_RENT_PETITION_ID, fromYear: 1348, toYear: 1450, requiresLots: 0, trigger: "plague",
    responses: ["accept", "refuse"], outcomes: { accept: QUIET, accept_with_price: QUIET, refuse: QUIET }, expiredGauge: 0 },
];
