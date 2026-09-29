// F5-A comparison (spec docs/design/chapter-five-legacy.md LG-7, LG-10): the chapter-5 town (fixture
// `chapter-five-town`, the bot's seed 1 at chapter 5's start) under the bot to the last market day of 1450, its four
// chapter-5 answers given by a variant instead of the bot's (each as the petition comes, the game command; the heir is
// the first the card offers). What each answer set leaves: the scores, the ending, the treasury, the factions.
//   tsx scripts/chapterFiveCompare.ts <variant> > variant.json      variant: standard | remembered | chantry | house | pilgrim | lords
import { readFileSync } from "node:fs";
import { CHAPTER_FIVE, type PetitionResponse } from "../src/content/chapterConfig";
import { BOROUGH_AUTONOMY_PETITION_ID, CHURCH_REBUILDING_PETITION_ID, GUILD_DISPUTE_PETITION_ID, HEIR_CHOICE_PETITION_ID, LEGACY_CHOICE_PETITION_ID, ROYAL_TAX_PETITION_ID } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { legacyEnding } from "../src/engine/legacy";
import { chapterEnd, openPetitions } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

type Answers = Readonly<Record<string, PetitionResponse>>;
// FIX-9: the interlude's two petitions — the guild's side, the nave rebuilt (the bot's `accept`) unless a variant says.
const INTERLUDE = { [GUILD_DISPUTE_PETITION_ID]: "accept", [CHURCH_REBUILDING_PETITION_ID]: "accept" } as const;
const VARIANTS: Readonly<Record<string, Answers>> = {
  standard: { ...INTERLUDE, [ROYAL_TAX_PETITION_ID]: "accept", [BOROUGH_AUTONOMY_PETITION_ID]: "accept", [LEGACY_CHOICE_PETITION_ID]: "accept" },
  remembered: { ...INTERLUDE, [ROYAL_TAX_PETITION_ID]: "accept", [BOROUGH_AUTONOMY_PETITION_ID]: "accept", [LEGACY_CHOICE_PETITION_ID]: "accept_with_price" },
  chantry: { ...INTERLUDE, [CHURCH_REBUILDING_PETITION_ID]: "refuse", [ROYAL_TAX_PETITION_ID]: "accept", [BOROUGH_AUTONOMY_PETITION_ID]: "accept", [LEGACY_CHOICE_PETITION_ID]: "refuse" },
  house: { ...INTERLUDE, [ROYAL_TAX_PETITION_ID]: "accept", [BOROUGH_AUTONOMY_PETITION_ID]: "refuse", [LEGACY_CHOICE_PETITION_ID]: "accept_with_price" },
  // FIX-9: the church's town — the nave rebuilt, the charter kept from the town, the church's legacy.
  pilgrim: { ...INTERLUDE, [ROYAL_TAX_PETITION_ID]: "accept", [BOROUGH_AUTONOMY_PETITION_ID]: "refuse", [LEGACY_CHOICE_PETITION_ID]: "refuse" },
  // The lord who answers nothing kindly: the Crown petitioned, the charter refused, the nave put off, no legacy.
  lords: { ...INTERLUDE, [CHURCH_REBUILDING_PETITION_ID]: "refuse", [ROYAL_TAX_PETITION_ID]: "refuse", [BOROUGH_AUTONOMY_PETITION_ID]: "refuse" },
};
const variant = process.argv[2] ?? "standard";
const answers = VARIANTS[variant];
if (answers === undefined) throw new Error(`unknown variant ${variant}`);

let state = decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${SAVE_SCHEMA_VERSION}/chapter-five-town.save.json`))).envelope.state as GameState;
const driver = createAutoplayTraceDriver();
const start = { tick: state.tick, year: stateCalendar(state).year, treasury: treasuryBalance(state), population: state.population };
while (chapterEnd(state, CHAPTER_FIVE.chapter) === null && state.tick < start.tick + 300_000) {
  for (const petition of openPetitions(state)) {
    const response = petition.defId === HEIR_CHOICE_PETITION_ID ? petition.options?.[0] : answers[petition.defId];
    if (response !== undefined) state = gameReducer(state, { type: "petition_response", petitionId: petition.id, response });
  }
  state = advanceTick(driver.apply(state));
}
const l = state.legacy!;
const relations = Object.fromEntries((state.factions?.factions ?? []).map(faction => [faction.id, faction.relation]));
process.stdout.write(`${JSON.stringify({ variant, answers: l.answers, start,
  end: { tick: state.tick, year: stateCalendar(state).year, treasury: treasuryBalance(state), population: state.population, outcome: state.settlement?.outcome ?? null,
    lived: state.houses.filter(house => house.residents > 0).length, l4: state.houses.filter(house => house.level >= 4 && house.residents > 0).length },
  heir: l.heir ?? null, candidates: l.candidates.map(candidate => [candidate.kind, candidate.relation]), mayorId: l.mayorId ?? null, family: l.family ?? null,
  backlash: l.backlash, royalSubsidy: l.royalSubsidy, legacy: l.legacy ?? null, endowment: l.endowment, clothSold: l.clothSold,
  interludes: l.interludes ?? {}, naveRebuilt: l.naveRebuilt ?? false,
  scores: l.scores ?? null, ending: legacyEnding(state), relations,
  rights: (state.politics?.rights ?? []).map(right => `${right.id}:${right.holder}`) }, null, 1)}\n`);
