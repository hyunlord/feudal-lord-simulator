import type { CSSProperties } from "react";
import { wave16ImageStyle, type Wave16ImageId } from "./wave16Art";
import { wave17ImageStyle, type Wave17ImageId } from "./wave17Art";
import { wave21ImageStyle, type Wave21ImageId } from "./wave21Art";
import { WAVE17_IMAGES } from "./wave17ArtManifest.generated";
import { WAVE21_IMAGES } from "./wave21ArtManifest.generated";
import { wave31ImageStyle, type Wave31ImageId } from "./wave31Art";
import { WAVE31_IMAGES } from "./wave31ArtManifest.generated";
import { wave33ImageStyle, type Wave33ImageId } from "./wave33Art";
import { WAVE33_IMAGES } from "./wave33ArtManifest.generated";
import { wave44ImageStyle, type Wave44ImageId } from "./wave44Art";
import { WAVE44_IMAGES } from "./wave44ArtManifest.generated";
import { wave40ImageStyle, type Wave40ImageId } from "./wave40Art";
import { WAVE40_IMAGES } from "./wave40ArtManifest.generated";

/** UI-6: a story beat's picture — Wave 16 (chapter 1's events) or Wave 17 (the war's); the two sets share no id.
 *  UI-8: extended to also accept Wave 21 (chapter 3's plague events and decisions); PLAGUE-b: Wave 31 (chapter openings);
 *  UI-10: Wave 33 (chapter 5's 1384–1400 interlude events). LM-R1: Wave 44 (the home estate's petitions, lord mode).
 *  EVENT-ART: Wave 40 (the lord's ledger moments: marriage, suit, wardship; lord mode). */
export type StoryIllustration = Wave16ImageId | Wave17ImageId | Wave21ImageId | Wave31ImageId | Wave33ImageId | Wave44ImageId | Wave40ImageId;

export function storyArtStyle(id: StoryIllustration, width: number): CSSProperties {
  if (id in WAVE44_IMAGES) return wave44ImageStyle(id as Wave44ImageId, width);
  if (id in WAVE40_IMAGES) return wave40ImageStyle(id as Wave40ImageId, width);
  if (id in WAVE33_IMAGES) return wave33ImageStyle(id as Wave33ImageId, width);
  if (id in WAVE31_IMAGES) return wave31ImageStyle(id as Wave31ImageId, width);
  if (id in WAVE21_IMAGES) return wave21ImageStyle(id as Wave21ImageId, width);
  return id in WAVE17_IMAGES ? wave17ImageStyle(id as Wave17ImageId, width) : wave16ImageStyle(id as Wave16ImageId, width);
}
