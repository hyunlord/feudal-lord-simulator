// Player-facing copy of the cause registry (the glyph character and short label per cause).
export const CAUSE_REGISTRY_COPY = {
  water: { glyphText: '물', shortLabel: '물' },
  bread: { glyphText: '빵', shortLabel: '빵' },
  delivery: { glyphText: '길', shortLabel: '도로·운송' },
  market: { glyphText: '시', shortLabel: '시장' },
  church: { glyphText: '교', shortLabel: '교회' },
  wall: { glyphText: '벽', shortLabel: '성벽' },
  workers: { glyphText: '일', shortLabel: '일꾼' },
  construction_access: { glyphText: '공', shortLabel: '공사 접근' },
  reserve_deadlock: { glyphText: '비' },
} as const;
