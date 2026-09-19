import type { RenderQueueItem } from "./objectRenderTypes";
import { buildingFootprint } from "../geometry/buildingFootprint";

type SortableRenderItem = RenderQueueItem | Readonly<{
  kind: "bridge_rail"; depth: number; anchorTx: number; id: string;
}>;

export function sortRenderItems<T extends SortableRenderItem>(items: readonly T[]): T[] {
  const ordered = [...items].sort(compareRenderItems);
  const buildings = ordered.flatMap((item, index) => item.kind === "building" ? [{ building: item.building, index }] : []);
  if (buildings.length === 0 || !ordered.some(item => item.kind === "palisade_segment")) return ordered;
  const outgoing = ordered.map(() => new Set<number>());
  const incoming = ordered.map(() => 0);
  const connect = (before: number, after: number) => {
    const targets = outgoing[before];
    if (targets === undefined || targets.has(after)) return;
    targets.add(after);
    incoming[after] = (incoming[after] ?? 0) + 1;
  };
  let previousObject: number | undefined;
  for (const [index, item] of ordered.entries()) {
    if (item.kind === "palisade_segment") continue;
    if (previousObject !== undefined) connect(previousObject, index);
    previousObject = index;
  }
  for (const [wallIndex, wall] of ordered.entries()) {
    if (wall.kind !== "palisade_segment") continue;
    const xs = wall.segment.edgePath.map(point => point.x);
    const ys = wall.segment.edgePath.map(point => point.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    for (const { index: buildingIndex, building } of buildings) {
      const { width, height } = buildingFootprint(building);
      const left = building.tx; const top = building.ty;
      const right = left + width; const bottom = top + height;
      const overlapsX = minX < right && maxX > left;
      const overlapsY = minY < bottom && maxY > top;
      const behind = (overlapsX && maxY <= top && maxY >= top - 1)
        || (overlapsY && maxX <= left && maxX >= left - 1);
      const ahead = (overlapsX && minY >= bottom && minY <= bottom + 1)
        || (overlapsY && minX >= right && minX <= right + 1);
      if (behind) connect(wallIndex, buildingIndex);
      else if (ahead) connect(buildingIndex, wallIndex);
    }
  }
  const result: T[] = [];
  const ready = incoming.flatMap((count, index) => count === 0 ? [index] : []);
  while (result.length < ordered.length) {
    const index = ready.shift();
    // Intersecting legacy footprints can contradict the immutable object order.
    // Keep their deterministic baseline instead of dropping render items.
    if (index === undefined) return ordered;
    const item = ordered[index];
    if (item === undefined) return ordered;
    result.push(item);
    for (const target of outgoing[index] ?? []) {
      incoming[target] = (incoming[target] ?? 0) - 1;
      if (incoming[target] !== 0) continue;
      let low = 0; let high = ready.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if ((ready[middle] ?? 0) < target) low = middle + 1;
        else high = middle;
      }
      ready.splice(low, 0, target);
    }
  }
  return result;
}

export function compareRenderItems(left: SortableRenderItem, right: SortableRenderItem): number {
  const depthDifference = left.depth - right.depth;
  if (depthDifference !== 0) return depthDifference;

  const anchorDifference = left.anchorTx - right.anchorTx;
  if (anchorDifference !== 0) return anchorDifference;
  const sortYDifference = renderSortY(left) - renderSortY(right);
  return sortYDifference !== 0 ? sortYDifference : left.id.localeCompare(right.id);
}

function renderSortY(item: SortableRenderItem): number {
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
    case "bridge_rail":
      return item.depth;
  }
}
