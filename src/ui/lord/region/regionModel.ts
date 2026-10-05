import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import type { ArtPoint, RegionalMapEntry } from "../../../render/art/artContract";
import type { GameState } from "../../../engine/engine.types";
import { estatePerson, estatePortfolio, estatesOf, LORD } from "../../../engine/estates";
import type { Estate, EstateKind, HolderId } from "../../../engine/estates.types";
import { lordHouse } from "../../../engine/lordshipState";
import { oversightViews } from "../../../engine/stewardship";
import { HOME_ESTATE_ID } from "../../../content/estateConfig";
import type { EmblemSpec } from "../../heraldry/EmblemImage";
import { heraldryArms } from "../../heraldry/heraldry";
import { moneyShort } from "../../money.ko";
import { lordHouseArms } from "../../persons/personModels";
import { lordPersonRow } from "../screen/lordPortrait";
import { FLAG_ART, FLAG_BASE, SITE_ART, siteSlots } from "./regionArt";
import { REGION_COPY as COPY } from "./regionCopy.ko";

// LM-R2 (region area): the region map's view model — pure, from the engine's read models only (estatesOf, oversightViews,
// estatePortfolio): which estates stand on the map, which site picture and flag each wears, where its slot is, whose
// arms go on the flag's empty base, and the chosen estate's line. No engine rule is copied here.

/** The flag on an estate: held by the lord and overseen by him, held and given to a steward, or another's. */
export type RegionFlag = "direct" | "delegated" | "neighbour";
/** The site pictures the engine's estate kinds map to (the abbey waits for a religious house: LM-E10). */
export type RegionSite = "manor" | "market" | "mill";
/** The map's own zoom (apart from the town's): the whole map in the screen, then half and full picture size. */
export type RegionZoom = "fit" | "half" | "full";
export const REGION_ZOOMS: readonly RegionZoom[] = ["fit", "half", "full"];

export const SITE_OF_KIND: Readonly<Record<EstateKind, RegionSite | null>> = { manor: "manor", market_town: "market", mill_estate: "mill", fishery: null };

/** A house or estate by its Korean reading (GENTRY_NAMES_KO, as the other lord screens): the map labels say the house's
 * reading alone (short at 12 px), the chosen estate's line "<reading> 영지". */
const ko = (name: string): string => GENTRY_NAMES_KO[name] ?? name;

/** ES-1 holders: the lord, a faction (a neighbour house), a neighbour estate's own house, a person (an heir). */
export function holderLabel(state: GameState, holder: HolderId): string {
  if (holder === LORD) return COPY.lordHouse(ko(lordHouse(state).name));
  const faction = state.factions?.factions.find(entry => entry.id === holder);
  if (faction !== undefined) return COPY.lordHouse(ko(faction.name));
  if (holder.startsWith("estate:")) {
    const house = estatesOf(state).estates.find(estate => estate.id === holder.slice("estate:".length))?.house;
    if (house !== undefined) return COPY.lordHouse(ko(house.name));
  }
  if (holder.startsWith("person:")) {
    const person = estatePerson(state, holder.slice("person:".length));
    if (person !== undefined) return lordPersonRow(state, person).name;
  }
  return COPY.holders[holder] ?? COPY.otherHolder;
}

/**
 * The flag: an estate another possesses is a neighbour's; the home estate is the lord's seat, ruled in person (the engine
 * keeps oversight only for estates off the map, SW-2); an estate off the map the lord possesses is delegated when its
 * oversight gives it to a steward, else direct.
 */
export function regionFlag(state: GameState, estate: Pick<Estate, "id" | "possessor">): RegionFlag {
  if (estate.possessor !== LORD) return "neighbour";
  if (estate.id === HOME_ESTATE_ID) return "direct";
  return oversightViews(state).find(view => view.estateId === estate.id)?.oversight.mode === "steward" ? "delegated" : "direct";
}

