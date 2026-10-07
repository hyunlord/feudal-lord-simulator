/**
 * EVA-AUTO (user order 2026-10-06): the event pictures follow the registry by a relation, never a count — every live
 * entry has its picture drawn by the real card (captured, then its provenance row and its ledger mark), or a stated
 * reason it has none; every shipped picture is a live entry's. A failure names the one command that mends it
 * (`npm run eventart:auto`). The same pure functions take a fixture registry with a mod's entry: it ships and installs
 * with no render-code change; an entry turned off keeps its row as retired.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { categorize, loadBudgetConfig } from "../scripts/checks/distBudget.mjs";
import { eventArtIntakeCheck, MANIFEST } from "../scripts/eventArtIntake";
import {
  EVENT_ART_AUTO_COMMAND, EVENT_ART_CAPTURES, EVENT_ART_INSTALLED_BY, eventArtLedger, eventArtProblems, eventArtProvenanceRows, eventArtStandings,
  ledgerInstalledBy, provenanceText, rawRecords, type EventArtCaptures, type EventArtEntry, type EventArtRelationInput,
} from "../scripts/eventArtAutoRows";
import { buildKeyartDerivative, EVENT_ART_DERIVATIVES, eventArtDerivatives, sha256 } from "../scripts/keyartDerivatives";
import { CSV_COLUMNS, parseCsvRows, stringifyCsv, type CsvRow } from "../scripts/provenanceLedgerCsv";
import { registryV4Support } from "../src/engine/registryV4";
import { eventArtFor } from "../src/ui/eventArt";
import { EVENT_ART_IMAGES } from "../src/ui/eventArtManifest.generated";
import { eventCardEntryIds, shippedEventArtIds } from "../src/ui/eventArtSelection";

const INBOX_LEDGER = "assets-inbox/INBOX_LEDGER.csv";
const entries: EventArtEntry[] = registryV4Support().map(entry => ({ id: entry.id, runs: entry.runs, reason: entry.reason }));
const captures = JSON.parse(readFileSync(EVENT_ART_CAPTURES, "utf8")) as EventArtCaptures;
const provenance = parseCsvRows(readFileSync("docs/provenance/assets.csv", "utf8"));
const ledger = readFileSync(INBOX_LEDGER, "utf8");
const shaOf = new Map(EVENT_ART_DERIVATIVES.map(item => [item.id.slice("event_".length), sha256(buildKeyartDerivative(item))]));
const inbox = (source: string) => source.slice("assets-inbox/".length);
const installedFrom = (text: string, known: Readonly<Record<string, { source: string }>>) => {
  const marks = ledgerInstalledBy(text);
  return (id: string) => marks.get(inbox(known[id]?.source ?? "")) ?? "";
};
const tree: EventArtRelationInput = { entries, known: EVENT_ART_IMAGES, shipped: [...shaOf.keys()], captures, derivativeSha: id => shaOf.get(id) ?? "",
  provenance, installedBy: installedFrom(ledger, EVENT_ART_IMAGES) };

test("every live entry has its picture drawn by the real card, or a stated reason; every shipped picture is a live entry's", () => {
  const problems = eventArtProblems(tree);
  assert.deepEqual(problems, [], `the event pictures do not follow the registry — run \`${EVENT_ART_AUTO_COMMAND}\`:\n${problems.join("\n")}`);
  // The card finds each by its id alone: a picture exactly for the live entries that have one, none for the rest.
  for (const standing of eventArtStandings(entries, EVENT_ART_IMAGES)) {
    assert.equal(eventArtFor(standing.id) !== null, standing.ships, `${standing.id}: ${standing.reason ?? "ships"}`);
    if (!standing.ships) assert.ok((standing.reason ?? "") !== "", `${standing.id}: no picture and no reason`);
  }
  assert.deepEqual([...captures.live].sort(), [...eventCardEntryIds()].sort(), "captures.json is of the registry's live set now");
});

test("the captures are each an event's card: its id, this build's derivative, decoded, not blank; a few pictures, not one per event", () => {
  for (const id of tree.shipped) {
    const row = captures.pictures[id] as EventArtCaptures["pictures"][string] & { natural?: number[]; luminance?: number };
    assert.ok(row?.ok === true, `${id}: ${row?.why ?? "not captured"}`);
    assert.equal(row.derivativeSha, shaOf.get(id), id);
    assert.ok((row.natural?.[0] ?? 0) > 0 && (row.luminance ?? 0) >= 8, `${id}: ${JSON.stringify(row)}`);
  }
  const shots = (JSON.parse(readFileSync(EVENT_ART_CAPTURES, "utf8")) as { shots: string[] }).shots;
  assert.ok(shots.length <= 4 && shots.every(name => existsSync(`docs/verification/eventart/auto/${name}`)), shots.join(" "));
});

test("the manifest is the inbox intake's own output (committed: tests, scripts and the build import it)", () => {
  const pictures = eventArtIntakeCheck();
  assert.deepEqual(Object.keys(EVENT_ART_IMAGES), pictures.map(picture => picture.id), MANIFEST);
});

/** A mod's event: its own id and picture in its pack's manifest. Its picture file here is ck_evt_001's received JPEG (an
 *  entry the registry never runs; left out of this fixture's manifest, so the file is the mod's alone). */
