import { DEFAULT_SCENARIO_ID } from "./content/scenario/coreScenarios";
import { SCENARIO_COPY } from "./content/scenario/scenarioCopy.ko";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { CauseLegend } from "./ui/CauseLegend";
import { KO_UI } from "./content/locale.ko";
import type { GameState, OverlayMode } from "./engine/engine.types";
import { confirmPalisadeProclamation } from "./engine/palisade";
import { canProclaimPalisadeEra } from "./engine/era";
import { GameCanvas } from "./render/GameCanvas";
import { applyPalisadeIntent, initialExpansionDraft, initialOpenPalisadeDraft, initialPalisadeDraft, type PalisadeDraftState } from "./render/palisadeDraftInteraction";
import { cachedExpansionPreview, expansionStartCandidate, proposalDraftCandidate } from "./ui/wallExpansionModel";
import type { ZoneBrushTool } from "./render/zoneBrushInteraction";
import type { PlacementTool } from "./render/renderer";
import { useGameApi, useGameSpeed, useGameUiSelector } from "./state/gameStore";
import { presentedState } from "./render/presentation/presentedState";
import { usePresentationClock } from "./ui/usePresentationClock";
import { nextDistributorRouteHistoryCommit, useTickObservers } from "./ui/useTickObservers";
import { useSaveSystemContext } from "./state/saveSystem";
import { formatNewGameArchiveNotice } from "./content/saveCopy.ko";
import { PALETTE_CSS_VARIABLES } from "./styles/paletteVariables";
import { createHouseMaterialWave, palisadeCenter } from "./render/buildingMaterialWave";
import { BuildSeals } from "./ui/BuildMenu";
import { EconomyOverlayControls } from "./ui/EconomyOverlayControls";
import { SettlementStatusLine } from "./ui/InfoPanel";
import { SettlementPanel } from "./ui/SettlementPanel";
import { PopulationEventPanel } from "./ui/PopulationEventPanel";
import {
  createOnboardingPresentationState,
  type OnboardingPresentationState,
  updateOnboardingPresentationState,
} from "./ui/onboardingTaskModel";
import { MapShield } from "./ui/OverlayControls";
import { releaseControlFocus } from "./input/domInputBindings";
import { stateCalendar } from "./engine/scenarioState";
import { TITLE_COPY } from "./ui/titleCopy.ko";
import { wave8Url } from "./ui/wave8Art";
import { seasonJustClosed } from "./ui/seasonLedgerCard";
import { seasonLedgerAuto, setSeasonLedgerAuto } from "./ui/seasonLedgerPreference";
import type { BuildCategory } from "./ui/buildMenuPresentation";
import { autoPlacementOverlay } from "./ui/placementAutoOverlay";
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
import { wallConstructionPriority } from './engine/constructionReserve';
import { platformServices } from "./platform/platform";
import { INTENT_ORDER } from "./input/intentBus";
import { useAppIntents, ZONE_TOOL_OFF, ZONE_TOOL_PREFIX } from "./input/useAppIntents";
import { speedStepOf } from "./input/inputIntent";
import { bindPressClock, lastPressAt } from "./input/inputDevice";
import { UiIcon } from "./ui/UiIcon";
import { setPresentationSpeed } from "./render/presentationSpeed";
import { playSound, unlockAudio } from "./audio/audioEngine";
import { AudioControls } from "./ui/AudioControls";
import { COMPLETION_TOAST_MS } from "./ui/completionToast";
import { COMPLETION_TOAST_COPY } from "./ui/completionToastCopy.ko";
import { alertStackRows } from "./ui/alertStackModel";
import { useTutorialController } from "./ui/tutorial/useTutorialController";
import { GoalCards, GoalDrawer, PauseVeil, TutorialToggle, UnlockBanner } from "./ui/tutorial/TutorialShell";
import type { ControlLayer } from "./ui/tutorial/tutorialModel";
import { BUILD_MENU_COPY } from "./ui/buildMenuCopy.ko";
import { tutorialTargetCanvasPoint } from "./ui/tutorial/tutorialMapChannel";
import { readTutorialRecord } from "./ui/tutorial/tutorialStore";
import { Inspector } from "./ui/InspectorView";
import { QaOverlay } from "./ui/qa/QaOverlay";
import { hudVisibility, reduceUi, topModal } from "./ui/stateMachine/uiStateMachine";
import { useUiStateMachine } from "./ui/stateMachine/useUiStateMachine";
import { ActionDock, CrisisIcons, LayerSwitch, LedgerDrawer, StatusPill } from "./ui/hud/HudShell";
import { StuckGoodsChip, stuckGoodsChipView, useStuckGoods } from "./ui/hud/StuckGoodsChip";
import { statusPillModel } from "./ui/hud/statusPillModel";
import { ZoneToolbar } from "./ui/hud/ZoneToolbar";
import { zoneEditHistory } from "./render/zoneEditHistory";
import type { ZoneKind } from "./zones/zone.types";
import { EventCards } from "./ui/hud/EventCards";
import { decisionModal } from "./ui/eventStory";
import { personRow, stewardPerson } from "./ui/persons/personModels";
import { useStoryPresentation } from "./ui/hud/useStoryPresentation";
import { guidanceSampleKey } from "./ui/hud/guidanceSample";
import { AppModals } from "./ui/screens/AppModals";
import { readWelcomeDismissed, WelcomeParchment, writeWelcomeDismissed } from "./ui/screens/WelcomeScreen";
import { isDefaultLand, landStartCommand, type LandChoice } from "./ui/landChoice";
import { showChapterLoading, useChapterLoading } from "./ui/chapterLoadingStore";
import { menAwayLine } from "./ui/lordshipModel";

