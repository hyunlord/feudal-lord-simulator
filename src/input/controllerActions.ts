import type { InputIntentKind } from "./inputIntent";

// Controller action ids (B9, design master 13.1 rule 4). The gamepad column is what gamepadTranslator.ts binds
// (TOUCH-1, standard mapping); the keyboard column is what the mouse / keyboard translator binds. Each action names
// the input intent it produces. Button glyphs are the P track.

export type ControllerActionId = "select" | "confirm" | "cancel" | "tool_prev" | "tool_next" | "zoom_in" | "zoom_out" | "pause" | "menu" | "cursor" | "camera" | "zone_tool" | "problem_view";

export type ControllerAction = {
  readonly id: ControllerActionId;
  /** Intent this action emits. */
  readonly intent: InputIntentKind;
  /** Gamepad binding (13.1 rule 4; wired by gamepadTranslator.ts). */
  readonly gamepad: string;
  /** Keyboard default binding (`KeyboardEvent.code`), as the translator binds it. */
  readonly keyboard: readonly string[];
  readonly note?: string;
};

export const CONTROLLER_ACTIONS: readonly ControllerAction[] = [
  { id: "cursor", intent: "point", gamepad: "left stick / d-pad", keyboard: [],
    note: "The pad moves a map cursor (hover, ghost, brush cursor; the camera follows it at the edge). The mouse pointer is the cursor for the mouse; the keys move the camera (camera)." },
  { id: "camera", intent: "pan", gamepad: "right stick", keyboard: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"] },
  { id: "select", intent: "select", gamepad: "A", keyboard: [], note: "A = left button at the cursor: a tap selects or places; with a road, zone or palisade tool, A held + cursor move = a stroke." },
  { id: "confirm", intent: "confirm", gamepad: "A twice (while a zone polygon is open)", keyboard: ["Enter"], note: "Closes a zone polygon; double click / double tap do the same." },
  { id: "cancel", intent: "cancel", gamepad: "B", keyboard: ["Escape"], note: "With a tool or a press armed: the global cancel; else the cancel aimed at the cursor (right click)." },
  { id: "tool_prev", intent: "toolStep", gamepad: "LB", keyboard: ["KeyQ"] },
  { id: "tool_next", intent: "toolStep", gamepad: "RB", keyboard: ["KeyE"] },
  { id: "zone_tool", intent: "toolSelect", gamepad: "X", keyboard: [], note: "Next zone brush: burgage, arable, pasture, orchard, eraser, off." },
  { id: "zoom_in", intent: "zoom", gamepad: "right trigger", keyboard: ["Equal", "NumpadAdd"], note: "The pad zooms around the cursor." },
  { id: "zoom_out", intent: "zoom", gamepad: "left trigger", keyboard: ["Minus", "NumpadSubtract"] },
  { id: "pause", intent: "pauseToggle", gamepad: "Y / menu (Start)", keyboard: ["Space"], note: "Space tap; Space held + drag still pans (kept from before)." },
  { id: "problem_view", intent: "problemView", gamepad: "view (Back)", keyboard: ["KeyO"] },
  { id: "menu", intent: "cancel", gamepad: "-", keyboard: [], note: "Reserved: opens the settings menu once it has a keyboard / pad focus order (UI buttons stay DOM clicks, decision IN3)." },
];
