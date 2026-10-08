import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { stageForEra } from "../engine/scenarioState";
import { LABOUR_COPY } from "./labourCopy.ko";
import { isWallConstructionSite } from "../domain/palisadeConstructionSchedule";
import { useLayoutEffect, useRef } from "react";
import { KO_UI } from "../content/locale.ko";
import { canProclaimStoneTownEra, evaluateEraRequirements, stoneWallProjectAvailable } from "../engine/era";
import { LEDGER_COPY } from "../ledger/ledgerCopy.ko";
import { recentIncome } from "../ledger/ledgerView";
import { LEDGER_CATEGORY_LABELS } from "../ledger/ledgerCopy.ko";
import { stoneProjectPredictionLines } from "./moneyPrediction";
import { reserveDeadlock } from "../engine/reserveDeadlock";
import { canAdvanceConstructionWork } from "../economy/construction";
import type { WallConstructionPriority } from "../engine/constructionReserve";
import type { Era } from "../content/eraConfig";
import type { EraRequirement, GameState } from "../engine/engine.types";
import type { PalisadeDraftState } from "../render/palisadeDraftInteraction";
import { A_TRIPLE_PRIME_WALL_COPY } from './aTriplePrimeWallCopy';
import { WALL_DRAFT_COPY as WALL_COPY, palisadeFailureLabel } from './wallDraftCopy.ko';
import { palisadeFootprintsForState, proposalSummaryForState } from "./eraConsoleModel";
import { draftPalisadePredictionLines, proposalPredictionLines } from "./wallPrediction";
import { PREDICTION_SEVERITY_TONE, type PredictionLine } from "./predictionTypes";
import { CONSTRUCTION_DEADLOCK_COPY } from './constructionDeadlockCopy.ko';
import { UiIcon } from "./UiIcon";
import { cachedExpansionPreview, expansionLines, pendingPastureWarning } from "./wallExpansionModel";
import { WALL_EXPANSION_COPY } from "./wallExpansionCopy.ko";
import { Button } from "./kit";
import { ERA_CONSOLE_COPY } from "./eraConsoleCopy.ko";
import { lordWallGuidance } from "./lord/advice/lordWall";

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
    readonly recommendEnabled: boolean;
  };
  readonly predictionLines: readonly PredictionLine[];
  readonly coinHint: string | null;
  /** M-7: the stone-wall project's cost, or why the treasury blocks it. */
  readonly projectLines: readonly PredictionLine[];
  readonly draft: {
    readonly editing: boolean;
    readonly selectedRunLabel: string | null;
    readonly failure: string | null;
    readonly canErase: boolean;
  };
  readonly wallProgress: string | null;
  readonly diagnostic: string | null;
  readonly reserveDeadlock: boolean;
  readonly irreversibleNotice: string | null;
  /** UX-0b2 WALL-2: widening the standing wall — the entry, the draft's preview lines, and the fields still to turn. */
  readonly expansion: {
    readonly available: boolean;
    readonly editing: boolean;
    readonly ok: boolean;
    readonly lines: readonly PredictionLine[];
    readonly pending: string | null;
  };
};

const PROCLAMATION_TOOLTIPS = {
  hamlet: LABOUR_COPY.palisadeProclamation,
  palisade: LABOUR_COPY.stoneProclamation,
  stone_town: ERA_CONSOLE_COPY.stoneTownProclaimed,
} as const satisfies Record<Era, string>;

/** Current settlement stage label, from the scenario's stage names (B2). */
const currentStageLabel = (era: Era): string => SCENARIO_COPY.stages[stageForEra(era)];

