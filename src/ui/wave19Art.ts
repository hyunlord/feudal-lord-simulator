import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import type { SeasonSceneId } from "./seasonLedgerScenes";
import { WAVE19_IMAGES } from "./wave19ArtManifest.generated";

// UI-4b Wave 19 art (scripts/installWave19.py): the 24 season-ledger scene icons (96 x 96 masters, drawn at 24-40 px)
// in use now; the record-card frames, timeline, biography and faction pages and the decision record registered for
// CHRON-1 (9-slice insets and minimum sizes in the manifest).
export type Wave19ImageId = keyof typeof WAVE19_IMAGES;

export const wave19Url = (id: Wave19ImageId): string => assetUrlForBase(WAVE19_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

/** A season scene icon as a `size` px square block. */
export function seasonSceneStyle(scene: SeasonSceneId, size: number): CSSProperties {
  return { width: size, height: size, backgroundImage: `url("${wave19Url(`scene_${scene}`)}")`, backgroundSize: "contain", backgroundRepeat: "no-repeat" };
}
