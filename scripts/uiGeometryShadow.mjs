// RR26 shadow (user rulings 2026-10-10): docs/verification/uiaudit1/SHADOW.md from the shadow records. check:merge
// writes one record per run (scripts/checks/uiGeometryMeasured.mjs shadowStep) on the DGX, ~/fls-runs/_shadow/; only
// the records of commits on the trunk's first-parent line count (check:merge also runs on commits never pushed), the
// newest for a commit. A first-parent stretch no record covers is "판정 불가 (기록 없음)", as is a record without the
// DGX's values ("지문 없음"); both stay out of the evidence. Both directions of a disagreement are tabled: an audit a′
// would have skipped (RR26 감사 필요 / a′ 불필요) is checked for a false pass against the audit the push carried — a new
// failure or an unopened condition the full audit before it did not have; a changed-rows audit counts only for its rows
// (비교한 줄 / 전체 줄) and is checked again at the next full audit — and a′ alone wanting one (RR26 불필요 / a′ 감사
// 필요) has a table of its own. Weekly: the audits a′ would have saved and their DGX time (the carried audits'
// durationS). The promotion is the user's (0 false passes over 2 weeks or 10 disagreeing pushes, and the savings).
//   node scripts/uiGeometryShadow.mjs [--records <dir>] [--trunk <rev>] [--since <rev>] [--out <file>]
// Without --records it reads the DGX's records over ssh. --since defaults to the first-parent commit that added the shadow.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, isMain } from './checks/gitRange.mjs';
import { readJson, reportFailures, rowRunsInRange, UI_GEOMETRY_RUNS, UI_GEOMETRY_SUMMARY } from './checks/uiGeometry.mjs';
import { shadowJudgement } from './checks/uiGeometryMeasured.mjs';

export const SHADOW_FILE = 'docs/verification/uiaudit1/SHADOW.md';
export const SHADOW_MODULE = 'scripts/checks/uiGeometryMeasured.mjs';

/** The records in a folder (one JSON object per file). */
export function loadRecords(dir) {
  let names = []; try { names = readdirSync(dir).filter(name => name.endsWith('.json') && !name.startsWith('_') && !name.startsWith('.')); } catch { return []; }
  return names.flatMap(name => { try { return [JSON.parse(readFileSync(join(dir, name), 'utf8'))]; } catch { return []; } });
}

/** The DGX's records, over ssh. */
export function fetchDgxRecords(env = process.env) {
  const host = env.FLS_REMOTE_HOST ?? 'hyunlord@100.70.109.50';
  const result = spawnSync('ssh', ['-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes', host, 'cd ~/fls-runs/_shadow 2>/dev/null && for f in [0-9a-f]*.json; do [ -f "$f" ] && cat "$f"; done; true'], { encoding: 'utf8', timeout: 60_000, maxBuffer: 256 * 2 ** 20 });
  if (result.status !== 0) throw new Error(`the DGX's shadow records could not be read: ${String(result.stderr).trim() || result.error?.message}`);
  return result.stdout.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}

/** Conditions (row|condition) of a report neither measured nor unreachable by design. */
const unopened = report => Object.entries(report?.rows ?? {}).flatMap(([row, entry]) => Object.entries(entry?.conditions ?? {})
  .filter(([, record]) => record?.status !== 'measured' && record?.status !== 'unreachable').map(([condition]) => `${row}|${condition}`));

/**
 * What a reference full audit's report lacks that `reports` show, on the rows they measured: new failure keys and
 * conditions not opened that it opened. { rows: rows compared, total: the reference's rows, failures, unopened }.
 */
