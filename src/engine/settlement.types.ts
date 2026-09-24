export type SettlementGoalId = "selfSufficient" | "palisade" | "prosperity";
export type SettlementOutcome = "ongoing" | "victory" | "abandoned";
export interface SettlementProgress {
  readonly lastUpdatedTick: number;
  readonly selfSufficientTicks: number;
  readonly prosperityTicks: number;
  readonly foodShortageTicks: number;
  readonly emptyTicks: number;
  readonly hadResidents: boolean;
  readonly milestones: Readonly<Record<SettlementGoalId, number | null>>;
  readonly outcome: SettlementOutcome;
}
export interface SettlementMetrics {
  readonly population: number;
  readonly occupiedHouses: number;
  readonly occupiedL4Lots: number;
  readonly suppliedHouses: number;
  readonly suppliedPercent: number;
  readonly fedHouses: number;
  readonly foodPercent: number;
  readonly completedWall: boolean;
  readonly completedStoneWall: boolean;
}
export interface SettlementCriterion {
  readonly id: string;
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly met: boolean;
}
export interface SettlementGoal {
  readonly id: SettlementGoalId;
  readonly title: string;
  readonly description: string;
  readonly criteria: readonly SettlementCriterion[];
  readonly holdTicks: number;
  readonly requiredHoldTicks: number;
}
export interface SettlementView {
  readonly currentGoal: SettlementGoal | null;
  readonly metrics: SettlementMetrics;
  readonly progress: SettlementProgress;
  readonly crisis: "none" | "food_shortage" | "abandonment_risk";
  readonly outcome: SettlementOutcome;
  readonly mode: "campaign" | "sandbox";
}
