/**
 * Household crafts (spec `docs/design/labour.md` LB-8). One JSON file per craft in this folder, listed in
 * `CRAFT_SOURCES`; the first one is C4's `brew_ale`. Until then there are none and every household slot is empty.
 */
export interface CraftDefinition {
  /** `namespace:id`-free short id, e.g. `brew_ale`. */
  readonly id: string;
  readonly name: string;
  /** House levels whose slots may take this craft. */
  readonly levels: readonly number[];
  /** Adults one slot of this craft employs. */
  readonly workers: number;
  /** Resources taken from the house's own stock per batch, and produced into it. */
  readonly input: Readonly<Record<string, number>>;
  readonly output: Readonly<Record<string, number>>;
  readonly ticksPerBatch: number;
}

/** Raw JSON of every craft file (C4 adds `import brewAle from "./brew_ale.json"` here). */
const CRAFT_SOURCES: readonly unknown[] = [];

const isAmounts = (value: unknown): value is Record<string, number> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
  && Object.values(value).every(amount => Number.isInteger(amount) && (amount as number) > 0);

/** LB-8: validates one craft file; throws with the craft id so a bad file fails at load, not mid-game. */
export function parseCraftDefinition(raw: unknown): CraftDefinition {
  if (typeof raw !== "object" || raw === null) throw new TypeError("Craft definition must be an object");
  const record = raw as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== "string" || !/^[a-z][a-z0-9_]*$/.test(id)) throw new TypeError("Craft definition needs a snake_case id");
  const fail = (field: string) => new TypeError(`Craft ${id}: invalid ${field}`);
  if (typeof record.name !== "string" || record.name.length === 0) throw fail("name");
  if (!Array.isArray(record.levels) || record.levels.length === 0
    || !record.levels.every(level => Number.isInteger(level) && level >= 0 && level <= 4)) throw fail("levels");
  if (!Number.isInteger(record.workers) || (record.workers as number) < 1) throw fail("workers");
  if (!isAmounts(record.input)) throw fail("input");
  if (!isAmounts(record.output) || Object.keys(record.output).length === 0) throw fail("output");
  if (!Number.isInteger(record.ticksPerBatch) || (record.ticksPerBatch as number) < 1) throw fail("ticksPerBatch");
  return { id, name: record.name, levels: [...record.levels] as number[], workers: record.workers as number,
    input: { ...record.input }, output: { ...record.output }, ticksPerBatch: record.ticksPerBatch as number };
}

/** LB-8: parses a list of craft files; ids must be unique. */
export function loadCraftDefinitions(sources: readonly unknown[]): readonly CraftDefinition[] {
  const crafts = sources.map(parseCraftDefinition);
  const ids = new Set<string>();
  for (const craft of crafts) {
    if (ids.has(craft.id)) throw new TypeError(`Craft ${craft.id} is defined twice`);
    ids.add(craft.id);
  }
  return crafts;
}

export const CRAFT_DEFINITIONS: readonly CraftDefinition[] = loadCraftDefinitions(CRAFT_SOURCES);
