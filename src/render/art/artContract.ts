/** Authored data only. Schema checks structure; registry checks references and geometry bounds. */
export type ArtKind = 'building-body' | 'state-overlay' | 'ground-prop' | 'walker-cargo'
  | 'land-stage' | 'landmark' | 'event-scene' | 'event-illustration' | 'portrait' | 'regional-map' | 'season-variant' | 'ground-texture' | 'weather-shadow';
export type ArtPoint = { readonly x: number; readonly y: number };
export type ArtRect = ArtPoint & { readonly width: number; readonly height: number };
export type ArtImage = { readonly url: string; readonly width: number; readonly height: number };
export type ArtProvenance = {
  readonly inboxFile: string;
  readonly sourceSha256: string;
  readonly runtimeSha256: string;
};
export type ArtGeometry = {
  readonly pivot: ArtPoint;
  /** Uniform world pixels per source pixel; never an independent axis stretch. */
  readonly scale: number;
  readonly crop?: ArtRect;
  /** Logical tile dimensions, not source pixels. */
  readonly footprint?: { readonly width: number; readonly height: number };
  readonly allowMirror: false;
};
export type ArtFrame = { readonly sourceRect: ArtRect; readonly pivot: ArtPoint; readonly durationMs: number };
export type ArtSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type ArtFacing = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type EntryBase = { readonly id: string; readonly image: ArtImage; readonly provenance: ArtProvenance };
type WorldEntry = EntryBase & { readonly geometry: ArtGeometry; readonly season?: ArtSeason; readonly facing?: ArtFacing };
export type BuildingBodyEntry = WorldEntry & {
  readonly kind: 'building-body'; readonly buildingKinds: readonly string[];
  readonly levels: readonly number[]; readonly variantId: string;
};
export type StateOverlayEntry = WorldEntry & {
  readonly kind: 'state-overlay'; readonly targetBodyIds: readonly string[];
  readonly layer: 'snow' | 'boarded' | 'worn' | 'wealth' | 'era';
  readonly transform: 'inherit-body'; readonly order: number;
};
export type ArtRange = { readonly min: number; readonly max?: number } | { readonly min?: number; readonly max: number };
export type HouseholdGroundPropEntry = WorldEntry & {
  readonly kind: 'ground-prop'; readonly archetypes: readonly string[]; readonly occupations: readonly string[];
  readonly placement: 'front-yard' | 'back-yard' | 'yard' | 'street' | 'frontage'; readonly wealthRange?: ArtRange;
};
export type LandGroundPropEntry = EntryBase & {
  readonly kind: 'ground-prop'; readonly placement: 'land'; readonly baseId: string;
  readonly archetypes: readonly string[]; readonly geometry: ArtGeometry; readonly season?: ArtSeason;
};
export type GroundPropEntry = HouseholdGroundPropEntry | LandGroundPropEntry;
export type WalkerCargoEntry = EntryBase & {
  readonly kind: 'walker-cargo'; readonly cargoKinds: readonly string[];
  readonly frames: readonly ArtFrame[]; readonly facing: ArtFacing; readonly scale: number; readonly allowMirror: false;
} & (
  | { readonly role: 'cargo'; readonly attachment: { readonly anchor: 'grip'; readonly pivot: ArtPoint } }
  | { readonly role: 'walker'; readonly attachment: { readonly anchor: 'foot'; readonly pivot: ArtPoint } }
);
/** Source-pixel endpoints; connectivity masks are selector facts, never port coordinates. */
export type LandStagePorts = {
  readonly SW?: ArtPoint; readonly NW?: ArtPoint; readonly SE?: ArtPoint; readonly NE?: ArtPoint;
  readonly start?: ArtPoint; readonly end?: ArtPoint;
};
export type LandStageEntry = WorldEntry & {
  readonly kind: 'land-stage'; readonly family: string; readonly stage: string;
} & (
  | { readonly layout: 'single'; readonly ports?: LandStagePorts }
  | { readonly layout: 'strip'; readonly ports: { readonly start: ArtPoint; readonly end: ArtPoint } }
  | { readonly layout: 'connector'; readonly ports: Pick<LandStagePorts, 'SW' | 'NW' | 'SE' | 'NE'> }
);
export type LandmarkEntry = WorldEntry & {
  readonly kind: 'landmark'; readonly family: string; readonly growthStage: string;
  readonly expansion: 'none' | 'approved-footprint';
};
export type EventSceneEntry = WorldEntry & {
  readonly kind: 'event-scene'; readonly eventIds: readonly string[]; readonly group: string;
  readonly placement: 'target' | 'building' | 'road';
  /** Visual lifetime only. This does not create or extend an engine event. */
  readonly duration: { readonly mode: 'while-active' } | { readonly mode: 'visual-ms'; readonly milliseconds: number };
  readonly frames?: readonly ArtFrame[];
};
export type EventIllustrationEntry = EntryBase & {
  readonly kind: 'event-illustration'; readonly eventIds: readonly string[];
  readonly fit: 'contain' | 'cover'; readonly altTextKey: string;
};
export type PortraitEntry = EntryBase & {
  readonly kind: 'portrait'; readonly pool: string; readonly personIds?: readonly string[];
  readonly lineage?: string; readonly ageStage: string; readonly era: string;
  readonly derivatives: readonly { readonly size: 96 | 256; readonly assetId: string }[];
};
export type RegionalMapEntry = EntryBase & {
  readonly kind: 'regional-map'; readonly mapId: string; readonly landTypes: readonly string[];
  readonly coordinateSpace: { readonly width: number; readonly height: number };
  readonly slots: readonly (ArtPoint & { readonly id: string; readonly landType: string })[];
};
export type SeasonVariantEntry = EntryBase & {
  readonly kind: 'season-variant';
  readonly base: { readonly namespace: 'world-sprite' | 'zone-prop'; readonly key: string };
  readonly season: ArtSeason; readonly geometry: Pick<ArtGeometry, 'pivot' | 'scale' | 'allowMirror'>;
};
export type FieldGroundTextureEntry = EntryBase & {
  readonly kind: 'ground-texture';
  readonly mapping: { readonly repeat: 'x'; readonly sourcePixelsPerTile: 128; readonly origin: { readonly x: 0; readonly y: 0 } };
  readonly composition: { readonly joinFadeSourcePx: 40; readonly wash: 'legacy-stage' | 'none' };
  readonly allowMirror: false;
};
export type RegionGroundTextureEntry = EntryBase & {
  readonly kind: 'ground-texture'; readonly baseId: string;
  readonly mapping: { readonly repeat: 'xy'; readonly sourcePixelsPerTile: { readonly u: 128; readonly v: 64 }; readonly origin: { readonly x: 0; readonly y: 0 } };
  readonly composition: { readonly wash: 'none' }; readonly allowMirror: false;
};
export type WeatherShadowEntry = EntryBase & {
  readonly kind: 'weather-shadow'; readonly deck: 'lower' | 'upper'; readonly blend: 'multiply'; readonly opacityMax: 0.12;
  readonly geometry: { readonly pivot: ArtPoint; readonly scale: 1; readonly allowMirror: false };
};
export type GroundTextureEntry = FieldGroundTextureEntry | RegionGroundTextureEntry;
export function isFieldTexture(entry: ArtEntry): entry is FieldGroundTextureEntry { return entry.kind === 'ground-texture' && entry.mapping.repeat === 'x'; }
export function isRegionTexture(entry: ArtEntry): entry is RegionGroundTextureEntry { return entry.kind === 'ground-texture' && entry.mapping.repeat === 'xy'; }
export type ArtEntry = BuildingBodyEntry | StateOverlayEntry | GroundPropEntry | WalkerCargoEntry | LandStageEntry
  | LandmarkEntry | EventSceneEntry | EventIllustrationEntry | PortraitEntry | RegionalMapEntry | SeasonVariantEntry | GroundTextureEntry | WeatherShadowEntry;
export type ArtScalar = string | number | boolean;
export type ArtCondition =
  | { readonly op: 'eq'; readonly field: string; readonly value: ArtScalar }
  | { readonly op: 'in'; readonly field: string; readonly values: readonly ArtScalar[] }
  | ({ readonly op: 'range'; readonly field: string } & ArtRange);
export type ArtVariant = { readonly assetId: string; readonly weight: number };
export type ArtRule = {
  readonly id: string; readonly kind: ArtKind; readonly slot: string; readonly priority: number;
  /** All predicates must match; an empty list is unconditional. Higher priority wins. */
  readonly conditions: readonly ArtCondition[]; readonly variants: readonly ArtVariant[]; readonly fallback: 'none';
};
export type ArtBundle = {
  readonly schemaVersion: 1; readonly bundleId: string;
  readonly entries: readonly ArtEntry[]; readonly rules: readonly ArtRule[];
};
