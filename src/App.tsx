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

import type { GameSpeed, GameState, OverlayMode } from "./engine/engine.types";
import { confirmPalisadeProclamation } from "./engine/palisade";
import { validatePalisadeCandidate } from "./world/palisadeGeometry";
import { GameCanvas } from "./render/GameCanvas";
import { initialPalisadeDraft, type PalisadeDraftState } from "./render/palisadeDraftInteraction";
import type { PlacementTool } from "./render/renderer";
import { useGameStore } from "./state/gameStore";
import { PALETTE_CSS_VARIABLES } from "./styles/paletteVariables";
import { createHouseMaterialWave, palisadeCenter } from "./render/buildingMaterialWave";
import { BuildSeals } from "./ui/BuildMenu";
import { EconomyOverlayControls, toggleOverlayByKey } from "./ui/EconomyOverlayControls";
import { CourtLedger, OnboardingTasks, SettlementStatusLine } from "./ui/InfoPanel";
import { economyStockTotals } from "./ui/ledgerModel";
import {
  createOnboardingPresentationState,
  getOnboardingTaskView,
  type OnboardingPresentationState,
  updateOnboardingPresentationState,
} from "./ui/onboardingTaskModel";
import { MapShield } from "./ui/OverlayControls";
import { SpeedSeals, speedToIntervalMs } from "./ui/SpeedControls";
import { EraConsole, buildEraConsoleModel } from "./ui/EraConsole";
import {
  createEraCeremonyPresentation,
  dismissEraCeremony,
  EraCeremonyBanner,
  observeEraCeremonyTransition,
  visibleEraCeremony,
} from "./ui/eraCeremonyModel";
import { palisadeFootprintsForState, proposalSummaryForState } from "./ui/eraConsoleModel";
import {
  appendPopulationEvents,
  diffPopulationEvents,
  type PopulationEvent,
} from "./ui/populationEventModel";

const WELCOME_DISMISSED_KEY = "feudal-lord-simulator:welcome-dismissed:v1";

export function nextOnboardingPresentationCommit(input: {
  readonly gameState: GameState;
  readonly presentation: OnboardingPresentationState;
  readonly nowMs: number;
}): OnboardingPresentationState | null {
  const nextPresentation = updateOnboardingPresentationState(input);
  return nextPresentation === input.presentation ? null : nextPresentation;
}

export function App() {
  const { state, dispatch } = useGameStore();
  const [selectedTool, setSelectedTool] = useState<PlacementTool | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("none");
  const [speed, setSpeed] = useState<GameSpeed>(0);
  const [welcomeVisible, setWelcomeVisible] = useState(() => !readWelcomeDismissed());
  const [palisadeDraft, setPalisadeDraft] = useState<PalisadeDraftState | null>(null);
  const [populationEvents, setPopulationEvents] = useState<readonly PopulationEvent[]>([]);
  const [populationDrawerOpen, setPopulationDrawerOpen] = useState(false);
  const [highlightedHouseIds, setHighlightedHouseIds] = useState<readonly string[]>([]);
  const [eraPresentation, setEraPresentation] = useState(() => createEraCeremonyPresentation(state.era));
  const previousPopulationStateRef = useRef(state);
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
    const intervalMs = speedToIntervalMs(speed);
    if (intervalMs === null) return undefined;
    const interval = window.setInterval(() => dispatch({ type: "advance_frame", speed }), intervalMs);
    return () => window.clearInterval(interval);
  }, [dispatch, speed]);

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
      if (event.code === "Escape") {
        event.preventDefault();
        setPalisadeDraft(null);
        setSelectedTool(null);
        return;
      }
      const nextMode = toggleOverlayByKey(event.code, overlayMode);
      if (nextMode === overlayMode) return;
      event.preventDefault();
      setOverlayMode(nextMode);
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [overlayMode]);

  const stockTotals = economyStockTotals(state);
  const visibleCeremony = visibleEraCeremony(eraPresentation, presentationNowMs);
  const houseMaterialWave = eraPresentation.ceremony === null || state.palisade === null
    ? null
    : createHouseMaterialWave({
      buildings: state.buildings,
      center: palisadeCenter(state.palisade.polygon),
      startedAtMs: eraPresentation.ceremony.startedAtMs,
    });
  const onboardingView = getOnboardingTaskView(state, onboardingPresentation);
  const highlightedTools = onboardingView.current?.highlightTools ?? [];
  const eraModel = buildEraConsoleModel({ state, draft: palisadeDraft });
  const beginPalisadeProposal = () => {
    const footprints = palisadeFootprintsForState(state);
    const proposal = proposalSummaryForState(state, footprints);
    if (!proposal.ok) return;
    const validation = validatePalisadeCandidate(state, proposal.path, footprints);
    if (!validation.ok) return;
    setSelectedTool(null);
    setPalisadeDraft(initialPalisadeDraft(validation.candidate));
  };
  const confirmPalisadeProposal = () => {
    if (palisadeDraft === null) return;
    const candidatePath = palisadeDraft.candidate.path;
    if (confirmPalisadeProclamation(state, candidatePath) === state) return;
    dispatch({ type: "confirm_palisade_proclamation", candidatePath });
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
      aria-label="Feudal Lord Simulator"
      style={PALETTE_CSS_VARIABLES as CSSProperties}
    >
      <div
        className="app-interaction-layer"
        inert={welcomeVisible ? true : undefined}
        aria-hidden={welcomeVisible ? true : undefined}
      >
        <h1 className="visually-hidden">Feudal Lord Simulator</h1>
        <GameCanvas
          selectedTool={selectedTool}
          overlayMode={overlayMode}
          highlightedHouseIds={highlightedHouseIds}
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
        <aside className="right-info-rail" aria-label="Information rail">
          <EraConsole
            model={eraModel}
            onBeginProposal={beginPalisadeProposal}
            onConfirmProposal={confirmPalisadeProposal}
            onCancelProposal={() => setPalisadeDraft(null)}
          />
          <OnboardingTasks view={onboardingView} />
        </aside>
        <aside className="court-console" aria-label="Court console">
          <div className="court-recess map-recess">
            <MapShield grid={state} />
          </div>
          <div className="court-recess seal-recess">
            <BuildSeals
              selectedTool={selectedTool}
              state={state}
              highlightedTools={highlightedTools}
              onSelect={setSelectedTool}
            />
          </div>
          <div className="court-recess ledger-recess">
            <div className="ledger-stack">
              <CourtLedger
                tick={state.tick}
                timber={state.treasuryTimber}
                selectedTool={selectedTool}
                population={state.population}
                idleWorkers={state.idleWorkers}
                stockTotals={stockTotals}
                populationEvents={populationEvents}
                populationDrawerOpen={populationDrawerOpen}
                onPopulationDrawerToggle={() => setPopulationDrawerOpen((open) => !open)}
                onSelectPopulationHouseIds={setHighlightedHouseIds}
              />
              <EconomyOverlayControls overlayMode={overlayMode} onChange={setOverlayMode} />
            </div>
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
        aria-label="Opening guidance"
        tabIndex={-1}
      >
        <h2>영지에 오신 것을 환영합니다</h2>
        <p>왼쪽 아래 도장을 눌러 건물을 고르고, 지도를 클릭해 지으세요.</p>
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
