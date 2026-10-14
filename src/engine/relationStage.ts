import { FACTION_ACT_BALANCE as B } from "../content/factionActConfig";

/**
 * Renderer A's request (docs/requests/engine-relation-stages.md, LS1 ③ chip "상인 가문: 못마땅 → 화남"): the stage a
 * faction's relation stands at, by the thresholds the factions already act on (DTR-4: a small act from ±30, a large one
 * from ±60, `FACTION_ACT_BALANCE`) — so the screen never draws its own boundaries. A read only: no save field, no rule
 * reads it. `rank` runs −2 (hostile) … 2 (devoted); the screen tells a crossing by two seasons' ranks and names the
 * stages in its own `*.ko.ts`.
 */
export type RelationStageId = "hostile" | "cold" | "neutral" | "warm" | "devoted";
export interface RelationStage { readonly id: RelationStageId; readonly rank: -2 | -1 | 0 | 1 | 2 }

export function relationStage(value: number): RelationStage {
  if (value >= B.largeAt) return { id: "devoted", rank: 2 };
  if (value >= B.smallAt) return { id: "warm", rank: 1 };
  if (value <= -B.largeAt) return { id: "hostile", rank: -2 };
  if (value <= -B.smallAt) return { id: "cold", rank: -1 };
  return { id: "neutral", rank: 0 };
}
