import { resourceEntry } from "../content/resourceCatalog";
import { resourceName } from "../content/resourceCatalog.ko";
import type { ResourceType } from "../content/resourceConfig";
import { assetUrlForBase } from "../render/worldAssets";
import { UiIcon } from "./UiIcon";

export type ResourceArtworkKind = ResourceType | "population";

/** RES-REG: a good with no picture of its own (or whose picture failed) shows the Wave 7 sacks or crates and its name. */
const GENERIC_ART = { granary: "assets/wave7/pile/sacks_1-v1.png", storehouse: "assets/wave7/pile/crates_1-v1.png", none: "assets/wave7/pile/crates_1-v1.png" } as const;

const art = (path: string) => assetUrlForBase(path, import.meta.env?.BASE_URL ?? "/");

export function ResourceArtwork({ kind, small = false }: {
  readonly kind: ResourceArtworkKind;
  readonly small?: boolean;
}) {
  const className = small ? "resource-artwork resource-artwork--small" : "resource-artwork resource-bar__icon";
  // ASSET-2: every good the UX-2 resource sheet paints is drawn from it, at both sizes (the old runtime-icons-v1
  // pictures are retired). A good without a cell: at full size the generic sacks or crates and its name; small (the
  // bar's second line, which names it in words) no picture.
  if (kind === "population") return <UiIcon sheet="resource" cell="population" className={className} />;
  const cell = resourceEntry(kind).sheetCell;
  if (cell !== undefined) return <UiIcon sheet="resource" cell={cell} className={className} />;
  if (small) return null;
  return (
    <span className="resource-artwork-generic" aria-hidden="true">
      <img className={className} width={32} height={32} alt="" src={art(GENERIC_ART[resourceEntry(kind).storage])} />
      <span className="resource-name-chip">{resourceName(kind)}</span>
    </span>
  );
}
