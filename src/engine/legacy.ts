/**
 * F5-A chapter 5's autonomy and legacy (spec docs/design/chapter-five-legacy.md LG-1…LG-12). From chapter 5's first
 * season (the sandbox's first after the reorganisation), at each season start:
 *
 * - LG-1 the steps: the merchants' demand for a mayor, the Crown's envoy, the old lord's succession, the town's seal,
 *   the charter sealed or refused, the family's leaving or staying, the legacy sealed, the last market day of 1450.
 * - LG-2…LG-5 the four decisions (petitions, `answerLegacyPetition`): the charter, the heir, the Crown's tax, the legacy.
 * - LG-7 / LG-8 at the last market day: the legacy's three scores, the ending, chapter 5's end — the campaign's.
 */
import type { SourceRef } from "../contracts";
import { CHAPTER_FIVE, type PetitionResponse } from "../content/chapterConfig";
import { LEGACY_AXIS_COPY, LEGACY_ENDING_COPY, HEIR_RELATION_COPY } from "../content/legacyCopy.ko";
import {
  BOROUGH_AUTONOMY_PETITION_ID,
  BOROUGH_SEAL_RIGHT_ID,
  CHURCH_REBUILDING_PETITION_ID,
  GUILD_DISPUTE_PETITION_ID,
  HEIR_BY_RESPONSE,
  HEIR_CHOICE_PETITION_ID,
  LEGACY_BALANCE,
  LEGACY_BY_RESPONSE,
  LEGACY_CHOICE_PETITION_ID,
  LEGACY_INTERLUDE_IDS,
  LEGACY_PETITION_IDS,
  LEGACY_SEQUENCE_ID,
  LEGACY_STEP_IDS,
  MAYORALTY_RIGHT_ID,
  ROYAL_TAX_PETITION_ID,
  type HeirKind,
  type LegacyAxis,
  type LegacyEndingId,
  type LegacyInterludeId,
  type LegacyStepId,
} from "../content/legacyConfig";
import { VACANT_PRIEST_PETITION_ID } from "../content/plagueConfig";
import { BRIDGE_TOLLS_RIGHT_ID, MARKET_TOLLS_RIGHT_ID, REORGANISATION_BALANCE } from "../content/reorganisationConfig";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import type { LedgerCategory } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";
import type { HeirCandidate, LegacyEnding, LegacyScores, LegacyState, LegacyStep } from "./legacy.types";
import { lordshipOf } from "./lordshipState";
import { ageOf, currentYear, manorLord, offerHeirs, personDisplayName, seatHeir } from "./persons";
import { lineageGenerations } from "./personsApi";
import type { PetitionRecord } from "./politics.types";
import { calendar, scenarioOf } from "./scenarioState";

const SEASON = 1000;
const YEAR = 4000;
const B = LEGACY_BALANCE;
const TOWN_ACTOR: SourceRef = { type: "actor", id: "town" };
const TOWN_HOLDERS = new Set(["townsfolk", "craftsmen"]);

export function legacyOf(state: Pick<GameState, "legacy">): LegacyState | undefined {
  return state.legacy;
}

export function legacyActive(state: Pick<GameState, "scenarioId">): boolean {
  return scenarioOf(state).activeEvents.includes(LEGACY_SEQUENCE_ID);
}

/** The tick of `year`'s season `season` (0 spring … 3 winter). */
const seasonOf = (state: Pick<GameState, "scenarioId">, year: number, season = 0) => (year - scenarioOf(state).startYear) * YEAR + season * SEASON;
const yearOf = (state: Pick<GameState, "scenarioId">, tick: number) => calendar(tick, scenarioOf(state).startYear).year;
const lastMarketTick = (state: Pick<GameState, "scenarioId">) => seasonOf(state, B.lastMarketYear, B.lastMarketSeason);

// --- ledger --------------------------------------------------------------------------------------------------------

/** Posts `amount` (positive: into the treasury; negative: out of it, at most what it holds); returns what moved. */
function post(state: GameState, category: LedgerCategory, amount: number, sources: readonly [SourceRef, ...SourceRef[]]): { readonly state: GameState; readonly moved: number } {
  const moved = amount < 0 ? -Math.min(-amount, Math.max(0, treasuryBalance(state))) : amount;
  if (moved === 0) return { state, moved: 0 };
  const posted = postLedgerEntries(state, [{ account: "cash", category, amount: moved, sourceRefs: sources }]);
  return { state: { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger }, moved };
}

