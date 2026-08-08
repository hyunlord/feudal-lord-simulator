import type { RenderQueueItem } from "./objectRenderTypes";

export function compareRenderItems(left: RenderQueueItem, right: RenderQueueItem): number {
  const depthDifference = left.depth - right.depth;
  if (depthDifference !== 0) return depthDifference;

  const anchorDifference = left.anchorTx - right.anchorTx;
  if (anchorDifference !== 0) return anchorDifference;
  const sortYDifference = renderSortY(left) - renderSortY(right);
  return sortYDifference !== 0 ? sortYDifference : left.id.localeCompare(right.id);
}

function renderSortY(item: RenderQueueItem): number {
  switch (item.kind) {
    case "tree":
    case "stump":
    case "groundCover":
      return item.descriptor.sortY;
    case "walker":
      return item.walker.position.ty;
    case "building":
      return item.building.ty;
    case "starting_landmark":
    case "palisade_segment":
    case "construction_site":
      return item.depth;
  }
}
