import type { CSSProperties } from "react";
import type { RegistryEntry } from "../content/registry/registryTypes";
import { assetUrlForBase } from "../render/worldAssets";
import { EVENT_ART_IMAGES } from "./eventArtManifest.generated";
import { eventArtKey, shippedEventArtIds } from "./eventArtSelection";

// EVENT-ART: the registry event card's picture (scripts/installEventArt.ts, assets-inbox/event-art/final200-20261004):
// 960 × 540, no text in it, shipped as the received JPEG and shown whole (16:9, contain). Found by the entry's id (the
// content canon v4 event id), or by the `artId` the engine sets; an entry with no picture shows its card without one —
// no other picture stands in (as LM-R1's home petitions without art).
export type EventArtId = keyof typeof EVENT_ART_IMAGES;

/** The pictures this build carries (the registry's entries only; src/ui/eventArtSelection.ts). */
const SHIPPED: ReadonlySet<string> = new Set(shippedEventArtIds(EVENT_ART_IMAGES));

/** The entry's picture, or null (no picture for its key, or one this build does not carry). */
export function eventArtFor(entry: Pick<RegistryEntry, "id" | "artId">): EventArtId | null {
  const key = eventArtKey(entry);
  return Object.hasOwn(EVENT_ART_IMAGES, key) && SHIPPED.has(key) ? key as EventArtId : null;
}

export const isEventArtId = (id: string): id is EventArtId => Object.hasOwn(EVENT_ART_IMAGES, id);

export const eventArtUrl = (id: EventArtId): string => assetUrlForBase(EVENT_ART_IMAGES[id].path, import.meta.env?.BASE_URL ?? "/");

export function eventArtStyle(id: EventArtId, width: number): CSSProperties {
  const image = EVENT_ART_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${eventArtUrl(id)}")`,
    backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" };
}
