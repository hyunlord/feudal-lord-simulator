// C4 probe (AL-6, decision AL11): the ale chain's bottleneck where a town stops rising, under the current rule or an
// alternative, over a window of ticks: barley barns and strips, barley stock, the kiln's operation (share of ticks by
// state) and malt, the brewing households and the ale they brew, the houses no alehouse reaches, and the houses held
// back by ale (eligible for the next level on every other requirement, not by the ale rule).
//   tsx scripts/aleBottleneckProbe.ts <seed> <maxTicks> <current|A|B|C> [windowStart] [windowTicks] > seed.json
// `current` is the rules as they stand (C4 decided: C + B); `C` puts back the blocking rule over them.
// A: ale is required from level 3; a served house rises to level 2 in 75 % of the hold. B: ale is not required; an
// unserved house waits 150 % of the hold from level 2. The alternatives are set on `ALE_BALANCE` for this run only.
import { ALE_BALANCE } from "../src/content/aleConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { productionOperation } from "../src/economy/production";
import { alehouses, aleRequired, aleServedHouses, brewingSlot } from "../src/engine/ale";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { stateCalendar } from "../src/engine/scenarioState";
import { buildingFootprintDistance } from "../src/geometry/buildingDistance";
import { updateHousing } from "../src/population/housing";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";

const [seedArg, maxArg, variantArg = "current", startArg, spanArg] = process.argv.slice(2);
const seed = Number(seedArg);
const maxTicks = Number(maxArg ?? 450_000);
const variant = variantArg as "current" | "A" | "B" | "C";
const windowStart = Number(startArg ?? 300_000);
const windowTicks = Number(spanArg ?? 20_000);
const balance = ALE_BALANCE as unknown as Record<string, unknown>;
if (variant === "A") Object.assign(balance, { requiredFromLevel: 3, servedBonusFromLevel: 2, servedHoldPermille: 750 });
if (variant === "B") Object.assign(balance, { rule: "delay", requiredFromLevel: 2, unservedHoldPermille: 1_500 });
// C alone: the kiln's carts and site as they are now, with the old blocking rule.
if (variant === "C") Object.assign(balance, { rule: "require", requiredFromLevel: 2, unservedHoldPermille: 1_000 });

const SEASON = 1_000;
const kilnStates: Record<string, number> = {};
let kilnTicks = 0;
let windowSamples = 0;
const sums = { barleyBarns: 0, barleyStrips: 0, barley: 0, malt: 0, maltInKiln: 0, brewing: 0, alehouses: 0, outOfReach: 0, aleBlocked: 0,
  otherBlocked: 0, eligibleUnserved: 0, l1plus: 0 };
let aleBrewed = 0;
let seasonsDrunk = 0;
let drinkers = 0;
let dryAtSeason = 0;
const trace: Record<string, number>[] = [];
let last: GameState | null = null;
let previousAle = new Map<string, number>();
const firstL4Full: { tick: number | null } = { tick: null };
/** The chain coming together (as `aleChainRun.ts`): the kiln, a barn on barley, the first ale drunk. */
const chain: Record<string, number | null> = { chapter2: null, kiln: null, barleyBarn: null, aleDrunk: null };
const mark = (key: string, tick: number) => { chain[key] ??= tick; };

/** Houses eligible to rise this tick with the ale rule and without it (the same state, one shadow step each way). */
function eligibility(state: GameState) {
  const services = householdServices(state);
  const served = aleServedHouses(state);
  const rises = (after: readonly GameState["houses"][number][]) => new Set(after.filter((house, index) => {
    const before = state.houses[index]!;
    return house.level > before.level || (house.promotionTicks ?? 0) > (before.promotionTicks ?? 0);
  }).map(house => house.buildingId));
  const tick = state.tick + 1;
  const withAle = rises(updateHousing(state.houses, state.buildings, tick, state.palisade, undefined, services,
    { fromLevel: ALE_BALANCE.requiredFromLevel, served }).houses);
  const without = rises(updateHousing(state.houses, state.buildings, tick, state.palisade, undefined, services).houses);
  return { withAle, without, served };
}

runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed, onTick: state => {
  last = state;
  if (firstL4Full.tick === null && state.houses.length === 24 && state.houses.every(house => house.level === 4)) firstL4Full.tick = state.tick;
  if (state.tick % 50 === 0) {
    if ((state.politics?.chapter.number ?? 1) >= 2) mark("chapter2", state.tick);
    if (state.buildings.some(building => building.kind === "malt_kiln")) mark("kiln", state.tick);
    if (state.buildings.some(building => building.crop === "barley")) mark("barleyBarn", state.tick);
    if (state.houses.some(house => house.aleUntilTick !== undefined)) mark("aleDrunk", state.tick);
  }
  if (state.tick % 4_000 === 0) {
    trace.push({ tick: state.tick, year: stateCalendar(state).year, l2plus: state.houses.filter(house => house.level >= 2).length,
      l3plus: state.houses.filter(house => house.level >= 3).length, l4: state.houses.filter(house => house.level === 4).length, population: state.population });
  }
  if (state.tick < windowStart || state.tick >= windowStart + windowTicks) return;
  // The kiln's operation every tick; the ale brewed (a slot's stock rising) every tick.
  for (const kiln of state.buildings.filter(building => building.kind === "malt_kiln")) {
    const op = productionOperation(kiln, BUILDING_CONFIG_BY_KIND.malt_kiln);
    kilnStates[op] = (kilnStates[op] ?? 0) + 1;
    kilnTicks += 1;
  }
  const ale = new Map(state.houses.map(house => [house.buildingId, brewingSlot(house)?.stock.ale ?? 0]));
  for (const [id, amount] of ale) aleBrewed += Math.max(0, amount - (previousAle.get(id) ?? amount));
  previousAle = ale;
  if (state.tick % SEASON === 0) {
    seasonsDrunk += 1;
    const drank = state.houses.filter(house => house.aleUntilTick === state.tick + ALE_BALANCE.aleServedTicks).length;
    drinkers += drank;
    dryAtSeason += state.houses.filter(house => house.level >= 1 && house.residents > 0 && house.aleUntilTick !== state.tick + ALE_BALANCE.aleServedTicks).length;
  }
  if (state.tick % 100 !== 0) return;
  windowSamples += 1;
  const byId = new Map(state.buildings.map(building => [building.id, building]));
  const stakes = alehouses(state).map(id => byId.get(id)).filter(building => building !== undefined);
  const stock = (resource: "barley" | "malt") => state.buildings.reduce((sum, building) => sum + (building.inventory[resource] ?? 0), 0);
  sums.barleyBarns += state.buildings.filter(building => building.crop === "barley").length;
  sums.barleyStrips += (state.arableFields ?? []).reduce((sum, field) => sum + field.strips.filter(strip => strip.crop === "barley").length, 0);
  sums.barley += stock("barley");
  sums.malt += stock("malt");
  sums.maltInKiln += state.buildings.filter(building => building.kind === "malt_kiln").reduce((sum, building) => sum + (building.inventory.malt ?? 0), 0);
  sums.brewing += state.houses.filter(house => brewingSlot(house) !== null).length;
  sums.alehouses += stakes.length;
  const lived = state.houses.filter(house => house.level >= 1 && house.residents > 0);
  sums.l1plus += lived.length;
  sums.outOfReach += lived.filter(house => brewingSlot(house) === null && !stakes.some(stake => {
    const home = byId.get(house.buildingId);
    return home !== undefined && buildingFootprintDistance(home, stake) <= ALE_BALANCE.alehouseReach;
  })).length;
  if (aleRequired(state)) {
    const { withAle, without, served } = eligibility(state);
    sums.aleBlocked += [...without].filter(id => !withAle.has(id)).length;
    sums.eligibleUnserved += [...without].filter(id => !served.has(id)).length;
    sums.otherBlocked += state.houses.filter(house => house.level < 4 && house.residents > 0 && !without.has(house.buildingId)).length;
  }
} });

const final = last as GameState | null;
const mean = (value: number) => windowSamples === 0 ? null : Math.round(value / windowSamples * 10) / 10;
const share = Object.fromEntries(Object.entries(kilnStates).map(([key, count]) => [key, Math.round(count / Math.max(1, kilnTicks) * 1000) / 10]));
process.stdout.write(`${JSON.stringify({ seed, variant, maxTicks, window: { start: windowStart, ticks: windowTicks, samples: windowSamples },
  bottleneck: {
    barleyBarns: mean(sums.barleyBarns), barleyStrips: mean(sums.barleyStrips), barleyStock: mean(sums.barley),
    kilnSharePercent: share, maltStock: mean(sums.malt), maltInKiln: mean(sums.maltInKiln),
    brewingHouses: mean(sums.brewing), aleBrewedPerSeason: seasonsDrunk === 0 ? null : Math.round(aleBrewed / seasonsDrunk * 10) / 10,
    drinkersPerSeason: seasonsDrunk === 0 ? null : Math.round(drinkers / seasonsDrunk * 10) / 10,
    dryHousesPerSeason: seasonsDrunk === 0 ? null : Math.round(dryAtSeason / seasonsDrunk * 10) / 10,
    alehouses: mean(sums.alehouses), l1plusHouses: mean(sums.l1plus), outOfAlehouseReach: mean(sums.outOfReach),
    heldBackByAle: mean(sums.aleBlocked), eligibleButUnserved: mean(sums.eligibleUnserved), heldBackByOther: mean(sums.otherBlocked),
  },
  chain, chainComplete: chain.aleDrunk !== null, firstL4Full: firstL4Full.tick, victoryTick: final?.settlement?.milestones.prosperity ?? null,
  final: final === null ? null : { tick: final.tick, year: stateCalendar(final).year, population: final.population,
    levels: [0, 1, 2, 3, 4].map(level => final.houses.filter(house => house.level === level).length) }, trace }, null, 1)}\n`);
