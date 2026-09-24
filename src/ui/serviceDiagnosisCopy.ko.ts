export const SERVICE_DIAGNOSIS_COPY = {
  paused: '시설 가동 중지',
  capacity: (name: string, count: number): string => `${name} 수용량 부족 · 먼저 지어진 집 ${count}채가 사용 중`,
} as const;
