/**
 * FACTION-0 factions (spec docs/design/factions.md FX-*): who stands behind the petitions and the events — the overlord,
 * the Crown, two neighbouring lords, the bishop, two merchant houses of the town, the town community and the commons.
 * Values are integers; names are the period's proper nouns (the Korean copy is `factionCopy.ko.ts`).
 */
import type { Petitioner } from "./chapterConfig";

export type FactionKind = "overlord" | "crown" | "neighbour" | "church" | "merchant_house" | "town" | "commons";
export type FactionId = "overlord" | "crown" | "neighbour_1" | "neighbour_2" | "bishop" | "merchant_house_1" | "merchant_house_2" | "town" | "commons";

export interface FactionDef {
  readonly id: FactionId;
  readonly kind: FactionKind;
  /** FX-2: the relation a new game starts at (−100…100). */
  readonly startRelation: number;
  /** FX-2: `outside` leaders are the faction's own people (aging, dying, succeeded); `town` leaders are household heads. */
  readonly leaders: "outside" | "town";
}

export const FACTION_DEFS: readonly FactionDef[] = [
  { id: "overlord", kind: "overlord", startRelation: 20, leaders: "outside" },
  { id: "crown", kind: "crown", startRelation: 10, leaders: "outside" },
  { id: "neighbour_1", kind: "neighbour", startRelation: 0, leaders: "outside" },
  { id: "neighbour_2", kind: "neighbour", startRelation: 0, leaders: "outside" },
  { id: "bishop", kind: "church", startRelation: 10, leaders: "outside" },
  { id: "merchant_house_1", kind: "merchant_house", startRelation: 0, leaders: "town" },
  { id: "merchant_house_2", kind: "merchant_house", startRelation: 0, leaders: "town" },
  { id: "town", kind: "town", startRelation: 10, leaders: "town" },
  { id: "commons", kind: "commons", startRelation: 10, leaders: "town" },
];
export const FACTION_DEF_BY_ID: ReadonlyMap<FactionId, FactionDef> = new Map(FACTION_DEFS.map(def => [def.id, def]));

/** FX-3: whose petition it is — the petitioner stands for a faction (the refugees come under the bishop's letter). */
export const FACTION_OF_PETITIONER: Readonly<Record<Petitioner, FactionId>> = {
  merchants: "merchant_house_1", overlord: "overlord", crown: "crown", townsfolk: "town", refugees: "bishop",
};

/** FX-1: the seed picks the overlord's earldom, the neighbours' houses and the see (names in English, the period's proper nouns). */
export const EARLDOMS: readonly { readonly title: string; readonly surname: string }[] = [
  { title: "Arundel", surname: "FitzAlan" }, { title: "Warwick", surname: "Beauchamp" }, { title: "Hereford", surname: "de Bohun" },
  { title: "Pembroke", surname: "de Valence" }, { title: "Oxford", surname: "de Vere" }, { title: "Devon", surname: "Courtenay" },
];
export const NEIGHBOUR_HOUSES: readonly string[] = ["Basset", "Zouche", "Lovel", "Scrope", "Willoughby", "Berkeley", "Talbot", "Grey"];
export const SEES: readonly string[] = ["Lincoln", "Winchester", "Exeter", "Salisbury", "Worcester", "Norwich"];
export const BISHOP_SURNAMES: readonly string[] = ["de Gravesend", "de Stratford", "de Grandisson", "de Wyvil", "de Cobham", "de Ayremynne"];

/** FX-5: England's kings 1272–1461, the Crown's leaders by the calendar (not the seed). */
export const KINGS: readonly { readonly name: string; readonly born: number; readonly from: number; readonly until: number }[] = [
  { name: "Edward I", born: 1239, from: 1272, until: 1307 }, { name: "Edward II", born: 1284, from: 1307, until: 1327 },
  { name: "Edward III", born: 1312, from: 1327, until: 1377 }, { name: "Richard II", born: 1367, from: 1377, until: 1399 },
  { name: "Henry IV", born: 1367, from: 1399, until: 1413 }, { name: "Henry V", born: 1386, from: 1413, until: 1422 },
  { name: "Henry VI", born: 1421, from: 1422, until: 1461 },
];

/** FX-5: the world's fixed events 1300–1450 (year, id); the Korean lines are `factionCopy.ko.ts`. */
export const WORLD_EVENTS: readonly { readonly year: number; readonly id: string; readonly factionId: FactionId }[] = [
  { year: 1307, id: "edward_ii", factionId: "crown" }, { year: 1314, id: "bannockburn", factionId: "crown" },
  { year: 1315, id: "great_famine", factionId: "bishop" }, { year: 1322, id: "boroughbridge", factionId: "overlord" },
  { year: 1327, id: "edward_iii", factionId: "crown" }, { year: 1337, id: "hundred_years_war", factionId: "crown" },
  { year: 1340, id: "sluys", factionId: "crown" }, { year: 1346, id: "crecy", factionId: "crown" },
  { year: 1348, id: "black_death", factionId: "bishop" }, { year: 1351, id: "statute_of_labourers", factionId: "crown" },
  { year: 1356, id: "poitiers", factionId: "crown" }, { year: 1361, id: "second_pestilence", factionId: "bishop" },
  { year: 1377, id: "richard_ii", factionId: "crown" }, { year: 1381, id: "peasants_revolt", factionId: "commons" },
  { year: 1399, id: "henry_iv", factionId: "crown" }, { year: 1413, id: "henry_v", factionId: "crown" },
  { year: 1415, id: "agincourt", factionId: "crown" }, { year: 1422, id: "henry_vi", factionId: "crown" },
  { year: 1450, id: "cade_rebellion", factionId: "commons" },
];

/** FX-5: each year, each outside faction has this chance (permille) of one of its kind's own events. */
export const FACTION_EVENT_PERMILLE = 250;
export const FACTION_EVENTS: Readonly<Record<"overlord" | "neighbour" | "church", readonly string[]>> = {
  overlord: ["tournament", "summons", "marriage", "feud"],
  neighbour: ["marriage", "feud", "new_hall", "lawsuit"],
  church: ["visitation", "new_abbot", "relic", "synod"],
};

/**
 * FX-4: how answers and events move a faction's relation (a memory each). Petitions: by the petition's faction.
 * The famine's answer: the commons and the bishop. A decline: the overlord for arrears, the town for dereliction; a
 * right bought back: its holder. The raid: the town, by whether its walls held.
 */
export const RELATION_RULES = {
  petition: { accept: 10, accept_with_price: 3, refuse: -15, expired: -10 },
  crown: { accept: 5, accept_with_price: 5, refuse: -20, expired: -20 },
  famine: { relief: { commons: 15, bishop: 10 }, price_control: { commons: 5, bishop: 0 }, laissez_faire: { commons: -10, bishop: -5 },
    speculation: { commons: -20, bishop: -15 } },
  declineArrears: -20,
  declineDerelict: -10,
  restored: 10,
  raidHeld: 5,
  raidBreached: -10,
  /** FX-4: a new lord's house: every outside faction's relation goes halfway back to where it started. */
  houseChangePermille: 500,
} as const;
