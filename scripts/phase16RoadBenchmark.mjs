import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run with node --import tsx scripts/phase16RoadBenchmark.mjs REPO STATE_JSON tick|service.
const [repositoryArg, input, mode = 'tick'] = process.argv.slice(2);
assert(repositoryArg && input && ['tick', 'service'].includes(mode), 'Expected REPO STATE_JSON tick|service');
const repository = resolve(repositoryArg);
const source = await readFile(input);
const initial = JSON.parse(source.toString());
assert(Array.isArray(initial.tiles) && Array.isArray(initial.buildings) && Number.isFinite(initial.tick));
const { advanceTick } = await import(pathToFileURL(`${repository}/src/engine/tick.ts`).href);
const { marketRoadService } = await import(pathToFileURL(`${repository}/src/engine/marketService.ts`).href);
const digest = value => createHash('sha256').update(value).digest('hex');
const runs = [];
for (let run = 0; run < 4; run++) {
  let state = structuredClone(initial);
  const homes = state.buildings.filter(building => building.kind === 'house');
  const markets = state.buildings.filter(building => building.kind === 'market');
  const elapsed = [];
  let reachable = 0;
  for (let frame = 0; frame < 40; frame++) {
    const start = performance.now();
    if (mode === 'tick') state = advanceTick(state);
    else {
      const service = marketRoadService(state);
      for (const home of homes) for (const market of markets) reachable += Number(service(home, market));
    }
    elapsed.push(performance.now() - start);
  }
  runs.push({ elapsed, reachable, finalTick: state.tick, population: state.population, hash: digest(JSON.stringify(state)) });
}
const measured = runs.slice(1).flatMap(run => run.elapsed).sort((a, b) => a - b);
console.log(JSON.stringify({
  mode, repository, sourceSha256: digest(source), sourceTick: initial.tick, sourcePopulation: initial.population,
  node: process.version, medianMs: measured[Math.floor(measured.length / 2)], p95Ms: measured[Math.ceil(measured.length * .95) - 1],
  limitation: mode === 'service' ? 'Isolated queries bypass service radius filtering; not full tick or FPS' : 'Headless engine ticks; not browser rAF or FPS',
  runs,
}, null, 2));
