import type { Building } from '../../content/buildingConfig';
import type { GameState } from '../../engine/engine.types';
import { stateCalendar } from '../../engine/scenarioState';
import { lordMode } from '../../engine/townAgency';
import { tradesOf } from '../../engine/trades';
import { createArtAdapters } from './artAdapters';
import type { BuildingAttachmentEntry, ArtPoint } from './artContract';
import type { ArtImageEnvironment } from './artImageLoader';
import type { ArtRegistry } from './artRegistry';
import type { ContractHouseDraw } from './contractHouseArt';
import { ART_REGISTRY } from './wave42Registry';

export type BuildingAttachmentInput = {
  readonly state: GameState;
  readonly building: Building;
  readonly drawn: ContractHouseDraw | null;
  readonly zoom: number;
};

/** A source-pixel mount follows the body actually painted, including its crop and uniform scale. */
export function buildingAttachmentAnchor(drawn: ContractHouseDraw, point: ArtPoint): ArtPoint {
  const { sourceRect: source, targetRect: target } = drawn.body;
  return {
    x: target.x + (point.x - source.x) * target.width / source.width,
    y: target.y + (point.y - source.y) * target.height / source.height,
  };
}

/** No calendar cache: crossing a data-authored era boundary changes the next draw, not the saved household. */
export function createBuildingAttachmentArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const adapters = createArtAdapters(registry, environment);
  const select = ({ state, building, drawn, zoom }: BuildingAttachmentInput): BuildingAttachmentEntry | null => {
    if (drawn === null || !lordMode(state) || building.kind !== 'house' || building.houseLot !== undefined) return null;
    const house = state.houses.find(entry => entry.buildingId === building.id);
    if (house === undefined || house.residents <= 0 || house.abandonedTick !== undefined || house.burntTick !== undefined
      || house.foodShortSinceTick !== undefined || house.leavingSinceTick !== undefined) return null;
    if (state.events?.burning.some(entry => entry.buildingId === building.id && entry.outTick > state.tick)) return null;
    const occupation = tradesOf(state).households.find(entry => entry.houseId === building.id)?.tradeId;
    if (occupation === undefined) return null;
    const calendar = stateCalendar(state);
    const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
    const entry = registry.select('building-attachment', 'house-trade-sign', {
      bodyId: drawn.body.bodyId, occupation, calendarYear: calendar.year, season: seasons[calendar.season], role: 'trade-sign',
    }, state.seed);
    if (entry?.kind !== 'building-attachment' || !entry.occupations.includes(occupation) || zoom < entry.minZoom
      || !entry.mounts.some(mount => mount.bodyId === drawn.body.bodyId)) return null;
    return entry;
  };
  return {
    select,
    draw: (context: Parameters<typeof adapters.draw>[0], input: BuildingAttachmentInput): boolean => {
      const entry = select(input);
      if (entry === null || input.drawn === null) return false;
      const mount = entry.mounts.find(candidate => candidate.bodyId === input.drawn?.body.bodyId);
      if (mount === undefined) return false;
      return adapters.draw(context, entry.id, { at: buildingAttachmentAnchor(input.drawn, mount.point) });
    },
  };
}

export const buildingAttachmentArt = createBuildingAttachmentArt(ART_REGISTRY);
