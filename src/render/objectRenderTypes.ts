import type { Walker } from "../agents/walker.types";
import type { Building } from "../content/buildingConfig";
import type { ConstructionSiteRenderItem } from "./constructionRenderItems";
import type { PalisadeSegmentRenderItem } from "./palisadeObjectRenderItems";
import type { ZoneProp } from "./zoneLayer";
import type {
  GroundCoverDescriptor,
  StumpDescriptor,
  TreeDescriptor,
} from "./treeLayout";

export type ObjectRenderItem =
  | {
      readonly kind: "tree";
      readonly id: string;
      readonly descriptor: TreeDescriptor;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      readonly kind: "stump";
      readonly id: string;
      readonly descriptor: StumpDescriptor;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      readonly kind: "groundCover";
      readonly id: string;
      readonly descriptor: GroundCoverDescriptor;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      readonly kind: "building";
      readonly id: string;
      readonly building: Building;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      readonly kind: "walker";
      readonly id: string;
      readonly walker: Walker;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      /** Farm animals and ox teams (C1f, farmProps.ts), display only. */
      readonly kind: "farm_prop";
      readonly id: string;
      readonly prop: import("./farmProps").FarmProp;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      /** UI-6 chapter 2's war (warWorldProps.ts): the coastal beacon, the raid's burning quay and smoke, display only. */
      readonly kind: "war_prop";
      readonly id: string;
      readonly prop: import("./warWorldProps").WarProp;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      /** INSTALL-23 village life (villageLife.ts): yard animals, birds, toys, washing lines, doorstep props, display only. */
      readonly kind: "village_life";
      readonly id: string;
      readonly life: import("./villageLife").VillageLifeItem;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      /** INSTALL-28 the countryside outside the walls (countrysideDraw.ts): field-edge strip pieces and point props, display only. */
      readonly kind: "countryside";
      readonly id: string;
      readonly piece: import("./countrysideLand").CountryStripPiece | import("./countrysideLayout").CountryPiece;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      /** Orchard trees and haycocks of painted zones (C1b), from the ground scene's zone layer. */
      readonly kind: "zone_prop";
      readonly id: string;
      readonly prop: ZoneProp;
      readonly depth: number;
      readonly anchorTx: number;
    };

export type WorldObjectRenderItem = ObjectRenderItem | PalisadeSegmentRenderItem;
export type RenderQueueItem = WorldObjectRenderItem | ConstructionSiteRenderItem;
