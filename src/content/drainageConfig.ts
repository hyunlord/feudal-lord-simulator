/**
 * ARCH-1b fen drainage (spec docs/design/map-archetypes.md MA-11): a still water on the fen drained to meadow by the
 * player's command — timber paid at the command, diggers for some seasons. Values are integers and a hypothesis
 * (decision MA10), to be tuned after play.
 */
export const DRAINAGE_BALANCE = {
  /** The works drain the mere's cells within this many tiles (Chebyshev) of the chosen tile: at most 5 × 5. */
  patchRadius: 2,
  /** Timber a cell, paid from the treasury and stores at the command. */
  timberPerCell: 5,
  /** Digger-ticks a cell. With `diggers` men a 25-cell patch takes 2,000 ticks, two seasons. */
  workPerCell: 320,
  /** The most men one works takes (after the field hands; what the town has left). */
  diggers: 4,
  /** Works open at once. */
  maxWorks: 2,
} as const;
