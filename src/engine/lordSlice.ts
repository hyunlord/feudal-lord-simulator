/**
 * LM-E8 (spec docs/design/lord-slice.md LS-1, LS-5): the lord's vertical slice — what its start screen shows (the
 * demesne and its town, the three neighbour estates, the factions, the goal and the end), when it ends (twenty years,
 * or five after the lord came to hold a second estate) and the summary of its end. Read only; nothing is stored (the
 * second estate's coming is its pieces' possession date).
 */
import { BALANCE } from "../content/balanceConfig";
import { HOME_ESTATE_ID } from "../content/estateConfig";
import { FACTION_DEF_BY_ID } from "../content/factionConfig";
import {
  LORD_SLICE_AFTER_SECOND_ESTATE_YEARS, LORD_SLICE_FACTIONS, LORD_SLICE_GOAL_YEARS, LORD_SLICE_SCENARIO_ID, LORD_SLICE_YEARS,
} from "../content/lordSliceConfig";
import { treasuryBalance } from "../ledger/ledger";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import { ageOf, currentYear } from "./persons";
import { scenarioOf } from "./scenarioState";

const YEAR = BALANCE.TICKS_PER_YEAR;
/** ES-8: the first two neighbour estates are the neighbour factions' (their leaders are the lords). */
const NEIGHBOUR_FACTION_OF_ESTATE: Readonly<Record<string, string>> = { "estate-neighbour-1": "neighbour_1", "estate-neighbour-2": "neighbour_2" };

/** LS-1: a game of the lord's slice. */
export function lordSlice(state: Pick<GameState, "scenarioId">): boolean {
  return state.scenarioId === LORD_SLICE_SCENARIO_ID;
}

export interface LordSliceStart {
  readonly seed: number;
  readonly startYear: number;
  readonly goalYears: typeof LORD_SLICE_GOAL_YEARS;
  readonly end: { readonly years: number; readonly afterSecondEstateYears: number };
  readonly home: { readonly estateId: string; readonly name: string; readonly annualValue: number; readonly pieces: readonly { readonly id: string; readonly kind: string; readonly possessor: string }[] };
  readonly town: { readonly population: number; readonly houses: number; readonly treasury: number };
  readonly neighbours: readonly {
    readonly estateId: string; readonly name: string; readonly manors: number; readonly annualValue: number; readonly debt: number;
    readonly house: string | null; readonly rank: string | null; readonly lordId: string | null; readonly lordAge: number | null;
    /** The faction whose leader is this house's lord (the first two neighbours; their lords are set at the first season). */
    readonly factionId: string | null;
    /** The house has daughters and no son living (the test neighbour: the old lord, daughters only, in debt). */
    readonly daughtersOnly: boolean;
  }[];
  readonly factions: readonly { readonly id: string; readonly kind: string; readonly relation: number }[];
}

/** LS-1 API (render LM-R3): the slice's start data — read from the opening state (or any state, as it stands). */
export function lordSliceStart(state: GameState): LordSliceStart {
  const estates = estatesOf(state);
  const year = currentYear(state);
  const home = estates.estates.find(estate => estate.id === HOME_ESTATE_ID)!;
  const person = (id: string | undefined) => estates.people.find(entry => entry.id === id);
  return {
    seed: state.seed,
    startYear: scenarioOf(state).startYear,
    goalYears: LORD_SLICE_GOAL_YEARS,
    end: { years: LORD_SLICE_YEARS, afterSecondEstateYears: LORD_SLICE_AFTER_SECOND_ESTATE_YEARS },
    home: { estateId: home.id, name: home.name, annualValue: home.annualValue, pieces: home.pieces.map(piece => ({ id: piece.id, kind: piece.kind, possessor: piece.possessor })) },
    town: { population: state.population, houses: state.houses.length, treasury: treasuryBalance(state) },
    neighbours: estates.estates.filter(estate => estate.offMap).map(estate => {
      const lord = person(estate.house?.lordId);
      const family = (estate.house?.familyIds ?? []).map(id => person(id)).filter(entry => entry !== undefined && entry.alive);
      return {
        estateId: estate.id, name: estate.name, manors: estate.manors, annualValue: estate.annualValue, debt: estate.burdens.debt,
        house: estate.house?.name ?? null, rank: estate.house?.rank ?? null, lordId: lord?.id ?? null, lordAge: lord === undefined ? null : ageOf(lord, year),
        factionId: NEIGHBOUR_FACTION_OF_ESTATE[estate.id] ?? null,
        daughtersOnly: family.some(entry => entry!.sex === "female") && !family.some(entry => entry!.sex === "male" && entry!.id !== lord?.id),
      };
    }),
    factions: LORD_SLICE_FACTIONS.map(id => {
      const faction = state.factions?.factions.find(entry => entry.id === id);
      const def = FACTION_DEF_BY_ID.get(id)!;
      return { id, kind: def.kind, relation: faction?.relation ?? def.startRelation };
    }),
  };
}

