import { SEMANTIC_PALETTE } from '../content/palette';
import { CONSTRUCTION_DEADLOCK_COPY } from './constructionDeadlockCopy.ko';

export const CAUSE_REGISTRY = {
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
}>;
