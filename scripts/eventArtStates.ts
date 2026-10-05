// EVENT-ART states: a lord-mode town with a live registry offer — the registry's event card (src/ui/hud/RegistryCard.tsx)
// for captures and the ui-geometry rows (`lord` state set, ~/fls-lord-states). The lord's slice (core:lord_slice) as
// the lord bot plays it (scripts/lordSliceRun.ts: `lordBotCommands` each tick), except that this lord never moves the
// market dues: in 1300–1320 the only registry entry whose years are open is ck_evt_005 (1304–1318, a market standing
// and the dues at their default), and the bot's own dues (800‰, then 1100‰) never let it come (docs/verification/lm-e9
// REPORT, 진단). The run stops at the first tick an offer waits for the lord, before the bot answers it.
//  - `registry-offer`: that state (the offer open, as the engine drew it; nothing injected).
// Beside it moments-eventart.json (the seed, the tick, the year, the offer and its receipt). Seeds 1, 2, 3 in turn.
//   tsx scripts/eventArtStates.ts <out-dir> [lastYear=1320]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 1300→1320(scripts/eventArtStates.ts)", { remote: "scripts/remote/run.sh render-EVENTART-card-<sha7> -- node_modules/.bin/tsx scripts/eventArtStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { openRegistryCards } from "../src/ui/registryCardModel";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/eventArtStates.ts <out-dir> [lastYear]");
const lastYear = Number(process.argv[3] ?? 1320);
mkdirSync(out, { recursive: true });

function run(seed: number): GameState | null {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
  while (stateCalendar(state).year <= lastYear) {
    if (openRegistryCards(state).length > 0) return state;
    for (const { kind, command } of lordBotCommands(state)) if (kind !== "dues") state = gameReducer(state, command);
    state = advanceTick(state);
  }
  return null;
}

for (const seed of [1, 2, 3]) {
  const state = run(seed);
  process.stderr.write(`seed ${seed}: ${state === null ? "no offer" : `offer at tick ${state.tick}`}\n`);
  if (state === null) continue;
  const [card] = openRegistryCards(state);
  writeFileSync(join(out, "registry-offer.json"), JSON.stringify(state));
  const date = stateCalendar(state);
  const about = { seed, tick: state.tick, year: date.year, season: date.season, offer: card!.occurrence, dues: state.agency?.duesPermille ?? null,
    market: state.buildings.filter(building => building.kind === "market").map(building => building.id) };
  writeFileSync(join(out, "moments-eventart.json"), JSON.stringify(about, null, 1) + "\n");
  console.log(JSON.stringify({ seed, tick: state.tick, year: date.year, entry: card!.entry.id }));
  process.exit(0);
}
process.exitCode = 1;
