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

/**
 * ARCH-1 (MA-2): how a map archetype's land is drawn from the shared noise fields (`world/archetypeTerrain.ts`).
 * `river` is the open-field generator unchanged; the others move its thresholds and may add a sea along one edge.
 */
export type ArchetypeTerrainKind = "river" | "coast" | "downs" | "woodland" | "fen";

export interface ArchetypeTerrainDef {
  readonly kind: ArchetypeTerrainKind;
  /**
   * The land's water, rock and forest, permille of the map before the town site (the thresholds are these quantiles of
   * the fields, so every seed of a land has its share). The riverside town has none: its thresholds are the open field's.
   */
  readonly shares?: { readonly water: number; readonly rock: number; readonly forest: number };
  /** How much finer noise breaks up the land's water and rock (and forest), permille: the fen's meres, the down's chalk. */
  readonly detailPermille?: number;
  /** A sea along one map edge (the seed picks north or west): its depth in tiles, the least and the most. */
  readonly sea?: { readonly minDepth: number; readonly maxDepth: number };
}

/** ARCH-1 (MA-5): the art a render lays on the archetype's land — Wave 22 ground, Wave 28 field edges, Wave 29 water. */
export interface ArchetypeGroundDef {
  /** Wave 22 fill of the open ground (`terrain/<fill>`); `grass` is today's meadow. */
  readonly fill: "grass" | "chalk_down" | "coastal_grass" | "woodland_floor" | "fen";
  /** A second fill in patches (the down's heath), or none. */
  readonly patchFill?: "heath";
  /** The Wave 22 transition band between the meadow and the fill (`boundary/<edge>_edge_{a,b}`), or none. */
  readonly edge?: "chalk" | "heath" | "fen" | "coastal";
  /** Wave 22 decals and props scattered on the fill (`decals/…`, `props/…` without the variant suffix). */
  readonly decals: readonly string[];
  /** Tiles of the open ground that carry a decal, permille. */
  readonly decalPermille: number;
  /** Wave 28's field boundary: a hedgerow or a dry-stone wall. */
  readonly fieldBoundary: "hedgerow" | "dry_stone_wall";
  /** Wave 29's water movement on this land's water. */
  readonly water: readonly string[];
}

/** ARCH-1 (MA-3): the land's resources, from scarce to rich; timber and stone are its forest and rock. */
export type ResourceLevel = "scarce" | "normal" | "rich";

/** ARCH-1 (MA-4): the archetype's rules differ by these coefficients only, permille (1,000 = the open field). */
export interface ArchetypeRules {
  /** The arable harvest (the crop a strip grows). */
  readonly arablePermille: number;
  /** The pasture's clip (fleeces at the shearing). */
  readonly pastoralPermille: number;
  /** The logging camp's pace (logs). */
  readonly timberPermille: number;
  /** A wet summer's harvest loss (its share of the 5 % the open field loses). */
  readonly floodPermille: number;
  /** A coastal town's raid (houses and loot) and its pestilence's deaths. */
  readonly coastalEventPermille: number;
}

export interface ArchetypeDef {
  readonly id: string;
  /** Filled by B5/C1 (land system, resource package). */
  readonly resourcePackage: Readonly<Record<string, unknown>>;
  /** F2-A (WR-5): on the coast (or a tidal river's mouth) — the war of 1337 lights its beacon and raids it. */
  readonly coastal?: boolean;
  /** ARCH-1: the land, its art, its resources and its rules. */
  readonly terrain: ArchetypeTerrainDef;
  readonly ground: ArchetypeGroundDef;
  readonly resources: Readonly<Record<"timber" | "stone" | "clay" | "fish", ResourceLevel>>;
  readonly rules: ArchetypeRules;
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
