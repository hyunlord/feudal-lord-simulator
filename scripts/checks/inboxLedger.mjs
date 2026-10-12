// Asset inbox ledger (INBOX-1q, INBOX-1y, AGENTS.md rule 19): node scripts/checks/inboxLedger.mjs [--base <rev>] [--head <rev>]
// Reads assets-inbox/INBOX_LEDGER.csv from git objects, like the other checks.
//  1. replaced_by: every path in a row's replaced_by (paths joined with ";") must be the file of another row at
//     <head>. A pattern, a typo or a note in place of a path fails. The whole ledger is checked.
//  2. canonical marks: a verdict_note marker "(정본: <path>)" must name another row with the same sha256. The whole
//     ledger is checked.
//  3. duplicates: a row added base..head whose sha256 equals another row's must carry that marker, or be the row
//     that another same-sha256 row names as its canonical. Existing rows were marked once (INBOX-1y), so only new
//     rows are held to this.
//  4. one row per image: when base..head touches anything under assets-inbox/ (any session; adding, moving, deleting,
//     or the ledger itself), the image files under assets-inbox/ at <head> (.png .jpg .jpeg .webp .gif .svg) and the
//     ledger's file column must be the same set — an image without a row, or a row whose file is gone, fails
//     (docs/ASSET_INBOX.md: rows = images). Added 2026-10-03 after 11ca755e moved 8 retired sprites into
//     assets-inbox/retired/ without rows and passed; the GIF/WebP/SVG records counted from the same day.
//  5. storage of new images (same trigger): a JPG/JPEG added under assets-inbox/ base..head must be a Git LFS pointer
//     (.gitattributes keeps 27 batch folders of JPGs received before 2026-10-03 as plain files, and a new JPG put into
//     one of them would land as plain bytes too); an added image of any kind over 1 MB (2^20) that is not LFS is a
//     warning. A file whose bytes were already under assets-inbox/ at <base> (a move or a copy) is not new.
//  6. form (user order 2026-10-08, decision RR11): every row of the ledger ends in CRLF, the last one too, and the rows
//     after the header are in byte order of the file column (what `LC_ALL=C sort` gives). Render B's install commits
//     wrote rows with LF and appended them at the end (80 LF lines and 45 rows out of order at 2b6d820c). A range that
//     changes the ledger fails on it; otherwise it is a warning (someone else's ledger work does not stop a push).
//     `node scripts/checks/inboxLedger.mjs --fix-form` rewrites the working-tree ledger in that form, changing
//     nothing but the order of the rows and their line ends.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gitPaths } from '../gitPaths.mjs';
import { changedFiles, git, isMain, resolveRange } from './gitRange.mjs';

export const LEDGER = 'assets-inbox/INBOX_LEDGER.csv';
const CANON = /\(정본: ([^)]+)\)/g;
const INBOX = 'assets-inbox/';
const IMAGE = /\.(png|jpe?g|webp|gif|svg)$/i;
const JPEG = /\.jpe?g$/i;
export const LARGE_PLAIN_BYTES = 2 ** 20;
const LFS_HEADER = 'version https://git-lfs.github.com/spec/v1';

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

/** The ledger's records as written: { line (1-based, of its first line), text (without its line end), end ("\r\n",
 *  "\n" or "" for a last line without one) }. A line break inside a quoted field stays inside its record. */
export function ledgerRecords(text) {
  const records = []; let start = 0; let line = 1; let startLine = 1; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    else if (c === '\n') {
      if (!quoted) {
        const cr = i > start && text[i - 1] === '\r';
        records.push({ line: startLine, text: text.slice(start, cr ? i - 1 : i), end: cr ? '\r\n' : '\n' });
        start = i + 1; startLine = line + 1;
      }
      line++;
    }
  }
  if (start < text.length) records.push({ line: startLine, text: text.slice(start), end: '' });
  return records;
}
const fileOf = (record, column) => parseCsv(record.text)[0]?.[column] ?? '';
const byteOrder = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

/** Check 6: the rows that do not end in CRLF ({ line }) and the rows out of byte order of the file column
 *  ({ line, file, after }). */
export function ledgerForm(text) {
  const records = ledgerRecords(text);
  const column = (parseCsv(records[0]?.text ?? '')[0] ?? []).indexOf('file');
  const notCrlf = records.filter(record => record.end !== '\r\n').map(record => record.line);
  const unsorted = [];
  for (let i = 2; i < records.length; i++) {
    const after = fileOf(records[i - 1], column); const file = fileOf(records[i], column);
    if (byteOrder(after, file) > 0) unsorted.push({ line: records[i].line, file, after });
  }
  return { notCrlf, unsorted };
}

/** The ledger in check 6's form: the header, then the rows sorted by the file column (byte order, stable), every one
 *  ending in CRLF. Nothing else changes. */
