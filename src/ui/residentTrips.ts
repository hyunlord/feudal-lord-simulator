import type { BuilderWalker, TilePos } from "../agents/walker.types";
import { operationSuspended, type Building } from "../content/buildingConfig";
import { BALANCE } from "../content/balanceConfig";
import type { GameState } from "../engine/engine.types";
import { householdServices } from "../engine/householdServices";
import { buildingRoadAccessTiles } from "../engine/routing";
import { householdMembers, type MemberAgeBand, type MemberSex } from "../population/householdMembers";
import { boundaryHash, hashNumbers } from "../world/boundary/boundaryGeometry";
import { getOrthogonalRoadNeighbors } from "../world/roadGraph";
import type { Tile } from "../world/world.types";

/**
 * MOVE-1 resident trips (spec docs/design/resident-movement.md RM-1..RM-7): household members, market-day visitors,
 * clergy and gate guards walk the roads. They are presentation walkers: derived from the state and the tick, never
 * stored, never read by the simulation, so the state hash and every service rule stay as they are.
 *  - A trip is a road route from an origin to a destination and back, with a hidden stay at the destination.
 *  - Schedules come from the calendar (360 days a year, 4,000 ticks: a day is 11.1 ticks, a week 7 days) and from
 *    hashes of the game seed and building ids, so the same state at the same tick gives the same walkers.
 *  - The walkers take the builder walker shape (selection skips builders; no cargo) plus a `resident` tag the
 *    render reads for its occupation (`walkerOccupation`).
 */

export type ResidentOccupation = "water_fetcher" | "marketgoer" | "churchgoer" | "field_hand" | "market_visitor" | "clergy" | "guard";
export type ResidentPurpose = "well" | "market" | "church" | "field" | "visit" | "clergy" | "patrol";

export interface ResidentTag {
  readonly occupation: ResidentOccupation;
  readonly purpose: ResidentPurpose;
  /** The member's house and index for household trips (`householdMembers(state, houseId).members[memberIndex]`). */
  readonly houseId: string | null;
  readonly memberIndex: number | null;
  readonly sex: MemberSex;
  readonly ageBand: MemberAgeBand;
}

export type ResidentWalker = BuilderWalker & { readonly resident: ResidentTag };

/** Tiles per tick: a carter's pace (`BALANCE.CARTER_SPEED` 0.14) slowed a little for people on foot. */
export const RESIDENT_WALK_SPEED = 0.12;
/** RM-5: at most this many presentation walkers at once (a 24-lot town fits one screen). */
export const RESIDENT_WALKER_CAP = 40;
const DAYS_PER_YEAR = 360;
const DAYS_PER_WEEK = 7;
/** RM-2: the market day and Sunday of the week (0-based day of the week). */
export const MARKET_WEEKDAY = 2;
export const SUNDAY_WEEKDAY = 6;
const WELL_PERIOD = 2_400;
const FIELD_PERIOD = 800;
const CLERGY_PERIOD = 600;
const STAY = { well: 30, market: 120, church: 150, field: 300, visit: 150, clergy: 80, patrol: 20 } as const satisfies Record<ResidentPurpose, number>;
/** Household departures spread over this many ticks after the day starts. */
const DEPARTURE_SPREAD = 40;
/**
 * A calendar week is 78 ticks and a walk across town 150-450, so a household goes to market on one market day in four
 * and to church on one Sunday in four (its own hashed turn): everyone every week would fill the streets without end.
 */
const HOUSEHOLD_TURNS = 4;
/** Priority when the cap bites: town figures first, then the market day, then everyday errands. */
const PRIORITY: Readonly<Record<ResidentPurpose, number>> = { patrol: 0, clergy: 1, visit: 2, market: 3, church: 4, field: 5, well: 6 };
/** RM-5: at most this many of each purpose at once, so one errand never takes the whole cap (sum 46, cap 40). */
const QUOTA: Readonly<Record<ResidentPurpose, number>> = { patrol: 2, clergy: 2, visit: 10, market: 12, church: 8, field: 6, well: 6 };

export const absoluteDay = (tick: number): number => Math.floor((Math.max(0, tick) * DAYS_PER_YEAR) / BALANCE.TICKS_PER_YEAR);
export const dayStartTick = (day: number): number => Math.ceil((day * BALANCE.TICKS_PER_YEAR) / DAYS_PER_YEAR);
export const weekday = (day: number): number => day % DAYS_PER_WEEK;
export const isMarketDay = (tick: number): boolean => weekday(absoluteDay(tick)) === MARKET_WEEKDAY;

