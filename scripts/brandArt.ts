import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND_COLOURS } from "../src/content/palette";
import { BRAND_COPY } from "../src/ui/brand/brandCopy.ko";

// LM-R3 (user decision 2026-10-08): the game logo and the seal are inline SVG in the UI, drawn from the brand kit's
// outlined SVGs (docs/design/brand/logos/*-outlined.svg, icons/seal-*.svg; glyphs as paths, no font). This script reads
// them, checks each against the kit's SHA256SUMS, and writes
//   src/ui/brand/brandArt.generated.ts  every variant's shapes as React-ready nodes: the kit's colours as BRAND_COLOURS
//                                       keys ("$wax"), the on-light/on-dark differences as tone slots ("~ink"), the wax
//                                       seal (the same group in every logo, 64 and 256) stored once, ids kept unprefixed
//                                       (GameLogo/SealMark prefix them per instance), titles/metadata/inner labels dropped;
//   index.html                          the window title, the Korean description and the favicon (the 32 px seal,
//                                       on-light, as a data URI of the kit's file).
// Run: npx tsx scripts/brandArt.ts      (tests/brandArt.test.ts checks the committed files match and the shapes are the kit's)

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const BRAND_DIR = "docs/design/brand";
export const BRAND_ART_FILES = { ts: "src/ui/brand/brandArt.generated.ts", html: "index.html" } as const;
export const FAVICON_SOURCE = "icons/seal-32-on-light.svg";

type Tone = "on-light" | "on-dark";
const TONES: readonly Tone[] = ["on-light", "on-dark"];
/** The colour pairs the kit swaps between on-light and on-dark, by slot. A new pair fails the script. */
const TONE_SLOT_PAIRS: Readonly<Record<string, string>> = { "waxShadow/rim": "edge", "oak/parchment": "ink" };

type Variant = { readonly key: string; readonly files: Readonly<Record<Tone, string>>; readonly seal: "full" | "small" };
const LOGO_VARIANTS: readonly Variant[] = (["ko", "en"] as const).flatMap(language => (["horizontal", "vertical"] as const).map(layout => ({
  key: `${language}-${layout}`,
  files: { "on-light": `logos/charter-kin-${language}-${layout}-on-light-outlined.svg`, "on-dark": `logos/charter-kin-${language}-${layout}-on-dark-outlined.svg` },
  seal: "full" as const,
})));
const SEAL_VARIANTS: readonly Variant[] = ([32, 64, 256] as const).map(size => ({
  key: String(size),
  files: { "on-light": `icons/seal-${size}-on-light.svg`, "on-dark": `icons/seal-${size}-on-dark.svg` },
  seal: size === 32 ? "small" as const : "full" as const,
}));

type XmlNode = { readonly tag: string; readonly attrs: readonly (readonly [string, string])[]; readonly children: XmlNode[] };
/** A node as the generated module writes it: [tag, attrs, children?]; "seal" stands for the shared wax-seal group. */
export type ArtNode = readonly [string, Readonly<Record<string, string>>, (readonly ArtNode[])?];