// --- the persons ---------------------------------------------------------------------------------------------------

/** The ledger's records (read directly: `history.ts` reads this module's forecast). */
const recordsOf = (state: Pick<GameState, "history">) => state.history?.records ?? [];

const personOf = (state: Pick<GameState, "persons">, id: string | null | undefined) =>
  id === null || id === undefined ? undefined : state.persons?.people.find(person => person.id === id) ?? state.persons?.past.find(person => person.id === id);
const nameOf = (state: Pick<GameState, "persons">, id: string | null | undefined) => { const person = personOf(state, id); return person === undefined ? "" : personDisplayName(person); };

/** The lord of the manor now (the house's head, else its eldest adult, `manorLord`). */
function lordOf(state: GameState) {
  return manorLord(state.persons?.people ?? [], lordshipOf(state).house.order, currentYear(state));
}

/** LG-1: the merchants' candidate for mayor — the first merchant house's head (a person of the town). */
function merchantLeader(state: GameState): string | null {
  const leader = state.factions?.factions.find(faction => faction.id === "merchant_house_1")?.leaderId ?? null;
  return leader !== null && state.persons?.people.some(person => person.id === leader) === true ? leader : null;
}

// --- the sequence --------------------------------------------------------------------------------------------------

function withLegacy(state: GameState, legacy: LegacyState): GameState {
  return { ...state, legacy };
}

function addPetition(state: GameState, defId: string, petitioner: PetitionRecord["petitioner"], options?: readonly PetitionResponse[]): GameState {
  if (state.politics === undefined) return state;
  const petition: PetitionRecord = { id: `${defId}@${state.tick}`, defId, petitioner, arrivedTick: state.tick, ...(options === undefined ? {} : { options }) };
  return { ...state, politics: { ...state.politics, petitions: [...state.politics.petitions, petition] } };
}

const petitionOf = (state: GameState, defId: string) => state.politics?.petitions.find(petition => petition.defId === defId);
/** When a petition was answered (by the lord or his silence), or null. */
const answeredAt = (state: GameState, defId: string) => petitionOf(state, defId)?.respondedTick ?? null;

/** LG-3: the answer that names each candidate there is, in the card's order. */
const HEIR_ORDER: readonly PetitionResponse[] = ["accept", "accept_with_price", "refuse"];
function heirOptions(candidates: readonly HeirCandidate[]): PetitionResponse[] {
  return HEIR_ORDER.filter(response => candidates.some(candidate => candidate.kind === HEIR_BY_RESPONSE[response]));
}

/** LG-3 API: the heirs offered (after the succession's question came), with what the card shows of each. */
export function heirCandidates(state: GameState): readonly (HeirCandidate & {
  readonly response: PetitionResponse; readonly name: string; readonly age: number; readonly birthYear: number;
  readonly portraitIdentity: string; readonly hair: string; readonly eye: string; readonly records: number; readonly through: string | null;
})[] {
  const legacy = legacyOf(state);
  if (legacy === undefined) return [];
  const year = currentYear(state);
  return legacy.candidates.flatMap(candidate => {
    const person = personOf(state, candidate.personId);
    if (person === undefined) return [];
    const response = HEIR_ORDER.find(entry => HEIR_BY_RESPONSE[entry] === candidate.kind)!;
    const records = recordsOf(state).filter(record => (record.subject.type === "person" && record.subject.id === person.id)
      || (record.actors ?? []).some(actor => actor.type === "person" && actor.id === person.id)).length;
    return [{ ...candidate, response, name: personDisplayName(person), age: ageOf(person, year), birthYear: person.birthYear,
      portraitIdentity: person.portraitIdentity, hair: person.traits.hair, eye: person.traits.eye, records, through: candidate.throughId === null ? null : nameOf(state, candidate.throughId) }];
  });
}

/**
 * LG-2…LG-5: the lord's answer to a chapter-5 petition (called by `respondToPetition`, which records the decision and
 * marks the petition answered). `expired` is a petition left a season unanswered (the lord's silence).
 */