export function buildEraConsoleModel(input: {
  readonly state: GameState;
  readonly draft: PalisadeDraftState | null;
}): EraConsoleModel {
  const requirements = evaluateEraRequirements(input.state);
  const expanding = input.draft?.purpose === 'expand';
  const expansionPreview = expanding && input.draft !== null ? cachedExpansionPreview(input.state, input.draft.candidate?.path ?? input.draft.path) : null;
  const proposal = input.state.era === "hamlet"
    ? proposalSummaryForState(input.state, palisadeFootprintsForState(input.state))
    : null;
  const firstUnmet = requirements.find((requirement) => !requirement.met) ?? null;
  const lordWall = lordWallGuidance(input.state, proposal === null || proposal.ok ? null : palisadeFailureLabel(proposal.reason));
  const proposalVisible =
    input.state.era === "hamlet" && (requirements.some((requirement) => requirement.met) || input.draft !== null);
  const targetEra = input.state.era === "hamlet" ? "palisade" : "stone_town";
  const canBegin = input.state.era === "hamlet"
    ? firstUnmet === null && (input.draft === null || input.draft.candidate !== null)
    : canProclaimStoneTownEra(input.state);
  const predictionPath = input.draft?.candidate?.path ?? (proposal?.ok ? proposal.path : null);
  const predictionLines = predictionPath === null || input.draft?.candidate === null
    ? [] : proposalPredictionLines(input.state, predictionPath);
  const draftLines: readonly PredictionLine[] = input.draft !== null && input.draft.candidate === null
    ? draftPalisadePredictionLines(input.state, input.draft.path)
    : predictionLines;
  // Spec L-8 / M-8: the income-source line is the ledger's recent income by category.
  const income = recentIncome(input.state);
  const deadlock = reserveDeadlock(input.state);
  const coinHint = input.state.era === 'palisade'
    ? income.total > 0
      ? LEDGER_COPY.eraIncome(income.byCategory.map(row => LEDGER_COPY.eraIncomeLine(LEDGER_CATEGORY_LABELS[row.category], row.amount)).join(LEDGER_COPY.eraIncomeSeparator))
      : LEDGER_COPY.eraNoIncome
    : null;
  return {
    currentEraLabel: currentStageLabel(input.state.era),
    requirements,
    tooltip: input.state.era === "hamlet" ? PROCLAMATION_TOOLTIPS.hamlet
      : LABOUR_COPY.assigned(input.state.constructionSites.filter(isWallConstructionSite).reduce((sum, site) => sum + site.assignedBuilders, 0)),
    action: expansionPreview !== null ? {
      enabled: expansionPreview.ok, label: WALL_EXPANSION_COPY.confirm, targetEra,
      reason: expansionPreview.ok ? null : WALL_EXPANSION_COPY.failure[expansionPreview.reason],
    } : {
      enabled: canBegin,
      label: actionLabel({ state: input.state, draft: input.draft }),
      reason: actionReason({ firstUnmet, state: input.state, draft: input.draft }),
      targetEra,
    },
    // PLAY-2 (lord mode): the town's line and its request, the lord's lever; drawing it himself only when the town found none.
    proposal: lordWall !== null ? { visible: true, label: lordWall.line, failure: lordWall.next, recommendEnabled: input.state.era === 'hamlet' && firstUnmet === null } : {
      visible: proposalVisible,
      label: proposal === null ? "" : proposal.ok ? proposal.label : WALL_COPY.recommendationFailed,
      failure: proposal === null || proposal.ok ? null : palisadeFailureLabel(proposal.reason),
      recommendEnabled: input.state.era === 'hamlet' && firstUnmet === null,
    },
    predictionLines: draftLines,
    coinHint,
    projectLines: stoneProjectPredictionLines(input.state),
    draft: {
      editing: input.draft !== null,
      selectedRunLabel: selectedRunLabel(input.draft),
      canErase: input.draft?.selectedRunIndex !== null && input.draft?.selectedRunIndex !== undefined,
      failure: input.draft?.failureReason === null || input.draft === null
        ? null
        : palisadeFailureLabel(input.draft.failureReason),
    },
    wallProgress: wallProgress(input.state),
    diagnostic: deadlock === null ? null : CONSTRUCTION_DEADLOCK_COPY.cause(
      deadlock.blockedResource, deadlock.used, deadlock.capacity),
    reserveDeadlock: deadlock !== null,
    irreversibleNotice: input.state.palisade === null
      ? null
      : A_TRIPLE_PRIME_WALL_COPY.proclamationNotice,
    expansion: {
      available: input.state.palisade !== null && input.draft === null,
      editing: expansionPreview !== null,
      ok: expansionPreview?.ok === true,
      lines: expansionPreview === null ? [] : expansionLines(input.state, expansionPreview),
      pending: pendingPastureWarning(input.state)?.line ?? null,
    },
  };
}

