// UI-10 gate states seed 2's bot does not reach (bare states, the scene injection admits them), from the chapter-5
// town of tests/helpers/legacyTown.ts as scripts/ui10EndingSaves.ts uses it:
//  - `heir_choice`: the heir's card open with its three candidates — the eldest son, the eldest daughter's husband, the
//    brother's son — the family scenario L4 gives the town's old lord (tests/chapterFiveLegacy.test.ts `withFamily`),
//    the Crown paid, run to the succession (seed 2's own house has one heir, a distant kinsman);
//  - `interlude.market_fire`: the market's fire of 1394 in a town without a guild (seed 2 formed one in chapter 4, so its
//    1394 is the guild's quarrel). The town's chapter 4 guild, if it has one, is left out (the guild refused).
// Beside them moments-extra.json (what each is).
//   tsx scripts/ui10ExtraStates.ts <out-dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("엔진 1384→1402(scripts/ui10ExtraStates.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/ui10ExtraStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HEIR_CHOICE_PETITION_ID, LEGACY_BALANCE as B, ROYAL_TAX_PETITION_ID } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { heirCandidates, legacyInterludes } from "../src/engine/legacy";
import { manorLord } from "../src/engine/persons";
import type { Person } from "../src/engine/persons.types";
import { openPetitions } from "../src/engine/politics";
import { stateCalendar } from "../src/engine/scenarioState";
import { LEGACY_ENDING_ANSWERS, throughLegacy } from "../tests/helpers/legacyEndings";
import { at, legacyTown, movedTo, runAnswering } from "../tests/helpers/legacyTown";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/ui10ExtraStates.ts <out-dir>");
mkdirSync(out, { recursive: true });
const found: Record<string, Record<string, unknown>> = {};
const save = (name: string, state: GameState, about: Record<string, unknown>) => {
  found[name] = { tick: state.tick, year: stateCalendar(state).year, ...about };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${stateCalendar(state).year})\n`);
};

/** L4's family: the old lord Henry made the head, with a son, a daughter gone to marry and a brother gone. */
function withFamily(state: GameState): GameState {
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

const start = legacyTown();

// The heir's card with three candidates.
const envoy = withFamily(throughLegacy(start, LEGACY_ENDING_ANSWERS.free_borough, "royal_tax_envoy"));
const asked = throughLegacy(envoy, { [ROYAL_TAX_PETITION_ID]: "accept" }, "succession");
const heir = openPetitions(asked).find(petition => petition.defId === HEIR_CHOICE_PETITION_ID);
if (heir !== undefined) save(HEIR_CHOICE_PETITION_ID, asked, { petitionId: heir.id, options: heir.options ?? null,
  candidates: heirCandidates(asked).map(({ kind, relation, name, age, created }) => ({ kind, relation, name, age, created })) });

// The market's fire: the town without a guild (its chapter 4 guild, if any, refused), the calendar moved to 1394.
const guilded = start.reorganisation?.guild !== undefined;
const withoutGuild = (state: GameState): GameState => { const { guild: _guild, ...reorganisation } = state.reorganisation!; return { ...state, reorganisation }; };
const guildless = guilded ? withoutGuild(start) : start;
const staple = runAnswering(movedTo(guildless, at(...B.staple)), at(...B.staple) + 1, {});
const fire = runAnswering(movedTo(staple, at(...B.guildDispute)), at(...B.guildDispute) + 1, {});
if (fire.history?.records.some(record => record.template === "legacy.market_fire" && record.tick === at(...B.guildDispute))) {
  save("interlude.market_fire", fire, { guildRemoved: guilded, interludes: legacyInterludes(fire) });
}

writeFileSync(join(out, "moments-extra.json"), JSON.stringify(found, null, 1) + "\n");
const missing = [HEIR_CHOICE_PETITION_ID, "interlude.market_fire"].filter(name => found[name] === undefined);
const three = ((found[HEIR_CHOICE_PETITION_ID]?.candidates as unknown[] | undefined) ?? []).length === 3;
console.log(JSON.stringify({ found: Object.fromEntries(Object.entries(found).map(([name, about]) => [name, about.year])), threeHeirs: three, guildRemoved: guilded, missing }));
process.exitCode = missing.length === 0 && three ? 0 : 1;
