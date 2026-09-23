import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import { isProblemViewShortcut } from "./ui/problemViewShortcut";
import { CauseLegend } from "./ui/CauseLegend";
import { KO_UI } from "./content/locale.ko";
import type { GameState, OverlayMode } from "./engine/engine.types";
import { confirmPalisadeProclamation } from "./engine/palisade";
import { canProclaimPalisadeEra } from "./engine/era";
import { validatePalisadeCandidate } from "./world/palisadeGeometry";
import { GameCanvas } from "./render/GameCanvas";
import { applyPalisadeIntent, initialOpenPalisadeDraft, initialPalisadeDraft, type PalisadeDraftState } from "./render/palisadeDraftInteraction";
import type { PlacementTool } from "./render/renderer";
import { useGameStore } from "./state/gameStore";
import { PALETTE_CSS_VARIABLES } from "./styles/paletteVariables";
import { createHouseMaterialWave, palisadeCenter } from "./render/buildingMaterialWave";
import { BuildSeals } from "./ui/BuildMenu";
import { EconomyOverlayControls, toggleOverlayByKey } from "./ui/EconomyOverlayControls";
import { OnboardingTasks, SettlementStatusLine } from "./ui/InfoPanel";
import { ResourceBar } from "./ui/ResourceBar";
import { SettlementPanel } from "./ui/SettlementPanel";
import { PopulationEventPanel } from "./ui/PopulationEventPanel";
import {
  createOnboardingPresentationState,
  getOnboardingTaskView,
  type OnboardingPresentationState,
  updateOnboardingPresentationState,
} from "./ui/onboardingTaskModel";
import { MapShield } from "./ui/OverlayControls";
import { SpeedSeals } from "./ui/SpeedControls";
import { EraConsole, buildEraConsoleModel } from "./ui/EraConsole";
import {
  createEraCeremonyPresentation,
  dismissEraCeremony,
  EraCeremonyBanner,
  observeEraCeremonyTransition,
  visibleEraCeremony,
} from "./ui/eraCeremonyModel";
import { palisadeFootprintsForState, proposalSummaryForState } from "./ui/eraConsoleModel";
import { palisadeCoreFootprintsForState } from './engine/palisadeFootprints';
import { wallConstructionPriority } from './engine/constructionReserve';
import {
  appendPopulationEvents,
  diffPopulationEvents,
  type PopulationEvent,
} from "./ui/populationEventModel";
import {
  createDistributorRouteHistory,
  observeDistributorRouteHistory,
  type DistributorRouteHistory,
} from "./ui/distributorRouteHistory";

const WELCOME_DISMISSED_KEY = "feudal-lord-simulator:welcome-dismissed:v1";

export function nextOnboardingPresentationCommit(input: {
  readonly gameState: GameState;
  readonly presentation: OnboardingPresentationState;
  readonly nowMs: number;
}): OnboardingPresentationState | null {
  const nextPresentation = updateOnboardingPresentationState(input);
  return nextPresentation === input.presentation ? null : nextPresentation;
}

export function nextDistributorRouteHistoryCommit(input: {
  readonly previousState: GameState;
  readonly nextState: GameState;
  readonly history: DistributorRouteHistory;
}): DistributorRouteHistory | null {
  const nextHistory = observeDistributorRouteHistory(input);
  return nextHistory === input.history ? null : nextHistory;
}

