export const WALL_CARRY_COPY = {
  access: (direct: number, carried: number, missing: number) =>
    `도로 연결 구간 ${direct} · 벽을 따라 운반 ${carried} · 연결 필요 ${missing > 0 ? 1 : 0}`,
  anchorRequired: '길을 한 곳 이어야 합니다',
  anchorTarget: '이곳에 길 연결',
  unreachable: (count: number) => `경로 없는 구간 ${count} · 한 곳만 길을 이으면 벽을 따라 운반합니다`,
  carried: (distance: number) => `벽을 따라 운반 · 도로 연결 구간에서 ${distance}칸`,
} as const;
