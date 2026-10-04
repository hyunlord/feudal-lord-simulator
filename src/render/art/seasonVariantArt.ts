import type { ArtSeason, SeasonVariantEntry } from './artContract';
import type { ArtRegistry } from './artRegistry';
import { ART_REGISTRY } from './wave42Registry';

export type SeasonVariantMeta = {
  readonly url: string; readonly width: number; readonly height: number;
  readonly bases: readonly string[]; readonly season: ArtSeason;
};
const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
/** Image substitution only: base registration and draw geometry stay with the existing consumer. */
export function createSeasonVariantArt(registry: ArtRegistry) {
  const entries = registry.entries('season-variant').filter((entry): entry is SeasonVariantEntry => entry.kind === 'season-variant');
  const ids: ReadonlySet<string> = new Set(entries.map(entry => entry.id));
  const images: Readonly<Record<string, SeasonVariantMeta>> = Object.fromEntries(entries.map(entry => [entry.id, {
    ...entry.image, bases: [entry.base.key], season: entry.season,
  }]));
  /** Keep legacy negative/fractional salt mapping; nonfinite and unsafe integers have no variant. */
  const select = (baseKey: string, season: 0 | 1 | 2 | 3, salt: number): string | null => {
    const seed = Math.abs(Math.trunc(salt));
    if (!Number.isSafeInteger(seed)) return null;
    return registry.select('season-variant', 'season-replacement', { baseKey, season: SEASONS[season] }, seed)?.id ?? null;
  };
  return { entries, ids, images, select };
}
const seasonal = createSeasonVariantArt(ART_REGISTRY);
export const SEASON_VARIANT_ENTRIES = seasonal.entries;
export const SEASON_VARIANT_IDS = seasonal.ids;
export const SEASON_VARIANT_IMAGES = seasonal.images;
export const selectSeasonVariant = seasonal.select;

export class SeasonVariantError extends Error {}
/** The legacy facade owns raw decal keys; a contract must not silently shadow one. */
export function mergeSeasonImages<T extends Readonly<Record<string, { readonly url: string; readonly width: number; readonly height: number }>>>(legacy: T): T & Readonly<Record<string, SeasonVariantMeta | T[keyof T]>> {
  for (const id of Object.keys(SEASON_VARIANT_IMAGES)) {
    if (Object.hasOwn(legacy, id)) throw new SeasonVariantError(`Duplicate legacy/contract season key: ${id}`);
  }
  return Object.freeze(Object.assign({}, SEASON_VARIANT_IMAGES, legacy));
}
