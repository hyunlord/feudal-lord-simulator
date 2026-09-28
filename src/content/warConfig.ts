/**
 * F2-A chapter 2's war (spec docs/design/chapter-two-war.md WR-*): the War era of 1337 brings the royal messenger, the
 * wool levy, the commission of array, the lay subsidy, the beacon and the coastal raid, then the refugees and the
 * Crown's licences. Values are integers (permille for fractions, pennies for money); times count seasons from the
 * messenger's season.
 */
import type { EffectSpec } from "../contracts";
import type { PetitionDef } from "./chapterConfig";

export const WAR_ERA_ID = "war";
/** WR-1: a scenario that lists this id in `activeEvents` has the war of 1337. */
export const WAR_SEQUENCE_ID = "war_1337";

/** WR-2…WR-7: the five decisions, one petition each (the Wave 17 decision cards, 1:1). */
export const WOOL_PAYMENT_PETITION_ID = "wool_payment";
export const LEVY_RESPONSE_PETITION_ID = "levy_response";
export const WAR_FUNDING_PETITION_ID = "war_funding";
export const REFUGEE_ADMISSION_PETITION_ID = "refugee_admission";
export const WALL_OR_MARKET_PETITION_ID = "wall_or_market";
export const WAR_PETITION_IDS = [WOOL_PAYMENT_PETITION_ID, LEVY_RESPONSE_PETITION_ID, WAR_FUNDING_PETITION_ID,
  REFUGEE_ADMISSION_PETITION_ID, WALL_OR_MARKET_PETITION_ID] as const;
export type WarPetitionId = (typeof WAR_PETITION_IDS)[number];

export const WAR_BALANCE = {
  /**
   * WR-1: the messenger comes with the War era; the rest counts seasons from his season. A town first seen in the War
   * era after `messengerLastYear` (an old save) has missed the war: it does not start late (as FC-1's `lastYear`).
   */
  messengerLastYear: 1340,
  woolLevySeason: 1,
  levySeason: 4,
  fundingSeason: 6,
  /** WR-5: the raid's summer, one of these (the seed picks): 1339 or 1340 for a messenger in spring 1337. */
  raidSeasons: [9, 13] as readonly number[],
  /** WR-5: the beacon burns this many seasons before the raid (the sign); the rumour runs from the messenger. */
  beaconSeasons: 1,
  refugeeSeasonsAfterRaid: 1,
  recoverySeasonsAfterRaid: 2,
  /** WR-7: a town off the coast has no raid; its recovery comes when a coastal town's latest raid would. */
  inlandRecoverySeason: 15,
  /** A demand left unanswered this many seasons is refused (the petition expires). */
  answerSeasons: 1,

  /** WR-2 wool levy: per lived-in house. In kind: 125 % in four seasonal payments, the town's fleece first (C5: the stores' stock) and the rest in cash (FIX-7, `pastureWool.ts`); refused: 150 % seized at once. */
  woolLevyPerHouse: 20,
  woolInKindPermille: 1250,
  woolInKindSeasons: 4,
  woolSeizedPermille: 1500,

  /** WR-3 commission of array: one man in `adultsPerMan` of the town's adults (at least `minMen`), away two seasons. */
  adultsPerMan: 20,
  minMen: 2,
  awaySeasons: 2,
  /** One man in this many does not come back (his household is one smaller). */
  lostEvery: 5,
  /** The exemption, per man. Refused: no men and no fine, but the Crown's favour is lost (as for every royal demand). */
  exemptionPerMan: 20,

  /** WR-4 lay subsidy: a tenth of the treasury (the borough's "tenth" of its movables), at least this per lived-in house. */
  subsidyTreasuryPermille: 100,
  subsidyPerHouse: 10,
  /** The merchants' loan: repaid with this interest in `loanSeasons` payments; their gauge rises. */
  loanInterestPermille: 200,
  loanSeasons: 8,
  loanGauge: 10,
  /** The tax: rent × (1 + surcharge) for `taxSeasons` seasons; each season one household in `taxFlightPermille` leaves. */
  taxSurchargePermille: 500,
  taxSeasons: 4,
  taxFlightPermille: 334,

  /** WR-5 the raid: houses burnt in a town with no defence, the stores' share looted, the treasury's share taken (at most `raidTreasuryMax`). */
  raidHouses: 8,
  raidLootPermille: 300,
  raidTreasuryPermille: 200,
  raidTreasuryMax: 2000,
  /** Defence of a closed ring: each stone segment holds this much, each timber segment this much (permille). */
  stoneDefencePermille: 1000,
  timberDefencePermille: 600,

  /** WR-6 refugees: households and people each; admitting half takes a fee per household. */
  refugeeHouseholds: 4,
  refugeesPerHousehold: 4,
  refugeeFeePerHousehold: 10,

  /** WR-7 royal purveyance licence: seasons, and the share of the granaries' wheat the purveyors buy each season at the market price. */
  licenceSeasons: 8,
  licenceWheatPermille: 100,
  /** WR-8 the wall or the market: murage doubles the tolls while the stone wall is building; the market's dues double (a fair). */
  murageTollPermille: 2000,
  marketExpansionPermille: 2000,
  /** WR-9 chapter 2 ends by the spring of 1348 whatever the wall's state. */
  chapterEndYear: 1348,
} as const;

