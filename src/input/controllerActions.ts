import type { InputIntentKind } from "./inputIntent";

// Controller action ids (B9, design master 13.1 rule 4): the table only. Real gamepad events and button glyphs are
// the P track; the keyboard column is what the mouse / keyboard translator binds today. Each action names the input
// intent it produces, so a gamepad translator only has to map buttons to these ids.

export type ControllerActionId = "select" | "confirm" | "cancel" | "tool_prev" | "tool_next" | "zoom_in" | "zoom_out" | "pause" | "menu" | "cursor";

export type ControllerAction = {
  readonly id: ControllerActionId;
  /** Intent this action emits. */
  readonly intent: InputIntentKind;
  /** Default gamepad binding (13.1 rule 4; not wired yet). */
  readonly gamepad: string;
  /** Keyboard default binding (`KeyboardEvent.code`), as the translator binds it. */
  readonly keyboard: readonly string[];
  readonly note?: string;
};

export const CONTROLLER_ACTIONS: readonly ControllerAction[] = [
  { id: "cursor", intent: "pan", gamepad: "left stick / d-pad", keyboard: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"],
    note: "No map cursor yet: the keys move the camera (the view centre is the cursor). A gamepad cursor comes with the P track." },
  { id: "select", intent: "select", gamepad: "A", keyboard: [], note: "Mouse click / tap on the map; no key selects at the view centre yet." },
  { id: "confirm", intent: "confirm", gamepad: "A (while a gesture is open)", keyboard: ["Enter"], note: "Closes a zone polygon; double click does the same." },
  { id: "cancel", intent: "cancel", gamepad: "B", keyboard: ["Escape"] },
  { id: "tool_prev", intent: "toolStep", gamepad: "LB", keyboard: ["KeyQ"] },
  { id: "tool_next", intent: "toolStep", gamepad: "RB", keyboard: ["KeyE"] },
  { id: "zoom_in", intent: "zoom", gamepad: "right trigger", keyboard: ["Equal", "NumpadAdd"] },
  { id: "zoom_out", intent: "zoom", gamepad: "left trigger", keyboard: ["Minus", "NumpadSubtract"] },
  { id: "pause", intent: "pauseToggle", gamepad: "menu", keyboard: ["Space"], note: "Space tap; Space held + drag still pans (kept from before)." },
  { id: "menu", intent: "cancel", gamepad: "view", keyboard: [], note: "Reserved: opens the settings menu once it has a keyboard / pad focus order." },
];
