// COPY-1r (CA-043): a stuck good's cause line names its store (창고 or 곡창) without a fixed particle after it — the
// fixed "이/으로" read "창고이 없습니다" and "창고으로" (glossary rule 8: choose the particle or avoid it).
export const PROBLEM_CAUSE_COPY = {
  noStore: (store: string) => `운반꾼이 가져갈 곳 없음 · 받을 ${store} 없음`,
  storeFull: (store: string, used: number, capacity: number) => `${store} 가득 참 (${used}/${capacity})`,
  noRoute: (store: string, resource: string) => `${store}까지 경로가 없습니다 — ${resource} 운반 불가`,
  waiting: (store: string) => `운반꾼이 ${store}까지 옮기기를 기다리는 중`,
} as const;