/** The arms on the flag's base: the ruling house's on what the lord possesses, a neighbour house's (by its heraldry seed)
 * on its own; none for a house the engine gives no arms (the old lord's, an heir's) — the base stays empty. */
export function regionArms(state: GameState, estate: Pick<Estate, "possessor">): { readonly emblem: EmblemSpec; readonly house: string } | null {
  if (estate.possessor === LORD) return { emblem: lordHouseArms(state), house: ko(lordHouse(state).name) };
  const faction = state.factions?.factions.find(entry => entry.id === estate.possessor);
  return faction === undefined ? null : { emblem: { kind: "arms", recipe: heraldryArms(faction.heraldrySeed) }, house: ko(faction.name) };
}

type Slot = ReturnType<typeof siteSlots>[number];
/**
 * Each estate's slot on the map: first the slot the records' assembly put its own site picture on, then the first free
 * slot in the records' order (the home market town on the market's place, the mill estate on the river mill's, the first
 * manor on the manor's, the second manor on the place the proof gave the abbey). Without a slot an estate is listed only.
 */
export function assignSlots(estates: readonly Pick<Estate, "id" | "kind">[], slots: readonly Slot[]): ReadonlyMap<string, Slot> {
  const taken = new Map<string, Slot>();
  const free = (slot: Slot) => ![...taken.values()].includes(slot);
  for (const estate of estates) {
    const own = slots.find(slot => slot.id === SITE_OF_KIND[estate.kind] && free(slot));
    if (own !== undefined) taken.set(estate.id, own);
  }
  for (const estate of estates) {
    if (taken.has(estate.id)) continue;
    const next = slots.find(free);
    if (next !== undefined) taken.set(estate.id, next);
  }
  return taken;
}

export interface RegionEstateView {
  readonly estateId: string;
  readonly home: boolean;
  readonly name: string;
  /** The map label: the name and the flag's word. */
  readonly label: string;
  readonly kind: string;
  readonly site: RegionSite | null;
  readonly flag: RegionFlag;
  readonly slot: Slot | null;
  readonly arms: { readonly emblem: EmblemSpec; readonly house: string } | null;
}

/** The map's estates (every estate the engine has, in its order), each with its flag, site, slot and arms. */
export function regionEstates(state: GameState, map: Pick<RegionalMapEntry, "slots"> | null): readonly RegionEstateView[] {
  const estates = estatesOf(state).estates;
  const slots = assignSlots(estates, siteSlots(map));
  return estates.map(estate => {
    const home = estate.id === HOME_ESTATE_ID;
    const flag = regionFlag(state, estate);
    const name = home ? COPY.home : ko(estate.name);
    return { estateId: estate.id, home, name, label: COPY.label(name, COPY.flags[flag]), kind: COPY.kinds[estate.kind],
      site: SITE_OF_KIND[estate.kind], flag, slot: slots.get(estate.id) ?? null, arms: regionArms(state, estate) };
  });
}

export interface RegionChosenView {
  readonly estateId: string;
  readonly name: string;
  readonly rows: readonly { readonly key: keyof typeof COPY.rows; readonly value: string }[];
}

/** The chosen estate's line under the map: its kind, flag, possessor (and title holder when apart), steward, year's
 * worth (ES-10's portfolio value) and the pieces of it the lord holds when the estate is another's. */
