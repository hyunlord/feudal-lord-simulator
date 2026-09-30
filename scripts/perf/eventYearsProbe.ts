// BOT-4 report: what each year of a campaign brought — the summer's weather, the harvest's yield (a wet summer, a
// dearth), the pestilence's stage, the events that arrived — beside the year's lowest L4 at its season starts.
// tsx scripts/perf/eventYearsProbe.ts <archetypeId> <seed> [firstYear] [lastYear]
import type { GameState } from "../../src/engine/engine.types";
import { stateCalendar } from "../../src/engine/scenarioState";
import { harvestYieldPermille, weatherOfSeason } from "../../src/engine/eventSchedule";
import { plagueStage } from "../../src/engine/plague";
import { runPhase19NaturalGrowth } from "../phase19NaturalGrowth";

const [archetypeId = "core:open_field", seedText = "1", firstText = "1365", lastText = "1450"] = process.argv.slice(2);
const first = Number(firstText);
const last = Number(lastText);
const YEAR = 4000;
class Stop extends Error {}
let current: { year: number; l4Min: number; popMin: number; weather: string[]; plague: string[]; events: string[]; harvest: number } | null = null;
const flush = () => { if (current !== null && current.year >= first) process.stdout.write(`${JSON.stringify(current)}\n`); };
try {
  runPhase19NaturalGrowth({ targetLots: 24, maxTicks: (last - 1300 + 1) * YEAR, seed: Number(seedText), archetypeId, onTick: (state: GameState) => {
    if (state.tick % (YEAR / 4) !== 0) return;
    const { year } = stateCalendar(state);
    if (year > last) { flush(); throw new Stop(); }
    const l4 = state.houses.filter(house => house.level >= 4 && house.residents > 0).length;
    const season = Math.floor(state.tick / (YEAR / 4));
    if (current?.year !== year) {
      flush();
      const yearIndex = Math.floor(state.tick / YEAR);
      current = { year, l4Min: l4, popMin: state.population, weather: [], plague: [], events: [], harvest: harvestYieldPermille(state, yearIndex * YEAR + 1600) };
    }
    current.l4Min = Math.min(current.l4Min, l4);
    current.popMin = Math.min(current.popMin, state.population);
    current.weather.push(weatherOfSeason(state, season));
    current.plague.push(plagueStage(state) ?? "-");
    const arrived = (state.events?.records ?? []).filter(record => Math.floor(record.arrivalTick / YEAR) === Math.floor(state.tick / YEAR)).map(record => `${record.kind}:${record.defId}`);
    current.events = [...new Set([...current.events, ...arrived])];
  }, additionalAcceptance: state => stateCalendar(state).year > last });
} catch (error) { if (!(error instanceof Stop)) throw error; }
