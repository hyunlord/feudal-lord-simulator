// UI-9: chapter 4 faction influence bars (RG-4), tug-of-war strip (RG-4) and revolt pressure (RG-8) — Korean copy.
// Kept separate from chronicleScreenCopy.ko.ts so parallel agents' additions do not conflict.
export const FACTION_INFLUENCE_COPY = {
  /** RG-4: an influence value shown on a faction row or in the tug-of-war strip. */
  influenceLabel: (value: number) => `힘 ${value}`,
  influenceBarLabel: (name: string, value: number) => `${name} 힘 ${value}`,
  /** RG-4: the tug-of-war strip above the faction list. */
  tugOfWarLabel: "4장 세력 줄다리기",
  townSide: "도시·상인",
  lordSide: "영주·왕실",
  warningLine: "백작 경고선 50",
  warningActive: "백작이 경고했습니다",
  /** RG-8: revolt pressure causes (the spec RG-8 table). */
  pressureHeading: "반란 압력",
  pressureTotal: (total: number) => `압력 합계: ${total}`,
  pressureThreshold: "50 이상이면 징수원을 쫓는다",
  causeLine: (name: string, pressure: number) => `${name} +${pressure}`,
  causeNames: {
    direct_collection: "직접 징수",
    labour_services: "3장 부역 유지",
    wages_bound: "3장 임금 묶음",
    guild_refused: "길드 거부",
    cloth_specialised: "직물 전문화",
    commons_estranged: "평민 관계 악화",
  } as Readonly<Record<string, string>>,
  outcomeChased: "소문 결과: 징수원을 쫓았습니다",
  outcomeQuiet: "소문 결과: 지나갔습니다",
} as const;
