// LAND-UI (LU-D7, spec docs/design/map-archetypes.md MA-6): the new-game screen's land choice — which land and which
// of its maps a new game starts on. NAT-4 (LU-D7 verdict, LM-E5 / LG-1): the map number is any whole number 1–999,999
// (NEW_GAME_SEED_MAX) on every land, the riverside town too; the welcome opens on the riverside with a random number
// (randomNewGameSeed), shown, which the player can type over or draw again. A number with no game (newGameState → null:
// on the riverside, a map with no legal site for the village) cannot be started. The riverside on map 1 is today's map
// exactly: it sends no command for the campaign (the tutorial gets the current state), as before.
import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID } from "../content/scenario/coreScenarios";
import { SCENARIOS } from "../content/scenario/registry";
import { NEW_GAME_SEED_MAX, mapArchetypes, newGameState, randomNewGameSeed } from "../state/newGame";

export interface LandChoice {
  readonly archetypeId: string;
  /** The map number, or null while the typed text is not a number from 1 to 999,999. */
  readonly seed: number | null;
}

export const LAND_SEED_MIN = 1;
export const LAND_SEED_MAX = NEW_GAME_SEED_MAX;
/** The field's width in digits (999,999). */
export const LAND_SEED_DIGITS = String(NEW_GAME_SEED_MAX).length;
/**
 * The page query that pins the welcome's first map number (`?new-game-seed=<n>`). Under the proof query
 * (`phase10-proof=1`, every scripted scene and replay) the first number is 1: a script that dismisses the welcome keeps
 * the state it injected, and a replay starts today's map.
 */
export const PIN_SEED_QUERY = "new-game-seed";

export type LandStartCommand = { readonly type: "start_new_game"; readonly scenarioId: string; readonly archetypeId?: string; readonly seed?: number };
export type LandSeedProblem = "range" | "unbuildable";

/** The default campaign's own land (the riverside town). */
export function defaultLandId(): string {
  return SCENARIOS.get(DEFAULT_SCENARIO_ID)?.archetype ?? mapArchetypes()[0]!.id;
}

/** The riverside town on map 1: today's game. */
export function defaultLandChoice(): LandChoice {
  return { archetypeId: defaultLandId(), seed: LAND_SEED_MIN };
}

/** The welcome's first choice: the riverside on a random map number, or the number `search` pins (see PIN_SEED_QUERY). */
export function initialLandChoice(search: string, random: () => number = Math.random): LandChoice {
  const query = new URLSearchParams(search);
  const pinned = parseLandSeed(query.get(PIN_SEED_QUERY) ?? "");
  if (pinned !== null) return { archetypeId: defaultLandId(), seed: pinned };
  if (query.get("phase10-proof") === "1") return defaultLandChoice();
  return randomLandSeed({ archetypeId: defaultLandId(), seed: null }, random);
}

/** The typed map number: digits only, 1–999,999 (a leading zero is allowed); null otherwise. */
export function parseLandSeed(text: string): number | null {
  if (!/^[0-9]{1,6}$/.test(text)) return null;
  const seed = Number(text);
  return seed >= LAND_SEED_MIN && seed <= LAND_SEED_MAX ? seed : null;
}

/** The field's text for a map number (empty for none). */
export function landSeedText(seed: number | null): string {
  return seed === null ? "" : String(seed);
}

/** Picking a land keeps the map number (every land takes every number). */
export function chooseLand(choice: LandChoice, archetypeId: string): LandChoice {
  return { archetypeId, seed: choice.seed };
}

/** "무작위": a random map number of the chosen land that has a game (LM-E5 randomNewGameSeed). */
export function randomLandSeed(choice: LandChoice, random: () => number = Math.random): LandChoice {
  const seed = randomNewGameSeed({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: choice.archetypeId }, random);
  remember(`${choice.archetypeId}|${seed}`, true);
  return { archetypeId: choice.archetypeId, seed };
}

// Cache (AGENTS rule 10): (a) key `${archetypeId}|${seed}`; (b) nothing else enters — the scenario is the default
// campaign (whether a map has a game depends on the land and seed only: newGame.ts) and the welcome never passes a mode;
// (c) the answer builds a whole opening state (~6–10 ms) and the picker asks on every render while the player types.
// FIFO, at most PLAYABLE_LIMIT answers (booleans).
const PLAYABLE_LIMIT = 256;
const playable = new Map<string, boolean>();
function remember(key: string, value: boolean): boolean {
  if (playable.size >= PLAYABLE_LIMIT) playable.delete(playable.keys().next().value!);
  playable.set(key, value);
  return value;
}

/** Why the choice cannot start: "range" (no number from 1 to 999,999) or "unbuildable" (the engine makes no game); null when it can. */
export function landSeedProblem(choice: LandChoice): LandSeedProblem | null {
  if (choice.seed === null) return "range";
  const key = `${choice.archetypeId}|${choice.seed}`;
  const known = playable.get(key);
  const ok = known ?? remember(key, newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: choice.archetypeId, seed: choice.seed }) !== null);
  return ok ? null : "unbuildable";
}

export function landPlayable(choice: LandChoice): boolean {
  return landSeedProblem(choice) === null;
}

/** True when the choice is today's game: the riverside town on map 1. */
export function isDefaultLand(choice: LandChoice): boolean {
  return choice.archetypeId === defaultLandId() && choice.seed === LAND_SEED_MIN;
}

/**
 * The command a start sends: none for the default campaign on today's land (the current state is that game), the
 * scenario alone for the sandbox on today's land, and the land and map number for any other choice. Only a playable
 * choice is started (the welcome refuses the others: landPlayable).
 */
export function landStartCommand(scenarioId: string, choice: LandChoice, overSave: boolean): LandStartCommand | null {
  // LM-R1: the lord's slice is the riverside market town (LS-1); the chosen map number is kept, the land is not.
  if (scenarioId === LORD_SLICE_SCENARIO_ID) return { type: "start_new_game", scenarioId, ...(choice.seed === null ? {} : { seed: choice.seed }) };
  if (isDefaultLand(choice)) return overSave || scenarioId !== DEFAULT_SCENARIO_ID ? { type: "start_new_game", scenarioId } : null;
  return { type: "start_new_game", scenarioId, archetypeId: choice.archetypeId, ...(choice.seed === null ? {} : { seed: choice.seed }) };
}
