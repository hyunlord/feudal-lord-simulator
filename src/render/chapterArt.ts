import { CHAPTER_FIVE, CHAPTER_FOUR, CHAPTER_THREE, CHAPTER_TWO } from "../content/chapterConfig";
import { scenarioById } from "../content/scenario/registry";
import type { GameState } from "../engine/engine.types";
import { WAVE21_IMAGES } from "../ui/wave21ArtManifest.generated";
import { WAVE31_IMAGES } from "../ui/wave31ArtManifest.generated";
import { WAVE33_IMAGES } from "../ui/wave33ArtManifest.generated";
import { ENDING_IMAGES } from "../ui/endingArtManifest.generated";
import { WAVE9_IMAGES } from "./wave9ArtManifest.generated";
import { WAVE17_WORLD_IMAGES } from "./wave17WorldManifest.generated";
import { WAVE12_GUILDHALL_IMAGES } from "./wave12GuildhallManifest.generated";
import { WAVE17_WALKER_IMAGES } from "./wave17WalkerManifest.generated";

// BUDGET-1b (judgement 2026-09-28): the world art still loads in one go at the start, except the art of the campaign
// chapters the game has not entered yet — that loads when the chapter begins. Presentation only (nothing is saved).
//  - Chapter-bound art is declared in CHAPTER_ART below, one line per manifest (or part of one), by the manifests' own
//    urls. Everything not declared is chapter 1. Buildings unlock by settlement stage, not by chapter
//    (content/scenario), so the stage-gated art (the market town's facilities, the keep, stone walls and gates) is not
//    declared and stays at startup.
//  - The limit: in the campaign, the chapter being played (`politics.chapter.number`, 1 before politics exist); outside
//    it (the sandbox), every chapter.
//  - Entering a chapter: the canvas compares the limit each frame and, when it rises, preloads the new chapter's art
//    (preloadGameArt.ts `preloadChapterArt`). Art drawn before its image arrives takes the loader's usual fallback (a war
//    prop or a facility painting is not drawn that frame; its draw starts the load itself).
//  - Installing later-chapter art: add its CHAPTER_ART line and preload it through a chapter-aware loader — a manifestArt
//    manifest in preloadGameArt.ts CHAPTER_SCOPED_MANIFESTS, or a historicalFacilityManifest entry (that loader filters
//    by chapter already). tests/chapterArt.test.ts fails when a url declared here for chapter 2+ is in the startup set
//    of a chapter-1 start, or when a declared url is not in the whole preload.

type ChapterArt = { readonly chapter: number; readonly what: string; readonly urls: readonly string[] };
const urlsOf = <K extends string>(manifest: Readonly<Record<K, { readonly url: string }>>, keep: (key: K) => boolean = () => true): readonly string[] =>
  (Object.keys(manifest) as K[]).filter(keep).map(key => manifest[key].url);

/** The chapter-bound art, one line each (see above). */
export const CHAPTER_ART: readonly ChapterArt[] = [
  { chapter: CHAPTER_TWO.chapter, what: "the war's world props (Wave 17 world, the Wave 12 quay under the burning quay)", urls: urlsOf(WAVE17_WORLD_IMAGES) },
  { chapter: CHAPTER_TWO.chapter + 1, what: "the plague-shut houses (Wave 9; 1348, no draw path yet)", urls: urlsOf(WAVE9_IMAGES, key => key.startsWith("event_plague_shut_")) },
  { chapter: CHAPTER_THREE.chapter, what: "Wave 21 chapter 3 illustrations (UI-8: decisions, events, chronicle, chapter-3 end)", urls: urlsOf(WAVE21_IMAGES, key => key.startsWith("ch3_")) },
  { chapter: CHAPTER_THREE.chapter, what: "Wave 31 chapter 3 opening (PLAGUE-b: the chronicle's chapter start, the opening screen)", urls: urlsOf(WAVE31_IMAGES, key => WAVE31_IMAGES[key].chapter === CHAPTER_THREE.chapter) },
  // UI-9: chapter 4 reorganisation art (Wave 21 ch4_*: decision cards, event illustrations, chronicle scenes, chapter-4 end).
  { chapter: CHAPTER_FOUR.chapter, what: "Wave 21 chapter 4 illustrations (UI-9: decisions, events, chronicle, chapter-4 end)", urls: urlsOf(WAVE21_IMAGES, key => key.startsWith("ch4_")) },
  { chapter: CHAPTER_FOUR.chapter, what: "Wave 31 chapter 4 opening (UI-9: the chronicle's chapter start, the opening screen)", urls: urlsOf(WAVE31_IMAGES, key => WAVE31_IMAGES[key].chapter === CHAPTER_FOUR.chapter) },
  { chapter: CHAPTER_FOUR.chapter, what: "Wave 12 guildhall world prop (UI-9: chapter 4 guild founded)", urls: urlsOf(WAVE12_GUILDHALL_IMAGES) },
  { chapter: CHAPTER_FIVE.chapter, what: "Wave 31 chapter 5 opening (UI-9b: the chronicle's chapter start, the opening screen)", urls: urlsOf(WAVE31_IMAGES, key => WAVE31_IMAGES[key].chapter === CHAPTER_FIVE.chapter) },
  { chapter: CHAPTER_FOUR.chapter, what: "Wave 17 lord's tax collector (UI-9b: chased from the market in 1381)", urls: urlsOf(WAVE17_WALKER_IMAGES) },
  // UI-10: chapter 5 autonomy and legacy art (Wave 21 ch5_*) and its 1384–1400 interlude events (Wave 33).
  { chapter: CHAPTER_FIVE.chapter, what: "Wave 21 chapter 5 illustrations (UI-10: decisions, events, chronicle, chapter-5 and campaign end)", urls: urlsOf(WAVE21_IMAGES, key => key.startsWith("ch5_")) },
  { chapter: CHAPTER_FIVE.chapter, what: "Wave 33 chapter 5 interlude events (UI-10: 1391 staple … 1399 deposition)", urls: urlsOf(WAVE33_IMAGES) },
  // INSTALL-33: the campaign's six ending paintings (one per ending, the ending screen's backdrop).
  { chapter: CHAPTER_FIVE.chapter, what: "campaign ending paintings (INSTALL-33: one per LegacyEndingId)", urls: urlsOf(ENDING_IMAGES) },
];

const CHAPTER_OF_URL: ReadonlyMap<string, number> = new Map(CHAPTER_ART.flatMap(entry => entry.urls.map(url => [url, entry.chapter] as const)));

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
