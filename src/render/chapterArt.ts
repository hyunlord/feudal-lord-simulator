import { CHAPTER_TWO } from "../content/chapterConfig";
import { scenarioById } from "../content/scenario/registry";
import type { GameState } from "../engine/engine.types";
import { WAVE9_IMAGES } from "./wave9ArtManifest.generated";
import { WAVE17_WORLD_IMAGES } from "./wave17WorldManifest.generated";

// BUDGET-1b (judgement 2026-09-28): the world art still loads in one go at the start, except the art of the campaign
// chapters the game has not entered yet — that loads when the chapter begins. Presentation only (nothing is saved).
//  - Chapter-bound art (by url, the runtime manifests' own entries):
//    - chapter 2: the war's world props (WAVE17_WORLD_IMAGES: beacon, burning quay, raid smoke, and the Wave 12 quay
//      under the burning quay) — the war comes only in chapter 2 (engine/war.ts).
//    - chapter 3: the Wave 9 plague-shut houses (1348, the chapter after the war's; no draw path uses them yet).
//    - everything else: chapter 1. Buildings unlock by settlement stage, not by chapter (content/scenario), so the
//      stage-gated art (market town's facilities, the keep, stone walls and gates) stays at startup.
//  - The limit: in the campaign, the chapter being played (`politics.chapter.number`, 1 before politics exist); outside
//    it (the sandbox), every chapter.
//  - Entering a chapter: the canvas compares the limit each frame and, when it rises, preloads the new chapter's art
//    (preloadGameArt.ts `preloadChapterArt`). A war prop drawn before its image arrives is skipped for that frame, as
//    before (manifestArt's draw returns false until loaded and starts the load itself).

const PLAGUE_CHAPTER = CHAPTER_TWO.chapter + 1;

const CHAPTER_OF_URL: ReadonlyMap<string, number> = new Map([
  ...Object.values(WAVE17_WORLD_IMAGES).map(image => [image.url, CHAPTER_TWO.chapter] as const),
  ...Object.entries(WAVE9_IMAGES).filter(([key]) => key.startsWith("event_plague_shut_")).map(([, image]) => [image.url, PLAGUE_CHAPTER] as const),
]);

/** The campaign chapter an image (a manifest url, base-relative: `assets/…`) belongs to; 1 for art every chapter draws. */
export function chapterOfArt(url: string): number {
  return CHAPTER_OF_URL.get(url.replace(/^\/+/, "")) ?? 1;
}

/** The urls of `urls` whose chapter is `chapter` or earlier (a chapter's art includes the chapters before it). */
export function artForChapter(urls: readonly string[], chapter: number): readonly string[] {
  return urls.filter(url => chapterOfArt(url) <= chapter);
}

/** The last chapter whose art the state may draw: the campaign's chapter being played, else every chapter (Infinity). */
export function artChapterLimit(state: Pick<GameState, "scenarioId" | "politics">): number {
  if (scenarioById(state.scenarioId).mode !== "campaign") return Number.POSITIVE_INFINITY;
  return Math.max(1, state.politics?.chapter.number ?? 1);
}
