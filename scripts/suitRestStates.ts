// SUIT-THREAD (renderer A's "suit-rest" part) states for the captures (scripts/suitRestCaptures.mjs), each the first tick
// it holds the thing, nothing injected:
//  - `will-lapsed`: the lmr2 `will-change` state played on with no answer until the will's deadline passed (the engine's
//    `willLapsed`: the marriage's timeline says the deadline answered it);
//  - `astra-1306`: Astra's lordplay2 1306 save (docs/qa/lordplay2-20261008/saves), migrated — the cousin's child born
//    of the marriage (kin of the house, its parents the groom and the bride);
//  - `prepared-arrival`: the lord's slice as the lord bot plays it, at the first dearth whose arrival the engine ties to a
//    decision that prepared for it (`crisis.arrived` with `because[].relation === "preparedness"`), while it lasts;
//    `prepared-dearth` the same for a bad harvest (not the Great Famine) when one comes first.
// Beside them suit-rest-states.json (each: the seed, the tick, the year and what it holds).
//   tsx scripts/suitRestStates.ts <out-dir> <lmr2-states-dir> [lastSeed=5] [lastYear=1324]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("SUIT-THREAD suit-rest 상태(scripts/suitRestStates.ts)", { remote: "scripts/remote/run.sh render-SUIT-rest-captures-<sha7> --light -- bash scripts/suitRestCaptures.sh", entry: import.meta.url });
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { GREAT_FAMINE_EVENT_ID } from "../src/content/eventConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const [out, lord2] = process.argv.slice(2);
if (out === undefined || lord2 === undefined) throw new Error("usage: tsx scripts/suitRestStates.ts <out-dir> <lmr2-states-dir> [lastSeed] [lastYear]");
const lastSeed = Number(process.argv[4] ?? 5);
const lastYear = Number(process.argv[5] ?? 1324);
mkdirSync(out, { recursive: true });
const found: Record<string, Record<string, unknown>> = {};
const save = (name: string, state: GameState, about: Record<string, unknown>) => {
  if (found[name] !== undefined) return;
  const date = stateCalendar(state);
  found[name] = { tick: state.tick, year: date.year, season: date.season, ...about };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${date.year}) ${JSON.stringify(about)}\n`);
};

// The will let lapse: the lmr2 state played on, the lord answering nothing.
const willPath = join(lord2, "will-change.json");
if (existsSync(willPath)) {
  let state = JSON.parse(readFileSync(willPath, "utf8")) as GameState;
  for (let tick = 0; tick < 4_000 && state.diplomacy?.marriage?.willLapsed !== true; tick += 1) state = advanceTick(state);
  if (state.diplomacy?.marriage?.willLapsed === true) save("will-lapsed", state, { from: "lmr2 will-change", willAnswer: state.diplomacy.marriage.willAnswer });
}

// Astra's 1306 save, as the game loads it.
const raw = gunzipSync(readFileSync("docs/qa/lordplay2-20261008/saves/indexedDB-1306-recovery-source.json.gz"));
const slot = (JSON.parse(raw.toString("utf8")) as { stores: { name: string; records: { value: { data: string } }[] }[] }).stores.find(store => store.name === "slots")!;
const astra = decodeSave(new Uint8Array(Buffer.from(slot.records[0]!.value.data, "base64"))).envelope.state as GameState;
const plan = astra.diplomacy?.marriage;
const child = astra.persons?.people.find(person => plan !== undefined && person.motherId === plan.brideId && person.fatherId === plan.groomId);
save("astra-1306", astra, { child: child?.id ?? null, tags: child?.tags ?? [] });

// A dearth's arrival tied to a decision that prepared for it, as the lord bot plays the slice.
const step = (state: GameState) => { let next = state; for (const { command } of lordBotCommands(next)) next = gameReducer(next, command); return advanceTick(next); };
const preparedArrival = (state: GameState) => (state.history?.records ?? []).find(record => record.template === "crisis.arrived"
  && (record.because ?? []).some(entry => entry.relation === "preparedness")
  && (state.events?.records ?? []).some(event => event.id === record.params?.eventId && event.endTick === undefined));
const started = Date.now();
/** The play's budget: past it, the bad harvest is left out (the Great Famine's arrival is enough for the chronicle). */
const BUDGET_MS = 15 * 60_000;
const spent = () => Date.now() - started > BUDGET_MS && found["prepared-arrival"] !== undefined;
for (let seed = 1; seed <= lastSeed && found["prepared-dearth"] === undefined && !spent(); seed += 1) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
  while (stateCalendar(state).year <= lastYear && found["prepared-dearth"] === undefined && !spent()) {
    state = step(state);
    if (state.tick % 50 !== 0) continue;
    const arrival = preparedArrival(state);
    if (arrival === undefined) continue;
    const event = state.events!.records.find(entry => entry.id === arrival.params?.eventId)!;
    const about = { seed, eventId: event.id, defId: event.defId, because: arrival.because };
    save("prepared-arrival", state, about);
    if (event.defId !== GREAT_FAMINE_EVENT_ID) save("prepared-dearth", state, about);
  }
  process.stderr.write(`seed ${seed}: ran to ${stateCalendar(state).year} in ${Math.round((Date.now() - started) / 1000)} s\n`);
}
writeFileSync(join(out, "suit-rest-states.json"), JSON.stringify(found, null, 1));
const missing = ["will-lapsed", "astra-1306", "prepared-arrival"].filter(name => found[name] === undefined);
if (missing.length > 0) { process.stderr.write(`missing: ${missing.join(", ")}\n`); process.exit(1); }
