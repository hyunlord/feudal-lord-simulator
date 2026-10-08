import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTER_FIVE } from '../src/content/chapterConfig';
import { archetypeById } from '../src/content/scenario/registry';
import { stateArchetype } from '../src/engine/archetype';
import type { GameState } from '../src/engine/engine.types';
import { chapterEnd } from '../src/engine/politics';
import { stateCalendar } from '../src/engine/scenarioState';
import { runPhase19NaturalGrowth } from './phase19NaturalGrowth';
import { refuseHeavyOnMac } from './remote/localGuard.mjs';

interface Options {
  readonly archetypeId: string;
  readonly seed: number;
  readonly output: string;
  readonly lastYear: number;
}
export function campaignHashOptions(args: readonly string[]): Options {
  const [archetypeId, seedText, output, lastYearText = '1450'] = args;
  if (args.length < 3 || args.length > 4 || archetypeId === undefined || archetypeById(archetypeId) === undefined
    || seedText === undefined || !/^[1-9]\d*$/.test(seedText) || !Number.isSafeInteger(Number(seedText))
    || output === undefined || output.trim() === '' || !/^\d{4}$/.test(lastYearText)
    || Number(lastYearText) < 1300 || Number(lastYearText) > 1450) {
    throw new RangeError('Usage: engineBCampaignHashRun.ts <archetypeId> <positive seed> <empty output directory> [lastYear=1450, 1300..1450]');
  }
  return { archetypeId, seed: Number(seedText), output, lastYear: Number(lastYearText) };
}

function sourceProvenance() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const git = (...args: readonly string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z', 'src', 'scripts').split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update('\0').update(readFileSync(resolve(root, file)));
  const dirtyFiles = git('status', '--porcelain', '--', 'src', 'scripts').trim();
  return { sourceRevision: git('rev-parse', 'HEAD').trim(), sourceSha256: hash.digest('hex'), sourceFiles: files.length,
    dirty: dirtyFiles !== '', dirtyFiles,
    harnessSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex') };
}

class CampaignBoundary extends Error {}

export function runCampaignHash(options: Options) {
  refuseHeavyOnMac('Campaign final-state hash verification', { remote: 'scripts/remote/run.sh eb-campaign --heavy --experiment --keep -- node_modules/.bin/tsx scripts/engineBCampaignHashRun.ts core:open_field 1 .remote/campaign/seed-1' });
  if (existsSync(options.output) && readdirSync(options.output).length > 0) throw new RangeError('Output directory must be empty');
  const provenance = sourceProvenance();
  mkdirSync(options.output, { recursive: true });
  const captured: { state: GameState | null } = { state: null };
  let report: ReturnType<typeof runPhase19NaturalGrowth> | null = null;
  const maxTicks = (options.lastYear - 1300 + 1) * 4000;
  try {
    report = runPhase19NaturalGrowth({ targetLots: 24, maxTicks, seed: options.seed, archetypeId: options.archetypeId,
      onTick: state => {
        captured.state = state;
        if (chapterEnd(state, CHAPTER_FIVE.chapter) !== null || stateCalendar(state).year > options.lastYear) throw new CampaignBoundary();
      }, additionalAcceptance: state => stateCalendar(state).year > options.lastYear });
  } catch (error) {
    if (!(error instanceof CampaignBoundary)) throw error;
  }
  const final = captured.state;
  if (final === null) throw new RangeError('Campaign produced no state');
  const campaignEnded = chapterEnd(final, CHAPTER_FIVE.chapter) !== null;
  const calendarEnded = stateCalendar(final).year > options.lastYear;
  const raw = JSON.stringify(final);
  const summary = { ...provenance, scenarioId: final.scenarioId, seed: options.seed, archetypeId: stateArchetype(final)?.id ?? null,
    requestedArchetypeId: options.archetypeId, lastYear: options.lastYear, maxTicks, finalTick: final.tick,
    finalYear: stateCalendar(final).year, campaignEnded, calendarEnded,
    stop: campaignEnded ? 'chapter-five-ended' : calendarEnded ? 'calendar-boundary' : report?.stopReason ?? 'unexpected-stop',
    boundaryReached: campaignEnded || calendarEnded, failures: report?.failures ?? [],
    finalStateSha256: createHash('sha256').update(raw).digest('hex'), finalStateBytes: Buffer.byteLength(raw),
    interpretation: 'Full state bytes, not campaign summary equality; pair with identical harness/options on the baseline revision.' };
  writeFileSync(resolve(options.output, 'final-state.json'), raw);
  writeFileSync(resolve(options.output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  return summary;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = runCampaignHash(campaignHashOptions(process.argv.slice(2)));
  process.stdout.write(JSON.stringify(summary) + '\n');
  if (!summary.boundaryReached || summary.failures.length > 0) process.exitCode = 1;
}
