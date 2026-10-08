import type { SceneRef, SurfaceRow } from "../../surfaces.registry";

// LM-R2: the lord's decision cards' ui-geometry rows, on the lord2 states (scripts/lmr2States.ts). Each card is reached
// as a player does: its chip, then [결정하기] (the audit's `story` step plays the chips in turn).

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
  { id: "hud.event-card.will-kept", root: ".event-card[data-story='lord_decision']", frame: "css", scene: decisionScene("will-change"),
    open: [{ wait: ".event-chip[data-story='lord_decision']", timeout: 90_000 }, { click: ".event-chip[data-story='lord_decision']" }, { pause: 600 }], scroll: "y",
    requires: ["h2", ".event-card-facts li", ".event-card-decide"], data: "the father's new will as its chip's card: the deadline, [결정하기] to its card" },
  { id: "modal.lord.will-change", ...CARD, root: card("will_change"), scene: decisionScene("will-change"),
    open: [{ story: card("will_change") }, { pause: 600 }],
    requires: [...HEAVY, ...ANSWERS],
    data: "the father's new will: favour (shut when the treasury is short), support promised (its promise, stake and witnesses), let it stand (the rival's claim) — the engine's run" },
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
