import type { GameState } from '../engine/engine.types';
import type { Tile } from '../world/world.types';
import { NATURE_ART } from './art/natureArt';
import { calendarProgress } from './calendarProgress';
import { accumulatedLeafSpots, liveDeciduousTrees } from './natureTreeModel';
import { mix, type Rect } from './weatherPlacement';

/** The new family owns autumn ground only when all six sources are ready. */
export function drawAccumulatedLeaves(context: CanvasRenderingContext2D, state: GameState, tiles: readonly Tile[], zoom: number): boolean {
  const ground = NATURE_ART.resolve('leaf-ground');
  if (ground === null) return false;
  const water = NATURE_ART.resolve('leaf-water');
  const visible = new Set(tiles.map(tile => `${tile.tx}:${tile.ty}`));
  for (const spot of accumulatedLeafSpots(state, liveDeciduousTrees(state))) {
    if (!visible.has(`${spot.tile.tx}:${spot.tile.ty}`)) continue;
    const family = spot.tile.terrain === 'water' ? water : ground;
    if (family === null) continue;
    const role = spot.tile.terrain === 'water' ? 'leaf-water' : 'leaf-ground';
    const group = role === 'leaf-water' ? 'all' : spot.group;
    const ready = NATURE_ART.select(family, role, group, spot.hash);
    if (ready !== null) NATURE_ART.draw(context, ready, spot.x, spot.y, zoom, spot.amount);
  }
  return true;
}
/** Atomically replaces the legacy falling sheet. Births use actual simulation seconds, never viewport seeds. */
export function drawNatureLeafFlight(context: CanvasRenderingContext2D, state: GameState, zoom: number, view: Rect): boolean {
  const leaves = NATURE_ART.resolve('leaf-flight'), wind = NATURE_ART.resolve('leaf-wind');
  if (leaves === null || wind === null) return false;
  const progress = calendarProgress(state);
  if (progress.season !== 2) return true;
  for (const { tree, group } of liveDeciduousTrees(state)) {
    if (tree.x < view.x - 80 || tree.x > view.x + view.width + 80 || tree.y < view.y - 80 || tree.y > view.y + view.height + 80) continue;
    const hash = mix(state.seed, tree.anchorTx, tree.anchorTy, tree.offsetX * 10, 39211);
    const phase = progress.seconds + hash % 40 / 10;
    const birth = Math.floor(phase / 4), age = phase % 4;
    const pick = mix(hash, birth);
    const ready = NATURE_ART.select(leaves, 'leaf-flight', group, pick);
    const x = tree.x + Math.sin(age * 1.4 + pick) * 12;
    const y = tree.y - 56 + age * 14;
    if (ready !== null) NATURE_ART.draw(context, ready, x, y, zoom, Math.min(1, age * 3, (4 - age) * 3), age);
    const windAge = (progress.seconds + hash % 100 / 10) % 12;
    if (windAge >= 1.2) continue;
    const windReady = NATURE_ART.select(wind, 'leaf-wind', 'all', hash);
    if (windReady !== null) NATURE_ART.draw(context, windReady, tree.x - 14 + windAge * 24, tree.y, zoom, Math.sin(windAge / 1.2 * Math.PI), windAge);
  }
  return true;
}
