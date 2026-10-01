// LAND-UI (LU-D7, spec docs/design/map-archetypes.md MA-6): the new-game screen's land choice — which land and which
// of its maps (seed 1–5) a new game starts on. The riverside town is today's map and has seed 1 only (newGame.ts), so
// its seed is fixed; it is the default, and choosing it with seed 1 keeps today's start exactly (no command for the
// campaign, the tutorial gets the current state).
import { DEFAULT_SCENARIO_ID } from "../content/scenario/coreScenarios";
import { SCENARIOS, archetypeById } from "../content/scenario/registry";
import { mapArchetypes } from "../state/newGame";

export interface LandChoice {
  readonly archetypeId: string;
  readonly seed: number;
}

/** The seeds the picker offers (MA-7 ran the bot on 1–3; createGrowthOpening caps at 5). */
export const LAND_SEED_MIN = 1;
export const LAND_SEED_MAX = 5;

export type LandStartCommand = { readonly type: "start_new_game"; readonly scenarioId: string; readonly archetypeId?: string; readonly seed?: number };

/** The default campaign's own land (the riverside town), seed 1: the picker's first and default choice. */
export function defaultLandChoice(): LandChoice {
  return { archetypeId: SCENARIOS.get(DEFAULT_SCENARIO_ID)?.archetype ?? mapArchetypes()[0]!.id, seed: LAND_SEED_MIN };
}

/** The riverside town's map exists for seed 1 only (newGame.ts: a `river` land takes the default state). */
export function landSeedLocked(archetypeId: string): boolean {
  return archetypeById(archetypeId)?.terrain.kind === "river";
}

/** Picking a land keeps the seed, except on the riverside (seed 1). */
export function chooseLand(choice: LandChoice, archetypeId: string): LandChoice {
  return { archetypeId, seed: landSeedLocked(archetypeId) ? LAND_SEED_MIN : choice.seed };
}

/** The seed control's −/+ (delta −1 or +1): clamped to 1–5, and no change on the riverside. */
export function stepLandSeed(choice: LandChoice, delta: number): LandChoice {
  if (landSeedLocked(choice.archetypeId)) return { ...choice, seed: LAND_SEED_MIN };
  return { ...choice, seed: Math.min(LAND_SEED_MAX, Math.max(LAND_SEED_MIN, choice.seed + delta)) };
}

/** Whether −/+ (delta −1 / +1) moves the seed: never on the riverside, and not past 1 or 5. */
export function canStepLandSeed(choice: LandChoice, delta: number): boolean {
  return stepLandSeed(choice, delta).seed !== choice.seed;
}

/** True when the choice is today's game: the riverside town on seed 1. */
export function isDefaultLand(choice: LandChoice): boolean {
  return landSeedLocked(choice.archetypeId) && choice.seed === LAND_SEED_MIN;
}

/**
 * The command a start sends: none for the default campaign on today's land (the current state is that game), the
 * scenario alone for the sandbox on today's land, and the land and seed for any other land.
 */
export function landStartCommand(scenarioId: string, choice: LandChoice, overSave: boolean): LandStartCommand | null {
  if (isDefaultLand(choice)) return overSave || scenarioId !== DEFAULT_SCENARIO_ID ? { type: "start_new_game", scenarioId } : null;
  return { type: "start_new_game", scenarioId, archetypeId: choice.archetypeId, seed: choice.seed };
}
