/**
 * EVA-AUTO — `npm run eventart:auto` (user order 2026-10-06): the one command any session runs after the registry's live
 * set changes (the engine turning an event on or off, a mod adding one). No hand list anywhere: the live set is the
 * registry's (src/ui/eventArtSelection.ts `eventCardEntryIds`), the pictures the build ships follow it
 * (scripts/keyartDerivatives.ts EVENT_ART_DERIVATIVES), and then:
 *  1. capture — scripts/eventArtAutoCapture.mjs opens each shipped picture's real card headless and checks it was drawn
 *     (the id, this build's derivative bytes, decoded, not blank) → docs/verification/eventart/auto/captures.json.
 *     A browser run: on Linux (the DGX, CI) here; on the Mac through `scripts/remote/run.sh <label> --light` (label
 *     $FLS_REMOTE_LABEL, default eventart-auto), whose docs/ results come back into this tree.
 *  2. apply — only for the pictures captured drawn: their provenance rows (docs/provenance/assets.csv, status runtime,
 *     the derivative's size and SHA in the notes) and prompt files (docs/provenance/prompts/<id>-event-art.txt), and
 *     installed_by = EVENT-ART on their inbox ledger rows (INSTALL_PROTOCOL 6: after the copy, the consumer and a
 *     capture). A picture no longer live keeps its row as `retired` and loses the mark (scripts/eventArtAutoRows.ts).
 *     Deterministic: the same tree and captures.json give the same files; a second run changes nothing.
 * The manifest (src/ui/eventArtManifest.generated.ts) is the inbox intake's (scripts/eventArtIntake.ts); apply stops when
 * it is not what the intake writes from the inbox.
 *   npm run eventart:auto                 capture, then apply
 *   npm run eventart:auto -- --capture    capture only (what the Mac sends to the DGX)
 *   npm run eventart:auto -- --apply      apply only, from the committed captures.json (no browser)
 * On the DGX directly (scripts/remote/run.sh <label> --light -- npm run eventart:auto): run.sh brings back docs/ only, so
 * run `npm run eventart:auto -- --apply` here afterwards for the ledger's installed_by.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { macHostName } from "./remote/localGuard.mjs";
import { buildKeyartDerivative, EVENT_ART_DERIVATIVES, JPEG_QUALITY, sha256 } from "./keyartDerivatives";
import { eventArtIntakeCheck, generation, type Picture } from "./eventArtIntake";
import { parseCsv, stringifyCsv, CSV_COLUMNS, type CsvRow } from "./provenanceLedgerCsv";
import { EVENT_ART_CAPTURES, EVENT_ART_INSTALLED_BY, eventArtLedger, eventArtProvenanceRows, type EventArtCaptures } from "./eventArtAutoRows";
import { eventCardEntryIds } from "../src/ui/eventArtSelection";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const LEDGER = "docs/provenance/assets.csv";
const INBOX_LEDGER = "assets-inbox/INBOX_LEDGER.csv";
const USED_IN = "src/ui/eventArtManifest.generated.ts (EVENT-ART: the lord-mode registry event card and its story chip, by the canon v4 entry's id; re-encoded at build, loaded when its card opens)";
const at = (relative: string) => path.join(ROOT, relative);
const same = (left: readonly string[], right: readonly string[]) => JSON.stringify(left) === JSON.stringify(right);

function capture(): number {
  if (macHostName() !== null && process.env.FLS_ALLOW_LOCAL !== "1") {
    const label = process.env.FLS_REMOTE_LABEL ?? "eventart-auto";
    console.log(`eventart:auto: the browser half runs on the DGX (scripts/remote/run.sh ${label} --light)`);
    return spawnSync("scripts/remote/run.sh", [label, "--light", "--", "node_modules/.bin/tsx", "scripts/eventArtAuto.ts", "--capture"], { cwd: ROOT, stdio: "inherit" }).status ?? 1;
  }
  return spawnSync("node_modules/.bin/tsx", ["scripts/eventArtAutoCapture.mjs", path.dirname(EVENT_ART_CAPTURES)], { cwd: ROOT, stdio: "inherit", env: { ...process.env, FLS_ALLOW_LOCAL: "1" } }).status ?? 1;
}

/** A drawn picture's provenance row (what the records give; never a model or seed they do not). */
function provenanceRow(picture: Picture, derived: Buffer): CsvRow {
  const { id } = picture;
  const record = generation(picture);
  const prompt = `docs/provenance/prompts/${id}-event-art.txt`;
  writeFileSync(at(prompt), `${record.prompt}\n`, "utf8");
  return { assetId: `event-art/${id}`, version: record.version, runtimePath: picture.file, runtimeSha256: picture.sha256, sourcePath: picture.file, sourceSha256: picture.sha256,
    tool: record.tool, model: "not exposed", generatedAt: "not recorded", prompt, referenceInputs: record.references, seed: "not exposed", candidates: "1",
    manualEdits: `${record.edits}; no picture edits at install; at build re-encoded as a baseline JPEG q${JPEG_QUALITY} 4:2:0 (scripts/jpegDecode.ts, scripts/keyartDerivatives.ts jpeg-reencoded).`,
    artBible: "not recorded", historicalProfile: "not recorded", owner: "Astra event-art", usedIn: USED_IN, status: "runtime",
    notes: `Astra event-art ${id} (${picture.title}; content canon v4 id; confirmed in assets-inbox/INBOX_LEDGER.csv) installed by ${EVENT_ART_INSTALLED_BY} `
      + `after the real card drew it (EVA-AUTO: scripts/eventArtAuto.ts, ${EVENT_ART_CAPTURES}); `
      + `runtime is assets/event-art/${id}.jpg, made at build from this received JPEG by scripts/keyartDerivatives.ts (format jpeg-reencoded: `
      + `${derived.length} bytes, sha256 ${sha256(derived)}; the received file has no C2PA segment). The records give no model or seed.` };
}