/** WR-1: the War era's effects (B1 pipe, data only: the town has no wool trade until C4, decision WR3). */
export const WAR_ERA_EFFECTS: readonly EffectSpec[] = [
  { kind: "modifier", stat: "wool_price", op: "mul", value: 1.5 },
];

const NO_RIGHT = { right: null, stallFeePermille: 1000 } as const;

/**
 * WR-2…WR-8: the five decisions as petitions (answered by `petition_response`, like the merchants'). `charterFee` is
 * left 0: the sums depend on the town (`warDecisionForecast` in `war.ts` predicts them); the gauge moves are fixed.
 * They arrive from `war.ts`, not by the calendar (`trigger: "war"`), and expire after `answerSeasons`.
 */
export const WAR_PETITION_DEFS: readonly PetitionDef[] = [
  { id: WOOL_PAYMENT_PETITION_ID, petitioner: "crown", demand: WOOL_PAYMENT_PETITION_ID, fromYear: 1337, toYear: 1450, requiresLots: 0, trigger: "war",
    outcomes: { accept: { ...NO_RIGHT, charterFee: 0, gauge: 0 }, accept_with_price: { ...NO_RIGHT, charterFee: 0, gauge: 0 }, refuse: { ...NO_RIGHT, charterFee: 0, gauge: 0 } },
    expiredGauge: 0 },
  { id: LEVY_RESPONSE_PETITION_ID, petitioner: "crown", demand: LEVY_RESPONSE_PETITION_ID, fromYear: 1337, toYear: 1450, requiresLots: 0, trigger: "war",
    outcomes: { accept: { ...NO_RIGHT, charterFee: 0, gauge: 0 }, accept_with_price: { ...NO_RIGHT, charterFee: 0, gauge: 0 }, refuse: { ...NO_RIGHT, charterFee: 0, gauge: 0 } },
    expiredGauge: 0 },
  { id: WAR_FUNDING_PETITION_ID, petitioner: "crown", demand: WAR_FUNDING_PETITION_ID, fromYear: 1337, toYear: 1450, requiresLots: 0, trigger: "war",
    outcomes: { accept: { ...NO_RIGHT, charterFee: 0, gauge: WAR_BALANCE.loanGauge }, accept_with_price: { ...NO_RIGHT, charterFee: 0, gauge: 0 }, refuse: { ...NO_RIGHT, charterFee: 0, gauge: 0 } },
    expiredGauge: 0 },
  { id: REFUGEE_ADMISSION_PETITION_ID, petitioner: "refugees", demand: REFUGEE_ADMISSION_PETITION_ID, fromYear: 1337, toYear: 1450, requiresLots: 0, trigger: "war",
    outcomes: { accept: { ...NO_RIGHT, charterFee: 0, gauge: 0 }, accept_with_price: { ...NO_RIGHT, charterFee: 0, gauge: 0 }, refuse: { ...NO_RIGHT, charterFee: 0, gauge: 0 } },
    expiredGauge: 0 },
  { id: WALL_OR_MARKET_PETITION_ID, petitioner: "townsfolk", demand: WALL_OR_MARKET_PETITION_ID, fromYear: 1337, toYear: 1450, requiresLots: 0, trigger: "war",
    outcomes: { accept: { ...NO_RIGHT, charterFee: 0, gauge: 0 }, accept_with_price: { ...NO_RIGHT, charterFee: 0, gauge: -5 }, refuse: { ...NO_RIGHT, charterFee: 0, gauge: 5 } },
    expiredGauge: 0 },
];
