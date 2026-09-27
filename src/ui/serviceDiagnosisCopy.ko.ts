export const SERVICE_DIAGNOSIS_COPY = {
  paused: '시설 가동 중지',
  capacity: (name: string, count: number): string => `${name} 수용량 부족 · 먼저 지어진 집 ${count}채가 사용 중`,
  names: { water: '우물', market: '시장', church: '교회' },
  usage: (used: number, capacity: number) => ` · 담당 ${used}/${capacity}필지`,
  wellServed: (distance: number) => `우물에서 ${distance}칸`,
  served: (name: string, distance: number, radius: number, usage: string) => `${name} 이용 가능 — 거리 ${distance} / 범위 ${radius}${usage}`,
  noWell: '우물이 없습니다',
  missing: (name: string) => `${name} 없음`,
  wellTooFar: (distance: number, radius: number) => `우물이 너무 멉니다 — 거리 ${distance} / 범위 ${radius}`,
  /** The subject particle follows the last syllable: 교회가, 시장이. */
  tooFar: (name: string, isChurch: boolean, distance: number, radius: number) =>
    `${name}${isChurch ? '가' : '이'} 멉니다 — 거리 ${distance} / 범위 ${radius}`,
  understaffed: (name: string) => `가까운 ${name}의 일꾼이 부족합니다`,
  unreachable: (name: string) => `${name}까지 연결된 도로가 없습니다`,
  providerLoad: (used: number, capacity: number) => `서비스 담당 ${used}/${capacity} 주거 필지`,
  providerLotRule: '단독 주택 1 · 합필 주택 2필지, 빈집도 자리 유지',
  wellDirect: '주민이 가까운 우물을 직접 이용합니다',
  roadNeeded: '범위 안 주택까지 이어진 도로가 필요합니다',
  noWorkers: '서비스 중단: 일꾼 부족',
} as const;
