import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";

import type { GameSpeed, GameState, OverlayMode } from "./engine/engine.types";
import { validatePalisadeCandidate } from "./world/palisadeGeometry";
import { GameCanvas } from "./render/GameCanvas";
import { initialPalisadeDraft, type PalisadeDraftState } from "./render/palisadeDraftInteraction";
import type { PlacementTool } from "./render/renderer";
import { useGameStore } from "./state/gameStore";
import { PALETTE_CSS_VARIABLES } from "./styles/paletteVariables";
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
import { palisadeFootprintsForState, proposalSummaryForState } from "./ui/eraConsoleModel";
import { PopulationEventPanel } from "./ui/PopulationEventPanel";
import {
  appendPopulationEvents,
  diffPopulationEvents,
  type PopulationEvent,
} from "./ui/populationEventModel";

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
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [palisadeDraft, setPalisadeDraft] = useState<PalisadeDraftState | null>(null);
  const [populationEvents, setPopulationEvents] = useState<readonly PopulationEvent[]>([]);
  const [highlightedHouseIds, setHighlightedHouseIds] = useState<readonly string[]>([]);
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
    dispatch({ type: "confirm_palisade_proclamation", candidatePath: palisadeDraft.candidate.path });
    setPalisadeDraft(null);
  };

  return (
    <main
      className="app-shell"
      aria-label="Feudal Lord Simulator"
      style={PALETTE_CSS_VARIABLES as CSSProperties}
    >
      <h1 className="visually-hidden">Feudal Lord Simulator</h1>
      <GameCanvas
        selectedTool={selectedTool}
        overlayMode={overlayMode}
        highlightedHouseIds={highlightedHouseIds}
        palisadeDraft={palisadeDraft}
        onPalisadeDraftChange={setPalisadeDraft}
        onPalisadeDraftCancel={() => setPalisadeDraft(null)}
      />
      <PopulationEventPanel events={populationEvents} onSelectHouseIds={setHighlightedHouseIds} />
      <SettlementStatusLine state={guidanceSnapshotRef.current.state} selectedTool={selectedTool} />
      {welcomeVisible ? <WelcomeParchment onDismiss={() => setWelcomeVisible(false)} /> : null}
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
            <EraConsole
              model={eraModel}
              onBeginProposal={beginPalisadeProposal}
              onConfirmProposal={confirmPalisadeProposal}
              onCancelProposal={() => setPalisadeDraft(null)}
            />
            <OnboardingTasks view={onboardingView} />
            <CourtLedger
              tick={state.tick}
              timber={state.treasuryTimber}
              selectedTool={selectedTool}
              population={state.population}
              idleWorkers={state.idleWorkers}
              stockTotals={stockTotals}
            />
            <EconomyOverlayControls overlayMode={overlayMode} onChange={setOverlayMode} />
          </div>
          <SpeedSeals speed={speed} onChange={setSpeed} />
        </div>
      </aside>
    </main>
  );
}

function WelcomeParchment({ onDismiss }: { readonly onDismiss: () => void }) {
  const consumeDismissal = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDismiss();
  };

  return (
    <div className="welcome-dismiss-layer" onClick={consumeDismissal}>
      <section className="welcome-parchment" aria-label="Opening guidance">
        <h2>영지에 오신 것을 환영합니다</h2>
        <p>왼쪽 아래 도장을 눌러 건물을 고르고, 지도를 클릭해 지으세요.</p>
        <p>마우스 휠로 확대, 드래그로 이동합니다.</p>
        <p className="welcome-dismiss">(아무 곳이나 클릭하여 시작)</p>
      </section>
    </div>
  );
}