export function answerLegacyPetition(state: GameState, petition: PetitionRecord, response: PetitionResponse | "expired"): GameState {
  const legacy = legacyOf(state);
  if (legacy === undefined) return state;
  let next = withLegacy(state, { ...legacy, answers: { ...legacy.answers, [petition.defId]: response } });
  const l = legacyOf(next)!;
  switch (petition.defId) {
    case ROYAL_TAX_PETITION_ID: {
      if (response !== "accept") break;
      const due = Math.max(B.subsidyMin, Math.min(B.subsidyMax, Math.floor(treasuryBalance(next) * B.subsidyPermille / 1000)));
      const paid = post(next, "royal_subsidy", -due, [{ type: "actor", id: "crown" }, { type: "claim", id: "royal_subsidy", detail: "tenth_and_fifteenth" }]);
      next = withLegacy(paid.state, { ...l, royalSubsidy: l.royalSubsidy - paid.moved });
      break;
    }
    case HEIR_CHOICE_PETITION_ID: {
      // The silence: the first there is (the son, else the daughter's husband, else the nephew).
      const options = petition.options ?? heirOptions(l.candidates);
      const answer = response === "expired" || !options.includes(response) ? options[0] : response;
      const chosen = answer === undefined ? undefined : l.candidates.find(candidate => candidate.kind === HEIR_BY_RESPONSE[answer]);
      if (chosen === undefined) break;
      const previous = lordOf(next)?.id ?? null;
      const relief = post(next, "succession_relief", -B.relief[chosen.kind], [{ type: "actor", id: "overlord" }, { type: "claim", id: "relief", detail: chosen.kind }]);
      next = seatHeir(relief.state, chosen, l.candidates);
      next = withLegacy(next, { ...l, heir: { kind: chosen.kind, personId: chosen.personId, previousHeadId: previous, tick: state.tick, relief: -relief.moved } });
      break;
    }
    case BOROUGH_AUTONOMY_PETITION_ID: {
      if (response === "accept") {
        // LG-2: the mayoralty and the seal to the town (and chapter 4's two lines if it had refused); the fine; the fee farm.
        const held = new Set((next.politics?.rights ?? []).map(right => right.id));
        const lines = [MAYORALTY_RIGHT_ID, BOROUGH_SEAL_RIGHT_ID, MARKET_TOLLS_RIGHT_ID, BRIDGE_TOLLS_RIGHT_ID].filter(id => !held.has(id));
        if (next.politics !== undefined) next = { ...next, politics: { ...next.politics, rights: [...next.politics.rights, ...lines.map(id => ({ id, holder: "townsfolk" as const,
          grantedTick: state.tick, petitionId: petition.id, stallFeePermille: id === MARKET_TOLLS_RIGHT_ID ? 0 : 1000 }))] } };
        next = post(next, "charter_fee", B.charterFine, [TOWN_ACTOR, { type: "right", id: BOROUGH_SEAL_RIGHT_ID, detail: "charter_fine" }]).state;
        if (l.answers[ROYAL_TAX_PETITION_ID] !== "accept") {
          next = post(next, "royal_subsidy", -B.confirmationFine, [{ type: "actor", id: "crown" }, { type: "claim", id: "royal_subsidy", detail: "confirmation" }]).state;
        }
        const mayor = personOf(next, l.mayorCandidateId)?.alive === true ? l.mayorCandidateId : merchantLeader(next);
        next = withLegacy(next, { ...l, backlash: 0, feeFarm: B.feeFarm, mayorId: mayor });
      } else {
        const town = next.reorganisation?.chapterFiveStart?.influence.town ?? next.reorganisation?.influence.town ?? 0;
        next = withLegacy(next, { ...l, backlash: Math.min(100, Math.max(B.backlashFloor, town, l.backlash + B.backlashAgain)) });
      }
      break;
    }
    case CHURCH_REBUILDING_PETITION_ID: {
      // FIX-9 (LG-13): the nave rebuilt at the lord's cost (the guild's quarrel moves only the factions).
      if (response !== "accept") break;
      const paid = post(next, "church_rebuilding", -B.churchRebuildingCost, [{ type: "actor", id: "bishop" }, { type: "claim", id: "church_rebuilding", detail: "nave" }]);
      next = withLegacy(paid.state, { ...l, naveRebuilt: true });
      break;
    }
    case LEGACY_CHOICE_PETITION_ID: {
      if (response === "expired") { next = withLegacy(next, { ...l, legacy: null }); break; }
      const axis = LEGACY_BY_RESPONSE[response];
      const paid = post(next, "legacy_endowment", -B.endowment, [TOWN_ACTOR, { type: "claim", id: "legacy", detail: axis }]);
      next = withLegacy(paid.state, { ...l, legacy: axis, endowment: -paid.moved });
      break;
    }
  }
  return next;
}

