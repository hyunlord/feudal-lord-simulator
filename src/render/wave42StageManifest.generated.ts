import type { ArtPoint, LandStagePorts } from './art/artContract';
import { ART_REGISTRY } from './art/wave42Registry';

export type Wave42StageKey = string;
export type Wave42StageMeta = {
  readonly url: string; readonly folder: string; readonly season: string;
  readonly kind: 'single' | 'strip' | 'connector'; readonly width: number; readonly height: number;
  readonly pivot: ArtPoint; readonly ports?: LandStagePorts;
};

/** NAT-5 compatibility view of tree, fallow and path art; later yard families have their own consumers. */
export const WAVE42_STAGES: Readonly<Record<string, Wave42StageMeta>> = Object.freeze(Object.fromEntries(
  ART_REGISTRY.entries('land-stage').flatMap(entry => {
    if (entry.kind !== 'land-stage' || !['tree', 'fallow', 'path'].includes(entry.family) || !entry.image.url.startsWith('assets/wave42/')) return [];
    return [[entry.id, Object.freeze({
      url: entry.image.url,
      folder: entry.image.url.split('/')[2] ?? '',
      season: entry.season ?? '',
      kind: entry.layout,
      width: entry.image.width,
      height: entry.image.height,
      pivot: entry.geometry.pivot,
      ...(entry.ports === undefined ? {} : { ports: entry.ports }),
    })]];
  }),
));
