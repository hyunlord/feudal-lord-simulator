import type { OpenStep, SceneRef, SurfaceRow } from "../../surfaces.registry";
import { OPEN_LORD, openLordScreen } from "../screen/surfaces";

// MARKET-TOWN: the lord's screens after the market charter's proclamation, on the `market` states
// (scripts/marketTownStates.ts, DGX ~/fls-market-states: the lord bot's slice one season after the proclamation,
// `market-proclaimed`, and four years after it, `market-years`). Rows as the hamlet's in each area's file, on these states.

/** A market state, the camera on the town's first house, the story quiet (no chip or card opens over the panel). */
const marketScene = (name: "market-proclaimed" | "market-years", query = "&story-delay=600000"): SceneRef => ({ kind: "state", set: "market", name, tile: "house", zoom: 1.1, query });
const PROCLAIMED = marketScene("market-proclaimed");
const YEARS = marketScene("market-years");
/** The goal slot's settlement progress opened (the era console inside it), as the registry's ERA_CONSOLE_OPEN. */
const ERA_CONSOLE_OPEN: readonly OpenStep[] = [{ click: ".goal-drawer-toggle" }, { pause: 600 }, { click: ".settlement-progress > details > summary" }, { pause: 500 }];
const HOST = { root: ".slot-panel.lord-screen", frame: "css", scrollParts: [".lord-screen-nav", ".lord-screen-content"] } as const;
/** market-years with the story's chips coming after a delay that outlasts the scene's setup (GEO-D1). */
const CHIPS_YEARS = marketScene("market-years", "&story-delay=8000");
/** The chips come (a first wait past the delay); a card or a chapter's page that opened by itself is put off (kept for later). */
const CHIPS_COME: readonly OpenStep[] = [{ wait: ".event-chip", timeout: 90_000 }, { wait: ".story-modal, .chronicle-page", timeout: 20_000, optional: true },
  { dismiss: [".chronicle-page .chronicle-keep", ".story-modal-later"] }];
const chipCard = (head: string): readonly OpenStep[] => [{ wait: `.event-chip[data-chip-id^='${head}']`, timeout: 90_000 }, ...CHIPS_COME.slice(1), { pause: 400 },
  { click: `.event-chip[data-chip-id^='${head}']` }, { pause: 600 }];
const LEDGER_LORD: readonly OpenStep[] = [{ click: "[data-dock='ledger']" }, { click: "[data-ledger-tab='lord']" }, { pause: 500 }];

