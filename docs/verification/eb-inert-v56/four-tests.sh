#!/usr/bin/env bash
set -euo pipefail
out=.remote/four-tests
mkdir -p "$out"
pin=scripts/engineBInertReviewedSources.mjs
residual=scripts/engineBTlinkResiduals.mjs
cp "$pin" "$out/reviewed-profile.mjs"
cp "$residual" "$out/reviewed-residuals.mjs"
trap 'cp "$out/reviewed-profile.mjs" "$pin"; cp "$out/reviewed-residuals.mjs" "$residual"' EXIT
git show f42b0a0fa8ab843b5152aca2a2dbe73edb8d1f5c:"$pin" > "$pin"
git show f42b0a0fa8ab843b5152aca2a2dbe73edb8d1f5c:"$residual" > "$residual"
cp "$pin" "$out/integration-profile.mjs"
cp "$residual" "$out/integration-residuals.mjs"
set +e
node --import tsx --test --test-reporter=tap tests/engineBTlinkOutcomeEvidence.test.ts tests/engineBTlinkResiduals.test.ts > "$out/before.tap" 2>&1
before_exit=$?
cp "$out/reviewed-profile.mjs" "$pin"
node --import tsx --test --test-reporter=tap tests/engineBTlinkOutcomeEvidence.test.ts tests/engineBTlinkResiduals.test.ts > "$out/pins-only.tap" 2>&1
pins_exit=$?
cp "$out/reviewed-residuals.mjs" "$residual"
node --import tsx --test --test-reporter=tap tests/engineBTlinkOutcomeEvidence.test.ts tests/engineBTlinkResiduals.test.ts > "$out/after.tap" 2>&1
after_exit=$?
set -e
printf '%s\n' "$before_exit" > "$out/before-exit-code"
printf '%s\n' "$pins_exit" > "$out/pins-only-exit-code"
printf '%s\n' "$after_exit" > "$out/after-exit-code"
test "$before_exit" -ne 0
test "$pins_exit" -eq 0
test "$after_exit" -eq 0
test -z "$(git status --porcelain)"
node --input-type=module - "$out" <<'JS'
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const out = process.argv[2];
const before = readFileSync(`${out}/before.tap`, 'utf8'), pinsOnly = readFileSync(`${out}/pins-only.tap`, 'utf8'), after = readFileSync(`${out}/after.tap`, 'utf8');
const failures = [...before.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]).sort();
assert.deepEqual(failures, [
  'INERT reviewed source profile matches every current reviewed actuator before a measurement run',
  'actual phase decision enters supplemental denominator without becoming a future receipt',
  'both phase commands require their exact history identity and compatible producer',
  'reviewed baseline phase history works without prototype receipt sources; supplemental status remains explicit',
].sort());
assert.match(after, /^# fail 0$/m);
assert.match(pinsOnly, /^# fail 0$/m);
const files = ['before.tap', 'pins-only.tap', 'after.tap', 'before-exit-code', 'pins-only-exit-code', 'after-exit-code',
  'integration-profile.mjs', 'reviewed-profile.mjs', 'integration-residuals.mjs', 'reviewed-residuals.mjs'];
const result = { sourceRevision: process.env.FULL_SHA, integrationRevision: 'f42b0a0fa8ab843b5152aca2a2dbe73edb8d1f5c',
  treatment: 'Integration profiles -> reviewed INERT pins -> independently reviewed phase history list; tests, assertions and product unchanged',
  failuresBefore: failures, failuresPinsOnly: 0, failuresAfter: 0, node: process.version,
  files: files.map(file => ({ file, sha256: createHash('sha256').update(readFileSync(`${out}/${file}`)).digest('hex') })) };
writeFileSync(`${out}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
JS
