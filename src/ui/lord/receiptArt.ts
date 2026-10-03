import type { CSSProperties } from "react";
import { assetUrlForBase } from "../../render/worldAssets";
import { frameToken } from "../frameBox";

// LM-R1: Astra's Wave 35 receipt pictures (scripts/installWave35Receipts.py; docs/provenance/assets.csv). The frame is the
// frame tokens' `receipt` kind (scripts/frameTokens.ts: nine-slice l40 t190 r40 b110, drawn ×0.875); the caps and the
// ribbon are backgrounds here. A picture that fails to load leaves the plain parchment and the written numbers (a cap
// or a ribbon is never the only cue: every value and every decision is text beside it).
// The four are listed for the provenance ledger's runtime enumeration (scripts/provenanceLedgerAssets.ts reads the
// quoted "url" literals); the frame's own draw comes from the frame tokens.
export type ReceiptArtId = "receipt_frame" | "reason_bar_cap_plus" | "reason_bar_cap_minus" | "related_decision_ribbon";

export const RECEIPT_ART: Readonly<Record<ReceiptArtId, { readonly url: string; readonly width: number; readonly height: number }>> = {
  receipt_frame: { "url": "assets/wave35-receipts/E_receipts/receipt_frame.png", width: 384, height: 512 },
  reason_bar_cap_plus: { "url": "assets/wave35-receipts/E_receipts/reason_bar_cap_plus.png", width: 48, height: 48 },
  reason_bar_cap_minus: { "url": "assets/wave35-receipts/E_receipts/reason_bar_cap_minus.png", width: 48, height: 48 },
  related_decision_ribbon: { "url": "assets/wave35-receipts/E_receipts/related_decision_ribbon.png", width: 256, height: 64 },
};

const url = (path: string): string => assetUrlForBase(path, import.meta.env?.BASE_URL ?? "/");

export function receiptArtStyle(id: ReceiptArtId): CSSProperties {
  return { backgroundImage: `url("${url(RECEIPT_ART[id].url)}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
}

/**
 * The frame's slots in art px (384 × 512, measured on the PNG): the picture recess (transparent in the art) at the
 * top and the lower field under the separator, placed in the frame's own coordinates at its draw scale.
 */
const SLOTS = {
  window: { x: 44, y: 54, width: 297, height: 111 },
  foot: { x: 46, y: 424, width: 292, height: 50 },
} as const;

export function receiptSlotStyle(slot: keyof typeof SLOTS): CSSProperties {
  const { scale, size } = frameToken("receipt");
  const rect = SLOTS[slot];
  return { position: "absolute", left: rect.x * scale, top: rect.y * scale, width: rect.width * scale, height: rect.height * scale,
    ...(slot === "foot" ? { top: "auto", bottom: (size.height - rect.y - rect.height) * scale } : {}) };
}

/**
 * The four pictures asked for once, when the first why-here button shows (lord mode only), so a receipt does not
 * open frameless while its frame loads. Not a cache: the browser keeps the files; this only starts the requests once.
 */
let requested = false;
export function preloadReceiptArt(): void {
  if (requested || typeof Image === "undefined") return;
  requested = true;
  for (const art of Object.values(RECEIPT_ART)) new Image().src = url(art.url);
}
