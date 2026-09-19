import { getTile, type Grid } from "./grid";
import type { PalisadeFootprint, PalisadePath, TileEdgePoint } from "./palisadeGeometry";

const key = (x: number, y: number) => `${x},${y}`;

export function palisadeLandEnvelopes(grid: Grid, footprints: readonly PalisadeFootprint[], margin: number): readonly PalisadePath[] {
  const cells = new Set<string>();
  for (const footprint of footprints) {
    for (let ty = footprint.ty - margin; ty < footprint.ty + footprint.height + margin; ty += 1) {
      for (let tx = footprint.tx - margin; tx < footprint.tx + footprint.width + margin; tx += 1) {
        const tile = getTile(grid, { tx, ty });
        if (tile !== null && tile.terrain !== "water") cells.add(key(tx, ty));
      }
    }
  }
  // Fill dry gaps between buffered plots; buildings never become holes in the enclosure.
  // Shore water remains outside, so the final candidate must independently pass setback checks.
  for (let ty = 0; ty < grid.height; ty += 1) {
    const row = [...cells].map(cell => cell.split(",").map(Number)).filter(([, y]) => y === ty).map(([x]) => x).filter((x): x is number => x !== undefined);
    if (row.length === 0) continue;
    const left = Math.min(...row); const right = Math.max(...row);
    const dry = Array.from({ length: right - left + 1 }, (_, offset) => getTile(grid, { tx: left + offset, ty })).every(tile => tile !== null && tile.terrain !== "water");
    if (dry) for (let tx = left; tx <= right; tx += 1) cells.add(key(tx, ty));
  }
  for (let tx = 0; tx < grid.width; tx += 1) {
    const column = [...cells].map(cell => cell.split(",").map(Number)).filter(([x]) => x === tx).map(([, y]) => y).filter((y): y is number => y !== undefined);
    if (column.length === 0) continue;
    const top = Math.min(...column); const bottom = Math.max(...column);
    const dry = Array.from({ length: bottom - top + 1 }, (_, offset) => getTile(grid, { tx, ty: top + offset })).every(tile => tile !== null && tile.terrain !== "water");
    if (dry) for (let ty = top; ty <= bottom; ty += 1) cells.add(key(tx, ty));
  }
  const outgoing = new Map<string, TileEdgePoint[]>();
  const add = (a: TileEdgePoint, b: TileEdgePoint) => outgoing.set(key(a.x, a.y), [...(outgoing.get(key(a.x, a.y)) ?? []), b]);
  for (const cell of cells) {
    const [x = 0, y = 0] = cell.split(",").map(Number);
    if (!cells.has(key(x, y - 1))) add({ x, y }, { x: x + 1, y });
    if (!cells.has(key(x + 1, y))) add({ x: x + 1, y }, { x: x + 1, y: y + 1 });
    if (!cells.has(key(x, y + 1))) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
    if (!cells.has(key(x - 1, y))) add({ x, y: y + 1 }, { x, y });
  }
  const loops: PalisadePath[] = [];
  while (outgoing.size > 0) {
    const startKey = [...outgoing.keys()].sort()[0];
    if (startKey === undefined) break;
    const [x = 0, y = 0] = startKey.split(",").map(Number);
    const path: TileEdgePoint[] = [{ x, y }];
    let current = path[0];
    while (current !== undefined) {
      const currentKey = key(current.x, current.y);
      const choices = outgoing.get(currentKey);
      const previous = path[path.length - 2];
      choices?.sort((a, b) => {
        if (previous !== undefined && current !== undefined) {
          const dx = current.x - previous.x; const dy = current.y - previous.y;
          const turnA = dx * (a.y - current.y) - dy * (a.x - current.x);
          const turnB = dx * (b.y - current.y) - dy * (b.x - current.x);
          if (turnA !== turnB) return turnB - turnA;
        }
        return a.x - b.x || a.y - b.y;
      });
      const next = choices?.shift();
      if (choices?.length === 0) outgoing.delete(currentKey);
      if (next === undefined) break;
      path.push(next);
      if (next.x === x && next.y === y) { loops.push(path); break; }
      current = next;
    }
  }
  return loops;
}
