// PERSON-0 (spec docs/design/persons.md PS-5): builds `src/content/portraitPool.ts` from the portrait pool CSVs
// (pilot P01–P36, pool 1 and pool 2 I037–I100, pool 3 I101–I124 — the factions' leaders — docs/design/portraits/). Only
// the attributes the matcher reads are kept.
// PERSON-1a (spec docs/design/lineage.md LN-6, LN-8): each picture's traits (hair, skin, eyes, face, nose, build) read
// from its record's words, and the lineage portraits (assets-inbox/lineage*/, the pictures confirmed in the inbox
// ledger): the sets L1–L8 (a family over three generations) and the common babies, toddlers and children.
//   tsx scripts/portraitPoolImport.ts
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import {
  buildFromWords, eyeFromWords, faceFromWords, hairFromWords, noseFromWords, skinFromWords, type PersonTraits,
} from "../src/content/personTraits";

const FILES = ["portrait_pilot.csv", "portrait_pool1.csv", "portrait_pool2.csv", "portrait_pool3.csv"] as const;
/** The lineage packs, oldest first (their records are merged by identity: a later redraw keeps the first record's traits). */
const LINEAGE_PACKS = ["lineage-pilot/pilot1-20260928", "lineage-pilot/pilot2-20260928", "lineage/prod1-20260928",
  "lineage/prod1-costume-v2-20260928", "lineage/prod2-20260928"] as const;
/** LN-7: each set's family's class (its clothes), and its trade or office. */
const SET_CLASS: Readonly<Record<string, { readonly classBand: string; readonly occupation: string }>> = {
  L1: { classBand: "gentry", occupation: "lord" }, L3: { classBand: "gentry", occupation: "lord" },
  L2: { classBand: "merchant", occupation: "merchant" }, L4: { classBand: "merchant", occupation: "merchant" },
  L5: { classBand: "labour", occupation: "reeve" }, L6: { classBand: "gentry", occupation: "earl" },
  L7: { classBand: "gentry", occupation: "knight_lord" }, L8: { classBand: "artisan", occupation: "miller" },
};

/** RFC 4180 rows (quoted fields, doubled quotes, commas and newlines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function records(path: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(readFileSync(path, "utf8").replace(/^﻿/, ""));
  return rows.map(row => Object.fromEntries(header!.map((name, index) => [name, row[index] ?? ""])));
}

/** A record's JSON field as words (objects and arrays flattened; broken JSON as its text). */
function words(value: string): Record<string, string> {
  if (value.trim() === "" || value === "null") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    const flat: Record<string, string> = {};
    const walk = (node: unknown, key: string) => {
      if (typeof node === "string") flat[key] = flat[key] === undefined ? node : `${flat[key]} | ${node}`;
      else if (Array.isArray(node)) node.forEach(item => walk(item, key));
      else if (node !== null && typeof node === "object") for (const [name, inner] of Object.entries(node)) walk(inner, name);
    };
    walk(parsed, "text");
    return flat;
  } catch { return { text: value }; }
}

/** The items of a list of descriptions (`a | b`, or a sentence of commas) that speak of one feature. */
const about = (value: string, feature: RegExp) => value.split(/ \| |, /).filter(item => feature.test(item)).join(" | ");

/**
 * Traits from the fields of one or more records (the first that names a trait wins). A field of a named trait (hair,
 * skin_tone, faceShape …) is read whole; a description list (`text`, `features`) only by the items about the feature
 * ("pale blue eyes" is not pale hair).
 */
