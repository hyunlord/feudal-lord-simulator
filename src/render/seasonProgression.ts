import type { GameState } from '../engine/engine.types';
import { calendarProgress, type CalendarProgress } from './calendarProgress';
import profiles from './seasonProgression.json';
import { SEASON_VARIANT_IMAGES } from './art/seasonVariantArt';

type Window = { readonly start: number; readonly end: number; readonly jitter: number };
type WinterStage = { readonly bare: string | null; readonly snow: string | null };
const WINTER_TREE_BASES = new Set(Object.values(SEASON_VARIANT_IMAGES)
  .filter(image => image.season === 'winter').flatMap(image => image.bases).filter(base => base.startsWith('tree_')));
export type ProgressionProfiles = { readonly schemaVersion: 1; readonly winterStages: Readonly<Record<string, WinterStage>>; readonly roofSnow: Window; readonly springMelt: Window;
  readonly treeSpring: Window; readonly treeSummer: Window; readonly treeAutumn: Window; readonly treeBare: Window; readonly treeSnow: Window; readonly firstFrost: Window; readonly fenceSnow: Window };
/** Timing only: image IDs, geometry, readiness and URLs remain in the existing art registry. */
export function parseProgressionProfiles(value: unknown): ProgressionProfiles | null {
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value) || value.schemaVersion !== 1) return null;
  if (!('winterStages' in value) || typeof value.winterStages !== 'object' || value.winterStages === null || Array.isArray(value.winterStages)) return null;
  if (Object.keys(value.winterStages).length !== WINTER_TREE_BASES.size) return null;
  const winterStages: Record<string, WinterStage> = {};
  for (const [base, row] of Object.entries(value.winterStages)) {
    if (!WINTER_TREE_BASES.has(base)) return null;
    if (typeof row !== 'object' || row === null || !('bare' in row) || !('snow' in row)) return null;
    const bare: unknown = row.bare, snow: unknown = row.snow;
    if (bare === null && snow === null) return null;
    if (bare !== null && typeof bare !== 'string' || snow !== null && typeof snow !== 'string') return null;
    for (const id of [bare, snow]) {
      if (id !== null && (!SEASON_VARIANT_IMAGES[id]?.bases.includes(base) || SEASON_VARIANT_IMAGES[id]?.season !== 'winter')) return null;
    }
    winterStages[base] = { bare, snow };
  }
  const read = (key: string): Window | null => {
    if (!(key in value)) return null;
    const item: unknown = Reflect.get(value, key);
    if (typeof item !== 'object' || item === null || !('start' in item) || !('end' in item) || !('jitter' in item)) return null;
    const { start, end, jitter } = item;
    if (typeof start !== 'number' || typeof end !== 'number' || typeof jitter !== 'number' ||
      !Number.isFinite(start + end + jitter) || start < 0 || end > 1 || end <= start || jitter < 0 || jitter >= end - start) return null;
    return { start, end, jitter };
  };
  const roofSnow = read('roofSnow'), springMelt = read('springMelt'), treeSpring = read('treeSpring'), treeSummer = read('treeSummer');
  const treeAutumn = read('treeAutumn'), treeBare = read('treeBare'), treeSnow = read('treeSnow');
  const firstFrost = read('firstFrost'), fenceSnow = read('fenceSnow');
  if (!firstFrost || !fenceSnow || !roofSnow || !springMelt || !treeSpring || !treeSummer || !treeAutumn || !treeBare || !treeSnow || treeBare.end > treeSnow.start) return null;
  return { schemaVersion: 1, winterStages, roofSnow, springMelt, treeSpring, treeSummer, treeAutumn, treeBare, treeSnow, firstFrost, fenceSnow };
}
const PROFILES = parseProgressionProfiles(profiles);
export function treeWinterVariant(base: string, snowy: boolean): string | null | undefined {
  const row = PROFILES?.winterStages[base];
  return row === undefined ? undefined : snowy ? row.snow : row.bare;
}
export function objectPhase(identity: string, domain: string): number {
  let hash = 2166136261;
  for (const char of `${domain}:${identity}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}
function ramp(fraction: number, window: Window, phase: number): number {
  const start = window.start + window.jitter * phase;
  return Math.max(0, Math.min(1, (fraction - start) / (window.end - start)));
}
export function roofSnowAlpha(state: Pick<GameState, 'tick' | 'scenarioId'>, building: { readonly tx: number; readonly ty: number; readonly id?: string }): number {
  const progress = calendarProgress(state);
  if (PROFILES === null) return progress.season === 3 ? 1 : 0;
  const phase = objectPhase(`${building.id ?? ''}:${building.tx}:${building.ty}`, 'roof');
  switch (progress.season) {
    case 0: return progress.year === calendarProgress({ ...state, tick: 0 }).year ? 0 : 1 - ramp(progress.fraction, PROFILES.springMelt, phase);
    case 1: case 2: return 0;
    case 3: return ramp(progress.fraction, PROFILES.roofSnow, phase);
  }
}
/** One complete painting per tree; phase differs by stable world identity, never camera or wall clock. */
export function treeProgression(progress: CalendarProgress, identity: string, firstYear = false): { readonly season: 0 | 1 | 2 | 3; readonly snowy: boolean } {
  if (PROFILES === null || firstYear && progress.season === 0) return { season: progress.season, snowy: progress.season === 3 };
  const phase = objectPhase(identity, 'tree');
  const changed = (window: Window) => progress.fraction >= window.start + phase * (window.end - window.start);
  switch (progress.season) {
    case 0: return { season: changed(PROFILES.treeSpring) ? 0 : 3, snowy: !changed(PROFILES.springMelt) };
    case 1: return { season: changed(PROFILES.treeSummer) ? 1 : 0, snowy: false };
    case 2: return { season: changed(PROFILES.treeAutumn) ? 2 : 1, snowy: false };
    case 3: return { season: changed(PROFILES.treeBare) ? 3 : 2, snowy: changed(PROFILES.treeSnow) };
  }
}

/** Ground overlays keep their own stable phase while sharing the calendar and spring melt. */
export function groundWinterAlpha(state: Pick<GameState, 'tick' | 'scenarioId'>, identity: string, kind: 'frost' | 'drift'): number {
  const progress = calendarProgress(state);
  if (PROFILES === null) return progress.season === 3 ? 1 : 0;
  const phase = objectPhase(identity, kind);
  if (progress.season === 0) return progress.year === calendarProgress({ ...state, tick: 0 }).year ? 0 : 1 - ramp(progress.fraction, PROFILES.springMelt, phase);
  if (kind === 'frost') return progress.season === 2 ? ramp(progress.fraction, PROFILES.firstFrost, phase) : progress.season === 3 ? 1 : 0;
  return progress.season === 3 ? ramp(progress.fraction, PROFILES.fenceSnow, phase) : 0;
}
