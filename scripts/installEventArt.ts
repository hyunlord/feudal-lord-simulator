/**
 * EVENT-ART: install the 200 confirmed event illustrations (assets-inbox/event-art/final200-20261004, filed by INBOX-3z,
 * confirmed 2026-10-04 in assets-inbox/INBOX_LEDGER.csv) for the registry event card (src/ui/hud/RegistryCard.tsx).
 * File name = the content canon v4 event id (ck_evt_001 … ck_evt_200); records/ASSETS.csv maps each id to its file. 167
 * are in final200-20261004/assets/; 33 identical ones stay in older batches (records/README.md lists each: event-art/
 * candidates-20261003, event-art/rework-20261003, wave44 07_market_stall_dispute.jpg for ck_evt_012) — each read where
 * it lies and checked byte for byte against ASSETS.csv.
 * Every picture: its ledger row confirmed with no replaced_by, its SHA-256 = ASSETS.csv's = the ledger's, 960 × 540 from
 * the JPEG frame header, no APPn JUMBF / C2PA segment. The build ships each re-encoded as a smaller baseline JPEG
 * (scripts/keyartDerivatives.ts, format jpeg-reencoded — user decision 2026-10-05: the received files and the ledger stay
 * as they are; no public/ copy), loaded when its card opens — and only the pictures of entries the registry can offer as the card (src/ui/eventArtSelection.ts
 * `shippedEventArtIds`: the canon v4 entries the registry runs, so an entry it turns on ships its picture with no hand
 * list; they are measured on demand, outside the first load — EVA-D1, EVA-D2).
 * Writes:
 *   src/ui/eventArtManifest.generated.ts  (all 200: path, width, height, title, source — `path`, not `url`: only the shipped
 *                                          ones are runtime assets, scripts/provenanceLedgerAssets.ts adds them)
 *   docs/provenance/assets.csv            (one row per shipped picture; earlier event-art/ rows replaced)
 *   docs/provenance/prompts/              (one .txt per shipped picture: its generation prompt and any edit prompts)
 *   assets-inbox/INBOX_LEDGER.csv         (only with --mark-installed <captures.json>: installed_by = EVENT-ART on the rows of
 *                                          the shipped pictures that capture shows drawn by the real card — INSTALL_PROTOCOL 6;
 *                                          cleared on an event picture's row that is not; CRLF kept; a row another task
 *                                          installed is left as it is)
 * Run: node_modules/.bin/tsx scripts/installEventArt.ts [--mark-installed docs/verification/eventart/v4/captures.json]
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsv, stringifyCsv, CSV_COLUMNS, type CsvRow } from "./provenanceLedgerCsv";
import { buildKeyartDerivative, JPEG_QUALITY } from "./keyartDerivatives";
import { shippedEventArtIds } from "../src/ui/eventArtSelection";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PACK = "assets-inbox/event-art/final200-20261004";
const LEDGER = "docs/provenance/assets.csv";
const INBOX_LEDGER = "assets-inbox/INBOX_LEDGER.csv";
const MANIFEST = "src/ui/eventArtManifest.generated.ts";
const INSTALLED_BY = "EVENT-ART";
const INSTALLED_ON = "2026-10-05";
const SIZE = [960, 540] as const;
const USED_IN = "src/ui/eventArtManifest.generated.ts (EVENT-ART: the lord-mode registry event card and its story chip, by the canon v4 entry's id; re-encoded at build, loaded when its card opens)";

const read = (relative: string) => readFileSync(path.join(ROOT, relative));
const text = (relative: string) => read(relative).toString("utf8");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const table = (relative: string): Record<string, string>[] => {
  const [header, ...rows] = parseCsv(text(relative));
  return rows.map(row => Object.fromEntries(header!.map((name, index) => [name, row[index] ?? ""])));
};

/** (width, height, a JUMBF/C2PA box in an APPn segment) from a baseline or progressive JPEG. */
function jpegFacts(data: Buffer): { width: number; height: number; c2pa: boolean } {
  if (data[0] !== 0xff || data[1] !== 0xd8) throw new Error("not a JPEG");
  let at = 2; let c2pa = false; let size: [number, number] | null = null;
  while (at + 4 <= data.length) {
    if (data[at] !== 0xff) throw new Error(`bad marker at ${at}`);
    const marker = data[at + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    const length = data.readUInt16BE(at + 2);
    const body = data.subarray(at + 4, at + 2 + length);
    if (marker >= 0xe0 && marker <= 0xef) c2pa ||= body.includes("jumb") || body.includes("c2pa");
    if ((marker === 0xc0 || marker === 0xc1 || marker === 0xc2) && size === null) size = [body.readUInt16BE(3), body.readUInt16BE(1)];
    if (marker === 0xda) break;
    at += 2 + length;
  }
  if (size === null) throw new Error("no frame header");
  return { width: size[0], height: size[1], c2pa };
}

type Picture = { id: string; title: string; file: string; sha256: string; bytes: number };

/** The generation record of a picture by the batch it lies in (never a model or seed the records do not give). */
function generation(picture: Picture): { version: string; tool: string; prompt: string; references: string; edits: string } {
  const file = picture.file.slice("assets-inbox/".length);
  const batch = file.split("/assets/")[0]!;
  if (batch === "event-art/candidates-20261003" || batch === "event-art/rework-20261003") {
    const record = JSON.parse(text(`assets-inbox/${batch}/records/${picture.id}.json`)) as Record<string, unknown>;
    const history = (record.history as { prompt: string }[] | undefined) ?? [];
    const edits = history.slice(1).map((step, index) => `[edit ${index + 1}] ${step.prompt.trim()}`);
    return { version: "v1", tool: String(record.tool ?? record.mode), prompt: [String(record.prompt).trim(), ...edits].join("\n\n"),
      references: ((record.style_references ?? record.references) as string[] | undefined ?? []).map(reference => path.basename(reference)).join(";") || "none",
      edits: `${String(record.conversion ?? record.format ?? "")}${edits.length > 0 ? `; ${edits.length} image edit(s) after the generation (record history)` : ""} (${batch} record)` };
  }
  if (batch === PACK.slice("assets-inbox/".length)) {
    // The round that selected these bytes: its ASSETS.csv row with this id and SHA, and that version's prompt file.
    const rounds = readdirSync(path.join(ROOT, PACK, "records")).filter(name => /^r\d\d$/.test(name)).sort().reverse();
    for (const round of rounds) {
      const assets = `${PACK}/records/${round}/ASSETS.csv`;
      if (!existsSync(path.join(ROOT, assets))) continue;
      const row = table(assets).find(entry => entry.event_id === picture.id && entry.sha256 === picture.sha256);
      if (row === undefined) continue;
      // A round names its version "v2" or plainly "2" (the prompt file is …-v2.txt); "existing_reuse" took an earlier
      // round's; r03 and r04 keep one prompt per picture (…/prompts/<id>.txt) and no version, so the round stands for it.
      const version = row.selected_version === undefined ? round : /^\d+$/.test(row.selected_version) ? `v${row.selected_version}` : row.selected_version;
      const prompt = `${PACK}/records/${round}/prompts/${picture.id}${row.selected_version === undefined ? "" : `-${version}`}.txt`;
      if (!existsSync(path.join(ROOT, prompt))) {
        if (version === "existing_reuse") continue;
        throw new Error(`${picture.id}: ${round} selected ${row.selected_version} but ${prompt} is missing`);
      }
      if (row.selected_version === undefined) {
        // r03/r04: the generation prompt, then every other prompt the round kept for this picture (redraws and edits),
        // each under its file name; the round's records (…-paths.json, edits-*.json) say which edit was kept.
        const others = readdirSync(path.join(ROOT, PACK, "records", round, "prompts")).filter(name => name.startsWith(`${picture.id}-`)).sort();
        const selected = (["composition", "semantic"] as const).flatMap(kind => {
          const file = path.join(ROOT, PACK, "records", round, "records", `${kind}-edit-paths.json`);
          if (!existsSync(file)) return [];
          const paths = JSON.parse(readFileSync(file, "utf8")) as { selected?: Record<string, { version: string }>; edits?: Record<string, { version: string }> };
          const chosen = (paths.selected ?? paths.edits ?? {})[String(Number(picture.id.slice("ck_evt_".length)))];
          return chosen === undefined ? [] : [`${kind}-${chosen.version}`];
        });
        return { version: selected.at(-1) ?? round, tool: `not recorded in the ${round} records`,
          prompt: [text(prompt).trim(), ...others.map(name => `[${name}] ${text(`${PACK}/records/${round}/prompts/${name}`).trim()}`)].join("\n\n"), references: "not recorded",
          edits: `${round} as delivered${selected.length === 0 ? "" : ` (selected edit ${selected.join(", ")} in records/${round}/records/*-edit-paths.json)`}; `
            + `${others.length} further prompt(s) of the round for this picture kept in the prompt file (final200 records/${round}/ASSETS.csv)` };
      }
      return { version, tool: `not recorded in the ${round} records`, prompt: text(prompt).trim(), references: "not recorded",
        edits: `${round} ${row.selected_version} as selected (final200 records/${round}/ASSETS.csv)` };
    }
    throw new Error(`${picture.id}: no round record selects ${picture.sha256}`);
  }
  if (batch === "wave44/candidates-20261002") {
    const record = (JSON.parse(text(`assets-inbox/${batch}/records/manifest.json`)) as Record<string, unknown>[])
      .find(entry => entry.sha256 === picture.sha256)!;
    return { version: `v${String(record.selected_version)}`, tool: "built-in image_gen", prompt: String(record.prompt_exact).trim(),
      references: (record.reference_images as string[]).join(";"), edits: `${String(record.crop_or_edit)} (wave44 pack record)` };
  }
  throw new Error(`${picture.id}: no generation record reader for ${batch}`);
}

function main(): void {
  const at = process.argv.indexOf("--mark-installed");
  const mark = at < 0 ? null : process.argv[at + 1] ?? null;
  if (at >= 0 && mark === null) throw new Error("--mark-installed needs the captures.json that shows each picture drawn by the card");
  let marked = 0;
  const assets = table(`${PACK}/records/ASSETS.csv`);
  const ids = assets.map(row => row.event_id!);
  const expected = Array.from({ length: 200 }, (_, index) => `ck_evt_${String(index + 1).padStart(3, "0")}`);
  if (JSON.stringify(ids) !== JSON.stringify(expected)) throw new Error("ASSETS.csv is not ck_evt_001 … ck_evt_200 in order");
  // records/README.md: the 33 identical pictures already in the ledger, each with the file it is (`ck_evt_NNN(`path`)`).
  const elsewhere = new Map([...text(`${PACK}/records/README.md`).matchAll(/(ck_evt_\d{3})\(`([^`]+)`\)/g)].map(match => [match[1]!, `assets-inbox/${match[2]!}`]));
  if (elsewhere.size !== 33) throw new Error(`README lists ${elsewhere.size} pictures elsewhere, not 33`);
  const inbox = table(INBOX_LEDGER);
  const byFile = new Map(inbox.map(row => [`assets-inbox/${row.file}`, row]));
  const local = new Set(readdirSync(path.join(ROOT, PACK, "assets")));
  if (local.size !== 167) throw new Error(`${PACK}/assets holds ${local.size} files, not 167`);

  const pictures: Picture[] = [];
  for (const row of assets) {
    const id = row.event_id!;
    const file = elsewhere.get(id) ?? `${PACK}/${row.file}`;
    if (!elsewhere.has(id) && !local.delete(path.basename(row.file!))) throw new Error(`${id}: ${row.file} is not in ${PACK}/assets`);
    const entry = byFile.get(file);
    // INSTALL_PROTOCOL 1: the ledger is the truth for which file is current.
    if (entry === undefined) throw new Error(`${file}: no INBOX_LEDGER row`);
    if (entry.status !== "confirmed" || entry.replaced_by !== "") throw new Error(`${file}: status ${entry.status}, replaced by ${entry.replaced_by || "nothing"}`);
    const data = read(file);
    const digest = sha(data);
    if (digest !== row.sha256 || digest !== entry.sha256) throw new Error(`${file}: SHA-256 differs from ASSETS.csv or the ledger`);
    const facts = jpegFacts(data);
    if (facts.c2pa) throw new Error(`${file} carries a C2PA / JUMBF segment`);
    if (facts.width !== SIZE[0] || facts.height !== SIZE[1]) throw new Error(`${file}: ${facts.width}x${facts.height}`);
    pictures.push({ id, title: row.title!, file, sha256: digest, bytes: data.length });
  }
  const unnamed = [...local];
  if (unnamed.length > 0) throw new Error(`${PACK}/assets has files no id names: ${unnamed.join(", ")}`);

  const images = Object.fromEntries(pictures.map(picture => [picture.id, { path: `assets/event-art/${picture.id}.jpg`, width: SIZE[0], height: SIZE[1],
    title: picture.title, source: picture.file }]));
  const shipped = shippedEventArtIds(images);
  const byId = new Map(pictures.map(picture => [picture.id, picture]));

  // Provenance: one row per shipped picture; rows of earlier runs (event-art/…) replaced, the rest of the ledger as it was.
  const raw = text(LEDGER);
  const [header, ...body] = parseCsv(raw);
  if (header!.join(",") !== CSV_COLUMNS.join(",")) throw new Error(`${LEDGER}: unexpected header`);
  const rows = body.map(cells => Object.fromEntries(CSV_COLUMNS.map((name, index) => [name, cells[index] ?? ""])) as CsvRow);
  if (stringifyCsv(rows) !== raw) throw new Error(`${LEDGER} does not round-trip; refusing to rewrite it`);
  const ours: CsvRow[] = shipped.map(id => {
    const picture = byId.get(id)!;
    const record = generation(picture);
    const prompt = `docs/provenance/prompts/${id}-event-art.txt`;
    writeFileSync(path.join(ROOT, prompt), `${record.prompt}\n`, "utf8");
    const runtime = picture.file;
    const derived = buildKeyartDerivative({ id: `event_${id}`, source: picture.file, url: `assets/event-art/${id}.jpg`, format: "jpeg-reencoded" }, ROOT);
    return { assetId: `event-art/${id}`, version: record.version, runtimePath: runtime, runtimeSha256: picture.sha256, sourcePath: runtime, sourceSha256: picture.sha256,
      tool: record.tool, model: "not exposed", generatedAt: "not recorded", prompt, referenceInputs: record.references, seed: "not exposed", candidates: "1",
      manualEdits: `${record.edits}; no picture edits at install; at build re-encoded as a baseline JPEG q${JPEG_QUALITY} 4:2:0 (scripts/jpegDecode.ts, scripts/keyartDerivatives.ts jpeg-reencoded).`, artBible: "not recorded", historicalProfile: "not recorded", owner: "Astra event-art",
      usedIn: USED_IN, status: "runtime",
      notes: `Astra event-art ${id} (${picture.title}; content canon v4 id; confirmed in assets-inbox/INBOX_LEDGER.csv) installed by ${INSTALLED_BY} on ${INSTALLED_ON}; `
        + `runtime is assets/event-art/${id}.jpg, made at build from this received JPEG by scripts/keyartDerivatives.ts (format jpeg-reencoded: `
        + `${derived.length} bytes, sha256 ${sha(derived)}; the received file has no C2PA segment). `
        + "The records give no model or seed." };
  });
  const kept = rows.filter(row => !row.assetId.startsWith("event-art/") && !ours.some(mine => mine.runtimePath === row.runtimePath));
  writeFileSync(path.join(ROOT, LEDGER), stringifyCsv([...kept, ...ours]), "utf8");

  if (mark !== null) {
    // INSTALL_PROTOCOL 6: installed_by only for a picture a capture showed drawn by the real card (scripts/eventArtCaptures.mjs
    // captures.json `rows.pictures[id].ok`); a picture no longer shipped, or not shown, loses this task's mark.
    const captured = JSON.parse(text(mark)) as { rows: { pictures: Record<string, { ok: boolean }> } };
    const drawn = new Set(shipped.filter(id => captured.rows.pictures[id]?.ok === true));
    const ours = new Map(pictures.map(picture => [picture.file.slice("assets-inbox/".length), picture.id]));
    const ledger = text(INBOX_LEDGER);
    const crlf = ledger.split("\n", 1)[0]!.endsWith("\r");
    const eol = crlf ? "\r\n" : "\n";
    // Only the installed_by field (the last column) of the event pictures' rows changes; every other byte stays.
    const lines = ledger.split(eol).map(line => {
      const id = ours.get(line.split(",")[1] ?? "");
      if (id === undefined) return line;
      if (drawn.has(id)) {
        if (line.endsWith(",")) return `${line}${INSTALLED_BY}`;
        if (!line.endsWith(`,${INSTALLED_BY}`)) process.stderr.write(`left as it is (installed by another task): ${id}\n`);
        return line;
      }
      return line.endsWith(`,${INSTALLED_BY}`) ? line.slice(0, -INSTALLED_BY.length) : line;
    });
    writeFileSync(path.join(ROOT, INBOX_LEDGER), lines.join(eol), "utf8");
    marked = drawn.size;
  }

  const literal = (value: Readonly<Record<string, string | number>>) => `{${Object.entries(value).map(([key, field]) => `${JSON.stringify(key)}: ${JSON.stringify(field)}`).join(", ")}}`;
  const entries = pictures.map(picture => `  ${picture.id}: ${literal(images[picture.id]!)},`);
  writeFileSync(path.join(ROOT, MANIFEST),
    "// Generated by scripts/installEventArt.ts — the 200 confirmed event illustrations (EVENT-ART; assets-inbox/event-art/final200-20261004,\n"
    + "// key = the content canon v4 event id): 960 × 540 JPEGs, re-encoded at build (scripts/keyartDerivatives.ts, format jpeg-reencoded)\n"
    + "// only for the registry's entries (src/ui/eventArtSelection.ts). `path` is where a shipped one is served; `source` the received file.\n"
    + `export const EVENT_ART_IMAGES = {\n${entries.join("\n")}\n} as const;\n`, "utf8");
  const shippedBytes = shipped.reduce((sum, id) => sum + byId.get(id)!.bytes, 0);
  const derivedBytes = ours.reduce((sum, row) => sum + Number(/jpeg-reencoded: (\d+) bytes/.exec(row.notes)![1]), 0);
  const allBytes = pictures.reduce((sum, picture) => sum + picture.bytes, 0);
  console.log(`event-art ${pictures.length} pictures (${(allBytes / 1e6).toFixed(2)} MB); shipped ${shipped.length} (received ${(shippedBytes / 1e6).toFixed(2)} MB, built ${(derivedBytes / 1e6).toFixed(2)} MB): ${shipped.join(" ")}`
    + `${mark === null ? "" : `; installed_by ${INSTALLED_BY} on ${marked} rows`}`);
}

main();
