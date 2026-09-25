export const BALANCE = {
  TICKS_PER_SECOND: 20,
  CARTER_SPEED: 0.14,
  CARTER_CAPACITY: 8,
  DISTRIBUTOR_SPEED: 0.11,
  DISTRIBUTOR_CAPACITY: 12,
  DISTRIBUTOR_INTERVAL: 120,
  DISTRIBUTOR_RANGE: 40,
  BREAD_HUNGER_WINDOW: 200,
  DEVOLUTION_GRACE: 400,
  GROWTH_INTERVAL: 150,
  FOOD_PRODUCTION_MARGIN_FACTOR: 1.05,
  STARVATION_WINDOW: 300,
  WORKERS_PER_RESIDENT: 0.5,
  CONSTRUCTION_MIN_WORKER_SHARE: 0.2,
  STARTING_TIMBER: 120,
  /**
   * Provisional (C1c): four 1,000-tick seasons, so autoplay's 24-lot victories (280–630k ticks) land in about
   * 1370–1460 from a 1300 start. Derived only (no state field); tune after player timing.
   */
  TICKS_PER_YEAR: 4000,
} as const;

/**
 * Money rules (spec `docs/design/money-rules.md`, M-*), in pennies. Every movement is posted through
 * `postLedgerEntries`; nothing adds to `treasuryCoin` directly. Income and upkeep settle once per ledger
 * period (2,400 ticks); the stone-wall project is spent when it is proclaimed.
 */
export const MONEY_BALANCE = {
  /** `toll`: per carter step through a completed gate or onto a bridge. */
  tollPerCrossing: 1,
  /** `stall_fee`: per stall of an operating market, per period. */
  stallFeePerStall: 4,
  /** A market sets out one stall per this many homes it serves, up to `maxStallsPerMarket`. */
  homesPerStall: 4,
  maxStallsPerMarket: 6,
  /** `rent`: per occupied home, per period, by house level L0…L4. */
  rentByLevel: [1, 2, 4, 8, 16],
  /** A home on a burgage plot pays level rent × plot frontage width ÷ this (B5 plots are 2–4 wide). */
  rentReferenceFrontage: 3,
  /** `mill_toll`: `millTollPerUnit` for every `millTollWheat` wheat a mill grinds (remainder carried). */
  millTollWheat: 10,
  millTollPerUnit: 1,
  /**
   * `upkeep` per facility, per period. Gates are counted per gate of a completed wall stretch. The work
   * order's start values (well 1 · market 4 · church 6 · mill 3 · storehouse 2 · gate 2) left a 24-lot town
   * earning 5.4–7.5× its upkeep; these bring it to 1.2–1.5× while rent alone still just covers the opening
   * well and storehouse and a small walled town can pay its gate (docs/verification/c2-money/REPORT.md, M5).
   */
  upkeep: { well: 1, market: 50, church: 80, mill: 8, storehouse: 2, gate: 10 },
  /** `project`: spent when the optional stone-wall project is proclaimed (the B2 prerequisite). */
  stoneWallProjectCost: 200,
} as const;

/**
 * Labour (spec `docs/design/labour.md`, LB-*). Adults are the old labour pool (`WORKERS_PER_RESIDENT`); the new
 * demands below take only what the R1-fix facility and construction allocation leaves (LB-4).
 */
export const LABOUR_BALANCE = {
  /** LB-4: order in which a short labour pool is filled (report value; tiers 1–6 are the R1-fix allocation). */
  priority: [
    "construction_floor", "core_food", "core_timber_while_building", "other_food", "other_facilities",
    "construction_extra", "hauling", "field_hands", "household_slots",
  ],
  /** LB-8: household production slots by house level L0…L4. */
  householdSlotsByLevel: [0, 1, 1, 2, 2],
  /** LB-7: a granary pushes wheat to mills whose footprint lies within this many tiles (one day labourer each). */
  pushRadius: 12,
  /** LB-7: haulers a granary with a mill in reach takes from the day pool. */
  haulersPerGranary: 1,
  /** LB-7: load of a mill's carts (bread out, wheat in) and of a granary's push cart. */
  millCartCapacity: 12,
  /** LB-7: a mill's intake cart leaves while the mill's wheat plus wheat on its way is below this. */
  millWheatTarget: 12,
  /** LB-7: a granary pushes to a mill whose wheat plus wheat on its way is below this (a second load on top). */
  millPushTarget: 24,
  /** LB-7: autoplay mill cap = a year's wheat need × this ÷ a mill's year of wheat, + 1 (AF-13: max(need, harvest) × 2). */
  millHaulingFactorPermille: 1300,
  /** LB-11: before the palisade, autoplay paints field blocks at least this many tiles outside its proposed wall. */
  fieldWallMargin: 1,
  /** LB-9: idle adults ÷ population above this shows the idle-labour hint (the A″ threshold). */
  idleHintPermille: 250,
} as const;

/** LB-5: the seasonal labour of the strips a farmstead tends (in-year ticks, 4,000-tick year). */
export const SEASON_BALANCE = {
  /** Adults a strip cell needs in a normal season, in permille (1000 = one adult per cell; two at sowing and harvest). */
  fieldHandsPerCellPermille: 1000,
  /** Seasonal multipliers in permille, by in-year tick; `from` inclusive, wrapping the year end. */
  bands: [
    { name: "sowing", from: 3500, until: 1000, permille: 2000 },
    { name: "early_summer", from: 1000, until: 1500, permille: 1000 },
    { name: "harvest", from: 1500, until: 3000, permille: 2000 },
    { name: "early_winter", from: 3000, until: 3500, permille: 500 },
  ],
} as const;

export const BALANCE_CONFIG = { ...BALANCE, money: MONEY_BALANCE, labour: LABOUR_BALANCE, season: SEASON_BALANCE } as const;
