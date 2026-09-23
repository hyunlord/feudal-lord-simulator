import type { Era } from "./eraConfig";

// B8 save-system copy lives in one file until t() exists (AGENTS.md rule 5).
export const SAVE_COPY = {
  continueGame: "이어하기",
  newGame: "새 게임",
  saveNow: "지금 저장",
  loadRecent: "불러오기 (최근 3개)",
  noSaves: "저장된 영지가 없습니다",
  saving: "저장 중…",
  saved: "저장했습니다",
  saveFailed: "저장하지 못했습니다",
  loadFailed: "불러오지 못했습니다",
  storageUnavailable: "저장 불가: 브라우저 저장소를 쓸 수 없음",
  checksumFallback: "저장 파일이 손상되어 이전 백업을 불러왔습니다",
  saveControlsLabel: "저장과 불러오기",
  welcomeSaveLabel: "가장 최근 저장",
  startNewGame: "시작",
  cancel: "취소",
  slotLabels: {
    "auto-1": "자동 저장 1",
    "auto-2": "자동 저장 2",
    "auto-3": "자동 저장 3",
    manual: "수동 저장",
    previous: "이전 도시",
  } as Readonly<Record<string, string>>,
  eraLabels: {
    hamlet: "촌락 시대",
    palisade: "목책 시대",
    stone_town: "석조 도시 시대",
  } as const satisfies Record<Era, string>,
  problems: {
    food_shortage: "빵 배급 부족",
    abandonment_risk: "주민 없음",
  },
} as const;

export type SaveProblemKey = keyof typeof SAVE_COPY.problems;

export function formatSaveSummaryLine(input: {
  readonly elapsedMinutes: number;
  readonly population: number;
  readonly era: Era;
  readonly problem: SaveProblemKey | null;
}): string {
  const parts = [
    `${input.elapsedMinutes}분째`,
    `인구 ${input.population}`,
    SAVE_COPY.eraLabels[input.era],
    ...(input.problem === null ? [] : [`현재 문제: ${SAVE_COPY.problems[input.problem]}`]),
  ];
  return parts.join(" · ");
}

export function formatNewGameArchiveNotice(input: { readonly elapsedMinutes: number; readonly population: number }): string {
  return `새 게임을 시작하면 이어하던 도시(${input.elapsedMinutes}분째 · 인구 ${input.population})는 '${SAVE_COPY.slotLabels.previous}' 칸에 보관됩니다.`;
}

export function formatSlotLabel(slotId: string): string {
  return SAVE_COPY.slotLabels[slotId] ?? slotId;
}