/** The render's walker key and member pick (`walkerLook.ts` walkerKey / walkerSex), so the tag and the drawn body agree. */
const walkerKey = (id: string): number => hashNumbers(Array.from(id, char => char.charCodeAt(0)));
const SEX_SALT = 1;
const MEMBER_SALT = 5;
const hashOf = (text: string, seed: number, salt: number): number => boundaryHash(walkerKey(text), seed, salt);

interface Route {
  /** Road tiles from the origin's road to the destination's road. */
  readonly path: readonly TilePos[];
}

interface PlannedTrip {
  readonly purpose: ResidentPurpose;
  readonly occupation: ResidentOccupation;
  readonly originId: string;
  readonly destinationId: string;
  readonly route: Route;
  /** House trips send one adult of this house; null for visitors, clergy and guards. */
  readonly houseId: string | null;
  readonly slot: number;
}

interface TripPlan {
  readonly household: readonly PlannedTrip[];
  readonly visitors: Route | null;
  readonly clergy: readonly PlannedTrip[];
  readonly patrols: readonly PlannedTrip[];
}

// ---------------------------------------------------------------------------------------------------------------
// Routes: one breadth-first search over road tiles per origin building, cached by the tiles array (roads and
// buildings replace it), never through the simulation's path cache.

type Search = ReadonlyMap<string, string | null>;
const key = (tile: TilePos): string => `${tile.tx},${tile.ty}`;
const searchesByTiles = new WeakMap<readonly Tile[], Map<string, Search>>();

function searchFrom(state: GameState, originKey: string, starts: readonly TilePos[]): Search {
  let byOrigin = searchesByTiles.get(state.tiles);
  if (byOrigin === undefined) {
    byOrigin = new Map();
    searchesByTiles.set(state.tiles, byOrigin);
  }
  const cached = byOrigin.get(originKey);
  if (cached !== undefined) return cached;
  const parents = new Map<string, string | null>(starts.map(start => [key(start), null]));
  const queue = [...starts];
  for (let index = 0; index < queue.length; index += 1) {
    for (const next of getOrthogonalRoadNeighbors(state, queue[index]!)) {
      if (parents.has(key(next))) continue;
      parents.set(key(next), key(queue[index]!));
      queue.push(next);
    }
  }
  byOrigin.set(originKey, parents);
  return parents;
}

function routeBetween(state: GameState, originKey: string, starts: readonly TilePos[], ends: readonly TilePos[]): Route | null {
  if (starts.length === 0 || ends.length === 0) return null;
  const parents = searchFrom(state, originKey, starts);
  let best: TilePos[] | null = null;
  for (const end of ends) {
    if (!parents.has(key(end))) continue;
    const path: TilePos[] = [];
    for (let at: string | null = key(end); at !== null; at = parents.get(at) ?? null) {
      const [tx, ty] = at.split(",").map(Number);
      path.push({ tx: tx!, ty: ty! });
    }
    path.reverse();
    if (best === null || path.length < best.length) best = path;
  }
  return best === null || best.length < 2 ? null : { path: best };
}

const buildingRoute = (state: GameState, origin: Building, destination: Building): Route | null =>
  routeBetween(state, origin.id, buildingRoadAccessTiles(state, origin), buildingRoadAccessTiles(state, destination));

// ---------------------------------------------------------------------------------------------------------------
// Plan: which trips the town has (RM-1..RM-4). Pure in the inputs of `planSignature`, cached on it.

const working = (building: Building): boolean => building.workers > 0 && !operationSuspended(building);

/**
 * RM-2: where visitors come in: the road tiles on the map edge, or, when no road reaches the edge yet, the road tiles
 * nearest to it (seed 2's roads stop 4 tiles short), in row order.
 */
function edgeRoadTiles(state: GameState): readonly TilePos[] {
  const roads = state.tiles.filter(tile => tile.hasRoad);
  const edgeDistance = (tile: Tile) => Math.min(tile.tx, tile.ty, state.width - 1 - tile.tx, state.height - 1 - tile.ty);
  const nearest = Math.min(...roads.map(edgeDistance));
  return roads.filter(tile => edgeDistance(tile) === nearest).map(tile => ({ tx: tile.tx, ty: tile.ty }));
}

/** Road tiles beside the main gate (tile centres within 1 of the gate point). */
function gateRoadTiles(state: GameState): readonly TilePos[] {
  const gate = state.palisade?.gate;
  if (gate === undefined) return [];
  return state.tiles.filter(tile => tile.hasRoad && Math.hypot(tile.tx + 0.5 - gate.x, tile.ty + 0.5 - gate.y) <= 1.01)
    .map(tile => ({ tx: tile.tx, ty: tile.ty })).sort((a, b) => a.ty - b.ty || a.tx - b.tx);
}

