import type { EconomyStockTotals } from "./ledgerModel";
import type { PlacementTool } from "../render/renderer";
import {
  getPlacementToolStatus,
  type PlacementTool as FeedbackPlacementTool,
} from "../render/placementFeedback";
import { BUILD_TOOL_OPTIONS } from "./buildMenuModel";
import type { GameState } from "../engine/engine.types";
import type { OnboardingTaskView } from "./onboardingTaskModel";
import { settlementGuidance } from "./settlementGuidanceModel";

type CourtLedgerProps = {
  readonly tick: number;
  readonly timber: number;
  readonly selectedTool: PlacementTool | null;
  readonly population?: number;
  readonly idleWorkers?: number;
  readonly stockTotals?: EconomyStockTotals;
};

export function CourtLedger({
  tick,
  timber,
  selectedTool,
  population,
  idleWorkers,
  stockTotals,
}: CourtLedgerProps) {
  const selectedName =
    selectedTool === null
      ? "없음"
      : BUILD_TOOL_OPTIONS.find((option) => option.tool === selectedTool)?.label ?? selectedTool;
  const timberTotal = stockTotals?.timber ?? timber;

  return (
    <div className="court-ledger" aria-label="Court ledger">
      <span className="ledger-heading">Royal Ledger</span>
      <dl>
        <dt>Timber</dt><dd>{timberTotal}</dd>
        {population !== undefined ? <><dt>Population</dt><dd>{population}</dd></> : null}
        {idleWorkers !== undefined ? <><dt>Idle</dt><dd>{idleWorkers}</dd></> : null}
        {stockTotals !== undefined ? (
          <>
            <dt>Wheat</dt><dd>{stockTotals.wheat}</dd>
            <dt>Bread</dt><dd>{stockTotals.bread}</dd>
            <dt>Logs</dt><dd>{stockTotals.logs}</dd>
          </>
        ) : null}
        <dt>Tick</dt><dd>{tick}</dd>
        <dt className="ledger-tool">Seal</dt><dd className="ledger-tool">{selectedName}</dd>
      </dl>
    </div>
  );
}

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
  const statusLine = activeToolStatus ?? placementFeedbackMessage ?? guidance.statusLine;
  const showProblemGlyph = activeToolStatus === null && placementFeedbackMessage === null;

  return (
    <section className="settlement-status" aria-label="Settlement status">
      <span className="settlement-priority">
        {guidance.priority === null || !showProblemGlyph ? null : (
          <span
            className={`problem-glyph problem-glyph--${guidance.priority.kind}`}
            aria-label={guidance.priority.label}
          >
            {guidance.priority.glyph}
          </span>
        )}
        <span>{statusLine}</span>
      </span>
    </section>
  );
}

export function OnboardingTasks({ view }: { readonly view: OnboardingTaskView }) {
  if (view.openGoal !== null) {
    return (
      <section className="onboarding-tasks" aria-label="Onboarding tasks" data-onboarding-state="open-goal">
        <span className="settlement-target">{view.openGoal.title}</span>
      </section>
    );
  }

  return (
    <section className="onboarding-tasks" aria-label="Onboarding tasks" data-onboarding-state="ordered">
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
        {view.next === null ? null : (
          <li className="onboarding-task onboarding-task--next" data-task-state="next">
            <span className="onboarding-task-title">{view.next.title}</span>
            <span className="onboarding-task-hint">{view.next.hint}</span>
          </li>
        )}
      </ol>
    </section>
  );
}

export function SettlementObjective({ state }: { readonly state: GameState }) {
  const guidance = settlementGuidance(state);
  return (
    <section className="settlement-objective" aria-label="Population objective">
      <span className="settlement-target">
        목표: 인구 {guidance.populationGoal}명 · 현재 {state.population}명
      </span>
      {guidance.completedGoal === null ? null : (
        <span className="settlement-complete">인구 {guidance.completedGoal}명 달성</span>
      )}
    </section>
  );
}

function feedbackPlacementTool(tool: PlacementTool): FeedbackPlacementTool {
  if (tool === "road") return { kind: "road" };
  return { kind: "building", buildingKind: tool };
}
