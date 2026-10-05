import { isPointInsidePalisade } from '../world/palisadeGeometry';
import { BALANCE } from '../content/balanceConfig';
import type { GameState } from '../engine/engine.types';
import { weatherAt } from '../engine/eventSchedule';
import { NATURE_ART } from './art/natureArt';
import { calendarProgress } from './calendarProgress';
import { engineWeather } from './weatherLayers';
import { presentationPreference } from './presentationPreferences';
import { mix, tileCentre } from './weatherPlacement';
import { TILE_H, TILE_W } from './iso';
import type { Tile } from '../world/world.types';

/** A visual curve reconstructed from the current schedule, not an observation of past rainfall or soil water. */
export function modeledWetness(state: GameState): number {
  const current = engineWeather(state).weather;
  const progress = calendarProgress(state);
  if (current === null || progress.season === 3) return 0;
  const previous = state.tick >= BALANCE.TICKS_PER_YEAR / 4 && progress.season !== 0
    ? weatherAt(state, state.tick - BALANCE.TICKS_PER_YEAR / 4).kind : null;
  if (current === 'wet') return previous === 'wet' ? 1 : Math.min(1, progress.fraction / 0.45);
  return previous === 'wet' ? Math.max(0, 1 - progress.fraction / (current === 'dry' ? 0.2 : 0.4)) : 0;
}
function wetReceipt() {
  const puddle = NATURE_ART.resolve('puddle'), mud = NATURE_ART.resolve('mud');
  const grass = NATURE_ART.resolve('wet-grass'), soil = NATURE_ART.resolve('wet-soil');
  return puddle !== null && mud !== null && grass !== null && soil !== null ? { puddle, mud, grass, soil } : null;
}
export function natureWetGroundReady(): boolean { return wetReceipt() !== null; }
export function drawNatureWetGround(context: CanvasRenderingContext2D, state: GameState, tiles: readonly Tile[], zoom: number): boolean {
  if (!presentationPreference('weatherFx')) return false;
  const family = wetReceipt();
  if (family === null) return false;
  const amount = modeledWetness(state);
  if (amount === 0) return true;
  const stoneWall = state.palisade !== null && state.palisade.segments.some(segment => segment.completed);
  for (const tile of tiles) {
    if (tile.terrain !== 'grass' || tile.buildingId !== null) continue;
    // Match roadCenterlineGraph's existing material rule; soil/mud never cover stone roads.
    if (tile.hasRoad && stoneWall && state.palisade !== null && isPointInsidePalisade({ x: tile.tx + 0.5, y: tile.ty + 0.5 }, state.palisade.polygon)) continue;
    const at = tileCentre(tile.tx, tile.ty);
    const role = tile.hasRoad ? 'wet-soil' : 'wet-grass';
    const mask = NATURE_ART.select(tile.hasRoad ? family.soil : family.grass, role, 'all', 0);
    if (mask !== null) {
      context.save();
      try {
        context.beginPath(); context.moveTo(at.x, at.y - TILE_H / 2); context.lineTo(at.x + TILE_W / 2, at.y);
        context.lineTo(at.x, at.y + TILE_H / 2); context.lineTo(at.x - TILE_W / 2, at.y); context.closePath(); context.clip();
        context.globalCompositeOperation = 'multiply';
        NATURE_ART.draw(context, mask, at.x, at.y, zoom, amount);
      } finally { context.restore(); }
    }
    const hash = mix(state.seed, tile.tx, tile.ty, 39301);
    if (tile.tx % 2 !== 0 || tile.ty % 2 !== 0 || hash % 1000 > amount * 300) continue;
    const muddy = tile.hasRoad && hash % 3 === 0;
    const decal = NATURE_ART.select(muddy ? family.mud : family.puddle, muddy ? 'mud' : 'puddle', 'all', hash);
    if (decal !== null) NATURE_ART.draw(context, decal, at.x, at.y, zoom, amount * 0.25);
  }
  return true;
}
