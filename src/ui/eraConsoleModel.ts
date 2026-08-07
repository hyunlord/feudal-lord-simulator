import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import {
  computePalisadeProposal,
  palisadePerimeterSteps,
  type PalisadeFailureReason,
  type PalisadeFootprint,
  type PalisadePath,
} from "../world/palisadeGeometry";

export type PalisadeProposalSummary =
  | {
      readonly ok: true;
      readonly path: PalisadePath;
      readonly label: string;
    }
  | {
      readonly ok: false;
      readonly reason: PalisadeFailureReason;
    };

const TIMBER_PER_WALL_STEP = 15;
const MAX_SEGMENT_STEPS = 4;

export function palisadeFootprintsForState(state: GameState): readonly PalisadeFootprint[] {
  return [...state.buildings]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((building) => {
      const definition = BUILDING_CONFIG_BY_KIND[building.kind];
      return {
        id: building.id,
        tx: building.tx,
        ty: building.ty,
        width: definition.width,
        height: definition.height,
      };
    });
}

export function proposalSummaryForState(
  state: GameState,
  footprints: readonly PalisadeFootprint[],
): PalisadeProposalSummary {
  const proposal = computePalisadeProposal(state, footprints);
  if (!proposal.ok) return proposal;
  return {
    ok: true,
    path: proposal.path,
    label: proposalCostLabel(proposal.perimeterSteps),
  };
}

export function proposalCostLabel(perimeterSteps: number): string {
  const timber = perimeterSteps * TIMBER_PER_WALL_STEP;
  const segments = Math.ceil(perimeterSteps / MAX_SEGMENT_STEPS);
  return `둘레 ${perimeterSteps}칸 · 목재 ${timber} · 공사 ${segments}구간 · 일꾼 ${segments * 120}틱`;
}

export function proposalCostLabelForPath(path: PalisadePath): string {
  return proposalCostLabel(palisadePerimeterSteps(path));
}