/** LG-12 prediction (HL-3): the treasury after the answer, two seasons on. */
export function legacyDecisionForecast(state: GameState, defId: string, response: PetitionResponse): number {
  const treasury = treasuryBalance(state);
  const legacy = legacyOf(state);
  const within = (tick: number) => tick > state.tick && tick <= state.tick + 2 * SEASON;
  const spring = Math.ceil((state.tick + 1) / YEAR) * YEAR;
  const out = (amount: number, from = treasury) => from - Math.min(amount, Math.max(0, from));
  switch (defId) {
    case ROYAL_TAX_PETITION_ID:
      return response === "accept" ? out(Math.max(B.subsidyMin, Math.min(B.subsidyMax, Math.floor(treasury * B.subsidyPermille / 1000)))) : treasury;
    case HEIR_CHOICE_PETITION_ID:
      return out(B.relief[HEIR_BY_RESPONSE[response]]);
    case BOROUGH_AUTONOMY_PETITION_ID: {
      if (response !== "accept") return treasury;
      const confirmed = legacy?.answers[ROYAL_TAX_PETITION_ID] === "accept" ? 0 : B.confirmationFine;
      const farm = within(spring) ? B.feeFarm - (legacy?.feeFarm ?? 0) : 0;
      return out(confirmed, treasury + B.charterFine) + Math.max(0, farm);
    }
    case LEGACY_CHOICE_PETITION_ID:
      return out(B.endowment);
    case CHURCH_REBUILDING_PETITION_ID:
      return response === "accept" ? out(B.churchRebuildingCost) : treasury;
    // Item 10: guild_dispute — no direct treasury movement; relations differ but money stays
    case GUILD_DISPUTE_PETITION_ID:
      return treasury;
    default:
      return treasury;
  }
}

/** LG-1: when each step is due (null: waits on the step before it). */
function due(state: GameState, legacy: LegacyState, step: LegacyStepId): number | null {
  const at = legacy.steps;
  switch (step) {
    case "mayor_demand": return legacy.startTick + B.mayorAfter * SEASON;
    case "royal_tax_envoy": return at.mayor_demand === undefined ? null : at.mayor_demand + B.envoyAfterMayor * SEASON;
    case "succession": return at.royal_tax_envoy === undefined ? null : Math.max(at.royal_tax_envoy + B.successionAfterEnvoy * SEASON, seasonOf(state, B.successionFromYear));
    case "city_seal": { const heir = answeredAt(state, HEIR_CHOICE_PETITION_ID); return heir === null ? null : heir + B.sealAfterHeir * SEASON; }
    case "charter_sealing": return at.city_seal === undefined ? null : at.city_seal + B.charterAfterSeal * SEASON;
    case "family_departure": { const charter = answeredAt(state, BOROUGH_AUTONOMY_PETITION_ID); return charter === null ? null : charter + B.departureAfterCharter * SEASON; }
    case "legacy_record": return at.family_departure === undefined ? null : Math.max(at.family_departure + B.legacyAfterDeparture * SEASON, seasonOf(state, B.legacyFromYear));
    case "last_market": return lastMarketTick(state);
  }
}

/** LG-12 API `legacyForecast`: the eight steps and their state. */
export function legacyForecast(state: GameState): readonly LegacyStep[] {
  const legacy = legacyOf(state);
  if (legacy === undefined) return [];
  return LEGACY_STEP_IDS.map(id => {
    const came = legacy.steps[id];
    const tick = came ?? due(state, legacy, id);
    return { id, tick, state: came !== undefined ? "done" : tick !== null && state.tick >= tick ? "now" : "ahead" };
  });
}

