import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { ARABLE_CONFIG } from "../src/content/arableConfig";
import { DEARTH_REHEARSAL_EVENT_ID, EVENT_DEF_BY_ID, FIRE_CONFIG, FIRST_FIRE_EVENT_ID, WEATHER_TABLE } from "../src/content/eventConfig";
import { constructionStage, isBuildingConstructionSite } from "../src/economy/construction";
import { completeEligibleConstruction } from "../src/engine/constructionLifecycle";
import type { GameState } from "../src/engine/engine.types";
import {
  dearthWindow,
  eventForecast,
  eventInstanceId,
  foodPricePermille,
  harvestYieldPermille,
  scheduledSeason,
  scheduledYear,
  weatherAt,
  weatherOfSeason,
} from "../src/engine/eventSchedule";
import { advanceEvents, eventEffectRegistry, fireIgnitionFrom, foodPriceSource, houseEventCauses } from "../src/engine/events";
import { fireIgnitionCandidates, rebuildBurntHouse, stepFires } from "../src/engine/fire";
import { marketSalePrice } from "../src/engine/marketSettlement";
import { settleMoneyPeriod } from "../src/engine/moneyRules";
import { advanceSeasons } from "../src/engine/seasonPressure";
import { advanceTick } from "../src/engine/tick";
import { LEDGER_PERIOD_TICKS } from "../src/ledger/ledger";
import type { House } from "../src/population/population.types";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { stepArableFields } from "../src/zones/arableFields";

// F0-B event scenarios (spec docs/design/flow-events.md EV-1…EV-9), work order E1–E10.

const SEASON = 1000;
const YEAR = 4000;
const FIRST_FIRE = EVENT_DEF_BY_ID.get(FIRST_FIRE_EVENT_ID)!;
const REHEARSAL = EVENT_DEF_BY_ID.get(DEARTH_REHEARSAL_EVENT_ID)!;

function town(): GameState {
  return decodeSave(new Uint8Array(readFileSync("fixtures/saves/v12/population-176.save.json"))).envelope.state as GameState;
}

