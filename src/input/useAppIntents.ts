import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { playSound } from "../audio/audioEngine";
import type { GameSpeed, GameState, OverlayMode } from "../engine/engine.types";
import { platformServices } from "../platform/platform";
import { applyPalisadeIntent, type PalisadeDraftState } from "../render/palisadeDraftInteraction";
import { presentationPreference, setPresentationPreference } from "../render/presentationPreferences";
import { steppedPlacementTool } from "../render/placementToolCycle";
import type { PlacementTool } from "../render/renderer";
import { DEFAULT_ZONE_BRUSH_RADIUS, type ZoneBrushTool } from "../render/zoneBrushInteraction";
import { toggleOverlayByKey } from "../ui/EconomyOverlayControls";
import { escapeOnce, reduceUi, topModal, type UiState } from "../ui/stateMachine/uiStateMachine";
import type { TutorialController } from "../ui/tutorial/useTutorialController";
import type { ControlLayer } from "../ui/tutorial/tutorialModel";
import { INTENT_ORDER } from "./intentBus";
import { SPEED_STEPS } from "./inputIntent";

/** `toolSelect` ids of the zone brushes (B9): `zone:<target>` arms one, `zone:off` disarms. */
export const ZONE_TOOL_PREFIX = "zone:";
export const ZONE_TOOL_OFF = "zone:off";

/**
 * CODE-1c (from App): the app shell's input intents (B9): after the map's handler, before menus (src/input/intentBus.ts).
 * Esc / Z on a palisade draft cancel or undo it (not while typing), Esc otherwise disarms every tool; O and 1-4 toggle
 * views; tool and speed intents come from the build menu, the speed seals and Q / E / Space.
 */
export function useAppIntents(input: {
  readonly speed: GameSpeed;
  readonly setSpeed: (speed: GameSpeed) => void;
  readonly selectedTool: PlacementTool | null;
  readonly setSelectedTool: Dispatch<SetStateAction<PlacementTool | null>>;
  readonly selectPlacementTool: (tool: PlacementTool | null) => void;
  readonly palisadeDraftRef: MutableRefObject<PalisadeDraftState | null>;
  readonly setPalisadeDraft: Dispatch<SetStateAction<PalisadeDraftState | null>>;
  readonly gameStateRef: MutableRefObject<GameState>;
  readonly uiRef: MutableRefObject<UiState>;
  readonly setUi: Dispatch<SetStateAction<UiState>>;
  readonly setProblemOnly: Dispatch<SetStateAction<boolean>>;
  readonly setOverlayMode: Dispatch<SetStateAction<OverlayMode>>;
  readonly setZoneTool: Dispatch<SetStateAction<ZoneBrushTool | null>>;
  readonly setLayer: Dispatch<SetStateAction<ControlLayer>>;
  readonly accessRef: MutableRefObject<TutorialController["access"]>;
}) {
  const { speed, setSpeed, selectedTool, setSelectedTool, palisadeDraftRef, setPalisadeDraft, gameStateRef, uiRef, setUi, setProblemOnly,
    setOverlayMode, setZoneTool, setLayer, accessRef } = input;
  const selectPlacementToolRef = useRef(input.selectPlacementTool);
  selectPlacementToolRef.current = input.selectPlacementTool;
  const selectPlacementTool = (tool: PlacementTool | null) => selectPlacementToolRef.current(tool);
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
        // UX-3 S-31: one step back (placement -> build drawer -> idle -> pause menu); the mode effect below drops the
        // zone brush or the inspector the new state no longer holds. A placement tool is dropped here, in the same
        // render as the step (as before UX-3), so a drag right after Esc already pans.
        if (uiRef.current.mode === "placement" || uiRef.current.mode === "line") setSelectedTool(null);
        setUi(current => escapeOnce(current));
        return "handled";
      case "panel":
        if (intent.panel === "hud") setUi(current => reduceUi(current, { type: "toggle_hud" }));
        // NAT-2: ` shows or hides the QA info overlay (the settings' developer switch).
        else if (intent.panel === "qa") setPresentationPreference("qaOverlay", !presentationPreference("qaOverlay"));
        // CHRON-1: C opens the chronicle over a state with no modal up, and closes it.
        else if (intent.panel === "chronicle") setUi(current => topModal(current) === "history" ? reduceUi(current, { type: "pop_modal" })
          : current.modals.length === 0 ? reduceUi(current, { type: "push_modal", modal: "history" }) : current);
        else setUi(current => reduceUi(current, { type: intent.panel === "build" ? "toggle_build" : "toggle_ledger" }));
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
  // The setters are React's (stable) and the rest is read through refs: one subscription for the app's life.
  }, INTENT_ORDER.app), [setSpeed, setPalisadeDraft, setSelectedTool, setUi, setProblemOnly, setOverlayMode, setZoneTool, setLayer, palisadeDraftRef, gameStateRef, uiRef, accessRef]);
  return { selectedToolRef };
}
