import type { BuildingKind } from "../../../content/buildingConfig";
import { BUILDING_COPY } from "../../../content/buildingCatalog.ko";
import { withParticle } from "../../particle.ko";

// LS1-3 (lord-screen-v1.md): what holds the town's growth — the engine's growthBlock in words: the mark in the status
// pill, the season-turn band's first line, the chip when a stop starts, the growth panel (cause, since when, the lord's
// lever) and the year card's line. One cause, the main one (P-C3).
/** A condition's or a building's name: the catalog's for a building (BLD-REG: the catalog holds the kinds' words), the
 * era conditions' own words for what is not a building. */
const NOT_BUILDINGS: Readonly<Record<string, string>> = { timber: "목재", stone: "석재", coin: "금고", population: "인구" };
const nameOf = (key: string | null): string => key === null ? "조건" : BUILDING_COPY[key as BuildingKind]?.name ?? NOT_BUILDINGS[key] ?? key;

export const GROWTH_COPY = {
  /** The pill's mark: whole years when the screen saw the stop begin (or the engine says when), else no number. */
  stalled: (years: number) => `정체 ${years}년`,
  stalledUnknown: "정체 중",
  stalledLabel: (years: number) => `마을이 ${years}년째 자라지 않습니다`,
  stalledUnknownLabel: "마을이 자라지 않고 있습니다",
  /** The season-turn band's first line. */
  band: (years: number | null, reason: string) => years === null ? `마을이 자라지 않고 있습니다 — ${reason}` : `마을이 ${years}년째 자라지 않습니다 — ${reason}`,
  /** The cause, by the engine's reason and detail. */
  reason: (reason: string, detail: string | null): string => {
    switch (reason) {
      case "era_condition": return `시장도시 선포의 조건이 모자랍니다(${nameOf(detail)})`;
      case "charter_search": return "마을이 목책을 두를 자리를 찾고 있습니다";
      case "wall_not_found": return "마을이 목책 자리를 찾지 못하고 있습니다";
      case "charter_asked": return "마을의 청이 영주의 답을 기다립니다";
      case "wall_building": return "목책 공사가 멈춰 있습니다";
      case "food": return "먹을 것이 모자란 집이 있습니다";
      case "service_missing": return `집이 다음 단계로 가려면 ${withParticle(nameOf(detail), "이/가")} 있어야 합니다`;
      case "service_outside": return `${withParticle(nameOf(detail), "이/가")} 너무 멀어 집이 다음 단계로 가지 못합니다`;
      case "no_lots": return "성 안에 집을 지을 자리가 없습니다";
      case "town_full": return "마을이 가득 찼습니다 — 모든 집이 가장 높은 단계입니다";
      default: return "마을이 자라지 않는 까닭을 읽지 못했습니다";
    }
  },
  /** The lord's lever: what it does, and its button to the existing screen. */
  lever: {
    order_timber: { line: "목재를 주문하면 풀립니다 — 마을이 목재 주문을 청하면 그 청에 답하세요", button: "목재 주문의 청 보기" },
    subsidy: (building: string) => ({ line: `${nameOf(building)} 공사를 장려금으로 도우면 풀립니다`, button: "장려금 정하기" }),
    wall_priority: { line: "목책을 먼저 짓게 하면 풀립니다", button: "목책 우선 정하기" },
    answer_request: { line: "마을의 청에 답하면 풀립니다", button: "청 보기" },
  },
  /** No lever (none in the engine, or the lord's own drawing, which lord mode does not have — A1). */
  noLever: (reason: string) => `지금은 영주가 직접 풀 길이 없습니다 — ${reason}`,
  panel: {
    /** The town still grows (or has not stopped long): what holds its next step, not a stop (A4). */
    next: "다음 단계를 막는 것",
    since: (year: number, season: string) => `${year}년 ${season}부터`,
    sinceUnknown: "언제부터인지는 이 화면이 보지 못했습니다(불러오기 전부터)",
  },
  /** The chip carries the cause in its title, so the rail says why while the stop holds (LS1-6: the cause seen). */
  chip: { title: (reason: string) => `마을이 자라지 않습니다 — ${reason}`, open: "까닭 보기", advice: "상태 띠의 인구 칸을 누르면 같은 까닭과 영주가 할 일을 다시 볼 수 있습니다." },
  /** The year card's line: the seasons the screen saw the town held, and the last cause. */
  year: (seasons: number, reason: string) => `자라지 못한 철 ${seasons} — ${reason}`,
} as const;
