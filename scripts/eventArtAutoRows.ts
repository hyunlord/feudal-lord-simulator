/**
 * EVA-AUTO (user order 2026-10-06): what `npm run eventart:auto` writes, and the relation the tests hold it to, as pure
 * functions of the registry's entries, the picture manifest and the capture record — all passed in, so a fixture registry
 * with a mod's entry runs through the same code as the core pack (docs/design/extensibility.md: mods the same way).
 * The relation, never a count: every live entry has its picture drawn by the real card (a capture of this build's
 * derivative, then its provenance row and its ledger mark), or a stated reason it has none (no picture in the set; the
 * canon's block with its reason); every shipped picture is a live entry's.
 * An entry that stops being live: its provenance row stays with status `retired` (the received file stays in
 * assets-inbox/, which the provenance checker accepts for a row that is no runtime asset any more:
 * scripts/provenanceLedger.ts `retiredRows`), and this task's installed_by on its ledger row is cleared. Turned on again,
 * its row is written afresh after its capture.
 */
import { CSV_COLUMNS, parseCsv, stringifyCsv, type CsvRow } from "./provenanceLedgerCsv";

export const EVENT_ART_AUTO_COMMAND = "npm run eventart:auto";
export const EVENT_ART_CAPTURES = "docs/verification/eventart/auto/captures.json";
export const EVENT_ART_INSTALLED_BY = "EVENT-ART";
const ASSET_PREFIX = "event-art/";
const RETIRED_NOTE = " Retired by EVA-AUTO: no live registry entry draws it any more (scripts/eventArtAuto.ts); the received file stays in assets-inbox.";

/** A registry entry as the registry reports it (registryV4Support: whether it runs, and why not). */
export type EventArtEntry = Readonly<{ id: string; runs: boolean; reason: string | null }>;
export type EventArtCapture = Readonly<{ ok: boolean; why: string | null; derivativeSha?: string; derivativeBytes?: number }>;
export type EventArtCaptures = Readonly<{ live: readonly string[]; shipped: readonly string[]; pictures: Readonly<Record<string, EventArtCapture>> }>;

/** Each entry's picture: shipped, or the stated reason it has none. */
export type EventArtStanding = Readonly<{ id: string; ships: boolean; reason: string | null }>;
export function eventArtStandings(entries: readonly EventArtEntry[], known: Readonly<Record<string, unknown>>): EventArtStanding[] {
  return entries.map(entry => !entry.runs ? { id: entry.id, ships: false, reason: entry.reason ?? "the registry does not run it" }
    : Object.hasOwn(known, entry.id) ? { id: entry.id, ships: true, reason: null } : { id: entry.id, ships: false, reason: "no picture in the pack's set" });
}

export type EventArtRelationInput = Readonly<{
  entries: readonly EventArtEntry[];
  /** The pack's pictures by event id (src/ui/eventArtManifest.generated.ts; `source`: the received file). */
  known: Readonly<Record<string, Readonly<{ source: string }>>>;
  /** The ids the build ships a picture for (scripts/keyartDerivatives.ts EVENT_ART_DERIVATIVES). */
  shipped: readonly string[];
  captures: EventArtCaptures;
  /** The SHA-256 of the derivative this build makes for a shipped id. */
  derivativeSha: (id: string) => string;
  provenance: readonly CsvRow[];
  /** The installed_by of the id's inbox ledger row ("" when none). */
  installedBy: (id: string) => string;
}>;

/** Every way the tree breaks the relation, each naming its id and the one command that mends it. Empty: it holds. */
export function eventArtProblems(input: EventArtRelationInput): string[] {
  const problems: string[] = [];
  const say = (id: string, what: string) => problems.push(`${id}: ${what} — run \`${EVENT_ART_AUTO_COMMAND}\``);
  const rows = new Map(input.provenance.filter(row => row.assetId.startsWith(ASSET_PREFIX)).map(row => [row.assetId.slice(ASSET_PREFIX.length), row]));
  const shipped = new Set(input.shipped);
  const standings = eventArtStandings(input.entries, input.known);
  for (const standing of standings) {
    // A picture another task already ships as the same file (ck_evt_012 is LM-R1's Wave 44 stall dispute) keeps that
    // task's row and mark: one row per runtime file.
    const source = standing.ships ? input.known[standing.id]!.source : null;
    const other = input.provenance.find(row => !row.assetId.startsWith(ASSET_PREFIX) && row.runtimePath === source && row.status === "runtime");
    const row = rows.get(standing.id) ?? other;
    if (!standing.ships) {
      if (standing.reason === null || standing.reason === "") say(standing.id, "no picture and no reason");
      if (shipped.has(standing.id)) say(standing.id, `shipped, but ${standing.reason}`);
      if (row !== undefined && row.status !== "retired") say(standing.id, `its provenance row is ${row.status}, not retired`);
      if (input.installedBy(standing.id) === EVENT_ART_INSTALLED_BY) say(standing.id, `installed_by ${EVENT_ART_INSTALLED_BY}, but ${standing.reason}`);
      continue;
    }
    if (!shipped.has(standing.id)) { say(standing.id, "live with a picture, but the build does not ship it"); continue; }
    const capture = input.captures.pictures[standing.id];
    const sha = input.derivativeSha(standing.id);
    if (capture === undefined) say(standing.id, "never captured through the card");
    else if (!capture.ok) say(standing.id, `not drawn by the card: ${capture.why ?? "no reason recorded"}`);
    else if (capture.derivativeSha !== sha) say(standing.id, "captured, but of another derivative than this build makes");
    if (row === undefined || row.status !== "runtime") say(standing.id, `no runtime provenance row (${row?.status ?? "none"})`);
    else if (row !== other && !row.notes.includes(`sha256 ${sha}`)) say(standing.id, "its provenance row names another derivative");
    if (other !== undefined && rows.has(standing.id)) say(standing.id, `two provenance rows for ${source}`);
    if (input.installedBy(standing.id) === "") say(standing.id, "no installed_by on its ledger row");
  }
  const running = input.entries.filter(entry => entry.runs).map(entry => entry.id).sort();
  if (JSON.stringify([...input.captures.live].sort()) !== JSON.stringify(running)) say("captures.json", "it was taken for another live set than the registry's now");
  const live = new Set(standings.filter(standing => standing.ships).map(standing => standing.id));
  for (const id of input.shipped) if (!live.has(id)) say(id, "shipped, but no live entry has it");
  for (const id of Object.keys(input.captures.pictures)) if (!shipped.has(id)) say(id, "a capture of a picture the build does not ship");
  return problems;
}

