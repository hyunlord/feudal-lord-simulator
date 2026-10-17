/**
 * STONE-FEED (③ (나), the user's ruling 2026-10-17): why a staffed masonry sits without raw stone while raw stone lies
 * elsewhere — diagnosis only, nothing changed. The lord slice played by the lord bot (as `growBlockProbe.ts`); from the
 * charter on, every 250 ticks each staffed masonry short of the raw stone for its next stone is put in one class:
 *  - its main cart is out: delivering (to a building, to a construction site) or fetching;
 *  - no cart out, and the fetch the delivery step would make (`fetchCandidate`) — none because the masonry has no room,
 *    because no store or quarry has raw stone it can take (held, or reserved), because no route reaches the stone; or one
 *    there (the cart leaves at the next delivery step).
 * Beside it: where the raw stone lies (stores, quarries, masonries, carts), the route length to the nearest store holding
 * it, where the quarries' carts take it, and the masonry-growth loop (`stoneDemandExpansionKind`,
 * `autoplayMaterialGrowth.ts:118`): the samples where the town wants stone, has two quarries a masonry, and the rule
 * waits because a staffed masonry lacks raw stone.
 * Usage: npx tsx scripts/stoneFeedProbe.ts <seed> <years> > out.json
 */
import { fetchCandidate } from "../src/agents/deliveryBuildingCandidates";
import type { CarterWalker } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { materialGrowthNeed, QUARRIES_PER_MASONRY_MAX, stoneDemandExpansionKind } from "../src/engine/autoplayMaterialGrowth";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { buildingHasRequiredRoadAccess } from "../src/engine/roadAccess";
import { stateCalendar } from "../src/engine/scenarioState";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const seed = Number(process.argv[2] ?? 27);
const years = Number(process.argv[3] ?? 30);
const SAMPLE = 250;
const dressing = BUILDING_CONFIG_BY_KIND.masonry.production?.inputPerOutput ?? 2;
const inventory = createDeliveryInventoryPort();

const raw = (building: Building) => building.inventory.stone_raw ?? 0;
const staffed = (building: Building) => building.workers >= BUILDING_CONFIG_BY_KIND[building.kind].workersRequired;
const add = (counts: Record<string, number>, key: string) => { counts[key] = (counts[key] ?? 0) + 1; };

