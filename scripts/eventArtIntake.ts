/**
 * EVENT-ART intake: the confirmed event illustrations of every pack Astra delivered → src/ui/eventArtManifest.generated.ts.
 * A pack is a batch under assets-inbox/event-art/ with its own records/ASSETS.csv (event_id, file, sha256, title): today
 * final200-20261004 (INBOX-3z, confirmed 2026-10-04) and v41-201-215-20261007 (INBOX-4b, the v4.1 new events). A new
 * batch filed the same way is read with no code change; an id two packs both name is refused.
 * Run it only when pictures arrive or change in the inbox; turning an event on needs nothing here (EVA-AUTO: the build
 * ships the live entries' pictures, src/ui/eventArtSelection.ts, and `npm run eventart:auto` draws each through the real
 * card and then writes its provenance row and its ledger mark).
 * File name = the content canon v4 event id; records/ASSETS.csv maps each id to its file. Most are in the pack's assets/;
 * final200's identical ones that stayed in older batches (its records/README.md lists each: event-art/candidates-20261003,
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
const EVENT_ART = "assets-inbox/event-art";
/** final200's records keep one ASSETS.csv per review round (records/rNN/); the generation reader below follows them. */
const FINAL200 = `${EVENT_ART}/final200-20261004`;
/** The packs: every batch under assets-inbox/event-art/ with a records/ASSETS.csv, in name order. */
export const PACKS: readonly string[] = readdirSync(path.join(ROOT, EVENT_ART))
  .filter(name => existsSync(path.join(ROOT, EVENT_ART, name, "records", "ASSETS.csv"))).sort().map(name => `${EVENT_ART}/${name}`);
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
  if (batch === FINAL200.slice("assets-inbox/".length)) {
    // The round that selected these bytes: its ASSETS.csv row with this id and SHA, and that version's prompt file.
    const rounds = readdirSync(path.join(ROOT, FINAL200, "records")).filter(name => /^r\d\d$/.test(name)).sort().reverse();
    for (const round of rounds) {
      const direct = `${FINAL200}/records/${round}/ASSETS.csv`;
      const assets = existsSync(path.join(ROOT, direct)) ? direct : `${FINAL200}/records/${round}/records/assets.csv`;
      if (!existsSync(path.join(ROOT, assets))) continue;
      const row = table(assets).find(entry => entry.event_id === picture.id && entry.sha256 === picture.sha256);
      if (row === undefined) continue;
      // A round names its version "v2" or plainly "2" (the prompt file is …-v2.txt); "existing_reuse" took an earlier
      // round's; r03 and r04 keep one prompt per picture (…/prompts/<id>.txt) and no version, so the round stands for it.
      const version = row.selected_version === undefined ? round : /^\d+$/.test(row.selected_version) ? `v${row.selected_version}` : row.selected_version;
      const prompt = `${FINAL200}/records/${round}/prompts/${picture.id}${row.selected_version === undefined ? "" : `-${version}`}.txt`;
      if (!existsSync(path.join(ROOT, prompt))) {
        if (version === "existing_reuse") continue;
        throw new Error(`${picture.id}: ${round} selected ${row.selected_version} but ${prompt} is missing`);
      }
      if (round === "r01" || round === "r02") {
        const records = `${FINAL200}/records/${round}/records`;
        const provenance: Record<string, unknown> = JSON.parse(text(`${records}/provenance.json`));
        const number = picture.id.slice("ck_evt_".length);
        const archived: string[] = [];
        for (const name of readdirSync(path.join(ROOT, records)).sort()) {
          if (!/^(?:.*prompts.*|rework-plan-v2|final\d+)\.json$/.test(name)) continue;
          const record: Record<string, unknown> = JSON.parse(text(`${records}/${name}`));
          const value = name === `final${number}.json` ? record.prompt : record[number];
          if (typeof value === "string") archived.push(`[archived round prompt: ${records}/${name}]\n${value}`);
        }
        return { version: round, tool: typeof provenance.tool === "string" ? provenance.tool : "not recorded",
          prompt: [text(prompt), ...archived].join("\n\n"),
          references: typeof provenance.reference === "string" ? provenance.reference : "not recorded",
          edits: `${String(provenance.postprocess ?? provenance.processing ?? "not recorded")}; selected JPEG SHA matches ${assets}; `
            + `${archived.length} additional archived round prompt(s) preserved verbatim, not asserted to be an exact selected edit chain` };
      }
      if (row.selected_version === undefined) {
        // r03/r04: the generation prompt, then every other prompt the round kept for this picture (redraws and edits),
        // each under its file name; the round's records (…-paths.json, edits-*.json) say which edit was kept.
        const others = readdirSync(path.join(ROOT, FINAL200, "records", round, "prompts")).filter(name => name.startsWith(`${picture.id}-`)).sort();
        const selected = (["composition", "semantic"] as const).flatMap(kind => {
          const file = path.join(ROOT, FINAL200, "records", round, "records", `${kind}-edit-paths.json`);
          if (!existsSync(file)) return [];
          const paths = JSON.parse(readFileSync(file, "utf8")) as { selected?: Record<string, { version: string }>; edits?: Record<string, { version: string }> };
          const chosen = (paths.selected ?? paths.edits ?? {})[String(Number(picture.id.slice("ck_evt_".length)))];
          return chosen === undefined ? [] : [`${kind}-${chosen.version}`];
        });
        return { version: selected.at(-1) ?? round, tool: `not recorded in the ${round} records`,
          prompt: [text(prompt).trim(), ...others.map(name => `[${name}] ${text(`${FINAL200}/records/${round}/prompts/${name}`).trim()}`)].join("\n\n"), references: "not recorded",
          edits: `${round} as delivered${selected.length === 0 ? "" : ` (selected edit ${selected.join(", ")} in records/${round}/records/*-edit-paths.json)`}; `
            + `${others.length} further prompt(s) of the round for this picture kept in the prompt file (final200 records/${round}/ASSETS.csv)` };
      }
      return { version, tool: `not recorded in the ${round} records`, prompt: text(prompt).trim(), references: "not recorded",
        edits: `${round} ${row.selected_version} as selected (final200 records/${round}/ASSETS.csv)` };
    }
    throw new Error(`${picture.id}: no round record selects ${picture.sha256}`);
  }
  if (PACKS.includes(`assets-inbox/${batch}`) && existsSync(path.join(ROOT, `assets-inbox/${batch}/records/prompts/${picture.id}.txt`))) {
    // A pack that keeps one saved prompt per picture (records/prompts/<id>.txt) and the selected version in ASSETS.csv
    // (v41-201-215: "_v2"); its records/records/generation-history.json lists every generation by SHA.
    const row = table(`assets-inbox/${batch}/records/ASSETS.csv`).find(entry => entry.event_id === picture.id && entry.sha256 === picture.sha256);
    if (row === undefined) throw new Error(`${picture.id}: ${batch} records/ASSETS.csv has no row with ${picture.sha256}`);
    const version = (row.version ?? "").replace(/^_/, "") || "as delivered";
    return { version, tool: "not recorded in the pack's records", prompt: text(`assets-inbox/${batch}/records/prompts/${picture.id}.txt`).trim(),
      references: "not recorded", edits: `${version} as selected (${batch} records/ASSETS.csv; records/records/generation-history.json lists the generations)` };
  }
  if (batch === "wave44/candidates-20261002") {
    const record = (JSON.parse(text(`assets-inbox/${batch}/records/manifest.json`)) as Record<string, unknown>[])
      .find(entry => entry.sha256 === picture.sha256)!;
    return { version: `v${String(record.selected_version)}`, tool: "built-in image_gen", prompt: String(record.prompt_exact).trim(),
      references: (record.reference_images as string[]).join(";"), edits: `${String(record.crop_or_edit)} (wave44 pack record)` };
  }
  throw new Error(`${picture.id}: no generation record reader for ${batch}`);
}


/** One pack's pictures in its ASSETS.csv order, each checked against the inbox ledger and its own bytes (throws on any doubt). */
function readPack(pack: string, byFile: ReadonlyMap<string, Record<string, string>>): Picture[] {
  const assets = table(`${pack}/records/ASSETS.csv`);
  // records/README.md (final200): the identical pictures already in the ledger, each with the file it is (`ck_evt_NNN(`path`)`).
  const readme = `${pack}/records/README.md`;
  const elsewhere = new Map(existsSync(path.join(ROOT, readme))
    ? [...text(readme).matchAll(/(ck_evt_\d{3})\(`([^`]+)`\)/g)].map(match => [match[1]!, `assets-inbox/${match[2]!}`] as const) : []);
  const local = new Set(readdirSync(path.join(ROOT, pack, "assets")));
  if (new Set(assets.map(row => row.event_id)).size !== assets.length) throw new Error(`${pack}: ASSETS.csv names an id twice`);
  if (local.size + elsewhere.size !== assets.length) throw new Error(`${pack}: ${local.size} in assets/ + ${elsewhere.size} elsewhere ≠ ${assets.length} ASSETS.csv rows`);

  const pictures: Picture[] = [];
  for (const row of assets) {
    const id = row.event_id!;
    const file = elsewhere.get(id) ?? `${pack}/${row.file}`;
    if (!elsewhere.has(id) && !local.delete(path.basename(row.file!))) throw new Error(`${id}: ${row.file} is not in ${pack}/assets`);
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
    // final200 calls the title `title`, v41-201-215 `title_ko`.
    const title = row.title || row.title_ko;
    if (!title) throw new Error(`${id}: ${pack} records/ASSETS.csv gives no title`);
    pictures.push({ id, title, file, sha256: digest, bytes: data.length });
  }
  const unnamed = [...local];
  if (unnamed.length > 0) throw new Error(`${pack}/assets has files no id names: ${unnamed.join(", ")}`);
  return pictures;
}

/** Every pack's pictures, pack by pack (an id two packs name is refused: which picture is current would be a guess). */
export function readEventArtPack(): Picture[] {
  const byFile = new Map(table(INBOX_LEDGER).map(row => [`assets-inbox/${row.file}`, row]));
  const pictures = PACKS.flatMap(pack => readPack(pack, byFile));
  const twice = pictures.map(picture => picture.id).filter((id, index, ids) => ids.indexOf(id) !== index);
  if (twice.length > 0) throw new Error(`event ids in two packs: ${[...new Set(twice)].join(", ")}`);
  return pictures;
}

/** src/ui/eventArtManifest.generated.ts for these pictures (key = the event id; `path` where the build serves it). */
export function eventArtManifestText(pictures: readonly Picture[]): string {
  const literal = (value: Readonly<Record<string, string | number>>) => `{${Object.entries(value).map(([key, field]) => `${JSON.stringify(key)}: ${JSON.stringify(field)}`).join(", ")}}`;
  const entries = pictures.map(picture => `  ${picture.id}: ${literal({ path: `assets/event-art/${picture.id}.jpg`, width: SIZE[0], height: SIZE[1], title: picture.title, source: picture.file })},`);
  return "// Generated by scripts/eventArtIntake.ts — the confirmed event illustrations (EVENT-ART; every pack under assets-inbox/event-art/,\n"
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
