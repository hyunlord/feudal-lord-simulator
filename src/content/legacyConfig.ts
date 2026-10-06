/**
 * F5-A chapter 5's autonomy and legacy (spec docs/design/chapter-five-legacy.md LG-*): from chapter 4's charter to the
 * last market day of 1450 — the merchants' mayor, the Crown's envoy, the old lord's heir, the town's seal, the charter
 * sealed or refused, the family's leaving or staying, the legacy sealed; then the legacy's three scores and the
 * campaign's ending. Values are integers (permille for fractions, pennies for money) and a hypothesis (decision LG1).
 */
import type { PetitionDef, PetitionResponse } from "./chapterConfig";
import { PACK_CALENDAR } from "./packSettings";

/** LG-1: a scenario that lists this id in `activeEvents` has chapter 5's sequence. */
export const LEGACY_SEQUENCE_ID = "legacy_1400";

/** LG-2…LG-5: the four decisions, one petition each (the Wave 21 chapter-5 decision cards, 1:1). */
export const BOROUGH_AUTONOMY_PETITION_ID = "borough_autonomy";
export const HEIR_CHOICE_PETITION_ID = "heir_choice";
export const ROYAL_TAX_PETITION_ID = "royal_tax";
export const LEGACY_CHOICE_PETITION_ID = "legacy_choice";
/** FIX-9 (LG-13): the interlude's two petitions — the guild against the merchants (1394), the parish's nave (1396). */
export const GUILD_DISPUTE_PETITION_ID = "guild_dispute";
export const CHURCH_REBUILDING_PETITION_ID = "church_rebuilding";
/** LG-2…LG-5: the four Wave 21 decisions. */
export const LEGACY_CARD_PETITION_IDS = [ROYAL_TAX_PETITION_ID, HEIR_CHOICE_PETITION_ID, BOROUGH_AUTONOMY_PETITION_ID, LEGACY_CHOICE_PETITION_ID] as const;
export const LEGACY_PETITION_IDS = [...LEGACY_CARD_PETITION_IDS, GUILD_DISPUTE_PETITION_ID, CHURCH_REBUILDING_PETITION_ID] as const;
export type LegacyPetitionId = (typeof LEGACY_PETITION_IDS)[number];

/** LG-2: the rights a sealed charter hands the town (their holder `townsfolk`). */
export const MAYORALTY_RIGHT_ID = "mayoralty";
export const BOROUGH_SEAL_RIGHT_ID = "borough_seal";

/** LG-1: the eight steps (the Wave 21 chapter-5 events, 1:1), in order. */
export const LEGACY_STEP_IDS = ["mayor_demand", "royal_tax_envoy", "succession", "city_seal", "charter_sealing", "family_departure", "legacy_record", "last_market"] as const;
export type LegacyStepId = (typeof LEGACY_STEP_IDS)[number];
/** LG-1: each step's Wave 21 picture (`assets-inbox/wave21/…/ch5_events/`). */
export const LEGACY_STEP_ART: Readonly<Record<LegacyStepId, string>> = {
  mayor_demand: "ch5_event_mayor_demand", royal_tax_envoy: "ch5_event_royal_tax_envoy", succession: "ch5_event_succession",
  city_seal: "ch5_event_city_seal_making", charter_sealing: "ch5_event_charter_sealing", family_departure: "ch5_event_family_departure",
  legacy_record: "ch5_event_legacy_record", last_market: "ch5_event_last_market",
};
/**
 * FIX-9 (LG-13): the interlude between the Crown's tax and the succession (1384–1400), by the calendar — the Staple
 * moved and wool bound (1391), the guild's quarrel with the merchants or, without a guild, the market's fire (1394), the
 * parish's nave (1396), Richard II deposed and Henry IV crowned (autumn 1399). No Wave 21 picture yet (render).
 */
export const LEGACY_INTERLUDE_IDS = ["staple", "guild_dispute", "market_fire", "church_rebuilding", "deposition"] as const;
export type LegacyInterludeId = (typeof LEGACY_INTERLUDE_IDS)[number];