/** UX-0b: how long the season card waits after the last press before it opens (a press in flight is not swallowed). */
const LEDGER_PRESS_GRACE_MS = 700;

const CHAPTER_LOADING_MS = 900;
/** UX-2: the season icon beside the date (calendar season index → resource-sheet cell). */

export function nextOnboardingPresentationCommit(input: {
  readonly gameState: GameState;
  readonly presentation: OnboardingPresentationState;
  readonly nowMs: number;
}): OnboardingPresentationState | null {
  const nextPresentation = updateOnboardingPresentationState(input);
  return nextPresentation === input.presentation ? null : nextPresentation;
}

/** Kept here for its callers (tests): the tick observers own it now (`ui/useTickObservers`). */
export { nextDistributorRouteHistoryCommit };

export function App() {
  // CODE-1c: App reads the game on the UI channel (actions at once, ticks at most four times a second); the map and
  // the per-tick memories follow every tick through the store without rendering App.
  const store = useGameApi();
  const { dispatch, setSpeed } = store;
  const speed = useGameSpeed();
  const state = useGameUiSelector(presentedState);
  setPresentationSpeed(speed);
  const [selectedTool, setSelectedTool] = useState<PlacementTool | null>(null);
  const [problemOnly, setProblemOnly] = useState(false);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("none");
  const [welcomeOpen, setWelcomeVisible] = useState(() => !readWelcomeDismissed());
  const saveSystem = useSaveSystemContext();
  const welcomeVisible = welcomeOpen || saveSystem.offerContinue;
  const [palisadeDraft, setPalisadeDraft] = useState<PalisadeDraftState | null>(null);
  const [zoneTool, setZoneTool] = useState<ZoneBrushTool | null>(null);
  // LAND-UI (LU-D6): the fen's drain tool (its card in the build drawer); arming it drops the other tools, and they drop it.
  const [drainTool, setDrainTool] = useState(false);
  // UX-1: the control layer (직접 / 구역 / 방향) and the goal drawer.
  const [layer, setLayer] = useState<ControlLayer>("direct");
  // UX-1: the left inspector (a warning's `[보기]`: cause and action of that building).
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  // UI-5: the person card on screen (a modal) and the person a chronicle opens on.
  const [personCardId, setPersonCardId] = useState<string | null>(null);
  const [chroniclePersonId, setChroniclePersonId] = useState<string | null>(null);
  // UX-3: which UI is on screen is one state (ui/stateMachine: one panel slot, Esc one step, modals push / pop).
  const { ui, uiRef, setUi, sendUi } = useUiStateMachine(store);
  // QA-025: the chapter preview opened from the card's "목표 보기" (not after a chapter page) until it closes.
  const [chapterGoalsView, setChapterGoalsView] = useState(false);
  useEffect(() => { if (topModal(ui) !== "chapter_preview") setChapterGoalsView(false); }, [ui]);
  const openInspector = useCallback((id: string) => { setInspectedId(id); sendUi({ type: "select" }); }, [sendUi]);
  // The map's own selection card (GameCanvas) takes the same slot; closing it there leaves the selection state.
  const onCanvasSelection = useCallback((open: boolean) => { if (open) sendUi({ type: "select" }); else if (uiRef.current.mode === "selection") sendUi({ type: "deselect" }); }, [sendUi, uiRef]);
  const palisadeDraftRef = useRef(palisadeDraft);
  const gameStateRef = useRef(state);
  palisadeDraftRef.current = palisadeDraft;
  gameStateRef.current = state;
  // UX-3R2 / F0-V: the stores' stock samples, distributor routes, the population log and completed sites, per tick.
  const { storeHistoryRef, distributorRouteHistoryRef, populationEvents, completionToast } = useTickObservers(store);
  // UX-3R2: a ledger row lights the stores holding that resource on the map (cleared when the ledger closes).
  const [ledgerHighlight, setLedgerHighlight] = useState<readonly string[]>([]);
  const [highlightedHouseIds, setHighlightedHouseIds] = useState<readonly string[]>([]);
  const [eraPresentation, setEraPresentation] = useState(() => createEraCeremonyPresentation(state.era));
  // CODE-1c: the 100 ms presentation clock runs only while something on screen is timed by it (set below).
  const [clockWanted, setClockWanted] = useState(true);
  const presentationNowMs = usePresentationClock(clockWanted);
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
  // why: once a presentation frame (the frame clock is the key): the rail and the canvas are measured then
  }, [presentationNowMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const [onboardingPresentation, setOnboardingPresentation] = useState(
    createOnboardingPresentationState,
  );
  const onboardingPresentationRef = useRef(onboardingPresentation);
  // QA-030: the 60-tick bucket while time runs, the state itself while paused (guidanceSample.ts).
  const guidanceSample = guidanceSampleKey(state, speed);
  const guidanceSnapshotRef = useRef({
    sample: guidanceSample,
    state,
  });
  if (guidanceSnapshotRef.current.sample !== guidanceSample) {
    guidanceSnapshotRef.current = { sample: guidanceSample, state };
  }

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
    onOpenDrawer: () => sendUi({ type: "open_goals" }), onOpenChapterGoals: () => { setChapterGoalsView(true); sendUi({ type: "push_modal", modal: "chapter_preview" }); } });
  // Tool intents obey the tutorial's unlocks (menu, Q / E, controller X alike).
  const accessRef = useRef(tutorial.access);
  accessRef.current = tutorial.access;
  const selectPlacementTool = (tool: PlacementTool | null) => {
    if (tool !== null && !accessRef.current.tools(tool)) return;
    setPalisadeDraft(null); setSelectedTool(tool); setDrainTool(false); if (tool !== null) { setZoneTool(null); setLayer("direct"); }
  };
  const selectDrainTool = (armed: boolean) => {
    setDrainTool(armed); if (armed) { setPalisadeDraft(null); setSelectedTool(null); setZoneTool(null); setLayer("direct"); }
  };
  useEffect(() => { if (zoneTool !== null || palisadeDraft !== null) setDrainTool(false); }, [zoneTool, palisadeDraft]);
  // The app shell's input intents (B9, src/input/useAppIntents.ts).
  const { selectedToolRef } = useAppIntents({ speed, setSpeed, selectedTool, setSelectedTool, selectPlacementTool, palisadeDraftRef, setPalisadeDraft,
    gameStateRef, uiRef, setUi, setProblemOnly, setOverlayMode, setZoneTool, setLayer, accessRef });

  // UX-3: the underlying tool / zone / inspector states follow the UI state (and a tool picked by any route moves it).
  // UX-0b: the arable brush armed from the build drawer on the direct layer is a line tool like the road, so the drawer
  // closes and the marked land is in view (the audit painted blind under the open drawer).
  const directBrush = zoneTool !== null && layer === "direct";
  useEffect(() => {
    if (selectedTool !== null || palisadeDraft?.mode === "draw" || directBrush || drainTool) sendUi({ type: "pick_tool", line: selectedTool === "road" || palisadeDraft?.mode === "draw" || directBrush });
    else sendUi({ type: "tool_cleared" });
  }, [selectedTool, palisadeDraft?.mode, directBrush, drainTool, sendUi]);
  useEffect(() => { sendUi({ type: layer === "zone" ? "zone_on" : "zone_off" }); }, [layer, sendUi]);
  useEffect(() => {
    const placing = ui.mode === "placement" || ui.mode === "line";
    if (placing) releaseControlFocus(); // the picked card closed with the drawer; Space, Esc and ] go to the map
    if (!placing && selectedToolRef.current !== null) setSelectedTool(null);
    if (!placing && palisadeDraftRef.current?.mode === "draw") setPalisadeDraft(null);
    if (!placing) setDrainTool(false);
    if (ui.mode !== "zone" && ui.mode !== "build" && !placing) { setZoneTool(null); setLayer(current => current === "zone" ? "direct" : current); }
    if (ui.mode !== "selection") setInspectedId(null);
    if (ui.mode !== "ledger") setLedgerHighlight([]);
  }, [ui.mode, selectedToolRef]);
  // S-51: the placed building's overlay while its tool is up; the overlay before it comes back afterwards.
  const overlayModeRef = useRef(overlayMode);
  overlayModeRef.current = overlayMode;
  const autoOverlayRef = useRef<OverlayMode | null>(null);
  useEffect(() => {
    const auto = autoPlacementOverlay(selectedTool);
    if (auto !== null && autoOverlayRef.current === null) { autoOverlayRef.current = overlayModeRef.current; setOverlayMode(auto); }
    if (auto === null && autoOverlayRef.current !== null) { setOverlayMode(autoOverlayRef.current); autoOverlayRef.current = null; }
  }, [selectedTool]);
  // UI-3 (S-28): a season that closes while the game runs opens its ledger card, a modal (time stops until 계속),
  // unless the player turned it off. A jump of more than one closed season (a load) opens nothing. UI-4b: keyed on
  // the last closed season's end, not the count (the engine keeps eight, so after two years the count stood still and
  // the card never opened again): it opens when the season before the new one is the one last seen.
  const [ledgerAuto, setLedgerAuto] = useState(seasonLedgerAuto);
  const lastClosedEnd = state.seasons?.history.at(-1)?.endTick ?? null;
  const priorClosedEnd = state.seasons?.history.at(-2)?.endTick ?? null;
  const lastClosedEndRef = useRef(lastClosedEnd);
  // UX-0b: the card waits until the pointer has been still for LEDGER_PRESS_GRACE_MS (the cold start audit's presses at
  // a season's close landed on the card's backdrop four times and were lost).
  useEffect(() => bindPressClock(), []);
  useEffect(() => {
    const previous = lastClosedEndRef.current;
    lastClosedEndRef.current = lastClosedEnd;
    if (!seasonJustClosed(previous, lastClosedEnd, priorClosedEnd) || !ledgerAuto || welcomeVisible || topModal(uiRef.current) === "season_ledger") return;
    const open = () => setUi(current => topModal(current) === "season_ledger" ? current : reduceUi(current, { type: "push_modal", modal: "season_ledger" }));
    const wait = LEDGER_PRESS_GRACE_MS - (performance.now() - lastPressAt());
    if (wait <= 0) { open(); return; }
    const timer = window.setTimeout(open, wait);
    return () => window.clearTimeout(timer);
  }, [lastClosedEnd, priorClosedEnd, ledgerAuto, welcomeVisible, setUi, uiRef]);
  // The card's next objective opens the build drawer at its category (the tutorial's request path, its own nonce).
  const [menuRequest, setMenuRequest] = useState<{ readonly category: BuildCategory; readonly nonce: number } | null>(null);
  useEffect(() => { setMenuRequest(null); }, [tutorial.openRequest]);
  const visibility = hudVisibility(ui, { tutorialRunning: tutorial.running });
  // UI-4: the town's story beats (fire, wet summer, famine, petition, chapter end): chips after the world, decisions
  // and the chronicle as modals (useStoryPresentation).
  const story = useStoryPresentation({ state, nowMs: presentationNowMs, blocked: welcomeVisible, topModal: topModal(ui),
    pushModal: modal => sendUi({ type: "push_modal", modal }), pause: () => setSpeed(0),
    markChapterSeen: chapter => dispatch({ type: "mark_chapter_page_seen", chapter }) });
  const stewardOfTown = stewardPerson(state);
  const steward = stewardOfTown === null ? null : personRow(state, stewardOfTown);
  const openPerson = (id: string) => { setPersonCardId(id); sendUi({ type: "push_modal", modal: "person_card" }); };
  // UX-3R2 zone toolbar: the brush and the polygon paint the last kind chosen (the first open kind before any); the
  // redo list belongs to one painting session (cleared when the zone tool goes down).
  const [lastZoneKind, setLastZoneKind] = useState<ZoneKind | null>(null);
  const zoneTarget = zoneTool?.target ?? null;
  useEffect(() => { if (zoneTarget !== null && zoneTarget !== "erase") setLastZoneKind(zoneTarget); }, [zoneTarget]);
  const zoneToolDown = zoneTool === null;
  useEffect(() => { if (zoneToolDown) zoneEditHistory.clear(); }, [zoneToolDown]);
  const toolbarKind = lastZoneKind ?? (["burgage", "arable", "pasture", "orchard"] as const).find(kind => tutorial.access.zoneTargets(kind)) ?? null;
  const pickZoneMode = (target: ZoneKind | "erase", polygon: boolean) => {
    if (target !== zoneTool?.target) platformServices().input.emit({ kind: "toolSelect", toolId: `${ZONE_TOOL_PREFIX}${target}` });
    setZoneTool(current => current === null ? current : { ...current, polygon });
  };

  // UX-2: an immediate warning in the town puts the active goal cards in their warning frame (same sampled state as
  // the warning stack, recomputed only when that sample changes).
  const guidanceState = guidanceSnapshotRef.current.state;
  const alertRows = useMemo(() => alertStackRows(guidanceState), [guidanceState]);
  // UI-AUDIT-1: stock piled in one building that cannot leave (the HUD's totals hide it), beside the crisis bells.
  const stuckRows = useStuckGoods(guidanceState);
  const stuckChip = useMemo(() => stuckGoodsChipView(guidanceState, stuckRows), [guidanceState, stuckRows]);
  const immediateWarning = alertRows.some(row => row.severity === "immediate");
  // UX-3 cache (AGENTS rule 10): the status pill's numbers (food days walk every store, money the ledger totals) —
  // key: the sampled guidance state, reason: App renders every tick and the pill's numbers change slowly; measured on
  // the DGX perf board (lots24 still p95 11.9 ms with a per-render model and duplicate alert rows, trunk 10.3 ms).
  const pillModel = useMemo(() => statusPillModel(guidanceState), [guidanceState]);
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
  // AUDIO-1: an unlock banner rings its own short call (the info tone stays the alert rows').
  useEffect(() => { if (tutorial.banner !== null) playSound("unlock_banner"); }, [tutorial.banner]);
  // Sound starts with the player's first input intent (a press or key, so the browser's autoplay rule allows it).
  useEffect(() => platformServices().input.subscribe(() => { unlockAudio(import.meta.env?.BASE_URL ?? "/"); return undefined; }, INTENT_ORDER.world - 1), []);
  // F0-V: completions grouped into one toast (names within COMPLETION_GROUP_MS, shown for COMPLETION_TOAST_MS).
  const toastVisible = completionToast !== null && presentationNowMs - completionToast.firstAtMs < COMPLETION_TOAST_MS;
  const visibleCeremony = visibleEraCeremony(eraPresentation, presentationNowMs);
  // CODE-1c: the clock runs for the tutorial, the era ceremony and the toast (story chips wake themselves).
  const clockNeeded = tutorial.awaitsClock || visibleCeremony !== null || toastVisible;
  useEffect(() => { setClockWanted(clockNeeded); }, [clockNeeded]);
  const houseMaterialWave = eraPresentation.ceremony === null || state.palisade === null
    ? null
    : createHouseMaterialWave({
      buildings: state.buildings,
      center: palisadeCenter(state.palisade.polygon),
      startedAtMs: eraPresentation.ceremony.startedAtMs,
      targetMaterialEra: eraPresentation.ceremony.targetEra === "stone_town" ? "stone" : "palisade",
    });
  const highlightedTools: readonly PlacementTool[] = [];
  // LAND-UI perf: the era console is shown only in the goal drawer; its model (the hamlet's palisade proposal, 0.6 s on a
  // water-heavy map whenever the terrain or the timber flags change) is built only while the drawer is open.
  const eraModel = ui.mode === "goals" ? buildEraConsoleModel({ state, draft: palisadeDraft }) : null;
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
    const candidate = proposalDraftCandidate(state, proposal.path, footprints);
    if (candidate === null) return;
    setSelectedTool(null);
    setPalisadeDraft(initialPalisadeDraft(candidate));
  };
  const confirmPalisadeProposal = () => {
    if (palisadeDraft?.candidate === null || palisadeDraft === null) return;
    const candidatePath = palisadeDraft.candidate.path;
    if (confirmPalisadeProclamation(state, candidatePath) === state) return;
    dispatch({ type: "confirm_palisade_proclamation", candidatePath });
    setPalisadeDraft(null);
  };
  // UX-0b2 WALL-2: widen the standing wall — a draft from the wall as it stands, proclaimed when the engine accepts it.
  const beginPalisadeExpansion = () => {
    const candidate = expansionStartCandidate(state);
    if (candidate === null) return;
    setSelectedTool(null);
    setZoneTool(null);
    setPalisadeDraft(initialExpansionDraft(candidate));
  };
  const confirmPalisadeExpansion = () => {
    if (palisadeDraft === null || palisadeDraft.purpose !== "expand") return;
    const candidatePath = palisadeDraft.candidate?.path ?? palisadeDraft.path;
    if (!cachedExpansionPreview(state, candidatePath).ok) return;
    dispatch({ type: "expand_palisade", candidatePath });
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
  // UI-3: a new game opens on the chapter's loading screen for a moment (chapter 1 reuses the title keyart; the
  // 1315 / 1337 / 1348 screens are registered for the later chapters). It never takes a click. NAT-4: its flag lives
  // outside this component (chapterLoadingStore.ts): a start that sends start_new_game remounts the app.
  const chapterLoading = useChapterLoading();
  // LAND-UI (LU-D7): every start takes the land picked on the welcome; the riverside on map 1 (the default) is today's
  // start exactly, any other land sends its land and seed and gives the tutorial no state (as a start over a save does).
  // A click anywhere starts the picked land too.
  const dismissWelcome = (land: LandChoice) => {
    if (!saveSystem.offerContinue && !isDefaultLand(land)) { showChapterLoading(CHAPTER_LOADING_MS); startScenarioWithoutSave(DEFAULT_SCENARIO_ID, land); return; }
    writeWelcomeDismissed();
    setWelcomeVisible(false);
    if (saveSystem.offerContinue) saveSystem.declineContinue();
    else tutorial.startNewGame(welcomeTutorial, state);
  };
  const startNewGameOverSave = (scenarioId: string, land: LandChoice) => {
    writeWelcomeDismissed();
    setWelcomeVisible(false);
    dispatch(landStartCommand(scenarioId, land, true) ?? { type: "start_new_game", scenarioId });
    saveSystem.startNewGame();
    tutorial.startNewGame(welcomeTutorial && scenarioId === DEFAULT_SCENARIO_ID, null);
  };
  const startScenarioWithoutSave = (scenarioId: string, land: LandChoice) => {
    writeWelcomeDismissed();
    setWelcomeVisible(false);
    const command = landStartCommand(scenarioId, land, false);
    if (command !== null) dispatch(command);
    tutorial.startNewGame(welcomeTutorial && scenarioId === DEFAULT_SCENARIO_ID, command === null ? state : null);
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
        // NAT-2 (QA-013): the open panel slot, so the crisis icons and event chips step left of it (hudShell.css).
        data-slot={ui.mode === "goals" || ui.mode === "population" || ui.mode === "selection" || ui.mode === "ledger" ? ui.mode : undefined}
        inert={welcomeVisible ? true : undefined}
        aria-hidden={welcomeVisible ? true : undefined}
      >
        <h1 className="visually-hidden">{KO_UI.appName}</h1>
        {/* UX-3: the only UI always on screen — status pill, speed, layer switch, action dock, crisis icons (at most 3). */}
        {visibility.statusPill ? <StatusPill state={state} model={pillModel} onOpenLedger={() => sendUi({ type: "toggle_ledger" })} onOpenPopulation={() => sendUi({ type: "open_population" })} /> : null}
        <GameCanvas
          selectedTool={selectedTool}
          overlayMode={overlayMode}
          problemOnly={problemOnly}
          highlightedHouseIds={ledgerHighlight.length > 0 ? ledgerHighlight : highlightedHouseIds}
          storeHistory={storeHistoryRef.current}
          distributorRouteHistory={distributorRouteHistoryRef.current}
          palisadeDraft={palisadeDraft}
          houseMaterialWave={houseMaterialWave}
          palisadeCeremonyStartedAtMs={visibleCeremony?.startedAtMs ?? null}
          onPalisadeDraftChange={setPalisadeDraft}
          onPalisadeDraftCancel={cancelPalisadeDraft}
          zoneTool={zoneTool}
          onZoneRadiusChange={radius => setZoneTool(current => current === null ? current : { ...current, radius })}
          drainTool={drainTool} onDrainToolChange={selectDrainTool}
          selectionOpen={ui.mode === "selection"} onSelectionChange={onCanvasSelection} onPerson={openPerson}
        />
        {/* NAT-2: the QA info overlay (settings → developer, key `): nothing mounted while it is off. */}
        <QaOverlay store={store} />
        <PauseVeil paused={speed === 0 && !welcomeVisible && topModal(ui) === null} />
        <div className="hud-time-cluster" data-frame="strip-top" role="group" aria-label={SCENARIO_COPY.calendarAria} hidden={!visibility.speed}>
          <SpeedSeals speed={speed} onChange={value => { platformServices().input.emit({ kind: "speed", value: speedStepOf(value) }); }}
            extraSettings={<><TutorialToggle enabled={tutorial.enabled} onChange={tutorial.setEnabled} /><AudioControls /></>} />
        </div>
        {visibility.crisis ? <CrisisIcons rows={alertRows} onInspect={openInspector}
          lead={stuckChip === null ? null : <StuckGoodsChip view={stuckChip} onInspect={openInspector} />} /> : null}
        {visibility.crisis ? <EventCards beats={story.visible} onDismiss={story.dismiss}
          onDecide={beat => { if (beat.decision !== null) sendUi({ type: "push_modal", modal: decisionModal(beat.decision) }); }} /> : null}
        {visibility.goalCard ? <aside ref={railRef} className={`goal-chip-rail${railSeeThrough ? " right-info-rail--see-through" : ""}`} aria-label={KO_UI.informationRail} data-placing={ui.mode === "placement" || ui.mode === "line" ? "true" : undefined}>
          <GoalCards tutorial={tutorial} maxActive={1} drawerOpen={ui.mode === "goals"} warn={immediateWarning} onToggleDrawer={() => sendUi({ type: "toggle_goals" })} />
        </aside> : null}
        {/* S-30: one panel slot — the goal log, the population log, the inspector or the ledger (the build drawer is below). */}
        {ui.mode === "goals" ? <aside className="slot-panel goal-slot" data-frame="slot" aria-label={KO_UI.informationRail}>
          <GoalDrawer open log={tutorial.log}>
            <SettlementStatusLine state={guidanceSnapshotRef.current.state} selectedTool={selectedTool} />
            <SettlementPanel state={state} onRestart={() => dispatch({ type: "restart_settlement" })} developmentContent={
              eraModel === null ? null : <EraConsole
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
                onBeginExpansion={beginPalisadeExpansion}
                onConfirmExpansion={confirmPalisadeExpansion}
              />
            } />
          </GoalDrawer>
        </aside> : null}
        {ui.mode === "population" ? (
          <div id="population-ledger-drawer" className="ledger-population-drawer slot-panel" data-frame="slot">
            <PopulationEventPanel events={populationEvents} onSelectHouseIds={setHighlightedHouseIds} note={menAwayLine(state)} />
          </div>
        ) : null}
        {ui.mode === "selection" && inspectedId !== null ? <div className="slot-panel inspector-slot" data-frame="slot"><Inspector state={state} buildingId={inspectedId} storeHistory={storeHistoryRef.current} stuck={stuckRows} onClose={() => sendUi({ type: "deselect" })}
          onPerson={openPerson} /></div> : null}
        {ui.mode === "ledger" ? <LedgerDrawer state={state} onInspect={openInspector} onClose={() => sendUi({ type: "toggle_ledger" })}
          history={storeHistoryRef.current} food={{ days: pillModel.foodDays }} highlighted={ledgerHighlight} onHighlight={setLedgerHighlight}
          viewTab={<EconomyOverlayControls overlayMode={overlayMode} onChange={setOverlayMode} problemOnly={problemOnly} onProblemOnlyChange={setProblemOnly} />}
          mapTab={<MapShield grid={state} />} onOpenChronicle={() => sendUi({ type: "push_modal", modal: "history" })} onPerson={openPerson} /> : null}
        <UnlockBanner text={tutorial.banner} />
        {toastVisible && completionToast !== null ? <div className="completion-toast" data-frame="toast" role="status" aria-label={COMPLETION_TOAST_COPY.region}>
          <UiIcon sheet="prediction" cell="ok" />{completionToast.names.length === 1 ? COMPLETION_TOAST_COPY.one(completionToast.names[0]!)
            : COMPLETION_TOAST_COPY.many(completionToast.names[0]!, completionToast.names.length - 1)}
        </div> : null}
        <EraCeremonyBanner
          ceremony={visibleCeremony}
          nowMs={presentationNowMs}
          onDismiss={() => setEraPresentation(dismissEraCeremony)}
        />
        {problemOnly ? <CauseLegend /> : null}
        {ui.mode === "zone" ? <ZoneToolbar tool={zoneTool} lastKind={toolbarKind} canUndo={(state.zoneUndo?.length ?? 0) > 0}
          eraserOpen={tutorial.access.zoneTargets("erase")} kindOpen={kind => tutorial.access.zoneTargets(kind)} pulse={tutorial.pulse} onPick={pickZoneMode}
          onRadius={radius => setZoneTool(current => current === null ? current : { ...current, radius })} /> : null}
        {/* Mounted in every state (their locks stay readable), hidden where the state clears them from the screen. */}
        <LayerSwitch layer={layer} access={tutorial.access} pulse={tutorial.pulse} hidden={!visibility.layers}
          onChange={next => { setLayer(next); if (next === "direct") setZoneTool(null); }} />
        <ActionDock hidden={!visibility.dock} buildOpen={ui.mode === "build"} ledgerOpen={ui.mode === "ledger"}
          onBuild={() => sendUi({ type: "toggle_build" })} onLedger={() => sendUi({ type: "toggle_ledger" })}
          advisor={tutorial.advisor} onDismissAdvisor={tutorial.dismissAdvisor}
          undo={{ enabled: newestSite !== undefined, attention: tutorial.cards.some(card => card.key === "well_done"), label: BUILD_MENU_COPY.undoHint, onUndo: undoLastSite }}
          stewardName={steward === null ? null : steward.name} />
        {/* S-21 build drawer (and the zone bar in S-24): the catalogue stays mounted so a goal card can open it. */}
        {/* UX-3R2: in the zone state the left zone panel holds the kinds and tools; the drawer stays closed. */}
        <aside className="court-console build-drawer" aria-label={KO_UI.courtConsole} data-open={ui.mode === "build" ? "true" : undefined} data-frame="strip-bottom">
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
            drainTool={drainTool} onDrainToolChange={selectDrainTool}
            access={tutorial.access}
            layer={layer}
            onLayerChange={next => { setLayer(next); if (next === "direct") setZoneTool(null); }}
            pulse={tutorial.pulse}
            openRequest={menuRequest ?? tutorial.openRequest}
            showLayers={false}
            open={ui.mode === "build"}
            onOpenChange={next => {
              if (next && uiRef.current.mode !== "zone") sendUi({ type: "open_build" });
              if (!next && uiRef.current.mode === "build") sendUi({ type: "toggle_build" });
            }}
          />
        </aside>
      </div>
      {/* CODE-1c: the modal screens (ui/screens/AppModals), reading the game themselves while one is up. */}
      <AppModals ui={ui} sendUi={sendUi} personCardId={personCardId} chroniclePersonId={chroniclePersonId} onChroniclePerson={setChroniclePersonId}
        steward={steward} onPerson={openPerson} ledgerAuto={ledgerAuto} onLedgerAuto={next => { setLedgerAuto(next); setSeasonLedgerAuto(next); }}
        onMenuRequest={setMenuRequest} tutorial={tutorial} chapterGoalsView={chapterGoalsView} />
      {chapterLoading ? <div className="chapter-loading" role="status" style={{ backgroundImage: `url("${wave8Url("keyart_title_bg")}")` }}>
        <p className="chapter-loading-title">{TITLE_COPY.chapter(stateCalendar(state).year)}</p><p className="chapter-loading-line">{TITLE_COPY.chapterLine}</p></div> : null}
      {welcomeVisible ? <WelcomeParchment
        onDismiss={dismissWelcome}
        continueLine={saveSystem.offerContinue ? saveSystem.latest?.summary?.line ?? "" : null}
        archiveNotice={saveSystem.latest?.summary ? formatNewGameArchiveNotice(saveSystem.latest.summary) : null}
        onContinue={continueSavedGame}
        onNewGame={(scenarioId, land) => { showChapterLoading(CHAPTER_LOADING_MS); startNewGameOverSave(scenarioId, land); }}
        onChooseMode={(scenarioId, land) => { showChapterLoading(CHAPTER_LOADING_MS); startScenarioWithoutSave(scenarioId, land); }}
        tutorialEnabled={welcomeTutorial}
        onTutorialChange={setWelcomeTutorial}
      /> : null}
    </main>
  );
}
