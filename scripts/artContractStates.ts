/** Prepared saved-state fixtures, never bot-grown or human-play evidence. No renderer facts are injected. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Building } from '../src/content/buildingConfig';
import { BALANCE, PRESSURE_BALANCE } from '../src/content/balanceConfig';
import { GROWN_YEARS, STUMP_YEARS, FALLOW_SCRUB_YEARS, FALLOW_SAPLING_YEARS } from '../src/content/landConfig';
import type { ForestHarvest, GameState } from '../src/engine/engine.types';
import { scenarioOf } from '../src/engine/scenarioState';
import type { House } from '../src/population/population.types';
import { createArtRegistry } from '../src/render/art/artRegistry';
import { createContractHouseArt } from '../src/render/art/contractHouseArt';
import { cellHash, treeStageArt, fallowStageArt } from '../src/render/landStageModel';
import { footpathPieces, PORT_STEP, type Port } from '../src/render/footpathModel';
import { ART_REGISTRY, selectLandArt } from '../src/render/art/wave42Registry';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { decodeSave, encodeSave } from '../src/save/saveCodec';
import { houseBodyAssignments } from '../src/render/houseVariantChoice';
import { buildingVariantAssignments } from '../src/render/buildingVariants';
import { historicalHouseAssetManifest } from '../src/render/historicalHouseAssetManifest.generated';
import { WAVE26_HOUSE_IMAGES } from '../src/render/wave26HouseManifest.generated';
import { admitSceneState } from './sceneState';
import { alehouseArt } from '../src/render/aleWorldArt';

type Season = 'summer' | 'winter';
type View = { readonly name: string; readonly state: string; readonly season: Season; readonly tile: readonly [number, number]; readonly zoom: 1 | 0.6; readonly width: 1280; readonly height: 800; readonly dpr: 1; readonly expectedRequests: readonly string[] };
type Focus = { readonly name: string; readonly tile: readonly [number, number]; readonly ids: readonly string[] };
const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;
const SEASONS: readonly Season[] = ['summer', 'winter'];
const building = (id: string, tx: number, ty: number): Building => ({ id, kind: 'house', tx, ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });
const house = (id: string, level: number, tick: number, abandoned: boolean): House => ({ buildingId: id, level, builtLevel: level, residents: abandoned ? 0 : 4, hasWater: true, breadStock: 4, lastServicedTick: tick, unmetRequirementTicks: 0, ...(abandoned ? { abandonedTick: tick - YEAR } : {}) });
function preparedBoard(base: GameState, year: number, season: Season): GameState {
  if (base.width < 56 || base.height < 56) throw new Error('Prepared art board needs at least a 56 by 56 map');
  const tick = (year - scenarioOf(base).startYear) * BALANCE.TICKS_PER_YEAR + (season === 'summer' ? 1.5 : 3.5) * PRESSURE_BALANCE.seasonTicks;
  const inside = (tx: number, ty: number) => tx >= 16 && tx <= 64 && ty >= 16 && ty <= 64;
  const buildings = base.buildings.filter(entry => !inside(entry.tx, entry.ty));
  const ids = new Set(buildings.map(entry => entry.id));
  const { zoneUndo: _zoneUndo, ...withoutZoneHistory } = base;
  return { ...withoutZoneHistory, tick, buildings, houses: base.houses.filter(entry => ids.has(entry.buildingId)),
    tiles: base.tiles.map(tile => inside(tile.tx, tile.ty) ? { ...tile, terrain: 'grass', hasRoad: false, buildingId: null } : tile),
    forestHarvests: [], land: { footfall: [], footpaths: [], fallow: [] }, zones: [], arableFields: [], constructionSites: [], pathCache: {}, roadRevision: base.roadRevision + 1 };
}
function withBuildings(state: GameState, buildings: readonly Building[], houses: readonly House[]): GameState {
  const occupied = new Map(buildings.map(entry => [entry.ty * state.width + entry.tx, entry.id]));
  const nextHouses = [...state.houses, ...houses];
  return { ...state, buildings: [...state.buildings, ...buildings], houses: nextHouses, population: nextHouses.reduce((sum, entry) => sum + entry.residents, 0),
    tiles: state.tiles.map((tile, index) => occupied.has(index) ? { ...tile, buildingId: occupied.get(index) ?? null } : tile) };
}
function landFixture(base: GameState, season: Season): { readonly state: GameState; readonly focus: readonly Focus[] } {
  let state = preparedBoard(base, 1350, season);
  const ages = [0.5, 0.5, 1.5, 1.5, STUMP_YEARS + 0.25, GROWN_YEARS - 0.25, GROWN_YEARS + 0.25, GROWN_YEARS + 0.25];
  const harvests: ForestHarvest[] = ages.map((age, index) => {
    const ty = 22 + Math.floor(index / 4) * 5;
    let tx = 22 + (index % 4) * 4;
    while (cellHash(tx, ty) % 2 !== index % 2) tx++;
    return { tx, ty, harvestedAtTick: state.tick - age * YEAR };
  });
  const forest = new Set(harvests.map(entry => entry.ty * state.width + entry.tx));
  state = { ...state, forestHarvests: harvests, tiles: state.tiles.map((tile, index) => forest.has(index) ? { ...tile, terrain: 'forest' } : tile) };
  const fallowFacts = [
    { tx: 46, ty: 22, age: 0.25, plot: false }, { tx: 51, ty: 22, age: 0.25, plot: true },
    { tx: 46, ty: 27, age: FALLOW_SCRUB_YEARS + 0.25, plot: false }, { tx: 51, ty: 27, age: FALLOW_SAPLING_YEARS + 0.25, plot: false },
  ];
  const plot = building('fixture-fallow-plot', 51, 22);
  state = withBuildings(state, [plot], [house(plot.id, 0, state.tick, true)]);
  const shapes: readonly (readonly Port[])[] = [['NE', 'SW'], ['NW', 'SE'], ['SW', 'NW'], ['NE', 'SE'], ['NE', 'SW', 'NW'], ['NE', 'SE', 'NW']];
  const cells = new Set<number>();
  for (const [index, ports] of shapes.entries()) {
    const tx = 23 + (index % 3) * 7, ty = 44 + Math.floor(index / 3) * 7;
    cells.add(ty * state.width + tx);
    for (const port of ports) for (const distance of [1, 2]) {
      const [dx, dy] = PORT_STEP[port];
      cells.add((ty + dy * distance) * state.width + tx + dx * distance);
    }
  }
  const fallow: readonly (readonly [number, number])[] = fallowFacts.map(fact => [fact.ty * state.width + fact.tx, state.tick - fact.age * YEAR]);
  state = { ...state, land: { footfall: [...cells].map(cell => [cell, 24]), footpaths: [...cells].sort((a, b) => a - b), fallow } };
  const pathIds = new Set<string>();
  for (const piece of footpathPieces(state, [...cells])) {
    if (piece.rule.connector) pathIds.add(selectLandArt('path', { family: 'path', stage: piece.rule.connector, season }).id);
    for (const port of piece.rule.halves) pathIds.add(selectLandArt('path-strip', { family: 'path', stage: port === 'NE' || port === 'SW' ? 'ne' : 'nw', season }).id);
  }
  return { state, focus: [
    { name: 'trees', tile: [28, 24], ids: harvests.map(entry => treeStageArt(entry, state.tick, season).id) },
    { name: 'fallow', tile: [49, 25], ids: fallowFacts.map(fact => fallowStageArt(fact.plot, state.tick - fact.age * YEAR, state.tick, season).id) },
    { name: 'paths', tile: [30, 48], ids: [...pathIds].sort() },
  ] };
}

function legacyHouseBodies(state: GameState): readonly { readonly buildingId: string; readonly url: string }[] {
  const paintings = houseBodyAssignments(state);
  const variants = buildingVariantAssignments(state);
  return state.buildings.filter(entry => entry.id.startsWith('prepared-')).map(entry => {
    const household = state.houses.find(candidate => candidate.buildingId === entry.id);
    if (!household || alehouseArt(state, entry, household, household.builtLevel ?? household.level) !== null) throw new Error(`Unexpected legacy house eligibility: ${entry.id}`);
    const painting = paintings.get(entry.id);
    const variant = variants.get(entry.id)?.variant;
    const url = painting ? Object.entries(WAVE26_HOUSE_IMAGES).find(([key]) => key === painting.key)?.[1].url
      : variant?.url ?? historicalHouseAssetManifest.find(meta => meta.level === (household.builtLevel ?? household.level))?.url;
    if (!url) throw new Error(`No legacy body source for ${entry.id}`);
    return { buildingId: entry.id, url: `/${url}` };
  });
}

export function prepareArtContractStates(base: GameState, wave20: unknown) {
  const houseRegistry = createArtRegistry([wave20]);
  const adapter = createContractHouseArt(houseRegistry);
  const states: Record<string, GameState> = {};
  const views: View[] = [];
  const expectedIds: Record<string, readonly string[]> = {};
  const add = (name: string, state: GameState, season: Season, focus: readonly Focus[], registry = ART_REGISTRY): void => {
    const migrated = decodeSave(new TextEncoder().encode(JSON.stringify(state))).envelope.state;
    const bytes = encodeSave({ state: migrated, createdAt: '2026-10-05T00:00:00Z', savedAt: '2026-10-05T00:00:00Z' }).bytes;
    states[name] = admitSceneState(decodeSave(bytes).envelope.state, DEFAULT_GAME_STATE);
    for (const group of focus) for (const zoom of [1, 0.6] as const) {
      const viewName = `${name}-${group.name}-z${zoom === 1 ? '1' : '06'}`;
      const ids = [...new Set(group.ids)].sort();
      expectedIds[viewName] = ids;
      views.push({ name: viewName, state: name, season, tile: group.tile, zoom, width: 1280, height: 800, dpr: 1,
        expectedRequests: ids.map(id => { const entry = registry.entry(id); if (!entry) throw new Error(`Unknown expected asset ${id}`); return `/${entry.image.url}`; }) });
    }
  };
  for (const season of SEASONS) {
    const land = landFixture(base, season);
    add(`prepared-land-${season}`, land.state, season, land.focus);
  }
  for (const year of [1350, 1400]) for (const season of SEASONS) {
    let state = preparedBoard(base, year, season);
    const buildings: Building[] = [], houses: House[] = [], ids = new Set<string>();
    for (let level = 0; level <= 4; level++) for (const [variantIndex, variant] of ['a', 'b'].entries()) for (const abandoned of [false, true]) {
      const tx = 28 + level * 4, ty = 28 + (variantIndex * 2 + Number(abandoned)) * 4;
      let chosen: Building | undefined;
      let selectedId: string | undefined;
      for (let attempt = 0; attempt < 256; attempt++) {
        const candidate = building(`prepared-${year}-l${level}-${variant}-${abandoned ? 'empty' : 'settled'}-${attempt}`, tx, ty);
        const household = house(candidate.id, level, state.tick, abandoned);
        const selected = adapter.select({ state: { ...state, houses: [...state.houses, household] }, building: candidate, level });
        if (selected?.variantId === variant) { chosen = candidate; selectedId = selected.id; break; }
      }
      if (!chosen || !selectedId) throw new Error(`No eligible ${year} L${level} ${variant} ${season} identity`);
      buildings.push(chosen); houses.push(house(chosen.id, level, state.tick, abandoned)); ids.add(selectedId);
      for (const layer of ['boarded', 'snow'] as const) {
        if (layer === 'boarded' ? !abandoned : season !== 'winter') continue;
        const overlay = houseRegistry.select('state-overlay', `house-${layer}`, { bodyId: selectedId, layer, season, vacant: abandoned }, 0);
        if (!overlay) throw new Error(`Missing ${layer} for ${selectedId}`);
        ids.add(overlay.id);
      }
    }
    state = withBuildings(state, buildings, houses);
    add(`prepared-houses-${year}-${season}`, state, season, [{ name: 'gallery', tile: [36, 34], ids: [...ids] }], houseRegistry);
  }
  const landViews = views.filter(view => view.state.startsWith('prepared-land-'));
  const houseAfterViews = views.filter(view => view.state.startsWith('prepared-houses-'));
  const legacyBodies: Record<string, ReturnType<typeof legacyHouseBodies>> = {};
  const houseBeforeViews = houseAfterViews.map(view => {
    const state = states[view.state];
    if (!state) throw new Error(`Missing house state ${view.state}`);
    const bodies = legacyBodies[view.state] ?? legacyHouseBodies(state);
    legacyBodies[view.state] = bodies;
    return { ...view, expectedRequests: [...new Set(bodies.map(body => body.url))].sort() };
  });
  return { states, views, landViews, houseAfterViews, houseBeforeViews, legacyBodies, expectedIds, provenance: { classification: 'prepared-save-fixture', sourceSeed: base.seed,
    sourceTick: base.tick, mutations: ['calendar tick', 'cleared display region and zone undo/crop records', 'save migration and codec validation', 'saved household records', 'saved forest harvest timestamps', 'saved fallow and footpath records'],
    runtimeClaim: 'NOT_RUN: static selection and view expectations only; require request/decode/draw evidence from capture harness',
    botGrownComparison: 'Use unchanged nat5StageStates.ts outputs separately; prepared fixtures do not replace bot-grown scene regression.' } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [out, baseFile, houseFile = 'tests/fixtures/art-house-bundle.json'] = process.argv.slice(2);
  if (!out) throw new Error('Usage: tsx scripts/artContractStates.ts OUT_DIR [BASE_SAVE] [HOUSE_BUNDLE_JSON]');
  const base = baseFile ? decodeSave(new Uint8Array(readFileSync(baseFile))).envelope.state : DEFAULT_GAME_STATE;
  const result = prepareArtContractStates(base, JSON.parse(readFileSync(houseFile, 'utf8')));
  mkdirSync(out, { recursive: true });
  for (const [name, state] of Object.entries(result.states)) writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  writeFileSync(join(out, 'views.json'), `${JSON.stringify(result.views, null, 2)}\n`);
  for (const [name, views] of [['views-land.json', result.landViews], ['views-houses-before.json', result.houseBeforeViews], ['views-houses-after.json', result.houseAfterViews]] as const) {
    writeFileSync(join(out, name), `${JSON.stringify(views, null, 2)}\n`);
  }
  writeFileSync(join(out, 'coverage.json'), `${JSON.stringify({ provenance: result.provenance, expectedIds: result.expectedIds, legacyBodies: result.legacyBodies }, null, 2)}\n`);
  console.log(JSON.stringify({ states: Object.keys(result.states).length, views: result.views.length, out }));
}
