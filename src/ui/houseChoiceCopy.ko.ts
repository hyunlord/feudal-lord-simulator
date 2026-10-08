// LM-R3 (HOUSE-1): the new game's house choice — the name, the arms, the start.
export const HOUSE_CHOICE_COPY = {
  heading: "가문을 고르세요",
  line: "고른 이름과 문장은 영주 화면과 연대기에 남습니다.",
  namesLabel: "가문 이름",
  armsLabel: "문장",
  arms: (house: string) => `${house} 가문의 문장`,
  candidate: (house: string, index: number) => `${house} 가문의 문장 ${index}`,
  moreArms: "다른 문장 보기",
  start: "이 가문으로 시작",
  back: "뒤로",
} as const;
