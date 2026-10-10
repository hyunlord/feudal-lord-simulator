// UI-AUDIT-1: the register of every framed surface in the game — panels, cards, modals, popovers, tooltips, chips,
// drawers, pages, books — with how a player reaches it, the data state it is measured in and what its frame is. Data
// only: scripts/uiGeometryAudit.mjs opens each row in five viewports × two copy lengths × two number ranges and
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

import { DECISION_CARD_SURFACES } from "./decisionCard/surfaces";
import { DECISION_SURFACES } from "./lord/decisions/surfaces";
import { ESTATES_SURFACES } from "./lord/estates/surfaces";
import { LEDGER_SURFACES } from "./lord/ledger/surfaces";
import { NEGOTIATION_SURFACES } from "./lord/negotiation/surfaces";
import { REGION_SURFACES } from "./lord/region/surfaces";
import { SCREEN_SURFACES } from "./lord/screen/surfaces";
import { STEWARD_SURFACES } from "./lord/steward/surfaces";
import { RESULTS_SURFACES } from "./results/surfaces";

export type FrameKind = "css" | "layer" | "painting" | "flat";
/** The cached DGX state folders (scripts/ui{5,6,8,9,10}States.ts, scripts/ui10ExtraStates.ts; `lands`: scripts/landStates.ts, ~/fls-land-states;
 * LM-R1 `petitions`: scripts/lmr1PetitionStates.ts, ~/fls-lmr1-petition-states; `lord`: scripts/lmr1LordStates.ts, ~/fls-lord-states — the lord's slice;
 * EVENT-ART adds `registry-offer` and `registry-offer-hold` to it: scripts/eventArtStates.ts; `moments`: scripts/wave40MomentStates.ts, the Wave 40 ledger moments;
 * LM-R2 `lord2`: scripts/lmr2States.ts, ~/fls-lmr2-states — the lord's marriage, estates, promises and suits played to their states). */
export type StateSet = "ui5" | "ui6" | "ui8" | "ui9" | "ui10" | "ui10-extra" | "lands" | "petitions" | "lord" | "moments" | "lord2"
  // DEC-CARD-2: scripts/deccard2ResultsStates.ts (the result thread).
  | "deccard2"
  // LM-R3: scripts/sliceEndsStates.ts (the lord slice played by the lord bot to its end, ~/fls-slice-end-states).
  | "slice"
  // ER-13: scripts/variantStates.ts (the wording variants' cards, ~/fls-variant-states).
  | "variants"
  // GROW-BLOCK: scripts/growPlanStates.ts (the palisade plan's stages from the bot's play, ~/fls-growplan-states).
  | "growplan";
export type ViewportId = "1280x800" | "1920x1080" | "tablet-1180x820" | "1024x768" | "1280x720";

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
  | { readonly hoverEach: readonly string[]; readonly until: string; readonly max?: number }
  /** Stop the page's timers (Playwright's clock) before a step that opens a surface shown for a moment (the 900 ms
   * loading screen): it stays until measured, as the player sees it while it shows. */
  | { readonly holdTimers: true };

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
  /** Elements the surface must show, painted (the content check: title, body, choices, buttons). */
  readonly requires?: readonly string[];
  /** Only these viewports (default: all five). */
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
  // QA round 15 (QA-035, QA-018): the smallest supported width (user decision 2026-10-01: 1024 px; below it is out of
  // scope) and the short laptop screen, where the settings' last row met the action dock.
  "1024x768": { width: 1024, height: 768, touch: false },
  "1280x720": { width: 1280, height: 720, touch: false },
};

/** The always-on HUD controls (the hud check): a surface must not sit under them, nor cover them while they are live.
 * The containers (.action-dock, .crisis-icons, .event-cards, .layer-switch) let clicks through; their pieces are listed. */
export const HUD_ALWAYS: readonly string[] = [
  ".status-pill", ".hud-time-cluster .speed-seal", ".hud-time-cluster .settings-disclosure > summary", ".action-dock .action-dock-button",
  ".layer-switch .control-layer", ".crisis-icons > *", ".event-cards .event-chip", ".goal-chip-rail .goal-card", ".steward-line",
  // NAT-4 (R15 leftover): the open bubble's first row — the ledger's foot covered the steward's name above his line.
  ".action-dock + .steward-bubble .steward-name",
];

