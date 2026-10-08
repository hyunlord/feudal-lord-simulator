import type { PetitionDef, PetitionResponse } from "../content/chapterConfig";
import { buildingFootprintDistance } from "../geometry/buildingDistance";
import type { GameState } from "./engine.types";
import type { PetitionRecord } from "./politics.types";
import { scenarioOf, stateCalendar } from "./scenarioState";

const DEFINITIONS: readonly (PetitionDef & { readonly registryChoices: Readonly<Partial<Record<PetitionResponse, string>>> })[] = [
  { id: "ck_evt_057", petitioner: "merchants", demand: "church_market_charter", fromYear: 1300, toYear: 1450, requiresLots: 0,
    registryChoices: { accept: "light", accept_with_price: "fee", refuse: "refuse" },
    responses: ["accept", "accept_with_price", "refuse"], expiredGauge: -5,
    outcomes: {
      accept: { right: "market_charter", stallFeePermille: 750, charterFee: 0, gauge: 12 },
      accept_with_price: { right: "market_charter", stallFeePermille: 1000, charterFee: 80, gauge: 3 },
      refuse: { right: null, stallFeePermille: 1000, charterFee: 0, gauge: -5 },
    } },
  { id: "ck_evt_058", petitioner: "merchants", demand: "merchant_single_payment", fromYear: 1300, toYear: 1450, requiresLots: 0,
    registryChoices: { accept: "remit", accept_with_price: "collect" },
    responses: ["accept", "accept_with_price"], expiredGauge: -4,
    outcomes: {
      accept: { right: null, stallFeePermille: 1000, charterFee: 0, gauge: 8 },
      accept_with_price: { right: null, stallFeePermille: 1000, charterFee: 50, gauge: 0 },
      refuse: { right: null, stallFeePermille: 1000, charterFee: 0, gauge: -4 },
    } },
];

/** Final v4 calendar (1300–1450) supersedes the earlier R05 definition window. Isolated lookup; these definitions must never enter the calendar scheduler. */
export function registryChapterPetitionDef(id: string): PetitionDef | undefined {
  return DEFINITIONS.find(def => def.id === id);
}

export function registryChapterPetitionDeadline(state: GameState, petition: PetitionRecord): number {
  return Math.min(petition.arrivedTick + 1000, (1451 - scenarioOf(state).startYear) * 4000);
}

export function registryChapterPetitionContext(state: GameState, id: string): boolean {
  const def = registryChapterPetitionDef(id);
  const year = stateCalendar(state).year;
  if (def === undefined || state.agency === undefined || year < def.fromYear || year > def.toYear) return false;
  const markets = state.buildings.filter(building => building.kind === "market");
  if (id === "ck_evt_058") return markets.length > 0;
  const politics = state.politics;
  if (politics === undefined || politics.rights.some(right => right.id === "market_charter")
    || politics.petitions.some(petition => petition.defId === "market_charter" && petition.response === undefined)) return false;
  const fee = Math.min(1000, ...politics.rights.map(right => right.stallFeePermille));
  return state.agency.duesPermille >= 250 && state.agency.duesPermille <= 2000 && fee > 750 && fee <= 1000
    && markets.some(market => state.buildings.some(building => (building.kind === "church" || building.kind === "chapel")
      && buildingFootprintDistance(market, building) <= 4));
}

/** Pure candidate copy. Persist only the weighted winner after the registry's budget and conflict selection. */
export function prepareRegistryChapterPetition(state: GameState, id: string): GameState | null {
  const def = registryChapterPetitionDef(id);
  const politics = state.politics;
  if (def === undefined || politics === undefined || !registryChapterPetitionContext(state, id)
    || politics.petitions.some(petition => petition.defId === id)
    || state.registry?.occurrences.some(occurrence => occurrence.entryId === id)) return null;
  const petition: PetitionRecord = { id: `${id}@${state.tick}`, defId: id, petitioner: def.petitioner,
    arrivedTick: state.tick, ...(def.responses === undefined ? {} : { options: def.responses }) };
  if (registryChapterPetitionDeadline(state, petition) - state.tick < 80) return null;
  return { ...state, politics: { ...politics, petitions: [...politics.petitions, petition] } };
}

export function canAnswerRegistryChapterPetition(state: GameState, petition: PetitionRecord, response: PetitionResponse): boolean {
  const def = registryChapterPetitionDef(petition.defId);
  return def !== undefined && petition.response === undefined && state.tick < registryChapterPetitionDeadline(state, petition)
    && def.responses?.includes(response) === true && registryChapterPetitionContext(state, petition.defId)
    && state.politics?.petitions.some(record => record.id === petition.id && record.defId === petition.defId && record.response === undefined) === true;
}

export function settleAnsweredRegistryChapterPetition(state: GameState, petitionId: string): GameState {
  const petition = state.politics?.petitions.find(record => record.id === petitionId);
  const definition = DEFINITIONS.find(def => def.id === petition?.defId);
  const registry = state.registry;
  if (petition?.response === undefined || petition.response === "expired" || petition.respondedTick === undefined
    || definition === undefined || registry === undefined) return state;
  const choiceId = definition.registryChoices[petition.response];
  if (choiceId === undefined) return state;
  const settledTick = petition.respondedTick;
  let changed = false;
  const occurrences = registry.occurrences.map(occurrence => {
    if (occurrence.status !== "offered" || occurrence.source !== "v4" || occurrence.entryId !== petition.defId
      || occurrence.bound?.chapterPetition !== petition.id) return occurrence;
    changed = true;
    return { ...occurrence, status: "answered" as const, choiceId, settledTick };
  });
  return changed ? { ...state, registry: { ...registry, occurrences } } : state;
}

/** Called before the registry seasonal guard. Existing transition observers own faction/history changes. */
export function expireRegistryChapterPetitions(state: GameState): GameState {
  const politics = state.politics;
  if (politics === undefined) return state;
  const due = politics.petitions.filter(petition => registryChapterPetitionDef(petition.defId) !== undefined
    && petition.response === undefined && state.tick >= registryChapterPetitionDeadline(state, petition));
  if (due.length === 0) return state;
  const ids = new Set(due.map(petition => petition.id));
  const gaugeDelta = due.reduce((total, petition) => total + (registryChapterPetitionDef(petition.defId)?.expiredGauge ?? 0), 0);
  return { ...state, politics: { ...politics, merchantGauge: Math.max(0, Math.min(100, politics.merchantGauge + gaugeDelta)),
    petitions: politics.petitions.map(petition => ids.has(petition.id) ? { ...petition, response: "expired", respondedTick: state.tick } : petition) },
    ...(state.registry === undefined ? {} : { registry: { ...state.registry,
      occurrences: state.registry.occurrences.map(occurrence => occurrence.status === "offered" && ids.has(occurrence.bound?.chapterPetition ?? "")
        ? { ...occurrence, status: "lapsed", settledTick: state.tick } : occurrence) } }) };
}
