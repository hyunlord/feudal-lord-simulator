import type { SceneRef, SurfaceRow } from "../../surfaces.registry";

// LM-R2: the lord's decision cards' ui-geometry rows, on the lord2 states (scripts/lmr2States.ts). Each card is reached
// as a player does: its chip, then [결정하기] (the audit's `story` step plays the chips in turn).

/** A lord2 state with the story's world-first delay short enough for the chip to come. */
const decisionScene = (name: string): SceneRef => ({ kind: "state", set: "lord2", name, tile: "house", zoom: 1.1, query: "&story-delay=3000" });

const CARD = {
  frame: "layer", frameLayer: ".petition-frame", contentSlot: ".petition-body",
  siblingsNoOverlap: [".petition-option", ".lord-decision-open", ".story-modal-later"],
} as const;
const card = (kind: string) => `.story-modal.petition-card.lord-card[data-lord-decision='${kind}']`;

export const DECISION_SURFACES: readonly SurfaceRow[] = [
  { id: "modal.lord.will-change", ...CARD, root: card("will_change"), scene: decisionScene("will-change"),
    open: [{ story: card("will_change") }, { pause: 600 }],
    requires: ["h2", ".lord-card-court", ".petition-body > h2 + p", ".petition-option", ".lord-card-forecast", ".story-modal-later"],
    data: "the father's new will: favour (refused when the treasury is short), support promised, let it stand — the engine's numbers" },
  { id: "modal.lord.contested", ...CARD, root: card("contested"), scene: decisionScene("contested"),
    open: [{ story: card("contested") }, { pause: 600 }],
    requires: ["h2", ".lord-card-court", ".petition-body > h2 + p", ".lord-decision-open", ".story-modal-later"],
    data: "the contested inheritance: the rival's hold, the lord's suit stage, the way to the suit" },
  { id: "modal.lord.audit", ...CARD, root: card("audit"), scene: decisionScene("audit-pending"),
    open: [{ story: card("audit") }, { pause: 600 }],
    requires: ["h2", ".lord-card-court", ".petition-body > h2 + p", ".petition-option", ".lord-card-forecast", ".story-modal-later"],
    data: "a Michaelmas audit's finding: punish, replace, tolerate with what each recovers and who follows" },
  { id: "modal.lord.offmap-petition", ...CARD, root: card("estate_petition_offmap"), scene: decisionScene("inherited"),
    open: [{ story: card("estate_petition_offmap") }, { pause: 600 }],
    requires: ["h2", ".lord-card-court", ".petition-body > h2 + p", ".petition-option", ".lord-card-forecast", ".story-modal-later"],
    data: "an off-map estate's petition: why it came to the lord, both answers' treasury and goodwill" },
];
