import type { GameState } from "../../../engine/engine.types";
import type { SeasonLedger } from "../../../engine/season.types";
import { SEASON_BAND_COPY as COPY } from "./seasonBandCopy.ko";

/**
 * LS1-2 (lord-screen-v1.md §3, §4): the season-turn band — what changed in the town in the season that closed, the design's
 * ② rows only, each a difference of two season-end states (P-D4: the screen copies no rule): the people and the treasury
 * from the engine's closed season (its population change, its cash flow — DTR-7), the houses, their levels, the other
 * buildings, the fields and the town's dead from two season-end snapshots, the steward's small matters from his season
 * report. Only what is not zero, in the design's order, at most five; a season with none says it was quiet (P-T1).
 */
export type TownSnapshot = Readonly<{
  /** The house's level by its building (a level that rose is a house that went up). */
  levels: Readonly<Record<string, number>>;
  /** The buildings that are not houses. */
  buildings: number;
  /** The fields laid out (arableFields: one per field, its strips not counted). */
  fields: number;
  /** The town's dead so far (the persons dead — not those who left, who are kept in `past` as well; the gentry — the lord's
   * house, the neighbours — are the chips'). */
  dead: number;
  /** LS1-5: the people and the treasury at the moment (the year card's start and end). */
  population: number;
  coin: number;
  /** LS1-16: the wall's segments still to build (the engine's construction sites) and their wall, null when none. */
  wallLeft: number;
  wallKind: "palisade" | "stone" | null;
}>;

export function townSnapshot(state: Pick<GameState, "houses" | "buildings" | "arableFields" | "persons" | "population" | "treasuryCoin"> & Partial<Pick<GameState, "constructionSites">>): TownSnapshot {
  const people = state.persons?.people ?? [];
  const past = state.persons?.past ?? [];
  const gentry = (person: { readonly classBand?: string }) => person.classBand === "gentry";
  return {
    levels: Object.fromEntries((state.houses ?? []).map(house => [house.buildingId, house.level])),
    buildings: (state.buildings ?? []).filter(building => building.kind !== "house").length,
    fields: state.arableFields?.length ?? 0,
    dead: [...past, ...people].filter(person => person.alive === false && !gentry(person)).length,
    population: state.population ?? 0,
    coin: state.treasuryCoin ?? 0,
    ...wallLeftOf(state.constructionSites ?? []),
  };
}

function wallLeftOf(sites: readonly { readonly kind: string }[]): Pick<TownSnapshot, "wallLeft" | "wallKind"> {
  const stone = sites.filter(site => site.kind === "stone_wall_segment").length;
  const palisade = sites.filter(site => site.kind === "palisade_segment").length;
  return { wallLeft: stone + palisade, wallKind: stone > 0 ? "stone" : palisade > 0 ? "palisade" : null };
}

/** LS1-3 (LS1-6): the town's size the growth count compares — its houses and its people. */
export const townSize = (snapshot: TownSnapshot): Readonly<{ houses: number; population: number }> =>
  ({ houses: Object.keys(snapshot.levels).length, population: snapshot.population });

/** v1.1 b: a season's deaths over this share of the town at its start say their main cause. */
export const DEATH_CAUSE_SHARE = 0.1;
/** Equal counts: the cause first in this order. */
const CAUSE_ORDER = ["fire", "plague", "famine", "famine_year", "captivity", "age"] as const;

/** v1.1 b: the season's deaths by the engine's cause — its `person.died` records' `cause` in (from, to] (the season's own
 * span, as its ledger counts), the town's people (not the gentry). */
export function seasonDeathCauses(state: Pick<GameState, "history" | "persons">, from: number, to: number): Readonly<Record<string, number>> {
  const gentry = new Set([...(state.persons?.people ?? []), ...(state.persons?.past ?? [])].filter(person => person.classBand === "gentry").map(person => person.id));
  const causes: Record<string, number> = {};
  for (const record of state.history?.records ?? []) {
    if (record.template !== "person.died" || record.tick <= from || record.tick > to || record.subject?.type !== "person" || gentry.has(record.subject.id)) continue;
    const cause = typeof record.params?.cause === "string" ? record.params.cause : null;
    if (cause !== null) causes[cause] = (causes[cause] ?? 0) + 1;
  }
  return causes;
}

/** The main cause: the most deaths, equal counts by CAUSE_ORDER; null with no recorded cause or one the band has no word for. */
function mainCause(causes: Readonly<Record<string, number>>): keyof typeof COPY.causes | null {
  const known = CAUSE_ORDER.filter(cause => (causes[cause] ?? 0) > 0);
  if (known.length === 0) return null;
  return known.reduce((best, cause) => (causes[cause] ?? 0) > (causes[best] ?? 0) ? cause : best);
}

export type SeasonBandItem = Readonly<{ key: "growth" | "population" | "built" | "levels" | "fields" | "money" | "deaths" | "steward"; text: string }>;
export type SeasonBand = Readonly<{ key: string; items: readonly SeasonBandItem[]; quiet: boolean }>;
export const SEASON_BAND_MAX = 5;

/**
 * The band for the season that closed: `before` the snapshot at the season's start (its prior close; null after a load
 * — then only the engine's own season numbers), `after` at its close, `stewardHandled` the steward's small matters in it.
 */
export function seasonBand(input: { readonly season: SeasonLedger; readonly before: TownSnapshot | null; readonly after: TownSnapshot; readonly stewardHandled: number;
  /** LS1-3: the stop of the town's growth, its line (the band's first), when it has held past two seasons. */
  readonly growth?: string | null;
  /** v1.1 b: the season's deaths by the engine's cause (seasonDeathCauses). */
  readonly deathCauses?: Readonly<Record<string, number>> }): SeasonBand {
  const { season, before, after } = input;
  const items: SeasonBandItem[] = [];
  if (input.growth !== undefined && input.growth !== null) items.push({ key: "growth", text: input.growth });
  const add = (key: SeasonBandItem["key"], value: number, text: string) => { if (value !== 0) items.push({ key, text }); };
  add("population", season.popDelta, COPY.population(season.popDelta));
  if (before !== null) {
    const houses = Object.keys(after.levels).filter(id => !(id in before.levels)).length;
    const buildings = Math.max(0, after.buildings - before.buildings);
    add("built", houses + buildings, COPY.built(houses, buildings));
    const rose = Object.entries(after.levels).filter(([id, level]) => id in before.levels && level > before.levels[id]!).length;
    add("levels", rose, COPY.levels(rose));
    add("fields", after.fields - before.fields, COPY.fields(after.fields - before.fields));
  }
  const net = Math.round(season.income - season.expense);
  add("money", net, COPY.money(net));
  if (before !== null) {
    const dead = Math.max(0, after.dead - before.dead);
    // v1.1 b: a heavy season (over a tenth of the town at its start) says its main cause, from the engine's records.
    const cause = before.population > 0 && dead / before.population > DEATH_CAUSE_SHARE ? mainCause(input.deathCauses ?? {}) : null;
    add("deaths", dead, cause === null ? COPY.deaths(dead) : COPY.deathsWithCause(dead, COPY.causes[cause]));
  }
  add("steward", input.stewardHandled, COPY.steward(input.stewardHandled));
  return { key: `${season.year}:${season.season}`, items: items.slice(0, SEASON_BAND_MAX), quiet: items.length === 0 };
}
