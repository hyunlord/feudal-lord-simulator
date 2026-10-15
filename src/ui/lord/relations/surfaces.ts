import type { SurfaceRow } from "../../surfaces.registry";

// LS1 ③ (lord-screen-v1.md §3): the stage-crossing chip's card on the market town's season close (scripts/marketTownStates.ts).
// A loaded state's first close only takes the ranks, so the row takes `stage-seed=merchant_house_1:-2` (the state counted
// as a close seen with that house hostile, stageTrack.ts): at the close its stage is crossed.
const STAGE_CHIP = ".event-chip[data-story='relation_stage']";

export const RELATION_STAGE_SURFACES: readonly SurfaceRow[] = [
  { id: "hud.event-card.relation-stage.market", root: ".event-card[data-story='relation_stage']", frame: "css", scene: { kind: "state", set: "market", name: "market-season-eve",
    tile: "house", zoom: 1.1, query: "&story-delay=3000&auto-pause=off&season-band-ms=600000&stage-seed=merchant_house_1:-2", run: true },
    open: [{ wait: STAGE_CHIP, timeout: 90_000 }, { click: STAGE_CHIP }, { pause: 600 }], scroll: "y", requires: ["h2", ".event-card-line"],
    data: "the market town's season close: a merchant house's relation crossing a stage — the stages by name, the one decision behind it or several causes" },
];
