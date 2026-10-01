// Decision IDs are unique (user instruction 2026-10-01): two rows of docs/decisions/README.md with the same ID fail the
// merge check. Sessions add IDs concurrently (RR4 and RR5 were taken twice in one day), and a merge can keep both an
// old and an updated copy of one row (FX7-1, merge e1b8119c). Reads <head>'s file from git objects.
// An ID is the first cell of a table row shaped like one (letters, digits, "-", "~", "·": FX7-1, RR7, INSTALL27-D1~D4);
// header rows ("번호") and separators are not IDs.
import { execFileSync } from 'node:child_process';

export const DECISIONS_FILE = 'docs/decisions/README.md';
const ID = /^[A-Z][A-Za-z0-9]*(?:[-~·][A-Za-z0-9]+)*$/;

/** Map of ID → line numbers (1-based) for every ID that appears on more than one row. */
export function duplicateDecisionIds(text) {
  const lines = new Map();
  text.split('\n').forEach((line, index) => {
    const cell = /^\|\s*([^|]+?)\s*\|/.exec(line)?.[1];
    if (cell === undefined || !ID.test(cell)) return;
    lines.set(cell, [...(lines.get(cell) ?? []), index + 1]);
  });
  return new Map([...lines].filter(([, at]) => at.length > 1));
}

export function checkDecisionIds({ head, cwd = process.cwd() }) {
  let text;
  try { text = execFileSync('git', ['show', `${head}:${DECISIONS_FILE}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 2 ** 20 }); } catch { return { duplicates: new Map() }; }
  return { duplicates: duplicateDecisionIds(text) };
}

export function formatDecisionIdResult({ duplicates }) {
  if (duplicates.size === 0) return `decision ids: no duplicates in ${DECISIONS_FILE}`;
  return [`decision ids: FAILED — ${duplicates.size} duplicated in ${DECISIONS_FILE} (give the later one a new ID, or drop a stale copy of the same row):`,
    ...[...duplicates].map(([id, at]) => `  ${id}: lines ${at.join(', ')}`)].join('\n');
}
