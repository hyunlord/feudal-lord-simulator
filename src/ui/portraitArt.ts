import type { CSSProperties } from "react";
import type { Person } from "../engine/persons.types";
import { assetUrlForBase } from "../render/worldAssets";
import { PORTRAIT_IMAGES } from "./portraitArtManifest.generated";
import { silhouetteUrl } from "./portraitSilhouette";
import { UI_ART_MANIFEST } from "./uiArtManifest.generated";
import type { StewardTone } from "./uiArt";

// CHRON-1 portrait pool runtime (scripts/installChronicleArt.py): each PERSON-0 pool picture (`PortraitChoice.portraitId`)
// ships as a 256 px and a 96 px JPEG made at build time from the received PNG. A slot up to 96 CSS px draws the 96 at
// 1x and the 256 at 2x; a larger slot draws the 256.
// UI-5 ⑥: the steward is the pool's fixed person — the Astra P0 steward in its three expressions (the advisor's lines
// wear them; 96 px and 192 px copies), whoever holds the office — drawn in place of the pool's pick for the steward.
export type PortraitImageId = keyof typeof PORTRAIT_IMAGES;
export const STEWARD_PORTRAIT: Readonly<Record<StewardTone, string>> = { neutral: "steward_neutral", concern: "steward_concern", success: "steward_success" };
const STEWARD_TONES: readonly StewardTone[] = ["neutral", "concern", "success"];

const hasPortrait = (id: string): id is PortraitImageId => Object.hasOwn(PORTRAIT_IMAGES, id);
const url = (path: string) => path.startsWith("data:") ? path : assetUrlForBase(path, import.meta.env?.BASE_URL ?? "/");
/** The picture's 96 px and full-size files (the pool's JPEGs, or the P0 steward's PNGs). */
function imageOf(portraitId: string): Readonly<{ url: string; url96: string }> | null {
  if (hasPortrait(portraitId)) return PORTRAIT_IMAGES[portraitId];
  // FIX-4 (HR-12): the engine's silhouette key (UI-7: only where the pool has no face for the age), one SVG for every size.
  const figure = silhouetteUrl(portraitId);
  if (figure !== null) return { url: figure, url96: figure };
  const tone = STEWARD_TONES.find(entry => STEWARD_PORTRAIT[entry] === portraitId);
  if (tone === undefined) return null;
  const steward = UI_ART_MANIFEST.portraits[`advisor_steward_portrait_${tone}`];
  return { url: steward.x2.url, url96: steward.x1.url };
}

/** The picture a person is drawn with: the pool's pick for their age (PERSON-0 PS-5), or the steward's fixed one. */
export function drawnPortraitId(person: Pick<Person, "role">, poolPortraitId: string, tone: StewardTone = "neutral"): string {
  return person.role === "steward" ? STEWARD_PORTRAIT[tone] : poolPortraitId;
}

export function portraitUrl(portraitId: string, size: 96 | 256): string | null {
  const image = imageOf(portraitId);
  return image === null ? null : url(size === 96 ? image.url96 : image.url);
}

/** The portrait as a `size` px square background (null for an id outside the pool). */
export function portraitStyle(portraitId: string, size: number): CSSProperties | null {
  const image = imageOf(portraitId);
  if (image === null) return null;
  const backgroundImage = size <= 96 ? `image-set(url("${url(image.url96)}") 1x, url("${url(image.url)}") 2x)` : `url("${url(image.url)}")`;
  return { width: size, height: size, backgroundImage, backgroundSize: "cover", backgroundPosition: "center" };
}