/** The kit's SVGs are plain XML (svg, title, metadata, g, path, circle; double-quoted attributes); text is dropped. */
export function parseSvg(text: string): XmlNode {
  const stack: XmlNode[] = [{ tag: "#root", attrs: [], children: [] }];
  for (const match of text.matchAll(/<\?[^>]*\?>|<(\/?)([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|[^<]+/g)) {
    if (match[2] === undefined) continue;
    if (match[1] === "/") { stack.pop(); continue; }
    const node: XmlNode = { tag: match[2], attrs: [...match[3]!.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name!, value!] as const), children: [] };
    stack.at(-1)!.children.push(node);
    if (match[4] !== "/") stack.push(node);
  }
  const svg = stack[0]!.children[0];
  if (svg?.tag !== "svg") throw new Error("brandArt: not an SVG");
  return svg;
}

const camel = (name: string): string => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
const COLOUR_KEYS = new Map(Object.entries(BRAND_COLOURS).map(([key, hex]) => [hex.toUpperCase(), key]));

/** One tone's node: React attribute names, colours as "$key", no inner labels. */
function artNode(node: XmlNode, file: string): ArtNode {
  const attrs: Record<string, string> = {};
  for (const [name, value] of node.attrs) {
    if (name === "aria-label") continue;
    if (/^#[0-9A-Fa-f]{3,8}$/.test(value)) {
      const key = COLOUR_KEYS.get(value.toUpperCase());
      if (key === undefined) throw new Error(`brandArt: ${file} uses ${value}, not in BRAND_COLOURS (src/content/palette.ts)`);
      attrs[camel(name)] = `$${key}`;
    } else attrs[camel(name)] = value;
  }
  const children = node.children.filter(child => child.tag !== "title" && child.tag !== "metadata").map(child => artNode(child, file));
  return children.length > 0 ? [node.tag, attrs, children] : [node.tag, attrs];
}

/** The on-light and on-dark nodes as one: equal but for colour pairs, which become tone slots ("~slot"). */
function mergeTones(light: ArtNode, dark: ArtNode, where: string): ArtNode {
  const [tag, lightAttrs, lightChildren = []] = light;
  const [darkTag, darkAttrs, darkChildren = []] = dark;
  if (tag !== darkTag || lightChildren.length !== darkChildren.length || Object.keys(lightAttrs).join() !== Object.keys(darkAttrs).join()) {
    throw new Error(`brandArt: ${where}: on-light and on-dark differ in shape`);
  }
  const attrs: Record<string, string> = {};
  for (const [name, value] of Object.entries(lightAttrs)) {
    const other = darkAttrs[name]!;
    if (value === other) { attrs[name] = value; continue; }
    const slot = value.startsWith("$") && other.startsWith("$") ? TONE_SLOT_PAIRS[`${value.slice(1)}/${other.slice(1)}`] : undefined;
    if (slot === undefined) throw new Error(`brandArt: ${where}: ${name} ${value} / ${other} is not a known tone pair`);
    attrs[name] = `~${slot}`;
  }
  const children = lightChildren.map((child, index) => mergeTones(child, darkChildren[index]!, where));
  return children.length > 0 ? [tag, attrs, children] : [tag, attrs];
}

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
export function kitSums(): ReadonlyMap<string, string> {
  return new Map(readFileSync(join(ROOT, BRAND_DIR, "SHA256SUMS"), "utf8").trim().split("\n").map(line => {
    const [sum, path] = line.split(/\s+/);
    return [path!, sum!] as const;
  }));
}

export function renderBrandArt(): { readonly ts: string; readonly html: string } {
  const sums = kitSums();
  const sources: { path: string; sha256: string }[] = [];
  const read = (path: string): string => {
    const text = readFileSync(join(ROOT, BRAND_DIR, path), "utf8");
    if (sha256(text) !== sums.get(path)) throw new Error(`brandArt: ${BRAND_DIR}/${path} does not match the kit's SHA256SUMS`);
    sources.push({ path: `${BRAND_DIR}/${path}`, sha256: sha256(text) });
    return text;
  };
  const seals: Partial<Record<"full" | "small", string>> = {};
  const sealNodes: Partial<Record<"full" | "small", ArtNode>> = {};
  const variant = (spec: Variant) => {
    const [light, dark] = TONES.map(tone => parseSvg(read(spec.files[tone])));
    const width = Number(light!.attrs.find(([name]) => name === "width")?.[1]);
    const height = Number(light!.attrs.find(([name]) => name === "height")?.[1]);
    const viewBox = light!.attrs.find(([name]) => name === "viewBox")?.[1];
    if (viewBox !== `0 0 ${width} ${height}`) throw new Error(`brandArt: ${spec.key}: viewBox ${viewBox} is not 0 0 ${width} ${height}`);
    const merged = mergeTones(artNode(light!, spec.files["on-light"]), artNode(dark!, spec.files["on-dark"]), spec.key);
    // The wax seal: the same group wherever it appears (per detail); stored once, referenced as ["seal", { art }].
    const shareSeal = (node: ArtNode): ArtNode => {
      if (node[0] === "g" && node[1]["id"] === "wax-seal") {
        const json = JSON.stringify(node);
        if (seals[spec.seal] !== undefined && seals[spec.seal] !== json) throw new Error(`brandArt: ${spec.key}: its wax seal differs from the others`);
        seals[spec.seal] = json;
        sealNodes[spec.seal] = node;
        return ["seal", { art: spec.seal }];
      }
      return node[2] === undefined ? node : [node[0], node[1], node[2].map(shareSeal)];
    };
    const body = (merged[2] ?? []).map(shareSeal);
    if (!JSON.stringify(body).includes('["seal"')) throw new Error(`brandArt: ${spec.key} has no wax-seal group`);
    return { width, height, body };
  };
  const logos = Object.fromEntries(LOGO_VARIANTS.map(spec => [spec.key, variant(spec)]));
  const icons = Object.fromEntries(SEAL_VARIANTS.map(spec => [spec.key, variant(spec)]));
  const favicon = read(FAVICON_SOURCE);

  const entry = ([key, value]: [string, { width: number; height: number; body: readonly ArtNode[] }]) =>
    `  ${JSON.stringify(key)}: { width: ${value.width}, height: ${value.height}, body: ${JSON.stringify(value.body)} },`;
  const ts = [
    "// Generated by scripts/brandArt.ts (LM-R3) from the brand kit's outlined SVGs (docs/design/brand). Do not edit by hand.",
    "// The shapes are the kit's, unchanged: colours are BRAND_COLOURS keys (\"$wax\"), the on-light/on-dark swaps tone slots",
    "// (\"~ink\" → TONE_SLOTS), [\"seal\", { art }] the shared wax-seal group (SEAL_ART). Ids are the kit's; the components",
    "// prefix them per instance so two logos can share a page. Kit colours are brand, not UI palette (src/content/palette.ts).",
    'import type { BRAND_COLOURS } from "../../content/palette";',
    "",
    "export type BrandArtNode = readonly [tag: string, attrs: Readonly<Record<string, string>>, children?: readonly BrandArtNode[]];",
    "export type BrandArt = { readonly width: number; readonly height: number; readonly body: readonly BrandArtNode[] };",
    "export type BrandTone = \"on-light\" | \"on-dark\";",
    "",
    `export const BRAND_SOURCES: readonly { readonly path: string; readonly sha256: string }[] = ${JSON.stringify(sources, null, 1).replace(/\n\s*/g, " ")};`,
    "",
    `export const TONE_SLOTS: Readonly<Record<BrandTone, Readonly<Record<string, keyof typeof BRAND_COLOURS>>>> = {`,
    ...TONES.map(tone => `  ${JSON.stringify(tone)}: { ${Object.entries(TONE_SLOT_PAIRS).map(([pair, slot]) => `${slot}: ${JSON.stringify(pair.split("/")[tone === "on-light" ? 0 : 1])}`).join(", ")} },`),
    "};",
    "",
    "export const SEAL_ART: Readonly<Record<\"full\" | \"small\", BrandArtNode>> = {",
    `  full: ${JSON.stringify(sealNodes.full)},`,
    `  small: ${JSON.stringify(sealNodes.small)},`,
    "};",
    "",
    "/** By `${language}-${layout}`. */",
    "export const LOGO_ART: Readonly<Record<\"ko-horizontal\" | \"ko-vertical\" | \"en-horizontal\" | \"en-vertical\", BrandArt>> = {",
    ...Object.entries(logos).map(entry),
    "};",
    "",
    "/** By the kit's icon size: 32 is the optical-small seal (no minor veins), 64 and 256 the standard one. */",
    "export const SEAL_ICON_ART: Readonly<Record<\"32\" | \"64\" | \"256\", BrandArt>> = {",
    ...Object.entries(icons).map(entry),
    "};",
    "",
  ].join("\n");

  const href = `data:image/svg+xml,${encodeURIComponent(favicon).replace(/%20/g, " ").replace(/%2F/g, "/").replace(/%3D/g, "=").replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%3B/g, ";")}`;
  const before = readFileSync(join(ROOT, BRAND_ART_FILES.html), "utf8");
  const html = replaceOnce(replaceOnce(replaceOnce(before,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${BRAND_COPY.description}" />`),
    /<link rel="icon"[^>]*\/>/, `<link rel="icon" type="image/svg+xml" href="${href}" />`),
    /<title>[^<]*<\/title>/, `<title>${BRAND_COPY.windowTitle.replace("&", "&amp;")}</title>`);
  return { ts, html };
}

function replaceOnce(text: string, pattern: RegExp, replacement: string): string {
  if (!pattern.test(text)) throw new Error(`brandArt: index.html has no ${pattern}`);
  return text.replace(pattern, () => replacement);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = renderBrandArt();
  writeFileSync(join(ROOT, BRAND_ART_FILES.ts), out.ts);
  writeFileSync(join(ROOT, BRAND_ART_FILES.html), out.html);
  console.log(`brandArt: wrote ${BRAND_ART_FILES.ts} (${Buffer.byteLength(out.ts)} bytes) and ${BRAND_ART_FILES.html}`);
}
