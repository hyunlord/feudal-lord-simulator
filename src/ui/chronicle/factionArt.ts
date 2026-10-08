import type { CSSProperties } from "react";
import type { FactionKind } from "../../content/factionConfig";
import type { UI_PART_ART } from "../lord/uiPartArt";

// INSTALL-18 (Wave 14 leftovers): the faction tab's panel and the faction-kind icons, from the art contract (catalog
// bundle `ui-wave14-factions`, scripts/installIn18W14.py). An icon goes only where Astra's subject is the engine's kind
// (FACTION_KINDS, docs/design/factions.md FX-1; the icon prompts in assets-inbox/wave14/candidates-v1/records/
// metadata-icons.json):
// - crown → icon_faction_crown ("Crown faction: a … crown"); church (the bishop) → icon_faction_church (a bishop's mitre);
// - merchant_house → icon_faction_merchant_elite ("Merchant elite faction": the town's merchant houses are FACTION-0's
//   take on the research's 상인 엘리트, docs/design/factions.md:5);
// - town (도시 공동체) → icon_faction_commune ("Community faction: three … townspeople").
// overlord, neighbour and commons have no icon and keep the current look; icon_faction_lord_household ("estate
// administration") is no faction kind — the lord's own house is not one of the nine — so it is not installed.
export const FACTION_KIND_ICON: Readonly<Partial<Record<FactionKind, string>>> = {
  crown: "wave14.faction.crown", church: "wave14.faction.church", merchant_house: "wave14.faction.merchant_elite", town: "wave14.faction.commune",
};
export const FACTION_PANEL_FRAME = "wave14.faction.panel";
/** Every part the faction tab and page draw (useUiParts loads them once; a part not ready keeps the current look). */
export const FACTION_ART_PARTS: readonly string[] = [FACTION_PANEL_FRAME, ...Object.values(FACTION_KIND_ICON)];

/** The kind's icon at `size` CSS px (24 on the tab's rows, 32 on the page), or null: no icon, or not loaded. */
export function factionKindIcon(art: typeof UI_PART_ART, kind: FactionKind, size: 24 | 32): CSSProperties | null {
  const id = FACTION_KIND_ICON[kind];
  return id === undefined ? null : art.image(id, size);
}
