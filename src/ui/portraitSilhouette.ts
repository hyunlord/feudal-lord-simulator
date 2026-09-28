import { SEMANTIC_PALETTE } from "../content/palette";
import { SILHOUETTE_PORTRAIT_ID, type PortraitSilhouette } from "../engine/portraits";

// FIX-4 (HR-12): the figure drawn in place of a portrait — a swaddled baby or a small child, in the parchment and ink of
// the portrait frames. An SVG, so one drawing serves every slot size. UI-7: since PERSON-1a (LN-6) a child under 8 has a
// face (their lineage set's or the common pool's, drawn like any portrait); the engine gives this key only when the pool
// has no picture of their sex and age, or a child of 8–13 whose identity has no child picture.
const FIGURES: Readonly<Record<PortraitSilhouette, string>> = {
  infant: '<circle cx="48" cy="40" r="13"/><path d="M26 86c0-18 10-30 22-30s22 12 22 30z"/><ellipse cx="48" cy="60" rx="19" ry="9"/>',
  child: '<circle cx="48" cy="34" r="14"/><path d="M22 92c0-24 11-38 26-38s26 14 26 38z"/>',
};

function figureSvg(kind: PortraitSilhouette): string {
  const { parchmentDark, inkMuted } = SEMANTIC_PALETTE;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${parchmentDark}"/>`
    + `<g fill="${inkMuted}" fill-opacity="0.55">${FIGURES[kind]}</g></svg>`;
}

const DATA_URLS: Readonly<Record<string, string>> = Object.fromEntries((Object.keys(FIGURES) as PortraitSilhouette[])
  .map(kind => [SILHOUETTE_PORTRAIT_ID[kind], `data:image/svg+xml,${encodeURIComponent(figureSvg(kind))}`]));

/** The figure's image URL for a silhouette portrait id (`silhouette_infant`, `silhouette_child`), else null. */
export function silhouetteUrl(portraitId: string): string | null {
  return DATA_URLS[portraitId] ?? null;
}
