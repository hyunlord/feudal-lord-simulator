import type { Building } from '../content/buildingConfig';
import type { GameState } from '../engine/engine.types';
import type { ContractHouseDraw } from './art/contractHouseArt';
import masks from './art/natureRoofMasks.json';
import { NATURE_ART } from './art/natureArt';
import { autumnAccumulation, calendarProgress } from './calendarProgress';
import { presentationPreference } from './presentationPreferences';
import { rainContactAge } from './natureContacts';
import { mix } from './weatherPlacement';

/** A conservative subset of each registered roof: opaque ink from that body's declared snow overlay. */
export function roofContactDomain(drawn: ContractHouseDraw) {
  const mask = masks.find(row => row.bodyIds.includes(drawn.body.bodyId));
  if (mask === undefined) return null;
  const source = drawn.body.sourceRect, target = drawn.body.targetRect;
  const kx = target.width / source.width, ky = target.height / source.height;
  const spans = mask.spans.flatMap(span => {
    const [x, y, width, height] = span;
    if (x === undefined || y === undefined || width === undefined || height === undefined) return [];
    const left = Math.max(x, source.x), top = Math.max(y, source.y);
    const right = Math.min(x + width, source.x + source.width), bottom = Math.min(y + height, source.y + source.height);
    return right <= left || bottom <= top ? [] : [{ x: target.x + (left - source.x) * kx, y: target.y + (top - source.y) * ky, width: (right - left) * kx, height: (bottom - top) * ky }];
  });
  return spans.length === 0 ? null : spans;
}
/** Called after the actual body in object order. Unregistered bodies receive no invented roof geometry. */
export function drawNatureRoof(context: CanvasRenderingContext2D, state: GameState, building: Building, drawn: ContractHouseDraw | null): void {
  if (drawn === null || building.kind !== 'house') return;
  const domain = roofContactDomain(drawn);
  if (domain === null) return;
  // The caller's existing props LOD gate owns visibility; CTM scale also includes DPR.
  const zoom = 1;
  const hash = mix(state.seed, building.tx, building.ty, 39361);
  const anchor = domain[hash % domain.length];
  if (anchor === undefined) return;
  const x = anchor.x + anchor.width / 2, y = anchor.y + anchor.height / 2;
  const amount = autumnAccumulation(calendarProgress(state));
  const leaves = presentationPreference('seasonFx') && amount > 0 ? NATURE_ART.resolve('leaf-roof') : null;
  const age = rainContactAge(state, x, y, hash);
  const splashes = age === null ? null : NATURE_ART.resolve('splash');
  context.save();
  try {
    context.beginPath();
    for (const span of domain) context.rect(span.x, span.y, span.width, span.height);
    context.clip();
    const leaf = leaves === null ? null : NATURE_ART.select(leaves, 'leaf-roof', 'all', hash);
    if (leaf !== null) NATURE_ART.draw(context, leaf, x, y, zoom, amount);
    const splash = splashes === null ? null : NATURE_ART.select(splashes, 'splash', 'roof', hash);
    if (splash !== null && age !== null) NATURE_ART.draw(context, splash, x, y, zoom, 0.5, age);
  } finally { context.restore(); }
}
