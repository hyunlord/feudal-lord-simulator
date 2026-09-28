/**
 * F3-A: the 24-house walled town (v19 fixture) in chapter 3 at spring 1348 (the collapse era entered), its ring closed
 * (timber), `treasury` pennies in hand — the chapter-3 scenarios' town (the war town of chapterTwoWar.test.ts, 11 years on).
 */
import { readFileSync } from "node:fs";
import { CHAPTER_THREE } from "../../src/content/chapterConfig";
import type { GameState } from "../../src/engine/engine.types";
import { advancePersons } from "../../src/engine/persons";
import { initialPolitics } from "../../src/engine/politics";
import { postLedgerEntries, treasuryBalance } from "../../src/ledger/ledger";
import { decodeSave } from "../../src/save/saveCodec";

/** Spring 1348: the collapse era enters. */
export const PLAGUE_ERA_TICK = 192_000;

export function plagueTown(treasury = 5000): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v19/palisade-construction.save.json"))).envelope.state as GameState;
  const palisade = state.palisade === null ? null : { ...state.palisade, segments: state.palisade.segments.map(segment => ({ ...segment, completed: true, material: "timber" as const })) };
  const funded = postLedgerEntries({ ...state, tick: PLAGUE_ERA_TICK - 1 }, [{ account: "cash", category: "opening_balance", amount: treasury - treasuryBalance(state),
    sourceRefs: [{ type: "scenario", id: "chapter-three-plague-test" }] }]);
  const politics = initialPolitics(state);
  const town: GameState = { ...state, tick: PLAGUE_ERA_TICK - 1, palisade, treasuryCoin: funded.treasuryCoin, ledger: funded.ledger,
    historicalEras: [...(state.historicalEras ?? []), { id: "war", enteredTick: 148_000, forced: false }, { id: "collapse", enteredTick: PLAGUE_ERA_TICK, forced: false }],
    politics: { ...politics, chapter: { number: CHAPTER_THREE.chapter, startTick: PLAGUE_ERA_TICK - 1, populationStart: state.population, peakPopulation: state.population },
      chapterEnds: [1, 2].map(chapter => ({ chapter, tick: chapter * 1000, chronicle: { chapter, fromYear: 1300, toYear: 1300, events: [], decisions: [],
        stats: { populationStart: 0, populationEnd: 0, peakPopulation: 0, houses: 0, burntHouses: 0, departures: 0, harvestLost: 0, treasury: 0, famine: null } } })) } };
  // The town's persons for its residents (and the lord's family), as they would be by 1348.
  return advancePersons(town);
}
