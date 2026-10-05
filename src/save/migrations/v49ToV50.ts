/**
 * v50 is MANOR-1:
 * - MH-5: the manor house is 3×3 (`growManorHouse`): a v49 town's 2×2 grows in place where its new tiles are free, else
 *   moves to the nearest free 3×3, else the town keeps none.
 * - HOUSE-1: the player's house is the lord's first house (`lordship`), and the registry keeps no house of its own
 *   (`RegistryState.house` goes). A lord-mode save's chosen house (`registry.house`) becomes the first house — its name
 *   everywhere the save wrote the old one (the lord's family, the history, the ledger), its arms' id and the arms drawn
 *   from it. A save without a chosen house (the campaign, the sandbox) keeps the first house it had: one whose lordship
 *   was not yet written gets it written, by the seed as v49 named it.
 */
import { LORD_HOUSE_NAMES } from "../../content/lordshipConfig";
import type { GameState } from "../../engine/engine.types";
import type { LordHouse, LordshipState } from "../../engine/lordship.types";
import { armsHeraldrySeed } from "../../engine/lordshipState";
import { hashSeed } from "../../engine/prng";
import { growManorHouse } from "../../state/openingVillage";

/** v49's first house, by seed (FL-7 before MANOR-1): its arms were the game seed's. */
function v49FirstHouse(seed: number): LordHouse {
  return { order: 1, name: LORD_HOUSE_NAMES[hashSeed(seed, "lord-house:1") % LORD_HOUSE_NAMES.length]!, heraldrySeed: seed, since: 0 };
}

/** Every string value equal to `from` becomes `to` (the house's name as the save wrote it). */
function renamed(value: unknown, from: string, to: string): unknown {
  if (value === from) return to;
  if (Array.isArray(value)) return value.map(item => renamed(item, from, to));
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, renamed(inner, from, to)]));
  return value;
}

export function migrateV49ToV50(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v49 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v49 save has no state");
  type V49Registry = NonNullable<GameState["registry"]> & { readonly house?: { readonly name: string; readonly arms: string } };
  const before = growManorHouse(envelope.state as GameState) as GameState & { readonly registry?: V49Registry };
  const lordship: LordshipState = before.lordship ?? { house: v49FirstHouse(before.seed), pastHouses: [], titleDemoted: false, decline: null };
  const chosen = before.registry?.house;
  if (chosen === undefined) return { ...envelope, schemaVersion: 50, state: { ...before, lordship } };
  const { house: _house, ...registry } = before.registry!;
  const first = [lordship.house, ...lordship.pastHouses].find(house => house.order === 1);
  let state = { ...before, lordship, registry } as GameState;
  if (first !== undefined && first.name !== chosen.name) state = renamed(state, first.name, chosen.name) as GameState;
  const mark = (house: LordHouse): LordHouse => house.order !== 1 ? house
    : { ...house, name: chosen.name, arms: chosen.arms, heraldrySeed: armsHeraldrySeed(chosen.arms) };
  const marked = state.lordship!;
  return { ...envelope, schemaVersion: 50, state: { ...state, lordship: { ...marked, house: mark(marked.house), pastHouses: marked.pastHouses.map(mark) } } };
}
