import { PRESSURE_BALANCE } from "./balanceConfig";

/**
 * INSTALL-27 backyard decals (Wave 27, src/render/backyardDecals.ts): which engine signal picks which yard picture.
 * Presentation only: nothing here is read by a rule.
 *
 * Occupation (the 12 art kinds): the household's own craft first — a brewing slot (C4 `brew_ale`, the alewife's
 * mash tub) is the brewer's yard — then its members' trades (PS-4 `MASTER_TRADES`: the master of a staffed building
 * takes its trade), head first, then the spouse, then the rest by person id; the first trade with a picture wins.
 * Trades with no picture of their own (mason, quarrier) and the rest (labourer, child, steward, the lord's family)
 * give no occupation: the household shows its circumstances only.
 * The engine has no baker, blacksmith, weaver, dyer, tanner, shepherd or fisher yet; their pictures are installed and
 * wait for those trades (C5's cloth chain names weavers and dyers).
 */
export const YARD_OCCUPATION_KINDS = ["farmer", "baker", "blacksmith", "carpenter", "weaver", "dyer", "tanner", "brewer",
  "miller", "merchant", "shepherd", "fisher"] as const;
export type YardOccupationKind = (typeof YARD_OCCUPATION_KINDS)[number];

/** Person occupation (engine `Person.occupation`) → yard picture. */
export const YARD_OCCUPATION_BY_TRADE: Readonly<Record<string, YardOccupationKind>> = {
  husbandman: "farmer", // farmstead master
  miller: "miller", // mill master
  granger: "miller", // granary keeper: grain sacks
  sawyer: "carpenter", // sawmill master: sawn timber and trestles
  woodward: "carpenter", // logging camp master: timber
  chapman: "merchant", // market master
  storekeeper: "merchant", // storehouse keeper: crates and scales
};

/** Household craft (`HouseholdSlot.craftId`) → yard picture; checked before the members' trades. */
export const YARD_OCCUPATION_BY_CRAFT: Readonly<Record<string, YardOccupationKind>> = {
  brew_ale: "brewer",
};

export const YARD_CIRCUMSTANCES = ["prosperous", "strained", "hungry", "vacant", "newcomer", "winter"] as const;
export type YardCircumstance = (typeof YARD_CIRCUMSTANCES)[number];

/**
 * Circumstances, first match wins (a yard shows one 2 x 1 picture):
 *  1. winter — the calendar's winter (season 3): every yard is under snow, occupied or not;
 *  2. vacant — the household left (FP-3 `abandonedTick`) or the house has no residents;
 *  3. hungry — FP-3 `foodShortSinceTick` (short of food) or `leavingSinceTick` (preparing to leave);
 *  4. newcomer — a household moved in (history `person.move_in` / `person.resettled` at the house) within
 *     `newcomerTicks`;
 *  5. the occupation's picture, when the household has one;
 *  6. prosperous — house level `prosperousMinLevel` or more (the merchant house: water, bread and a granary near);
 *  7. strained — the rest (the hut, the small cottage and the artisan house getting by).
 */
export const YARD_RULES = {
  prosperousMinLevel: 3,
  /** One season: the fresh-dug beds and the new fence last until the household's first season is out. */
  newcomerTicks: PRESSURE_BALANCE.seasonTicks,
  /** The calendar season that is winter (`stateCalendar(state).season`). */
  winterSeason: 3,
} as const;

/**
 * The 1 x 1 shared props, used when only one back cell is free: any of the four for a fed household, only the rain
 * barrel for a hungry or vacant yard and in winter (no animals, no fresh manure).
 */
export const YARD_SHARED_KINDS = ["pigsty", "chicken_coop", "manure", "rain_barrel"] as const;
export type YardSharedKind = (typeof YARD_SHARED_KINDS)[number];
export const YARD_SHARED_LEAN: YardSharedKind = "rain_barrel";
