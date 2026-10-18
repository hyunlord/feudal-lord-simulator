/**
 * FOOD-DIST ② (the user's ruling 2026-10-18): why the distributors pass the houses without bread — diagnosis only,
 * nothing changed. The lord slice played by the lord bot (as `growBlockProbe.ts`); from `fromYear`, for each season:
 *  - how many distributors: per granary, the spawn ticks (`spawnDistributors`: every DISTRIBUTOR_INTERVAL ticks while
 *    fewer than 2 of its own walk and it holds bread) and the ticks each granary could not send (2 out, no bread);
 *  - each trip (a distributor from spawn to its end): ticks roaming and returning, tiles walked, bread taken out and
 *    brought back, and the tiles of its route;
 *  - every 100 ticks, each lived-in house with no bread: the road distance from its nearest bread-holding granary
 *    (`feasibleDistributorDistance`; a trip walks at most DISTRIBUTOR_RANGE tiles), and the distance from the house to
 *    the nearest tile any distributor walked that season (0–1: a route passed it).
 * Usage: npx tsx scripts/distributorRouteProbe.ts <seed> <years> [fromYear] > out.json
 */
import type { DistributorWalker } from "../src/agents/walker.types";
import { BALANCE } from "../src/content/balanceConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { feasibleDistributorDistance } from "../src/engine/distributorAccess";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 7);
const distributors = (state: GameState) => state.walkers.filter((walker): walker is DistributorWalker => walker.kind === "distributor");
const granaryBread = (state: GameState, id: string) => state.buildings.find(b => b.id === id)?.inventory.bread ?? 0;

type Trip = { granary: string; start: number; roamTicks: number; returnTicks: number; tiles: number; out: number; back: number; route: Set<string> };
type Season = { year: number; season: number; granaries: number; spawns: Record<string, number>; blocked: Record<string, number>;
  trips: { granary: string; roamTicks: number; returnTicks: number; tiles: number; out: number; back: number }[];
  noBread: number; lived: number; farFromGranary: number; noGranaryRoute: number; offRoute: Record<string, number>; distances: number[] };
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const fromYear = Number(process.argv[4] ?? start);
const seasons: Season[] = [];
let current: Season | null = null;
const trips = new Map<string, Trip>();
let visited = new Set<string>();
const key = (tx: number, ty: number) => `${tx},${ty}`;
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  const year = stateCalendar(state).year;
  if (year < fromYear) continue;
  if (current === null || state.tick % 1_000 === 1) {
    current = { year, season: Math.floor((state.tick % 4_000) / 1_000), granaries: 0, spawns: {}, blocked: {}, trips: [], noBread: 0, lived: 0,
      farFromGranary: 0, noGranaryRoute: 0, offRoute: {}, distances: [] };
    seasons.push(current);
    visited = new Set();
  }
  const walking = distributors(state);
  const ids = new Set(walking.map(walker => walker.id));
  for (const walker of walking) {
    let trip = trips.get(walker.id);
    if (trip === undefined) {
      trip = { granary: walker.homeBuildingId, start: state.tick, roamTicks: 0, returnTicks: 0, tiles: 0, out: walker.cargo?.amount ?? 0, back: 0, route: new Set() };
      trips.set(walker.id, trip);
      current.spawns[walker.homeBuildingId] = (current.spawns[walker.homeBuildingId] ?? 0) + 1;
    }
    if (walker.phase === "roaming") trip.roamTicks += 1; else trip.returnTicks += 1;
    trip.tiles = walker.tilesTravelled;
    trip.back = walker.cargo?.amount ?? 0;
    const tile = key(Math.round(walker.position.tx), Math.round(walker.position.ty));
    trip.route.add(tile); visited.add(tile);
  }
  for (const [id, trip] of trips) if (!ids.has(id)) {
    current.trips.push({ granary: trip.granary, roamTicks: trip.roamTicks, returnTicks: trip.returnTicks, tiles: trip.tiles, out: trip.out, back: trip.back });
    trips.delete(id);
  }
  if (state.tick % BALANCE.DISTRIBUTOR_INTERVAL === 0) for (const granary of state.buildings.filter(b => b.kind === "granary")) {
    const out = walking.filter(walker => walker.homeBuildingId === granary.id).length;
    const why = out >= 2 ? "two_out" : (granary.inventory.bread ?? 0) === 0 ? "no_bread" : null;
    if (why !== null) current.blocked[why] = (current.blocked[why] ?? 0) + 1;
  }
  if (state.tick % 100 === 0) {
    const granaries = state.buildings.filter(b => b.kind === "granary");
    current.granaries = granaries.length;
    const stocked = granaries.filter(g => granaryBread(state, g.id) > 0);
    for (const house of state.houses.filter(h => h.residents > 0)) {
      current.lived += 1;
      if (house.breadStock > 0) continue;
      current.noBread += 1;
      const distances = stocked.map(g => feasibleDistributorDistance(state, g, house.buildingId)).filter((d): d is number => d !== null);
      if (distances.length === 0) current.noGranaryRoute += 1;
      else { const d = Math.min(...distances); current.distances.push(d); if (d > BALANCE.DISTRIBUTOR_RANGE) current.farFromGranary += 1; }
      const home = state.buildings.find(b => b.id === house.buildingId);
      if (home === undefined) continue;
      let nearest = Infinity;
      for (const tile of visited) { const [tx, ty] = tile.split(",").map(Number); nearest = Math.min(nearest, Math.max(0, Math.abs(tx! - home.tx) - 1) + Math.max(0, Math.abs(ty! - home.ty) - 1)); }
      const band = !Number.isFinite(nearest) ? "no_route_this_season" : nearest <= 1 ? "route_passed(0-1)" : nearest <= 4 ? "near(2-4)" : nearest <= 10 ? "off(5-10)" : "far(>10)";
      current.offRoute[band] = (current.offRoute[band] ?? 0) + 1;
    }
  }
}
const median = (xs: number[]) => xs.length === 0 ? null : [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
console.log(JSON.stringify({ seed, years, fromYear, range: BALANCE.DISTRIBUTOR_RANGE, interval: BALANCE.DISTRIBUTOR_INTERVAL, capacity: BALANCE.DISTRIBUTOR_CAPACITY,
  seasons: seasons.map(s => ({ year: s.year, season: s.season, granaries: s.granaries, spawns: s.spawns, blocked: s.blocked,
    trips: s.trips.length, roamTicks: median(s.trips.map(t => t.roamTicks)), returnTicks: median(s.trips.map(t => t.returnTicks)),
    tiles: median(s.trips.map(t => t.tiles)), breadOut: s.trips.reduce((a, t) => a + t.out, 0), breadBack: s.trips.reduce((a, t) => a + t.back, 0),
    noBreadShare: s.lived ? Math.round(100 * s.noBread / s.lived) : 0, noBread: s.noBread, farFromGranary: s.farFromGranary, noGranaryRoute: s.noGranaryRoute,
    granaryDistanceMedian: median(s.distances), offRoute: s.offRoute })) }, null, 1));
