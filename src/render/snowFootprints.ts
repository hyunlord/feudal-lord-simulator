import { createFootprintGroundSupport } from './snowFootprintSupport';
import type { Walker } from '../agents/walker.types';
import type { GameState } from '../engine/engine.types';
import type { Tile } from '../world/world.types';
import { NATURE_ART } from './art/natureArt';
import { createSnowFootprintHistory } from './snowFootprintHistory';
import { presentationPreference } from './presentationPreferences';
import { screenToTile } from './iso';
import { objectPhase } from './seasonProgression';
import { SNOW_FOOTPRINTS } from './snowProgressionProfiles';

const history = createSnowFootprintHistory();
/** Observe all supplied walkers before view culling; draw only footprints supported by observed steps. */
export function drawSnowFootprints(context: CanvasRenderingContext2D, state: GameState, walkers: readonly Walker[], visible: readonly Tile[], zoom: number): void {
  if (!presentationPreference('seasonFx')) { history.reset(); return; }
  const prints = history.observe(state, walkers);
  if (zoom < 1 || prints.length === 0) return;
  const family = NATURE_ART.resolve('snow-footprint');
  if (family === null) return;
  const groundSupports = createFootprintGroundSupport(state);
  const cells = new Set(visible.map(tile => `${tile.tx}:${tile.ty}`));
  for (const print of prints) {
    const tile = screenToTile(print.x, print.y);
    if (!cells.has(`${Math.round(tile.tx)}:${Math.round(tile.ty)}`)) continue;
    const ready = NATURE_ART.select(family, 'snow-footprint', 'all', Math.floor(objectPhase(`${print.walkerId}:${print.tick}`, 'footprint') * 1000));
    if (ready !== null && groundSupports(print, ready.entry.id)) NATURE_ART.draw(context, ready, print.x, print.y, zoom, Math.max(0, 1 - (state.tick - print.tick) / SNOW_FOOTPRINTS.lifeTicks));
  }
}
