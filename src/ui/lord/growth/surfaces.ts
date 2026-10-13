import type { SurfaceRow } from "../../surfaces.registry";

// LS1-3 (lord-screen-v1.md): the growth panel at the head of the population slot (the pill's population cell opens it)
// and the chip when a stop of the town's growth begins, on the market states (scripts/marketTownStates.ts). LS1-6: a stop
// is the town not growing over closes the screen saw, so the stop's rows take `growth-held=3` (the loaded state counted
// as a stop already held three closes, growthTrack.ts); the panel's other form — what holds the next step while the town
// grows — is the row without it.

const POPULATION = ".status-pill > .status-pill-cell:nth-of-type(2)";

export const GROWTH_SURFACES: readonly SurfaceRow[] = [
  { id: "slot.population.growth.market", root: ".ledger-population-drawer.slot-panel", frame: "css", scene: { kind: "state", set: "market", name: "market-years", tile: "house", zoom: 1.1,
    query: "&story-delay=600000&growth-held=3" }, open: [{ click: POPULATION }, { wait: ".growth-panel", timeout: 30_000 }, { pause: 600 }], scroll: "y",
    requires: [".growth-panel h3", ".growth-panel-reason", ".growth-panel-since", ".growth-panel-lever"],
    data: "four years after the proclamation, a stop held: what holds the town's growth — the cause, since when (unknown after a load), the lord's lever" },
  { id: "slot.population.growth-next.market", root: ".ledger-population-drawer.slot-panel", frame: "css", scene: { kind: "state", set: "market", name: "market-years", tile: "house",
    zoom: 1.1, query: "&story-delay=600000" }, open: [{ click: POPULATION }, { wait: ".growth-panel[data-growth-stop='no']", timeout: 30_000 }, { pause: 600 }], scroll: "y",
    requires: [".growth-panel h3", ".growth-panel-reason", ".growth-panel-lever"],
    data: "four years after the proclamation, no stop seen yet: what holds the town's next step, headed so, no since (LS1-6, A4)" },
  // The season's close seen in the session: the stop's chip and its card (its button to the growth panel).
  { id: "hud.event-card.growth.market", root: ".event-card[data-story='growth_block']", frame: "css", scene: { kind: "state", set: "market", name: "market-season-eve",
    tile: "house", zoom: 1.1, query: "&story-delay=3000&auto-pause=off&season-band-ms=600000&growth-held=3", run: true },
    open: [{ wait: ".event-chip[data-story='growth_block']", timeout: 90_000 }, { click: ".event-chip[data-story='growth_block']" }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-facts li", ".event-card-decide"],
    data: "the market town, a stop held: the chip when the stop is first said — its cause, since when, the lever, the way to the panel" },
];
