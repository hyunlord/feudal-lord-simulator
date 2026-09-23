import { KO_UI } from "../content/locale.ko";
import { canProclaimStoneTownEra, evaluateEraRequirements } from "../engine/era";
import { recentCoinIncome } from "../engine/coinLedger";
import { canAdvanceConstructionWork } from "../economy/construction";
import type { WallConstructionPriority } from "../engine/constructionReserve";
import type { Era } from "../content/eraConfig";
import type { EraRequirement, GameState } from "../engine/engine.types";
import type { PalisadeDraftState } from "../render/palisadeDraftInteraction";
import { A_TRIPLE_PRIME_WALL_COPY } from './aTriplePrimeWallCopy';
import { palisadeFootprintsForState, proposalSummaryForState } from "./eraConsoleModel";
import { proposalPredictionLines } from "./wallPrediction";
import type { PredictionLine } from "./predictionTypes";

export type EraConsoleAction = {
  readonly enabled: boolean;
  readonly label: string;
  readonly reason: string | null;
  readonly targetEra: Extract<Era, "palisade" | "stone_town">;
};

export type EraConsoleModel = {
  readonly currentEraLabel: string;
  readonly requirements: readonly EraRequirement[];
  readonly tooltip: string;
  readonly action: EraConsoleAction;
  readonly proposal: {
    readonly visible: boolean;
    readonly label: string;
    readonly failure: string | null;
  };
  readonly predictionLines: readonly PredictionLine[];
  readonly coinHint: string | null;
  readonly draft: {
    readonly editing: boolean;
    readonly selectedRunLabel: string | null;
    readonly failure: string | null;
  };
  readonly wallProgress: string | null;
  readonly diagnostic: string | null;
  readonly irreversibleNotice: string | null;
};

const PROCLAMATION_TOOLTIPS = {
  hamlet: "선포하면 일꾼의 40%가 성벽 공사에 배정됩니다 (약 600틱)",
  palisade: "선포하면 일꾼의 50%가 석조 전환 공사에 배정됩니다 (약 900틱)",
  stone_town: "석조 도시가 선포되었습니다",
} as const satisfies Record<Era, string>;

const CURRENT_ERA_LABELS = {
  hamlet: "촌락",
  palisade: "목책마을",
  stone_town: "석조 도시",
} as const satisfies Record<Era, string>;

export function buildEraConsoleModel(input: {
  readonly state: GameState;
  readonly draft: PalisadeDraftState | null;
}): EraConsoleModel {
  const requirements = evaluateEraRequirements(input.state);
  const proposal = input.state.era === "hamlet"
    ? proposalSummaryForState(input.state, palisadeFootprintsForState(input.state))
    : null;
  const firstUnmet = requirements.find((requirement) => !requirement.met) ?? null;
  const proposalVisible =
    input.state.era === "hamlet" && (requirements.some((requirement) => requirement.met) || input.draft !== null);
  const targetEra = input.state.era === "hamlet" ? "palisade" : "stone_town";
  const canBegin = input.state.era === "hamlet"
    ? firstUnmet === null && proposal?.ok === true
    : canProclaimStoneTownEra(input.state);
  const predictionPath = input.draft?.candidate.path ?? (proposal?.ok ? proposal.path : null);
  const marketCount = input.state.buildings.filter(building => building.kind === 'market').length;
  const recentIncome = recentCoinIncome(input.state);
  const coinHint = input.state.era === 'palisade'
    ? marketCount === 0
      ? '시장 0개 · 수입원 없음 · 시장이 창고의 남는 물자를 팔 때 들어옵니다'
      : recentIncome.total > 0
        ? `시장 ${marketCount}개 · 최근 2,400틱 시장 판매 +${recentIncome.total}`
        : `시장 ${marketCount}개 · 최근 수입 0 · 남는 물자 판매 대기`
    : null;
  return {
    currentEraLabel: CURRENT_ERA_LABELS[input.state.era],
    requirements,
    tooltip: PROCLAMATION_TOOLTIPS[input.state.era],
    action: {
      enabled: canBegin,
      label: actionLabel({ state: input.state, draft: input.draft }),
      reason: actionReason({ firstUnmet, proposalOk: proposal?.ok === true, state: input.state }),
      targetEra,
    },
    proposal: {
      visible: proposalVisible,
      label: proposal === null ? "" : proposal.ok ? proposal.label : "목책 제안 불가",
      failure: proposal === null || proposal.ok ? null : proposalFailureLabel(proposal.reason),
    },
    predictionLines: predictionPath === null ? [] : proposalPredictionLines(input.state, predictionPath),
    coinHint,
    draft: {
      editing: input.draft !== null,
      selectedRunLabel: selectedRunLabel(input.draft),
      failure: input.draft?.failureReason === null || input.draft === null
        ? null
        : proposalFailureLabel(input.draft.failureReason),
    },
    wallProgress: wallProgress(input.state),
    diagnostic: null,
    irreversibleNotice: input.state.palisade === null
      ? null
      : A_TRIPLE_PRIME_WALL_COPY.proclamationNotice,
  };
}

