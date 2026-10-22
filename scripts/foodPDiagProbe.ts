/**
 * FOOD-P-DIAG (the user's ruling 2026-10-22): why FOOD-P's earlier mills cost seeds 26, 35, 39 a house at level 4 and
 * seed 36 its stone town — diagnosis only, nothing changed. The lord slice played by the lord bot; for each season:
 *  - bread made against the houses' need (as `foodReProbe.ts`), mills built and begun, the granaries' bread at the close;
 *  - each mill site begun that season: whether the food step's waits stood then (`hasPendingFoodChain` — another food
 *    site building — or `hasActiveFoodObservation`), so whether FOOD-P's skip placed it; the measured decision; the
 *    season's bread made and need so far and the last full season's; the granaries' bread then; its timber (30);
 *  - the building sites waiting for timber at the close, by kind (church, house, palisade segment, the rest);
 *  - with `houses`, each house below level 4 and what it lacks (water, bread, market, church, inside the wall).
 * Usage: npx tsx scripts/foodPDiagProbe.ts <seed> <years> [houses] > out.json
 */
import type { CarterWalker } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation, isWinterTick } from "../src/content/houseFoodConfig";
import { constructionDeliveryNeed, isBuildingConstructionSite } from "../src/economy/construction";
import { hasPendingFoodChain } from "../src/engine/autoplayFood";
import { measuredFoodDecision } from "../src/engine/autoplayFoodMeasuredDecision";
import { hasActiveFoodObservation } from "../src/engine/autoplayFoodThroughput";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { houseRequirementRows } from "./autoplayStallProbe";

const seed = Number(process.argv[2] ?? 26);
const years = Number(process.argv[3] ?? 30);
const withHouses = process.argv[4] === "houses";
const bread = (inventory: Record<string, number | undefined>) => inventory.bread ?? 0;
const carts = (state: GameState) => state.walkers.filter((walker): walker is CarterWalker => walker.kind === "carter" && walker.cancellation === null);
const cargoBread = (walker: CarterWalker) => walker.reservation.resource === "bread" && walker.mission === "deliver" ? walker.reservation.amount : 0;
const granaryBread = (state: GameState) => state.buildings.filter(b => b.kind === "granary").reduce((s, b) => s + bread(b.inventory), 0);
const lacksOf = (row: ReturnType<typeof houseRequirementRows>[number]) => [!row.water ? "water" : null, !row.bread ? "bread" : null,
  row.market !== "served" ? `market:${row.market}` : null, row.church !== "served" ? `church:${row.church}` : null,
  row.protection === "outside" ? "outside_wall" : null].filter(entry => entry !== null).join("+");

// A mill site begun between two states (the town's weekly projects inside the tick, and the bot's commands): did the food
// step's waits stand on the state before it?
function noteNewMills(before: GameState, after: GameState): void {
  const known = new Set(before.constructionSites.map(site => site.id));
  for (const site of after.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === "mill" && !known.has(site.id))) {
    const decision = measuredFoodDecision(before);
    current?.newMills.push({ tick: after.tick, waitsStood: { pendingChain: hasPendingFoodChain(before), observation: hasActiveFoodObservation(before) },
      measured: `${decision.kind ?? "none"}:${decision.reason ?? ""}`, seasonSoFar: current === null ? null : { made: current.made, need: Math.round(current.need) },
      lastSeason: last === null ? null : { made: last.made, need: Math.round(last.need) }, granaryBread: granaryBread(before), timber: site.required.timber ?? 0 });
  }
}

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
type Season = { year: number; season: number; made: number; need: number; mills?: number; millsBegun?: number; granaryBread?: number;
  newMills: unknown[]; waitingTimber?: Record<string, number>; below?: Record<string, string> };
const seasons: Season[] = [];
let current: Season | null = null;
let last: Season | null = null;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) {
    const before = state;
    const next = gameReducer(state, command);
    if (next !== state) state = next;
    noteNewMills(before, state);
  }
  const before = state;
  state = advanceTick(state);
  noteNewMills(before, state);
  const calendar = stateCalendar(state);
  if (current === null || state.tick % 1_000 === 1) {
    last = current;
    current = { year: calendar.year, season: Math.floor((state.tick % 4_000) / 1_000), made: 0, need: 0, newMills: [] };
    seasons.push(current);
  }
  const oldCarts = new Set(before.walkers.map(walker => walker.id));
  for (const mill of state.buildings.filter(b => b.kind === "mill")) {
    const was = before.buildings.find(b => b.id === mill.id);
    const loaded = carts(state).filter(walker => !oldCarts.has(walker.id) && walker.homeBuildingId === mill.id).reduce((s, w) => s + cargoBread(w), 0);
    current.made += Math.max(0, bread(mill.inventory) - bread(was?.inventory ?? {}) + loaded);
  }
  if (state.tick % HOUSE_FOOD_INTERVAL === 0) for (const house of state.houses) if (house.residents > 0) current.need += houseFoodRation(house) * (isWinterTick(state.tick) ? 1.2 : 1);
  if (state.tick % 1_000 !== 0) continue;
  current.mills = state.buildings.filter(b => b.kind === "mill").length;
  current.millsBegun = state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === "mill").length;
  current.granaryBread = granaryBread(state);
  const waiting: Record<string, number> = {};
  for (const site of state.constructionSites) {
    if ((constructionDeliveryNeed(site).timber ?? 0) <= 0 || site.stall !== "awaiting_materials") continue;
    const kind = site.kind === "church" || site.kind === "house" || site.kind === "palisade_segment" ? site.kind : "other";
    waiting[kind] = (waiting[kind] ?? 0) + 1;
  }
  current.waitingTimber = waiting;
  if (withHouses) current.below = Object.fromEntries(houseRequirementRows(state).filter(row => row.level < 4).map(row => [`${row.id}@${row.tx},${row.ty}`, `L${row.level}:${lacksOf(row)}`]));
}
console.log(JSON.stringify({ seed, years, millTimber: BUILDING_CONFIG_BY_KIND.mill.buildCost.timber ?? 0,
  seasons: seasons.map(s => ({ ...s, need: Math.round(s.need) })) }, null, 1));