/** LG-13: the tick of each interlude event (the guild's quarrel and the market's fire share 1394). */
function interludeTick(state: Pick<GameState, "scenarioId">, id: LegacyInterludeId): number {
  const [year, season] = id === "staple" ? B.staple : id === "church_rebuilding" ? B.churchRebuilding : id === "deposition" ? B.deposition : B.guildDispute;
  return seasonOf(state, year, season);
}

/**
 * LG-13 API `legacyInterludes`: the interlude's events and their state — those the chapter opened too late for are left
 * out; of 1394's two, the one the town has (the guild's quarrel with a guild, else the market's fire).
 */
export function legacyInterludes(state: GameState): readonly { readonly id: LegacyInterludeId; readonly tick: number; readonly state: "done" | "ahead" }[] {
  const legacy = legacyOf(state);
  if (legacy === undefined) return [];
  const guild = state.reorganisation?.guild !== undefined;
  return LEGACY_INTERLUDE_IDS.filter(id => (id === "guild_dispute" ? guild : id === "market_fire" ? !guild : true) && interludeTick(state, id) > legacy.startTick)
    .map(id => ({ id, tick: interludeTick(state, id), state: legacy.interludes?.[id] !== undefined ? "done" as const : "ahead" as const }));
}

/** LG-13: the interlude's events due by this season start (by the calendar, in a chapter opened before them). */
function advanceInterlude(state: GameState): GameState {
  let next = state;
  for (const due of legacyInterludes(state).filter(entry => entry.state === "ahead" && entry.tick <= state.tick)) {
    const legacy = legacyOf(next)!;
    next = withLegacy(next, { ...legacy, interludes: { ...legacy.interludes, [due.id]: state.tick } });
    if (due.id === "guild_dispute") next = addPetition(next, GUILD_DISPUTE_PETITION_ID, "craftsmen");
    if (due.id === "church_rebuilding") next = addPetition(next, CHURCH_REBUILDING_PETITION_ID, "parish");
    if (due.id === "market_fire") next = post(next, "construction", -B.marketFireRepair, [TOWN_ACTOR, { type: "claim", id: "market_fire", detail: "repair" }]).state;
  }
  return next;
}

/** LG-13: the Staple's years — cloth sells dearer (permille), else 1,000. */
export function legacyClothPermille(state: Partial<Pick<GameState, "legacy" | "tick">>): number {
  const staple = state.legacy?.interludes?.staple;
  return staple !== undefined && state.tick !== undefined && state.tick < staple + B.stapleSeasons * SEASON ? B.staplePricePermille : 1_000;
}

/** LG-12 API: the stage now — before the envoy, from it to the charter's answer, from then to the end, done (null before). */
export function legacyStage(state: Pick<GameState, "legacy">): "rumour" | "arrival" | "recovery" | "done" | null {
  const legacy = state.legacy;
  if (legacy === undefined) return null;
  if (legacy.endedTick !== undefined) return "done";
  if (legacy.steps.family_departure !== undefined) return "recovery";
  return legacy.steps.royal_tax_envoy === undefined ? "rumour" : "arrival";
}

// --- LG-7 the legacy -----------------------------------------------------------------------------------------------

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const relation = (state: GameState, id: string) => state.factions?.factions.find(faction => faction.id === id)?.relation ?? 0;