function building(id: string, kind: Building["kind"], tx: number, ty: number): Building {
  return { id, kind, tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

function home(id: string, hasWater: boolean): House {
  return { buildingId: id, level: 2, builtLevel: 2, residents: 4, hasWater, breadStock: 3, lastServicedTick: 0, unmetRequirementTicks: 0 };
}

/**
 * The opening village plus a street of 1×1 houses at y = 20 (x listed) and wells, far from the opening well (45,41).
 * A household within a listed well's service radius draws its water. Seed 1 unless given.
 */
function street(xs: readonly number[], wells: readonly number[] = [], seed = 1, tick = 0): GameState {
  const houses = xs.map(x => building(`house-${x}-20`, "house", x, 20));
  const wellBuildings = wells.map(x => building(`well-${x}-20`, "well", x, 20));
  const radius = BUILDING_CONFIG_BY_KIND.well.serviceRadius;
  return { ...DEFAULT_GAME_STATE, seed, tick, buildings: [...DEFAULT_GAME_STATE.buildings, ...houses, ...wellBuildings],
    houses: [...DEFAULT_GAME_STATE.houses, ...houses.map(house => home(house.id, wells.some(well => Math.abs(well - house.tx) <= radius)))] };
}

/** A state without the saved season and event state (a fresh start for `advanceSeasons` at an earlier tick). */
function fresh(state: GameState): GameState {
  const { seasons: _seasons, events: _events, ...rest } = state;
  return rest;
}

/** Sets a house alight at `tick` (as ignition would), then runs `stepFires` until every fire is out. */
function burnOut(state: GameState, id: string, tick: number): GameState {
  const doused = state.houses.some(house => house.buildingId === id && house.hasWater && house.residents > 0);
  let current: GameState = { ...state, tick, events: { records: [], burning: [{ buildingId: id, eventId: "first_fire@test", ignitedTick: tick,
    outTick: tick + (doused ? FIRE_CONFIG.dousedBurnTicks : FIRE_CONFIG.burnTicks), doused }] } };
  while ((current.events?.burning.length ?? 0) > 0) current = stepFires({ ...current, tick: current.tick + 1 }).state;
  return current;
}

const burntIds = (state: GameState) => state.houses.filter(house => house.burntTick !== undefined).map(house => house.buildingId).sort();

/** Seasons and events at every 50th tick from `from` to `to` (the ladder's samples), the rest of the town standing still. */
function eventSamples(state: GameState, from: number, to: number): GameState {
  let current: GameState = { ...state, tick: from };
  for (let tick = from; tick <= to; tick += 50) current = advanceEvents(advanceSeasons({ ...current, tick }));
  return current;
}

test("E1 the forecast ladder: rumour three seasons before the dearth, sign one season before, arrival, recovery, done", () => {
  const state = fresh(town());
  const season = scheduledSeason(state, REHEARSAL)!;
  const id = eventInstanceId(REHEARSAL, season);
  const stageAt = (current: GameState) => eventForecast(current).find(entry => entry.id === id)?.stage ?? null;
  assert.equal(stageAt({ ...state, tick: (season - 4) * SEASON }), null, "not yet rumoured");
  assert.equal(stageAt({ ...state, tick: (season - 3) * SEASON }), "rumour");
  assert.equal(stageAt({ ...state, tick: (season - 2) * SEASON + 999 }), "rumour");
  assert.equal(stageAt({ ...state, tick: (season - 1) * SEASON }), "sign");
  const window = dearthWindow(REHEARSAL, season);
  const arrived = eventSamples(state, (season - 1) * SEASON, window.arrivalTick);
  assert.equal(arrived.events!.records.find(record => record.id === id)?.arrivalTick, window.arrivalTick);
  assert.equal(stageAt(arrived), "arrival");
  const ended = eventSamples(arrived, window.arrivalTick + 50, window.endTick);
  assert.equal(stageAt(ended), "recovery");
  assert.equal(ended.events!.records.find(record => record.id === id)!.recoveryUntilTick, window.endTick + REHEARSAL.recoverySeasons * SEASON);
  const done = eventSamples(ended, window.endTick + 50, window.endTick + REHEARSAL.recoverySeasons * SEASON);
  assert.equal(stageAt(done), null, "done events leave the forecast");
});

test("E2 the weather is the seed's: the same seed gives the same seasons, forced summers hold, the windows hold", () => {
  const seasons = Array.from({ length: 80 }, (_, index) => index);
  const years: { fire: number; dearth: number }[] = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const state = { ...DEFAULT_GAME_STATE, seed };
    const a = seasons.map(index => weatherOfSeason(state, index));
    const b = seasons.map(index => weatherOfSeason(structuredClone(state), index));
    assert.deepEqual(b, a, `seed ${seed} repeats`);
    const forced = new Set([FIRST_FIRE, REHEARSAL].flatMap(def => [scheduledSeason(state, def)!, scheduledSeason(state, def)! - 1]));
    a.forEach((kind, index) => assert.ok(forced.has(index) || WEATHER_TABLE[index % 4]!.some(([allowed]) => allowed === kind), `${kind} in season ${index % 4}`));
    const fire = scheduledYear(state, FIRST_FIRE)!;
    const dearth = scheduledYear(state, REHEARSAL)!;
    assert.ok(fire >= 1301 && fire <= 1303, `first fire 1302 ± 1 (${fire})`);
    assert.ok(dearth >= 1302 && dearth <= 1304 && dearth > fire, `dearth 1303 ± 1 after the fire (${dearth})`);
    assert.equal(a[scheduledSeason(state, FIRST_FIRE)!], "dry");
    assert.equal(a[scheduledSeason(state, FIRST_FIRE)! - 1], "dry", "the dry spring is the fire's sign");
    assert.equal(a[scheduledSeason(state, REHEARSAL)!], "wet");
    assert.equal(a[scheduledSeason(state, REHEARSAL)! - 1], "wet", "the wet spring is the dearth's sign");
    years.push({ fire, dearth });
    assert.deepEqual(weatherAt({ ...state, tick: 12_345 }), { kind: a[12]!, seasonIndex: 12 });
  }
  const first = seasons.map(index => weatherOfSeason({ ...DEFAULT_GAME_STATE, seed: 1 }, index));
  const second = seasons.map(index => weatherOfSeason({ ...DEFAULT_GAME_STATE, seed: 2 }, index));
  assert.notDeepEqual(second, first, "seeds differ");
});

test("E3 a fire starts only in dense thatch away from wells, on its dry summer; where it can spread first", () => {
  const onStreet = (state: GameState) => fireIgnitionCandidates(state).map(candidate => candidate.building.id).filter(id => id.endsWith("-20"));
  assert.deepEqual(onStreet(street([10, 13])), [], "two houses are not dense thatch");
  assert.deepEqual(onStreet(street([10, 11, 12])), ["house-11-20", "house-10-20", "house-12-20"], "most touching first");
  assert.deepEqual(onStreet(street([10, 12, 14])), ["house-12-20"], "a lane between houses is still dense");
  assert.deepEqual(onStreet(street([10, 11, 12], [13])), ["house-11-20", "house-10-20"], "a house touching a well is watched");
  assert.deepEqual(fireIgnitionCandidates(street([10, 11, 12])).slice(0, 3).map(candidate => candidate.building.id), ["house-11-20", "house-10-20", "house-12-20"],
    "a touching row goes before the opening village (houses a lane apart)");
  const lone = street([10]);
  const row = street([10, 11, 12]);

  const season = scheduledSeason(row, FIRST_FIRE)!;
  const id = eventInstanceId(FIRST_FIRE, season);
  const from = fireIgnitionFrom(row, id, season);
  assert.ok(from >= season * SEASON && from < season * SEASON + SEASON / 2);
  assert.equal(advanceEvents({ ...row, tick: from - FIRE_CONFIG.ignitionStepTicks }).events?.burning.length ?? 0, 0, "not before its time");
  const lit = advanceEvents({ ...row, tick: from });
  assert.equal(lit.events!.burning.length, 1);
  const record = lit.events!.records.find(entry => entry.id === id)!;
  assert.equal(record.arrivalTick, from);
  assert.ok(["house-10-20", "house-11-20", "house-12-20"].includes(record.originBuildingId!));
  assert.equal(weatherAt(lit).kind, "dry");
  const none = { ...lone, houses: lone.houses.filter(house => house.buildingId.endsWith("-20")),
    buildings: lone.buildings.filter(entry => entry.kind !== "house" || entry.id.endsWith("-20")) };
  assert.equal(advanceEvents({ ...none, tick: from }).events?.burning.length ?? 0, 0, "no candidate, no fire");
  const missed = advanceEvents({ ...none, tick: (season + 1) * SEASON });
  assert.deepEqual(missed.events!.missed, [id], "a summer without a house to catch is missed");
});

test("E4 a fire spreads along touching thatch and stops at an empty tile and at a well", () => {
  let spread = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const gap = burnOut(street([10, 11, 12, 14, 15], [], seed, 5_000), "house-10-20", 5_000);
    assert.ok(!burntIds(gap).includes("house-14-20") && !burntIds(gap).includes("house-15-20"), `seed ${seed}: the empty tile at x 13 stops it`);
    const well = burnOut(street([30, 31, 33, 34], [32], seed, 5_000), "house-30-20", 5_000);
    assert.ok(!burntIds(well).includes("house-33-20") && !burntIds(well).includes("house-34-20"), `seed ${seed}: the well at x 32 stops it`);
    if (burntIds(gap).includes("house-11-20")) spread += 1;
  }
  assert.ok(spread >= 6, `a dry-summer fire far from water reaches its neighbour in most seeds (${spread}/12)`);
});

