/**
 * F0-C1 chapter 1's decisions and end (spec docs/design/flow-chapter-one.md FC-2…FC-5). Runs every tick after the
 * events (a no-op between the ladder's 50-tick samples):
 *
 * - FC-2 famine answer (`famineResponse`): chosen once while the famine arrives. At every season's start of the famine,
 *   relief buys bread into a granary with treasury money (`famine_relief`), speculation sells granary grain into the
 *   treasury (`famine_sale`), price control costs the merchants' goodwill. The departure cap and the price cap are read
 *   by the ladder and the market (`departureCapPerSeason`, `foodPricePermille`).
 * - FC-3 petition: arrives at the seed's season in its years once the town has its building; the answer (`respondToPetition`)
 *   grants the right (stall fee), takes a charter price, moves the gauge. Unanswered at its years' end it expires.
 * - FC-4 rights: `rights[]`, one line per right, published in the B1 pipe with source `{type:"right"}`.
 * - FC-5 chronicle and chapter end: when the famine is over, the town came through it with at least 60 % of its people
 *   and it is a market town, chapter 1 ends and its chronicle page is written.
 */
import { EffectRegistry, SETTLEMENT_REGION_ID, type SourceRef } from "../contracts";
import { BUILDING_CONFIG_BY_KIND, operationSuspended } from "../content/buildingConfig";
import {
  CHAPTER_ONE,
  FAMINE_RESPONSE_CONFIG,
  MERCHANT_GAUGE_START,
  PETITION_DEFS,
  type FamineResponseChoice,
  type PetitionDef,
  type PetitionResponse,
} from "../content/chapterConfig";
import { GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { postLedgerEntries } from "../ledger/ledger";
import type { LedgerPosting } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";
import { SEASON_TICKS, dearthEndTick, famineShortHouses, recordStage } from "./eventSchedule";
import type { EventRecord } from "./events.types";
import { eventSource } from "./events";
import { marketSalePrice } from "./marketSettlement";
import type { ChapterEnd, ChronicleEntry, DecisionRecord, PetitionRecord, PoliticsState } from "./politics.types";
import { hashSeed } from "./prng";
import { calendar, scenarioOf } from "./scenarioState";
import { housingLotCount } from "../population/housing";

const SAMPLE = 50;

export function initialPolitics(state: Pick<GameState, "tick" | "population">): PoliticsState {
  return { merchantGauge: MERCHANT_GAUGE_START, petitions: [], rights: [], decisions: [],
    chapter: { number: CHAPTER_ONE.chapter, startTick: state.tick, populationStart: state.population, peakPopulation: state.population }, chapterEnds: [] };
}

function politicsOf(state: GameState): PoliticsState {
  return state.politics ?? initialPolitics(state);
}

const clampGauge = (value: number) => Math.max(0, Math.min(100, value));

/** FC-1: the Great Famine's record, if it arrived. */
export function famineRecord(state: Pick<GameState, "events">): EventRecord | undefined {
  return state.events?.records.find(record => record.defId === GREAT_FAMINE_EVENT_ID);
}

/** FC-2 API: the famine now — its stage, the answer chosen and the answers still open (null before it arrives). */
export function famineStatus(state: GameState): { readonly eventId: string; readonly stage: ReturnType<typeof recordStage>;
  readonly response: FamineResponseChoice | null; readonly choices: readonly FamineResponseChoice[]; readonly endTick: number } | null {
  const record = famineRecord(state);
  if (record === undefined) return null;
  const stage = recordStage(record, state.tick);
  return { eventId: record.id, stage, response: record.response?.choice ?? null,
    choices: stage === "arrival" && record.response === undefined ? ["relief", "price_control", "laissez_faire", "speculation"] : [],
    endTick: record.endTick ?? dearthEndTick(record) };
}

/** FC-2 action `famine_response`: the lord answers the arriving famine, once. */
export function famineResponse(state: GameState, choice: FamineResponseChoice): GameState {
  const record = famineRecord(state);
  if (record === undefined || record.response !== undefined || recordStage(record, state.tick) !== "arrival") return state;
  const events = state.events!;
  const politics = politicsOf(state);
  return {
    ...state,
    events: { ...events, records: events.records.map(entry => entry === record ? { ...entry, response: { choice, tick: state.tick } } : entry) },
    politics: { ...politics, decisions: [...politics.decisions, { kind: "famine_response", tick: state.tick, eventId: record.id, choice }] },
  };
}

function granaries(state: GameState) {
  return state.buildings.filter(building => building.kind === "granary" && !operationSuspended(building)).sort((a, b) => a.id.localeCompare(b.id));
}

/** Bread the town eats in a season at the ration (every lived-in house). */
function seasonBread(state: GameState): number {
  const ration = state.houses.reduce((sum, house) => sum + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  return Math.ceil(ration * SEASON_TICKS / HOUSE_FOOD_INTERVAL);
}


/** FC-2: a season's relief or speculation, at the season's start while the famine arrives. */
function stepFamineResponse(state: GameState, record: EventRecord): GameState {
  const choice = record.response?.choice;
  const source = eventSource(record, choice);
  if (choice === "relief") {
    const granary = granaries(state)[0];
    const price = marketSalePrice(state, "bread");
    const poor = new Set(famineShortHouses(state, true));
    const need = seasonBread({ ...state, houses: state.houses.filter(house => poor.has(house.buildingId)) });
    const budget = Math.floor(Math.max(0, state.treasuryCoin) * FAMINE_RESPONSE_CONFIG.reliefTreasuryPermille / 1000);
    const capacity = granary === undefined ? 0 : Math.max(0, BUILDING_CONFIG_BY_KIND.granary.storageCapacity
      - Object.values(granary.inventory).reduce((sum, amount) => sum + (amount ?? 0), 0));
    const bread = price <= 0 ? 0 : Math.min(need, Math.floor(budget / price), capacity);
    if (granary === undefined || bread <= 0) return state;
    const posted = postLedgerEntries(state, [{ account: "cash", category: "famine_relief", amount: -bread * price,
      sourceRefs: [source, { type: "building", id: granary.id, detail: `bread:${bread}` }] }]);
    return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger,
      buildings: state.buildings.map(building => building.id === granary.id ? { ...building, inventory: { ...building.inventory, bread: (building.inventory.bread ?? 0) + bread } } : building) };
  }
  if (choice === "speculation") {
    const postings: LedgerPosting[] = [];
    const breadPrice = marketSalePrice(state, "bread");
    const wheatPrice = marketSalePrice(state, "wheat");
    const sold = new Map<string, { bread: number; wheat: number }>();
    for (const granary of granaries(state)) {
      const bread = Math.floor(Math.max(0, granary.inventory.bread ?? 0) * FAMINE_RESPONSE_CONFIG.speculationPermille / 1000);
      const wheat = Math.floor(Math.max(0, granary.inventory.wheat ?? 0) * FAMINE_RESPONSE_CONFIG.speculationPermille / 1000);
      const amount = bread * breadPrice + wheat * wheatPrice;
      if (amount <= 0) continue;
      sold.set(granary.id, { bread, wheat });
      postings.push({ account: "cash", category: "famine_sale", amount, sourceRefs: [source, { type: "building", id: granary.id, detail: `bread:${bread},wheat:${wheat}` }] });
    }
    if (postings.length === 0) return state;
    const posted = postLedgerEntries(state, postings);
    return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, buildings: state.buildings.map(building => {
      const out = sold.get(building.id);
      return out === undefined ? building : { ...building, inventory: { ...building.inventory,
        bread: (building.inventory.bread ?? 0) - out.bread, wheat: (building.inventory.wheat ?? 0) - out.wheat } };
    }) };
  }
  if (choice === "price_control") {
    const politics = politicsOf(state);
    return { ...state, politics: { ...politics, merchantGauge: clampGauge(politics.merchantGauge + FAMINE_RESPONSE_CONFIG.priceControlMerchantPerSeason) } };
  }
  return state;
}

