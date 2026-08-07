import type { Walker } from "../agents/walker.types";
import type { Building } from "../content/buildingConfig";
import type { ConstructionSiteRenderItem } from "./constructionRenderItems";
import type { PalisadeSegmentRenderItem } from "./palisadeObjectRenderItems";
import type {
  GroundCoverDescriptor,
  StumpDescriptor,
  TreeDescriptor,
} from "./treeLayout";
import type { StartingLandmark } from "./startingLandmarks";

export type ObjectRenderItem =
  | {
      readonly kind: "starting_landmark";
      readonly id: string;
      readonly landmark: StartingLandmark;
      readonly depth: number;
      readonly anchorTx: number;
    }
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
    };

export type WorldObjectRenderItem = ObjectRenderItem | PalisadeSegmentRenderItem;
export type RenderQueueItem = WorldObjectRenderItem | ConstructionSiteRenderItem;
