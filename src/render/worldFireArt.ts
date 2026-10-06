import type { GameState } from '../engine/engine.types';
import { stateCalendar } from '../engine/scenarioState';
import { createArtAdapters } from './art/artAdapters';
import type { EventSceneEntry } from './art/artContract';
import type { ArtImageEnvironment } from './art/artImageLoader';
import type { ArtRegistry } from './art/artRegistry';
import { ART_REGISTRY } from './art/wave42Registry';
import { tileToScreen } from './iso';

export type WorldFireRole = 'bucket-brigade' | 'fire-flame';
export type WorldFireProp = {
  readonly id: string; readonly buildingId: string; readonly eventId: string;
  readonly assetId: string; readonly role: WorldFireRole; readonly tx: number; readonly ty: number;
};
export type WorldFireSelector = (state: GameState, eventId: string, role: WorldFireRole) => EventSceneEntry | null;
export function createWorldFireArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const adapters = createArtAdapters(registry, environment);
  const select: WorldFireSelector = (state, eventId, role) => {
    const entry = registry.select('event-scene', role === 'bucket-brigade' ? 'fire-brigade' : 'fire-flame', {
      eventId, group: role, active: true, season: stateCalendar(state).season === 3 ? 'winter' : 'summer',
    }, state.seed);
    return entry?.kind === 'event-scene' && entry.duration.mode === 'while-active' && adapters.image(entry.id) !== null ? entry : null;
  };
  return { select, draw: (context: Parameters<typeof adapters.draw>[0], prop: WorldFireProp, elapsedMs: number): boolean => {
    const at = tileToScreen(prop.tx, prop.ty);
    return adapters.draw(context, prop.assetId, { at: { x: at.sx, y: at.sy }, elapsedMs });
  } };
}
export const WORLD_FIRE_ART = createWorldFireArt(ART_REGISTRY);
