import { pence } from "./hud/hudCopy.ko";

// UI-4 decision modals: the famine's four answers (FC-2) and the petition's three (FC-3), with the engine's
// predicted numbers (two seasons on) beside the current ones.
const METRIC_NAMES: Readonly<Record<string, string>> = { population: "인구", treasury: "금고", merchantGauge: "상인 게이지" };
const value = (key: string, amount: number) => key === "treasury" ? pence(amount) : String(amount);

export const DECISION_COPY = {
  famineTitle: "대기근 — 영주의 대응",
  famineIntro: "수확이 반으로 줄고 빵 값이 세 배가 되었습니다. 가장 가난한 가구 넷 중 하나는 빵을 살 수 없습니다. 어떻게 하시겠습니까?",
  petitionTitle: "상인들의 청원",
  petitionIntro: "상인 무리가 마을에 모였습니다. 상인 감독 아래 장을 열 권리, 가벼운 좌판세를 청합니다.",
  petitioners: "청원자: 상인 무리",
  demand: "요구: 시장권(상인 감독 아래 장을 열 권리)",
  choose: (label: string) => `${label} — 고르기`,
  later: "나중에 정하기",
  predictedHeading: "두 계절 뒤 예측",
  predictedLine: (numbers: string) => `두 계절 뒤 예측 · ${numbers}`,
  predicted: (now: Readonly<Record<string, number>>, after: Readonly<Record<string, number>>) =>
    Object.keys(after).map(key => `${METRIC_NAMES[key] ?? key} ${value(key, after[key] ?? 0)}(지금 ${value(key, now[key] ?? 0)})`).join(" · "),
  famine: {
    relief: { label: "구휼", line: "가난한 가구의 한 계절 빵을 기근 값으로 사서 곡창에 넣습니다. 떠나는 가구가 적지만 금고가 비어 갑니다" },
    price_control: { label: "가격 통제", line: "값을 1.5배로 묶습니다. 가난한 가구도 빵을 사지만 상인들이 싫어합니다" },
    laissez_faire: { label: "방관", line: "아무것도 하지 않습니다. 빵을 못 사는 가구가 계절마다 떠납니다" },
    speculation: { label: "투기", line: "곡창의 빵과 밀 1/4을 기근 값으로 팝니다. 금고는 차지만 가장 많이 떠납니다" },
  },
  petition: {
    accept: { label: "수락", line: (feePermille: number) => `시장권을 줍니다. 좌판세 × ${(feePermille / 1000).toFixed(2)}` },
    accept_with_price: { label: "가격을 붙여 수락", line: (_feePermille: number, fee: number) => `시장권을 주되 인가료 ${pence(fee)}을 받습니다` },
    refuse: { label: "거절", line: () => "시장권을 주지 않습니다. 상인들이 등을 돌립니다" },
  },
  rightsHeading: "권리 목록",
  right: (holder: string, feePermille: number) => `${holder === "merchants" ? "상인 무리" : holder}: 시장권 · 좌판세 × ${(feePermille / 1000).toFixed(2)}`,
} as const;
