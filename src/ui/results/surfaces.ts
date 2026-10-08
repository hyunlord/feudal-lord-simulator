import type { SceneRef, SurfaceRow } from "../surfaces.registry";

// DEC-CARD-2 (the result thread): the ui-geometry rows of the news chip's card, the chronicle's thread, the lord's year card
// on the engine's yearReview and the house card on the engine's succession — on the `deccard2` states
// (scripts/deccard2ResultsStates.ts: the lord's slice as the lord bot plays it).

const scene = (name: string, delay: number): SceneRef => ({ kind: "state", set: "deccard2", name, tile: "house", zoom: 1.1, query: `&story-delay=${delay}` });
/** The year's and the house's cards open by themselves after the load; the delay outlasts it (as the house rows' HOUSE_DELAY). */
const OPENS_ITSELF = 20_000;
const CHIP = ".event-chip[data-story='decision_trace']";
const TO_CHRONICLE = [{ wait: CHIP, timeout: 90_000 }, { click: CHIP }, { pause: 600 }, { click: ".event-card-chronicle" }, { wait: ".chronicle-thread", timeout: 30_000 }, { pause: 900 }] as const;
const RESULTS_CARD = {
  frame: "layer", frameLayer: ".petition-frame", contentSlot: ".petition-body", scrollParts: [".petition-body"],
  siblingsNoOverlap: [".results-card-part", ".results-card-actions"],
} as const;

export const RESULTS_SURFACES: readonly SurfaceRow[] = [
  { id: "hud.event-card.trace", root: ".event-card[data-story='decision_trace']", frame: "css", scene: scene("trace-season", 0),
    open: [{ wait: CHIP, timeout: 90_000 }, { click: CHIP }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-facts li", ".event-card-chronicle"],
    data: "the season's news of the lord's decision (the market dues set): the sawmill's project (one cause among others), the merchant houses' minds, the way to the chronicle" },
  { id: "modal.history.thread-decision", root: ".chronicle-thread[data-thread='decision']", frame: "flat", scene: scene("trace-later", 0),
    open: [...TO_CHRONICLE], requires: [".chronicle-thread-part h4", ".chronicle-thread-link", ".chronicle-thread-minds li"],
    data: "the suit filed in 1300, opened from its later chip: what followed (its turns) and who remembers it" },
  { id: "modal.history.thread-because", extends: "modal.history.thread-decision", root: ".chronicle-thread[data-thread='because']", frame: "flat", scene: scene("trace-later", 0),
    open: [{ click: ".chronicle-thread[data-thread='decision'] .chronicle-thread-link" }, { wait: ".chronicle-thread[data-thread='because']", timeout: 10_000 }, { pause: 600 }],
    requires: [".chronicle-thread-part h4", ".chronicle-thread-link"], data: "a suit's turn: the decision it followed from (the year and who decided), its link back" },
  { id: "modal.year-review.lord", ...RESULTS_CARD, root: ".story-modal.petition-card.results-card.year-review[data-year-source='engine']", scene: scene("year-loaded", OPENS_ITSELF),
    open: [{ wait: ".results-card.year-review", timeout: 90_000 }, { pause: 600 }],
    requires: ["h2", ".results-card-part h3", ".results-card-part li", ".year-review-group-head", ".results-card-chronicle", ".results-card-continue"],
    data: "1300's card on the engine's yearReview after a load (unseen): the lord's decisions, the steward's, what followed by decision, the town" },
  // Replaces the phase-1 row on the petitions set's pannage state (its death came before DEC-TRACE: no succession record).
  { id: "modal.house-change.lord-died", ...RESULTS_CARD, root: ".story-modal.petition-card.results-card.house-change[data-house-change='lord_died']", scene: scene("succession", OPENS_ITSELF),
    open: [{ wait: ".results-card.house-change", timeout: 90_000 }, { pause: 600 }],
    requires: ["h2", ".results-card-court", ".house-change-heir", ".results-card-part li", ".results-card-continue"],
    data: "the engine's succession: the lord's death and his heir in the ledger's sentence, who leads the house now" },
];