function classify(state: GameState, home: Building, routes: ReturnType<typeof createSimulationRoutePorts>["delivery"]): string {
  const cart = state.walkers.find((walker): walker is CarterWalker => walker.kind === "carter" && walker.homeBuildingId === home.id
    && walker.cart === undefined && walker.cancellation === null);
  if (cart !== undefined) {
    if (cart.mission === "fetch") return `cart:fetch:${cart.phase}`;
    const to = cart.destination.kind === "construction_site" ? "site" : state.buildings.find(b => b.id === (cart.destination as { buildingId: string }).buildingId)?.kind ?? "?";
    return `cart:deliver:${cart.reservation.resource}->${to}:${cart.phase}`;
  }
  if (!buildingHasRequiredRoadAccess(state, home)) return "no_road_access";
  if (inventory.availableSpace(home) === 0) return `home_full(stone ${home.inventory.stone ?? 0})`;
  const holders = state.buildings.filter(b => b.id !== home.id && raw(b) > 0);
  if (holders.length === 0) return "no_raw_anywhere";
  const takeable = holders.filter(b => inventory.availableStock(b, "stone_raw") > 0);
  if (takeable.length === 0) return "raw_all_reserved";
  const routed = takeable.filter(b => (routes.betweenBuildings(home.id, b.id)?.length ?? 0) > 0);
  if (routed.length === 0) return "no_route_to_raw";
  const candidate = fetchCandidate(home, "stone_raw", state.buildings, inventory, routes);
  if (candidate === null) return "fetch_none";
  return candidate.amount < dressing ? `fetch_small:${candidate.building.kind}` : `fetch_ready:${candidate.building.kind}`;
}

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
let charter: number | null = null;
const idle: Record<string, number> = {};
const quarryCarts: Record<string, number> = {};
let samples = 0, masonrySamples = 0, idleSamples = 0, storedIdle = 0;
let wantStone = 0, loopWaits = 0, loopWaitsStored = 0;
const routeToRaw: number[] = [];
const examples: unknown[] = [];
const byYear: Record<number, { idle: number; samples: number; storeRaw: number; quarryRaw: number; masonries: number; quarries: number }> = {};
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  if (charter === null && state.era !== "hamlet") charter = state.tick;
  if (charter === null || state.tick % SAMPLE !== 0) continue;
  samples += 1;
  const routes = createSimulationRoutePorts(state).delivery;
  const masonries = state.buildings.filter(b => b.kind === "masonry");
  const quarries = state.buildings.filter(b => b.kind === "quarry");
  const stores = state.buildings.filter(b => b.kind !== "masonry" && b.kind !== "quarry" && raw(b) > 0);
  const storeRaw = stores.reduce((sum, b) => sum + raw(b), 0);
  const year = stateCalendar(state).year;
  const entry = byYear[year] ??= { idle: 0, samples: 0, storeRaw: 0, quarryRaw: 0, masonries: 0, quarries: 0 };
  entry.samples += 1; entry.storeRaw = Math.max(entry.storeRaw, storeRaw); entry.quarryRaw = Math.max(entry.quarryRaw, quarries.reduce((s, b) => s + raw(b), 0));
  entry.masonries = masonries.length; entry.quarries = quarries.length;
  for (const walker of state.walkers) if (walker.kind === "carter" && quarries.some(q => q.id === walker.homeBuildingId) && walker.mission === "deliver" && walker.phase === "outbound") {
    const to = walker.destination.kind === "construction_site" ? "site" : state.buildings.find(b => b.id === (walker.destination as { buildingId: string }).buildingId)?.kind ?? "?";
    add(quarryCarts, `${walker.reservation.resource}->${to}`);
  }
  let anyIdle = false;
  for (const home of masonries) {
    if (!staffed(home)) continue;
    masonrySamples += 1;
    if (raw(home) >= dressing) continue;
    anyIdle = true; idleSamples += 1; entry.idle += 1;
    if (storeRaw >= dressing) storedIdle += 1;
    const why = classify(state, home, routes);
    add(idle, `${storeRaw >= dressing ? "stored" : "none_stored"}|${why}`);
    const nearest = stores.map(b => routes.betweenBuildings(home.id, b.id)?.length ?? Infinity).reduce((a, b) => Math.min(a, b), Infinity);
    if (Number.isFinite(nearest)) routeToRaw.push(nearest);
    if (examples.length < 12 && storeRaw >= dressing) examples.push({ tick: state.tick, year, masonry: `${home.tx},${home.ty}`, raw: raw(home), stone: home.inventory.stone ?? 0,
      why, stores: stores.map(b => `${b.kind}@${b.tx},${b.ty}:${raw(b)}(avail ${inventory.availableStock(b, "stone_raw")})`), nearest });
  }
  const need = materialGrowthNeed(state, "stone");
  if (need > 0) wantStone += 1;
  const placed = (kind: string) => state.buildings.filter(b => b.kind === kind).length + state.constructionSites.filter(s => "kind" in s && s.kind === kind).length;
  if (need > 0 && placed("quarry") >= QUARRIES_PER_MASONRY_MAX * placed("masonry") && anyIdle && stoneDemandExpansionKind(state) === null) {
    loopWaits += 1; if (storeRaw >= dressing) loopWaitsStored += 1;
  }
}
routeToRaw.sort((a, b) => a - b);
console.log(JSON.stringify({
  seed, years, charterYear: charter === null ? null : start + Math.floor(charter / 4000), samples, sampleTicks: SAMPLE,
  masonrySamples, idleSamples, idleWhileStored: storedIdle, idle: Object.fromEntries(Object.entries(idle).sort((a, b) => b[1] - a[1])),
  routeToRawMedian: routeToRaw.length ? routeToRaw[Math.floor(routeToRaw.length / 2)] : null, routeToRawMax: routeToRaw.at(-1) ?? null,
  quarryCarts, masonryLoop: { wantStone, waitsOnIdleMasonry: loopWaits, waitsWhileStored: loopWaitsStored },
  byYear, examples, era: state.era,
}, null, 1));
