// LM-R2 (estates area): install the portfolio screen's pictures into renderer B's art catalog as the `lord-estates`
// bundle (ui-image entries, src/render/art/catalog.json), rerunnable. Specs docs/ops/install-plan-20261003/SPECS/
// wave35-estates.md, wave35-operations.md, lord-components-ui.md; only the files this screen draws (the rest are held,
// docs in the LM-R2 estates report):
//  - wave35-estates: ordinary, poor, wealthy, riverside_mill (the card's picture by the Estate's fields,
//    src/ui/lord/estates/estatesModel.ts) and integrated_overlay (an estate taken into possession), 480×270, shown at 240.
//  - wave35-operations: office_receiver / office_steward (64 with its 32 copy, shown at 32: the keeper of a direct /
//    delegated estate), annual_audit (960×540 at 240: a pending audit), policy_* (64 at 32) and subsidy_notice (192×256
//    at 96) in LM-R1's policy tab (src/ui/lord/LordPolicyPanel.tsx).
//  - lord-components-ui: trait_merchant_friendly / trait_peasant_friendly (48 with its 24 copy, at 24: the two
//    StewardDispositions with a trait), alert_deadline / alert_rights / alert_urgent (32, at 24).
// Each file: the inbox ledger row confirmed with no replaced_by and its SHA, the measured size, then a copy to
// public/assets/lord-ui/<spec>/ with only the PNG caBX/jumb/c2pa chunks dropped (pixels, alpha and canvas kept). One
// docs/provenance/assets.csv row each (replacing earlier rows for the same runtime path) from the batch records, one
// prompt file each. `--installed` writes installed_by = LM-R2 on these inbox ledger rows: run it only after the
// consumer and the 캡처 관문 captures are confirmed (INSTALL_PROTOCOL 6), in the captures' commit.
// Run: npx tsx scripts/installLmr2Estates.ts [--installed]
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CATALOG, upsertCatalogBundle } from "./lmr2ArtBundle";

const ROOT = process.cwd();
const INBOX_LEDGER = "assets-inbox/INBOX_LEDGER.csv";
const PROVENANCE = "docs/provenance/assets.csv";
const INSTALLED_BY = "LM-R2";
const WAVE35 = "wave35/candidates-20260930";
const LORD = "lord-components/candidates-20261002";
const DROP = new Set(["caBX", "jumb", "c2pa"]);
const USED_IN = {
  estates: "src/ui/lord/estates/PortfolioPanel.tsx; src/ui/lord/estates/estatesArt.ts; src/styles/lordEstates.css (LM-R2: the lord screen's estate cards)",
  operations: "src/ui/lord/estates/PortfolioPanel.tsx; src/ui/lord/estates/estatesArt.ts; src/styles/lordEstates.css (LM-R2: the estates' oversight and audit)",
  policy: "src/ui/lord/LordPolicyPanel.tsx; src/ui/lord/policyModel.ts; src/styles/lordEstates.css (LM-R2 in LM-R1's lord policy tab)",
} as const;

type Spec = "wave35-estates" | "wave35-operations" | "lord-components-ui";
type Item = {
  readonly stem: string; readonly spec: Spec; readonly inbox: string; readonly width: number; readonly height: number;
  readonly cssWidths: readonly number[]; readonly derivativeOf?: string; readonly usedIn: string;
  /** Where its generation record is: the batch's records file and the record id. */
  readonly record: "estates" | "frames" | "insignia" | "lord";
  readonly recordId: string;
};

const estate = (name: string, record: Item["record"] = "estates"): Item => ({ stem: `estate_${name}`, spec: "wave35-estates",
  inbox: `${WAVE35}/assets/A_estates/estate_${name}.png`, width: 480, height: 270, cssWidths: [240], usedIn: USED_IN.estates, record, recordId: `estate_${name}` });
const insignia = (file: string, recordId: string, size: number, cssWidths: readonly number[], usedIn: string, derivativeOf?: string): Item => ({
  stem: file, spec: "wave35-operations", inbox: `${WAVE35}/assets/D_operations/${file}.png`, width: size, height: size, cssWidths, usedIn, record: "insignia", recordId,
  ...(derivativeOf === undefined ? {} : { derivativeOf }) });
