import type { PauseReason } from "../../content/lordSliceConfig";

// LM-R3 (lord slice LS-2): the lord-mode auto-pause's notice — why time stopped, one line per reason, and the way on.
export const AUTO_PAUSE_COPY = {
  region: "시간이 멈춘 까닭",
  title: "영주가 볼 일이 생겨 시간을 멈췄습니다",
  resume: "계속",
  /** More reasons than the notice lists. */
  more: (count: number) => `그 밖에 ${count}건`,
  /** The reason's word, before the line the ledger wrote. */
  reasons: {
    counter_offer: "역제안",
    major_death: "주요 인물의 죽음",
    inheritance: "상속",
    judgment: "판결",
    rights_petition: "권리가 걸린 청원",
    estate_crisis: "영지의 위기",
    estate_gained: "영지를 얻음",
    estate_lost: "영지를 잃음",
  } satisfies Readonly<Record<PauseReason, string>>,
  /** A petition that put a right at stake (no ledger line of its own): its subject. */
  petition: (subject: string) => `${subject}이 들어왔습니다`,
  petitionUnknown: "권리가 걸린 청원이 들어왔습니다",
  links: {
    marriage: "혼인 보기",
    suit: "소송 보기",
    estate: "영지 보기",
    house: "가문 소식 보기",
    petition: "청원 보기",
  },
} as const;