/** LS-5: the tick the lord came to hold a second estate (an estate off the map, title and possession), or null. */
export function secondEstateSince(state: GameState): number | null {
  let since: number | null = null;
  for (const estate of estatesOf(state).estates) {
    if (!estate.offMap || estate.titleHolder !== LORD || estate.possessor !== LORD) continue;
    const held = Math.min(...estate.pieces.map(piece => piece.possessedSince));
    since = since === null ? held : Math.min(since, held);
  }
  return since;
}

/** LS-5: the tick the slice ends — twenty years from its start, or five after the second estate, the sooner. */
export function lordSliceEndTick(state: GameState): number {
  const second = secondEstateSince(state);
  const years = LORD_SLICE_YEARS * YEAR;
  return second === null ? years : Math.min(years, second + LORD_SLICE_AFTER_SECOND_ESTATE_YEARS * YEAR);
}

export interface LordSliceOutcome {
  readonly ended: boolean;
  readonly reason: "years" | "second_estate" | null;
  readonly endTick: number;
  readonly summary: {
    readonly year: number;
    readonly population: number;
    readonly houses: number;
    readonly treasury: number;
    readonly estatesHeld: readonly string[];
    readonly secondEstateYear: number | null;
    /** The town's projects (receipts) and how many the lord's decisions moved (TA-6). */
    readonly projects: number;
    readonly projectsByLord: number;
    /** The lord's recorded decisions (the ledger's decision lines), by template. */
    readonly decisions: Readonly<Record<string, number>>;
    readonly promises: { readonly kept: number; readonly broken: number; readonly open: number };
    readonly marriage: string | null;
  };
}

/** LS-5 API: the slice's end (null outside the slice) — whether it has ended, why, and the summary of the lord's years. */
export function lordSliceOutcome(state: GameState): LordSliceOutcome | null {
  if (!lordSlice(state)) return null;
  const endTick = lordSliceEndTick(state);
  const ended = state.tick >= endTick;
  const second = secondEstateSince(state);
  const reason = !ended ? null : second !== null && endTick < LORD_SLICE_YEARS * YEAR ? "second_estate" as const : "years" as const;
  const receipts = state.agency?.receipts ?? [];
  const decisions: Record<string, number> = {};
  for (const record of state.history?.records ?? []) if (record.kind === "decision") decisions[record.template] = (decisions[record.template] ?? 0) + 1;
  const promises = (state.diplomacy?.promises ?? []).filter(entry => entry.promisor === LORD);
  return {
    ended, reason, endTick,
    summary: {
      year: currentYear(state),
      population: state.population,
      houses: state.houses.length,
      treasury: treasuryBalance(state),
      estatesHeld: estatesOf(state).estates.filter(estate => estate.titleHolder === LORD && estate.possessor === LORD).map(estate => estate.id),
      secondEstateYear: second === null ? null : currentYear({ ...state, tick: second }),
      projects: receipts.length,
      projectsByLord: receipts.filter(receipt => receipt.decisionIds.length > 0).length,
      decisions,
      promises: { kept: promises.filter(entry => entry.status === "kept").length, broken: promises.filter(entry => entry.status === "broken").length,
        open: promises.filter(entry => entry.status === "open").length },
      marriage: state.diplomacy?.marriage?.stage ?? null,
    },
  };
}
