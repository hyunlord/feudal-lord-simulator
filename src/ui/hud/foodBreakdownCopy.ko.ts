// LM-R1 (playtest 2026-10-02 #5): the food cell pressed — what the "n일" is made of, and where food does not reach the
// households. Units by the glossary (밀 자루, 빵 덩이).
const n = (value: number) => Math.floor(value).toLocaleString("ko-KR");

export const FOOD_BREAKDOWN_COPY = {
  region: "식량 내역",
  close: "닫기",
  terms: { total: "총량", milling: "제분", carrying: "운반", access: "가구 접근", starving: "굶는 가구" },
  /** The stores' bread and wheat, and the days they last (the pill's number). */
  total: (bread: number, wheat: number, days: number | null) => `곳간의 빵 ${n(bread)}덩이 · 밀 ${n(wheat)}자루${days === null ? "" : ` — ${n(days)}일`}`,
  noMill: (wheat: number) => `방앗간이 없어 밀 ${n(wheat)}자루가 빵이 되지 못합니다`,
  millStopped: (wheat: number) => `방앗간이 멈춰 밀 ${n(wheat)}자루가 빵이 되지 않습니다`,
  milling: (mills: number) => `방앗간 ${mills}곳이 밀을 빵으로 빻습니다`,
  /** The engine's bound wheat (FIX-16): "묶인 밀 782자루 — 풀리면 +91일". */
  bound: (wheat: number, days: number) => days > 0 ? `묶인 밀 ${n(wheat)}자루 — 풀리면 +${n(days)}일` : `묶인 밀 ${n(wheat)}자루 — 빻을 방앗간이 없습니다`,
  onCarts: (bread: number, wheat: number) => `수레 위 빵 ${n(bread)}덩이 · 밀 ${n(wheat)}자루`,
  nothingCarried: "나르는 식량이 없습니다",
  /** Lived-in houses without bread, and how many of them no granary road reaches. */
  access: (empty: number, cut: number) => empty === 0 ? "모든 집에 빵이 있습니다" : cut > 0 ? `빵 없는 집 ${empty}채 · 곡창 길이 끊긴 집 ${cut}채` : `빵 없는 집 ${empty}채`,
  noGranary: (empty: number) => `곡창이 없습니다 — 빵 없는 집 ${empty}채`,
  starving: (households: number) => households === 0 ? "없음" : `${households}가구`,
  /** Days alone do not say the town is fed. */
  starvingNote: "일수가 넉넉해도 굶는 가구가 있을 수 있습니다",
  go: "가장 급한 곳 보기",
  goLabel: (term: string) => `가장 급한 곳 — ${term}. 누르면 그 건물로 갑니다`,
  ledger: "자원 장부 열기",
  pillLabel: (days: string, starving: number) => starving > 0 ? `${days} · 굶는 가구 ${starving}. 누르면 식량 내역을 엽니다` : `${days}. 누르면 식량 내역을 엽니다`,
  /** The pill's mark beside the days while households go hungry. */
  pillStarving: (households: number) => `굶주림 ${households}`,
} as const;