/** FC-3: the season a petition arrives in (absolute season index), picked by the seed in its years. */
export function petitionSeason(state: Pick<GameState, "seed" | "scenarioId">, def: PetitionDef): number {
  const startYear = scenarioOf(state).startYear;
  const seasons = (def.toYear - def.fromYear + 1) * 4;
  return (def.fromYear - startYear) * 4 + hashSeed(state.seed, `petition:${def.id}`) % Math.max(1, seasons - 4);
}

function petitionDef(record: PetitionRecord): PetitionDef | undefined {
  return PETITION_DEFS.find(def => def.id === record.defId);
}

/** FC-3 API: the petitions waiting for an answer. */
export function openPetitions(state: GameState): readonly PetitionRecord[] {
  return (state.politics?.petitions ?? []).filter(petition => petition.response === undefined);
}

/** FC-3 action `petition_response`: the lord answers an open petition. */
export function respondToPetition(state: GameState, petitionId: string, response: PetitionResponse): GameState {
  const politics = politicsOf(state);
  const petition = politics.petitions.find(entry => entry.id === petitionId && entry.response === undefined);
  const def = petition === undefined ? undefined : petitionDef(petition);
  if (petition === undefined || def === undefined) return state;
  const outcome = def.outcomes[response];
  let next: GameState = state;
  if (outcome.charterFee > 0) {
    const posted = postLedgerEntries(state, [{ account: "cash", category: "charter_fee", amount: outcome.charterFee,
      sourceRefs: [{ type: "right", id: outcome.right ?? def.id, detail: `petition:${petition.id}` }, { type: "actor", id: def.petitioner }] }]);
    next = { ...next, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
  }
  const decision: DecisionRecord = { kind: "petition_response", tick: state.tick, petitionId, choice: response };
  return {
    ...next,
    politics: {
      ...politics,
      merchantGauge: clampGauge(politics.merchantGauge + outcome.gauge),
      petitions: politics.petitions.map(entry => entry === petition ? { ...entry, response, respondedTick: state.tick } : entry),
      rights: outcome.right === null ? politics.rights : [...politics.rights, { id: outcome.right, holder: def.petitioner, grantedTick: state.tick,
        petitionId: petition.id, stallFeePermille: outcome.stallFeePermille }],
      decisions: [...politics.decisions, decision],
    },
  };
}

/** FC-3/FC-4: the stall fee under the granted rights, permille of the usual fee (the lowest right applies). */
export function stallFeePermille(state: Pick<GameState, "politics">): number {
  return Math.min(1000, ...(state.politics?.rights ?? []).map(right => right.stallFeePermille));
}

/** FC-4: the source a stall fee under a right carries, or null. */
export function stallFeeRightSource(state: Pick<GameState, "politics">): SourceRef | null {
  const right = (state.politics?.rights ?? []).find(entry => entry.stallFeePermille < 1000);
  return right === undefined ? null : { type: "right", id: right.id, detail: `stall_fee:${right.stallFeePermille}` };
}

/** FC-4 (B1 pipe): the granted rights as effects, source `{type:"right"}`. */
export function rightsEffectRegistry(state: GameState): EffectRegistry {
  const registry = new EffectRegistry();
  for (const right of state.politics?.rights ?? []) {
    registry.register({ id: `${right.id}@${right.grantedTick}`, source: { type: "right", id: right.id, detail: right.holder },
      target: { kind: "settlement", id: SETTLEMENT_REGION_ID }, spec: { kind: "modifier", stat: "stall_fee", op: "mul", value: right.stallFeePermille / 1000 },
      startedAt: right.grantedTick });
  }
  return registry;
}

const DECISION_WEIGHT: Readonly<Record<DecisionRecord["kind"], number>> = { famine_response: 0, petition_response: 1, market_town: 2 };

/** FC-5: the chronicle page of chapter 1, written at `state.tick`. */
export function chronicleEntry(state: GameState): ChronicleEntry {
  const politics = politicsOf(state);
  const startYear = scenarioOf(state).startYear;
  const records = (state.events?.records ?? []).filter(record => record.arrivalTick >= politics.chapter.startTick && record.arrivalTick <= state.tick);
  const famine = famineRecord(state);
  const decisions = [...politics.decisions].sort((a, b) => DECISION_WEIGHT[a.kind] - DECISION_WEIGHT[b.kind] || a.tick - b.tick).slice(0, CHAPTER_ONE.quotedDecisions);
  const sum = (key: "burntHouses" | "departures" | "harvestLost") => records.reduce((total, record) => total + record.losses[key], 0);
  return {
    chapter: politics.chapter.number,
    fromYear: calendar(politics.chapter.startTick, startYear).year,
    toYear: calendar(state.tick, startYear).year,
    events: records.map(record => ({ eventId: record.id, defId: record.defId, year: calendar(record.arrivalTick, startYear).year, losses: record.losses })),
    decisions,
    stats: {
      populationStart: politics.chapter.populationStart, populationEnd: state.population, peakPopulation: politics.chapter.peakPopulation,
      houses: state.houses.length, burntHouses: sum("burntHouses"), departures: sum("departures"), harvestLost: sum("harvestLost"),
      treasury: state.treasuryCoin,
      famine: famine === undefined ? null : { year: calendar(famine.arrivalTick, startYear).year, populationAtArrival: famine.populationAtArrival ?? 0,
        populationAtEnd: famine.populationAtEnd ?? state.population },
    },
  };
}

/** FC-5: the famine is over and the town kept at least 60 % of its people through it. */
export function famineSurvived(state: Pick<GameState, "events">): boolean {
  const record = famineRecord(state);
  if (record?.endTick === undefined || record.populationAtArrival === undefined || record.populationAtEnd === undefined) return false;
  return record.populationAtEnd * 1000 >= record.populationAtArrival * CHAPTER_ONE.survivalPermille;
}

/** FC-5 API: the chapter the town ended (chapter 1 once it has), or null. */
export function chapterEnd(state: Pick<GameState, "politics">): ChapterEnd | null {
  return state.politics?.chapterEnds.find(end => end.chapter === CHAPTER_ONE.chapter) ?? null;
}

/** One tick of F0-C1 (no-op between 50-tick samples, and for a scenario without the famine). */
export function advancePolitics(state: GameState): GameState {
  if (state.tick % SAMPLE !== 0 && state.politics !== undefined) return state;
  if (!scenarioOf(state).activeEvents.includes(GREAT_FAMINE_EVENT_ID)) return state;
  let next: GameState = state.politics === undefined ? { ...state, politics: initialPolitics(state) } : state;
  let politics = politicsOf(next);
  const tick = state.tick;

  // FC-5: the peak, and the market town (the stage's proclamation) as a decision.
  if (next.population > politics.chapter.peakPopulation) politics = { ...politics, chapter: { ...politics.chapter, peakPopulation: next.population } };
  if (next.era !== "hamlet" && !politics.decisions.some(decision => decision.kind === "market_town")) {
    politics = { ...politics, decisions: [...politics.decisions, { kind: "market_town", tick: next.eraProclaimedTick ?? tick }] };
  }

  // FC-3: petitions arrive and expire.
  const startYear = scenarioOf(next).startYear;
  const year = calendar(tick, startYear).year;
  for (const def of PETITION_DEFS) {
    const existing = politics.petitions.find(petition => petition.defId === def.id);
    if (existing === undefined) {
      const ready = housingLotCount(next) >= def.requiresLots;
      if (Math.floor(tick / SEASON_TICKS) >= petitionSeason(next, def) && year <= def.toYear && ready) {
        politics = { ...politics, petitions: [...politics.petitions, { id: `${def.id}@${tick}`, defId: def.id, petitioner: def.petitioner, arrivedTick: tick }] };
      }
    } else if (existing.response === undefined && year > def.toYear) {
      politics = { ...politics, merchantGauge: clampGauge(politics.merchantGauge + def.expiredGauge),
        petitions: politics.petitions.map(petition => petition === existing ? { ...petition, response: "expired" as const, respondedTick: tick } : petition) };
    }
  }
  next = { ...next, politics };

  // FC-2: the famine answer's season, at each season's start of the famine.
  const famine = famineRecord(next);
  if (famine?.response !== undefined && tick % SEASON_TICKS === 0 && recordStage(famine, tick) === "arrival") next = stepFamineResponse(next, famine);

  // FC-5: chapter 1 ends — a market town through the famine with 60 % of its people.
  politics = politicsOf(next);
  if (chapterEnd(next) === null && famineSurvived(next) && next.era !== "hamlet") {
    const chronicle = chronicleEntry(next);
    politics = { ...politics, chapterEnds: [...politics.chapterEnds, { chapter: CHAPTER_ONE.chapter, tick, chronicle }] };
    next = { ...next, politics };
  }
  return next === state ? state : next;
}
