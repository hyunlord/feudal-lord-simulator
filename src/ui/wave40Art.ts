import type { CSSProperties } from "react";
import type { HistoryRecord } from "../engine/history.types";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE40_IMAGES } from "./wave40ArtManifest.generated";

// EVENT-ART Wave 40 lord-mode moment illustrations (scripts/installWave40.py, spec docs/ops/install-plan-20261003/SPECS/wave40.md):
// 960 × 540 pictures, no text in them, shipped as the received JPEGs. Each shows one state transition the engine already
// writes to the ledger (the marriage's stages, the suit's, the wardship's), so the picture is found by the history record:
// its template (and, for the suit's stage and the enforcement, one parameter). Lord mode only — the callers check it.
export type Wave40ImageId = keyof typeof WAVE40_IMAGES;

export const wave40Url = (id: Wave40ImageId): string => assetUrlForBase(WAVE40_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

/** The picture at `width` (16:9); `cover` so a square chronicle slot shows its middle (the chip and card boxes are 16:9). */
export function wave40ImageStyle(id: Wave40ImageId, width: number): CSSProperties {
  const image = WAVE40_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave40Url(id)}")`,
    backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundPosition: "center" };
}

/** The ledger templates with a picture of their own (history.ts diplomacyDrafts, estateDrafts, the wardship lines). */
const TEMPLATE_ART: Readonly<Record<string, Wave40ImageId>> = {
  "negotiation.offered": "moment_marriage_negotiation",
  "marriage.contracted": "moment_marriage_sealing",
  "marriage.bride_arrived": "moment_bride_arrival",
  "marriage.child_born": "moment_first_child",
  "marriage.brother_in_law_born": "moment_brother_in_law_born",
  "marriage.father_ill": "moment_old_lord_sickbed",
  "marriage.will_change": "moment_attempted_will_change",
  "marriage.inherited": "moment_inheritance_fealty",
  "estate.suit_filed": "moment_lawsuit_filed",
  "lord.wardship_begun": "moment_child_lord_guardian",
  "lord.wardship_ended": "moment_end_of_wardship",
};

/**
 * A ledger record's Wave 40 picture, or null when it is not one of the fourteen moments. The suit's stages other than the
 * evidence (patronage, hearing), its judgment, the counter and the refusal, the father's death, the estate lost to the
 * brother-in-law and the contested estate have no picture of their own — no other picture stands in for them.
 */
export function wave40RecordArt(record: Pick<HistoryRecord, "template" | "params">): Wave40ImageId | null {
  if (record.template === "estate.suit_stage") return record.params?.stage === "evidence" ? "moment_documentary_evidence" : null;
  if (record.template === "estate.possession_enforced") return record.params?.succeeded === 1 ? "moment_possession_taken" : "moment_possession_refused";
  return TEMPLATE_ART[record.template] ?? null;
}

/**
 * Astra lordplay2 ② (the engine's enforcement records name the plaintiff): whose enforcement a possession moment is — the
 * lord's own, or a house's against him (its picture the same; its title and advice say what the lord lost or kept).
 * Older records carry no plaintiff: they are the lord's.
 */
export function wave40RecordSide(record: Pick<HistoryRecord, "template" | "params">): "lord" | "against" {
  const { plaintiff, defendant } = record.params ?? {};
  return record.template === "estate.possession_enforced" && typeof plaintiff === "string" && plaintiff !== "" && plaintiff !== "lord" && defendant === "lord" ? "against" : "lord";
}
