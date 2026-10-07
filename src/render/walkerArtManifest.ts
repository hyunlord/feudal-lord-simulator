import type { ArtPoint, ArtRect, WalkerArtDirection, WalkerBodyFrame } from './art/artContract';
import { ART_REGISTRY } from './art/wave42Registry';
import { createWalkerArt } from './art/walkerArt';
import { ArtAdapterError } from './art/artAdapters';
import { walkerSheetManifest as legacySheets, walkerPropManifest as legacyProps, walkerCloakManifest } from './walkerSheetManifest.generated';

export { walkerCloakManifest };
export type WalkerSheet = {
  readonly id: string; readonly url: string; readonly width: number; readonly height: number; readonly sha256: string;
  readonly classBand: string; readonly sex: 'male' | 'female'; readonly occupationTags: readonly string[];
  readonly legacy: boolean; readonly holdsTool: boolean; readonly template: string; readonly season: string;
  readonly directionOrder: readonly WalkerArtDirection[]; readonly cloak: keyof typeof walkerCloakManifest | null;
  readonly cloakPoke: number | null; readonly frames: readonly WalkerBodyFrame[];
  readonly propVariants?: readonly { readonly slot: string; readonly propId: string }[];
};
export type WalkerProp = {
  readonly url: string; readonly anchor: ArtPoint; readonly role: string; readonly scale?: number;
  readonly sha256?: string; readonly opaqueBounds?: ArtRect; readonly referenceFigureHeight?: number;
  readonly walkerPoint?: ArtPoint; readonly cell?: number; readonly sheetWidth?: number;
};
export type WalkerPropDirections = Readonly<Record<WalkerArtDirection, WalkerProp>>;
const art = createWalkerArt(ART_REGISTRY);
export const walkerSheetManifest: readonly WalkerSheet[] = [
  ...legacySheets,
  ...art.bodies.map(entry => ({ id: entry.id, ...entry.image, sha256: entry.provenance.runtimeSha256, ...entry.registration })),
];
const registeredProps = new Map<string, Map<WalkerArtDirection, WalkerProp>>();
for (const entry of art.props) {
  const directions = registeredProps.get(entry.propId) ?? new Map<WalkerArtDirection, WalkerProp>();
  directions.set(entry.direction, { url: entry.image.url, anchor: entry.anchor, role: entry.role,
    scale: entry.scale, sha256: entry.provenance.runtimeSha256, opaqueBounds: entry.opaqueBounds,
    ...(entry.referenceFigureHeight === undefined ? {} : { referenceFigureHeight: entry.referenceFigureHeight }) });
  registeredProps.set(entry.propId, directions);
}
const registeredManifest: Readonly<Record<string, WalkerPropDirections>> = Object.fromEntries([...registeredProps].map(([id, directions]) => {
  const NE = directions.get('NE'); const SE = directions.get('SE');
  const SW = directions.get('SW'); const NW = directions.get('NW');
  if (!NE || !SE || !SW || !NW) throw new ArtAdapterError(`Incomplete walker prop family ${id}`);
  return [id, { NE, SE, SW, NW }];
}));
export const walkerPropManifest: Readonly<Record<string, WalkerPropDirections>> = { ...legacyProps, ...registeredManifest };
export function walkerPropDirections(id: string): WalkerPropDirections {
  const directions = walkerPropManifest[id];
  if (!Object.hasOwn(walkerPropManifest, id) || directions === undefined) throw new ArtAdapterError(`Unknown walker prop ${id}`);
  return directions;
}
