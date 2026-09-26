// UX-3 UI state machine (research 15 A, S-20..S-35): which UI is on screen is one state, enforced here, not a set of
// independent booleans.
//  - S-30 one panel slot: the build drawer, the ledger drawer, the inspector, the population drawer and the goal
//    drawer share it; opening one closes the one before.
//  - S-31 Esc goes back one step: placement -> build drawer -> idle -> pause menu (a modal); right-click = one Esc.
//  - S-32 modals push onto a stack over the state they interrupt and pop back to it; while any modal is up time stops
//    (`timeStopped`), and the speed comes back when the last one closes.
//  - S-34 Space never changes the state (the app pauses time only).
//  - S-35 `]` hides the HUD (a view toggle outside the state).
export type UiMode =
  | "idle" // S-20
  | "build" // S-21 build drawer
  | "placement" // S-22 a building ghost (continuous: stays after a placement)
  | "line" // S-23 road / palisade line
  | "zone" // S-24
  | "selection" // S-25 inspector
  | "ledger" // S-26
  | "population" // pop pill -> household events
  | "goals"; // the goal log drawer
export type UiModal = "pause_menu" | "event" | "season_ledger";
export type UiState = Readonly<{ mode: UiMode; modals: readonly { readonly modal: UiModal; readonly under: UiMode }[]; hudHidden: boolean }>;
export type UiEvent =
  | { readonly type: "open_build" } | { readonly type: "toggle_build" }
  | { readonly type: "pick_tool"; readonly line: boolean }
  | { readonly type: "tool_cleared" } // the tool went away without Esc (e.g. the map's own cancel)
  | { readonly type: "zone_on" } | { readonly type: "zone_off" }
  | { readonly type: "select" } | { readonly type: "deselect" }
  | { readonly type: "open_ledger" } | { readonly type: "toggle_ledger" }
  | { readonly type: "open_population" } | { readonly type: "open_goals" } | { readonly type: "toggle_goals" }
  | { readonly type: "escape" }
  | { readonly type: "push_modal"; readonly modal: UiModal } | { readonly type: "pop_modal" }
  | { readonly type: "toggle_hud" };

export const INITIAL_UI_STATE: UiState = { mode: "idle", modals: [], hudHidden: false };

/** The panel slot's occupant (S-30): at most one. */
export type PanelSlot = "build" | "ledger" | "inspector" | "population" | "goals" | null;
export function panelSlot(state: UiState): PanelSlot {
  switch (state.mode) {
    case "build": return "build";
    case "ledger": return "ledger";
    case "selection": return "inspector";
    case "population": return "population";
    case "goals": return "goals";
    default: return null;
  }
}

export const topModal = (state: UiState): UiModal | null => state.modals.at(-1)?.modal ?? null;
/** S-32 / S-27..29: a modal stops time. */
export const timeStopped = (state: UiState): boolean => state.modals.length > 0;
/** What stays on screen in the state (research 15 table 2.1): the dock and the layer switch leave placement and zone. */
/** The running tutorial's card stays with the step it steers (build, placement, zone): its button places at the
 * suggested spot, and the 13-step replay presses only card buttons. Other goal cards are the normal state's. */
export function hudVisibility(state: UiState, options: { readonly tutorialRunning?: boolean } = {}) {
  const placing = state.mode === "placement" || state.mode === "line";
  const tutorialStep = options.tutorialRunning === true && (placing || state.mode === "build" || state.mode === "zone");
  return {
    statusPill: !state.hudHidden, speed: !state.hudHidden,
    layers: !state.hudHidden && !placing,
    dock: !state.hudHidden && !placing && state.mode !== "zone",
    goalCard: !state.hudHidden && (state.mode === "idle" || tutorialStep), // S-80: the goal card in the normal state
    crisis: !state.hudHidden && !placing,
  };
}

const toggle = (state: UiState, mode: UiMode): UiState => ({ ...state, mode: state.mode === mode ? "idle" : mode });

export function reduceUi(state: UiState, event: UiEvent): UiState {
  if (state.modals.length > 0 && event.type !== "pop_modal" && event.type !== "push_modal" && event.type !== "escape" && event.type !== "toggle_hud") {
    return state; // a modal holds the screen: nothing under it changes until it closes
  }
  switch (event.type) {
    case "open_build": return { ...state, mode: "build" };
    case "toggle_build": return toggle(state, "build");
    case "pick_tool": return { ...state, mode: event.line ? "line" : "placement" };
    case "tool_cleared": return state.mode === "placement" || state.mode === "line" ? { ...state, mode: "build" } : state;
    case "zone_on": return { ...state, mode: "zone" };
    case "zone_off": return state.mode === "zone" ? { ...state, mode: "idle" } : state;
    case "select": return { ...state, mode: "selection" };
    case "deselect": return state.mode === "selection" ? { ...state, mode: "idle" } : state;
    case "open_ledger": return { ...state, mode: "ledger" };
    case "toggle_ledger": return toggle(state, "ledger");
    case "open_population": return { ...state, mode: "population" };
    case "open_goals": return { ...state, mode: "goals" };
    case "toggle_goals": return toggle(state, "goals");
    case "push_modal": return { ...state, modals: [...state.modals, { modal: event.modal, under: state.mode }] };
    case "pop_modal": {
      const top = state.modals.at(-1);
      return top === undefined ? state : { ...state, mode: top.under, modals: state.modals.slice(0, -1) };
    }
    case "toggle_hud": return { ...state, hudHidden: !state.hudHidden };
    case "escape": return escapeOnce(state);
  }
}

/** S-31: one step back. */
export function escapeOnce(state: UiState): UiState {
  if (state.modals.length > 0) return reduceUi(state, { type: "pop_modal" });
  switch (state.mode) {
    case "placement": case "line": return { ...state, mode: "build" };
    case "idle": return { ...state, modals: [{ modal: "pause_menu", under: "idle" }] };
    default: return { ...state, mode: "idle" };
  }
}
