/**
 * FOOD-DIST (⑤, the user's ruling 2026-10-18): seed 1's houses without bread in 1302–1306 while its mills never sat idle —
 * diagnosis only, nothing changed. The lord slice played by the lord bot (as `growBlockProbe.ts`); for each season:
 *  - bread made (each mill's bread gained in a tick, plus the loads its carts took that tick) against the bread the lived-in
 *    houses eat (their ration at each meal, ×1.2 in winter — `houseFoodConfig`);
 *  - where the bread lay at the season's end (mills, granaries, carts, houses);
 *  - every 100 ticks, each lived-in house with no bread by the house panel's own reading (`houseDiagnosisModel` bread:
 *    no granary, granaries empty, no road to a stocked granary, not visited by a distributor), the empty-granary case split
 *    by whether bread then lay at a mill or in a cart.
 * Usage: npx tsx scripts/breadFeedProbe.ts <seed> <years> [fromYear] > out.json
 */
import type { CarterWalker } from "../src/agents/walker.types";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation, isWinterTick } from "../src/content/houseFoodConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 7);
const bread = (inventory: Record<string, number | undefined>) => inventory.bread ?? 0;
const carts = (state: GameState) => state.walkers.filter((walker): walker is CarterWalker => walker.kind === "carter" && walker.cancellation === null);
const cargoBread = (walker: CarterWalker) => walker.reservation.resource === "bread" && walker.mission === "deliver" ? walker.reservation.amount : 0;

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const fromYear = Number(process.argv[4] ?? start);
type Season = { year: number; season: number; made: number; need: number; houses: number; residents: number; mills: number; granaries: number;
  distributors: number; end: Record<string, number>; noBreadSamples: number; livedSamples: number; why: Record<string, number> };
const seasons: Season[] = [];
let current: Season | null = null;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  const before = state;
  state = advanceTick(state);
  const calendar = stateCalendar(state);
  if (calendar.year < fromYear) continue;
  if (current === null || state.tick % 1_000 === 1) {
    current = { year: calendar.year, season: Math.floor((state.tick % 4_000) / 1_000), made: 0, need: 0, houses: 0, residents: 0, mills: 0, granaries: 0,
      distributors: 0, end: {}, noBreadSamples: 0, livedSamples: 0, why: {} };
    seasons.push(current);
  }
  // Bread made: a mill's bread gained this tick, plus the loads its new carts took out this tick.
  const oldCarts = new Set(before.walkers.map(walker => walker.id));
  for (const mill of state.buildings.filter(b => b.kind === "mill")) {
    const was = before.buildings.find(b => b.id === mill.id);
    const loaded = carts(state).filter(walker => !oldCarts.has(walker.id) && walker.homeBuildingId === mill.id).reduce((s, w) => s + cargoBread(w), 0);
    current.made += Math.max(0, bread(mill.inventory) - bread(was?.inventory ?? {}) + loaded);
  }
  if (state.tick % HOUSE_FOOD_INTERVAL === 0) for (const house of state.houses) if (house.residents > 0) current.need += houseFoodRation(house) * (isWinterTick(state.tick) ? 1.2 : 1);
  if (state.tick % 100 === 0) {
    const millBread = state.buildings.filter(b => b.kind === "mill").reduce((s, b) => s + bread(b.inventory), 0);
    const cartBread = carts(state).reduce((s, w) => s + cargoBread(w), 0);
    for (const house of state.houses.filter(h => h.residents > 0)) {
      current.livedSamples += 1;
      if (house.breadStock > 0) continue;
      current.noBreadSamples += 1;
      const kind = houseDiagnosisModel(state, house.buildingId)?.bread?.kind ?? "?";
      const why = kind === "granary_empty" ? (millBread > 0 ? "granary_empty:bread_at_mill" : cartBread > 0 ? "granary_empty:bread_in_cart" : "granary_empty:none")
        : kind === "not_visited" ? "granary_stocked:not_visited" : kind;
      current.why[why] = (current.why[why] ?? 0) + 1;
    }
  }
  if (state.tick % 1_000 === 0) {
    current.houses = state.houses.filter(h => h.residents > 0).length;
    current.residents = state.houses.reduce((s, h) => s + h.residents, 0);
    current.mills = state.buildings.filter(b => b.kind === "mill").length;
    current.granaries = state.buildings.filter(b => b.kind === "granary").length;
    current.distributors = state.walkers.filter(w => w.kind === "distributor").length;
    current.end = { mills: state.buildings.filter(b => b.kind === "mill").reduce((s, b) => s + bread(b.inventory), 0),
      granaries: state.buildings.filter(b => b.kind === "granary").reduce((s, b) => s + bread(b.inventory), 0),
      carts: carts(state).reduce((s, w) => s + cargoBread(w), 0), houses: state.houses.reduce((s, h) => s + h.breadStock, 0) };
  }
}
console.log(JSON.stringify({ seed, years, fromYear, seasons: seasons.map(s => ({ ...s, need: Math.round(s.need), noBreadShare: s.livedSamples ? Math.round(100 * s.noBreadSamples / s.livedSamples) : 0 })) }, null, 1));
