// Evidence folders stay within 3 MB (AGENTS.md standing rule 1, decision RR10): every docs/verification/<task>/ folder
// a range touches must hold at most 3 MiB (3 × 2^20 bytes, the unit `du -h` shows) at <head>. NAT-4 nearly merged
// 17 MB of regression-bundle output that no check saw (2026-10-02).
// Not counted: replay captures (rule 1: "재플레이 캡처 별도" — any path with "replay" in it) and the committed DGX
// ui-geometry results docs/verification/uiaudit1/geometry/, which check:merge itself reads and which grow by one run
// per UI task, and the perf-trend page docs/verification/perf-trend/ (generated per trunk commit, ~10 KB each; the
// post-merge hook commits it). Git LFS files count at their real size (the pointer's "size" line).
// Folders already over the limit are listed in evidence-size-baseline.json with their size then; they may not grow
// past it, and the list only shrinks. Reads git objects only.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedFiles } from './gitRange.mjs';

export const EVIDENCE_ROOT = 'docs/verification';
export const EVIDENCE_LIMIT_BYTES = 3 * 2 ** 20;
export const EVIDENCE_BASELINE_FILE = join(dirname(fileURLToPath(import.meta.url)), 'evidence-size-baseline.json');
const EXEMPT = [/^docs\/verification\/uiaudit1\/geometry\//, /^docs\/verification\/perf-trend\//, /replay/i];

/** docs/verification/<task> for a path inside a task folder, else null (files right under docs/verification). */
export function evidenceFolder(path) {
  const parts = path.split('/');
  return parts.length >= 4 && `${parts[0]}/${parts[1]}` === EVIDENCE_ROOT ? parts.slice(0, 3).join('/') : null;
}

export const isExempt = path => EXEMPT.some(rule => rule.test(path));

/** Counted files of a folder at <rev>: [{ path, bytes }] (LFS pointers at their real size), largest first. */
export function folderFiles(rev, folder, cwd = process.cwd()) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 2 ** 20 });
  const rows = git(['ls-tree', '-r', '-l', '-z', rev, '--', `${folder}/`]).split('\0').filter(Boolean).map(row => {
    const [meta, path] = row.split('\t'); const [, , object, size] = meta.split(/\s+/);
    return { path, object, bytes: Number(size) };
  }).filter(row => !isExempt(row.path));
  for (const row of rows) {
    if (row.bytes > 1024) continue;
    const size = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\n(?:.*\n)*?size (\d+)/.exec(git(['cat-file', '-p', row.object]))?.[1];
    if (size !== undefined) row.bytes = Number(size);
  }
  return rows.map(({ path, bytes }) => ({ path, bytes })).sort((a, b) => b.bytes - a.bytes);
}

export function loadEvidenceBaseline(path = EVIDENCE_BASELINE_FILE) {
  return JSON.parse(readFileSync(path, 'utf8')).folders;
}

/** { folders: [{ folder, bytes, allowed, files }], over: [...] } for the task folders base..head touches. */
export function checkEvidenceSize({ base, head, cwd = process.cwd(), baseline = loadEvidenceBaseline(), limit = EVIDENCE_LIMIT_BYTES }) {
  const touched = [...new Set(changedFiles(base, head, cwd).map(file => evidenceFolder(file.path)).filter(folder => folder !== null))].sort();
  const folders = touched.map(folder => {
    const files = folderFiles(head, folder, cwd);
    const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
    return { folder, bytes, allowed: Math.max(limit, baseline[folder] ?? 0), files };
  }).filter(row => row.files.length > 0);
  return { folders, over: folders.filter(row => row.bytes > row.allowed) };
}

const mib = bytes => `${(bytes / 2 ** 20).toFixed(2)} MB`;

export function formatEvidenceResult({ folders, over }) {
  if (folders.length === 0) return 'evidence: no docs/verification/<task>/ folder changed';
  if (over.length === 0) return `evidence: ${folders.length} folder(s) changed, each within its limit (${folders.map(row => `${row.folder.slice(EVIDENCE_ROOT.length + 1)} ${mib(row.bytes)}`).join(', ')}; 3 MB = 3 × 2^20 bytes)`;
  return [`evidence: FAILED — ${over.length} evidence folder(s) over 3 MB (AGENTS.md rule 1; replay captures, uiaudit1/geometry and perf-trend not counted):`,
    ...over.flatMap(row => [`  ${row.folder} ${mib(row.bytes)} > ${mib(row.allowed)}; largest:`,
      ...row.files.slice(0, 5).map(file => `    ${mib(file.bytes)} ${file.path}`)]),
    '  Keep summaries and a few JPEGs; leave bulk output out of git (or in .remote-runs) and say where it is in the report.'].join('\n');
}
