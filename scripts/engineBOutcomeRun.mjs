import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOutcomeReplay, outcomeSha256, requireOutcome } from './engineBOutcomeArchive.mjs';
import { scoreOutcomeGate } from './engineBOutcomeGate.mjs';

/** Config paths are relative to its own directory, keeping stored invocations portable. */
export function runOutcomeGate(configPath, outputPath) {
  const configBytes = readFileSync(configPath), config = JSON.parse(configBytes);
  requireOutcome(config.schemaVersion === 1 && Array.isArray(config.seeds) && config.seeds.length > 0
    && config.seeds.every(seed => Number.isSafeInteger(seed) && seed > 0) && new Set(config.seeds).size === config.seeds.length, 'config seeds invalid');
  requireOutcome(typeof config.replayDirectory === 'string' && typeof config.rawDirectory === 'string' && typeof config.contractFile === 'string', 'config paths missing');
  const base = dirname(resolve(configPath)), path = value => resolve(base, value);
  const contractBytes = readFileSync(path(config.contractFile));
  requireOutcome(config.contractSha256 === outcomeSha256(contractBytes), 'contract file pin mismatch');
  requireOutcome(Array.isArray(config.replayPins) && config.replayPins.length === config.seeds.length, 'expected replay pins missing');
  const runs = config.seeds.map(seed => {
    const directory = join(path(config.replayDirectory), `seed-${seed}`);
    const input = { format: config.replayFormat, manifestBytes: readFileSync(join(directory, 'manifest.json')), validityBytes: readFileSync(join(directory, 'validity.json')),
      classificationBytes: readFileSync(join(directory, 'answer-classification.json')), rawBytes: readFileSync(join(path(config.rawDirectory), `seed-${seed}.json`)) };
    const pins = config.replayPins.filter(row => row.seed === seed);
    requireOutcome(pins.length === 1 && pins[0].manifestSha256 === outcomeSha256(input.manifestBytes)
      && pins[0].rawSha256 === outcomeSha256(input.rawBytes), 'external replay pin mismatch');
    const verified = verifyOutcomeReplay(input);
    requireOutcome(verified.raw.seed === seed, 'requested seed does not match input seed');
    return verified;
  });
  const report = scoreOutcomeGate(runs, JSON.parse(contractBytes), { horizonTicks: config.horizonTicks, ticksPerSeason: config.ticksPerSeason });
  report.configSha256 = outcomeSha256(configBytes);
  report.contractSha256 = outcomeSha256(contractBytes);
  report.scorerHashes = Object.fromEntries(['engineBOutcomeArchive.mjs', 'engineBOutcomeGate.mjs', 'engineBOutcomeRun.mjs'].map(name =>
    [name, outcomeSha256(readFileSync(new URL(name, import.meta.url)))]));
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return report;
}

/** Prepare a portable config from a newly produced, verified outcome archive; this never simulates. */
export function prepareOutcomeConfig(dataDirectory, contractFile, configPath, seeds = [1, 2, 3]) {
  requireOutcome(Array.isArray(seeds) && seeds.length > 0 && seeds.every(seed => Number.isSafeInteger(seed) && seed > 0)
    && new Set(seeds).size === seeds.length, 'config seed set invalid');
  const base = dirname(resolve(configPath)), data = resolve(dataDirectory), contract = resolve(contractFile);
  const pins = seeds.map(seed => {
    const directory = join(data, `seed-${seed}`), recorded = JSON.parse(readFileSync(join(directory, 'pins.json')));
    const run = verifyOutcomeReplay({ format: 'outcome-replay-v1', rawBytes: readFileSync(join(data, `seed-${seed}.json`)),
      manifestBytes: readFileSync(join(directory, 'manifest.json')), validityBytes: readFileSync(join(directory, 'validity.json')),
      classificationBytes: readFileSync(join(directory, 'answer-classification.json')) });
    requireOutcome(run.raw.seed === seed && recorded.seed === seed && recorded.rawSha256 === run.pins.rawSha256
      && recorded.manifestSha256 === run.pins.replayManifestSha256, 'producer pins mismatch');
    requireOutcome(recorded.years === 125 && recorded.horizonTicks === 12 * recorded.ticksPerSeason
      && run.raw.endTick === 500 * recorded.ticksPerSeason, 'producer calendar pin mismatch');
    return recorded;
  });
  requireOutcome(pins.every(pin => pin.horizonTicks === pins[0].horizonTicks && pin.ticksPerSeason === pins[0].ticksPerSeason), 'calendar pins differ');
  const config = { schemaVersion: 1, replayFormat: 'outcome-replay-v1', seeds, replayDirectory: relative(base, data) || '.', rawDirectory: relative(base, data) || '.',
    contractFile: relative(base, contract), contractSha256: outcomeSha256(readFileSync(contract)), horizonTicks: pins[0].horizonTicks,
    ticksPerSeason: pins[0].ticksPerSeason, replayPins: pins.map(({ seed, manifestSha256, rawSha256 }) => ({ seed, manifestSha256, rawSha256 })) };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
  return config;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--prepare') {
    const [data, contract, config, seeds, ...extra] = process.argv.slice(3);
    requireOutcome(data && contract && config && extra.length === 0, 'usage: --prepare DATA_DIR CONTRACT_FILE NEW_CONFIG.json [1,2,3]');
    prepareOutcomeConfig(data, contract, config, seeds === undefined ? [1, 2, 3] : seeds.split(',').map(Number));
  } else {
  const [config, output, ...extra] = process.argv.slice(2);
  requireOutcome(config && output && extra.length === 0, 'usage: node scripts/engineBOutcomeRun.mjs CONFIG.json NEW_OUTPUT.json');
  const report = runOutcomeGate(config, output);
  console.log(JSON.stringify({ pass: report.pass, counts: report.counts, legacyDirectRatio: report.legacyDirectRatio,
    strictContractDirectRatio: report.strictContractDirectRatio, coverage: { ...report.coverage, unclassified: undefined } }));
  process.exitCode = report.pass ? 0 : 1;
  }
}
