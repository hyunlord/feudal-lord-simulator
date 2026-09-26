/**
 * F0-C1 chapter 1 content (spec docs/design/flow-chapter-one.md FC-*): the famine responses, the first petition and the
 * chapter's end. Values are integers (permille for fractions, pennies for money).
 */

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

/** FC-3: petitioners (the gauge starts at 50 of 100). */
export type Petitioner = "merchants";
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
}

export const MARKET_CHARTER_PETITION_ID = "market_charter";
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
];

/** FC-5: chapter 1 ends with a market town that came through the famine with this share of its people. */
export const CHAPTER_ONE = {
  chapter: 1,
  fromYear: 1300,
  toYear: 1318,
  survivalPermille: 600,
  /** The chronicle quotes this many of the player's decisions. */
  quotedDecisions: 3,
} as const;
