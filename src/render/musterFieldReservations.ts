import type { GameState } from '../engine/engine.types';
import { stateCalendar } from '../engine/scenarioState';
import type { ArtRect } from './art/artContract';
import { countrysideOf } from './countrysideLayout';
import { pieceBlit, stripBlits, type CountryBlit } from './countrysideArt';
import { warProps } from './warWorldProps';
import { WAVE17_WORLD_IMAGES } from './wave17WorldManifest.generated';
import { tileToScreen } from './iso';
import { washPoolReservations } from './washPoolReservations';
import { facilityGroundProps, washPoolBox } from './washPoolPlacement';
import { FACILITY_GROUND_ENTRIES } from './washPoolArt';
import { ART_REGISTRY } from './art/wave42Registry';
import { isSpringWorldEntry, springWorldSlot } from './art/springWorldValidation';
import { springWorldProps } from './springWorldProps';
import { buildGroundCover } from './groundCoverLayout';
import { spriteMetaView } from './worldAssets';
import { worldFireProps } from './worldFireProps';

function blitBox(blit: CountryBlit): ArtRect {
  const [a, b, c, d, e, f] = blit.m;
  const points = [[0, 0], [blit.source.width, 0], [0, blit.source.height], [blit.source.width, blit.source.height]].map(([x, y]) => ({ x: a * x! + c * y! + e, y: b * x! + d * y! + f }));
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}
/** Whole painted envelopes, independent of viewport, draw readiness and zoom. */
export function musterFieldReservations(state: GameState): readonly ArtRect[] {
  const boxes = [...washPoolReservations(state)], country = countrysideOf(state), season = stateCalendar(state).season;
  // Reserve even potentially hidden cover: changing a nearby road/yard must not reveal a shrub through this scene.
  for (const tile of state.tiles) for (const cover of buildGroundCover({ tile, seed: state.seed })) {
    const meta = spriteMetaView(cover.spriteKey); if (!meta) continue;
    const scale = meta.renderScale * cover.scale;
    boxes.push({ x: cover.x - meta.anchor.x * scale, y: cover.y - meta.anchor.y * scale, width: meta.width * scale, height: meta.height * scale });
  }
  for (const p of [...country.props, ...country.fields]) boxes.push(blitBox(pieceBlit(p, season)));
  for (const p of country.strips) for (const blit of stripBlits(p, season)) boxes.push(blitBox(blit));
  for (const p of warProps(state)) {
    const m = WAVE17_WORLD_IMAGES[p.kind], at = tileToScreen(p.x, p.y), scale = m.zoom1Scale;
    boxes.push({ x: at.sx - m.pivot.x * scale, y: at.sy - m.pivot.y * scale, width: m.cell.width * scale, height: m.cell.height * scale });
  }
  for (const p of facilityGroundProps(state, FACILITY_GROUND_ENTRIES)) {
    const entry = FACILITY_GROUND_ENTRIES.find(e => e.id === p.assetId);
    if (entry) boxes.push(washPoolBox(entry, p.tx, p.ty));
  }
  const spring = springWorldProps(state, (role, seed, group = 'all') => {
    const entry = ART_REGISTRY.select('ground-prop', springWorldSlot(role), { placement: 'spring-context', season: 'spring', role, group }, seed);
    return isSpringWorldEntry(entry) ? entry : null;
  });
  const fires = worldFireProps(state, (s, eventId, role) => {
    const entry = ART_REGISTRY.select('event-scene', role === 'bucket-brigade' ? 'fire-brigade' : 'fire-flame', { eventId, group: role, active: true, season: stateCalendar(s).season === 3 ? 'winter' : 'summer' }, s.seed);
    return entry?.kind === 'event-scene' ? entry : null;
  });
  for (const p of [...spring, ...fires]) {
    const entry = ART_REGISTRY.entry(p.assetId); if (!entry || !('geometry' in entry)) continue;
    const at = tileToScreen(p.tx, p.ty), { pivot, scale } = entry.geometry;
    boxes.push({ x: at.sx - pivot.x * scale, y: at.sy - pivot.y * scale, width: entry.image.width * scale, height: entry.image.height * scale });
  }
  return boxes;
}
