// Asset inbox ledger (INBOX-1q, AGENTS.md rule 19): node scripts/checks/inboxLedger.mjs [--head <rev>]
// Every path in a row's replaced_by (paths joined with ";") must be the file of another row of
// assets-inbox/INBOX_LEDGER.csv at <head>. A pattern, a typo or a note in place of a path fails. The whole ledger
// is checked, not only the rows the range changed; it is read from git objects, like the other checks.
import { git, isMain, resolveRange } from './gitRange.mjs';

export const LEDGER = 'assets-inbox/INBOX_LEDGER.csv';

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

export function checkInboxLedger({ head, cwd = process.cwd() }) {
  let text;
  try { text = git(['show', `${head}:${LEDGER}`], cwd); } catch { return { present: false, rows: 0, dangling: [] }; }
  const [header, ...rows] = parseCsv(text);
  const fileAt = header.indexOf('file'); const replacedAt = header.indexOf('replaced_by');
  if (fileAt < 0 || replacedAt < 0) throw new Error(`${LEDGER}: no file or replaced_by column`);
  const files = new Set(rows.map(row => row[fileAt]));
  const dangling = [];
  for (const row of rows) {
    const targets = (row[replacedAt] ?? '').split(';').map(target => target.trim()).filter(Boolean);
    for (const target of targets) if (!files.has(target)) dangling.push({ file: row[fileAt], target });
  }
  return { present: true, rows: rows.length, dangling };
}

export function formatLedgerResult({ present, rows, dangling }) {
  if (!present) return `ledger: skipped (${LEDGER} does not exist)`;
  if (dangling.length === 0) return `ledger: ${rows} rows, every replaced_by path is a ledger row`;
  const lines = [`ledger: ${dangling.length} replaced_by path(s) that are not a ledger row`];
  for (const { file, target } of dangling) lines.push(`  MISSING ${file} -> ${target}`);
  lines.push('  Write each replacement as the file path of its own ledger row; join several with ";".');
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const result = checkInboxLedger(resolveRange());
  console.log(formatLedgerResult(result));
  process.exitCode = result.dangling.length > 0 ? 1 : 0;
}