test("E5 households with a well's water douse a fire: shorter burn and fewer neighbours caught", () => {
  const tick = 5_000;
  const far = street([10, 11]);
  const near = street([10, 11], [16]);
  let farCaught = 0;
  let nearCaught = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    if (burntIds(burnOut({ ...far, seed }, "house-10-20", tick)).includes("house-11-20")) farCaught += 1;
    if (burntIds(burnOut({ ...near, seed }, "house-10-20", tick)).includes("house-11-20")) nearCaught += 1;
  }
  assert.ok(nearCaught < farCaught / 2, `doused ${nearCaught}/40 vs undoused ${farCaught}/40`);
  const doused = burnOut(near, "house-10-20", tick);
  const burntAt = doused.houses.find(house => house.buildingId === "house-10-20")!.burntTick!;
  assert.equal(burntAt, tick + FIRE_CONFIG.dousedBurnTicks, "put out after the doused burn");
  const undoused = burnOut(far, "house-10-20", tick);
  assert.equal(undoused.houses.find(house => house.buildingId === "house-10-20")!.burntTick, tick + FIRE_CONFIG.burnTicks);
});

test("E6 a burnt house keeps its household, loses its level and rent, and is rebuilt from stage 2", () => {
  const before = street([10, 11]);
  const burnt = burnOut(before, "house-10-20", 5_000);
  const house = burnt.houses.find(entry => entry.buildingId === "house-10-20")!;
  assert.equal(house.residents, 4, "not a departure");
  assert.equal(house.level, 0);
  assert.equal(house.breadStock, 0);
  assert.deepEqual(houseEventCauses(burnt, "house-10-20"), [{ type: "event", id: "first_fire@test", detail: "burnt" }]);
  const period = settleMoneyPeriod({ ...burnt, tick: LEDGER_PERIOD_TICKS * 3 });
  const rents = (period.ledger?.entries ?? []).filter(entry => entry.category === "rent").map(entry => entry.sourceRefs[0]?.id);
  assert.ok(!rents.includes("house-10-20") && rents.includes("house-11-20"), "a burnt house pays no rent");

  const rebuilding = rebuildBurntHouse(burnt, "house-10-20");
  const site = rebuilding.constructionSites.find(entry => isBuildingConstructionSite(entry) && entry.rebuildOf === "house-10-20")!;
  assert.ok(site !== undefined && isBuildingConstructionSite(site));
  assert.equal(constructionStage(site), "foundation", "stage 2");
  const cost = BUILDING_CONFIG_BY_KIND.house.buildCost;
  for (const [resource, amount] of Object.entries(cost)) assert.equal(site.required[resource as keyof typeof cost], Math.ceil((amount ?? 0) * 0.75));
  assert.equal(rebuildBurntHouse(rebuilding, "house-10-20"), rebuilding, "one rebuild at a time");
  assert.equal(rebuildBurntHouse(before, "house-10-20"), before, "only burnt houses");

  const finished: GameState = { ...rebuilding, wallTick: rebuilding.wallTick + 1_000, constructionSites: rebuilding.constructionSites.map(entry =>
    entry.id === site.id ? { ...entry, delivered: { ...entry.required }, builderTicks: entry.requiredBuilderTicks } : entry) };
  const done = completeEligibleConstruction(finished);
  const rebuilt = done.houses.find(entry => entry.buildingId === "house-10-20")!;
  assert.equal(rebuilt.burntTick, undefined);
  assert.equal(rebuilt.residents, 4);
  assert.equal(done.buildings.length, finished.buildings.length, "no new building");
  assert.equal(done.houses.length, finished.houses.length);
  assert.ok(!done.constructionSites.some(entry => entry.id === site.id));
});

