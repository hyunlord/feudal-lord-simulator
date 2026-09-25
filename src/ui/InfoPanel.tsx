import { useRef } from "react";

import type { EconomyStockTotals } from "./ledgerModel";
import type { PlacementTool } from "../render/renderer";
import { KO_UI } from "../content/locale.ko";
import {
  getPlacementToolStatus,
  type PlacementTool as FeedbackPlacementTool,
} from "../render/placementFeedback";
import { BUILD_TOOL_OPTIONS } from "./buildMenuModel";
import type { GameState } from "../engine/engine.types";
import { getSettlementView } from "../engine/settlementView";
import { openGoalFitsScenario, type OnboardingTaskView } from "./onboardingTaskModel";
import { PopulationEventPanel } from "./PopulationEventPanel";
import type { PopulationEvent } from "./populationEventModel";
import { settlementGuidance } from "./settlementGuidanceModel";
import { ProblemGlyph } from "./ProblemGlyph";
import {
  createResourceCounterTween,
  resourceCounterValues,
  retargetResourceCounterTween,
  type ResourceCounterTween,
} from "./resourceCounterTween";

type CourtLedgerProps = {
  readonly tick: number;
  readonly timber: number;
  readonly coin?: number;
  readonly selectedTool: PlacementTool | null;
  readonly population?: number;
  readonly idleWorkers?: number;
  readonly stockTotals?: EconomyStockTotals;
  readonly populationEvents?: readonly PopulationEvent[];
  readonly populationDrawerOpen?: boolean;
  readonly onPopulationDrawerToggle?: () => void;
  readonly onSelectPopulationHouseIds?: (houseIds: readonly string[]) => void;
  readonly nowMs?: number;
};

type LedgerResourceValues = Pick<
  EconomyStockTotals,
  "timber" | "coin" | "wheat" | "bread" | "logs"
>;

type LedgerLabelProps = {
  readonly full: string;
  readonly compact: string;
};

type LedgerRowProps = LedgerLabelProps & {
  readonly value: string | number;
  readonly secondary?: boolean;
};

export function CourtLedger({
  tick,
  timber,
  coin = 0,
  selectedTool,
  population,
  idleWorkers,
  stockTotals,
  populationEvents = [],
  populationDrawerOpen = false,
  onPopulationDrawerToggle,
  onSelectPopulationHouseIds = () => undefined,
  nowMs,
}: CourtLedgerProps) {
  const selectedName =
    selectedTool === null
      ? "없음"
      : BUILD_TOOL_OPTIONS.find((option) => option.tool === selectedTool)?.label ?? selectedTool;
  const resourceTargets: LedgerResourceValues = {
    timber: stockTotals?.timber ?? timber,
    coin: stockTotals?.coin ?? coin,
    wheat: stockTotals?.wheat ?? 0,
    bread: stockTotals?.bread ?? 0,
    logs: stockTotals?.logs ?? 0,
  };
  const resourceTweenRef = useRef<ResourceCounterTween | null>(null);
  if (resourceTweenRef.current === null) {
    resourceTweenRef.current = createResourceCounterTween(resourceTargets, nowMs ?? 0);
  } else if (nowMs !== undefined) {
    resourceTweenRef.current = retargetResourceCounterTween(
      resourceTweenRef.current,
      resourceTargets,
      nowMs,
    );
  }
  const tweenedResources = nowMs === undefined
    ? resourceTargets
    : resourceCounterValues(resourceTweenRef.current, nowMs);
  const displayedResources: LedgerResourceValues = {
    timber: tweenedResources.timber ?? 0,
    coin: tweenedResources.coin ?? 0,
    wheat: tweenedResources.wheat ?? 0,
    bread: tweenedResources.bread ?? 0,
    logs: tweenedResources.logs ?? 0,
  };

  return (
    <>
      <div className="court-ledger" aria-label={KO_UI.ledger.ariaLabel}>
        <span className="ledger-heading">{KO_UI.ledger.heading}</span>
        {onPopulationDrawerToggle === undefined ? null : (
          <button
            className="ledger-population-toggle"
            type="button"
            aria-expanded={populationDrawerOpen}
            aria-controls="population-ledger-drawer"
            onClick={() => onPopulationDrawerToggle()}
          >
            인구 기록
          </button>
        )}
        <dl>
          <LedgerRow full={KO_UI.ledger.timber} compact={KO_UI.ledger.timber} value={displayedResources.timber} />
          <LedgerRow full={KO_UI.ledger.coin} compact={KO_UI.ledger.coin} value={displayedResources.coin} />
          {population !== undefined ? <LedgerRow full={KO_UI.ledger.population} compact={KO_UI.ledger.population} value={population} /> : null}
          {idleWorkers !== undefined ? <LedgerRow full={KO_UI.ledger.idle} compact={KO_UI.ledger.idle} value={idleWorkers} /> : null}
          {stockTotals !== undefined ? (
            <>
              <LedgerRow full={KO_UI.ledger.wheat} compact={KO_UI.ledger.wheat} value={displayedResources.wheat} secondary />
              <LedgerRow full={KO_UI.ledger.bread} compact={KO_UI.ledger.bread} value={displayedResources.bread} secondary />
              <LedgerRow full={KO_UI.ledger.logs} compact={KO_UI.ledger.logs} value={displayedResources.logs} secondary />
            </>
          ) : null}
          <LedgerRow full={KO_UI.ledger.tick} compact={KO_UI.ledger.tick} value={tick} secondary />
          <dt className="ledger-tool">{KO_UI.ledger.seal}</dt><dd className="ledger-tool">{selectedName}</dd>
        </dl>
      </div>
      {populationDrawerOpen ? (
        <div id="population-ledger-drawer" className="ledger-population-drawer">
          <PopulationEventPanel events={populationEvents} onSelectHouseIds={onSelectPopulationHouseIds} />
        </div>
      ) : null}
    </>
  );
}