export function compareWithFull(reference, reports) {
  const before = new Set(reportFailures(reference).keys); const openedBefore = reportFailures(reference).measured;
  const rows = new Set(); const failures = []; const notOpened = [];
  for (const report of reports) {
    const { keys, measured } = reportFailures(report);
    for (const row of Object.keys(report?.rows ?? {})) rows.add(row);
    for (const key of keys) if (!before.has(key)) failures.push(key);
    for (const cell of unopened(report)) { const [row, condition] = cell.split('|'); if (openedBefore.get(row)?.has(condition) === true && !measured.get(row)?.has(condition)) notOpened.push(cell); }
  }
  return { rows: rows.size, total: Object.keys(reference?.rows ?? {}).length, failures: [...new Set(failures)].sort(), unopened: [...new Set(notOpened)].sort() };
}

/** The audit a push (base..head) carried: a new full shared result, or the changed-rows runs its trailers name, or none. */
export function auditCarried({ base, head, cwd = process.cwd() }) {
  const before = readJson(base, UI_GEOMETRY_SUMMARY, cwd); const after = readJson(head, UI_GEOMETRY_SUMMARY, cwd);
  const reference = before?.full === true && typeof before.report === 'string' ? readJson(base, before.report, cwd) : null;
  if (after?.full === true && after.run !== before?.run && typeof after.report === 'string') {
    const report = readJson(head, after.report, cwd);
    return { kind: 'full', runs: [after.run], durationS: report?.durationS ?? null, reference: before?.run ?? null, comparison: reference && report ? compareWithFull(reference, [report]) : null };
  }
  const runs = rowRunsInRange(base, head, cwd);
  if (runs.length === 0) return { kind: 'none', runs: [], durationS: null, reference: before?.run ?? null, comparison: null };
  const reports = runs.map(run => readJson(head, `${UI_GEOMETRY_RUNS}/${run}/geometry.json`, cwd)).filter(Boolean);
  return { kind: 'rows', runs, durationS: reports.reduce((sum, report) => sum + (report.durationS ?? 0), 0), reference: before?.run ?? null,
    comparison: reference ? compareWithFull(reference, reports) : null };
}

/** The judgement of a record (recomputed: a DGX record carries the inputs, a local one also the judgement). */
export const judgementOf = record => shadowJudgement({ gate: { unchanged: record.rr26?.needed === false },
  range: { status: record.measured?.status ?? 'none', why: record.measured?.why ?? 'no measured inputs in the record', changed: record.measured?.changed ?? null, files: record.measured?.files ?? [], shared: record.shared ?? null },
  fingerprint: record.fingerprint ?? null });

/** The first-parent commit that added the shadow (the start of the records). */
export function shadowStart(trunk, cwd = process.cwd()) {
  const added = git(['log', '--first-parent', '--format=%H', '--diff-filter=A', trunk, '--', SHADOW_MODULE], cwd).split('\n').filter(Boolean);
  return added.at(-1) ?? null;
}

/**
 * The pushes since `since` on the trunk's first-parent line: { pushes: [{ head, base, record, judgement, carried,
 * recheck }], unrecorded: [[commits…]…], fullAudits: [{ commit, run }] }.
 */
