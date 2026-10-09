// GROW-BLOCK (the user's ruling 2026-10-09): the era console's palisade plan in lord mode — "마을의 목책 계획", where the
// town's plan stands and what holds it, read from the engine's charterWallPlan. The town finds the wall's line and asks
// its lord to proclaim (TA-11, TA-7); the lord answers its request and moves the conditions with his levers (lordAdvice).
// The steward speaks ("~습니다"); times are calendar arrival points ("봄 말쯤"), never ticks.
import type { CharterWallFailureReason } from "../../../engine/townAgency.types";

export const LORD_WALL_COPY = {
  /** The console's one primary in lord mode: opens and closes the plan. */
  plan: "마을의 목책 계획",
  /** Where the plan stands, one line under the primary (closed or open). */
  stage: {
    waiting: (unmet: number) => `목책 둘레는 마을이 잡아 영주에게 청합니다. 선포 조건 ${unmet}가지가 아직 차지 않았습니다`,
    sites: (open: number) => `선포 조건이 찼습니다. 마을은 공사장 ${open}곳이 끝나기를 기다렸다가 목책 둘레를 찾습니다`,
    searching: "선포 조건이 찼습니다. 마을이 목책 둘레를 잡아 청할 차례입니다",
    asked: "마을이 목책 둘레를 잡아 시장도시 선포를 청했습니다. 마을의 청 칩에서 들어주면 마을이 그 둘레로 짓습니다",
    failed: "마을이 지난번에 목책 둘레를 찾지 못했습니다",
  },
  // --- waiting: each unmet condition and the project that meets it ---
  conditionsLabel: "아직 차지 않은 선포 조건",
  /** A condition and how far it is ("인구 12/20": the era console's own current/target). */
  progress: (label: string, amount: string) => `${label} ${amount}`,
  /** A condition no project of the town meets (the coin: the treasury fills it). */
  noProject: "마을이 지을 것은 없습니다. 금고에 돈이 차면 됩니다",
  /** A lever's way to the place where the lord sets it. */
  go: { conditions: "명령 › 방향 열기", zone: "명령 › 장려 구역 열기" },
  // --- sites: the open building sites the search waits on ---
  sitesLabel: "목책 둘레 찾기를 붙잡은 공사장",
  site: (name: string, age: string) => `${name} 공사장 — ${age}`,
  age: (years: number, seasons: number) =>
    years === 0 && seasons === 0 ? "한 계절이 안 되었습니다"
      : years === 0 ? `${seasons}계절째 서 있습니다`
        : seasons === 0 ? `${years}년째 서 있습니다` : `${years}년 ${seasons}계절째 서 있습니다`,
  ageUnknown: "언제 섰는지 모릅니다",
  abandonedLabel: "마을이 요즘 접은 공사",
  // --- failed: why, the homes a wall would cut off, the attempts, the next search ---
  /** Why the search found no wall (the engine's CharterWallFailureReason), in plain words. */
  reasons: {
    water: "둘레가 물을 건너야 했습니다",
    edge: "둘레가 지도 끝에 닿았습니다",
    buildings: "건물 사이로 둘레를 닫을 수 없었습니다",
    service_space: "목책이 집들을 장터·교회 마당과 그 길에서 떼어 놓습니다",
    rules: "둘레가 목책 선포의 규칙에 맞지 않았습니다",
    lots: "둘레 안에 들일 필지가 모자랐습니다",
    route: "둘레 안팎을 잇는 길이 닿지 않았습니다",
    other: "까닭을 하나로 짚지 못했습니다",
  } satisfies Record<CharterWallFailureReason, string>,
  homes: (count: number) => `목책을 두르면 집 ${count}채가 쓰던 마당과 길에서 떨어집니다`,
  lookAtHome: "떨어지는 집 위치로",
  attempts: (count: number) => count === 1 ? "한 번 찾지 못했습니다" : `${count}번 잇달아 찾지 못했습니다`,
  retry: (when: string) => `${when} 다시 찾습니다`,
} as const;
