/**
 * F0-C1 chapter 1 content (spec docs/design/flow-chapter-one.md FC-*): the famine responses, the first petition and the
 * chapter's end. Values are integers (permille for fractions, pennies for money).
 */
import { PLAGUE_PETITION_DEFS } from "./plagueConfig";
import { LEGACY_PETITION_DEFS } from "./legacyConfig";
import { REORGANISATION_PETITION_DEFS } from "./reorganisationConfig";
import { WAR_PETITION_DEFS } from "./warConfig";
import { packChapter } from "./packSettings";

/** FC-2: the lord's answer to the Great Famine. */
export type FamineResponseChoice = "relief" | "price_control" | "laissez_faire" | "speculation";
export const FAMINE_RESPONSE_CHOICES = ["relief", "price_control", "laissez_faire", "speculation"] as const satisfies readonly FamineResponseChoice[];

/**
 * FC-2: what each answer does while the famine is arriving, at every season's start (relief, speculation, the
 * merchants' mood) and on every ladder sample (the departure cap, the poor households' shortage).
 * - The price shock: while food sells at `poorShortPricePermille` or more, the poorest `poorPermille` of the lived-in
 *   households (lowest level, then id) cannot buy bread and count as short of food on the ladder.
 * - relief: the treasury pays the poor households' season of bread at the famine price (into the granary), spending
 *   at most the last season's cash income and `reliefTreasuryPermille` of the treasury — the famine takes the town's
 *   earnings, not its savings — and they are not short; one household may leave a season instead of two.
 * - price_control: bread and wheat sell at most at `priceCapPermille`; the merchants lose `merchantPerSeason` a season.
 * - speculation: the granaries sell `speculationPermille` of their bread and wheat at the famine price into the
 *   treasury each season; three households may leave a season.
 */
export const FAMINE_RESPONSE_CONFIG = {
  poorPermille: 250,
  poorShortPricePermille: 2000,
  reliefTreasuryPermille: 500,
  reliefDepartureCap: 1,
  priceCapPermille: 1500,
  priceControlMerchantPerSeason: -10,
  speculationPermille: 250,
  speculationDepartureCap: 3,
} as const;

/**
 * FC-3: petitioners (the gauge starts at 50 of 100). FAIL-3 (FL-6): the overlord asks too, to hand back a right he holds.
 * F2-A (WR-2…WR-8): the Crown demands, the refugees ask, the townsfolk choose the wall or the market.
 * F3-A (PL-5, PL-6): the labourers ask for wages, the parish for a priest. F4-A (RG-5): the craftsmen for a guild.
 */
export type Petitioner = "merchants" | "overlord" | "crown" | "refugees" | "townsfolk" | "labourers" | "parish" | "craftsmen";
export const MERCHANT_GAUGE_START = 50;

export type PetitionResponse = "accept" | "refuse" | "accept_with_price";
export const PETITION_RESPONSES = ["accept", "refuse", "accept_with_price"] as const satisfies readonly PetitionResponse[];

export interface PetitionOutcome {
  /** The right granted (rights[] line), or none. */
  readonly right: string | null;
  /** Stall fee after the answer, permille of the usual fee. */
  readonly stallFeePermille: number;
  /** One-off payment to the treasury (pennies). */
  readonly charterFee: number;
  /** Change of the petitioners' gauge. */
  readonly gauge: number;
}

/**
 * FC-3: one petition. It arrives at a season the seed picks in `fromYear`…`toYear` (first sample there that the town
 * has `requiresLots` lots: merchants ask a village big enough to trade in), waits for an answer until the end of
 * `toYear` (unanswered: `expired`, the gauge takes `expiredGauge`).
 */
export interface PetitionDef {
  readonly id: string;
  readonly petitioner: Petitioner;
  readonly demand: string;
  readonly fromYear: number;
  readonly toYear: number;
  readonly requiresLots: number;
  readonly outcomes: Readonly<Record<PetitionResponse, PetitionOutcome>>;
  readonly expiredGauge: number;
  /**
   * FAIL-3 (FL-6): how it arrives — by the calendar (FC-3, absent) or when a decline's cause has cleared (`lordship.ts`).
   * F2-A (WR-2…WR-8): or in the war's sequence (`war.ts`). F3-A (PL-5…PL-8): or in the pestilence's (`plague.ts`).
   * F4-A (RG-5…RG-9): or in the reorganisation's (`reorganisation.ts`). F5-A (LG-2…LG-5): or in chapter 5's (`legacy.ts`).
   */
  readonly trigger?: "calendar" | "decline_recovered" | "war" | "plague" | "reorganisation" | "legacy";
  /** F3-A: the answers the card offers (absent = all three); another answer is not taken. */
  readonly responses?: readonly PetitionResponse[];
}

