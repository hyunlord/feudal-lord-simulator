import { createPredictionPublisher } from "./placementPredictionRuntime";
import { proofFrameWork } from "../testing/proofFrameWork";
import { useEffect, useRef } from "react";
import { createZoneBrushContext, zoneBrushView } from "./canvasZoneBrushRuntime";

import { clampPan, type CameraState } from "./camera";
import { cameraAfterViewportResize, initialCamera, resizeCanvas } from "./canvasRuntime";
import { createCanvasMutableRefs } from "./canvasRuntimeRefs";
import { worldBounds } from "./interactions";
import { publishMinimapViewport } from "./minimapCameraJump";
import { preloadGameArt } from "./preloadGameArt";
import { drawCurrentCanvasFrame } from "./canvasRuntimeFrame";
import type { GameCanvasRuntimeInput } from "./gameCanvasRuntimeInput";
import { useGameCanvasRuntimeRefs } from "./useGameCanvasRuntimeRefs";
import { installPhase10ProofRuntime } from "../testing/phase10ProofRuntime";
import { setGroundSceneZoneDeferral } from "./groundBoundaryScene";
import { installAutoplayPulseRuntime } from "./autoplayPulseRuntime";
import { createCanvasIntentHandler } from "./canvasIntentHandler";
import { bindMouseKeyboard, bindTouch } from "../input/domInputBindings";
import { createMouseKeyboardTranslator, type ArmedTools } from "../input/mouseKeyboardTranslator";
import { createTouchTranslator } from "../input/touchTranslator";
import { createGamepadTranslator, type PadState } from "../input/gamepadTranslator";
import { lastInputDevice } from "../input/inputDevice";
import { drawMapCursor } from "./mapCursor";
import { INTENT_ORDER } from "../input/intentBus";
import { platformServices } from "../platform/platform";
import { preloadVisibilityArt } from "./visibilityArtManifest";
import { preloadWave7Art } from "./wave7Art";
import { preloadWave11Art } from "./wave11Art";
import { preloadCanvasIcons } from "../ui/uiArt";

// Game canvas runtime: frame loop, camera, and input. Input goes DOM event -> translator (src/input) -> intent bus
// (PlatformServices.input) -> handlers; the map's handler (canvasIntentHandler.ts) runs first, the app shell's after.
// Translators: mouse / keyboard, touch (drives the mouse translator's left button, TOUCH-1) and gamepad (polled each
// frame, a map cursor that drives the same left button; the cursor is drawn while the pad was the last device).

