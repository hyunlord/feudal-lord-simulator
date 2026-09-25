import { STORAGE_OVERFLOW_COPY } from './storageOverflowCopy.ko';
import { BUILDING_OPERATION_COPY } from './buildingOperationCopy.ko';
import { SEMANTIC_PALETTE } from '../content/palette';
import { CONSTRUCTION_DEADLOCK_COPY } from './constructionDeadlockCopy.ko';
import type { SourceRef } from '../contracts';
import type { BuildingCausePresentation } from './houseProgressModel';

export const CAUSE_REGISTRY = {
  operation_paused: { color: SEMANTIC_PALETTE.inkMuted, glyphId: 'operation_paused', glyphText: BUILDING_OPERATION_COPY.glyph, shortLabel: BUILDING_OPERATION_COPY.shortLabel },
  storage_overflow: { color: SEMANTIC_PALETTE.earthDark, glyphId: 'storage_overflow', glyphText: STORAGE_OVERFLOW_COPY.glyph, shortLabel: STORAGE_OVERFLOW_COPY.shortLabel },
  water: { color: SEMANTIC_PALETTE.water, glyphId: 'water', glyphText: '물', shortLabel: '물' },
  bread: { color: SEMANTIC_PALETTE.earthDark, glyphId: 'bread', glyphText: '빵', shortLabel: '빵' },
  delivery: { color: SEMANTIC_PALETTE.inkMuted, glyphId: 'delivery', glyphText: '길', shortLabel: '도로·운송' },
  market: { color: SEMANTIC_PALETTE.gold, glyphId: 'market', glyphText: '시', shortLabel: '시장' },
  church: { color: SEMANTIC_PALETTE.ultramarine, glyphId: 'church', glyphText: '교', shortLabel: '교회' },
  wall: { color: SEMANTIC_PALETTE.stoneDark, glyphId: 'wall', glyphText: '벽', shortLabel: '성벽' },
  workers: { color: SEMANTIC_PALETTE.vermilion, glyphId: 'workers', glyphText: '일', shortLabel: '일꾼' },
  construction_access: { color: SEMANTIC_PALETTE.vermilion, glyphId: 'construction_access', glyphText: '공', shortLabel: '공사 접근' },
  reserve_deadlock: { color: SEMANTIC_PALETTE.vermilion, glyphId: 'reserve_deadlock', glyphText: '비', shortLabel: CONSTRUCTION_DEADLOCK_COPY.shortLabel },
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