/**
 * The provenance ledger with the event pictures' rows made current: every other row as it was, in its place; the event
 * rows together where the first one was (at the end when there was none), by id — a drawn picture's `fresh` row, and a
 * row whose picture is no longer drawn kept as `retired`; `others`: ids another task's row already covers (their event
 * row, if any, goes). The same input gives the same rows (idempotent).
 */
export function eventArtProvenanceRows(existing: readonly CsvRow[], fresh: ReadonlyMap<string, CsvRow>, others: ReadonlySet<string> = new Set()): CsvRow[] {
  const isOurs = (row: CsvRow) => row.assetId.startsWith(ASSET_PREFIX);
  const ours = new Map<string, CsvRow>();
  for (const row of existing.filter(isOurs)) {
    const id = row.assetId.slice(ASSET_PREFIX.length);
    if (others.has(id)) continue;
    ours.set(id, row.status === "retired" ? row : { ...row, status: "retired", notes: row.notes.endsWith(RETIRED_NOTE) ? row.notes : `${row.notes}${RETIRED_NOTE}` });
  }
  for (const [id, row] of fresh) ours.set(id, row);
  const block = [...ours.entries()].sort(([left], [right]) => (left < right ? -1 : 1)).map(([, row]) => row);
  const first = existing.findIndex(isOurs);
  const rest = existing.filter(row => !isOurs(row));
  const at = first < 0 ? rest.length : existing.slice(0, first).filter(row => !isOurs(row)).length;
  return [...rest.slice(0, at), ...block, ...rest.slice(at)];
}

/**
 * The inbox ledger with installed_by = EVENT-ART on the rows of the drawn pictures, and cleared on an event picture's
 * row that is not (only this task's mark; a row another task installed is left as it is and listed). Only the last
 * field (installed_by) of those rows changes; every other byte stays, the line ends (CRLF) too.
 */
export function eventArtLedger(ledger: string, files: ReadonlyMap<string, string>, drawn: ReadonlySet<string>): { text: string; others: string[] } {
  const eol = ledger.split("\n", 1)[0]!.endsWith("\r") ? "\r\n" : "\n";
  const others: string[] = [];
  const mark = EVENT_ART_INSTALLED_BY;
  const lines = ledger.split(eol).map(line => {
    const id = files.get(line.split(",")[1] ?? "");
    if (id === undefined) return line;
    if (drawn.has(id)) {
      if (line.endsWith(",")) return `${line}${mark}`;
      if (!line.endsWith(`,${mark}`)) others.push(id);
      return line;
    }
    return line.endsWith(`,${mark}`) ? line.slice(0, -mark.length) : line;
  });
  return { text: lines.join(eol), others };
}

/** installed_by of each ledger row by its file (assets-inbox/-relative), for `installedBy`. */
export function ledgerInstalledBy(ledger: string): ReadonlyMap<string, string> {
  const [header, ...rows] = parseCsv(ledger);
  const file = header!.indexOf("file");
  const installed = header!.indexOf("installed_by");
  return new Map(rows.map(row => [row[file] ?? "", row[installed] ?? ""]));
}

/** The file's records as written, each with its own line end (quoted newlines kept inside), the header first. */
export function rawRecords(raw: string): string[] {
  const records: string[] = [];
  let start = 0; let quoted = false;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '"') quoted = !quoted;
    else if (raw[i] === "\n" && !quoted) { records.push(raw.slice(start, i + 1)); start = i + 1; }
  }
  if (start < raw.length) records.push(raw.slice(start));
  return records;
}

/** The ledger with `rows`: a row other lanes wrote and this run did not change keeps its bytes (its own line end — some
 * end in CRLF in this LF file); only the event-art rows this run writes are serialised. */
export function provenanceText(raw: string, existing: readonly CsvRow[], rows: readonly CsvRow[]): string {
  const [header, ...records] = rawRecords(raw);
  const key = (row: CsvRow) => JSON.stringify(CSV_COLUMNS.map(column => row[column] ?? ""));
  const kept = new Map<string, string[]>();
  existing.forEach((row, index) => { const list = kept.get(key(row)) ?? []; list.push(records[index]!); kept.set(key(row), list); });
  const line = (row: CsvRow) => stringifyCsv([row]).split("\n").slice(1).join("\n");
  return header! + rows.map(row => kept.get(key(row))?.shift() ?? line(row)).join("");
}
