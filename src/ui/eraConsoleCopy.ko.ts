import { moneyShort } from "./money.ko";

// Player-facing copy of the era console (settlement stage, requirements, wall projects, proclamation).
export const ERA_CONSOLE_COPY = {
  /** A requirement's progress, "12/20"; UI-AUDIT-1: the money one in English money, "£3 4s/£10". */
  requirementProgress: (key: string, current: number, target: number) =>
    key === "coin" ? `${moneyShort(current)}/${moneyShort(target)}` : `${current}/${target}`,
  stoneTownProclaimed: "석조 도시가 선포되었습니다",
  currentEra: "현재 시대",
  requirementsLabel: "시대 요구 조건",
  palisadePrediction: "목책 공사 예측",
  stoneProjectPrediction: "석벽 사업 재원 예측",
  wallPriorityLabel: "성벽 공사 자재 우선순위",
  priorityBalanced: "균형 · 25% 비축",
  priorityConstruction: "공사 우선",
  stoneTownAlreadyProclaimed: "이미 석조 도시가 선포되었습니다",
  proclaimStoneTown: "석조 도시 선포",
  stoneTownProclamationDone: "석조 도시 선포 완료",
} as const;
