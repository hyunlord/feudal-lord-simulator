import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { spawnCarters, stepCarters } from "../src/agents/delivery";
import { LABOUR_BALANCE, SEASON_BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { CRAFT_DEFINITIONS, loadCraftDefinitions, parseCraftDefinition } from "../src/content/crafts/craftDefinitions";
import { createConstructionSite } from "../src/economy/construction";
import { stepProduction } from "../src/economy/production";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { householdMembers, memberProfile, withHouseholdMembers } from "../src/population/householdMembers";
import { householdLabour } from "../src/engine/householdLabour";
import { householdSlotCount, householdSlots, processDelivery } from "../src/population/householdSlots";
import { allocateBuildingAndConstructionLabour, availableWorkers } from "../src/population/labour";
import { allocateLabourDemands, farmsteadFieldNeed, laborSeason, tendedCellsByFarmstead } from "../src/engine/labourDemand";
import type { House } from "../src/population/population.types";
import { migrateSaveToLatest } from "../src/save/migrations";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { householdLabourRows, idleLabourCause } from "../src/ui/householdLabourModel";
import { HOUSEHOLD_LABOUR_COPY } from "../src/ui/householdLabourCopy.ko";
import { settlementGuidance } from "../src/ui/settlementGuidanceModel";
import { arableLayouts } from "../src/zones/arableFields";
import { building, DELIVERY_INVENTORY, line, routePort } from "./deliveryFixtures";
import { farmsteadAt, fieldWorld, rectangle, runFields } from "./helpers/arableWorld";

const TIMES = { createdAt: "2026-09-25T00:00:00.000Z", savedAt: "2026-09-25T00:00:00.000Z", gameVersion: "test" } as const;
const house = (buildingId: string, residents: number, level = 1): House => ({ buildingId, level, residents, hasWater: true,
  breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 });
const adultsOf = (houses: readonly House[]) => houses.reduce((total, entry) => total + (entry.members?.adults ?? 0), 0);
const residentsOf = (houses: readonly House[]) => houses.reduce((total, entry) => total + entry.residents, 0);
const stateFromSave = (path: string): GameState => (migrateSaveToLatest(JSON.parse(readFileSync(path, "utf8"))).value as { state: GameState }).state;
/** In-year tick of a season band start (LB-5). */
const bandStart = (name: string) => SEASON_BALANCE.bands.find(band => band.name === name)!.from;

test("L1 LB-1 household adults add up to the old labour pool and adults + children = residents", () => {
  const odd = withHouseholdMembers([house("h3", 3), house("h1", 5), house("h2", 7), house("h4", 0)], 42);
  assert.equal(adultsOf(odd), availableWorkers(15), "⌊15 × 0.5⌋ = 7 adults, not Σ⌊r/2⌋ = 5");
  for (const entry of odd) assert.equal((entry.members?.adults ?? 0) + (entry.members?.children ?? 0), entry.residents, entry.buildingId);
  // The same count holds on the 24-lot city and on the saved in-repo states after a real tick.
  for (const path of ["fixtures/determinism/seed1/final-state.json", "fixtures/saves/v10/population-176.save.json", "fixtures/saves/v10/four-farms.save.json"]) {
    const state = advanceTick(stateFromSave(path));
    assert.equal(adultsOf(state.houses), availableWorkers(state.population), path);
    assert.equal(residentsOf(state.houses), state.population, path);
    const labour = state.labour!;
    assert.equal(labour.adults, availableWorkers(stateFromSave(path).population), `${path}: the tick staffs with its opening population`);
    assert.equal(labour.facility + labour.construction + labour.fieldHands + labour.hauling + labour.household + labour.idle, labour.adults, `${path}: every adult is counted once`);
  }
});

test("L2 LB-1/LB-2 member seeds are deterministic and survive a save round trip", () => {
  const state = advanceTick(stateFromSave("fixtures/saves/v10/population-176.save.json"));
  const again = advanceTick(stateFromSave("fixtures/saves/v10/population-176.save.json"));
  assert.deepEqual(state.houses.map(entry => entry.members), again.houses.map(entry => entry.members));
  assert.ok(new Set(state.houses.map(entry => entry.members?.seed)).size === state.houses.length, "each household has its own seed");
  const loaded = decodeSave(encodeSave({ state, ...TIMES }).bytes).envelope.state;
  assert.deepEqual(loaded.houses.map(entry => entry.members), state.houses.map(entry => entry.members));
  const id = state.houses.find(entry => entry.residents > 2)!.buildingId;
  assert.deepEqual(householdMembers(loaded, id), householdMembers(state, id));
  const view = householdMembers(state, id)!;
  assert.equal(view.members.length, view.adults + view.children);
  assert.ok(view.members.slice(view.adults).every(member => member.ageBand === "child"));
  assert.ok(view.members.slice(0, view.adults).every(member => member.ageBand !== "child"));
  assert.equal(memberProfile(state.houses.find(entry => entry.buildingId === id)!.members!, 0).ageBand, "adult", "the head of a household is of working age");
  assert.equal(householdMembers(state, "no-such-house"), null);
});

/** An 8×4 field (24 cultivable cells) tended from a farmstead, with a mill, a granary, a logging camp and a sawmill. */
const FIELD_CELLS = 24;
function townWithBigField(tick: number): GameState {
  const world = fieldWorld({ field: rectangle(2, 9, 10, 13), tick, farmstead: farmsteadAt(10, 10, 0) });
  const extra: Building[] = ["mill", "granary", "logging_camp", "sawmill"].map((kind, index) =>
    ({ ...building(`b-${kind}`, kind as Building["kind"], { tx: 14 + index, ty: 3 }) }));
  return { ...world, buildings: [...world.buildings, ...extra] };
}

test("L3 LB-4 facilities and the construction floor come first; field hands only take what is left (R-T5 kept)", () => {
  const state = townWithBigField(bandStart("harvest"));
  assert.equal(tendedCellsByFarmstead(state).get("farmstead-10-10"), FIELD_CELLS);
  const site = createConstructionSite({ ordinal: 1, kind: "house", tx: 30, ty: 30, startedTick: 0 });
  // 36 residents = 18 adults: floor 3, then farmstead 4 · mill 2 · granary 2, the timber pair 3 + 2, then the rest.
  const labour = allocateBuildingAndConstructionLabour(state.buildings, [{ ...site, delivered: site.required }], 36, undefined);
  assert.equal(labour.constructionSites[0]?.assignedBuilders, 3, "R-3 floor");
  const workers = new Map(labour.buildings.map(entry => [entry.kind, entry.workers]));
  assert.deepEqual([workers.get("farmstead"), workers.get("mill"), workers.get("granary"), workers.get("logging_camp"), workers.get("sawmill")], [4, 2, 2, 3, 2]);
  assert.equal(labour.idleWorkers, 2);
  const demands = allocateLabourDemands({ state, buildings: labour.buildings, houses: [], remaining: labour.idleWorkers,
    constructionWorkers: 3, adults: 18, tick: state.tick, eligible: () => true });
  const need = farmsteadFieldNeed(FIELD_CELLS, state.tick);
  assert.equal(need, 2 * FIELD_CELLS, "harvest: 24 cells × 1 × 2");
  // The two left over: the granary's hauler (its mill is in reach, LB-7) first, then one field hand.
  assert.equal(demands.buildings.find(entry => entry.kind === "granary")?.haulers, 1);
  assert.equal(demands.buildings.find(entry => entry.kind === "farmstead")?.fieldHands, 1, "only what is left becomes field hands");
  assert.deepEqual(demands.summary, { adults: 18, facility: 13, construction: 3, fieldHands: 1, hauling: 1, household: 0, idle: 0 });
  // With spare adults the day pool fills the whole seasonal need (and a granary with a mill in reach gets its hauler).
  const rich = allocateLabourDemands({ state, buildings: labour.buildings.map(entry => entry.kind === "mill" ? { ...entry, workers: 2 } : entry),
    houses: [], remaining: 60, constructionWorkers: 3, adults: 76, tick: state.tick, eligible: () => true });
  assert.equal(rich.buildings.find(entry => entry.kind === "farmstead")?.fieldHands, need - 4);
  assert.equal(rich.summary.idle, 60 - (need - 4) - LABOUR_BALANCE.haulersPerGranary);
});

test("L4 LB-5 harvest need ×2 is met from the day pool and the strips finish at full speed", () => {
  assert.equal(laborSeason(bandStart("harvest")).permille, 2000);
  assert.equal(laborSeason(bandStart("sowing")).permille, 2000);
  assert.equal(laborSeason(bandStart("early_summer")).permille, 1000);
  assert.equal(farmsteadFieldNeed(FIELD_CELLS, bandStart("harvest")), 2 * farmsteadFieldNeed(FIELD_CELLS, bandStart("early_summer")));
  // Ripe 24-cell field at the start of the harvest band: the farmstead's 4 workers alone versus 4 + 44 hands.
  const start = townWithBigField(bandStart("harvest"));
  const ripe: GameState = { ...start, arableFields: (() => {
    const layouts = arableLayouts(start);
    return layouts.map(layout => ({ zoneId: layout.zoneId, axis: layout.axis, harvestedWheat: 0, lostWheat: 0,
      strips: layout.strips.map(strip => ({ id: strip.id, cells: strip.cells.length, crop: "wheat" as const, stage: "ripe" as const,
        stageTick: start.tick, completionPermille: 1000, fertilityPermille: 1000, work: 0 })) }));
  })() };
  const harvestTicks = (hands: number) => {
    let finished: number | null = null;
    const withHands = { ...ripe, buildings: ripe.buildings.map(entry => entry.kind === "farmstead" ? { ...entry, workers: 4, ...(hands > 0 ? { fieldHands: hands } : {}) } : entry) };
    runFields(withHands, 900, state => {
      if (finished === null && (state.arableFields ?? []).every(field => field.strips.every(strip => strip.stage === "harvested"))) finished = state.tick - ripe.tick;
    });
    return finished;
  };
  const need = farmsteadFieldNeed(FIELD_CELLS, bandStart("harvest"));
  const full = harvestTicks(need - 4);
  const crewOnly = harvestTicks(0);
  // 24 cells × 90 worker-ticks: 45 ticks at the full 48-person need, 540 with the crew alone (the C1c-2 speed).
  assert.ok(full !== null && full <= Math.ceil(FIELD_CELLS * 90 / need) + 1, `full staff harvested in ${full}`);
  assert.ok(crewOnly !== null && crewOnly >= Math.floor(FIELD_CELLS * 90 / 4) - 1, `crew alone harvested in ${crewOnly}`);
});

test("L5 LB-5 early winter halves the need: field hands go home, idle rises and every household slot is free", () => {
  const houses = withHouseholdMembers([house("h1", 20, 1), house("h2", 20, 3), house("h3", 20, 4)], 7);
  const allocate = (tick: number) => {
    const state = { ...townWithBigField(tick), houses: [...houses] };
    const staffed = state.buildings.map(entry => ({ ...entry, workers: BUILDING_CONFIG_BY_KIND[entry.kind].workersRequired }));
    return allocateLabourDemands({ state, buildings: staffed, houses, remaining: 20, constructionWorkers: 0, adults: 30, tick, eligible: () => true });
  };
  const harvest = allocate(bandStart("harvest")).summary;
  const winter = allocate(bandStart("early_winter")).summary;
  assert.equal(farmsteadFieldNeed(FIELD_CELLS, bandStart("early_winter")), 12, "24 × 1 × 0.5");
  assert.ok(winter.fieldHands < harvest.fieldHands, `hands ${harvest.fieldHands} → ${winter.fieldHands}`);
  assert.ok(winter.idle > harvest.idle, `idle ${harvest.idle} → ${winter.idle}`);
  const free = houses.flatMap(entry => householdSlots(entry)).filter(slot => slot.craftId === null).length;
  assert.equal(free, householdSlotCount(1) + householdSlotCount(3) + householdSlotCount(4), "L1 1 + L3 2 + L4 2 slots, all empty");
  assert.equal(winter.household, 0, "no craft yet, so the freed adults stay idle (C4 gives the slots work)");
});

test("L6 LB-7 a mill runs two carts: bread goes out while the intake cart brings 12 wheat", () => {
  const mill = { ...building("mill", "mill", { inventory: { bread: 8 } }), workers: 2 };
  const store = building("store", "granary", { inventory: { wheat: 40 } });
  const result = spawnCarters({ tick: 1, buildings: [mill, store], walkers: [], inventory: DELIVERY_INVENTORY,
    routes: routePort({ "mill->store": line([0, 0], [1, 0], [2, 0]) }) });
  const carts = result.walkers.filter(walker => walker.kind === "carter" && walker.homeBuildingId === "mill");
  assert.equal(carts.length, 2);
  const intake = carts.find(walker => walker.kind === "carter" && walker.cart === "intake");
  const main = carts.find(walker => walker.kind === "carter" && walker.cart === undefined);
  assert.ok(intake?.kind === "carter" && intake.mission === "fetch" && intake.reservation.amount === LABOUR_BALANCE.millCartCapacity);
  assert.ok(main?.kind === "carter" && main.mission === "deliver");
  assert.deepEqual(main.cargo, { resource: "bread", amount: 8 });
  assert.equal(BUILDING_CONFIG_BY_KIND.mill.carterCapacity, 12);
});

/** A staffed mill 12 road tiles from a granary full of wheat; the loop runs carts and grinding for `ticks`. */
function millStarvedTicks(haulers: number, ticks: number): { starved: number; bread: number } {
  const path = line(...Array.from({ length: 13 }, (_, index) => [index, 0] as [number, number]));
  const reverse = [...path].reverse();
  const routes = routePort({ "mill->store": path, "store->mill": reverse,
    ...Object.fromEntries(path.map((tile, index) => [`${tile.tx},${tile.ty}->mill`, path.slice(0, index + 1).reverse()])),
    ...Object.fromEntries(path.map((tile, index) => [`${tile.tx},${tile.ty}->store`, path.slice(index)])) });
  let buildings: readonly Building[] = [{ ...building("mill", "mill", { tx: 0, ty: 1 }), workers: 2 },
    { ...building("store", "granary", { tx: 12, ty: 1, inventory: { wheat: 150 } }), ...(haulers > 0 ? { haulers } : {}) }];
  let walkers = spawnCarters({ tick: 0, buildings, walkers: [], inventory: DELIVERY_INVENTORY, routes });
  buildings = walkers.buildings;
  let starved = 0;
  let bread = 0;
  for (let tick = 1; tick <= ticks; tick += 1) {
    const moved = stepCarters({ tick, buildings, walkers: walkers.walkers, inventory: DELIVERY_INVENTORY, routes });
    buildings = moved.buildings.map(entry => {
      if (entry.kind !== "mill") return entry;
      if ((entry.inventory.wheat ?? 0) < 2) starved += 1;
      const step = stepProduction(entry, BUILDING_CONFIG_BY_KIND.mill);
      if (step.produced === "bread") bread += 1;
      // Bread leaves the scene so it never fills the mill (the granary has room for it anyway).
      return { ...step.building, inventory: { ...step.building.inventory, bread: 0 } };
    });
    walkers = spawnCarters({ tick, buildings, walkers: moved.walkers, inventory: DELIVERY_INVENTORY, routes });
    buildings = walkers.buildings;
  }
  return { starved, bread };
}

test("L7 LB-7 a granary hauler pushing wheat cuts the ticks a distant mill waits with no wheat", () => {
  const alone = millStarvedTicks(0, 2400);
  const pushed = millStarvedTicks(1, 2400);
  assert.ok(pushed.starved < alone.starved, `zero-wheat ticks ${alone.starved} → ${pushed.starved}`);
  assert.ok(pushed.bread > alone.bread, `bread ${alone.bread} → ${pushed.bread}`);
});

test("L8 LB-9 idle labour above 25% shows the goal-panel line, the cause and the hint", () => {
  const base = stateFromSave("fixtures/saves/v10/population-176.save.json");
  const state = advanceTick(base);
  const idle = state.labour!.idle;
  assert.ok(idle / state.population > LABOUR_BALANCE.idleHintPermille / 1000, `idle ${idle} of ${state.population}`);
  const cause = idleLabourCause(state);
  assert.equal(cause?.label, HOUSEHOLD_LABOUR_COPY.idleLine(idle));
  assert.ok(cause !== null && cause.sources.length > 0 && cause.sources.every(source => source.type === "building"));
  const shares = householdLabour(state);
  assert.equal([...shares.values()].reduce((total, share) => total + share.idle, 0), idle, "the houses' idle adults add up to the town's");
  const guidance = settlementGuidance(state);
  assert.equal(guidance.idleLine, HOUSEHOLD_LABOUR_COPY.idleLine(idle));
  if (guidance.priority?.kind === "labour") assert.equal(guidance.priority.label, HOUSEHOLD_LABOUR_COPY.idleHint);
  // A town with no idle adult shows neither.
  const busy: GameState = { ...state, labour: { ...state.labour!, idle: 0 } };
  assert.equal(idleLabourCause(busy), null);
  assert.equal(settlementGuidance(busy).idleLine, null);
  const rows = householdLabourRows(state, cause!.sources[0]!.id);
  assert.match(rows[0]!, /^성인 \d+/);
  assert.equal(rows[1], HOUSEHOLD_LABOUR_COPY.householdProductionNone);
});

test("L9 LB-8 crafts load (none yet), slots derive by level and household stock saves and moves by process delivery", () => {
  assert.equal(CRAFT_DEFINITIONS.length, 0, "C4 adds brew_ale");
  assert.deepEqual([0, 1, 2, 3, 4].map(householdSlotCount), [0, 1, 1, 2, 2]);
  const sample = { id: "sample_craft", name: "시험 공정", levels: [1, 2], workers: 1, input: { wheat: 2 }, output: { bread: 1 }, ticksPerBatch: 40 };
  assert.deepEqual(loadCraftDefinitions([sample]).map(craft => craft.id), ["sample_craft"]);
  assert.throws(() => parseCraftDefinition({ ...sample, workers: 0 }), /sample_craft: invalid workers/);
  assert.throws(() => loadCraftDefinitions([sample, sample]), /defined twice/);
  const slot = { craftId: "sample_craft", workers: 1, input: { wheat: 2 }, output: { bread: 1 }, stock: { bread: 5 } };
  const from: House = { ...house("h1", 6, 2), crafts: [slot] };
  const to: House = { ...house("h2", 6, 2), crafts: [{ ...slot, input: { bread: 1 }, stock: {} }] };
  const state = { ...stateFromSave("fixtures/saves/v10/new-game.save.json"), houses: [from, to] };
  const loaded = decodeSave(encodeSave({ state, ...TIMES }).bytes).envelope.state;
  assert.deepEqual(loaded.houses[0]?.crafts, [slot]);
  assert.deepEqual(householdSlots(loaded.houses[0]!).map(entry => entry.craftId), ["sample_craft"]);
  const moved = processDelivery(loaded.houses, { fromHouseId: "h1", slotIndex: 0, to: { kind: "house", houseId: "h2" }, resource: "bread", amount: 3 });
  assert.equal(moved.moved, 3);
  assert.deepEqual([moved.houses[0]?.crafts?.[0]?.stock, moved.houses[1]?.crafts?.[0]?.stock], [{ bread: 2 }, { bread: 3 }]);
  assert.equal(processDelivery(loaded.houses, { fromHouseId: "h1", slotIndex: 0, to: { kind: "house", houseId: "h2" }, resource: "wheat", amount: 3 }).moved, 0);
});

test("L10 LB-10 a v10 save migrates: members are seeded, population and residents stay", () => {
  const manifest = JSON.parse(readFileSync("fixtures/saves/v10/manifest.json", "utf8")) as { fixtures: { file: string }[] };
  assert.ok(SAVE_SCHEMA_VERSION >= 11);
  for (const { file } of manifest.fixtures) {
    const raw = JSON.parse(readFileSync(`fixtures/saves/v10/${file}`, "utf8")) as { state: GameState };
    const migrated = migrateSaveToLatest(raw);
    assert.equal(migrated.fromVersion, 10);
    const state = (migrated.value as { state: GameState }).state;
    assert.equal(state.population, raw.state.population, file);
    assert.deepEqual(state.houses.map(entry => entry.residents), raw.state.houses.map(entry => entry.residents), file);
    assert.ok(state.houses.every(entry => entry.members !== undefined), file);
    assert.equal(adultsOf(state.houses), availableWorkers(residentsOf(state.houses)), file);
    assert.deepEqual(decodeSave(encodeSave({ state, ...TIMES }).bytes).envelope.state.houses, state.houses, `${file} round trip`);
  }
});


test("LB-11 behind a wall autoplay puts a sawmill outside it when a site exists, else searches as before", async () => {
  const { autoplayBuildAction } = await import("../src/engine/autoplay");
  const { footprintCorners, isPointInsidePalisade } = await import("../src/world/palisadeGeometry");
  const base = stateFromSave("fixtures/saves/v10/palisade-construction.save.json");
  assert.ok(base.palisade !== null, "the fixture has a proclaimed palisade");
  const inside = (polygon: NonNullable<GameState["palisade"]>["polygon"], kind: "sawmill" | "storehouse", tx: number, ty: number) =>
    footprintCorners({ id: kind, tx, ty, width: BUILDING_CONFIG_BY_KIND[kind].width, height: BUILDING_CONFIG_BY_KIND[kind].height })
      .every(corner => isPointInsidePalisade(corner, polygon));
  // Its real wall encloses every road, so there is no outside site yet: the search falls back to the old one.
  const fallback = autoplayBuildAction(base, "sawmill");
  assert.ok(fallback.kind === "place_building" && inside(base.palisade!.polygon, "sawmill", fallback.tx, fallback.ty));
  // A wall line around that first choice's row leaves the other routed sites (two rows down) outside it: one of those
  // is taken instead.
  const polygon = [{ x: fallback.tx - 2, y: fallback.ty - 1 }, { x: fallback.tx + 3, y: fallback.ty - 1 },
    { x: fallback.tx + 3, y: fallback.ty + 1 }, { x: fallback.tx - 2, y: fallback.ty + 1 }, { x: fallback.tx - 2, y: fallback.ty - 1 }];
  const walled: GameState = { ...base, palisade: { ...base.palisade!, polygon } };
  const action = autoplayBuildAction(walled, "sawmill");
  assert.ok(action.kind === "place_building", "a sawmill site");
  assert.equal(inside(polygon, "sawmill", action.tx, action.ty), false, `sawmill at ${action.tx},${action.ty}`);
  assert.notDeepEqual([action.tx, action.ty], [fallback.tx, fallback.ty]);
});


test("LB-12 autoplay proclaims the palisade with a wall of six cells per wanted lot when one exists, else as before", async () => {
  const { autoplayEraAction, wallInteriorCells } = await import("../src/engine/autoplayEra");
  const { confirmPalisadeProclamation } = await import("../src/engine/palisade");
  const { runAutoplaySearch } = await import("../src/engine/autoplaySearchBudget");
  // The 176-resident hamlet meets every palisade requirement once it has the timber.
  const state = { ...stateFromSave("fixtures/saves/v10/population-176.save.json"), treasuryTimber: 600 };
  const noBuild = () => ({ kind: "none" } as const);
  const cellsOf = (action: ReturnType<typeof autoplayEraAction>) => {
    assert.ok(action.kind === "proclaim_era" && action.candidatePath !== undefined);
    return wallInteriorCells(confirmPalisadeProclamation(state, action.candidatePath!));
  };
  const { housingLotCount } = await import("../src/population/housing");
  const { wallRoom } = await import("../src/engine/autoplayWallRoom");
  const first = cellsOf(runAutoplaySearch(() => autoplayEraAction(state, noBuild)));
  const lots = housingLotCount(state);
  // A target the hamlet already has keeps the first wall (BOT-2 AR-11 checks room only for lots still wanted).
  assert.equal(cellsOf(runAutoplaySearch(() => autoplayEraAction(state, noBuild, lots))), first);
  // More lots wanted: the wall taken has room for them (six cells per lot and, AR-11, free house cells per lot still
  // wanted with roads at most 30 %), stretched toward open land if need be — never a smaller wall.
  for (const target of [Math.floor(first / LABOUR_BALANCE.wallCellsPerLot), lots + 5]) {
    const action = runAutoplaySearch(() => autoplayEraAction(state, noBuild, target));
    assert.ok(cellsOf(action) >= first);
    assert.ok(action.kind === "proclaim_era" && wallRoom(state, action.candidatePath!, target - lots).roomy, `target ${target}`);
  }
  // No candidate holds 60 lots: the advisor still proclaims with the first acceptable wall (it never waits on room).
  assert.equal(cellsOf(runAutoplaySearch(() => autoplayEraAction(state, noBuild, 60))), first);
});