export function fixLedgerForm(text) {
  const [header, ...rows] = ledgerRecords(text);
  if (header === undefined) return text;
  const column = (parseCsv(header.text)[0] ?? []).indexOf('file');
  const sorted = rows.filter(row => row.text !== '').map((row, i) => ({ row, i, file: fileOf(row, column) }))
    .sort((a, b) => byteOrder(a.file, b.file) || a.i - b.i).map(entry => entry.row);
  return [header, ...sorted].map(record => `${record.text}\r\n`).join('');
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
  if (rows === null) return { present: false, rows: 0, dangling: [], badMarks: [], unmarked: [], added: 0, images: null, unledgered: [], fileless: [], plainJpegs: [], largePlain: [], form: { notCrlf: [], unsorted: [], strict: false } };
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
  const changed = base === undefined ? null : changedFiles(base, head, cwd).filter(file => file.path.startsWith(INBOX));
  const files = changed === null || changed.length > 0 ? inboxImages(head, cwd) : null;
  const unledgered = files === null ? [] : files.filter(file => !byFile.has(file));
  const present = new Set(files ?? []);
  const fileless = files === null ? [] : rows.map(row => row.file).filter(file => !present.has(file));
  const { plainJpegs, largePlain } = changed === null ? { plainJpegs: [], largePlain: [] } : newImageStorage(base, head, changed, cwd);
  // Check 6 binds a range that changes the ledger (or a run without a base); for the others it is a warning.
  const form = { ...ledgerForm(git(['show', `${head}:${LEDGER}`], cwd)), strict: changed === null || changed.some(file => file.path === LEDGER) };
  return { present: true, rows: rows.length, dangling, badMarks, unmarked, added: added.length, images: files === null ? null : files.length, unledgered, fileless, plainJpegs, largePlain, form };
}

/** Images added base..head under assets-inbox/ whose bytes are new there: JPG/JPEG stored without LFS (plainJpegs) and
 *  any image over LARGE_PLAIN_BYTES stored without LFS (largePlain, { file, bytes }). */
export function newImageStorage(base, head, changed, cwd) {
  const addedPaths = new Set(changed.filter(file => file.status === 'A' && IMAGE.test(file.path)).map(file => file.path));
  if (addedPaths.size === 0) return { plainJpegs: [], largePlain: [] };
  const tree = rev => gitPaths(['ls-tree', '-r', '-l', '-z', rev, '--', INBOX], { cwd }).map(row => {
    const [meta, path] = row.split('\t'); const [, , object, size] = meta.split(/\s+/); return { path, object, bytes: Number(size) };
  });
  const before = new Set(tree(base).map(entry => entry.object));
  const fresh = tree(head).filter(entry => addedPaths.has(entry.path) && !before.has(entry.object));
  const small = fresh.filter(entry => entry.bytes < 1024);
  const pointers = new Set();
  if (small.length > 0) {
    const out = execFileSync('git', ['cat-file', '--batch'], { cwd, input: small.map(entry => entry.object).join('\n') + '\n', encoding: 'utf8', maxBuffer: 64 * 2 ** 20 });
    for (const entry of small) {
      const at = out.indexOf(`${entry.object} blob `);
      if (at >= 0 && out.slice(out.indexOf('\n', at) + 1).startsWith(LFS_HEADER)) pointers.add(entry.object);
    }
  }
  const relative = path => path.slice(INBOX.length);
  return {
    plainJpegs: fresh.filter(entry => JPEG.test(entry.path) && !pointers.has(entry.object)).map(entry => relative(entry.path)),
    largePlain: fresh.filter(entry => entry.bytes > LARGE_PLAIN_BYTES && !pointers.has(entry.object)).map(entry => ({ file: relative(entry.path), bytes: entry.bytes })),
  };
}

/** Image paths (.png .jpg .jpeg .webp .gif .svg) under assets-inbox/ at <rev>, relative to it as the ledger writes them. */
export function inboxImages(rev, cwd) {
  return gitPaths(['ls-tree', '-r', '--name-only', '-z', rev, '--', INBOX], { cwd })
    .filter(path => path.startsWith(INBOX) && IMAGE.test(path)).map(path => path.slice(INBOX.length));
}

const formOk = form => form === undefined || form.notCrlf.length + form.unsorted.length === 0;
export const ledgerOk = result => result.dangling.length === 0 && result.badMarks.length === 0 && result.unmarked.length === 0
  && result.unledgered.length === 0 && result.fileless.length === 0 && result.plainJpegs.length === 0
  && (formOk(result.form) || !result.form.strict);