export function EraConsole({
  model,
  onBeginProposal,
  onConfirmProposal,
  onCancelProposal,
  onProclaimStoneTown = () => undefined,
  priority = 'balanced',
  onPriorityChange,
}: {
  readonly model: EraConsoleModel;
  readonly onBeginProposal: () => void;
  readonly onConfirmProposal: () => void;
  readonly onCancelProposal: () => void;
  readonly onProclaimStoneTown?: () => void;
  readonly priority?: WallConstructionPriority;
  readonly onPriorityChange?: (priority: WallConstructionPriority) => void;
}) {
  const actionHandler = model.action.targetEra === "stone_town"
    ? onProclaimStoneTown
    : model.draft.editing ? onConfirmProposal : onBeginProposal;
  return (
    <section className="era-console" aria-label={KO_UI.eraConsole}>
      <header className="era-console__header">
        <span className="era-console__kicker">현재 시대</span>
        <strong>{model.currentEraLabel}</strong>
      </header>
      <dl className="era-requirements" aria-label="시대 요구 조건">
        {model.requirements.map((requirement) => (
          <div
            className={requirement.met ? "era-requirement era-requirement--met" : "era-requirement"}
            key={requirement.key}
          >
            <dt>{requirement.label}</dt>
            <dd>{requirement.current}/{requirement.target}
              {requirement.key === 'coin' && model.coinHint !== null
                ? <small className="era-requirement-hint">{model.coinHint}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="era-tooltip">{model.tooltip}</p>
      {model.proposal.visible ? (
        <p className="era-proposal">
          <span>{model.proposal.label}</span>
          {model.proposal.failure === null ? null : <span>{model.proposal.failure}</span>}
        </p>
      ) : null}
      {model.proposal.visible && model.predictionLines.length > 0 ? (
        <ul className="era-proposal-lines" aria-label="목책 공사 예측">
          {model.predictionLines.map(line => <li className={`prediction-line prediction-line--${line.tone}`} key={line.id}>{line.text}</li>)}
        </ul>
      ) : null}
      {model.draft.editing ? (
        <p className="era-draft-status">
          {model.draft.selectedRunLabel ?? "목책선을 클릭해 조정할 구간을 고르세요."}
          {model.draft.failure === null ? null : ` · ${model.draft.failure}`}
        </p>
      ) : null}
      {model.wallProgress === null ? null : <p className="era-wall-progress">{model.wallProgress}</p>}
      {model.wallProgress !== null && onPriorityChange !== undefined ? (
        <div className="era-wall-priority" role="group" aria-label="성벽 공사 자재 우선순위">
          <button type="button" aria-pressed={priority === 'balanced'}
            onClick={() => onPriorityChange('balanced')}>{priority === 'balanced' ? '✓ ' : ''}균형 · 25% 비축</button>
          <button type="button" aria-pressed={priority === 'priority'}
            onClick={() => onPriorityChange('priority')}>{priority === 'priority' ? '✓ ' : ''}공사 우선</button>
        </div>
      ) : null}
      {model.diagnostic === null ? null : <p className="era-diagnostic">{model.diagnostic}</p>}
      {model.irreversibleNotice === null ? null : (
        <p className="era-irrevocable">{model.irreversibleNotice}</p>
      )}
      <div className="era-actions">
        <button
          className="era-action"
          type="button"
          disabled={!model.action.enabled && !model.draft.editing}
          onClick={actionHandler}
          aria-describedby="era-action-reason"
        >
          {model.action.label}
        </button>
        {model.draft.editing ? (
          <button className="era-action era-action--secondary" type="button" onClick={onCancelProposal}>
            제안 취소
          </button>
        ) : null}
      </div>
      <small id="era-action-reason" className="era-action-reason">
        {model.action.reason ?? "두 번째 클릭으로 확정합니다."}
      </small>
    </section>
  );
}

function actionReason(input: {
  readonly firstUnmet: EraRequirement | null;
  readonly proposalOk: boolean;
  readonly state: GameState;
}): string | null {
  if (input.state.era === "stone_town") return "이미 석조 도시가 선포되었습니다";
  if (input.firstUnmet !== null) {
    return `${input.firstUnmet.label} ${input.firstUnmet.current}/${input.firstUnmet.target}`;
  }
  if (input.state.era === "palisade") return null;
  return input.proposalOk ? null : "유효한 목책 제안을 만들 수 없습니다";
}

function actionLabel(input: {
  readonly state: GameState;
  readonly draft: PalisadeDraftState | null;
}): string {
  if (input.state.era === "palisade") return "석조 도시 선포";
  if (input.state.era === "stone_town") return "석조 도시 선포 완료";
  return input.draft === null ? "목책 시대 선포 준비" : "목책 시대 선포 확정";
}

function proposalFailureLabel(reason: string): string {
  switch (reason) {
    case "no_footprints":
      return "완성된 건물이 없어 둘레를 잡을 수 없습니다";
    case "collinear_footprints":
      return "건물이 한 줄로 몰려 둘레를 잡을 수 없습니다";
    case "open_polygon":
      return "목책선이 닫히지 않았습니다";
    case "self_intersection":
      return "목책선이 서로 교차합니다";
    case "out_of_bounds":
      return "목책선이 지도 밖으로 나갑니다";
    case "water_crossing":
      return "목책선이 물을 가로지릅니다";
    case "building_clearance":
      return "건물과 성벽 사이에 최소 한 칸의 여유가 필요합니다";
    case "insufficient_enclosure":
      return "생활권을 모두 둘러야 합니다";
    case "empty_perimeter":
      return "둘레가 비어 있습니다";
    default:
      return "목책 제안을 확인할 수 없습니다";
  }
}

function selectedRunLabel(draft: PalisadeDraftState | null): string | null {
  if (draft === null || draft.selectedRunIndex === null) return null;
  const run = draft.candidate.runs[draft.selectedRunIndex];
  return run === undefined ? null : `선택 구간 ${draft.selectedRunIndex + 1} · ${run.steps}칸`;
}

function wallProgress(state: GameState): string | null {
  if (state.palisade === null) return null;
  const completed = state.palisade.segments.filter((segment) => segment.completed).length;
  const remaining = state.constructionSites.filter(site =>
    site.kind === 'palisade_segment' && site.wallId === state.palisade?.id);
  const noRoute = remaining.filter(site => site.stall === 'no_route').length;
  const active = remaining.filter(site => site.stall === "none" && canAdvanceConstructionWork(site)).length;
  const waiting = Math.max(0, state.palisade.segments.length - completed - active - noRoute);
  return A_TRIPLE_PRIME_WALL_COPY.wallProgress(completed, state.palisade.segments.length, active, noRoute, waiting);
}