export function EraConsole({
  model,
  onBeginProposal,
  onBeginDraw = onBeginProposal,
  onConfirmProposal,
  onCancelProposal,
  onEraseDraftSegment = () => undefined,
  onProclaimStoneTown = () => undefined,
  onBeginExpansion,
  onConfirmExpansion,
  priority = 'balanced',
  onPriorityChange,
}: {
  readonly model: EraConsoleModel;
  readonly onBeginProposal: () => void;
  readonly onBeginDraw?: () => void;
  readonly onConfirmProposal: () => void;
  readonly onCancelProposal: () => void;
  readonly onEraseDraftSegment?: () => void;
  readonly onProclaimStoneTown?: () => void;
  /** UX-0b2 WALL-2: start widening the standing wall, and proclaim the widened ring. */
  readonly onBeginExpansion?: () => void;
  readonly onConfirmExpansion?: () => void;
  readonly priority?: WallConstructionPriority;
  readonly onPriorityChange?: (priority: WallConstructionPriority) => void;
}) {
  const actionReasonRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (model.draft.editing) actionReasonRef.current?.scrollIntoView({ block: 'nearest' });
  }, [model.draft.editing, model.draft.selectedRunLabel, model.draft.failure]);
  const actionHandler = model.expansion.editing ? onConfirmExpansion
    : model.action.targetEra === "stone_town" ? onProclaimStoneTown
    : model.draft.editing ? onConfirmProposal : onBeginDraw;
  return (
    <section className="era-console" data-frame="flat" aria-label={KO_UI.eraConsole}>
      <header className="era-console__header">
        <span className="era-console__kicker">{ERA_CONSOLE_COPY.currentEra}</span>
        <strong>{model.currentEraLabel}</strong>
      </header>
      <dl className="era-requirements" aria-label={ERA_CONSOLE_COPY.requirementsLabel}>
        {model.requirements.map((requirement) => (
          <div
            className={requirement.met ? "era-requirement era-requirement--met" : "era-requirement"}
            key={requirement.key}
          >
            <dt>{requirement.label}</dt>
            <dd>{ERA_CONSOLE_COPY.requirementProgress(requirement.key, requirement.current, requirement.target)}
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
        <ul className="era-proposal-lines" aria-label={ERA_CONSOLE_COPY.palisadePrediction}>
          {model.predictionLines.map(line => <li className={`prediction-line prediction-line--${PREDICTION_SEVERITY_TONE[line.severity]}`} key={line.id}>{line.text}</li>)}
        </ul>
      ) : null}
      {model.projectLines.length > 0 ? (
        <ul className="era-project-lines" aria-label={ERA_CONSOLE_COPY.stoneProjectPrediction}>
          {model.projectLines.map(line => <li className={`prediction-line prediction-line--${PREDICTION_SEVERITY_TONE[line.severity]}`} key={line.id}>{line.text}</li>)}
        </ul>
      ) : null}
      {model.expansion.editing ? <>
        <p className="era-expansion-hint">{WALL_EXPANSION_COPY.hint}</p>
        <ul className="era-proposal-lines era-expansion-lines" aria-label={WALL_EXPANSION_COPY.begin}>
          {model.expansion.lines.map(line => <li className={`prediction-line prediction-line--${PREDICTION_SEVERITY_TONE[line.severity]}`} key={line.id}
            data-expansion-line={line.id}>{line.text}</li>)}
        </ul>
      </> : null}
      {model.expansion.pending === null ? null : <p className="era-expansion-pending" role="status">{model.expansion.pending}</p>}
      {model.draft.editing ? (
        <p className="era-draft-status">
          {model.draft.selectedRunLabel ?? WALL_COPY.drawOrMove}
          {model.draft.failure === null ? null : ` · ${model.draft.failure}`}
        </p>
      ) : null}
      {model.wallProgress === null ? null : <p className="era-wall-progress">{model.wallProgress}</p>}
      {model.diagnostic === null ? null : <p className="era-diagnostic">{model.diagnostic}</p>}
      {model.wallProgress !== null && onPriorityChange !== undefined ? (
        <div className="era-wall-priority" role="group" aria-label={ERA_CONSOLE_COPY.wallPriorityLabel}>
          <Button type="button" aria-pressed={priority === 'balanced'}
            onPress={() => onPriorityChange('balanced')} variant="secondary">{priority === 'balanced' ? <UiIcon sheet="prediction" cell="ok" /> : null}{ERA_CONSOLE_COPY.priorityBalanced}</Button>
          <Button type="button" aria-pressed={priority === 'priority'}
            onPress={() => onPriorityChange('priority')} variant="secondary">{priority === 'priority' ? <UiIcon sheet="prediction" cell="ok" /> : null}{ERA_CONSOLE_COPY.priorityConstruction}</Button>
          {model.reserveDeadlock && priority === 'balanced' ? (
            <Button type="button" onPress={() => onPriorityChange('priority')} variant="secondary">{CONSTRUCTION_DEADLOCK_COPY.action}</Button>
          ) : null}
        </div>
      ) : null}
      {model.irreversibleNotice === null ? null : (
        <p className="era-irrevocable">{model.irreversibleNotice}</p>
      )}
      <div className="era-actions">
        <Button
          className="era-action"
          type="button"
          disabled={!model.action.enabled}
          onPress={() => actionHandler?.()}
          aria-describedby="era-action-reason"
         variant="primary">
          {model.action.label}
        </Button>
        {model.proposal.recommendEnabled ? (
          <Button className="era-action era-action--secondary" type="button" onPress={() => onBeginProposal()} variant="secondary">{WALL_COPY.recommend}</Button>
        ) : null}
        {model.draft.canErase ? (
          <Button className="era-action era-action--secondary" type="button" onPress={() => onEraseDraftSegment?.()} variant="secondary">{WALL_COPY.eraseSegment}</Button>
        ) : null}
        {model.draft.editing ? (
          <Button className="era-action era-action--secondary" type="button" onPress={() => onCancelProposal()} variant="secondary">
            {model.expansion.editing ? WALL_EXPANSION_COPY.cancel : WALL_COPY.cancelDraft}
          </Button>
        ) : null}
        {model.expansion.available && onBeginExpansion !== undefined ? (
          <Button className="era-action era-action--secondary" type="button" data-action="begin-expansion" onPress={() => onBeginExpansion()} variant="secondary">{WALL_EXPANSION_COPY.begin}</Button>
        ) : null}
      </div>
      <small ref={actionReasonRef} id="era-action-reason" className="era-action-reason">
        {model.action.reason ?? (model.draft.editing ? WALL_COPY.proclamationNotice : WALL_COPY.startHint)}
      </small>
    </section>
  );
}

