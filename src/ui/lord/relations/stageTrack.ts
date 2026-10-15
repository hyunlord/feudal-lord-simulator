import type { GameState } from "../../../engine/engine.types";
import { relationStage } from "../../../engine/relationStage";

// LS1 ③ (lord-screen-v1.md §3, "세력 관계, 단계를 넘을 때"): each faction's relation stage at the season closes the screen
// saw — the engine's `relationStage` rank (DTR-4's thresholds; the screen draws none of its own, P-D4) — and the stages
// crossed at the last close, a difference of two season ends. A new game takes its first tick as the close before; after
// a load the first close only takes the ranks. Kept for the page.

export type StageCrossing = Readonly<{ factionId: string; from: number; to: number; year: number; season: number;
  /** The season the crossing happened in: (fromTick, toTick]. */
  fromTick: number; toTick: number }>;

const track = { ranks: null as ReadonlyMap<string, number> | null, crossings: [] as StageCrossing[] };

const ranksOf = (state: Pick<GameState, "factions">) => new Map((state.factions?.factions ?? []).map(faction => [faction.id as string, relationStage(faction.relation).rank as number]));

/**
 * A page's start: a new game's first tick counts as a close; a load knows no ranks yet. `seed`: the audit's query
 * `stage-seed=<faction>:<rank>` — a loaded state counted as a close seen with that faction at that rank, so a geometry
 * row sees a crossing at the next close without waiting seasons (as `growth-held` does for the growth stop).
 */
export function startStageTrack(state: Pick<GameState, "factions"> | null, seed: Readonly<{ factionId: string; rank: number }> | null = null): void {
  const ranks = state === null ? null : new Map(ranksOf(state));
  if (ranks !== null && seed !== null && ranks.has(seed.factionId)) ranks.set(seed.factionId, seed.rank);
  track.ranks = ranks; track.crossings = [];
}

/** The query's seed (null without it). */
export function stageSeedQuery(): Readonly<{ factionId: string; rank: number }> | null {
  if (typeof window === "undefined") return null;
  const [factionId, rank] = (new URLSearchParams(window.location.search).get("stage-seed") ?? "").split(":");
  const value = Number(rank);
  return factionId !== undefined && factionId !== "" && Number.isInteger(value) && value >= -2 && value <= 2 ? { factionId, rank: value } : null;
}

/** A season's close: the factions whose stage moved since the close before it. */
export function noteStageClose(state: Pick<GameState, "factions">, close: Readonly<{ year: number; season: number; startTick: number; endTick: number }>): void {
  const now = ranksOf(state);
  const was = track.ranks;
  track.crossings = was === null ? [] : [...now].flatMap(([factionId, rank]) => {
    const from = was.get(factionId);
    return from === undefined || from === rank ? [] : [{ factionId, from, to: rank, year: close.year, season: close.season, fromTick: close.startTick, toTick: close.endTick }];
  });
  track.ranks = now;
}

/** The stages crossed at the last close the screen saw. */
export function stageCrossings(): readonly StageCrossing[] {
  return track.crossings;
}
