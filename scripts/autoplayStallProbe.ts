/**
 * Read-only probe of an autoplay stall state (BOT-1): each house's level and which L(n+1) requirement it lacks,
 * the timber and stone facilities, and optionally the advisor over N more ticks.
 *
 *   npx tsx scripts/autoplayStallProbe.ts fixtures/autoplay/seed2-408000.json.gz [ticks]
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { GameState } from '../src/engine/engine.types';
import { advanceTick } from '../src/engine/tick';
import { householdServices } from '../src/engine/householdServices';
import { palisadeProtectionForBuilding } from '../src/geometry/palisadeProtection';
import { houseHasFood } from '../src/population/houseFood';
import { housingLotCount } from '../src/population/housing';
import { buildingFootprintDistance } from '../src/geometry/buildingDistance';
import { operationSuspended } from '../src/content/buildingConfig';
import type { Building } from '../src/content/buildingConfig';
import { createAutoplayTraceDriver, type AdvisorDiagnosticReceipt } from './economyHarnessAutoplay';

export function loadAutoplayFixture(path: string): GameState {
  const raw = readFileSync(path);
  return JSON.parse((path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8')) as GameState;
}

/** The L3 granary test (housing.ts `hasGranaryNearby`, not exported): an operating granary within footprint distance 12. */
const granaryNear = (home: Building | undefined, buildings: readonly Building[]) => home !== undefined
  && buildings.some(building => building.kind === 'granary' && !operationSuspended(building) && buildingFootprintDistance(home, building) <= 12);

export function houseRequirementRows(state: GameState) {
  const services = householdServices(state);
  return state.houses.map(house => {
    const home = state.buildings.find(building => building.id === house.buildingId);
    const served = services.houses.get(house.buildingId);
    return { id: house.buildingId, tx: home?.tx, ty: home?.ty, level: house.level, residents: house.residents,
      water: house.hasWater, bread: houseHasFood(house), breadStock: house.breadStock, emptyFoodTicks: house.emptyFoodTicks ?? 0,
      granary: granaryNear(home, state.buildings), market: served?.market.kind, church: served?.church.kind,
      protection: home === undefined ? 'inactive' : palisadeProtectionForBuilding(home, state.palisade) };
  });
}

const count = (state: GameState, kind: string) => state.buildings.filter(building => building.kind === kind).length;

function summary(state: GameState) {
  const levels: Record<number, number> = {};
  for (const house of state.houses) levels[house.level] = (levels[house.level] ?? 0) + 1;
  return { tick: state.tick, lots: housingLotCount(state), levels, era: state.era,
    sites: state.constructionSites.map(site => ('kind' in site ? site.kind : 'wall')),
    sawmill: count(state, 'sawmill'), logging: count(state, 'logging_camp'), quarry: count(state, 'quarry'), masonry: count(state, 'masonry'),
    granary: count(state, 'granary'), idle: state.idleWorkers };
}

function main(args: readonly string[]) {
  const path = args[0];
  if (path === undefined) throw new RangeError('Usage: autoplayStallProbe.ts <state.json[.gz]> [ticks]');
  let state = loadAutoplayFixture(resolve(path));
  const ticks = Number(args[1] ?? 0);
  process.stdout.write(`${JSON.stringify(summary(state))}\n`);
  for (const row of houseRequirementRows(state).filter(row => row.level < 4)) process.stdout.write(`${JSON.stringify(row)}\n`);
  const receipts: AdvisorDiagnosticReceipt[] = [];
  const driver = createAutoplayTraceDriver({ id: 'stall-probe', source: path, policy: { maxHousingLots: 24 },
    onDiagnostic: receipt => { if (receipt.result !== 'no_action') receipts.push(receipt); } });
  for (let step = 0; step < ticks; step += 1) {
    state = advanceTick(driver.apply(state));
    if (state.tick % 2400 === 0) process.stdout.write(`${JSON.stringify(summary(state))}\n`);
  }
  for (const receipt of receipts) process.stdout.write(`${JSON.stringify({ tick: receipt.tick, action: receipt.advisorAction, result: receipt.result })}\n`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