/** Check 6's lines: what is out of form, and how to fix it. */
function formLines(form, prefix) {
  if (formOk(form)) return [];
  const some = (list, show) => list.slice(0, 8).map(show).join(', ') + (list.length > 8 ? `, … ${list.length - 8} more` : '');
  const lines = [];
  if (form.notCrlf.length > 0) lines.push(`${prefix}FORM ${form.notCrlf.length} row(s) of ${LEDGER} end in LF, not CRLF: line ${some(form.notCrlf, line => line)}`);
  if (form.unsorted.length > 0) lines.push(`${prefix}FORM ${form.unsorted.length} row(s) out of the file column's byte order: ${some(form.unsorted, ({ line, file, after }) => `line ${line} ${file} (after ${after})`)}`);
  lines.push(`${prefix}  The ledger keeps every row ending in CRLF and its rows sorted by file (byte order, as LC_ALL=C sort); a new row goes in its place, not at the end (decision RR11).`);
  lines.push(`${prefix}  Fix: node scripts/checks/inboxLedger.mjs --fix-form   (rewrites ${LEDGER}: header first, rows sorted by file, CRLF line ends; nothing else changes — git diff --stat shows only the moved and re-ended rows), then commit it.`);
  lines.push(`${prefix}  Or by hand (Mac or Linux; no field before file holds a comma): f=${LEDGER}; { head -n 1 "$f" | tr -d '\\r'; tail -n +2 "$f" | tr -d '\\r' | LC_ALL=C sort -t, -k2,2; } | awk '{ printf "%s\\r\\n", $0 }' > "$f.tmp" && mv "$f.tmp" "$f"`);
  return lines;
}

export function formatLedgerResult(result) {
  const { present, rows, dangling, badMarks, unmarked, added, images, unledgered, fileless, plainJpegs, largePlain } = result;
  if (!present) return `ledger: skipped (${LEDGER} does not exist)`;
  const count = images === null ? 'no assets-inbox change, rows = images not checked' : `${images} image(s) under assets-inbox/`;
  // A warning, not a failure: a large new image stored as plain bytes (every clone carries it in full).
  const warnings = largePlain.map(({ file, bytes }) => `  warning: ${file} is ${(bytes / 2 ** 20).toFixed(2)} MB and not in Git LFS — add its folder's pattern to .gitattributes (filter=lfs)`);
  // Check 6 out of form in a range that leaves the ledger alone: a warning (it fails the push that changes the ledger).
  const form = result.form ?? { notCrlf: [], unsorted: [], strict: false };
  if (!form.strict) warnings.push(...formLines(form, '  warning: '));
  if (ledgerOk(result)) return [`ledger: ${rows} rows, ${count}${images === null ? '' : ', one row each'}, every replaced_by path is a ledger row, canonical marks match, ${added} new row(s) and none an unmarked duplicate`, ...warnings].join('\n');
  const lines = [`ledger: ${rows} rows vs ${count}: ${unledgered.length} image(s) without a row, ${fileless.length} row(s) without a file, ${plainJpegs.length} new JPG(s) outside LFS, ${dangling.length} dangling replaced_by, ${badMarks.length} bad canonical mark(s), ${unmarked.length} new duplicate row(s) without a canonical mark, ${form.strict ? form.notCrlf.length + form.unsorted.length : 0} row(s) out of form`];
  if (form.strict) lines.push(...formLines(form, '  '));
  for (const file of unledgered) lines.push(`  NOROW ${file}`);
  if (unledgered.length > 0) lines.push(`  Every image (png, jpg, jpeg, webp, gif, svg) under assets-inbox/ has one ledger row (wave, file, sha256, status…), retired or moved files too (docs/ASSET_INBOX.md).`);
  for (const file of fileless) lines.push(`  NOFILE ${file}`);
  if (fileless.length > 0) lines.push('  Inbox files are never deleted or overwritten; a moved file takes its row along (change the row\'s file).');
  for (const file of plainJpegs) lines.push(`  NOTLFS ${file}`);
  if (plainJpegs.length > 0) lines.push('  New inbox JPG/JPEGs go through Git LFS. The 27 folders that .gitattributes keeps plain (!filter) hold only the JPGs received before 2026-10-03: put new ones in a new batch folder, or narrow that folder\'s exception to the old files; then git rm --cached and git add the file again.');
  for (const { file, target } of dangling) lines.push(`  MISSING ${file} -> ${target}`);
  if (dangling.length > 0) lines.push('  Write each replacement as the file path of its own ledger row; join several with ";".');
  for (const { file, target, why } of badMarks) lines.push(`  BADMARK ${file} (정본: ${target}): ${why}`);
  for (const { file, same } of unmarked) lines.push(`  UNMARKED ${file} has the same sha256 as ${same.join(', ')}`);
  if (unmarked.length > 0) lines.push('  Add "<name>와 동일 바이트(정본: <path>)" to its verdict_note; the canonical is the row a runtime manifest or docs/provenance/assets.csv points at, else the earliest received confirmed row (docs/ASSET_INBOX.md section 2).');
  return [...lines, ...warnings].join('\n');
}

if (isMain(import.meta.url) && process.argv.includes('--fix-form')) {
  const before = readFileSync(LEDGER, 'utf8');
  const after = fixLedgerForm(before);
  const { notCrlf, unsorted } = ledgerForm(before);
  if (after === before) console.log(`${LEDGER}: already in form (CRLF, sorted by file)`);
  else { writeFileSync(LEDGER, after); console.log(`${LEDGER}: rewritten — ${notCrlf.length} line end(s) made CRLF, ${unsorted.length} row(s) that were out of order put in place; check git diff --stat, then commit`); }
} else if (isMain(import.meta.url)) {
  const result = checkInboxLedger(resolveRange());
  console.log(formatLedgerResult(result));
  process.exitCode = ledgerOk(result) ? 0 : 1;
}
