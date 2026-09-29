/**
 * ARCH-1 (spec docs/design/map-archetypes.md MA-4, MA-6): a town's land and the five coefficients its rules read.
 * A state's land is `state.archetypeId` (save v31), else its scenario's (the open field) — so every older save, and
 * every state the open field's guardrail makes, reads the riverside town with all its coefficients at 1,000.
 */
import type { BuildingKind } from "../content/buildingConfig";
import { archetypeById, archetypeOf } from "../content/scenario/registry";
import type { ArchetypeDef, ArchetypeRules } from "../content/scenario/types";
import type { BuildingDefinition } from "../economy/economy.types";
import type { GameState } from "./engine.types";
import { scenarioOf } from "./scenarioState";

const NEUTRAL: ArchetypeRules = { arablePermille: 1000, pastoralPermille: 1000, timberPermille: 1000, floodPermille: 1000, coastalEventPermille: 1000 };

/** MA-6: the town's land. */
export function stateArchetype(state: Pick<GameState, "scenarioId" | "archetypeId">): ArchetypeDef | undefined {
  return state.archetypeId === undefined ? archetypeOf(scenarioOf(state)) : archetypeById(state.archetypeId) ?? archetypeOf(scenarioOf(state));
}

/** MA-4: the land's coefficients (all 1,000 without a land). */
export function archetypeRules(state: Pick<GameState, "scenarioId" | "archetypeId">): ArchetypeRules {
  return stateArchetype(state)?.rules ?? NEUTRAL;
}

/** MA-4 ③: the kinds whose working time the land sets — the logging camp by `timberPermille`. */
const TIMBER_KINDS: ReadonlySet<BuildingKind> = new Set(["logging_camp"]);
const scaled = new Map<string, BuildingDefinition>();

/**
 * MA-4 ③: a production definition under the land — a timber land fells faster (its ticks per log ÷ the coefficient).
 * Cache (AGENTS rule 10): (a) keyed on the kind, the definition's own ticks and the coefficient; (b) nothing else enters
 * the scaled copy; (c) one object per key instead of one per building-tick (the same pattern as `reorganisationDefinition`).
 */
export function archetypeProductionDefinition(state: Pick<GameState, "scenarioId" | "archetypeId">, definition: BuildingDefinition): BuildingDefinition {
  const production = definition.production;
  if (production === null || !TIMBER_KINDS.has(definition.kind)) return definition;
  const permille = archetypeRules(state).timberPermille;
  if (permille === 1000) return definition;
  const key = `${definition.kind}:${production.ticksPerOutput}:${permille}`;
  let entry = scaled.get(key);
  if (entry === undefined) {
    entry = { ...definition, production: { ...production, ticksPerOutput: Math.max(1, Math.round(production.ticksPerOutput * 1000 / permille)) } };
    scaled.set(key, entry);
  }
  return entry;
}

/** MA-4: a count scaled by a coefficient (floored, as the rules' own shares are); 1,000 returns the count itself. */
export function scaleByPermille(value: number, permille: number): number {
  return permille === 1000 ? value : Math.floor(value * permille / 1000);
}
