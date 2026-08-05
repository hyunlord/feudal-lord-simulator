import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";

export type SettlementProblemKind = "water" | "bread" | "labour" | "storage";

export type SettlementProblemGlyph = {
  readonly kind: SettlementProblemKind;
  readonly glyph: string;
  readonly label: string;
};

export type SettlementGuidance = {
  readonly populationGoal: 50 | 120;
  readonly completedGoal: 50 | null;
  readonly sampledTick: number;
  readonly statusLine: string;
  readonly priority: SettlementProblemGlyph | null;
  readonly problems: readonly SettlementProblemGlyph[];
};

const PROBLEM_GLYPHS: Record<SettlementProblemKind, SettlementProblemGlyph> = {
  water: { kind: "water", glyph: "水", label: "물 부족" },
  bread: { kind: "bread", glyph: "빵", label: "빵 부족" },
  labour: { kind: "labour", glyph: "人", label: "일손 부족" },
  storage: { kind: "storage", glyph: "箱", label: "창고 가득" },
};

export function settlementProblemGlyphs(state: GameState): readonly SettlementProblemGlyph[] {
  const problems: SettlementProblemGlyph[] = [];
  if (hasWaterProblem(state)) problems.push(PROBLEM_GLYPHS.water);
  if (hasBreadProblem(state)) problems.push(PROBLEM_GLYPHS.bread);
  if (hasLabourProblem(state)) problems.push(PROBLEM_GLYPHS.labour);
  if (hasStorageProblem(state)) problems.push(PROBLEM_GLYPHS.storage);
  return problems;
}

export function settlementGuidance(state: GameState): SettlementGuidance {
  const populationGoal = state.population >= 50 ? 120 : 50;
  const problems = settlementProblemGlyphs(state);
  const priority = guidancePriority(state);
  return {
    populationGoal,
    completedGoal: state.population >= 50 ? 50 : null,
    sampledTick: Math.floor(state.tick / 60) * 60,
    statusLine: priority?.label ?? "정착지는 안정적입니다",
    priority,
    problems,
  };
}

function guidancePriority(state: GameState): SettlementProblemGlyph | null {
  if (hasWaterProblem(state)) return { ...PROBLEM_GLYPHS.water, label: "우물이 필요합니다" };
  if (hasBreadProblem(state)) return { ...PROBLEM_GLYPHS.bread, label: "식량이 부족합니다" };
  if (state.idleWorkers > 0 && hasLabourProblem(state)) {
    return {
      ...PROBLEM_GLYPHS.labour,
      label: "일꾼이 놀고 있습니다 — 길이 끊겼는지 확인하세요",
    };
  }
  if (!state.buildings.some((building) => building.kind === "granary")) {
    return { kind: "storage", glyph: "箱", label: "곡창이 필요합니다" };
  }
  if (state.treasuryTimber < 30) {
    return { kind: "storage", glyph: "箱", label: "목재가 부족합니다" };
  }
  return null;
}

function hasWaterProblem(state: GameState): boolean {
  return state.houses.some((house) => house.residents > 0 && !house.hasWater);
}

function hasBreadProblem(state: GameState): boolean {
  return state.houses.some(
    (house) =>
      house.residents > 0 &&
      house.breadStock <= 0 &&
      state.tick - house.lastServicedTick >= BALANCE.BREAD_HUNGER_WINDOW,
  );
}

function hasLabourProblem(state: GameState): boolean {
  return state.buildings.some((building) => {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    return definition.workersRequired > 0 && building.workers < definition.workersRequired;
  });
}

function hasStorageProblem(state: GameState): boolean {
  return state.buildings.some((building) => {
    const definition = BUILDING_CONFIG_BY_KIND[building.kind];
    if (definition.storageCapacity <= 0) return false;
    const occupied = Object.values(building.inventory).reduce((total, amount) => total + (amount ?? 0), 0);
    return occupied >= definition.storageCapacity;
  });
}
