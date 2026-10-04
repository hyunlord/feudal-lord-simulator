import type { Building } from '../../content/buildingConfig';
import type { GameState } from '../../engine/engine.types';
import { stateCalendar } from '../../engine/scenarioState';
import { housePressureStatus } from '../../population/housePressure';
import { textRandom } from '../buildingVariants';
import { houseBodyEligible } from '../houseVariantChoice';
import { tileToScreen, TILE_H } from '../iso';
import { seasonBlend, seasonForObject } from '../seasonTransition';
import { createArtAdapters } from './artAdapters';
import type { ArtImageEnvironment } from './artImageLoader';
import type { ArtRegistry } from './artRegistry';
import type { ArtPoint, ArtRect, BuildingBodyEntry, StateOverlayEntry } from './artContract';
import { ART_REGISTRY } from './wave42Registry';

type HouseArtState = Pick<GameState, 'seed' | 'houses'> & Partial<Pick<GameState, 'tick' | 'scenarioId' | 'events'>>;
export type ContractHouseInput = { readonly state: HouseArtState | undefined; readonly building: Building; readonly level: number };
export type ContractHouseDraw = {
  readonly at: ArtPoint; readonly layers: readonly string[];
  readonly body: { readonly bodyId: string; readonly sourceRect: ArtRect; readonly targetRect: ArtRect };
};
type DrawContext = Parameters<ReturnType<typeof createArtAdapters>['draw']>[0];

/** Rendering reads current facts on every draw; only the shared adapter's image cache persists. */
export function createContractHouseArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const adapters = createArtAdapters(registry, environment);
  const hasBodies = registry.entries('building-body').length > 0;
  const facts = ({ state, building, level }: ContractHouseInput) => {
    if (!hasBodies || state?.tick === undefined || !Number.isFinite(state.tick) || building.kind !== 'house' || building.houseLot !== undefined) return null;
    const house = state.houses.find(candidate => candidate.buildingId === building.id);
    if (house === undefined || !houseBodyEligible(state, building, house)) return null;
    const clock = { ...state, tick: state.tick };
    const effective = seasonForObject(seasonBlend(clock), building.tx * 31 + building.ty * 17);
    const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
    return { context: { buildingKind: building.kind, level, calendarYear: stateCalendar(clock).year,
      lot: 'single', eligible: true, season: seasons[effective] },
    vacant: housePressureStatus(house) === 'abandoned', seed: Math.floor(textRandom(state.seed, building.id, 0) * 0x1_0000_0000) >>> 0 };
  };
  const selection = (input: ContractHouseInput) => {
    const read = facts(input);
    if (read === null) return null;
    const body = registry.select('building-body', 'house-body', read.context, read.seed);
    if (body?.kind !== 'building-body' || !body.buildingKinds.includes(input.building.kind) || !body.levels.includes(input.level)) return null;
    const layers: StateOverlayEntry[] = [];
    for (const layer of ['boarded', 'snow'] as const) {
      if (layer === 'boarded' ? !read.vacant : read.context.season !== 'winter') continue;
      const overlay = registry.select('state-overlay', `house-${layer}`, {
        bodyId: body.id, layer, season: read.context.season, vacant: read.vacant,
      }, read.seed);
      // Registry geometry compatibility is guaranteed only for declared targets, not every rule match.
      if (overlay?.kind !== 'state-overlay' || overlay.layer !== layer || !overlay.targetBodyIds.includes(body.id)) return null;
      layers.push(overlay);
    }
    return { body, layers: layers.sort((a, b) => a.order - b.order) };
  };
  const readySelection = (input: ContractHouseInput) => {
    const selected = selection(input);
    if (selected === null) return null;
    // Start every required request even when the first is loading; publish one coherent painting only.
    const images = [selected.body, ...selected.layers].map(entry => adapters.image(entry.id));
    return images.some(image => image === null) ? null : selected;
  };
  const anchor = (building: Building) => {
    const center = tileToScreen(building.tx, building.ty);
    return { x: center.sx, y: center.sy + TILE_H / 2 };
  };
  return {
    select: (input: ContractHouseInput): BuildingBodyEntry | null => selection(input)?.body ?? null,
    ready: (input: ContractHouseInput): boolean => readySelection(input) !== null,
    status: adapters.status,
    drawBody: (context: DrawContext, input: ContractHouseInput): ContractHouseDraw | null => {
      const selected = readySelection(input);
      if (selected === null) return null;
      const at = anchor(input.building);
      const placement = adapters.placement(selected.body.id, { at });
      if (placement?.type !== 'blit' || !adapters.draw(context, selected.body.id, { at })) return null;
      // This local receipt pins the actually drawn body, season and layers across the rest of this draw pass.
      return Object.freeze({ at: Object.freeze(at), layers: Object.freeze(selected.layers.map(layer => layer.id)),
        body: Object.freeze({ bodyId: selected.body.id, sourceRect: Object.freeze(placement.sourceRect), targetRect: Object.freeze(placement.targetRect) }) });
    },
    drawLayers: (context: DrawContext, drawn: ContractHouseDraw | null): boolean => {
      if (drawn === null) return false;
      for (const id of drawn.layers) adapters.draw(context, id, { at: drawn.at, body: drawn.body });
      return true;
    },
  };
}

export const contractHouseArt = createContractHouseArt(ART_REGISTRY);
