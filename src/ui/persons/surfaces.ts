import type { OpenStep, SurfaceRow } from "../surfaces.registry";

// LS1-6 (lord-screen-v1.md §3): the family chip's card (familyBeats.ts) — a birth, a death and a marriage in the lord's
// family from their records (the way to the chronicle) — on states the sets already hold with one in their season (the
// wave40 moments, a home petition; render-LS16-famprobe).
// A card that opened by itself first (a home petition, a moment) put off, as the registry's PUT_OFF_FIRST does.
const DISMISS: OpenStep = { dismiss: [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"] };
const FAMILY_CHIP = ".event-chip[data-story='family_news']";
const open = (put: boolean): readonly OpenStep[] => [{ wait: FAMILY_CHIP, timeout: 90_000 }, ...(put ? [{ pause: 600 }, DISMISS, { pause: 400 }, DISMISS, { pause: 400 }] : []),
  { click: FAMILY_CHIP }, { pause: 600 }];

export const FAMILY_SURFACES: readonly SurfaceRow[] = [
  { id: "hud.event-card.family-born", root: ".event-card[data-story='family_news']", frame: "css",
    scene: { kind: "state", set: "moments", name: "old_lord_sickbed", tile: "house", zoom: 1.1, query: "&story-delay=0" }, open: open(false), scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-facts li", ".event-card-chronicle"], data: "a child of the lord's house born: its name, the ledger's sentence, its parents, the way to the chronicle" },
  { id: "hud.event-card.family-died", root: ".event-card[data-story='family_news']", frame: "css",
    scene: { kind: "state", set: "petitions", name: "home-pannage", tile: "house", zoom: 1.1, query: "&story-delay=0" }, open: open(true), scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-chronicle"], data: "a death in the lord's family: the ledger's sentence, the spouse left, the way to the chronicle" },
  { id: "hud.event-card.family-married", root: ".event-card[data-story='family_news']", frame: "css",
    scene: { kind: "state", set: "moments", name: "first_child", tile: "house", zoom: 1.1, query: "&story-delay=0" }, open: open(true), scroll: "y",
    requires: ["h2", ".event-card-line", ".event-card-chronicle"], data: "a marriage in the lord's family: the two by name, the ledger's sentence, the way to the chronicle" },
];
