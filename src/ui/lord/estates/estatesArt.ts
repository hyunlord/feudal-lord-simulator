import type { EstatePicture } from "./estatesModel";
import type { OfficeId, TraitIcon } from "./oversightModel";

// LM-R2 (estates area): the ids of the screen's pictures in the `lord-estates` bundle (src/render/art/catalog.json, made by
// scripts/installLmr2Estates.ts). Each is drawn only when its entry has loaded (useUiParts); a picture that is not in
// the bundle (the held ones) draws nothing and the card keeps its plain frame.

const ID = (stem: string) => `lord.estates.${stem}`;

/** A card's picture (wave35-estates, 480×270, shown at 240 CSS px). */
export const estatePictureId = (picture: EstatePicture): string => ID(`estate_${picture}`);
/** The overlay over a card's picture when the lord took the estate into possession (same origin, same size). */
export const ESTATE_OVERLAY_ID = ID("estate_integrated_overlay");
export const ESTATE_PICTURE_WIDTH = 240;
/** The office of the one keeping an estate's accounts (wave35-operations, 64 px with its 32 px copy; shown at 32). */
export const officeIconId = (office: OfficeId): string => ID(`office_${office}`);
export const OFFICE_WIDTH = 32;
/** A steward's disposition (lord-components-ui trait, 48 px with its 24 px copy; shown at 24). */
export const traitIconId = (trait: TraitIcon): string => ID(`trait_${trait}`);
export const TRAIT_WIDTH = 24;
/** The alerts (lord-components-ui, 32 px; shown at 24). */
export type AlertIcon = "deadline" | "rights" | "urgent";
export const alertIconId = (alert: AlertIcon): string => ID(`alert_${alert}`);
export const ALERT_WIDTH = 24;
/** The Michaelmas audit's picture over a pending audit (wave35-operations, 960×540; shown at 240). */
export const AUDIT_PICTURE_ID = ID("annual_audit");
export const AUDIT_PICTURE_WIDTH = 240;

const PICTURES: readonly EstatePicture[] = ["ordinary", "poor", "wealthy", "declining", "hunting", "riverside_mill"];
/** Every id the portfolio screen may draw (the hook loads them once). */
export const PORTFOLIO_ART_IDS: readonly string[] = [...PICTURES.map(estatePictureId), ESTATE_OVERLAY_ID, officeIconId("receiver"), officeIconId("steward"),
  traitIconId("merchant_friendly"), traitIconId("peasant_friendly"), alertIconId("deadline"), alertIconId("rights"), alertIconId("urgent"), AUDIT_PICTURE_ID];
