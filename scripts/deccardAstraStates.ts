// DEC-CARD A1/A4/A5 states (Astra's lord-mode play, 2026-10-06): the lord's slice as the lord bot plays it (its registry
// answers too: scripts/eventArtStates.ts's loop), each state taken at the first tick it holds — nothing injected:
//  - `stuck-pile`: a pile the HUD's stuck-goods chip raises (A1: the inspector's lord-mode "조치");
//  - `advice-beat`: a story beat whose sandbox advice asks to build (a fire, a dry or wet summer, a bad harvest, the famine's
//    omen, the palisade) is up (A1: the event card's [조언]);
//  - `since-dues`: a registry card that sets the market dues is open and the lord answered one of its kind before
//    (A4: "지난번 같은 일 이후"); `since-any` the same for the policy or a subsidy when no dues card comes;
//  - `estates-two`: the treasury by estate has two estates (A5: an inherited or married estate's money).
// Beside them deccard-astra-states.json (each: the seed, the tick, the year and what it holds). Seeds 1, 2, 3 in turn.
//   tsx scripts/deccardAstraStates.ts <out-dir> [lastYear=1330]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 1300→1330(scripts/deccardAstraStates.ts)", { remote: "scripts/remote/run.sh render-DECCARD-astra-<sha7> -- bash scripts/deccardAstraCaptures.sh", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { storyBeats } from "../src/ui/eventStory";
import { hudStuckRows } from "../src/ui/hud/stuckStockView";
import { sinceLastAnswer } from "../src/ui/lord/since/sinceLastModel";
import { treasuryByEstate } from "../src/ui/lord/treasury/treasuryModel";
import { openRegistryCards } from "../src/ui/registryCardModel";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/deccardAstraStates.ts <out-dir> [lastYear]");
const lastYear = Number(process.argv[3] ?? 1330);
mkdirSync(out, { recursive: true });

const ADVICE_KINDS = new Set(["fire", "fire_warning", "fire_aftermath", "wet_summer", "bad_harvest", "famine_omen", "palisade"]);
type Probe = (state: GameState) => string | null;
const PROBES: Readonly<Record<string, Probe>> = {
  "stuck-pile": state => { const row = hudStuckRows(state)[0]; return row === undefined ? null : `${row.kind} ${row.good} ${row.amount} ${row.reason}`; },
  "advice-beat": state => storyBeats(state).find(beat => ADVICE_KINDS.has(beat.kind))?.kind ?? null,
  "since-dues": state => {
    const card = openRegistryCards(state).find(entry => sinceLastAnswer(state, entry.entry.id, entry.occurrence.id)?.lines.some(line => line.startsWith("좌판세")) === true);
    return card === undefined ? null : `${card.entry.id} ${card.occurrence.id}`;
  },
  "since-any": state => {
    const card = openRegistryCards(state).find(entry => sinceLastAnswer(state, entry.entry.id, entry.occurrence.id) !== null);
    return card === undefined ? null : `${card.entry.id} ${card.occurrence.id}`;
  },
  "estates-two": state => ((treasuryByEstate(state)?.estates.length ?? 0) >= 2 ? treasuryByEstate(state)!.estates.map(row => row.estateId).join(" ") : null),
};
const found = new Map<string, { seed: number; state: GameState; what: string }>();
const done = () => Object.keys(PROBES).every(name => found.has(name) || (name === "since-any" && found.has("since-dues")));

function play(seed: number): void {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
  while (stateCalendar(state).year <= lastYear && !done()) {
    // The probes read the town every in-game week (the stuck stock and the beats change slowly; the cards wait a season).
    if (state.tick % 78 === 0) for (const [name, probe] of Object.entries(PROBES)) {
      if (found.has(name)) continue;
      const what = probe(state);
      if (what !== null) { found.set(name, { seed, state, what }); process.stderr.write(`seed ${seed} tick ${state.tick}: ${name} — ${what}\n`); }
    }
    for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
    state = advanceTick(state);
  }
}

for (const seed of [1, 2, 3]) { if (done()) break; play(seed); }
const about: Record<string, unknown> = {};
for (const [name, { seed, state, what }] of found) {
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  const date = stateCalendar(state);
  about[name] = { seed, tick: state.tick, year: date.year, season: date.season, what };
  console.log(JSON.stringify({ name, seed, tick: state.tick, year: date.year, what }));
}
writeFileSync(join(out, "deccard-astra-states.json"), JSON.stringify(about, null, 1) + "\n");
if (!done()) process.stderr.write(`not found by ${lastYear}: ${Object.keys(PROBES).filter(name => !found.has(name)).join(", ")}\n`);
