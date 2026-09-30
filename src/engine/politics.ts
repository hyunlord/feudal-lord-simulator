/**
 * F0-C1 chapter 1's decisions and end (spec docs/design/flow-chapter-one.md FC-2…FC-5). Runs every tick after the
 * events (a no-op between the ladder's 50-tick samples):
 *
 * - FC-2 famine answer (`famineResponse`): chosen once while the famine arrives. At every season's start of the famine,
 *   relief hands the poor their season's bread — bought into a granary with treasury money, the rest released from the
 *   granaries' bread, both at the market price (`famine_relief`, cash and in kind; FC-2a in `famineRelief.ts`),
 *   speculation sells a quarter of the granaries' grain into the treasury (`famine_sale`, FC-2b in `famineSale.ts`),
 *   price control costs the merchants' goodwill.
 *   The departure cap and the price cap are read by the ladder and the market (`departureCapPerSeason`, `foodPricePermille`).
 * - FC-3 petition: arrives at the seed's season in its years once the town has its building; the answer (`respondToPetition`)
 *   grants the right (stall fee), takes a charter price, moves the gauge. Unanswered at its years' end it expires.
 * - FC-4 rights: `rights[]`, one line per right, published in the B1 pipe with source `{type:"right"}`.
 * - FC-5 chronicle and chapter end: when the famine is over, the town came through it with at least 60 % of its people
 *   and it is a market town, chapter 1 ends and its chronicle page is written.
 * - FAIL-3 (FL-8): in the campaign chapter 2 begins at the same tick, the same town (sandbox has no chapters).
 * - FAIL-3 (FL-6): a restoration petition (`restore_right`) arrives from `lordship.ts`, not by the calendar; its answer is
 *   `answerRestoration`.
 * - F2-A (WR-2…WR-8): the war's five decisions arrive from `war.ts`; their answers are `answerWarPetition`. Chapter 2's
 *   end (WR-9) is written here (`endChapterTwo`), called by the war.
 * - F3-A / F4-A: the pestilence's and the reorganisation's decisions likewise (`answerPlaguePetition`,
 *   `answerReorganisationPetition`); chapters 3 and 4 end here (`endChapterThree`, `endChapterFour`). F5-A (LG-2…LG-8): so
 *   do chapter 5's (`answerLegacyPetition`); chapter 5 — the campaign — ends here (`endChapterFive`).
 */
