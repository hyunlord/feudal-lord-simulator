export const WALL_CARRY_COPY = {
  access: (direct: number, carried: number, missing: number) =>
    `도로 연결 구간 ${direct} · 벽을 따라 운반 ${carried} · 연결 필요 ${missing > 0 ? 1 : 0}`,
  anchorRequired: '길을 한 곳 이어야 합니다',
  anchorTarget: '이곳에 길 연결',
  unreachable: (count: number) => `경로 없는 구간 ${count} · 한 곳만 길을 이으면 벽을 따라 운반합니다`,
  carried: (distance: number) => `벽을 따라 운반 · 도로 연결 구간에서 ${distance}칸`,
} as const;

/** INSTALL-3b ①: the wall works' one tag (its segment count and the cause nearest the gate) and a segment's queue place. */
export const WALL_SITE_LABEL_COPY = {
  works: (segments: number, cause: string) => `성벽 공사 ${segments}구간 · ${cause}`,
  queued: (position: number) => `성벽 ${position}번째 대기`,
} as const;