/** LG-7 API: the legacy's three scores now (the parts behind each). */
export function legacyScores(state: GameState): LegacyScores {
  const legacy = legacyOf(state);
  const c = B.score;
  const lived = state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined);
  const autonomy = legacy?.answers[BOROUGH_AUTONOMY_PETITION_ID];
  const town = {
    people: Math.min(c.town.peopleCap, Math.floor(Math.max(0, state.population) / c.town.peoplePerPoint)),
    houses: lived.length === 0 ? 0 : Math.floor(lived.filter(house => house.level >= 4).length * c.town.l4Points / lived.length),
    cloth: Math.min(c.town.clothCap, Math.floor((legacy?.clothSold ?? 0) / c.town.clothPerPoint)),
    rights: Math.min(c.town.rightsCap, (state.politics?.rights ?? []).filter(right => TOWN_HOLDERS.has(right.holder)).length * c.town.rightPoints),
    autonomy: autonomy === "accept" ? c.town.autonomy : autonomy === undefined ? 0 : c.town.refused,
    legacy: legacy?.legacy === "town" ? B.legacyPoints : 0,
  };
  const lordship = lordshipOf(state);
  const generations = lineageGenerations(state, `lord:${lordship.house.order}`).length;
  const family = {
    house: Math.max(0, c.family.firstHouse + (lordship.house.order - 1) * c.family.perChange),
    generations: Math.min(c.family.generationsCap, generations * c.family.perGeneration),
    heir: legacy?.heir === undefined ? 0 : c.family.heir[legacy.heir.kind],
    stayed: legacy?.family === "stayed" ? c.family.stayed : 0,
    relations: clamp(Math.floor((relation(state, "overlord") + relation(state, "crown")) / c.family.relationDivisor), 0, c.family.relationCap),
    treasury: Math.min(c.family.treasuryCap, Math.floor(Math.max(0, treasuryBalance(state)) / c.family.treasuryPerPoint)),
    legacy: legacy?.legacy === "family" ? B.legacyPoints : 0,
  };
  const built = (kind: string) => state.buildings.filter(building => building.kind === kind).length;
  const church = {
    church: Math.min(c.church.churchCap, built("church") * c.church.church),
    chapels: Math.min(c.church.chapelCap, built("chapel") * c.church.chapel),
    bishop: clamp(Math.floor(relation(state, "bishop") / c.church.bishopDivisor), 0, c.church.bishopCap),
    priest: state.plague?.answers[VACANT_PRIEST_PETITION_ID] === "accept" ? c.church.priest : 0,
    relief: (state.politics?.decisions ?? []).some(decision => decision.kind === "famine_response" && decision.choice === "relief") ? c.church.relief : 0,
    rebuilt: legacy?.naveRebuilt === true ? c.church.rebuilt : 0,
    legacy: legacy?.legacy === "church" ? B.legacyPoints : 0,
  };
  const sum = (parts: Readonly<Record<string, number>>) => clamp(Object.values(parts).reduce((total, value) => total + value, 0), 0, 100);
  return { town: sum(town), family: sum(family), church: sum(church), parts: { town, family, church } };
}

const ENDINGS: Readonly<Record<LegacyAxis, (chosen: LegacyAxis | null) => LegacyEndingId>> = {
  town: chosen => chosen === "town" ? "free_borough" : chosen === "family" ? "house_remembered" : "merchants_chantry",
  family: chosen => chosen === "family" ? "house_seat" : "lords_town",
  church: () => "pilgrim_town",
};

/** LG-7: the ending the scores and the chosen legacy make, with the ledger records its sentence quotes. */
function endingOf(state: GameState, scores: LegacyScores): LegacyEnding {
  const legacy = legacyOf(state);
  const highest: LegacyAxis = scores.town >= scores.family && scores.town >= scores.church ? "town" : scores.family >= scores.church ? "family" : "church";
  const chosen = legacy?.legacy ?? null;
  const decisions = recordsOf(state).filter(record => record.kind === "decision");
  const quoted = (defId: string) => decisions.find(record => record.params?.defId === defId)?.id;
  const quotes = [BOROUGH_AUTONOMY_PETITION_ID, HEIR_CHOICE_PETITION_ID, LEGACY_CHOICE_PETITION_ID].map(quoted).filter((id): id is string => id !== undefined);
  const lordship = lordshipOf(state);
  const charterTick = legacy?.answers[BOROUGH_AUTONOMY_PETITION_ID] === "accept" ? answeredAt(state, BOROUGH_AUTONOMY_PETITION_ID) : null;
  const params = {
    house: lordship.house.name, since: yearOf(state, lordship.house.since), charterYear: charterTick === null ? 0 : yearOf(state, charterTick),
    mayor: nameOf(state, legacy?.mayorId), heir: nameOf(state, legacy?.heir?.personId), legacy: chosen ?? "",
    generations: Math.max(1, lineageGenerations(state, `lord:${lordship.house.order}`).length),
    town: scores.town, family: scores.family, church: scores.church,
  };
  return { id: ENDINGS[highest](chosen), highest, chosen, quotes, params };
}

/** LG-7 API `legacyEnding`: the campaign's ending (written at the last market day; before it, what the scores make now). */
export function legacyEnding(state: GameState): { readonly id: LegacyEndingId; readonly title: string; readonly sentence: string; readonly quotes: readonly string[]; readonly final: boolean } | null {
  const legacy = legacyOf(state);
  if (legacy === undefined) return null;
  const ending = legacy.ending ?? endingOf(state, legacyScores(state));
  const copy = LEGACY_ENDING_COPY[ending.id]!;
  return { id: ending.id, title: copy.title, sentence: copy.sentence(ending.params), quotes: ending.quotes, final: legacy.ending !== undefined };
}

