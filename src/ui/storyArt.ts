import type { CSSProperties } from "react";
import { wave16ImageStyle, type Wave16ImageId } from "./wave16Art";
import { wave17ImageStyle, type Wave17ImageId } from "./wave17Art";
import { WAVE17_IMAGES } from "./wave17ArtManifest.generated";

/** UI-6: a story beat's picture — Wave 16 (chapter 1's events) or Wave 17 (the war's); the two sets share no id. */
export type StoryIllustration = Wave16ImageId | Wave17ImageId;

export function storyArtStyle(id: StoryIllustration, width: number): CSSProperties {
  return id in WAVE17_IMAGES ? wave17ImageStyle(id as Wave17ImageId, width) : wave16ImageStyle(id as Wave16ImageId, width);
}
