// F4-A comparison (spec docs/design/chapter-four-reorganisation.md RG-12): the chapter-4 town (fixture
// `chapter-four-town`, winter 1368) under the bot, its four chapter-4 answers given by a variant instead of the bot's
// (each as the petition comes, the game command), to chapter 5's start. What each answer set leaves: the treasury, the
// cloth, who left, the rumour of 1381, the charter, the factions, chapter 5's start.
//   tsx scripts/chapterFourCompare.ts <variant> > variant.json      variant: standard | opposite | direct
import { readFileSync } from "node:fs";
import { CHAPTER_FOUR, type PetitionResponse } from "../src/content/chapterConfig";
import { BOROUGH_CHARTER_PETITION_ID, CLOTH_OR_GRAIN_PETITION_ID, GUILD_CHARTER_PETITION_ID, TAX_COLLECTION_PETITION_ID } from "../src/content/reorganisationConfig";
import type { GameState } from "../src/engine/engine.types";
import { chapterEnd, openPetitions } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

const VARIANTS: Readonly<Record<string, Readonly<Record<string, PetitionResponse>>>> = {
  standard: { [GUILD_CHARTER_PETITION_ID]: "accept", [TAX_COLLECTION_PETITION_ID]: "accept", [CLOTH_OR_GRAIN_PETITION_ID]: "accept", [BOROUGH_CHARTER_PETITION_ID]: "accept" },
  opposite: { [GUILD_CHARTER_PETITION_ID]: "refuse", [TAX_COLLECTION_PETITION_ID]: "refuse", [CLOTH_OR_GRAIN_PETITION_ID]: "refuse", [BOROUGH_CHARTER_PETITION_ID]: "refuse" },
  direct: { [GUILD_CHARTER_PETITION_ID]: "accept", [TAX_COLLECTION_PETITION_ID]: "refuse", [CLOTH_OR_GRAIN_PETITION_ID]: "accept", [BOROUGH_CHARTER_PETITION_ID]: "accept" },
};
const variant = process.argv[2] ?? "standard";
const answers = VARIANTS[variant];
if (answers === undefined) throw new Error(`unknown variant ${variant}`);
const CLOTH = new Set(["ulnage", "cloth_toll", "fulling_toll"]);

let state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v27/chapter-four-town.save.json"))).envelope.state as GameState;
const driver = createAutoplayTraceDriver();
const income = new Map<string, number>();
let seen = (state.ledger?.nextEntryOrdinal ?? 1) - 1;
const start = { tick: state.tick, treasury: treasuryBalance(state), population: state.population };
while (chapterEnd(state, CHAPTER_FOUR.chapter) === null && state.tick < start.tick + 160_000) {
  state = advanceTick(driver.apply(state));
  for (const petition of openPetitions(state)) {
    const response = answers[petition.defId];
    if (response !== undefined) state = gameReducer(state, { type: "petition_response", petitionId: petition.id, response });
  }
  const entries = state.ledger?.entries ?? [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (Number(entry.id.slice(7)) <= seen) break;
    if (entry.account === "cash" && entry.amount > 0) income.set(entry.category, (income.get(entry.category) ?? 0) + entry.amount);
  }
  seen = (state.ledger?.nextEntryOrdinal ?? 1) - 1;
}
const r = state.reorganisation!;
const relations = Object.fromEntries((state.factions?.factions ?? []).map(faction => [faction.id, faction.relation]));
const cloth = [...income].filter(([category]) => CLOTH.has(category)).reduce((sum, [, amount]) => sum + amount, 0);
process.stdout.write(`${JSON.stringify({ variant, answers: r.answers, start,
  end: { tick: state.tick, year: stateCalendar(state).year, chapter: state.politics?.chapter.number, treasury: treasuryBalance(state), population: state.population,
    lived: state.houses.filter(house => house.residents > 0).length },
  cloth: { sold: r.clothSold, income: cloth, incomeToTreasury: r.clothIncome }, rent: income.get("rent") ?? 0, pollTax: r.pollTax,
  leavers: { wages: r.wageLeavers, weavers: r.weaverLeavers }, rebellion: r.rebellion ?? null, guild: r.guild ?? null,
  influence: r.influence, relations, chapterFiveStart: r.chapterFiveStart ?? null, income: Object.fromEntries([...income].sort((a, b) => b[1] - a[1])) }, null, 1)}\n`);