/** LG-3 / LG-5: the words a step's record carries (the heir's relation, the legacy). */
export function heirRelationWord(candidate: Pick<HeirCandidate, "relation">): string {
  return HEIR_RELATION_COPY[candidate.relation] ?? candidate.relation;
}
export function legacyWord(axis: LegacyAxis | null | undefined): string {
  return axis === null || axis === undefined ? "" : LEGACY_AXIS_COPY[axis]!.legacy;
}

/** LG-1: chapter 5 begins — with chapter 5 in the campaign, the season after the reorganisation in the sandbox. */
function startsNow(state: GameState): boolean {
  if (scenarioOf(state).mode === "campaign") return (state.politics?.chapter.number ?? 1) >= CHAPTER_FIVE.chapter;
  const ended = state.reorganisation?.endedTick;
  return ended !== undefined && state.tick > ended;
}

/** LG-7: the cloth sold this tick (the ledger's seal entries of this tick). */
function clothThisTick(state: GameState): number {
  const entries = state.ledger?.entries ?? [];
  let sold = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (entry.tick !== state.tick) break;
    if (entry.account === "cash" && entry.category === "ulnage") sold += 1;
  }
  return sold;
}

/** The step came: its tick, the chapter's own answers to it (petitions), what it changes. */
function came(state: GameState, legacy: LegacyState, step: LegacyStepId): GameState {
  return withLegacy(state, { ...legacy, steps: { ...legacy.steps, [step]: state.tick } });
}

/**
 * One tick of F5-A (a no-op except at season starts and for a scenario without chapter 5; the cloth count at the
 * market's ticks). `endChapter` writes chapter 5's end (the politics) — the campaign's.
 */
