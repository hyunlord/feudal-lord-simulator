import { readFile } from "node:fs/promises";

import { SEMANTIC_PALETTE } from "../src/content/palette";

type AuditRole = "body" | "heading" | "numeric" | "warning";

type AuditEntry = {
  readonly selector: string;
  readonly foregroundToken: string;
  readonly backgroundToken: string;
  readonly fontSizePx: number;
  readonly role: AuditRole;
};

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);
const AUDIT_PATTERN = /\/\*\s*contrast-audit\s+([^*]+?)\s*\*\//g;
const FIELD_PATTERN = /([a-z]+)="([^"]+)"/g;
const CSS_RULE_PATTERN = /([^{}]+)\{([^{}]*)\}/g;
const TEXT_RULE_PATTERN = /([^{}]+)\{([^{}]*(?:font-size|color)[^{}]*)\}/g;
const NUMERIC_FONT_PATTERN = /font-family:\s*ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace/;
const EXEMPT_SELECTOR_PATTERN = /::|:disabled|:focus|:hover|:root|html|body|button|visually-hidden|game-canvas|seal-glyph|svg|@|--/;
const PRESENTATION_ONLY_PATTERN = /\.app-shell|\.court-console|\.build-seals|\.map-shield|\.shield-caption|\.build-seal|\.speed-seal|\.road-tool|\.overlay-seal|\.era-ceremony$|\.onboarding-task--|\.settlement-target|\.settlement-priority/;

const TOKEN_VALUES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SEMANTIC_PALETTE).map(([name, colour]) => [
    `--palette-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
    colour,
  ]),
);

function parseAuditEntries(css: string): readonly AuditEntry[] {
  return [...css.matchAll(AUDIT_PATTERN)].map((match) => {
    const fieldSource = match[1];
    if (fieldSource === undefined) throw new Error(`Malformed contrast audit entry: ${match[0]}`);
    const fields = Object.fromEntries([...fieldSource.matchAll(FIELD_PATTERN)].flatMap((field) => {
      const name = field[1];
      const value = field[2];
      return name === undefined || value === undefined ? [] : [[name, value]];
    }));
    const selector = fields["selector"];
    const foregroundToken = fields["fg"];
    const backgroundToken = fields["bg"];
    const size = Number(fields["size"]);
    const role = fields["role"];
    if (
      selector === undefined
      || foregroundToken === undefined
      || backgroundToken === undefined
      || !Number.isFinite(size)
      || !isAuditRole(role)
    ) {
      throw new Error(`Malformed contrast audit entry: ${match[0]}`);
    }
    return { selector, foregroundToken, backgroundToken, fontSizePx: size, role };
  });
}

function isAuditRole(value: string | undefined): value is AuditRole {
  return value === "body" || value === "heading" || value === "numeric" || value === "warning";
}

function ruleForSelector(css: string, selector: string): string {
  const matchingRules: string[] = [];
  const normalizedSelector = normalizeSelector(selector);
  for (const match of css.matchAll(CSS_RULE_PATTERN)) {
    const selectorSource = match[1];
    const body = match[2];
    if (selectorSource === undefined || body === undefined) continue;
    const selectorGroup = stripComments(selectorSource).trim();
    if (selectorGroup.startsWith("@")) continue;
    const selectors = selectorGroup.split(",").map((item) => normalizeSelector(item.trim()));
    if (selectors.includes(normalizedSelector)) matchingRules.push(body);
  }
  return matchingRules.join("\n");
}

function stripComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
}

function normalizeSelector(value: string): string {
  return value.replace(/\[([^=\]]+)="([^"]+)"\]/g, "[$1=$2]");
}

function rgbFromToken(token: string): readonly [number, number, number] {
  const colour = TOKEN_VALUES[token];
  if (colour === undefined) throw new Error(`Unknown palette token ${token}`);
  const hex = colour.slice(1);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([red, green, blue]: readonly [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(rgbFromToken(foreground));
  const bg = relativeLuminance(rgbFromToken(background));
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastFloor(entry: AuditEntry): number {
  if (entry.fontSizePx < 13) return 8;
  return entry.role === "heading" || entry.role === "warning" ? 4.5 : 7;
}

function assertRuleIntegrity(css: string, entry: AuditEntry): readonly string[] {
  const errors: string[] = [];
  const rule = ruleForSelector(css, entry.selector);
  if (rule === "") errors.push(`${entry.selector}: missing CSS rule`);
  if (/background-image:\s*url\(/.test(rule) || /background-repeat:\s*repeat/.test(rule)) {
    errors.push(`${entry.selector}: repeated background image behind text`);
  }
  if (entry.role === "body" && entry.foregroundToken === "--palette-vermilion") {
    errors.push(`${entry.selector}: vermilion body text is forbidden`);
  }
  if (entry.role === "numeric") {
    if (!NUMERIC_FONT_PATTERN.test(rule)) {
      errors.push(`${entry.selector}: numeric text must use the declared monospace stack`);
    }
    if (!/font-variant-numeric:\s*tabular-nums/.test(rule)) {
      errors.push(`${entry.selector}: numeric text must use tabular numbers`);
    }
    if (!/text-align:\s*right/.test(rule)) errors.push(`${entry.selector}: numeric text must align right`);
    if (entry.foregroundToken !== "--palette-ink") {
      errors.push(`${entry.selector}: numeric text must be one token darker than labels`);
    }
  }
  return errors;
}

function unauditedTextSelectors(css: string, auditedSelectors: ReadonlySet<string>): readonly string[] {
  const selectors = new Set<string>();
  for (const match of css.matchAll(TEXT_RULE_PATTERN)) {
    const selectorSource = match[1];
    if (selectorSource === undefined) continue;
    const selectorGroup = stripComments(selectorSource).trim();
    if (selectorGroup.startsWith("@")) continue;
    for (const selector of selectorGroup.split(",").map((item) => item.trim())) {
      if (selector === "" || EXEMPT_SELECTOR_PATTERN.test(selector)) continue;
      if (PRESENTATION_ONLY_PATTERN.test(selector)) continue;
      if (selector.includes(" ")) continue;
      if (/^[a-z]+$/.test(selector)) continue;
      if (!selector.startsWith(".")) continue;
      if (auditedSelectors.has(normalizeSelector(selector))) continue;
      selectors.add(selector);
    }
  }
  return [...selectors].sort();
}

async function main(): Promise<void> {
  const css = await readFile(STYLESHEET, "utf8");
  const entries = parseAuditEntries(css);
  const auditedSelectors = new Set(entries.map((entry) => normalizeSelector(entry.selector)));
  const errors: string[] = [];

  if (entries.length === 0) errors.push("No contrast audit entries declared in stylesheet");
  for (const selector of unauditedTextSelectors(css, auditedSelectors)) {
    errors.push(`${selector}: text selector missing contrast-audit entry`);
  }

  console.log("selector foreground background size ratio floor");
  for (const entry of entries) {
    const ratio = contrastRatio(entry.foregroundToken, entry.backgroundToken);
    const floor = contrastFloor(entry);
    console.log([
      entry.selector,
      entry.foregroundToken,
      entry.backgroundToken,
      `${entry.fontSizePx}px`,
      ratio.toFixed(2),
      floor.toFixed(1),
    ].join(" "));
    if (ratio < floor) {
      errors.push(`${entry.selector}: ${ratio.toFixed(2)} contrast is below ${floor.toFixed(1)}`);
    }
    errors.push(...assertRuleIntegrity(css, entry));
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  }
}

await main();
