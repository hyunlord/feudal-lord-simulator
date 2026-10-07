import type { ObjectRenderItem, RenderQueueItem } from "./objectRenderTypes";

export const mergeObjectRenderItems = (
  left: readonly RenderQueueItem[],
  right: readonly ObjectRenderItem[],
): readonly RenderQueueItem[] => {
  const merged: RenderQueueItem[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftItem = left[leftIndex];
    const rightItem = right[rightIndex];
    if (leftItem === undefined || rightItem === undefined) break;
    if (compareObjectRenderItems(leftItem, rightItem) <= 0) {
      merged.push(leftItem);
      leftIndex += 1;
    } else {
      merged.push(rightItem);
      rightIndex += 1;
    }
  }
  for (; leftIndex < left.length; leftIndex += 1) {
    const item = left[leftIndex];
    if (item !== undefined) merged.push(item);
  }
  for (; rightIndex < right.length; rightIndex += 1) {
    const item = right[rightIndex];
    if (item !== undefined) merged.push(item);
  }
  return merged;
};

export const compareObjectRenderItems = (left: RenderQueueItem, right: RenderQueueItem): number => {
  const depthDifference = left.depth - right.depth;
  if (depthDifference !== 0) return depthDifference;
  const anchorDifference = left.anchorTx - right.anchorTx;
  return anchorDifference !== 0 ? anchorDifference : left.id.localeCompare(right.id);
};

