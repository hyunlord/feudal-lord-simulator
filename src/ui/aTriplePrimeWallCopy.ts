export const A_TRIPLE_PRIME_WALL_COPY = {
  unreachableSegments: (count: number) => `경로 없는 구간 ${count} · 이대로 선포하면 이 구간은 길을 이을 때까지 멈춤`,
  proclamationNotice: '선포 후 성벽 구간은 취소할 수 없습니다. 경로 있는 구간부터 자재와 일꾼이 이동합니다.',
  wallProgress: (completed: number, total: number, active: number, noRoute: number, waiting: number) =>
    `성벽 ${completed}/${total} · 진행 중 ${active} · 경로 없음 ${noRoute} · 대기 ${waiting}`,
} as const;
