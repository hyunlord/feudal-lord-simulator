import type { DeadlineKind } from "./deadlines";

// LS1-11: the held chips' time left, the auto-pause's line for a deadline in its last season, and the chip that says
// what a lapse did (the engine's `decision.lapsed`, and an audit tolerated for want of an answer).

/** A lapsed decision's kind, as the engine's trace names it (`decision.lapsed` params.decisionKind), or the audit's. */
export type LapseKind = "manor_petition" | "estate_petition" | "registry" | "chapter_petition" | "marriage" | "audit";

const DEADLINE_SUBJECT: Readonly<Record<DeadlineKind, string>> = {
  will_change: "유언 바꿈", audit: "감사", estate_petition: "영지 밖 청원", suit_defence: "소송 방어", entry_threat: "강제 진입 경고",
  home_petition: "본령 청원", registry: "제안", famine: "대기근", petition: "청원",
};

/** LS1-18: a kind's short word for the stop's folded line (the rail's fold words). */
const DEADLINE_SHORT: Readonly<Record<DeadlineKind, string>> = {
  will_change: "유언 바꿈", audit: "감사", estate_petition: "청원", suit_defence: "소송", entry_threat: "강제 진입 경고",
  home_petition: "본령 청원", registry: "제안", famine: "대기근", petition: "청원",
};

/** What the engine will do if the deadline passes (the effectful kinds the auto-pause tells). */
const IF_LAPSED: Readonly<Partial<Record<DeadlineKind, string>>> = {
  will_change: "유언은 그대로 둡니다", audit: "묵인으로 처리됩니다", estate_petition: "거절로 처리되고 기다린 쪽의 마음이 상합니다",
  registry: "정해 둔 답으로 처리됩니다",
  petition: "거절로 처리됩니다",
};

const LAPSE_SUBJECT: Readonly<Record<LapseKind, string>> = {
  manor_petition: "본령 청원", estate_petition: "영지 밖 청원", registry: "제안", chapter_petition: "청원", marriage: "유언 바꿈", audit: "감사",
};

/** What the lapse did, as the engine settled it. */
const LAPSED: Readonly<Record<LapseKind, string>> = {
  manor_petition: "기한이 지나 없던 일이 됐습니다",
  estate_petition: "기한이 지나 거절로 처리됐습니다",
  registry: "기한이 지나 제안이 사라졌습니다",
  chapter_petition: "기한이 지나 거절로 처리됐습니다",
  marriage: "답하지 않아 유언을 그대로 두었습니다",
  audit: "기한이 지나 묵인으로 처리됐습니다",
};

/** LS1-12: a folded chip's subject, by its members' chip id prefix. */
const HELD_FOLD_SUBJECT: Readonly<Record<string, string>> = {
  "estate-petition": "영지 밖 청원", registry: "제안", "home-petition": "본령 청원", audit: "감사", petition: "청원",
};

/** LS1-14: a folded chip's short subject on the rail ("청원 2건 · 이번 철"); its card keeps the whole one. */
const HELD_FOLD_SHORT: Readonly<Record<string, string>> = {
  "estate-petition": "청원", registry: "제안", "home-petition": "본령 청원", audit: "감사", petition: "청원",
};

/** LS1-14: a lapse chip's short name on the rail (render-VIS-ls114: the whole sentence was cut, "청원: 기한이 지나 거절로 처리됐습…"). */
const LAPSED_SHORT: Readonly<Record<LapseKind, string>> = {
  manor_petition: "본령 청원 · 없던 일로", estate_petition: "청원 · 거절로", registry: "제안 · 사라짐", chapter_petition: "청원 · 거절로",
  marriage: "유언 · 그대로", audit: "감사 · 묵인으로",
};

export const DEADLINE_COPY = {
  /** LS1-14 (the user's ruling 2026-10-18; REMOTE's lord-pinned HUD measure over budget): the chip's short marks — the
   * card keeps the long ones. */
  short: { thisSeason: "이번 철", seasons: (seasons: number) => `${seasons}철`, past: "기한 지남" },
  heldFoldShort: (prefix: string, count: number) => `${HELD_FOLD_SHORT[prefix] ?? "결정"} ${count}건`,
  thisSeason: "이번 철까지",
  /** LS1-17: a suit against the lord — the seasons to its verdict (engine B's suitVerdictTick), on the chip and its card. */
  toVerdict: (seasons: number) => `판결까지 ${seasons}철`,
  past: "기한 지남",
  /** LS1-10: a held chip past its deadline, the engine yet to settle it (the screen keeps its last look). */
  pastSettling: "기한 지남 — 철 말에 정리",
  seasonsLeft: (seasons: number) => `${seasons}철 남음`,
  /** The auto-pause's word and line for a deadline in its last season. */
  pauseWord: "기한 임박",
  /** LS1-12: with the decision's own name (its chip's title) when there is one: "영지 밖 청원(지대 감면): …". */
  /** LS1-18: several deadlines of one kind in one stop — one line, their count and names ("청원 2건 · 마지막 철"). */
  pauseMany: (kind: DeadlineKind, names: readonly (string | null)[]) => {
    const named = names.filter((name): name is string => name !== null && name !== DEADLINE_SUBJECT[kind]);
    return `${DEADLINE_SHORT[kind]} ${names.length}건 · 마지막 철${named.length === 0 ? "" : `(${named.join(", ")})`}: 이번 철이 지나면 ${IF_LAPSED[kind] ?? "답할 수 없게 됩니다"}`;
  },
  pauseLine: (kind: DeadlineKind, name: string | null = null) =>
    `${DEADLINE_SUBJECT[kind]}${name === null || name === DEADLINE_SUBJECT[kind] ? "" : `(${name})`}: 이번 철이 지나면 ${IF_LAPSED[kind] ?? "답할 수 없게 됩니다"}`,
  /** The lapse chip: one lapse says itself; more say how many. */
  lapsedOne: (kind: LapseKind) => `${LAPSE_SUBJECT[kind]}: ${LAPSED[kind]}`,
  lapsedRegistryAnswered: "제안: 기한이 지나 정해 둔 답으로 처리됐습니다",
  lapsedMany: (count: number) => `기한이 지나 처리된 일 ${count}`,
  /** LS1-14: the lapse chip's short name; a registry offer answered by its lapse answer reads "제안 · 정해 둔 답으로". */
  lapsedShort: (kind: LapseKind, answered = false) => answered ? "제안 · 정해 둔 답으로" : LAPSED_SHORT[kind],
  lapsedManyShort: (count: number) => `기한 지남 ${count}건`,
  lapsedLine: (count: number) => count === 1 ? "답하지 않은 결정이 기한을 넘겨 처리됐습니다." : `답하지 않은 결정 ${count}건이 기한을 넘겨 처리됐습니다.`,
  lapsedAdvice: "칩으로 내린 결정은 기한이 있습니다. 칩에 남은 철이 적혀 있고, 마지막 철에는 칩 모양이 바뀝니다.",
  openLabel: "연대기에서 보기",
  /** LS1-12: held decisions of one kind folded into one chip, and its card. */
  heldFold: (prefix: string, count: number) => `${HELD_FOLD_SUBJECT[prefix] ?? "결정"} ${count}건`,
  heldFoldLine: (count: number) => `답을 기다리는 결정 ${count}건입니다. 기한이 이른 것부터 하나씩 답하세요.`,
} as const;