export const MARKET_CHARTER_PETITION_ID = "market_charter";
/** FAIL-3 (FL-6): the holder of a right the lord lost offers it back once the decline's cause has cleared. */
export const RESTORE_RIGHT_PETITION_ID = "restore_right";
export const MARKET_CHARTER_RIGHT_ID = "market_charter";

export const PETITION_DEFS: readonly PetitionDef[] = [
  {
    // FC-3: the merchants ask for a market charter (60–75 min, 1305–1308): the right to hold the town's market under
    // their own wardens with lighter stall dues — asked of a village of six lots or more, with or without its market.
    id: MARKET_CHARTER_PETITION_ID, petitioner: "merchants", demand: "market_charter", fromYear: 1305, toYear: 1308,
    requiresLots: 6,
    outcomes: {
      accept: { right: MARKET_CHARTER_RIGHT_ID, stallFeePermille: 750, charterFee: 0, gauge: 15 },
      accept_with_price: { right: MARKET_CHARTER_RIGHT_ID, stallFeePermille: 1000, charterFee: 150, gauge: 5 },
      refuse: { right: null, stallFeePermille: 1000, charterFee: 0, gauge: -20 },
    },
    expiredGauge: -10,
  },
  {
    // FAIL-3 (FL-6): renegotiation. The lord buys the right back (100d, the title with it) or haggles (50d, the title a
    // year later) or refuses (the petition comes again a year later). `charterFee` is what the treasury pays out.
    id: RESTORE_RIGHT_PETITION_ID, petitioner: "merchants", demand: "restore_right", fromYear: 1300, toYear: 1450, requiresLots: 0,
    trigger: "decline_recovered",
    outcomes: {
      accept: { right: null, stallFeePermille: 1000, charterFee: -100, gauge: 10 },
      accept_with_price: { right: null, stallFeePermille: 1000, charterFee: -50, gauge: 0 },
      refuse: { right: null, stallFeePermille: 1000, charterFee: 0, gauge: -10 },
    },
    expiredGauge: 0,
  },
  ...WAR_PETITION_DEFS,
  ...PLAGUE_PETITION_DEFS,
  ...REORGANISATION_PETITION_DEFS,
  ...LEGACY_PETITION_DEFS,
];

/** FC-5: chapter 1 ends with a market town that came through the famine with this share of its people. */
/** FAIL-3 (FL-9): the campaign's chapters; its victory is the last one's end. */
export const CAMPAIGN_CHAPTERS = 5;

/** FAIL-3 (FL-8): chapter 2 of the campaign, the same town from the end of chapter 1 (counted from 1318 at the earliest). */
export const CHAPTER_TWO = {
  chapter: 2,
  fromYear: packChapter(2).fromYear,
  toYear: packChapter(2).toYear,
} as const;

/** F3-A (PL-10): chapter 3 of the campaign, the Black Death (from chapter 2's end, 1348 at the latest). */
export const CHAPTER_THREE = {
  chapter: 3,
  fromYear: packChapter(3).fromYear,
  toYear: packChapter(3).toYear,
} as const;

/** F4-A (RG-10): chapter 4 of the campaign, the reorganisation (from chapter 3's end, 1400 at the latest). */
export const CHAPTER_FOUR = {
  chapter: 4,
  fromYear: packChapter(4).fromYear,
  toYear: packChapter(4).toYear,
} as const;

/** F5-A (LG-1, LG-8): chapter 5 of the campaign, autonomy and legacy (from chapter 4's end to the last market day of 1450). */
export const CHAPTER_FIVE = {
  chapter: 5,
  fromYear: packChapter(5).fromYear,
  toYear: packChapter(5).toYear,
} as const;

export const CHAPTER_ONE = {
  chapter: 1,
  fromYear: packChapter(1).fromYear,
  toYear: packChapter(1).toYear,
  survivalPermille: 600,
  /** The chronicle quotes this many of the player's decisions. */
  quotedDecisions: 3,
} as const;
