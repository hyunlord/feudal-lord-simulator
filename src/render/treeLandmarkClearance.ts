import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { STARTING_LANDMARKS } from "./startingLandmarks";
import type { TreeDescriptor } from "./treeLayout";
import { spriteMeta } from "./worldAssets";

type Rect = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

const LANDMARK_LABEL_HALF_WIDTH = 26;
const LANDMARK_LABEL_TOP = -30;
const LANDMARK_LABEL_BOTTOM = -8;
const LANDMARK_FOOTPRINT_RADIUS_X = TILE_W * 0.42;
const LANDMARK_FOOTPRINT_TOP = -TILE_H * 0.26;
const LANDMARK_FOOTPRINT_BOTTOM = TILE_H * 0.34;

export function treeClearsStartingLandmarks(tree: TreeDescriptor): boolean {
  const treeBounds = treeVisualBounds(tree);
  return STARTING_LANDMARKS.every((landmark) => {
    const center = tileToScreen(landmark.tx, landmark.ty);
    return (
      !rectsIntersect(treeBounds, {
        left: center.sx - LANDMARK_LABEL_HALF_WIDTH,
        right: center.sx + LANDMARK_LABEL_HALF_WIDTH,
        top: center.sy + LANDMARK_LABEL_TOP,
        bottom: center.sy + LANDMARK_LABEL_BOTTOM,
      }) &&
      !rectsIntersect(treeBounds, {
        left: center.sx - LANDMARK_FOOTPRINT_RADIUS_X,
        right: center.sx + LANDMARK_FOOTPRINT_RADIUS_X,
        top: center.sy + LANDMARK_FOOTPRINT_TOP,
        bottom: center.sy + LANDMARK_FOOTPRINT_BOTTOM,
      })
    );
  });
}

function treeVisualBounds(tree: TreeDescriptor): Rect {
  const meta = spriteMeta(tree.spriteKey);
  if (meta === null) {
    return {
      left: tree.x - 20 * tree.scale,
      right: tree.x + 20 * tree.scale,
      top: tree.y - 56 * tree.scale,
      bottom: tree.y,
    };
  }
  return {
    left: tree.x - meta.anchor.x * tree.scale,
    right: tree.x + (meta.width - meta.anchor.x) * tree.scale,
    top: tree.y - meta.anchor.y * tree.scale,
    bottom: tree.y,
  };
}

function rectsIntersect(left: Rect, right: Rect): boolean {
  return !(
    left.right < right.left ||
    left.left > right.right ||
    left.bottom < right.top ||
    left.top > right.bottom
  );
}