test("E7 the rehearsal's wet summer brings in 70 % of the crop; other years bring 100 % (90 % in a wet summer)", () => {
  const state = town();
  const season = scheduledSeason(state, REHEARSAL)!;
  const year = Math.floor(season / 4);
  assert.equal(harvestYieldPermille(state, year * YEAR + 2_000), 700);
  for (let other = 0; other < 20; other += 1) {
    if (other === year) continue;
    const expected = weatherOfSeason(state, other * 4 + 1) === "wet" ? 900 : 1000;
    assert.equal(harvestYieldPermille(state, other * YEAR + 2_000), expected, `year ${1300 + other}`);
  }
  // A ripe strip one worker-tick from harvest: the barn gets 70 % of what it grew in the rehearsal year.
  const field = state.arableFields!.find(entry => entry.strips.length > 0)!;
  const strip = field.strips[0]!;
  const barn = state.buildings.find(entry => entry.kind === "farmstead")!;
  const ripe = (tick: number): GameState => ({ ...state, tick,
    buildings: state.buildings.map(entry => entry.id === barn.id ? { ...entry, workers: 4, inventory: {} } : entry.kind === "farmstead" ? { ...entry, workers: 0 } : entry),
    arableFields: state.arableFields!.map(entry => entry !== field ? { ...entry, strips: entry.strips.map(record => ({ ...record, stage: "fallow" as const })) }
      : { ...entry, strips: entry.strips.map((record, index) => index === 0
        ? { ...record, stage: "ripe" as const, completionPermille: 1000, stageTick: tick - 10, work: record.cells * ARABLE_CONFIG.workPerCell.harvest - 1 }
        : { ...record, stage: "fallow" as const }) }) });
  const normalYear = [year - 1, year + 1, year + 2].find(other => harvestYieldPermille(state, other * YEAR + 2_000) === 1000)!;
  const normal = stepArableFields(ripe(normalYear * YEAR + 2_000));
  const dearth = stepArableFields(ripe(year * YEAR + 2_000));
  const grown = normal.activity.harvestedWheat;
  assert.ok(grown > 0, `the strip ${strip.id} is harvested`);
  assert.equal(dearth.activity.harvestedWheat, Math.floor(grown * 0.7));
  assert.equal(dearth.activity.weatherLostWheat, grown - Math.floor(grown * 0.7));
});

