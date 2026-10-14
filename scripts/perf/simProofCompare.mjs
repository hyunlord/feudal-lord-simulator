// SIM-SPEED: collects a proof run's hashes and times (the 60-year probe's JSON without its rows' wall-clock `ms`) (scripts/perf/simSpeedProof.sh) into proof.json, or compares two.
//   node scripts/perf/simProofCompare.mjs --write <dir>          → <dir>/proof.json
//   node scripts/perf/simProofCompare.mjs <base proof.json> <new proof.json>   → same/different per item, times side by side
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const read = path => existsSync(path) ? readFileSync(path, 'utf8') : null;
const seconds = path => Number((read(path) ?? '').match(/(\d+)s/)?.[1] ?? NaN);

export function collect(dir) {
  const proof = { guardrail: null, grow60: null, lord30: null };
  const guard = read(join(dir, '..', 'guardrail', 'summary.json'));
  if (guard !== null) proof.guardrail = { seconds: seconds(join(dir, 'guardrail.time')),
    seeds: JSON.parse(guard).map(row => ({ seed: row.seed, exit: row.exit, seconds: row.seconds, stopReason: row.stopReason, tick: row.tick, finalStateSha256: row.finalStateSha256 })) };
  if (existsSync(join(dir, 'grow60'))) proof.grow60 = { seconds: seconds(join(dir, 'grow60.time')),
    seeds: readdirSync(join(dir, 'grow60')).filter(file => /^m-\d+\.json$/.test(file)).map(file => {
      const seed = Number(file.match(/\d+/)[0]); const [exit, secs] = (read(join(dir, 'grow60', `m-${seed}.exit`)) ?? '').trim().split(' ').map(Number);
      // The probe's yearly rows carry their wall-clock time (`ms`, since c6125725): hashed without it, with its own final state hash.
      const probe = JSON.parse(readFileSync(join(dir, 'grow60', file), 'utf8'));
      for (const row of probe.rows ?? []) delete row.ms;
      return { seed, exit, seconds: secs, jsonSha256: createHash('sha256').update(JSON.stringify(probe)).digest('hex'), finalStateSha256: probe.finalStateSha256 ?? null };
    }).sort((a, b) => a.seed - b.seed) };
  if (existsSync(join(dir, 'lord30'))) proof.lord30 = { seconds: seconds(join(dir, 'lord30.time')),
    seeds: readdirSync(join(dir, 'lord30')).filter(file => /^s-\d+\.json$/.test(file)).map(file => JSON.parse(readFileSync(join(dir, 'lord30', file), 'utf8')))
      .map(row => ({ seed: row.seed, seconds: row.seconds, finalStateSha256: row.finalStateSha256, yearlySha256: createHash('sha256').update(row.yearly.join('\n')).digest('hex') })).sort((a, b) => a.seed - b.seed) };
  return proof;
}

export function compare(base, next) {
  const lines = []; let same = true;
  for (const part of ['guardrail', 'grow60', 'lord30']) {
    if (base[part] === null || next[part] === null) { lines.push(`${part}: not in both`); continue; }
    const keys = part === 'guardrail' ? ['finalStateSha256'] : part === 'grow60' ? ['jsonSha256', 'finalStateSha256'] : ['yearlySha256', 'finalStateSha256'];
    const differ = base[part].seeds.filter(row => keys.some(key => next[part].seeds.find(other => other.seed === row.seed)?.[key] !== row[key])).map(row => row.seed);
    if (base[part].seeds.length !== next[part].seeds.length || differ.length > 0) same = false;
    lines.push(`${part}: ${differ.length === 0 && base[part].seeds.length === next[part].seeds.length ? 'same' : `DIFFERENT seeds ${differ.join(',')}`} (${base[part].seeds.length} seeds) · ${base[part].seconds} s → ${next[part].seconds} s`);
  }
  return { same, text: lines.join('\n') };
}

const args = process.argv.slice(2);
if (args[0] === '--write') { const proof = collect(args[1]); writeFileSync(join(args[1], 'proof.json'), `${JSON.stringify(proof, null, 1)}\n`); console.log(JSON.stringify(proof).slice(0, 400)); }
else if (args.length === 2) { const result = compare(JSON.parse(readFileSync(args[0], 'utf8')), JSON.parse(readFileSync(args[1], 'utf8'))); console.log(result.text); process.exitCode = result.same ? 0 : 1; }
