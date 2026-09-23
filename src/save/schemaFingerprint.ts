import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { RESOURCE_TYPES } from "../content/resourceConfig";

/**
 * Shape of saved game state: every key path and the JSON value types seen there, never the values.
 * Keys that are content IDs or free-form map keys collapse to placeholders so the shape reflects the
 * code, not what a particular city happens to contain.
 */
export interface SchemaShape {
  readonly paths: readonly string[];
  readonly sha256Input: string;
}

const RESOURCE_KEYS = new Set<string>(RESOURCE_TYPES);
const BUILDING_KIND_KEYS = new Set<string>(Object.keys(BUILDING_CONFIG_BY_KIND));
const PLAIN_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function keyToken(key: string): string {
  if (RESOURCE_KEYS.has(key)) return "<resource>";
  if (BUILDING_KIND_KEYS.has(key)) return "<buildingKind>";
  if (!PLAIN_KEY.test(key) || /\d/.test(key)) return "<key>";
  return key;
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function collect(value: unknown, path: string, out: Map<string, Set<string>>): void {
  const types = out.get(path) ?? new Set<string>();
  types.add(typeOf(value));
  out.set(path, types);
  if (Array.isArray(value)) {
    for (const item of value) collect(item, `${path}[]`, out);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) collect(item, `${path}.${keyToken(key)}`, out);
  }
}

/** `declaredKeys`: property names of `interface GameState`, so optional fields that are never set still count. */
export function schemaShape(states: readonly unknown[], declaredKeys: readonly string[]): SchemaShape {
  const out = new Map<string, Set<string>>();
  for (const state of states) collect(state, "$", out);
  const paths = [...out].map(([path, types]) => `${path}:${[...types].sort().join("|")}`).sort();
  const declared = [...declaredKeys].sort().map(key => `declared:${key}`);
  const all = [...declared, ...paths];
  return { paths: all, sha256Input: all.join("\n") };
}

/** Property names declared in the `export interface GameState { … }` block of engine.types.ts. */
export function declaredGameStateKeys(engineTypesSource: string): string[] {
  const block = /export interface GameState \{([\s\S]*?)\n\}/.exec(engineTypesSource)?.[1] ?? "";
  return [...block.matchAll(/^\s{2}(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\??:/gm)].map(match => match[1] ?? "");
}
