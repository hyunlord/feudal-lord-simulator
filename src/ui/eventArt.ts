import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { EVENT_ART_IMAGES } from "./eventArtManifest.generated";
import { shippedEventArtIds } from "./eventArtSelection";

// EVENT-ART: the registry event card's picture (scripts/eventArtIntake.ts, assets-inbox/event-art/final200-20261004):
// 960 × 540, no text in it, re-encoded smaller at build and shown whole (16:9, contain). Found by the entry's id (the
// content canon v4 event id = the picture's file name; no v4 entry carries an artId of its own); an entry with no picture
// shows its card without one — no other picture stands in (as LM-R1's home petitions without art).
export type EventArtId = keyof typeof EVENT_ART_IMAGES;

/** The pictures this build carries (the registry's offerable entries only; src/ui/eventArtSelection.ts). */
const SHIPPED: ReadonlySet<string> = new Set(shippedEventArtIds(EVENT_ART_IMAGES));

/** The picture of the entry with this id, or null (no picture for it, or one this build does not carry). */
export function eventArtFor(id: string): EventArtId | null {
  return Object.hasOwn(EVENT_ART_IMAGES, id) && SHIPPED.has(id) ? id as EventArtId : null;
}

export const isEventArtId = (id: string): id is EventArtId => Object.hasOwn(EVENT_ART_IMAGES, id);

export const eventArtUrl = (id: EventArtId): string => assetUrlForBase(EVENT_ART_IMAGES[id].path, import.meta.env?.BASE_URL ?? "/");

export function eventArtStyle(id: EventArtId, width: number): CSSProperties {
  const image = EVENT_ART_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${eventArtUrl(id)}")`,
    backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" };
}
