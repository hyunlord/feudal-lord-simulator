/**
 * LM-R2-E ① (render request: the old lord's house had no arms, its flag base on the regional map stood empty): each
 * neighbouring lord's house carries exact arms — an authored blazon, not drawn from a seed (neighbour world NF02). The
 * project's heraldic conventions (docs/design/neighbor-world-20261003/SOURCES.md): ermine only for an earl's house or the
 * Crown, and no royal combination (gold lions on red, gold lilies on blue). Every coat keeps the rule of tincture (a
 * metal on a colour or a colour on a metal). Invented designs; no real lineage is claimed (decision FN11). The Korean
 * readings are `neighbourArmsCopy.ko.ts`.
 */
export type Tincture = "or" | "argent" | "gules" | "azure" | "vert" | "sable" | "purpure" | "ermine";
export const METALS: ReadonlySet<Tincture> = new Set(["or", "argent"]);

export interface Blazon {
  readonly field: Tincture;
  /** An ordinary across the field. */
  readonly ordinary?: { readonly kind: "fess" | "chevron" | "bend" | "saltire" | "cross"; readonly tincture: Tincture; readonly line?: "engrailed" | "wavy" };
  /** The charges (on the field, around the ordinary). */
  readonly charges?: { readonly kind: string; readonly count: number; readonly tincture: Tincture };
  /** The blazon in English heraldic terms. */
  readonly en: string;
}

/** One coat for each `NEIGHBOUR_SURNAMES` name (the test pins the cover). */
export const NEIGHBOUR_ARMS: Readonly<Record<string, Blazon>> = {
  "de Corbelle": { field: "or", charges: { kind: "crow", count: 3, tincture: "sable" }, en: "Or, three crows Sable." },
  "de Lisonde": { field: "vert", ordinary: { kind: "fess", tincture: "argent" }, charges: { kind: "roundel", count: 3, tincture: "or" }, en: "Vert, a fess Argent between three bezants." },
  "de Ambreth": { field: "purpure", ordinary: { kind: "chevron", tincture: "argent" }, en: "Purpure, a chevron Argent." },
  "de Thornell": { field: "argent", charges: { kind: "hawthorn", count: 1, tincture: "vert" }, en: "Argent, a hawthorn tree Vert." },
  "de Heronel": { field: "azure", charges: { kind: "heron", count: 1, tincture: "argent" }, en: "Azure, a heron Argent." },
  "de Ivrecourt": { field: "sable", ordinary: { kind: "cross", tincture: "or", line: "engrailed" }, en: "Sable, a cross engrailed Or." },
  "de Kestevale": { field: "gules", ordinary: { kind: "saltire", tincture: "argent" }, charges: { kind: "crescent", count: 4, tincture: "or" }, en: "Gules, a saltire Argent between four crescents Or." },
  "de Gildermoor": { field: "or", ordinary: { kind: "bend", tincture: "vert", line: "wavy" }, en: "Or, a bend wavy Vert." },
};

/** A neighbouring lord's house's arms by its name (the estates' and factions' house names), or null for another name. */
export function neighbourArms(name: string): Blazon | null {
  return NEIGHBOUR_ARMS[name] ?? null;
}