const lord = (file: string, recordId: string, size: number, cssWidths: readonly number[], stem: string, derivativeOf?: string): Item => ({
  stem, spec: "lord-components-ui", inbox: `${LORD}/assets/${file}.png`, width: size, height: size, cssWidths, usedIn: USED_IN.operations, record: "lord", recordId,
  ...(derivativeOf === undefined ? {} : { derivativeOf }) });

const ITEMS: readonly Item[] = [
  estate("ordinary"), estate("poor"), estate("wealthy"), estate("riverside_mill"), estate("integrated_overlay", "frames"),
  { stem: "annual_audit", spec: "wave35-operations", inbox: `${WAVE35}/assets/D_operations/annual_audit.png`, width: 960, height: 540, cssWidths: [240],
    usedIn: USED_IN.operations, record: "estates", recordId: "annual_audit" },
  insignia("office_receiver_64", "office_receiver", 64, [32], USED_IN.operations), insignia("office_receiver_32", "office_receiver", 32, [32], USED_IN.operations, "office_receiver_64"),
  insignia("office_steward_64", "office_steward", 64, [32], USED_IN.operations), insignia("office_steward_32", "office_steward", 32, [32], USED_IN.operations, "office_steward_64"),
  ...(["growth", "revenue", "stability", "defence"] as const).map(policy => insignia(`policy_${policy}`, `policy_${policy}`, 64, [32], USED_IN.policy)),
  { stem: "subsidy_notice", spec: "wave35-operations", inbox: `${WAVE35}/assets/D_operations/subsidy_notice.png`, width: 192, height: 256, cssWidths: [96],
    usedIn: USED_IN.policy, record: "insignia", recordId: "subsidy_notice" },
  lord("trait_merchant_friendly_48x48", "trait_merchant_friendly", 48, [24], "trait_merchant_friendly_48"),
  lord("trait_merchant_friendly_24x24", "trait_merchant_friendly", 24, [24], "trait_merchant_friendly_24", "trait_merchant_friendly_48"),
  lord("trait_peasant_friendly_48x48", "trait_peasant_friendly", 48, [24], "trait_peasant_friendly_48"),
  lord("trait_peasant_friendly_24x24", "trait_peasant_friendly", 24, [24], "trait_peasant_friendly_24", "trait_peasant_friendly_48"),
  lord("alert_deadline_32x32", "alert_deadline", 32, [24], "alert_deadline"),
  lord("alert_rights_32x32", "alert_rights", 32, [24], "alert_rights"),
  lord("alert_urgent_32x32", "alert_urgent", 32, [24], "alert_urgent"),
];

/** The screen's id for a stem: the 64/48 file of a sized pair carries the pair's name, its smaller copy keeps its size. */
function assetId(item: Item): string {
  const pair = ITEMS.some(other => other.derivativeOf === item.stem);
  return `lord.estates.${pair ? item.stem.replace(/_(?:64|48)$/, "") : item.stem}`;
}

const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** The PNG without its caBX / jumb / c2pa chunks (every other chunk, so the pixels, alpha and canvas, byte for byte). */
function stripProvenanceChunks(bytes: Buffer): Buffer {
  if (!bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new Error("not a PNG");
  const kept: Buffer[] = [bytes.subarray(0, 8)];
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString("latin1");
    const end = at + 12 + length;
    if (!DROP.has(type)) kept.push(bytes.subarray(at, end));
    at = end;
  }
  return Buffer.concat(kept);
}
const pngSize = (bytes: Buffer) => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });

/** A CSV line's fields (quoted fields with "" escapes). */
function splitCsv(line: string): string[] {
  const out: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') { field += '"'; index += 1; } else if (char === '"') quoted = false; else field += char;
    } else if (char === '"') quoted = true; else if (char === ",") { out.push(field); field = ""; } else field += char;
  }
  out.push(field);
  return out;
}
/** A CSV text's records as their raw text (a quoted field may hold a newline), without the line ends. */
function csvRecords(text: string): string[] {
  const out: string[] = []; let start = 0; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '"') quoted = !quoted;
    else if (char === "\n" && !quoted) { out.push(text.slice(start, index).replace(/\r$/, "")); start = index + 1; }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}
