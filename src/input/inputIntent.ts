// Input intents (B9, design master 13.1 rule 2): what the player means, whatever the device. Game-side handlers take
// only these; the mouse / keyboard translator (mouseKeyboardTranslator.ts) is one producer, touch and controller
// translators come later (P track). Points are canvas CSS pixels (`ScreenPoint`) or world screen pixels
// (`WorldPoint`, the iso plane the camera looks at: canvas = world * zoom + pan).

export type ScreenPoint = { readonly x: number; readonly y: number };
export type WorldPoint = { readonly x: number; readonly y: number };

/** Speed steps 0..3 map to the game speeds paused, 1x, 3x, 5x (`SPEED_STEPS`). */
export type SpeedStep = 0 | 1 | 2 | 3;
export const SPEED_STEPS = [0, 1, 3, 5] as const;

/** The step of a game speed (an unknown speed counts as 1x). */
export function speedStepOf(speed: number): SpeedStep {
  const step = SPEED_STEPS.indexOf(speed as (typeof SPEED_STEPS)[number]);
  return (step < 0 ? 1 : step) as SpeedStep;
}

/** The drawing tools a stroke can carry. */
export type StrokeToolId = "road" | "palisade" | "zone";

export type InputIntent =
  /** A tap or click on the map: select what is there, or with a placement tool armed, place it. */
  | { readonly kind: "select"; readonly world: WorldPoint }
  /** Finish the gesture in progress (closes a zone polygon; Enter, double click, controller A). */
  | { readonly kind: "confirm" }
  /**
   * Drop the gesture in progress. `world` set: aimed at the map (right click: drops a drawing gesture, else cancels
   * the construction site there); unset: the global cancel (Esc, controller B), which also disarms the tool.
   */
  | { readonly kind: "cancel"; readonly world?: WorldPoint }
  /** Ask about what is there without selecting it (reserved for long press / controller; the mouse uses `point`). */
  | { readonly kind: "inspect"; readonly world: WorldPoint }
  /** Move the camera by this many canvas pixels. */
  | { readonly kind: "pan"; readonly dx: number; readonly dy: number }
  /** Zoom by `factor` around `anchor` (canvas pixels). */
  | { readonly kind: "zoom"; readonly factor: number; readonly anchor: ScreenPoint }
  /** Start drawing with a tool (road, palisade draft, zone brush); `polygon` adds a zone polygon vertex instead. */
  | { readonly kind: "strokeBegin"; readonly toolId: StrokeToolId; readonly world: WorldPoint; readonly polygon?: boolean }
  | { readonly kind: "strokeMove"; readonly world: WorldPoint }
  /** `outside`: released off the map (a road drag then places nothing). */
  | { readonly kind: "strokeEnd"; readonly world: WorldPoint; readonly outside?: boolean }
  | { readonly kind: "undo" }
  | { readonly kind: "toolSelect"; readonly toolId: string | null }
  | { readonly kind: "speed"; readonly value: SpeedStep }
  // B9 extensions (not in design master 13.1; device-free meanings, see docs/design/input-intents.md IN-2):
  /** The pointer's position (null: left the map), for hover previews, edge scrolling and brush cursors. Presentation only. */
  | { readonly kind: "point"; readonly screen: ScreenPoint | null }
  /** The window lost focus: held keys and buttons are released, a palisade drag is finished. */
  | { readonly kind: "focusLost" }
  /** Next / previous placement tool (Q / E, controller LB / RB). */
  | { readonly kind: "toolStep"; readonly step: -1 | 1 }
  /** Zone brush radius one step up or down ([ / ]). */
  | { readonly kind: "brushSize"; readonly step: -1 | 1 }
  /** Toggle economy overlay slot 1-4 (keys 1-4) or the problem-only view (O). */
  | { readonly kind: "overlayToggle"; readonly slot: 1 | 2 | 3 | 4 }
  | { readonly kind: "problemView" }
  /** UX-3: open / close a panel (B the build drawer, L the ledger drawer) or hide the HUD (H). */
  | { readonly kind: "panel"; readonly panel: "build" | "ledger" | "hud" }
  /** Pause / resume (Space tap, controller menu). */
  | { readonly kind: "pauseToggle" }
  /** Centre the view on a tile (the map overview; later a controller "jump to problem"). */
  | { readonly kind: "lookAt"; readonly tile: { readonly tx: number; readonly ty: number } };

export type InputIntentKind = InputIntent["kind"];
