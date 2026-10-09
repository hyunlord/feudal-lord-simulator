import type { SceneRef, SurfaceRow } from "../surfaces.registry";

// ER-13 wording variants: the ui-geometry rows of the home petition's card and the registry offer's card wearing the canon's
// variant words (engine B's registryVariants — 041 / 048 / 056 on the home petitions, 067 / 078 on the 031 / 019 offers;
// the bodies run longer than the kinds' own), and their chips' cards, on the `variants` states (scripts/variantStates.ts:
// the lord's slice as the lord bot plays it, the lord keeping the three home kinds; states.json says which are prepared).

const scene = (name: string): SceneRef => ({ kind: "state", set: "variants", name, tile: "house", zoom: 1.1, query: "&story-delay=3000" });
const CARD = {
  frame: "layer", frameLayer: ".petition-frame", contentSlot: ".petition-body", scrollParts: [".decision-card-body"],
  siblingsNoOverlap: [".decision-card-choice", ".story-modal-later"],
} as const;
const HOME = { ...CARD, root: ".story-modal.petition-card.decision-card.lord-card[data-home-petition]", frameSlots: [".petition-roundel"],
  requires: ["h2", ".decision-card-court", ".decision-card-situation", ".decision-card-stake", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"],
  open: [{ story: ".lord-card[data-home-petition]" }, { pause: 600 }] } as const;
const REGISTRY = { ...CARD, root: ".story-modal.petition-card.decision-card.lord-card[data-registry-offer]", frameSlots: [],
  requires: ["h2", ".decision-card-court", ".decision-card-situation", ".decision-card-stake", ".decision-card-deadline", ".registry-card-why li", ".decision-card-choice", ".decision-card-choose", ".story-modal-later"],
  open: [{ story: ".lord-card[data-registry-offer]" }, { pause: 600 }] } as const;
/** The card opens by itself; put off ([나중에]), its chip stays, and the chip's card says the same words. The chip is pressed
 * only while its card is shut: the `story` step may have opened the card from its chip already (a press would shut it). */
const chipCard = (card: string, chip: string, opened: string) => [{ story: card }, { click: ".story-modal-later" }, { wait: chip, timeout: 30_000 },
  { repeat: chip, until: opened, max: 2 }, { pause: 600 }] as const;

export const DECISION_CARD_SURFACES: readonly SurfaceRow[] = [
  { id: "modal.lord.home-petition.variant-041", ...HOME, scene: scene("home-041"), data: "the pannage petition on the woodland in autumn in 041's words (the longest variant body)" },
  { id: "modal.lord.home-petition.variant-048", ...HOME, scene: scene("home-048"), data: "the common-pasture petition in 048's words (the commons against the second merchant house)" },
  { id: "modal.lord.home-petition.variant-056", ...HOME, scene: scene("home-056"), data: "the road and bridge petition beside the market in 056's words" },
  { id: "modal.lord.registry.variant-067", ...REGISTRY, scene: scene("registry-067"), data: "031's steward offer in 067's words (ability against loyalty; the longest variant title)" },
  { id: "modal.lord.registry.variant-078", ...REGISTRY, scene: scene("registry-078"), data: "019's oversight offer in 078's words (the merchant's man against the peasants')" },
  { id: "hud.event-card.home-petition-variant", root: ".event-card[data-story='home_petition']", frame: "css", scene: scene("home-041"), scroll: "y",
    open: chipCard(".lord-card[data-home-petition]", ".event-chip[data-story='home_petition']", ".event-card[data-story='home_petition']"), requires: ["h2", ".event-card-line", ".event-card-actions .ui-btn"],
    data: "the pannage petition's chip card in 041's words, its card put off" },
  { id: "hud.event-card.registry-variant", root: ".event-card[data-story='registry_event']", frame: "css", scene: scene("registry-067"), scroll: "y",
    open: chipCard(".lord-card[data-registry-offer]", ".event-chip[data-story='registry_event']", ".event-card[data-story='registry_event']"), requires: ["h2", ".event-card-line", ".event-card-actions .ui-btn"],
    data: "031's offer's chip card in 067's words, its card put off" },
];
