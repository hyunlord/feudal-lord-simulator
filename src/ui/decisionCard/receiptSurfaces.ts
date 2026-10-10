import type { SceneRef, StateSet, SurfaceRow } from "../surfaces.registry";

// RECEIPTS: the ui-geometry rows of the answer's receipt (src/ui/decisionCard/AnswerReceipt.tsx) — each heavy card
// reached as a player does on the real states that hold it, one answer pressed, and its receipt measured: a home
// petition granted and refused, an audit's finding punished and tolerated, an off-map estate's petition granted and
// refused, registry offers (a claim's evidence paid for and put off, a marriage offer sent) and the town's request.
// GEO-D1: the story's delay outlasts the scene's own setup (8 s) and the first wait is 20 s.

const scene = (set: StateSet, name: string): SceneRef => ({ kind: "state", set, name, tile: "house", zoom: 1.1, query: "&story-delay=8000" });
const receipt = (family: string) => `.story-modal.petition-card.decision-card.answer-receipt[data-answer-receipt='${family}']`;
/** The card as it opens by itself (or from its chip), then the answer pressed and its receipt waited for. */
const answer = (card: string, choice: string, family: string) => [{ wait: card, timeout: 20_000, optional: true }, { story: card }, { pause: 600 },
  { click: `${card} [data-choose='${choice}']` }, { wait: receipt(family), timeout: 20_000 }, { pause: 600 }] as const;

const RECEIPT = {
  frame: "layer", frameLayer: ".petition-frame", contentSlot: ".petition-body", scrollParts: [".decision-card-body"],
  siblingsNoOverlap: [".answer-receipt-row", ".answer-receipt-close"],
  requires: ["h2", ".answer-receipt-kicker", ".answer-receipt-answer", ".answer-receipt-row", ".answer-receipt-close"],
} as const;
const row = (id: string, family: string, set: StateSet, name: string, card: string, choice: string, data: string): SurfaceRow =>
  ({ id, ...RECEIPT, root: receipt(family), scene: scene(set, name), open: answer(card, choice, family), data });

const HOME = ".lord-card[data-home-petition]";
const AUDIT = ".lord-card[data-lord-decision='audit']";
const OFFMAP = ".lord-card[data-lord-decision='estate_petition_offmap']";
const REGISTRY = ".lord-card[data-registry-offer]";
const REQUEST = ".lord-card[data-lord-request]";

export const RECEIPT_SURFACES: readonly SurfaceRow[] = [
  row("modal.receipt.home-grant", "home_petition", "petitions", "home-boundary_dispute", HOME, "grant",
    "the boundary dispute granted: both factions' relations, each move and from what to what"),
  row("modal.receipt.home-refuse", "home_petition", "petitions", "home-chancel_repair", HOME, "refuse",
    "the chancel's repair refused: the bishop's relation, its move and from what to what"),
  row("modal.receipt.audit-punish", "audit", "lord2", "audit-pending", AUDIT, "punish",
    "an audit's finding punished: the sum recovered to the treasury, the bishop's relation, the tenants' goodwill, the new steward"),
  row("modal.receipt.audit-tolerate", "audit", "lord2", "audit-pending", AUDIT, "tolerate",
    "an audit's finding tolerated: the steward's loyalty, its move and from what to what"),
  row("modal.receipt.offmap-grant", "estate_petition_offmap", "lord2", "inherited", OFFMAP, "grant",
    "an off-map estate's petition granted: the treasury and the tenants' goodwill"),
  row("modal.receipt.offmap-refuse", "estate_petition_offmap", "lord2", "inherited", OFFMAP, "refuse",
    "an off-map estate's petition refused: the tenants' goodwill"),
  row("modal.receipt.registry-evidence", "registry_offer", "lord", "registry-offer-hold", REGISTRY, "roll",
    "a registry offer's court roll paid for: the treasury, the evidence and its weight, the suit's costs; then what it set going"),
  row("modal.receipt.registry-hold", "registry_offer", "lord", "registry-offer-hold", REGISTRY, "defer",
    "the same offer put off (its hold): the claim's strength, its move and from what to what"),
  row("modal.receipt.registry-marriage", "registry_offer", "lord", "registry-offer", REGISTRY, "b",
    "a registry offer that sends a marriage offer: the offer and the counterpart's answer at once"),
  row("modal.receipt.request", "lord_request", "petitions", "request", REQUEST, "grant",
    "the town's request granted (the proclamation): the town's era and the works it opens"),
];