export const MARKET_SURFACES: readonly SurfaceRow[] = [
  // GROW-BLOCK §4's sixth stage: past the hamlet the console's plan is one quiet line (lordWallPlanDone), no primary of its own.
  { id: "slot.goals.era-console.lord.past", root: ".era-console", frame: "flat", scene: PROCLAIMED, open: ERA_CONSOLE_OPEN,
    requires: [".era-requirements", ".era-wall-progress", ".era-wall-priority", ".era-plan-done"],
    data: "the market town's era console a season after the proclamation: the stone town's conditions, the wall's segments and priority, the plan's past line" },
  { id: "slot.goals.era-console.lord.past-years", root: ".era-console", frame: "flat", scene: YEARS, open: ERA_CONSOLE_OPEN,
    requires: [".era-requirements", ".era-wall-progress", ".era-wall-priority", ".era-plan-done"],
    data: "the era console four years on: the stone town's conditions, the wall further on, the plan's past line" },
  { id: "slot.goals.market", root: ".slot-panel.goal-slot", frame: "css", scene: PROCLAIMED, open: [{ click: ".goal-drawer-toggle" }, { pause: 600 }], scroll: "y",
    requires: [".settlement-status"], data: "the goal slot of the market town: the goal log, the settlement line past the hamlet and its progress" },
  { id: "hud.status-pill.market", root: ".status-pill", frame: "css", scene: PROCLAIMED, open: [], requires: [".status-pill-town"],
    data: "the market town's pill a season after the proclamation: date, population, food, coin, the way back to town" },
  { id: "hud.status-pill.market-years", root: ".status-pill", frame: "css", scene: YEARS, open: [], requires: [".status-pill-town"],
    data: "the pill four years on: the slice ended, the treasury nearly doubled" },
  { id: "hud.command-pins.market", root: ".command-pins", frame: "css", scene: PROCLAIMED, numbers: false, open: [{ click: "[data-dock='build']" }, { pause: 500 }],
    requires: [".command-pin"], data: "the lord's public work and encouragement-zone pins once the town is a market town" },
  { id: "lord.screen.market", ...HOST, scene: PROCLAIMED, open: OPEN_LORD, requires: ["h2", ".lord-screen-nav-item", ".slot-panel-close"],
    siblingsNoOverlap: [".lord-screen-nav-item"], data: "the lord screen host over the market town: the menu and the first open page" },
  { id: "lord.estates.market", ...HOST, scene: YEARS, open: openLordScreen("estates"),
    requires: [".lord-estates-totals", ".lord-estates-attention", ".lord-estates-pick", ".lord-estates-card", ".lord-estates-pieces"], siblingsNoOverlap: [".lord-estates-pick"],
    data: "the estates screen four years after the proclamation: the totals, the attention, the estates held, the home card" },
  { id: "lord.ledger.market", ...HOST, scene: YEARS, open: openLordScreen("ledger"), requires: [".lord-ledger-book", ".lord-ledger-suit", ".lord-ledger-defence"],
    siblingsNoOverlap: [".lord-ledger-suit"], data: "the ledger four years after the proclamation: the promises, four closed suits and a house's suit against the lord at its evidence stage, his defence" },
  // The chips the states hold, and their cards: each chip comes after the story's delay, which outlasts the scene's setup,
  // and the first wait outlasts the delay (GEO-D1); a card that opened by itself is put off first.
  { id: "hud.event-chips.market", root: ".event-cards", frame: "flat", scene: CHIPS_YEARS, open: [...CHIPS_COME, { pause: 500 }],
    requires: [".event-chip[data-chip-id^='suit-defence:']", ".event-chip[data-chip-id^='lord-moment:']"],
    data: "four years after the proclamation, the rail's chips: a house's suit against the lord, the lord's moment, the last decision's trace" },
  { id: "hud.event-card.suit-defence.market", root: ".event-card[data-chip-id^='suit-defence:']", frame: "css", scene: CHIPS_YEARS, open: chipCard("suit-defence:"), scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-facts li", ".event-card-decide"],
    data: "four years after the proclamation, a house's suit against the lord as its chip's card: its filing, its stage and next season, the button to the ledger" },
  { id: "hud.event-card.lord-moment.market", root: ".event-card[data-chip-id^='lord-moment:']", frame: "css", scene: CHIPS_YEARS, open: chipCard("lord-moment:"), scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-actions .ui-btn"], data: "four years after the proclamation, the lord's latest moment as its chip's card: the ledger's sentence" },
  // Chapter 1 (1300–1317) ends a season after the proclamation: its page opens by itself (the delay outlasts the page load).
  { id: "modal.chapter-page.market", root: ".chronicle-page:not(.legacy-ending):not(.legacy-book)", frame: "layer", frameLayer: ".chronicle-frame",
    contentSlot: ".chapter-page-body", scrollParts: [".chapter-page-scroll"], scene: marketScene("market-proclaimed", "&story-delay=20000"),
    open: [{ wait: ".chronicle-page", timeout: 90_000 }, { pause: 800 }], requires: ["h2", ".chronicle-keep"],
    data: "chapter 1's page in the lord's slice, a season after the market charter's proclamation: 1300–1317 as the chronicle keeps it" },
  { id: "hud.event-card.famine.market", root: ".event-card[data-chip-id^='famine:']", frame: "css", scene: marketScene("market-proclaimed", "&story-delay=8000"),
    open: chipCard("famine:"), scroll: "y", requires: ["h2", ".event-card-line", ".event-card-actions .ui-btn"],
    data: "a season after the proclamation, the great famine's chip (1315–17, the bot's answer given) as its card: its line, until when" },
  { id: "lord.negotiation.market", ...HOST, scene: YEARS, open: openLordScreen("marriage"), requires: [".lord-neg-head h3"],
    data: "the marriage page four years after the proclamation" },
  { id: "lord.region.market", ...HOST, scene: YEARS, open: openLordScreen("region"), requires: ["h3", ".lord-region-map", ".lord-region-site"],
    siblingsNoOverlap: [".lord-region-site", ".lord-region-zoom"], data: "the region map four years after the proclamation: the estates held and the neighbours" },
  { id: "lord.standing.market", ...HOST, scene: YEARS, open: openLordScreen("petitions"),
    requires: [".lord-standing h3", ".lord-standing-family", ".lord-standing-open"], siblingsNoOverlap: [".lord-standing-open"],
    data: "the standing policies of the market town: each kind with its setting" },
  { id: "slot.ledger.lord.market", root: ".slot-panel.ledger-drawer", frame: "css", scene: YEARS, open: LEDGER_LORD, scroll: "y",
    requires: [".lord-screen-open", ".lord-policy-option"], data: "the ledger's lord tab in the market town: the way into the lord screens, the policies" },
  { id: "slot.ledger.stock-lord.market", root: ".slot-panel.ledger-drawer", frame: "css", scene: YEARS, open: [{ click: "[data-dock='ledger']" }, { pause: 600 }], scroll: "y",
    scrollParts: [".ledger-matrix-scroll"], requires: [".treasury-estates h3", ".treasury-estates-list > li"],
    data: "the market town's stock tab: the treasury by estate, then the stocks" },
  { id: "modal.season-ledger.market", root: ".season-ledger-card", frame: "layer", frameLayer: ".season-ledger-frame", contentSlot: ".season-ledger-body",
    frameSlots: [".season-ledger-scenes"], scene: { kind: "state", set: "market", name: "market-proclaimed", tile: "house", zoom: 1.1, query: "&story-delay=600000&auto-pause=off", run: true },
    // 10× (Digit0; Digit1–4 are the overlays): at 1× the extreme numbers' town did not reach the season's close in 120 s.
    open: [{ key: "Digit0" }, { wait: ".season-ledger-card", timeout: 120_000 }, { pause: 900 }],
    requires: ["h2", ".season-ledger-line", ".season-ledger-resume"], scrollParts: [".season-ledger-content"],
    data: "the market town's first season close after the proclamation (lord mode: the steward's section)" },
];
