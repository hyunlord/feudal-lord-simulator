// UI-AUDIT-1: the register of every framed surface in the game — panels, cards, modals, popovers, tooltips, chips,
// drawers, pages, books — with how a player reaches it, the data state it is measured in and what its frame is. Data
// only: scripts/uiGeometryAudit.mjs opens each row in three viewports × two copy lengths × two number ranges and
// measures it (scripts/uiGeometryMeasure.ts); scripts/checks/surfaceRegistry.mjs (a check:merge step and
// tests/surfacesRegistry.test.ts) fails when a dialog root, a framed root (data-frame), a framed class name in src/ui/** or
// src/render/*.tsx, or a CSS selector that sets a border-image is in none of the selectors below and not in NOT_SURFACES;
// the audit also lists every framed root it meets on screen that no row's root matches. `frame` is the kind of frame
// the surface wears; on the frame tokens its root's data-frame kind names it (FRAME_TOKENS type), and the audit
// reports any row where the two disagree.
// Frame kinds (docs survey §0.3): `css` — the root's own border-image; `layer` — a sibling span at inset 0 carries the
// border-image (`frameLayer`), content sits in the art's content rect (`contentSlot`); `painting` — the whole card art
// is the root's background, children sit in art-pixel slots (`painting` holds the art's size and its content-safe
// rect, measured on the PNG); `flat` — no art frame (a plain fill with a CSS rule).
// Copy in this file stays out of it (koreanStrings): buttons are reached by class, data attribute or position.

export type FrameKind = "css" | "layer" | "painting" | "flat";
/** The cached DGX state folders (scripts/ui{5,6,8,9,10}States.ts, scripts/ui10ExtraStates.ts). */
export type StateSet = "ui5" | "ui6" | "ui8" | "ui9" | "ui10" | "ui10-extra";
export type ViewportId = "1280x800" | "1920x1080" | "tablet-1180x820";

export type SceneRef =
  /** A cached state, the camera on its first house (or keep, or `focus`), paused unless `run`. */
  | { readonly kind: "state"; readonly set: StateSet; readonly name: string; readonly tile?: "house" | "keep"; readonly focus?: MapTarget; readonly zoom?: number;
    readonly query?: string; readonly run?: boolean }
  /** Today's new game (no injected state), the tutorial on: the welcome is dismissed as a player does. */
  | { readonly kind: "new-game" }
  /** A fresh profile: the title screen. */
  | { readonly kind: "title" }
  /** A dev route (the kit gallery). */
  | { readonly kind: "route"; readonly path: string };

/** A point on the map, from the scene's state: a building of one of these kinds, a construction site, a walker. */
export type MapTarget = { readonly building?: readonly string[]; readonly site?: true; readonly walker?: true; readonly offset?: readonly [number, number] };

export type OpenStep =
  /** Click the first visible match (a list: the first selector that matches). `optional`: go on when none does. */
  | { readonly click: string | readonly string[]; readonly force?: boolean; readonly optional?: boolean }
  /** Click every visible match, in order. */
  | { readonly clickAll: string }
  | { readonly key: string }
  | { readonly wait: string; readonly timeout?: number; readonly optional?: boolean }
  | { readonly pause: number }
  /** A story modal: it opens on its own, or from the waiting event chips in turn (a chip's card's decide button; another
   * card is closed, another petition put off). */
  | { readonly story: string }
  /** Close whatever of these is open (a chapter page, a card that opened over the scene). */
  | { readonly dismiss: readonly string[] }
  | { readonly map: MapTarget; readonly action: "click" | "hover" | "tap" }
  /** Click `repeat` (the first visible match) until `until` shows, at most `max` times (a book's next page). */
  | { readonly repeat: string; readonly until: string; readonly max?: number }
  /** Hover buildings of these kinds one by one until `until` shows. */
  | { readonly hoverEach: readonly string[]; readonly until: string; readonly max?: number };

/** Art pixels. */
export type ArtRect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

export interface SurfaceRow {
  readonly id: string;
  /** The surface's root; the first visible match is measured. */
  readonly root: string;
  readonly frame: FrameKind;
  readonly scene: SceneRef;
  /** Steps after the scene loads (after the parent's steps when `extends` names a row). */
  readonly open: readonly OpenStep[];
  /** Continue from this row's opened page (its steps run first; the audit reuses its page when it can). */
  readonly extends?: string;
  /** The representative data state (what makes this row's content). */
  readonly data: string;
  /** Axes the root may scroll (anything else that overflows fails). */
  readonly scroll?: "x" | "y" | "xy";
  /** Descendants that may scroll (a table's scroller, the chronicle's list). */
  readonly scrollParts?: readonly string[];
  /** Layer frames: the sibling that paints the frame. */
  readonly frameLayer?: string;
  /** Layer frames: the element placed on the art's content rect (its box is the content-safe rect). */
  readonly contentSlot?: string;
  /** Children placed on the frame on purpose (a roundel, the season scenes in the frame's left inset, an art patch). */
  readonly frameSlots?: readonly string[];
  /** Painting surfaces: the art's size and its content-safe rect (inside the painted rules), in art pixels. */
  readonly painting?: { readonly art: { readonly w: number; readonly h: number }; readonly safe: ArtRect };
  /** A round portrait on a painting: the printed ring (art px; `r` its outer edge, `inner` its opening), the face and the ornament. */
  readonly portraitRing?: { readonly cx: number; readonly cy: number; readonly r: number; readonly inner: number; readonly face: string; readonly ornament: string };
  /** Selectors whose visible matches must not overlap one another (beyond the default buttons / text / buttons check). */
  readonly siblingsNoOverlap?: readonly string[];
  /** Only these viewports (default: all three). */
  readonly viewports?: readonly ViewportId[];
  /** false: the extreme-number condition does not apply (no state is injected). */
  readonly numbers?: false;
  /** A selector that must be present for the variant (a walker's card, a store's body). */
  readonly expect?: string;
  /** Set when no scripted path opens it: why (the row is listed as not reached). */
  readonly unreachable?: string;
}