export function regionChosen(state: GameState, estateId: string): RegionChosenView | null {
  const view = estatePortfolio(state).find(estate => estate.id === estateId);
  if (view === undefined) return null;
  const flag = regionFlag(state, view);
  const oversight = oversightViews(state).find(entry => entry.estateId === estateId);
  const steward = flag === "delegated" && oversight?.steward !== undefined ? estatePerson(state, oversight.steward.personId) : undefined;
  const lordPieces = view.possessor === LORD ? [] : view.pieces.filter(piece => piece.possessor === LORD).map(piece => COPY.pieces[piece.kind]);
  const rows: { key: keyof typeof COPY.rows; value: string }[] = [
    { key: "kind", value: COPY.kinds[view.kind] },
    { key: "flag", value: COPY.flagRow(COPY.flags[flag], COPY.flagLines[flag]) },
    { key: "possessor", value: holderLabel(state, view.possessor) },
  ];
  if (view.titleHolder !== view.possessor) rows.push({ key: "title", value: holderLabel(state, view.titleHolder) });
  if (steward !== undefined) rows.push({ key: "steward", value: lordPersonRow(state, steward).name });
  rows.push({ key: "value", value: moneyShort(view.annualValue) });
  if (lordPieces.length > 0) rows.push({ key: "lordPieces", value: lordPieces.join(", ") });
  return { estateId, name: view.id === HOME_ESTATE_ID ? COPY.home : COPY.estateName(ko(view.name)), rows };
}

/** The markers' size at each zoom (CSS px per source px): half size at the whole map and at half zoom (the declared
 * 48 px site, 32 px flag), the picture's own size at full zoom — so the sites stay legible on the fitted map. */
export const MARKER_SCALE: Readonly<Record<RegionZoom, 0.5 | 1>> = { fit: 0.5, half: 0.5, full: 1 };
/** The map's width at each zoom: the screen's width, then half and full picture size (CSS px). */
export const MAP_WIDTH: Readonly<Record<Exclude<RegionZoom, "fit">, number>> = { half: 800, full: 1600 };

type Box = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
export interface MarkerLayout {
  /** The art box (CSS px) around the slot point; the point sits at (anchorX, anchorY) inside it. */
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly site: Box | null;
  readonly flag: Box | null;
  /** The arms on the flag's empty base (a square inside it), when the estate has arms and a flag. */
  readonly arms: Box | null;
}

/**
 * A marker's pieces at one scale: the site picture on its foot at the slot, the flag on its pole's foot where the records'
 * assembly stood it (the flag slot's offset from the site slot, at the marker's scale), the arms on the flag's empty base.
 * The art box is symmetric about the slot point, so the label can centre under it.
 */
export function markerLayout(slot: Pick<Slot, "site" | "flag">, scale: number, flag: RegionFlag | null, hasSite: boolean, hasArms: boolean): MarkerLayout {
  const at = (point: ArtPoint, pivot: ArtPoint, width: number, height: number): Box =>
    ({ left: Math.round(point.x - pivot.x * scale), top: Math.round(point.y - pivot.y * scale), width: width * scale, height: height * scale });
  const site = hasSite ? at({ x: 0, y: 0 }, SITE_ART.pivot, SITE_ART.width, SITE_ART.height) : null;
  const flagFoot = slot.flag === null ? null : { x: (slot.flag.x - slot.site.x) * scale, y: (slot.flag.y - slot.site.y) * scale };
  const flagBox = flag === null || flagFoot === null ? null : at(flagFoot, FLAG_ART.pivot, FLAG_ART.width, FLAG_ART.height);
  const base = flag === null || flagBox === null || !hasArms ? null : FLAG_BASE[flag];
  const side = base === null ? 0 : Math.floor(Math.min(base.width, base.height) * scale);
  const arms = base === null || flagBox === null ? null : {
    left: Math.round(flagBox.left + (base.x + base.width / 2) * scale - side / 2), top: Math.round(flagBox.top + (base.y + base.height / 2) * scale - side / 2), width: side, height: side };
  const boxes = [site, flagBox].filter((box): box is Box => box !== null);
  const half = Math.max(22, ...boxes.flatMap(box => [-box.left, box.left + box.width]));
  const top = Math.min(-22, ...boxes.map(box => box.top));
  const bottom = Math.max(22, ...boxes.map(box => box.top + box.height));
  const shift = (box: Box | null): Box | null => box === null ? null : { ...box, left: box.left + Math.ceil(half), top: box.top - top };
  return { width: Math.ceil(half) * 2, height: bottom - top, anchorX: Math.ceil(half), anchorY: -top, site: shift(site), flag: shift(flagBox), arms: shift(arms) };
}
