import type { SceneRef, SurfaceRow } from "../../surfaces.registry";

// LM-R2: the lord's decision cards' ui-geometry rows, on the lord2 states (scripts/lmr2States.ts). Each card is reached
// as a player does: its chip, then [결정하기] (the audit's `story` step plays the chips in turn).

/** The will's chip id's head (LORD_MATTER_CHIP.marriage). */
const WILL_CHIP = "marriage-decision:will_change:";
/** A lord2 state with the story's world-first delay short enough for the chip to come. */
const decisionScene = (name: string): SceneRef => ({ kind: "state", set: "lord2", name, tile: "house", zoom: 1.1, query: "&story-delay=3000" });

const CARD = {
  frame: "layer", frameLayer: ".petition-frame", contentSlot: ".petition-body", scrollParts: [".decision-card-body"],
  siblingsNoOverlap: [".decision-card-choice", ".lord-decision-open", ".story-modal-later"],
} as const;
/** DEC-CARD: the heavy decision card (src/ui/decisionCard/), its parts on every row. */
const card = (kind: string) => `.story-modal.petition-card.decision-card.lord-card[data-lord-decision='${kind}']`;
const HEAVY = ["h2", ".decision-card-court", ".decision-card-situation", ".decision-card-stake"] as const;
const ANSWERS = [".decision-card-deadline", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"] as const;

export const DECISION_SURFACES: readonly SurfaceRow[] = [
  // PLAY-2 (friction 8): the will's chip card — its deadline; the chip stays until answered (useStoryPresentation storyChips).
  // SUIT-THREAD: the deadline is the engine's (lordMattersDue, as a season); the chip's button opens the 혼인 page.
  { id: "hud.event-card.will-kept", root: `.event-card[data-chip-id^='${WILL_CHIP}']`, frame: "css", scene: decisionScene("will-change"),
    open: [{ wait: `.event-chip[data-chip-id^='${WILL_CHIP}']`, timeout: 90_000 }, { click: `.event-chip[data-chip-id^='${WILL_CHIP}']` }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-facts li", ".event-card-decide"], data: "the father's new will as its chip's card: the engine's deadline as a season, the button to the 혼인 page" },
  // SUIT-THREAD: the will's card, reached as a player does — its chip, the 혼인 page, that page's [결정하기].
  { id: "modal.lord.will-change", ...CARD, root: card("will_change"), scene: decisionScene("will-change"),
    open: [{ wait: `.event-chip[data-chip-id^='${WILL_CHIP}']`, timeout: 90_000 }, { click: `.event-chip[data-chip-id^='${WILL_CHIP}']` }, { pause: 600 },
      { click: `.event-card[data-chip-id^='${WILL_CHIP}'] .event-card-decide` }, { wait: ".lord-decide[data-decide='marriage_decision']", timeout: 20_000 },
      { click: ".lord-decide[data-decide='marriage_decision']" }, { wait: card("will_change"), timeout: 20_000 }, { pause: 600 }],
    requires: [...HEAVY, ...ANSWERS],
    data: "the father's new will: favour (shut when the treasury is short), support promised (its promise, stake and witnesses), let it stand (the rival's claim) — the engine's run" },
  // SUIT-THREAD: a suit against the lord (the engine's lordMattersDue) as its chip's card — the engine's sentence of the
  // filing, the stage, when it moves on, the way to it on 약속·소송; kept until answered.
  { id: "hud.event-card.suit-defence", root: ".event-card[data-chip-id^='suit-defence:']", frame: "css", scene: decisionScene("neighbour-suit"),
    open: [{ wait: ".event-chip[data-chip-id^='suit-defence:']", timeout: 90_000 }, { click: ".event-chip[data-chip-id^='suit-defence:']" }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-facts li", ".event-card-decide"], data: "a neighbour house's suit against the lord: its filing, its stage and next season, [소송 보기]" },
  // A forcible entry forewarned (lordMattersDue) as its chip's card, on suit-ledger's state played on from neighbour-suit
  // (scripts/suitLedgerStates.ts, kept in the lord2 folder as suit-entry-threat.json).
  { id: "hud.event-card.entry-threat", root: ".event-card[data-chip-id^='entry-threat:']", frame: "css", scene: decisionScene("suit-entry-threat"),
    open: [{ wait: ".event-chip[data-chip-id^='entry-threat:']", timeout: 90_000 }, { click: ".event-chip[data-chip-id^='entry-threat:']" }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-facts li", ".event-card-decide"], data: "a house's forcible entry forewarned: the engine's warning, the season it comes, [예고 보기]" },
  { id: "modal.lord.contested", ...CARD, root: card("contested"), scene: decisionScene("contested"),
    open: [{ story: card("contested") }, { pause: 600 }],
    requires: [...HEAVY, ".lord-decision-open", ".story-modal-later"],
    data: "the contested inheritance: the rival's hold, both claims' strength, the lord's suit stage, the way to the suit" },
  { id: "modal.lord.audit", ...CARD, root: card("audit"), scene: decisionScene("audit-pending"),
    open: [{ story: card("audit") }, { pause: 600 }],
    requires: [...HEAVY, ...ANSWERS],
    data: "a Michaelmas audit's finding: punish, replace, tolerate — what each recovers, who follows, who remembers" },
  { id: "modal.lord.offmap-petition", ...CARD, root: card("estate_petition_offmap"), scene: decisionScene("inherited"),
    open: [{ story: card("estate_petition_offmap") }, { pause: 600 }],
    requires: [...HEAVY, ...ANSWERS],
    data: "an off-map estate's petition: why it came to the lord, both answers' treasury and the estate's goodwill" },
];