test("E8 the rehearsal raises bread and wheat × 1.5 at market from its summer to the next harvest", () => {
  const state = town();
  const season = scheduledSeason(state, REHEARSAL)!;
  const window = dearthWindow(REHEARSAL, season);
  assert.equal(foodPricePermille(state, window.arrivalTick - 1), 1000);
  assert.equal(foodPricePermille(state, window.arrivalTick), 1500);
  assert.equal(foodPricePermille(state, window.endTick - 1), 1500);
  assert.equal(foodPricePermille(state, window.endTick), 1000);
  assert.equal(window.endTick, (Math.floor(season / 4) + 1) * YEAR + ARABLE_CONFIG.growTicks, "the next harvest");
  assert.equal(marketSalePrice({ ...state, tick: window.arrivalTick }, "wheat"), 3, "wheat 2 → 3");
  assert.equal(marketSalePrice({ ...state, tick: window.arrivalTick }, "bread"), 8, "bread 5 → 7.5, a whole penny");
  assert.equal(marketSalePrice({ ...state, tick: window.arrivalTick }, "timber"), 6, "other goods keep their price");
  assert.equal(marketSalePrice({ ...state, tick: window.arrivalTick - 1 }, "bread"), 5);
  const arrived = advanceEvents({ ...fresh(state), tick: window.arrivalTick });
  assert.deepEqual(foodPriceSource(arrived), { type: "event", id: eventInstanceId(REHEARSAL, season), detail: "food_price" });
  const effects = eventEffectRegistry(arrived).active(window.arrivalTick);
  assert.deepEqual(effects.map(effect => effect.spec), REHEARSAL.effects, "the B1 pipe carries the event's effects");
  assert.ok(effects.every(effect => effect.source.type === "event"));
});

