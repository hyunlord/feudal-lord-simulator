import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig';
import { lordBotCommands } from '../src/engine/lordBot';
import { registerRegistryCandidateObserver, registryCandidateObserverFailures } from '../src/engine/registryCandidateObservation';
import { createCandidateAuditCollector } from './engineBWeightAuditCandidates';
import { registryV4Support } from '../src/engine/registryV4';
import { stateCalendar } from '../src/engine/scenarioState';
import { advanceTick } from '../src/engine/tick';
import { gameReducer } from '../src/state/gameStore';
import { newGameState } from '../src/state/newGame';
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
import { createWeightAuditCollector } from './engineBWeightAuditCollector';
import { annualStatistics, ENGINE_B_PRIOR_BATCH_IDS, summarizeWeightAudit } from './engineBWeightAuditSummary';

export class WeightAuditInputError extends Error {
  constructor(message: string) { super(message); this.name = 'WeightAuditInputError'; }
}
export function engineBWeightAuditRun(seed: number, years: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || !Number.isSafeInteger(years) || years < 1) {
    throw new WeightAuditInputError('seed must be a nonnegative integer; years must be a positive integer');
  }
  refuseHeavyOnMac('EB-WEIGHT long simulation', { remote: 'scripts/remote/run.sh EB-WEIGHT -- npx tsx scripts/engineBWeightAuditRun.ts 1 125 output.json' });
  if (registryCandidateObserverFailures() !== 0) throw new WeightAuditInputError('Candidate observer already has failures');
  const candidates = createCandidateAuditCollector();
  const unregister = registerRegistryCandidateObserver(candidates.observe);
  try {
    let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed });
    if (state === null) throw new WeightAuditInputError(`Cannot create seed ${seed}`);
    const startYear = stateCalendar(state).year;
    const collector = createWeightAuditCollector();
    const started = Date.now();
    collector.observe(state);
    let commands = 0;
    while (stateCalendar(state).year < startYear + years) {
      for (const { command } of lordBotCommands(state)) {
        const next = gameReducer(state, command);
        if (next !== state) commands += 1;
        state = next;
        collector.observe(state);
      }
      state = advanceTick(state);
      collector.observe(state);
    }
    if (registryCandidateObserverFailures() !== 0) throw new WeightAuditInputError('Candidate observer failed during audit');
    const archive = collector.snapshot();
    if (archive.observation.firstTick !== 0 || archive.observation.lastTick !== state.tick
      || archive.observation.maxGap > 1 || archive.observation.reversals !== 0) throw new WeightAuditInputError('Incomplete observation interval');
    const summary = summarizeWeightAudit({ ...archive, startYear, years, endTick: state.tick });
    const yearOf = (tick: number) => stateCalendar({ ...state, tick }).year;
    const enabledIds = registryV4Support().filter(entry => entry.runs).map(entry => entry.id);
    const observedIds = [...new Set(archive.occurrences.map(occurrence => occurrence.entryId))].sort();
    const annualArrivals = Array.from({ length: years }, (_, offset) => {
      const year = startYear + offset;
      const presented = archive.presentations.filter(item => yearOf(item.firstObservedTick) === year);
      const ids = new Set(presented.filter(item => item.kind === 'registry').map(item => item.key.slice('registry:'.length)));
      const weightedRegistry = archive.occurrences.filter(item => ids.has(item.id) && (item.weights?.length ?? 0) > 0);
      const due = archive.lordDueArrivals.filter(item => yearOf(item.firstObservedTick) === year);
      return { year, wholeGameQueueItems: presented.length, registryHeavyOffers: weightedRegistry.length,
        lordDueItems: due.length, lordDueKinds: due.map(item => item.kind),
        combinedQueueItems: presented.length + due.filter(item => item.kind !== 'will_change').length };
    });
    return { schemaVersion: 1, seed, years, startYear, endYearExclusive: startYear + years, endTick: state.tick,
      seconds: (Date.now() - started) / 1000, commands, summary, annualArrivals,
      candidateObservation: { ...candidates.snapshot(), observerFailures: registryCandidateObserverFailures() },
      arrivalLimits: 'Whole-game queue arrival collector does not classify non-registry item weights; P-T1 uses resolved/lapsed trace metric separately.',
      registryHeavyArrivalDensity: annualStatistics(annualArrivals.map(row => row.registryHeavyOffers)),
      support: { priorBatchB11Ids: [...ENGINE_B_PRIOR_BATCH_IDS], enabledIds, observedIds, enabledNotObserved: enabledIds.filter(id => !observedIds.includes(id)),
        perEntry: enabledIds.map(id => ({ id, occurrences: archive.occurrences.filter(item => item.entryId === id).length,
          decisions: summary.decisions.filter(item => item.source.startsWith(`registry:${id}:`)).map(item => item.id) })) },
      ...archive };
  } finally { unregister(); }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = '1', years = '125', output, extra] = process.argv.slice(2);
  if (extra !== undefined) throw new WeightAuditInputError('usage: engineBWeightAuditRun.ts [seed] [years] [output.json]');
  const provenance = { sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirtyPaths: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), node: process.version };
  const result = `${JSON.stringify({ provenance, ...engineBWeightAuditRun(Number(seed), Number(years)) }, null, 2)}\n`;
  if (output === undefined) process.stdout.write(result); else writeFileSync(output, result);
}
