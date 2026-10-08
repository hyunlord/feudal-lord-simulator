// SUIT-THREAD (Astra lordplay2 ⑦, TOP10 8): the chips of the lord's matters that wait for his answer by a time (the
// engine's `lordMattersDue`) — the father's will (its chip opens the lord screen's 혼인 page), a suit against the lord
// and a forcible entry forewarned (theirs open the 약속·소송 page on the suit or the threat). Glossary
// (docs/design/glossary.md): 강제 점거, 점유 침탈 소송, 최종 합의 ('합의'); dates as "1305년 여름" (rule 5, no days counted).

export const LORD_MATTERS_COPY = {
  /** The will's chip: the day it stands without him (the engine's `dueTick`), and its way to the 혼인 page. */
  willDue: (date: string) => `${date}까지 답하지 않으면 새 유언이 그대로 서고, 그대로 둔 것으로 칩니다.`,
  willOpen: "혼인 화면에서 답하기",
  willAdvice: "혼인 화면의 유언 변경 줄에서 답합니다. 기한이 지나면 그대로 둔 것으로 칩니다.",
  // A suit against the lord (the engine's sentence of its filing is the chip's line).
  suitTitle: "영주를 상대로 한 소송",
  suitLine: "이웃 가문이 영주를 상대로 소송을 냈습니다.",
  suitStage: (stage: string) => `지금: ${stage}`,
  suitNext: (date: string) => `${date}에 다음 단계로 넘어갑니다`,
  suitWaits: "다음 단계로 넘어갈 때가 아직 정해지지 않았습니다",
  suitOpen: "소송 보기",
  suitAdvice: "약속·소송 화면의 이 소송 줄에서 방어합니다. 답하지 않아도 소송은 제때 다음 단계로 넘어갑니다.",
  // A forcible entry forewarned (the engine's sentence of the warning is the chip's line).
  entryTitle: "강제 점거 예고",
  entryLine: "이웃 가문이 영지의 권리에 힘으로 들어오려 합니다.",
  entryComes: (date: string) => `${date}에 들어옵니다`,
  entryOpen: "예고 보기",
  entryAdvice: "약속·소송 화면에서 이 예고에 답합니다. 그대로 두면 판결 없이 점유를 빼앗깁니다.",
} as const;
