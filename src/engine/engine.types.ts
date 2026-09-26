import type { Walker } from "../agents/walker.types";
import type { Building } from "../economy/economy.types";
import type { ConstructionSite } from "../economy/construction";
import type { House } from "../population/population.types";
import type { PalisadePath, TileEdgePoint } from "../world/palisadeGeometry";
import type { TileCoordinate } from "../world/grid";
import type { Tile } from "../world/world.types";

export type OverlayMode =
  | "none"
  | "water"
  | "food"
  | "labour"
  | "roads"
  | "distribution"
  | "road_component";
export type GameSpeed = 0 | 1 | 3 | 5;
export type RoadPathCache = Record<string, readonly TileCoordinate[]>;
export type { Era, EraRequirementKey } from "../content/eraConfig";

import type { Era, EraRequirementKey } from "../content/eraConfig";

export interface EraRequirement {
  readonly key: EraRequirementKey;
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly met: boolean;
}

export interface PalisadeSegment {
  readonly id: string;
  readonly order: number;
  readonly gateDistance?: number;
  readonly edgePath: PalisadePath;
  readonly tileCount: number;
  readonly completed: boolean;
  readonly constructionSiteId: string | null;
  readonly material?: "timber" | "stone";
  readonly replacementConstructionSiteId?: string | null;
}

export interface PalisadeState {
  readonly id: string;
  readonly polygon: PalisadePath;
  readonly gate: TileEdgePoint;
  readonly additionalGates?: readonly TileEdgePoint[];
  readonly segments: readonly PalisadeSegment[];
}

export interface ForestHarvest {
  readonly tx: number;
  readonly ty: number;
  readonly harvestedAtTick: number;
}

export interface AutoplayFoodObservationSnapshot {
  readonly deliveredWheat?: number;
  readonly breadProduced?: number;
  readonly missedMeals?: number;
  readonly outputTotal: number;
  readonly houseBread: number;
  readonly starvingHomes: number;
}

export interface AutoplayFoodObservationOutcome {
  readonly deliveredWheatDelta?: number;
  readonly outputDelta: number;
  readonly deliveredBreadDelta: number;
  readonly starvingHomesDelta: number;
  readonly effective: boolean;
}

export interface AutoplayFoodObservation {
  readonly requiresDeliveredOutcome?: boolean;
  readonly kind: "granary" | "mill" | "wheat_farm";
  readonly siteId: string;
  readonly placedTick: number;
  readonly targetHouseIds?: readonly string[];
  readonly deliveredTargetHouseIds?: readonly string[];
  readonly completedTick?: number;
  readonly observeUntilTick?: number;
  readonly baseline?: AutoplayFoodObservationSnapshot;
  readonly latest?: AutoplayFoodObservationSnapshot;
  readonly outcome?: AutoplayFoodObservationOutcome;
}

export interface GameState {
  /** Scenario (`namespace:id`, save v5). Absent in pre-v5 states, which read as the default campaign. */
  readonly scenarioId?: string;
  settlement?: import("./settlement.types").SettlementProgress;
  tick: number;
  seed: number;
  tiles: Tile[];
  width: number;
  height: number;
  buildings: Building[];
  constructionSites: ConstructionSite[];
  houses: House[];
  walkers: Walker[];
  population: number;
  /**
   * Adults the R1-fix facility and construction allocation left over: the pool a new facility can staff (autoplay
   * reads it). Not the idle labour of LB-9 — that is `labour.idle`, after field hands, hauling and household slots.
   */
  idleWorkers: number;
  /** LB-4 (save v11): where the adults went this tick. Recomputed every tick; absent before the first v11 tick. */
  readonly labour?: import("./labourDemand").LabourSummary;
  treasuryTimber: number;
  treasuryCoin: number;
  /**
   * Economy ledger (save v7, spec docs/design/ledger.md). Absent until the first posting; then
   * `treasuryCoin` is only the cached cash balance and changes only through `postLedgerEntries`.
   */
  readonly ledger?: import("../ledger/ledger.types").Ledger;
  /** Money-rule counts and the upkeep arrears queue (save v8, spec docs/design/money-rules.md). */
  readonly money?: import("./money.types").MoneyState;
  readonly timberProductionWindow?: {
    readonly startTick: number;
    readonly throughTick: number;
    readonly produced: number;
    readonly productionTicks: readonly number[];
    readonly availableTimber?: number;
    readonly lastAvailableIncreaseTick?: number;
    readonly expansionShortageSinceTick?: number;
  };
  readonly wallConstructionPriority?: import("./constructionReserve").WallConstructionPriority;
  readonly wallConstructionReserve?: import("./constructionReserve").WallConstructionReserve;
  wallTick: number;
  era: Era;
  eraProclaimedTick: number | null;
  palisade: PalisadeState | null;
  readonly forestHarvests: readonly ForestHarvest[];
  readonly autoplayRecurringDelivery?: import("./autoplayRecurringDelivery").AutoplayRecurringDelivery;
  readonly autoplayFoodTransientConfirmation?: import("./autoplayFoodTransient").AutoplayFoodTransientConfirmation;
  readonly autoplayFoodFlow?: import("./autoplayFoodFlow").AutoplayFoodFlow;
  readonly autoplayFoodObservation?: AutoplayFoodObservation;
  readonly autoplayMaterialRecovery?: import("./autoplayMaterialTypes").AutoplayMaterialRecovery;
  readonly autoplayEmptyHomes?: readonly {
    readonly buildingId: string;
    readonly sinceTick: number;
    readonly failedRecovery?: boolean;
    readonly lastServicedTick: number;
  }[];
  nextConstructionOrdinal: number;
  roadRevision: number;
  pathCache: RoadPathCache;
  /** Painted land zones (save v6). Absent or empty = no zone rules apply (spec Z-11). */
  readonly zones?: readonly import("../zones/zone.types").Zone[];
  /** Ordinal of the next painted zone (save v6); starts at 1. */
  readonly nextZoneOrdinal?: number;
  /** Undo stack of the last zone paint/erase edits, newest last (save v9, spec Z-17). Absent = empty. */
  readonly zoneUndo?: readonly import("../zones/zone.types").ZoneUndoRecord[];
  /** Crop state of every arable zone's strips (save v10, spec AF-3). Absent = no field worked yet. */
  readonly arableFields?: readonly import("../zones/arable.types").ArableField[];
  /** Set once by the v9→v10 migration when it converted wheat farms (spec AF-12). */
  readonly arableMigration?: import("../zones/arable.types").ArableMigrationSummary;
  /** Season ledgers and the season being counted (save v12, spec FP-1). Absent until the first tick after v12. */
  readonly seasons?: import("./season.types").SeasonState;
  /** Historical eras entered, in order (save v12, spec FP-5). Absent until the first tick after v12. */
  readonly historicalEras?: readonly import("./season.types").HistoricalEraEntry[];
}