const csvField = (value: string): string => /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

type Record_ = { readonly tool: string; readonly prompt: string; readonly referenceInputs: string; readonly edits: string; readonly candidates: string };
function generation(item: Item): Record_ {
  const records = join(ROOT, "assets-inbox", item.spec === "lord-components-ui" ? LORD : WAVE35, "records");
  if (item.record === "lord") {
    const entry = (JSON.parse(readFileSync(join(records, "generations.json"), "utf8")) as Record<string, unknown>[]).find(row => row.id === item.recordId)!;
    const metrics = readFileSync(join(records, "assets.csv"), "utf8").replace(/^﻿/, "").split(/\r?\n/);
    const head = splitCsv(metrics[0]!);
    const row = metrics.map(splitCsv).find(fields => fields[head.indexOf("output")] === `assets/${item.inbox.split("/").pop()}`);
    return { tool: String(entry.tool ?? "image_gen.imagegen"), prompt: String(entry.prompt), referenceInputs: String(entry.reference_usage ?? entry.references ?? "not exposed"),
      edits: `at delivery: ${row === undefined ? "see records/assets.csv" : row[head.indexOf("transform")]}`, candidates: "1" };
  }
  const list = JSON.parse(readFileSync(join(records, `${item.record}.json`), "utf8")) as Record<string, unknown>[];
  const entry = list.find(row => row.id === item.recordId && (row.file === undefined || String(row.file).endsWith(`${item.stem}.png`)))
    ?? list.find(row => row.id === item.recordId)!;
  if (item.record === "estates") {
    const raw = String(entry.selected_raw);
    const version = raw.match(/-v(\d+)\.png$/)?.[1] ?? "1";
    const prompt = readFileSync(join(records, "prompts/estates", `${item.recordId}-v${version}.txt`), "utf8");
    return { tool: String(entry.tool), prompt, referenceInputs: String(entry.reference), edits: `at delivery: ${String(entry.postprocessing)} (from ${raw})`,
      candidates: String((entry.attempts as unknown[] | undefined)?.length ?? 1) };
  }
  if (item.record === "frames") {
    const crop = entry.crop as { left: number; top: number; width: number; height: number };
    return { tool: String(entry.tool), prompt: String(entry.prompt), referenceInputs: String(entry.reference_usage ?? "not exposed"),
      edits: `at delivery: crop ${crop.left},${crop.top} ${crop.width}x${crop.height} of the raw image; ${String(entry.processing)}`, candidates: "1" };
  }
  const prompt = readFileSync(join(records, "prompts", `${item.recordId}.txt`), "utf8");
  return { tool: String(entry.tool), prompt, referenceInputs: String(entry.reference_usage), candidates: "1",
    edits: `at delivery: ${String(entry.postprocess)}${entry.derivative === true ? " (the smaller copy of the same raw)" : ""}` };
}

