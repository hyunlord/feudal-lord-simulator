import type { PauseReason } from "../../content/lordSliceConfig";
import type { LordMatterDue } from "../../engine/lordDue";

// LM-R3 (lord slice LS-2): the lord-mode auto-pause's notice — why time stopped, one line per reason, and the way on.
export const AUTO_PAUSE_COPY = {
  region: "시간이 멈춘 까닭",
  title: "영주가 볼 일이 생겨 시간을 멈췄습니다",
  resume: "계속",
  /** The season's later reasons, after the player went on (time runs; no second stop in a season). */
  addedTitle: "이번 철에 영주가 볼 일이 더 생겼습니다",
  addedOk: "확인",
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
  /** A matter that waits for the lord's answer by a time (the engine's matters due). */
  matters: {
    will_change: "유언을 바꾸려는 뜻",
    contested: "상속 다툼",
    suit_defence: "영주를 상대로 한 소송",
    entry_threat: "강제 점거 예고",
    audit: "감사에서 드러난 것",
    estate_petition: "바깥 영지의 청원",
  } satisfies Readonly<Record<LordMatterDue["kind"], string>>,
  /** Its chip's line, and when it is decided without him (a season word; null: it waits). */
  matterSentence: (line: string, when: string | null) => when === null ? line : `${line} ${when}까지 답해야 합니다.`,
  /** A petition that put a right at stake (no ledger line of its own): its subject. */
  petition: (subject: string) => `${subject}이 들어왔습니다`,
  petitionUnknown: "권리가 걸린 청원이 들어왔습니다",
  links: {
    marriage: "혼인 보기",
    contested: "상속 다툼 보기",
    entry: "점거 예고 보기",
    suit: "소송 보기",
    estate: "영지 보기",
    house: "가문 소식 보기",
    petition: "청원 보기",
    audit: "감사 보기",
  },
} as const;
