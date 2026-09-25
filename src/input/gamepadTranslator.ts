import { canvasToWorld, worldToCanvas, type CameraState, type Point } from "../render/camera";
import { reportInputDevice } from "./inputDevice";
import type { InputIntent, WorldPoint } from "./inputIntent";
import type { ArmedTools, MouseKeyboardTranslator } from "./mouseKeyboardTranslator";

// Gamepad (Gamepad API, standard mapping) -> input intents (TOUCH-1, design master 13.1 rule 4; spec
// docs/design/input-intents.md IN-7; action ids in controllerActions.ts). Polled once per frame.
//  - Map cursor: a point on the world plane. Left stick moves it (radial dead zone, speed CURSOR_TILES_PER_S rising to
//    CURSOR_MAX_TILES_PER_S while held), the d-pad steps one tile (repeat while held). The cursor is what the mouse
//    pointer is for the mouse: each move emits `point` (hover, placement ghost, brush cursor). Near the viewport edge
//    the camera follows it (EDGE_MARGIN px).
//  - Right stick pans the camera, the triggers zoom around the cursor (right in, left out).
//  - A = the mouse translator's left button at the cursor: tap = click (select / place; road: place or remove one
//    tile). With a stroke tool (road, zone, palisade) A held + cursor moves = a stroke, released = its end. Two A taps
//    within DOUBLE_PRESS_MS = a double click (closes a zone polygon).
//  - B = cancel: the global cancel (Esc) while a tool or a press is armed, else the cancel aimed at the cursor (the
//    construction site there, like a right click).
//  - X = zone brush: the next zone tool (burgage, arable, pasture, orchard, eraser, off). Y and Start = pause toggle,
//    Back = problem view, LB / RB = previous / next placement tool.

type PadButton = { readonly pressed: boolean; readonly value: number };
export type PadState = { readonly connected: boolean; readonly axes: readonly number[]; readonly buttons: readonly PadButton[]; readonly mapping?: string };
type CanvasRect = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

export type GamepadTranslatorContext = {
  readonly bounds: () => CanvasRect;
  readonly camera: () => CameraState;
  readonly armed: () => ArmedTools;
  readonly emit: (intent: InputIntent) => boolean;
  readonly mouse: Pick<MouseKeyboardTranslator, "pointerDown" | "pointerMove" | "pointerUp" | "click" | "keyDown" | "pressing">;
  readonly gamepads: () => readonly (PadState | null)[];
};

export const DEAD_ZONE = 0.2;
export const CURSOR_TILES_PER_S = 4;
export const CURSOR_MAX_TILES_PER_S = 12;
/** Seconds of full deflection until the cursor reaches its top speed. */
export const CURSOR_ACCELERATION_S = 1.2;
export const PAN_PX_PER_S = 900;
/** Zoom rate at full trigger: factor e^(rate * seconds). */
export const ZOOM_RATE = 1.4;
export const EDGE_MARGIN = 56;
export const DOUBLE_PRESS_MS = 350;
const DPAD_REPEAT_DELAY_MS = 300;
const DPAD_REPEAT_MS = 110;
/** One tile on the world plane (iso 64 x 32). */
const TILE_W = 64; const TILE_H = 32;
export const ZONE_TOOL_CYCLE = ["zone:burgage", "zone:arable", "zone:pasture", "zone:orchard", "zone:erase", "zone:off"] as const;

const BUTTON = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
/** The d-pad as screen steps: up / down move one tile up / down the screen (half a tile each way), left / right one tile across. */
const DPAD_STEPS: readonly (readonly [number, WorldPoint])[] = [
  [BUTTON.UP, { x: 0, y: -TILE_H }], [BUTTON.DOWN, { x: 0, y: TILE_H }], [BUTTON.LEFT, { x: -TILE_W, y: 0 }], [BUTTON.RIGHT, { x: TILE_W, y: 0 }],
];

function stick(x: number, y: number): { readonly x: number; readonly y: number; readonly magnitude: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= DEAD_ZONE) return { x: 0, y: 0, magnitude: 0 };
  const scaled = Math.min(1, (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE));
  return { x: (x / magnitude) * scaled, y: (y / magnitude) * scaled, magnitude: scaled };
}

