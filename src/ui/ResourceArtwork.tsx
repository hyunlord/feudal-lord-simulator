import { resourceEntry } from "../content/resourceCatalog";
import { resourceName } from "../content/resourceCatalog.ko";
import type { ResourceType } from "../content/resourceConfig";
import { assetUrlForBase } from "../render/worldAssets";
import { resourceChainIconStyle } from "./resourceChainArt";
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
  // INSTALL-3: the ale chain's goods from the Wave 3 chain sheet.
  const chain = resourceEntry(kind).chainCell;
  if (chain !== undefined) return <span className={`ui-icon ${className}`} aria-hidden="true" data-icon={`chain.${chain}`} style={resourceChainIconStyle(chain, 24)} />;
  if (small) return null;
  return (
    <span className="resource-artwork-generic" aria-hidden="true">
      <img className={className} width={32} height={32} alt="" src={art(GENERIC_ART[resourceEntry(kind).storage])} />
      <span className="resource-name-chip">{resourceName(kind)}</span>
    </span>
  );
}

/**
 * INSTALL-3: a good's icon beside its name in a list (the ledger drawer, the season card, the placement chip, the stores):
 * the UX-2 sheet's cell or the Wave 3 chain sheet's, else nothing (the name beside it says what it is). Decorative.
 * 16 px (a text line's height) draws the UX-2 cell from its 24 px copy scaled down, as the bar's second line does.
 */
export function ResourceGlyph({ resource, size = 24 }: { readonly resource: ResourceType; readonly size?: 16 | 24 | 32 }) {
  const entry = resourceEntry(resource);
  const className = size === 16 ? "resource-glyph resource-glyph--16" : "resource-glyph";
  if (entry.sheetCell !== undefined) return <UiIcon sheet="resource" cell={entry.sheetCell} size={size === 16 ? 24 : size} className={className} />;
  if (entry.chainCell === undefined) return null;
  return <span className="ui-icon resource-glyph" aria-hidden="true" data-icon={`chain.${entry.chainCell}`} style={resourceChainIconStyle(entry.chainCell, size)} />;
}
