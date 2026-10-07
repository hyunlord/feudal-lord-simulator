/**
 * EVENT-ART intake: the confirmed event illustrations of the pack Astra delivered (assets-inbox/event-art/final200-20261004,
 * filed by INBOX-3z, confirmed 2026-10-04 in assets-inbox/INBOX_LEDGER.csv) → src/ui/eventArtManifest.generated.ts.
 * Run it only when pictures arrive or change in the inbox; turning an event on needs nothing here (EVA-AUTO: the build
 * ships the live entries' pictures, src/ui/eventArtSelection.ts, and `npm run eventart:auto` draws each through the real
 * card and then writes its provenance row and its ledger mark).
 * File name = the content canon v4 event id; records/ASSETS.csv maps each id to its file. Most are in the pack's assets/;
 * the identical ones that stayed in older batches (records/README.md lists each: event-art/candidates-20261003,
 * event-art/rework-20261003, wave44 07_market_stall_dispute.jpg for ck_evt_012) are each read where they lie and checked
 * byte for byte against ASSETS.csv.
 * Every picture: its ledger row confirmed with no replaced_by, its SHA-256 = ASSETS.csv's = the ledger's, 960 × 540 from
 * the JPEG frame header, no APPn JUMBF / C2PA segment. The build ships each re-encoded as a smaller baseline JPEG
 * (scripts/keyartDerivatives.ts, format jpeg-reencoded — user decision 2026-10-05: the received files and the ledger stay
 * as they are; no public/ copy), loaded when its card opens.
 * The manifest stays committed (EVA-AUTO): tests, tsx scripts and the build all import it, and tests/eventArtAuto.test.ts
 * checks that this intake writes the same file.
 * Run: node_modules/.bin/tsx scripts/eventArtIntake.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "./provenanceLedgerCsv";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
export const PACK = "assets-inbox/event-art/final200-20261004";
const INBOX_LEDGER = "assets-inbox/INBOX_LEDGER.csv";
export const MANIFEST = "src/ui/eventArtManifest.generated.ts";
const SIZE = [960, 540] as const;

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

export type Picture = { id: string; title: string; file: string; sha256: string; bytes: number };

/** The generation record of a picture by the batch it lies in (never a model or seed the records do not give). */
export function generation(picture: Picture): { version: string; tool: string; prompt: string; references: string; edits: string } {
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


/** The pack's pictures in ASSETS.csv order, each checked against the inbox ledger and its own bytes (throws on any doubt). */
export function readEventArtPack(): Picture[] {
  const assets = table(`${PACK}/records/ASSETS.csv`);
  // records/README.md: the identical pictures already in the ledger, each with the file it is (`ck_evt_NNN(`path`)`).
  const elsewhere = new Map([...text(`${PACK}/records/README.md`).matchAll(/(ck_evt_\d{3})\(`([^`]+)`\)/g)].map(match => [match[1]!, `assets-inbox/${match[2]!}`]));
  const inbox = table(INBOX_LEDGER);
  const byFile = new Map(inbox.map(row => [`assets-inbox/${row.file}`, row]));
  const local = new Set(readdirSync(path.join(ROOT, PACK, "assets")));
  if (new Set(assets.map(row => row.event_id)).size !== assets.length) throw new Error("ASSETS.csv names an id twice");
  if (local.size + elsewhere.size !== assets.length) throw new Error(`${PACK}: ${local.size} in assets/ + ${elsewhere.size} elsewhere ≠ ${assets.length} ASSETS.csv rows`);

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
  return pictures;
}

/** src/ui/eventArtManifest.generated.ts for these pictures (key = the event id; `path` where the build serves it). */
export function eventArtManifestText(pictures: readonly Picture[]): string {
  const literal = (value: Readonly<Record<string, string | number>>) => `{${Object.entries(value).map(([key, field]) => `${JSON.stringify(key)}: ${JSON.stringify(field)}`).join(", ")}}`;
  const entries = pictures.map(picture => `  ${picture.id}: ${literal({ path: `assets/event-art/${picture.id}.jpg`, width: SIZE[0], height: SIZE[1], title: picture.title, source: picture.file })},`);
  return "// Generated by scripts/eventArtIntake.ts — the confirmed event illustrations (EVENT-ART; assets-inbox/event-art/final200-20261004,\n"
    + "// key = the content canon v4 event id): 960 × 540 JPEGs, re-encoded at build (scripts/keyartDerivatives.ts, format jpeg-reencoded)\n"
    + "// only for the registry's live entries (src/ui/eventArtSelection.ts). `path` is where a shipped one is served; `source` the received file.\n"
    + `export const EVENT_ART_IMAGES = {\n${entries.join("\n")}\n} as const;\n`;
}

/** The pack's pictures, when the committed manifest is what this intake writes from the inbox (else it throws). */
export function eventArtIntakeCheck(): Picture[] {
  const pictures = readEventArtPack();
  if (readFileSync(path.join(ROOT, MANIFEST), "utf8") !== eventArtManifestText(pictures)) {
    throw new Error(`${MANIFEST} is not what the inbox gives: run node_modules/.bin/tsx scripts/eventArtIntake.ts (the pictures in the inbox changed)`);
  }
  return pictures;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  const pictures = readEventArtPack();
  writeFileSync(path.join(ROOT, MANIFEST), eventArtManifestText(pictures), "utf8");
  console.log(`event-art intake: ${pictures.length} pictures (${(pictures.reduce((sum, picture) => sum + picture.bytes, 0) / 1e6).toFixed(2)} MB) → ${MANIFEST}`);
}
