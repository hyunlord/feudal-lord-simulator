import type { SceneRef, SurfaceRow } from "../surfaces.registry";

// LM-R3 (lord slice LS-2): the lord-mode auto-pause's notice, spread into SURFACES (src/ui/surfaces.registry.ts). Its
// states are in the `slice` set (scripts/autoPauseStates.ts, DGX ~/fls-slice-end-states): the lord bot's seed 3 a few
// ticks before a stop; the scene runs time from there and the game stops by itself (the story quiet: no chip or card
// opens over the notice).

const due = (name: string): SceneRef => ({ kind: "state", set: "slice", name, tile: "house", zoom: 1.1, query: "&story-delay=600000", run: true });
const OPEN = [{ wait: ".auto-pause-notice", timeout: 90_000 }, { pause: 600 }] as const;

export const AUTO_PAUSE_SURFACES: readonly SurfaceRow[] = [
  { id: "hud.auto-pause", root: ".auto-pause-notice", frame: "css", scene: due("pause-due"), open: OPEN, scroll: "y",
    requires: [".auto-pause-title", ".auto-pause-word", ".auto-pause-sentence", ".auto-pause-resume"],
    data: "time run in the lord slice until the engine names a reason (the first, a great person's death): why it stopped, the ledger's line and the way on" },
  { id: "hud.auto-pause.link", root: ".auto-pause-notice", frame: "css", scene: due("pause-due-suit"), open: OPEN, scroll: "y",
    requires: [".auto-pause-title", ".auto-pause-word", ".auto-pause-sentence", ".auto-pause-link", ".auto-pause-resume"],
    siblingsNoOverlap: [".auto-pause-link", ".auto-pause-resume"],
    data: "time run until a suit is judged: the judgment's line with the way to its suit on the ledger screen beside the way on" },
];
