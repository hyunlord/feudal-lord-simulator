import type { SurfaceRow } from "../../surfaces.registry";

// LS1-2 (lord-screen-v1.md): the season-turn band's ui-geometry row — at a season's close, at every speed, not modal —
// on the market state 40 ticks before a season's close (scripts/marketTownStates.ts `market-season-eve`), run at 1×.

export const SEASON_BAND_SURFACES: readonly SurfaceRow[] = [
  { id: "hud.season-band.market", root: ".season-band", frame: "css", scene: { kind: "state", set: "market", name: "market-season-eve", tile: "house", zoom: 1.1,
    query: "&story-delay=600000&auto-pause=off&season-band-ms=600000", run: true }, open: [{ wait: ".season-band", timeout: 90_000 }, { pause: 600 }], requires: [".season-band-item"],
    data: "the market town's season close after the proclamation: the band of what changed in it (after a load: the people, the treasury, the steward's)" },
];
