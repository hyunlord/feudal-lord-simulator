/**
 * DEC-TRACE §6 read model (the user's instruction 2026-10-06, Astra's lord-mode play: "I could not tell whether the
 * famine was prevented, had not come, or was weak"): a crisis's preparedness and the weak points left, at its notice and
 * at its arrival, and what it did — the damage, or why it was avoided. The thread writes the arrival and the outcome in
 * the history with the decisions behind them (`decisionTrace.ts`); this reads them, and the forecast's coming crises.
 */
import { BALANCE } from "../content/balanceConfig";
import { DAYS_PER_SEASON_FOR_CRISIS, WEAK_POINT_PROJECT } from "../content/crisisConfig";
import { foodReserveTicks } from "../population/foodReserve";
import type { GameState } from "./engine.types";
import { eventForecast } from "./eventSchedule";
import { foodShortHouseIds } from "./foodShortage";

/** What a town has against a crisis now, and its weak points. */
export interface Preparedness {
  /** Days the stored food would feed the town (null: no reading). */
  readonly foodDays: number | null;
  readonly granaries: number;
  readonly markets: number;
  readonly shortHouseholds: number;
  readonly population: number;
  readonly policy: string | null;
  /** The weak points left: no granary, food under a season, households already short, no market to buy grain at. */
  readonly weakPoints: readonly ("no_granary" | "food_under_a_season" | "households_short" | "no_market")[];
  /** PLAY-2: each weak point with the town project that answers it (null: none — households already short). */
  readonly levers: readonly { readonly point: Preparedness["weakPoints"][number]; readonly project: string | null }[];
}

export function preparedness(state: GameState): Preparedness {
  const ticks = foodReserveTicks(state);
  const foodDays = ticks === null ? null : Math.floor(ticks * 360 / BALANCE.TICKS_PER_YEAR);
  const count = (kind: string) => state.buildings.filter(building => building.kind === kind).length;
  const granaries = count("granary"), markets = count("market");
  const shortHouseholds = foodShortHouseIds(state).size;
  const weakPoints: Preparedness["weakPoints"][number][] = [];
  if (granaries === 0) weakPoints.push("no_granary");
  if (foodDays !== null && foodDays < DAYS_PER_SEASON_FOR_CRISIS) weakPoints.push("food_under_a_season");
  if (shortHouseholds > 0) weakPoints.push("households_short");
  if (markets === 0) weakPoints.push("no_market");
  return { foodDays, granaries, markets, shortHouseholds, population: state.population, policy: state.agency?.policy ?? null, weakPoints,
    levers: weakPoints.map(point => ({ point, project: WEAK_POINT_PROJECT[point] })) };
}

/**
 * DEC-TRACE §6 API (`crisisReview`): the dearths coming (forecast: rumour or sign) with the town's preparedness now, and
 * those that came — their arrival's preparedness, their outcome (the damage or why it was avoided), the decisions behind.
 */
export function crisisReview(state: GameState) {
  const now = preparedness(state);
  const upcoming = eventForecast(state).filter(entry => entry.kind === "dearth" && (entry.stage === "rumour" || entry.stage === "sign"))
    .map(entry => ({ id: entry.id, defId: entry.defId, stage: entry.stage, arrivalTick: entry.arrivalTick, year: entry.year, season: entry.season, preparedness: now }));
  const records = state.history?.records ?? [];
  const past = (state.events?.records ?? []).filter(record => record.kind === "dearth").map(record => {
    const arrived = records.find(entry => entry.template === "crisis.arrived" && entry.params?.eventId === record.id);
    const outcome = records.find(entry => entry.template === "consequence" && entry.params?.key === "crisis_outcome" && entry.params?.eventId === record.id);
    return { id: record.id, defId: record.defId, arrivalTick: record.arrivalTick, endTick: record.endTick ?? null, response: record.response?.choice ?? null,
      arrival: arrived?.params ?? null, outcome: outcome?.params ?? null,
      decisions: [...(arrived?.because ?? []), ...(outcome?.because ?? [])].map(entry => entry.decisionId).filter((id, index, all) => all.indexOf(id) === index) };
  });
  return { now, upcoming, past };
}
