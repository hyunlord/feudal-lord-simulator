/**
 * DEC-CARD: one state for the famine and one for every political petition kind, each with that card open — the ways
 * the campaign's tests already build them: the famine arriving on the default town (tests/ui4Story), chapter 1's charter
 * on it, the right's buy-back on a declined lordship (tests/lmr1Steward), the war's five from the walled town's war run
 * season by season (tests/ui6ChapterTwoScreens), the plague's four on its first pestilence (tests/ui8Cards), chapter 4's
 * four on the `chapter-four-town` fixture (tests/ui9Cards), chapter 5's and the interlude's from the UI-10 course.
 */
import { readFileSync } from "node:fs";
import { PRESSURE_BALANCE } from "../../src/content/balanceConfig";
import { CHAPTER_TWO, PETITION_DEFS, RESTORE_RIGHT_PETITION_ID } from "../../src/content/chapterConfig";
import { DEFAULT_SCENARIO_ID } from "../../src/content/scenario/coreScenarios";
import { PLAGUE_PETITION_IDS } from "../../src/content/plagueConfig";
import { REORGANISATION_PETITION_IDS } from "../../src/content/reorganisationConfig";
import type { GameState } from "../../src/engine/engine.types";
import { advanceFactions } from "../../src/engine/factions";
import { endChapterTwo, initialPolitics, openPetitions, respondToPetition } from "../../src/engine/politics";
import type { PetitionRecord } from "../../src/engine/politics.types";
import type { ReorganisationState } from "../../src/engine/reorganisation.types";
import { advanceWar } from "../../src/engine/war";
import { postLedgerEntries, treasuryBalance } from "../../src/ledger/ledger";
import { decodeSave } from "../../src/save/saveCodec";
import { DEFAULT_GAME_STATE } from "../../src/state/gameStore";
import { newGameState } from "../../src/state/newGame";
import type { PetitionDefId } from "../../src/ui/petitionPresentation";
import { ui10Course } from "./ui10Course";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const losses = { burntHouses: 0, departures: 0, harvestLost: 0 };

/** The Great Famine arriving on the default town (tests/ui4Story). */
export function famineState(): GameState {
  return advanceFactions({ ...DEFAULT_GAME_STATE, tick: 9_400, events: { records: [{ id: "great_famine@67", defId: "great_famine", kind: "dearth", season: 67, arrivalTick: 9_000, losses }],
    burning: [] } } as unknown as GameState);
}

/** `state` with `defId` the one open petition (the others answered before it). */
function withOpen(state: GameState, defId: string, tick = state.tick): GameState {
  const def = PETITION_DEFS.find(entry => entry.id === defId)!;
  const politics = state.politics ?? initialPolitics(state);
  const petition: PetitionRecord = { id: `${defId}@${tick}`, defId, petitioner: def.petitioner, arrivedTick: tick };
  return { ...state, politics: { ...politics, petitions: [...politics.petitions.filter(entry => entry.response !== undefined), petition] } };
}

function marketCharter(): GameState {
  return withOpen(advanceFactions({ ...DEFAULT_GAME_STATE, tick: 30_000, politics: { merchantGauge: 50, petitions: [], rights: [], decisions: [],
    chapter: { number: 1, startTick: 0, populationStart: 12, peakPopulation: 12 }, chapterEnds: [] } } as unknown as GameState), "market_charter");
}