function computePlan(state: GameState): TripPlan {
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  const services = householdServices(state);
  const household: PlannedTrip[] = [];
  const homes = state.houses.filter(house => house.residents > 0 && (house.members?.adults ?? 0) > 0)
    .sort((a, b) => a.buildingId.localeCompare(b.buildingId));
  for (const house of homes) {
    const home = buildings.get(house.buildingId);
    const served = services.houses.get(house.buildingId);
    if (home === undefined || served === undefined) continue;
    const errands = [["well", "water_fetcher", served.water], ["market", "marketgoer", served.market], ["church", "churchgoer", served.church]] as const;
    for (const [purpose, occupation, access] of errands) {
      const destination = access.kind === "served" && access.providerId !== null ? buildings.get(access.providerId) : undefined;
      const route = destination === undefined ? null : buildingRoute(state, home, destination);
      if (destination !== undefined && route !== null) {
        household.push({ purpose, occupation, originId: home.id, destinationId: destination.id, route, houseId: home.id, slot: 0 });
      }
    }
  }
  // RM-3 field hands: each worker of a working farmstead walks from one of the nearest homes (by road).
  for (const farm of state.buildings.filter(building => building.kind === "farmstead" && working(building)).sort((a, b) => a.id.localeCompare(b.id))) {
    const nearest = homes.flatMap(house => {
      const home = buildings.get(house.buildingId);
      const route = home === undefined ? null : buildingRoute(state, home, farm);
      return home === undefined || route === null ? [] : [{ house, route }];
    }).sort((a, b) => a.route.path.length - b.route.path.length || a.house.buildingId.localeCompare(b.house.buildingId));
    for (let slot = 0; slot < farm.workers && nearest.length > 0; slot += 1) {
      const pick = nearest[slot % nearest.length]!;
      household.push({ purpose: "field", occupation: "field_hand", originId: pick.house.buildingId, destinationId: farm.id, route: pick.route, houseId: pick.house.buildingId, slot });
    }
  }
  // RM-2 visitors: from the first road tile on the map edge (row-major) that reaches a working market.
  const market = state.buildings.filter(building => building.kind === "market" && working(building)).sort((a, b) => a.id.localeCompare(b.id))[0];
  let visitors: Route | null = null;
  if (market !== undefined) {
    for (const edge of edgeRoadTiles(state)) {
      visitors = routeBetween(state, `edge:${key(edge)}`, [edge], buildingRoadAccessTiles(state, market));
      if (visitors !== null) break;
    }
  }
  // RM-4 clergy: church to chapel (either way round: the church's clergy visit the chapel).
  const church = state.buildings.filter(building => building.kind === "church" && !operationSuspended(building)).sort((a, b) => a.id.localeCompare(b.id))[0];
  const chapel = state.buildings.filter(building => building.kind === "chapel").sort((a, b) => a.id.localeCompare(b.id))[0];
  const clergy: PlannedTrip[] = [];
  const clergyRoute = church === undefined || chapel === undefined ? null : buildingRoute(state, church, chapel);
  if (church !== undefined && chapel !== undefined && clergyRoute !== null) {
    for (const slot of [0, 1]) clergy.push({ purpose: "clergy", occupation: "clergy", originId: church.id, destinationId: chapel.id, route: clergyRoute, houseId: null, slot });
  }
  // RM-4 guards: from the gate's road to the town's centre building (keep, market, church, granary) and back.
  const centre = ["keep", "market", "church", "granary"].map(kind => state.buildings.filter(building => building.kind === kind).sort((a, b) => a.id.localeCompare(b.id))[0])
    .find(building => building !== undefined);
  const patrols: PlannedTrip[] = [];
  const gateTiles = gateRoadTiles(state);
  const patrolRoute = centre === undefined ? null : routeBetween(state, `gate:${gateTiles.map(key).join(";")}`, gateTiles, buildingRoadAccessTiles(state, centre));
  if (centre !== undefined && patrolRoute !== null) {
    for (const slot of [0, 1]) patrols.push({ purpose: "patrol", occupation: "guard", originId: "gate", destinationId: centre.id, route: patrolRoute, houseId: null, slot });
  }
  return { household, visitors, clergy, patrols };
}

