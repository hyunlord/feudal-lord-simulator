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
  readonly outputTotal: number;
  readonly houseBread: number;
  readonly starvingHomes: number;
}

export interface AutoplayFoodObservationOutcome {
  readonly outputDelta: number;
  readonly deliveredBreadDelta: number;
  readonly starvingHomesDelta: number;
  readonly effective: boolean;
}

export interface AutoplayFoodObservation {
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
  idleWorkers: number;
  treasuryTimber: number;
  treasuryCoin: number;
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
}