export function useGameCanvasRuntime(input: GameCanvasRuntimeInput): void {
  const {
    canvasRef,
    setPrediction,
    dispatch,
    highlightedHouseIds,
    overlayMode,
    problemOnly = false,
    selectedTool,
    selection,
    setHoveredBuilding,
    setSelection,
    state,
    palisadeDraft = null,
    houseMaterialWave = null,
    palisadeCeremonyStartedAtMs = null,
    onPalisadeDraftChange,
    onPalisadeDraftCancel, previousRenderState, interpolationAlpha,
  } = input;
  const { problemOnlyRef, highlightedHouseIdsRef, houseMaterialWaveRef, overlayModeRef, palisadeCeremonyStartedAtMsRef, palisadeDraftRef, previousRenderStateRef, selectedToolRef, selectionRef, stateRef, zoneToolRef } =
    useGameCanvasRuntimeRefs({ state, previousRenderState, selectedTool, overlayMode, problemOnly, selection, highlightedHouseIds, palisadeDraft, houseMaterialWave, palisadeCeremonyStartedAtMs, zoneTool: input.zoneTool ?? null });
  const zoneRadiusRef = useRef(input.onZoneRadiusChange); zoneRadiusRef.current = input.onZoneRadiusChange;
  const pendingRef = useRef(input.setPendingPlacement); pendingRef.current = input.setPendingPlacement;

  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext("2d") ?? null;
    if (canvas === null || context === null) return undefined;

    void preloadGameArt();
    // F0-V: the visibility art and the canvas icon sheets load with the rest (a paused first frame then has them).
    preloadVisibilityArt();
    preloadWave7Art();
    preloadWave11Art();
    preloadCanvasIcons();

    const refs = createCanvasMutableRefs(initialCamera(canvas, stateRef.current));
    const publishPanel = createPredictionPublisher(value => setPrediction?.(value));
    // UX-2 cursor: the placement verdict at the pointer (valid / invalid cursor art), written only when it changes.
    const publishPrediction = (preview: import("./overlays").PlacementPreview, camera: import("./camera").CameraState) => {
      const verdict = preview.tool === null || preview.tile === null ? "none" : preview.ok ? "ok" : "blocked";
      if (canvas.dataset.placement !== verdict) canvas.dataset.placement = verdict;
      publishPanel(preview, camera);
    };
    const bus = platformServices().input;
    let frameId = 0, lastFrameAtMs = performance.now(), userControlledCamera = false;
    const viewport = () => {
      const rect = canvas.getBoundingClientRect(); return { width: rect.width, height: rect.height };
    };
    const world = () => worldBounds(stateRef.current.width, stateRef.current.height);
    const clampCamera = (camera: CameraState): CameraState => clampPan(camera, viewport(), world());
    const zoneContext = createZoneBrushContext({ toolRef: zoneToolRef, radiusRef: zoneRadiusRef, refs, stateRef, dispatch, clampCamera });
    const armed = (): ArmedTools => ({
      zone: zoneToolRef.current !== null,
      zonePolygon: zoneToolRef.current?.polygon === true || zoneContext.zone.gestureRef.current?.mode === "polygon",
      palisade: palisadeDraftRef.current !== null,
      road: selectedToolRef.current === "road",
      tool: selectedToolRef.current !== null || zoneToolRef.current !== null || palisadeDraftRef.current !== null,
      building: selectedToolRef.current !== null && selectedToolRef.current !== "road" && zoneToolRef.current === null && palisadeDraftRef.current === null,
    });
    const setPending = (tile: { readonly tx: number; readonly ty: number } | null) => { refs.pendingPlacement.current = tile; pendingRef.current?.(tile); };
    const disposeHandler = bus.subscribe(createCanvasIntentHandler({
      canvas, refs, stateRef, selectedToolRef, palisadeDraftRef, zone: zoneContext, dispatch, setSelection, setHoveredBuilding, setPending,
      onPalisadeDraftChange, clampCamera, viewport, world, markUserControlled: () => { userControlledCamera = true; },
    }), INTENT_ORDER.world);
    const translator = createMouseKeyboardTranslator({
      bounds: () => canvas.getBoundingClientRect(), camera: () => refs.cameraRef.current, world, armed,
      emit: (intent, context) => bus.emit(intent, context),
    });
    const touch = createTouchTranslator({ bounds: () => canvas.getBoundingClientRect(), camera: () => refs.cameraRef.current, armed,
      emit: intent => bus.emit(intent), mouse: translator });
    const readPads = (): readonly (PadState | null)[] => typeof navigator !== "undefined" && typeof navigator.getGamepads === "function" ? [...navigator.getGamepads()] : [];
    const gamepad = createGamepadTranslator({ bounds: () => canvas.getBoundingClientRect(), camera: () => refs.cameraRef.current, armed,
      emit: intent => bus.emit(intent), mouse: translator, gamepads: readPads });
    const resize = () => {
      refs.pixelRatioRef.current = resizeCanvas(canvas, context);
      refs.cameraRef.current = cameraAfterViewportResize({ camera: refs.cameraRef.current, canvas, state: stateRef.current, userControlled: userControlledCamera });
    };
    const drawFrame = () => {
      const nowMs = performance.now();
      translator.frame(nowMs, lastFrameAtMs, viewport());
      gamepad.frame(nowMs, nowMs - lastFrameAtMs);
      lastFrameAtMs = nowMs;
      const work = proofFrameWork.current;
      const startedAt = work === null ? 0 : performance.now();
      drawCurrentCanvasFrame({ canvas, context, refs, publishPrediction, zoneBrush: zoneBrushView(zoneContext), state: stateRef.current, selectedTool: selectedToolRef.current, overlayMode: overlayModeRef.current, problemOnly: problemOnlyRef.current, selection: selectionRef.current, previousRenderState: previousRenderStateRef.current, interpolationAlpha, highlightedHouseIds: highlightedHouseIdsRef.current, palisadeDraft: palisadeDraftRef.current, houseMaterialWave: houseMaterialWaveRef.current, palisadeCeremonyStartedAtMs: palisadeCeremonyStartedAtMsRef.current });
      const cursor = gamepad.cursor();
      if (cursor !== null && lastInputDevice() === "gamepad") drawMapCursor(context, cursor, refs.cameraRef.current, refs.pixelRatioRef.current);
      if (work !== null) work.recordFrame(performance.now() - startedAt);
      publishMinimapViewport({ target: window, camera: refs.cameraRef.current, viewport: viewport(), world: world(), grid: stateRef.current });
      frameId = requestAnimationFrame(drawFrame);
    };
    resize();
    const disposeAutoplayPulse = installAutoplayPulseRuntime(refs.feedbackRef);
    const disposeProofRuntime = installPhase10ProofRuntime({ canvas, cameraRef: refs.cameraRef, stateRef, location: window.location, gamepadCursor: () => gamepad.cursor() });
    const disposeEvents = bindMouseKeyboard(canvas, translator, resize);
    const disposeZoneTouch = bindTouch(canvas, touch); setGroundSceneZoneDeferral(true);
    frameId = requestAnimationFrame(drawFrame);
    return () => {
      disposeZoneTouch(); setGroundSceneZoneDeferral(false);
      cancelAnimationFrame(frameId); disposeAutoplayPulse(); disposeEvents(); disposeProofRuntime(); disposeHandler();
    };
  }, [canvasRef, dispatch, onPalisadeDraftCancel, onPalisadeDraftChange, setHoveredBuilding, setSelection, setPrediction]);
}