export function createGamepadTranslator(context: GamepadTranslatorContext) {
  let cursor: WorldPoint | null = null;
  let previous: readonly boolean[] = [];
  let heldS = 0;
  let aDown = false;
  let lastAPress = -Infinity;
  const dpadNextAt = new Map<number, number>();
  let zoneIndex = -1;

  const client = (point: WorldPoint) => {
    const rect = context.bounds(); const canvas = worldToCanvas(point, context.camera());
    return { clientX: rect.left + canvas.x, clientY: rect.top + canvas.y };
  };
  const centre = (): WorldPoint => { const rect = context.bounds(); return canvasToWorld({ x: rect.width / 2, y: rect.height / 2 }, context.camera()); };
  const pad = (): PadState | null => context.gamepads().find(candidate => candidate !== null && candidate.connected) ?? null;

  /** Keep the cursor on screen: the camera follows it into the EDGE_MARGIN band. */
  const follow = () => {
    if (cursor === null) return;
    const rect = context.bounds(); const at = worldToCanvas(cursor, context.camera());
    const dx = at.x < EDGE_MARGIN ? EDGE_MARGIN - at.x : at.x > rect.width - EDGE_MARGIN ? rect.width - EDGE_MARGIN - at.x : 0;
    const dy = at.y < EDGE_MARGIN ? EDGE_MARGIN - at.y : at.y > rect.height - EDGE_MARGIN ? rect.height - EDGE_MARGIN - at.y : 0;
    if (dx !== 0 || dy !== 0) context.emit({ kind: "pan", dx, dy });
  };
  const moveCursor = (dx: number, dy: number) => {
    if (cursor === null || (dx === 0 && dy === 0)) return;
    cursor = { x: cursor.x + dx, y: cursor.y + dy };
    follow();
    const at = client(cursor);
    const rect = context.bounds();
    context.emit({ kind: "point", screen: { x: at.clientX - rect.left, y: at.clientY - rect.top } });
    if (aDown) context.mouse.pointerMove(at);
  };
  const strokeTool = () => { const armed = context.armed(); return armed.zone || armed.road || armed.palisade; };

  return {
    /** The map cursor on the world plane, once a pad has been used (null before). */
    cursor: (): WorldPoint | null => cursor,
    /** Put the cursor at the view centre (the first pad input, or a camera jump). */
    recentre(): void { cursor = centre(); },

    frame(nowMs: number, dtMs: number): void {
      const state = pad();
      if (state === null) { previous = []; heldS = 0; return; }
      const pressed = state.buttons.map(button => button.pressed || button.value > 0.5);
      const edge = (index: number) => pressed[index] === true && previous[index] !== true;
      const released = (index: number) => pressed[index] !== true && previous[index] === true;
      const left = stick(state.axes[0] ?? 0, state.axes[1] ?? 0);
      const right = stick(state.axes[2] ?? 0, state.axes[3] ?? 0);
      const trigger = (state.buttons[BUTTON.RT]?.value ?? 0) - (state.buttons[BUTTON.LT]?.value ?? 0);
      const active = left.magnitude > 0 || right.magnitude > 0 || Math.abs(trigger) > 0.05 || pressed.some(Boolean);
      if (!active && !previous.some(Boolean)) { previous = pressed; heldS = 0; return; }
      if (active) {
        reportInputDevice("gamepad");
        cursor ??= centre();
      }
      const seconds = Math.min(0.1, Math.max(0, dtMs / 1000));

      // Cursor: stick (accelerating) and d-pad (one tile per press, repeating).
      heldS = left.magnitude > 0 ? heldS + seconds : 0;
      const speed = (CURSOR_TILES_PER_S + (CURSOR_MAX_TILES_PER_S - CURSOR_TILES_PER_S) * Math.min(1, heldS / CURSOR_ACCELERATION_S)) * TILE_W;
      let dx = left.x * speed * seconds; let dy = left.y * speed * seconds;
      for (const [button, step] of DPAD_STEPS) {
        if (pressed[button] !== true) { dpadNextAt.delete(button); continue; }
        const due = dpadNextAt.get(button);
        if (due === undefined || nowMs >= due) {
          dx += step.x; dy += step.y;
          dpadNextAt.set(button, nowMs + (due === undefined ? DPAD_REPEAT_DELAY_MS : DPAD_REPEAT_MS));
        }
      }
      moveCursor(dx, dy);

      // Camera: right stick pans (the view moves with the stick), triggers zoom at the cursor.
      if (right.magnitude > 0) context.emit({ kind: "pan", dx: -right.x * PAN_PX_PER_S * seconds, dy: -right.y * PAN_PX_PER_S * seconds });
      if (Math.abs(trigger) > 0.05 && cursor !== null) {
        const anchor: Point = worldToCanvas(cursor, context.camera());
        context.emit({ kind: "zoom", factor: Math.exp(trigger * ZOOM_RATE * seconds), anchor });
      }

      // A: the left button at the cursor.
      if (edge(BUTTON.A) && cursor !== null) {
        const at = client(cursor);
        const double = nowMs - lastAPress <= DOUBLE_PRESS_MS;
        lastAPress = double ? -Infinity : nowMs;
        context.mouse.pointerDown({ button: 0, ...at, detail: double ? 2 : 1 });
        aDown = true;
        if (!strokeTool()) { context.mouse.pointerUp({ button: 0, ...at }); context.mouse.click(at); aDown = false; }
      }
      if (released(BUTTON.A) && aDown && cursor !== null) {
        const at = client(cursor);
        context.mouse.pointerUp({ button: 0, ...at });
        context.mouse.click(at);
        aDown = false;
      }
      // B: cancel.
      if (edge(BUTTON.B)) {
        const armed = context.armed();
        const busy = armed.zone || armed.road || armed.palisade || armed.tool === true || context.mouse.pressing();
        if (busy || cursor === null) { context.mouse.keyDown({ code: "Escape", key: "Escape", target: null }); aDown = false; }
        else context.emit({ kind: "cancel", world: cursor });
      }
      if (edge(BUTTON.X)) {
        zoneIndex = context.armed().zone ? (zoneIndex + 1) % ZONE_TOOL_CYCLE.length : 0;
        context.emit({ kind: "toolSelect", toolId: ZONE_TOOL_CYCLE[zoneIndex] as string });
      }
      if (edge(BUTTON.Y) || edge(BUTTON.START)) context.emit({ kind: "pauseToggle" });
      if (edge(BUTTON.BACK)) context.emit({ kind: "problemView" });
      if (edge(BUTTON.LB)) context.emit({ kind: "toolStep", step: -1 });
      if (edge(BUTTON.RB)) context.emit({ kind: "toolStep", step: 1 });
      previous = pressed;
    },
  };
}

export type GamepadTranslator = ReturnType<typeof createGamepadTranslator>;
