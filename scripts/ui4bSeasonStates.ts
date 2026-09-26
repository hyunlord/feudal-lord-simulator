// UI-4b evidence states: the seed 2 chapter 1 run (the bot, as UI-4's), saving the state 30 ticks before a season
// closes for seasons whose history holds a first fire, the dearth, the Great Famine, the first petition, the market
// town, a first building, or nothing weighty (a quiet season). Opened at 1x, the season ledger card comes up about 1.5 s
// later with its three scenes (scripts/ui4bCaptures.mjs).
//   tsx scripts/ui4bSeasonStates.ts <seed> <maxTicks> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { history } from "../src/engine/history";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const found = new Map<string, number>();
const save = (name: string, state: GameState) => {
  if (found.has(name)) return;
  found.set(name, state.tick);
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick}\n`);
};
const SEASON = 1_000;
runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg ?? 90_000), seed: Number(seedArg), onTick: state => {
  if (state.tick % SEASON !== SEASON - 30) return;
  const records = history.query(state, { severity: 1, range: { from: state.tick - SEASON + 31 } });
  const has = (template: string, param?: [string, string]) => records.some(record => record.template === template && (param === undefined || String(record.params?.[param[0]]) === param[1]));
  if (has("person.burnt")) save("season-fire", state);
  if (has("event.arrived", ["defId", "dearth_rehearsal"])) save("season-dearth", state);
  if (has("event.arrived", ["defId", "great_famine"])) save("season-famine", state);
  if (has("decision.petition_response")) save("season-petition", state);
  if (has("milestone.market_town") || has("decision.market_town")) save("season-market-town", state);
  if (has("milestone.first_building")) save("season-first-building", state);
  if (records.length === 0 && state.tick > 8_000) save("season-quiet", state);
} });
writeFileSync(join(out!, "moments.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
console.log(JSON.stringify(Object.fromEntries(found)));