function main(): void {
  const mark = process.argv.includes("--installed");
  const ledgerText = readFileSync(INBOX_LEDGER, "utf8");
  const eol = ledgerText.includes("\r\n") ? "\r\n" : "\n";
  const lines = ledgerText.split(eol);
  const head = splitCsv(lines[0]!);
  const col = (name: string) => head.indexOf(name);
  const rows = new Map(lines.slice(1).filter(line => line !== "").map((line, index) => [splitCsv(line)[col("file")]!, index + 1]));
  const entries: Record<string, unknown>[] = [];
  const provenance: Record<string, string>[] = [];
  for (const item of ITEMS) {
    const at = rows.get(item.inbox);
    if (at === undefined) throw new Error(`${item.inbox}: no inbox ledger row`);
    const row = splitCsv(lines[at]!);
    if (row[col("status")] !== "confirmed" || row[col("replaced_by")] !== "") throw new Error(`${item.inbox}: not confirmed, or replaced`);
    const installedBy = row[col("installed_by")] ?? "";
    if (installedBy !== "" && installedBy !== INSTALLED_BY) throw new Error(`${item.inbox}: installed by ${installedBy} already`);
    const source = readFileSync(join(ROOT, "assets-inbox", item.inbox));
    const sourceSha = sha(source);
    if (sourceSha !== row[col("sha256")]) throw new Error(`${item.inbox}: SHA differs from the ledger`);
    const size = pngSize(source);
    if (size.width !== item.width || size.height !== item.height) throw new Error(`${item.inbox}: ${size.width}x${size.height}, expected ${item.width}x${item.height}`);
    const runtime = stripProvenanceChunks(source);
    const stripped = runtime.length !== source.length;
    const url = `assets/lord-ui/${item.spec}/${item.stem}.png`;
    mkdirSync(dirname(join(ROOT, "public", url)), { recursive: true });
    writeFileSync(join(ROOT, "public", url), runtime);
    const runtimeSha = sha(runtime);
    const derivatives = ITEMS.filter(other => other.derivativeOf === item.stem).map(other => ({ width: other.width, assetId: assetId(other) }));
    entries.push({ id: assetId(item), kind: "ui-image", image: { url, width: item.width, height: item.height },
      provenance: { inboxFile: `assets-inbox/${item.inbox}`, sourceSha256: sourceSha, runtimeSha256: runtimeSha }, cssWidths: item.cssWidths, derivatives });
    const record = generation(item);
    const prompt = `docs/provenance/prompts/${item.stem}-${item.spec}.txt`;
    writeFileSync(join(ROOT, prompt), `${record.prompt.trim()}\n`);
    provenance.push({ assetId: `lord-ui/${item.spec}/${item.stem}`, version: "1", runtimePath: `public/${url}`, runtimeSha256: runtimeSha,
      sourcePath: `assets-inbox/${item.inbox}`, sourceSha256: sourceSha, tool: record.tool, model: "not exposed", generatedAt: item.spec === "lord-components-ui" ? "2026-10-02" : "2026-09-30",
      prompt, referenceInputs: record.referenceInputs, seed: "not exposed", candidates: record.candidates,
      manualEdits: `${record.edits}${stripped ? "; at install: PNG caBX/jumb/c2pa chunks dropped (pixels, alpha and canvas kept)" : ""}`,
      artBible: "ART_BIBLE_v2", historicalProfile: "S_England_1300_1450_v1", owner: "Astra", usedIn: item.usedIn, status: "runtime",
      notes: `Astra ${item.spec} ${item.stem} (confirmed in assets-inbox/INBOX_LEDGER.csv) installed by ${INSTALLED_BY} on 2026-10-06 as the ui-image ${assetId(item)} `
        + `(bundle lord-estates), ${item.width} x ${item.height}, shown at ${item.cssWidths.join("/")} CSS px; `
        + `${stripped ? "metadata chunks dropped at install" : "no C2PA chunk, received bytes = runtime bytes"}. The batch records give the delivery date, not a generation time.` });
    if (mark) { row[col("installed_by")] = INSTALLED_BY; lines[at] = row.map(csvField).join(","); }
  }
  const bundle = { schemaVersion: 1, bundleId: "lord-estates", entries, rules: [] };
  writeFileSync(CATALOG, upsertCatalogBundle(ROOT, readFileSync(CATALOG, "utf8"), bundle as never));
  const ledger = csvRecords(readFileSync(PROVENANCE, "utf8"));
  const fields = splitCsv(ledger[0]!);
  const ours = new Set(provenance.map(row => row.runtimePath));
  const kept = ledger.slice(1).filter(line => line !== "" && !ours.has(splitCsv(line)[fields.indexOf("runtimePath")]!));
  writeFileSync(PROVENANCE, [ledger[0], ...kept, ...provenance.map(row => fields.map(field => csvField(row[field] ?? "")).join(","))].join("\n") + "\n");
  if (mark) writeFileSync(INBOX_LEDGER, lines.join(eol));
  console.log(JSON.stringify({ bundle: "lord-estates", entries: entries.length, ledgerMarked: mark }));
}

main();
