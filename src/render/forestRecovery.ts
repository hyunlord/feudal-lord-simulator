import type { ForestHarvest } from "../engine/engine.types";
import { stumpAgeAt } from "../engine/forestHarvests";

export type ForestVisualStage = "fresh" | "old" | "weathered" | "recovered";

export function forestVisualStage(harvest: ForestHarvest, tick: number): ForestVisualStage {
  const age = Math.max(0, tick - harvest.harvestedAtTick);
  const locationHash = Math.imul(harvest.tx + 41, 374_761_393) ^ Math.imul(harvest.ty + 73, 668_265_263);
  const recoveryTicks = 3_600 + (locationHash >>> 0) % 3_601;
  if (age >= recoveryTicks) return "recovered";
  if (age >= 1_800) return "weathered";
  return stumpAgeAt(harvest, tick);
}
