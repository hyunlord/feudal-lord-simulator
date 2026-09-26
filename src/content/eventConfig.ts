/**
 * F0-B events (spec docs/design/flow-events.md, EV-*): the event definitions, the weather table and the fire rules.
 * Values are integers; permille (‰) stands for fractions so the rules stay exact. Years are calendar years of the
 * scenario (tick 0 = spring 1300); a season is 1,000 ticks (spring 0, summer 1, autumn 2, winter 3).
 */
import type { EffectSpec } from "../contracts";

/** EV-3: the weather of one season. */
export type WeatherKind = "normal" | "wet" | "dry" | "cold";

/** EV-3: the chance of each weather in each season, permille, summing to 1,000 (spring, summer, autumn, winter). */
export const WEATHER_TABLE: readonly (readonly (readonly [WeatherKind, number])[])[] = [
  [["normal", 750], ["wet", 250]],
  [["normal", 600], ["wet", 200], ["dry", 200]],
  [["normal", 750], ["wet", 250]],
  [["normal", 700], ["cold", 300]],
];

/** EV-3: a wet summer's harvest, permille of the crop grown (the harvest of that calendar year). */
export const WET_SUMMER_HARVEST_PERMILLE = 950;

/** The kinds of event the scheduler knows. `dearth` is a bad harvest and dear food; `fire` a house fire. */
export type EventKind = "fire" | "dearth";

/** EV-2: the forecast ladder. Rumour from `rumourSeasons` before arrival, sign from `signSeasons` before. */
export interface EventForecastDef {
  readonly rumourSeasons: number;
  readonly signSeasons: number;
}

/**
 * EV-1: one event. A scheduled event takes the summer of one year among `centreYear + yearOffsets` (the seed picks; with
 * `afterEventId`, only years at least `minYearsAfter` after that event's). A fire's summer is dry and it happens only
 * when its conditions hold then; a dearth's harvest summers are wet.
 */
export interface EventDef {
  readonly id: string;
  readonly kind: EventKind;
  /** `scheduled`: once, in its window; `chance`: every dry summer after `afterEventId`'s window, with `chancePermille`. */
  readonly schedule:
    | { readonly type: "scheduled"; readonly centreYear: number; readonly yearOffsets: readonly number[]; readonly afterEventId?: string; readonly minYearsAfter?: number }
    | { readonly type: "chance"; readonly chancePermille: number; readonly afterEventId: string }
    /**
     * F0-C1 (FC-1): the event arrives when the historical era `eraId` enters (FP-5 readiness, forced after its grace).
     * Its forecast counts back from the summer of `plannedYear` (the era's year); waiting past it, it stays signed.
     * `harvestYearCounts`: the seed picks how many harvests it takes. `lastYear`: the era is forced in by then; an era
     * entered later came with an old save (its eras enter together on load) and brings no event.
     */
    | { readonly type: "era"; readonly eraId: string; readonly plannedYear: number; readonly lastYear: number; readonly harvestYearCounts: readonly number[] };
  readonly forecast: EventForecastDef;
  /** Published into the B1 effect pipe (source `{type:"event"}`); the rules below read the same values. */
  readonly effects: readonly EffectSpec[];
  /** Harvests counted as this event's (calendar years from the arrival year: 0 = the arrival summer's harvest). */
  readonly harvestYears?: readonly number[];
  /** Food price while the event is arriving, permille (market sale price of bread and wheat). */
  readonly foodPricePermille?: number;
  /** F0-C1 (FC-1): food price while the event is signed (prices rise ahead of it), permille. */
  readonly signFoodPricePermille?: number;
  /** Harvest while the event is arriving, permille of the crop grown. */
  readonly harvestPermille?: number;
  /** EV-2: seasons of recovery after the arrival ends. */
  readonly recoverySeasons: number;
}

/** EV-3: a scenario that lists this id in `activeEvents` has weather (the events below need it). */
export const WEATHER_EVENT_ID = "weather";
export const FIRST_FIRE_EVENT_ID = "first_fire";
export const FIRE_EVENT_ID = "fire";
export const DEARTH_REHEARSAL_EVENT_ID = "dearth_rehearsal";
export const GREAT_FAMINE_EVENT_ID = "great_famine";
export const FAMINE_ERA_ID = "famine";

/**
 * F0-C1 (FC-1): the famine era's effects (`EraDef.effects`, the B1 pipe): half harvests, food × 3 and a mild murrain
 * (a data effect only: the game has no livestock yet, decision FC2).
 */
export const GREAT_FAMINE_EFFECTS: readonly EffectSpec[] = [
  { kind: "modifier", stat: "harvest_yield", op: "mul", value: 0.5 },
  { kind: "modifier", stat: "food_price", op: "mul", value: 3 },
  { kind: "modifier", stat: "livestock_health", op: "mul", value: 0.8 },
];