/** LG-2…LG-5: each decision's Wave 21 card. */
export const LEGACY_DECISION_ART: Readonly<Record<(typeof LEGACY_CARD_PETITION_IDS)[number], string>> = {
  borough_autonomy: "ch5_decision_autonomy", heir_choice: "ch5_decision_heir_choice", royal_tax: "ch5_decision_royal_tax_response", legacy_choice: "ch5_decision_legacy",
};

/** LG-3: the three heirs, by the answer that names them. */
export type HeirKind = "eldest_son" | "daughter_husband" | "nephew";
export const HEIR_BY_RESPONSE: Readonly<Record<PetitionResponse, HeirKind>> = { accept: "eldest_son", accept_with_price: "daughter_husband", refuse: "nephew" };
/** LG-5: the three legacies, by the answer that chooses them. */
export type LegacyAxis = "town" | "family" | "church";
export const LEGACY_BY_RESPONSE: Readonly<Record<PetitionResponse, LegacyAxis>> = { accept: "town", accept_with_price: "family", refuse: "church" };

/** LG-7: the six endings. */
export const LEGACY_ENDING_IDS = ["free_borough", "house_remembered", "merchants_chantry", "house_seat", "lords_town", "pilgrim_town"] as const;
export type LegacyEndingId = (typeof LEGACY_ENDING_IDS)[number];

export const LEGACY_BALANCE = {
  /** LG-1: each step this many seasons after the one before (the first after chapter 5's start). */
  mayorAfter: 4,
  envoyAfterMayor: 4,
  successionAfterEnvoy: 4,
  successionLatestAfterEnvoy: 12,
  /** LG-1: the succession not before the spring of this year, the legacy's question not before this one (the chapter is 1400–1450). */
  successionFromYear: 1400,
  legacyFromYear: 1440,
  /** LG-1: the succession comes the first spring the lord is this old (from `successionAfterEnvoy`). */
  lordOldAge: 50,
  sealAfterHeir: 4,
  charterAfterSeal: 2,
  departureAfterCharter: 2,
  legacyAfterDeparture: 8,
  /** LG-1 / LG-8: the last market day, the campaign's end (year, in-year season: 0 spring … 3 winter). */
  lastMarketYear: PACK_CALENDAR.end.year,
  lastMarketSeason: PACK_CALENDAR.end.season,

  /** LG-2: a sealed charter — the town's one-off fine, the fee farm from then, the Crown's confirmation after a petition. */
  charterFine: 300,
  feeFarm: 200,
  confirmationFine: 200,
  /** LG-2: a refusal's backlash — at least this, the town's influence, or chapter 4's backlash and this much. */
  backlashFloor: 30,
  backlashAgain: 20,

  /** LG-3: the relief the heir pays the overlord; the candidates' ages. */
  relief: { eldest_son: 100, daughter_husband: 150, nephew: 200 } as Readonly<Record<HeirKind, number>>,
  daughterMinAge: 16,
  husbandOlder: [2, 5] as readonly [number, number],
  nephewAge: [18, 25] as readonly [number, number],

  /** LG-4: the Crown's tenth and fifteenth, permille of the treasury, within these bounds. */
  subsidyPermille: 100,
  subsidyMin: 60,
  subsidyMax: 400,

  /**
   * LG-13 the interlude (year, in-year season). The Staple: cloth sells at `staplePricePermille` for `stapleSeasons`
   * (wool bound at home, the weavers' market wider). The market's fire: its repair. The nave: its cost. The deposition:
   * the Crown's relation goes `depositionPermille` of the way back to where it started (a new king's reign).
   */
  staple: [1391, 0] as readonly [number, number],
  staplePricePermille: 1_100,
  stapleSeasons: 8,
  guildDispute: [1394, 0] as readonly [number, number],
  marketFireRepair: 150,
  churchRebuilding: [1396, 0] as readonly [number, number],
  churchRebuildingCost: 300,
  deposition: [1399, 2] as readonly [number, number],
  depositionPermille: 500,

  /** LG-5: the legacy's endowment and its score. */
  endowment: 500,
  legacyPoints: 25,

  /** LG-7: the scores' parts and caps. */
  score: {
    town: { peoplePerPoint: 20, peopleCap: 25, l4Points: 20, clothPerPoint: 40, clothCap: 15, rightPoints: 5, rightsCap: 15, autonomy: 20, refused: -20 },
    family: { firstHouse: 20, perChange: -10, perGeneration: 4, generationsCap: 16, heir: { eldest_son: 12, daughter_husband: 8, nephew: 5 } as Readonly<Record<HeirKind, number>>,
      stayed: 15, relationDivisor: 10, relationCap: 10, treasuryPerPoint: 2000, treasuryCap: 10 },
    // FIX-9: the church's axis can lead (a church-built town): each church 10 (two), the bishop's favour ÷ 2, the
    // monastery's priest, the nave rebuilt.
    church: { church: 10, churchCap: 20, chapel: 4, chapelCap: 8, bishopDivisor: 2, bishopCap: 25, priest: 10, relief: 5, rebuilt: 15 },
  },
} as const;