const MOD = "mod:harvest_feast";
const { ck_evt_001: borrowed, ...corePictures } = EVENT_ART_IMAGES;
const modKnown = { ...corePictures, [MOD]: { path: "assets/event-art/mod-harvest_feast.jpg", width: 960, height: 540, title: "수확 잔치",
  source: borrowed.source } } as Readonly<Record<string, { path: string; source: string }>>;
const modEntries: EventArtEntry[] = [...entries, { id: MOD, runs: true, reason: null }];
const modIds = modEntries.filter(entry => entry.runs).map(entry => entry.id);

test("a mod's live entry with a picture ships and installs by the same code: no render-code change, no list to edit", () => {
  // Shipped: selection, the build's derivative (on demand, out of the first load), the card's lookup rule.
  assert.ok(shippedEventArtIds(modKnown, modIds).includes(MOD));
  const derivative = eventArtDerivatives(modKnown, modIds).find(item => item.id === `event_${MOD}`)!;
  assert.deepEqual([derivative.url, derivative.source, derivative.format], [modKnown[MOD]!.path, modKnown[MOD]!.source, "jpeg-reencoded"]);
  assert.equal(categorize(derivative.url, loadBudgetConfig())?.category, "event_cards");
  const sha = sha256(buildKeyartDerivative(derivative));
  const shipped = eventArtDerivatives(modKnown, modIds).map(item => item.id.slice("event_".length));
  const before: EventArtRelationInput = { ...tree, entries: modEntries, known: modKnown, shipped, captures: { ...captures, live: modIds },
    derivativeSha: id => id === MOD ? sha : shaOf.get(id) ?? "", installedBy: installedFrom(ledger, modKnown) };
  // Not yet captured: the relation names the mod's entry and the command, nothing else.
  const problems = eventArtProblems(before);
  assert.ok(problems.length > 0 && problems.every(problem => problem.startsWith(`${MOD}: `) && problem.endsWith(`run \`${EVENT_ART_AUTO_COMMAND}\``)), problems.join("\n"));
  // What the command then writes: its capture, its provenance row, its ledger mark — and the relation holds.
  const row: CsvRow = { ...provenance.find(entry => entry.assetId === "event-art/ck_evt_005")!, assetId: `event-art/${MOD}`, runtimePath: modKnown[MOD]!.source,
    notes: `a mod's picture (jpeg-reencoded: 1 bytes, sha256 ${sha})` };
  const fresh = new Map([...provenance.filter(entry => entry.assetId.startsWith("event-art/") && entry.status === "runtime").map(entry => [entry.assetId.slice("event-art/".length), entry] as const), [MOD, row] as const]);
  const files = new Map([[inbox(modKnown[MOD]!.source), MOD]]);
  const after: EventArtRelationInput = { ...before, captures: { ...before.captures, pictures: { ...captures.pictures, [MOD]: { ok: true, why: null, derivativeSha: sha } } },
    provenance: eventArtProvenanceRows(provenance, fresh), installedBy: installedFrom(eventArtLedger(ledger, files, new Set([MOD])).text, modKnown) };
  assert.deepEqual(eventArtProblems(after), []);
});

