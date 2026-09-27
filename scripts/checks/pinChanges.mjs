// Pin changes need a reason in the decision list (REVIEW-1, AGENTS.md rule 19).
//   node scripts/checks/pinChanges.mjs [--base <rev>] [--head <rev>]      (default: merge-base with the trunk..HEAD)
// A pin is a recorded value that tests or gates compare against. Re-recording one makes a test follow the code
// instead of catching it, so every pin change base..head must be named by a line the same range adds to the
// decision list (docs/decisions/** or docs/DECISIONS.md): the file's name, its path, or a parent folder of two or
// more levels (e.g. `fixtures/saves/v17/`). Pins:
//  - pin files (PIN_FILES below), added, changed or deleted;
//  - hash literals in test files: a change of a quoted hex string of 16+ characters in tests/**.
import { addedLines, changedFiles, isMain, lineChanges, resolveRange } from './gitRange.mjs';

export const PIN_FILES = [
  { pattern: /^seeds\/baseline-[^/]+\.json$/, kind: 'guardrail baseline' },
  { pattern: /^perf\/baseline-dgx-[^/]+\.json$/, kind: 'DGX performance baseline' },
  { pattern: /^src\/save\/schemaFingerprint[^/]*\.json$/, kind: 'save schema fingerprint' },
  { pattern: /(^|\/)c25-board[^/]*\.json$/, kind: 'C25 board' },
  { pattern: /^fixtures\/ledger\/world-baseline-[^/]+\.json$/, kind: 'ledger world baseline' },
  { pattern: /^fixtures\/determinism\//, kind: 'determinism fixture' },
  { pattern: /^fixtures\/saves\//, kind: 'baseline save fixture' },
];
const TEST_FILE = /^tests\/.+\.(ts|tsx|mjs|js)$/;
const HASH_LITERAL = /["'`]([0-9a-f]{16,})["'`]/g;
const DECISION_FILE = /^docs\/(decisions\/.+|DECISIONS\.md)$/;

const hashes = lines => lines.flatMap(line => [...line.matchAll(HASH_LITERAL)].map(match => match[1]));

export function checkPinChanges({ base, head, cwd = process.cwd() }) {
  const files = changedFiles(base, head, cwd);
  const pins = [];
  for (const { status, path } of files) {
    const rule = PIN_FILES.find(candidate => candidate.pattern.test(path));
    if (rule) pins.push({ path, kind: rule.kind, how: { A: 'added', M: 'changed', D: 'deleted' }[status[0]] ?? status });
  }
  const testPaths = files.filter(file => file.status !== 'D' && TEST_FILE.test(file.path)).map(file => file.path);
  for (const [path, { removed, added }] of lineChanges(base, head, testPaths, cwd)) {
    const before = hashes(removed); const after = new Set(hashes(added));
    const changed = before.filter(hash => !after.has(hash));
    if (changed.length > 0) pins.push({ path, kind: 'test hash pin', how: `${changed.length} hash literal(s) changed` });
  }
  const decisionPaths = files.filter(file => file.status !== 'D' && DECISION_FILE.test(file.path)).map(file => file.path);
  const decisionText = addedLines(base, head, decisionPaths, cwd).map(row => row.text).join('\n');
  const named = path => {
    const parts = path.split('/');
    const names = [parts.at(-1), path];
    for (let depth = 2; depth < parts.length; depth++) names.push(`${parts.slice(0, depth).join('/')}/`);
    return names.some(name => decisionText.includes(name));
  };
  const missing = pins.filter(pin => !named(pin.path));
  return { pins, missing, decisionFiles: decisionPaths };
}

export function formatPinResult({ pins, missing }) {
  if (pins.length === 0) return 'pins: no pin changed';
  const lines = [`pins: ${pins.length} pin change(s), ${missing.length} without a decision`];
  for (const pin of pins) lines.push(`  ${missing.includes(pin) ? 'MISSING' : 'ok     '} ${pin.path} (${pin.kind}, ${pin.how})`);
  if (missing.length > 0) {
    lines.push('  Add a line to docs/decisions/README.md (or docs/DECISIONS.md) in the same branch that names each file above');
    lines.push('  and says why its recorded value changed (AGENTS.md rule 19).');
  }
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const result = checkPinChanges(resolveRange());
  console.log(formatPinResult(result));
  process.exitCode = result.missing.length > 0 ? 1 : 0;
}
