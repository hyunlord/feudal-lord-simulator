import type { CSSProperties } from "react";
import type { HomePetitionKind } from "../engine/stewardship.types";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE44_IMAGES } from "./wave44ArtManifest.generated";

// LM-R1 Wave 44 home-petition illustrations (scripts/installWave44.py, spec docs/ops/install-plan-20261003/SPECS/wave44.md):
// 960 × 540 event-card pictures, no text in them (the petition's title and answers are the card's DOM), shipped as the
// received JPEGs. Shown whole (16:9, contain) whatever the season: the picture's own season never changes the game's.
export type Wave44ImageId = keyof typeof WAVE44_IMAGES;

export const wave44Url = (id: Wave44ImageId): string => assetUrlForBase(WAVE44_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

export function wave44ImageStyle(id: Wave44ImageId, width: number): CSSProperties {
  const image = WAVE44_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave44Url(id)}")`,
    backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" };
}

/**
 * Each home petition kind's picture (the type check keeps every kind covered). The spec's mismatches have none: the
 * pannage is not the forest trespass (12), and the chancel's repair has no picture — no other picture stands in for
 * them (not the manor court's, 11, which no engine kind has).
 */
export const HOME_PETITION_ART: Readonly<Record<HomePetitionKind, Wave44ImageId | null>> = {
  boundary_dispute: "boundary_dispute", mill_suit: "mill_suit", heriot: "heriot", merchet: "merchet", ale_fines: "ale_fines",
  road_bridge: "road_bridge", stall_dispute: "stall_dispute", wardship: "wardship", common_pasture: "common_pasture", newcomer: "newcomer",
  pannage: null, chancel_repair: null,
};

/** The steward at his work (once the precedent card's; DEC-CARD-2: it heads the standing-policy screen — never an open petition's picture). */
export const PRECEDENT_ART: Wave44ImageId = "by_precedent";