function LedgerRow({
  full,
  compact,
  value,
  secondary = false,
}: LedgerRowProps) {
  const rowClassName = secondary ? "ledger-row ledger-row--secondary" : "ledger-row";

  return (
    <>
      <dt className={rowClassName} aria-label={full}>
        <LedgerLabel full={full} compact={compact} />
      </dt>
      <dd className={`${rowClassName} ledger-value`}>{value}</dd>
    </>
  );
}

function LedgerLabel({ full, compact }: LedgerLabelProps) {
  return (
    <>
      <span className="ledger-label ledger-label--full">{full}</span>
      <span className="ledger-label ledger-label--compact" aria-hidden="true">{compact}</span>
    </>
  );
}

/** Ticks (one second at 1x) before the settlement status line speaks. */
const STATUS_WARMUP_TICKS = 20;

type SettlementStatusLineProps = {
  readonly state: GameState;
  readonly selectedTool?: PlacementTool | null;
  readonly placementFeedbackMessage?: string | null;
};

export function SettlementStatusLine({
  state,
  selectedTool = null,
  placementFeedbackMessage = null,
}: SettlementStatusLineProps) {
  const guidance = settlementGuidance(state);
  const activeToolStatus =
    selectedTool === null ? null : getPlacementToolStatus(feedbackPlacementTool(selectedTool));
  // UX-0: before the game has run, water and bread supply are not computed yet ("우물이 필요합니다" at tick 0 was false).
  if (activeToolStatus === null && placementFeedbackMessage === null && state.tick < STATUS_WARMUP_TICKS) return null;
  const statusLine = activeToolStatus ?? placementFeedbackMessage ?? guidance.statusLine;
  const showProblemGlyph = activeToolStatus === null && placementFeedbackMessage === null;

  return (
    <section className="settlement-status" aria-label={KO_UI.settlementStatus}>
      <span className="settlement-priority">
        {guidance.priority === null || !showProblemGlyph ? null : (
          <span
            className={`problem-glyph problem-glyph--${guidance.priority.kind}`}
            aria-label={guidance.priority.label}
          >
            <ProblemGlyph kind={guidance.priority.kind} />
          </span>
        )}
        <span>{statusLine}</span>
      </span>
    </section>
  );
}

export function OnboardingTasks({ view, state, warningState = state }: {
  readonly view: OnboardingTaskView;
  readonly state?: GameState;
  readonly warningState?: GameState;
}) {
  if (state !== undefined && getSettlementView(state).outcome === "victory") return null;
  if (view.openGoal !== null && state !== undefined && !openGoalFitsScenario(state)) return null;
  if (view.openGoal !== null && [state, warningState].some(candidate =>
    candidate !== undefined && settlementGuidance(candidate).problems.some(problem => problem.kind === "water" || problem.kind === "bread"))) return null;
  if (view.openGoal !== null) {
    return (
      <section className="onboarding-tasks" aria-label={KO_UI.onboardingTasks} data-onboarding-state="open-goal">
        <span className="settlement-target">{view.openGoal.title}</span>
      </section>
    );
  }

  return (
    <section className="onboarding-tasks" aria-label={KO_UI.onboardingTasks} data-onboarding-state="ordered">
      <ol>
        {view.current === null ? null : (
          <li className="onboarding-task onboarding-task--current" data-task-state="current">
            <span className="onboarding-task-title">{view.current.title}</span>
            <span className="onboarding-task-hint">{view.current.hint}</span>
            {view.current.flourishLabel === null ? null : (
              <span className="onboarding-task-flourish">{view.current.flourishLabel}</span>
            )}
          </li>
        )}
      </ol>
    </section>
  );
}

export function SettlementObjective({ state }: { readonly state: GameState }) {
  const guidance = settlementGuidance(state);
  return (
    <section className="settlement-objective" aria-label={KO_UI.populationObjective}>
      <span className="settlement-target">
        목표: 인구 {guidance.populationGoal}명 · 현재 {state.population}명
      </span>
      {guidance.completedGoal === null ? null : (
        <span className="settlement-complete">인구 {guidance.completedGoal}명 달성</span>
      )}
      {guidance.idleLine === null ? null : <span className="settlement-idle">{guidance.idleLine}</span>}
    </section>
  );
}

function feedbackPlacementTool(tool: PlacementTool): FeedbackPlacementTool {
  if (tool === "road") return { kind: "road" };
  return { kind: "building", buildingKind: tool };
}