function actionReason(input: {
  readonly firstUnmet: EraRequirement | null;
  readonly state: GameState;
  readonly draft: PalisadeDraftState | null;
}): string | null {
  if (input.state.era === "stone_town") return ERA_CONSOLE_COPY.stoneTownAlreadyProclaimed;
  if (input.state.era === "palisade" && !stoneWallProjectAvailable(input.state)) return SCENARIO_COPY.stoneWallClosed;
  if (input.firstUnmet !== null) {
    return WALL_COPY.requirementProgress(input.firstUnmet.label, input.firstUnmet.current, input.firstUnmet.target);
  }
  if (input.state.era === 'hamlet' && input.draft !== null && input.draft.candidate === null) {
    return palisadeFailureLabel(input.draft.failureReason ?? 'open_polygon');
  }
  return null;
}

function actionLabel(input: {
  readonly state: GameState;
  readonly draft: PalisadeDraftState | null;
}): string {
  if (input.state.era === "palisade") return ERA_CONSOLE_COPY.proclaimStoneTown;
  if (input.state.era === "stone_town") return ERA_CONSOLE_COPY.stoneTownProclamationDone;
  return input.draft === null ? WALL_COPY.drawTool : input.draft.candidate === null ? WALL_COPY.closeDraft : WALL_COPY.confirm;
}

function selectedRunLabel(draft: PalisadeDraftState | null): string | null {
  if (draft === null || draft.selectedRunIndex === null || draft.candidate === null) return null;
  const run = draft.candidate.runs[draft.selectedRunIndex];
  return run === undefined ? null : WALL_COPY.selectedRun(draft.selectedRunIndex, run.steps);
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