/** A declined lordship (a right lost to the merchants) with `coin` in the treasury (tests/lmr1Steward). */
export function restoreRight(coin = 200): GameState {
  const base = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, seed: 1 })!;
  const posted = postLedgerEntries(base, [{ account: "cash", category: "opening_balance", amount: coin - treasuryBalance(base), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  const state = { ...base, treasuryCoin: posted.treasuryCoin, ledger: posted.ledger,
    lordship: { house: { order: 1, name: "de Fauconval", heraldrySeed: 1, since: 0 }, pastHouses: [], titleDemoted: true,
      decline: { since: base.tick, cause: "arrears", lost: "tolls", by: "merchants" } } } as GameState;
  return withOpen(advanceFactions(state), RESTORE_RIGHT_PETITION_ID);
}

/** The war's demands as they come, from the walled town's messenger (tests/ui6ChapterTwoScreens). */
function warStates(): Map<string, GameState> {
  const M = 148_000;
  const fixture = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v19/palisade-construction.save.json"))).envelope.state as GameState;
  const palisade = fixture.palisade === null ? null : { ...fixture.palisade, segments: fixture.palisade.segments.map(segment => ({ ...segment, completed: true, material: "timber" as const })) };
  const funded = postLedgerEntries({ ...fixture, tick: M }, [{ account: "cash", category: "opening_balance", amount: 5000 - treasuryBalance(fixture),
    sourceRefs: [{ type: "scenario", id: "deccard-test" }] }]);
  const politics = initialPolitics(fixture);
  let state = advanceFactions({ ...fixture, tick: M, palisade, treasuryCoin: funded.treasuryCoin, ledger: funded.ledger,
    historicalEras: [...(fixture.historicalEras ?? []), { id: "war", enteredTick: M, forced: false }], factions: undefined,
    politics: { ...politics, chapter: { number: CHAPTER_TWO.chapter, startTick: 80_000, populationStart: fixture.population, peakPopulation: fixture.population } } } as unknown as GameState);
  const seen = new Map<string, GameState>();
  for (let offset = 0; offset <= 15; offset += 1) {
    state = advanceWar({ ...state, tick: M + offset * SEASON }, endChapterTwo);
    for (const petition of openPetitions(state)) {
      if (!seen.has(petition.defId)) seen.set(petition.defId, state);
      state = respondToPetition(state, petition.id, "accept_with_price");
    }
  }
  return seen;
}

/** The plague's first pestilence (tests/ui8Cards), the petition just come. */
function plagueState(defId: string): GameState {
  const ERA = 148_000;
  const state = { ...DEFAULT_GAME_STATE, tick: ERA, plague: { eraTick: ERA, rumourTick: ERA - SEASON, first: { arrivalTick: ERA, dead: 10, endTick: undefined },
    answers: {}, vacantHouseIds: ["h1", "h2"], resettled: 0, recovered: 0, fled: 0, curacy: { vacantSince: ERA } },
    politics: { merchantGauge: 50, petitions: [], rights: [], decisions: [], chapter: { number: 3, startTick: ERA - 4 * SEASON, populationStart: 50, peakPopulation: 50 }, chapterEnds: [] } } as unknown as GameState;
  return withOpen(advanceFactions(state), defId);
}

/** Chapter 4's town (fixture `chapter-four-town`, tests/ui9Cards) with its reorganisation begun (tests/ui9Factions), the petition just come. */
export function reorganisationState(defId: string, reorganisation: Partial<ReorganisationState> = {}): GameState {
  const base = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v32/chapter-four-town.save.json"))).envelope.state as GameState;
  return withOpen({ ...base, reorganisation: { startTick: base.tick, answers: {}, influence: { town: 60, merchant_house_1: 25, merchant_house_2: 15 }, clothSeasons: [],
    clothSeason: 0, clothIncome: 0, clothSold: 0, pollTax: 0, collections: 0, wageLeavers: 0, weaverLeavers: 0, ...reorganisation } }, defId);
}

let built: ReadonlyMap<PetitionDefId, GameState> | null = null;
/** Every petition kind's card, open on a state of its chapter. */
export function petitionStates(): ReadonlyMap<PetitionDefId, GameState> {
  if (built !== null) return built;
  const course = ui10Course();
  const states = new Map<PetitionDefId, GameState>([["market_charter", marketCharter()], ["restore_right", restoreRight()]]);
  for (const [defId, state] of warStates()) states.set(defId as PetitionDefId, state);
  for (const defId of PLAGUE_PETITION_IDS) states.set(defId, plagueState(defId));
  for (const defId of REORGANISATION_PETITION_IDS) states.set(defId, reorganisationState(defId));
  states.set("royal_tax", course.envoy);
  states.set("guild_dispute", course.quarrel);
  states.set("church_rebuilding", course.nave);
  states.set("heir_choice", course.heir);
  states.set("borough_autonomy", course.charter);
  states.set("legacy_choice", course.legacy);
  built = states;
  return states;
}