export const EVENT_DEFS: readonly EventDef[] = [
  {
    // EV-4: chapter 1's first fire, 35–45 minutes in (1302 ± 1): the seed picks the summer, which is dry.
    id: FIRST_FIRE_EVENT_ID, kind: "fire",
    schedule: { type: "scheduled", centreYear: 1302, yearOffsets: [-1, 0, 1] },
    forecast: { rumourSeasons: 2, signSeasons: 1 },
    effects: [{ kind: "event_weight", eventId: FIRST_FIRE_EVENT_ID, multiplier: 1 }],
    recoverySeasons: 2,
  },
  {
    // EV-4: later fires, a chance on each dry summer after the first fire's window: 20 % dry × 15 % ≈ one in 33 years, so
    // chapter 1 (18 years, with its first fire) has one or two (flow design §7: 1–2 per chapter).
    id: FIRE_EVENT_ID, kind: "fire",
    schedule: { type: "chance", chancePermille: 150, afterEventId: FIRST_FIRE_EVENT_ID },
    forecast: { rumourSeasons: 2, signSeasons: 1 },
    effects: [{ kind: "event_weight", eventId: FIRE_EVENT_ID, multiplier: 1 }],
    recoverySeasons: 2,
  },
  {
    // EV-5: the first dearth, the Great Famine's rehearsal (1303 ± 1, after the first fire): a wet summer, −30 %
    // harvest, food × 1.5 until the next harvest.
    id: DEARTH_REHEARSAL_EVENT_ID, kind: "dearth",
    schedule: { type: "scheduled", centreYear: 1303, yearOffsets: [-1, 0, 1], afterEventId: FIRST_FIRE_EVENT_ID, minYearsAfter: 1 },
    forecast: { rumourSeasons: 3, signSeasons: 1 },
    effects: [
      { kind: "modifier", stat: "harvest_yield", op: "mul", value: 0.7 },
      { kind: "modifier", stat: "food_price", op: "mul", value: 1.5 },
    ],
    harvestYears: [0],
    harvestPermille: 700,
    foodPricePermille: 1500,
    // Two seasons after the next harvest: the lean late spring after the bad harvest ends in its departures (EV-9).
    recoverySeasons: 2,
  },
  {
    // F0-C1 (FC-1): the Great Famine arrives with the famine era (1315+ when the town is ready, forced by 1320). Rumour
    // three years ahead (summer 1312), sign two years ahead: the wet summers of 1313–14 and prices rising. Two or
    // three harvests at half, food × 3 until the next good harvest. Its effects are the famine era's (`EraDef.effects`).
    id: GREAT_FAMINE_EVENT_ID, kind: "dearth",
    schedule: { type: "era", eraId: FAMINE_ERA_ID, plannedYear: 1315, lastYear: 1320, harvestYearCounts: [2, 3] },
    forecast: { rumourSeasons: 12, signSeasons: 8 },
    effects: GREAT_FAMINE_EFFECTS,
    harvestPermille: 500,
    foodPricePermille: 3000,
    signFoodPricePermille: 1200,
    recoverySeasons: 2,
  },
];

export const EVENT_DEF_BY_ID: ReadonlyMap<string, EventDef> = new Map(EVENT_DEFS.map(def => [def.id, def]));

/** EV-4: the fire rules. Distances are footprint distances (Manhattan gap between footprints; edge-adjacent = 1). */
export const FIRE_CONFIG = {
  /** Ignition: a thatched house with at least this many thatched houses within `densityRadius` (the thatch is dense). */
  minNeighbours: 2,
  densityRadius: 2,
  /** Ignition: and at least this far from every well (a house touching a well is watched). */
  minWellDistance: 2,
  /** Ignition is tried every this many ticks of the planned summer, from a seeded offset in its first half. */
  ignitionStepTicks: 50,
  /** Spread: a burning house reaches thatched houses this close (edge-adjacent only; an empty tile or a well stops it). */
  spreadRadius: 1,
  /** Spread is rolled every this many ticks for every burning house and every neighbour. */
  spreadStepTicks: 10,
  /** Spread chance per roll, permille, by the season's weather. */
  spreadPermille: { normal: 50, wet: 15, dry: 120, cold: 50 } as Readonly<Record<WeatherKind, number>>,
  /** A neighbour whose household draws water from a well (`hasWater`) is doused: its spread chance × this. */
  wellSpreadPermille: 300,
  /** A house burns this long; a household with a well's water puts it out sooner. */
  burnTicks: 150,
  dousedBurnTicks: 60,
  /** Rebuild (EV-6): the site starts at stage 2 (foundation), with this share of the house's cost and builder work done. */
  rebuildDonePermille: 250,
} as const;