/** Everything `computePlan` reads: houses, buildings, roads (the tiles array), the wall gate and the seed. */
function planSignature(state: GameState): string {
  const houses = state.houses.map(house => `${house.buildingId}:${house.residents}:${house.level}:${house.members?.adults ?? 0}:${house.members?.children ?? 0}`).join(";");
  const buildings = state.buildings.map(building => `${building.id}:${building.kind}:${building.tx},${building.ty}:${building.workers}:${building.operationPaused === true ? 1 : 0}:${building.upkeepUnpaid === true ? 1 : 0}:${building.houseLot ?? ""}`).join(";");
  const gate = state.palisade === null ? "" : `${state.palisade.gate.x},${state.palisade.gate.y}`;
  return `${state.seed}|${state.width}x${state.height}|${gate}|${houses}|${buildings}`;
}

const plansByTiles = new WeakMap<readonly Tile[], { readonly signature: string; readonly plan: TripPlan }>();
function tripPlan(state: GameState): TripPlan {
  const signature = planSignature(state);
  const cached = plansByTiles.get(state.tiles);
  if (cached?.signature === signature) return cached.plan;
  const plan = computePlan(state);
  plansByTiles.set(state.tiles, { signature, plan });
  return plan;
}

// ---------------------------------------------------------------------------------------------------------------
// Trips at a tick (RM-1..RM-4): start ticks from the calendar and hashes; position along the route.

interface ActiveTrip {
  readonly id: string;
  readonly purpose: ResidentPurpose;
  readonly occupation: ResidentOccupation;
  readonly homeBuildingId: string;
  readonly houseId: string | null;
  readonly path: readonly TilePos[];
  readonly startTick: number;
}

const legTicks = (path: readonly TilePos[]): number => Math.ceil((path.length - 1) / RESIDENT_WALK_SPEED);
const tripTicks = (path: readonly TilePos[], purpose: ResidentPurpose): number => legTicks(path) * 2 + STAY[purpose];

/** Days (latest first) whose trips may still be on the road at `tick`. */
function recentDays(tick: number, weekdayWanted: number, longest: number): readonly number[] {
  const days: number[] = [];
  for (let day = absoluteDay(tick); day >= 0 && dayStartTick(day) > tick - longest - DEPARTURE_SPREAD; day -= 1) {
    if (weekday(day) === weekdayWanted) days.push(day);
  }
  return days;
}

function activeTrips(state: GameState, plan: TripPlan): readonly ActiveTrip[] {
  const tick = state.tick;
  const trips: ActiveTrip[] = [];
  const add = (trip: ActiveTrip) => {
    const age = tick - trip.startTick;
    if (age >= 0 && age < tripTicks(trip.path, trip.purpose)) trips.push(trip);
  };
  for (const planned of plan.household) {
    const base = `${planned.purpose}:${planned.originId}:${planned.destinationId}:${planned.slot}`;
    const offset = hashOf(base, state.seed, 11);
    if (planned.purpose === "well" || planned.purpose === "field") {
      const period = planned.purpose === "well" ? WELL_PERIOD : FIELD_PERIOD;
      const start = tick - ((((tick - offset) % period) + period) % period);
      add({ id: `resident-${base}@${start}`, purpose: planned.purpose, occupation: planned.occupation, homeBuildingId: planned.originId,
        houseId: planned.houseId, path: planned.route.path, startTick: start });
      continue;
    }
    const wanted = planned.purpose === "market" ? MARKET_WEEKDAY : SUNDAY_WEEKDAY;
    for (const day of recentDays(tick, wanted, tripTicks(planned.route.path, planned.purpose))) {
      if (Math.floor(day / DAYS_PER_WEEK) % HOUSEHOLD_TURNS !== offset % HOUSEHOLD_TURNS) continue;
      const start = dayStartTick(day) + (offset % DEPARTURE_SPREAD);
      add({ id: `resident-${base}@${start}`, purpose: planned.purpose, occupation: planned.occupation, homeBuildingId: planned.originId,
        houseId: planned.houseId, path: planned.route.path, startTick: start });
    }
  }
  if (plan.visitors !== null) {
    const path = plan.visitors.path;
    for (const day of recentDays(tick, MARKET_WEEKDAY, tripTicks(path, "visit"))) {
      const count = 4 + (hashOf(`visitors@${day}`, state.seed, 12) % 5);
      for (let index = 0; index < count; index += 1) {
        const start = dayStartTick(day) + index * 6;
        add({ id: `resident-visit:${day}:${index}@${start}`, purpose: "visit", occupation: "market_visitor", homeBuildingId: "visitor",
          houseId: null, path, startTick: start });
      }
    }
  }
  for (const planned of [...plan.clergy, ...plan.patrols]) {
    const period = planned.purpose === "clergy" ? CLERGY_PERIOD : tripTicks(planned.route.path, planned.purpose);
    const offset = planned.slot * Math.floor(period / 2);
    const start = tick - ((((tick - offset) % period) + period) % period);
    const cycle = Math.floor((start - offset) / period);
    const idBase = `${planned.purpose}:${planned.destinationId}:${planned.slot}:${cycle}`;
    // The guard sheet is male-only legacy art: the walker id gets a suffix whose hash draws a man (RM-6).
    const id = planned.purpose === "patrol" ? maleId(`resident-${idBase}`, state.seed) : `resident-${idBase}`;
    add({ id, purpose: planned.purpose, occupation: planned.occupation, homeBuildingId: planned.originId, houseId: null,
      path: planned.route.path, startTick: start });
  }
  return trips;
}

