// BUDGET-1b: the images the game's startup preload requests, by campaign chapter — run with tsx, prints JSON.
// It runs the runtime's own preload functions (src/render/preloadGameArt.ts: preloadGameArt, preloadFrameArt; and the two
// the first terrain frame starts whatever the map holds, drawTerrainBoundaryV2.ts: the boundary and season art) with a
// recording Image in place of the browser's: every `src` they set is one request. Nothing loads, so loaders that chain
// on `onload` would be missed (none of the startup ones does). scripts/checks/distBudget.mjs calls it and reads each
// file's size from its PNG/JPEG header for the "시작 시 불러오는 그림 메모리" line.
//   { chapters: [{ chapter: 1, paths: [...] }, … { chapter: 5, … }], all: [...] }
// Paths are base-relative (`assets/…`, as in dist); each chapter's list is cumulative (chapter N includes 1…N);
// `all` is what the sandbox (no chapter) requests — the whole startup preload, as before BUDGET-1b. Not in it: art a
// first draw loads only when the map has it (shore, zones and yards, wall faces, weather, village life, story props).
import { CAMPAIGN_CHAPTERS } from "../../src/content/chapterConfig";

const requested = new Set<string>();

class RecordingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  set src(url: string) { requested.add(url.replace(/^\/+/, "")); }
}
// Node has no Image; the preload functions only construct it and set `src`.
(globalThis as unknown as { Image: unknown }).Image = RecordingImage;

const { preloadFrameArt, preloadGameArt } = await import("../../src/render/preloadGameArt");
const { preloadBoundaryAssets } = await import("../../src/render/boundaryAssets");
const { preloadSeasonArt } = await import("../../src/render/seasonArt");

const chapters: { chapter: number; paths: string[] }[] = [];
void preloadGameArt();
void preloadBoundaryAssets();
preloadSeasonArt();
for (let chapter = 1; chapter <= CAMPAIGN_CHAPTERS; chapter += 1) {
  preloadFrameArt(chapter);
  chapters.push({ chapter, paths: [...requested].sort() });
}
preloadFrameArt(Number.POSITIVE_INFINITY);
process.stdout.write(`${JSON.stringify({ chapters, all: [...requested].sort() })}\n`);
