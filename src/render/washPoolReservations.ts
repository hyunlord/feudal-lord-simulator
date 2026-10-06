import { constructionArtLayers } from './constructionArtAssets';
import { fittedBuildingSpriteRect, isFittedSpriteKey } from './buildingSpriteFit';
import { buildingSpriteKey } from './buildingSprites';
import { spriteMetaView } from './worldAssets';
import { palisadeScreenPath } from './palisadeRenderGeometry';
import type { GameState } from '../engine/engine.types';
import type { ArtRect } from './art/artContract';
import { groundBoundaryScene, type GroundBoundaryScene } from './groundBoundaryScene';
import { historicalFacilitySpriteRect } from './historicalFacilityAssets';
import { historicalHouseAssetMeta, historicalHouseSpriteRect } from './historicalHouseAssets';
import { farmProps } from './farmProps';
import { ZONE_ASSETS, ZONE_VARIANTS } from './zoneAssetManifest';
import { hurdleAssetKey } from './hurdleArt';
import { tileToScreen } from './iso';
import { ART_REGISTRY } from './art/wave42Registry';
import type { BoundaryBounds } from '../world/boundary/boundaryGeometry';

function groundBox(bounds: BoundaryBounds): ArtRect {
  const points = [tileToScreen(bounds.left, bounds.top), tileToScreen(bounds.right, bounds.top), tileToScreen(bounds.left, bounds.bottom), tileToScreen(bounds.right, bounds.bottom)];
  const x = Math.min(...points.map(p => p.sx)), y = Math.min(...points.map(p => p.sy));
  return { x, y, width: Math.max(...points.map(p => p.sx)) - x, height: Math.max(...points.map(p => p.sy)) - y };
}
/** Conservative screen rectangles reserve existing pictures, including possible spring flock companions. */
export function washPoolReservations(state: GameState, scene: GroundBoundaryScene = groundBoundaryScene(state)): readonly ArtRect[] {
  const boxes: ArtRect[] = [...scene.grounds.yards, ...scene.grounds.aprons].map(p => groundBox(p.bounds));
  for (const building of state.buildings) {
    const meta = building.kind === 'house' ? historicalHouseAssetMeta(state.houses.find(h => h.buildingId === building.id)?.level ?? 0) : null;
    const box = meta ? historicalHouseSpriteRect(building, meta) : historicalFacilitySpriteRect(building, state);
    if (box) boxes.push(box);
    else {
      const key = buildingSpriteKey(building, 0), sprite = spriteMetaView(key);
      if (isFittedSpriteKey(key)) boxes.push(fittedBuildingSpriteRect(key, building));
      else if (sprite) {
        const at = tileToScreen(building.tx, building.ty), scale = sprite.renderScale;
        boxes.push({ x: at.sx - sprite.anchor.x * scale, y: at.sy - sprite.anchor.y * scale, width: sprite.width * scale, height: sprite.height * scale });
      }
    }
  }
  // Match the completed wall renderer's conservative raster envelope, including gate towers.
  for (const segment of state.palisade?.segments ?? []) {
    const points = palisadeScreenPath(segment.edgePath); if (!points.length) continue;
    const left = Math.min(...points.map(p => p.x)) - 96, top = Math.min(...points.map(p => p.y)) - 128;
    boxes.push({ x: left, y: top, width: Math.max(...points.map(p => p.x)) + 96 - left, height: Math.max(...points.map(p => p.y)) + 48 - top });
  }
  // Reserve every construction stage, so advancing its progress cannot engulf a pool.
  for (const site of state.constructionSites) boxes.push(...constructionArtLayers(site, 'roof'));
  for (const chain of scene.zones.outlines.chains) {
    for (let i = 1; i < chain.points.length; i++) {
      const a = chain.points[i - 1], b = chain.points[i]; if (!a || !b) continue;
      const p = tileToScreen(a.x, a.y), q = tileToScreen(b.x, b.y);
      // 1.6 screen-pixel outline at zoom 0.6, rounded upward in world pixels.
      boxes.push({ x: Math.min(p.sx, q.sx) - 2, y: Math.min(p.sy, q.sy) - 2, width: Math.abs(p.sx - q.sx) + 4, height: Math.abs(p.sy - q.sy) + 4 });
    }
  }
  for (const hurdle of scene.yardProps.hurdles) {
    const meta = ZONE_ASSETS.find(e => e.key === hurdleAssetKey(hurdle));
    if (!meta || !('anchorX' in meta) || !('displayWidth' in meta)) continue;
    const at = tileToScreen(hurdle.anchor.x, hurdle.anchor.y), scale = meta.displayWidth / meta.width;
    const pivot = hurdle.mirror ? meta.width - meta.anchorX : meta.anchorX;
    boxes.push({ x: at.sx - pivot * scale, y: at.sy - meta.anchorY * scale, width: meta.displayWidth, height: meta.height * scale });
  }
  const companion = ART_REGISTRY.entries('ground-prop').filter(e => e.kind === 'ground-prop' && e.placement === 'spring-context' && e.role === 'ewe-lamb');
  const reach = Math.max(0, ...companion.map(e => 'geometry' in e ? e.image.width * e.geometry.scale + 4 : 0));
  const above = Math.max(0, ...companion.map(e => 'geometry' in e ? e.geometry.pivot.y * e.geometry.scale : 0));
  const below = Math.max(0, ...companion.map(e => 'geometry' in e ? (e.image.height - e.geometry.pivot.y) * e.geometry.scale : 0));
  for (const prop of [...farmProps(state), ...scene.zones.props]) {
    const meta = ZONE_ASSETS.find(e => e.key === prop.kind);
    if (!meta || !('anchorX' in meta) || !('displayWidth' in meta)) continue;
    const at = tileToScreen(prop.x, prop.y), scale = meta.displayWidth / meta.width * ('scale' in prop ? prop.scale : 1);
    const padding = (ZONE_VARIANTS.sheepFlock as readonly string[]).includes(prop.kind) ? reach : 0;
    const top = Math.max(meta.anchorY * scale, padding ? above : 0), bottom = Math.max((meta.height - meta.anchorY) * scale, padding ? below : 0);
    boxes.push({ x: at.sx - ('flip' in prop && prop.flip ? meta.width - meta.anchorX : meta.anchorX) * scale - padding, y: at.sy - top,
      width: meta.width * scale + padding * 2, height: top + bottom });
  }
  return boxes;
}