function maleId(base: string, seed: number): string {
  for (let suffix = 0; suffix < 64; suffix += 1) {
    const id = `${base}:${suffix}`;
    if ((hashOf(id, seed, SEX_SALT) & 1) === 1) return id;
  }
  return base;
}

/** The tag of a trip: the member the render will draw (its household pick), else the walker hash's sex. */
function tripTag(state: GameState, trip: ActiveTrip): ResidentTag {
  const household = trip.houseId === null ? null : householdMembers(state, trip.houseId);
  const adults = household?.members.map((member, index) => ({ member, index })).filter(({ member }) => member.ageBand !== "child") ?? [];
  if (adults.length > 0) {
    const pick = adults[hashOf(trip.id, state.seed, MEMBER_SALT) % adults.length]!;
    return { occupation: trip.occupation, purpose: trip.purpose, houseId: trip.houseId, memberIndex: pick.index, sex: pick.member.sex, ageBand: pick.member.ageBand };
  }
  const sex: MemberSex = (hashOf(trip.id, state.seed, SEX_SALT) & 1) === 0 ? "female" : "male";
  return { occupation: trip.occupation, purpose: trip.purpose, houseId: null, memberIndex: null, sex, ageBand: "adult" };
}

/** Position on the out-and-back route at `age` ticks, or null during the stay (inside the destination). */
function walkerOnRoute(trip: ActiveTrip, age: number, tag: ResidentTag): ResidentWalker | null {
  const leg = legTicks(trip.path);
  const outbound = age < leg;
  const back = age >= leg + STAY[trip.purpose];
  if (!outbound && !back) return null;
  const path = outbound ? trip.path : [...trip.path].reverse();
  const progress = Math.min(path.length - 1, (outbound ? age : age - leg - STAY[trip.purpose]) * RESIDENT_WALK_SPEED);
  const index = Math.min(path.length - 2, Math.floor(progress));
  const from = path[index]!;
  const to = path[index + 1]!;
  const fraction = progress - index;
  return {
    id: trip.id, kind: "builder", homeBuildingId: trip.homeBuildingId,
    position: { tx: from.tx + (to.tx - from.tx) * fraction, ty: from.ty + (to.ty - from.ty) * fraction },
    path, pathIndex: index, previousTile: index > 0 ? path[index - 1]! : null, cargo: null, spawnedTick: trip.startTick,
    siteId: "", slotIndex: 0, resident: tag,
  };
}

/**
 * RM-1..RM-5: the presentation walkers of the state at its tick: pure in the state (the plan cache holds only what
 * `planSignature` names). At most `RESIDENT_WALKER_CAP`, town figures and the market day first.
 */
export function residentWalkers(state: GameState): readonly ResidentWalker[] {
  if (state.settlement?.outcome === "abandoned") return [];
  const plan = tripPlan(state);
  const walking = activeTrips(state, plan).flatMap(trip => {
    const walker = walkerOnRoute(trip, state.tick - trip.startTick, tripTag(state, trip));
    return walker === null ? [] : [walker];
  });
  const taken: Partial<Record<ResidentPurpose, number>> = {};
  return walking.sort((a, b) => PRIORITY[a.resident.purpose] - PRIORITY[b.resident.purpose] || a.spawnedTick - b.spawnedTick || a.id.localeCompare(b.id))
    .filter(walker => {
      const count = taken[walker.resident.purpose] ?? 0;
      taken[walker.resident.purpose] = count + 1;
      return count < QUOTA[walker.resident.purpose];
    })
    .slice(0, RESIDENT_WALKER_CAP);
}

export function isResidentWalker(walker: { readonly id: string }): walker is ResidentWalker {
  return "resident" in walker;
}
