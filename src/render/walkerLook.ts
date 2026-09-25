import type { GameState } from "../engine/engine.types";
import type { Walker } from "../agents/walker.types";
import type { ResourceType } from "../content/resourceConfig";
import { stateCalendar } from "../engine/scenarioState";
import { householdMembers, type MemberSex } from "../population/householdMembers";
import { boundaryHash, hashNumbers } from "../world/boundary/boundaryGeometry";
import { walkerSheetManifest, type walkerPropManifest } from "./walkerSheetManifest.generated";

// V2 walker looks (spec docs/design/walker-composer.md WC-1..WC-5): which sheet, sex, trade item and cloak a walker
// wears. Pure and derived from the saved state (nothing saved): the same state gives the same looks, before and after
// a save round trip.
//  - Occupation: the engine has three walker kinds; the render occupation reads the kind and the goods (WC-1).
//  - Sex: householdMembers (C3 LB-2) when the walker's home building is a counted house, else the walker's hash bit
//    (50:50). Walkers are workers, so a child or elder profile keeps its sex on the adult body (no child / elder art).
//  - Class band: weighted by occupation (WC-2), then the sheets of that band and sex, plus the occupation's own legacy
//    sheet for men, in a hash order.
//  - Near rejection (V1 rule, WC-3): a walker takes the first sheet of its order that no earlier living walker of the
//    same home building wears (earlier = spawned earlier, then id). Walkers of one building share its road, so they
//    are the ones that walk side by side; positions are not used, so a look never changes as walkers pass each other.

export type WalkerSheet = typeof walkerSheetManifest[number];
export type WalkerSheetId = WalkerSheet["id"];
export type WalkerClassBand = WalkerSheet["classBand"];
export type WalkerPropKind = keyof typeof walkerPropManifest;
export type WalkerOccupation = "builder" | "farmer" | "logger" | "quarryman" | "carter" | "coin_carter" | "distributor";

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
  farmer: [["labor", 1]],
  logger: [["labor", 3], ["artisan", 1]],
  quarryman: [["labor", 1]],
  carter: [["labor", 2], ["servant", 1], ["textile", 1]],
  coin_carter: [["merchant", 2], ["servant", 1]],
  distributor: [["servant", 2], ["merchant", 1], ["poor", 1]],
};

/** WC-1: legacy occupation art (holds its tool) joins the men's candidates of its own occupation only. */
const LEGACY_SHEET_BY_OCCUPATION: Readonly<Partial<Record<WalkerOccupation, WalkerSheetId>>> = {
  builder: "legacy_builder", farmer: "legacy_farmer", logger: "legacy_logger", quarryman: "legacy_carter", carter: "legacy_carter",
};
/** The templates are the civilian / merchant / cleric bodies the reskins were painted over: never drawn themselves. */
const TEMPLATE_SHEETS: ReadonlySet<WalkerSheetId> = new Set(["legacy_civilian_man", "legacy_civilian_woman", "legacy_merchant", "legacy_cleric"]);

const SHEETS_BY_ID: ReadonlyMap<WalkerSheetId, WalkerSheet> = new Map(walkerSheetManifest.map(sheet => [sheet.id, sheet]));
export function walkerSheet(id: WalkerSheetId): WalkerSheet {
  const sheet = SHEETS_BY_ID.get(id);
  if (sheet === undefined) throw new Error(`Unknown walker sheet ${id}`);
  return sheet;
}

const SALT = { sex: 1, band: 2, order: 3, trinket: 4, member: 5 } as const;
function walkerKey(walkerId: string): number {
  return hashNumbers(Array.from(walkerId, char => char.charCodeAt(0)));
}

export function walkerOccupation(walker: Walker): WalkerOccupation {
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

function weightedBand(weights: readonly (readonly [WalkerClassBand, number])[], hash: number): WalkerClassBand {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let pick = hash % total;
  for (const [band, weight] of weights) { if (pick < weight) return band; pick -= weight; }
  return weights[0]![0];
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
  if (band === "textile") return (roll & 1) === 0 ? "bundle_cloth" : "bundle_wool";
  if (band === "servant") return roll % 2 === 0 ? "jug" : null;
  return null;
}

const earlierFirst = (a: Walker, b: Walker) => a.spawnedTick - b.spawnedTick || a.id.localeCompare(b.id);

/** Looks of every walker of the state (pure: WC-1..WC-3). */
export function walkerLooks(state: Pick<GameState, "walkers" | "houses" | "seed">): ReadonlyMap<string, WalkerLook> {
  const looks = new Map<string, WalkerLook>();
  const byHome = new Map<string, Walker[]>();
  for (const walker of state.walkers) {
    const list = byHome.get(walker.homeBuildingId) ?? [];
    list.push(walker);
    byHome.set(walker.homeBuildingId, list);
  }
  for (const walkers of byHome.values()) {
    const worn = new Set<WalkerSheetId>();
    for (const walker of [...walkers].sort(earlierFirst)) {
      const key = walkerKey(walker.id);
      const occupation = walkerOccupation(walker);
      const sex = walkerSex(state, walker, key);
      const band = weightedBand(OCCUPATION_BANDS[occupation], boundaryHash(key, state.seed, SALT.band));
      const candidates = walkerCandidates(occupation, band, sex, key, state.seed);
      const sheetId = candidates.find(id => !worn.has(id)) ?? candidates[0]!;
      worn.add(sheetId);
      looks.set(walker.id, { sheetId, band, occupation, sex, trinket: trinketFor(band, key, state.seed) });
    }
  }
  return looks;
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
export function walkerCloak(state: Pick<GameState, "tick" | "scenarioId">, look: WalkerLook): "male" | "female" | null {
  return stateCalendar(state).season === 3 ? walkerSheet(look.sheetId).cloak : null;
}
