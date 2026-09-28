/** C4 AL-10 (FIX-7, save v25): the town's ale counted by season (spec docs/design/ale-chain.md AL-10). */

/** One season's ale: casks brewed, malt the brewing used, casks drunk and, of those, bought from an alehouse. */
export interface AleSeasonCount {
  /** The season's first tick. */
  readonly startTick: number;
  readonly brewed: number;
  readonly maltUsed: number;
  readonly drunk: number;
  readonly sold: number;
}

/** The season being counted and the last closed one. Absent until the town first brews or drinks. */
export interface AleState {
  readonly current: AleSeasonCount;
  readonly last?: AleSeasonCount;
}