import { EffectRegistry, SETTLEMENT_REGION_ID, type SourceRef } from "../contracts";
import {
  CHAPTER_FIVE,
  CHAPTER_FOUR,
  CHAPTER_ONE,
  CHAPTER_THREE,
  CHAPTER_TWO,
  FAMINE_RESPONSE_CONFIG,
  MERCHANT_GAUGE_START,
  PETITION_DEFS,
  RESTORE_RIGHT_PETITION_ID,
  type FamineResponseChoice,
  type PetitionDef,
  type PetitionResponse,
} from "../content/chapterConfig";
import { GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import { postLedgerEntries } from "../ledger/ledger";
import type { LedgerPosting } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";
import { SEASON_TICKS, dearthEndTick, recordStage } from "./eventSchedule";
import type { EventRecord } from "./events.types";
import { eventSource } from "./events";
import { marketSalePrice } from "./marketSettlement";
import { famineGranaries, reliefSeason } from "./famineRelief";
import { speculationSold } from "./famineSale";
import type { ChapterEnd, ChronicleEntry, DecisionRecord, PetitionRecord, PoliticsState } from "./politics.types";
import { hashSeed } from "./prng";
import { chapterPageRecords } from "./history";
import { calendar, scenarioOf } from "./scenarioState";
import { answerRestoration } from "./lordship";
import { answerWarPetition, chapterTwoWallOutcome } from "./war";
import { answerPlaguePetition } from "./plague";
import { answerReorganisationPetition } from "./reorganisation";
import { answerLegacyPetition, legacyChronicleStats } from "./legacy";
import { PLAGUE_BALANCE } from "../content/plagueConfig";
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

/** FC-2: a season's relief or speculation, at the season's start while the famine arrives. */
function stepFamineResponse(state: GameState, record: EventRecord): GameState {
  const choice = record.response?.choice;
  const source = eventSource(record, choice);
  if (choice === "relief") {
    // FC-2a: the poor's season of bread, bought with cash first (FC3), the rest released from the granaries.
    const { price, bought, released } = reliefSeason(state);
    if (bought <= 0 && released <= 0) return state;
    const stores = famineGranaries(state);
    const granary = stores[0]!;
    const postings: LedgerPosting[] = [];
    if (bought > 0) postings.push({ account: "cash", category: "famine_relief", amount: -bought * price,
      sourceRefs: [source, { type: "building", id: granary.id, detail: `bread:${bought}` }] });
    // The release is valued at the market price, in kind (no money moves; the bread goes out through the town's usual trade).
    let left = released;
    for (const store of stores) {
      const bread = Math.min(left, Math.max(0, store.inventory.bread ?? 0));
      if (bread <= 0) continue;
      left -= bread;
      postings.push({ account: "in_kind", category: "famine_relief", amount: -bread * price, resource: "bread",
        sourceRefs: [source, { type: "building", id: store.id, detail: `bread:${bread}` }] });
    }
    const posted = postLedgerEntries(state, postings);
    return { ...state, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger, buildings: bought <= 0 ? state.buildings
      : state.buildings.map(building => building.id === granary.id ? { ...building, inventory: { ...building.inventory, bread: (building.inventory.bread ?? 0) + bought } } : building) };
  }
  if (choice === "speculation") {
    const postings: LedgerPosting[] = [];
    const breadPrice = marketSalePrice(state, "bread");
    const wheatPrice = marketSalePrice(state, "wheat");
    const sold = new Map<string, { bread: number; wheat: number }>();
    for (const granary of famineGranaries(state)) {
      const { bread, wheat } = speculationSold(granary.inventory);
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
  const decision: DecisionRecord = { kind: "petition_response", tick: state.tick, petitionId, choice: response };
  // F3-A: a card offers only its answers. F5-A (LG-3): a petition whose answers depend on the town, only its own.
  if (def.responses !== undefined && !def.responses.includes(response)) return state;
  if (petition.options !== undefined && !petition.options.includes(response)) return state;
  if (def.trigger === "plague" || def.trigger === "reorganisation" || def.trigger === "legacy") {
    // F3-A (PL-5…PL-8), F4-A (RG-5…RG-9), F5-A (LG-2…LG-5): the sequence's rules answer; the factions remember (FX-4).
    const answered = def.trigger === "plague" ? answerPlaguePetition(state, petition, response)
      : def.trigger === "reorganisation" ? answerReorganisationPetition(state, petition, response) : answerLegacyPetition(state, petition, response);
    const after = answered.politics ?? politics;
    return { ...answered, politics: { ...after,
      petitions: after.petitions.map(entry => entry.id === petition.id ? { ...entry, response, respondedTick: state.tick } : entry),
      decisions: [...after.decisions, decision] } };
  }
  if (def.trigger === "war") {
    // F2-A (WR-2…WR-8): the war's rules answer; the petitioners' gauge moves as the definition says.
    const answered = answerWarPetition(state, petition, response);
    const after = answered.politics ?? politics;
    return { ...answered, politics: { ...after,
      merchantGauge: clampGauge(after.merchantGauge + outcome.gauge),
      petitions: after.petitions.map(entry => entry.id === petition.id ? { ...entry, response, respondedTick: state.tick } : entry),
      decisions: [...after.decisions, decision] } };
  }
  if (def.id === RESTORE_RIGHT_PETITION_ID) {
    // FAIL-3 (FL-6): the fee and the restoration are the lordship's; the merchants' gauge moves only for their own offer.
    const answered = answerRestoration(state, petition, response);
    return { ...answered, politics: { ...politics,
      merchantGauge: petition.petitioner === "merchants" ? clampGauge(politics.merchantGauge + outcome.gauge) : politics.merchantGauge,
      petitions: politics.petitions.map(entry => entry === petition ? { ...entry, response, respondedTick: state.tick } : entry),
      decisions: [...politics.decisions, decision] } };
  }
  let next: GameState = state;
  if (outcome.charterFee > 0) {
    const posted = postLedgerEntries(state, [{ account: "cash", category: "charter_fee", amount: outcome.charterFee,
      sourceRefs: [{ type: "right", id: outcome.right ?? def.id, detail: `petition:${petition.id}` }, { type: "actor", id: def.petitioner }] }]);
    next = { ...next, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger };
  }
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

/** FC-5: the chronicle page of chapter 1, written at `state.tick`. */
export function chronicleEntry(state: GameState): ChronicleEntry {
  const politics = politicsOf(state);
  const startYear = scenarioOf(state).startYear;
  // FIX-11 (FX11-8): from chapter 2 on the range starts one tick after the previous chapter's end (its end tick's records
  // are that chapter's); chapter 1 starts at its own start.
  const from = politics.chapter.number > 1 ? politics.chapter.startTick + 1 : politics.chapter.startTick;
  const records = (state.events?.records ?? []).filter(record => record.arrivalTick >= from && record.arrivalTick <= state.tick);
  const famine = famineRecord(state);
  // F0-C2 (HL-6): the page is edited from the history ledger — its weightiest events and eras, its big decisions.
  const page = chapterPageRecords(state, from, state.tick);
  const noLosses = { burntHouses: 0, departures: 0, harvestLost: 0 };
  const events = page.events.map(record => {
    const eventId = String(record.params?.eventId ?? `era:${String(record.params?.eraId ?? "")}`);
    const event = state.events?.records.find(entry => entry.id === eventId);
    return { recordId: record.id, eventId, defId: String(record.params?.defId ?? record.params?.eraId ?? ""),
      year: calendar(record.tick, startYear).year, losses: event?.losses ?? noLosses };
  });
  const decisions = page.decisions.map(record => ({ recordId: record.id, kind: String(record.params?.decisionKind ?? ""), tick: record.tick,
    chosen: record.decision!.chosen, alternatives: record.decision!.alternatives, predicted: record.decision!.predicted,
    ...(record.decision!.actual === undefined ? {} : { actual: record.decision!.actual }) }));
  const sum = (key: "burntHouses" | "departures" | "harvestLost") => records.reduce((total, record) => total + record.losses[key], 0);
  return {
    chapter: politics.chapter.number,
    fromYear: calendar(politics.chapter.startTick, startYear).year,
    toYear: calendar(state.tick, startYear).year,
    events,
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

/** FC-5 API: the chapter the town ended (chapter 1 once it has; F2-A: another chapter by number), or null. */
export function chapterEnd(state: Pick<GameState, "politics">, chapter: number = CHAPTER_ONE.chapter): ChapterEnd | null {
  return state.politics?.chapterEnds.find(end => end.chapter === chapter) ?? null;
}

/**
 * F2-A (WR-9): chapter 2 ends — its chronicle page is written (with the war's line) and chapter 3 begins at the same
 * tick, the same town (chapter 3's content comes later).
 */
export function endChapterTwo(state: GameState): GameState {
  const politics = politicsOf(state);
  if (politics.chapter.number !== CHAPTER_TWO.chapter || chapterEnd(state, CHAPTER_TWO.chapter) !== null) return state;
  const page = chronicleEntry(state);
  const war = state.war;
  const chronicle: ChronicleEntry = war === undefined ? page : { ...page, stats: { ...page.stats, war: {
    raidYear: war.raid === undefined ? null : calendar(war.raid.tick, scenarioOf(state).startYear).year,
    raidLosses: war.raid?.losses ?? null, defencePermille: war.raid?.defencePermille ?? null,
    men: war.conscripts?.men ?? 0, lostMen: war.conscripts?.lostHouseIds.length ?? 0, wall: chapterTwoWallOutcome(state) } } };
  return { ...state, politics: { ...politics,
    chapterEnds: [...politics.chapterEnds, { chapter: CHAPTER_TWO.chapter, tick: state.tick, chronicle }],
    chapter: { number: CHAPTER_TWO.chapter + 1, startTick: state.tick, populationStart: state.population, peakPopulation: state.population } } };
}

/**
 * F3-A (PL-10): chapter 3 ends — its chronicle page is written (with the pestilence's line) and chapter 4 begins at the
 * same tick, the same town (chapter 4's content comes later).
 */
export function endChapterThree(state: GameState): GameState {
  const politics = politicsOf(state);
  if (politics.chapter.number !== CHAPTER_THREE.chapter || chapterEnd(state, CHAPTER_THREE.chapter) !== null) return state;
  const page = chronicleEntry(state);
  const plague = state.plague;
  const startYear = scenarioOf(state).startYear;
  const chronicle: ChronicleEntry = plague?.first === undefined ? page : { ...page, stats: { ...page.stats, plague: {
    arrivalYear: calendar(plague.first.arrivalTick, startYear).year, populationAtArrival: plague.first.populationAtArrival,
    dead: plague.first.dead, manorDead: plague.first.manorDead, secondDead: plague.second?.dead ?? 0,
    resettled: plague.resettled, fled: plague.fled, outcome: state.population * 1000 >= plague.first.populationAtArrival * PLAGUE_BALANCE.resettledPermille ? "resettled" : "calendar" } } };
  return { ...state, politics: { ...politics,
    chapterEnds: [...politics.chapterEnds, { chapter: CHAPTER_THREE.chapter, tick: state.tick, chronicle }],
    chapter: { number: CHAPTER_THREE.chapter + 1, startTick: state.tick, populationStart: state.population, peakPopulation: state.population } } };
}

/**
 * F4-A (RG-10): chapter 4 ends — its chronicle page is written (with the reorganisation's line) and chapter 5 begins at
 * the same tick, the same town, from the charter's outcome (`chapterFiveStart`).
 */
export function endChapterFour(state: GameState): GameState {
  const politics = politicsOf(state);
  if (politics.chapter.number !== CHAPTER_FOUR.chapter || chapterEnd(state, CHAPTER_FOUR.chapter) !== null) return state;
  const page = chronicleEntry(state);
  const r = state.reorganisation;
  const startYear = scenarioOf(state).startYear;
  const chronicle: ChronicleEntry = r?.chapterFiveStart === undefined ? page : { ...page, stats: { ...page.stats, reorganisation: {
    startYear: calendar(r.startTick, startYear).year, wageLeavers: r.wageLeavers, weaverLeavers: r.weaverLeavers,
    clothSold: r.clothSold, clothIncome: r.clothIncome, guild: r.guild !== undefined, pollTax: r.pollTax,
    rebellion: r.rebellion?.outcome ?? null, charter: r.chapterFiveStart.charter,
    townInfluence: r.influence.town ?? 0, merchantInfluence: r.influence.merchant_house_1 ?? 0 } } };
  return { ...state, politics: { ...politics,
    chapterEnds: [...politics.chapterEnds, { chapter: CHAPTER_FOUR.chapter, tick: state.tick, chronicle }],
    chapter: { number: CHAPTER_FOUR.chapter + 1, startTick: state.tick, populationStart: state.population, peakPopulation: state.population } } };
}

/**
 * F5-A (LG-8): chapter 5 ends at the last market day of 1450 — its chronicle page is written (with the legacy's line);
 * the campaign is won (FL-9: its last chapter's end). No chapter follows.
 */
export function endChapterFive(state: GameState): GameState {
  const politics = politicsOf(state);
  if (politics.chapter.number !== CHAPTER_FIVE.chapter || chapterEnd(state, CHAPTER_FIVE.chapter) !== null) return state;
  const page = chronicleEntry(state);
  const legacy = legacyChronicleStats(state);
  const chronicle: ChronicleEntry = legacy === undefined ? page : { ...page, stats: { ...page.stats, legacy } };
  return { ...state, politics: { ...politics, chapterEnds: [...politics.chapterEnds, { chapter: CHAPTER_FIVE.chapter, tick: state.tick, chronicle }] } };
}

/**
 * FAIL-3 (FL-9): the goal of a chapter — chapter 1 the market town through the famine (FC-5), chapter 2 prosperity.
 * F2-A (WR-9): and chapter 2's war goal, the stone wall built or the market chosen (reached at chapter 2's end).
 */
export type ChapterGoalId = "famine_market_town" | "prosperity" | "wall_or_market" | "resettled" | "charter" | "legacy";
export interface ChapterGoal {
  readonly chapter: number;
  readonly id: ChapterGoalId;
  /** The tick the goal was reached, or null. */
  readonly reachedTick: number | null;
}

/**
 * FAIL-3 (FL-9) API: the campaign's chapter goals so far, the current chapter's last. Prosperity (the scenario's victory
 * conditions held, `settlement.milestones.prosperity`) is a chapter goal; the campaign's own victory is chapter 5's end.
 */
export function chapterGoals(state: Pick<GameState, "politics" | "settlement">): readonly ChapterGoal[] {
  const chapter = state.politics?.chapter.number ?? CHAPTER_ONE.chapter;
  const goals: ChapterGoal[] = [{ chapter: CHAPTER_ONE.chapter, id: "famine_market_town", reachedTick: chapterEnd(state)?.tick ?? null }];
  if (chapter >= CHAPTER_TWO.chapter) {
    goals.push({ chapter: CHAPTER_TWO.chapter, id: "prosperity", reachedTick: state.settlement?.milestones.prosperity ?? null });
    goals.push({ chapter: CHAPTER_TWO.chapter, id: "wall_or_market", reachedTick: chapterEnd(state, CHAPTER_TWO.chapter)?.tick ?? null });
  }
  // F3-A (PL-10): chapter 3's goal, the town resettled after the pestilence (reached at chapter 3's end).
  if (chapter >= CHAPTER_THREE.chapter) goals.push({ chapter: CHAPTER_THREE.chapter, id: "resettled", reachedTick: chapterEnd(state, CHAPTER_THREE.chapter)?.tick ?? null });
  // F4-A (RG-10): chapter 4's goal, the charter negotiated (reached at chapter 4's end, granted or refused).
  if (chapter >= CHAPTER_FOUR.chapter) goals.push({ chapter: CHAPTER_FOUR.chapter, id: "charter", reachedTick: chapterEnd(state, CHAPTER_FOUR.chapter)?.tick ?? null });
  // F5-A (LG-8): chapter 5's goal, the legacy judged at the last market day (the campaign's end).
  if (chapter >= CHAPTER_FIVE.chapter) goals.push({ chapter: CHAPTER_FIVE.chapter, id: "legacy", reachedTick: chapterEnd(state, CHAPTER_FIVE.chapter)?.tick ?? null });
  return goals;
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
    if ((def.trigger ?? "calendar") !== "calendar") continue;
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
    // FAIL-3 (FL-8): the campaign goes on with chapter 2, the same town; its chapter counts start afresh.
    if (scenarioOf(next).mode === "campaign") {
      politics = { ...politics, chapter: { number: CHAPTER_TWO.chapter, startTick: tick, populationStart: next.population, peakPopulation: next.population } };
    }
    next = { ...next, politics };
  }
  return next === state ? state : next;
}