test("E9 the season ledger records the rumour, the sign, the arrival and the recovery with its losses", () => {
  const state = fresh(town());
  const season = scheduledSeason(state, REHEARSAL)!;
  const window = dearthWindow(REHEARSAL, season);
  const id = eventInstanceId(REHEARSAL, season);
  const rumoured = eventSamples(state, (season - 3) * SEASON, (season - 2) * SEASON);
  const rumourSeason = rumoured.seasons!.history.at(-1)!;
  assert.deepEqual(rumourSeason.notableEvents.filter(event => event.kind.startsWith("event_")), [{ kind: "event_rumour", eventId: id, defId: REHEARSAL.id }]);
  assert.equal(rumourSeason.nextObjectiveHint === "dearth_reserve" || rumourSeason.nextObjectiveHint === "food_reserve" || rumourSeason.nextObjectiveHint === "harvest_reserve", true);
  // A settled, well-fed town during the rumour: the card's hint is to stock up.
  const granary = state.buildings.find(entry => entry.kind === "granary")!;
  const fed: GameState = { ...state, tick: (season - 3) * SEASON + 500, houses: state.houses.map(house => ({ ...house, breadStock: 6 })),
    buildings: state.buildings.map(entry => entry === granary ? { ...entry, inventory: { ...entry.inventory, bread: 8_000 } } : entry) };
  const fedClosed = eventSamples(fed, (season - 3) * SEASON + 500, (season - 2) * SEASON);
  assert.equal(fedClosed.seasons!.history.at(-1)!.nextObjectiveHint, "dearth_reserve");
  const through = eventSamples(rumoured, (season - 2) * SEASON + 50, window.endTick + REHEARSAL.recoverySeasons * SEASON + SEASON);
  const lines = through.seasons!.history.flatMap(ledger => ledger.notableEvents).filter(event => event.kind.startsWith("event_"));
  const kinds = lines.filter(event => "eventId" in event && event.eventId === id).map(event => event.kind);
  assert.ok(kinds.includes("event_sign") && kinds.includes("event_arrived") && kinds.includes("event_recovered"), kinds.join(","));
  const recovered = lines.find(event => event.kind === "event_recovered" && event.eventId === id);
  assert.ok(recovered !== undefined && recovered.kind === "event_recovered");
  assert.deepEqual(recovered.losses, through.events!.records.find(record => record.id === id)!.losses);
});

test("E10 a town mid-fire and mid-dearth round-trips through save v13 and runs on identically; a v12 save is promoted", () => {
  const season = scheduledSeason(DEFAULT_GAME_STATE, REHEARSAL)!;
  const window = dearthWindow(REHEARSAL, season);
  const arriving = advanceEvents(street([10, 11, 12], [], 1, window.arrivalTick + 10));
  const target = arriving.buildings.find(entry => entry.id === "house-11-20")!;
  const burning: GameState = { ...arriving, events: { ...arriving.events!, burning: [{ buildingId: target.id, eventId: "fire@test", ignitedTick: arriving.tick, outTick: arriving.tick + 150, doused: false }] } };
  const loaded = decodeSave(encodeSave({ state: burning, createdAt: "2026-09-26T00:00:00.000Z", savedAt: "2026-09-26T00:00:00.000Z" }).bytes);
  assert.equal(loaded.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(SAVE_SCHEMA_VERSION, 13);
  assert.deepEqual(loaded.envelope.state, burning);
  let a: GameState = burning;
  let b: GameState = loaded.envelope.state as GameState;
  let c: GameState = structuredClone(burning);
  for (let step = 0; step < 400; step += 1) { a = advanceTick(a); b = advanceTick(b); c = advanceTick(c); }
  const { pathCache: _a, ...restA } = a;
  const { pathCache: _b, ...restB } = b;
  const { pathCache: _c, ...restC } = c;
  assert.deepEqual(restB, restA);
  assert.deepEqual(restC, restA);
  assert.ok(a.houses.find(house => house.buildingId === target.id)!.burntTick !== undefined, "the fire went on after loading");
  assert.equal(a.events!.records.find(record => record.defId === REHEARSAL.id)?.endTick, undefined, "the dearth is still arriving");

  const promoted = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v12/population-176.save.json")));
  assert.equal(promoted.migratedFrom, 12);
  assert.equal(promoted.envelope.schemaVersion, 13);
  const next = advanceTick(promoted.envelope.state as GameState);
  assert.deepEqual(next.events?.burning ?? [], []);
});