function apply(): number {
  const pictures = eventArtIntakeCheck();
  if (!existsSync(at(EVENT_ART_CAPTURES))) throw new Error(`${EVENT_ART_CAPTURES} is missing: run npm run eventart:auto (the capture)`);
  const captures = JSON.parse(readFileSync(at(EVENT_ART_CAPTURES), "utf8")) as EventArtCaptures;
  const shipped = EVENT_ART_DERIVATIVES.map(item => item.id.slice("event_".length));
  if (!same(captures.live, eventCardEntryIds()) || !same(captures.shipped, shipped)) {
    throw new Error(`${EVENT_ART_CAPTURES} is of another live set than the registry's now: run npm run eventart:auto (capture and apply)`);
  }
  const byId = new Map(pictures.map(picture => [picture.id, picture]));
  const raw = readFileSync(at(LEDGER), "utf8");
  const [header, ...body] = parseCsv(raw);
  if (header!.join(",") !== CSV_COLUMNS.join(",")) throw new Error(`${LEDGER}: unexpected header`);
  const existing = body.map(cells => Object.fromEntries(CSV_COLUMNS.map((name, index) => [name, cells[index] ?? ""])) as CsvRow);
  if (stringifyCsv(existing) !== raw) throw new Error(`${LEDGER} does not round-trip; refusing to rewrite it`);

  const fresh = new Map<string, CsvRow>();
  const others = new Set<string>();
  const notDrawn: string[] = [];
  for (const item of EVENT_ART_DERIVATIVES) {
    const id = item.id.slice("event_".length);
    const picture = byId.get(id)!;
    const derived = buildKeyartDerivative(item, ROOT);
    const shot = captures.pictures[id];
    if (shot?.ok !== true || shot.derivativeSha !== sha256(derived)) { notDrawn.push(`${id} (${shot?.ok === true ? "captured of another derivative" : shot?.why ?? "not captured"})`); continue; }
    // One row per runtime file: a picture another task already ships as the same file keeps that task's row (ck_evt_012).
    if (existing.some(row => !row.assetId.startsWith("event-art/") && row.runtimePath === picture.file && row.status === "runtime")) { others.add(id); continue; }
    fresh.set(id, provenanceRow(picture, derived));
  }
  const rows = eventArtProvenanceRows(existing, fresh, others);
  writeFileSync(at(LEDGER), stringifyCsv(rows), "utf8");

  const drawn = new Set([...fresh.keys(), ...others]);
  const files = new Map(pictures.map(picture => [picture.file.slice("assets-inbox/".length), picture.id]));
  const ledger = eventArtLedger(readFileSync(at(INBOX_LEDGER), "utf8"), files, drawn);
  writeFileSync(at(INBOX_LEDGER), ledger.text, "utf8");
  const retired = rows.filter(row => row.assetId.startsWith("event-art/") && row.status === "retired").map(row => row.assetId.slice("event-art/".length));
  console.log(`eventart:auto apply: ${fresh.size} drawn pictures with provenance rows and installed_by ${EVENT_ART_INSTALLED_BY}`
    + `${others.size + ledger.others.length === 0 ? "" : `; kept another task's row or mark: ${[...new Set([...others, ...ledger.others])].sort().join(" ")}`}`
    + `${retired.length === 0 ? "" : `; retired (no longer live): ${retired.join(" ")}`}${notDrawn.length === 0 ? "" : `; NOT drawn, no rows: ${notDrawn.join(", ")}`}`);
  return notDrawn.length === 0 ? 0 : 1;
}

const mode = process.argv.includes("--capture") ? "capture" : process.argv.includes("--apply") ? "apply" : "all";
let status = mode === "apply" ? 0 : capture();
if (mode === "capture") process.exit(status);
if (status !== 0) console.error(`eventart:auto: the capture ended with ${status}; the rows are written for the pictures it saw drawn`);
if (existsSync(at(EVENT_ART_CAPTURES))) status = Math.max(status, apply());
if (mode === "all" && process.env.FLS_REMOTE_PORT !== undefined) console.log("eventart:auto: on the DGX the inbox ledger stays here (run.sh brings back docs/ only): run `npm run eventart:auto -- --apply` in your tree");
process.exit(status);
