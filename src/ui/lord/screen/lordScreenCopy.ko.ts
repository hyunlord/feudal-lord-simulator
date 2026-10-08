// LM-R2: the lord screen host — a side panel over the town (the world stays in view), its left menu and its empty state.
import type { LordScreenId } from "./lordScreenTypes";

export const LORD_SCREEN_COPY = {
  title: "영주 집무",
  region: "영주 집무: 영지·혼인·약속·지역",
  nav: "영주 화면",
  close: "영주 집무 닫기",
  labels: {
    character: "인물", dynasty: "가문", region: "지역", estates: "영지", council: "평의회",
    marriage: "혼인", ledger: "약속·소송", petitions: "상시 방침", military: "무력",
  } satisfies Record<LordScreenId, string>,
  /** Why a menu item is shut: its screen is not built yet, or the game has no rules for it. */
  soon: "준비 중",
  noRules: "규칙 없음",
  none: "아직 열 수 있는 화면이 없습니다. 각 화면은 준비되는 대로 열립니다.",
  /** The ledger drawer's lord tab: the way in. */
  open: "영주 집무 열기",
  openLabel: "영주 집무 열기: 영지·혼인·약속·지역 화면",
  /** A waiting decision on a lord screen: its card opens; one behind another of its kind waits for that one first. */
  decide: "결정하기",
  decideAfter: "앞의 결정을 먼저 합니다",
} as const;
