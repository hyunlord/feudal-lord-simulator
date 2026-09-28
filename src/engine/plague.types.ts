/**
 * F3-A chapter 3's Black Death (save v26, spec docs/design/chapter-three-plague.md PL-*): what the collapse era of 1348
 * brought and what the lord answered. The sequence's seasons derive from `eraTick`; what is saved is what happened.
 */
import type { PetitionResponse } from "../content/chapterConfig";

/** PL-2 / PL-9: one pestilence — when it came, whom it found, the share it takes and the dead so far. */
export interface Pestilence {
  readonly arrivalTick: number;
  /** The town's people (residents) when it came. */
  readonly populationAtArrival: number;
  /** The share it takes, permille (the seed's pick). */
  readonly deathPermille: number;
  /** The town's people it has killed (residents; the lord's household is counted apart). */
  readonly dead: number;
  /** Of the lord's household (the family and the steward). */
  readonly manorDead: number;
  /** PL-2: the households it took whole (their houses emptied). */
  readonly wipedHouses: number;
  /** The last season's end: absent while it rages. */
  readonly endTick?: number;
}

export interface PlagueState {
  /** PL-1: the collapse era's first season start (absolute tick); the sequence counts from here. */
  readonly eraTick: number;
  /** PL-1: the harbour fever's rumour (absent before). */
  readonly rumourTick?: number;
  /** PL-2: the first pestilence (absent before it arrives). */
  readonly first?: Pestilence;
  /** PL-9: the second pestilence of 1361. */
  readonly second?: Pestilence;
  /** PL-5…PL-8: the answers, by petition id (an unanswered one: `expired`). */
  readonly answers: Readonly<Partial<Record<string, PetitionResponse | "expired">>>;
  /** PL-6: the priest's seat — empty since, and the tick it is filled (by the monastery or a clerk). */
  readonly curacy?: { readonly vacantSince: number; readonly filledTick?: number; readonly by?: "monastery" | "clerk" };
  /** PL-3: houses the pestilence emptied, waiting for new households (the ladder does not resettle them). */
  readonly vacantHouseIds: readonly string[];
  /** PL-5: the Statute read (tick) and the justices' fine paid. */
  readonly ordinanceTick?: number;
  readonly statuteFine?: number;
  /** PL-7: households settled into empty houses since the resettlement began, and people added by the town's recovery. */
  readonly resettled: number;
  readonly recovered: number;
  /** PL-5 / PL-8: households gone for wages or from their services. */
  readonly fled: number;
  /** PL-10: the chapter's end (campaign) or the sequence's (sandbox). */
  readonly endedTick?: number;
}

/** PL-1 API `plagueForecast`: the sequence's steps and their state. */
export type PlagueStepId = "rumour" | "arrival" | "wage_demand" | "abandoned_fields" | "ordinance" | "resettlement" | "second" | "end";
export interface PlagueStep {
  readonly id: PlagueStepId;
  readonly tick: number;
  readonly state: "ahead" | "now" | "done";
}
