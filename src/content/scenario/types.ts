import type { EffectSpec } from "../../contracts";
import type { BuildingKind } from "../buildingConfig";
import type { Era } from "../eraConfig";

/** Settlement stages (K4). Each maps onto the saved `state.era` value; see `STAGE_ERA`. */
export type StageId = "village" | "market_town" | "fortified_town";

export const STAGE_ORDER = ["village", "market_town", "fortified_town"] as const satisfies readonly StageId[];

/** The saved wall-era field keeps its values; stages are a presentation and data layer over it. */
export const STAGE_ERA = {
  village: "hamlet", market_town: "palisade", fortified_town: "stone_town",
} as const satisfies Record<StageId, Era>;

/** Named predicates over values the victory and proclamation rules already read (spec SC-2). */
export type Condition =
  | { readonly kind: "population_at_least"; readonly value: number }
  | { readonly kind: "supplied_percent_at_least"; readonly value: number }
  | { readonly kind: "occupied_l4_lots_at_least"; readonly value: number }
  | { readonly kind: "stage_at_least"; readonly stage: StageId }
  | { readonly kind: "wall_completed" }
  | { readonly kind: "stone_wall_completed" }
  | { readonly kind: "building_count_at_least"; readonly building: BuildingKind; readonly value: number }
  | { readonly kind: "spendable_resource_at_least"; readonly resource: "timber" | "stone"; readonly value: number }
  | { readonly kind: "treasury_coin_at_least"; readonly value: number }
  | { readonly kind: "settlement_empty_for"; readonly ticks: number }
  /** FP-5: housing lots (a house counts its lot area, as the lot cap does). */
  | { readonly kind: "housing_lots_at_least"; readonly value: number };

export const CONDITION_KINDS = [
  "population_at_least", "supplied_percent_at_least", "occupied_l4_lots_at_least", "stage_at_least",
  "wall_completed", "stone_wall_completed", "building_count_at_least", "spendable_resource_at_least",
  "treasury_coin_at_least", "settlement_empty_for", "housing_lots_at_least",
] as const satisfies readonly Condition["kind"][];

/** All conditions must hold; `holdTicks` > 0 means they must hold for that many consecutive ticks. */
export interface ConditionSet {
  readonly all: readonly Condition[];
  readonly holdTicks?: number;
}

export interface StageDef {
  readonly id: StageId;
  /** Proclamation requirements for entering this stage (village has none). */
  readonly enterWhen: ConditionSet;
  /** Building kinds first buildable at this stage; the only source for building unlocks. */
  readonly unlocks: readonly BuildingKind[];
}

export interface EraDef {
  readonly id: string;
  /** Player-facing name, taken from `scenarioCopy.ko.ts`. */
  readonly name: string;
  /**
   * FP-5 (F2): the era comes when the calendar reaches `yearAtLeast` and the town meets `state` (its readiness).
   * Unmet, it waits at most `maxDelayYears` more years and then comes anyway (forced).
   */
  readonly enterWhen: { readonly yearAtLeast?: number; readonly state?: ConditionSet; readonly maxDelayYears?: number };
  /** Published into the B1 effect pipe; empty until C-stage content defines values. */
  readonly effects: readonly EffectSpec[];
}

export interface ArchetypeDef {
  readonly id: string;
  /** Filled by B5/C1 (land system, resource package). */
  readonly resourcePackage: Readonly<Record<string, unknown>>;
}

export interface WallPolicy {
  /** Data slot; only "required" is supported until C1 (decision K4-2). */
  readonly palisade: "required" | "optional" | "off";
  readonly stoneWall: "required" | "optional" | "off";
  readonly stoneWallPrereq?: ConditionSet;
}

/** Ordered intermediate goals. Ids are the saved milestone keys, so saves keep their shape. */
export interface ObjectiveDef {
  readonly id: "selfSufficient" | "palisade";
  readonly conditions: ConditionSet;
}

export interface ScenarioDef {
  readonly id: string;
  /** Player-facing name, taken from `scenarioCopy.ko.ts`. */
  readonly name: string;
  readonly mode: "campaign" | "sandbox";
  readonly startYear: number;
  readonly archetype: string;
  readonly stages: readonly StageDef[];
  readonly eras: readonly EraDef[];
  readonly objectives: readonly ObjectiveDef[];
  /** Counted only after every objective is met. Saved under the `prosperity` milestone. */
  readonly victory: ConditionSet | null;
  readonly failure: ConditionSet | null;
  readonly walls: WallPolicy;
  readonly activeEvents: readonly string[];
  readonly economyRules: EconomyRules;
}

/** Money rules a scenario switches (spec docs/design/money-rules.md). */
export interface EconomyRules {
  /** M-3: the lord's mill monopoly; mills charge `mill_toll` on the wheat they grind. */
  readonly millMonopoly: boolean;
  /** M-1b: market sales of granary grain are the lord's demesne surplus and post `demesne_sale`. */
  readonly demesneSale: boolean;
}