export function shadowHistory({ records, trunk, since, cwd = process.cwd() }) {
  const line = git(['rev-list', '--first-parent', '--reverse', trunk, '--not', `${since}^`], cwd).split('\n').filter(Boolean);
  const onLine = new Set(line);
  const newest = new Map();
  for (const record of records) {
    if (record?.kind !== 'ui-geometry-shadow' || !onLine.has(record.head)) continue;
    if (!newest.has(record.head) || String(newest.get(record.head).time) < String(record.time)) newest.set(record.head, record);
  }
  const covered = new Set(); const pushes = [];
  for (const head of line) {
    const record = newest.get(head); if (record === undefined) continue;
    const range = record.base ? git(['rev-list', '--first-parent', `${record.base}..${head}`], cwd).split('\n').filter(Boolean) : [head];
    for (const commit of range) covered.add(commit);
    const judgement = judgementOf(record);
    pushes.push({ head, base: record.base, record, judgement, carried: judgement.direction === 'saved' && record.base ? auditCarried({ base: record.base, head, cwd }) : null, recheck: null });
  }
  const unrecorded = []; let stretch = [];
  for (const commit of line) { if (covered.has(commit)) { if (stretch.length > 0) unrecorded.push(stretch); stretch = []; } else stretch.push(commit); }
  if (stretch.length > 0) unrecorded.push(stretch);
  // The full shared results along the line, to check the skipped audits again at the next full audit.
  const fullAudits = []; let last = null;
  for (const commit of line) { const summary = readJson(commit, UI_GEOMETRY_SUMMARY, cwd); if (summary?.full === true && summary.run !== last) { fullAudits.push({ commit, run: summary.run, report: summary.report }); last = summary.run; } }
  for (const push of pushes) {
    if (push.judgement.direction !== 'saved' || push.carried?.kind === 'full') continue;
    const at = line.indexOf(push.head);
    const next = fullAudits.find(full => line.indexOf(full.commit) > at && full.run !== push.carried?.reference);
    if (next === undefined) { push.recheck = { status: 'pending' }; continue; }
    const before = readJson(push.base, UI_GEOMETRY_SUMMARY, cwd);
    const reference = before?.report ? readJson(push.base, before.report, cwd) : null; const report = readJson(next.commit, next.report, cwd);
    push.recheck = reference && report ? { status: 'checked', run: next.run, ...compareWithFull(reference, [report]) } : { status: 'unreadable', run: next.run };
  }
  return { since, trunk: line.at(-1) ?? null, pushes, unrecorded, fullAudits };
}

