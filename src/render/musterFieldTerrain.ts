import type { GameState } from '../engine/engine.types';

/** Drainage changes water to grass but retains its original cell IDs; harvesting leaves terrain intact. */
export function musterTerrainClearance(state: GameState): Int16Array {
  const drained = new Set(state.drainage?.drained ?? []), { width, height } = state;
  const distances = new Int16Array(width * height), queue: number[] = [];
  distances.fill(32767);
  for (let index = 0; index < distances.length; index++) {
    const x = index % width, y = Math.floor(index / width);
    if (state.tiles[index]?.terrain !== 'grass' || drained.has(index)) { distances[index] = 0; queue.push(index); }
    else if (x === 0 || y === 0 || x === width - 1 || y === height - 1) { distances[index] = 1; queue.push(index); }
  }
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head]!, x = index % width, y = Math.floor(index / width), next = distances[index]! + 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const neighbor = ny * width + nx;
      if (distances[neighbor]! > next) { distances[neighbor] = next; queue.push(neighbor); }
    }
  }
  return distances;
}
