import type { GameState } from "../engine/engine.types";
import type { Walker } from "../agents/walker.types";
import type { ResourceType } from "../content/resourceConfig";
import { stateCalendar } from "../engine/scenarioState";
import { householdMembers, type MemberSex } from "../population/householdMembers";
import { boundaryHash, hashNumbers } from "../world/boundary/boundaryGeometry";
import { walkerSheetManifest, type walkerCloakManifest, type walkerPropManifest } from "./walkerSheetManifest.generated";

// V2 walker looks (spec docs/design/walker-composer.md WC-1..WC-5): which sheet, sex, trade item and cloak a walker
// wears. Pure and derived from the saved state (nothing saved): the same state gives the same looks, before and after
// a save round trip.
//  - Occupation: the engine has three walker kinds; the render occupation reads the kind and the goods (WC-1).
//  - Sex: householdMembers (C3 LB-2) when the walker's home building is a counted house, else the walker's hash bit
//    (50:50). Walkers are workers, so a child or elder profile keeps its sex on the adult body (no child / elder art).
//  - Sheet (WC-2, WC-3): one weighted draw over the sheets of the occupation's class bands for that sex (plus the
//    occupation's own legacy sheet for men); no near rejection, see walkerLook.

export type WalkerSheet = typeof walkerSheetManifest[number];
export type WalkerSheetId = WalkerSheet["id"];
export type WalkerClassBand = WalkerSheet["classBand"];
export type WalkerPropKind = keyof typeof walkerPropManifest;
/** Winter cloaks: men's and women's (Wave 5a) and the merchant's (Wave 4e, merchant template bodies only). */
export type WalkerCloakKind = keyof typeof walkerCloakManifest;
export type WalkerOccupation = "builder" | "farmer" | "logger" | "quarryman" | "carter" | "coin_carter" | "distributor"
  | "water_fetcher" | "marketgoer" | "churchgoer" | "field_hand" | "market_visitor" | "clergy" | "guard" | "child_companion";

export interface WalkerLook {
  readonly sheetId: WalkerSheetId;
  readonly band: WalkerClassBand;
  readonly occupation: WalkerOccupation;
  readonly sex: MemberSex;
  /** Carried when the hands are free and there is no tool for the occupation (textile bundles, a servant's jug). */
  readonly trinket: WalkerPropKind | null;
}

/** WC-2: class band weights per occupation. Bands with no walking occupation yet (gentry, clergy, visitors) wait for C3 / E. */
export const OCCUPATION_BANDS: Readonly<Record<WalkerOccupation, readonly (readonly [WalkerClassBand, number])[]>> = {
  builder: [["artisan", 3], ["labor", 1]],
  farmer: [["labor", 4], ["servant", 1], ["poor", 1]],
  logger: [["labor", 3], ["artisan", 1]],
  quarryman: [["labor", 3], ["poor", 1]],
  carter: [["labor", 2], ["servant", 1], ["textile", 1]],
  coin_carter: [["merchant", 2], ["servant", 1]],
  distributor: [["servant", 2], ["merchant", 1], ["poor", 1]],
  water_fetcher: [["servant", 2], ["labor", 2], ["poor", 1]],
  marketgoer: [["merchant", 2], ["artisan", 2], ["textile", 1], ["servant", 1], ["gentry", 1]],
  churchgoer: [["labor", 2], ["artisan", 1], ["merchant", 1], ["gentry", 1], ["textile", 1], ["servant", 1], ["poor", 1]],
  field_hand: [["labor", 3], ["poor", 1], ["servant", 1]],
  market_visitor: [["visitor", 3], ["poor", 1], ["textile", 1]],
  clergy: [["priest", 2], ["monk", 1], ["nun", 1]],
  guard: [["guard", 1]],
  child_companion: [["child", 1]],
};
/** INSTALL-5c: an elder of the household walks in an elder body whatever the errand (Wave 5c elder reskins). */
export const ELDER_BANDS: readonly (readonly [WalkerClassBand, number])[] = [["elder", 1]];

/** WC-1: legacy occupation art (holds its tool) joins the men's candidates of its own occupation only. */
const LEGACY_SHEET_BY_OCCUPATION: Readonly<Partial<Record<WalkerOccupation, WalkerSheetId>>> = {
  builder: "legacy_builder", farmer: "legacy_farmer", logger: "legacy_logger", quarryman: "legacy_carter", carter: "legacy_carter",
  field_hand: "legacy_farmer", guard: "legacy_guard",
};
/** The templates are the civilian / merchant / cleric bodies the reskins were painted over: never drawn themselves. */
const TEMPLATE_SHEETS: ReadonlySet<WalkerSheetId> = new Set(["legacy_civilian_man", "legacy_civilian_woman", "legacy_merchant", "legacy_cleric"]);

const SHEETS_BY_ID: ReadonlyMap<WalkerSheetId, WalkerSheet> = new Map(walkerSheetManifest.map(sheet => [sheet.id, sheet]));
export function walkerSheet(id: WalkerSheetId): WalkerSheet {
  const sheet = SHEETS_BY_ID.get(id);
  if (sheet === undefined) throw new Error(`Unknown walker sheet ${id}`);
  return sheet;
}

const SALT = { sex: 1, sheet: 2, order: 3, trinket: 4, member: 5 } as const;
function walkerKey(walkerId: string): number {
  return hashNumbers(Array.from(walkerId, char => char.charCodeAt(0)));
}

export function walkerOccupation(walker: Walker): WalkerOccupation {
  if ("resident" in walker) return (walker as { readonly resident: { readonly occupation: WalkerOccupation } }).resident.occupation;
  if (walker.kind === "builder") return "builder";
  if (walker.kind === "distributor") return "distributor";
  return occupationForResource(walker.cargo?.resource ?? walker.reservation.resource);
}

