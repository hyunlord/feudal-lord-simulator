// EVENT-ART (wave40) lord-mode states for the Wave 40 moment captures and the ui-geometry row's `moments` state set: each the
// first tick after the engine wrote one of the fourteen moments' ledger records (src/ui/wave40Art.ts wave40RecordArt), from
// the real game — a lord-mode town from 1300 played by commands only (scripts/marriagePath.ts: the offer, the counter a few
// weeks later, the promises kept, the new will let stand, the contested estate sued for, evidence and the bishop brought, the
// possession enforced until it gives, the inheritance), over the openings' seeds until every marriage and suit moment is
// found (the brother-in-law and the will change are the seed's draws; one excludes the other). The wardship: the town
// after its inheritance with its lord's birth year set to make him 20 at the next year's turn — the engine's own yearly
// check begins the wardship then and ends it a year later (FIX-11; `injected` in moments.json).
// Beside them moments.json (what each is: seed, tick, year, the record's id and template).
//   tsx scripts/wave40MomentStates.ts <out-dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("엔진 영주 모드 혼인·소송·후견 경로(scripts/wave40MomentStates.ts)", { remote: "scripts/remote/run.sh render-EVENTART-wave40-<sha7> -- node_modules/.bin/tsx scripts/wave40MomentStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import type { HistoryRecord } from "../src/engine/history.types";
import { lordHouse } from "../src/engine/lordshipState";
import { currentYear, manorLord } from "../src/engine/persons";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { wave40RecordArt, type Wave40ImageId } from "../src/ui/wave40Art";
import { WAVE40_IMAGES } from "../src/ui/wave40ArtManifest.generated";
import { marriagePath } from "./marriagePath";

const YEAR = 4_000;
const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/wave40MomentStates.ts <out-dir>");
mkdirSync(out, { recursive: true });
const found: Partial<Record<Wave40ImageId, Record<string, unknown>>> = {};
const ordinal = (record: HistoryRecord) => Number(record.id.slice(2));
const save = (art: Wave40ImageId, state: GameState, record: HistoryRecord, about: Record<string, unknown>) => {
  const date = stateCalendar(state);
  found[art] = { tick: state.tick, year: date.year, season: date.season, record: record.id, template: record.template, recordTick: record.tick, ...about };
  writeFileSync(join(out, `${art.slice("moment_".length)}.json`), JSON.stringify(state));
  process.stderr.write(`${art} at tick ${state.tick} (${date.year}) ${record.id} ${record.template}\n`);
};
/** The new records since `last` (ids `h-000001` in order; folding only removes old ones), oldest first. */
const newRecords = (state: GameState, last: number) => {
  const records = state.history?.records ?? [];
  const fresh: HistoryRecord[] = [];
  for (let index = records.length - 1; index >= 0 && ordinal(records[index]!) > last; index -= 1) fresh.push(records[index]!);
  return fresh.reverse();
};
const MARRIAGE_AND_SUIT = (Object.keys(WAVE40_IMAGES) as Wave40ImageId[]).filter(art => art !== "moment_child_lord_guardian" && art !== "moment_end_of_wardship");

let inherited: GameState | null = null;
for (const seed of [1, 2, 3, 4, 5]) {
  if (MARRIAGE_AND_SUIT.every(art => found[art] !== undefined) && inherited !== null) break;
  let last = 0;
  const path = marriagePath({ seed, willAnswer: "let_it_be", lastYear: 1330, keepState: true, observe: state => {
    for (const record of newRecords(state, last)) {
      last = ordinal(record);
      const art = wave40RecordArt(record);
      if (art !== null && found[art] === undefined) save(art, state, record, { seed });
    }
  } });
  process.stderr.write(`seed ${seed}: ${path.stage} in ${path.finalYear}\n`);
  if (inherited === null && path.stage === "inherited" && path.state !== undefined) inherited = path.state as GameState;
}

// The wardship: the inherited town's lord made 20 at the next year's turn; the engine begins it there and ends it a year on.
if (inherited !== null) {
  let state = inherited;
  const turn = (Math.floor(state.tick / YEAR) + 1) * YEAR;
  const year = currentYear({ ...state, tick: turn });
  const lord = manorLord(state.persons!.people, lordHouse(state).order, year)!;
  state = { ...state, persons: { ...state.persons!, people: state.persons!.people.map(person => person.id === lord.id ? { ...person, birthYear: year - 20 } : person) } };
  let last = ordinal(state.history!.records.at(-1)!);
  const injected = { lord: lord.id, birthYear: year - 20, injected: "the lord's birth year (20 at the next year's turn)" };
  while (state.tick <= turn + YEAR + 1 && found.moment_end_of_wardship === undefined) {
    state = advanceTick(state);
    for (const record of newRecords(state, last)) {
      last = ordinal(record);
      const art = wave40RecordArt(record);
      if ((art === "moment_child_lord_guardian" || art === "moment_end_of_wardship") && found[art] === undefined) save(art, state, record, injected);
    }
  }
}
writeFileSync(join(out, "moments.json"), JSON.stringify(found, null, 1));
const missing = (Object.keys(WAVE40_IMAGES) as Wave40ImageId[]).filter(art => found[art] === undefined);
process.stderr.write(`moments ${14 - missing.length}/14${missing.length === 0 ? "" : `, missing ${missing.join(" ")}`}\n`);
if (missing.length > 0) process.exitCode = 1;