export function advanceLegacy(state: GameState, endChapter: (state: GameState) => GameState): GameState {
  if (state.tick <= 0 || !legacyActive(state)) return state;
  let l = legacyOf(state);
  const seasonStart = state.tick % SEASON === 0;
  if (l === undefined) {
    if (!seasonStart || !startsNow(state)) return state;
    const start = state.reorganisation?.chapterFiveStart;
    return withLegacy(state, { startTick: state.tick, steps: {}, answers: {}, mayorCandidateId: null, candidates: [], royalSubsidy: 0,
      backlash: start?.backlash ?? 0, feeFarm: start?.feeFarm ?? 0, endowment: 0, clothSold: 0 });
  }
  let next = state;
  if (l.endedTick !== undefined) return next;
  const sold = clothThisTick(state);
  if (sold > 0) next = withLegacy(next, l = { ...l, clothSold: l.clothSold + sold });
  if (!seasonStart) return next;
  const tick = state.tick;

  // LG-2: the fee farm a sealed charter raised — the part chapter 4's does not already pay (each spring).
  const chapterFour = state.reorganisation?.chapterFiveStart?.charter === "partial" ? REORGANISATION_BALANCE.feeFarm : 0;
  if (tick % YEAR === 0 && l.answers[BOROUGH_AUTONOMY_PETITION_ID] === "accept" && l.feeFarm > chapterFour) {
    next = post(next, "fee_farm", l.feeFarm - chapterFour, [TOWN_ACTOR, { type: "right", id: BOROUGH_SEAL_RIGHT_ID, detail: "fee_farm" }]).state;
  }

  // A petition left a season unanswered: the lord's silence answers it.
  for (const petition of next.politics?.petitions ?? []) {
    if (petition.response !== undefined || !(LEGACY_PETITION_IDS as readonly string[]).includes(petition.defId)) continue;
    if (tick - petition.arrivedTick < SEASON) continue;
    next = answerLegacyPetition(next, petition, "expired");
    next = { ...next, politics: { ...next.politics!, petitions: next.politics!.petitions.map(entry => entry.id === petition.id
      ? { ...entry, response: "expired" as const, respondedTick: tick } : entry) } };
  }
  // LG-13: the interlude's events by the calendar.
  next = advanceInterlude(next);
  l = legacyOf(next)!;
  const ready = (step: LegacyStepId) => { const at = due(next, l!, step); return l!.steps[step] === undefined && at !== null && tick >= at; };

  if (ready("mayor_demand")) {
    next = came(next, l, "mayor_demand");
    next = withLegacy(next, l = { ...legacyOf(next)!, mayorCandidateId: merchantLeader(next) });
  }
  if (ready("royal_tax_envoy")) {
    next = addPetition(came(next, l, "royal_tax_envoy"), ROYAL_TAX_PETITION_ID, "crown");
    l = legacyOf(next)!;
  }
  // LG-1: the succession the first spring the lord is old, by the latest.
  if (ready("succession")) {
    const lord = lordOf(next);
    const old = lord !== undefined && ageOf(lord, yearOf(next, tick)) >= B.lordOldAge && tick % YEAR === 0;
    const latest = due(next, l, "succession")! + (B.successionLatestAfterEnvoy - B.successionAfterEnvoy) * SEASON;
    if (old || tick >= latest || lord === undefined) {
      const offered = offerHeirs(came(next, l, "succession"));
      next = withLegacy(offered.state, l = { ...legacyOf(offered.state)!, candidates: offered.candidates });
      next = addPetition(next, HEIR_CHOICE_PETITION_ID, "overlord", heirOptions(offered.candidates));
      l = legacyOf(next)!;
    }
  }
  if (ready("city_seal")) {
    next = came(next, l, "city_seal");
    l = legacyOf(next)!;
  }
  if (ready("charter_sealing")) {
    next = addPetition(came(next, l, "charter_sealing"), BOROUGH_AUTONOMY_PETITION_ID, "townsfolk");
    l = legacyOf(next)!;
  }
  if (ready("family_departure")) {
    next = came(next, l, "family_departure");
    next = withLegacy(next, l = { ...legacyOf(next)!, family: l.answers[BOROUGH_AUTONOMY_PETITION_ID] === "accept" ? "departed" : "stayed" });
  }
  // LG-5: the legacy's question, and its record sealed the season after the answer.
  if (l.steps.family_departure !== undefined && petitionOf(next, LEGACY_CHOICE_PETITION_ID) === undefined && tick >= due(next, l, "legacy_record")!) {
    next = addPetition(next, LEGACY_CHOICE_PETITION_ID, "townsfolk");
    l = legacyOf(next)!;
  }
  const legacyAnswered = answeredAt(next, LEGACY_CHOICE_PETITION_ID);
  if (l.steps.legacy_record === undefined && legacyAnswered !== null && tick > legacyAnswered) {
    next = came(next, l, "legacy_record");
    l = legacyOf(next)!;
  }

  // LG-7 / LG-8: the last market day — the scores, the ending, chapter 5's end (the campaign's).
  if (tick >= lastMarketTick(next)) {
    next = came(next, l, "last_market");
    const scores = legacyScores(next);
    next = withLegacy(next, { ...legacyOf(next)!, scores, ending: endingOf(next, scores), endedTick: tick });
    if (scenarioOf(next).mode === "campaign" && next.politics?.chapter.number === CHAPTER_FIVE.chapter) next = endChapter(next);
  }
  return next;
}

/** LG-8: the chronicle page's line for chapter 5. */
export function legacyChronicleStats(state: GameState) {
  const l = legacyOf(state);
  if (l === undefined) return undefined;
  const answer = (defId: string) => l.answers[defId];
  return {
    startYear: yearOf(state, l.startTick),
    mayor: l.mayorId !== undefined && l.mayorId !== null,
    heir: (l.heir?.kind ?? null) as HeirKind | null,
    royalTax: answer(ROYAL_TAX_PETITION_ID) === "accept" ? "paid" as const : answer(ROYAL_TAX_PETITION_ID) === undefined ? null : "petitioned" as const,
    charter: answer(BOROUGH_AUTONOMY_PETITION_ID) === "accept" ? "sealed" as const : answer(BOROUGH_AUTONOMY_PETITION_ID) === undefined ? null : "refused" as const,
    family: l.family ?? null,
    legacy: l.legacy ?? null,
    ending: l.ending?.id ?? null,
    scores: l.scores === undefined ? null : { town: l.scores.town, family: l.scores.family, church: l.scores.church },
  };
}