function occupationForResource(resource: ResourceType): WalkerOccupation {
  switch (resource) {
    case "wheat": case "bread": return "farmer";
    case "logs": case "timber": return "logger";
    case "stone_raw": case "stone": return "quarryman";
    case "coin": return "coin_carter";
  }
}

function walkerSex(state: Pick<GameState, "houses" | "seed">, walker: Walker, key: number): MemberSex {
  const household = householdMembers(state, walker.homeBuildingId);
  const adults = household?.members.filter(member => member.ageBand !== "child") ?? [];
  if (adults.length > 0) return adults[boundaryHash(key, state.seed, SALT.member) % adults.length]!.sex;
  return (boundaryHash(key, state.seed, SALT.sex) & 1) === 0 ? "female" : "male";
}

/** The candidate sheets of a walker, in its own hash order (deterministic shuffle of the band's sheets). */
export function walkerCandidates(occupation: WalkerOccupation, band: WalkerClassBand, sex: MemberSex, key: number, seed: number): readonly WalkerSheetId[] {
  const legacy = LEGACY_SHEET_BY_OCCUPATION[occupation];
  const sheets = walkerSheetManifest.filter(sheet => sheet.classBand === band && sheet.sex === sex && !sheet.legacy && !TEMPLATE_SHEETS.has(sheet.id))
    .map(sheet => sheet.id as WalkerSheetId);
  if (legacy !== undefined && sex === "male" && walkerSheet(legacy).classBand === band) sheets.push(legacy);
  return sheets.map(id => ({ id, rank: boundaryHash(key ^ hashNumbers(Array.from(id, char => char.charCodeAt(0))), seed, SALT.order) }))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)).map(entry => entry.id);
}

function trinketFor(band: WalkerClassBand, key: number, seed: number): WalkerPropKind | null {
  const roll = boundaryHash(key, seed, SALT.trinket);
  // Wave 4e adds the yarn bundle to the textile band and the ale jug to the servants (a third each; the rest as before).
  if (band === "textile") return (["bundle_cloth", "bundle_wool", "yarn_bundle"] as const)[roll % 3]!;
  if (band === "servant") return (["jug", "ale_jug", null] as const)[roll % 3]!;
  return null;
}

/**
 * WC-3: which sheet a walker wears. Only the walker's own saved facts count (id, home, goods), never the other
 * walkers: a rule that looked at them (the V1 near rejection) changes a look whenever a neighbour spawns, leaves or
 * walks by, and so either flips a walker's clothes mid-walk or shows another look after a reload (measured on the seed
 * 2 city: docs/verification/v2-walkers/REPORT.md, gate 2). Instead the pool is made wide: one weighted draw over the
 * sheets of every band of the occupation (a sheet weighs its band's weight over the band's sheet count for that sex),
 * so two walkers of one occupation share a sheet with probability sum(p^2) (0.20-0.33 for the wheat carters, against
 * 0.5 for the two women's labour sheets alone).
 */
export function walkerLook(state: Pick<GameState, "houses" | "seed">, walker: Walker): WalkerLook {
  const key = walkerKey(walker.id);
  const occupation = walkerOccupation(walker);
  // INSTALL-5c: a household member's age band (MOVE-1 tag): a child companion wears its own sex, an elder the elder bodies.
  const member = "resident" in walker ? (walker as { readonly resident: { readonly ageBand: string; readonly sex: MemberSex } }).resident : null;
  const sex = member?.ageBand === "child" ? member.sex : walkerSex(state, walker, key);
  const bands = member?.ageBand === "elder" ? ELDER_BANDS : OCCUPATION_BANDS[occupation];
  const pool = bands.flatMap(([band, weight]) => {
    const sheets = walkerCandidates(occupation, band, sex, key, state.seed);
    return sheets.map(sheetId => ({ sheetId, weight: weight / sheets.length }));
  });
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let pick = (boundaryHash(key, state.seed, SALT.sheet) / 2 ** 32) * total;
  const chosen = pool.find(entry => (pick -= entry.weight) < 0) ?? pool[pool.length - 1]!;
  const band = walkerSheet(chosen.sheetId).classBand;
  return { sheetId: chosen.sheetId, band, occupation, sex, trinket: trinketFor(band, key, state.seed) };
}

/** Looks of every walker of the state (pure). */
export function walkerLooks(state: Pick<GameState, "walkers" | "houses" | "seed">): ReadonlyMap<string, WalkerLook> {
  return new Map(state.walkers.map(walker => [walker.id, walkerLook(state, walker)]));
}

/**
 * WC-4: the held prop, per frame (the goods change along a trip). The legacy occupation art already holds its tool;
 * bread is carried as a loaf; other goods keep the cargo marker; free hands carry the occupation's tool (builder:
 * hammer, logger: axe) or the look's trinket.
 */
export function walkerHeldProp(look: WalkerLook, walker: Walker): WalkerPropKind | null {
  if (walkerSheet(look.sheetId).holdsTool) return null;
  if (walker.cargo !== null) return walker.cargo.resource === "bread" ? "loaf" : null;
  if (look.occupation === "builder") return "tool_hammer";
  if (look.occupation === "logger") return "tool_axe";
  return look.trinket;
}

/** WC-5: calendar winter (season 3, 1,000 ticks of the 4,000-tick year): the sheet's cloak, if it takes one. */
export function walkerCloak(state: Pick<GameState, "tick" | "scenarioId">, look: WalkerLook): WalkerCloakKind | null {
  return stateCalendar(state).season === 3 ? walkerSheet(look.sheetId).cloak : null;
}