function traitsOf(fields: readonly Record<string, string>[]): Partial<PersonTraits> {
  const pick = <T>(read: (text: string) => T | undefined, keys: readonly string[], feature: RegExp): T | undefined => {
    for (const field of fields) for (const key of [...keys, "features", "text"]) {
      const raw = field[key];
      if (raw === undefined || raw === "") continue;
      const value = keys.includes(key) ? raw : about(raw, feature);
      if (value === "") continue;
      const trait = read(value);
      if (trait !== undefined) return trait;
    }
    return undefined;
  };
  const traits: Record<string, unknown> = {
    hair: pick(hairFromWords, ["hair", "hair_color"], /hair|curl|lock|tuft|wisp|down\b/),
    skin: pick(skinFromWords, ["skin", "skin_tone"], /skin|complexion/),
    eye: pick(eyeFromWords, ["eyes", "eye"], /eye/),
    faceShape: pick(faceFromWords, ["faceShape"], /face|jaw|chin|skull|cranium|head/),
    nose: pick(noseFromWords, ["nose"], /nose|nasal/),
    buildBias: pick(buildFromWords, ["build", "body"], /shoulder|build|stocky|slender|neck/),
  };
  return Object.fromEntries(Object.entries(traits).filter(([, value]) => value !== undefined)) as Partial<PersonTraits>;
}

const entries: Record<string, unknown>[] = [];
const sources: string[] = [];
for (const file of FILES) {
  const raw = readFileSync(`docs/design/portraits/${file}`);
  sources.push(`${file} ${createHash("sha256").update(raw).digest("hex")}`);
  for (const row of records(`docs/design/portraits/${file}`)) {
    const stage = row.stage!;
    const band = stage === "pool" ? row.age_group! : stage;
    const body = row.body!;
    entries.push({
      id: row.id, identityId: row.identity_id, stage, band, file: row.file,
      sex: row.sex === "f" ? "female" : "male", age: Number(row.age), classBand: row.class ?? "",
      occupation: row.occupation ?? "", role: row.role ?? "", build: body === "fat" || body === "heavy" ? "heavy" : body,
      ...(row.faction === undefined || row.faction === "" ? {} : { faction: row.faction, rank: row.rank }),
      traits: traitsOf([row]),
    });
  }
}

// PERSON-1a: the lineage portraits the inbox ledger confirmed, with their pack's records merged by identity.
const ledger = records("assets-inbox/INBOX_LEDGER.csv");
const byIdentity = new Map<string, Record<string, string>[]>();
const byAsset = new Map<string, Record<string, string>>();
for (const pack of LINEAGE_PACKS) {
  for (const row of records(`assets-inbox/${pack}/records/assets.csv`)) {
    const asset = row.asset_id || row.id!;
    const identity = row.identity || asset.replace(/_(baby|toddler|child|young|mature|old)(-v2)?$/, "");
    byAsset.set(`${pack}/${asset}`, row);
    byIdentity.set(identity, [...(byIdentity.get(identity) ?? []), row]);
  }
}
const confirmed = ledger.filter(row => (row.wave === "lineage" || row.wave === "lineage-pilot") && row.status === "confirmed"
  && row.file!.endsWith(".png") && row.file!.includes("/assets/")).sort((a, b) => a.file!.localeCompare(b.file!));
