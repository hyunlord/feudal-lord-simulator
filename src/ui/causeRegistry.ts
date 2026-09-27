import { STORAGE_OVERFLOW_COPY } from './storageOverflowCopy.ko';
import { BUILDING_OPERATION_COPY } from './buildingOperationCopy.ko';
import { SEMANTIC_PALETTE } from '../content/palette';
import { CONSTRUCTION_DEADLOCK_COPY } from './constructionDeadlockCopy.ko';
import type { SourceRef } from '../contracts';
import type { BuildingCausePresentation } from './houseProgressModel';
import { CAUSE_REGISTRY_COPY } from './causeRegistryCopy.ko';

export const CAUSE_REGISTRY = {
  operation_paused: { color: SEMANTIC_PALETTE.inkMuted, glyphId: 'operation_paused', glyphText: BUILDING_OPERATION_COPY.glyph, shortLabel: BUILDING_OPERATION_COPY.shortLabel },
  storage_overflow: { color: SEMANTIC_PALETTE.earthDark, glyphId: 'storage_overflow', glyphText: STORAGE_OVERFLOW_COPY.glyph, shortLabel: STORAGE_OVERFLOW_COPY.shortLabel },
  water: { color: SEMANTIC_PALETTE.water, glyphId: 'water', glyphText: CAUSE_REGISTRY_COPY.water.glyphText, shortLabel: CAUSE_REGISTRY_COPY.water.shortLabel },
  bread: { color: SEMANTIC_PALETTE.earthDark, glyphId: 'bread', glyphText: CAUSE_REGISTRY_COPY.bread.glyphText, shortLabel: CAUSE_REGISTRY_COPY.bread.shortLabel },
  delivery: { color: SEMANTIC_PALETTE.inkMuted, glyphId: 'delivery', glyphText: CAUSE_REGISTRY_COPY.delivery.glyphText, shortLabel: CAUSE_REGISTRY_COPY.delivery.shortLabel },
  market: { color: SEMANTIC_PALETTE.gold, glyphId: 'market', glyphText: CAUSE_REGISTRY_COPY.market.glyphText, shortLabel: CAUSE_REGISTRY_COPY.market.shortLabel },
  church: { color: SEMANTIC_PALETTE.ultramarine, glyphId: 'church', glyphText: CAUSE_REGISTRY_COPY.church.glyphText, shortLabel: CAUSE_REGISTRY_COPY.church.shortLabel },
  wall: { color: SEMANTIC_PALETTE.stoneDark, glyphId: 'wall', glyphText: CAUSE_REGISTRY_COPY.wall.glyphText, shortLabel: CAUSE_REGISTRY_COPY.wall.shortLabel },
  workers: { color: SEMANTIC_PALETTE.vermilion, glyphId: 'workers', glyphText: CAUSE_REGISTRY_COPY.workers.glyphText, shortLabel: CAUSE_REGISTRY_COPY.workers.shortLabel },
  construction_access: { color: SEMANTIC_PALETTE.vermilion, glyphId: 'construction_access', glyphText: CAUSE_REGISTRY_COPY.construction_access.glyphText, shortLabel: CAUSE_REGISTRY_COPY.construction_access.shortLabel },
  reserve_deadlock: { color: SEMANTIC_PALETTE.vermilion, glyphId: 'reserve_deadlock', glyphText: CAUSE_REGISTRY_COPY.reserve_deadlock.glyphText, shortLabel: CONSTRUCTION_DEADLOCK_COPY.shortLabel },
} as const;
export type CauseId = keyof typeof CAUSE_REGISTRY;
export type CauseDetail = Readonly<{
  causeId: CauseId;
  requirement: 'water' | 'bread' | 'granary' | 'market' | 'church' | 'protected' | 'production';
  reason: string;
  label: string;
  providerId?: string;
  used?: number;
  capacity?: number;
  distance?: number;
  /** Where the cause comes from (shared `SourceRef` contract). Today: the diagnosed building only. */
  sources: readonly SourceRef[];
}>;

/** Map marker severity (UX1): ▲ `block` needs the player now, ◆ `warn` is a caution. */
export type CauseMarkerSeverity = 'block' | 'warn';
/** Blockers the settlement clears by itself (a distributor already on its way): nothing for the player to do. */
const WAITING_REASONS: ReadonlySet<string> = new Set(['awaiting_delivery']);

/**
 * The map marker for a building's first cause, or null when that cause needs no player action. Immediate: a house
 * about to lose its level, a facility that stopped working. Caution: a house held below its next level, a facility
 * the player paused on purpose.
 */
export function causeMarkerSeverity(cause: BuildingCausePresentation): CauseMarkerSeverity | null {
  if ((cause.status !== 'blocked' && cause.status !== 'risk') || cause.blocker === null) return null;
  if (WAITING_REASONS.has(cause.blocker.reason)) return null;
  if (cause.status === 'risk') return 'block';
  if ('currentLevel' in cause) return 'warn';
  return cause.blocker.reason === 'paused' ? 'warn' : 'block';
}
