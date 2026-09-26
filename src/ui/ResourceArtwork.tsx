import { useState } from "react";
import type { ResourceType } from "../content/resourceConfig";
import { assetUrlForBase } from "../render/worldAssets";
import { UiIcon } from "./UiIcon";

export type ResourceArtworkKind = ResourceType | "population";

const FALLBACK = {
  population: "인", wheat: "밀", bread: "빵", logs: "목",
  timber: "재", stone_raw: "암", stone: "석", coin: "금",
} as const satisfies Record<ResourceArtworkKind, string>;

/** UX-2: the kinds the P0 resource sheet paints (24 px); the others keep their runtime-icons-v1 picture. */
const SHEET_CELL = { population: "population", bread: "bread", timber: "timber", stone: "stone", coin: "coin" } as const;

export function ResourceArtwork({ kind, small = false }: {
  readonly kind: ResourceArtworkKind;
  readonly small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const className = small ? "resource-artwork resource-artwork--small" : "resource-artwork resource-bar__icon";
  if (!small && kind in SHEET_CELL) return <UiIcon sheet="resource" cell={SHEET_CELL[kind as keyof typeof SHEET_CELL]} className={className} />;
  return failed
    ? <span className={className} aria-hidden="true">{FALLBACK[kind]}</span>
    : <img className={className} width={32} height={32} alt="" aria-hidden="true"
        src={assetUrlForBase(`assets/runtime-icons-v1/${kind}.png`, import.meta.env?.BASE_URL ?? "/")}
        onError={() => setFailed(true)} />;
}