/**
 * LG-6: how each answer moves the factions (FX-4, a ledger record each), by petition and answer (the silence as its
 * default answer).
 */
export const LEGACY_RELATIONS: Readonly<Record<LegacyPetitionId, Readonly<Partial<Record<PetitionResponse, Readonly<Partial<Record<string, number>>>>>>>> = {
  borough_autonomy: {
    accept: { town: 25, merchant_house_1: 15, overlord: -15, crown: 5 },
    refuse: { town: -25, merchant_house_1: -15, commons: -5, overlord: 10 },
  },
  heir_choice: {
    accept: { overlord: 5 },
    accept_with_price: { neighbour_1: 10 },
    refuse: { overlord: -5 },
  },
  royal_tax: {
    accept: { crown: 10, town: -5 },
    refuse: { crown: -15, town: 5 },
  },
  legacy_choice: {
    accept: { town: 10 },
    accept_with_price: { overlord: 5 },
    refuse: { bishop: 15 },
  },
  // FIX-9 (LG-13): the guild's side or the merchants'; the nave rebuilt or not.
  guild_dispute: {
    accept: { town: 10, merchant_house_1: -10 },
    refuse: { merchant_house_1: 10, town: -10 },
  },
  church_rebuilding: {
    accept: { bishop: 10 },
    refuse: { bishop: -10 },
  },
};

const QUIET = { right: null, stallFeePermille: 1000, charterFee: 0, gauge: 0 } as const;
/** LG-2…LG-5: the answers each card offers (the heir's card: those whose candidate exists, `PetitionRecord.options`). */
const RESPONSES: Readonly<Record<LegacyPetitionId, readonly PetitionResponse[]>> = {
  borough_autonomy: ["accept", "refuse"], royal_tax: ["accept", "refuse"],
  heir_choice: ["accept", "accept_with_price", "refuse"], legacy_choice: ["accept", "accept_with_price", "refuse"],
  guild_dispute: ["accept", "refuse"], church_rebuilding: ["accept", "refuse"],
};

/**
 * LG-2…LG-5: the four decisions as petitions (answered by `petition_response`), arriving from `legacy.ts`
 * (`trigger: "legacy"`); unanswered a season, the lord's silence answers. Sums depend on the town (`legacyDecisionForecast`).
 */
export const LEGACY_PETITION_DEFS: readonly PetitionDef[] = LEGACY_PETITION_IDS.map(id => ({
  id, petitioner: id === ROYAL_TAX_PETITION_ID ? "crown" as const : id === HEIR_CHOICE_PETITION_ID ? "overlord" as const
    : id === GUILD_DISPUTE_PETITION_ID ? "craftsmen" as const : id === CHURCH_REBUILDING_PETITION_ID ? "parish" as const : "townsfolk" as const,
  demand: id, fromYear: 1382, toYear: 1450, requiresLots: 0, trigger: "legacy" as const,
  responses: RESPONSES[id], outcomes: { accept: QUIET, accept_with_price: QUIET, refuse: QUIET }, expiredGauge: 0,
}));
