import type { GameState } from '../engine/engine.types';
import type { Tile } from '../world/world.types';
import { groundBoundaryScene } from './groundBoundaryScene';
import { boundaryV2Enabled } from './renderBoundaryFlag';
import { tileToScreen } from './iso';
import { mix } from './weatherPlacement';
import { rainBandWeight } from './worldRainModel';
import { calendarProgress } from './calendarProgress';
import { engineWeather } from './weatherLayers';
import { presentationPreference } from './presentationPreferences';
import { NATURE_ART } from './art/natureArt';

export type RainContact = { readonly x: number; readonly y: number; readonly group: 'soil' | 'stone'; readonly hash: number };
/** Use actual painted ribbon centreline segments; grass and water are not falsely classified as soil. */
export function roadRainContacts(state: GameState, visible: readonly Tile[]): readonly RainContact[] {
  if (!boundaryV2Enabled()) return [];
  const scene = groundBoundaryScene(state);
  const cells = new Set(visible.filter(tile => tile.hasRoad && tile.buildingId === null && tile.terrain !== 'water').map(tile => `${tile.tx}:${tile.ty}`));
  const result: RainContact[] = [];
  for (const chain of scene.roads.chains) for (let i = 1; i < chain.centreline.length; i += 1) {
    const a = chain.centreline[i - 1], b = chain.centreline[i];
    if (a === undefined || b === undefined) continue;
    const tx = (a.x + b.x) / 2, ty = (a.y + b.y) / 2;
    const first = chain.cells[0];
    if (first === undefined) continue;
    const nearest = chain.cells.reduce((best, cell) => Math.hypot(cell.tx - tx, cell.ty - ty) < Math.hypot(best.tx - tx, best.ty - ty) ? cell : best, first);
    if (!cells.has(`${nearest.tx}:${nearest.ty}`)) continue;
    const material = chain.materials[chain.cells.indexOf(nearest)];
    if (material === undefined) continue;
    const at = tileToScreen(tx, ty);
    result.push({ x: at.sx, y: at.sy, group: material === 'stone' ? 'stone' : 'soil', hash: mix(state.seed, nearest.tx, nearest.ty, i, 39341) });
  }
  return result;
}
export function rainContactAge(state: GameState, x: number, y: number, hash: number): number | null {
  if (!presentationPreference('weatherFx') || !presentationPreference('rainOverlay') || engineWeather(state).weather !== 'wet') return null;
  const seconds = calendarProgress(state).seconds;
  const phase = (seconds + (hash % 1000) / 1000) % 1.8;
  if (phase >= 0.2 || (hash % 100) / 100 > rainBandWeight(x, y, seconds, state.seed)) return null;
  return phase;
}
export function drawNatureGroundContacts(context: CanvasRenderingContext2D, state: GameState, visible: readonly Tile[], zoom: number): void {
  if (zoom < 1 || !presentationPreference('weatherFx') || !presentationPreference('rainOverlay') || engineWeather(state).weather !== 'wet') return;
  const family = NATURE_ART.resolve('splash');
  if (family === null) return;
  for (const contact of roadRainContacts(state, visible)) {
    const age = rainContactAge(state, contact.x, contact.y, contact.hash);
    if (age === null) continue;
    const ready = NATURE_ART.select(family, 'splash', contact.group, contact.hash);
    if (ready !== null) NATURE_ART.draw(context, ready, contact.x, contact.y, zoom, 0.5, age);
  }
}