test("an entry the registry turns off: no picture shipped, its row kept as retired, this task's mark cleared — the relation holds", () => {
  const off = "ck_evt_005";
  const offEntries = entries.map(entry => entry.id === off ? { ...entry, runs: false, reason: "fixture: turned off" } : entry);
  const offIds = offEntries.filter(entry => entry.runs).map(entry => entry.id);
  const shipped = shippedEventArtIds(EVENT_ART_IMAGES, offIds);
  assert.ok(!shipped.includes(off));
  const fresh = new Map(provenance.filter(row => row.assetId.startsWith("event-art/") && row.status === "runtime" && row.assetId !== `event-art/${off}`)
    .map(row => [row.assetId.slice("event-art/".length), row] as const));
  const rows = eventArtProvenanceRows(provenance, fresh);
  const retired = rows.find(row => row.assetId === `event-art/${off}`)!;
  assert.equal(retired.status, "retired");
  // The provenance checker's rule for a retired row: outside public/, the received file still there.
  assert.ok(!retired.runtimePath.startsWith("public/") && existsSync(retired.runtimePath), retired.runtimePath);
  assert.deepEqual(eventArtProvenanceRows(rows, fresh), rows, "idempotent");
  const files = new Map(Object.entries(EVENT_ART_IMAGES).map(([id, image]) => [inbox(image.source), id]));
  const marked = new Set(Object.keys(EVENT_ART_IMAGES).filter(id => tree.installedBy(id) === EVENT_ART_INSTALLED_BY && id !== off));
  const text = eventArtLedger(ledger, files, marked).text;
  const { [off]: _gone, ...pictures } = captures.pictures;
  assert.deepEqual(eventArtProblems({ ...tree, entries: offEntries, shipped, captures: { ...captures, live: offIds, pictures }, provenance: rows,
    installedBy: installedFrom(text, EVENT_ART_IMAGES) }), []);
  // The mark comes back, and only the installed_by field moved (CRLF kept).
  assert.equal(eventArtLedger(text, files, new Set([...marked, off])).text, ledger);
  assert.ok(text.includes("\r\n") && text.length === ledger.length - EVENT_ART_INSTALLED_BY.length);
});

test("the command's rows from the tree as it is change nothing (a second run is a no-op)", () => {
  const fresh = new Map(provenance.filter(row => row.assetId.startsWith("event-art/") && row.status === "runtime").map(row => [row.assetId.slice("event-art/".length), row] as const));
  assert.deepEqual(eventArtProvenanceRows(provenance, fresh), provenance);
  const files = new Map(Object.entries(EVENT_ART_IMAGES).map(([id, image]) => [inbox(image.source), id]));
  const drawn = new Set(tree.shipped.filter(id => tree.installedBy(id) !== ""));
  assert.equal(eventArtLedger(ledger, files, drawn).text, ledger);
});

test("the provenance write keeps other lanes' rows byte for byte (a CRLF row in the LF file) and serialises only the rows it writes", () => {
  const header = CSV_COLUMNS.join(",");
  const blank = Object.fromEntries(CSV_COLUMNS.map(column => [column, ""])) as CsvRow;
  const other = { ...blank, assetId: "wave42/log", runtimePath: "public/x.png", notes: "kept\nas written" };
  const mine = { ...blank, assetId: "event-art/ck_evt_201", runtimePath: "assets-inbox/a.jpg", status: "runtime" };
  const raw = `${header}\n${stringifyCsv([other]).split("\n").slice(1).join("\n").replace(/\n$/, "\r\n")}`;
  assert.deepEqual(rawRecords(raw).length, 2, "the quoted newline stays inside its record");
  const existing = [other];
  const text = provenanceText(raw, existing, [other, mine]);
  assert.ok(text.startsWith(raw), "the CRLF row is untouched");
  assert.equal(text.slice(raw.length), stringifyCsv([mine]).split("\n").slice(1).join("\n"), "only the new row is serialised");
});
