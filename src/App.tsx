import { CORE_SCENARIOS, DEFAULT_SCENARIO_ID } from "./content/scenario/coreScenarios";
import { SCENARIO_COPY } from "./content/scenario/scenarioCopy.ko";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import { CauseLegend } from "./ui/CauseLegend";
import { KO_UI } from "./content/locale.ko";
import type { GameSpeed, GameState, OverlayMode } from "./engine/engine.types";
import { confirmPalisadeProclamation } from "./engine/palisade";
import { canProclaimPalisadeEra } from "./engine/era";
import { validatePalisadeCandidate } from "./world/palisadeGeometry";
import { GameCanvas } from "./render/GameCanvas";
import { applyPalisadeIntent, initialOpenPalisadeDraft, initialPalisadeDraft, type PalisadeDraftState } from "./render/palisadeDraftInteraction";
import { DEFAULT_ZONE_BRUSH_RADIUS, type ZoneBrushTool } from "./render/zoneBrushInteraction";
import type { PlacementTool } from "./render/renderer";
import { useGameStore } from "./state/gameStore";
import { useSaveSystemContext } from "./state/saveSystem";
import { formatNewGameArchiveNotice, SAVE_COPY } from "./content/saveCopy.ko";
import { PALETTE_CSS_VARIABLES } from "./styles/paletteVariables";
import { createHouseMaterialWave, palisadeCenter } from "./render/buildingMaterialWave";
import { BuildSeals } from "./ui/BuildMenu";
import { EconomyOverlayControls, toggleOverlayByKey } from "./ui/EconomyOverlayControls";
import { SettlementStatusLine } from "./ui/InfoPanel";
import { ResourceBar } from "./ui/ResourceBar";
import { SettlementPanel } from "./ui/SettlementPanel";
import { PopulationEventPanel } from "./ui/PopulationEventPanel";
import {
  createOnboardingPresentationState,
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
import { platformServices } from "./platform/platform";
import { INTENT_ORDER } from "./input/intentBus";
import { SPEED_STEPS, speedStepOf } from "./input/inputIntent";
import { steppedPlacementTool } from "./render/placementToolCycle";
import { calendarLabel, stateCalendar } from "./engine/scenarioState";
import { UiIcon } from "./ui/UiIcon";
import { setPresentationSpeed } from "./render/presentationSpeed";
import { playSound, unlockAudio } from "./audio/audioEngine";
import { AudioControls } from "./ui/AudioControls";
import { COMPLETION_GROUP_MS, COMPLETION_TOAST_MS, completedSiteNames } from "./ui/completionToast";
import { COMPLETION_TOAST_COPY } from "./ui/completionToastCopy.ko";
import { alertStackRows } from "./ui/alertStackModel";
import { useTutorialController } from "./ui/tutorial/useTutorialController";
import { GoalCards, GoalDrawer, PauseVeil, StewardAdvisor, TutorialToggle, UnlockBanner } from "./ui/tutorial/TutorialShell";
import { TUTORIAL_COPY } from "./ui/tutorial/tutorialCopy.ko";
import type { ControlLayer } from "./ui/tutorial/tutorialModel";
import { BUILD_MENU_COPY } from "./ui/buildMenuCopy.ko";
import { AlertStack } from "./ui/AlertStackView";
import { tutorialTargetCanvasPoint } from "./ui/tutorial/tutorialMapChannel";
import { readTutorialRecord } from "./ui/tutorial/tutorialStore";
import { Inspector } from "./ui/InspectorView";

/** `toolSelect` ids of the zone brushes (B9): `zone:<target>` arms one, `zone:off` disarms. */
const ZONE_TOOL_PREFIX = "zone:";
const ZONE_TOOL_OFF = "zone:off";

const WELCOME_DISMISSED_KEY = "feudal-lord-simulator:welcome-dismissed:v1";
/** UX-2: the season icon beside the date (calendar season index → resource-sheet cell). */
const SEASON_ICON = ["spring", "summer", "autumn", "winter"] as const;

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
  setPresentationSpeed(speed);
  const [selectedTool, setSelectedTool] = useState<PlacementTool | null>(null);
  const [problemOnly, setProblemOnly] = useState(false);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("none");
  const [welcomeOpen, setWelcomeVisible] = useState(() => !readWelcomeDismissed());
  const saveSystem = useSaveSystemContext();
  const welcomeVisible = welcomeOpen || saveSystem.offerContinue;
  const [palisadeDraft, setPalisadeDraft] = useState<PalisadeDraftState | null>(null);
  const [zoneTool, setZoneTool] = useState<ZoneBrushTool | null>(null);
  // UX-1: the control layer (직접 / 구역 / 방향) and the goal drawer.
  const [layer, setLayer] = useState<ControlLayer>("direct");
  const [drawerOpen, setDrawerOpen] = useState(false);
  // UX-1: the left inspector (a warning's `[보기]`: cause and action of that building).
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const palisadeDraftRef = useRef(palisadeDraft);
  const gameStateRef = useRef(state);
  palisadeDraftRef.current = palisadeDraft;
  gameStateRef.current = state;
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
  // UX-0 H: the goal rail turns see-through while the tutorial's map target lies under it (checked on the 100 ms clock).
  const railRef = useRef<HTMLElement | null>(null);
  const [railSeeThrough, setRailSeeThrough] = useState(false);
  useEffect(() => {
    const point = tutorialTargetCanvasPoint(); const rail = railRef.current; const canvas = rail?.parentElement?.querySelector("canvas");
    let under = false;
    if (point !== null && rail !== null && canvas !== null && canvas !== undefined) {
      const box = rail.getBoundingClientRect(); const origin = canvas.getBoundingClientRect();
      const x = origin.left + point.x; const y = origin.top + point.y;
      under = x >= box.left - 24 && x <= box.right + 24 && y >= box.top - 24 && y <= box.bottom + 24;
    }
    if (under !== railSeeThrough) setRailSeeThrough(under);
  }, [presentationNowMs]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const tutorial = useTutorialController({ state, paused: speed === 0, selectedTool, zoneTool, layer, setLayer, nowMs: presentationNowMs,
    onOpenDrawer: () => setDrawerOpen(true) });
  // Tool intents obey the tutorial's unlocks (menu, Q / E, controller X alike).
  const accessRef = useRef(tutorial.access);
  accessRef.current = tutorial.access;
  const selectPlacementTool = (tool: PlacementTool | null) => {
    if (tool !== null && !accessRef.current.tools(tool)) return;
    setPalisadeDraft(null); setSelectedTool(tool); if (tool !== null) { setZoneTool(null); setLayer("direct"); }
  };
  // The app shell's input intents (B9): after the map's handler, before menus (src/input/intentBus.ts). Esc / Z on a
  // palisade draft cancel or undo it (not while typing), Esc otherwise disarms every tool; O and 1-4 toggle views;
  // tool and speed intents come from the build menu, the speed seals and Q / E / Space.
  const speedRef = useRef(speed);
  const resumeSpeedRef = useRef<GameSpeed>(speed === 0 ? 1 : speed);
  speedRef.current = speed;
  if (speed !== 0) resumeSpeedRef.current = speed;
  const selectedToolRef = useRef(selectedTool);
  selectedToolRef.current = selectedTool;
  useEffect(() => platformServices().input.subscribe((intent, context) => {
    switch (intent.kind) {
      case "cancel":
        if (intent.world !== undefined) return;
        if (context.target !== "text" && palisadeDraftRef.current !== null) {
          setPalisadeDraft(current => current === null ? null : applyPalisadeIntent({ state: gameStateRef.current, draft: current, intent: { type: "cancel" } }));
          return "handled";
        }
        if (selectedToolRef.current !== null || palisadeDraftRef.current !== null) playSound("place_cancel");
        setPalisadeDraft(null);
        setSelectedTool(null);
        setZoneTool(null);
        return "handled";
      case "undo":
        if (context.target === "text" || palisadeDraftRef.current === null) return;
        setPalisadeDraft(current => current === null ? null : applyPalisadeIntent({ state: gameStateRef.current, draft: current, intent: { type: "undo" } }));
        return "handled";
      case "problemView":
        setProblemOnly(value => !value);
        return "handled";
      case "overlayToggle":
        setOverlayMode(mode => toggleOverlayByKey(`Digit${intent.slot}`, mode));
        return "handled";
      case "toolSelect":
        if (intent.toolId === ZONE_TOOL_OFF) { setPalisadeDraft(null); setSelectedTool(null); setZoneTool(null); return "handled"; }
        if (intent.toolId?.startsWith(ZONE_TOOL_PREFIX) === true) {
          const target = intent.toolId.slice(ZONE_TOOL_PREFIX.length) as ZoneBrushTool["target"];
          const access = accessRef.current;
          const arableFromTrade = target === "arable" && access.arableCard;
          if (!access.zoneTargets(target) && !arableFromTrade) return "handled";
          setLayer(access.layers.zone && !(arableFromTrade && !access.zoneTargets(target)) ? "zone" : "direct");
          setPalisadeDraft(null);
          setSelectedTool(null);
          setZoneTool(current => ({ target, radius: current?.radius ?? DEFAULT_ZONE_BRUSH_RADIUS, polygon: current?.polygon ?? false }));
          return "handled";
        }
        selectPlacementTool(intent.toolId as PlacementTool | null);
        return "handled";
      case "toolStep":
        selectPlacementTool(steppedPlacementTool(gameStateRef.current, selectedToolRef.current, intent.step));
        return "handled";
      case "speed":
        setSpeed(SPEED_STEPS[intent.value]);
        return "handled";
      case "pauseToggle":
        setSpeed(speedRef.current === 0 ? resumeSpeedRef.current : 0);
        return "handled";
      default:
        return;
    }
  }, INTENT_ORDER.app), [setSpeed]);

  // UX-2: an immediate warning in the town puts the active goal cards in their warning frame (same sampled state as
  // the warning stack, recomputed only when that sample changes).
  const guidanceState = guidanceSnapshotRef.current.state;
  const alertRows = useMemo(() => alertStackRows(guidanceState), [guidanceState]);
  const immediateWarning = alertRows.some(row => row.severity === "immediate");
  // F0-V: a warning row that appears plays its tier (urgent / caution); the unlock banner plays the info sound.
  const heardAlertsRef = useRef<ReadonlySet<string> | null>(null);
  useEffect(() => {
    const ids = new Set(alertRows.map(row => row.id));
    const heard = heardAlertsRef.current;
    heardAlertsRef.current = ids;
    if (heard === null) return;
    const fresh = alertRows.filter(row => !heard.has(row.id));
    if (fresh.some(row => row.severity === "immediate")) playSound("alert_urgent");
    else if (fresh.length > 0) playSound("alert_warn");
  }, [alertRows]);
  useEffect(() => { if (tutorial.banner !== null) playSound("alert_info"); }, [tutorial.banner]);
  // Sound starts with the player's first input intent (a press or key, so the browser's autoplay rule allows it).
  useEffect(() => platformServices().input.subscribe(() => { unlockAudio(import.meta.env?.BASE_URL ?? "/"); return undefined; }, INTENT_ORDER.world - 1), []);
  // F0-V: completions grouped into one toast (names within COMPLETION_GROUP_MS, shown for COMPLETION_TOAST_MS).
  const previousCompletionStateRef = useRef(state);
  const [completionToast, setCompletionToast] = useState<{ readonly names: readonly string[]; readonly firstAtMs: number } | null>(null);
  useEffect(() => {
    const names = completedSiteNames(previousCompletionStateRef.current, state);
    previousCompletionStateRef.current = state;
    if (names.length === 0) return;
    const now = Date.now();
    setCompletionToast(current => current !== null && now - current.firstAtMs < COMPLETION_GROUP_MS
      ? { names: [...current.names, ...names], firstAtMs: current.firstAtMs } : { names, firstAtMs: now });
  }, [state]);
  const toastVisible = completionToast !== null && presentationNowMs - completionToast.firstAtMs < COMPLETION_TOAST_MS;
  const visibleCeremony = visibleEraCeremony(eraPresentation, presentationNowMs);
  const houseMaterialWave = eraPresentation.ceremony === null || state.palisade === null
    ? null
    : createHouseMaterialWave({
      buildings: state.buildings,
      center: palisadeCenter(state.palisade.polygon),
      startedAtMs: eraPresentation.ceremony.startedAtMs,
      targetMaterialEra: eraPresentation.ceremony.targetEra === "stone_town" ? "stone" : "palisade",
    });
  const highlightedTools: readonly PlacementTool[] = [];
  const eraModel = buildEraConsoleModel({ state, draft: palisadeDraft });
  const beginPalisadeDraw = () => {
    if (!canProclaimPalisadeEra(state)) return;
    setSelectedTool(null);
    setZoneTool(null);
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
  // UX-1: a new game from the welcome starts the tutorial when its toggle is on (campaign only; a city that is not a
  // fresh game, e.g. an injected fixture, never gets one).
  // The toggle starts from the stored choice (a player who switched the tutorial off keeps it off), else on.
  const [welcomeTutorial, setWelcomeTutorial] = useState(() => readTutorialRecord()?.enabled ?? true);
  const dismissWelcome = () => {
    writeWelcomeDismissed();
    setWelcomeVisible(false);
    if (saveSystem.offerContinue) saveSystem.declineContinue();
    else tutorial.startNewGame(welcomeTutorial, state);
  };
  const startNewGameOverSave = (scenarioId: string) => {
    writeWelcomeDismissed();
    setWelcomeVisible(false);
    dispatch({ type: "start_new_game", scenarioId });
    saveSystem.startNewGame();
    tutorial.startNewGame(welcomeTutorial && scenarioId === DEFAULT_SCENARIO_ID, null);
  };
  const startScenarioWithoutSave = (scenarioId: string) => {
    writeWelcomeDismissed();
    setWelcomeVisible(false);
    if (scenarioId !== DEFAULT_SCENARIO_ID) dispatch({ type: "start_new_game", scenarioId });
    tutorial.startNewGame(welcomeTutorial && scenarioId === DEFAULT_SCENARIO_ID, scenarioId === DEFAULT_SCENARIO_ID ? state : null);
  };
  // Undo (UX-1 HUD "undo"): cancels the newest construction site; the tutorial draws attention to it after the well.
  const newestSite = [...state.constructionSites].reverse().find(site => site.kind !== "palisade_segment" && site.kind !== "stone_wall_segment");
  const undoLastSite = () => { if (newestSite !== undefined) dispatch({ type: "cancel_construction", siteId: newestSite.id }); };
  const continueSavedGame = () => {
    writeWelcomeDismissed();
    setWelcomeVisible(false);
    saveSystem.continueLatest();
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
          onHighlightBuildings={setHighlightedHouseIds}
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
          zoneTool={zoneTool}
          onZoneRadiusChange={radius => setZoneTool(current => current === null ? current : { ...current, radius })}
        />
        <PauseVeil paused={speed === 0 && !welcomeVisible} />
        <div className="hud-time-cluster" role="group" aria-label={SCENARIO_COPY.calendarAria}>
          <span className="hud-date" data-testid="hud-calendar"><UiIcon sheet="resource" cell={SEASON_ICON[stateCalendar(state).season]} />{calendarLabel(state)}</span>
          <SpeedSeals speed={speed} onChange={value => { platformServices().input.emit({ kind: "speed", value: speedStepOf(value) }); }}
            extraSettings={<><TutorialToggle enabled={tutorial.enabled} onChange={tutorial.setEnabled} /><AudioControls /></>} />
        </div>
        <StewardAdvisor advisor={tutorial.advisor} onDismiss={tutorial.dismissAdvisor} />
        <div className="left-inspector-mount"><Inspector state={state} buildingId={inspectedId} onClose={() => setInspectedId(null)} /></div>
        <UnlockBanner text={tutorial.banner} />
        {toastVisible && completionToast !== null ? <div className="completion-toast" role="status" aria-label={COMPLETION_TOAST_COPY.region}>
          <UiIcon sheet="prediction" cell="ok" />{completionToast.names.length === 1 ? COMPLETION_TOAST_COPY.one(completionToast.names[0]!)
            : COMPLETION_TOAST_COPY.many(completionToast.names[0]!, completionToast.names.length - 1)}
        </div> : null}
        <SettlementStatusLine state={guidanceSnapshotRef.current.state} selectedTool={selectedTool} />
        <EraCeremonyBanner
          ceremony={visibleCeremony}
          nowMs={presentationNowMs}
          onDismiss={() => setEraPresentation(dismissEraCeremony)}
        />
        <aside ref={railRef} className={`right-info-rail${railSeeThrough ? " right-info-rail--see-through" : ""}`} aria-label={KO_UI.informationRail}>
          <GoalCards tutorial={tutorial} drawerOpen={drawerOpen} warn={immediateWarning} onToggleDrawer={() => setDrawerOpen(open => !open)} />
          <GoalDrawer open={drawerOpen} log={tutorial.log}>
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
          </GoalDrawer>
          <AlertStack state={guidanceSnapshotRef.current.state} onInspect={setInspectedId} />
          {problemOnly ? <CauseLegend /> : null}
        </aside>
        <aside className="court-console" aria-label={KO_UI.courtConsole}>
          <div className="court-recess map-recess">
            <button type="button" className="hud-undo" disabled={newestSite === undefined} aria-label={BUILD_MENU_COPY.undoHint}
              data-attention={tutorial.cards.some(card => card.key === "well_done") ? "true" : undefined} onClick={undoLastSite}>{BUILD_MENU_COPY.undo}</button>
          </div>
          <div className="court-recess seal-recess">
            <BuildSeals
              selectedTool={selectedTool}
              state={state}
              highlightedTools={highlightedTools}
              onSelect={tool => { platformServices().input.emit({ kind: "toolSelect", toolId: tool }); }}
              zoneTool={zoneTool}
              onZoneToolChange={tool => {
                // Arming another zone tool (or none) is a tool choice; radius and polygon are settings of the armed one.
                if (tool === null || tool.target !== zoneTool?.target) platformServices().input.emit({ kind: "toolSelect", toolId: tool === null ? ZONE_TOOL_OFF : `${ZONE_TOOL_PREFIX}${tool.target}` });
                else setZoneTool(tool);
              }}
              palisadeDrawing={palisadeDraft?.mode === 'draw'}
              onStartPalisadeDrawing={beginPalisadeDraw}
              access={tutorial.access}
              layer={layer}
              onLayerChange={next => { setLayer(next); if (next === "direct") setZoneTool(null); }}
              pulse={tutorial.pulse}
              openRequest={tutorial.openRequest}
            />
          </div>
          <div className="court-recess ledger-recess">
            <details className="command-disclosure"><summary>지도</summary><div className="command-popover"><MapShield grid={state} /></div></details>
            <details className="command-disclosure ledger-stack"><summary>보기</summary><div className="command-popover">
              <EconomyOverlayControls overlayMode={overlayMode} onChange={setOverlayMode} problemOnly={problemOnly} onProblemOnlyChange={setProblemOnly} />
            </div></details>
          </div>
        </aside>
      </div>
      {welcomeVisible ? <WelcomeParchment
        onDismiss={dismissWelcome}
        continueLine={saveSystem.offerContinue ? saveSystem.latest?.summary?.line ?? "" : null}
        archiveNotice={saveSystem.latest?.summary ? formatNewGameArchiveNotice(saveSystem.latest.summary) : null}
        onContinue={continueSavedGame}
        onNewGame={startNewGameOverSave}
        onChooseMode={startScenarioWithoutSave}
        tutorialEnabled={welcomeTutorial}
        onTutorialChange={setWelcomeTutorial}
      /> : null}
    </main>
  );
}

function WelcomeParchment({ onDismiss, continueLine, archiveNotice, onContinue, onNewGame, onChooseMode, tutorialEnabled, onTutorialChange }: {
  readonly tutorialEnabled: boolean;
  readonly onTutorialChange: (enabled: boolean) => void;
  readonly onDismiss: () => void;
  readonly continueLine: string | null;
  readonly archiveNotice: string | null;
  readonly onContinue: () => void;
  readonly onNewGame: (scenarioId: string) => void;
  readonly onChooseMode: (scenarioId: string) => void;
}) {
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const consumeDismissal = (event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // With a saved city on offer the player must choose explicitly; a stray click must not start over.
    if (continueLine === null) onDismiss();
  };
  const containKeyboard = (event: ReactKeyboardEvent) => {
    event.stopPropagation();
  };
  const keepChoice = (event: MouseEvent | PointerEvent) => {
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
        <TutorialToggle enabled={tutorialEnabled} onChange={onTutorialChange} />
        {continueLine === null ? <>
          <ScenarioModeButtons onChoose={scenarioId => onChooseMode(scenarioId)} keepChoice={keepChoice} />
          <p className="welcome-dismiss">(아무 곳이나 클릭하여 시작)</p>
        </> : (
          <div className="welcome-save" role="group" aria-label={SAVE_COPY.welcomeSaveLabel}>
            <p>{continueLine}</p>
            <button className="autoplay-toggle save-control-button" type="button"
              onPointerDown={keepChoice} onClick={event => { keepChoice(event); onContinue(); }}>
              {SAVE_COPY.continueGame}
            </button>
            {confirmingNewGame ? <>
              <p role="status">{archiveNotice}</p>
              <ScenarioModeButtons onChoose={onNewGame} keepChoice={keepChoice} />
              <button className="autoplay-toggle save-control-button" type="button"
                onPointerDown={keepChoice} onClick={event => { keepChoice(event); setConfirmingNewGame(false); }}>
                {SAVE_COPY.cancel}
              </button>
            </> : (
              <button className="autoplay-toggle save-control-button" type="button"
                onPointerDown={keepChoice} onClick={event => { keepChoice(event); setConfirmingNewGame(true); }}>
                {SAVE_COPY.newGame}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** New-game mode choice (B2): one button per registered scenario, in registration order. */
function ScenarioModeButtons({ onChoose, keepChoice }: {
  readonly onChoose: (scenarioId: string) => void;
  readonly keepChoice: (event: MouseEvent | PointerEvent) => void;
}) {
  return <div className="welcome-modes" role="group" aria-label={SCENARIO_COPY.modePrompt}>
    {CORE_SCENARIOS.map(scenario => <div key={scenario.id}>
      <button className="autoplay-toggle save-control-button" type="button"
        data-scenario={scenario.id} onPointerDown={keepChoice} onClick={event => { keepChoice(event); onChoose(scenario.id); }}>
        {SCENARIO_COPY.modeButtons[scenario.id === DEFAULT_SCENARIO_ID ? "campaign_market_town" : "sandbox"]}
      </button>
      <p className="welcome-mode-line">{TUTORIAL_COPY.modeLines[scenario.id === DEFAULT_SCENARIO_ID ? "campaign_market_town" : "sandbox"]}</p>
    </div>)}
  </div>;
}

function readWelcomeDismissed(): boolean {
  return platformServices().preferences.get(WELCOME_DISMISSED_KEY) === "1";
}

function writeWelcomeDismissed(): void {
  platformServices().preferences.set(WELCOME_DISMISSED_KEY, "1");
}
