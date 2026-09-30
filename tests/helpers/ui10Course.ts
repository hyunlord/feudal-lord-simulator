/**
 * UI-10: chapter 5's cards as a player meets them — the chapter-4 town run into chapter 5 (`legacyTown`) and on, the
 * calendar moved between the steps, each card left open when it comes: the Crown's envoy (answered by the petition),
 * the interlude's quarrel (a guild founded, the record alone) and nave, the deposition of 1399, the heir's card (the
 * old lord given a son, a daughter gone to marry and a brother gone; and the fixture's own house of one), the
 * charter's card and the legacy's. Shared by tests/ui10Cards.test.ts and scripts/ui10CardsCaptures.ts.
 */
import assert from "node:assert/strict";
import type { PetitionResponse } from "../../src/content/chapterConfig";
import {
  BOROUGH_AUTONOMY_PETITION_ID,
  CHURCH_REBUILDING_PETITION_ID,
  GUILD_DISPUTE_PETITION_ID,
  HEIR_CHOICE_PETITION_ID,
  LEGACY_BALANCE as B,
  LEGACY_CHOICE_PETITION_ID,
  ROYAL_TAX_PETITION_ID,
} from "../../src/content/legacyConfig";
import type { GameState } from "../../src/engine/engine.types";
import { legacyForecast } from "../../src/engine/legacy";
import { manorLord } from "../../src/engine/persons";
import type { Person } from "../../src/engine/persons.types";
import { openPetitions } from "../../src/engine/politics";
import { gameReducer } from "../../src/state/gameStore";
import { at, legacyTown, movedTo, runAnswering } from "./legacyTown";

const SEASON = 1000;
type Answers = Partial<Record<string, PetitionResponse>>;
const STANDARD: Answers = { [ROYAL_TAX_PETITION_ID]: "accept", [HEIR_CHOICE_PETITION_ID]: "refuse", [BOROUGH_AUTONOMY_PETITION_ID]: "accept", [LEGACY_CHOICE_PETITION_ID]: "accept",
  [GUILD_DISPUTE_PETITION_ID]: "accept", [CHURCH_REBUILDING_PETITION_ID]: "accept" };
const without = (answers: Answers, defId: string): Answers => ({ ...answers, [defId]: undefined });

/** Runs chapter 5 season by season (the calendar moved to each step's tick), answering, until `defId` is open. */
function untilOpen(state: GameState, defId: string, answers: Answers): GameState {
  let next = state;
  for (let guard = 0; guard < 60 && !openPetitions(next).some(petition => petition.defId === defId); guard += 1) {
    const step = legacyForecast(next).find(entry => entry.state !== "done");
    const target = step?.tick !== null && step?.tick !== undefined && step.tick > next.tick ? step.tick : (Math.floor(next.tick / SEASON) + 1) * SEASON;
    if (target > next.tick + 1) next = movedTo(next, target);
    next = runAnswering(next, target + 1, without(answers, defId));
  }
  assert.ok(openPetitions(next).some(petition => petition.defId === defId), `${defId} did not come (tick ${next.tick})`);
  return next;
}
/** The calendar moved to `tick` and one tick run (an interlude's season start). */
const reach = (state: GameState, tick: number, answers: Answers) => runAnswering(movedTo(state, tick), tick + 1, answers);
export const answer = (state: GameState, defId: string, response: PetitionResponse) =>
  gameReducer(state, { type: "petition_response", petitionId: openPetitions(state).find(petition => petition.defId === defId)!.id, response });

/** The old lord (the fixture's widower) made the head, with a son, a daughter gone to marry and a brother gone (chapterFiveLegacy L4). */
export function withFamily(state: GameState): GameState {
  const persons = state.persons!;
  const lord = manorLord(persons.people, 1, 1386)!;
  const kin = (id: string, fields: Partial<Person>): Person => ({ ...lord, id, role: "child", tags: ["lord-family", "lord-house:1"], ...fields });
  const father = kin("m-900001", { givenName: "Robert", role: "head", birthYear: 1290, alive: false, deathYear: 1350, deathCause: "age" });
  return { ...state, persons: { ...persons,
    people: [...persons.people.map(person => person.id === lord.id ? { ...person, role: "head" as const, fatherId: father.id } : person),
      kin("m-900002", { givenName: "Richard", sex: "male", birthYear: 1360, fatherId: lord.id })],
    past: [...persons.past, father, kin("m-900003", { givenName: "Agnes", sex: "female", birthYear: 1362, fatherId: lord.id, leftYear: 1380 }),
      kin("m-900004", { givenName: "Walter", sex: "male", birthYear: 1327, fatherId: father.id, leftYear: 1345 })] } };
}

// The course, built once: the envoy's card (the tax petitioned), the interlude's two cards and the deposition, the
// heir's card (with the family of three heirs, and the fixture's own house of one), the charter's card, the legacy's.
let course: ReturnType<typeof build> | null = null;
export const ui10Course = () => (course ??= build());
function build() {
  const answers: Answers = { ...STANDARD, [ROYAL_TAX_PETITION_ID]: "refuse" };
  const envoy = untilOpen(legacyTown(), ROYAL_TAX_PETITION_ID, answers);
  const petitioned = answer(envoy, ROYAL_TAX_PETITION_ID, "refuse");
  // The fixture's chapter 4 founded no guild (1394 is the market's fire); a guild founded (the record alone) brings the quarrel.
  const guilded = { ...petitioned, reorganisation: { ...petitioned.reorganisation!, guild: { foundedTick: petitioned.legacy!.startTick, headId: null } } };
  const quarrel = reach(guilded, at(...B.guildDispute), {});
  const nave = reach(reach(petitioned, at(...B.guildDispute), {}), at(...B.churchRebuilding), {});
  // The spring of 1399 first (the year's turn crowns the calendar's king, FX-5), then the deposition's autumn.
  const deposed = reach(reach(answer(nave, CHURCH_REBUILDING_PETITION_ID, "accept"), at(B.deposition[0]), {}), at(...B.deposition), {});
  const heir = untilOpen(withFamily(deposed), HEIR_CHOICE_PETITION_ID, answers);
  const ownHeir = untilOpen(deposed, HEIR_CHOICE_PETITION_ID, answers);
  const charter = untilOpen(answer(heir, HEIR_CHOICE_PETITION_ID, "accept_with_price"), BOROUGH_AUTONOMY_PETITION_ID, answers);
  const legacy = untilOpen(answer(charter, BOROUGH_AUTONOMY_PETITION_ID, "accept"), LEGACY_CHOICE_PETITION_ID, answers);
  return { envoy, quarrel, nave, deposed, heir, ownHeir, charter, legacy };
}
