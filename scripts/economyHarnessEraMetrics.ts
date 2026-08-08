import {
  PHASE9_MAX_COIN_TICK,
  PHASE9_MAX_ERA3_REQUIREMENT_TICK,
  PHASE9_MAX_STONE_CHAIN_STALL_TICKS,
  PHASE9_MAX_STONE_WALL_COMPLETION_TICKS,
} from "./economyHarnessPhase9Scenario";
import type { Phase9RunTrace } from "./economyHarnessPhase9Trace";
import {
  STAGE3_LEGACY_HASH,
  STAGE3_MAX_NON_WALL_STALL_TICKS,
  STAGE3_MAX_REQUIREMENT_TICK,
  STAGE3_MAX_WALL_COMPLETION_TICKS,
} from "./economyHarnessStage3Scenario";
import type { Stage3RunTrace } from "./economyHarnessStage3Trace";
import { harnessMetric, type HarnessMetric } from "./economyHarnessMetric";

export function stage3Metrics(first: Stage3RunTrace, second: Stage3RunTrace): readonly HarnessMetric[] {
  const completed = first.wallCompletionElapsedTicks !== null &&
    first.wallCompletionElapsedTicks <= STAGE3_MAX_WALL_COMPLETION_TICKS;
  const reachable = first.requirementsMetTick !== null && first.requirementsMetTick <= STAGE3_MAX_REQUIREMENT_TICK;
  return [
    harnessMetric("Legacy Stage 2 hash", STAGE3_LEGACY_HASH, true),
    harnessMetric("Stage 3 determinism hash", `${first.hash} == ${second.hash}`, first.hash === second.hash),
    harnessMetric(
      "Palisade reachability",
      first.requirementsMetTick === null ? "not reachable" : `${first.requirementsMetTick} ticks`,
      reachable,
    ),
    harnessMetric(
      "Palisade wall completion",
      first.wallCompletionElapsedTicks === null
        ? "unfinished"
        : `${first.wallCompletionElapsedTicks} ticks after proclamation`,
      completed,
    ),
    harnessMetric(
      "Palisade labour continuity",
      `${first.maxNonWallProductionStall} ticks without non-wall production`,
      first.maxNonWallProductionStall < STAGE3_MAX_NON_WALL_STALL_TICKS,
    ),
  ];
}

export function phase9Metrics(first: Phase9RunTrace, second: Phase9RunTrace): readonly HarnessMetric[] {
  const coinElapsedTick = first.coinReachedTick === null ? null : first.coinReachedTick - first.initialTick;
  const coinPassing = coinElapsedTick !== null && coinElapsedTick <= PHASE9_MAX_COIN_TICK;
  const reachable = first.era3ConditionsMetTick !== null &&
    first.era3ConditionsMetTick <= PHASE9_MAX_ERA3_REQUIREMENT_TICK;
  const chainPassing = !reachable || (
    first.stoneChainAccessMissingTicks === 0 &&
    first.maxStoneChainStallWithAccess <= PHASE9_MAX_STONE_CHAIN_STALL_TICKS
  );
  const wallPassing = !reachable || (
    first.stoneWallCompletionElapsedTicks !== null &&
    first.stoneWallCompletionElapsedTicks <= PHASE9_MAX_STONE_WALL_COMPLETION_TICKS
  );
  return [
    harnessMetric(
      "Stone chain continuity",
      first.stoneChainAccessMissingTicks > 0
        ? `${first.stoneChainAccessMissingTicks} ticks without rock/route access`
        : `${first.maxStoneChainStallWithAccess} ticks with access`,
      chainPassing,
    ),
    harnessMetric(
      "Market coin by 5000",
      coinElapsedTick === null ? "no surplus sale" : `${coinElapsedTick} elapsed ticks`,
      coinPassing,
    ),
    harnessMetric(
      "Stone Town reachability",
      first.era3ConditionsMetTick === null ? "not reachable" : `${first.era3ConditionsMetTick} ticks`,
      reachable,
    ),
    harnessMetric(
      "Stone wall completion",
      !reachable
        ? "not evaluated after late/unreachable proclamation"
        : first.stoneWallCompletionElapsedTicks === null
        ? "unfinished"
        : `${first.stoneWallCompletionElapsedTicks} ticks after proclamation`,
      wallPassing,
    ),
    harnessMetric(
      "Segment material continuity",
      `${first.segmentMaterialGapTicks} segment-gap ticks`,
      first.segmentMaterialGapTicks === 0 && first.hash === second.hash,
    ),
  ];
}