/** The gap between a frame's content-safe inset and the content (work order §2.1; the frame tokens' `--frame-gap`). */
export const FRAME_GAP_PX = 8;

export const VIEWPORTS: Readonly<Record<ViewportId, { readonly width: number; readonly height: number; readonly touch: boolean }>> = {
  "1280x800": { width: 1280, height: 800, touch: false },
  "1920x1080": { width: 1920, height: 1080, touch: false },
  "tablet-1180x820": { width: 1180, height: 820, touch: true },
};

const TOWN = { kind: "state", set: "ui5", name: "merchant-town", tile: "house", zoom: 1.4 } as const;
const TOWN_CLOSE = { ...TOWN, zoom: 1.6 } as const;
const townAt = (focus: MapTarget) => ({ ...TOWN_CLOSE, focus }) as const;
const QUIET = "&story-delay=600000";
const DISMISS: OpenStep = { dismiss: [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"] };
const LEDGER: OpenStep = { click: "[data-dock='ledger']" };
const CHRONICLE: readonly OpenStep[] = [LEDGER, { click: ".ledger-tab--chronicle" }, { wait: ".chronicle-screen" }, { pause: 900 }];
const petitionScene = (set: StateSet, name: string, delay: number) => ({ kind: "state", set, name, tile: "house", zoom: 1.1, query: `&story-delay=${delay}` }) as const;
const PETITION = {
  root: ".story-modal.petition-card", frame: "layer", frameLayer: ".petition-frame", contentSlot: ".petition-body", frameSlots: [".petition-roundel"],
  siblingsNoOverlap: [".petition-option", ".story-modal-later"],
} as const;
const BOOK = { root: ".chronicle-page.legacy-book", frame: "layer", frameLayer: ".chronicle-frame", contentSlot: ".legacy-book-body", scrollParts: [".legacy-book-page"],
  scene: { kind: "state", set: "ui10", name: "chapter5-end", tile: "house", zoom: 1.1, query: "&story-delay=5000" } } as const;
const chapterScene = (set: StateSet, name: string) => ({ kind: "state", set, name, tile: "house", zoom: 1.1, query: "&story-delay=5000" }) as const;
const CHAPTER_PAGE = {
  root: ".chronicle-page:not(.legacy-ending):not(.legacy-book)", frame: "layer", frameLayer: ".chronicle-frame", contentSlot: ".chapter-page-body",
  open: [{ wait: ".chronicle-page", timeout: 90_000 }, { pause: 800 }],
} as const;
/** frame_person_card-v1.png 320×200: the painted rules end at x 14 / y 21 / x 305 / y 177 (PIL, UI-AUDIT-1 survey §4). */
const PERSON_CARD_ART = { art: { w: 320, h: 200 }, safe: { x: 15, y: 22, w: 290, h: 155 } } as const;
/** frame_biography.png / frame_faction_page.png 640×800: the plain parchment inside the border (PIL). */
const BIOGRAPHY_ART = { art: { w: 640, h: 800 }, safe: { x: 26, y: 29, w: 586, h: 741 } } as const;
const FACTION_PAGE_ART = { art: { w: 640, h: 800 }, safe: { x: 28, y: 29, w: 582, h: 740 } } as const;

export const SURFACES: readonly SurfaceRow[] = [
  // --- The always-on HUD, its strips and small floating boxes (survey §2.1).
  { id: "hud.status-pill", root: ".status-pill", frame: "css", scene: TOWN, open: [], data: "seed 1 stone town: date, population, food, coin" },
  { id: "hud.season-strip-panel", root: ".season-strip-panel", frame: "css", scene: TOWN, open: [{ click: "[data-testid='hud-calendar']" }, { pause: 500 }],
    data: "the town's year strip with its marks and the food line" },
  { id: "hud.time-cluster", root: ".hud-time-cluster", frame: "css", scene: TOWN, open: [], data: "the speed seals and the settings button" },
  { id: "hud.settings-popover", root: ".command-popover", frame: "css", scene: TOWN, open: [{ click: ".settings-disclosure > summary" }, { pause: 500 }],
    data: "autoplay, tutorial, audio, save and render switches" },
  { id: "hud.layer-switch", root: ".layer-switch", frame: "flat", scene: { kind: "new-game" }, open: [], numbers: false, data: "the three layers, two locked (tutorial on)" },
  { id: "hud.layer-switch-note", root: ".layer-switch-note", frame: "css", scene: { kind: "new-game" }, numbers: false,
    open: [{ click: ".control-layer[aria-disabled='true']", force: true }, { pause: 400 }], data: "a locked layer's reason (tutorial on)" },
  { id: "hud.action-dock", root: ".action-dock", frame: "flat", scene: TOWN, open: [], data: "build, ledger, steward (undo when a site is new)",
    siblingsNoOverlap: [".action-dock-button", ".hud-undo"] },
  { id: "hud.steward-bubble", root: ".steward-bubble", frame: "css", scene: TOWN, open: [{ click: "[data-dock='steward']" }, { pause: 500 }],
    data: "the steward's line (quiet, or the advisor's line when he speaks)" },
  { id: "hud.crisis-icons", root: ".crisis-icons", frame: "flat", scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.1, query: QUIET },
    open: [DISMISS], data: "the famine's alerts (at most three bells)" },
  { id: "hud.stuck-goods", root: ".crisis-icons .stuck-goods-chip", frame: "css", scene: { kind: "state", set: "ui10", name: "empty-manor", tile: "house", zoom: 1.1, query: QUIET },
    open: [DISMISS, { wait: ".stuck-goods-chip" }], data: "the 1404 manor's worst stuck pile (a kit secondary button left of the bells)" },
  { id: "hud.event-chips", root: ".event-cards", frame: "flat", scene: { kind: "state", set: "ui9", name: "reorg.alehouse_boom", tile: "keep", zoom: 1.1, query: "&story-delay=0" },
    open: [{ wait: ".event-chip", timeout: 90_000 }, { pause: 500 }], data: "chapter 4's alehouse boom beat" },
  { id: "hud.event-card", extends: "hud.event-chips", root: ".event-card", frame: "css", scene: { kind: "state", set: "ui9", name: "reorg.alehouse_boom", tile: "keep", zoom: 1.1, query: "&story-delay=0" },
    open: [{ click: ".event-chip" }, { pause: 600 }], scroll: "y", data: "the alehouse boom's story card" },
  { id: "hud.goal-chips", root: ".goal-chip-rail .goal-card", frame: "css", scene: { kind: "new-game" }, numbers: false, open: [{ pause: 600 }],
    data: "the tutorial's first goal card" },
  { id: "hud.goal-help", extends: "hud.goal-chips", root: ".goal-card-help > p", frame: "css", scene: { kind: "new-game" }, numbers: false,
    open: [{ click: ".goal-chip-rail .goal-card-cta" }, { pause: 900 }, { click: ".goal-chip-rail .goal-card--folded .goal-card-fold", optional: true }, { pause: 400 },
      { click: ".goal-card-help > summary" }, { pause: 400 }], data: "a tutorial goal card's help line",
    unreachable: "the help seal shows only on a tutorial card whose step has an advisor line; the opening card, the one after it and the chapter goal cards (tutorial off) carry none, and later steps need buildings finished (UI-AUDIT-1 smoke runs)" },
  { id: "hud.unlock-banner", root: ".unlock-banner", frame: "css", scene: { kind: "new-game" }, numbers: false, open: [], data: "a tutorial unlock",
    unreachable: "shows only when a tutorial step unlocks a tool; no scripted path completes one (survey §2: no browser script reaches it)" },
  { id: "hud.pause-veil", root: ".pause-veil-label", frame: "painting", painting: { art: { w: 128, h: 48 }, safe: { x: 25, y: 2, w: 102, h: 44 } }, scene: TOWN, open: [],
    data: "the paused town's badge (speed 0, no modal)" },
  { id: "hud.completion-toast", root: ".completion-toast", frame: "css", scene: { kind: "state", set: "ui5", name: "carrying", tile: "house", zoom: 1.1, query: QUIET, run: true },
    open: [{ key: "Digit3" }, { wait: ".completion-toast", timeout: 120_000 }], data: "the carter town's mill site finishing at speed 3" },
  { id: "hud.era-ceremony", root: ".era-ceremony", frame: "flat", scene: TOWN, open: [], data: "entering an era",
    unreachable: "shows only on the tick an era is entered; no cached state sits on that tick (survey §2: static contrast check only)" },
  { id: "hud.cause-legend", root: ".cause-legend", frame: "flat", scene: TOWN, open: [LEDGER, { click: "[data-ledger-tab='view']" }, { click: ".economy-overlays .overlay-seal" }, { pause: 500 }],
    data: "the problem-only view's legend" },
  { id: "hud.zone-toolbar", root: ".zone-toolbar", frame: "flat", scene: TOWN, open: [{ click: ".control-layer[data-layer='zone']" }, { pause: 600 }],
    data: "the zone layer's kinds and tools" },
  { id: "hud.zone-land-legend", extends: "hud.zone-toolbar", root: ".zone-land-legend", frame: "flat", scene: TOWN, open: [], data: "the zone layer's land legend" },
  { id: "hud.placement-confirm", root: ".placement-confirm-bar", frame: "flat", scene: TOWN, viewports: ["tablet-1180x820"],
    open: [{ click: "[data-dock='build']" }, { click: ".build-menu-category[data-category='living']" }, { click: ".build-tool[data-affordable='true']:not([data-locked])" },
      { pause: 400 }, { map: { building: ["house"], offset: [3, 3] }, action: "tap" }, { pause: 600 }], data: "a tapped ghost's confirm bar (touch)" },
  { id: "hud.prediction-chip", root: ".prediction-panel.placement-chip", frame: "css", scene: TOWN,
    open: [{ click: "[data-dock='build']" }, { click: ".build-menu-category[data-category='living']" }, { click: ".build-tool[data-affordable='true']:not([data-locked])" },
      { pause: 400 }, { map: { building: ["house"], offset: [3, 3] }, action: "hover" }, { pause: 700 }], data: "a living tool's placement chip over open ground" },
  { id: "hud.hover-tooltip", root: ".building-inspector.cause-tooltip", frame: "flat", scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.4, query: QUIET },
    open: [DISMISS, { hoverEach: ["house", "farmstead", "granary", "mill", "market"], until: ".cause-tooltip", max: 16 }], viewports: ["1280x800", "1920x1080"],
    data: "a hungry house's cause tooltip (hover, no tool)" },
  { id: "hud.build-drawer", root: ".court-console.build-drawer", frame: "css", scene: TOWN, open: [{ click: "[data-dock='build']" }, { pause: 500 }],
    siblingsNoOverlap: [".build-tool", ".build-menu-category"], data: "the living category's cards" },
  { id: "hud.build-pinned", root: ".build-menu-pinned", frame: "css", scene: { kind: "new-game" }, numbers: false,
    open: [{ click: "[data-dock='build']" }, { pause: 400 }, { click: ".build-menu-category--locked", force: true }, { pause: 500 }],
    data: "a locked category's note (tutorial on)" },
  { id: "hud.build-details", root: ".build-menu-details", frame: "css", scene: TOWN, open: [], data: "a card's full details",
    unreachable: "the HUD's build drawer is controlled, which hides the details' toggle (BuildMenu.tsx: `open !== undefined`); nothing opens it in play" },
  { id: "hud.qa-overlay", root: ".qa-overlay", frame: "css", scene: TOWN, open: [{ key: "Backquote" }, { pause: 600 }], data: "the developer's info lines" },

  // --- The panel slot (S-30: one at a time).
  { id: "slot.goals", root: ".slot-panel.goal-slot", frame: "css", scene: TOWN, open: [{ click: ".goal-drawer-toggle" }, { pause: 600 }], scroll: "y",
    data: "the goal log, the settlement line and its progress" },
  { id: "slot.goals.drawer", extends: "slot.goals", root: ".goal-drawer", frame: "css", scene: TOWN, open: [], data: "the goal log inside the slot" },
  { id: "slot.goals.status", extends: "slot.goals", root: ".settlement-status", frame: "css", scene: TOWN, open: [], data: "the settlement line" },
  { id: "slot.goals.settlement", extends: "slot.goals", root: ".settlement-progress", frame: "flat", scene: TOWN,
    open: [{ click: ".settlement-progress > details > summary" }, { pause: 500 }], data: "the settlement's progress, opened" },
  { id: "slot.goals.era-console", extends: "slot.goals.settlement", root: ".era-console", frame: "flat", scene: TOWN, open: [], data: "the stone town's era console" },
  { id: "slot.population", root: ".ledger-population-drawer.slot-panel", frame: "css", scene: TOWN,
    open: [{ click: ".status-pill > .status-pill-cell:nth-of-type(2)" }, { pause: 600 }], scroll: "y", data: "the town's population events" },
  { id: "slot.population.panel", extends: "slot.population", root: ".population-event-panel", frame: "flat", scene: TOWN, open: [], data: "the population log inside the slot" },
  { id: "slot.inspector", root: ".slot-panel.inspector-slot", frame: "css", scene: TOWN,
    open: [LEDGER, { click: ".ledger-held-toggle" }, { click: ".ledger-store" }, { pause: 700 }], scroll: "y", data: "the first store's inspector" },
  { id: "slot.inspector.body", extends: "slot.inspector", root: ".left-inspector", frame: "css", scene: TOWN, open: [], scroll: "y", data: "the inspector inside the slot" },
  { id: "slot.ledger.stock", root: ".slot-panel.ledger-drawer", frame: "css", scene: TOWN, open: [LEDGER, { pause: 600 }], scroll: "y",
    scrollParts: [".ledger-matrix-scroll"], data: "the stone town's stocks" },
  { id: "slot.ledger.alerts", root: ".slot-panel.ledger-drawer", frame: "css", scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.1, query: QUIET },
    open: [DISMISS, LEDGER, { click: "[data-ledger-tab='alerts']" }, { pause: 500 }], scroll: "y", data: "the famine's alerts" },
  { id: "slot.ledger.view", root: ".slot-panel.ledger-drawer", frame: "css", scene: TOWN, open: [LEDGER, { click: "[data-ledger-tab='view']" }, { pause: 500 }], scroll: "y",
    data: "the overlay switches" },
  { id: "slot.ledger.map", root: ".slot-panel.ledger-drawer", frame: "css", scene: TOWN, open: [LEDGER, { click: "[data-ledger-tab='map']" }, { pause: 800 }], scroll: "y",
    data: "the map shield" },
  { id: "slot.ledger.map-overview", extends: "slot.ledger.map", root: ".map-overview", frame: "css", scene: TOWN, open: [], data: "the map shield's overview" },
  { id: "slot.ledger.rights", root: ".ledger-rights", frame: "css", scene: { kind: "state", set: "ui9", name: "chapter4-end", tile: "house", zoom: 1.1, query: QUIET },
    open: [{ pause: 1000 }, DISMISS, LEDGER, { click: "[data-ledger-tab='rights']" }, { pause: 700 }], data: "chapter 4's rights register (charter rights, fee farm, revolt pressure)" },
  { id: "slot.ledger.rights-decline", root: ".ledger-rights", frame: "css", scene: { kind: "state", set: "ui6", name: "decline", tile: "keep", zoom: 1.1, query: QUIET },
    open: [{ pause: 1000 }, DISMISS, LEDGER, { click: "[data-ledger-tab='rights']" }, { pause: 700 }], data: "chapter 2's register after a right is lost" },
  { id: "slot.ledger.wage", root: ".slot-panel.ledger-drawer", frame: "css", scene: { kind: "state", set: "ui8", name: "chapter3-end", tile: "house", zoom: 1.1, query: QUIET },
    open: [{ pause: 1000 }, DISMISS, LEDGER, { pause: 600 }], scroll: "y", scrollParts: [".ledger-matrix-scroll"], data: "chapter 3's wage ledger under the stocks" },
  { id: "slot.ledger.reorg", root: ".slot-panel.ledger-drawer", frame: "css", scene: { kind: "state", set: "ui9", name: "chapter4-end", tile: "house", zoom: 1.1, query: QUIET },
    open: [{ pause: 1000 }, DISMISS, LEDGER, { pause: 600 }], scroll: "y", scrollParts: [".ledger-matrix-scroll"], data: "chapter 4's reorganisation ledger" },
  { id: "slot.ledger.legacy", root: ".slot-panel.ledger-drawer", frame: "css", scene: { kind: "state", set: "ui10", name: "chapter5-end", tile: "house", zoom: 1.1, query: QUIET },
    open: [{ pause: 1000 }, DISMISS, LEDGER, { pause: 600 }], scroll: "y", scrollParts: [".ledger-matrix-scroll"], data: "chapter 5's money ledger" },

  // --- The map's selection card (GameCanvas, not the slot).
  { id: "map.selection.house", root: ".diagnostic-card", frame: "flat", scene: TOWN_CLOSE, open: [{ map: { building: ["house"] }, action: "click" }, { pause: 800 }], scroll: "y",
    expect: ".inspector-members", data: "the first house: its household" },
  { id: "map.selection.walker", root: ".diagnostic-card", frame: "flat", scene: townAt({ walker: true }), open: [{ map: { walker: true }, action: "click" }, { pause: 800 }], scroll: "y",
    expect: ".walker-headline", data: "the first walker" },
  { id: "map.selection.site", root: ".diagnostic-card", frame: "flat",
    scene: { kind: "state", set: "ui9", name: "reorg.wage_competition", focus: { site: true }, zoom: 1.6, query: QUIET },
    open: [DISMISS, { map: { site: true }, action: "click" }, { pause: 800 }], scroll: "y", expect: "[data-action='cancel-construction']", data: "chapter 4's first cloth site" },
  { id: "map.selection.farmstead", root: ".diagnostic-card", frame: "flat", scene: townAt({ building: ["farmstead"] }), open: [{ map: { building: ["farmstead"] }, action: "click" }, { pause: 800 }],
    scroll: "y", expect: ".inspector-crop", data: "a farmstead and its crop choice" },
  { id: "map.selection.store", root: ".diagnostic-card", frame: "flat", scene: townAt({ building: ["granary"] }), open: [{ map: { building: ["granary"] }, action: "click" }, { pause: 800 }],
    scroll: "y", expect: ".store-inspector", data: "a granary's store body" },

  // --- Modals (AppModals, time stopped).
  { id: "modal.pause", root: ".pause-menu", frame: "css", scene: TOWN, open: [{ key: "Escape" }, { pause: 600 }], scroll: "y", data: "the pause menu and its settings" },
  { id: "modal.season-ledger", root: ".season-ledger-card", frame: "layer", frameLayer: ".season-ledger-frame", contentSlot: ".season-ledger-body",
    frameSlots: [".season-ledger-scenes"], scene: { kind: "state", set: "ui5", name: "carrying", tile: "house", zoom: 1.4, query: QUIET, run: true },
    open: [{ key: "Digit3" }, { wait: ".season-ledger-card", timeout: 90_000 }, { pause: 900 }], data: "the carter town's season close" },
  { id: "modal.famine", root: ".story-modal.famine-decision", frame: "flat", scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.1, query: "&story-delay=5000" },
    open: [{ story: ".famine-decision" }, { pause: 800 }], scroll: "y", siblingsNoOverlap: [".famine-option", ".story-modal-later"], data: "chapter 1's famine decision" },
  { id: "modal.petition.ch1", ...PETITION, scene: petitionScene("ui5", "petition-open", 5000), open: [{ story: ".petition-card" }, { pause: 600 }], data: "chapter 1's petition" },
  { id: "modal.petition.ch2-war", ...PETITION, scene: petitionScene("ui6", "wool_payment", 5000), open: [{ story: ".petition-card" }, { pause: 700 }], data: "the Crown's writ (war)" },
  { id: "modal.petition.ch4-reorg", ...PETITION, scene: petitionScene("ui9", "borough_charter", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "the borough charter" },
  { id: "modal.petition.ch5-legacy", ...PETITION, scene: petitionScene("ui10", "borough_autonomy", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "the borough's autonomy (legacy)" },
  { id: "modal.petition.heir", ...PETITION, scene: petitionScene("ui10-extra", "heir_choice", 0), open: [{ story: ".petition-card[data-def='heir_choice']" }, { pause: 600 }],
    expect: ".petition-heir", data: "the heir's card with three candidates" },
  { id: "modal.chapter-page.ch1", ...CHAPTER_PAGE, scene: chapterScene("ui5", "chapter-end"), data: "chapter 1's end page" },
  { id: "modal.chapter-page.ch2", ...CHAPTER_PAGE, scene: chapterScene("ui6", "chapter2-end"), data: "chapter 2's end page" },
  { id: "modal.chapter-page.ch3", ...CHAPTER_PAGE, scene: chapterScene("ui8", "chapter3-end"), data: "chapter 3's end page" },
  { id: "modal.chapter-page.ch4", ...CHAPTER_PAGE, scene: chapterScene("ui9", "chapter4-end"), data: "chapter 4's end page" },
  { id: "modal.chapter-page.ch5", ...CHAPTER_PAGE, scene: chapterScene("ui10", "chapter5-end"), data: "chapter 5's end page (the campaign's)" },
  { id: "modal.chapter-preview", extends: "modal.chapter-page.ch1", root: ".chapter-preview", frame: "flat", scene: chapterScene("ui5", "chapter-end"),
    open: [{ click: ".chronicle-page .chronicle-next" }, { wait: ".chapter-preview" }, { pause: 800 }], data: "chapter 2's preview and goals" },
  { id: "modal.chapter-preview.goals", extends: "modal.chapter-preview", root: ".chapter-preview-goals", frame: "flat", scene: chapterScene("ui5", "chapter-end"), open: [],
    data: "chapter 2's goals on the preview" },
  { id: "modal.chapter-loading", root: ".chapter-loading", frame: "flat", scene: { kind: "title" }, numbers: false,
    open: [{ click: ".welcome-parchment [data-scenario]" }, { wait: ".chapter-loading", timeout: 5_000 }], data: "the new game's loading screen (900 ms)" },
  { id: "modal.person-card", extends: "map.selection.house", root: ".person-card", frame: "painting", painting: PERSON_CARD_ART, scene: TOWN_CLOSE,
    frameSlots: [".person-card-emblem-cover"],
    portraitRing: { cx: 59.5, cy: 83.5, r: 43, inner: 33.5, face: ".person-card-portrait .person-portrait-layer", ornament: ".person-card-portrait .person-state-ornament" },
    siblingsNoOverlap: [".person-card-portrait", ".person-card-text", ".person-card-actions", ".person-card-emblem"],
    open: [{ click: [".diagnostic-card .person-chip:has(.person-state-ornament)", ".diagnostic-card .person-chip"] }, { wait: ".person-card" }, { pause: 700 }],
    data: "a house member's card (one wearing a state ornament when the house has one)" },
  { id: "modal.history.records", root: ".chronicle-screen", frame: "flat", scene: TOWN, open: [...CHRONICLE], scrollParts: [".chronicle-list", ".chronicle-detail"],
    data: "the stone town's chronicle: timeline, filters, record list, detail" },
  { id: "modal.history.record-card", extends: "modal.history.records", root: ".chronicle-card", frame: "layer", frameLayer: ".chronicle-card-frame", scene: TOWN, open: [],
    frameSlots: [".chronicle-card-art--portrait"],
    data: "the first record card" },
  { id: "modal.history.snapshot-map", extends: "modal.history.records", root: ".chronicle-map-box", frame: "layer", frameLayer: ".chronicle-map-frame", contentSlot: ".chronicle-map-inner",
    scene: TOWN, open: [{ click: ".chronicle-card:not([data-kind='decision']) .chronicle-card-body" }, { pause: 800 }], data: "a record's then-map" },
  { id: "modal.history.snapshot-figure", extends: "modal.history.snapshot-map", root: ".chronicle-map", frame: "flat", scene: TOWN, open: [],
    siblingsNoOverlap: [".chronicle-map-box", ".chronicle-map > figcaption"], data: "the then-map with its caption (the caption measured beside the framed box)" },
  { id: "modal.select-list", extends: "modal.history.records", root: ".ui-select-list", frame: "css", scene: TOWN, scroll: "y",
    open: [{ click: ".chronicle-select .ui-select-trigger" }, { pause: 400 }], data: "the severity filter's open list" },
  { id: "modal.history.decision", root: ".chronicle-decision", frame: "layer", frameLayer: ".chronicle-decision-frame",
    scene: { kind: "state", set: "ui9", name: "chapter4-end", tile: "house", zoom: 1.1, query: QUIET },
    open: [{ pause: 1000 }, DISMISS, ...CHRONICLE, { clickAll: ".chronicle-kind[aria-pressed='true']:not([data-kind='decision'])" }, { pause: 500 },
      { click: ".chronicle-card .chronicle-card-body" }, { pause: 800 }], data: "chapter 4's first decision record, compared" },
  { id: "modal.history.biography", extends: "modal.person-card", root: ".chronicle-biography", frame: "painting", painting: BIOGRAPHY_ART, scene: TOWN_CLOSE,
    frameSlots: [".chronicle-biography-cover"], scrollParts: [".chronicle-biography-band > ul"],
    portraitRing: { cx: 162, cy: 216, r: 112, inner: 100, face: ".chronicle-biography-portrait", ornament: ".chronicle-biography-ornament" },
    open: [{ click: ".person-card .person-card-action" }, { wait: ".chronicle-biography" }, { pause: 1200 }], data: "that person's biography page" },
  { id: "modal.history.family-tree", extends: "modal.history.biography", root: ".family-tree", frame: "flat", scene: TOWN_CLOSE, scroll: "xy",
    open: [{ click: ".chronicle-person-tabs .chronicle-tab:nth-child(2)" }, { pause: 900 }], siblingsNoOverlap: [".family-tree-node", ".family-tree-toggle"],
    data: "that person's family tree" },
  { id: "modal.history.tree-banner", extends: "modal.history.family-tree", root: ".family-tree-banner", frame: "css", scene: TOWN_CLOSE, open: [], data: "the lineage banner" },
  { id: "modal.history.tree-generation", extends: "modal.history.tree-banner", root: ".family-tree-generation", frame: "css", scene: TOWN_CLOSE, open: [],
    data: "the first generation label" },
  { id: "modal.history.tree-node", extends: "modal.history.tree-generation", root: ".family-tree-node", frame: "css", scene: TOWN_CLOSE, open: [], data: "the first person node" },
  { id: "modal.history.factions", root: ".chronicle-factions", frame: "flat", scene: { kind: "state", set: "ui9", name: "rumour-chased", tile: "house", zoom: 1.1, query: QUIET },
    open: [{ pause: 1000 }, DISMISS, ...CHRONICLE, { click: ".chronicle-tabs:not(.chronicle-person-tabs) .chronicle-tab:nth-child(2)" }, { pause: 900 }],
    siblingsNoOverlap: [".chronicle-factions-row"], data: "chapter 4's factions: influence, tug of war, relations" },
  { id: "modal.history.faction-page", extends: "modal.history.factions", root: ".chronicle-faction", frame: "painting", painting: FACTION_PAGE_ART,
    frameSlots: [".chronicle-faction-band"], scrollParts: [".chronicle-faction-box > ul", ".chronicle-faction-pressure-body"],
    scene: { kind: "state", set: "ui9", name: "rumour-chased", tile: "house", zoom: 1.1, query: QUIET },
    open: [{ click: [".chronicle-factions-row:not([data-memory='0'])", ".chronicle-factions-row"] }, { pause: 1200 }], data: "a faction that remembers something" },
  { id: "modal.legacy-ending", root: ".chronicle-page.legacy-ending", frame: "layer", frameLayer: ".chronicle-frame", contentSlot: ".legacy-ending-body",
    scrollParts: [".legacy-ending-scroll"],
    scene: chapterScene("ui10", "chapter5-end"),
    open: [{ wait: ".chronicle-page", timeout: 90_000 }, { pause: 800 }, { click: ".chronicle-page .chronicle-next" }, { wait: ".legacy-ending" }, { pause: 800 }],
    data: "the campaign's legacy verdict and ending" },
  { id: "modal.chronicle-book", extends: "modal.legacy-ending", ...BOOK, open: [{ click: ".legacy-ending .legacy-open-book" }, { wait: ".legacy-book" }, { pause: 800 }],
    data: "the chronicle book's title page and contents" },
  { id: "modal.chronicle-book.chapter", extends: "modal.chronicle-book", ...BOOK, open: [{ click: ".legacy-book-contents-entry" }, { wait: ".legacy-book-page[data-kind='chapter']" }, { pause: 600 }],
    data: "the book's first chapter page" },
  { id: "modal.chronicle-book.family", extends: "modal.chronicle-book.chapter", ...BOOK,
    open: [{ repeat: ".legacy-book-next", until: ".legacy-book-page[data-kind='family']", max: 12 }, { pause: 600 }], data: "the book's family page" },
  { id: "modal.chronicle-book.factions", extends: "modal.chronicle-book.family", ...BOOK,
    open: [{ repeat: ".legacy-book-next", until: ".legacy-book-page[data-kind='factions']", max: 12 }, { pause: 600 }], data: "the book's factions page" },
  { id: "modal.chronicle-book.legacy", extends: "modal.chronicle-book.factions", ...BOOK,
    open: [{ repeat: ".legacy-book-next", until: ".legacy-book-page[data-kind='legacy']", max: 12 }, { pause: 600 }], data: "the book's legacy page" },

  // --- Screens outside the town.
  { id: "screen.welcome", root: ".welcome-parchment", frame: "css", scene: { kind: "title" }, numbers: false, open: [{ pause: 800 }],
    data: "a fresh profile's title parchment and mode buttons" },
  { id: "dev.ui-kit", root: ".ui-kit-gallery-frame", frame: "css", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [{ pause: 800 }],
    data: "the kit gallery's first frame" },
  { id: "dev.ui-kit.section", extends: "dev.ui-kit", root: ".ui-kit-gallery-section", frame: "css", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [],
    data: "the gallery's first section panel" },
  { id: "dev.ui-kit.dark", extends: "dev.ui-kit.section", root: ".ui-kit-gallery-dark", frame: "css", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [],
    data: "the gallery's dark panel" },
  { id: "dev.ui-kit.tooltip", extends: "dev.ui-kit.dark", root: ".ui-tooltip", frame: "css", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [],
    data: "the kit Tooltip in the gallery" },
];

/**
 * Class names the registry check meets that are not surfaces of their own, and why. A framed-looking class that is a
 * control (it wears button art: the controls check covers it), a part measured inside a registered surface, or a
 * component not mounted in the game.
 */
export const NOT_SURFACES: Readonly<Record<string, string>> = {
  // Controls: buttons wearing P0 button art (the controls check covers them inside every surface).
  "ui-btn": "the kit button",
  "goal-card-cta": "a button (primary art)", "steward-button": "a button (primary art)", "build-tool": "a build card button (primary art)",
  "goal-card-secondary": "a button", "goal-drawer-toggle": "a button", "control-layer": "a layer button", "hud-undo": "a button",
  "tutorial-switch": "a switch button", "zone-radius-button": "a button", "zone-polygon-toggle": "a button", "alert-stack-inspect": "a button",
  "autoplay-toggle": "a button", "save-control-button": "a button", "overlay-seal": "a button", "speed-seal": "a button",
  "left-inspector-close": "a button", "build-info-toggle": "a button", "build-menu-category": "a category tab",
  "build-tool-shortfall": "a chip inside a build card", "build-tool-lock": "a chip inside a build card",
  "person-chip": "a kit button (a person's portrait and name)", "event-chip": "a kit button opening the event card (measured in hud.event-chips)",
  "legacy-open-book": "a button", "pause-menu-book": "a button", "resource-bar__more": "the unmounted resource bar's button",
  "chronicle-book": "a button of the chronicle header", "command-disclosure": "the settings Disclosure; its summary is a button (hud.settings-popover)",
  // Parts measured inside a registered surface.
  "story-modal": "the class the famine and petition cards share (modal.famine, modal.petition.*)",
  "placement-chip": "with .prediction-panel (hud.prediction-chip)", "cause-tooltip": "with .building-inspector (hud.hover-tooltip)",
  "ledger-rights-page": "a page of the rights register (slot.ledger.rights)", "legacy-book-page": "a page inside modal.chronicle-book",
  "legacy-book-title-page": "the title page inside modal.chronicle-book", "chronicle-biography-chip": "a record link inside modal.history.biography",
  "store-accept-chip": "a tag inside the store body (map.selection.store)", "resource-name-chip": "a resource tag inside ledger and store rows",
  "era-tooltip": "an era's line inside the era console (slot.goals.era-console)", "build-menu-body": "the build drawer's body (hud.build-drawer)",
  "goal-card--done": "a goal card state", "goal-card--already": "a goal card state", "goal-card--warn": "a goal card state",
  "steward-advisor": "the steward bubble while he speaks (hud.steward-bubble)", "steward-advisor--concern": "the steward bubble's warning tone",
  "settlement-crisis": "a crisis line inside slot.goals.settlement (shown only in a food shortage or abandonment risk)",
  "ledger-population-drawer": "with .slot-panel (slot.population)",
  "ledger-drawer": "with .slot-panel (slot.ledger.*)", "build-drawer": "with .court-console (hud.build-drawer)",
  // Kit parts (the gallery, dev.ui-kit) and unmounted components.
  "ui-frame": "the kit Panel / Card / Modal (used only in the gallery and the kit Select)", "ui-chip": "the kit Chip (gallery only)",
  "resource-bar": "ResourceBar is not mounted (survey §2)", "ledger-panel": "LedgerPanel is not mounted (survey §2)",
  "resource-bar__coin-detail": "part of the unmounted ResourceBar", "alert-stack-row": "AlertStack is not mounted (survey §2)",
};