export function App() {
  const { state, dispatch, speed, setSpeed } = useGameStore();
  const [selectedTool, setSelectedTool] = useState<PlacementTool | null>(null);
  const [problemOnly, setProblemOnly] = useState(false);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("none");
  const [welcomeVisible, setWelcomeVisible] = useState(() => !readWelcomeDismissed());
  const [palisadeDraft, setPalisadeDraft] = useState<PalisadeDraftState | null>(null);
  const [populationEvents, setPopulationEvents] = useState<readonly PopulationEvent[]>([]);
  const [populationDrawerOpen, setPopulationDrawerOpen] = useState(false);
  const [highlightedHouseIds, setHighlightedHouseIds] = useState<readonly string[]>([]);
  const [distributorRouteHistory, setDistributorRouteHistory] = useState(
    createDistributorRouteHistory,
  );
  const distributorRouteHistoryRef = useRef(distributorRouteHistory);
  const [eraPresentation, setEraPresentation] = useState(() => createEraCeremonyPresentation(state.era));
  const previousPopulationStateRef = useRef(state);
  const previousDistributorRouteStateRef = useRef(state);
  const [presentationNowMs, setPresentationNowMs] = useState(() => Date.now());
  const [onboardingPresentation, setOnboardingPresentation] = useState(
    createOnboardingPresentationState,
  );
  const onboardingPresentationRef = useRef(onboardingPresentation);
  const guidanceSample = Math.floor(state.tick / 60);
  const guidanceSnapshotRef = useRef({
    sample: guidanceSample,
    state,
  });
  if (guidanceSnapshotRef.current.sample !== guidanceSample) {
    guidanceSnapshotRef.current = { sample: guidanceSample, state };
  }

  useEffect(() => {
    const nextHistory = nextDistributorRouteHistoryCommit({
      previousState: previousDistributorRouteStateRef.current,
      nextState: state,
      history: distributorRouteHistoryRef.current,
    });
    previousDistributorRouteStateRef.current = state;
    if (nextHistory === null) return;
    distributorRouteHistoryRef.current = nextHistory;
    setDistributorRouteHistory(nextHistory);
  }, [state]);

  useEffect(() => {
    const incoming = diffPopulationEvents(previousPopulationStateRef.current, state);
    previousPopulationStateRef.current = state;
    if (incoming.length > 0) {
      setPopulationEvents((existing) => appendPopulationEvents(existing, incoming));
    }
  }, [state]);

  useEffect(() => {
    const interval = window.setInterval(() => setPresentationNowMs(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const nextPresentation = nextOnboardingPresentationCommit({
      gameState: state,
      presentation: onboardingPresentationRef.current,
      nowMs: presentationNowMs,
    });
    if (nextPresentation === null) return;
    onboardingPresentationRef.current = nextPresentation;
    setOnboardingPresentation(nextPresentation);
  }, [presentationNowMs, state]);

  useEffect(() => {
    setEraPresentation((presentation) =>
      observeEraCeremonyTransition({ presentation, era: state.era, nowMs: presentationNowMs }),
    );
  }, [presentationNowMs, state.era]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editable = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (!editable && palisadeDraft !== null && (event.code === "Escape" || event.code === "KeyZ")) {
        event.preventDefault();
        setPalisadeDraft(current => current === null ? null : applyPalisadeIntent({ state, draft: current, intent: { type: event.code === "Escape" ? "cancel" : "undo" } }));
        return;
      }
      if (event.code === "Escape") {
        event.preventDefault();
        setPalisadeDraft(null);
        setSelectedTool(null);
        return;
      }
      if (event.code === "KeyO") {
        if (!isProblemViewShortcut(event.code, event.repeat, editable)) return;
        event.preventDefault();
        setProblemOnly(value => !value);
        return;
      }
      const nextMode = toggleOverlayByKey(event.code, overlayMode);
      if (nextMode === overlayMode) return;
      event.preventDefault();
      setOverlayMode(nextMode);
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [overlayMode, palisadeDraft, state]);

  const visibleCeremony = visibleEraCeremony(eraPresentation, presentationNowMs);
  const houseMaterialWave = eraPresentation.ceremony === null || state.palisade === null
    ? null
    : createHouseMaterialWave({
      buildings: state.buildings,
      center: palisadeCenter(state.palisade.polygon),
      startedAtMs: eraPresentation.ceremony.startedAtMs,
      targetMaterialEra: eraPresentation.ceremony.targetEra === "stone_town" ? "stone" : "palisade",
    });
  const onboardingView = getOnboardingTaskView(state, onboardingPresentation);
  const highlightedTools = onboardingView.current?.highlightTools ?? [];
  const eraModel = buildEraConsoleModel({ state, draft: palisadeDraft });
  const beginPalisadeDraw = () => {
    if (!canProclaimPalisadeEra(state)) return;
    setSelectedTool(null);
    setPalisadeDraft(initialOpenPalisadeDraft());
  };
  const beginPalisadeProposal = () => {
    if (!canProclaimPalisadeEra(state)) return;
    const footprints = palisadeFootprintsForState(state);
    const proposal = proposalSummaryForState(state, footprints);
    if (!proposal.ok) {
      setSelectedTool(null);
      setPalisadeDraft({ ...initialOpenPalisadeDraft(), path: proposal.attemptedPath ?? [],
        failureReason: proposal.reason, failurePoint: proposal.failurePoint ?? null,
        affectedFootprintIds: proposal.affectedFootprintIds ?? [] });
      return;
    }
    const validation = validatePalisadeCandidate(state, proposal.path, footprints, palisadeCoreFootprintsForState(state), 1);
    if (!validation.ok) return;
    setSelectedTool(null);
    setPalisadeDraft(initialPalisadeDraft(validation.candidate));
  };
  const confirmPalisadeProposal = () => {
    if (palisadeDraft?.candidate === null || palisadeDraft === null) return;
    const candidatePath = palisadeDraft.candidate.path;
    if (confirmPalisadeProclamation(state, candidatePath) === state) return;
    dispatch({ type: "confirm_palisade_proclamation", candidatePath });
    setPalisadeDraft(null);
  };
  const proclaimStoneTown = () => {
    dispatch({ type: "confirm_stone_town_proclamation" });
    setPalisadeDraft(null);
  };
  const cancelPalisadeDraft = useCallback(() => setPalisadeDraft(null), []);
  const dismissWelcome = () => {
    writeWelcomeDismissed();
    setWelcomeVisible(false);
  };

  return (
    <main
      className="app-shell"
      aria-label={KO_UI.appName}
      style={PALETTE_CSS_VARIABLES as CSSProperties}
    >
      <div
        className="app-interaction-layer"
        inert={welcomeVisible ? true : undefined}
        aria-hidden={welcomeVisible ? true : undefined}
      >
        <h1 className="visually-hidden">{KO_UI.appName}</h1>
        <ResourceBar
          paused={speed === 0}
          state={state}
          populationDrawerOpen={populationDrawerOpen}
          onPopulationDrawerToggle={() => setPopulationDrawerOpen((open) => !open)}
        />
        {populationDrawerOpen ? (
          <div id="population-ledger-drawer" className="ledger-population-drawer top-population-drawer">
            <PopulationEventPanel events={populationEvents} onSelectHouseIds={setHighlightedHouseIds} />
          </div>
        ) : null}
        <GameCanvas
          selectedTool={selectedTool}
          overlayMode={overlayMode}
          problemOnly={problemOnly}
          highlightedHouseIds={highlightedHouseIds}
          distributorRouteHistory={distributorRouteHistory}
          palisadeDraft={palisadeDraft}
          houseMaterialWave={houseMaterialWave}
          palisadeCeremonyStartedAtMs={visibleCeremony?.startedAtMs ?? null}
          onPalisadeDraftChange={setPalisadeDraft}
          onPalisadeDraftCancel={cancelPalisadeDraft}
        />
        <SettlementStatusLine state={guidanceSnapshotRef.current.state} selectedTool={selectedTool} />
        <EraCeremonyBanner
          ceremony={visibleCeremony}
          nowMs={presentationNowMs}
          onDismiss={() => setEraPresentation(dismissEraCeremony)}
        />
        <aside className="right-info-rail" aria-label={KO_UI.informationRail}>
          <SettlementPanel state={state} onRestart={() => dispatch({ type: "restart_settlement" })} developmentContent={
            <EraConsole
              model={eraModel}
              priority={wallConstructionPriority(state)}
              onPriorityChange={priority => dispatch({ type: 'set_wall_construction_priority', priority })}
              onBeginProposal={beginPalisadeProposal}
              onBeginDraw={beginPalisadeDraw}
              onConfirmProposal={confirmPalisadeProposal}
              onCancelProposal={() => setPalisadeDraft(null)}
              onEraseDraftSegment={() => setPalisadeDraft(current => current === null || current.selectedRunIndex === null
                ? current : applyPalisadeIntent({ state, draft: current, intent: { type: 'eraseSegment', index: current.selectedRunIndex } }))}
              onProclaimStoneTown={proclaimStoneTown}
            />
          } />
          <OnboardingTasks view={onboardingView} state={state} warningState={guidanceSnapshotRef.current.state} />
          {problemOnly ? <CauseLegend /> : null}
        </aside>
        <aside className="court-console" aria-label={KO_UI.courtConsole}>
          <div className="court-recess map-recess">
            <details className="command-disclosure"><summary>지도</summary><div className="command-popover"><MapShield grid={state} /></div></details>
          </div>
          <div className="court-recess seal-recess">
            <BuildSeals
              selectedTool={selectedTool}
              state={state}
              highlightedTools={highlightedTools}
              onSelect={tool => { setPalisadeDraft(null); setSelectedTool(tool); }}
              palisadeDrawing={palisadeDraft?.mode === 'draw'}
              onStartPalisadeDrawing={beginPalisadeDraw}
            />
          </div>
          <div className="court-recess ledger-recess">
            <details className="command-disclosure ledger-stack"><summary>보기</summary><div className="command-popover">
              <EconomyOverlayControls overlayMode={overlayMode} onChange={setOverlayMode} problemOnly={problemOnly} onProblemOnlyChange={setProblemOnly} />
            </div></details>
            <SpeedSeals speed={speed} onChange={setSpeed} />
          </div>
        </aside>
      </div>
      {welcomeVisible ? <WelcomeParchment onDismiss={dismissWelcome} /> : null}
    </main>
  );
}

function WelcomeParchment({ onDismiss }: { readonly onDismiss: () => void }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const consumeDismissal = (event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDismiss();
  };
  const containKeyboard = (event: ReactKeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className="welcome-dismiss-layer"
      onPointerDown={consumeDismissal}
      onClick={consumeDismissal}
      onKeyDown={containKeyboard}
    >
      <section
        ref={dialogRef}
        className="welcome-parchment"
        role="dialog"
        aria-modal="true"
        aria-label={KO_UI.openingGuidance}
        tabIndex={-1}
      >
        <h2>영지에 오신 것을 환영합니다</h2>
        <p>아래 건설 메뉴에서 건물을 고르고, 지도를 클릭해 지으세요.</p>
        <p>마우스 휠로 확대, 드래그로 이동합니다.</p>
        <p className="welcome-dismiss">(아무 곳이나 클릭하여 시작)</p>
      </section>
    </div>
  );
}

function readWelcomeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WELCOME_DISMISSED_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function writeWelcomeDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
  } catch (_error) {
    return;
  }
}
