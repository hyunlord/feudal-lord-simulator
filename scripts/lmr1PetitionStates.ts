// LM-R1 (petitions) lord-mode states for the lord's cards (captures and the ui-geometry rows' `petitions` state set), from
// the lord slice (core:lord_slice) seed 3 as the lord bot plays it (scripts/lordSliceRun.ts: `lordBotCommands` each tick —
// the home petitions as they come, tenants granted, so the kinds settle into precedents; the town's requests granted):
//  - `home-<kind>`: the first tick each of the twelve home petition kinds waits for the lord (FIX-14: they come in cycles
//    of twelve, the first cycle by about 1305);
//  - `precedent`: the first season the steward answered one by precedent (ER-6: the lord's same answer twice running, not
//    the year's first), as its season report shows it;
//  - `request`: the first week the town asks its lord (TA-7: the market town's proclamation, the wall, timber); none by
//    1321 → the latest state with the proclamation the TA-12 wait would ask for (`injected: true` in moments.json);
//  - `guardian`: `home-wardship` with its lord made 15 and the engine's own wardship begun (`beginWardship`: the mother,
//    else adult kin, else the overlord) — FIX-11's minor lord in lord mode (the slice's lord is grown in 1300).
// Beside them moments.json (what each is).
//   tsx scripts/lmr1PetitionStates.ts <out-dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("엔진 영주 모드 1300→1320(scripts/lmr1PetitionStates.ts)", { remote: "scripts/remote/run.sh render-LMR1-petitions-<sha7> -- node_modules/.bin/tsx scripts/lmr1PetitionStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOME_PETITION_ORDER } from "../src/content/stewardshipConfig";
import type { GameState } from "../src/engine/engine.types";
import { beginWardship } from "../src/engine/lordship";
import { lordHouse } from "../src/engine/lordshipState";
import { manorLord } from "../src/engine/persons";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { lordBotCommands } from "../src/engine/lordBot";
import { openPetitions } from "../src/engine/politics";
import { lordRequestView, openHomePetitions, precedentView } from "../src/ui/lordCardsModel";

/** LM-E8: seed 3's town asks its lord within the slice's 20 years (docs/verification/lme8/REPORT.md: the charter, timber). */
const SEED = 3;

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/lmr1PetitionStates.ts <out-dir>");
mkdirSync(out, { recursive: true });
const found: Record<string, Record<string, unknown>> = {};
const save = (name: string, state: GameState, about: Record<string, unknown>) => {
  const date = stateCalendar(state);
  found[name] = { tick: state.tick, year: date.year, season: date.season, ...about };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${date.year})\n`);
};

const END = 21 * 4_000;
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: SEED })!;
const kinds = new Set<string>();
let precedent = false;
let request = false;
let homeWardship: GameState | null = null;
while (state.tick < END && (kinds.size < HOME_PETITION_ORDER.length || !precedent || !request)) {
  // The moments as the lord finds them (before he acts this tick); the precedent and the request with nothing else waiting.
  const waiting = openHomePetitions(state);
  for (const petition of waiting) {
    if (kinds.has(petition.kind)) continue;
    kinds.add(petition.kind);
    save(`home-${petition.kind}`, state, { petition: petition.id, kind: petition.kind, amount: petition.amount, party: petition.party ?? null,
      political: openPetitions(state).map(entry => entry.defId) });
    if (petition.kind === "wardship") homeWardship = state;
  }
  const quiet = waiting.length === 0 && openPetitions(state).length === 0;
  if (!precedent && quiet) {
    const view = precedentView(state);
    if (view !== null) { precedent = true; save("precedent", state, { petitions: view.key, items: view.items }); }
  }
  if (!request && quiet) {
    const view = lordRequestView(state);
    if (view !== null && view.command !== null) { request = true; save("request", state, { request: view.kind, command: view.command.type, injected: false }); }
  }
  // The lord bot plays the lord (scripts/lordSliceRun.ts): petitions, policies, the town's requests …
  for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
  state = advanceTick(state);
}
if (!request) {
  const asked = { ...state, agency: { ...state.agency!, requests: [{ kind: "proclaim_era" as const }] } };
  save("request", asked, { request: "proclaim_era", injected: true, command: lordRequestView(asked)?.command?.type ?? null });
}
if (homeWardship !== null) {
  const year = stateCalendar(homeWardship).year;
  const people = homeWardship.persons!.people;
  const lord = manorLord(people, lordHouse(homeWardship).order, year)!;
  const minor = { ...homeWardship, persons: { ...homeWardship.persons!, people: people.map(person => person.id === lord.id ? { ...person, birthYear: year - 15 } : person) } };
  const ward = beginWardship(minor, minor.tick, { ...lord, birthYear: year - 15 });
  save("guardian", ward, { lord: lord.id, age: 15, guardian: ward.lordship?.wardship?.guardianId ?? null, injected: "the lord's birth year" });
}
writeFileSync(join(out, "moments.json"), JSON.stringify(found, null, 1));
process.stderr.write(`kinds ${kinds.size}/${HOME_PETITION_ORDER.length}, precedent ${precedent}, request ${request} (end tick ${state.tick})\n`);
