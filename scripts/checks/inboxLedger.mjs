// Asset inbox ledger (INBOX-1q, INBOX-1y, AGENTS.md rule 19): node scripts/checks/inboxLedger.mjs [--base <rev>] [--head <rev>]
// Reads assets-inbox/INBOX_LEDGER.csv from git objects, like the other checks.
//  1. replaced_by: every path in a row's replaced_by (paths joined with ";") must be the file of another row at
//     <head>. A pattern, a typo or a note in place of a path fails. The whole ledger is checked.
//  2. canonical marks: a verdict_note marker "(정본: <path>)" must name another row with the same sha256. The whole
//     ledger is checked.
//  3. duplicates: a row added base..head whose sha256 equals another row's must carry that marker, or be the row
//     that another same-sha256 row names as its canonical. Existing rows were marked once (INBOX-1y), so only new
//     rows are held to this.
import { git, isMain, resolveRange } from './gitRange.mjs';

export const LEDGER = 'assets-inbox/INBOX_LEDGER.csv';
const CANON = /\(정본: ([^)]+)\)/g;

/** RFC 4180 rows (quoted fields may hold commas, quotes and line breaks); CRLF or LF line ends. */
export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function readLedger(rev, cwd) {
  let text;
  try { text = git(['show', `${rev}:${LEDGER}`], cwd); } catch { return null; }
  const [header, ...rows] = parseCsv(text);
  const at = name => { const i = header.indexOf(name); if (i < 0) throw new Error(`${LEDGER}: no ${name} column`); return i; };
  const [file, sha, replaced, note] = ['file', 'sha256', 'replaced_by', 'verdict_note'].map(at);
  return rows.map(row => ({ file: row[file], sha: row[sha], replacedBy: row[replaced] ?? '', note: row[note] ?? '' }));
}

export function checkInboxLedger({ base, head, cwd = process.cwd() }) {
  const rows = readLedger(head, cwd);
  if (rows === null) return { present: false, rows: 0, dangling: [], badMarks: [], unmarked: [], added: 0 };
  const byFile = new Map(rows.map(row => [row.file, row]));
  const bySha = new Map();
  for (const row of rows) bySha.set(row.sha, [...(bySha.get(row.sha) ?? []), row]);
  const marks = row => [...row.note.matchAll(CANON)].map(match => match[1].trim());

  const dangling = [];
  for (const row of rows) {
    const targets = row.replacedBy.split(';').map(target => target.trim()).filter(Boolean);
    for (const target of targets) if (!byFile.has(target)) dangling.push({ file: row.file, target });
  }
  const badMarks = [];
  const namedCanon = new Set();
  for (const row of rows) {
    for (const target of marks(row)) {
      const canon = byFile.get(target);
      if (canon === undefined || canon === row || canon.sha !== row.sha) badMarks.push({ file: row.file, target, why: canon === undefined ? 'not a ledger row' : canon === row ? 'names itself' : 'different sha256' });
      else namedCanon.add(target);
    }
  }
  const before = base === undefined ? null : readLedger(base, cwd);
  const old = new Set((before ?? []).map(row => row.file));
  const added = rows.filter(row => !old.has(row.file));
  const unmarked = added.filter(row => (bySha.get(row.sha) ?? []).length > 1 && marks(row).length === 0 && !namedCanon.has(row.file))
    .map(row => ({ file: row.file, same: bySha.get(row.sha).filter(other => other !== row).map(other => other.file) }));
  return { present: true, rows: rows.length, dangling, badMarks, unmarked, added: added.length };
}

export const ledgerOk = result => result.dangling.length === 0 && result.badMarks.length === 0 && result.unmarked.length === 0;

export function formatLedgerResult(result) {
  const { present, rows, dangling, badMarks, unmarked, added } = result;
  if (!present) return `ledger: skipped (${LEDGER} does not exist)`;
  if (ledgerOk(result)) return `ledger: ${rows} rows, every replaced_by path is a ledger row, canonical marks match, ${added} new row(s) and none an unmarked duplicate`;
  const lines = [`ledger: ${dangling.length} dangling replaced_by, ${badMarks.length} bad canonical mark(s), ${unmarked.length} new duplicate row(s) without a canonical mark`];
  for (const { file, target } of dangling) lines.push(`  MISSING ${file} -> ${target}`);
  if (dangling.length > 0) lines.push('  Write each replacement as the file path of its own ledger row; join several with ";".');
  for (const { file, target, why } of badMarks) lines.push(`  BADMARK ${file} (정본: ${target}): ${why}`);
  for (const { file, same } of unmarked) lines.push(`  UNMARKED ${file} has the same sha256 as ${same.join(', ')}`);
  if (unmarked.length > 0) lines.push('  Add "<name>와 동일 바이트(정본: <path>)" to its verdict_note; the canonical is the earliest received confirmed row.');
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const result = checkInboxLedger(resolveRange());
  console.log(formatLedgerResult(result));
  process.exitCode = ledgerOk(result) ? 0 : 1;
}
