import { registerRuntimeAsset } from "./runtimeAssetCoordinates";
import { drawCroppedWorldSprite } from "./worldSprite";
import type { ConstructionSite } from '../economy/construction';
import { constructionSiteFootprint } from '../economy/construction';
import type { ConstructionRenderSignature } from './constructionStageBands';
import { tileToScreen } from './iso';
import { drawWave7 } from './wave7Art';
import { assetUrlForBase } from './worldAssets';

const FILES = {
  foundation: 'construction_foundation-v1', frame: 'construction_timber_frame-v2',
  roof: 'construction_roof_frame-v1', scaffold: 'construction_scaffold-v2',
  condition: 'condition_decals-v3', dust: 'effect_dust-v1',
  wall: 'construction_wall-v2', salvage: 'construction_salvage-v3', smoke: 'effect_smoke-v1',
} as const;
type ArtKey = keyof typeof FILES;
type RecordEntry = { readonly key: ArtKey; readonly url: string; image: HTMLImageElement | null; status: 'idle' | 'loading' | 'ready' | 'missing' };
const keys: readonly ArtKey[] = ['foundation', 'frame', 'roof', 'scaffold', 'condition', 'dust', 'wall', 'salvage', 'smoke'];
const records: RecordEntry[] = keys.map(key => ({ key, url: assetUrlForBase(`assets/runtime-construction-v1/${FILES[key]}.png`, import.meta.env?.BASE_URL ?? '/'), image: null, status: 'idle' }));
let preload: Promise<void> | null = null;
export function preloadConstructionArtAssets(): Promise<void> {
  if (typeof Image !== 'function') return Promise.resolve();
  preload ??= Promise.all(records.map(record => new Promise<void>(resolve => {
    record.status = 'loading';
    try {
      const image = new Image();
      image.onload = () => {
        record.status = registerRuntimeAsset(image, record.url, 1774, 887) ? 'ready' : 'missing';
        if (record.status === 'ready') record.image = image;
        resolve();
      };
      image.onerror = () => { record.status = 'missing'; resolve(); };
      image.src = record.url;
    } catch (error) {
      record.status = 'missing'; resolve();
      if (!(error instanceof Error)) console.warn('Construction image initialization failed', error);
    }
  }))).then(() => undefined);
  return preload;
}
export function constructionArtAssetStatuses() {
  return records.map(({key, url, status}) => ({key, url, status,
    usage: key === 'wall' || key === 'salvage' || key === 'smoke' ? 'reserved' : 'active',
  }));
}
export const reservedConstructionArt = [
  { key: 'wall', sourceRegions: 'mixed wall-stage components', reason: 'Unregistered multi-part sheet; existing path-stage wall renderer remains authoritative.' },
  { key: 'salvage', sourceRegions: 'single salvage pile', reason: 'Demolition has no persistent physical salvage entity; inventory refunds are not ground piles.' },
  { key: 'smoke', sourceRegions: 'four smoke frames', reason: 'No simulated active fire process exists; never emitted from historical houses.' },
] as const;
export function constructionArtImage(key: ArtKey): HTMLImageElement | null {
  void preloadConstructionArtAssets();
  return records.find(record => record.key === key && record.status === 'ready')?.image ?? null;
}
type Layer = Readonly<{key: ArtKey; x: number; y: number; width: number; height: number}>;

// Each registration uses the painted contact point; transparent canvas margins are retained.
const REGISTRATION = {
  foundation: { span: 1490, contactX: 954, contactY: 845 },
  frame: { span: 1519, contactX: 991, contactY: 865 },
  roof: { span: 1570, contactX: 939, contactY: 850 },
  scaffold: { span: 973, contactX: 1000, contactY: 875 },
} as const;
export function constructionArtLayers(site: ConstructionSite, stage: ConstructionRenderSignature): readonly Layer[] {
  if (stage === 'plot' || site.kind === 'wheat_farm' || site.kind === 'quarry' || site.kind === 'well' || site.kind === 'palisade_segment' || site.kind === 'stone_wall_segment') return [];
  const footprint = constructionSiteFootprint(site);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  const span = (footprint.width + footprint.height) * 27;
  const front = center.sy + (footprint.width + footprint.height) * 7;
  const layer = (key: keyof typeof REGISTRATION, width: number, dx = 0, dy = 0): Layer => {
    const registration = REGISTRATION[key];
    const scale = width / registration.span;
    return { key, x: center.sx + dx - registration.contactX * scale, y: front + dy - registration.contactY * scale, width: 1774 * scale, height: 887 * scale };
  };
  const foundation = layer('foundation', span);
  if (stage === 'foundation') return [foundation];
  const frame = layer('frame', span);
  const scaffold = layer('scaffold', span * 0.30, span * 0.24, -2);
  // The frame is a temporary oak construction structure, including for masonry facilities.
  if (stage === 'frame') return [foundation, frame, scaffold];
  return [foundation, frame, layer('roof', span, 0, -span * 0.18), scaffold];
}
/**
 * INSTALL-7 roof truss size class (visibility design P1 B): 1 x 1 small, 2 x 1 medium, 2 x 2 large, the stone-built
 * 2 x 2s (church, keep) the stone large truss. The truss is drawn at half its canvas (a 128 px small truss over a
 * 64 px tile), its base plate's front on the timber frame's eaves line (TRUSS_LIFT of the footprint span above the
 * front vertex).
 */
export function roofTrussFor(site: ConstructionSite): 'roof_frame_small' | 'roof_frame_medium' | 'roof_frame_large' | 'roof_frame_stone_large' {
  const footprint = constructionSiteFootprint(site);
  const area = footprint.width * footprint.height;
  if (area >= 4) return site.kind === 'church' || site.kind === 'keep' ? 'roof_frame_stone_large' : 'roof_frame_large';
  return area >= 2 ? 'roof_frame_medium' : 'roof_frame_small';
}
const TRUSS_SCALE = 0.5;
const TRUSS_LIFT = 0.62;
function drawRoofTruss(context: CanvasRenderingContext2D, site: ConstructionSite): boolean {
  const footprint = constructionSiteFootprint(site);
  const center = tileToScreen(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
  const span = (footprint.width + footprint.height) * 27;
  const front = center.sy + (footprint.width + footprint.height) * 7;
  return drawWave7(context, roofTrussFor(site), center.sx, front - span * TRUSS_LIFT, TRUSS_SCALE * (footprint.width + footprint.height) / 2 / (roofTrussFor(site) === 'roof_frame_small' ? 1 : roofTrussFor(site) === 'roof_frame_medium' ? 1.5 : 2));
}

export function drawConstructionArt(context: CanvasRenderingContext2D, site: ConstructionSite, stage: ConstructionRenderSignature): boolean {
  const layers = constructionArtLayers(site, stage);
  if (layers.length === 0 || layers.some(layer => constructionArtImage(layer.key) === null)) return false;
  context.save();
  context.imageSmoothingEnabled = true;
  for (const layer of layers) {
    // INSTALL-7: the roof stage's truss by the building's size class (Wave 7); the generic roof frame stands in.
    if (layer.key === 'roof' && drawRoofTruss(context, site)) continue;
    const image = constructionArtImage(layer.key);
    if (image !== null) drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: 1774, height: 887 }, layer, false, true);
  }
  context.restore();
  return true;
}
