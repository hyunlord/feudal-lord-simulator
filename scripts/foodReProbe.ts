/**
 * FOOD-RE (the user's ruling 2026-10-22): bread on the trunk after CLOTH-1, STORE, CHURCH-CAP and STONE-1a, and why the
 * third mill comes late — diagnosis only, nothing changed. The lord slice played by the lord bot; for each season:
 *  - bread made (each mill's bread gained in a tick plus the loads its carts took that tick) against the bread the lived-in
 *    houses eat (their ration at each meal, ×1.2 in winter — `houseFoodConfig`), and the share of lived-in houses with no
 *    bread (sampled every 100 ticks), as `breadFeedProbe.ts` (FOOD-DIST) measured them;
 *  - mills built and begun, granaries; the bread at the season's end (mills, granaries, carts, houses);
 *  - while fewer than three mills stand or are begun, at the season's close: the mill cap (`foodFacilityWithinLimit`), the
 *    food step's own reading (`decideNextAction`'s food diagnostic: reason, recovery, action), whether a mill is a planning
 *    need (`planningNeeds`) and a town proposal (`townProposals`: rank, actor, score, cost, the actor's funds), a begun
 *    mill's stall and delivered timber, the town's timber and idle workers.
 * Usage: npx tsx scripts/foodReProbe.ts <seed> <years> > out.json
 */
import type { CarterWalker } from "../src/agents/walker.types";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation, isWinterTick } from "../src/content/houseFoodConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { decideNextAction, planningNeeds } from "../src/engine/autoplay";
import type { FoodDiagnosticCollector } from "../src/engine/autoplayFoodDiagnostic";
import { foodFacilityWithinLimit } from "../src/engine/autoplayFoodLimits";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_MODE_POLICY, townProposals } from "../src/engine/townAgency";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 20);
const bread = (inventory: Record<string, number | undefined>) => inventory.bread ?? 0;
const carts = (state: GameState) => state.walkers.filter((walker): walker is CarterWalker => walker.kind === "carter" && walker.cancellation === null);
const cargoBread = (walker: CarterWalker) => walker.reservation.resource === "bread" && walker.mission === "deliver" ? walker.reservation.amount : 0;
const millSites = (state: GameState) => state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === "mill");

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
type Season = { year: number; season: number; made: number; need: number; samples: number; noBread: number; houses?: number; mills?: number;
  millsBegun?: number; granaries?: number; end?: Record<string, number>; third?: unknown };
const seasons: Season[] = [];
let current: Season | null = null;
let thirdMillYear: number | null = null;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  const before = state;
  state = advanceTick(state);
  const calendar = stateCalendar(state);
  if (current === null || state.tick % 1_000 === 1) {
    current = { year: calendar.year, season: Math.floor((state.tick % 4_000) / 1_000), made: 0, need: 0, samples: 0, noBread: 0 };
    seasons.push(current);
  }
  const oldCarts = new Set(before.walkers.map(walker => walker.id));
  for (const mill of state.buildings.filter(b => b.kind === "mill")) {
    const was = before.buildings.find(b => b.id === mill.id);
    const loaded = carts(state).filter(walker => !oldCarts.has(walker.id) && walker.homeBuildingId === mill.id).reduce((s, w) => s + cargoBread(w), 0);
    current.made += Math.max(0, bread(mill.inventory) - bread(was?.inventory ?? {}) + loaded);
  }
  if (state.tick % HOUSE_FOOD_INTERVAL === 0) for (const house of state.houses) if (house.residents > 0) current.need += houseFoodRation(house) * (isWinterTick(state.tick) ? 1.2 : 1);
  if (state.tick % 100 === 0) for (const house of state.houses.filter(h => h.residents > 0)) { current.samples += 1; if (house.breadStock <= 0) current.noBread += 1; }
  if (state.tick % 1_000 !== 0) continue;
  const mills = state.buildings.filter(b => b.kind === "mill").length;
  if (mills >= 3 && thirdMillYear === null) thirdMillYear = calendar.year;
  current.houses = state.houses.filter(h => h.residents > 0).length;
  current.mills = mills;
  current.millsBegun = millSites(state).length;
  current.granaries = state.buildings.filter(b => b.kind === "granary").length;
  current.end = { mills: state.buildings.filter(b => b.kind === "mill").reduce((s, b) => s + bread(b.inventory), 0),
    granaries: state.buildings.filter(b => b.kind === "granary").reduce((s, b) => s + bread(b.inventory), 0),
    carts: carts(state).reduce((s, w) => s + cargoBread(w), 0), houses: state.houses.reduce((s, h) => s + h.breadStock, 0) };
  if (mills + millSites(state).length < 3) {
    const collector: FoodDiagnosticCollector = {};
    const action = decideNextAction(state, LORD_MODE_POLICY, collector);
    const proposals = townProposals(state);
    const rank = proposals.findIndex(p => p.what === "mill");
    const proposal = rank < 0 ? null : proposals[rank]!;
    const funds = Object.fromEntries((state.agency?.actors ?? []).map(a => [a.kind, a.funds]));
    current.third = {
      cap: foodFacilityWithinLimit(state, "mill"),
      food: collector.food === undefined ? null : { reason: collector.food.reason, recovery: collector.food.recovery ?? null,
        action: collector.food.action === null ? null : JSON.stringify(collector.food.action).slice(0, 60), counts: collector.food.counts ?? null },
      botAction: JSON.stringify(action).slice(0, 70),
      millNeed: planningNeeds(state, LORD_MODE_POLICY).filter(need => JSON.stringify(need.action).includes('"mill"')).map(need => need.planner),
      millProposal: proposal === null ? null : { rank, of: proposals.length, actor: proposal.actor, score: proposal.score, cost: proposal.cost, funds: funds[proposal.actor] ?? null },
      top: proposals.slice(0, 4).map(p => `${p.what}:${p.actor}:${p.score}`),
      timber: state.buildings.reduce((s, b) => s + (b.inventory.timber ?? 0), 0) + state.treasuryTimber, idle: state.idleWorkers,
      openSites: state.constructionSites.filter(isBuildingConstructionSite).length,
    };
  } else if (millSites(state).length > 0) {
    current.third = { begun: millSites(state).map(site => `${site.stall}:${site.delivered.timber ?? 0}/${site.required.timber ?? 0}`) };
  }
}
console.log(JSON.stringify({ seed, years, thirdMillYear, seasons: seasons.map(s => ({ ...s, need: Math.round(s.need), noBreadShare: s.samples ? Math.round(100 * s.noBread / s.samples) : 0 })) }, null, 1));
