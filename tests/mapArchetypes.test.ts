/**
 * ARCH-1 map archetypes (spec docs/design/map-archetypes.md MA-1…MA-6): five lands, their deterministic maps with the
 * same town site, their resources, their five coefficients where the rules read them, their art keys (Wave 22, 28, 29
 * confirmed files) and the new game's command. The bot's chapter 1 on each land is `scripts/archetypeChapterOne.ts`
 * (gate ①, DGX), the human path `humanPathArchetypes.test.ts` (gate ③).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { CLOTH_BALANCE } from "../src/content/clothConfig";
import { WET_SUMMER_HARVEST_PERMILLE } from "../src/content/eventConfig";
import {
  COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, FEN_ARCHETYPE_ID, MAP_ARCHETYPE_IDS, MAP_ARCHETYPES, RIVERSIDE_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID,
} from "../src/content/scenario/archetypes";
import { DEFAULT_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { SCENARIOS } from "../src/content/scenario/registry";
import { SCENARIO_COPY } from "../src/content/scenario/scenarioCopy.ko";
import type { TerrainType } from "../src/content/terrainConfig";
import { archetypeProductionDefinition, archetypeRules, stateArchetype } from "../src/engine/archetype";
import { advanceCloth, pastoralFieldNeed } from "../src/engine/cloth";
import type { GameState } from "../src/engine/engine.types";
import { harvestYieldPermille, weatherOfSeason } from "../src/engine/eventSchedule";
import { arrivalSeasonOffset, plagueCoastal } from "../src/engine/plague";
import { advanceTick } from "../src/engine/tick";
import { raidLosses, warCoastal } from "../src/engine/war";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import { mapArchetypes, newGameState } from "../src/state/newGame";
import { stepArableFields } from "../src/zones/arableFields";
import { archetypeGroundLayer } from "../src/world/archetypeGround";
import { archetypeTerrains, buildArchetypeWorld, coastSeaEdge, TOWN_SITE } from "../src/world/archetypeTerrain";
import { buildWorldGrid } from "../src/world/terrain";
import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { terrainResourcePreflight } from "../scripts/phase19NaturalGrowth";
import { clothTown } from "./helpers/clothTown";
import { PLAGUE_ERA_TICK, plagueTown } from "./helpers/plagueTown";

const SIZE = { width: 64, height: 64 };
const NEW_LANDS = [COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID, FEN_ARCHETYPE_ID] as const;
const byId = (id: string) => MAP_ARCHETYPES.find(archetype => archetype.id === id)!;
const share = (terrains: readonly TerrainType[], terrain: TerrainType) => terrains.filter(entry => entry === terrain).length * 1000 / terrains.length;
const on = (state: GameState, archetypeId: string): GameState => ({ ...state, archetypeId });
const loadSave = (name: string) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v32/${name}.save.json`))).envelope.state as GameState;

test("MA-1 five lands in the start screen's order: the riverside town (the open field, every coefficient 1,000) first; the harbour and the river's mouth coastal", () => {
  assert.deepEqual(MAP_ARCHETYPE_IDS, [RIVERSIDE_ARCHETYPE_ID, COASTAL_ARCHETYPE_ID, DOWNS_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID, FEN_ARCHETYPE_ID]);
  assert.deepEqual(mapArchetypes().map(archetype => archetype.id), MAP_ARCHETYPE_IDS);
  assert.equal(RIVERSIDE_ARCHETYPE_ID, SCENARIOS.get(DEFAULT_SCENARIO_ID)!.archetype, "the campaign's land is still the open field");
  assert.deepEqual(Object.values(byId(RIVERSIDE_ARCHETYPE_ID).rules), [1000, 1000, 1000, 1000, 1000, 1000]);
  assert.deepEqual(MAP_ARCHETYPES.map(archetype => archetype.coastal === true), [true, true, false, false, false]);
  for (const archetype of MAP_ARCHETYPES) {
    const copy = SCENARIO_COPY.archetypes[archetype.id.split(":")[1] as keyof typeof SCENARIO_COPY.archetypes];
    assert.ok(copy.name.length > 0 && copy.description.length > 0, archetype.id);
  }
  // A state without a land reads the open field; an older save has no land.
  assert.equal(stateArchetype(DEFAULT_GAME_STATE)!.id, RIVERSIDE_ARCHETYPE_ID);
  assert.equal(DEFAULT_GAME_STATE.archetypeId, undefined);
});

test("MA-2 ① MA-9 the riverside town's map is the open field's with its river carved across it; a new land's is deterministic in (land, seed) and differs by seed and by land", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const world = buildArchetypeWorld(byId(RIVERSIDE_ARCHETYPE_ID), { ...SIZE, seed });
    const open = buildWorldGrid({ ...SIZE, seed }).tiles.map(tile => tile.terrain);
    const channel = new Set(world.river!.cells);
    const changed = world.terrains.flatMap((terrain, index) => terrain === open[index] ? [] : [index]);
    assert.deepEqual(changed.filter(index => !channel.has(index)), [], `seed ${seed}: only the channel differs`);
    assert.ok(world.river!.cells.every(index => world.terrains[index] === "water"));
  }
  for (const id of NEW_LANDS) {
    const first = archetypeTerrains(byId(id), { ...SIZE, seed: 2 });
    assert.deepEqual(archetypeTerrains(byId(id), { ...SIZE, seed: 2 }), first, `${id} repeats`);
    assert.notDeepEqual(archetypeTerrains(byId(id), { ...SIZE, seed: 3 }), first, `${id} seed 3 differs`);
    for (const other of NEW_LANDS.filter(entry => entry !== id)) assert.notDeepEqual(archetypeTerrains(byId(other), { ...SIZE, seed: 2 }), first);
  }
});

test("MA-2 ② every new land's town site is open ground with the camp's copse, and the opening village stands on it untranslated with its roads joined (seeds 1–5)", () => {
  for (const id of NEW_LANDS) for (const seed of [1, 2, 3, 4, 5]) {
    const terrains = archetypeTerrains(byId(id), { ...SIZE, seed });
    for (let ty = TOWN_SITE.minTy; ty <= TOWN_SITE.maxTy; ty += 1) for (let tx = TOWN_SITE.minTx; tx <= TOWN_SITE.maxTx; tx += 1) {
      assert.equal(terrains[ty * SIZE.width + tx], "grass", `${id} seed ${seed} site ${tx},${ty}`);
    }
    assert.equal(terrains[40 * SIZE.width + 51], "forest", `${id} seed ${seed}: the logging camp's neighbour`);
    // The verification opening's selection (legal footprints, roads joined to the granary) takes it where it is.
    const opening = createGrowthOpening(seed, id);
    assert.deepEqual(opening.provenance.offset, { tx: 0, ty: 0 }, `${id} seed ${seed}`);
    assert.equal(opening.state.archetypeId, id);
    const preflight = terrainResourcePreflight(opening.state);
    assert.ok(preflight.failures.length === 0 && preflight.legalQuarryFootprints > 0, `${id} seed ${seed}: a quarry can stand`);
  }
});

test("MA-2 ③ MA-3 the lands' resources: the harbour's sea on its north or west edge, the down's rock and little water, the forest's timber, the fen's meres", () => {
  // Still water and land: the river's channel (MA-9) is counted apart.
  const stillShare = (id: string, seed: number, terrain: TerrainType) => {
    const world = buildArchetypeWorld(byId(id), { ...SIZE, seed });
    const channel = new Set(world.river?.cells ?? []);
    return share(world.terrains.map((entry, index) => channel.has(index) ? "grass" : entry), terrain);
  };
  const mean = (id: string, terrain: TerrainType) => [1, 2, 3].reduce((sum, seed) => sum + stillShare(id, seed, terrain), 0) / 3;
  const open = (terrain: TerrainType) => [1, 2, 3].reduce((sum, seed) => sum + share(buildWorldGrid({ ...SIZE, seed }).tiles.map(tile => tile.terrain), terrain), 0) / 3;
  for (const seed of [1, 2, 3, 4, 5]) {
    const terrains = archetypeTerrains(byId(COASTAL_ARCHETYPE_ID), { ...SIZE, seed });
    const edge = coastSeaEdge(seed);
    const edgeCells = Array.from({ length: SIZE.width }, (_, along) => edge === "north" ? terrains[along]! : terrains[along * SIZE.width]!);
    assert.ok(edgeCells.every(terrain => terrain === "water"), `seed ${seed}: the sea along the ${edge} edge`);
  }
  assert.ok(mean(DOWNS_ARCHETYPE_ID, "rock") > 3 * open("rock") && mean(DOWNS_ARCHETYPE_ID, "water") < 20, "the down: chalk, and water scarce");
  assert.ok(mean(WOODLAND_ARCHETYPE_ID, "forest") > 1.5 * open("forest"), "the forest's edge: timber rich");
  assert.ok(mean(FEN_ARCHETYPE_ID, "water") > 2 * open("water"), "the fen: meres");
  assert.deepEqual(MAP_ARCHETYPES.map(archetype => archetype.resources.timber), ["normal", "scarce", "scarce", "rich", "scarce"]);
  assert.deepEqual(MAP_ARCHETYPES.map(archetype => archetype.resources.stone), ["normal", "normal", "rich", "normal", "scarce"]);
});

test("MA-4 ① the arable harvest by the land's coefficient: the down's strip brings less, the fen's more, the same strips the same season", () => {
  let state = loadSave("four-farms");
  let checked = 0;
  for (let step = 0; step < 8000 && checked < 3; step += 1) {
    const open = stepArableFields(state).activity.harvestedWheat;
    if (open > 0) {
      const downs = stepArableFields(on(state, DOWNS_ARCHETYPE_ID)).activity.harvestedWheat;
      const fen = stepArableFields(on(state, FEN_ARCHETYPE_ID)).activity.harvestedWheat;
      assert.ok(downs < open && downs >= Math.floor(open * 850 / 1000) - 3, `down ${downs} of ${open}`);
      assert.ok(fen > open && fen <= Math.ceil(open * 1150 / 1000), `fen ${fen} of ${open}`);
      checked += 1;
    }
    state = advanceTick(state);
  }
  assert.equal(checked, 3, "three harvest ticks compared");
});

test("MA-4 ② the pasture's clip by the land: the down's flocks give 1.3 times the fleece, the forest's 0.9", () => {
  const town = clothTown();
  const side = 6, x = 2, y = 50;
  const shearing = Math.ceil(town.tick / 4000) * 4000 + CLOTH_BALANCE.shearingInYearTick;
  const membership: number[] = [];
  for (let dy = 0; dy < side; dy += 1) for (let dx = 0; dx < side; dx += 1) membership.push((y + dy) * town.width + x + dx);
  const farm = { id: "test-pastoral_farm", kind: "pastoral_farm" as const, tx: x + side, ty: y, workers: 1, fieldHands: pastoralFieldNeed(side * side, shearing),
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
  const pasture: GameState = { ...town, tick: shearing, buildings: [...town.buildings, farm],
    zones: [...(town.zones ?? []).map(zone => ({ ...zone, membership: zone.membership.filter(index => !membership.includes(index)) })),
      { id: "zone-pasture-test", kind: "pasture" as const, strokes: [], membership: membership.sort((a, b) => a - b), createdOrdinal: 9999 }] };
  const fleece = (state: GameState) => advanceCloth(state).buildings.find(building => building.id === farm.id)!.inventory.fleece ?? 0;
  const open = fleece(pasture);
  assert.ok(open > 0);
  assert.equal(fleece(on(pasture, DOWNS_ARCHETYPE_ID)), Math.floor(open * 1300 / 1000));
  assert.equal(fleece(on(pasture, WOODLAND_ARCHETYPE_ID)), Math.floor(open * 900 / 1000));
});

test("MA-4 ③ the logging camp's pace by the land: the forest fells a log in 38 ticks, the fen in 63; the open field's definition is the config's own", () => {
  const camp = BUILDING_CONFIG_BY_KIND.logging_camp;
  assert.equal(archetypeProductionDefinition(DEFAULT_GAME_STATE, camp), camp);
  assert.equal(archetypeProductionDefinition(on(DEFAULT_GAME_STATE, WOODLAND_ARCHETYPE_ID), camp).production!.ticksPerOutput, Math.round(50 * 1000 / 1300));
  assert.equal(archetypeProductionDefinition(on(DEFAULT_GAME_STATE, FEN_ARCHETYPE_ID), camp).production!.ticksPerOutput, Math.round(50 * 1000 / 800));
  assert.equal(archetypeProductionDefinition(on(DEFAULT_GAME_STATE, WOODLAND_ARCHETYPE_ID), camp), archetypeProductionDefinition(on(DEFAULT_GAME_STATE, WOODLAND_ARCHETYPE_ID), camp), "one object per key");
  assert.equal(archetypeProductionDefinition(on(DEFAULT_GAME_STATE, WOODLAND_ARCHETYPE_ID), BUILDING_CONFIG_BY_KIND.sawmill), BUILDING_CONFIG_BY_KIND.sawmill, "the sawmill keeps its pace");
});

test("MA-4 ④ a wet summer floods by the land: the open field keeps 95 % of its harvest, the fen 87.5 %, the down 97 %", () => {
  const wet = Array.from({ length: 12 }, (_, year) => year).find(year =>
    weatherOfSeason(DEFAULT_GAME_STATE, year * 4 + 1) === "wet" && harvestYieldPermille(DEFAULT_GAME_STATE, year * 4000 + 2000) === WET_SUMMER_HARVEST_PERMILLE);
  assert.ok(wet !== undefined, "a plain wet summer in the first twelve years");
  const tick = wet * 4000 + 2000;
  assert.equal(harvestYieldPermille(on(DEFAULT_GAME_STATE, FEN_ARCHETYPE_ID), tick), 875);
  assert.equal(harvestYieldPermille(on(DEFAULT_GAME_STATE, DOWNS_ARCHETYPE_ID), tick), 970);
  assert.equal(harvestYieldPermille(on(DEFAULT_GAME_STATE, WOODLAND_ARCHETYPE_ID), tick), WET_SUMMER_HARVEST_PERMILLE);
});

test("MA-4 ⑤ the harbour's raid takes more houses and loot, its port fever more lives; the inland lands have neither the raid nor the early fever", () => {
  const town = loadSave("population-176");
  const open = raidLosses(town), harbour = raidLosses(on(town, COASTAL_ARCHETYPE_ID));
  assert.ok(harbour.burntHouses >= open.burntHouses && harbour.looted > open.looted, `${JSON.stringify(open)} → ${JSON.stringify(harbour)}`);
  for (const id of [DOWNS_ARCHETYPE_ID, WOODLAND_ARCHETYPE_ID, FEN_ARCHETYPE_ID]) {
    assert.equal(warCoastal(on(town, id)), false, id);
    assert.equal(plagueCoastal(on(town, id)), false, id);
  }
  const plague = plagueTown();
  const arrival = PLAGUE_ERA_TICK + arrivalSeasonOffset(plague) * 1000;
  const firstDeaths = (state: GameState) => { let next = state; while (next.tick <= arrival) next = advanceTick(next); return next.plague!.first!.deathPermille; };
  const riverside = firstDeaths(plague);
  assert.ok(riverside >= 420 && riverside <= 480);
  assert.equal(firstDeaths(on(plague, COASTAL_ARCHETYPE_ID)), Math.floor(riverside * archetypeRules(on(plague, COASTAL_ARCHETYPE_ID)).coastalEventPermille / 1000));
});

test("MA-13 the harbour's raid weighs 1.5 (houses and loot), its pestilence still 1.2; every other land 1,000", () => {
  const rules = (id: string) => MAP_ARCHETYPES.find(archetype => archetype.id === id)!.rules;
  assert.deepEqual([rules(COASTAL_ARCHETYPE_ID).coastalRaidPermille, rules(COASTAL_ARCHETYPE_ID).coastalEventPermille], [1500, 1200]);
  for (const archetype of MAP_ARCHETYPES) if (archetype.id !== COASTAL_ARCHETYPE_ID) assert.equal(archetype.rules.coastalRaidPermille, 1000, archetype.id);
  const town = loadSave("population-176");
  const open = raidLosses(town), harbour = raidLosses(on(town, COASTAL_ARCHETYPE_ID));
  const exposed = town.houses.filter(house => house.burntTick === undefined).length;
  assert.equal(harbour.burntHouses, Math.min(exposed, Math.round(open.burntHouses * 1.5)), `${open.burntHouses} → ${harbour.burntHouses}`);
});

test("MA-5 the ground layer names confirmed Wave 22 files; field edges are Wave 28's, water movement Wave 29's; each land has its own fill", () => {
  const ledger = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8").split("\n").filter(line => /^wave2[289],/.test(line) && line.includes(",confirmed,"));
  const confirmed = (wave: string, key: string) => ledger.some(line => line.startsWith(`${wave},`) && new RegExp(`/assets/${key}[-_.]`).test(line));
  const fills = new Set<string>();
  for (const archetype of MAP_ARCHETYPES) {
    const { state } = createGrowthOpening(1, archetype.id);
    const layer = archetypeGroundLayer(archetype, state.tiles.map(tile => tile.terrain), state.width, state.height, state.seed);
    for (const key of layer.keys.slice(1)) {
      if (key === "terrain/grass") continue;
      assert.ok(confirmed("wave22", key), `${archetype.id}: ${key}`);
    }
    fills.add(layer.keys[Math.max(...Array.from(layer.fill))]!);
    assert.ok(confirmed("wave28", archetype.ground.fieldBoundary === "hedgerow" ? "hedgerow_a" : "dry_stone_wall"), archetype.id);
    for (const key of archetype.ground.water) assert.ok(confirmed("wave29", key), `${archetype.id}: ${key}`);
    if (archetype.id !== RIVERSIDE_ARCHETYPE_ID) assert.ok(layer.decal.some(value => value !== 0), `${archetype.id} decals`);
    // Wave 22 has no woodland band: the forest's edge keeps today's forest border.
    assert.equal(layer.band.some(value => value !== 0), archetype.ground.edge !== undefined, `${archetype.id} bands`);
  }
  assert.equal(fills.size, MAP_ARCHETYPES.length, `fills ${[...fills].join(", ")}`);
  const coast = archetypeGroundLayer(byId(COASTAL_ARCHETYPE_ID), archetypeTerrains(byId(COASTAL_ARCHETYPE_ID), { ...SIZE, seed: 1 }), 64, 64, 1);
  assert.ok(["sand_beach", "shingle", "salt_marsh"].every(kind => coast.keys.some(key => key.startsWith(`shore/${kind}`))), "the harbour's three shores");
  assert.equal(byId(DOWNS_ARCHETYPE_ID).ground.fieldBoundary, "dry_stone_wall");
});

test("MA-6 a new game on a land: the start command takes the land and seed; the riverside town is today's map; a new land keeps its id through a save", () => {
  const riverside = newGameState({ scenarioId: DEFAULT_SCENARIO_ID })!;
  assert.deepEqual(riverside, { ...structuredClone(DEFAULT_GAME_STATE), scenarioId: DEFAULT_SCENARIO_ID });
  assert.equal(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: RIVERSIDE_ARCHETYPE_ID, seed: 2 }), null, "the riverside town is seed 1");
  assert.equal(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: "core:no_such_land" }), null);
  assert.equal(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: FEN_ARCHETYPE_ID, seed: 0 }), null);
  const fen = newGameState({ scenarioId: SANDBOX_SCENARIO_ID, archetypeId: FEN_ARCHETYPE_ID, seed: 2 })!;
  assert.deepEqual([fen.archetypeId, fen.seed, fen.scenarioId], [FEN_ARCHETYPE_ID, 2, SANDBOX_SCENARIO_ID]);
  assert.deepEqual(fen.buildings, DEFAULT_GAME_STATE.buildings, "the same opening village");
  assert.deepEqual(fen.tiles.map(tile => tile.terrain), archetypeTerrains(byId(FEN_ARCHETYPE_ID), { ...SIZE, seed: 2 }));
  assert.deepEqual(gameReducer(DEFAULT_GAME_STATE, { type: "start_new_game", scenarioId: SANDBOX_SCENARIO_ID, archetypeId: FEN_ARCHETYPE_ID, seed: 2 }), fen);
  assert.equal(gameReducer(DEFAULT_GAME_STATE, { type: "start_new_game", scenarioId: DEFAULT_SCENARIO_ID, archetypeId: "core:no_such_land" }), DEFAULT_GAME_STATE);
  const saved = decodeSave(encodeSave({ state: fen, createdAt: "2026-09-29T00:00:00.000Z", savedAt: "2026-09-29T00:00:00.000Z" }).bytes).envelope.state as GameState;
  assert.equal(saved.archetypeId, FEN_ARCHETYPE_ID);
  assert.equal(archetypeRules(saved).floodPermille, 2500);
});
