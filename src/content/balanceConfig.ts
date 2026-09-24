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
  /** Provisional (B2): one calendar year per minute at 1x; four 300-tick seasons. Tune after player timing. */
  TICKS_PER_YEAR: 1200,
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
   * earning 5.4–6.7× its upkeep; these bring it to 1.2–1.5× while rent alone still just covers the opening
   * well and storehouse and a small walled town can pay its gate (docs/verification/c2-money/REPORT.md, M5).
   */
  upkeep: { well: 1, market: 50, church: 80, mill: 8, storehouse: 2, gate: 10 },
  /** `project`: spent when the optional stone-wall project is proclaimed (the B2 prerequisite). */
  stoneWallProjectCost: 200,
} as const;

export const BALANCE_CONFIG = { ...BALANCE, money: MONEY_BALANCE } as const;
