// EVENT-ART states: a lord-mode town with a live registry offer of the content canon v4 — the registry's event card
// (src/ui/hud/RegistryCard.tsx) for captures and the ui-geometry rows (`lord` state set, ~/fls-lord-states). The lord's
// slice (core:lord_slice) as the lord bot plays it (scripts/lordSliceRun.ts: `lordBotCommands` each tick, its registry
// answers too); each state is taken at the first tick its offer waits, before the bot answers it — nothing injected:
//  - `registry-offer`: the first v4 offer the registry draws;
//  - `registry-offer-hold`: the first whose card has a hold the lord can choose (ER-19: one that costs him something) —
//    the same state as `registry-offer` when that one has a hold.
// Beside them moments-eventart.json (for each: the seed, the tick, the year, the offer and its receipt). Seeds 1, 2, 3 in
// turn until both are found.
//   tsx scripts/eventArtStates.ts <out-dir> [lastYear=1330]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 모드 1300→1330(scripts/eventArtStates.ts)", { remote: "scripts/remote/run.sh render-EVENTART-v4-<sha7> -- node_modules/.bin/tsx scripts/eventArtStates.ts <디렉터리>", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { openRegistryCards, registryCardView } from "../src/ui/registryCardModel";

const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/eventArtStates.ts <out-dir> [lastYear]");
const lastYear = Number(process.argv[3] ?? 1330);
mkdirSync(out, { recursive: true });

type Found = { name: string; seed: number; state: GameState };
const found = new Map<string, Found>();
const holdable = (state: GameState) => openRegistryCards(state).some(card => registryCardView(state, card).choices.some(choice => choice.hold && choice.enabled));

function play(seed: number): void {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed })!;
  const seen = new Set<string>();
  while (stateCalendar(state).year <= lastYear && found.size < 2) {
    const fresh = openRegistryCards(state).filter(card => !seen.has(card.occurrence.id));
    for (const card of fresh) seen.add(card.occurrence.id);
    if (fresh.length > 0) {
      if (!found.has("registry-offer")) found.set("registry-offer", { name: "registry-offer", seed, state });
      if (!found.has("registry-offer-hold") && holdable(state)) found.set("registry-offer-hold", { name: "registry-offer-hold", seed, state });
      process.stderr.write(`seed ${seed} tick ${state.tick}: ${fresh.map(card => card.entry.id).join(" ")}${holdable(state) ? " (a hold)" : ""}\n`);
    }
    for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
    state = advanceTick(state);
  }
}

for (const seed of [1, 2, 3]) {
  if (found.size === 2) break;
  play(seed);
}
const about: Record<string, unknown> = {};
for (const { name, seed, state } of found.values()) {
  const [card] = openRegistryCards(state).filter(item => name !== "registry-offer-hold" || registryCardView(state, item).choices.some(choice => choice.hold && choice.enabled));
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  const date = stateCalendar(state);
  about[name] = { seed, tick: state.tick, year: date.year, season: date.season, offer: card!.occurrence, choices: registryCardView(state, card!).choices.map(choice => [choice.id, choice.enabled, choice.hold]) };
  console.log(JSON.stringify({ name, seed, tick: state.tick, year: date.year, entry: card!.entry.id }));
}
writeFileSync(join(out, "moments-eventart.json"), JSON.stringify(about, null, 1) + "\n");
if (found.size < 2) { process.stderr.write(`found only ${[...found.keys()].join(", ") || "nothing"} by ${lastYear}\n`); process.exitCode = 1; }