const TOWN = { kind: "state", set: "ui5", name: "merchant-town", tile: "house", zoom: 1.4 } as const;
const TOWN_CLOSE = { ...TOWN, zoom: 1.6 } as const;
const townAt = (focus: MapTarget) => ({ ...TOWN_CLOSE, focus }) as const;
const QUIET = "&story-delay=600000";
/** The goal slot's settlement progress opened (the era console inside it). */
const ERA_CONSOLE_OPEN: readonly OpenStep[] = [{ click: ".goal-drawer-toggle" }, { pause: 600 }, { click: ".settlement-progress > details > summary" }, { pause: 500 }];
/** GROW-BLOCK: the era console's palisade plan opened by its primary (lord mode). */
const WALL_PLAN_OPEN: readonly OpenStep[] = [...ERA_CONSOLE_OPEN, { click: "[data-wall-plan='open']" }, { pause: 500 }];
const growPlanScene = (name: string): SceneRef => ({ kind: "state", set: "growplan", name, tile: "house", zoom: 1.1, query: QUIET });
const DISMISS: OpenStep = { dismiss: [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"] };
const LEDGER: OpenStep = { click: "[data-dock='ledger']" };
const CHRONICLE: readonly OpenStep[] = [LEDGER, { click: ".ledger-tab--chronicle" }, { wait: ".chronicle-screen" }, { pause: 900 }];
const petitionScene = (set: StateSet, name: string, delay: number) => ({ kind: "state", set, name, tile: "house", zoom: 1.1, query: `&story-delay=${delay}` }) as const;
const PETITION = {
  root: ".story-modal.petition-card", frame: "layer", frameLayer: ".petition-frame", contentSlot: ".petition-body", frameSlots: [".petition-roundel"],
  siblingsNoOverlap: [".petition-option", ".story-modal-later"],
  // QA-034: the title, the request, every answer and the later button are shown and painted (not under the frame layer).
  requires: ["h2", ".petition-body > p:not(.petition-who)", ".petition-option", ".story-modal-later"],
} as const;
/** DEC-CARD (A3): the house card opens first of the scene's cards; the delay outlasts the page load (as CHAPTER_DELAY's
 * does), or openScene's opening Escape closes it as it opens and the petition behind it comes instead. */
const HOUSE_DELAY = 20_000;
/** DEC-CARD (result side): the year's card and the house card — the petition frame's layer, the body scrolling inside. */
const RESULTS_CARD = {
  frame: "layer", frameLayer: ".petition-frame", contentSlot: ".petition-body", scrollParts: [".petition-body"],
  siblingsNoOverlap: [".results-card-part", ".results-card-actions"],
} as const;
/** DEC-CARD: the famine and the political petitions in the heavy decision card (the petition frame; the situation, the
 * stake, the deadline, then the answers as a grid, each with now / later / who remembers). Its body scrolls past the view. */
const DECISION_CARD = {
  ...PETITION, root: ".story-modal.petition-card.decision-card.petition-decision", scrollParts: [".decision-card-body"],
  siblingsNoOverlap: [".decision-card-choice", ".story-modal-later"],
  requires: ["h2", ".decision-card-situation", ".decision-card-stake", ".decision-card-deadline", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"],
} as const;
const BOOK = { root: ".chronicle-page.legacy-book", frame: "layer", frameLayer: ".chronicle-frame", contentSlot: ".legacy-book-body", scrollParts: [".legacy-book-page"],
  scene: { kind: "state", set: "ui10", name: "chapter5-end", tile: "house", zoom: 1.1, query: "&story-delay=20000" } } as const;
/** A chapter's end page opens by itself after the story's delay; the delay must outlast the page load, or openScene's
 * opening Escape closes the page as it opens and it never comes back (the UI-9b "page does not open" flake on a busy
 * DGX). 20 s leaves the load that margin; the open step waits 90 s. */
const CHAPTER_DELAY = "&story-delay=20000";
const chapterScene = (set: StateSet, name: string) => ({ kind: "state", set, name, tile: "house", zoom: 1.1, query: CHAPTER_DELAY }) as const;
const CHAPTER_PAGE = {
  root: ".chronicle-page:not(.legacy-ending):not(.legacy-book)", frame: "layer", frameLayer: ".chronicle-frame", contentSlot: ".chapter-page-body", scrollParts: [".chapter-page-scroll"],
  open: [{ wait: ".chronicle-page", timeout: 90_000 }, { pause: 800 }],
} as const;
/** frame_person_card-v1.png 320×200: the painted rules end at x 14 / y 21 / x 305 / y 177 (PIL, UI-AUDIT-1 survey §4). */
const PERSON_CARD_ART = { art: { w: 320, h: 200 }, safe: { x: 15, y: 22, w: 290, h: 155 } } as const;
/** frame_biography.png / frame_faction_page.png 640×800: the plain parchment inside the border (PIL). */
const BIOGRAPHY_ART = { art: { w: 640, h: 800 }, safe: { x: 26, y: 29, w: 586, h: 741 } } as const;
const FACTION_PAGE_ART = { art: { w: 640, h: 800 }, safe: { x: 28, y: 29, w: 582, h: 740 } } as const;

// LM-R1 receipt: the lord's slice, the camera on its first farmstead (town-built: its receipt); the frame layer's slots
// are the picture recess, the lower field (the money) and the close seal.
const LORD_TOWN = { kind: "state", set: "lord", name: "lord-receipts", focus: { building: ["farmstead"] }, zoom: 1.4, query: QUIET } as const;
const LORD_PICK: OpenStep = { map: { building: ["farmstead"] }, action: "click" };
const RECEIPT = { frame: "layer", frameLayer: ".lord-receipt-frame", contentSlot: ".lord-receipt-body",
  frameSlots: [".lord-receipt-window", ".lord-receipt-foot", ".lord-receipt-close"], scrollParts: [".lord-receipt-body"] } as const;

/** LM-R3 (lord slice LS-2): a state a few ticks before an auto-pause, run at 1x until the notice shows. */
const PAUSE_DUE = (name: string): SceneRef => ({ kind: "state", set: "slice", name, tile: "house", zoom: 1.1, query: "&story-delay=600000", run: true });
// The stops fall on a season's turn: a fresh profile's first season card opens over the notice; closed, time stays stopped.
const PAUSE_OPEN: readonly OpenStep[] = [{ wait: ".auto-pause-notice, .season-ledger-card", timeout: 90_000 }, { pause: 1_200 },
  { dismiss: [".season-ledger-resume"] }, { wait: ".auto-pause-notice", timeout: 30_000 }, { pause: 600 }];

export const SURFACES: readonly SurfaceRow[] = [
  // --- The always-on HUD, its strips and small floating boxes (survey §2.1).
  { id: "hud.status-pill", root: ".status-pill", frame: "css", scene: TOWN, open: [], data: "seed 1 stone town: date, population, food, coin" },
  { id: "hud.season-strip-panel", root: ".season-strip-panel", frame: "css", scene: TOWN, open: [{ click: "[data-testid='hud-calendar']" }, { pause: 500 }],
    data: "the town's year strip with its marks and the food line" },
  { id: "hud.time-cluster", root: ".hud-time-cluster", frame: "css", scene: TOWN, open: [], requires: [".speed-seal-mark .speed-seal-step"],
    data: "the speed seals (PLAY-2: the fast seal's mark ×5·10) and the settings button" },
  // QA-035: on a short screen the popover scrolls inside (it stops above the dock); the HUD it would meet hides while open.
  { id: "hud.settings-popover", root: ".command-popover", frame: "css", scene: TOWN, open: [{ click: ".settings-disclosure > summary" }, { pause: 500 }], scroll: "y",
    requires: [".save-controls .ui-btn"], data: "autoplay, tutorial, audio, save and render switches" },
  { id: "hud.layer-switch", root: ".layer-switch", frame: "flat", scene: { kind: "new-game" }, open: [], numbers: false, data: "the three layers, two locked (tutorial on)" },
  { id: "hud.layer-switch-note", root: ".layer-switch-note", frame: "css", scene: { kind: "new-game" }, numbers: false,
    open: [{ click: ".control-layer[aria-disabled='true']", force: true }, { pause: 400 }], data: "a locked layer's reason (tutorial on)" },
  { id: "hud.action-dock", root: ".action-dock", frame: "flat", scene: TOWN, open: [], data: "build, ledger, steward (undo when a site is new)",
    siblingsNoOverlap: [".action-dock-button", ".hud-undo"] },
  { id: "hud.steward-bubble", root: ".steward-bubble", frame: "css", scene: TOWN, open: [{ click: "[data-dock='steward']" }, { pause: 500 }],
    scrollParts: [".steward-line"], data: "the steward's line (quiet, or the advisor's line when he speaks)" },
  { id: "hud.crisis-icons", root: ".crisis-icons", frame: "flat", scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.1, query: QUIET },
    open: [DISMISS], data: "the famine's alerts (at most three bells)" },
  { id: "hud.stuck-goods", root: ".crisis-icons .stuck-goods-chip", frame: "css", scene: { kind: "state", set: "ui10", name: "empty-manor", tile: "house", zoom: 1.1, query: QUIET },
    open: [DISMISS, { wait: ".stuck-goods-chip" }], data: "the 1404 manor's worst stuck pile (a kit secondary button left of the bells)" },
  { id: "hud.event-chips", root: ".event-cards", frame: "flat", scene: { kind: "state", set: "ui9", name: "reorg.alehouse_boom", tile: "keep", zoom: 1.1, query: "&story-delay=0" },
    open: [{ wait: ".event-chip", timeout: 90_000 }, { pause: 500 }], data: "chapter 4's alehouse boom beat" },
  { id: "hud.event-card", extends: "hud.event-chips", root: ".event-card", frame: "css", scene: { kind: "state", set: "ui9", name: "reorg.alehouse_boom", tile: "keep", zoom: 1.1, query: "&story-delay=0" },
    open: [{ click: ".event-chip" }, { pause: 600 }], scroll: "y", requires: ["h2", ".event-card-line", ".event-card-actions .ui-btn"], data: "the alehouse boom's story card" },
  // EVENT-ART (wave40): a lord-mode moment's card (src/ui/lordMomentBeats.ts) on scripts/wave40MomentStates.ts's `moments` states —
  // the suit filed (Wave 40 09), the ledger's own sentence as its line, [조언] and [닫기] (no decision, no place off the map).
  { id: "hud.event-card.lord-moment", root: ".event-card[data-story='lord_moment']", frame: "css",
    scene: { kind: "state", set: "moments", name: "lawsuit_filed", tile: "house", zoom: 1.1, query: "&story-delay=0" },
    open: [{ wait: ".event-chip[data-story='lord_moment']", timeout: 90_000 }, { click: ".event-chip[data-story='lord_moment']" }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-actions .ui-btn"], data: "the lord's suit filed: its Wave 40 picture and the ledger's sentence" },
  // PLAY-2 (friction 9): the first child's moment names the child and the parents; its record opens with their biographies.
  { id: "hud.event-card.family-moment", root: ".event-card[data-story='lord_moment']", frame: "css",
    scene: { kind: "state", set: "moments", name: "first_child", tile: "house", zoom: 1.1, query: "&story-delay=0" },
    open: [{ wait: ".event-chip[data-story='lord_moment']", timeout: 90_000 }, { click: ".event-chip[data-story='lord_moment']" }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-facts li", ".event-card-chronicle"], data: "the first child: the ledger's sentence, the child and the parents named, the way to the chronicle" },
  { id: "modal.history.family-links", root: ".chronicle-screen", frame: "flat", scrollParts: [".chronicle-list", ".chronicle-detail"],
    scene: { kind: "state", set: "moments", name: "first_child", tile: "house", zoom: 1.1, query: "&story-delay=0" },
    open: [{ wait: ".event-chip[data-story='lord_moment']", timeout: 90_000 }, { click: ".event-chip[data-story='lord_moment']" }, { pause: 600 },
      { click: ".event-card[data-story='lord_moment'] .event-card-chronicle" }, { wait: ".chronicle-detail [data-family]", timeout: 30_000 }, { pause: 900 }],
    requires: [".chronicle-detail [data-family]"], data: "the first child's record in the chronicle (as modal.history.records: the detail scrolls): a biography button for each person its record names" },
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
  { id: "hud.build-drawer", root: ".court-console.build-drawer", frame: "css", scene: TOWN, open: [{ click: "[data-dock='build']" }, { pause: 500 }], scroll: "y",
    siblingsNoOverlap: [".build-tool", ".build-menu-category"], data: "the living category's cards" },
  // LAND-UI (LU-D6): the fen's build drawer with the drain card, and the drain tool's prediction lines over a mere.
  { id: "hud.build-drawer.fen", root: ".court-console.build-drawer", frame: "css", scroll: "y",
    // The camera on the mere the drain chip row hovers (on screen in every viewport).
    scene: { kind: "state", set: "lands", name: "fen_drainage-summer", focus: { building: ["house"], offset: [-8, -14] }, zoom: 1.1, query: QUIET },
    open: [{ click: "[data-dock='build']" }, { click: ".build-menu-category[data-category='trade']" }, { pause: 500 }],
    siblingsNoOverlap: [".build-tool", ".build-menu-category"], requires: [".drain-tool"], data: "the fen's trade cards with the drain tool" },
  { id: "hud.prediction-chip.drain", extends: "hud.build-drawer.fen", root: ".prediction-panel:not(.placement-chip)", frame: "css", requires: [".prediction-line"],
    scene: { kind: "state", set: "lands", name: "fen_drainage-summer", focus: { building: ["house"], offset: [-8, -14] }, zoom: 1.1, query: QUIET },
    open: [{ click: ".drain-tool" }, { pause: 400 }, { map: { building: ["house"], offset: [-8, -14] }, action: "hover" }, { pause: 700 }],
    data: "the drain tool's lines over a mere (cells, timber, men, seasons)" },
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
  // PLAY-2 (friction 10), GROW-BLOCK since: lord mode's era console — its one primary the town's palisade plan (lordWall).
  { id: "slot.goals.era-console.lord", root: ".era-console", frame: "flat",
    scene: { kind: "state", set: "lord2", name: "offer-countered", tile: "house", zoom: 1.1, query: QUIET },
    open: ERA_CONSOLE_OPEN,
    requires: [".era-requirements", "[data-wall-plan='open']", ".era-action-reason"], data: "the hamlet's era console in lord mode: the conditions, the plan's primary and where it stands" },
  // GROW-BLOCK: the plan opened, on the bot's states of each stage (`growplan`: scripts/growPlanStates.ts, ~/fls-growplan-states).
  { id: "slot.goals.era-console.lord.plan-waiting", root: ".era-console", frame: "flat", scene: growPlanScene("plan-waiting"), open: WALL_PLAN_OPEN,
    requires: [".wall-plan", "[data-wall-plan-condition]", "[data-wall-plan-go]"], data: "the plan waiting on a condition: each unmet one, who builds its project, the lord's lever and its way" },
  { id: "slot.goals.era-console.lord.plan-sites", root: ".era-console", frame: "flat", scene: growPlanScene("plan-sites"), open: WALL_PLAN_OPEN,
    requires: [".wall-plan", "[data-wall-plan-site]"], data: "the plan waiting on open building sites: each with its age, and the sites the town gave up" },
  { id: "slot.goals.era-console.lord.plan-searching", root: ".era-console", frame: "flat", scene: growPlanScene("plan-searching"), open: WALL_PLAN_OPEN,
    requires: [".wall-plan", ".era-action-reason"], data: "the plan with every condition met and no site open: the town's turn to find the wall" },
  { id: "slot.goals.era-console.lord.plan-asked", root: ".era-console", frame: "flat", scene: growPlanScene("plan-asked"), open: WALL_PLAN_OPEN,
    requires: [".wall-plan", ".era-action-reason"], data: "the plan with the town's request waiting: answered on its own chip" },
  { id: "slot.goals.era-console.lord.plan-failed", root: ".era-console", frame: "flat", scene: growPlanScene("plan-failed"), open: WALL_PLAN_OPEN,
    requires: [".wall-plan", "[data-wall-plan-failure]"], data: "the plan after a failed search: why, the homes cut off, the attempts and the next search" },
  { id: "slot.population", root: ".ledger-population-drawer.slot-panel", frame: "css", scene: TOWN,
    open: [{ click: ".status-pill > .status-pill-cell:nth-of-type(2)" }, { pause: 600 }], scroll: "y", data: "the town's population events" },
  { id: "slot.population.panel", extends: "slot.population", root: ".population-event-panel", frame: "flat", scene: TOWN, open: [], data: "the population log inside the slot" },
  // NAT-4 (QA-028): the drawer with records in it — a loaded town has none until a house's residents change, so the
  // famine's town runs until its first loss (starvation, within ten ticks; the merchant town has none for 6,000), then
  // stops (the first speed seal).
  { id: "slot.population.records", root: ".ledger-population-drawer.slot-panel", frame: "css",
    scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.1, query: QUIET, run: true },
    open: [DISMISS, { click: ".status-pill > .status-pill-cell:nth-of-type(2)" }, { wait: ".population-event-panel ol li", timeout: 60_000 },
      { click: ".hud-time-cluster .speed-seal" }, { pause: 600 }], scroll: "y", requires: ["h2", ".population-event-panel ol .ui-btn"],
    data: "the famine town's population records after it ran (QA-028: the records, not a 22 px band)" },
  { id: "slot.inspector", root: ".slot-panel.inspector-slot", frame: "css", scene: TOWN,
    open: [LEDGER, { click: ".ledger-held-toggle" }, { click: ".ledger-store" }, { pause: 700 }], scroll: "y", data: "the first store's inspector" },
  { id: "slot.inspector.body", extends: "slot.inspector", root: ".left-inspector", frame: "css", scene: TOWN, open: [], scroll: "y", data: "the inspector inside the slot" },
  { id: "slot.ledger.stock", root: ".slot-panel.ledger-drawer", frame: "css", scene: TOWN, open: [LEDGER, { pause: 600 }], scroll: "y",
    scrollParts: [".ledger-matrix-scroll"], data: "the stone town's stocks" },
  // NAT-4 (R15 leftover): the ledger with the steward's bubble open over the dock (the town's steward speaks of a crisis
  // row; the click opens his line in full) — the slot stops above it. The bubble's own row catches it painted over.
  { id: "slot.ledger.steward", root: ".slot-panel.ledger-drawer", frame: "css", scene: TOWN,
    open: [LEDGER, { pause: 600 }, { click: "[data-dock='steward']" }, { pause: 500 }], scroll: "y", scrollParts: [".ledger-matrix-scroll"],
    expect: ".action-dock + .steward-bubble .steward-button", data: "the stone town's stocks with the steward's advice open" },
  { id: "hud.steward-bubble.ledger", extends: "slot.ledger.steward", root: ".action-dock + .steward-bubble", frame: "css", scene: TOWN, open: [],
    scrollParts: [".steward-line"], data: "the steward's open advice beside the ledger" },
  { id: "slot.ledger.steward-concern", root: ".slot-panel.ledger-drawer", frame: "css",
    scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.1, query: QUIET },
    open: [DISMISS, LEDGER, { click: "[data-ledger-tab='alerts']" }, { pause: 500 }, { click: "[data-dock='steward']" }, { pause: 500 }], scroll: "y",
    expect: ".action-dock + .steward-bubble .steward-button", data: "the famine's alerts with the steward's warning open" },
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
  { id: "map.selection.house", root: ".diagnostic-card", frame: "css", scene: TOWN_CLOSE, open: [{ map: { building: ["house"] }, action: "click" }, { pause: 800 }], scroll: "y",
    expect: ".inspector-members", data: "the first house: its household" },
  { id: "map.selection.walker", root: ".diagnostic-card", frame: "css", scene: townAt({ walker: true }), open: [{ map: { walker: true }, action: "click" }, { pause: 800 }], scroll: "y",
    expect: ".walker-headline", data: "the first walker" },
  { id: "map.selection.site", root: ".diagnostic-card", frame: "css",
    scene: { kind: "state", set: "ui9", name: "reorg.wage_competition", focus: { site: true }, zoom: 1.6, query: QUIET },
    open: [DISMISS, { map: { site: true }, action: "click" }, { pause: 800 }], scroll: "y", expect: "[data-action='cancel-construction']", data: "chapter 4's first cloth site" },
  { id: "map.selection.farmstead", root: ".diagnostic-card", frame: "css", scene: townAt({ building: ["farmstead"] }), open: [{ map: { building: ["farmstead"] }, action: "click" }, { pause: 800 }],
    scroll: "y", expect: ".inspector-crop", data: "a farmstead and its crop choice" },
  { id: "map.selection.store", root: ".diagnostic-card", frame: "css", scene: townAt({ building: ["granary"] }), open: [{ map: { building: ["granary"] }, action: "click" }, { pause: 800 }],
    scroll: "y", expect: ".store-inspector", data: "a granary's store body" },

  // --- Modals (AppModals, time stopped).
  { id: "modal.pause", root: ".pause-menu", frame: "css", scene: TOWN, open: [{ key: "Escape" }, { pause: 600 }], scroll: "y", data: "the pause menu and its settings" },
  { id: "modal.season-ledger", root: ".season-ledger-card", frame: "layer", frameLayer: ".season-ledger-frame", contentSlot: ".season-ledger-body",
    frameSlots: [".season-ledger-scenes"], scene: { kind: "state", set: "ui5", name: "carrying", tile: "house", zoom: 1.4, query: QUIET, run: true },
    open: [{ key: "Digit3" }, { wait: ".season-ledger-card", timeout: 90_000 }, { pause: 900 }], requires: ["h2", ".season-ledger-line", ".season-ledger-resume"],
    data: "the carter town's season close" },
  // DEC-CARD (result side): the year's card (src/ui/results/ResultCards.tsx) — the hook opens it at the next year's first
  // tick it sees, so the scene runs the 1302 town over its year's turn (120 ticks, at 10×); the winter's season card first.
  { id: "modal.year-review", ...RESULTS_CARD, root: ".story-modal.petition-card.results-card.year-review",
    scene: { kind: "state", set: "ui5", name: "aging-eve", tile: "house", zoom: 1.1, query: "&story-delay=1500", run: true },
    open: [{ key: "Digit0" }, { wait: ".season-ledger-resume, .results-card.year-review", timeout: 90_000 }, { click: ".season-ledger-resume", optional: true },
      { wait: ".results-card.year-review", timeout: 60_000 }, { pause: 600 }],
    requires: ["h2", ".results-card-part h3", ".results-card-part li", ".results-card-chronicle", ".results-card-continue"],
    data: "1302's card at 1303's first tick: its decisions (or none), the factions' moves, the town's people and money" },
  { id: "modal.famine", ...DECISION_CARD, root: ".story-modal.petition-card.decision-card.famine-decision", frameSlots: [],
    scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.1, query: "&story-delay=5000" },
    open: [{ story: ".famine-decision" }, { pause: 800 }], data: "chapter 1's famine decision (DEC-CARD: four answers, the steward beside the stake)" },
  // PLAY-2: the famine answered on screen (방관) — its card's line, until when and the bottleneck left (famineAfter).
  { id: "hud.event-card.famine-answered", root: ".event-card[data-story='famine']", frame: "css",
    // The story's delay outlasts the scene's setup (openScene's Escape put a card already up away for good on a busy DGX:
    // REMOTE, infra-RR26-full-7af6f5e — this row opened only in the retry round, now and then).
    scene: { kind: "state", set: "ui5", name: "famine-arrival", tile: "house", zoom: 1.1, query: "&story-delay=8000" },
    // The scene starts paused and the beats are sampled as the town runs: a moment at 1× after the answer (the speed seals;
    // Digit1 is an overlay key, and Space started the town again), paused, any card that came up put away, then the chip.
    open: [{ wait: ".famine-decision", timeout: 20_000, optional: true }, { story: ".famine-decision" }, { pause: 800 },
      { click: ".famine-decision [data-choose='laissez_faire']" }, { click: ".speed-seal[data-seal='normal']" }, { pause: 1500 },
      { click: ".speed-seal[data-seal='pause']" }, { pause: 600 }, DISMISS, { wait: ".event-chip[data-story='famine']", timeout: 30_000 },
      { repeat: ".event-chip[data-story='famine']", until: ".event-card[data-story='famine']", max: 2 }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-facts li", ".event-card-actions .ui-btn"], data: "chapter 1's famine after the answer: the line, until when, the bottleneck left" },
  { id: "modal.petition.ch1", ...DECISION_CARD, scene: petitionScene("ui5", "petition-open", 5000), open: [{ story: ".petition-card" }, { pause: 600 }], data: "chapter 1's petition" },
  { id: "modal.petition.ch2-war", ...DECISION_CARD, scene: petitionScene("ui6", "wool_payment", 5000), open: [{ story: ".petition-card" }, { pause: 700 }], data: "the Crown's writ (war)" },
  { id: "modal.petition.ch4-reorg", ...DECISION_CARD, scene: petitionScene("ui9", "borough_charter", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "the borough charter" },
  { id: "modal.petition.ch5-legacy", ...DECISION_CARD, scene: petitionScene("ui10", "borough_autonomy", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "the borough's autonomy (legacy)" },
  { id: "modal.petition.heir", ...DECISION_CARD, scene: petitionScene("ui10-extra", "heir_choice", 0), open: [{ story: ".petition-card[data-def='heir_choice']" }, { pause: 600 }],
    expect: ".petition-heir", data: "the heir's card with three candidates" },
  // QA-034: every chapter's decision cards (the frame layer covered all of them on 3acc04ff).
  { id: "modal.petition.ch3-plague", ...DECISION_CARD, scene: petitionScene("ui8", "cash_rent", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "chapter 3's cash rent" },
  { id: "modal.petition.ch4-guild", ...DECISION_CARD, scene: petitionScene("ui9", "guild_charter", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "chapter 4's guild charter" },
  { id: "modal.petition.ch5-royal-tax", ...DECISION_CARD, scene: petitionScene("ui10", "royal_tax", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "the Crown's tax, 1384 (QA-034)" },
  { id: "modal.petition.ch5-legacy-choice", ...DECISION_CARD, scene: petitionScene("ui10", "legacy_choice", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "the legacy choice" },
  { id: "modal.petition.interlude-guild", ...DECISION_CARD, scene: petitionScene("ui10", "guild_dispute", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "the interlude's guild dispute" },
  { id: "modal.petition.interlude-church", ...DECISION_CARD, scene: petitionScene("ui10", "church_rebuilding", 0), open: [{ story: ".petition-card" }, { pause: 600 }], data: "the interlude's church rebuilding" },
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
    // LM-R3: the campaign is the sandbox's "목표와 함께" option, and a mode press opens the house choice first.
    open: [{ holdTimers: true }, { click: ".welcome-parchment [data-sandbox-goal]" }, { click: ".welcome-parchment [data-scenario='core:campaign_market_town']" },
      { click: ".welcome-parchment [data-house-start]" }, { wait: ".chapter-loading", timeout: 5_000 }], data: "the new game's loading screen (900 ms)" },
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
    frameSlots: [".chronicle-biography-cover"], scrollParts: [".chronicle-biography-band > ul", ".chronicle-biography-header", ".chronicle-biography-life"],
    portraitRing: { cx: 162, cy: 216, r: 112, inner: 100, face: ".chronicle-biography-portrait", ornament: ".chronicle-biography-ornament" },
    open: [{ click: ".person-card .person-card-action" }, { wait: ".chronicle-biography" }, { pause: 1200 }], data: "that person's biography page" },
  // QA-015 (Astra round 15): the king in 1384 has no records — the biography's empty-records line met the art's middle
  // rule. Reached as Astra did: the Crown's tax card → the sender's chip → his card → his biography.
  { id: "modal.person-card.king", extends: "modal.petition.ch5-royal-tax", root: ".person-card", frame: "painting", painting: PERSON_CARD_ART,
    scene: petitionScene("ui10", "royal_tax", 0), frameSlots: [".person-card-emblem-cover"],
    portraitRing: { cx: 59.5, cy: 83.5, r: 43, inner: 33.5, face: ".person-card-portrait .person-portrait-layer", ornament: ".person-card-portrait .person-state-ornament" },
    open: [{ click: ".petition-people .person-chip" }, { wait: ".person-card" }, { pause: 700 }], data: "the king's card (no records)" },
  { id: "modal.history.biography.king", extends: "modal.person-card.king", root: ".chronicle-biography", frame: "painting", painting: BIOGRAPHY_ART,
    scene: petitionScene("ui10", "royal_tax", 0), frameSlots: [".chronicle-biography-cover"],
    scrollParts: [".chronicle-biography-band > ul", ".chronicle-biography-header", ".chronicle-biography-life"],
    portraitRing: { cx: 162, cy: 216, r: 112, inner: 100, face: ".chronicle-biography-portrait", ornament: ".chronicle-biography-ornament" },
    open: [{ click: ".person-card .person-card-action" }, { wait: ".chronicle-biography" }, { pause: 1200 }], data: "the king's biography: the empty-records line" },
  { id: "modal.history.family-tree", extends: "modal.history.biography", root: ".family-tree", frame: "flat", scene: TOWN_CLOSE, scroll: "xy",
    open: [{ click: ".chronicle-person-tabs .chronicle-tab:nth-child(2)" }, { pause: 900 }], siblingsNoOverlap: [".family-tree-node", ".family-tree-toggle"],
    data: "that person's family tree" },
  { id: "modal.history.tree-banner", extends: "modal.history.family-tree", root: ".family-tree-banner", frame: "css", scene: TOWN_CLOSE, open: [], data: "the lineage banner" },
  { id: "modal.history.tree-generation", extends: "modal.history.tree-banner", root: ".family-tree-generation", frame: "css", scene: TOWN_CLOSE, open: [],
    data: "the first generation label" },
  { id: "modal.history.tree-node", extends: "modal.history.tree-generation", root: ".family-tree-node", frame: "css", scene: TOWN_CLOSE, open: [], data: "the first person node" },
  { id: "modal.history.factions", root: ".chronicle-factions", frame: "flat", scene: { kind: "state", set: "ui9", name: "rumour-chased", tile: "house", zoom: 1.1, query: QUIET },
    open: [{ pause: 1000 }, DISMISS, ...CHRONICLE, { click: ".chronicle-tabs:not(.chronicle-person-tabs) .chronicle-tab:nth-child(2)" }, { pause: 900 }],
    // The world strip is a sideways scroller by design (overflow-x auto, focusable, its focus ring).
    scrollParts: [".chronicle-world-strip"], siblingsNoOverlap: [".chronicle-factions-row"], data: "chapter 4's factions: influence, tug of war, relations" },
  // INSTALL-18: Wave 14's faction panel around the list (a css nine-slice frame), its heading in the frame's title band.
  { id: "modal.history.factions-panel", extends: "modal.history.factions", root: ".chronicle-factions-panel", frame: "css",
    scene: { kind: "state", set: "ui9", name: "rumour-chased", tile: "house", zoom: 1.1, query: QUIET }, open: [], frameSlots: [".chronicle-factions-heading"],
    siblingsNoOverlap: [".chronicle-factions-row"], data: "the nine factions' rows in Wave 14's faction panel, the kind icons beside four names" },
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
    data: "a fresh profile's title parchment: the logo, the lands, lord mode and the sandbox (its goal option)" },
  // LM-R3 (HOUSE-1): the house choice after a mode press — the twenty names, the arms, the start.
  { id: "screen.welcome.house", root: ".welcome-house", frame: "css", scene: { kind: "title" }, numbers: false,
    open: [{ click: ".welcome-parchment [data-scenario='core:lord_slice']" }, { wait: ".welcome-house" }, { pause: 800 }],
    data: "the welcome's house choice (lord mode, de Haverel by default)" },
  { id: "dev.ui-kit", root: ".ui-kit-gallery-frame", frame: "css", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [{ pause: 800 }],
    data: "the kit gallery's first frame" },
  { id: "dev.ui-kit.section", extends: "dev.ui-kit", root: ".ui-kit-gallery-section", frame: "css", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [],
    data: "the gallery's first section panel" },
  { id: "dev.ui-kit.dark", extends: "dev.ui-kit.section", root: ".ui-kit-gallery-dark", frame: "css", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [],
    data: "the gallery's dark panel" },
  { id: "dev.ui-kit.tooltip", extends: "dev.ui-kit.dark", root: ".ui-tooltip", frame: "css", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [],
    data: "the kit Tooltip in the gallery" },
  // NAT-4 (LU-D7): the kit NumberField's row in the gallery (the land agent's NumberField; screen.welcome holds the map number one).
  { id: "dev.ui-kit.number", extends: "dev.ui-kit", root: "[data-states='number']", frame: "flat", scene: { kind: "route", path: "dev/ui-kit" }, numbers: false, open: [],
    data: "the kit NumberField's states in the gallery" },
  // LM-R1 petitions: the lord's cards in lord mode (src/ui/hud/LordCards.tsx) on scripts/lmr1PetitionStates.ts's states — a
  // home estate's petition with its Wave 44 picture (opens by itself), one without a picture, a minor lord's court line
  // and the town's request (from its chip). DEC-CARD-2: the precedent card is gone (DTR-1; the season card's steward).
  // The picture is not a required element: the content check proves paint by text and controls changing between its two
  // captures, which a picture never does (scripts/lmr1PetitionCaptures.mjs checks each picture loads at 960 × 540).
  { id: "modal.lord.home-petition", ...PETITION, scrollParts: [".decision-card-body"], root: ".story-modal.petition-card.decision-card.lord-card[data-home-petition]", frameSlots: [".petition-roundel"], siblingsNoOverlap: [".decision-card-choice", ".story-modal-later"],
    requires: ["h2", ".decision-card-court", ".decision-card-situation", ".decision-card-stake", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"],
    scene: petitionScene("petitions", "home-boundary_dispute", 3000), open: [{ story: ".lord-card[data-home-petition]" }, { pause: 600 }], data: "the boundary dispute (Wave 44 01) in the DEC-CARD layout: the situation, the stake, each answer now / later / who remembers" },
  { id: "modal.lord.home-petition.no-art", ...PETITION, scrollParts: [".decision-card-body"], root: ".story-modal.petition-card.decision-card.lord-card[data-home-petition]", frameSlots: [".petition-roundel"], siblingsNoOverlap: [".decision-card-choice", ".story-modal-later"],
    requires: ["h2", ".decision-card-court", ".decision-card-situation", ".decision-card-stake", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"],
    scene: petitionScene("petitions", "home-chancel_repair", 3000), open: [{ story: ".lord-card[data-home-petition]" }, { pause: 600 }], data: "the chancel's repair (no picture)" },
  { id: "modal.lord.home-petition.guardian", ...PETITION, scrollParts: [".decision-card-body"], root: ".story-modal.petition-card.decision-card.lord-card[data-home-petition]", frameSlots: [".petition-roundel"], siblingsNoOverlap: [".decision-card-choice", ".story-modal-later"],
    requires: ["h2", ".decision-card-court", ".decision-card-choose", ".story-modal-later"],
    scene: petitionScene("petitions", "guardian", 3000), open: [{ story: ".lord-card[data-home-petition]" }, { pause: 600 }], data: "a minor lord's wardship petition (the court line with his guardian)" },
  { id: "modal.lord.request", ...PETITION, scrollParts: [".decision-card-body"], root: ".story-modal.petition-card.decision-card.lord-card[data-lord-request]", frameSlots: [],
    siblingsNoOverlap: [".decision-card-choice", ".story-modal-later"],
    requires: ["h2", ".decision-card-court", ".decision-card-situation", ".decision-card-stake", ".decision-card-deadline", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"],
    scene: petitionScene("petitions", "request", 1500), open: [{ story: ".lord-card[data-lord-request]" }, { pause: 600 }],
    data: "the town's request (a proclamation waiting) in the DEC-CARD layout: the grant's now (the works it opens) and later (the actual's day)" },
  // DEC-CARD (Astra A3): a change in the lord's house as one card before the petitions (src/ui/results/ResultCards.tsx), on
  // the real states that hold one: the lord's wardship begun on the tick the boundary dispute came, the neighbour's estate
  // inherited through the wife (its title, possession and the debts promised with it). DEC-CARD-2: the lord's death is
  // src/ui/results/surfaces.ts's row, on the engine's succession.
  { id: "modal.house-change.wardship", ...RESULTS_CARD, root: ".story-modal.petition-card.results-card.house-change[data-house-change='wardship_begun']",
    scene: petitionScene("petitions", "home-boundary_dispute", HOUSE_DELAY), open: [{ wait: ".results-card.house-change", timeout: 90_000 }, { pause: 600 }],
    requires: ["h2", ".results-card-court", ".house-change-heir", ".results-card-part li", ".house-change-next", ".results-card-continue"],
    data: "a minor lord's wardship begun (Wave 40 13): who, the guardian, no right changed, his card as the next act — before the boundary dispute's card" },
  { id: "modal.house-change.inherited", ...RESULTS_CARD, root: ".story-modal.petition-card.results-card.house-change[data-house-change='inherited']",
    scene: petitionScene("moments", "inheritance_fealty", HOUSE_DELAY), open: [{ wait: ".results-card.house-change", timeout: 90_000 }, { pause: 600 }],
    requires: ["h2", ".results-card-court", ".house-change-heir", ".results-card-part li", ".house-change-next", ".results-card-continue"],
    data: "the neighbour's estate inherited (Wave 40 08): the old lord's death, the title and possession, five debts promised, the estates screen as the next act" },
  // EVENT-ART: the registry's event card (src/ui/hud/RegistryCard.tsx) on scripts/eventArtStates.ts's states — the lord's
  // slice played by the lord bot to the first content canon v4 offer the registry draws, and to the first whose card has a
  // hold (ER-19: its cost under its tradeoff); it opens by itself after the world, as a petition does. The picture is not
  // a required element (as above).
  { id: "modal.lord.registry", ...PETITION, scrollParts: [".decision-card-body"], root: ".story-modal.petition-card.decision-card.lord-card[data-registry-offer]", frameSlots: [],
    siblingsNoOverlap: [".decision-card-choice", ".story-modal-later"],
    requires: ["h2", ".decision-card-court", ".decision-card-situation", ".decision-card-stake", ".decision-card-deadline", ".registry-card-why li", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"],
    scene: petitionScene("lord", "registry-offer", 3000), open: [{ story: ".lord-card[data-registry-offer]" }, { pause: 600 }],
    data: "the first v4 offer the registry drew in the lord's slice (DEC-CARD layout): its why, each answer's tradeoff, now / later / who remembers, the shut one with why" },
  { id: "modal.lord.registry-hold", ...PETITION, scrollParts: [".decision-card-body"], root: ".story-modal.petition-card.decision-card.lord-card[data-registry-offer]", frameSlots: [],
    siblingsNoOverlap: [".decision-card-choice", ".story-modal-later"],
    requires: ["h2", ".decision-card-court", ".decision-card-situation", ".decision-card-stake", ".decision-card-deadline", ".registry-card-why li", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"],
    scene: petitionScene("lord", "registry-offer-hold", 3000), open: [{ story: ".lord-card[data-registry-offer]" }, { pause: 600 }],
    data: "the first v4 offer with a hold the lord can choose (DEC-CARD layout): the hold's cost as the engine's run shows it (the claim weakened)" },
  // LM-R1 receipt: lord mode's "왜 여기?" receipt beside a selected building's card, and the ledger drawer's lord tab
  // (scripts/lmr1LordStates.ts: the lord's slice with the stability policy, dues 80% and a 10d farmstead subsidy).
  { id: "map.selection.lord-farmstead", root: ".diagnostic-card", frame: "css", scene: LORD_TOWN, open: [LORD_PICK], scroll: "y",
    expect: ".lord-why-here", data: "the lord's slice: a town-built farmstead's card with its why-here button" },
  { id: "lord.receipt", root: ".lord-receipt", ...RECEIPT, scene: LORD_TOWN, open: [LORD_PICK, { click: ".lord-why-here" }, { pause: 600 }],
    requires: ["h2", ".lord-receipt-reason", ".lord-receipt-value", ".lord-receipt-ribbon", ".lord-receipt-foot"],
    data: "a town-built farmstead's receipt: five reasons, the next best site, the chance, the 10d subsidy and its decisions" },
  { id: "lord.receipt-old", root: ".lord-receipt", ...RECEIPT, scene: { ...LORD_TOWN, name: "lord-receipts-old" }, open: [LORD_PICK, { click: ".lord-why-here" }, { pause: 600 }],
    requires: ["h2", ".lord-receipt-reason", "[data-chance='none']"], data: "the same receipt from a save before the chance was kept" },
  { id: "lord.receipt-none", root: ".lord-receipt", ...RECEIPT, scene: { ...LORD_TOWN, focus: { building: ["well"] } },
    open: [{ map: { building: ["well"] }, action: "click" }, { pause: 800 }, { click: ".lord-why-here" }, { pause: 600 }],
    requires: ["h2", ".lord-receipt-none"], data: "the opening well: no receipt, the reason instead of an empty frame" },
  // Astra B03: a store opened from the ledger's stock (the left inspector) — its receipt on the shell, left of the slot.
  { id: "lord.receipt-inspector", root: ".lord-receipt.lord-receipt--slot", ...RECEIPT, scene: LORD_TOWN,
    open: [LEDGER, { click: ".ledger-held-toggle" }, { click: ".ledger-store" }, { pause: 700 }, { click: ".left-inspector .lord-why-here" }, { pause: 600 }],
    requires: ["h2"], data: "the first store's receipt (or why it has none) from the left inspector" },
  { id: "slot.ledger.lord", root: ".slot-panel.ledger-drawer", frame: "css", scene: LORD_TOWN, open: [LEDGER, { click: "[data-ledger-tab='lord']" }, { pause: 500 }], scroll: "y",
    requires: [".lord-policy-option", ".lord-policy-kind", ".lord-policy-set", "[data-dues='raise']"], siblingsNoOverlap: [".lord-policy-option"],
    data: "the lord tab: the four policies (stability), the 10d farmstead subsidy, the draft and the dues at 80%" },
  // The quarter-of-the-treasury refusal: the draft raised until the engine refuses it (the extreme treasury never does).
  { id: "slot.ledger.lord-refusal", extends: "slot.ledger.lord", root: ".slot-panel.ledger-drawer", frame: "css", scene: LORD_TOWN, numbers: false, scroll: "y",
    open: [{ repeat: "[data-step='more']", until: ".lord-policy-refusal[data-refused='true']", max: 15 }, { pause: 300 }],
    requires: [".lord-policy-refusal"], data: "a subsidy draft past a quarter of the treasury: the reason written, the set button shut" },
  // Playtest 2026-10-02 #5: the food cell's breakdown under the pill (total, milling, carrying, access, hunger).
  { id: "hud.food-breakdown", root: ".food-breakdown", frame: "css", scene: TOWN, open: [{ click: ".status-pill-cell[data-food-days]" }, { pause: 500 }],
    requires: [".food-breakdown-row", ".food-breakdown-ledger"], data: "the town's food split five ways, the ledger and close buttons" },
  // DEC-CARD A2: lord mode's pill ends with "내 도시로" (the camera to the town's seat); A5: the stock tab under the
  // treasury line shows the treasury by estate (rent, taxes, contracts, spending), lord mode only.
  { id: "hud.status-pill.lord", root: ".status-pill", frame: "css", scene: LORD_TOWN, open: [], requires: [".status-pill-town"],
    data: "the lord's slice: date, population, food, coin and the way back to town" },
  { id: "slot.ledger.stock-lord", root: ".slot-panel.ledger-drawer", frame: "css", scene: LORD_TOWN, open: [LEDGER, { pause: 600 }], scroll: "y",
    scrollParts: [".ledger-matrix-scroll"], requires: [".treasury-estates h3", "[data-treasury-settled]", ".treasury-estates-list > li", ".treasury-estates-note"],
    data: "the lord's slice stock tab: the treasury by estate under the treasury line, then the stocks" },
  // Lord mode's command pins in the build drawer's place, on the receipt's lord-mode state (scripts/lmr1LordStates.ts).
  { id: "hud.command-pins", root: ".command-pins", frame: "css", scene: LORD_TOWN, numbers: false, open: [{ click: "[data-dock='build']" }, { pause: 500 }],
    requires: [".command-pin"], data: "the lord's public work (the keep, locked until the fortified town) and encouragement-zone pins" },
  // LM-R2: the lord screen host and its four areas' screens (each area's rows in its own file, src/ui/lord/<area>/surfaces.ts).
  ...SCREEN_SURFACES, ...NEGOTIATION_SURFACES, ...LEDGER_SURFACES, ...ESTATES_SURFACES, ...REGION_SURFACES,
  // LM-R2: the lord's decision cards (src/ui/lord/decisions/surfaces.ts).
  ...DECISION_SURFACES,
  // DEC-CARD-2: the standing policies and the season card's steward section (src/ui/lord/steward/surfaces.ts).
  ...STEWARD_SURFACES,
  // DEC-CARD-2: the result thread (src/ui/results/surfaces.ts; the house card's lord-died row moved there).
  ...RESULTS_SURFACES,
  // LM-R3 (lord slice LS-2): the lord-mode auto-pause's notice. Its states are in the `slice` set (scripts/autoPauseStates.ts:
  // the lord bot's seed 3 a few ticks before a stop); the scene runs time from there and the game stops by itself, the
  // story quiet (no chip or card opens over the notice).
  { id: "hud.auto-pause", root: ".auto-pause-notice", frame: "css", scene: PAUSE_DUE("pause-due"), open: PAUSE_OPEN, scroll: "y",
    requires: [".auto-pause-title", ".auto-pause-word", ".auto-pause-sentence", ".auto-pause-resume"],
    data: "time run in the lord slice until the engine names a reason (the first, a great person's death): why it stopped, the ledger's line and the way on" },
  { id: "hud.auto-pause.link", root: ".auto-pause-notice", frame: "css", scene: PAUSE_DUE("pause-due-suit"), open: PAUSE_OPEN, scroll: "y",
    requires: [".auto-pause-title", ".auto-pause-word", ".auto-pause-sentence", ".auto-pause-link", ".auto-pause-resume"],
    siblingsNoOverlap: [".auto-pause-link", ".auto-pause-resume"],
    data: "time run until a suit is judged: the judgment's line with the way to its suit on the ledger screen beside the way on" },
  // ER-13: the home petition's and the registry offer's cards in the canon's variant words (src/ui/decisionCard/surfaces.ts).
  ...DECISION_CARD_SURFACES,
  // LM-R3 phase 2a: the lord slice's opening page (after the welcome's house step, at the game's first tick: time started)
  // and its end (scripts/sliceEndsStates.ts: the lord bot's seed 3 at the slice's first ended tick; no mark, so no year card
  // opens after the load — the end page does, after the story's delay). TRACE-KEEP: the state played on the engine that keeps
  // the big decisions in the thread to the end (DTR-24), so the page's years list 1300–1308's too.
  { id: "modal.slice-start", root: ".chronicle-page.slice-page[data-slice='start']", frame: "layer", frameLayer: ".chronicle-frame", contentSlot: ".chapter-page-body",
    scrollParts: [".chapter-page-scroll"], scene: { kind: "title" }, numbers: false,
    open: [{ click: ".welcome-parchment [data-scenario='core:lord_slice']" }, { wait: ".welcome-house" }, { click: ".welcome-parchment [data-house-start]" },
      { pause: 1_500 }, { click: ".speed-seal[data-seal='normal']" }, { wait: ".slice-page[data-slice='start']", timeout: 30_000 }, { pause: 1_200 }],
    requires: ["h2", ".slice-you", ".slice-neighbours li", ".slice-factions li", ".slice-rules li", ".slice-begin"],
    data: "a new lord-slice game's opening page (de Haverel): the house and its arms, the home estate, the town, the neighbours, the five factions, the slice's years" },
  { id: "modal.slice-end", root: ".chronicle-page.slice-page[data-slice='end']", frame: "layer", frameLayer: ".chronicle-frame", contentSlot: ".chapter-page-body",
    scrollParts: [".chapter-page-scroll"], scene: { kind: "state", set: "slice", name: "slice-end", tile: "house", zoom: 1.1, query: CHAPTER_DELAY },
    open: [{ wait: ".slice-page[data-slice='end']", timeout: 90_000 }, { pause: 800 }],
    requires: ["h2", ".slice-last-year li", ".slice-year-card", ".slice-season-card", ".slice-why p", ".chronicle-maps", ".slice-decisions li", ".slice-record",
      ".slice-remembers li", ".slice-year-lines li", ".slice-year-big li", ".slice-year-small", ".slice-small-total", ".slice-chronicle", ".slice-continue"],
    data: "the slice's end in 1317 (seed 3, five years after the second estate of 1312; ~/fls-slice-end-states rebuilt on the TRACE-KEEP engine): the last year 1316 at the top with its two cards as links, why and when, then and now with the maps, the decisions ranked by what followed, who remembers, a line a year with its big decisions from the thread (1300-1308 too) and what followed each, and its small matters counted in one line" },
  { id: "modal.slice-end.record", extends: "modal.slice-end", root: ".chronicle-screen", frame: "flat", scene: { kind: "state", set: "slice", name: "slice-end", tile: "house", zoom: 1.1, query: CHAPTER_DELAY },
    open: [{ click: ".slice-decisions .slice-record" }, { wait: ".chronicle-screen", timeout: 30_000 }, { pause: 900 }], scrollParts: [".chronicle-list", ".chronicle-detail"],
    requires: [".chronicle-filters", ".chronicle-card"], data: "the end page's first decision (1300's market dues, 67 rows followed) opened in the chronicle on its record (closing it comes back to the page)" },
  // The user's ruling (2026-10-09): the end page takes the live end's cards' place and links to them.
  { id: "modal.slice-end.year-card", extends: "modal.slice-end", root: ".story-modal.petition-card.results-card.year-review", frame: "layer", frameLayer: ".petition-frame",
    contentSlot: ".petition-body", scrollParts: [".petition-body"], siblingsNoOverlap: [".results-card-part", ".results-card-actions"],
    scene: { kind: "state", set: "slice", name: "slice-end", tile: "house", zoom: 1.1, query: CHAPTER_DELAY },
    open: [{ click: ".slice-last-year .slice-year-card" }, { wait: ".results-card.year-review", timeout: 30_000 }, { pause: 600 }],
    requires: ["h2", ".results-card-part h3", ".results-card-chronicle", ".results-card-continue"], data: "1316's year card (the last year; the slice ends in 1317 spring by its second estate) opened from the end page's link (the engine's yearReview)" },
  { id: "modal.slice-end.season-card", extends: "modal.slice-end", root: ".season-ledger-card", frame: "layer", frameLayer: ".season-ledger-frame", contentSlot: ".season-ledger-body",
    frameSlots: [".season-ledger-scenes"], scene: { kind: "state", set: "slice", name: "slice-end", tile: "house", zoom: 1.1, query: CHAPTER_DELAY },
    open: [{ click: ".slice-last-year .slice-season-card" }, { wait: ".season-ledger-card", timeout: 30_000 }, { pause: 900 }],
    // Its content scrolls in its own region, as the lord-mode season card's row (modal.season-ledger.steward) declares.
    requires: ["h2", ".season-ledger-line", ".season-ledger-resume"], scrollParts: [".season-ledger-content"],
    data: "1316 winter's season card (the last closed before the end in 1317 spring) opened from the end page's link (it does not open by itself at the end)" },
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
  "ui-number": "the kit NumberField (a control; measured inside screen.welcome and the gallery)",
  "resource-bar": "ResourceBar is not mounted (survey §2)", "ledger-panel": "LedgerPanel is not mounted (survey §2)",
  "resource-bar__coin-detail": "part of the unmounted ResourceBar", "alert-stack-row": "AlertStack is not mounted (survey §2)",
  // LM-R1 buttons: Wave 38 control pictures on parts of kit controls (the controls check covers the controls themselves).
  "ui-select-option": "the kit select's active row (Wave 38 select_row_hover; inside modal.select-list)",
  "ui-slider": "the kit slider's groove (Wave 38 slider_track; a control measured in hud.settings-popover and the gallery)",
  "app-shell": "the Wave 38 scrollbar track and thumb (::-webkit-scrollbar of every scroller in the app shell; not a box)",
};
