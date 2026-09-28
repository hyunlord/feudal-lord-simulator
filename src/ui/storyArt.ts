import type { CSSProperties } from "react";
import { wave16ImageStyle, type Wave16ImageId } from "./wave16Art";
import { wave17ImageStyle, type Wave17ImageId } from "./wave17Art";
import { wave21ImageStyle, type Wave21ImageId } from "./wave21Art";
import { WAVE17_IMAGES } from "./wave17ArtManifest.generated";
import { WAVE21_IMAGES } from "./wave21ArtManifest.generated";

/** UI-6: a story beat's picture — Wave 16 (chapter 1's events) or Wave 17 (the war's); the two sets share no id.
 *  UI-8: extended to also accept Wave 21 (chapter 3's plague events and decisions). */
export type StoryIllustration = Wave16ImageId | Wave17ImageId | Wave21ImageId;

export function storyArtStyle(id: StoryIllustration, width: number): CSSProperties {
  if (id in WAVE21_IMAGES) return wave21ImageStyle(id as Wave21ImageId, width);
  return id in WAVE17_IMAGES ? wave17ImageStyle(id as Wave17ImageId, width) : wave16ImageStyle(id as Wave16ImageId, width);
}