const short = commit => String(commit ?? '').slice(0, 8);
const minutes = seconds => seconds === null || seconds === undefined ? '—' : `${Math.round(seconds / 60)}분`;
const weekOf = time => { const day = new Date(time); const monday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - ((day.getUTCDay() + 6) % 7))); return monday.toISOString().slice(0, 10); };
const list = (items, n = 3) => items.length === 0 ? '없음' : `${items.slice(0, n).map(item => `\`${item}\``).join(', ')}${items.length > n ? ` 외 ${items.length - n}` : ''}`;

/** A pushed audit's false-pass verdict (or the reason there is none). */
const falsePass = carried => carried === null ? '—' : carried.kind === 'none' ? '감사 없이 들어감(덮어쓰기?)' : carried.comparison === null ? '비교 불가(이전 전체 감사 없음)'
  : carried.comparison.failures.length + carried.comparison.unopened.length > 0 ? `**거짓 통과**: 새 실패 ${list(carried.comparison.failures)}, 못 연 조건 ${list(carried.comparison.unopened)}` : '없음';

export function formatShadowMarkdown(history) {
  const { pushes, unrecorded } = history;
  const by = direction => pushes.filter(push => push.judgement.direction === direction);
  const saved = by('saved'); const aprimeOnly = by('aprime-only');
  const undecidable = pushes.filter(push => push.judgement.aprime === 'undecidable'); const fallback = pushes.filter(push => push.judgement.aprime === 'fallback');
  const agree = pushes.filter(push => push.judgement.direction === null && !['undecidable', 'fallback'].includes(push.judgement.aprime));
  const falsePasses = saved.filter(push => (push.carried?.comparison && push.carried.comparison.failures.length + push.carried.comparison.unopened.length > 0)
    || (push.recheck?.status === 'checked' && push.recheck.failures.length + push.recheck.unopened.length > 0));
  const days = pushes.length === 0 ? 0 : Math.floor((Date.parse(pushes.at(-1).record.time) - Date.parse(pushes[0].record.time)) / 86_400_000);
  const lines = ['# RR26 그림자 기록 (a′)', '',
    '사용자 결정(2026-10-10): 관문의 판정은 RR26 안전 목록 그대로이고, a′(측정한 입력)의 판정은 계산해서 기록만 한다. 이 문서는 `node scripts/uiGeometryShadow.mjs`가 DGX의 실행 기록(`~/fls-runs/_shadow/`, check:merge 한 번에 파일 하나)에서 만든다 — 손으로 고치지 않는다.', '',
    '- 본선(first-parent)에 들어간 커밋의 기록만 센다. 같은 커밋의 기록이 여럿이면 가장 늦은 것.',
    '- **판정 불가**: 기록이 없는 본선 구간, 또는 DGX 지문(상태 폴더·Chromium·Playwright·node·시스템 파일·node_modules)을 못 받은 기록. 승격 근거에서 뺀다.',
    '- **안전 목록 대체**: 밑의 공용 결과에 쓸 수 있는 측정 입력이 없어(없음·깨짐·추적 불가·이미 낡음) a′도 안전 목록으로 판정한 푸시. 정의상 RR26과 같다.',
    '- **거짓 통과 확인**: a′라면 건너뛰었을 감사를 푸시가 실제로 가져왔을 때, 그 감사에 앞선 전체 감사에 없던 새 실패나 못 연 조건이 있으면 a′의 거짓 통과다. 바뀐 줄 감사는 그 줄만 비교하고(비교한 줄 / 전체 줄), 다음 전체 감사가 돌면 그 결과로 다시 확인한다. 푸시 전에 실패해 고친 감사는 여기서 보이지 않는다.', '',
    `기간: ${short(history.since)}..${short(history.trunk)} · 기록된 푸시 ${pushes.length}개(${days}일) · 판정 일치 ${agree.length} · **RR26 감사 필요 / a′ 불필요 ${saved.length}** · **RR26 불필요 / a′ 감사 필요 ${aprimeOnly.length}** · 안전 목록 대체 ${fallback.length} · 판정 불가: 지문 없음 ${undecidable.length}, 기록 없는 구간 ${unrecorded.length}개(커밋 ${unrecorded.reduce((sum, stretch) => sum + stretch.length, 0)}개)`, '',
    `승격 기준(사용자 결정): 2주 또는 엇갈린 푸시 10개 동안 거짓 통과 0, 그리고 의미 있는 절감. 현재: 엇갈린 푸시(a′가 건너뛰었을 감사) ${saved.length}개, 거짓 통과 ${falsePasses.length}개, ${days}일.`, '',
    '## RR26 감사 필요 / a′ 불필요 — a′가 아꼈을 감사', '',
    '| 푸시(본선) | 시각 | 세션 | 바뀐 파일 | 가져온 감사 | 비교한 줄 / 전체 줄 | 거짓 통과 | 다음 전체 감사로 다시 확인 |', '|---|---|---|---|---|---|---|---|'];
  for (const push of saved) {
    const carried = push.carried; const comparison = carried?.comparison;
    const recheck = push.recheck === null ? (carried?.kind === 'full' ? '전체 감사로 비교함' : '—') : push.recheck.status === 'pending' ? '대기'
      : push.recheck.status === 'unreadable' ? `${push.recheck.run}: 읽지 못함` : push.recheck.failures.length + push.recheck.unopened.length > 0 ? `**${push.recheck.run}: 새 실패 ${list(push.recheck.failures)}, 못 연 조건 ${list(push.recheck.unopened)}**` : `${push.recheck.run}: 깨끗함`;
    lines.push(`| ${short(push.head)} | ${push.record.time.slice(0, 16).replace('T', ' ')} | ${push.record.session} | ${push.judgement.changed ?? '—'} | ${carried === null ? '—' : carried.kind === 'none' ? '없음' : `${carried.kind === 'full' ? '전체' : '바뀐 줄'}: ${carried.runs.join(', ')} (${minutes(carried.durationS)})`} | ${comparison ? `${comparison.rows} / ${comparison.total}` : '—'} | ${falsePass(carried)} | ${recheck} |`);
  }
  if (saved.length === 0) lines.push('| (없음) | | | | | | | |');
  lines.push('', '## RR26 불필요 / a′ 감사 필요 — RR26의 빈틈일 수 있는 것 (한 건이라도 사용자에게 바로 알린다)', '', '| 푸시(본선) | 시각 | 세션 | a′의 까닭 |', '|---|---|---|---|');
  for (const push of aprimeOnly) lines.push(`| ${short(push.head)} | ${push.record.time.slice(0, 16).replace('T', ' ')} | ${push.record.session} | ${push.judgement.why.replace(/\|/g, '\\|')} |`);
  if (aprimeOnly.length === 0) lines.push('| (없음) | | | |');
  lines.push('', '## 주별 절감', '', '| 주(월요일) | 기록된 푸시 | a′가 아꼈을 감사 | 그 DGX 시간 | a′만 감사 필요 | 판정 불가(지문 없음) |', '|---|---|---|---|---|---|');
  const weeks = new Map();
  for (const push of pushes) {
    const week = weekOf(push.record.time); if (!weeks.has(week)) weeks.set(week, { pushes: 0, saved: 0, seconds: 0, aprimeOnly: 0, undecidable: 0 });
    const row = weeks.get(week); row.pushes += 1;
    if (push.judgement.direction === 'saved') { row.saved += 1; row.seconds += push.carried?.durationS ?? 0; }
    if (push.judgement.direction === 'aprime-only') row.aprimeOnly += 1;
    if (push.judgement.aprime === 'undecidable') row.undecidable += 1;
  }
  for (const [week, row] of [...weeks].sort()) lines.push(`| ${week} | ${row.pushes} | ${row.saved} | ${minutes(row.seconds)} | ${row.aprimeOnly} | ${row.undecidable} |`);
  if (weeks.size === 0) lines.push('| (없음) | | | | | |');
  lines.push('', '## 판정 불가', '', '| 구분 | 커밋 | 까닭 |', '|---|---|---|');
  for (const stretch of unrecorded) lines.push(`| 기록 없는 구간 | ${short(stretch[0])}${stretch.length > 1 ? `..${short(stretch.at(-1))} (${stretch.length}개)` : ''} | check:merge의 그림자 기록이 DGX에 없음 |`);
  for (const push of undecidable) lines.push(`| 지문 없음 | ${short(push.head)} | ${String(push.record.fingerprintError ?? 'DGX 지문을 받지 못함').replace(/\|/g, '\\|')} |`);
  if (unrecorded.length + undecidable.length === 0) lines.push('| (없음) | | |');
  return `${lines.join('\n')}\n`;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2); const flag = name => { const at = args.indexOf(name); return at === -1 ? null : args[at + 1]; };
  const cwd = git(['rev-parse', '--show-toplevel']).trim();
  const trunk = flag('--trunk') ?? 'origin/codex/phase15-organic-ground';
  const given = flag('--since');
  const since = given !== null ? execFileSync('git', ['rev-parse', given], { cwd, encoding: 'utf8' }).trim() : shadowStart(trunk, cwd);
  if (since === null) { console.error(`uiGeometryShadow: ${SHADOW_MODULE} is not on ${trunk}'s first-parent line yet (--since <rev>)`); process.exit(2); }
  const records = flag('--records') !== null ? loadRecords(flag('--records')) : fetchDgxRecords();
  const out = flag('--out') ?? join(cwd, SHADOW_FILE);
  const history = shadowHistory({ records, trunk: execFileSync('git', ['rev-parse', trunk], { cwd, encoding: 'utf8' }).trim(), since, cwd });
  writeFileSync(out, formatShadowMarkdown(history));
  console.log(`shadow: ${history.pushes.length} recorded push(es), ${history.pushes.filter(push => push.judgement.direction === 'saved').length} audit(s) a′ would have skipped, ${history.pushes.filter(push => push.judgement.direction === 'aprime-only').length} a′ alone wanted, ${history.unrecorded.length} unrecorded stretch(es) → ${out}`);
}
