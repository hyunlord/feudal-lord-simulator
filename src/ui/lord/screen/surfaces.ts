import type { OpenStep, SceneRef, SurfaceRow } from "../../surfaces.registry";
import type { LordScreenId } from "./lordScreenTypes";

// LM-R2: the lord screen host's ui-geometry rows and the scenes / open steps every area's rows use
// (src/ui/lord/<area>/surfaces.ts). States: the `lord2` set (scripts/lmr2States.ts, DGX ~/fls-lmr2-states).
// The lord2 state names: offer-countered, marriage-contracted, will-change, contested, inherited, audit-pending,
// attention-overloaded, promises, neighbour-suit (scripts/lmr2States.ts lists what each holds).

/** A lord2 state, the camera on the town's first house, the story quiet (no chip or card opens over the panel). */
export const lord2Scene = (name: string): SceneRef => ({ kind: "state", set: "lord2", name, tile: "house", zoom: 1.1, query: "&story-delay=600000" });
/** Into the lord screen: the dock's ledger, its lord tab, the way in. */
export const OPEN_LORD: readonly OpenStep[] = [{ click: "[data-dock='ledger']" }, { click: "[data-ledger-tab='lord']" }, { click: "[data-lord-open]" }, { pause: 500 }];
/** Into one lord screen (its menu item must be open in the scene's state). */
export const openLordScreen = (screen: LordScreenId): readonly OpenStep[] => [...OPEN_LORD, { click: `[data-lord-nav='${screen}']` }, { pause: 500 }];

const HOST = { root: ".slot-panel.lord-screen", frame: "css", scrollParts: [".lord-screen-nav", ".lord-screen-content"] } as const;

export const SCREEN_SURFACES: readonly SurfaceRow[] = [
  { id: "lord.screen", ...HOST, scene: lord2Scene("offer-countered"), open: OPEN_LORD,
    requires: ["h2", ".lord-screen-nav-item", ".slot-panel-close"], siblingsNoOverlap: [".lord-screen-nav-item"],
    data: "the lord screen host over the town: the left menu (each shut item with its reason) and the screen (empty until an area opens one)" },
  { id: "slot.ledger.lord-open", root: ".slot-panel.ledger-drawer", frame: "css", scene: lord2Scene("offer-countered"), scroll: "y",
    open: [{ click: "[data-dock='ledger']" }, { click: "[data-ledger-tab='lord']" }, { pause: 500 }], requires: [".lord-screen-open", ".lord-policy-option"],
    data: "the ledger's lord tab with the way into the lord screens above the policies" },
];
