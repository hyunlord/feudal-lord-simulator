/**
 * BOT-3 probe (LB-15 evidence): from seed 3's food-logistics stall (MK6), optionally add bot-placed food buildings,
 * run the advisor for N ticks and print the L4 count (sampled every 200 ticks) and each granary's bread.
 *
 *   npx tsx scripts/barnBacklogProbe.ts [none|west-mill|west-mill2|relay-granary] [ticks]
 *
 * Run it on a commit with and without LB-15 to compare the cart rule; the other modes are the bot-only alternatives
 * weighed against it (each needs a facility cap exception).
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BuildingKind } from '../src/content/buildingConfig';
import { autoplayBuildAction } from '../src/engine/autoplay';
import { autoplayActionToGameAction } from '../src/engine/autoplayActions';
import type { GameState } from '../src/engine/engine.types';
import { advanceTick } from '../src/engine/tick';
import { gameReducer } from '../src/state/gameStore';
import { createAutoplayTraceDriver } from './economyHarnessAutoplay';
import { loadAutoplayFixture } from './autoplayStallProbe';

export const SEED3_BACKLOG_FIXTURE = 'fixtures/autoplay/seed3-market1-1200000.json.gz';

/** The bot's own site search for `kind` within `radius` (Manhattan) of a tile, applied through the reducer. */
function place(state: GameState, kind: BuildingKind, tx: number, ty: number, radius: number): GameState {
  const action = autoplayBuildAction(state, kind, tile => Math.abs(tile.tx - tx) + Math.abs(tile.ty - ty) <= radius);
  const command = autoplayActionToGameAction(action, state);
  process.stdout.write(`${JSON.stringify({ place: kind, action })}\n`);
  return command === null ? state : gameReducer(state, command);
}

function main(args: readonly string[]) {
  const mode = args[0] ?? 'none';
  const ticks = Number(args[1] ?? 40_000);
  let state = loadAutoplayFixture(resolve(SEED3_BACKLOG_FIXTURE));
  if (mode === 'west-mill' || mode === 'west-mill2') state = place(state, 'mill', 6, 12, 6);
  if (mode === 'west-mill2') {
    for (let step = 0; step < 600; step += 1) state = advanceTick(state);
    state = place(state, 'mill', 3, 12, 8);
  }
  if (mode === 'relay-granary') state = place(state, 'granary', 15, 16, 5);
  const driver = createAutoplayTraceDriver({ id: 'barn-backlog', source: SEED3_BACKLOG_FIXTURE, policy: { maxHousingLots: 24 } });
  const l4 = () => state.houses.filter(house => house.level >= 4).length;
  let min = Infinity, max = 0, sum = 0, samples = 0;
  for (let step = 0; step < ticks; step += 1) {
    state = advanceTick(driver.apply(state));
    if (state.tick % 200 === 0) { const value = l4(); min = Math.min(min, value); max = Math.max(max, value); sum += value; samples += 1; }
    if (state.tick % 4000 === 0) process.stdout.write(`${JSON.stringify({ tick: state.tick, l4: l4(),
      granaryBread: state.buildings.filter(building => building.kind === 'granary').map(building => `${building.tx},${building.ty}:${building.inventory.bread ?? 0}`).join(' ') })}\n`);
  }
  process.stdout.write(`${JSON.stringify({ mode, ticks, minL4: min, maxL4: max, meanL4: Number((sum / samples).toFixed(2)) })}\n`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
