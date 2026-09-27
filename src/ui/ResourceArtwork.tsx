import { useState } from "react";
import { resourceEntry } from "../content/resourceCatalog";
import { resourceName } from "../content/resourceCatalog.ko";
import type { ResourceType } from "../content/resourceConfig";
import { assetUrlForBase } from "../render/worldAssets";
import { RESOURCE_BAR_COPY } from "./resourceBarCopy.ko";
import { UiIcon } from "./UiIcon";

export type ResourceArtworkKind = ResourceType | "population";

/** RES-REG: a good with no picture of its own (or whose picture failed) shows the Wave 7 sacks or crates and its name. */
const GENERIC_ART = { granary: "assets/wave7/pile/sacks_1-v1.png", storehouse: "assets/wave7/pile/crates_1-v1.png", none: "assets/wave7/pile/crates_1-v1.png" } as const;

const art = (path: string) => assetUrlForBase(path, import.meta.env?.BASE_URL ?? "/");

export function ResourceArtwork({ kind, small = false }: {
  readonly kind: ResourceArtworkKind;
  readonly small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const className = small ? "resource-artwork resource-artwork--small" : "resource-artwork resource-bar__icon";
  // UX-2: the kinds the P0 resource sheet paints (24 px); the others keep their runtime-icons-v1 picture.
  const entry = kind === "population" ? null : resourceEntry(kind);
  const cell = kind === "population" ? "population" : entry?.sheetCell;
  if (!small && cell !== undefined) return <UiIcon sheet="resource" cell={cell} className={className} />;
  const icon = kind === "population" ? "population" : entry?.iconKey;
  if (icon !== undefined && !failed) {
    return <img className={className} width={32} height={32} alt="" aria-hidden="true"
      src={art(`assets/runtime-icons-v1/${icon}.png`)} onError={() => setFailed(true)} />;
  }
  return (
    <span className="resource-artwork-generic" aria-hidden="true">
      <img className={className} width={32} height={32} alt="" src={art(GENERIC_ART[entry?.storage ?? "none"])} />
      <span className="resource-name-chip">{kind === "population" ? RESOURCE_BAR_COPY.populationName : resourceName(kind)}</span>
    </span>
  );
}