// The ledger's other columns (who installed a picture) change on install: the source is its confirmed pictures and bytes.
sources.push(`${confirmed.length} confirmed lineage pictures ${createHash("sha256").update(confirmed.map(row => `${row.file} ${row.sha256}`).join("\n")).digest("hex")}`);
const BAND_OF_STAGE: Readonly<Record<string, string>> = { baby: "baby", toddler: "toddler", child: "child", young: "young", mature: "mature", old: "old" };
for (const row of confirmed) {
  const pack = row.file!.split("/").slice(0, 2).join("/");
  const asset = basename(row.file!, ".png");
  const record = byAsset.get(`${pack}/${asset}`) ?? {};
  const stage = (record.stage || asset.split("_").at(-1)!).replace(/-v2$/, "");
  const identity = record.identity || asset.replace(/_(baby|toddler|child|young|mature|old)(-v2)?$/, "");
  const lineage = identity.startsWith("C_") || identity.startsWith("L0_") ? "common" : identity.split("_")[0]!;
  const kin = byIdentity.get(identity) ?? [];
  const fieldsOf = (source: Record<string, string>) => [words(source.traits ?? ""), words(source.common_traits ?? ""), words(source.difference_markers ?? "")];
  const traits = traitsOf([record, ...kin].flatMap(fieldsOf));
  const generation = Number(record.generation || /_(\d)/.exec(identity)?.[1] || 0);
  const parents = words(record.parents ?? "").text?.split(" ") ?? [];
  const father = record.father || record.father_identity || kin.map(source => source.father || source.father_identity).find(value => value) || parents[0] || "";
  const mother = record.mother || record.mother_identity || kin.map(source => source.mother || source.mother_identity).find(value => value) || parents[1] || "";
  const set = SET_CLASS[lineage];
  const sex = (record.sex || kin.map(source => source.sex).find(value => value) || "male") === "female" ? "female" : "male";
  entries.push({
    id: asset.replace(/-v2$/, ""), identityId: identity, stage, band: BAND_OF_STAGE[stage] ?? stage, file: row.file,
    sex, age: Number(record.age || 0), classBand: lineage === "common" ? "child" : set?.classBand ?? "labour",
    occupation: lineage === "common" ? "child" : set?.occupation ?? "", role: "", build: traits.buildBias ?? "average",
    lineage, ...(generation > 0 ? { generation } : {}), ...(father === "" ? {} : { father }), ...(mother === "" ? {} : { mother }),
    traits,
  });
}

// An aging chain is one person: a trait one picture's record leaves out (grey hair, a covered head) is its other pictures'.
const known = new Map<string, Record<string, unknown>>();
for (const entry of entries) {
  const traits = known.get(entry.identityId as string) ?? {};
  for (const [key, value] of Object.entries(entry.traits as object)) traits[key] ??= value;
  known.set(entry.identityId as string, traits);
}
for (const entry of entries) entry.traits = { ...known.get(entry.identityId as string), ...(entry.traits as object) };

writeFileSync("src/content/portraitPool.ts", `// Generated by scripts/portraitPoolImport.ts from docs/design/portraits/*.csv and the lineage packs' records in
// assets-inbox (the pictures the inbox ledger confirmed) — do not edit by hand.
// Sources (sha256): ${sources.join("; ")}
import type { PersonTraits } from "./personTraits";

export interface PortraitEntry {
  readonly id: string;
  readonly identityId: string;
  /** "pool" (pilot, one picture) or an aging stage: baby · toddler · child · young · mature · old. */
  readonly stage: string;
  /** Age band the picture shows: baby (0–2) · toddler (3–5) · child · young · mature · old. */
  readonly band: "baby" | "toddler" | "child" | "young" | "mature" | "old";
  /** The received picture: \`portraits/…\` in its pool pack, or the lineage picture's path in assets-inbox. */
  readonly file: string;
  readonly sex: "female" | "male";
  readonly age: number;
  readonly classBand: string;
  readonly occupation: string;
  readonly role: string;
  readonly build: "thin" | "average" | "heavy";
  /** Pool 3 (CODE-1a): the faction whose leaders and heirs wear the face (earl_house, crown, neighbor_a …) and the rank. */
  readonly faction?: string;
  readonly rank?: string;
  /** PERSON-1a (LN-6): the traits the picture shows, as far as its record names them. */
  readonly traits: Partial<PersonTraits>;
  /** PERSON-1a (LN-7): a lineage set's picture (L1–L8), or \`common\` (the babies, toddlers and children of every town). */
  readonly lineage?: string;
  /** The set's generation (1 the founding couple, 2 their children and the spouses married in, 3 the grandchildren). */
  readonly generation?: number;
  /** The set identities of the pictured person's parents. */
  readonly father?: string;
  readonly mother?: string;
}

export const PORTRAIT_POOL: readonly PortraitEntry[] = [
${entries.map(entry => `  ${JSON.stringify(entry)},`).join("\n")}
];
`);
const lineageCount = entries.filter(entry => entry.lineage !== undefined).length;
process.stdout.write(`${entries.length} portraits (${lineageCount} lineage)\n`);
